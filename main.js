const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let controlWindow = null;
let displayWindow = null;
let timerInterval = null;
let clockInterval = null;
let isDirty = false;
let lastSavedSessions = null;
let lastSavedSettings = null;

const defaultSettings = {
  fontFamily: 'Orbitron',
  fontSize: 160,
  titleFontSize: 52,
  speakerFontSize: 36,
  greenBg: '#000000', amberBg: '#000000', redBg: '#000000',
  greenText: '#00e676', amberText: '#ffab00', redText: '#ff1744',
  amberThreshold: 300, redThreshold: 60,
  countUpEnabled: true, progressBarEnabled: true,
  messageTextColor: '#ffffff', messageBgColor: 'rgba(0,0,0,0.75)',
  glowEnabled: true, trafficLightEnabled: false,
  flashEnabled: true, flashThreshold: 10, flashSpeed: 0.8,
  gridEnabled: false, selectedDisplayId: null,
  chimeAtAmber: true, chimeAtRed: true, chimeAtZero: true,
  chimeVolume: 0.5,
  displayMode: 'countdown',
  showSpeaker: true,
  clockFormat: '24h',
};

const defaultSessions = [
  { id: 1, name: 'Opening Keynote', speaker: '', duration: 1800, linked: false },
  { id: 2, name: 'Coffee Break', speaker: '', duration: 600, linked: false },
  { id: 3, name: 'Panel Discussion', speaker: '', duration: 2700, linked: false },
];

let state = {
  sessions: JSON.parse(JSON.stringify(defaultSessions)),
  currentSessionIndex: 0,
  timeRemaining: 1800,
  isRunning: false,
  isCountingUp: false,
  countUpTime: 0,
  message: '',
  showMessage: false,
  blackout: false,
  flashTrigger: 0,
  settings: { ...defaultSettings },
};

// ── Persistence ──────────────────────────────────────────────────────────────
function getSavePath() {
  return path.join(app.getPath('userData'), 'timer-state.json');
}

function loadSavedState() {
  try {
    const raw = fs.readFileSync(getSavePath(), 'utf8');
    const saved = JSON.parse(raw);
    if (saved.sessions) state.sessions = saved.sessions;
    if (saved.settings) state.settings = { ...defaultSettings, ...saved.settings };
    if (state.sessions.length > 0) {
      state.currentSessionIndex = 0;
      state.timeRemaining = state.sessions[0].duration;
    }
    lastSavedSessions = JSON.stringify(state.sessions);
    lastSavedSettings = JSON.stringify(state.settings);
  } catch (e) {
    lastSavedSessions = JSON.stringify(state.sessions);
    lastSavedSettings = JSON.stringify(state.settings);
  }
}

function saveState() {
  try {
    const toSave = { sessions: state.sessions, settings: state.settings };
    fs.writeFileSync(getSavePath(), JSON.stringify(toSave, null, 2), 'utf8');
    lastSavedSessions = JSON.stringify(state.sessions);
    lastSavedSettings = JSON.stringify(state.settings);
    isDirty = false;
    broadcast();
  } catch (e) { console.error('Save failed', e); }
}

function checkDirty() {
  const curSessions = JSON.stringify(state.sessions);
  const curSettings = JSON.stringify(state.settings);
  isDirty = (curSessions !== lastSavedSessions || curSettings !== lastSavedSettings);
}

// ── Window creation ──────────────────────────────────────────────────────────
function getTargetDisplay() {
  const displays = screen.getAllDisplays();
  if (state.settings.selectedDisplayId) {
    const found = displays.find(d => d.id === state.settings.selectedDisplayId);
    if (found) return found;
  }
  return screen.getPrimaryDisplay();
}

