/* UVEG — widget de accesibilidad unificado. Una sola etiqueta <script>, sin dependencias,
 * UI en Shadow DOM (aislada del framework anfitrion, Bootstrap/Tailwind/Joomla/ninguno),
 * preferencias en localStorage (no hay cuenta compartida entre plataformas por diseno).
 * cdn.alonsobasauri.com/a11y/v1/a11y.js — Alonso, UVEG, 2026-09-02.
 */
(function () {
  'use strict';

  // capturado YA, sincrono: document.currentScript es null en cuanto corre codigo async
  // (p.ej. el listener de DOMContentLoaded de mas abajo), asi que hay que guardarlo aqui arriba.
  var SELF_SCRIPT = document.currentScript;

  // Base para assets (fuentes, etc.) relativa a DESDE DONDE SE CARGO este script — asi
  // funciona igual si se sirvio del CDN (copper-wolf) o del espejo de GitHub Pages, sin
  // hardcodear ningun host. Fallback al CDN solo si por lo que sea no hay currentScript.src
  // (p.ej. injeccion manual rara) — nunca se deja sin fuente.
  var ASSET_BASE = (function () {
    var src = SELF_SCRIPT && SELF_SCRIPT.src;
    if (src) return src.replace(/[^/]*$/, '');
    return 'https://cdn.alonsobasauri.com/a11y/v1/';
  })();

  if (window.__uvegA11yLoaded) return;
  window.__uvegA11yLoaded = true;
  if (typeof document.body === 'undefined' && !document.body) return;
  if (typeof Element === 'undefined' || !Element.prototype.attachShadow) return;

  var STORAGE_KEY = 'uveg-a11y-prefs-v1';
  var POS_KEY = 'uveg-a11y-fabpos-v1'; // posicion del boton flotante (NO se borra con "Reiniciar todo")
  var CX = 'uveg-a11y-'; // prefix for the GLOBAL effect classes injected on <html>

  var Z = { overlay: 2147483000, guide: 2147483200, panel: 2147483400, lens: 2147483600 };

  var DEFAULTS = {
    fontface: '', fontsize: 0, lineheight: 0, letterspacing: 0, paragraphwidth: 0,
    textalignment: '', fontkerning: false,
    backgroundcolour: '', textcolour: '',
    imagevisibility: false, linkhighlight: false,
    bigcursor: false, readingguide: false, readingmask: false,
    highsaturation: false, lowsaturation: false, stopanimations: false,
    magnifier: false, texttospeech: false, ttsRate: 1, ttsVoiceURI: '',
    profile: ''
  };

  var FONTSIZE = [1, 1.25, 1.5, 2];
  var LINEHEIGHT = [1.2, 1.5, 2, 3];
  var LETTERSPACING = [0, 0.1, 0.3, 0.5];
  var PARAGRAPHWIDTH = [0, 25, 50, 100];
  var LEVEL_LABELS = ['Apagado', 'Bajo', 'Medio', 'Alto'];

  var BG_PRESETS = [
    { hex: '#000000', label: 'Negro' }, { hex: '#1a1a2e', label: 'Azul oscuro' },
    { hex: '#f5f5dc', label: 'Beige' }, { hex: '#fffff0', label: 'Marfil' }
  ];
  var FG_PRESETS = [
    { hex: '#ffffff', label: 'Blanco' }, { hex: '#ffff00', label: 'Amarillo' },
    { hex: '#00ff00', label: 'Verde' }, { hex: '#000000', label: 'Negro' }
  ];

  // Sin iconos emoji: en varios entornos de UVEG (Chrome sin Noto Color Emoji, thin clients)
  // los pictogramas a color se ven como tofu boxes — se probo en vivo (ver bitacora). Solo texto.
  var PROFILES = [
    { id: 'visualimpairment', label: 'Apoyo visual',
      actions: [['fontface', 'sansserif'], ['fontsize', 2], ['highsaturation', true], ['bigcursor', true]] },
    { id: 'seizure', label: 'Proteccion ante epilepsia',
      actions: [['lowsaturation', true], ['stopanimations', true]] },
    { id: 'colorblind', label: 'Vision de color',
      actions: [['fontface', 'sansserif'], ['highsaturation', true]] },
    { id: 'adhd', label: 'TDAH',
      actions: [['lowsaturation', true], ['stopanimations', true], ['readingmask', true]] },
    { id: 'dyslexia', label: 'Dislexia',
      actions: [['fontface', 'dyslexic'], ['readingguide', true]] },
    { id: 'learning', label: 'Aprendizaje',
      actions: [['fontface', 'sansserif'], ['fontsize', 1], ['readingguide', true]] },
    { id: 'listencourse', label: 'Escuchar el curso',
      actions: [['texttospeech', true]] }
  ];

  // ---------- state ----------
  var prefs = loadPrefs();

  function loadPrefs() {
    var out = {};
    for (var k in DEFAULTS) out[k] = DEFAULTS[k];
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k2 in saved) if (k2 in DEFAULTS) out[k2] = saved[k2];
      }
    } catch (e) { /* localStorage bloqueado (privado/embebido): se sigue con defaults en memoria */ }
    out.magnifier = false; // nunca persiste entre cargas: requiere permiso/estado por sesion
    return out;
  }

  function savePrefs() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* ver loadPrefs */ }
  }

  function setPref(key, value) {
    prefs[key] = value;
    if (key !== 'profile' && PROFILE_MANAGED.indexOf(key) === -1) prefs.profile = '';
    savePrefs();
    applyPrefs();
    renderPanel();
  }

  var PROFILE_MANAGED = ['fontface', 'fontsize', 'highsaturation', 'bigcursor', 'lowsaturation',
    'stopanimations', 'readingmask', 'readingguide', 'texttospeech'];

  function resetAll() {
    for (var k in DEFAULTS) prefs[k] = DEFAULTS[k];
    savePrefs();
    applyPrefs();
    renderPanel();
  }

  function applyProfile(id) {
    if (prefs.profile === id) { resetAll(); return; }
    for (var k in DEFAULTS) prefs[k] = DEFAULTS[k];
    var p = null;
    for (var i = 0; i < PROFILES.length; i++) if (PROFILES[i].id === id) p = PROFILES[i];
    if (!p) return;
    p.actions.forEach(function (a) { prefs[a[0]] = a[1]; });
    prefs.profile = id;
    savePrefs();
    applyPrefs();
    renderPanel();
  }

  // ---------- global effects stylesheet (light DOM — this is the one deliberate leak: it only
  // ever matches our own uveg-a11y-* classes on <html>, gated by explicit user action) ----------
  var EFFECTS_CSS = [
    'html.' + CX + 'fontface-sansserif *:not(i):not([class*="fa-"]):not([class*="icon"]){font-family:"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif!important}',
    'html.' + CX + 'fontface-serif *:not(i):not([class*="fa-"]):not([class*="icon"]){font-family:Georgia,Cambria,"Times New Roman",Times,serif!important}',
    // OpenDyslexic real (mismo .otf que traia el plugin original), servida desde el mismo
    // origen del que se cargo este script (ASSET_BASE) para que funcione igual desde el CDN
    // que desde el espejo de GitHub Pages. Verdana/Comic Sans queda como RESPALDO en la pila
    // por si la fuente no llega a cargar (red lenta, bloqueo, etc.) — ya no es la funcion
    // principal, es el fallback.
    '@font-face{font-family:"opendyslexic-uveg";src:url("' + ASSET_BASE + 'fontface/opendyslexic.otf") format("opentype");font-display:swap}',
    'html.' + CX + 'fontface-dyslexic *:not(i):not([class*="fa-"]):not([class*="icon"]){font-family:"opendyslexic-uveg",Verdana,"Comic Sans MS",Arial,sans-serif!important;letter-spacing:.04em!important;word-spacing:.1em!important}',
    'html.' + CX + 'fontsize-125 *{font-size:1.25rem!important}',
    'html.' + CX + 'fontsize-150 *{font-size:1.5rem!important}',
    'html.' + CX + 'fontsize-200 *{font-size:2rem!important}',
    'html.' + CX + 'lineheight-150 *{line-height:1.5!important}',
    'html.' + CX + 'lineheight-200 *{line-height:2!important}',
    'html.' + CX + 'lineheight-300 *{line-height:3!important}',
    'html.' + CX + 'letterspacing-10 *{letter-spacing:.1rem!important}',
    'html.' + CX + 'letterspacing-30 *{letter-spacing:.3rem!important}',
    'html.' + CX + 'letterspacing-50 *{letter-spacing:.5rem!important}',
    'html.' + CX + 'paragraphwidth-25 p{max-width:25rem!important}',
    'html.' + CX + 'paragraphwidth-50 p{max-width:50rem!important}',
    'html.' + CX + 'paragraphwidth-100 p{max-width:100rem!important}',
    'html.' + CX + 'align-left p,html.' + CX + 'align-left h1,html.' + CX + 'align-left h2,html.' + CX + 'align-left h3,html.' + CX + 'align-left h4,html.' + CX + 'align-left h5,html.' + CX + 'align-left h6,html.' + CX + 'align-left li,html.' + CX + 'align-left td,html.' + CX + 'align-left th,html.' + CX + 'align-left dt,html.' + CX + 'align-left dd{text-align:left!important}',
    'html.' + CX + 'align-center p,html.' + CX + 'align-center h1,html.' + CX + 'align-center h2,html.' + CX + 'align-center h3,html.' + CX + 'align-center h4,html.' + CX + 'align-center h5,html.' + CX + 'align-center h6,html.' + CX + 'align-center li,html.' + CX + 'align-center td,html.' + CX + 'align-center th,html.' + CX + 'align-center dt,html.' + CX + 'align-center dd{text-align:center!important}',
    'html.' + CX + 'align-right p,html.' + CX + 'align-right h1,html.' + CX + 'align-right h2,html.' + CX + 'align-right h3,html.' + CX + 'align-right h4,html.' + CX + 'align-right h5,html.' + CX + 'align-right h6,html.' + CX + 'align-right li,html.' + CX + 'align-right td,html.' + CX + 'align-right th,html.' + CX + 'align-right dt,html.' + CX + 'align-right dd{text-align:right!important}',
    'html.' + CX + 'align-justify p,html.' + CX + 'align-justify h1,html.' + CX + 'align-justify h2,html.' + CX + 'align-justify h3,html.' + CX + 'align-justify h4,html.' + CX + 'align-justify h5,html.' + CX + 'align-justify h6,html.' + CX + 'align-justify li,html.' + CX + 'align-justify td,html.' + CX + 'align-justify th,html.' + CX + 'align-justify dt,html.' + CX + 'align-justify dd{text-align:justify!important}',
    'html.' + CX + 'fontkerning-off *{font-kerning:none!important}',
    'html.' + CX + 'bg-on *:not(img){background-color:var(--uveg-a11y-bg)!important}',
    'html.' + CX + 'fg-on *{color:var(--uveg-a11y-fg)!important}',
    'html.' + CX + 'hide-images img{visibility:hidden!important}',
    'html.' + CX + 'hide-images *{background-image:none!important}',
    'html.' + CX + 'link-highlight a{outline:2px solid #0046b8!important;outline-offset:2px!important}',
    'html.' + CX + 'bigcursor,html.' + CX + 'bigcursor *{cursor:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M5.5 3.2 L5.5 20.8 L10.5 15.8 L13.8 22.5 L16.6 21.2 L13.3 14.5 L19 14.5 Z\' fill=\'%23000000\' stroke=\'%23ffffff\' stroke-width=\'1.2\' stroke-linejoin=\'round\'/%3E%3C/svg%3E") 5 3,auto!important}',
    // no se usa filter: en un ancestro rompe el containing-block de los position:fixed propios
    // (panel/lupa/guia/mascara) — igual que en el origen campus, overlay ::before + backdrop-filter.
    'html.' + CX + 'highsaturation::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:' + Z.overlay + ';-webkit-backdrop-filter:saturate(2);backdrop-filter:saturate(2)}',
    'html.' + CX + 'lowsaturation::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:' + Z.overlay + ';-webkit-backdrop-filter:saturate(.35);backdrop-filter:saturate(.35)}',
    // no se usa animation:none (dejaria congelados los elementos que arrancan con opacity:0);
    // se colapsa la duracion a 1ms para que la animacion corra y termine en su cuadro final.
    'html.' + CX + 'stopanimations *,html.' + CX + 'stopanimations *::before,html.' + CX + 'stopanimations *::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:1ms!important;transition-delay:0s!important;scroll-behavior:auto!important}',
    'html.' + CX + 'tts-on .' + CX + 'tts-readable{cursor:pointer!important}',
    '.' + CX + 'tts-reading{background-color:#fff3b0!important;box-shadow:0 0 0 4px #fff3b0!important;border-radius:4px}'
  ].join('\n');

  function ensureEffectsStyle() {
    if (document.getElementById('uveg-a11y-effects')) return;
    var style = document.createElement('style');
    style.id = 'uveg-a11y-effects';
    style.textContent = EFFECTS_CSS;
    document.head.appendChild(style);
  }

  function applyPrefs() {
    var html = document.documentElement;
    var wanted = [];
    if (prefs.fontface) wanted.push(CX + 'fontface-' + prefs.fontface);
    if (prefs.fontsize > 0) wanted.push(CX + 'fontsize-' + Math.round(FONTSIZE[prefs.fontsize] * 100));
    if (prefs.lineheight > 0) wanted.push(CX + 'lineheight-' + Math.round(LINEHEIGHT[prefs.lineheight] * 100));
    if (prefs.letterspacing > 0) wanted.push(CX + 'letterspacing-' + Math.round(LETTERSPACING[prefs.letterspacing] * 100));
    if (prefs.paragraphwidth > 0) wanted.push(CX + 'paragraphwidth-' + PARAGRAPHWIDTH[prefs.paragraphwidth]);
    if (prefs.textalignment) wanted.push(CX + 'align-' + prefs.textalignment);
    if (prefs.fontkerning) wanted.push(CX + 'fontkerning-off');
    if (prefs.backgroundcolour) wanted.push(CX + 'bg-on');
    if (prefs.textcolour) wanted.push(CX + 'fg-on');
    if (prefs.imagevisibility) wanted.push(CX + 'hide-images');
    if (prefs.linkhighlight) wanted.push(CX + 'link-highlight');
    if (prefs.bigcursor) wanted.push(CX + 'bigcursor');
    if (prefs.highsaturation) wanted.push(CX + 'highsaturation');
    else if (prefs.lowsaturation) wanted.push(CX + 'lowsaturation'); // alta gana si ambas activas
    if (prefs.stopanimations) wanted.push(CX + 'stopanimations');
    if (prefs.texttospeech) wanted.push(CX + 'tts-on');

    var current = [];
    html.classList.forEach(function (c) { if (c.indexOf(CX) === 0) current.push(c); });
    current.forEach(function (c) { if (wanted.indexOf(c) === -1) html.classList.remove(c); });
    wanted.forEach(function (c) { html.classList.add(c); });

    if (prefs.backgroundcolour) html.style.setProperty('--uveg-a11y-bg', prefs.backgroundcolour);
    if (prefs.textcolour) html.style.setProperty('--uveg-a11y-fg', prefs.textcolour);

    readingGuide.set(prefs.readingguide);
    readingMask.set(prefs.readingmask);
    magnifier.set(prefs.magnifier);
    tts.set(prefs.texttospeech);

    syncIframes();
  }

  // ---------- same-origin iframe sync (SCORM/H5P/paquetes embebidos) ----------
  var trackedIframes = [];
  function syncIframes() {
    var iframes = document.querySelectorAll('iframe');
    iframes.forEach(function (f) { scanIframe(f, 0); });
  }
  function scanIframe(iframe, depth) {
    if (depth > 3) return;
    var doc;
    try { doc = iframe.contentDocument; if (!doc || !doc.body) return; } catch (e) { return; }
    if (!doc.getElementById('uveg-a11y-effects')) {
      try {
        var s = doc.createElement('style');
        s.id = 'uveg-a11y-effects';
        s.textContent = EFFECTS_CSS;
        doc.head.appendChild(s);
      } catch (e) { return; }
    }
    var wanted = [];
    document.documentElement.classList.forEach(function (c) { if (c.indexOf(CX) === 0) wanted.push(c); });
    var current = [];
    doc.documentElement.classList.forEach(function (c) { if (c.indexOf(CX) === 0) current.push(c); });
    current.forEach(function (c) { if (wanted.indexOf(c) === -1) doc.documentElement.classList.remove(c); });
    wanted.forEach(function (c) { doc.documentElement.classList.add(c); });
    if (prefs.backgroundcolour) doc.documentElement.style.setProperty('--uveg-a11y-bg', prefs.backgroundcolour);
    if (prefs.textcolour) doc.documentElement.style.setProperty('--uveg-a11y-fg', prefs.textcolour);
    if (trackedIframes.indexOf(iframe) === -1) {
      trackedIframes.push(iframe);
      iframe.addEventListener('load', function () { scanIframe(iframe, depth); });
    }
    doc.querySelectorAll('iframe').forEach(function (inner) { scanIframe(inner, depth + 1); });
  }
  new MutationObserver(function () { syncIframes(); updateModalAvoidance(); }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-modal', 'open', 'style']
  });

  // ---------- no taparle un modal del sitio anfitrion: si detecta uno abierto, el panel/fab
  // bajan su z-index por debajo (Alonso, 2026-09-02: "que si pueda tapar todo" salvo modales) ----------
  var MODAL_SELECTOR = '[role="dialog"],[aria-modal="true"],dialog[open],.modal.show,.modal.in';
  function detectModalZ() {
    var nodes = document.querySelectorAll(MODAL_SELECTOR);
    var maxZ = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.closest && n.closest('#uveg-a11y-host')) continue;
      // Moodle (y otros) dejan plantillas de dialogo ocultas en el DOM aunque no esten
      // abiertas — sin este filtro, un role="dialog" invisible con z-index propio bajaba
      // el widget para siempre, aunque nunca hubiera un modal real en pantalla.
      if (n.getClientRects().length === 0) continue;
      var cs = window.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var z = parseInt(cs.zIndex, 10);
      if (!isNaN(z) && z > maxZ) maxZ = z;
    }
    return maxZ;
  }
  var updateModalAvoidance = debounce(function () {
    if (!fabEl) return;
    var modalZ = detectModalZ();
    var targets = [fabEl, panelEl, backdropEl];
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t) continue;
      t.style.zIndex = modalZ > 0 ? String(modalZ - 1) : '';
    }
  }, 150);

  // ---------- runtime helpers: reading guide / reading mask / magnifier / text-to-speech ----------
  function raf1(fn) {
    var id = null;
    return function () {
      var args = arguments;
      if (id == null) id = window.requestAnimationFrame(function () { id = null; fn.apply(null, args); });
    };
  }

  var readingGuide = (function () {
    var el = null, onMove = null;
    return {
      set: function (on) {
        if (on && !el) {
          el = mkShadowOverlay('div', CX + 'guide-el');
          el.style.cssText = 'position:fixed;left:0;right:0;height:10px;margin-top:-5px;background:#000;border-top:2px solid #ffed00;border-bottom:2px solid #ffed00;box-sizing:border-box;pointer-events:none;z-index:' + Z.guide;
          onMove = raf1(function (y) { el.style.top = y + 'px'; });
          document.addEventListener('mousemove', function (e) { onMove(e.clientY); }, { passive: true });
        }
        if (el) el.style.display = on ? 'block' : 'none';
      }
    };
  })();

  var readingMask = (function () {
    var top = null, bottom = null, GAP = 160;
    function paint(y) {
      var h = window.innerHeight;
      top.style.height = Math.max(0, y - GAP / 2) + 'px';
      bottom.style.height = Math.max(0, h - y - GAP / 2) + 'px';
    }
    return {
      set: function (on) {
        if (on && !top) {
          top = mkShadowOverlay('div', CX + 'mask-top');
          bottom = mkShadowOverlay('div', CX + 'mask-bottom');
          var base = 'position:fixed;left:0;right:0;background:rgba(0,0,0,.55);pointer-events:none;z-index:' + Z.guide + ';';
          top.style.cssText = base + 'top:0';
          bottom.style.cssText = base + 'bottom:0';
          var throttled = raf1(paint);
          paint(window.innerHeight / 2);
          document.addEventListener('mousemove', function (e) { throttled(e.clientY); }, { passive: true });
          window.addEventListener('resize', function () { throttled(window.innerHeight / 2); }, { passive: true });
        }
        if (top) { top.style.display = bottom.style.display = on ? 'block' : 'none'; }
      }
    };
  })();

  var magnifier = (function () {
    var lens = null, stage = null, active = false, scale = 2, size = 220;
    var lastX = 0, lastY = 0;
    function refresh() {
      if (!active) return;
      var clone;
      try { clone = document.body.cloneNode(true); } catch (e) { return; }
      var host = clone.querySelector('#uveg-a11y-host');
      if (host) host.remove();
      clone.querySelectorAll('script').forEach(function (s) { s.remove(); });
      stage.innerHTML = '';
      clone.style.margin = '0';
      clone.style.width = document.documentElement.scrollWidth + 'px';
      clone.style.transform = 'scale(' + scale + ')';
      clone.style.transformOrigin = '0 0';
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.pointerEvents = 'none';
      stage.appendChild(clone);
      reposition(lastX, lastY);
    }
    function reposition(x, y) {
      lastX = x; lastY = y;
      stage.style.left = (-x * scale + size / 2) + 'px';
      stage.style.top = (-y * scale + size / 2) + 'px';
      lens.style.left = x + 'px';
      lens.style.top = y + 'px';
    }
    var refreshDebounced = debounce(refresh, 500);
    var refreshScroll = debounce(refresh, 300);
    return {
      set: function (on) {
        active = on;
        if (on && !lens) {
          lens = mkShadowOverlay('div', CX + 'lens');
          lens.style.cssText = 'display:none;position:fixed;width:' + size + 'px;height:' + size + 'px;margin-left:-' + (size / 2) + 'px;margin-top:-' + (size / 2) + 'px;border-radius:50%;border:3px solid #0046b8;box-shadow:0 8px 32px rgba(0,0,0,.35);overflow:hidden;pointer-events:none;z-index:' + Z.lens + ';background:#fff';
          stage = document.createElement('div');
          stage.style.position = 'absolute';
          lens.appendChild(stage);
          document.addEventListener('mousemove', function (e) { if (active) reposition(e.clientX, e.clientY); }, { passive: true });
          window.addEventListener('scroll', function () { refreshScroll(); }, { passive: true });
          window.addEventListener('resize', function () { refreshDebounced(); }, { passive: true });
        }
        if (lens) lens.style.display = on ? 'block' : 'none';
        if (on) refresh();
      }
    };
  })();

  var tts = (function () {
    var enabled = false, hoverTimer = null, cursorIdx = -1, blocks = [];
    var SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,dt,dd,figcaption,caption,a,button,.btn';
    function pickVoice() {
      var voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      var es = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf('es') === 0; });
      if (prefs.ttsVoiceURI) {
        var saved = es.filter(function (v) { return v.voiceURI === prefs.ttsVoiceURI; });
        if (saved.length) return saved[0];
      }
      var scored = es.map(function (v) {
        var s = 0;
        if (v.lang.toLowerCase() === 'es-us') s += 4;
        if (v.name.toLowerCase().indexOf('google') !== -1) s += 2;
        s += 1;
        return { v: v, s: s };
      }).sort(function (a, b) { return b.s - a.s; });
      return scored.length ? scored[0].v : null;
    }
    function speak(text) {
      if (!window.speechSynthesis || !text) return;
      window.speechSynthesis.cancel();
      var chunks = text.match(/[^.!?;:]+[.!?;:]?/g) || [text];
      chunks.forEach(function (c) {
        var u = new SpeechSynthesisUtterance(c.trim());
        var voice = pickVoice();
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang : 'es-MX';
        u.rate = prefs.ttsRate || 1;
        window.speechSynthesis.speak(u);
      });
    }
    function blockText(el) {
      var clone = el.cloneNode(true);
      clone.querySelectorAll('img').forEach(function (img) {
        var t = img.getAttribute('alt') || img.getAttribute('aria-label') || '';
        img.replaceWith(document.createTextNode(' ' + t + ' '));
      });
      return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }
    function readableBlocks() {
      return Array.prototype.filter.call(document.querySelectorAll(SELECTOR), function (el) {
        if (el.closest('#uveg-a11y-host')) return false;
        if (el.closest('iframe')) return false;
        if (el.closest(SELECTOR) !== el) return false;
        var r = el.getClientRects();
        return r.length > 0;
      });
    }
    function highlight(el) {
      document.querySelectorAll('.' + CX + 'tts-reading').forEach(function (e) { e.classList.remove(CX + 'tts-reading'); });
      if (el) el.classList.add(CX + 'tts-reading');
    }
    function onHover(e) {
      if (!enabled) return;
      var el = e.target.closest(SELECTOR);
      if (!el || el.closest('#uveg-a11y-host') || el.closest('iframe')) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(function () {
        highlight(el);
        speak(blockText(el));
      }, 200);
    }
    function onKey(e) {
      if (!enabled) return;
      if (e.key === 'Escape') { window.speechSynthesis && window.speechSynthesis.cancel(); highlight(null); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
      blocks = readableBlocks();
      if (!blocks.length) return;
      if (e.key === 'ArrowDown') cursorIdx = Math.min(blocks.length - 1, cursorIdx + 1);
      else if (e.key === 'ArrowUp') cursorIdx = Math.max(0, cursorIdx - 1);
      else if (e.key === 'Enter') { if (cursorIdx >= 0) blocks[cursorIdx].click(); return; }
      var el = blocks[cursorIdx];
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      highlight(el);
      speak(blockText(el));
    }
    document.addEventListener('mouseover', onHover, { passive: true });
    document.addEventListener('keydown', onKey);
    return {
      set: function (on) {
        enabled = on;
        if (!on) { window.speechSynthesis && window.speechSynthesis.cancel(); highlight(null); cursorIdx = -1; }
      }
    };
  })();

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      window.clearTimeout(t);
      t = window.setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // ---------- shadow UI ----------
  var host, shadow, panelEl, fabEl;
  var floatingMode = true; // false = la pagina trae su propio contenedor (fijo, sin arrastre)

  function mkShadowOverlay(tag, cls) {
    var el = document.createElement(tag);
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    shadow.appendChild(el);
    return el;
  }

  // ---------- donde se monta el boton: 3 niveles, del mas especifico al menos (Alonso, 2026-09-02) ----------
  function findMount() {
    var byId = document.getElementById('uveg-a11y');
    if (byId) return byId;
    if (SELF_SCRIPT) {
      var sel = SELF_SCRIPT.getAttribute('data-mount');
      if (sel) {
        var target = document.querySelector(sel);
        if (target) return target;
      }
    }
    return null; // nivel 3: sin contenedor -> boton flotante, arrastrable, con posicion guardada
  }

  function buildHost() {
    var mount = findMount();
    floatingMode = !mount;
    host = document.createElement('div');
    host.id = 'uveg-a11y-host';
    if (mount) {
      host.style.cssText = 'position:relative;display:inline-block;line-height:0;';
      mount.appendChild(host);
    } else {
      host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;';
      document.body.appendChild(host);
    }
    shadow = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);
  }

  // ---------- posicion del boton flotante: arrastre con mouse Y con dedo (Pointer Events cubre
  // ambos con el mismo codigo), clamp a viewport, se recuerda entre cargas (Alonso, 2026-09-02) ----------
  function loadFabPos() {
    try {
      var raw = window.localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ver loadPrefs */ }
    return null;
  }
  function saveFabPos(xFrac, yFrac) {
    try { window.localStorage.setItem(POS_KEY, JSON.stringify({ x: xFrac, y: yFrac })); } catch (e) { /* ver loadPrefs */ }
  }
  function applyFabPos() {
    if (!floatingMode || !fabEl) return;
    var pos = loadFabPos();
    if (!pos) return; // sin posicion guardada: se queda con el default de CSS (abajo-derecha)
    var size = fabEl.offsetWidth || 52;
    var maxX = Math.max(0, window.innerWidth - size);
    var maxY = Math.max(0, window.innerHeight - size);
    var x = Math.min(Math.max(0, pos.x * maxX), maxX);
    var y = Math.min(Math.max(0, pos.y * maxY), maxY);
    fabEl.style.left = x + 'px';
    fabEl.style.top = y + 'px';
    fabEl.style.right = 'auto';
    fabEl.style.bottom = 'auto';
  }

  var suppressFabClick = false;
  function bindDrag() {
    var dragging = false, moved = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    var THRESH = 6; // px antes de considerarlo arrastre y no un click/tap
    fabEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      var r = fabEl.getBoundingClientRect();
      startLeft = r.left; startTop = r.top;
      try { fabEl.setPointerCapture(e.pointerId); } catch (e2) { /* algunos navegadores viejos no lo tienen */ }
    });
    fabEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;
      moved = true;
      var size = fabEl.offsetWidth || 52;
      var maxX = Math.max(0, window.innerWidth - size), maxY = Math.max(0, window.innerHeight - size);
      var nx = Math.min(Math.max(0, startLeft + dx), maxX);
      var ny = Math.min(Math.max(0, startTop + dy), maxY);
      fabEl.style.left = nx + 'px';
      fabEl.style.top = ny + 'px';
      fabEl.style.right = 'auto';
      fabEl.style.bottom = 'auto';
      e.preventDefault();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        var size = fabEl.offsetWidth || 52;
        var maxX = window.innerWidth - size, maxY = window.innerHeight - size;
        var xFrac = maxX > 0 ? (parseFloat(fabEl.style.left) || 0) / maxX : 0;
        var yFrac = maxY > 0 ? (parseFloat(fabEl.style.top) || 0) / maxY : 0;
        saveFabPos(xFrac, yFrac);
        suppressFabClick = true; // el pointerup dispara un click justo despues: no debe abrir el panel
        window.setTimeout(function () { suppressFabClick = false; }, 0);
      }
      moved = false;
    }
    fabEl.addEventListener('pointerup', endDrag);
    fabEl.addEventListener('pointercancel', endDrag);
  }

  // el panel se ancla junto al boton (fijo o flotante donde haya quedado tras el arrastre),
  // eligiendo el cuadrante con mas espacio para no salirse de la pantalla
  function positionPanel() {
    if (!fabEl || !panelEl) return;
    var rect = fabEl.getBoundingClientRect();
    var margin = 12, gap = 10;
    var vw = window.innerWidth, vh = window.innerHeight;
    panelEl.style.left = panelEl.style.right = panelEl.style.top = panelEl.style.bottom = '';
    if (rect.left + rect.width / 2 > vw / 2) {
      panelEl.style.right = Math.max(margin, vw - rect.right) + 'px';
    } else {
      panelEl.style.left = Math.max(margin, rect.left) + 'px';
    }
    if (rect.top + rect.height / 2 > vh / 2) {
      panelEl.style.bottom = Math.max(margin, vh - rect.top + gap) + 'px';
    } else {
      panelEl.style.top = Math.max(margin, rect.bottom + gap) + 'px';
    }
  }

  var SHADOW_CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:"Segoe UI",Roboto,Arial,sans-serif}',
    '.fab{width:52px;height:52px;border-radius:50%;background:#0046b8;color:#fff;border:2px solid #0046b8;box-shadow:0 4px 14px rgba(20,38,145,.35);font-size:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:' + Z.panel + ';pointer-events:auto}',
    '.fab.floating{position:fixed;bottom:1.5rem;right:1.5rem;touch-action:none}',
    '.fab.anchored{position:static;width:36px;height:36px;font-size:18px}',
    '.fab:hover{background:#1c61ac;border-color:#1c61ac}',
    '.fab:focus-visible{outline:3px solid #1c61ac;outline-offset:2px}',
    '.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:' + (Z.panel - 1) + ';pointer-events:auto}',
    '.panel{display:none;position:fixed;bottom:6rem;right:1.5rem;width:340px;max-width:calc(100vw - 2rem);max-height:calc(100vh - 8rem);background:#fff;border:2px solid #0046b8;border-radius:12px;box-shadow:0 4px 24px rgba(20,38,145,.25);z-index:' + Z.panel + ';flex-direction:column;overflow:hidden;pointer-events:auto;color:#1a1a2e}',
    '.panel.open{display:flex}',
    '.hd{background:#0046b8;color:#fff;padding:.5rem .75rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem}',
    '.hd .title{display:flex;align-items:center;gap:.35rem;min-width:0}',
    '.hd .title-icon{font-size:14px;line-height:1;flex:none}',
    '.hd b{font-size:13px;font-weight:600;white-space:nowrap}',
    '.hd .actions{display:flex;gap:.5rem}',
    '.hd button{background:transparent;border:none;color:#fff;cursor:pointer;font-size:13px;padding:.25rem .4rem;border-radius:6px}',
    '.hd button:hover{background:rgba(255,255,255,.15)}',
    '.body{overflow-y:auto;padding:.75rem;display:flex;flex-direction:column;gap:.5rem}',
    'details{border:1px solid rgba(20,38,145,.15);border-radius:10px;overflow:hidden}',
    'summary{cursor:pointer;padding:.55rem .75rem;font-weight:600;color:#0046b8;list-style:none;display:flex;align-items:center;gap:.4rem;background:#f0f4ff}',
    'summary::-webkit-details-marker{display:none}',
    'summary:focus-visible{outline:2px solid #1c61ac}',
    '.sec-body{padding:.6rem .75rem;display:flex;flex-direction:column;gap:.7rem}',
    '.widget{display:flex;flex-direction:column;gap:.35rem}',
    '.wt{font-size:13px;font-weight:600;color:#1a1a2e}',
    '.hint{font-size:11px;color:#555;margin:0}',
    '.row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}',
    'button.pill{background:#fff;border:1px solid rgba(20,38,145,.3);border-radius:20px;color:#0046b8;font-size:12px;padding:.3rem .7rem;cursor:pointer}',
    'button.pill:hover{background:rgba(20,38,145,.08)}',
    'button.pill.active{background:#0046b8;border-color:#0046b8;color:#fff}',
    'button.pill:focus-visible{outline:2px solid #1c61ac;outline-offset:1px}',
    '.swatch{width:22px;height:22px;border-radius:50%;border:2px solid rgba(0,0,0,.15);cursor:pointer;padding:0}',
    '.swatch.active{border-color:#0046b8;box-shadow:0 0 0 2px #0046b8}',
    'input[type=color]{width:32px;height:26px;border:1px solid rgba(20,38,145,.3);border-radius:6px;padding:0;cursor:pointer;background:#fff}',
    'input[type=range]{width:100%}',
    '.profiles{display:flex;flex-wrap:wrap;gap:.4rem}',
    '.profile-chip{display:flex;align-items:center;gap:.35rem;background:#fff;border:1px solid rgba(20,38,145,.3);border-radius:20px;color:#0046b8;font-size:12px;padding:.35rem .6rem;cursor:pointer}',
    '.profile-chip.active{background:#0046b8;border-color:#0046b8;color:#fff}',
    '.profile-chip:hover{background:rgba(20,38,145,.08)}',
    '.profile-chip.active:hover{background:#1c61ac}',
    '.ft{padding:.6rem .75rem;border-top:1px solid rgba(20,38,145,.1);font-size:11px;color:#666}',
    '.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}'
  ].join('\n');

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function buildFab() {
    fabEl = el('button', {
      class: 'fab ' + (floatingMode ? 'floating' : 'anchored'), type: 'button',
      'aria-label': 'Abrir el panel de accesibilidad', 'aria-haspopup': 'dialog', text: '♿'
    });
    fabEl.addEventListener('click', function () {
      if (suppressFabClick) return; // fue un arrastre, no un click: no abrir el panel
      openPanel();
    });
    shadow.appendChild(fabEl);
    if (floatingMode) { applyFabPos(); bindDrag(); }
    window.addEventListener('resize', function () {
      if (floatingMode) applyFabPos();
      if (panelEl && panelEl.classList.contains('open')) positionPanel();
    });
  }

  var backdropEl = null;
  function openPanel() {
    panelEl.classList.add('open');
    positionPanel();
    updateModalAvoidance();
    if (window.innerWidth <= 480 && !backdropEl) {
      backdropEl = el('div', { class: 'backdrop', onclick: closePanel });
      shadow.insertBefore(backdropEl, panelEl);
    }
    document.addEventListener('keydown', onEscape);
    document.addEventListener('click', onOutsideClick, true);
    var first = panelEl.querySelector('button, input, [tabindex]');
    if (first) first.focus();
  }
  function closePanel() {
    panelEl.classList.remove('open');
    if (backdropEl) { backdropEl.remove(); backdropEl = null; }
    document.removeEventListener('keydown', onEscape);
    document.removeEventListener('click', onOutsideClick, true);
    fabEl.focus();
  }
  function onEscape(e) { if (e.key === 'Escape') closePanel(); }
  function onOutsideClick(e) {
    if (!panelEl.classList.contains('open')) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(host) === -1) closePanel();
  }

  function levelRow(key, levels, unitFmt) {
    var row = el('div', { class: 'row' });
    LEVEL_LABELS.forEach(function (label, i) {
      var btn = el('button', {
        class: 'pill' + (prefs[key] === i ? ' active' : ''), type: 'button', text: label,
        'aria-pressed': String(prefs[key] === i),
        onclick: function () { setPref(key, i); }
      });
      row.appendChild(btn);
    });
    return row;
  }

  function choiceRow(key, options) {
    var row = el('div', { class: 'row' });
    options.forEach(function (opt) {
      var active = prefs[key] === opt.value;
      var btn = el('button', {
        class: 'pill' + (active ? ' active' : ''), type: 'button', text: opt.label,
        'aria-pressed': String(active),
        onclick: function () { setPref(key, active ? '' : opt.value); }
      });
      row.appendChild(btn);
    });
    return row;
  }

  function toggleRow(key, onLabel, offLabel) {
    var active = !!prefs[key];
    var btn = el('button', {
      class: 'pill' + (active ? ' active' : ''), type: 'button', text: active ? onLabel : offLabel,
      'aria-pressed': String(active),
      onclick: function () { setPref(key, !prefs[key]); }
    });
    return el('div', { class: 'row' }, [btn]);
  }

  function colourWidget(key, presets, title, hint) {
    var wrap = el('div', { class: 'widget' }, [
      el('div', { class: 'wt', text: title }),
      hint ? el('p', { class: 'hint', text: hint }) : null
    ]);
    var row = el('div', { class: 'row' });
    presets.forEach(function (p) {
      var active = (prefs[key] || '').toLowerCase() === p.hex.toLowerCase();
      var sw = el('button', {
        class: 'swatch' + (active ? ' active' : ''), type: 'button', title: p.label,
        'aria-label': p.label, style: 'background:' + p.hex,
        onclick: function () { setPref(key, p.hex); }
      });
      row.appendChild(sw);
    });
    var picker = el('input', { type: 'color', value: prefs[key] || '#ffffff', 'aria-label': 'Elegir color personalizado para ' + title });
    picker.addEventListener('input', function () { setPref(key, picker.value); });
    row.appendChild(picker);
    if (prefs[key]) {
      row.appendChild(el('button', { class: 'pill', type: 'button', text: 'Restablecer', onclick: function () { setPref(key, ''); } }));
    }
    wrap.appendChild(row);
    return wrap;
  }

  function section(id, label, bodyChildren) {
    var det = el('details', { id: 'sec-' + id });
    if (prefs.profile) det.open = false;
    var sum = el('summary', {}, [document.createTextNode(label)]);
    var body = el('div', { class: 'sec-body' }, bodyChildren);
    det.appendChild(sum);
    det.appendChild(body);
    return det;
  }

  function renderPanel() {
    if (!panelEl) return;
    panelEl.innerHTML = '';

    var closeBtn = el('button', { type: 'button', 'aria-label': 'Cerrar', text: '✕', onclick: closePanel });
    var resetBtn = el('button', { type: 'button', text: 'Reiniciar todo', onclick: resetAll });
    var hd = el('div', { class: 'hd' }, [
      el('div', { class: 'title' }, [
        el('span', { class: 'title-icon', 'aria-hidden': 'true', text: '♿' }),
        el('b', { text: 'Accesibilidad' })
      ]),
      el('div', { class: 'actions' }, [resetBtn, closeBtn])
    ]);

    var profileChips = el('div', { class: 'profiles' });
    PROFILES.forEach(function (p) {
      var active = prefs.profile === p.id;
      profileChips.appendChild(el('button', {
        class: 'profile-chip' + (active ? ' active' : ''), type: 'button',
        'aria-pressed': String(active), text: p.label,
        onclick: function () { applyProfile(p.id); }
      }));
    });
    var profilesSec = section('profiles', 'Perfiles rapidos', [profileChips]);
    profilesSec.open = true;

    var contentSec = section('content', 'Contenido', [
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Tipo de letra' }),
        choiceRow('fontface', [{ value: 'sansserif', label: 'Sin serifa' }, { value: 'serif', label: 'Con serifa' }, { value: 'dyslexic', label: 'Dislexia' }])]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Tamano de letra' }), levelRow('fontsize', FONTSIZE)]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Interlineado' }), levelRow('lineheight', LINEHEIGHT)]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Espaciado entre letras' }), levelRow('letterspacing', LETTERSPACING)]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Ancho de parrafo' }), levelRow('paragraphwidth', PARAGRAPHWIDTH)]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Alineacion de texto' }),
        choiceRow('textalignment', [{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centrar' }, { value: 'right', label: 'Derecha' }, { value: 'justify', label: 'Justificar' }])]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Interletraje (kerning)' }), toggleRow('fontkerning', 'Sin kerning: activado', 'Sin kerning: desactivado')])
    ]);

    var colorSec = section('color', 'Color', [
      colourWidget('backgroundcolour', BG_PRESETS, 'Color de fondo'),
      colourWidget('textcolour', FG_PRESETS, 'Color de texto')
    ]);

    var visSec = section('visibility', 'Visibilidad', [
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Ocultar imagenes' }), toggleRow('imagevisibility', 'Ocultas', 'Visibles')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Resaltar enlaces' }), toggleRow('linkhighlight', 'Activado', 'Desactivado')])
    ]);

    var ttsWrap = el('div', { class: 'widget' }, [
      el('div', { class: 'wt', text: 'Lectura por voz' }),
      el('p', { class: 'hint', text: 'Pasa el mouse sobre un parrafo para escucharlo. Flechas arriba/abajo + Enter para navegar por teclado, Esc para detener.' }),
      toggleRow('texttospeech', 'Activada', 'Desactivada')
    ]);
    var rateRow = el('div', { class: 'row' });
    var rateInput = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.1', value: String(prefs.ttsRate) });
    rateInput.addEventListener('change', function () { setPref('ttsRate', parseFloat(rateInput.value)); });
    rateRow.appendChild(document.createTextNode('Velocidad'));
    rateRow.appendChild(rateInput);
    ttsWrap.appendChild(rateRow);

    var helpersSec = section('helpers', 'Ayudas', [
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Cursor grande' }), toggleRow('bigcursor', 'Activado', 'Desactivado')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Guia de lectura' }), el('p', { class: 'hint', text: 'Una linea horizontal sigue el cursor.' }), toggleRow('readingguide', 'Activada', 'Desactivada')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Mascara de lectura' }), el('p', { class: 'hint', text: 'Oscurece la pantalla salvo una franja bajo el cursor.' }), toggleRow('readingmask', 'Activada', 'Desactivada')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Saturacion alta' }), el('p', { class: 'hint', text: 'Intensifica los colores.' }), toggleRow('highsaturation', 'Activada', 'Desactivada')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Saturacion baja' }), el('p', { class: 'hint', text: 'Atenua los colores (reduce estimulos).' }), toggleRow('lowsaturation', 'Activada', 'Desactivada')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Detener animaciones' }), toggleRow('stopanimations', 'Activado', 'Desactivado')]),
      el('div', { class: 'widget' }, [el('div', { class: 'wt', text: 'Lupa' }), el('p', { class: 'hint', text: 'No se guarda entre visitas.' }), toggleRow('magnifier', 'Activada', 'Desactivada')]),
      ttsWrap
    ]);

    var body = el('div', { class: 'body' }, [profilesSec, contentSec, colorSec, visSec, helpersSec]);
    var ft = el('div', { class: 'ft', text: 'Tus preferencias se guardan solo en este navegador.' });

    panelEl.appendChild(hd);
    panelEl.appendChild(body);
    panelEl.appendChild(ft);
  }

  function buildPanel() {
    panelEl = el('div', { class: 'panel', role: 'dialog', 'aria-label': 'Panel de accesibilidad' });
    shadow.appendChild(panelEl);
    renderPanel();
  }

  function init() {
    try {
      ensureEffectsStyle();
      buildHost();
      buildFab();
      buildPanel();
      applyPrefs();
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = function () {};
    } catch (e) {
      // un fallo aqui nunca debe tumbar la pagina anfitriona
      if (window.console) console.error('[uveg-a11y] init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
