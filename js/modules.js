/* NICK-VERSE Watch — modules: stopwatch, timer, alarms, world clocks, focus, solar, status, CINCO */
(function () {
  'use strict';
  const NV = window.NV, $ = NV.$;

  // ======================= STOPWATCH =======================
  const SW = (NV.stopwatch = {});
  let sw = Object.assign({ running: false, startAt: 0, acc: 0, laps: [] }, NV.store.get('stopwatch', {}));
  const swSave = () => NV.store.set('stopwatch', sw);
  const swElapsed = () => sw.acc + (sw.running ? Date.now() - sw.startAt : 0);

  function swRenderLaps() {
    const ol = $('#sw-laps');
    if (!sw.laps.length) { ol.innerHTML = '<li class="empty">No laps recorded, Sir.</li>'; return; }
    const lapTimes = sw.laps.map((s, i) => s - (i ? sw.laps[i - 1] : 0));
    const best = sw.laps.length > 1 ? Math.min(...lapTimes) : -1, worst = sw.laps.length > 1 ? Math.max(...lapTimes) : -1;
    ol.innerHTML = sw.laps.map((s, i) => ({ s, i, l: lapTimes[i] })).reverse().map(({ s, i, l }) =>
      `<li class="${l === best ? 'best' : l === worst ? 'worst' : ''}"><span>${NV.pad(i + 1)}</span><span>${NV.fmtDuration(l)}</span><span>${NV.fmtDuration(s)}</span></li>`).join('');
  }
  function swUI() {
    const b = $('#sw-start');
    b.textContent = sw.running ? 'Stop' : (swElapsed() > 0 ? 'Resume' : 'Start');
    b.classList.toggle('running', sw.running);
    $('#sw-lap').disabled = !sw.running; $('#sw-reset').disabled = sw.running || swElapsed() === 0;
    $('#sw-state').textContent = sw.running ? 'RUNNING' : swElapsed() > 0 ? 'PAUSED' : 'STANDBY';
  }
  SW.toggle = () => { if (sw.running) { sw.acc += Date.now() - sw.startAt; sw.running = false; } else { sw.startAt = Date.now(); sw.running = true; } NV.audio.click(sw.running ? 1.2 : 0.8); swSave(); swUI(); };
  SW.lap = () => { if (!sw.running) return; sw.laps.push(swElapsed()); NV.audio.click(1.4); swSave(); swRenderLaps(); };
  SW.reset = () => { if (sw.running) return; sw = { running: false, startAt: 0, acc: 0, laps: [] }; NV.audio.click(0.6); swSave(); swRenderLaps(); swUI(); };
  SW.frame = () => {
    const e = swElapsed(), cs = NV.fmtDuration(e);
    const main = cs.slice(0, -3), frac = cs.slice(-3);
    const el = $('#sw-main'); const html = `${main}<span>${frac}</span>`; if (el.innerHTML !== html) el.innerHTML = html;
    const lastSplit = sw.laps.length ? sw.laps[sw.laps.length - 1] : 0;
    $('#sw-lapnow').textContent = `LAP ${NV.pad(sw.laps.length + 1)} · ${NV.fmtDuration(e - lastSplit)}`;
    NV.setRing($('#sw-ring'), (e % 60000) / 60000);
    NV.setRing($('#sw-ring2'), (e % 1000) / 1000);
  };
  SW.init = () => {
    NV.buildTicks($('#sw-ticks'));
    $('#sw-start').onclick = SW.toggle; $('#sw-lap').onclick = SW.lap; $('#sw-reset').onclick = SW.reset;
    swRenderLaps(); swUI();
  };

  // ======================= TIMER =======================
  const TM = (NV.timer = {});
  let tm = Object.assign({ running: false, endAt: 0, remaining: 0, duration: 0, label: '' }, NV.store.get('timer', {}));
  const tmSave = () => NV.store.set('timer', tm);
  const PRESETS = [[1, '1m'], [3, '3m'], [5, '5m'], [10, '10m'], [15, '15m'], [25, '25m'], [30, '30m'], [60, '1h']];
  const tmInputMs = () => ((+$('#tm-h').value || 0) * 3600 + (+$('#tm-m').value || 0) * 60 + (+$('#tm-s').value || 0)) * 1000;
  const tmLeft = () => tm.running ? tm.endAt - Date.now() : tm.remaining;
  function tmSetInputs(ms) { const t = Math.round(ms / 1000); $('#tm-h').value = Math.floor(t / 3600); $('#tm-m').value = Math.floor(t / 60) % 60; $('#tm-s').value = t % 60; }
  function tmUI() {
    const active = tm.running || tm.remaining > 0;
    $('#tm-inputs').hidden = active; $('#tm-main').hidden = !active;
    const b = $('#tm-start'); b.textContent = tm.running ? 'Pause' : tm.remaining > 0 ? 'Resume' : 'Start'; b.classList.toggle('running', tm.running);
    $('#tm-reset').disabled = !active;
    $('#tm-state').textContent = tm.running ? 'COUNTING' : tm.remaining > 0 ? 'PAUSED' : 'STANDBY';
    $('#tm-end').textContent = tm.running ? 'ENDS ' + NV.fmtClock(new Date(tm.endAt).getHours(), new Date(tm.endAt).getMinutes()) : active ? 'PAUSED' : 'SET DURATION';
    $('#chip-timer').hidden = !active;
    if (!active) { NV.face.timer = null; NV.setRing($('#tm-ring'), 0); }
  }
  TM.start = (ms) => {
    if (ms) { tm.duration = ms; tm.remaining = ms; }
    if (!tm.remaining) { const v = tmInputMs(); if (!v) { NV.toast('Set a duration first, Sir.'); return; } tm.duration = v; tm.remaining = v; }
    tm.endAt = Date.now() + tm.remaining; tm.running = true; NV.audio.confirm(); tmSave(); tmUI();
  };
  TM.toggle = () => { if (tm.running) { tm.remaining = Math.max(0, tm.endAt - Date.now()); tm.running = false; NV.audio.click(0.8); tmSave(); tmUI(); } else TM.start(); };
  TM.reset = () => { tm.running = false; tm.remaining = 0; tmSave(); $('#tm-ring').closest('.sw-dial').classList.remove('done'); NV.audio.click(0.6); tmUI(); };
  TM.add = (ms) => { if (tm.running) tm.endAt += ms; else if (tm.remaining) tm.remaining += ms; else { tmSetInputs(tmInputMs() + ms); return; } tm.duration += ms; tmSave(); tmUI(); };
  function tmFinish() {
    tm.running = false; tm.remaining = 0; tmSave(); tmUI();
    $('#tm-ring').closest('.sw-dial').classList.add('done'); setTimeout(() => $('#tm-ring').closest('.sw-dial').classList.remove('done'), 6000);
    NV.alert.show({ kicker: 'COUNTDOWN COMPLETE', time: NV.fmtHMS(tm.duration), title: 'Time is up, Sir', snooze: false });
  }
  TM.frame = () => {
    const left = tmLeft();
    if (tm.running && left <= 0) { tmFinish(); return; }
    const active = tm.running || tm.remaining > 0;
    if (active) {
      const txt = NV.fmtHMS(left); if ($('#tm-main').textContent !== txt) $('#tm-main').textContent = txt;
      const frac = tm.duration ? left / tm.duration : 0; NV.setRing($('#tm-ring'), frac);
      NV.face.timer = { frac, label: 'T-' + txt };
      $('#chip-timer-text').textContent = 'T-' + txt;
    }
  };
  TM.init = () => {
    NV.buildTicks($('#tm-ticks'));
    const box = $('#tm-presets');
    PRESETS.forEach(([m, l]) => { const b = NV.el('button', { class: 'preset', type: 'button' }, l); b.onclick = () => { TM.reset(); tmSetInputs(m * 60000); TM.start(m * 60000); }; box.appendChild(b); });
    $('#tm-start').onclick = TM.toggle; $('#tm-reset').onclick = TM.reset; $('#tm-add').onclick = () => { TM.add(60000); NV.audio.click(1.1); };
    ['#tm-h', '#tm-m', '#tm-s'].forEach((s) => $(s).addEventListener('change', (e) => { const el = e.target; el.value = NV.clamp(Math.floor(+el.value || 0), 0, +el.max); }));
    if (tm.running && tm.endAt < Date.now()) { tm.running = false; tm.remaining = 0; tmSave(); setTimeout(() => NV.toast('A countdown finished while you were away, Sir.'), 2500); }
    tmUI();
  };

  // ======================= ALARMS =======================
  const AL = (NV.alarms = {});
  const DAYN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], DAYL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let alarms = NV.store.get('alarms', null);
  if (!alarms) alarms = [{ id: 'a1', time: '07:00', label: 'Suit up', days: [1, 2, 3, 4, 5], enabled: false }];
  let snoozes = NV.store.get('snoozes', []);
  const fired = {};
  let formDays = [];
  const alSave = () => { NV.store.set('alarms', alarms); NV.store.set('snoozes', snoozes); };

  function nextFire(a, from = new Date()) {
    const [h, m] = a.time.split(':').map(Number);
    for (let i = 0; i < 8; i++) {
      const d = new Date(from); d.setDate(d.getDate() + i); d.setHours(h, m, 0, 0);
      if (d <= from) continue;
      if (!a.days.length || a.days.includes(d.getDay())) return d;
    }
    return null;
  }
  AL.next = () => {
    let best = null;
    alarms.filter((a) => a.enabled).forEach((a) => { const d = nextFire(a); if (d && (!best || d < best.d)) best = { d, a }; });
    snoozes.forEach((s) => { const d = new Date(s.at); if (!best || d < best.d) best = { d, a: { label: s.label + ' (snoozed)' } }; });
    return best;
  };
  AL.nextText = () => { const n = AL.next(); if (!n) return ''; return NV.fmtClock(n.d.getHours(), n.d.getMinutes()) + (n.a.label ? ', ' + n.a.label : ''); };
  function relTime(ms) { const m = Math.round(ms / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor(m / 60) % 24}h`; }
  function alRender() {
    const ul = $('#al-list');
    if (!alarms.length && !snoozes.length) ul.innerHTML = '<li class="empty-state">No alarms configured. Peaceful, isn\u2019t it?</li>';
    else {
      ul.innerHTML = alarms.slice().sort((a, b) => a.time.localeCompare(b.time)).map((a) => {
        const [h, m] = a.time.split(':').map(Number); const t = NV.fmtClock(h, m); const parts = t.split(' ');
        const days = !a.days.length ? 'Once' : a.days.length === 7 ? 'Every day' : a.days.join() === '1,2,3,4,5' ? 'Weekdays' : a.days.join() === '0,6' ? 'Weekends' : a.days.map((d) => DAYL[d]).join(' ');
        return `<li class="alarm-item ${a.enabled ? 'on' : 'off'}" data-id="${a.id}"><div><div class="a-time">${parts[0]}<small>${parts[1] || ''}</small></div><div class="a-meta"><span class="a-label">${NV.esc(a.label || 'Alarm')}</span> · ${days}</div></div><button class="toggle ${a.enabled ? 'on' : ''}" data-act="toggle" aria-label="Toggle alarm" aria-pressed="${a.enabled}"></button><button class="del" data-act="del" aria-label="Delete alarm" title="Delete">✕</button></li>`;
      }).join('') + snoozes.map((s) => { const d = new Date(s.at); return `<li class="alarm-item on" data-snooze="${s.id}"><div><div class="a-time">${NV.fmtClock(d.getHours(), d.getMinutes())}</div><div class="a-meta"><span class="a-label">${NV.esc(s.label)}</span> · Snoozed</div></div><span></span><button class="del" data-act="del" aria-label="Cancel snooze">✕</button></li>`; }).join('');
    }
    alNextUI();
  }
  function alNextUI() { const n = AL.next(); $('#al-next').textContent = n ? 'NEXT IN ' + relTime(n.d - Date.now()).toUpperCase() : 'NO ALARMS ARMED'; }
  AL.check = (d) => {
    const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes();
    const hm = NV.pad(d.getHours()) + ':' + NV.pad(d.getMinutes());
    alarms.forEach((a) => {
      if (!a.enabled || a.time !== hm || fired[a.id] === key) return;
      if (a.days.length && !a.days.includes(d.getDay())) return;
      fired[a.id] = key;
      if (!a.days.length) { a.enabled = false; alSave(); alRender(); }
      NV.alert.show({ kicker: 'ALARM', time: NV.fmtClock(d.getHours(), d.getMinutes()), title: a.label || 'Alarm', snooze: true, label: a.label || 'Alarm' });
    });
    for (let i = snoozes.length - 1; i >= 0; i--) {
      if (Date.now() >= snoozes[i].at) { const s = snoozes.splice(i, 1)[0]; alSave(); alRender(); NV.alert.show({ kicker: 'SNOOZE OVER', time: NV.fmtClock(d.getHours(), d.getMinutes()), title: s.label, snooze: true, label: s.label }); }
    }
    if (d.getSeconds() === 0) alNextUI();
  };
  AL.snooze = (label, min = 5) => { snoozes.push({ id: 's' + Date.now(), at: Date.now() + min * 60000, label }); alSave(); alRender(); NV.toast(`Snoozed for ${min} minutes. I\u2019ll be back, Sir.`); };
  AL.render = alRender;
  AL.init = () => {
    const dbox = $('#al-days');
    DAYN.forEach((n, i) => { const b = NV.el('button', { class: 'day-btn', type: 'button', title: DAYL[i], 'aria-pressed': 'false' }, n); b.onclick = () => { formDays = formDays.includes(i) ? formDays.filter((x) => x !== i) : formDays.concat(i).sort(); b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }; dbox.appendChild(b); });
    $('#al-form').addEventListener('submit', (e) => {
      e.preventDefault(); const time = $('#al-time').value; if (!time) return;
      const a = { id: 'a' + Date.now(), time, label: $('#al-label').value.trim(), days: formDays.slice(), enabled: true };
      alarms.push(a); alSave(); alRender(); NV.audio.confirm();
      const nf = nextFire(a); NV.toast(`Alarm armed for ${NV.fmtClock(+time.slice(0, 2), +time.slice(3))}${nf ? ' — in ' + relTime(nf - Date.now()) : ''}.`);
      $('#al-label').value = ''; formDays = []; NV.$$('.day-btn', dbox).forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    });
    $('#al-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]'); if (!btn) return; const li = btn.closest('li');
      if (li.dataset.snooze) { snoozes = snoozes.filter((s) => s.id !== li.dataset.snooze); alSave(); alRender(); return; }
      const a = alarms.find((x) => x.id === li.dataset.id); if (!a) return;
      if (btn.dataset.act === 'toggle') { a.enabled = !a.enabled; NV.audio.click(a.enabled ? 1.2 : 0.8); alSave(); alRender(); }
      else { li.style.opacity = 0; li.style.transform = 'translateX(20px)'; setTimeout(() => { alarms = alarms.filter((x) => x !== a); alSave(); alRender(); }, 220); NV.audio.click(0.6); }
    });
    alRender();
  };

  // ======================= WORLD CLOCKS =======================
  const WC = (NV.world = {});
  const CITIES = [
    ['Chicago', 'America/Chicago'], ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'], ['Denver', 'America/Denver'], ['Phoenix', 'America/Phoenix'],
    ['Anchorage', 'America/Anchorage'], ['Honolulu', 'Pacific/Honolulu'], ['Toronto', 'America/Toronto'], ['Vancouver', 'America/Vancouver'], ['Mexico City', 'America/Mexico_City'],
    ['São Paulo', 'America/Sao_Paulo'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'], ['Reykjavík', 'Atlantic/Reykjavik'], ['London', 'Europe/London'], ['Dublin', 'Europe/Dublin'],
    ['Paris', 'Europe/Paris'], ['Berlin', 'Europe/Berlin'], ['Madrid', 'Europe/Madrid'], ['Rome', 'Europe/Rome'], ['Stockholm', 'Europe/Stockholm'], ['Athens', 'Europe/Athens'],
    ['Istanbul', 'Europe/Istanbul'], ['Moscow', 'Europe/Moscow'], ['Cairo', 'Africa/Cairo'], ['Lagos', 'Africa/Lagos'], ['Johannesburg', 'Africa/Johannesburg'], ['Nairobi', 'Africa/Nairobi'],
    ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Bangkok', 'Asia/Bangkok'], ['Singapore', 'Asia/Singapore'], ['Hong Kong', 'Asia/Hong_Kong'], ['Shanghai', 'Asia/Shanghai'],
    ['Seoul', 'Asia/Seoul'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['Auckland', 'Pacific/Auckland']
  ].filter(([, tz]) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } });
  let wcList = NV.store.get('world', ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']);
  const localTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'; } catch (e) { return 'Local'; } })();
  const fmtCache = {};
  function partsIn(tz, d) {
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }));
    const o = {}; f.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
    const h = +o.hour % 24;
    return { y: +o.year, mo: +o.month, d: +o.day, h, m: +o.minute, s: +o.second, wd: o.weekday };
  }
  function offsetMin(tz, d) { const p = partsIn(tz, d); return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.m, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000); }
  const cityName = (tz) => (CITIES.find((c) => c[1] === tz) || [tz.split('/').pop().replace(/_/g, ' ')])[0];
  function wcRender() {
    const now = new Date(); const ul = $('#wc-list');
    const all = [localTz].concat(wcList.filter((t) => t !== localTz));
    ul.innerHTML = all.map((tz, i) => `<li class="world-item${i === 0 ? ' local' : ''}" data-tz="${tz}">
      <svg class="mini-clock" viewBox="0 0 50 50"><circle cx="25" cy="25" r="22" class="mc-face"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => { const a = k * Math.PI / 6; return `<line class="mc-t" x1="${25 + Math.sin(a) * 19}" y1="${25 - Math.cos(a) * 19}" x2="${25 + Math.sin(a) * (k % 3 ? 17.5 : 16)}" y2="${25 - Math.cos(a) * (k % 3 ? 17.5 : 16)}"/>`; }).join('')}<line class="mc-h" x1="25" y1="25" x2="25" y2="14"/><line class="mc-m" x1="25" y1="25" x2="25" y2="8"/><line class="mc-s" x1="25" y1="28" x2="25" y2="6"/><circle cx="25" cy="25" r="1.8" fill="#fff"/></svg>
      <div><div class="w-city">${NV.esc(i === 0 ? cityName(tz) + ' · Local' : cityName(tz))}</div><div class="w-meta"></div></div>
      <div class="w-time"></div>${i === 0 ? '<span></span>' : `<button class="del" aria-label="Remove ${NV.esc(cityName(tz))}" title="Remove">✕</button>`}</li>`).join('');
    const sel = $('#wc-select');
    sel.innerHTML = '<option value="">+ Add a city…</option>' + CITIES.filter(([, tz]) => !all.includes(tz)).map(([n, tz]) => { const o = offsetMin(tz, now) / 60; return `<option value="${tz}">${n} (UTC${o >= 0 ? '+' : ''}${o})</option>`; }).join('');
    $('#wc-local').textContent = localTz.toUpperCase();
    WC.tick(now);
  }
  WC.tick = (now = new Date()) => {
    const lp = partsIn(localTz, now), lOff = offsetMin(localTz, now), lDay = Date.UTC(lp.y, lp.mo - 1, lp.d);
    NV.$$('.world-item').forEach((li) => {
      const tz = li.dataset.tz, p = partsIn(tz, now);
      const t = NV.fmtClock(p.h, p.m), [tm, ap] = t.split(' ');
      const tEl = li.querySelector('.w-time'); const html = `${tm}<small>${ap || NV.pad(p.s)}</small>`; if (tEl.innerHTML !== html) tEl.innerHTML = html;
      const dd = Math.round((Date.UTC(p.y, p.mo - 1, p.d) - lDay) / 86400000);
      const diff = (offsetMin(tz, now) - lOff) / 60;
      const night = p.h < 6 || p.h >= 19;
      const meta = `${night ? '☾' : '☀'} ${dd === 0 ? 'Today' : dd > 0 ? 'Tomorrow' : 'Yesterday'} · ${p.wd} · ${diff === 0 ? 'Same time' : (diff > 0 ? '+' : '') + diff + 'h'}`;
      const mEl = li.querySelector('.w-meta'); if (mEl.textContent !== meta) mEl.textContent = meta;
      const svg = li.querySelector('.mini-clock'); svg.classList.toggle('night', night);
      svg.querySelector('.mc-h').setAttribute('transform', `rotate(${((p.h % 12) + p.m / 60) * 30} 25 25)`);
      svg.querySelector('.mc-m').setAttribute('transform', `rotate(${(p.m + p.s / 60) * 6} 25 25)`);
      svg.querySelector('.mc-s').setAttribute('transform', `rotate(${p.s * 6} 25 25)`);
    });
  };
  WC.init = () => {
    const add = () => { const tz = $('#wc-select').value; if (!tz) { NV.toast('Choose a city first, Sir.'); return; } wcList.push(tz); NV.store.set('world', wcList); NV.audio.confirm(); wcRender(); };
    $('#wc-add').onclick = add;
    $('#wc-select').addEventListener('change', () => { if ($('#wc-select').value) add(); });
    $('#wc-list').addEventListener('click', (e) => { const b = e.target.closest('.del'); if (!b) return; const tz = b.closest('li').dataset.tz; wcList = wcList.filter((t) => t !== tz); NV.store.set('world', wcList); NV.audio.click(0.6); wcRender(); });
    wcRender();
  };
  WC.localTz = localTz;

  // ======================= FOCUS / POMODORO =======================
  const FC = (NV.focus = {});
  const today = () => new Date().toDateString();
  let fc = Object.assign({ phase: 'work', running: false, endAt: 0, remaining: 0, cycle: 0, done: 0, day: today(), work: 25, brk: 5, long: 15 }, NV.store.get('focus', {}));
  if (fc.day !== today()) { fc.done = 0; fc.day = today(); }
  const fcSave = () => NV.store.set('focus', fc);
  const phaseMs = (p) => (p === 'work' ? fc.work : p === 'break' ? fc.brk : fc.long) * 60000;
  const PH = { work: 'DEEP WORK', break: 'SHORT BREAK', long: 'LONG BREAK' };
  const fcLeft = () => (fc.running ? fc.endAt - Date.now() : fc.remaining || phaseMs(fc.phase));
  function fcUI() {
    const b = $('#fc-start'); b.textContent = fc.running ? 'Pause' : fc.remaining ? 'Resume' : 'Engage'; b.classList.toggle('running', fc.running);
    $('#fc-phase').textContent = PH[fc.phase]; $('#fc-phase').classList.toggle('break', fc.phase !== 'work');
    $('#fc-state').textContent = fc.running ? (fc.phase === 'work' ? 'ENGAGED' : 'RECHARGING') : fc.remaining ? 'PAUSED' : 'READY';
    NV.$$('#fc-dots i').forEach((d, i) => d.classList.toggle('on', i < fc.cycle || (i === fc.cycle && fc.phase === 'work' && fc.running)));
    $('#fc-stats').textContent = `Sessions completed today: ${fc.done} · ${fc.done * fc.work} focused minutes`;
    document.body.classList.toggle('focus-on', fc.running && fc.phase === 'work');
    $('#chip-focus').hidden = !fc.running && !fc.remaining;
    if (!fc.running && !fc.remaining) NV.face.focus = null;
  }
  FC.toggle = () => {
    if (fc.running) { fc.remaining = Math.max(0, fc.endAt - Date.now()); fc.running = false; NV.audio.click(0.8); }
    else { fc.endAt = Date.now() + (fc.remaining || phaseMs(fc.phase)); fc.running = true; fc.remaining = 0; NV.audio.phase(true); if (fc.phase === 'work') NV.toast('Focus protocol engaged. Distractions have been… discouraged.'); }
    fcSave(); fcUI();
  };
  function fcAdvance(completed) {
    if (fc.phase === 'work') { if (completed) fc.done++; fc.cycle++; fc.phase = fc.cycle >= 4 ? 'long' : 'break'; }
    else { if (fc.phase === 'long') fc.cycle = 0; fc.phase = 'work'; }
    fc.remaining = 0;
    if (fc.running) fc.endAt = Date.now() + phaseMs(fc.phase);
    fcSave(); fcUI();
  }
  FC.skip = () => { NV.audio.click(1); fcAdvance(false); };
  FC.reset = () => { fc.running = false; fc.remaining = 0; fc.phase = 'work'; fc.cycle = 0; NV.face.focus = null; NV.audio.click(0.6); fcSave(); fcUI(); };
  FC.frame = () => {
    let left = fcLeft();
    if (fc.running && left <= 0) {
      const wasWork = fc.phase === 'work'; fcAdvance(true); NV.audio.phase(!wasWork); NV.audio.chime();
      NV.toast(wasWork ? 'Session complete. Take a breather, Sir — you\u2019ve earned it.' : 'Break over. Back to saving the Nick-Verse.');
      if (NV.jarvis && NV.settings.announce) NV.jarvis.speak(wasWork ? 'Focus session complete, Sir. Time for a break.' : 'Break complete. Shall we resume?');
      left = fcLeft();
    }
    const txt = NV.fmtDuration(left, false); if ($('#fc-main').textContent !== txt) $('#fc-main').textContent = txt;
    const frac = 1 - left / phaseMs(fc.phase); NV.setRing($('#fc-ring'), frac);
    if (fc.running || fc.remaining) { NV.face.focus = { frac: 1 - frac, label: (fc.phase === 'work' ? 'FOCUS ' : 'BREAK ') + txt }; $('#chip-focus-text').textContent = (fc.phase === 'work' ? 'FOCUS ' : 'BREAK ') + txt; }
  };
  FC.init = () => {
    NV.buildTicks($('#fc-ticks'));
    $('#fc-work').value = fc.work; $('#fc-break').value = fc.brk; $('#fc-long').value = fc.long;
    [['#fc-work', 'work', 120], ['#fc-break', 'brk', 60], ['#fc-long', 'long', 60]].forEach(([s, k, max]) => $(s).addEventListener('change', (e) => { fc[k] = NV.clamp(Math.round(+e.target.value || 1), 1, max); e.target.value = fc[k]; fcSave(); fcUI(); }));
    $('#fc-start').onclick = FC.toggle; $('#fc-skip').onclick = FC.skip; $('#fc-reset').onclick = FC.reset;
    if (fc.running && fc.endAt < Date.now()) { fc.running = false; fc.remaining = 0; fcSave(); }
    fcUI();
  };

  // ======================= SOLAR / DAY PROGRESS =======================
  const SOL = (NV.solar = {});
  let loc = NV.store.get('location', { lat: 41.8781, lon: -87.6298, name: 'Chicago (default)' });
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  function sunTimes(date, lat, lon) {
    const toDays = (d) => d.valueOf() / dayMs - 0.5 + J1970 - J2000, fromJ = (j) => new Date((j + 0.5 - J1970) * dayMs);
    const lw = rad * -lon, phi = rad * lat, d = toDays(date), e = rad * 23.4397;
    const n = Math.round(d - 0.0009 - lw / (2 * Math.PI)), ds = 0.0009 + lw / (2 * Math.PI) + n;
    const M = rad * (357.5291 + 0.98560028 * ds);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const Lsun = M + C + rad * 102.9372 + Math.PI, dec = Math.asin(Math.sin(e) * Math.sin(Lsun));
    const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * Lsun);
    const cosw = (Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosw > 1 || cosw < -1) return { polar: cosw > 1 ? 'night' : 'day', noon: fromJ(Jnoon) };
    const w = Math.acos(cosw), Jset = J2000 + 0.0009 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * Lsun);
    return { sunrise: fromJ(Jnoon - (Jset - Jnoon)), sunset: fromJ(Jset), noon: fromJ(Jnoon) };
  }
  function moon(now) {
    const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    const ph = (((now - ref) / dayMs) % syn + syn) % syn / syn;
    const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    return { name: names[Math.round(ph * 8) % 8], illum: (1 - Math.cos(ph * 2 * Math.PI)) / 2 };
  }
  // arc param: ellipse center (150,128) rx=120 ry=110 ; t in [0,1] left->right
  const arcPt = (t) => { const a = Math.PI * (1 - t); return [150 + Math.cos(a) * 120, 128 - Math.sin(a) * 110]; };
  SOL.tick = (now = new Date()) => {
    const noonToday = new Date(now); noonToday.setHours(12, 0, 0, 0);
    const st = sunTimes(noonToday, loc.lat, loc.lon);
    const mid = new Date(now); mid.setHours(0, 0, 0, 0);
    const dayFrac = (now - mid) / dayMs;
    const doy = Math.floor((mid - new Date(now.getFullYear(), 0, 0)) / dayMs);
    $('#day-bar').style.width = (dayFrac * 100).toFixed(2) + '%';
    $('#day-bar-lbl').textContent = `DAY ${NV.pad(doy, 3)} · ${(dayFrac * 100).toFixed(1)}% ELAPSED`;
    $('#day-pct').textContent = (dayFrac * 100).toFixed(1) + '%';
    const m = moon(now); const SHORT = { 'New Moon': 'New', 'Waxing Crescent': 'Wax. Cres.', 'First Quarter': '1st Qtr', 'Waxing Gibbous': 'Wax. Gib.', 'Full Moon': 'Full', 'Waning Gibbous': 'Wan. Gib.', 'Last Quarter': 'Last Qtr', 'Waning Crescent': 'Wan. Cres.' };
    $('#moon-phase').textContent = `${SHORT[m.name]} · ${Math.round(m.illum * 100)}%`;
    $('#moon-phase').title = m.name;
    const svg = $('#day-arc'), fill = $('#day-arc-fill'), sun = $('#sun-g');
    if (!st.sunrise) {
      $('#day-state').textContent = st.polar === 'day' ? 'MIDNIGHT SUN' : 'POLAR NIGHT';
      $('#sunrise-lbl').textContent = '--'; $('#sunset-lbl').textContent = '--'; return;
    }
    const f = (d) => NV.fmtClock(d.getHours(), d.getMinutes());
    let t, isDay = now >= st.sunrise && now <= st.sunset;
    const len = (st.sunset - st.sunrise) / 60000;
    $('#day-length').textContent = NV.fmtSpan(len);
    if (isDay) {
      t = (now - st.sunrise) / (st.sunset - st.sunrise);
      $('#sunrise-lbl').textContent = '↑ ' + f(st.sunrise); $('#sunset-lbl').textContent = '↓ ' + f(st.sunset);
      $('#day-state').textContent = t < 0.5 ? 'MORNING ARC' : 'AFTERNOON ARC';
      $('#daylight-left').textContent = NV.fmtSpan((st.sunset - now) / 60000);
    } else {
      // night arc: sunset -> next sunrise
      let set, rise;
      if (now > st.sunset) { set = st.sunset; const nt = new Date(noonToday.getTime() + dayMs); rise = sunTimes(nt, loc.lat, loc.lon).sunrise || new Date(st.sunrise.getTime() + dayMs); }
      else { const pv = new Date(noonToday.getTime() - dayMs); set = sunTimes(pv, loc.lat, loc.lon).sunset || new Date(st.sunset.getTime() - dayMs); rise = st.sunrise; }
      t = (now - set) / (rise - set);
      $('#sunrise-lbl').textContent = '↓ ' + f(set); $('#sunset-lbl').textContent = '↑ ' + f(rise);
      $('#day-state').textContent = 'NIGHT WATCH · SUNRISE IN ' + NV.fmtSpan((rise - now) / 60000).toUpperCase();
      $('#daylight-left').textContent = '0h 00m';
    }
    svg.classList.toggle('night', !isDay);
    t = NV.clamp(t, 0, 1);
    const [x, y] = arcPt(t); sun.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    const total = fill.getTotalLength ? fill.getTotalLength() : 360;
    fill.style.strokeDasharray = `${total * t} ${total}`;
  };
  SOL.init = () => {
    const g = $('#day-ticks'); let h = '';
    for (let i = 0; i <= 12; i++) { const [x, y] = arcPt(i / 12); const [x2, y2] = [150 + (x - 150) * 1.06, 128 + (y - 128) * 1.06]; h += `<line class="tk" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }
    g.innerHTML = h;
    const row = NV.el('div', { class: 'hint', style: 'margin-top:10px' });
    row.innerHTML = `Location: <span id="loc-name">${NV.esc(loc.name)}</span> · <a href="#" id="loc-btn" style="color:var(--acc2)">use my location</a>`;
    $('.hud-day').appendChild(row);
    $('#loc-btn').addEventListener('click', (e) => {
      e.preventDefault();
      if (!navigator.geolocation) { NV.toast('Geolocation unavailable on this device.'); return; }
      navigator.geolocation.getCurrentPosition((p) => { loc = { lat: p.coords.latitude, lon: p.coords.longitude, name: `${p.coords.latitude.toFixed(2)}°, ${p.coords.longitude.toFixed(2)}°` }; NV.store.set('location', loc); $('#loc-name').textContent = loc.name; SOL.tick(); NV.toast('Solar track recalibrated to your position, Sir.'); },
        () => NV.toast('Location access declined. Chicago it is.'), { timeout: 10000 });
    });
    SOL.tick();
  };

  // ======================= SYSTEM STATUS =======================
  const ST = (NV.status = { battery: null, charging: false, fpsHist: [] });
  const t0 = Date.now();
  ST.init = () => {
    $('#st-tz').textContent = localTz;
    $('#st-dpr').textContent = `${screen.width}×${screen.height} @${(window.devicePixelRatio || 1).toFixed(1)}x`;
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const upd = () => {
          ST.battery = b.level; ST.charging = b.charging;
          $('#st-battery').textContent = Math.round(b.level * 100) + '%' + (b.charging ? ' ⚡' : '');
          $('#st-battery-bar').style.width = b.level * 100 + '%';
          const tm = b.charging ? b.chargingTime : b.dischargingTime;
          $('#st-battery-note').textContent = b.charging ? (isFinite(tm) && tm > 0 ? `Full in ${NV.fmtSpan(tm / 60)}` : 'Charging · stable') : (isFinite(tm) ? `${NV.fmtSpan(tm / 60)} remaining` : 'Discharging');
        };
        upd(); ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach((ev) => b.addEventListener(ev, upd));
      }).catch(batFallback);
    } else batFallback();
    const net = () => {
      const c = navigator.connection; const on = navigator.onLine;
      $('#st-net').textContent = on ? (c && c.effectiveType ? c.effectiveType.toUpperCase() : 'ONLINE') : 'OFFLINE';
      $('#st-net-bar').style.width = !on ? '4%' : c && c.downlink ? NV.clamp(c.downlink / 10 * 100, 10, 100) + '%' : '100%';
      $('#st-net-note').textContent = !on ? 'Running on local reserves' : c && c.downlink ? `${c.downlink} Mbps · ${c.rtt ?? '--'}ms RTT` : 'Link established';
    };
    net(); window.addEventListener('online', net); window.addEventListener('offline', net);
    if (navigator.connection && navigator.connection.addEventListener) navigator.connection.addEventListener('change', net);
  };
  function batFallback() {
    $('#st-battery').textContent = 'EXT';
    $('#st-battery-bar').style.width = '100%';
    $('#st-battery-note').textContent = 'Battery API unavailable · external power assumed';
  }
  ST.tick = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('#st-uptime').textContent = `${NV.pad(Math.floor(s / 3600))}:${NV.pad(Math.floor(s / 60) % 60)}:${NV.pad(s % 60)}`;
  };
  ST.fps = (fps) => {
    $('#st-fps').textContent = Math.round(fps) + ' FPS';
    ST.fpsHist.push(fps); if (ST.fpsHist.length > 40) ST.fpsHist.shift();
    const cv = $('#st-spark'); if (!cv) return; const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H); x.beginPath();
    ST.fpsHist.forEach((v, i) => { const px = (i / 39) * W, py = H - 3 - NV.clamp(v / 65, 0, 1) * (H - 6); i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.strokeStyle = NV.colors.primary; x.lineWidth = 1.5; x.shadowColor = NV.colors.primary; x.shadowBlur = 6; x.stroke();
  };

  // ======================= ALERT MODAL =======================
  const ALERT = (NV.alert = { current: null });
  ALERT.show = ({ kicker, time, title, snooze, label }) => {
    ALERT.current = { label: label || title, snooze };
    $('#alert-kicker').textContent = kicker; $('#alert-time').textContent = time; $('#alert-title').textContent = title;
    $('#alert-snooze').hidden = !snooze;
    const m = $('#alert'); m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
    NV.audio.startAlarm(); setTimeout(() => $('#alert-dismiss').focus(), 50);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('NICK-VERSE · ' + kicker, { body: title, icon: 'icons/icon-192.png' }); } catch (e) {} }
    document.title = '⏰ ' + title + ' — NICK-VERSE';
  };
  ALERT.dismiss = (doSnooze) => {
    const m = $('#alert'); if (!m.classList.contains('open')) return false;
    NV.audio.stopAlarm(); m.classList.remove('open'); m.setAttribute('aria-hidden', 'true');
    if (doSnooze && ALERT.current) AL.snooze(ALERT.current.label);
    ALERT.current = null; document.title = 'NICK-VERSE Watch'; return true;
  };
  ALERT.init = () => { $('#alert-dismiss').onclick = () => ALERT.dismiss(false); $('#alert-snooze').onclick = () => ALERT.dismiss(true); };

  // ======================= CINCO ADS =======================
  const CI = (NV.cinco = {});
  const I = (p) => `<svg viewBox="0 0 64 64" fill="none" stroke="#3a2200" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const PRODUCTS = [
    { name: 'CINCO Fwip Auto-Sandwich', line: 'Lunch, now with less you.', tag: 'It makes the sandwich. It eats the sandwich. You just watch.',
      icon: I('<path d="M8 26c0-9 11-14 24-14s24 5 24 14z" fill="#fff3c4"/><path d="M8 32c6 3 10-2 16 1s10-2 16 1 10-2 16 0" stroke="#3aa655"/><path d="M8 38h48" stroke="#d9412b" stroke-width="5"/><path d="M10 44h44a2 2 0 0 1 0 6H10a2 2 0 0 1 0-6z" fill="#fff3c4"/><path d="M46 8l6-4M50 14l7-1" />'),
      feats: ['Assembles up to three sandwiches per fiscal quarter', 'Patented Fwip™ bread-launching action (goggles recommended)', 'Self-cleaning — cleans itself of your approval', 'Now with 40% more mayonnaise-adjacent substance'],
      was: '$899.99', price: '$19.95', plus: 'plus shipping, handling, and emotional damages', fine: 'Do not insert hands, pets, or regrets. Sandwich may be conceptual. Fwip™ velocity may exceed local ordinances.' },
    { name: 'CINCO Nap Helmet', line: 'Sleep anywhere. Legally questionable.', tag: 'Why nap in a bed when you could nap in a helmet?',
      icon: I('<path d="M10 40a22 22 0 0 1 44 0z" fill="#9fd3ff"/><path d="M8 40h48v6H8z" fill="#fff"/><path d="M22 30h20" /><path d="M44 12l4-4h-4l4-4M52 20l3-3h-3l3-3" stroke-width="2.5"/>'),
      feats: ['Pre-installed darkness (batteries not required)', 'Built-in snore amplifier for social dominance', 'Adjusts to head sizes S, M, and “Whoa”', 'Emergency pillow deploys at 60 mph'],
      was: '$1,200', price: '$49.99', plus: 'or 12 easy payments of $49.99', fine: 'Not rated for impacts, sleep, or public transit. Helmet may continue napping after you wake up.' },
    { name: 'CINCO Soup Umbrella', line: 'Stay dry. Stay souped.', tag: 'Finally — an umbrella that catches the rain AND turns it into soup.',
      icon: I('<path d="M6 30a26 26 0 0 1 52 0z" fill="#ff9aa2"/><path d="M32 30v18a5 5 0 0 1-10 0"/><path d="M14 52h24l-3 7H17z" fill="#fff3c4"/><path d="M20 12v-4M44 12v-4M32 8V3" stroke="#3a7bd5"/>'),
      feats: ['Converts precipitation into lukewarm broth', 'Available in Cream of Cloud and Chunky Drizzle', 'Doubles as a very wide spoon', 'Handle-mounted crouton dispenser (croutons sold by the ton)'],
      was: 'priceless', price: '$29.95', plus: 'plus a $400 bowl deposit', fine: 'Soup flavor determined by local weather. Hail season may cause dental events. Do not use during a sharknado.' },
    { name: 'CINCO Pocket Fog', line: 'For dramatic exits. Anywhere.', tag: 'Leave every room like a villain in the third act.',
      icon: I('<path d="M14 40a10 10 0 0 1 4-19 14 14 0 0 1 27-2 10 10 0 0 1 5 20z" fill="#e6ecf2"/><path d="M8 48h30M18 55h36M42 48h12" stroke-width="3"/>'),
      feats: ['Deploys 400 cubic feet of mysterious fog', 'Ambient thunder sold separately', 'Makes Mondays up to 30% more ominous', 'Pocket not included'],
      was: '$250', price: '$14.95', plus: 'plus fog tax and a small emotional surcharge', fine: 'Fog may linger for 3–5 business years. Not for use in submarines, weddings, or submarine weddings.' },
    { name: 'CINCO Emotional Toaster', line: 'It toasts. It listens.', tag: 'The only kitchen appliance that asks how your day was — and means it.',
      icon: I('<rect x="10" y="24" width="44" height="28" rx="8" fill="#ffd0e0"/><path d="M20 24v-8h10v8M34 24v-8h10v8" fill="#f5d08a"/><circle cx="25" cy="37" r="1.5" fill="#3a2200"/><circle cx="39" cy="37" r="1.5" fill="#3a2200"/><path d="M26 44q6 4 12 0"/><path d="M54 32h4"/>'),
      feats: ['Detects sadness via bread moisture', 'Burns encouraging messages into your toast', 'Three settings: Light, Golden, and Therapist', 'Warranty covers feelings for 90 days'],
      was: '$3,000', price: '$39.95', plus: 'plus shipping, handling, and a co-pay', fine: 'Toast advice is not medical advice. Do not bathe with toaster, no matter how good the conversation is going.' },
    { name: 'CINCO Time Refill Pack', line: 'Running low on time? Top up.', tag: '60 fresh minutes of CINCO-certified time. Compatible with this very watch.',
      icon: I('<path d="M18 6h28M18 58h28M20 6c0 14 24 14 24 26S20 44 20 58M44 6c0 14-24 14-24 26s24 14 24 26" /><path d="M26 50h12l-6-8z" fill="#f5c04a"/><path d="M27 16h10" stroke="#f5c04a" stroke-width="4"/>'),
      feats: ['Each pack contains 1 (one) hour', 'Minutes pre-shuffled for freshness', 'Now with More Time™ technology', 'Expires at a time to be determined'],
      was: '$60/min', price: '$9.95/hr', plus: 'seconds billed separately', fine: 'Time purchased cannot be refunded, reversed, or remembered. CINCO is not responsible for Tuesdays that last until Thursday.' }
  ];
  const BUY_LINES = [
    'Order received. CINCO will find you.',
    'Payment accepted in the form of your next free Tuesday.',
    'Thank you! Your product is already in your home. Don’t look.',
    'Transaction complete. Please remain exactly where you are.',
    'Your order has been escalated to the CINCO Board of Directors (Gary).',
    'Congratulations! You are now a CINCO Platinum Member. There is no way out.'
  ];
  let adIdx = 0, adTimer = null, curProduct = 0, buyCount = 0;
  function adShow(i, animate = true) {
    adIdx = (i + PRODUCTS.length) % PRODUCTS.length; const p = PRODUCTS[adIdx]; const body = $('#ad-body');
    const apply = () => { $('#ad-icon').innerHTML = p.icon; $('#ad-name').textContent = p.name; $('#ad-line').textContent = p.line; NV.$$('#ad-dots i').forEach((d, k) => d.classList.toggle('on', k === adIdx)); body.classList.remove('swap'); };
    if (!animate) return apply();
    body.classList.add('swap'); setTimeout(apply, 380);
  }
  function openPromo() {
    curProduct = adIdx; const p = PRODUCTS[curProduct]; buyCount = 0;
    $('#promo-icon').innerHTML = p.icon; $('#promo-name').textContent = p.name; $('#promo-tag').textContent = '“' + p.tag + '”';
    $('#promo-feats').innerHTML = p.feats.map((f) => `<li>${NV.esc(f)}</li>`).join('');
    $('#promo-was').textContent = p.was; $('#promo-price').textContent = p.price; $('#promo-plus').textContent = p.plus; $('#promo-fine').textContent = p.fine;
    $('#promo-result').hidden = true; $('#promo-buy').textContent = 'BUY NOW';
    const m = $('#promo'); m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); NV.audio.confirm();
    clearInterval(adTimer);
  }
  CI.close = () => { const m = $('#promo'); if (!m.classList.contains('open')) return false; m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); startRotation(); return true; };
  function startRotation() { clearInterval(adTimer); adTimer = setInterval(() => adShow(adIdx + 1), 7000); }
  CI.init = () => {
    $('#ad-dots').innerHTML = PRODUCTS.map(() => '<i></i>').join('');
    adShow(Math.floor(Math.random() * PRODUCTS.length), false); startRotation();
    $('#cinco-ad').addEventListener('click', openPromo);
    $('#promo-buy').addEventListener('click', (e) => {
      const r = $('#promo-result'); r.hidden = false;
      r.textContent = '✓ ' + BUY_LINES[buyCount % BUY_LINES.length] + (buyCount >= 2 ? ` (Orders pending: ${buyCount + 1}. Nothing was actually purchased.)` : '');
      buyCount++; $('#promo-buy').textContent = buyCount === 1 ? 'BUY ANOTHER?' : 'BUY EVEN MORE';
      NV.audio.phase(true);
      const b = e.target.getBoundingClientRect(); NV.bg.burst(b.left + b.width / 2, b.top + b.height / 2, 40);
    });
  };
})();
