const { ipcMain, app } = require('electron');
const { pathToFileURL } = require('url');
const settings = require('./settings');
const petLoader = require('./petLoader');
const petWindow = require('./petWindow');
const movement = require('./movement');
const reminder = require('./reminder');
const tray = require('./tray');
const settingsWindow = require('./settingsWindow');

function registerIpcHandlers() {
  // Renderer to Main: Pet Interaction
  ipcMain.on('drag-delta', (event, { dx, dy }) => {
    if (typeof dx === 'number' && typeof dy === 'number') {
      petWindow.updateWindowPositionDelta(dx, dy);
    }
  });

  ipcMain.on('drag-end', () => {
    petWindow.saveFinalPosition();
  });

  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    petWindow.setWindowIgnoreMouse(Boolean(ignore));
  });

  ipcMain.on('walk-start', (event, { direction }) => {
    movement.startWalking(direction);
  });

  ipcMain.on('walk-stop', () => {
    movement.stopWalking();
  });

  ipcMain.handle('get-pet-initial-state', () => {
    const currentSettings = settings.get();
    const pet = petLoader.getPetById(currentSettings.petId);
    return {
      pet: pet ? {
        manifest: pet.manifest,
        imageUrl: pathToFileURL(pet.imagePath).href
      } : null,
      settings: currentSettings
    };
  });

  // Settings UI Handlers
  ipcMain.handle('get-settings', () => {
    return settings.get();
  });

  ipcMain.handle('get-pets-list', () => {
    return petLoader.getAllPets().map(p => ({
      id: p.id,
      name: p.name,
      manifest: p.manifest,
      imageUrl: pathToFileURL(p.imagePath).href
    }));
  });

  ipcMain.handle('update-settings', (event, newSettings) => {
    if (!newSettings || typeof newSettings !== 'object') {
      return { success: false, error: 'Invalid payload' };
    }

    const previous = settings.get();
    const updated = settings.set(newSettings);

    // Apply side effects
    if (newSettings.startWithWindows !== undefined) {
      try {
        app.setLoginItemSettings({
          openAtLogin: Boolean(newSettings.startWithWindows)
        });
      } catch (err) {
        console.error('[IPC] Failed to set login item settings:', err);
      }
    }

    if (newSettings.alwaysOnTop !== undefined) {
      petWindow.setAlwaysOnTop(Boolean(newSettings.alwaysOnTop));
    }

    if (newSettings.petId !== undefined && newSettings.petId !== previous.petId) {
      petWindow.sendCurrentPetToRenderer();
    }

    if (newSettings.scale !== undefined && newSettings.scale !== previous.scale) {
      petWindow.applyScale(newSettings.scale);
    } else if (newSettings.animationSpeed !== undefined) {
      petWindow.sendCurrentPetToRenderer();
    }

    if (newSettings.intervalMinutes !== undefined && newSettings.intervalMinutes !== previous.intervalMinutes) {
      reminder.resetInterval();
    }

    if (newSettings.reminderEnabled !== undefined || newSettings.paused !== undefined) {
      if (updated.reminderEnabled && !updated.paused) {
        reminder.resume();
      } else {
        reminder.pause();
      }
    }

    tray.updateTrayMenu();
    return { success: true, settings: updated };
  });

  ipcMain.on('close-settings-window', () => {
    settingsWindow.closeSettingsWindow();
  });
}

module.exports = {
  registerIpcHandlers
};
