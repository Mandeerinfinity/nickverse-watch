/* NICK-VERSE Watch — synthesized audio (Web Audio API, no samples) */
(function () {
  'use strict';
  const NV = window.NV;
  let ctx = null, master = null, alarmTimer = null, alarmActive = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = NV.settings.volume;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  NV.onSetting((k, v) => { if (k === 'volume' && master) master.gain.value = v; });
  // Unlock on first gesture (autoplay policies)
  const unlock = () => { ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

  function tone(freq, start, dur, { type = 'sine', gain = 0.3, attack = 0.005, glideTo = null, dest = null } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest || master); o.start(start); o.stop(start + dur + 0.05);
  }

  NV.audio = {
    unlock: ensure,
    // subtle UI blip
    click(pitch = 1) {
      if (!NV.settings.uisound || !ensure()) return;
      const t = ctx.currentTime; tone(1800 * pitch, t, 0.05, { type: 'triangle', gain: 0.05 }); tone(2600 * pitch, t + 0.02, 0.04, { type: 'sine', gain: 0.03 });
    },
    // rising HUD confirm
    confirm() {
      if (!NV.settings.uisound || !ensure()) return;
      const t = ctx.currentTime; tone(660, t, 0.12, { gain: 0.08, glideTo: 990 }); tone(1320, t + 0.08, 0.18, { gain: 0.06 });
    },
    // soft two-tone bell chime (hourly)
    chime() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [[784, 0], [1047, 0.42], [1319, 0.84]].forEach(([f, d]) => {
        tone(f, t + d, 2.2, { gain: 0.22, attack: 0.01 });
        tone(f * 2.01, t + d, 1.2, { gain: 0.06, attack: 0.01 });
        tone(f * 3.03, t + d, 0.6, { gain: 0.025, attack: 0.01 });
      });
    },
    // focus phase change
    phase(up = true) {
      if (!ensure()) return;
      const t = ctx.currentTime; const seq = up ? [523, 659, 784, 1047] : [1047, 784, 659, 523];
      seq.forEach((f, i) => tone(f, t + i * 0.11, 0.35, { gain: 0.14, type: 'triangle' }));
    },
    // looping alarm — urgent HUD klaxon pattern
    startAlarm() {
      if (!ensure() || alarmActive) return; alarmActive = true;
      const burst = () => {
        if (!alarmActive) return; const t = ctx.currentTime + 0.02;
        for (let i = 0; i < 3; i++) {
          tone(880, t + i * 0.16, 0.12, { type: 'square', gain: 0.09 });
          tone(1760, t + i * 0.16, 0.1, { type: 'sine', gain: 0.08 });
        }
        tone(660, t + 0.55, 0.35, { type: 'sawtooth', gain: 0.05, glideTo: 1320 });
      };
      burst(); alarmTimer = setInterval(burst, 1200);
      if (navigator.vibrate) try { navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) {}
    },
    stopAlarm() { alarmActive = false; clearInterval(alarmTimer); alarmTimer = null; if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) {} },
    get alarmActive() { return alarmActive; }
  };
})();
