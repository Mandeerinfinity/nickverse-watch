/* NICK-VERSE Watch — analog HUD face renderer (Canvas 2D, high-DPI, cached layers) */
(function () {
  'use strict';
  const NV = window.NV;
  const TAU = Math.PI * 2;
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const face = (NV.face = { timer: null, focus: null, ready: false });
  let canvas, ctx, S = 0, R = 0, dpr = 1, builtVer = -1, builtSize = 0;
  let L = {}; // cached layers
  let lastSec = -1, tickStart = 0;

  function mk(drawFn) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(S * dpr);
    const x = c.getContext('2d');
    x.scale(dpr, dpr); x.translate(S / 2, S / 2);
    drawFn(x);
    return c;
  }
  const glow = (x, color, blur) => { x.shadowColor = color; x.shadowBlur = blur * dpr; };
  const noGlow = (x) => { x.shadowBlur = 0; x.shadowColor = 'transparent'; };

  // Curved text. bottom=false: reads clockwise across the top; bottom=true: reads left-to-right along the bottom.
  function arcText(x, text, radius, size, color, bottom = false, spacing = 1.18) {
    x.save(); x.font = `600 ${size}px Orbitron, sans-serif`; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...text], widths = chars.map((ch) => x.measureText(ch).width * spacing);
    const span = widths.reduce((a, b) => a + b, 0) / radius;
    let th = bottom ? Math.PI + span / 2 : -span / 2;
    chars.forEach((ch, i) => {
      const w = widths[i] / radius; th += (bottom ? -w : w) / 2;
      x.save(); x.translate(Math.sin(th) * radius, -Math.cos(th) * radius); x.rotate(bottom ? th - Math.PI : th);
      x.fillText(ch, 0, 0); x.restore();
      th += (bottom ? -w : w) / 2;
    });
    x.restore();
  }

  function hexPath(x, r, rot = 0) {
    x.beginPath();
    for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * TAU; const px = Math.cos(a) * r, py = Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.closePath();
  }

  // ---------------- Static dial ----------------
  function buildDial(c) {
    return mk((x) => {
      // base disc
      const g = x.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
      g.addColorStop(0, NV.mixHex(c.bg1, c.primary, 0.12)); g.addColorStop(0.55, c.bg1); g.addColorStop(1, c.bg);
      x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fillStyle = g; x.fill();

      // hex micro-texture
      x.save(); x.beginPath(); x.arc(0, 0, R * 0.9, 0, TAU); x.clip();
      x.strokeStyle = NV.rgba(c.primary, 0.05); x.lineWidth = 0.7;
      const hs = R * 0.055, hw = hs * Math.sqrt(3);
      for (let row = -22; row <= 22; row++) for (let col = -14; col <= 14; col++) {
        const cx = col * hw + (row & 1 ? hw / 2 : 0), cy = row * hs * 1.5;
        if (cx * cx + cy * cy > R * R) continue;
        x.save(); x.translate(cx, cy); hexPath(x, hs, Math.PI / 6); x.stroke(); x.restore();
      }
      // fade texture toward center
      const fade = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
      fade.addColorStop(0, NV.rgba(c.bg1, 0.85)); fade.addColorStop(0.6, NV.rgba(c.bg1, 0.2)); fade.addColorStop(1, NV.rgba(c.bg, 0.4));
      x.fillStyle = fade; x.fillRect(-R, -R, R * 2, R * 2);
      x.restore();

      // concentric guide rings
      x.lineWidth = 1;
      [0.8, 0.68, 0.36].forEach((f, i) => { x.beginPath(); x.arc(0, 0, R * f, 0, TAU); x.strokeStyle = NV.rgba(c.primary, i === 1 ? 0.12 : 0.07); x.stroke(); });

      // bezel (metallic)
      const bz = x.createLinearGradient(-R, -R, R, R);
      bz.addColorStop(0, NV.mixHex('#9aa6ad', c.secondary, 0.25)); bz.addColorStop(0.25, '#2a3036'); bz.addColorStop(0.5, NV.mixHex('#5d676e', c.primary, 0.15)); bz.addColorStop(0.75, '#15191c'); bz.addColorStop(1, NV.mixHex('#7c878e', c.primary, 0.2));
      x.beginPath(); x.arc(0, 0, R * 0.9725, 0, TAU); x.lineWidth = R * 0.055; x.strokeStyle = bz; x.stroke();
      x.beginPath(); x.arc(0, 0, R * 0.9725, 0, TAU); x.lineWidth = R * 0.05; x.strokeStyle = NV.rgba(c.bg, 0.72); x.stroke();
      // bezel edges
      x.lineWidth = 1.2;
      x.beginPath(); x.arc(0, 0, R * 0.999, 0, TAU); x.strokeStyle = NV.rgba(c.secondary, 0.45); x.stroke();
      glow(x, c.primary, 10);
      x.beginPath(); x.arc(0, 0, R * 0.945, 0, TAU); x.lineWidth = 1.6; x.strokeStyle = c.primary; x.stroke();
      noGlow(x);
      // bezel scale (seconds / tachy)
      x.font = `${R * 0.034}px ShareTech, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        x.save(); x.rotate(a);
        if (i % 5 === 0) { x.fillStyle = NV.rgba(c.secondary, 0.85); x.fillText(i === 0 ? '60' : NV.pad(i), 0, -R * 0.9725); }
        else { x.fillStyle = NV.rgba(c.secondary, 0.35); x.fillRect(-0.6, -R * 0.982, 1.2, R * 0.02); }
        x.restore();
      }
      // seconds track
      x.beginPath(); x.arc(0, 0, R * 0.918, 0, TAU); x.lineWidth = R * 0.016; x.strokeStyle = NV.rgba(c.primary, 0.1); x.stroke();

      // minute ticks (base, dim)
      for (let i = 0; i < 60; i++) {
        const maj = i % 5 === 0; x.save(); x.rotate((i / 60) * TAU);
        x.fillStyle = maj ? NV.rgba(c.secondary, 0.9) : NV.rgba(c.primary, 0.3);
        if (maj) { glow(x, c.primary, 8); x.fillRect(-R * 0.011, -R * 0.887, R * 0.022, R * 0.075); noGlow(x); }
        else x.fillRect(-R * 0.0035, -R * 0.887, R * 0.007, R * 0.032);
        x.restore();
      }

      // numerals (skip 3 & 9 -> date/day windows)
      x.font = `600 ${R * 0.085}px Orbitron, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      glow(x, c.primary, 12); x.fillStyle = c.secondary;
      for (let n = 1; n <= 12; n++) {
        if (n === 3 || n === 9) continue;
        const a = (n / 12) * TAU - Math.PI / 2;
        x.fillStyle = n % 3 === 0 ? '#ffffff' : NV.rgba(c.secondary, 0.82);
        x.font = `${n % 3 === 0 ? 800 : 500} ${R * (n % 3 === 0 ? 0.1 : 0.074)}px Orbitron, sans-serif`;
        x.fillText(String(n), Math.cos(a) * R * 0.735, Math.sin(a) * R * 0.735 + R * 0.004);
      }
      noGlow(x);

      // date / day window frames
      [[1, 0], [-1, 0]].forEach(([sx]) => {
        const cx = sx * R * 0.705, w = R * 0.2, h = R * 0.12;
        x.save(); x.translate(cx, 0);
        x.beginPath(); x.roundRect ? x.roundRect(-w / 2, -h / 2, w, h, R * 0.02) : x.rect(-w / 2, -h / 2, w, h);
        x.fillStyle = NV.rgba(c.bg, 0.8); x.fill();
        glow(x, c.primary, 6); x.lineWidth = 1.2; x.strokeStyle = NV.rgba(c.primary, 0.8); x.stroke(); noGlow(x);
        x.restore();
      });

      // curved brand text
      arcText(x, 'NICK-VERSE', R * 0.645, R * 0.048, NV.rgba(c.secondary, 0.95), false, 1.4);
      arcText(x, 'A CINCO CORPORATION PRODUCT', R * 0.645, R * 0.028, NV.rgba(c.secondary, 0.6), true, 1.3);

      // inner stamp texts
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `500 ${R * 0.028}px ShareTech, monospace`; x.fillStyle = NV.rgba(c.secondary, 0.55);
      x.fillText('CHRONO-FWIP 5000', 0, -R * 0.345);
      x.fillText('AUTOMATIC · 5 JEWELS', 0, -R * 0.305);
      // CINCO badge
      const bw = R * 0.2, bh = R * 0.058, by = R * 0.325;
      const bgr = x.createLinearGradient(0, by - bh / 2, 0, by + bh / 2); bgr.addColorStop(0, '#ffffff'); bgr.addColorStop(1, '#b9c4cc');
      x.save(); x.translate(0, by); x.transform(1, 0, -0.18, 1, 0, 0);
      x.beginPath(); x.rect(-bw / 2, -bh / 2, bw, bh); x.fillStyle = bgr; glow(x, 'rgba(255,255,255,.5)', 8); x.fill(); noGlow(x);
      x.fillStyle = c.bg; x.font = `900 ${R * 0.04}px Orbitron, sans-serif`; x.fillText('CINCO', R * 0.004, R * 0.003);
      x.restore();
      x.font = `500 ${R * 0.024}px ShareTech, monospace`; x.fillStyle = NV.rgba(c.secondary, 0.5);
      x.fillText('TIME, NOW WITH MORE TIME™', 0, by + R * 0.058);
    });
  }

  // --------------- Rotating rings ---------------
  function buildRingA(c) { // dashed segment ring
    return mk((x) => {
      glow(x, c.primary, 8); x.lineCap = 'butt';
      for (let i = 0; i < 36; i++) {
        const a0 = (i / 36) * TAU, len = (i % 9 === 0 ? 0.9 : 0.55) * (TAU / 36);
        x.beginPath(); x.arc(0, 0, R * 0.585, a0, a0 + len);
        x.lineWidth = i % 9 === 0 ? R * 0.028 : R * 0.014;
        x.strokeStyle = i % 9 === 0 ? c.secondary : NV.rgba(c.primary, 0.55); x.stroke();
      }
      noGlow(x);
      x.beginPath(); x.arc(0, 0, R * 0.61, 0, TAU); x.lineWidth = 0.8; x.strokeStyle = NV.rgba(c.primary, 0.25); x.stroke();
      // small triangles markers
      x.fillStyle = c.secondary;
      for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * TAU / 4 + TAU / 8); x.beginPath(); x.moveTo(0, -R * 0.555); x.lineTo(-R * 0.012, -R * 0.535); x.lineTo(R * 0.012, -R * 0.535); x.closePath(); x.fill(); x.restore(); }
    });
  }
  function buildRingB(c) { // fine tick ring
    return mk((x) => {
      x.strokeStyle = NV.rgba(c.primary, 0.5); x.lineWidth = 1;
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * TAU, r1 = R * 0.525, r2 = R * (i % 10 === 0 ? 0.495 : 0.512);
        x.beginPath(); x.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); x.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); x.stroke();
      }
      x.beginPath(); x.arc(0, 0, R * 0.532, 0, TAU); x.strokeStyle = NV.rgba(c.primary, 0.35); x.stroke();
      x.font = `${R * 0.022}px ShareTech, monospace`; x.fillStyle = NV.rgba(c.secondary, 0.5); x.textAlign = 'center';
      ['SYS', 'NV-5', 'CORE', 'SYNC'].forEach((t, i) => { x.save(); x.rotate(i * TAU / 4 + 0.08); x.fillText(t, 0, -R * 0.47); x.restore(); });
    });
  }
  function buildRingC(c) { // three glowing arcs
    return mk((x) => {
      x.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a0 = (i / 3) * TAU; glow(x, c.primary, 16);
        x.beginPath(); x.arc(0, 0, R * 0.455, a0, a0 + TAU / 3 - 0.5); x.lineWidth = R * 0.022; x.strokeStyle = NV.rgba(c.primary, 0.9); x.stroke();
        noGlow(x);
        x.beginPath(); x.arc(0, 0, R * 0.455, a0 + 0.1, a0 + TAU / 3 - 0.6); x.lineWidth = R * 0.006; x.strokeStyle = '#fff'; x.stroke();
        x.beginPath(); x.arc(0, 0, R * 0.43, a0 + TAU / 3 - 0.35, a0 + TAU / 3 - 0.15); x.lineWidth = R * 0.01; x.strokeStyle = c.secondary; x.stroke();
      }
    });
  }
  function buildCore(c) { // arc-reactor-inspired hex core (original design)
    return mk((x) => {
      const halo = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
      halo.addColorStop(0, NV.rgba(c.secondary, 0.55)); halo.addColorStop(0.35, NV.rgba(c.primary, 0.22)); halo.addColorStop(1, NV.rgba(c.primary, 0));
      x.fillStyle = halo; x.beginPath(); x.arc(0, 0, R * 0.34, 0, TAU); x.fill();
      x.beginPath(); x.arc(0, 0, R * 0.24, 0, TAU); x.fillStyle = NV.rgba(c.bg, 0.55); x.fill();
      glow(x, c.primary, 12);
      x.beginPath(); x.arc(0, 0, R * 0.24, 0, TAU); x.lineWidth = R * 0.012; x.strokeStyle = NV.rgba(c.primary, 0.9); x.stroke();
      // 12 coil segments
      for (let i = 0; i < 12; i++) {
        x.save(); x.rotate((i / 12) * TAU);
        x.beginPath(); x.moveTo(-R * 0.03, -R * 0.222); x.lineTo(R * 0.03, -R * 0.222); x.lineTo(R * 0.02, -R * 0.178); x.lineTo(-R * 0.02, -R * 0.178); x.closePath();
        x.fillStyle = NV.rgba(c.secondary, 0.8); x.fill(); x.restore();
      }
      x.beginPath(); x.arc(0, 0, R * 0.162, 0, TAU); x.lineWidth = R * 0.006; x.strokeStyle = c.secondary; x.stroke();
      hexPath(x, R * 0.125, Math.PI / 6); x.lineWidth = R * 0.014; x.strokeStyle = c.primary; x.stroke();
      noGlow(x);
      const core = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.11);
      core.addColorStop(0, '#ffffff'); core.addColorStop(0.4, NV.rgba(c.secondary, 0.9)); core.addColorStop(1, NV.rgba(c.primary, 0.1));
      hexPath(x, R * 0.11, Math.PI / 6); x.fillStyle = core; x.fill();
    });
  }
  function buildGlass() {
    return mk((x) => {
      x.save(); x.beginPath(); x.arc(0, 0, R * 0.94, 0, TAU); x.clip();
      const g = x.createLinearGradient(-R * 0.6, -R * 0.9, R * 0.2, R * 0.1);
      g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.beginPath(); x.ellipse(-R * 0.18, -R * 0.42, R * 0.85, R * 0.55, -0.5, 0, TAU); x.fillStyle = g; x.fill();
      const v = x.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 0.95); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
      x.fillStyle = v; x.fillRect(-R, -R, R * 2, R * 2);
      x.restore();
    });
  }

  function rebuild() {
    const c = NV.colors;
    L = { dial: buildDial(c), ringA: buildRingA(c), ringB: buildRingB(c), ringC: buildRingC(c), core: buildCore(c), glass: buildGlass(),
      hour: buildHand(c, R * 0.5, R * 0.062, R * 0.09), minute: buildHand(c, R * 0.8, R * 0.044, R * 0.1), second: buildSecond(c), cap: buildCap(c), spark: buildSpark(c) };
    builtVer = NV.colors.v; builtSize = S * dpr;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(100, Math.round(rect.width));
    dpr = NV.dpr();
    if (size === S && canvas.width === Math.round(size * dpr)) return;
    S = size; R = S * 0.49;
    canvas.width = canvas.height = Math.round(S * dpr);
    builtVer = -1;
  }

  // --------------- Hands (pre-rendered sprites: glow baked in, cheap to rotate) ---------------
  function handPath(x, len, width, tail) {
    x.beginPath(); x.moveTo(0, tail); x.lineTo(-width / 2, 0); x.lineTo(-width * 0.32, -len * 0.86); x.lineTo(0, -len);
    x.lineTo(width * 0.32, -len * 0.86); x.lineTo(width / 2, 0); x.closePath();
  }
  function sprite(len, tail, halfW, drawFn) {
    const m = R * 0.09, w = halfW * 2 + m * 2, h = len + tail + m * 2;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const x = cv.getContext('2d'); x.scale(dpr, dpr); x.translate(w / 2, m + len); drawFn(x);
    return { img: cv, w, h, ox: w / 2, oy: m + len };
  }
  function buildHand(c, len, width, tail) {
    const body = sprite(len, tail, width / 2, (x) => {
      glow(x, NV.rgba(c.primary, 0.9), 14);
      x.beginPath(); x.moveTo(0, tail); x.lineTo(-width / 2, 0); x.lineTo(-width * 0.32, -len * 0.86); x.lineTo(0, -len); x.closePath();
      x.fillStyle = c.hand; x.fill(); noGlow(x);
      x.beginPath(); x.moveTo(0, tail); x.lineTo(width / 2, 0); x.lineTo(width * 0.32, -len * 0.86); x.lineTo(0, -len); x.closePath();
      x.fillStyle = NV.mixHex(c.hand, c.bg1, 0.45); x.fill();
      glow(x, c.primary, 10);
      x.beginPath(); x.moveTo(0, -len * 0.22); x.lineTo(0, -len * 0.8);
      x.lineWidth = Math.max(1.5, width * 0.22); x.lineCap = 'round'; x.strokeStyle = c.primary; x.stroke(); noGlow(x);
    });
    const shadow = sprite(len, tail, width / 2, (x) => {
      x.shadowColor = 'rgba(0,0,0,0.75)'; x.shadowBlur = 6 * dpr; x.shadowOffsetX = 2000 * dpr;
      x.translate(-2000, 0); handPath(x, len, width, tail); x.fillStyle = '#000'; x.fill();
    });
    return { body, shadow };
  }
  function buildSecond(c) {
    const len = R * 0.9, tail = R * 0.2;
    const draw = (x, col, shadow) => {
      x.strokeStyle = col; x.lineCap = 'round';
      x.lineWidth = R * 0.008; x.beginPath(); x.moveTo(0, tail); x.lineTo(0, -len); x.stroke();
      x.lineWidth = R * 0.022; x.beginPath(); x.moveTo(0, tail); x.lineTo(0, R * 0.08); x.stroke();
      x.beginPath(); x.arc(0, -R * 0.74, R * 0.022, 0, TAU); x.lineWidth = R * 0.007; x.stroke();
      if (!shadow) { x.beginPath(); x.arc(0, -R * 0.74, R * 0.012, 0, TAU); x.fillStyle = '#fff'; x.fill(); }
    };
    const body = sprite(len, tail, R * 0.03, (x) => { glow(x, c.tertiary, 14); draw(x, c.tertiary); noGlow(x); x.globalAlpha = 0.6; draw(x, '#ffffff'); });
    const shadow = sprite(len, tail, R * 0.03, (x) => { x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 4 * dpr; x.shadowOffsetX = 2000 * dpr; x.translate(-2000, 0); draw(x, '#000', true); });
    return { body, shadow };
  }
  function buildCap(c) {
    return sprite(0, 0, R * 0.05, (x) => {
      glow(x, c.primary, 12);
      x.beginPath(); x.arc(0, 0, R * 0.036, 0, TAU); x.fillStyle = c.bg; x.fill(); x.lineWidth = R * 0.01; x.strokeStyle = c.tertiary; x.stroke();
      noGlow(x); x.beginPath(); x.arc(0, 0, R * 0.014, 0, TAU); x.fillStyle = '#fff'; x.fill();
    });
  }
  function buildSpark(c) {
    return sprite(0, 0, R * 0.01, (x) => {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.07);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, NV.rgba(c.secondary, 0.95)); g.addColorStop(0.45, NV.rgba(c.primary, 0.35)); g.addColorStop(1, NV.rgba(c.primary, 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.07, 0, TAU); x.fill();
    });
  }
  function drawSprite(sp, angle, dx = 0, dy = 0) {
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(angle); ctx.drawImage(sp.img, -sp.ox, -sp.oy, sp.w, sp.h); ctx.restore();
  }

  function drawLayer(img, px, py, rot) {
    if (rot) { ctx.save(); ctx.translate(S / 2 + px, S / 2 + py); ctx.rotate(rot); ctx.drawImage(img, -S / 2, -S / 2, S, S); ctx.restore(); }
    else ctx.drawImage(img, px, py, S, S);
  }

  face.draw = function (now, t) {
    if (!canvas) return;
    if (builtVer !== NV.colors.v || builtSize !== S * dpr) rebuild();
    const c = NV.colors, x = ctx;
    const d = new Date(now);
    const ms = d.getMilliseconds(), sec = d.getSeconds(), min = d.getMinutes(), hr = d.getHours();
    // second hand position: smooth sweep, or ticking with spring settle
    let secF;
    if (NV.settings.sweep) secF = sec + ms / 1000;
    else {
      if (sec !== lastSec) { lastSec = sec; tickStart = now; }
      const k = NV.clamp((now - tickStart) / 180, 0, 1);
      const spring = 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5);
      secF = sec - 1 + NV.clamp(spring, 0, 1.08);
    }
    const minF = min + (sec + ms / 1000) / 60, hrF = (hr % 12) + minF / 60;
    const aS = (secF / 60) * TAU, aM = (minF / 60) * TAU, aH = (hrF / 12) * TAU;
    const px = (NV.parallax ? NV.parallax.x : 0) * S * 0.012, py = (NV.parallax ? NV.parallax.y : 0) * S * 0.012;

    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, S, S);

    drawLayer(L.dial, px * 0.2, py * 0.2);

    // radar sweep trailing the second hand
    x.save(); x.translate(S / 2 + px * 0.3, S / 2 + py * 0.3);
    if (x.createConicGradient) {
      const sweep = 1.1; const g = x.createConicGradient(aS - Math.PI / 2 - sweep, 0, 0);
      const f = sweep / TAU;
      g.addColorStop(0, NV.rgba(c.primary, 0)); g.addColorStop(f * 0.985, NV.rgba(c.primary, 0.16)); g.addColorStop(f, NV.rgba(c.secondary, 0.3)); g.addColorStop(Math.min(1, f + 0.002), NV.rgba(c.primary, 0)); g.addColorStop(1, NV.rgba(c.primary, 0));
      x.beginPath(); x.arc(0, 0, R * 0.8, 0, TAU); x.arc(0, 0, R * 0.25, 0, TAU, true); x.fillStyle = g; x.fill('evenodd');
    }
    x.restore();

    // rotating rings
    const tt = t / 1000;
    drawLayer(L.ringA, px * 0.45, py * 0.45, tt * 0.12);
    drawLayer(L.ringB, px * 0.55, py * 0.55, -tt * 0.07);
    drawLayer(L.ringC, px * 0.65, py * 0.65, tt * 0.45);

    // core with pulse
    x.save(); const pulse = 0.82 + 0.18 * Math.sin(tt * 2.4);
    x.globalAlpha = pulse; drawLayer(L.core, px * 0.8, py * 0.8, -tt * 0.05); x.restore();
    x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.18 + 0.12 * Math.sin(tt * 2.4);
    const cg = x.createRadialGradient(S / 2 + px * 0.8, S / 2 + py * 0.8, 0, S / 2 + px * 0.8, S / 2 + py * 0.8, R * 0.2);
    cg.addColorStop(0, c.secondary); cg.addColorStop(1, NV.rgba(c.primary, 0));
    x.fillStyle = cg; x.fillRect(0, 0, S, S); x.restore();

    x.save(); x.translate(S / 2 + px * 0.2, S / 2 + py * 0.2);
    // minute progress: lit ticks up to current minute
    for (let i = 0; i <= min; i++) {
      if (i % 5 === 0) continue; x.save(); x.rotate((i / 60) * TAU);
      x.fillStyle = NV.rgba(c.secondary, 0.55); x.fillRect(-R * 0.0035, -R * 0.887, R * 0.007, R * 0.032); x.restore();
    }
    // seconds trail on ticks
    x.globalCompositeOperation = 'lighter';
    const curTick = Math.floor(secF) % 60;
    for (let k = 0; k < 12; k++) {
      const i = (curTick - k + 60) % 60, a = 1 - k / 12;
      x.save(); x.rotate((i / 60) * TAU); x.fillStyle = NV.rgba(c.secondary, a * 0.9);
      const maj = i % 5 === 0; x.fillRect(-R * (maj ? 0.011 : 0.005), -R * 0.887, R * (maj ? 0.022 : 0.01), R * (maj ? 0.075 : 0.036));
      x.restore();
    }
    noGlow(x); x.globalCompositeOperation = 'source-over';

    // seconds progress ring (layered strokes = cheap bloom)
    const sf = secF / 60, a0 = -Math.PI / 2, a1 = a0 + sf * TAU + 0.0001;
    x.lineCap = 'round'; x.globalCompositeOperation = 'lighter';
    [[0.05, 0.06], [0.03, 0.14], [0.018, 0.5]].forEach(([w, al]) => { x.beginPath(); x.arc(0, 0, R * 0.918, a0, a1); x.lineWidth = R * w; x.strokeStyle = NV.rgba(c.primary, al); x.stroke(); });
    x.beginPath(); x.arc(0, 0, R * 0.918, a0, a1); x.lineWidth = R * 0.007; x.strokeStyle = NV.rgba(c.secondary, 0.95); x.stroke();
    const sx = Math.cos(aS - Math.PI / 2) * R * 0.918, sy = Math.sin(aS - Math.PI / 2) * R * 0.918;
    x.drawImage(L.spark.img, sx - L.spark.ox, sy - L.spark.oy, L.spark.w, L.spark.h);
    x.globalCompositeOperation = 'source-over';

    // timer / focus arcs (inner)
    const drawArc = (frac, r, color, label) => {
      x.beginPath(); x.arc(0, 0, r, 0, TAU); x.lineWidth = R * 0.012; x.strokeStyle = NV.rgba(color, 0.12); x.stroke();
      const e1 = -Math.PI / 2 + TAU * NV.clamp(frac, 0, 1) + 0.0001; x.lineCap = 'round';
      x.beginPath(); x.arc(0, 0, r, -Math.PI / 2, e1); x.lineWidth = R * 0.035; x.strokeStyle = NV.rgba(color, 0.15); x.stroke();
      x.beginPath(); x.arc(0, 0, r, -Math.PI / 2, e1); x.lineWidth = R * 0.012; x.strokeStyle = color; x.stroke();
      if (label) { x.font = `${R * 0.026}px ShareTech, monospace`; x.fillStyle = color; x.textAlign = 'center'; x.fillText(label, 0, -r + R * 0.04); }
    };
    if (face.timer) drawArc(face.timer.frac, R * 0.4, c.tertiary, face.timer.label);
    if (face.focus) drawArc(face.focus.frac, face.timer ? R * 0.375 : R * 0.4, c.secondary, face.timer ? '' : face.focus.label);

    // date & day windows
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${R * 0.052}px Orbitron, sans-serif`; x.fillStyle = '#fff';
    x.fillText(String(d.getDate()), R * 0.705 - R * 0.042, R * 0.004);
    x.font = `500 ${R * 0.034}px ShareTech, monospace`; x.fillStyle = c.secondary;
    x.fillText(MONTHS[d.getMonth()], R * 0.705 + R * 0.045, R * 0.004);
    x.font = `700 ${R * 0.046}px Orbitron, sans-serif`; x.fillStyle = '#fff';
    x.fillText(DAYS[d.getDay()], -R * 0.705, R * 0.004);
    noGlow(x);
    x.restore();

    // hands (sprites) — shadows offset in fixed screen direction for real depth
    x.save(); x.translate(S / 2 + px, S / 2 + py);
    const so = R * 0.022;
    drawSprite(L.hour.shadow, aH, so * 0.6, so); drawSprite(L.hour.body, aH);
    drawSprite(L.minute.shadow, aM, so * 0.8, so * 1.3); drawSprite(L.minute.body, aM);
    drawSprite(L.second.shadow, aS, so, so * 1.6); drawSprite(L.second.body, aS);
    drawSprite(L.cap, 0);
    x.restore();

    drawLayer(L.glass, -px * 0.4, -py * 0.4);
  };

  face.init = function (el) {
    canvas = el; ctx = canvas.getContext('2d');
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 20px Orbitron'), document.fonts.load('20px ShareTech')]).then(() => { builtVer = -1; }).catch(() => {});
    }
    face.ready = true;
  };
})();