function createWindows() {
  loadSavedState();
  const targetDisplay = getTargetDisplay();

  displayWindow = new BrowserWindow({
    x: targetDisplay.bounds.x, y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width, height: targetDisplay.bounds.height,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-display.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    backgroundColor: '#000000', title: 'Event Timer Display', frame: false,
  });
  displayWindow.loadFile('display.html');

  controlWindow = new BrowserWindow({
    width: 1150, height: 840, minWidth: 960, minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    backgroundColor: '#0d0d1a', title: 'Event Timer Control Panel', show: false,
  });
  controlWindow.loadFile('control.html');
  controlWindow.once('ready-to-show', () => controlWindow.show());

  controlWindow.on('close', async (e) => {
    checkDirty();
    if (isDirty) {
      e.preventDefault();
      const result = await dialog.showMessageBox(controlWindow, {
        type: 'question',
        buttons: ['Save & Quit', 'Quit Without Saving', 'Cancel'],
        defaultId: 0, cancelId: 2,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes to your sessions and settings.',
        detail: 'Do you want to save before closing?',
      });
      if (result.response === 0) { saveState(); app.quit(); }
      else if (result.response === 1) { app.quit(); }
    } else {
      app.quit();
    }
  });
}

app.whenReady().then(createWindows);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Timer logic ──────────────────────────────────────────────────────────────
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
    isDirty,
  };
}
function broadcast() {
  const fullState = buildFullState();
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.webContents.send('state:update', fullState);
  if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send('state:update', fullState);
}

let prevPhase = 'green';
function tick() {
  if (state.isCountingUp) { state.countUpTime++; broadcast(); return; }
  if (state.timeRemaining > 0) state.timeRemaining--;

  // Phase change chimes
  const newPhase = getPhase();
  if (newPhase !== prevPhase) {
    if (newPhase === 'amber' && state.settings.chimeAtAmber) triggerChime('amber');
    if (newPhase === 'red' && state.settings.chimeAtRed) triggerChime('red');
    prevPhase = newPhase;
  }

  if (state.timeRemaining === 0 && !state.isCountingUp) {
    if (state.settings.chimeAtZero) triggerChime('zero');
    if (state.settings.countUpEnabled) {
      state.isCountingUp = true;
      state.countUpTime = 0;
    } else {
      clearInterval(timerInterval); timerInterval = null; state.isRunning = false;
      // Auto-advance if linked
      tryAutoAdvance();
    }
    if (state.settings.countUpEnabled) {
      // Still check auto-advance for linked (overtime runs, but session advances)
    }
  }
  if (state.timeRemaining === 0 && state.isCountingUp && state.countUpTime === 0) {
    tryAutoAdvance();
  }
  broadcast();
}

function tryAutoAdvance() {
  const currentSession = state.sessions[state.currentSessionIndex];
  if (currentSession && currentSession.linked) {
    const nextIndex = state.currentSessionIndex + 1;
    if (nextIndex < state.sessions.length) {
      setTimeout(() => {
        state.currentSessionIndex = nextIndex;
        state.timeRemaining = state.sessions[nextIndex].duration;
        state.isCountingUp = false;
        state.countUpTime = 0;
        prevPhase = 'green';
        startTimer();
      }, 500);
    }
  }
}

function triggerChime(type) {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('chime:play', { type, volume: state.settings.chimeVolume });
  }
}

