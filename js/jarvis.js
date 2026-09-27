/* NICK-VERSE Watch — J.A.R.V.I.S.-style assistant (Web Speech API) */
(function () {
  'use strict';
  const NV = window.NV;
  const J = (NV.jarvis = { speaking: false, level: 0 });
  const synth = window.speechSynthesis || null;
  let voices = [], canvas, ctx, S = 0, dpr = 1;

  const QUIPS = [
    'I have taken the liberty of not scheduling anything heroic before coffee.',
    'Time remains linear, Sir. I checked twice.',
    'Shall I alert the Nick-Verse writers\u2019 room that the plot has thickened?',
    'The clock is ticking, Sir. Literally. I built it that way.',
    'Your punctuality metrics are\u2026 aspirational.',
    'I would recommend saving the multiverse after a light snack.',
    'All systems nominal. Except the snack reserves, which are critically low.',
    'I\u2019ve calibrated the seconds hand to within a femtosecond. You\u2019re welcome.',
    'If time is a flat circle, Sir, this watch is at least a very shiny one.',
    'CINCO Corporation reminds you that time, as always, now comes with more time.',
    'Another chapter of the Nick-Verse awaits. The villains won\u2019t write themselves, Sir.',
    'Might I suggest hydration? Even legends require water.',
    'I\u2019ve run the numbers. You are exactly as late as you think you are.',
    'Shall I render you in full HUD? Oh wait. I already have.'
  ];
  const LATE = ['It is rather late, Sir. Even heroes require sleep.', 'Burning the midnight oil again, I see. Shall I dim the lights?', 'The rest of the world is asleep, Sir. An ideal time to plot a sequel.'];
  const MORNING = ['Shall I prepare the coffee protocols?', 'A fresh day for the Nick-Verse, Sir.', 'Rise and shine. Well, rise, at any rate.'];
  const AFTERNOON = ['The afternoon is proceeding according to plan. Mostly.', 'Might I suggest a short focus session?', 'Productivity is trending upward, Sir. Marginally.'];
  const EVENING = ['A fine evening for writing, Sir.', 'Shall I queue up something cinematic?', 'The day\u2019s missions are nearly complete.'];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function greetingFor(h) {
    if (h < 5) return 'Good evening';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
  function extraFor(h) { return h < 5 ? pick(LATE) : h < 12 ? pick(MORNING) : h < 17 ? pick(AFTERNOON) : h >= 23 ? pick(LATE) : pick(EVENING); }

  function spokenTime(d) {
    const h = d.getHours(), m = d.getMinutes();
    if (NV.settings.h24) return NV.pad(h) + ':' + NV.pad(m) + (m === 0 ? ' hours' : '');
    const hh = h % 12 || 12, ap = h >= 12 ? 'PM' : 'AM';
    return m === 0 ? `${hh} o'clock ${ap}` : `${hh}:${NV.pad(m)} ${ap}`;
  }
  function displayTime(d) { const f = NV.fmtHM(d); return f.hm + (f.ampm ? ' ' + f.ampm : ''); }

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    const sel = NV.$('#set-voice'); if (!sel) return;
    const en = voices.filter((v) => /^en/i.test(v.lang));
    const list = en.length ? en : voices;
    sel.innerHTML = '<option value="">Auto (British preferred)</option>' + list.map((v) => `<option value="${NV.esc(v.name)}">${NV.esc(v.name)} — ${NV.esc(v.lang)}</option>`).join('');
    sel.value = NV.settings.voice || '';
    const v = chooseVoice();
    NV.$('#jv-voice').textContent = v ? `Voice: ${v.name} (${v.lang})` : (synth ? 'Voice: system default' : 'Speech synthesis unavailable — text mode');
  }
  function chooseVoice() {
    if (!voices.length) return null;
    if (NV.settings.voice) { const v = voices.find((x) => x.name === NV.settings.voice); if (v) return v; }
    const gb = voices.filter((v) => /en[-_]GB/i.test(v.lang));
    const pref = ['Daniel', 'Google UK English Male', 'Arthur', 'Oliver', 'George', 'Ryan', 'Microsoft Ryan', 'UK English Male', 'Malcolm'];
    for (const p of pref) { const v = gb.find((x) => x.name.includes(p)) || voices.find((x) => x.name.includes(p) && /en/i.test(x.lang)); if (v) return v; }
    return gb.find((v) => /male/i.test(v.name)) || gb[0] || voices.find((v) => /^en/i.test(v.lang)) || voices[0];
  }

  // --- log with typewriter effect ---
  let typing = null;
  function log(text, tag = 'JARVIS') {
    const box = NV.$('#jv-log'); if (!box) return;
    NV.$$('p', box).forEach((p) => p.classList.add('old'));
    while (box.children.length > 5) box.firstChild.remove();
    const p = NV.el('p'); p.innerHTML = `<b>${tag}</b><span></span><i class="caret"></i>`; box.appendChild(p);
    const span = p.querySelector('span'); let i = 0;
    if (typing) clearInterval(typing.id), typing.finish();
    const finish = () => { span.textContent = text; const c = p.querySelector('.caret'); if (c) c.remove(); box.scrollTop = box.scrollHeight; };
    const id = setInterval(() => { i += 2; span.textContent = text.slice(0, i); box.scrollTop = box.scrollHeight; if (i >= text.length) { clearInterval(id); finish(); typing = null; } }, 18);
    typing = { id, finish };
  }

  function speak(text, { silentLog = false } = {}) {
    if (!silentLog) log(text);
    NV.$('#jv-state').textContent = 'SPEAKING';
    if (!synth) { fakeSpeak(text); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = chooseVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
      u.rate = 0.96; u.pitch = 0.92; u.volume = NV.clamp(NV.settings.volume + 0.2, 0, 1);
      u.onstart = () => { J.speaking = true; };
      u.onboundary = () => { J.level = 1; };
      const end = () => { J.speaking = false; NV.$('#jv-state').textContent = 'ONLINE'; };
      u.onend = end; u.onerror = end;
      J.speaking = true;
      synth.speak(u);
      // Safety: some engines never fire onend
      setTimeout(() => { if (J.speaking && !synth.speaking) end(); }, 400 + text.length * 90);
    } catch (e) { fakeSpeak(text); }
  }
  function fakeSpeak(text) { J.speaking = true; setTimeout(() => { J.speaking = false; NV.$('#jv-state').textContent = 'ONLINE'; }, 600 + text.length * 55); }

  J.sayTime = function () {
    const d = new Date(), h = d.getHours();
    const line = `${greetingFor(h)}, Sir. It is ${spokenTime(d)}.`;
    const extra = Math.random() < 0.6 ? ' ' + (Math.random() < 0.5 ? extraFor(h) : pick(QUIPS)) : '';
    log(`${greetingFor(h)}, Sir. It is ${displayTime(d)}.${extra}`);
    speak(line + extra, { silentLog: true });
  };
  J.announceHour = function () {
    const d = new Date();
    speak(`${greetingFor(d.getHours())}, Sir. It is now ${spokenTime(d)}.`);
  };
  J.quip = () => speak(pick(QUIPS));
  J.status = function () {
    const st = NV.status || {};
    const parts = ['Status report.'];
    if (st.battery != null) parts.push(`Power cell at ${Math.round(st.battery * 100)} percent${st.charging ? ', charging' : ''}.`);
    else parts.push('Power telemetry unavailable; I shall assume you are plugged into something impressive.');
    parts.push(navigator.onLine ? 'Uplink is stable.' : 'We appear to be offline, Sir. Fortunately, I am not.');
    const al = (NV.alarms && NV.alarms.nextText && NV.alarms.nextText()) || '';
    parts.push(al ? `Next alarm: ${al}.` : 'No alarms armed.');
    if (NV.face.timer) parts.push('A countdown is in progress.');
    parts.push(pick(['All systems nominal.', 'Everything is running smoothly. Suspiciously so.', 'The Nick-Verse is secure.']));
    speak(parts.join(' '));
  };
  J.speak = speak; J.log = log;

  // --- orb visualizer ---
  function resize() { if (!canvas) return; const r = canvas.getBoundingClientRect(); if (!r.width) return; dpr = NV.dpr(); S = r.width; canvas.width = canvas.height = Math.round(S * dpr); }
  J.draw = function (t) {
    if (!canvas || !canvas.offsetParent) return;
    if (!S || canvas.width !== Math.round(S * dpr)) resize(); if (!S) return;
    const c = NV.colors, x = ctx, R = S * 0.42, tt = t / 1000;
    J.level = NV.lerp(J.level, J.speaking ? 0.55 + 0.45 * Math.abs(Math.sin(tt * 9) * Math.sin(tt * 3.7)) : 0.08, 0.15);
    x.setTransform(dpr, 0, 0, dpr, S / 2 * dpr, S / 2 * dpr); x.clearRect(-S / 2, -S / 2, S, S);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, R * 1.1);
    g.addColorStop(0, NV.rgba(c.secondary, 0.35 + J.level * 0.4)); g.addColorStop(0.4, NV.rgba(c.primary, 0.12 + J.level * 0.2)); g.addColorStop(1, NV.rgba(c.primary, 0));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 1.1, 0, Math.PI * 2); x.fill();
    // radial bars
    const N = 64; x.lineCap = 'round';
    x.shadowColor = c.primary; x.shadowBlur = 8 * dpr;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + tt * 0.2;
      const n = 0.5 + 0.5 * Math.sin(i * 0.9 + tt * 6) * Math.sin(i * 0.37 - tt * 3.3);
      const len = R * (0.08 + J.level * 0.34 * n + 0.03 * Math.sin(tt * 2 + i));
      const r0 = R * 0.62;
      x.strokeStyle = i % 2 ? c.primary : c.secondary; x.lineWidth = Math.max(1.2, S * 0.008);
      x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); x.stroke();
    }
    // rings
    x.lineWidth = 1.5; x.strokeStyle = NV.rgba(c.primary, 0.7);
    x.beginPath(); x.arc(0, 0, R * 0.56, tt, tt + Math.PI * 1.4); x.stroke();
    x.strokeStyle = NV.rgba(c.secondary, 0.5);
    x.beginPath(); x.arc(0, 0, R * 0.5, -tt * 1.5, -tt * 1.5 + Math.PI * 0.8); x.stroke();
    x.beginPath(); x.arc(0, 0, R * 1.02, -tt * 0.4, -tt * 0.4 + Math.PI * 0.5); x.stroke();
    x.beginPath(); x.arc(0, 0, R * 1.02, -tt * 0.4 + Math.PI, -tt * 0.4 + Math.PI * 1.5); x.stroke();
    // core
    const cr = R * (0.28 + J.level * 0.08);
    const cg = x.createRadialGradient(0, 0, 0, 0, 0, cr);
    cg.addColorStop(0, '#fff'); cg.addColorStop(0.5, c.secondary); cg.addColorStop(1, NV.rgba(c.primary, 0.2));
    x.shadowBlur = 24 * dpr; x.fillStyle = cg; x.beginPath(); x.arc(0, 0, cr, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    x.font = `700 ${S * 0.055}px Orbitron, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = NV.rgba(c.bg, 0.85);
    x.fillText('J', 0, 1);
  };

  J.init = function () {
    canvas = NV.$('#jv-canvas'); ctx = canvas.getContext('2d');
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    if (synth) { loadVoices(); if ('onvoiceschanged' in synth) synth.onvoiceschanged = loadVoices; setTimeout(loadVoices, 800); }
    else NV.$('#jv-voice').textContent = 'Speech synthesis unavailable — text mode';
    const h = new Date().getHours();
    log(`${greetingFor(h)}, Sir. NICK-VERSE systems are online. Tap the orb and I shall tell you the time.`);
  };
  J.refreshVoices = loadVoices;
})();
