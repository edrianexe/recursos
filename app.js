/* ============================================================================
   EDRIAN.EXE · LANDING — lógica de captura
   - Valida email + consentimiento
   - Envía a Kit con kit.js (formulario público, sin servidor)
   - Redirige a gracias.html (descarga + "revisa tu correo")
   ============================================================================ */

(function () {
  "use strict";

  // Año del footer
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Reveal on scroll
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });

  // Botón "volver arriba" del closer
  document.querySelectorAll("[data-scroll-top]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(function () { var i = document.getElementById("email"); if (i) i.focus(); }, 500);
    });
  });

  // ── Formulario ──────────────────────────────────────────────────────────
  var form    = document.getElementById("capture-form");
  var input   = document.getElementById("email");
  var consent = document.getElementById("consent");
  var btn     = document.getElementById("submit-btn");
  var msg     = document.getElementById("form-msg");

  if (!form) return;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setMsg(text, kind) {
    msg.textContent = text;
    msg.classList.remove("is-ok", "is-err");
    if (kind) msg.classList.add(kind);
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = (input.value || "").trim();

    input.classList.remove("is-error");

    if (!EMAIL_RE.test(email)) {
      input.classList.add("is-error");
      setMsg("Ese email no tiene buena pinta. Revísalo.", "is-err");
      input.focus();
      return;
    }
    if (!consent.checked) {
      setMsg("Marca la casilla de consentimiento para continuar.", "is-err");
      return;
    }

    btn.disabled = true;
    var original = btn.querySelector(".cta__label").textContent;
    btn.querySelector(".cta__label").textContent = "Enviando…";
    setMsg("", null);

    // UTM passthrough (para saber de dónde vienen las altas)
    var params = new URLSearchParams(window.location.search);
    var payload = {
      email: email,
      source: params.get("utm_source") || document.referrer || "directo",
      campaign: params.get("utm_campaign") || "stack-ia"
    };

    window.kitSubscribe(payload.email, payload.source, payload.campaign)
      .then(function (r) {
        if (r.ok) {
          // Guardamos el email por si gracias.html quiere personalizar
          try { sessionStorage.setItem("edrian_lead", email); } catch (e) {}
          window.location.href = "gracias.html";
        } else {
          throw new Error("error");
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.querySelector(".cta__label").textContent = original;
        setMsg("Algo ha fallado al apuntarte. Inténtalo en un momento o escríbeme a contacto@edrianexe.com.", "is-err");
      });
  });
})();
