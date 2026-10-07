const { BrowserWindow } = require('electron');
const path = require('path');

let settingsWin = null;

function openSettingsWindow(options = {}) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return settingsWin;
  }

  settingsWin = new BrowserWindow({
    width: 580,
    height: 760,
    resizable: false,
    maximizable: false,
    title: 'Kiko Settings',
    icon: path.join(__dirname, '../../assets/kiko.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/settingsPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false,
    autoHideMenuBar: true
  });

  settingsWin.loadFile(path.join(__dirname, '../renderer/settings/settings.html'), {
    query: options.showTour ? { tour: '1' } : {}
  });

  settingsWin.once('ready-to-show', () => {
    settingsWin.show();
  });

  settingsWin.on('closed', () => {
    // Crucial for low RAM: release memory when closed
    settingsWin = null;
  });

  return settingsWin;
}

function closeSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.close();
  }
}

function reportTourInteraction(interaction) {
  if (!settingsWin || settingsWin.isDestroyed() || !settingsWin.webContents) return;
  settingsWin.webContents.send('tour-interaction', interaction);
}

function isSettingsWindowSender(sender) {
  return Boolean(settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents === sender);
}

module.exports = {
  openSettingsWindow,
  closeSettingsWindow,
  reportTourInteraction,
  isSettingsWindowSender
};
