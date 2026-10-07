// State Constants
const States = {
  IDLE: 'IDLE',
  WALKING: 'WALKING',
  REMINDER: 'REMINDER',
  DRINKING: 'DRINKING',
  SLEEPING: 'SLEEPING',
  HIDDEN: 'HIDDEN'
};

let currentState = States.IDLE;
let currentPetManifest = null;
let movementEnabled = true;
let movementIntervalSeconds = 25;
let currentPomodoroPhase = 'off';

// Timers
let stateTimer = null;
let bubbleTimer = null;
let walkTriggerTimer = null;
let inactivityTimer = null;

// Dragging State
let isDragging = false;
let dragMoved = false;
let dragStartX = 0;
let dragStartY = 0;
let clickReactionTimer = null;
let lastPetClickAt = 0;
let spiderDragOffsetX = 0;
let spiderDragOffsetY = 0;
let spiderDragTargetX = 0;
let spiderDragTargetY = 0;
let spiderDragVelocityX = 0;
let spiderDragVelocityY = 0;
let spiderAnimationFrame = null;
let spiderLastFrameTime = 0;

// DOM Elements
const petContainer = document.getElementById('pet-container');
const petRoot = document.getElementById('pet-root');
const petImage = document.getElementById('pet-image');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const reminderPetImage = document.getElementById('reminder-pet-image');
const dismissReminderButton = document.getElementById('dismiss-reminder');
const snoozeReminderButton = document.getElementById('snooze-reminder');
const doneReminderButton = document.getElementById('done-reminder');
const sleepZzz = document.getElementById('sleep-zzz');
const reminderAudio = document.getElementById('reminder-audio');
const pomodoroBadge = document.getElementById('pomodoro-badge');

// Hit-Testing: Click-through toggle
function bindHitTesting() {
  const interactiveElements = [petContainer, speechBubble];

  interactiveElements.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      if (window.pet && window.pet.setIgnoreMouse) {
        window.pet.setIgnoreMouse(false);
      }
    });

    el.addEventListener('mouseleave', () => {
      if (!isDragging && window.pet && window.pet.setIgnoreMouse) {
        window.pet.setIgnoreMouse(true);
      }
    });
  });

  petContainer.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    reactToClick();
  });

  dismissReminderButton.addEventListener('click', finishReminder);
  doneReminderButton.addEventListener('click', finishReminder);
  snoozeReminderButton.addEventListener('click', () => {
    if (window.pet && window.pet.snoozeReminder) {
      window.pet.snoozeReminder();
    }
    finishReminder();
  });
}

function reportTourInteraction(interaction) {
  if (window.pet && window.pet.reportTourInteraction) {
    window.pet.reportTourInteraction(interaction);
  }
}

function finishReminder() {
  hideBubble();
  if (currentState === States.REMINDER) {
    setState(States.IDLE);
  }
}

function reactToClick() {
  const reactions = [
    'Hey! Nice to see you 👋',
    'Ready for a tiny break? ✨',
    'You found me! 🐾',
    'Let’s make today a good one 💪',
    'Boop! Thanks for checking in 💛'
  ];
  showBubble(reactions[Math.floor(Math.random() * reactions.length)], 3500);
  petContainer.classList.remove('reaction-playful');
  void petContainer.offsetWidth;
  petContainer.classList.add('reaction-playful');
  setTimeout(() => petContainer.classList.remove('reaction-playful'), 750);
}

function queueClickReaction() {
  if (clickReactionTimer) clearTimeout(clickReactionTimer);
  clickReactionTimer = setTimeout(() => {
    clickReactionTimer = null;
    lastPetClickAt = 0;
    reactToClick();
    if (window.pet && window.pet.setIgnoreMouse) {
      window.pet.setIgnoreMouse(true);
    }
  }, 500);
}

function openNotes() {
  if (clickReactionTimer) {
    clearTimeout(clickReactionTimer);
    clickReactionTimer = null;
  }
  lastPetClickAt = 0;
  if (window.pet && window.pet.openNotes) {
    window.pet.openNotes();
  }
}

function updateSpiderDragPose() {
  const angle = Math.max(-65, Math.min(65, Math.atan2(spiderDragOffsetX, 64 + spiderDragOffsetY) * (180 / Math.PI)));
  const pull = Math.max(0, Math.min(180, spiderDragOffsetY));
  petContainer.style.setProperty('--spider-angle', `${angle}deg`);
  petRoot.style.setProperty('--spider-angle', `${angle}deg`);
  petRoot.style.setProperty('--spider-pull', `${pull}px`);
}

