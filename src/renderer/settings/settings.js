// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const petsGrid = document.getElementById('pets-grid');
const saveStatus = document.getElementById('save-status');
const closeBtn = document.getElementById('close-btn');

// Input Controls
const startWithWindowsInput = document.getElementById('startWithWindows');
const alwaysOnTopInput = document.getElementById('alwaysOnTop');
const movementEnabledInput = document.getElementById('movementEnabled');
const reminderEnabledInput = document.getElementById('reminderEnabled');
const intervalMinutesInput = document.getElementById('intervalMinutes');
const soundInput = document.getElementById('sound');
const notificationInput = document.getElementById('notification');
const scaleInput = document.getElementById('scale');
const scaleValueBadge = document.getElementById('scale-value');
const animationSpeedInput = document.getElementById('animationSpeed');
const speedValueBadge = document.getElementById('speed-value');
const movementFrequencyInput = document.getElementById('movementFrequency');
const movementFrequencyBadge = document.getElementById('movement-frequency-value');
const jumpHeightInput = document.getElementById('jumpHeight');
const jumpHeightBadge = document.getElementById('jump-height-value');
const climbEveryWalksInput = document.getElementById('climbEveryWalks');
const pomodoroEnabledInput = document.getElementById('pomodoroEnabled');
const pomodoroFocusInput = document.getElementById('pomodoroFocusMinutes');
const pomodoroBreakInput = document.getElementById('pomodoroBreakMinutes');
const dailyStreakValue = document.getElementById('daily-streak');
const outfitsGrid = document.getElementById('outfits-grid');
const customReminderMessageInput = document.getElementById('customReminderMessage');
const customMessageCount = document.getElementById('custom-message-count');
const customMessagePreview = document.getElementById('custom-message-preview');
const customMessageStatus = document.getElementById('custom-message-status');

let currentSettings = {};
let allPets = [];
let statusTimeout = null;
let customMessageSaveTimeout = null;

// Tab Navigation
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const target = tab.getAttribute('data-tab');
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

// Flash "Saved" indicator
function showSavedIndicator() {
  saveStatus.classList.add('visible');
  if (statusTimeout) clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => {
    saveStatus.classList.remove('visible');
  }, 1200);
}

// Push updates to main process
async function updateSetting(changes) {
  if (!window.settingsApi) return;
  currentSettings = { ...currentSettings, ...changes };
  await window.settingsApi.updateSettings(changes);
  showSavedIndicator();
}

