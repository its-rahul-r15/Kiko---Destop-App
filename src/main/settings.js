const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_SETTINGS = {
  customReminderMessage: 'Take a little water break — you’ve got this! 💧',
  petId: 'ironman',
  position: { x: 100, y: 500 },
  alwaysOnTop: true,
  movementEnabled: true,
  startWithWindows: false,
  reminderEnabled: true,
  intervalMinutes: 60,
  paused: false,
  sound: true,
  notification: false,
  scale: 1.0,
  animationSpeed: 1.0,
  movementIntervalSeconds: 25,
  jumpHeight: 50,
  climbEveryWalks: 2,
  pomodoroEnabled: false,
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroPhase: 'focus',
  pomodoroEndsAt: null,
  pomodoroSessions: 0,
  dailyStreak: 0,
  lastActiveDate: '',
  unlockedOutfits: ['classic'],
  selectedOutfit: 'classic'
};

let settingsData = { ...DEFAULT_SETTINGS };
let settingsFilePath = '';
let writeTimeout = null;
let firstRun = false;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function recordDailyUse() {
  const today = localDateKey();
  if (settingsData.lastActiveDate === today) return;

  let streak = 1;
  if (settingsData.lastActiveDate) {
    const [year, month, day] = settingsData.lastActiveDate.split('-').map(Number);
    const lastActive = Date.UTC(year, month - 1, day);
    const [currentYear, currentMonth, currentDayOfMonth] = today.split('-').map(Number);
    const currentDay = Date.UTC(currentYear, currentMonth - 1, currentDayOfMonth);
    if (currentDay - lastActive === 24 * 60 * 60 * 1000) {
      streak = (Number(settingsData.dailyStreak) || 0) + 1;
    }
  }

  const unlockedOutfits = Array.isArray(settingsData.unlockedOutfits)
    ? [...settingsData.unlockedOutfits]
    : ['classic'];
  if (streak >= 3 && !unlockedOutfits.includes('shadow')) unlockedOutfits.push('shadow');
  if (streak >= 7 && !unlockedOutfits.includes('neon')) unlockedOutfits.push('neon');

  settingsData = {
    ...settingsData,
    dailyStreak: streak,
    lastActiveDate: today,
    unlockedOutfits,
    selectedOutfit: unlockedOutfits.includes(settingsData.selectedOutfit) ? settingsData.selectedOutfit : 'classic'
  };
  saveSettingsSync();
}

function getSettingsPath() {
  if (!settingsFilePath) {
    settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
  }
  return settingsFilePath;
}

function loadSettings() {
  const filePath = getSettingsPath();
  try {
    firstRun = !fs.existsSync(filePath);
    if (!firstRun) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      // Merge with defaults so new keys never break old configs
      settingsData = { ...DEFAULT_SETTINGS, ...parsed };
      if (typeof settingsData.customReminderMessage !== 'string') {
        settingsData.customReminderMessage = DEFAULT_SETTINGS.customReminderMessage;
      } else {
        settingsData.customReminderMessage = settingsData.customReminderMessage.slice(0, 120);
      }
      if (!Array.isArray(settingsData.notes)) {
        settingsData.notes = [];
      }
      if (parsed.position && typeof parsed.position.x === 'number' && typeof parsed.position.y === 'number') {
        settingsData.position = { x: parsed.position.x, y: parsed.position.y };
      }
    } else {
      settingsData = { ...DEFAULT_SETTINGS };
      saveSettingsSync();
    }
  } catch (err) {
    console.error('[Settings] Failed to parse settings.json, falling back to defaults:', err);
    settingsData = { ...DEFAULT_SETTINGS };
    firstRun = false;
  }
  recordDailyUse();
  return settingsData;
}

function wasFirstRun() {
  return firstRun;
}

function saveSettingsSync() {
  try {
    const filePath = getSettingsPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(settingsData, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Settings] Failed to save settings synchronously:', err);
  }
}

function saveSettingsDebounced() {
  if (writeTimeout) {
    clearTimeout(writeTimeout);
  }
  writeTimeout = setTimeout(() => {
    try {
      const filePath = getSettingsPath();
      fs.promises.writeFile(filePath, JSON.stringify(settingsData, null, 2), 'utf-8')
        .catch(err => console.error('[Settings] Error writing settings.json:', err));
    } catch (err) {
      console.error('[Settings] Failed to schedule settings save:', err);
    }
  }, 500);
}

function get(key) {
  recordDailyUse();
  if (key) {
    return settingsData[key];
  }
  return { ...settingsData };
}

function set(newValues) {
  if (typeof newValues !== 'object' || newValues === null) return settingsData;
  settingsData = { ...settingsData, ...newValues };
  saveSettingsDebounced();
  return settingsData;
}

module.exports = {
  loadSettings,
  get,
  set,
  saveSettingsSync,
  wasFirstRun,
  DEFAULT_SETTINGS
};
