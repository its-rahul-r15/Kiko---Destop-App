const { BrowserWindow } = require('electron');
const path = require('path');

let notesWin = null;

function openNotesWindow() {
  if (notesWin && !notesWin.isDestroyed()) {
    if (notesWin.isMinimized()) notesWin.restore();
    notesWin.show();
    notesWin.focus();
    return notesWin;
  }

  notesWin = new BrowserWindow({
    width: 840,
    height: 620,
    minWidth: 520,
    minHeight: 420,
    title: 'Kiko Notes',
    icon: path.join(__dirname, '../../assets/kiko.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/notesPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false,
    autoHideMenuBar: true
  });

  notesWin.webContents.on('will-navigate', (event) => event.preventDefault());
  notesWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  notesWin.loadFile(path.join(__dirname, '../renderer/notes/notes.html'));
  notesWin.once('ready-to-show', () => notesWin.show());
  notesWin.on('closed', () => {
    notesWin = null;
  });

  return notesWin;
}

function isNotesWindowSender(sender) {
  return Boolean(notesWin && !notesWin.isDestroyed() && notesWin.webContents === sender);
}

function closeNotesWindow() {
  if (notesWin && !notesWin.isDestroyed()) notesWin.close();
}

module.exports = {
  openNotesWindow,
  isNotesWindowSender,
  closeNotesWindow
};
