const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (data) => ipcRenderer.invoke('update-settings', data),
  clearCache: () => ipcRenderer.invoke('clear-app-cache'),
  openGithubProfile: () => ipcRenderer.invoke('open-github-profile'),
  getPetsList: () => ipcRenderer.invoke('get-pets-list'),
  onTourInteraction: (callback) => {
    const handler = (event, interaction) => callback(interaction);
    ipcRenderer.on('tour-interaction', handler);
    return () => ipcRenderer.removeListener('tour-interaction', handler);
  },
  closeWindow: () => ipcRenderer.send('close-settings-window')
});