// Render Character Cards Grid
function renderPetsGrid() {
  petsGrid.innerHTML = '';

  allPets.forEach((pet) => {
    const card = document.createElement('div');
    card.className = `pet-card ${pet.id === currentSettings.petId ? 'selected' : ''}`;
    card.setAttribute('data-id', pet.id);

    const img = document.createElement('img');
    img.className = 'pet-thumb';
    img.src = pet.imageUrl;
    img.alt = pet.name;

    const name = document.createElement('span');
    name.className = 'pet-name';
    name.textContent = pet.name;

    card.appendChild(img);
    card.appendChild(name);

    card.addEventListener('click', () => {
      document.querySelectorAll('.pet-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      updateSetting({ petId: pet.id });
    });

    petsGrid.appendChild(card);
  });
}

function renderOutfits() {
  const outfits = [
    { id: 'classic', name: 'Classic', requirement: 0 },
    { id: 'shadow', name: 'Shadow', requirement: 3 },
    { id: 'neon', name: 'Neon', requirement: 7 }
  ];
  const unlocked = currentSettings.unlockedOutfits || ['classic'];
  outfitsGrid.innerHTML = '';

  outfits.forEach((outfit) => {
    const isUnlocked = unlocked.includes(outfit.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `outfit-card outfit-preview-${outfit.id}${currentSettings.selectedOutfit === outfit.id ? ' selected' : ''}`;
    card.disabled = !isUnlocked;
    card.setAttribute('aria-pressed', String(currentSettings.selectedOutfit === outfit.id));

    const preview = document.createElement('span');
    preview.className = 'outfit-preview';
    preview.textContent = outfit.id === 'classic' ? '✨' : outfit.id === 'shadow' ? '🌑' : '💠';

    const name = document.createElement('span');
    name.className = 'pet-name';
    name.textContent = outfit.name;

    const state = document.createElement('span');
    state.className = 'outfit-requirement';
    state.textContent = isUnlocked ? (currentSettings.selectedOutfit === outfit.id ? 'Selected' : 'Unlocked') : `🔥 ${outfit.requirement} days`;

    card.append(preview, name, state);
    if (isUnlocked) {
      card.addEventListener('click', () => {
        document.querySelectorAll('.outfit-card').forEach(item => {
          item.classList.remove('selected');
          item.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        state.textContent = 'Selected';
        updateSetting({ selectedOutfit: outfit.id });
      });
    }
    outfitsGrid.appendChild(card);
  });
}

// Initialize settings and form values
async function initSettings() {
  if (!window.settingsApi) return;

  currentSettings = await window.settingsApi.getSettings();
  allPets = await window.settingsApi.getPetsList();

  // Populate inputs
  startWithWindowsInput.checked = Boolean(currentSettings.startWithWindows);
  alwaysOnTopInput.checked = currentSettings.alwaysOnTop !== false;
  movementEnabledInput.checked = currentSettings.movementEnabled !== false;
  reminderEnabledInput.checked = currentSettings.reminderEnabled !== false;
  intervalMinutesInput.value = String(currentSettings.intervalMinutes || 60);
  customReminderMessageInput.value = currentSettings.customReminderMessage || '';
  updateCustomMessagePreview();
  soundInput.checked = currentSettings.sound !== false;
  notificationInput.checked = Boolean(currentSettings.notification);
  movementFrequencyInput.value = currentSettings.movementIntervalSeconds || 25;
  movementFrequencyBadge.textContent = `${movementFrequencyInput.value} sec`;
  jumpHeightInput.value = currentSettings.jumpHeight ?? 50;
  jumpHeightBadge.textContent = `${jumpHeightInput.value} px`;
  climbEveryWalksInput.value = String(currentSettings.climbEveryWalks || 2);
  pomodoroEnabledInput.checked = Boolean(currentSettings.pomodoroEnabled);
  pomodoroFocusInput.value = String(currentSettings.pomodoroFocusMinutes || 25);
  pomodoroBreakInput.value = String(currentSettings.pomodoroBreakMinutes || 5);
  dailyStreakValue.textContent = String(currentSettings.dailyStreak || 0);

  scaleInput.value = currentSettings.scale || 1.0;
  scaleValueBadge.textContent = `${Number(currentSettings.scale || 1.0).toFixed(2)}x`;

  animationSpeedInput.value = currentSettings.animationSpeed || 1.0;
  speedValueBadge.textContent = `${Number(currentSettings.animationSpeed || 1.0).toFixed(1)}x`;

  renderPetsGrid();
  renderOutfits();

  // Event Listeners for Changes
  startWithWindowsInput.addEventListener('change', () => updateSetting({ startWithWindows: startWithWindowsInput.checked }));
  alwaysOnTopInput.addEventListener('change', () => updateSetting({ alwaysOnTop: alwaysOnTopInput.checked }));
  movementEnabledInput.addEventListener('change', () => updateSetting({ movementEnabled: movementEnabledInput.checked }));
  movementFrequencyInput.addEventListener('input', () => {
    movementFrequencyBadge.textContent = `${movementFrequencyInput.value} sec`;
    updateSetting({ movementIntervalSeconds: Number(movementFrequencyInput.value) });
  });
  jumpHeightInput.addEventListener('input', () => {
    jumpHeightBadge.textContent = `${jumpHeightInput.value} px`;
    updateSetting({ jumpHeight: Number(jumpHeightInput.value) });
  });
  climbEveryWalksInput.addEventListener('change', () => updateSetting({ climbEveryWalks: Number(climbEveryWalksInput.value) }));
  pomodoroEnabledInput.addEventListener('change', () => updateSetting({ pomodoroEnabled: pomodoroEnabledInput.checked }));
  pomodoroFocusInput.addEventListener('change', () => updateSetting({ pomodoroFocusMinutes: Number(pomodoroFocusInput.value) }));
  pomodoroBreakInput.addEventListener('change', () => updateSetting({ pomodoroBreakMinutes: Number(pomodoroBreakInput.value) }));
  reminderEnabledInput.addEventListener('change', () => updateSetting({ reminderEnabled: reminderEnabledInput.checked }));
  intervalMinutesInput.addEventListener('change', () => updateSetting({ intervalMinutes: parseInt(intervalMinutesInput.value, 10) }));
  customReminderMessageInput.addEventListener('input', () => {
    updateCustomMessagePreview();
    customMessageStatus.textContent = 'Saving...';
    if (customMessageSaveTimeout) clearTimeout(customMessageSaveTimeout);
    customMessageSaveTimeout = setTimeout(saveCustomReminderMessage, 350);
  });
  soundInput.addEventListener('change', () => updateSetting({ sound: soundInput.checked }));
  notificationInput.addEventListener('change', () => updateSetting({ notification: notificationInput.checked }));

  scaleInput.addEventListener('input', () => {
    const val = parseFloat(scaleInput.value);
    scaleValueBadge.textContent = `${val.toFixed(2)}x`;
    updateSetting({ scale: val });
  });

  animationSpeedInput.addEventListener('input', () => {
    const val = parseFloat(animationSpeedInput.value);
    speedValueBadge.textContent = `${val.toFixed(1)}x`;
    updateSetting({ animationSpeed: val });
  });

  closeBtn.addEventListener('click', () => {
    if (window.settingsApi.closeWindow) {
      window.settingsApi.closeWindow();
    }
  });
}

function updateCustomMessagePreview() {
  const message = customReminderMessageInput.value.trim();
  customMessageCount.textContent = `${customReminderMessageInput.value.length} / 120`;
  customMessagePreview.textContent = message || 'Your reminder will appear in Kiko’s speech bubble.';
}

async function saveCustomReminderMessage() {
  const message = customReminderMessageInput.value.trim();
  try {
    const response = await window.settingsApi.updateSettings({ customReminderMessage: message });
    if (!response || !response.success) {
      throw new Error(response && response.error ? response.error : 'Unable to save reminder message');
    }
    currentSettings.customReminderMessage = message;
    customMessageStatus.textContent = 'Saved on this PC';
  } catch (error) {
    customMessageStatus.textContent = 'Could not save. Please try again.';
    console.error('[Settings] Failed to save custom reminder message:', error);
  }
}

document.addEventListener('DOMContentLoaded', initSettings);
