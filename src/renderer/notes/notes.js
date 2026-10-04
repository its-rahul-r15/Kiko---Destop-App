const notesBoard = document.getElementById('notes-board');
const noteTemplate = document.getElementById('note-template');
const newNoteButton = document.getElementById('new-note');
const closeWindowButton = document.getElementById('close-window');
const saveStatus = document.getElementById('save-status');

const MAX_NOTES = 50;
let notes = [];
let saveTimeout = null;
let activeSave = Promise.resolve();
let notesLoaded = false;

function setSaveStatus(message, state) {
  saveStatus.textContent = message;
  saveStatus.dataset.state = state;
}

function updateNewNoteButton() {
  newNoteButton.disabled = notes.length >= MAX_NOTES;
  newNoteButton.title = newNoteButton.disabled ? 'You have reached the 50-note limit.' : 'Create a note';
}

function scheduleSave() {
  setSaveStatus('Unsaved changes', 'saving');
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveNotes, 300);
}

function saveNotes() {
  if (!window.notesApi) {
    setSaveStatus('Notes could not be saved.', 'error');
    return;
  }
  const snapshot = notes.map((note) => ({ ...note }));
  activeSave = activeSave.then(async () => {
    const result = await window.notesApi.saveNotes(snapshot);
    if (!result || !result.success) {
      throw new Error(result && result.error ? result.error : 'Unable to save notes.');
    }
    setSaveStatus('All changes saved', 'saved');
  }).catch((error) => {
    console.error('[Notes] Failed to save notes:', error);
    setSaveStatus('Could not save. Please try again.', 'error');
  });
}

function renderEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const icon = document.createElement('span');
  icon.className = 'empty-state-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✎';
  const title = document.createElement('h2');
  title.textContent = 'A clear space for your thoughts.';
  const description = document.createElement('p');
  description.textContent = 'Jot down a reminder, save an idea, or keep a little note to yourself.';
  const createButton = document.createElement('button');
  createButton.className = 'new-note-button';
  createButton.type = 'button';
  createButton.textContent = '＋ Create your first note';
  createButton.addEventListener('click', createNote);
  empty.append(icon, title, description, createButton);
  notesBoard.appendChild(empty);
}

function renderNotes(focusNoteId) {
  notesBoard.replaceChildren();
  if (!notes.length) {
    renderEmptyState();
    updateNewNoteButton();
    return;
  }

  notes.forEach((note) => {
    const card = noteTemplate.content.firstElementChild.cloneNode(true);
    const titleInput = card.querySelector('.note-title');
    const contentInput = card.querySelector('.note-content');
    titleInput.value = note.title;
    contentInput.value = note.content;
    titleInput.addEventListener('input', () => {
      note.title = titleInput.value;
      scheduleSave();
    });
    contentInput.addEventListener('input', () => {
      note.content = contentInput.value;
      scheduleSave();
    });
    card.querySelector('.delete-note').addEventListener('click', () => {
      notes = notes.filter((item) => item.id !== note.id);
      renderNotes();
      scheduleSave();
    });
    if (note.id === focusNoteId) {
      titleInput.dataset.focusOnRender = 'true';
    }
    notesBoard.appendChild(card);
  });

  updateNewNoteButton();
  const focusInput = notesBoard.querySelector('[data-focus-on-render="true"]');
  if (focusInput) {
    focusInput.focus();
    focusInput.removeAttribute('data-focus-on-render');
  }
}

function createNote() {
  if (notes.length >= MAX_NOTES) {
    setSaveStatus('You can keep up to 50 notes.', 'error');
    return;
  }
  const note = {
    id: window.crypto.randomUUID(),
    title: '',
    content: ''
  };
  notes.unshift(note);
  renderNotes(note.id);
  scheduleSave();
  notesBoard.querySelector('.note-content').focus();
}

async function initializeNotes() {
  try {
    const savedNotes = await window.notesApi.getNotes();
    if (!Array.isArray(savedNotes)) {
      throw new Error('Saved notes have an invalid format.');
    }
    notes = savedNotes;
    notesLoaded = true;
    renderNotes();
  } catch (error) {
    console.error('[Notes] Failed to load notes:', error);
    setSaveStatus('Could not load notes. Please reopen Notes.', 'error');
  }
}

newNoteButton.addEventListener('click', createNote);
closeWindowButton.addEventListener('click', () => window.notesApi.closeWindow());
window.addEventListener('beforeunload', () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  if (notesLoaded && window.notesApi) {
    window.notesApi.saveNotesBeforeClose(notes);
  }
});

initializeNotes();