function animateSpiderRope() {
  const animate = (timestamp) => {
    const stiffness = 240;
    const damping = 28;
    const deltaSeconds = Math.min((timestamp - spiderLastFrameTime) / 1000, 0.032);
    spiderLastFrameTime = timestamp;

    spiderDragVelocityX += ((spiderDragTargetX - spiderDragOffsetX) * stiffness - spiderDragVelocityX * damping) * deltaSeconds;
    spiderDragVelocityY += ((spiderDragTargetY - spiderDragOffsetY) * stiffness - spiderDragVelocityY * damping) * deltaSeconds;
    spiderDragOffsetX += spiderDragVelocityX * deltaSeconds;
    spiderDragOffsetY += spiderDragVelocityY * deltaSeconds;
    updateSpiderDragPose();

    const settled = !isDragging
      && Math.abs(spiderDragOffsetX) < 0.1
      && Math.abs(spiderDragOffsetY) < 0.1
      && Math.abs(spiderDragVelocityX) < 0.1
      && Math.abs(spiderDragVelocityY) < 0.1;
    if (settled) {
      spiderDragOffsetX = 0;
      spiderDragOffsetY = 0;
      updateSpiderDragPose();
      petRoot.classList.remove('spider-moving');
      spiderAnimationFrame = null;
      return;
    }

    spiderAnimationFrame = requestAnimationFrame(animate);
  };

  if (spiderAnimationFrame === null) {
    spiderLastFrameTime = performance.now();
    spiderAnimationFrame = requestAnimationFrame(animate);
  }
}

function resetSpiderRope() {
  if (spiderAnimationFrame !== null) {
    cancelAnimationFrame(spiderAnimationFrame);
    spiderAnimationFrame = null;
  }
  spiderLastFrameTime = 0;
  spiderDragOffsetX = 0;
  spiderDragOffsetY = 0;
  spiderDragTargetX = 0;
  spiderDragTargetY = 0;
  spiderDragVelocityX = 0;
  spiderDragVelocityY = 0;
  petRoot.classList.remove('spider-moving');
  petContainer.style.setProperty('--spider-angle', '0deg');
  petRoot.style.setProperty('--spider-angle', '0deg');
  petRoot.style.setProperty('--spider-pull', '0px');
}

