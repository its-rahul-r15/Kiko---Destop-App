const { BrowserWindow, Menu, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const settings = require('./settings');
const petLoader = require('./petLoader');
const settingsWindow = require('./settingsWindow');

const BASE_W = 220;
const BASE_H = 260;
const MIN_VISIBLE = 60; // px of window that must stay on some display

let petWin = null;
let size = { width: BASE_W, height: BASE_H };

const alive = () => petWin && !petWin.isDestroyed();

/* ---------- geometry helpers ---------- */

function getSize() {
  return { ...size };
}

function sizeForScale(scale) {
  const s = Math.min(Math.max(Number(scale) || 1, 0.5), 2);
  return { width: Math.round(BASE_W * s), height: Math.round(BASE_H * s) };
}

function defaultPosition() {
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    x: wa.x + wa.width - size.width - 40,
    y: wa.y + wa.height - size.height - 20
  };
}

// true if enough of the rect is visible on at least one display
function isVisibleOnAnyDisplay(rect) {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const w = Math.min(rect.x + rect.width, a.x + a.width) - Math.max(rect.x, a.x);
    const h = Math.min(rect.y + rect.height, a.y + a.height) - Math.max(rect.y, a.y);
    return w >= MIN_VISIBLE && h >= MIN_VISIBLE;
  });
}

// always clamps inside the work area of the display the window mostly sits on
function clampToWorkArea(x, y) {
  const display = screen.getDisplayMatching({ x, y, ...size });
  const a = display.workArea;
  return {
    x: Math.round(Math.min(Math.max(x, a.x), a.x + a.width - size.width)),
    y: Math.round(Math.min(Math.max(y, a.y), a.y + a.height - size.height))
  };
}

function positionAtTop(position) {
  const display = screen.getDisplayMatching({ ...position, ...size });
  return clampToWorkArea(position.x, display.workArea.y);
}

// only used at startup / when displays change
function resolveStartPosition(saved) {
  if (!saved || !isVisibleOnAnyDisplay({ x: saved.x, y: saved.y, ...size })) {
    return defaultPosition();
  }
  return clampToWorkArea(saved.x, saved.y);
}

/* ---------- window ---------- */

function onDisplayChange() {
  if (!alive()) return;
  const b = petWin.getBounds();
  const pos = isVisibleOnAnyDisplay(b) ? clampToWorkArea(b.x, b.y) : defaultPosition();
  petWin.setBounds({ ...pos, ...size });
}

function createPetWindow() {
  if (alive()) return petWin;

  const cfg = settings.get();
  size = sizeForScale(cfg.scale);
  const savedPos = resolveStartPosition(cfg.position);
  const pos = cfg.petId === 'spiderman' ? positionAtTop(savedPos) : savedPos;
  const onTop = cfg.alwaysOnTop !== false;

  petWin = new BrowserWindow({
    ...size,
    ...pos,
    transparent: true,
    frame: false,
    thickFrame: false, // no resize border/snap artifacts on transparent windows (Windows)
    hasShadow: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    icon: path.join(__dirname, '../../assets/kiko.ico'),
    alwaysOnTop: onTop,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true // lets Chromium throttle when hidden
    }
  });

  if (onTop) petWin.setAlwaysOnTop(true, 'screen-saver');
  petWin.setIgnoreMouseEvents(true, { forward: true });

  // security
  petWin.webContents.on('will-navigate', (e) => e.preventDefault());
  petWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  petWin.webContents.on('context-menu', (event) => {
    event.preventDefault();
    if (!alive()) return;

    Menu.buildFromTemplate([
      {
        label: 'Open Settings...',
        click: () => settingsWindow.openSettingsWindow()
      }
    ]).popup({ window: petWin });
  });

  petWin.loadFile(path.join(__dirname, '../renderer/pet/pet.html'));

  // renderer listeners are registered by now, so the first set-pet is never missed
  petWin.webContents.once('did-finish-load', sendCurrentPetToRenderer);
  petWin.once('ready-to-show', () => petWin.showInactive()); // don't steal focus

  screen.on('display-removed', onDisplayChange);
  screen.on('display-metrics-changed', onDisplayChange);

  petWin.on('closed', () => {
    screen.removeListener('display-removed', onDisplayChange);
    screen.removeListener('display-metrics-changed', onDisplayChange);
    petWin = null;
  });

  return petWin;
}

function getPetWindow() {
  return petWin;
}

function sendCurrentPetToRenderer() {
  if (!alive()) return;

  const cfg = settings.get();
  const pet = petLoader.getPetById(cfg.petId);
  if (!pet) return;

  if (cfg.petId === 'spiderman') {
    const bounds = petWin.getBounds();
    const topPosition = positionAtTop(bounds);
    if (bounds.y !== topPosition.y) {
      petWin.setBounds({ ...topPosition, ...size });
    }
  }

  petWin.webContents.send('set-pet', {
    manifest: pet.manifest,
    imageUrl: pathToFileURL(pet.imagePath).href,
    scale: cfg.scale || 1.0,
    speed: cfg.animationSpeed || 1.0,
    outfit: cfg.selectedOutfit || 'classic'
  });
  const bounds = petWin.getBounds();
  const display = screen.getDisplayMatching(bounds);
  petWin.webContents.send('set-pet-at-top', bounds.y <= display.workArea.y);
}

/* ---------- movement / drag ---------- */

// setBounds with a fixed size avoids the Windows DPI size-drift bug of setPosition on transparent windows
function moveTo(x, y) {
  if (!alive()) return;
  const p = clampToWorkArea(x, y);
  petWin.setBounds({ ...p, ...size });
}

function updateWindowPositionDelta(dx, dy) {
  if (!alive()) return;
  const { x, y } = petWin.getBounds();
  moveTo(x + dx, y + dy);
}

function saveFinalPosition() {
  if (!alive()) return;
  const { x, y } = petWin.getBounds();
  const p = clampToWorkArea(x, y);
  petWin.setBounds({ ...p, ...size });
  settings.set({ position: p });
  const display = screen.getDisplayMatching({ ...p, ...size });
  petWin.webContents.send('set-pet-at-top', p.y <= display.workArea.y);
}

/* ---------- settings-driven ---------- */

function applyScale(scale) {
  if (!alive()) return;
  const b = petWin.getBounds();
  const next = sizeForScale(scale);
  // keep the pet's bottom-center where it was
  const x = b.x + Math.round((b.width - next.width) / 2);
  const y = b.y + (b.height - next.height);
  size = next;
  const p = clampToWorkArea(x, y);
  petWin.setBounds({ ...p, ...size });
  settings.set({ scale, position: p });
  sendCurrentPetToRenderer();
}

function setWindowIgnoreMouse(ignore) {
  if (!alive()) return;
  petWin.setIgnoreMouseEvents(!!ignore, { forward: true });
}

function setAlwaysOnTop(enabled) {
  if (!alive()) return;
  petWin.setAlwaysOnTop(!!enabled, enabled ? 'screen-saver' : 'normal');
}

function showPet() {
  if (alive() && !petWin.isVisible()) petWin.showInactive();
}

function hidePet() {
  if (alive() && petWin.isVisible()) petWin.hide();
}

module.exports = {
  createPetWindow,
  getPetWindow,
  sendCurrentPetToRenderer,
  moveTo,
  updateWindowPositionDelta,
  saveFinalPosition,
  setWindowIgnoreMouse,
  setAlwaysOnTop,
  applyScale,
  showPet,
  hidePet,
  getSize,
  clampToWorkArea
};