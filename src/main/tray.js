const { Tray, Menu, app } = require('electron');
const path = require('path');
const settings = require('./settings');
const petLoader = require('./petLoader');
const petWindow = require('./petWindow');
const movement = require('./movement');
const pomodoro = require('./pomodoro');
const reminder = require('./reminder');
const settingsWindow = require('./settingsWindow');

let tray = null;
let isPetHidden = false;

function getTrayIconPath() {
  return path.join(__dirname, '../../assets/kiko.ico');
}

function updateTrayMenu() {
  if (!tray) return;

  const currentSettings = settings.get();
  const allPets = petLoader.getAllPets();
  const intervals = [15, 30, 45, 60, 90, 120];

  const petMenuItems = allPets.map(p => ({
    label: p.name,
    type: 'radio',
    checked: p.id === currentSettings.petId,
    click: () => {
      settings.set({ petId: p.id });
      petWindow.sendCurrentPetToRenderer();
      updateTrayMenu();
    }
  }));

  const intervalMenuItems = intervals.map(mins => ({
    label: `${mins} Minutes`,
    type: 'radio',
    checked: currentSettings.intervalMinutes === mins,
    click: () => {
      settings.set({ intervalMinutes: mins });
      reminder.resetInterval();
      updateTrayMenu();
    }
  }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: currentSettings.paused ? '▶ Resume Reminder' : '⏸ Pause Reminder',
      click: () => {
        if (currentSettings.paused) {
          reminder.resume();
        } else {
          reminder.pause();
        }
        updateTrayMenu();
      }
    },
    {
      label: '⏱ Interval',
      submenu: intervalMenuItems
    },
    {
      label: '🎭 Choose Pet',
      submenu: petMenuItems
    },
    { type: 'separator' },
    {
      label: '📌 Always on Top',
      type: 'checkbox',
      checked: currentSettings.alwaysOnTop !== false,
      click: (menuItem) => {
        settings.set({ alwaysOnTop: menuItem.checked });
        petWindow.setAlwaysOnTop(menuItem.checked);
      }
    },
    {
      label: '🚶 Movement Enabled',
      type: 'checkbox',
      checked: currentSettings.movementEnabled !== false,
      click: (menuItem) => {
        settings.set({ movementEnabled: menuItem.checked });
        if (!menuItem.checked) movement.stopWalking();
        const win = petWindow.getPetWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('set-movement', {
            enabled: menuItem.checked,
            intervalSeconds: currentSettings.movementIntervalSeconds
          });
        }
      }
    },
    {
      label: currentSettings.pomodoroEnabled ? '⏹ Stop Pomodoro' : '🍅 Start Pomodoro',
      click: () => {
        if (settings.get('pomodoroEnabled')) pomodoro.stop();
        else pomodoro.start();
        updateTrayMenu();
      }
    },
    {
      label: '🔔 Sound Alert',
      type: 'checkbox',
      checked: currentSettings.sound !== false,
      click: (menuItem) => {
        settings.set({ sound: menuItem.checked });
      }
    },
    { type: 'separator' },
    {
      label: '⚙ Settings...',
      click: () => settingsWindow.openSettingsWindow()
    },
    {
      label: isPetHidden ? '👁 Show Pet' : '🙈 Hide Pet',
      click: () => togglePetVisibility()
    },
    { type: 'separator' },
    {
      label: '❌ Exit',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function togglePetVisibility() {
  const win = petWindow.getPetWindow();
  if (!win || win.isDestroyed()) return;

  if (isPetHidden) {
    win.show();
    isPetHidden = false;
  } else {
    win.hide();
    isPetHidden = true;
  }
  updateTrayMenu();
}

function createTray() {
  if (tray) return tray;

  const iconPath = getTrayIconPath();
  tray = new Tray(iconPath);
  tray.setToolTip('Kiko');

  tray.on('double-click', () => {
    togglePetVisibility();
  });

  updateTrayMenu();
  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  createTray,
  updateTrayMenu,
  destroyTray,
  togglePetVisibility
};