// Custom Drag System
function bindDragHandling() {
  petContainer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    const isSpider = currentPetManifest?.id === 'spiderman';
    if (clickReactionTimer) {
      clearTimeout(clickReactionTimer);
      clickReactionTimer = null;
    }

    if (currentState === States.WALKING) {
      if (window.pet && window.pet.stopWalk) window.pet.stopWalk();
      setState(States.IDLE);
    }
    clearWalkTrigger();
    isDragging = true;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    dragMoved = false;
    spiderDragOffsetX = 0;
    spiderDragOffsetY = 0;
    if (isSpider) {
      spiderDragTargetX = 0;
      spiderDragTargetY = 0;
      spiderDragVelocityX = 0;
      spiderDragVelocityY = 0;
      petRoot.classList.add('spider-moving');
      animateSpiderRope();
    }

    // Wake up if sleeping
    if (currentState === States.SLEEPING) {
      setState(States.IDLE);
    }
    resetInactivityTimer();

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const dx = moveEvent.screenX - dragStartX;
      const dy = moveEvent.screenY - dragStartY;
      if (Math.abs(moveEvent.screenX - e.screenX) + Math.abs(moveEvent.screenY - e.screenY) > 5) {
        dragMoved = true;
      }
      dragStartX = moveEvent.screenX;
      dragStartY = moveEvent.screenY;

      if (isSpider) {
        spiderDragTargetX = Math.max(-150, Math.min(150, spiderDragTargetX + dx));
        spiderDragTargetY = Math.max(-40, Math.min(180, spiderDragTargetY + dy));
        animateSpiderRope();
      } else if (window.pet && window.pet.sendDragDelta) {
        window.pet.sendDragDelta(dx, dy);
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isSpider) {
        spiderDragTargetX = 0;
        spiderDragTargetY = 0;
        animateSpiderRope();
      } else if (window.pet && window.pet.sendDragEnd) {
        window.pet.sendDragEnd();
      }

      if (!dragMoved) {
        const now = Date.now();
        if (lastPetClickAt && now - lastPetClickAt <= 500) {
          reportTourInteraction('double-click');
          openNotes();
          if (window.pet && window.pet.setIgnoreMouse) {
            window.pet.setIgnoreMouse(true);
          }
        } else {
          reportTourInteraction('click');
          lastPetClickAt = now;
          queueClickReaction();
        }
      } else {
        reportTourInteraction('drag');
        lastPetClickAt = 0;
        if (window.pet && window.pet.setIgnoreMouse) {
          window.pet.setIgnoreMouse(true);
        }
      }
      if (currentState === States.IDLE) scheduleNextRandomWalk();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

// State Machine Engine
function setState(newState, payload = {}) {
  // Clear any existing state-specific timers
  if (stateTimer) {
    clearTimeout(stateTimer);
    stateTimer = null;
  }

  // Remove previous state classes
  petContainer.classList.remove('state-idle', 'state-walking', 'state-reminder', 'state-drinking', 'state-sleeping');
  sleepZzz.classList.add('zzz-hidden');

  currentState = newState;

  switch (newState) {
    case States.IDLE:
      petContainer.classList.add('state-idle');
      scheduleNextRandomWalk();
      resetInactivityTimer();
      break;

    case States.WALKING:
      petContainer.classList.add('state-walking');
      clearWalkTrigger();
      if (window.pet && window.pet.startWalk) {
        window.pet.startWalk(payload.direction || (Math.random() > 0.5 ? 1 : -1));
      }
      break;

    case States.REMINDER:
      petContainer.classList.add('state-reminder');
      petRoot.classList.add('reminder-visible');
      showBubble(payload.message || "💧 Time to drink water!", 12000);
      if (payload.sound) {
        playHydrationSound();
      }

      // Transition to drinking / celebration state after 4 seconds
      stateTimer = setTimeout(() => {
        setState(States.DRINKING);
      }, 4000);
      break;

    case States.DRINKING:
      petContainer.classList.add('state-drinking');
      stateTimer = setTimeout(() => {
        setState(States.IDLE);
      }, 3500);
      break;

    case States.SLEEPING:
      petContainer.classList.add('state-sleeping');
      sleepZzz.classList.remove('zzz-hidden');
      clearWalkTrigger();
      break;

    case States.HIDDEN:
      petContainer.classList.add('paused');
      clearWalkTrigger();
      break;
  }
}

// Random Walk Scheduler
function scheduleNextRandomWalk() {
  clearWalkTrigger();
  if (!movementEnabled || currentState !== States.IDLE || currentPetManifest?.id === 'spiderman') return;

  const baseDelay = Math.max(10, Math.min(movementIntervalSeconds, 120));
  const delayMs = Math.round(baseDelay * (0.8 + Math.random() * 0.4) * 1000);
  walkTriggerTimer = setTimeout(() => {
    if (currentState === States.IDLE && movementEnabled) {
      setState(States.WALKING);
    }
  }, delayMs);
}

function clearWalkTrigger() {
  if (walkTriggerTimer) {
    clearTimeout(walkTriggerTimer);
    walkTriggerTimer = null;
  }
}

// Inactivity Timer (10 mins -> SLEEPING)
function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  inactivityTimer = setTimeout(() => {
    if (currentState === States.IDLE) {
      setState(States.SLEEPING);
    }
  }, 10 * 60 * 1000);
}

// Speech Bubble Management
function showBubble(text, duration = 8000) {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }

  bubbleText.textContent = text;
  speechBubble.classList.remove('bubble-hidden');

  bubbleTimer = setTimeout(hideBubble, duration);
}

function hideBubble() {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
  speechBubble.classList.add('bubble-hidden');
  petRoot.classList.remove('reminder-visible');
}

function playHydrationSound() {
  reminderAudio.src = new URL('../../../assets/water.wav', window.location.href).href;
  reminderAudio.volume = 0.6;
  reminderAudio.currentTime = 0;
  reminderAudio.play().catch((err) => {
    console.error('[Reminder] Failed to play hydration sound:', err);
  });
}

