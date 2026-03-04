const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let controlWindow = null;
let displayWindow = null;
let timerInterval = null;

let state = {
  sessions: [
    { id: 1, name: 'Opening Keynote', duration: 1800 },
    { id: 2, name: 'Coffee Break', duration: 600 },
    { id: 3, name: 'Panel Discussion', duration: 2700 },
  ],
  currentSessionIndex: 0,
  timeRemaining: 1800,
  isRunning: false,
  isCountingUp: false,
  countUpTime: 0,
  message: '',
  showMessage: false,
  blackout: false,
  settings: {
    fontFamily: 'Orbitron',
    fontSize: 160,
    titleFontSize: 52,
    greenBg: '#000000',
    amberBg: '#000000',
    redBg: '#000000',
    greenText: '#00e676',
    amberText: '#ffab00',
    redText: '#ff1744',
    amberThreshold: 300,
    redThreshold: 60,
    countUpEnabled: true,
    progressBarEnabled: true,
    messageTextColor: '#ffffff',
    messageBgColor: 'rgba(0,0,0,0.75)',
    glowEnabled: true,
    trafficLightEnabled: false,
    flashEnabled: true,
    flashThreshold: 10,
    flashSpeed: 0.8,
    gridEnabled: false,
    selectedDisplayId: null,
  }
};

function getTargetDisplay() {
  const displays = screen.getAllDisplays();
  if (state.settings.selectedDisplayId) {
    const found = displays.find(d => d.id === state.settings.selectedDisplayId);
    if (found) return found;
  }
  return screen.getPrimaryDisplay();
}

function createWindows() {
  const targetDisplay = getTargetDisplay();

  displayWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-display.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#000000',
    title: 'Event Timer Display',
    frame: false,
  });
  displayWindow.loadFile('display.html');

  controlWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d0d1a',
    title: 'Event Timer Control Panel',
    show: false,
  });
  controlWindow.loadFile('control.html');
  controlWindow.once('ready-to-show', () => controlWindow.show());
  controlWindow.on('closed', () => app.quit());
}

app.whenReady().then(createWindows);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function getPhase() {
  if (state.isCountingUp) return 'red';
  if (state.timeRemaining <= state.settings.redThreshold) return 'red';
  if (state.timeRemaining <= state.settings.amberThreshold) return 'amber';
  return 'green';
}

function getProgress() {
  const session = state.sessions[state.currentSessionIndex];
  if (!session || session.duration === 0 || state.isCountingUp) return 0;
  return state.timeRemaining / session.duration;
}

function buildFullState() {
  return {
    ...state,
    phase: getPhase(),
    progress: getProgress(),
    currentSession: state.sessions[state.currentSessionIndex] || null,
  };
}

function broadcast() {
  const fullState = buildFullState();
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('state:update', fullState);
  }
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('state:update', fullState);
  }
}

function tick() {
  if (state.isCountingUp) {
    state.countUpTime++;
    broadcast();
    return;
  }
  if (state.timeRemaining > 0) {
    state.timeRemaining--;
  }
  if (state.timeRemaining === 0 && !state.isCountingUp) {
    if (state.settings.countUpEnabled) {
      state.isCountingUp = true;
      state.countUpTime = 0;
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      state.isRunning = false;
    }
  }
  broadcast();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  state.isRunning = true;
  timerInterval = setInterval(tick, 1000);
  broadcast();
}

function pauseTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  state.isRunning = false;
  broadcast();
}

function resetCurrentSession() {
  pauseTimer();
  const session = state.sessions[state.currentSessionIndex];
  state.timeRemaining = session ? session.duration : 0;
  state.isCountingUp = false;
  state.countUpTime = 0;
  broadcast();
}

ipcMain.handle('state:get', () => buildFullState());
ipcMain.handle('timer:start', () => { startTimer(); return buildFullState(); });
ipcMain.handle('timer:pause', () => { pauseTimer(); return buildFullState(); });
ipcMain.handle('timer:reset', () => { resetCurrentSession(); return buildFullState(); });

