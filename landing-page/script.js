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
      image: 'assets/pets/ironman.png',
      color: '#e35b4e'
    },
    {
      id: 'spiderman',
      name: 'Spider-Man',
      desc: 'The friendly neighborhood pal.',
      image: 'assets/pets/spiderman.png',
      color: '#d44c55'
    },
    {
      id: 'blue-snake',
      name: 'Blue Snake',
      desc: 'A bright little buddy for your desktop.',
      image: 'assets/pets/blue-snake.png',
      color: '#3f9fce'
    },
    {
      id: 'black-cat',
      name: 'Black Cat',
      desc: 'A curious companion for your workday.',
      image: 'assets/pets/black-cat.png',
      color: '#707080'
    },
    {
      id: 'deadpool',
      name: 'Deadpool',
      desc: 'A companion with attitude.',
      image: 'assets/pets/deadpool.png',
      color: '#d84755'
    },
    {
      id: 'drstrange',
      name: 'Doctor Strange',
      desc: 'A little magic between tasks.',
      image: 'assets/pets/drstrange.png',
      color: '#8a63f0'
    },
    {
      id: 'wolverine',
      name: 'Wolverine',
      desc: 'Ready when you are.',
      image: 'assets/pets/wolverine.png',
      color: '#c79a48'
    },
    {
      id: 'deadcho',
      name: 'Deadcho',
      desc: 'A bright spark on your screen.',
      image: 'assets/pets/deadcho.png',
      color: '#e4a63d'
    },
    {
      id: 'marvel-deadpool',
      name: 'Deadpool',
      desc: 'The extra-expressive edition.',
      image: 'assets/pets/marvel-deadpool.png',
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
  const updateEmailDialog = document.getElementById('update-email-dialog');
  const updateEmailForm = document.getElementById('update-email-form');
  const updateEmailInput = document.getElementById('update-email');
  const updateEmailStatus = document.getElementById('update-email-status');

  /* ---------- Screen buddy ---------- */
  function initScreenBuddy() {
    const buddy = document.querySelector('.screen-buddy');
    if (!buddy) return;

    let pointerStart = null;
    let dragStart = null;
    let jumpTimeout;
    let roamTimeout;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function keepInViewport(left, top) {
      const maxLeft = Math.max(0, window.innerWidth - buddy.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - buddy.offsetHeight);
      return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop)
      };
    }

    function jump() {
      if (reducedMotion.matches) return;
      window.clearTimeout(jumpTimeout);
      buddy.classList.remove('is-jumping', 'is-jumping-down');
      void buddy.offsetWidth;
      buddy.classList.add(
        buddy.getBoundingClientRect().top < 48 ? 'is-jumping-down' : 'is-jumping'
      );
      jumpTimeout = window.setTimeout(function () {
        buddy.classList.remove('is-jumping', 'is-jumping-down');
      }, 600);
    }

    function scheduleRoam(delay) {
      window.clearTimeout(roamTimeout);
      if (reducedMotion.matches || document.hidden) return;
      roamTimeout = window.setTimeout(moveToRandomSpot, delay);
    }

    function moveToRandomSpot() {
      if (reducedMotion.matches || document.hidden || buddy.classList.contains('is-dragging')) return;

      const current = buddy.getBoundingClientRect();
      const position = keepInViewport(
        Math.random() * Math.max(0, window.innerWidth - current.width),
        Math.random() * Math.max(0, window.innerHeight - current.height)
      );
      const travelTime = 1.2 + Math.random() * 1.6;
      buddy.style.setProperty('--buddy-travel-time', travelTime + 's');
      buddy.classList.toggle('is-facing-left', position.left < current.left);
      buddy.style.left = position.left + 'px';
      buddy.style.top = position.top + 'px';
      scheduleRoam((travelTime + 0.8 + Math.random() * 1.8) * 1000);
    }

    const initialPosition = keepInViewport(
      Math.random() * Math.max(0, window.innerWidth - buddy.offsetWidth),
      Math.random() * Math.max(0, window.innerHeight - buddy.offsetHeight)
    );
    buddy.style.left = initialPosition.left + 'px';
    buddy.style.top = initialPosition.top + 'px';
    buddy.style.bottom = 'auto';
    buddy.classList.add('is-ready');
    scheduleRoam(900 + Math.random() * 900);

    buddy.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      window.clearTimeout(roamTimeout);
      const rect = buddy.getBoundingClientRect();
      pointerStart = { x: event.clientX, y: event.clientY };
      dragStart = { left: rect.left, top: rect.top };
      buddy.style.left = rect.left + 'px';
      buddy.style.top = rect.top + 'px';
      buddy.setPointerCapture(event.pointerId);
    });

    buddy.addEventListener('pointermove', function (event) {
      if (!pointerStart || !buddy.hasPointerCapture(event.pointerId)) return;
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      if (!buddy.classList.contains('is-dragging')
        && Math.hypot(deltaX, deltaY) < 6) return;

      buddy.classList.add('is-dragging');
      const position = keepInViewport(dragStart.left + deltaX, dragStart.top + deltaY);
      buddy.style.left = position.left + 'px';
      buddy.style.top = position.top + 'px';
      buddy.style.right = 'auto';
      buddy.style.bottom = 'auto';
      event.preventDefault();
    });

    function finishPointer(event) {
      if (!pointerStart) return;
      const wasDragging = buddy.classList.contains('is-dragging');
      pointerStart = null;
      dragStart = null;
      if (wasDragging) {
        buddy.classList.remove('is-dragging');
        event.preventDefault();
        scheduleRoam(900);
      } else {
        jump();
        scheduleRoam(900);
      }
    }

    buddy.addEventListener('pointerup', finishPointer);
    buddy.addEventListener('pointercancel', function () {
      pointerStart = null;
      dragStart = null;
      buddy.classList.remove('is-dragging');
      scheduleRoam(900);
    });

    buddy.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      jump();
    });

    window.addEventListener('resize', function () {
      if (!buddy.classList.contains('is-ready') || buddy.classList.contains('is-dragging')) return;
      const position = keepInViewport(
        Number.parseFloat(buddy.style.left),
        Number.parseFloat(buddy.style.top)
      );
      buddy.style.left = position.left + 'px';
      buddy.style.top = position.top + 'px';
      scheduleRoam(900);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.clearTimeout(roamTimeout);
      } else {
        scheduleRoam(700);
      }
    });

    reducedMotion.addEventListener('change', function () {
      if (reducedMotion.matches) {
        window.clearTimeout(roamTimeout);
      } else {
        scheduleRoam(700);
      }
    });
  }

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

  /* ---------- Download update signup ---------- */
  function initDownloadEmailSignup() {
    if (!updateEmailDialog || !updateEmailForm || !updateEmailInput || !updateEmailStatus) return;

    document.querySelectorAll('[data-download-link]').forEach(function (link) {
      link.addEventListener('click', function () {
        updateEmailStatus.textContent = '';
        updateEmailStatus.classList.remove('is-error', 'is-success');
        updateEmailForm.querySelector('button[type="submit"]').disabled = false;
        updateEmailDialog.showModal();
      });
    });

    function closeDialog() {
      if (updateEmailDialog.open) updateEmailDialog.close();
    }

    updateEmailDialog.querySelector('.update-email-close').addEventListener('click', closeDialog);
    updateEmailDialog.querySelector('.update-email-skip').addEventListener('click', closeDialog);
    updateEmailDialog.addEventListener('click', function (event) {
      if (event.target === updateEmailDialog) closeDialog();
    });

    updateEmailForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!updateEmailInput.value.trim()) {
        updateEmailStatus.textContent = 'Email is optional. Choose “Not now” to close this window.';
        updateEmailStatus.classList.remove('is-error', 'is-success');
        updateEmailInput.focus();
        return;
      }

      const submitButton = updateEmailForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      updateEmailStatus.textContent = 'Saving your email…';
      updateEmailStatus.classList.remove('is-error', 'is-success');

      try {
        const response = await fetch(updateEmailForm.action, {
          method: 'POST',
          body: new FormData(updateEmailForm),
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error('Formspree returned HTTP ' + response.status);
        }
        updateEmailStatus.textContent = 'Thanks! We’ll let you know when Kiko gets an update.';
        updateEmailStatus.classList.add('is-success');
        updateEmailForm.reset();
      } catch (error) {
        console.error('[Downloads] Could not save update email:', error);
        updateEmailStatus.textContent = 'Could not save your email right now. Please try again.';
        updateEmailStatus.classList.add('is-error');
        submitButton.disabled = false;
      }
    });
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
    initDownloadEmailSignup();
    initScreenBuddy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();