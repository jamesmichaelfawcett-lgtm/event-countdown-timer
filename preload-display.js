const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('displayAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  onStateUpdate: (callback) => {
    ipcRenderer.on('state:update', (_, state) => callback(state));
  },
});
