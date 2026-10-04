const { app } = require('electron');
const settings = require('./settings');
const petLoader = require('./petLoader');
const petWindow = require('./petWindow');
const movement = require('./movement');
const pomodoro = require('./pomodoro');
const reminder = require('./reminder');
const tray = require('./tray');
const ipc = require('./ipc');
const settingsWindow = require('./settingsWindow');

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
    const isFirstRun = settings.wasFirstRun();

    // 2. Scan available pets in /pets directory
    petLoader.loadAllPets();

    // 3. Register IPC communication channels
    ipc.registerIpcHandlers();

    // 4. Create the main transparent Pet Window
    petWindow.createPetWindow();

    // 5. Initialize the system tray and show onboarding on a fresh install.
    tray.createTray();
    if (isFirstRun) settingsWindow.openSettingsWindow();

    // 6. Schedule hydration reminders & power monitor listeners
    reminder.scheduleNextReminder();
    reminder.initPowerMonitor();
    pomodoro.startSavedSession();

    console.log('[Main] App initialization complete.');
  });

  // Keep app running in the background/tray when all windows are closed
  app.on('window-all-closed', (e) => {
    e.preventDefault();
  });

  app.on('before-quit', () => {
    console.log('[Main] Cleaning up before quit...');
    movement.stopWalking();
    pomodoro.shutdown();
    reminder.pause();
    tray.destroyTray();
    settings.saveSettingsSync();
  });
}