function triggerManualFlash() {
  state.flashTrigger = (state.flashTrigger || 0) + 1;
  broadcast();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  prevPhase = getPhase();
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
  prevPhase = 'green';
  broadcast();
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('state:get', () => buildFullState());
ipcMain.handle('timer:start', () => { startTimer(); return buildFullState(); });
ipcMain.handle('timer:pause', () => { pauseTimer(); return buildFullState(); });
ipcMain.handle('timer:reset', () => { resetCurrentSession(); return buildFullState(); });
ipcMain.handle('timer:flash', () => { triggerManualFlash(); return buildFullState(); });

ipcMain.handle('timer:adjustTime', (_, seconds) => {
  if (state.isCountingUp) {
    state.isCountingUp = false; state.countUpTime = 0;
    state.timeRemaining = Math.max(0, seconds);
  } else {
    state.timeRemaining = Math.max(0, state.timeRemaining + seconds);
  }
  broadcast(); return buildFullState();
});

ipcMain.handle('session:select', (_, index) => {
  if (index < 0 || index >= state.sessions.length) return buildFullState();
  pauseTimer();
  state.currentSessionIndex = index;
  state.timeRemaining = state.sessions[index].duration;
  state.isCountingUp = false; state.countUpTime = 0;
  prevPhase = 'green';
  broadcast(); return buildFullState();
});
ipcMain.handle('session:add', (_, session) => {
  state.sessions.push({ id: Date.now(), name: session.name || 'New Session', speaker: session.speaker || '', duration: session.duration || 300, linked: false });
  checkDirty(); broadcast(); return buildFullState();
});
ipcMain.handle('session:update', (_, { index, updates }) => {
  if (index < 0 || index >= state.sessions.length) return buildFullState();
  state.sessions[index] = { ...state.sessions[index], ...updates };
  if (index === state.currentSessionIndex && !state.isRunning) {
    state.timeRemaining = state.sessions[index].duration;
    state.isCountingUp = false; state.countUpTime = 0;
  }
  checkDirty(); broadcast(); return buildFullState();
});
ipcMain.handle('session:delete', (_, index) => {
  if (state.sessions.length <= 1) return buildFullState();
  state.sessions.splice(index, 1);
  if (state.currentSessionIndex >= state.sessions.length) state.currentSessionIndex = state.sessions.length - 1;
  if (!state.isRunning) {
    const session = state.sessions[state.currentSessionIndex];
    state.timeRemaining = session ? session.duration : 0;
    state.isCountingUp = false; state.countUpTime = 0;
  }
  checkDirty(); broadcast(); return buildFullState();
});
ipcMain.handle('session:duplicate', (_, index) => {
  if (index < 0 || index >= state.sessions.length) return buildFullState();
  const orig = state.sessions[index];
  const copy = { ...orig, id: Date.now(), name: orig.name + ' (copy)' };
  state.sessions.splice(index + 1, 0, copy);
  checkDirty(); broadcast(); return buildFullState();
});
ipcMain.handle('session:move', (_, { fromIndex, toIndex }) => {
  const [moved] = state.sessions.splice(fromIndex, 1);
  state.sessions.splice(toIndex, 0, moved);
  if (state.currentSessionIndex === fromIndex) state.currentSessionIndex = toIndex;
  else if (fromIndex < state.currentSessionIndex && toIndex >= state.currentSessionIndex) state.currentSessionIndex--;
  else if (fromIndex > state.currentSessionIndex && toIndex <= state.currentSessionIndex) state.currentSessionIndex++;
  checkDirty(); broadcast(); return buildFullState();
});
ipcMain.handle('message:set', (_, { message, show }) => {
  state.message = message; state.showMessage = show;
  broadcast(); return buildFullState();
});
ipcMain.handle('settings:update', (_, updates) => {
  state.settings = { ...state.settings, ...updates };
  checkDirty(); broadcast(); return buildFullState();
});
ipcMain.handle('state:save', () => { saveState(); return buildFullState(); });
ipcMain.handle('state:export', async () => {
  const result = await dialog.showSaveDialog(controlWindow, {
    title: 'Export Rundown', defaultPath: 'rundown.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify({ sessions: state.sessions, settings: state.settings }, null, 2));
    return { success: true };
  }
  return { success: false };
});
ipcMain.handle('state:import', async () => {
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Import Rundown', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths[0]) {
    try {
      const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      if (data.sessions) { pauseTimer(); state.sessions = data.sessions; state.currentSessionIndex = 0; state.timeRemaining = state.sessions[0].duration; state.isCountingUp = false; state.countUpTime = 0; }
      if (data.settings) state.settings = { ...defaultSettings, ...data.settings };
      checkDirty(); broadcast(); return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }
  return { success: false };
});
ipcMain.handle('display:toggleFullscreen', () => {
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.setFullScreen(!displayWindow.isFullScreen());
});
ipcMain.handle('display:blackout', () => {
  state.blackout = !state.blackout; broadcast(); return buildFullState();
});
ipcMain.handle('display:getDisplays', () => {
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: 'Display ' + (i + 1) + ' (' + d.bounds.width + 'x' + d.bounds.height + ')' + (d.id === screen.getPrimaryDisplay().id ? ' [Primary]' : ''),
    bounds: d.bounds, isPrimary: d.id === screen.getPrimaryDisplay().id,
  }));
});
ipcMain.handle('display:moveToDisplay', (_, displayId) => {
  state.settings.selectedDisplayId = displayId;
  const target = screen.getAllDisplays().find(d => d.id === displayId) || screen.getPrimaryDisplay();
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setFullScreen(false); displayWindow.setBounds(target.bounds); displayWindow.setFullScreen(true);
  }
  broadcast(); return buildFullState();
});
