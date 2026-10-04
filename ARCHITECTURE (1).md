# Kiko (Electron) — Architecture & Build Spec

> This document is the source of truth for the project. Follow it strictly. Do not add features, libraries or layers that are not listed here. Keep the MVP small.

## 1. Goal

A lightweight Windows desktop companion. A small animated pet (Spider-Man by default) lives on the desktop with a transparent background, stays above other windows, can be dragged, walks around occasionally, and shows a speech-bubble reminder every 60 minutes to drink water. The user can choose between multiple pets.

**Priorities (in order):** low RAM/CPU → smooth animation → fast startup → native Windows feel → simple code → maintainability.

## 2. Tech Stack

| Area | Choice |
|---|---|
| Runtime | Electron (latest stable) |
| UI | Plain HTML + CSS + vanilla JS. **No React/Vue/Tailwind, no bundler** |
| Animation | CSS sprite sheets with `steps()` |
| Storage | Single `settings.json` in `app.getPath('userData')` (no database) |
| Packaging | `electron-builder` (NSIS installer + portable), x64, Windows 10/11 |
| Network | None. Fully offline. No telemetry |

Dependencies: only `electron` and `electron-builder` (dev). Write the settings store by hand (read/write JSON), do not add `electron-store`.

## 3. Folder Structure

```
kiko-desktop-pet/
├── package.json
├── electron-builder.yml
├── ARCHITECTURE.md
├── src/
│   ├── main/
│   │   ├── main.js              # app lifecycle, single-instance lock, wiring
│   │   ├── petWindow.js         # transparent pet window, position, bounds, always-on-top
│   │   ├── movement.js          # walking logic (timer only while WALKING)
│   │   ├── reminder.js          # reminder scheduler (single timeout)
│   │   ├── tray.js              # tray icon + menu (pause, interval, choose pet, toggles, exit)
│   │   ├── settings.js          # load/save/merge defaults, debounced writes
│   │   ├── settingsWindow.js    # on-demand settings window (destroyed on close)
│   │   ├── petLoader.js         # scans /pets, validates manifests
│   │   └── ipc.js               # all ipcMain handlers in one place
│   ├── preload/
│   │   └── preload.js           # contextBridge API (minimal, whitelisted)
│   └── renderer/
│       ├── pet/
│       │   ├── pet.html
│       │   ├── pet.css
│       │   └── pet.js           # state machine, sprite switching, bubble, hover hit-testing
│       └── settings/
│           ├── settings.html
│           ├── settings.css
│           └── settings.js
├── pets/
│   ├── spiderman/
│   │   ├── manifest.json
│   │   └── sheet.png
│   └── <other-pet>/
│       ├── manifest.json
│       └── sheet.png
└── assets/
    ├── kiko.ico
    └── water.wav
```

## 4. Process Model

Idle target: **one** visible BrowserWindow (the pet). Everything else is created on demand.

```
┌────────────────────────── Main process ──────────────────────────┐
│ main.js ── settings ── petLoader ── reminder ── movement ── tray │
│     │                                                            │
│     ├── petWindow (BrowserWindow, always alive)                  │
│     └── settingsWindow (created on demand, destroyed on close)   │
└───────────────┬──────────────────────────────────────────────────┘
                │ IPC via preload (contextBridge)
┌───────────────▼───────────────┐
│ Renderer: pet.html            │
│ state machine + CSS sprites   │
│ speech bubble (DOM element)   │
└───────────────────────────────┘
```

The reminder timer and the movement timer live in the **main process**. The renderer only handles visuals.

## 5. Pet Window

```js
new BrowserWindow({
  width: 160, height: 200,
  transparent: true,
  frame: false,
  hasShadow: false,
  resizable: false,
  skipTaskbar: true,
  focusable: false,
  alwaysOnTop: true,
  show: false,
  webPreferences: {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    backgroundThrottling: true
  }
});
win.setAlwaysOnTop(true, 'screen-saver');
win.setIgnoreMouseEvents(true, { forward: true });
```

**Click-through:** the window ignores mouse events by default. The renderer listens to `mousemove` (forwarded) and, when the cursor is over the pet or bubble, asks main to call `setIgnoreMouseEvents(false)`; when the cursor leaves, it switches back to `true`.

**Dragging:** implement custom drag in the renderer (`mousedown` → send deltas via IPC → main calls `setPosition`). Do not use `-webkit-app-region: drag` because it breaks the click-through toggle.

**Position:** save the last position on drag end (debounced). Clamp to the work area of the nearest display using `screen.getDisplayNearestPoint(...).workArea`. If the saved position is off-screen at startup (monitor removed), reset it inside the primary display.

## 6. Multiple Pets

Each pet is a folder in `/pets`. Adding a pet means adding a folder, never changing code.

`manifest.json`:

