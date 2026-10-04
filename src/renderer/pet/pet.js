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

// Timers
let stateTimer = null;
let bubbleTimer = null;
let walkTriggerTimer = null;
let inactivityTimer = null;

// Dragging State
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// DOM Elements
const petContainer = document.getElementById('pet-container');
const petRoot = document.getElementById('pet-root');
const petImage = document.getElementById('pet-image');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const sleepZzz = document.getElementById('sleep-zzz');
const reminderAudio = document.getElementById('reminder-audio');

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
}

// Custom Drag System
function bindDragHandling() {
  petContainer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click

    isDragging = true;
    dragStartX = e.screenX;
    dragStartY = e.screenY;

    // Wake up if sleeping
    if (currentState === States.SLEEPING) {
      setState(States.IDLE);
    }
    resetInactivityTimer();

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const dx = moveEvent.screenX - dragStartX;
      const dy = moveEvent.screenY - dragStartY;
      dragStartX = moveEvent.screenX;
      dragStartY = moveEvent.screenY;

      if (window.pet && window.pet.sendDragDelta) {
        window.pet.sendDragDelta(dx, dy);
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (window.pet && window.pet.sendDragEnd) {
        window.pet.sendDragEnd();
      }

      if (window.pet && window.pet.setIgnoreMouse) {
        window.pet.setIgnoreMouse(true);
      }
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
      showBubble(payload.message || "💧 Time to drink water!");
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

// Random Walk Scheduler (15-35s)
function scheduleNextRandomWalk() {
  clearWalkTrigger();
  if (!movementEnabled || currentState !== States.IDLE) return;

  const delayMs = (Math.floor(Math.random() * 21) + 15) * 1000;
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
function showBubble(text) {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }

  bubbleText.textContent = text;
  speechBubble.classList.remove('bubble-hidden');

  // Auto-hide after 8 seconds
  bubbleTimer = setTimeout(() => {
    speechBubble.classList.add('bubble-hidden');
  }, 8000);
}

function playHydrationSound() {
  try {
    reminderAudio.src = '../../assets/water.wav';
    reminderAudio.volume = 0.6;
    reminderAudio.play().catch(() => {});
  } catch (err) {}
}

// Character Asset & Animation Applier
function applyPetData(petData) {
  if (!petData) return;

  const { manifest, imageUrl, scale, speed } = petData;
  currentPetManifest = manifest;

  if (imageUrl) {
    petImage.src = imageUrl;
  }

  // Set CSS Variables
  const root = document.documentElement;
  root.style.setProperty('--scale', scale || '1.0');
  root.style.setProperty('--speed', speed || '1.0');

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

  // Fetch initial state
  if (window.pet.getInitialState) {
    window.pet.getInitialState().then((state) => {
      if (state && state.pet) {
        movementEnabled = state.settings.movementEnabled !== false;
        applyPetData({
          manifest: state.pet.manifest,
          imageUrl: state.pet.imageUrl,
          scale: state.settings.scale,
          speed: state.settings.animationSpeed
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
