const { screen } = require('electron');
const petWindow = require('./petWindow');
const settings = require('./settings');

let walkInterval = null;
let currentDirection = 1; // 1 = right, -1 = left
let targetPosition = null;
let travelDistance = 0;
let distanceTravelled = 0;
let lastTimestamp = 0;
let climbTarget = null;
let spiderWalkCount = 0;
let hopCount = 1;
const WALK_SPEED_PPS = 70; // pixels per second

function finishWalking(win) {
  stopWalking();
  climbTarget = null;
  targetPosition = null;
  petWindow.saveFinalPosition();
  if (win.webContents) {
    win.webContents.send('walk-finished');
  }
}

function startWalking(initialDirection) {
  stopWalking(); // Ensure any prior interval is cleaned up

  const currentSettings = settings.get();
  if (currentSettings.movementEnabled === false) {
    return;
  }

  const win = petWindow.getPetWindow();
  if (!win || win.isDestroyed()) return;

  const bounds = win.getBounds();
  const startX = bounds.x;
  const startY = bounds.y;
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const edgeLeft = area.x;
  const edgeRight = area.x + area.width - bounds.width;
  const climbEveryWalks = Math.max(1, Math.floor(Number(currentSettings.climbEveryWalks) || 2));
  const shouldClimb = currentSettings.petId === 'spiderman'
    && bounds.y > area.y
    && ++spiderWalkCount % climbEveryWalks === 0;

  const maxX = area.x + area.width - bounds.width;
  const maxY = Math.max(area.y, area.y + area.height - bounds.height);
  targetPosition = shouldClimb
    ? null
    : {
        x: Math.round(area.x + Math.random() * Math.max(0, maxX - area.x)),
        y: Math.round(area.y + Math.random() * Math.max(0, maxY - area.y))
      };
  if (targetPosition && Math.abs(targetPosition.y - bounds.y) < Math.max(100, area.height * 0.2)) {
    targetPosition.y = bounds.y < area.y + area.height / 2 ? maxY : area.y;
  }

  currentDirection = targetPosition
    ? Math.sign(targetPosition.x - bounds.x) || initialDirection || 1
    : (initialDirection !== undefined ? initialDirection : (Math.random() > 0.5 ? 1 : -1));
  const jumpHeight = Math.max(0, Math.min(Number(currentSettings.jumpHeight) || 0, 120));
  hopCount = jumpHeight > 0 && Math.random() < 0.5 ? 1 : 2;
  climbTarget = shouldClimb
    ? {
        x: Math.abs(bounds.x - edgeLeft) <= Math.abs(edgeRight - bounds.x) ? edgeLeft : edgeRight,
        y: area.y
      }
    : null;
  if (climbTarget) currentDirection = Math.sign(climbTarget.x - bounds.x) || currentDirection;
  if (win.webContents) {
    win.webContents.send('set-direction', { direction: currentDirection });
  }
  const destination = climbTarget || targetPosition;
  travelDistance = destination
    ? Math.hypot(destination.x - bounds.x, destination.y - bounds.y)
    : 0;
  distanceTravelled = 0;
  lastTimestamp = Date.now();

  walkInterval = setInterval(() => {
    if (!win || win.isDestroyed()) {
      stopWalking();
      return;
    }

    const now = Date.now();
    const deltaTime = (now - lastTimestamp) / 1000;
    lastTimestamp = now;

    const speed = (currentSettings.animationSpeed || 1.0) * WALK_SPEED_PPS;
    const step = speed * deltaTime;
    const bounds = win.getBounds();

    const destination = climbTarget || targetPosition;
    if (!destination) {
      finishWalking(win);
      return;
    }

    const totalDeltaX = destination.x - startX;
    const totalDeltaY = destination.y - startY;
    const progress = travelDistance === 0
      ? 1
      : Math.min((distanceTravelled + step) / travelDistance, 1);
    if (progress >= 1) {
      petWindow.moveTo(destination.x, destination.y);
      finishWalking(win);
      return;
    }

    const hopOffset = Math.sin(progress * Math.PI * hopCount) * jumpHeight;
    const nextX = startX + totalDeltaX * progress;
    const nextY = startY + totalDeltaY * progress - hopOffset;
    petWindow.moveTo(nextX, nextY);
    distanceTravelled += step;
  }, 33); // ~30 fps tick
}

function stopWalking() {
  if (walkInterval) {
    clearInterval(walkInterval);
    walkInterval = null;
  }
  climbTarget = null;
  targetPosition = null;
}

function isWalking() {
  return walkInterval !== null;
}

module.exports = {
  startWalking,
  stopWalking,
  isWalking
};
