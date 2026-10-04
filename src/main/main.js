const { app } = require('electron');
const settings = require('./settings');
const petLoader = require('./petLoader');
const petWindow = require('./petWindow');
const movement = require('./movement');
const reminder = require('./reminder');
const tray = require('./tray');
const ipc = require('./ipc');

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = petWindow.getPetWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    console.log('[Main] Kiko starting up...');

    // 1. Load persisted settings
    settings.loadSettings();

    // 2. Scan available pets in /pets directory
    petLoader.loadAllPets();

    // 3. Register IPC communication channels
    ipc.registerIpcHandlers();

    // 4. Create the main transparent Pet Window
    petWindow.createPetWindow();

    // 5. Initialize System Tray
    tray.createTray();

    // 6. Schedule hydration reminders & power monitor listeners
    reminder.scheduleNextReminder();
    reminder.initPowerMonitor();

    console.log('[Main] App initialization complete.');
  });

  // Keep app running in the background/tray when all windows are closed
  app.on('window-all-closed', (e) => {
    e.preventDefault();
  });

  app.on('before-quit', () => {
    console.log('[Main] Cleaning up before quit...');
    movement.stopWalking();
    reminder.pause();
    tray.destroyTray();
    settings.saveSettingsSync();
  });
}
