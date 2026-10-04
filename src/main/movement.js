const { screen } = require('electron');
const petWindow = require('./petWindow');
const settings = require('./settings');

let walkInterval = null;
let currentDirection = 1; // 1 = right, -1 = left
let targetDistance = 0;
let distanceCovered = 0;
let lastTimestamp = 0;
let climbTarget = null;
let spiderWalkCount = 0;
let walkStartY = 0;
let hopCount = 1;
const WALK_SPEED_PPS = 70; // pixels per second
const HOP_HEIGHT = 54;

function finishWalking(win) {
  stopWalking();
  climbTarget = null;
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
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const edgeLeft = area.x;
  const edgeRight = area.x + area.width - bounds.width;
  const climbEveryWalks = Math.max(1, Math.floor(Number(currentSettings.climbEveryWalks) || 2));
  const shouldClimb = currentSettings.petId === 'spiderman'
    && bounds.y > area.y
    && ++spiderWalkCount % climbEveryWalks === 0;

  currentDirection = initialDirection !== undefined ? initialDirection : (Math.random() > 0.5 ? 1 : -1);
  walkStartY = bounds.y;
  const jumpHeight = Math.max(0, Math.min(Number(currentSettings.jumpHeight) || 0, 120));
  hopCount = jumpHeight > 0 && Math.random() < 0.5 ? 1 : 2;
  climbTarget = shouldClimb
    ? {
        x: Math.abs(bounds.x - edgeLeft) <= Math.abs(edgeRight - bounds.x) ? edgeLeft : edgeRight,
        y: area.y
      }
    : null;
  targetDistance = Math.floor(Math.random() * 200) + 100;
  distanceCovered = 0;
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

    if (climbTarget) {
      const remainingX = climbTarget.x - bounds.x;
      let newX = bounds.x;
      let newY = bounds.y;

      if (Math.abs(remainingX) > 1) {
        newX += Math.sign(remainingX) * Math.min(Math.abs(remainingX), step);
      } else {
        newX = climbTarget.x;
        newY -= Math.min(Math.max(bounds.y - climbTarget.y, 0), step);
      }

      petWindow.moveTo(newX, newY);
      const position = win.getBounds();
      if (position.x === climbTarget.x && position.y <= climbTarget.y) {
        finishWalking(win);
      }
      return;
    }

    const dx = currentDirection * step;
    const targetDisplay = screen.getDisplayMatching(bounds);
    const { x: displayX, width: displayWidth } = targetDisplay.workArea;
    const rightEdge = displayX + displayWidth - bounds.width;
    let newX = bounds.x + dx;

    if (newX <= displayX) {
      newX = displayX;
      currentDirection = 1;
      if (win.webContents) {
        win.webContents.send('set-direction', { direction: 1 });
      }
    } else if (newX >= rightEdge) {
      newX = rightEdge;
      currentDirection = -1;
      if (win.webContents) {
        win.webContents.send('set-direction', { direction: -1 });
      }
    }

    distanceCovered += Math.abs(dx);
    const progress = Math.min(distanceCovered / targetDistance, 1);
    const hopOffset = Math.sin(progress * Math.PI * hopCount) * jumpHeight;
    const newY = Math.max(targetDisplay.workArea.y, walkStartY - hopOffset);
    petWindow.moveTo(newX, newY);

    if (distanceCovered >= targetDistance) {
      finishWalking(win);
    }
  }, 33); // ~30 fps tick
}

function stopWalking() {
  if (walkInterval) {
    clearInterval(walkInterval);
    walkInterval = null;
  }
  climbTarget = null;
}

function isWalking() {
  return walkInterval !== null;
}

module.exports = {
  startWalking,
  stopWalking,
  isWalking
};
