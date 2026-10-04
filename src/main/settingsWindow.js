const { BrowserWindow } = require('electron');
const path = require('path');

let settingsWin = null;

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return settingsWin;
  }

  settingsWin = new BrowserWindow({
    width: 540,
    height: 640,
    resizable: false,
    maximizable: false,
    title: 'Kiko Settings',
    icon: path.join(__dirname, '../../assets/tray.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/settingsPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false,
    autoHideMenuBar: true
  });

  settingsWin.loadFile(path.join(__dirname, '../renderer/settings/settings.html'));

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

module.exports = {
  openSettingsWindow,
  closeSettingsWindow
};
