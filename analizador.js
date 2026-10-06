/* ============================================================================
   EDRIAN.EXE · Analizador de Prompts
   Heurística 100% cliente (sin API, sin coste). Puntúa un prompt según los
   7 principios del Stack de IA, da feedback y reescribe una versión pro.
   El email se captura para el mismo embudo (kit.js -> Kit).
   ============================================================================ */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var yr = $("year"); if (yr) yr.textContent = new Date().getFullYear();

  // Animación de entrada (este archivo no carga app.js)
  try {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });
  } catch (e) {
    document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Quita acentos y pasa a minúsculas para que la heurística no falle con "escríbeme", "máximo", etc.
  function norm(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  var input = $("prompt-in");
  var hint  = $("char-hint");
  var btn   = $("analyze-btn");
  var res   = $("result");

  // contador
  input.addEventListener("input", function () {
    hint.textContent = input.value.trim().length + " caracteres";
  });

  // ── Definición de los 7 chequeos (heurística por señales) ─────────────────
  // Patrones en ASCII: el texto se normaliza con norm() (sin acentos) antes de testear.
  var CHECKS = [
    {
      key: "rol", name: "Rol asignado", pts: 15,
      test: function (t) { return /\b(actua como|comportate como|eres (un|una)|adopta el (rol|papel)|imagina que eres|ponte en el papel|as an?|act as)\b/.test(t); },
      okMsg: "Le das un rol. Bien: acotas el universo de respuestas.",
      noMsg: "No le asignas rol. Empieza con “Actúa como [experto en X]…” y sube el nivel al instante."
    },
    {
      key: "objetivo", name: "Tarea/objetivo claro", pts: 15,
      test: function (t) { return /\b(escrib|gener|crea|dame|hazme|\bhaz\b|analiz|resum|compar|disen|explic|traduc|redact|critic|mejora|conviert|necesito que|quiero que|ayudame a|dime|propon)/.test(t); },
      okMsg: "Hay un verbo de acción claro. Sabe qué quieres que haga.",
      noMsg: "No queda claro qué le pides que haga. Empieza con un verbo: “Escribe…”, “Analiza…”, “Compara…”."
    },
    {
      key: "contexto", name: "Contexto suficiente", pts: 18,
      test: function (t) {
        var words = t.trim().split(/\s+/).length;
        var hasData = /[\[\("]|\b\d+\b|para (mi|el|la|los|un)|mi (audiencia|publico|empresa|producto|marca|caso)|contexto:|el contexto es/.test(t);
        return words >= 25 && hasData;
      },
      okMsg: "Das contexto y datos. La IA no tiene que adivinar.",
      noMsg: "Te falta contexto. ¿Para quién? ¿Con qué datos? Pega lo que tengas: cuanto más concreto, mejor sale."
    },
    {
      key: "formato", name: "Formato de salida", pts: 14,
      test: function (t) { return /\b(en (tabla|lista|bullets|formato|json|markdown)|formato|maximo \d+|\d+ (palabras|bullets|puntos|frases|lineas)|en \d+|como (guion|tuit|hilo|email|carrusel|post)|estructura|en pasos|paso a paso)\b/.test(t); },
      okMsg: "Pides un formato concreto. Adiós al muro de texto.",
      noMsg: "No pides formato. Añade “en tabla”, “máximo 120 palabras” o “en 5 bullets” y controla la salida."
    },
    {
      key: "restricciones", name: "Restricciones/límites", pts: 14,
      test: function (t) { return /\b(no (uses|incluyas|menciones|quiero|me des)|evita|sin (tecnicismos|relleno|introducciones|humo|rodeos)|nada de|solo|unicamente|maximo|que no suene)\b/.test(t); },
      okMsg: "Marcas límites. Las restricciones suben la calidad y sacan a la IA del promedio.",
      noMsg: "No pones límites. Un simple “NO quiero ___” o “sin relleno” mejora muchísimo el resultado."
    },
    {
      key: "razonamiento", name: "Pide razonamiento", pts: 12,
      test: function (t) { return /\b(explica (el|tu|por que|brevemente)|razona|paso a paso|justifica|antes de (decidir|responder|concluir)|por que|piensa)\b/.test(t); },
      okMsg: "Le pides que razone. Así cazas errores que de otro modo no verías.",
      noMsg: "No le pides el porqué. Añade “explica tu razonamiento antes de concluir” para resultados más fiables."
    },
    {
      key: "verificacion", name: "Pide verificación", pts: 12,
      test: function (t) { return /\b(verifica|comprueba|que no puedas confirmar|nivel de confianza|cita (las )?fuentes|se esceptic|senala (que|las dudas)|incertidumbre|no inventes)\b/.test(t); },
      okMsg: "Pides verificación. Mi sello: desconfiar por defecto.",
      noMsg: "No pides verificación. Cierra con “señala qué no puedes confirmar con certeza”. La IA suena segura aunque se equivoque."
    }
  ];

  function analyze(text) {
    var total = 0, max = 0, results = [];
    var t = norm(text);
    CHECKS.forEach(function (c) {
      max += c.pts;
      var pass = c.test(t);
      if (pass) total += c.pts;
      results.push({ name: c.name, pass: pass, pts: c.pts, msg: pass ? c.okMsg : c.noMsg, key: c.key });
    });
    return { score: Math.round((total / max) * 100), results: results };
  }

  function verdict(score) {
    if (score >= 85) return ["Prompt de profesional 🔥", "Esto no es de cuñado. Sabes lo que haces. Pequeños ajustes y es perfecto."];
    if (score >= 60) return ["Vas bien encaminado", "Tienes la base, pero le faltan piezas que multiplicarían el resultado. Mira abajo."];
    if (score >= 35) return ["Prompt de andar por casa", "Funciona a medias. La IA te está dando el promedio de internet. Arréglalo y notarás el salto."];
    return ["Esto es pedir un deseo 🪄", "Le estás dejando casi todo a la suerte. Buena noticia: con 2-3 cambios cambia todo."];
  }

  // Construye una versión "pro" del prompt insertando lo que falta como andamiaje.
  function rewrite(text, results) {
    var miss = {};
    results.forEach(function (r) { miss[r.key] = !r.pass; });
    var orig = text.trim().replace(/\s+/g, " ");

    var lines = [];
    lines.push((miss.rol ? "Actúa como un experto en la materia. " : "") +
               "Tu objetivo es el siguiente encargo:");
    lines.push("");
    lines.push("« " + orig + " »");
    lines.push("");
    lines.push("Sigue estas indicaciones:");
    if (miss.contexto)     lines.push("• CONTEXTO: [describe para quién es, con qué datos y con qué fin — cuanto más concreto, mejor].");
    if (miss.formato)      lines.push("• FORMATO: devuélvemelo en [tabla / 5 bullets / guion de 30s / máx. 150 palabras].");
    if (miss.restricciones)lines.push("• RESTRICCIONES: nada de relleno ni introducciones. NO quiero [lo que no quieras].");
    if (miss.razonamiento) lines.push("• RAZONAMIENTO: explica brevemente tu porqué antes de darme la respuesta final.");
    if (miss.verificacion) lines.push("• VERIFICACIÓN: al final, señala qué partes no puedes confirmar con certeza.");
    if (lines[lines.length - 1] === "Sigue estas indicaciones:") {
      lines.push("• Mantén el rigor y evita el hype hueco.");
    }
    return lines.join("\n");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  var lastResults = null, lastText = "";

  btn.addEventListener("click", function () {
    var text = input.value.trim();
    if (text.length < 8) {
      input.focus();
      hint.textContent = "Escribe un prompt un poco más largo para analizarlo.";
      return;
    }
    var a = analyze(text);
    lastResults = a.results; lastText = text;

    // anillo + número
    var ring = $("ring-fill");
    var circ = 327; // 2*pi*52
    ring.style.strokeDashoffset = circ - (circ * a.score / 100);
    ring.setAttribute("stroke", a.score >= 60 ? "#22d3ee" : a.score >= 35 ? "#f472b6" : "#fb7185");

    // animación del número
    var sv = $("score-val"), n = 0;
    clearInterval(window.__cnt);
    window.__cnt = setInterval(function () {
      n += Math.ceil(a.score / 20);
      if (n >= a.score) { n = a.score; clearInterval(window.__cnt); }
      sv.textContent = n;
    }, 30);

    var v = verdict(a.score);
    $("verdict-title").textContent = v[0];
    $("verdict-desc").textContent = v[1];

    var box = $("checks"); box.innerHTML = "";
    a.results.forEach(function (r) {
      var el = document.createElement("div");
      el.className = "check " + (r.pass ? "ok" : "no");
      el.innerHTML =
        '<div class="check__icon">' + (r.pass ? "✅" : "⚠️") + '</div>' +
        '<div class="check__txt"><b>' + r.name + '</b><span>' + r.msg + '</span></div>' +
        '<div class="check__pts">' + (r.pass ? "+" + r.pts : "0") + "</div>";
      box.appendChild(el);
    });

    res.classList.add("is-on");
    res.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ── Gate: captura email -> desbloquea reescritura ─────────────────────────
  var gateForm = $("gate-form"), gateMsg = $("gate-msg"), gateBtn = $("gate-btn");
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  gateForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = $("gate-email").value.trim();
    if (!EMAIL_RE.test(email)) { gateMsg.textContent = "Revisa el email."; gateMsg.className = "capture__msg is-err"; return; }
    if (!$("gate-consent").checked) { gateMsg.textContent = "Marca el consentimiento."; gateMsg.className = "capture__msg is-err"; return; }

    gateBtn.disabled = true;
    gateBtn.querySelector(".cta__label").textContent = "Generando…";

    window.kitSubscribe(email, "analizador", "stack-ia")
      .then(function () { unlock(); })
      .catch(function () { unlock(); }) // no penalizamos al usuario por un fallo de red: ya tiene su análisis
      .finally(function () {
        gateBtn.disabled = false;
        gateBtn.querySelector(".cta__label").textContent = "Reescribir →";
      });
  });

  function unlock() {
    gateMsg.textContent = "";
    var improved = $("improved");
    $("improved-text").textContent = rewrite(lastText, lastResults || []);
    improved.classList.add("is-on");
    gateForm.querySelector(".capture__row").style.display = "none";
    gateForm.querySelector(".capture__consent").style.display = "none";
    improved.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("copy-btn").addEventListener("click", function () {
    var txt = $("improved-text").textContent;
    navigator.clipboard.writeText(txt).then(function () {
      var l = $("copy-btn").querySelector(".cta__label");
      var old = l.textContent; l.textContent = "¡Copiado! ✓";
      setTimeout(function () { l.textContent = old; }, 1800);
    });
  });
})();
