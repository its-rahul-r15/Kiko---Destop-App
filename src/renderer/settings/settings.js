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

let currentSettings = {};
let allPets = [];
let statusTimeout = null;

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
  soundInput.checked = currentSettings.sound !== false;
  notificationInput.checked = Boolean(currentSettings.notification);

  scaleInput.value = currentSettings.scale || 1.0;
  scaleValueBadge.textContent = `${Number(currentSettings.scale || 1.0).toFixed(2)}x`;

  animationSpeedInput.value = currentSettings.animationSpeed || 1.0;
  speedValueBadge.textContent = `${Number(currentSettings.animationSpeed || 1.0).toFixed(1)}x`;

  renderPetsGrid();

  // Event Listeners for Changes
  startWithWindowsInput.addEventListener('change', () => updateSetting({ startWithWindows: startWithWindowsInput.checked }));
  alwaysOnTopInput.addEventListener('change', () => updateSetting({ alwaysOnTop: alwaysOnTopInput.checked }));
  movementEnabledInput.addEventListener('change', () => updateSetting({ movementEnabled: movementEnabledInput.checked }));
  reminderEnabledInput.addEventListener('change', () => updateSetting({ reminderEnabled: reminderEnabledInput.checked }));
  intervalMinutesInput.addEventListener('change', () => updateSetting({ intervalMinutes: parseInt(intervalMinutesInput.value, 10) }));
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

document.addEventListener('DOMContentLoaded', initSettings);
