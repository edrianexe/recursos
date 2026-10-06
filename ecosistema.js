/* ecosistema.js — bloque "Más de edrian.exe" (libro + canales + recursos).
   Única fuente de enlaces: se cambia aquí y se actualiza en todas las páginas.
   Uso: <div data-ecosistema></div> donde quieras el bloque. */
(function () {
  var LIBRO = {
    titulo: "500 páginas web que debes conocer",
    sub: "De la cueva al navegador",
    texto: "La historia de internet que nunca te contaron: de una estatua que «hablaba» en Egipto al miedo actual a ChatGPT. 400 páginas, primera edición limitada con tu nombre dentro.",
    url: "https://dashbook.es/book/500-paginas-web-que-debes-conocer",
    cta: "Reservar · 27,50 €",
    img: "assets/libro-500-webs.jpg"
  };
  var CANALES = [
    { n: "Instagram", h: "@edrian.exe", u: "https://www.instagram.com/edrian.exe/" },
    { n: "TikTok", h: "@edrian.exe", u: "https://www.tiktok.com/@edrian.exe" },
    { n: "YouTube", h: "@EdrianExe", u: "https://www.youtube.com/@EdrianExe" },
    { n: "Distop-IA", h: "Vídeos largos", u: "https://www.youtube.com/@distop-ia" },
    { n: "Threads", h: "@edrian.exe", u: "https://www.threads.com/@edrian.exe" },
    { n: "Facebook", h: "EdrianExe", u: "https://www.facebook.com/EdrianExe/" }
  ];
  var RECURSOS = [
    { n: "10 minutos al día", d: "Un concepto nuevo cada día, con racha y quiz", u: "diez/" },
    { n: "Analizador de prompts", d: "Puntúa tu prompt en 10 segundos", u: "analizador.html" },
    { n: "El Stack de IA", d: "27 prompts + 3 flujos, gratis", u: "./" },
    { n: "Mi stack de herramientas", d: "Lo que uso de verdad", u: "stack.html" },
    { n: "El Vault de IA", d: "La introducción a la IA que no caduca", u: "producto.html" }
  ];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  document.querySelectorAll("[data-ecosistema]").forEach(function (box) {
    var base = box.getAttribute("data-base") || "";
    var skip = box.getAttribute("data-skip") || "";
    var rec = RECURSOS.filter(function (r) { return r.u !== skip; }).map(function (r) {
      var href = /^https?:/.test(r.u) ? r.u : base + r.u;
      return '<a class="eco__res" href="' + esc(href) + '"><strong>' + esc(r.n) + '</strong><span>' + esc(r.d) + "</span></a>";
    }).join("");
    var can = CANALES.map(function (c) {
      return '<a class="eco__can" href="' + esc(c.u) + '" target="_blank" rel="noopener"><strong>' + esc(c.n) + "</strong><span>" + esc(c.h) + "</span></a>";
    }).join("");
    box.innerHTML =
      '<section class="eco" data-reveal>' +
      '<p class="section__crumb"><span class="bracket">//</span> más de edrian.exe</p>' +
      '<a class="eco__libro" href="' + esc(LIBRO.url) + '" target="_blank" rel="noopener">' +
      '<img src="' + esc(base + LIBRO.img) + '" alt="Portada del libro ' + esc(LIBRO.titulo) + '" loading="lazy" width="480" height="360">' +
      '<div><span class="eco__tag">Mi libro · preventa</span><h3>' + esc(LIBRO.titulo) + "</h3><em>" + esc(LIBRO.sub) + "</em>" +
      "<p>" + esc(LIBRO.texto) + '</p><span class="cta cta--primary"><span class="cta__label">' + esc(LIBRO.cta) + " →</span></span></div></a>" +
      '<h4 class="eco__h">Gratis, aquí mismo</h4><div class="eco__grid">' + rec + "</div>" +
      '<h4 class="eco__h">Donde publico</h4><div class="eco__grid eco__grid--can">' + can + "</div>" +
      "</section>";
    box.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-visible"); });
  });
})();
