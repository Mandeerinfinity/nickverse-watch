/* NICK-VERSE Watch — app bootstrap, theme engine, main render loop, input */
(function () {
  'use strict';
  const NV = window.NV, $ = NV.$, S = NV.settings;

  // ---------- Theme engine (smooth color interpolation) ----------
  const KEYS = ['primary', 'secondary', 'tertiary', 'bg', 'bg1', 'hand'];
  const pickColors = (t) => KEYS.reduce((o, k) => ((o[k] = t[k]), o), {});
  NV.colors = Object.assign(pickColors(NV.themeById(S.theme)), { v: 1 });
  let themeAnim = null;

  function applyTheme(id, animate = true) {
    const th = NV.themeById(id);
    document.body.dataset.theme = th.id;
    $('#theme-name').textContent = th.name.toUpperCase();
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = th.bg1;
    NV.$$('.theme-dot, .theme-card').forEach((b) => { const on = b.dataset.theme === th.id; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); });
    if (!animate || NV.reducedMotion) { Object.assign(NV.colors, pickColors(th)); NV.colors.v++; themeAnim = null; return; }
    themeAnim = { from: pickColors(NV.colors), to: pickColors(th), start: performance.now(), dur: 900 };
  }
  function stepTheme(now) {
    if (!themeAnim) return;
    const k = NV.ease(NV.clamp((now - themeAnim.start) / themeAnim.dur, 0, 1));
    KEYS.forEach((key) => { NV.colors[key] = NV.mixHex(themeAnim.from[key], themeAnim.to[key], k); });
    NV.colors.v++;
    if (k >= 1) themeAnim = null;
  }
  function setTheme(id) { if (id === S.theme) return; NV.setSetting('theme', id); applyTheme(id); NV.audio.confirm(); const r = $('#watch').getBoundingClientRect(); NV.bg.burst(r.left + r.width / 2, r.top + r.height / 2, 36); }
  function cycleTheme(dir = 1) { const i = NV.THEMES.findIndex((t) => t.id === S.theme); setTheme(NV.THEMES[(i + dir + NV.THEMES.length) % NV.THEMES.length].id); NV.toast('Face theme: ' + NV.themeById(S.theme).name, 1800); }

  function buildThemeControls() {
    const sw = $('#theme-switcher'), cards = $('#theme-cards');
    NV.THEMES.forEach((t) => {
      const b = NV.el('button', { class: 'theme-dot', 'data-theme': t.id, role: 'radio', title: t.name, 'aria-label': t.name });
      b.innerHTML = `<span style="background:${t.swatch};box-shadow:0 0 10px ${t.primary}"></span>`; b.onclick = () => setTheme(t.id); sw.appendChild(b);
      const c = NV.el('button', { class: 'theme-card', 'data-theme': t.id, role: 'radio' });
      c.innerHTML = `<span class="sw" style="background:${t.swatch};box-shadow:0 0 10px ${t.primary}"></span>${t.name}`; c.onclick = () => setTheme(t.id); cards.appendChild(c);
    });
  }

  // ---------- Digital readout ----------
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let lastSecond = -1;
  function updateDigital(d) {
    const f = NV.fmtHM(d);
    $('#d-hm').textContent = f.hm; $('#d-sec').textContent = NV.pad(d.getSeconds());
    $('#d-ampm').textContent = f.ampm; $('#d-ampm').hidden = !f.ampm;
    $('#d-dow').textContent = DOW[d.getDay()]; $('#d-date').textContent = `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    $('#hour-label').textContent = S.h24 ? '24H' : '12H';
  }

  function perSecond(d) {
    updateDigital(d);
    NV.alarms.check(d);
    NV.world.tick(d);
    NV.status.tick();
    if (d.getSeconds() === 0) NV.solar.tick(d);
    // hourly chime
    if (d.getMinutes() === 0 && d.getSeconds() === 0) {
      if (S.chime) { NV.audio.chime(); NV.toast(`Hourly chime — ${NV.fmtClock(d.getHours(), 0)}`); }
      if (S.announce && NV.jarvis) setTimeout(() => NV.jarvis.announceHour(), S.chime ? 2600 : 0);
    }
  }

  // ---------- Parallax (mouse + device tilt) ----------
  NV.parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  function initParallax() {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      NV.parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2; NV.parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    document.addEventListener('mouseleave', () => { NV.parallax.tx = 0; NV.parallax.ty = 0; });
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      NV.parallax.tx = NV.clamp(e.gamma / 30, -1, 1); NV.parallax.ty = NV.clamp((e.beta - 45) / 30, -1, 1);
    });
  }
  let pxEls = null, lastPX = 1e9, lastPY = 1e9;
  function stepParallax() {
    const p = NV.parallax, on = S.parallax && !NV.reducedMotion;
    p.x = NV.lerp(p.x, on ? p.tx : 0, 0.06); p.y = NV.lerp(p.y, on ? p.ty : 0, 0.06);
    if (Math.abs(p.x - lastPX) < 0.002 && Math.abs(p.y - lastPY) < 0.002) return; // settle: no style work
    lastPX = p.x; lastPY = p.y;
    if (!pxEls) pxEls = { watch: $('#watch'), halo: $('.watch-halo'), digital: $('#digital'), glow: $('.bg-glow'), grid: $('.bg-grid') };
    const X = p.x * 14, Y = p.y * 14;
    pxEls.watch.style.transform = `rotateX(${(-Y * 0.35).toFixed(2)}deg) rotateY(${(X * 0.35).toFixed(2)}deg)`;
    pxEls.halo.style.transform = `translate(${(-X * 0.4).toFixed(1)}px,${(-Y * 0.4).toFixed(1)}px)`;
    pxEls.digital.style.transform = `translate(${(X * 0.3).toFixed(1)}px,${(Y * 0.3).toFixed(1)}px)`;
    pxEls.glow.style.transform = `translate(${(-X * 0.6).toFixed(1)}px,${(-Y * 0.6).toFixed(1)}px)`;
    pxEls.grid.style.transform = `perspective(420px) rotateX(64deg) translateX(${(-X * 1.2).toFixed(1)}px)`;
  }

  // ---------- Main loop ----------
  let last = performance.now(), frames = 0, fpsT = last, hidden = false;
  function loop(now) {
    const dt = now - last; last = now;
    stepTheme(now); stepParallax();
    const epoch = Date.now(), d = new Date(epoch);
    if (d.getSeconds() !== lastSecond) { lastSecond = d.getSeconds(); perSecond(d); }
    NV.face.draw(epoch, now);
    NV.bg.draw(dt, now);
    NV.stopwatch.frame(); NV.timer.frame(); NV.focus.frame();
    if (activeTab === 'jarvis') NV.jarvis.draw(now);
    frames++;
    if (now - fpsT >= 1000) { NV.status.fps(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
    requestAnimationFrame(loop);
  }
  // keep alarms/timers firing when tab is hidden (rAF pauses)
  setInterval(() => {
    if (!document.hidden) return;
    const d = new Date(); if (d.getSeconds() !== lastSecond) { lastSecond = d.getSeconds(); perSecond(d); }
    NV.timer.frame(); NV.focus.frame();
  }, 500);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; last = performance.now(); void hidden; });

  // ---------- Tabs ----------
  let activeTab = 'stopwatch';
  const TABS = ['stopwatch', 'timer', 'alarms', 'world', 'focus', 'jarvis'];
  function showTab(name, sound = true) {
    activeTab = name;
    NV.$$('#tabs button').forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    NV.$$('.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
    NV.store.set('tab', name); if (sound) NV.audio.click(1.1);
  }

  // ---------- Modals / drawer ----------
  function openModal(id) { const m = $('#' + id); m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); }
  function closeModal(id) { const m = $('#' + id); m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); if (id === 'promo') NV.cinco.close(); }
  function toggleDrawer(force) { const d = $('#settings'); const open = force ?? !d.classList.contains('open'); d.classList.toggle('open', open); d.setAttribute('aria-hidden', !open); NV.audio.click(open ? 1.2 : 0.8); }

  // ---------- Fullscreen ----------
  function toggleFullscreen() {
    const doc = document, el = doc.documentElement;
    const fs = doc.fullscreenElement || doc.webkitFullscreenElement;
    try {
      if (!fs) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    } catch (e) { NV.toast('Fullscreen is not supported here.'); }
  }

  // ---------- Settings binding ----------
  function bindSettings() {
    const map = { 'set-24h': 'h24', 'set-chime': 'chime', 'set-announce': 'announce', 'set-sweep': 'sweep', 'set-particles': 'particles', 'set-scanlines': 'scanlines', 'set-parallax': 'parallax', 'set-uisound': 'uisound' };
    Object.entries(map).forEach(([id, key]) => { const el = $('#' + id); el.checked = !!S[key]; el.addEventListener('change', () => { NV.setSetting(key, el.checked); NV.audio.click(el.checked ? 1.2 : 0.8); }); });
    $('#set-volume').value = S.volume; $('#set-volume').addEventListener('input', (e) => NV.setSetting('volume', +e.target.value));
    $('#set-voice').addEventListener('change', (e) => { NV.setSetting('voice', e.target.value); NV.jarvis.refreshVoices(); });
    $('#set-test').onclick = () => { NV.audio.chime(); setTimeout(() => NV.jarvis.sayTime(), 1200); };
    NV.onSetting((k, v) => {
      if (map['set-' + k] !== undefined || Object.values(map).includes(k)) { const id = Object.keys(map).find((i) => map[i] === k); if (id) $('#' + id).checked = !!v; }
      if (k === 'h24') { updateDigital(new Date()); NV.alarms.render(); NV.world.tick(); NV.solar.tick(); }
      if (k === 'chime') $('#btn-chime').setAttribute('aria-pressed', v);
      if (k === 'scanlines') document.body.classList.toggle('no-scanlines', !v);
    });
    $('#btn-chime').setAttribute('aria-pressed', S.chime);
    document.body.classList.toggle('no-scanlines', !S.scanlines);
  }
  const toggleH24 = () => { NV.setSetting('h24', !S.h24); NV.audio.click(); NV.toast(S.h24 ? '24-hour display engaged.' : '12-hour display engaged.', 1800); };
  const toggleChime = () => { NV.setSetting('chime', !S.chime); NV.audio.click(); if (S.chime) NV.audio.chime(); NV.toast(S.chime ? 'Hourly chime enabled.' : 'Hourly chime silenced.', 1800); };

  // ---------- Keyboard ----------
  function onKey(e) {
    if (e.target.matches('input, select, textarea') && e.key !== 'Escape') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') {
      if (NV.alert.dismiss(false)) return;
      if ($('#promo').classList.contains('open')) return closeModal('promo');
      if ($('#help').classList.contains('open')) return closeModal('help');
      if ($('#settings').classList.contains('open')) return toggleDrawer(false);
      return;
    }
    if (/^[1-6]$/.test(k)) return showTab(TABS[+k - 1]);
    switch (k.toLowerCase()) {
      case ' ':
        e.preventDefault();
        if (activeTab === 'stopwatch') NV.stopwatch.toggle(); else if (activeTab === 'timer') NV.timer.toggle(); else if (activeTab === 'focus') NV.focus.toggle(); else if (activeTab === 'jarvis') NV.jarvis.sayTime();
        break;
      case 'l': NV.stopwatch.lap(); break;
      case 'r': if (activeTab === 'stopwatch') NV.stopwatch.reset(); else if (activeTab === 'timer') NV.timer.reset(); else if (activeTab === 'focus') NV.focus.reset(); break;
      case 't': cycleTheme(e.shiftKey ? -1 : 1); break;
      case 'h': toggleH24(); break;
      case 'j': NV.jarvis.sayTime(); break;
      case 'c': toggleChime(); break;
      case 'f': toggleFullscreen(); break;
      case 's': toggleDrawer(); break;
      case '?': case '/': openModal('help'); break;
    }
  }

  // ---------- Boot sequence ----------
  function boot() {
    const el = $('#boot'); if (!el) return;
    const skip = /[?&](noboot|shot)/.test(location.search) || NV.reducedMotion;
    const lines = ['Initializing NICK-VERSE kernel', 'Calibrating chronometric core', 'Spooling arc-grade HUD rings', 'Linking J.A.R.V.I.S. voice matrix', 'Consulting CINCO Corporation legal', 'All systems nominal'];
    const box = $('#boot-lines'), bar = $('#boot-progress');
    let i = 0, done = false;
    const finish = () => { if (done) return; done = true; el.classList.add('done'); setTimeout(() => el.remove(), 900); };
    if (skip) { el.remove(); return; }
    const step = () => { if (done) return; if (i < lines.length) { const d = NV.el('div'); d.innerHTML = `${lines[i]}<span class="ok">OK</span>`; box.appendChild(d); i++; bar.style.width = (i / lines.length * 100) + '%'; setTimeout(step, 260); } else setTimeout(finish, 350); };
    setTimeout(step, 200);
    el.addEventListener('click', finish);
  }

  // ---------- PWA ----------
  let deferredPrompt = null;
  function initPWA() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(() => { $('#sw-status').textContent = 'Offline cache active.'; }).catch(() => { $('#sw-status').textContent = 'Offline cache unavailable.'; });
    } else $('#sw-status').textContent = 'Serve over http(s) to enable offline mode.';
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#set-install').disabled = false; });
    $('#set-install').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (e) {} deferredPrompt = null; $('#set-install').disabled = true; };
    window.addEventListener('appinstalled', () => NV.toast('Installed. The NICK-VERSE is now on your home screen, Sir.'));
  }

  // ---------- Init ----------
  function init() {
    buildThemeControls();
    applyTheme(S.theme, false);
    NV.bg.init($('#bg-canvas'));
    NV.face.init($('#face'));
    NV.stopwatch.init(); NV.timer.init(); NV.alarms.init(); NV.world.init(); NV.focus.init();
    NV.solar.init(); NV.status.init(); NV.alert.init(); NV.cinco.init();
    NV.jarvis.init();
    bindSettings(); initParallax(); initPWA();

    NV.$$('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    const params = new URLSearchParams(location.search);
    showTab(params.get('tab') || NV.store.get('tab', 'stopwatch'), false);
    if (params.get('theme')) applyTheme(params.get('theme'), false);

    $('#btn-hour').onclick = toggleH24; $('#btn-chime').onclick = toggleChime;
    $('#btn-theme').onclick = () => cycleTheme(1); $('#btn-fullscreen').onclick = toggleFullscreen;
    $('#btn-settings').onclick = () => toggleDrawer(); $('#btn-help').onclick = () => openModal('help');
    NV.$$('[data-close]').forEach((b) => b.addEventListener('click', () => { const id = b.dataset.close; if (id === 'settings') toggleDrawer(false); else closeModal(id); }));
    NV.$$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'alert') closeModal(m.id); }));
    $('#watch').addEventListener('click', (e) => { NV.bg.burst(e.clientX, e.clientY, 28); NV.jarvis.sayTime(); });
    $('#watch').title = 'Tap for the time, Sir';
    $('#jv-orb').onclick = () => NV.jarvis.sayTime(); $('#jv-time').onclick = () => NV.jarvis.sayTime();
    $('#jv-status').onclick = () => NV.jarvis.status(); $('#jv-quip').onclick = () => NV.jarvis.quip();
    // close drawer when clicking outside
    document.addEventListener('pointerdown', (e) => { const d = $('#settings'); if (d.classList.contains('open') && !d.contains(e.target) && !e.target.closest('#btn-settings')) toggleDrawer(false); });
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', () => setTimeout(() => window.dispatchEvent(new Event('resize')), 100));

    updateDigital(new Date());
    boot();
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
