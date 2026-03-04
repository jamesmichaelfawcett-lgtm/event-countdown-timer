const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("timerAPI", {
  getState: () => ipcRenderer.invoke("state:get"),
  start: () => ipcRenderer.invoke("timer:start"),
  pause: () => ipcRenderer.invoke("timer:pause"),
  reset: () => ipcRenderer.invoke("timer:reset"),
  adjustTime: (seconds) => ipcRenderer.invoke("timer:adjustTime", seconds),
  selectSession: (index) => ipcRenderer.invoke("session:select", index),
  addSession: (session) => ipcRenderer.invoke("session:add", session),
  updateSession: (index, updates) => ipcRenderer.invoke("session:update", { index, updates }),
  deleteSession: (index) => ipcRenderer.invoke("session:delete", index),
  moveSession: (fromIndex, toIndex) => ipcRenderer.invoke("session:move", { fromIndex, toIndex }),
  setMessage: (message, show) => ipcRenderer.invoke("message:set", { message, show }),
  updateSettings: (updates) => ipcRenderer.invoke("settings:update", updates),
  toggleFullscreen: () => ipcRenderer.invoke("display:toggleFullscreen"),
  toggleBlackout: () => ipcRenderer.invoke("display:blackout"),
  getDisplays: () => ipcRenderer.invoke("display:getDisplays"),
  moveToDisplay: (id) => ipcRenderer.invoke("display:moveToDisplay", id),
  onStateUpdate: (callback) => {
    ipcRenderer.on("state:update", (_, state) => callback(state));
  },
});