```json
{
  "id": "spiderman",
  "name": "Spider-Man",
  "frameSize": [128, 128],
  "states": {
    "idle":     { "row": 0, "frames": 4, "fps": 4 },
    "walking":  { "row": 1, "frames": 6, "fps": 8 },
    "reminder": { "row": 2, "frames": 4, "fps": 6 },
    "drinking": { "row": 3, "frames": 4, "fps": 5 },
    "sleeping": { "row": 4, "frames": 2, "fps": 2 }
  },
  "messages": [
    "🕷️ Hey! It's been 1 hour. Drink some water 💧"
  ]
}
```

Rules:
- `petLoader.js` scans `/pets` at startup, validates every manifest (required keys, sheet exists), and skips invalid ones with a console warning.
- Tray → **Choose Pet** submenu lists valid pets (radio style). Selecting one sends `set-pet` to the renderer and saves `petId` in settings.
- MVP: **one pet visible at a time**. Showing several pets simultaneously is a future feature (see section 13).
- Fallback: if the saved `petId` is missing, use the first valid pet.

## 7. Animation

CSS sprite sheet, one PNG per pet, one row per state. No GIF, no video, no per-frame JS loop.

```css
.pet {
  width: var(--w); height: var(--h);
  background-image: var(--sheet);
  background-position: 0 calc(var(--row) * var(--h) * -1);
  background-repeat: no-repeat;
  image-rendering: pixelated;
  animation: play calc(var(--frames) / var(--fps) * 1s) steps(var(--frames)) infinite;
}
@keyframes play {
  to { background-position-x: calc(var(--frames) * var(--w) * -1); }
}
.pet.paused { animation-play-state: paused; }
.pet.flip   { transform: scaleX(-1); }
```

JavaScript only sets CSS variables when the state changes. Use `flip` for walking direction. Pause the animation while SLEEPING or HIDDEN.

## 8. State Machine (renderer, driven by main-process events)

States: `IDLE`, `WALKING`, `REMINDER`, `DRINKING`, `SLEEPING`, `HIDDEN`.

```
IDLE ──(random 20–60s, movement enabled)──► WALKING ──(target reached)──► IDLE
IDLE ──(reminder due)──► REMINDER ──► DRINKING ──► IDLE
IDLE ──(no interaction ~10 min)──► SLEEPING ──(click/drag)──► IDLE
SLEEPING ──(reminder due)──► REMINDER ──► DRINKING ──► IDLE
ANY ──(hide from tray)──► HIDDEN ──(show)──► IDLE
```

Keep the machine as a plain transition table in `pet.js`. Timers for state changes use `setTimeout`, and every timer is cleared on state exit.

## 9. Movement

- `movement.js` runs a `setInterval` (~30–40 ms) **only while WALKING**. On leaving WALKING it calls `clearInterval`. At idle there must be no active interval.
- Walk horizontally along the bottom of the work area, turn at the edges, and pick a random target distance.
- Step size is based on elapsed time (delta), not a fixed value, so speed stays consistent.
- Multi-monitor: use the display nearest to the pet. Do not cross displays in the MVP.

## 10. Reminder System

- Settings: `reminderEnabled`, `intervalMinutes` (default 60), `paused`.
- Store `nextDue` as an **absolute timestamp**. Arm a single `setTimeout(nextDue - Date.now())`. No polling.
- On fire: send `show-reminder` (with a message from the manifest) to the renderer, optionally play `water.wav`, optionally show a system notification, then schedule the next one.
- `powerMonitor.on('resume')`: recompute the delay. If the deadline passed during sleep, fire once (never a burst).
- Pause stores the remaining time; resume re-arms from it.
- Changing the interval re-arms from now.
- The reminder lives in the main process, so closing the settings window never affects it.
- Write `reminder.js` so it can hold a list of jobs later (Pomodoro, break reminders), but only one job exists in the MVP.

## 11. Speech Bubble

A DOM element inside the pet window (not a separate window). Show for ~8 seconds with a CSS fade, then hide. Increase the window height (or reserve space above the pet from the start) so the bubble is not clipped. Keep it borderless and minimal; use a soft shadow/background instead of borders.

## 12. IPC Contract (preload.js)

Expose only these through `contextBridge` under `window.pet`:

| Channel | Direction | Purpose |
|---|---|---|
| `set-pet` | main → renderer | load a pet manifest and sheet |
| `show-reminder` | main → renderer | show bubble + REMINDER state |
| `set-movement` | main → renderer | walking on/off |
| `walk-start` / `walk-stop` | renderer → main | start/stop the movement timer |
| `drag-delta` | renderer → main | move window while dragging |
| `drag-end` | renderer → main | save position |
| `set-ignore-mouse` | renderer → main | click-through toggle |
| `get-settings` / `update-settings` | renderer ↔ main | settings window |

