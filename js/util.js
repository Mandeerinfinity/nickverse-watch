/* NICK-VERSE Watch — shared utilities */
(function () {
  'use strict';
  const NV = (window.NV = window.NV || {});

  NV.THEMES = [
    { id: 'arc',     name: 'Arc Reactor',     primary: '#4de8ff', secondary: '#bff8ff', tertiary: '#ffb547', bg: '#01060b', bg1: '#05263a', hand: '#ffffff', swatch: 'radial-gradient(circle at 35% 35%,#e8feff,#4de8ff 45%,#05263a)' },
    { id: 'armor',   name: 'Crimson Armor',   primary: '#ff4545', secondary: '#ffd27a', tertiary: '#ffd27a', bg: '#070102', bg1: '#2c0708', hand: '#ffe6b0', swatch: 'conic-gradient(from 200deg,#ff4545,#ffd27a,#ff4545)' },
    { id: 'stealth', name: 'Stealth Night',   primary: '#9fb4c4', secondary: '#e9f1f6', tertiary: '#7dffb5', bg: '#030405', bg1: '#12171c', hand: '#f2f7fa', swatch: 'radial-gradient(circle at 35% 35%,#e9f1f6,#56636e 50%,#0b0e11)' },
    { id: 'neon',    name: 'Nick-Verse Neon', primary: '#b46bff', secondary: '#ff5ee1', tertiary: '#5ef2ff', bg: '#05010c', bg1: '#220a3d', hand: '#ffffff', swatch: 'conic-gradient(from 90deg,#b46bff,#ff5ee1,#5ef2ff,#b46bff)' },
    { id: 'gamma',   name: 'Gamma Pulse',     primary: '#5dff9a', secondary: '#d9ff6b', tertiary: '#ffe66b', bg: '#010803', bg1: '#06291a', hand: '#f4fff0', swatch: 'radial-gradient(circle at 35% 35%,#f4fff0,#5dff9a 45%,#06291a)' }
  ];
  NV.themeById = (id) => NV.THEMES.find((t) => t.id === id) || NV.THEMES[0];

  // ---------- Storage ----------
  const PREFIX = 'nickverse.watch.';
  NV.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(PREFIX + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* private mode */ } }
  };

  // ---------- Settings (reactive-ish) ----------
  const DEFAULTS = { theme: 'arc', h24: false, chime: false, announce: false, sweep: true, particles: true, scanlines: true, parallax: true, uisound: true, volume: 0.7, voice: '' };
  NV.settings = Object.assign({}, DEFAULTS, NV.store.get('settings', {}));
  const listeners = [];
  NV.onSetting = (fn) => listeners.push(fn);
  NV.setSetting = (k, v) => {
    NV.settings[k] = v; NV.store.set('settings', NV.settings);
    listeners.forEach((fn) => { try { fn(k, v); } catch (e) { console.error(e); } });
  };

  // ---------- Time formatting ----------
  NV.pad = (n, w = 2) => String(Math.floor(Math.abs(n))).padStart(w, '0');
  NV.fmtHM = (d, h24 = NV.settings.h24) => {
    let h = d.getHours(); const m = d.getMinutes();
    if (h24) return { hm: NV.pad(h) + ':' + NV.pad(m), ampm: '' };
    const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return { hm: h + ':' + NV.pad(m), ampm };
  };
  NV.fmtClock = (hh, mm, h24 = NV.settings.h24) => {
    if (h24) return NV.pad(hh) + ':' + NV.pad(mm);
    return ((hh % 12) || 12) + ':' + NV.pad(mm) + ' ' + (hh >= 12 ? 'PM' : 'AM');
  };
  NV.fmtDuration = (ms, withCs = true) => {
    ms = Math.max(0, ms);
    const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000);
    const base = (h ? h + ':' + NV.pad(m) : NV.pad(m)) + ':' + NV.pad(s);
    return withCs ? base + '.' + NV.pad(cs) : base;
  };
  NV.fmtHMS = (ms) => {
    const t = Math.ceil(Math.max(0, ms) / 1000);
    return NV.pad(Math.floor(t / 3600)) + ':' + NV.pad(Math.floor(t / 60) % 60) + ':' + NV.pad(t % 60);
  };
  NV.fmtSpan = (min) => { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + 'h ' + NV.pad(min % 60) + 'm'; };

  // ---------- Color ----------
  NV.hexToRgb = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  NV.rgba = (hex, a) => { const [r, g, b] = NV.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  NV.mixHex = (a, b, t) => { const A = NV.hexToRgb(a), B = NV.hexToRgb(b); const c = A.map((v, i) => Math.round(v + (B[i] - v) * t)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  NV.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  NV.lerp = (a, b, t) => a + (b - a) * t;
  NV.ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- DOM ----------
  NV.$ = (s, r = document) => r.querySelector(s);
  NV.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  NV.el = (tag, attrs = {}, html) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; };
  NV.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  NV.toast = (msg, ms = 3800) => {
    const box = NV.$('#toasts'); if (!box) return;
    const t = NV.el('div', { class: 'toast' }); t.textContent = msg; box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
  };

  NV.buildTicks = (g, n = 60, major = 5, r1 = 96, r2 = 92, r3 = 89) => {
    if (!g) return; const ns = 'http://www.w3.org/2000/svg'; let html = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, isMaj = i % major === 0, ri = isMaj ? r3 : r2;
      html += `<line class="tick${isMaj ? ' major' : ''}" x1="${100 + Math.cos(a) * r1}" y1="${100 + Math.sin(a) * r1}" x2="${100 + Math.cos(a) * ri}" y2="${100 + Math.sin(a) * ri}"/>`;
    }
    g.innerHTML = html; void ns;
  };
  NV.setRing = (el, frac) => { if (el) el.style.strokeDasharray = `${NV.clamp(frac, 0, 1) * 100} 100`; };

  NV.dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);
  NV.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
})();
