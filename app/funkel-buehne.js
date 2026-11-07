// Funkel auf Werbeseiten: das 3D-Einhorn aus der App steht über der Hörprobe und spricht mit.
// Einbinden: <script src="funkel-buehne.js" defer></script> irgendwo nach den Hörprobe-Knöpfen.
// Erwartet Knöpfe mit class="hoer" und data-src (wie in landing.html). Die Seite selbst startet den Ton
// und legt das Audio-Objekt in knopf._a ab; dieses Skript hängt sich nur daran.
// Bis das 3D-Modell geladen ist (oder ohne WebGL) steht das gezeichnete Funkel-Bild da.
(function () {
  var hier = (document.currentScript && document.currentScript.src) || location.href;
  var MODUL = new URL('../funkel3d.js', hier).href;
  var BILD = new URL('themen/einhorn/figuren/funkel.svg', hier).href;

  var stil = document.createElement('style');
  stil.textContent =
    '.funkel-buehne{position:relative;width:min(260px,62vw);aspect-ratio:1;margin:0 auto 4px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.funkel-buehne::before{content:"";position:absolute;inset:12% 8% 4%;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.35),rgba(167,139,250,0) 68%);transition:transform .4s ease,opacity .4s ease;opacity:.7}' +
    '.funkel-buehne.spricht::before{transform:scale(1.12);opacity:1}' +
    '.funkel-buehne img{position:absolute;inset:14%;width:72%;height:72%;object-fit:contain;transition:opacity .4s ease}' +
    '.funkel-buehne .f3d{position:absolute;inset:0;-webkit-mask-image:linear-gradient(to bottom,#000 70%,transparent 96%);mask-image:linear-gradient(to bottom,#000 70%,transparent 96%)}' +
    '.funkel-buehne .f3d canvas{width:100%;height:100%;display:block}' +
    '.funkel-buehne.bereit img{opacity:0}';
  document.head.appendChild(stil);

  function sichtbarerKnopf() {
    var k = document.querySelectorAll('.hoer[data-src]');
    for (var i = 0; i < k.length; i++) if (k[i].offsetParent !== null) return k[i];
    return null;
  }

  var buehne, knopf, huelle = null, huelleLaedt = false, zuletzt = null;

  function F() { return window.Funkel3D || null; }

  // Lautstärkeverlauf der Aufnahme (60 Werte pro Sekunde), wie im Spiel
  function huelleHolen(src) {
    if (huelle || huelleLaedt) return; huelleLaedt = true;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !window.fetch) return;
    fetch(src).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var oc = new OAC(1, 44100, 44100);
      return new Promise(function (ok, nein) { var p = oc.decodeAudioData(buf, ok, nein); if (p && p.then) p.then(ok, nein); });
    }).then(function (b) {
      var d = b.getChannelData(0), sr = b.sampleRate, w = Math.max(1, Math.floor(sr / 60)), n = Math.ceil(d.length / w), h = new Float32Array(n), max = 0;
      for (var i = 0; i < n; i++) { var s = 0, a = i * w, e = Math.min(d.length, a + w); for (var j = a; j < e; j += 2) s += d[j] * d[j]; h[i] = Math.sqrt(s / Math.max(1, (e - a) / 2)); if (h[i] > max) max = h[i]; }
      var ruhe = max * 0.06;
      for (var k = 0; k < n; k++) h[k] = Math.pow(Math.max(0, (h[k] - ruhe) / Math.max(1e-6, max * 0.7 - ruhe)), 0.8);
      huelle = h;
    }).catch(function () {});
  }
  function zuckeln() { var t = performance.now() / 1000; return Math.max(0, .55 + .45 * Math.sin(t * 15)) * (.65 + .35 * Math.sin(t * 3.3)); }

  function sprechen(au) {
    var f = F(); if (buehne) buehne.classList.add('spricht');
    if (!f) return;
    f.sprich(function () {
      if (au.paused) return 0;
      if (!huelle) return zuckeln();
      var i = Math.floor((au.currentTime + 0.03) * 60); return i < huelle.length ? (huelle[i] || 0) : 0;
    });
  }
  function aufhoeren() { var f = F(); if (buehne) buehne.classList.remove('spricht'); if (f) f.still(); }

  function anhaengen(au) {               // einmal je Audio-Objekt
    if (!au || au._funkel) return; au._funkel = true;
    au.addEventListener('playing', function () { zuletzt = au; sprechen(au); });
    au.addEventListener('pause', function () { if (zuletzt === au) aufhoeren(); });
    au.addEventListener('ended', function () { if (zuletzt === au) { aufhoeren(); var f = F(); if (f) f.freude(); } });
    if (!au.paused) sprechen(au);
  }

  function modulLaden() {
    if (document.querySelector('script[data-funkel3d]')) return;
    var s = document.createElement('script'); s.type = 'module'; s.src = MODUL; s.setAttribute('data-funkel3d', '');
    document.head.appendChild(s);
  }
  function starten() {
    var f = F(), el = buehne && buehne.querySelector('.f3d'); if (!f || !el) return;
    try { f.start(el); } catch (e) { return; }
    var n = 0; (function warte() {             // Bild erst ausblenden, wenn das Modell wirklich gezeichnet wird
      var z = f.zustand ? f.zustand() : null;
      if (z && z.bilder > 1 && !el.hidden) { buehne.classList.add('bereit'); return; }
      if (++n < 120) setTimeout(warte, 100);
    })();
  }

  function einrichten() {
    knopf = sichtbarerKnopf(); if (!knopf) return;
    var probe = knopf.closest('.probe') || knopf;
    buehne = document.createElement('div');
    buehne.className = 'funkel-buehne';
    buehne.setAttribute('role', 'button');
    buehne.setAttribute('aria-label', 'Funkel das Einhorn: Hörprobe anhören');
    buehne.innerHTML = '<img alt="" src="' + BILD + '"><div class="f3d" aria-hidden="true"></div>';
    probe.parentNode.insertBefore(buehne, probe);
    buehne.addEventListener('click', function () { knopf.click(); });

    // nach dem Klick der Seite (die das Audio anlegt) anhängen
    document.addEventListener('click', function (e) {
      var k = e.target.closest && e.target.closest('.hoer[data-src]'); if (!k) return;
      huelleHolen(k.dataset.src);
      setTimeout(function () { anhaengen(k._a); }, 0);
    });

    window.addEventListener('funkel3d-bereit', starten);
    if (F()) starten();
    var spaeter = window.requestIdleCallback || function (fn) { setTimeout(fn, 300); };
    if (document.readyState === 'complete') spaeter(modulLaden);
    else window.addEventListener('load', function () { spaeter(modulLaden); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einrichten);
  else einrichten();
})();
