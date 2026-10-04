const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (data) => ipcRenderer.invoke('update-settings', data),
  getPetsList: () => ipcRenderer.invoke('get-pets-list'),
  closeWindow: () => ipcRenderer.send('close-settings-window')
});
