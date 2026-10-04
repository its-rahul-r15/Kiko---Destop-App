const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesApi', {
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (notes) => ipcRenderer.invoke('save-notes', notes),
  saveNotesBeforeClose: (notes) => ipcRenderer.sendSync('save-notes-before-close', notes),
  closeWindow: () => ipcRenderer.send('close-notes-window')
});
