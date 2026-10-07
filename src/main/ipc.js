const { ipcMain, app, shell } = require('electron');
const { pathToFileURL } = require('url');
const settings = require('./settings');
const petLoader = require('./petLoader');
const petWindow = require('./petWindow');
const movement = require('./movement');
const pomodoro = require('./pomodoro');
const reminder = require('./reminder');
const tray = require('./tray');
const settingsWindow = require('./settingsWindow');
const notesStore = require('./notesStore');
const notesWindow = require('./notesWindow');

function validateNotes(value) {
  if (!Array.isArray(value) || value.length > 50) {
    throw new Error('Notes must be a list of up to 50 items.');
  }

  const ids = new Set();
  return value.map((note) => {
    if (!note || typeof note !== 'object' || Array.isArray(note)) {
      throw new Error('Each note must be an object.');
    }
    if (typeof note.id !== 'string' || !/^[\w-]{1,64}$/.test(note.id) || ids.has(note.id)) {
      throw new Error('Each note must have a unique, valid ID.');
    }
    if (typeof note.title !== 'string' || note.title.length > 80) {
      throw new Error('Note titles must be 80 characters or fewer.');
    }
    if (typeof note.content !== 'string' || note.content.length > 5000) {
      throw new Error('Note text must be 5,000 characters or fewer.');
    }
    const size = note.size === undefined ? 'medium' : note.size;
    if (!['small', 'medium', 'large'].includes(size)) {
      throw new Error('Note size must be small, medium, or large.');
    }
    const todos = note.todos === undefined ? [] : note.todos;
    if (!Array.isArray(todos) || todos.length > 100) {
      throw new Error('Each note can contain up to 100 tasks.');
    }
    const todoIds = new Set();
    const validatedTodos = todos.map((todo) => {
      if (!todo || typeof todo !== 'object' || Array.isArray(todo)
        || typeof todo.id !== 'string' || !/^[\w-]{1,64}$/.test(todo.id) || todoIds.has(todo.id)
        || typeof todo.text !== 'string' || todo.text.trim().length === 0 || todo.text.length > 160
        || typeof todo.completed !== 'boolean') {
        throw new Error('Each task must have a unique ID, text, and completion state.');
      }
      todoIds.add(todo.id);
      return { id: todo.id, text: todo.text, completed: todo.completed };
    });
    ids.add(note.id);
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      size,
      todos: validatedTodos
    };
  });
}