// Character Asset & Animation Applier
function applyPetData(petData) {
  if (!petData) return;

  const { manifest, imageUrl, scale, speed, outfit } = petData;
  currentPetManifest = manifest;
  petRoot.classList.toggle('pet-spiderman', manifest.id === 'spiderman');

  if (imageUrl) {
    petImage.src = imageUrl;
    reminderPetImage.src = imageUrl;
    reminderPetImage.alt = `${manifest.name} is here to remind you to take a water break`;
  }

  if (manifest.id === 'spiderman') {
    clearWalkTrigger();
    if (currentState === States.WALKING) {
      if (window.pet && window.pet.stopWalk) window.pet.stopWalk();
      setState(States.IDLE);
    }
  } else {
    resetSpiderRope();
    if (currentState === States.IDLE) scheduleNextRandomWalk();
  }

  // Set CSS Variables
  const root = document.documentElement;
  root.style.setProperty('--scale', scale || '1.0');
  root.style.setProperty('--speed', speed || '1.0');
  applyOutfit(outfit || 'classic');

  // Clear animation classes
  petContainer.classList.remove('anim-swing', 'anim-hover', 'anim-spell', 'anim-bounce', 'anim-claws', 'anim-attitude');

  // Map custom animation from manifest
  const animType = manifest.animationType || 'bounce';
  switch (animType) {
    case 'swing':
      petContainer.classList.add('anim-swing');
      break;
    case 'hover':
      petContainer.classList.add('anim-hover');
      break;
    case 'spell':
      petContainer.classList.add('anim-spell');
      break;
    case 'bounce':
      petContainer.classList.add('anim-bounce');
      break;
    case 'claws':
      petContainer.classList.add('anim-claws');
      break;
    case 'attitude':
      petContainer.classList.add('anim-attitude');
      break;
    default:
      petContainer.classList.add('anim-bounce');
  }
}

function applyOutfit(outfit) {
  petRoot.classList.remove('outfit-classic', 'outfit-shadow', 'outfit-neon');
  const supported = ['classic', 'shadow', 'neon'];
  petRoot.classList.add(`outfit-${supported.includes(outfit) ? outfit : 'classic'}`);
}

function renderPomodoro(status) {
  if (!status) return;
  const previousPhase = currentPomodoroPhase;
  currentPomodoroPhase = status.phase || 'off';
  petRoot.classList.toggle('pomodoro-focus', currentPomodoroPhase === 'focus');
  petRoot.classList.toggle('pomodoro-break', currentPomodoroPhase === 'break');

  if (currentPomodoroPhase === 'off') {
    pomodoroBadge.classList.add('pomodoro-hidden');
    return;
  }

  const minutes = Math.floor(status.remainingSeconds / 60);
  const seconds = status.remainingSeconds % 60;
  pomodoroBadge.textContent = `${currentPomodoroPhase === 'focus' ? 'Focus' : 'Break'} · ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  pomodoroBadge.classList.remove('pomodoro-hidden');

  if (previousPhase !== 'off' && previousPhase !== currentPomodoroPhase) {
    showBubble(currentPomodoroPhase === 'break' ? 'Focus session complete! Take a short break 🌿' : 'Break is over. Ready to focus? 🎯', 5000);
  }
}

// IPC Listener Wiring
function initIPC() {
  if (!window.pet) return;

  window.pet.onSetPet((data) => {
    applyPetData(data);
  });

  window.pet.onShowReminder((data) => {
    setState(States.REMINDER, data);
  });

  window.pet.onSetMovement((data) => {
    movementEnabled = Boolean(data.enabled);
    movementIntervalSeconds = Number(data.intervalSeconds) || movementIntervalSeconds;
    if (movementEnabled && currentState === States.IDLE) {
      scheduleNextRandomWalk();
    } else if (!movementEnabled && currentState === States.WALKING) {
      setState(States.IDLE);
    }
  });

  window.pet.onWalkFinished(() => {
    if (currentState === States.WALKING) {
      setState(States.IDLE);
    }
  });

  window.pet.onSetPetAtTop((atTop) => {
    petRoot.classList.toggle('pet-at-top', Boolean(atTop));
  });

  window.pet.onSetDirection(({ direction }) => {
    petContainer.classList.toggle('facing-left', direction === -1);
  });

  window.pet.onPomodoroUpdate(renderPomodoro);

  // Fetch initial state
  if (window.pet.getInitialState) {
    window.pet.getInitialState().then((state) => {
      if (state && state.pet) {
        movementEnabled = state.settings.movementEnabled !== false;
        movementIntervalSeconds = Number(state.settings.movementIntervalSeconds) || 25;
        if (state.settings.pomodoroEnabled) {
          renderPomodoro({
            phase: state.settings.pomodoroPhase || 'focus',
            remainingSeconds: Math.max(0, Math.ceil((state.settings.pomodoroEndsAt - Date.now()) / 1000))
          });
        }
        applyPetData({
          manifest: state.pet.manifest,
          imageUrl: state.pet.imageUrl,
          scale: state.settings.scale,
          speed: state.settings.animationSpeed,
          outfit: state.settings.selectedOutfit
        });
      }
    });
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  bindHitTesting();
  bindDragHandling();
  initIPC();
  setState(States.IDLE);
});
