/* ============================================================
   Kiko Landing Page — main.js
   OS detection, pet picker, sprite player, release info, copy
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Companion art (matches the assets shipped with the app) ---------- */
  const pets = [
    {
      id: 'ironman',
      name: 'Iron Man',
      desc: 'A little arc-reactor energy.',
      image: '../pets/ironman/sprite.png',
      color: '#e35b4e'
    },
    {
      id: 'spiderman',
      name: 'Spider-Man',
      desc: 'The friendly neighborhood pal.',
      image: '../pets/spiderman/sprite.png',
      color: '#d44c55'
    },
    {
      id: 'blue-snake',
      name: 'Blue Snake',
      desc: 'A bright little buddy for your desktop.',
      image: '../pets/blue-snake/sprite.png',
      color: '#3f9fce'
    },
    {
      id: 'black-cat',
      name: 'Black Cat',
      desc: 'A curious companion for your workday.',
      image: '../pets/black-cat/sprite.png',
      color: '#707080'
    },
    {
      id: 'deadpool',
      name: 'Deadpool',
      desc: 'A companion with attitude.',
      image: '../pets/deadpool/sprite.png',
      color: '#d84755'
    },
    {
      id: 'drstrange',
      name: 'Doctor Strange',
      desc: 'A little magic between tasks.',
      image: '../pets/drstrange/sprite.png',
      color: '#8a63f0'
    },
    {
      id: 'wolverine',
      name: 'Wolverine',
      desc: 'Ready when you are.',
      image: '../pets/wolverine/sprite.png',
      color: '#c79a48'
    },
    {
      id: 'deadcho',
      name: 'Deadcho',
      desc: 'A bright spark on your screen.',
      image: '../pets/deadcho/sprite.png',
      color: '#e4a63d'
    },
    {
      id: 'marvel-deadpool',
      name: 'Deadpool',
      desc: 'The extra-expressive edition.',
      image: '../pets/marvel-deadpool/sprite.png',
      color: '#df4757'
    }
  ];

  /* ---------- State ---------- */
  let selectedPetId = 'ironman';

  /* ---------- DOM refs ---------- */
  const heroSprite = document.getElementById('hero-sprite');
  const previewSprite = document.getElementById('preview-sprite');
  const previewLabel = document.getElementById('pet-preview-label');
  const petCardsContainer = document.getElementById('pet-cards');
  const osNotes = document.querySelectorAll('.os-note');

  /* ---------- OS detection ---------- */
  function detectOS() {
    const ua = navigator.userAgent || '';
    const uaData = navigator.userAgentData;

    if (uaData && uaData.platform) {
      return uaData.platform.toLowerCase();
    }
    if (/windows|win32|win64|wince/i.test(ua)) return 'windows';
    if (/macintosh|mac os x/i.test(ua)) return 'macos';
    if (/linux/i.test(ua)) return 'linux';
    return 'unknown';
  }

  function showOSNotes() {
    const os = detectOS();
    if (os !== 'windows') {
      osNotes.forEach(function (note) {
        note.hidden = false;
      });
    }
  }

  /* ---------- Companion preview ---------- */
  function applyPetImage(el, pet) {
    if (!el) return;
    el.src = pet.image;
    el.style.setProperty('--pet-accent', pet.color);
    el.setAttribute('data-pet', pet.id);
    el.alt = pet.name + ' desktop companion';
  }

  /* ---------- Pet picker ---------- */
  function buildPetCards() {
    if (!petCardsContainer) return;

    pets.forEach(function (pet) {
      const card = document.createElement('button');
      card.className = 'pet-card';
      card.type = 'button';
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', pet.id === selectedPetId ? 'true' : 'false');
      card.setAttribute('data-pet-id', pet.id);
      const image = document.createElement('img');
      image.className = 'pet-card-art';
      image.src = pet.image;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      const details = document.createElement('span');
      details.className = 'pet-card-details';
      const name = document.createElement('span');
      name.className = 'pet-card-name';
      name.textContent = pet.name;
      const description = document.createElement('span');
      description.className = 'pet-card-desc';
      description.textContent = pet.desc;
      details.append(name, description);
      card.append(image, details);

      card.addEventListener('click', function () {
        selectPet(pet.id);
      });

      petCardsContainer.appendChild(card);
    });
  }

  function selectPet(id) {
    selectedPetId = id;

    // Update card selected state
    petCardsContainer.querySelectorAll('.pet-card').forEach(function (card) {
      card.setAttribute('aria-selected', card.getAttribute('data-pet-id') === id ? 'true' : 'false');
    });

    // Update preview sprite
    const pet = pets.find(function (p) { return p.id === id; });
    if (pet) {
      applyPetImage(previewSprite, pet);
      if (previewLabel) previewLabel.textContent = pet.name;
      applyPetImage(heroSprite, pet);
    }

    // Persist in sessionStorage (optional)
    try {
      sessionStorage.setItem('kiko-selected-pet', id);
    } catch (e) { /* ignore */ }
  }

  function restorePetSelection() {
    try {
      const stored = sessionStorage.getItem('kiko-selected-pet');
      if (stored && pets.some(function (p) { return p.id === stored; })) {
        selectedPetId = stored;
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- Init ---------- */
  function init() {
    restorePetSelection();
    buildPetCards();

    // Apply initial pet to both sprites
    const initialPet = pets.find(function (p) { return p.id === selectedPetId; }) || pets[0];
    applyPetImage(heroSprite, initialPet);
    applyPetImage(previewSprite, initialPet);
    if (previewLabel) previewLabel.textContent = initialPet.name;

    showOSNotes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();