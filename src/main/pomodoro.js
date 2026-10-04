const settings = require('./settings');
const petWindow = require('./petWindow');

let ticker = null;

function phaseDurationMs(phase, currentSettings = settings.get()) {
  const key = phase === 'break' ? 'pomodoroBreakMinutes' : 'pomodoroFocusMinutes';
  const minutes = Math.max(1, Math.min(Number(currentSettings[key]) || (phase === 'break' ? 5 : 25), 180));
  return minutes * 60 * 1000;
}

function getStatus(currentSettings = settings.get()) {
  if (!currentSettings.pomodoroEnabled) {
    return { phase: 'off', remainingSeconds: 0, sessions: currentSettings.pomodoroSessions || 0 };
  }

  return {
    phase: currentSettings.pomodoroPhase === 'break' ? 'break' : 'focus',
    remainingSeconds: Math.max(0, Math.ceil((Number(currentSettings.pomodoroEndsAt) - Date.now()) / 1000)),
    sessions: currentSettings.pomodoroSessions || 0
  };
}

function sendStatus(status = getStatus()) {
  const win = petWindow.getPetWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('pomodoro-update', status);
  }
}

function advancePhase() {
  const currentSettings = settings.get();
  if (!currentSettings.pomodoroEnabled) {
    stopTicker();
    return;
  }

  const nextPhase = currentSettings.pomodoroPhase === 'focus' ? 'break' : 'focus';
  const sessions = (Number(currentSettings.pomodoroSessions) || 0) + (nextPhase === 'break' ? 1 : 0);
  settings.set({
    pomodoroPhase: nextPhase,
    pomodoroEndsAt: Date.now() + phaseDurationMs(nextPhase, currentSettings),
    pomodoroSessions: sessions
  });
  sendStatus();
}

function tick() {
  const currentSettings = settings.get();
  if (!currentSettings.pomodoroEnabled) {
    stopTicker();
    return;
  }

  const status = getStatus(currentSettings);
  if (status.remainingSeconds === 0) {
    advancePhase();
  } else {
    sendStatus(status);
  }
}

function start() {
  const currentSettings = settings.get();
  settings.set({
    pomodoroEnabled: true,
    pomodoroPhase: 'focus',
    pomodoroEndsAt: Date.now() + phaseDurationMs('focus', currentSettings)
  });
  if (!ticker) ticker = setInterval(tick, 1000);
  sendStatus();
}

function stopTicker() {
  if (!ticker) return;
  clearInterval(ticker);
  ticker = null;
}

function stop() {
  stopTicker();
  settings.set({ pomodoroEnabled: false, pomodoroEndsAt: null });
  sendStatus({ phase: 'off', remainingSeconds: 0, sessions: settings.get('pomodoroSessions') || 0 });
}

function restartCurrentPhase() {
  const currentSettings = settings.get();
  if (!currentSettings.pomodoroEnabled) return;

  const phase = currentSettings.pomodoroPhase === 'break' ? 'break' : 'focus';
  settings.set({ pomodoroEndsAt: Date.now() + phaseDurationMs(phase, currentSettings) });
  if (!ticker) ticker = setInterval(tick, 1000);
  sendStatus();
}

function startSavedSession() {
  if (settings.get('pomodoroEnabled')) start();
}

function shutdown() {
  stopTicker();
}

module.exports = {
  start,
  stop,
  restartCurrentPhase,
  startSavedSession,
  shutdown
};
