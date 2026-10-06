/* 10 minutos al día · edrian.exe
   Un artículo al azar (Wikipedia destacados+buenos o selección de The Conversation), recortado a ~10 min, con racha, constelación,
   quiz semanal (preguntas sacadas del propio texto leído) y tarjeta para compartir.
   Todo en el navegador: progreso en localStorage, textos vía API pública de Wikipedia. */
(function () {
  "use strict";

  var KEY = "diez.v1", POOL_V = "2026-10-06b";   // subir POOL_V al regenerar el catálogo
  var WPM = 230, BUDGET = 2300;               // ~10 minutos de lectura
  var TEMAS = {
    "Ciencia":        { c: "#22d3ee", x: 115, y: 120 },
    "Salud":          { c: "#fb923c", x: 305, y: 100 },
    "Historia":       { c: "#fbbf24", x: 495, y: 125 },
    "Arte y cultura": { c: "#f472b6", x: 685, y: 105 },
    "Mundo":          { c: "#34d399", x: 210, y: 345 },
    "Ideas":          { c: "#a78bfa", x: 400, y: 355 },
    "Tecnología":     { c: "#60a5fa", x: 590, y: 340 }
  };
  var NIVELES = [[0, "Curioso"], [50, "Aprendiz"], [150, "Explorador"], [350, "Erudito"], [700, "Polímata"], [1200, "Sabio"]];
  var SKIP = /^(véase también|notas|referencias|bibliografía|enlaces externos|fuentes|notas y referencias|galería|discografía|filmografía|lecturas adicionales|citas|notas al pie|obras|bibliografía adicional|referencias y notas|enlaces|otras lecturas)$/i;

  var $ = function (id) { return document.getElementById(id); };
  var pool = null, cur = null, curQs = [];

  /* ── Estado ─────────────────────────────────────────────────────────── */
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    s = s || {};
    s.reads = (Array.isArray(s.reads) ? s.reads : []).filter(function (r) { return r && typeof r.t === "string" && TEMAS[r.tema] && /^\d{4}-\d{2}-\d{2}$/.test(r.d); });
    s.xp = +s.xp || 0; s.quiz = s.quiz || {}; s.asks = s.asks || 0;
    return s;
  }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function hoy(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function diaAnt(s) { var p = s.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() - 1); return hoy(d); }
  function semana(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n);
    var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() + "-W" + Math.ceil(((d - y0) / 864e5 + 1) / 7);
  }
  function racha() {
    var dias = {}; S.reads.forEach(function (r) { dias[r.d] = 1; });
    var d = hoy(); if (!dias[d]) d = diaAnt(d);
    var n = 0; while (dias[d]) { n++; d = diaAnt(d); }
    return n;
  }
  function leidoHoy() { var h = hoy(); return S.reads.some(function (r) { return r.d === h; }); }
  function nivel(xp) {
    var i = 0; while (i + 1 < NIVELES.length && xp >= NIVELES[i + 1][0]) i++;
    var next = NIVELES[i + 1];
    return { n: NIVELES[i][1], next: next, pct: next ? (xp - NIVELES[i][0]) / (next[0] - NIVELES[i][0]) : 1 };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clave(r) { return r.k || r.t; }
  function enlace(r) { return r.u || wurl(r.t); }
  function wurl(t) { return "https://es.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_")); }
  function toast(m) { var t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("on"); }, 3200); }

  /* ── Pintar estado ──────────────────────────────────────────────────── */
  function pintaEstado() {
    var r = racha(), nv = nivel(S.xp);
    $("st-racha").textContent = r;
    $("st-leidos").textContent = S.reads.length;
    $("st-xp").textContent = S.xp;
    $("st-nivel").textContent = nv.n;
    $("st-next").textContent = nv.next ? "nivel · " + (nv.next[0] - S.xp) + " pts para " + nv.next[1] : "nivel máximo";
    $("st-bar").style.width = Math.round(nv.pct * 100) + "%";
    var h = $("hoy-hint");
    if (leidoHoy()) h.textContent = "Hoy ya has encendido tu estrella. Vuelve mañana para mantener la racha (puedes leer más, pero no cuenta doble).";
    else if (r > 0) h.textContent = "Lee uno hoy y tu racha sube a " + (r + 1) + " días.";
    else h.textContent = S.reads.length ? "Tu racha se ha roto. Hoy empieza otra." : "Tu primer concepto está a un clic.";
    var qs = preguntasSemana(), qb = $("btn-quiz");
    qb.hidden = qs.length < 2;
    var dom = new Date().getDay() === 0, hecho = S.quiz[semana(new Date())];
    qb.classList.toggle("dz-ghost--hot", dom && !hecho);
    qb.textContent = hecho ? "🧠 Repetir el quiz (" + hecho + " aciertos)" : (dom ? "🧠 ¡Hoy toca el quiz!" : "🧠 Quiz de la semana");
    pintaCielo(); pintaHist();
  }

  function pintaHist() {
    var box = $("hist-box"), ol = $("hist");
    box.hidden = !S.reads.length;
    ol.innerHTML = S.reads.slice(-30).reverse().map(function (r) {
      return '<li><span>' + esc(r.d.slice(8) + "/" + r.d.slice(5, 7)) + '</span><a href="' + esc(enlace(r)) + '" target="_blank" rel="noopener">' + esc(r.t) + '</a><span style="margin-left:auto;color:' + TEMAS[r.tema].c + '">' + esc(r.tema) + "</span></li>";
    }).join("");
  }

  /* ── Constelación ───────────────────────────────────────────────────── */
  function estrellas() {
    var por = {}; Object.keys(TEMAS).forEach(function (k) { por[k] = []; });
    S.reads.forEach(function (r, i) {
      var T = TEMAS[r.tema]; if (!T) return;
      var h = hash(clave(r)), a = (h % 360) * Math.PI / 180, rad = 14 + ((h >>> 9) % 62);
      por[r.tema].push({ x: T.x + Math.cos(a) * rad * 1.1, y: T.y + Math.sin(a) * rad * .8, t: r.t, i: i });
    });
    return por;
  }
  function pintaCielo() {
    var svg = $("sky"), por = estrellas(), out = [], last = S.reads.length - 1;
    var seed = 7; function pr() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 90; i++) out.push('<circle cx="' + (pr() * 800).toFixed(1) + '" cy="' + (pr() * 490).toFixed(1) + '" r="' + (pr() * 1.1 + .3).toFixed(2) + '" fill="#9fb4e8" opacity="' + (pr() * .35 + .1).toFixed(2) + '"/>');
    Object.keys(TEMAS).forEach(function (k) {
      var T = TEMAS[k], st = por[k];
      out.push('<circle cx="' + T.x + '" cy="' + T.y + '" r="85" fill="' + T.c + '" opacity="' + (st.length ? .05 : .025) + '"/>');
      for (var j = 1; j < st.length; j++) out.push('<line x1="' + st[j - 1].x.toFixed(1) + '" y1="' + st[j - 1].y.toFixed(1) + '" x2="' + st[j].x.toFixed(1) + '" y2="' + st[j].y.toFixed(1) + '" stroke="' + T.c + '" stroke-opacity=".35" stroke-width="1"/>');
      st.forEach(function (s) {
        out.push('<circle class="st' + (s.i === last ? " st--new" : "") + '" cx="' + s.x.toFixed(1) + '" cy="' + s.y.toFixed(1) + '" r="' + (s.i === last ? 6 : 4.2) + '" fill="' + T.c + '"><title>' + esc(s.t) + "</title></circle>");
        out.push('<circle cx="' + s.x.toFixed(1) + '" cy="' + s.y.toFixed(1) + '" r="11" fill="' + T.c + '" opacity=".12"/>');
      });
      out.push('<text x="' + T.x + '" y="' + (T.y + 108) + '" text-anchor="middle" fill="' + T.c + '" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600" opacity="' + (st.length ? 1 : .45) + '">' + esc(k.toUpperCase()) + " · " + st.length + "</text>");
    });
    svg.innerHTML = out.join("");
    $("sky-legend").innerHTML = Object.keys(TEMAS).map(function (k) {
      var tot = pool && pool.temas[k] ? pool.temas[k].length : 0;
      return '<div class="dz-leg"><span style="color:' + TEMAS[k].c + '">● ' + esc(k) + "</span><b>" + por[k].length + (tot ? "/" + tot : "") + "</b></div>";
    }).join("");
  }

  /* ── Elegir y cargar concepto ───────────────────────────────────────── */
  function temasPool() { return Object.keys(TEMAS).filter(function (k) { return pool.temas[k] && pool.temas[k].length; }); }
  function elegir() {
    var leidos = {}; S.reads.forEach(function (r) { leidos[clave(r)] = 1; });
    for (var n = 0; n < 50; n++) {
      var tema = rnd(temasPool()), t = rnd(pool.temas[tema]);
      if (!leidos[t] && (!cur || cur.k !== t)) return { t: t, tema: tema };
    }
    var tema2 = rnd(temasPool()); return { t: rnd(pool.temas[tema2]), tema: tema2 };
  }

  function api(t) {
    var p = new URLSearchParams({ action: "query", prop: "extracts|pageimages", explaintext: "1", exsectionformat: "wiki", pithumbsize: "1000", redirects: "1", format: "json", formatversion: "2", origin: "*", titles: t });
    return fetch("https://es.wikipedia.org/w/api.php?" + p).then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (d) { var pg = d.query && d.query.pages && d.query.pages[0]; if (!pg || pg.missing || !pg.extract) throw new Error("vacío"); return pg; });
  }

  function trocear(extract) {
    var lineas = extract.split("\n"), bloques = [], palabras = 0, saltar = false, cortado = false;
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i].trim(); if (!l) continue;
      var m = l.match(/^(=+)\s*(.*?)\s*=+$/);
      if (m) {
        saltar = SKIP.test(m[2]);
        if (!saltar) bloques.push({ h: m[1].length <= 2 ? "h3" : "h4", t: m[2] });
        continue;
      }
      if (saltar) continue;
      var w = l.split(/\s+/).length;
      if (palabras + w > BUDGET && palabras > BUDGET * .6) { cortado = true; break; }
      bloques.push({ p: l }); palabras += w;
    }
    while (bloques.length && bloques[bloques.length - 1].h) bloques.pop();   // sin títulos huérfanos al final
    // quitar títulos sin párrafos debajo
    bloques = bloques.filter(function (b, i) { return !b.h || (bloques[i + 1] && bloques[i + 1].p); });
    return { bloques: bloques, palabras: palabras, cortado: cortado };
  }

  /* Preguntas sacadas del propio texto: años tapados o "¿de qué concepto habla?" */
  function preguntas(t, tema, bloques) {
    var frases = [];
    bloques.forEach(function (b) { if (b.p) frases = frases.concat(b.p.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"])/)); });
    var anyo = /(^|[^\d])(1[0-9]{3}|20[0-2][0-9])(?![\d])/, actual = new Date().getFullYear(), qs = [];
    var cand = frases.filter(function (f) { return f.length > 60 && f.length < 240 && anyo.test(f) && !/a\. ?C\./.test(f); });
    var paso = Math.max(1, Math.floor(cand.length / 3));
    for (var i = 0; i < cand.length && qs.length < 3; i += paso) {
      var f = cand[i], m = f.match(anyo), y = +m[2], opts = [y], tries = 0;
      while (opts.length < 4 && tries++ < 50) {
        var d = y + (Math.random() < .5 ? -1 : 1) * (2 + Math.floor(Math.random() * 60));
        if (d <= actual && d > 0 && opts.indexOf(d) < 0) opts.push(d);
      }
      qs.push({ tipo: "año", t: t, s: f.replace(m[2], "____"), ok: String(y), o: shuffle(opts.map(String)) });
    }
    var base = t.replace(/\s*\(.*\)$/, ""), re = new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    var defin = frases.filter(function (f) { return f.length > 70 && f.length < 260 && re.test(f); })[0];
    if (defin && pool && pool.temas[tema]) {
      var otros = shuffle(pool.temas[tema].filter(function (x) { return x !== t && x.indexOf("tc:") !== 0; })).slice(0, 3);
      qs.push({ tipo: "concepto", t: t, s: defin.replace(re, "____"), ok: t, o: shuffle([t].concat(otros)) });
    }
    return qs;
  }

  function mostrar(sel) {
    cur = sel; cur.k = sel.t; S.cur = { t: sel.t, tema: sel.tema, d: hoy() }; save();
    var box = $("lectura"); box.hidden = false;
    $("rd-tema").textContent = sel.tema; $("rd-tema").style.color = TEMAS[sel.tema].c;
    $("rd-titulo").textContent = sel.t.indexOf("tc:") === 0 ? "" : sel.t; $("rd-min").textContent = "cargando…";
    $("rd-firma").hidden = true;
    $("rd-fig").hidden = true;
    $("rd-body").innerHTML = '<div class="dz-skel" style="width:96%"></div><div class="dz-skel" style="width:88%"></div><div class="dz-skel" style="width:92%"></div><div class="dz-skel" style="width:60%"></div>';
    $("rd-attr").textContent = ""; $("btn-leido").disabled = true;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    if (sel.t.indexOf("tc:") === 0) return mostrarTC(sel);
    return api(sel.t).then(function (pg) {
      if (cur !== sel) return;
      var tr = trocear(pg.extract);
      if (tr.palabras < 350) throw new Error("corto");
      $("rd-titulo").textContent = pg.title;
      $("rd-min").textContent = Math.max(1, Math.round(tr.palabras / WPM)) + " min de lectura";
      if (pg.thumbnail && pg.thumbnail.source) { $("rd-img").src = pg.thumbnail.source; $("rd-img").alt = pg.title; $("rd-fig").hidden = false; }
      var html = tr.bloques.map(function (b) { return b.h ? "<" + b.h + ">" + esc(b.t) + "</" + b.h + ">" : "<p>" + esc(b.p) + "</p>"; }).join("");
      if (tr.cortado) html += '<p class="dz-cut">Aquí terminan tus 10 minutos. El artículo sigue en Wikipedia si te has quedado con ganas.</p>';
      $("rd-body").innerHTML = html;
      var libro = (sel.tema === "Tecnología" || sel.tema === "Historia")
        ? ' · <a href="https://dashbook.es/book/500-paginas-web-que-debes-conocer" target="_blank" rel="noopener">¿Te va la historia? Mi libro cuenta cómo llegamos a internet →</a>' : "";
      $("rd-attr").innerHTML = 'Extracto de «<a href="' + wurl(pg.title) + '" target="_blank" rel="noopener">' + esc(pg.title) + '</a>», Wikipedia en español (<a href="' + wurl(pg.title) + '?action=history" target="_blank" rel="noopener">autores</a>), licencia <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener">CC BY-SA 4.0</a>.' + libro;
      $("rd-mas").href = wurl(pg.title); $("rd-mas").textContent = "Seguir leyendo en Wikipedia →";
      curQs = preguntas(pg.title, sel.tema, tr.bloques);
      cur.t = pg.title;
      $("btn-leido").disabled = false;
    }).catch(function () {
      if (cur !== sel) return;
      sel._fallos = (sel._fallos || 0) + 1;
      if (sel._fallos > 3) { $("rd-body").innerHTML = "<p>No consigo conectar con Wikipedia ahora mismo. Prueba en un momento.</p>"; return; }
      var otro = elegir(); otro._fallos = sel._fallos; return mostrar(otro);
    });
  }

  /* Artículo de The Conversation (CC BY-ND): completo, sin editar, firmado y con su píxel */
  function mostrarTC(sel) {
    return fetch("tc/" + sel.t.slice(3) + ".json").then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); }).then(function (a) {
      if (cur !== sel) return;
      $("rd-titulo").textContent = a.titulo;
      $("rd-min").textContent = Math.max(1, Math.round(a.palabras / WPM)) + " min de lectura";
      var firma = a.autores.map(function (x) { return "<strong>" + esc(x.n) + "</strong>" + (x.rol ? "<span>" + esc(x.rol) + "</span>" : ""); }).join("");
      $("rd-firma").innerHTML = '<a class="dz-tc" href="' + esc(a.url) + '" target="_blank" rel="noopener">Publicado originalmente en <b>The Conversation</b></a>' + '<div class="dz-autores">' + firma + "</div>";
      $("rd-firma").hidden = false;
      $("rd-body").innerHTML = a.bloques.map(function (b) { return b.p ? "<p>" + esc(b.p) + "</p>" : "<h3>" + esc(b.t) + "</h3>"; }).join("") +
        '<img src="' + esc(a.pixel) + '" alt="" width="1" height="1" style="border:none;width:1px;height:1px;position:absolute" referrerpolicy="no-referrer-when-downgrade">';
      $("rd-attr").innerHTML = 'Este artículo fue publicado originalmente en <a href="https://theconversation.com/es" target="_blank" rel="noopener">The Conversation</a>. Lea el <a href="' + esc(a.url) + '" target="_blank" rel="noopener">original</a>. Licencia <a href="https://creativecommons.org/licenses/by-nd/4.0/deed.es" target="_blank" rel="noopener">CC BY-ND 4.0</a>.' +
        (a.clausula ? '<br><span class="dz-clausula">Cláusula de divulgación: ' + esc(a.clausula) + "</span>" : "");
      $("rd-mas").href = a.url; $("rd-mas").textContent = "Ver el original en The Conversation →";
      curQs = preguntas(a.titulo, sel.tema, a.bloques.filter(function (b) { return b.p; }));
      cur.t = a.titulo; cur.u = a.url;
      $("btn-leido").disabled = false;
    }).catch(function () {
      if (cur !== sel) return;
      var otro = elegir(); return mostrar(otro);
    });
  }

  function marcarLeido() {
    if (!cur) return;
    var yaHoy = leidoHoy();
    var reg = { t: cur.t, tema: cur.tema, d: hoy(), q: curQs };
    if (cur.k !== cur.t) reg.k = cur.k;
    if (cur.u) reg.u = cur.u;
    S.reads.push(reg);
    S.xp += 10 + (yaHoy ? 0 : 5);
    S.cur = null; var tema = cur.tema; cur = null; save();
    $("lectura").hidden = true;
    pintaEstado();
    toast("✦ Estrella encendida en " + tema + (yaHoy ? " (+10)" : " (+15 · racha " + racha() + ")"));
    document.querySelector(".dz-sky").scrollIntoView({ behavior: "smooth", block: "center" });
    if (!S.email && ((S.reads.length === 1 && S.asks === 0) || (S.reads.length >= 3 && S.asks === 1))) setTimeout(abrirEmail, 1400);
  }

  /* ── Quiz semanal ───────────────────────────────────────────────────── */
  function preguntasSemana() {
    var lim = new Date(); lim.setDate(lim.getDate() - 7); var l = hoy(lim), qs = [];
    S.reads.forEach(function (r) { if (r.d > l && r.q) qs = qs.concat(r.q); });
    return qs;
  }
  var Q = null;
  function abrirQuiz() {
    var qs = shuffle(preguntasSemana().slice()).slice(0, 10);
    if (qs.length < 2) return;
    Q = { qs: qs, i: 0, ok: 0, sem: semana(new Date()), xp: !S.quiz[semana(new Date())] };
    abrir("m-quiz"); pintaPregunta();
  }
  function pintaPregunta() {
    var q = Q.qs[Q.i];
    $("mq-k").innerHTML = '<span class="bracket">[</span>&nbsp;PREGUNTA ' + (Q.i + 1) + " DE " + Q.qs.length + '&nbsp;<span class="bracket">]</span>';
    $("mq-t").textContent = q.tipo === "año" ? "¿Qué año falta?" : "¿De qué concepto habla?";
    $("mq-q").innerHTML = esc(q.s).replace("____", "<mark>____</mark>") + (q.tipo === "año" ? '<br><small style="color:var(--text-dim);font:500 12px var(--font-mono)">De: ' + esc(q.t) + "</small>" : "");
    $("mq-fb").textContent = ""; $("mq-next").hidden = true;
    $("mq-opts").innerHTML = q.o.map(function (o) { return "<button type=\"button\">" + esc(o) + "</button>"; }).join("");
    Array.prototype.forEach.call($("mq-opts").children, function (b) {
      b.addEventListener("click", function () {
        var bien = b.textContent === q.ok;
        Array.prototype.forEach.call($("mq-opts").children, function (x) { x.disabled = true; if (x.textContent === q.ok) x.classList.add("ok"); });
        if (!bien) b.classList.add("ko"); else Q.ok++;
        $("mq-fb").textContent = bien ? "✓ Bien. +5" : "✗ Era " + q.ok + ".";
        $("mq-fb").style.color = bien ? "var(--ok)" : "var(--err)";
        $("mq-next").hidden = false;
        $("mq-next").querySelector(".cta__label").textContent = Q.i + 1 < Q.qs.length ? "Siguiente →" : "Ver resultado →";
      });
    });
  }
  function siguiente() {
    Q.i++;
    if (Q.i < Q.qs.length) return pintaPregunta();
    if (Q.xp) { S.xp += Q.ok * 5; S.quiz[Q.sem] = Q.ok + "/" + Q.qs.length; save(); }
    $("mq-k").innerHTML = '<span class="bracket">[</span>&nbsp;RESULTADO&nbsp;<span class="bracket">]</span>';
    $("mq-t").textContent = Q.ok + " de " + Q.qs.length + (Q.ok === Q.qs.length ? ". Perfecto." : Q.ok >= Q.qs.length / 2 ? ". Se te está quedando." : ". Lo que no repasas, se va.");
    $("mq-q").textContent = Q.xp ? "+" + Q.ok * 5 + " puntos. El domingo que viene, más." : "Repaso sin puntos: los de esta semana ya los tienes.";
    $("mq-opts").innerHTML = ""; $("mq-fb").textContent = ""; $("mq-next").hidden = true;
    pintaEstado();
  }

  /* ── Email ──────────────────────────────────────────────────────────── */
  function abrirEmail() { S.asks++; save(); abrir("m-email"); setTimeout(function () { $("fe-email").focus(); }, 100); }
  function enviarEmail(e) {
    e.preventDefault();
    var em = $("fe-email").value.trim(), msg = $("fe-msg");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { msg.textContent = "Revisa el email."; msg.className = "capture__msg is-err"; return; }
    if (!$("fe-consent").checked) { msg.textContent = "Marca el consentimiento."; msg.className = "capture__msg is-err"; return; }
    msg.textContent = "Enviando…"; msg.className = "capture__msg";
    window.kitSubscribe(em, "diez", "10min").then(function (r) {
      if (!r.ok) throw 0;
      S.email = true; save(); cerrar("m-email");
      toast("Hecho. Confirma en tu correo y te llevo al Stack de IA.");
    }).catch(function () { msg.textContent = "No se ha podido enviar. Prueba en un momento."; msg.className = "capture__msg is-err"; });
  }

  /* ── Compartir ──────────────────────────────────────────────────────── */
  function tarjeta() {
    var cv = $("share-canvas"), g = cv.getContext("2d"), W = 1080, H = 1350;
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0a1530"); bg.addColorStop(1, "#03060f");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "#22d3ee"; g.font = "600 30px 'JetBrains Mono', monospace"; g.fillText("[ 10 MINUTOS · edrian.exe ]", 80, 120);
    g.fillStyle = "#e8efff"; g.font = "700 74px 'Space Grotesk', sans-serif"; g.fillText("Mi constelación", 80, 220);
    var nv = nivel(S.xp), datos = [[racha(), "días de racha"], [S.reads.length, "conceptos"], [nv.n, "nivel"]];
    datos.forEach(function (d, i) {
      var x = 80 + i * 320;
      g.fillStyle = i === 2 ? "#22d3ee" : "#e8efff"; g.font = "700 " + (i === 2 ? 52 : 80) + "px 'Space Grotesk', sans-serif"; g.fillText(String(d[0]), x, 350);
      g.fillStyle = "#92a5cf"; g.font = "500 26px 'JetBrains Mono', monospace"; g.fillText(d[1], x, 395);
    });
    var ox = 80, oy = 450, k = 1.15;          // cielo 800x490 escalado a 920 px
    g.save(); g.translate(ox, oy); g.scale(k, k);
    g.fillStyle = "#040713"; g.fillRect(0, 0, 800, 520);
    var seed = 11; function pr() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 120; i++) { g.globalAlpha = pr() * .4 + .1; g.fillStyle = "#9fb4e8"; g.beginPath(); g.arc(pr() * 800, pr() * 520, pr() * 1.4 + .3, 0, 7); g.fill(); }
    var por = estrellas();
    Object.keys(TEMAS).forEach(function (t) {
      var T = TEMAS[t], st = por[t];
      var halo = g.createRadialGradient(T.x, T.y, 0, T.x, T.y, 100);
      halo.addColorStop(0, T.c); halo.addColorStop(1, "transparent");
      g.globalAlpha = st.length ? .16 : .05; g.fillStyle = halo; g.beginPath(); g.arc(T.x, T.y, 100, 0, 7); g.fill();
      g.strokeStyle = T.c; g.globalAlpha = .5; g.lineWidth = 2;
      for (var j = 1; j < st.length; j++) { g.beginPath(); g.moveTo(st[j - 1].x, st[j - 1].y); g.lineTo(st[j].x, st[j].y); g.stroke(); }
      g.fillStyle = T.c;
      st.forEach(function (s) {
        g.globalAlpha = .25; g.beginPath(); g.arc(s.x, s.y, 16, 0, 7); g.fill();
        g.globalAlpha = 1; g.beginPath(); g.arc(s.x, s.y, 7, 0, 7); g.fill();
      });
      g.globalAlpha = st.length ? 1 : .45; g.font = "700 20px 'JetBrains Mono', monospace"; g.textAlign = "center";
      g.fillText(t.toUpperCase() + " · " + st.length, T.x, T.y + 112); g.textAlign = "left"; g.globalAlpha = 1;
    });
    g.restore();
    g.fillStyle = "#e8efff"; g.font = "600 34px 'Inter', sans-serif"; g.fillText("10 minutos al día de algo que no sabes.", 80, 1110);
    g.fillStyle = "#22d3ee"; g.font = "600 28px 'JetBrains Mono', monospace"; g.fillText("edrianexe.github.io/recursos/diez", 80, 1175);
    return cv;
  }
  function compartir() {
    var cv = tarjeta();
    cv.toBlob(function (b) {
      var f = new File([b], "mi-constelacion.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: "Mi constelación", text: "Llevo " + S.reads.length + " conceptos y " + racha() + " días de racha. 10 minutos al día:", url: "https://edrianexe.github.io/recursos/diez/" }).catch(function () {});
      } else {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "mi-constelacion.png"; a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      }
    }, "image/png");
  }

  /* ── Modales ────────────────────────────────────────────────────────── */
  function abrir(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
  function cerrar(id) { $(id).hidden = true; document.body.style.overflow = ""; }
  document.querySelectorAll(".dz-modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m || e.target.hasAttribute("data-close")) cerrar(m.id); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") document.querySelectorAll(".dz-modal:not([hidden])").forEach(function (m) { cerrar(m.id); }); });

  /* ── Progreso de lectura ────────────────────────────────────────────── */
  window.addEventListener("scroll", function () {
    var b = $("rd-body"); if ($("lectura").hidden) return;
    var r = b.getBoundingClientRect(), tot = r.height - window.innerHeight * .6;
    $("rd-progress").style.width = Math.max(0, Math.min(100, (-r.top + 80) / Math.max(1, tot) * 100)) + "%";
  }, { passive: true });

  /* ── Arranque ───────────────────────────────────────────────────────── */
  $("year").textContent = new Date().getFullYear();
  document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-visible"); });
  pintaEstado();
  $("btn-hoy").disabled = true;
  fetch("pool.json?v=" + POOL_V).then(function (r) { return r.json(); }).then(function (p) {
    pool = p; $("btn-hoy").disabled = false; pintaCielo();
    if (S.cur && S.cur.d === hoy() && !S.reads.some(function (r) { return clave(r) === S.cur.t; })) {
      $("btn-hoy").querySelector(".cta__label").textContent = S.cur.t.indexOf("tc:") === 0 ? "Seguir con tu lectura de hoy →" : "Seguir con «" + S.cur.t + "» →";
    }
  });
  $("btn-hoy").addEventListener("click", function () {
    if (!pool) return;
    // Solo se retoma el concepto pendiente al entrar; con uno ya en pantalla, siempre trae otro
    var pendiente = !cur && S.cur && S.cur.d === hoy() && !S.reads.some(function (r) { return clave(r) === S.cur.t; });
    var sel = pendiente ? { t: S.cur.t, tema: S.cur.tema } : elegir();
    $("btn-hoy").querySelector(".cta__label").textContent = "Dame otro concepto →";
    mostrar(sel);
  });
  $("btn-otro").addEventListener("click", function () { mostrar(elegir()); });
  $("btn-leido").addEventListener("click", marcarLeido);
  $("btn-quiz").addEventListener("click", abrirQuiz);
  $("mq-next").addEventListener("click", siguiente);
  $("f-email").addEventListener("submit", enviarEmail);
  $("btn-share").addEventListener("click", function () { tarjeta(); abrir("m-share"); });
  $("btn-share-go").addEventListener("click", compartir);
})();