Validate every payload in `ipc.js`. No raw `ipcRenderer` exposure.

## 13. Settings

```json
{
  "petId": "spiderman",
  "position": { "x": 100, "y": 600 },
  "alwaysOnTop": true,
  "movementEnabled": true,
  "startWithWindows": false,
  "reminderEnabled": true,
  "intervalMinutes": 60,
  "paused": false,
  "sound": true,
  "notification": false,
  "scale": 1.0,
  "animationSpeed": 1.0
}
```

- Merge with defaults on load so new keys never break old files.
- Debounce writes (~500 ms). Handle a corrupt JSON file by falling back to defaults.
- Settings window (on-demand, destroyed on close): **General** (start with Windows, always on top, movement), **Reminder** (enable, interval, sound, notification), **Appearance** (pet, size, animation speed). Plain HTML form, no framework.

## 14. Windows Integration

- **Tray:** icon with menu — Pause/Resume, Interval, Choose Pet, Always on top, Movement, Sound, Settings, Hide/Show, Exit.
- **Start with Windows:** `app.setLoginItemSettings({ openAtLogin })`.
- **Single instance:** `app.requestSingleInstanceLock()`; a second launch just focuses/shows the existing pet.
- **Notifications:** Electron `Notification`, optional and off by default.
- **No admin rights.** Never request elevation.

## 15. Performance Rules

1. Only one BrowserWindow is alive at idle.
2. No timers run in IDLE except the reminder timeout and the state-change timeout.
3. The movement interval exists only in WALKING.
4. Animations are CSS `steps()` and paused when SLEEPING/HIDDEN.
5. No frameworks, no heavy dependencies, no remote content.
6. Settings and sprite sheets are read once, not per frame.
7. Destroy the settings window on close (`win = null`).
8. Remove IPC listeners and clear timers on state exit to avoid leaks.
9. Try `app.disableHardwareAcceleration()` and compare CPU/RAM with it on and off, then keep the better option.
10. Expected idle RAM is roughly 90–150 MB (Electron limit). Do not promise lower.

**Leak checklist:** timers not cleared, IPC listeners added repeatedly, settings window references kept alive, tray recreated without destroying the old one, large images loaded more than once.

## 16. Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every window.
- Strict CSP in each HTML file: `default-src 'self'; img-src 'self' data:; style-src 'self'`.
- Block navigation and new windows (`will-navigate`, `setWindowOpenHandler` → deny).
- No network calls. No analytics. Local files only.

## 17. Packaging

- `electron-builder.yml`: targets `nsis` (per-user install, `oneClick: true`) and `portable`, `x64` only, `asar: true`.
- Exclude dev files and unused locales (`electronLanguages: ["en-US"]`).
- Output name: `Kiko`.
- Expected size ~80–100 MB (Electron baseline).

## 18. MVP Scope

**Build:**
- Transparent, draggable, always-on-top pet with click-through outside the character
- Idle, walking, reminder, drinking, sleeping animations
- Multiple pets, selectable from tray and settings
- Hourly reminder with speech bubble, pause/resume, custom interval
- Remembers position and settings
- Tray menu, start with Windows, minimal settings window

**Do NOT build now:** Pomodoro, weather, AI assistant, voice, marketplace, simultaneous multiple pets, CPU/RAM widget, any backend.

## 19. Future Extensions (design for, don't implement)

- **Several pets at once:** one window per pet, or a single fullscreen transparent overlay rendering all pets.
- **Custom pets:** user-dropped folders in `userData/pets`, same manifest format.
- **More reminders:** extra jobs in `reminder.js`.
- **Marketplace/AI/weather:** separate optional modules; the core stays offline.

## 20. Development Roadmap

1. **Setup:** project scaffold, single-instance lock, pet window (transparent, topmost, click-through).
2. **Sprites:** manifest loader, CSS sprite animation, IDLE state with a placeholder sheet.
3. **Interaction:** custom drag, position save, screen clamping.
4. **States:** state machine, WALKING with movement timer, SLEEPING.
5. **Reminder:** scheduler, bubble, REMINDER/DRINKING, sound, resume-from-sleep.
6. **Pets:** multi-pet scanning, tray Choose Pet, persistence.
7. **System:** tray menu, settings window, start with Windows.
8. **Polish:** leak audit, RAM/CPU check, packaging (NSIS + portable).

## 21. Definition of Done

- Pet runs with transparent background, stays on top, drags, and clicks pass through outside the character.
- Reminder fires every configured interval, survives sleep/resume, and pause/resume works.
- Switching pets from the tray works instantly and persists after restart.
- No timers running in IDLE other than the reminder and state timeout (verify manually).
- Memory stays stable after several hours of runtime.
- Installer and portable build both produced.
