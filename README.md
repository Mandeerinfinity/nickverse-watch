# NICK-VERSE Watch

*A CINCO Corporation Product. Time, Now With More Time.™*

A heads-up-display smartwatch-style clock for Nick. It's a self-contained static web app with no build step,
no CDNs, and no network dependencies. It uses vanilla JS, Canvas 2D, SVG, Web Audio, and Web Speech.

## Run
```bash
cd nickverse-watch
python3 -m http.server 8000
# open http://localhost:8000
```
You can also open `index.html` directly from disk. Everything works except the offline service worker, which needs http(s).

## Features
- **Analog HUD face** (high-DPI canvas): smooth sweeping second hand with radar sweep, glowing seconds progress ring,
  ticks that light up for the minute, a tick trail behind the second hand, three counter-rotating inner rings, a pulsing hex core,
  date and day windows, curved NICK-VERSE / CINCO dial text, faceted hands with drop shadows, and a glass reflection. Tap the face to hear the time.
- **Digital readout**: time, seconds, AM/PM, day of week, and date. There's a 12/24h toggle.
- **5 themes** with smooth color-interpolated transitions, saved in localStorage: Arc Reactor, Crimson Armor, Stealth Night, Nick-Verse Neon, Gamma Pulse.
- **Stopwatch** with laps. The best and worst laps are highlighted, and state survives a page reload.
- **Countdown timer** with presets, a custom H:M:S entry, +1 min, and a synthesized klaxon alarm. The remaining time shows as an arc on the face.
- **Alarms**: add, delete, or toggle them, with repeat days or one-time. They're saved in localStorage and come with a full-screen alert, sound, a 5-min snooze, and vibration where supported.
- **World clocks**: 37 built-in cities (Intl time zones). Each one has a mini analog clock, day/night, today/tomorrow, and the offset from local time.
- **J.A.R.V.I.S. panel**: it speaks the time with a British voice when one is available, greets you by time of day, and has dry-wit lines, a status report, and an animated voice orb.
- **Focus protocol** (Pomodoro): configurable work, break, and long-break lengths, a 4-cycle tracker, and a daily count. The rest of the UI dims while you work.
- **Solar track**: a sunrise/sunset arc with sun or moon position (default location Chicago, or tap "use my location"), plus day length, moon phase, and day-of-year progress.
- **System status HUD**: battery (Battery API, or a fallback when it's missing), network, a live FPS sparkline, session uptime, and time zone.
- **Ambient effects**: a depth particle field with constellation lines, a perspective grid, scanlines, a scan bar, and mouse/tilt parallax. Each one can be turned off.
- **Hourly chime** (a synthesized bell), with an option for JARVIS to announce the hour.
- **CINCO sponsored transmissions**: rotating parody product ads that open a fake infomercial. Nothing is ever purchased or linked.
- **PWA**: a manifest, icons, and an offline cache-first service worker.

## Keyboard
`1–6` switch module · `Space` start/pause · `L` lap · `R` reset · `T` / `Shift+T` theme · `H` 12/24h · `J` speak time ·
`C` chime · `F` fullscreen · `S` settings · `?` help · `Esc` close/dismiss

## Notes
- Alarms, timers, and chimes only fire while the page is open. A background tab is fine, but a closed one isn't.
- Speech voices depend on the browser and OS. If there's no en-GB voice, the best English voice is used.
- Browsers only allow audio after your first click or keypress.
- Fonts: Orbitron, Rajdhani, and Share Tech Mono (SIL OFL 1.1), bundled in `/fonts`.
- The design is original. It uses no Marvel logos or assets. CINCO is a fictional parody brand.