function requireNotesWindow(event) {
  if (!notesWindow.isNotesWindowSender(event.sender)) {
    throw new Error('Notes can only be accessed from the Notes window.');
  }
}

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

  ipcMain.on('open-notes-window', (event) => {
    const petWin = petWindow.getPetWindow();
    if (!petWin || petWin.isDestroyed() || petWin.webContents !== event.sender) {
      console.error('[IPC] Ignored an open-notes request from an untrusted window.');
      return;
    }
    notesWindow.openNotesWindow();
  });

  ipcMain.on('snooze-reminder', (event) => {
    if (!petWindow.isPetWindowSender(event.sender)) {
      console.error('[IPC] Ignored a snooze request from an untrusted window.');
      return;
    }
    reminder.snooze();
  });

  ipcMain.on('pet-tour-interaction', (event, interaction) => {
    if (!petWindow.isPetWindowSender(event.sender)
      || !['click', 'double-click', 'drag'].includes(interaction)) {
      return;
    }
    settingsWindow.reportTourInteraction(interaction);
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

  ipcMain.handle('clear-app-cache', async (event) => {
    if (!settingsWindow.isSettingsWindowSender(event.sender)) {
      throw new Error('Only the Settings window can clear the app cache.');
    }
    await event.sender.session.clearCache();
    return { success: true };
  });

  ipcMain.handle('open-github-profile', async (event) => {
    if (!settingsWindow.isSettingsWindowSender(event.sender)) {
      throw new Error('Only the Settings window can open the GitHub profile.');
    }
    await shell.openExternal('https://github.com/its-rahul-r15');
    return { success: true };
  });

  ipcMain.handle('get-pets-list', () => {
    return petLoader.getAllPets().map(p => ({
      id: p.id,
      name: p.name,
      manifest: p.manifest,
      imageUrl: pathToFileURL(p.imagePath).href
    }));
  });

  ipcMain.handle('get-notes', (event) => {
    requireNotesWindow(event);
    return validateNotes(notesStore.loadNotes());
  });

  ipcMain.handle('save-notes', (event, value) => {
    requireNotesWindow(event);
    return { success: true, notes: notesStore.saveNotes(validateNotes(value)) };
  });

  ipcMain.on('save-notes-before-close', (event, value) => {
    if (!notesWindow.isNotesWindowSender(event.sender)) {
      console.error('[IPC] Ignored a notes save request from an untrusted window.');
      event.returnValue = { success: false, error: 'Untrusted notes window.' };
      return;
    }
    try {
      notesStore.saveNotes(validateNotes(value));
      event.returnValue = { success: true };
    } catch (error) {
      console.error('[IPC] Failed to save notes before closing:', error);
      event.returnValue = { success: false, error: error.message };
    }
  });

  ipcMain.on('close-notes-window', (event) => {
    if (notesWindow.isNotesWindowSender(event.sender)) {
      notesWindow.closeNotesWindow();
    }
  });

  ipcMain.handle('update-settings', (event, newSettings) => {
    if (!newSettings || typeof newSettings !== 'object') {
      return { success: false, error: 'Invalid payload' };
    }

    const previous = settings.get();
    if (newSettings.selectedOutfit !== undefined) {
      const allowedOutfits = ['classic', 'shadow', 'neon'];
      if (!allowedOutfits.includes(newSettings.selectedOutfit)
        || !Array.isArray(previous.unlockedOutfits)
        || !previous.unlockedOutfits.includes(newSettings.selectedOutfit)) {
        return { success: false, error: 'That look is not unlocked yet' };
      }
    }
    const boundedSettings = { ...newSettings };
    if (boundedSettings.customReminderMessage !== undefined) {
      if (typeof boundedSettings.customReminderMessage !== 'string') {
        return { success: false, error: 'Reminder message must be text' };
      }
      boundedSettings.customReminderMessage = boundedSettings.customReminderMessage.trim();
      if (boundedSettings.customReminderMessage.length > 120) {
        return { success: false, error: 'Reminder message must be 120 characters or fewer' };
      }
    }
    if (boundedSettings.movementIntervalSeconds !== undefined) {
      const value = Number(boundedSettings.movementIntervalSeconds);
      if (!Number.isFinite(value)) return { success: false, error: 'Invalid movement interval' };
      boundedSettings.movementIntervalSeconds = Math.max(10, Math.min(Math.round(value), 60));
    }
    if (boundedSettings.jumpHeight !== undefined) {
      const value = Number(boundedSettings.jumpHeight);
      if (!Number.isFinite(value)) return { success: false, error: 'Invalid jump height' };
      boundedSettings.jumpHeight = Math.max(0, Math.min(Math.round(value), 100));
    }
    if (boundedSettings.climbEveryWalks !== undefined) {
      const value = Number(boundedSettings.climbEveryWalks);
      if (![1, 2, 3, 5].includes(value)) return { success: false, error: 'Invalid climbing frequency' };
      boundedSettings.climbEveryWalks = value;
    }
    for (const [key, allowedValues] of [
      ['pomodoroFocusMinutes', [15, 25, 45, 50]],
      ['pomodoroBreakMinutes', [5, 10, 15]]
    ]) {
      if (boundedSettings[key] === undefined) continue;
      const value = Number(boundedSettings[key]);
      if (!allowedValues.includes(value)) return { success: false, error: `Invalid ${key}` };
      boundedSettings[key] = value;
    }
    const updated = settings.set(boundedSettings);

    // Apply side effects
    if (boundedSettings.startWithWindows !== undefined) {
      try {
        app.setLoginItemSettings({
          openAtLogin: Boolean(boundedSettings.startWithWindows)
        });
      } catch (err) {
        console.error('[IPC] Failed to set login item settings:', err);
      }
    }

    if (boundedSettings.alwaysOnTop !== undefined) {
      petWindow.setAlwaysOnTop(Boolean(boundedSettings.alwaysOnTop));
    }

    if (boundedSettings.petId !== undefined && boundedSettings.petId !== previous.petId) {
      petWindow.sendCurrentPetToRenderer();
    }
    if (boundedSettings.selectedOutfit !== undefined && boundedSettings.selectedOutfit !== previous.selectedOutfit) {
      petWindow.sendCurrentPetToRenderer();
    }

    if (boundedSettings.scale !== undefined && boundedSettings.scale !== previous.scale) {
      petWindow.applyScale(boundedSettings.scale);
    } else if (boundedSettings.animationSpeed !== undefined) {
      petWindow.sendCurrentPetToRenderer();
    }

    if (boundedSettings.intervalMinutes !== undefined && boundedSettings.intervalMinutes !== previous.intervalMinutes) {
      reminder.resetInterval();
    }

    if (boundedSettings.movementEnabled !== undefined && boundedSettings.movementEnabled !== previous.movementEnabled) {
      if (!updated.movementEnabled) movement.stopWalking();
      const win = petWindow.getPetWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('set-movement', {
          enabled: Boolean(updated.movementEnabled),
          intervalSeconds: updated.movementIntervalSeconds
        });
      }
    } else if (
      boundedSettings.movementIntervalSeconds !== undefined
      || boundedSettings.jumpHeight !== undefined
      || boundedSettings.climbEveryWalks !== undefined
    ) {
      const win = petWindow.getPetWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('set-movement', {
          enabled: updated.movementEnabled !== false,
          intervalSeconds: updated.movementIntervalSeconds
        });
      }
    }

    if (boundedSettings.pomodoroEnabled !== undefined && boundedSettings.pomodoroEnabled !== previous.pomodoroEnabled) {
      if (updated.pomodoroEnabled) pomodoro.start();
      else pomodoro.stop();
    } else if (updated.pomodoroEnabled) {
      const activeDurationKey = updated.pomodoroPhase === 'break'
        ? 'pomodoroBreakMinutes'
        : 'pomodoroFocusMinutes';
      if (boundedSettings[activeDurationKey] !== undefined) {
        pomodoro.restartCurrentPhase();
      }
    }

    if (boundedSettings.reminderEnabled !== undefined || boundedSettings.paused !== undefined) {
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