ipcMain.handle('timer:adjustTime', (_, seconds) => {
  if (state.isCountingUp) {
    state.isCountingUp = false;
    state.countUpTime = 0;
    state.timeRemaining = Math.max(0, seconds);
  } else {
    state.timeRemaining = Math.max(0, state.timeRemaining + seconds);
  }
  broadcast();
  return buildFullState();
});

ipcMain.handle('session:select', (_, index) => {
  if (index < 0 || index >= state.sessions.length) return buildFullState();
  pauseTimer();
  state.currentSessionIndex = index;
  state.timeRemaining = state.sessions[index].duration;
  state.isCountingUp = false;
  state.countUpTime = 0;
  broadcast();
  return buildFullState();
});

ipcMain.handle('session:add', (_, session) => {
  state.sessions.push({ id: Date.now(), name: session.name || 'New Session', duration: session.duration || 300 });
  broadcast();
  return buildFullState();
});

ipcMain.handle('session:update', (_, { index, updates }) => {
  if (index < 0 || index >= state.sessions.length) return buildFullState();
  state.sessions[index] = { ...state.sessions[index], ...updates };
  if (index === state.currentSessionIndex && !state.isRunning) {
    state.timeRemaining = state.sessions[index].duration;
    state.isCountingUp = false;
    state.countUpTime = 0;
  }
  broadcast();
  return buildFullState();
});

ipcMain.handle('session:delete', (_, index) => {
  if (state.sessions.length <= 1) return buildFullState();
  state.sessions.splice(index, 1);
  if (state.currentSessionIndex >= state.sessions.length) {
    state.currentSessionIndex = state.sessions.length - 1;
  }
  if (!state.isRunning) {
    const session = state.sessions[state.currentSessionIndex];
    state.timeRemaining = session ? session.duration : 0;
    state.isCountingUp = false;
    state.countUpTime = 0;
  }
  broadcast();
  return buildFullState();
});

ipcMain.handle('session:move', (_, { fromIndex, toIndex }) => {
  const [moved] = state.sessions.splice(fromIndex, 1);
  state.sessions.splice(toIndex, 0, moved);
  if (state.currentSessionIndex === fromIndex) {
    state.currentSessionIndex = toIndex;
  } else if (fromIndex < state.currentSessionIndex && toIndex >= state.currentSessionIndex) {
    state.currentSessionIndex--;
  } else if (fromIndex > state.currentSessionIndex && toIndex <= state.currentSessionIndex) {
    state.currentSessionIndex++;
  }
  broadcast();
  return buildFullState();
});

ipcMain.handle('message:set', (_, { message, show }) => {
  state.message = message;
  state.showMessage = show;
  broadcast();
  return buildFullState();
});

ipcMain.handle('settings:update', (_, updates) => {
  state.settings = { ...state.settings, ...updates };
  broadcast();
  return buildFullState();
});

ipcMain.handle('display:toggleFullscreen', () => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setFullScreen(!displayWindow.isFullScreen());
  }
});

ipcMain.handle('display:blackout', () => {
  state.blackout = !state.blackout;
  broadcast();
  return buildFullState();
});

ipcMain.handle('display:getDisplays', () => {
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: 'Display ' + (i + 1) + ' (' + d.bounds.width + 'x' + d.bounds.height + ')' + (d.id === screen.getPrimaryDisplay().id ? ' [Primary]' : ''),
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
  }));
});

ipcMain.handle('display:moveToDisplay', (_, displayId) => {
  state.settings.selectedDisplayId = displayId;
  const displays = screen.getAllDisplays();
  const target = displays.find(d => d.id === displayId) || screen.getPrimaryDisplay();
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setFullScreen(false);
    displayWindow.setBounds(target.bounds);
    displayWindow.setFullScreen(true);
  }
  broadcast();
  return buildFullState();
});
