const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onSetPet: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('set-pet', handler);
    return () => ipcRenderer.removeListener('set-pet', handler);
  },
  onShowReminder: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('show-reminder', handler);
    return () => ipcRenderer.removeListener('show-reminder', handler);
  },
  onSetMovement: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('set-movement', handler);
    return () => ipcRenderer.removeListener('set-movement', handler);
  },
  onWalkFinished: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('walk-finished', handler);
    return () => ipcRenderer.removeListener('walk-finished', handler);
  },
  onSetPetAtTop: (callback) => {
    const handler = (event, atTop) => callback(atTop);
    ipcRenderer.on('set-pet-at-top', handler);
    return () => ipcRenderer.removeListener('set-pet-at-top', handler);
  },
  onSetDirection: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('set-direction', handler);
    return () => ipcRenderer.removeListener('set-direction', handler);
  },
  onPomodoroUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('pomodoro-update', handler);
    return () => ipcRenderer.removeListener('pomodoro-update', handler);
  },
  startWalk: (direction) => ipcRenderer.send('walk-start', { direction }),
  stopWalk: () => ipcRenderer.send('walk-stop'),
  sendDragDelta: (dx, dy) => ipcRenderer.send('drag-delta', { dx, dy }),
  sendDragEnd: () => ipcRenderer.send('drag-end'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  openNotes: () => ipcRenderer.send('open-notes-window'),
  getInitialState: () => ipcRenderer.invoke('get-pet-initial-state')
});
