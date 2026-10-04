const { Notification, powerMonitor } = require('electron');
const path = require('path');
const settings = require('./settings');
const petLoader = require('./petLoader');
const petWindow = require('./petWindow');

let reminderTimer = null;
let nextDueTimestamp = null;
let pausedRemainingMs = null;

function calculateNextDelay() {
  const currentSettings = settings.get();
  const intervalMinutes = currentSettings.intervalMinutes || 60;
  return intervalMinutes * 60 * 1000;
}

function scheduleNextReminder(delayMs) {
  clearTimer();

  const currentSettings = settings.get();
  if (currentSettings.reminderEnabled === false || currentSettings.paused === true) {
    return;
  }

  const duration = typeof delayMs === 'number' ? delayMs : calculateNextDelay();
  nextDueTimestamp = Date.now() + duration;

  reminderTimer = setTimeout(() => {
    triggerReminder();
  }, duration);
}

function triggerReminder() {
  clearTimer();

  const currentSettings = settings.get();
  if (currentSettings.reminderEnabled === false || currentSettings.paused === true) {
    return;
  }

  const pet = petLoader.getPetById(currentSettings.petId);
  const messages = (pet && pet.manifest && pet.manifest.messages && pet.manifest.messages.length > 0)
    ? pet.manifest.messages
    : ["💧 It's time to drink some water! Stay hydrated! 💧"];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  // 1. Send IPC to Pet Renderer
  const win = petWindow.getPetWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('show-reminder', {
      message: randomMessage,
      sound: currentSettings.sound !== false
    });
  }

  // 2. Optional Windows Native Notification
  if (currentSettings.notification === true && Notification.isSupported()) {
    try {
      const notif = new Notification({
        title: pet ? pet.name : 'Kiko Reminder',
        body: randomMessage,
        icon: path.join(__dirname, '../../assets/tray.ico'),
        silent: true // Pet renderer plays the custom sound if enabled
      });
      notif.show();
    } catch (err) {
      console.error('[Reminder] Failed to show system notification:', err);
    }
  }

  // 3. Schedule next reminder
  scheduleNextReminder();
}

function clearTimer() {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
}

function pause() {
  if (nextDueTimestamp) {
    pausedRemainingMs = Math.max(0, nextDueTimestamp - Date.now());
  }
  clearTimer();
  settings.set({ paused: true });
}

function resume() {
  settings.set({ paused: false });
  const delay = (pausedRemainingMs && pausedRemainingMs > 1000) ? pausedRemainingMs : calculateNextDelay();
  pausedRemainingMs = null;
  scheduleNextReminder(delay);
}

function resetInterval() {
  pausedRemainingMs = null;
  scheduleNextReminder();
}

function initPowerMonitor() {
  powerMonitor.on('resume', () => {
    const currentSettings = settings.get();
    if (currentSettings.reminderEnabled === false || currentSettings.paused === true) return;

    if (nextDueTimestamp && nextDueTimestamp <= Date.now()) {
      // PC was sleeping when reminder expired -> fire ONCE immediately
      triggerReminder();
    } else if (nextDueTimestamp) {
      // Re-arm for the exact remaining duration
      const remaining = Math.max(1000, nextDueTimestamp - Date.now());
      scheduleNextReminder(remaining);
    }
  });
}

module.exports = {
  scheduleNextReminder,
  triggerReminder,
  pause,
  resume,
  resetInterval,
  initPowerMonitor
};
