const notesBoard = document.getElementById('notes-board');
const noteTemplate = document.getElementById('note-template');
const newNoteButton = document.getElementById('new-note');
const closeWindowButton = document.getElementById('close-window');
const saveStatus = document.getElementById('save-status');
const searchInput = document.getElementById('search-notes');
const notesCount = document.getElementById('notes-count');

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
  notesCount.textContent = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;
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
  const hasSearch = Boolean(searchInput.value.trim());
  title.textContent = hasSearch ? 'No notes found' : 'A clear space for your thoughts.';
  const description = document.createElement('p');
  description.textContent = hasSearch
    ? `Nothing matches “${searchInput.value.trim()}”. Try another search.`
    : 'Jot down a reminder, save an idea, or keep a little note to yourself.';
  const createButton = document.createElement('button');
  createButton.className = 'new-note-button';
  createButton.type = 'button';
  createButton.textContent = hasSearch ? 'Clear search' : '＋ Create your first note';
  createButton.addEventListener('click', hasSearch
    ? () => {
      searchInput.value = '';
      renderNotes();
      searchInput.focus();
    }
    : createNote);
  empty.append(icon, title, description, createButton);
  notesBoard.appendChild(empty);
}

function renderNotes(focusNoteId) {
  notesBoard.replaceChildren();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleNotes = notes.filter((note) => (
    `${note.title}\n${note.content}\n${(note.todos || []).map((todo) => todo.text).join('\n')}`
      .toLocaleLowerCase().includes(query)
  ));
  if (!visibleNotes.length) {
    renderEmptyState();
    updateNewNoteButton();
    return;
  }

  visibleNotes.forEach((note) => {
    const card = noteTemplate.content.firstElementChild.cloneNode(true);
    const titleInput = card.querySelector('.note-title');
    const contentInput = card.querySelector('.note-content');
    const sizeSelect = card.querySelector('.note-size');
    const todoForm = card.querySelector('.todo-form');
    const todoInput = card.querySelector('.todo-input');
    const todoList = card.querySelector('.todo-list');
    const todoProgress = card.querySelector('.todo-progress');

    note.size = ['small', 'medium', 'large'].includes(note.size) ? note.size : 'medium';
    note.todos = Array.isArray(note.todos) ? note.todos : [];
    card.classList.add(`note-card--${note.size}`);
    titleInput.value = note.title;
    contentInput.value = note.content;
    sizeSelect.value = note.size;

    titleInput.addEventListener('input', () => {
      note.title = titleInput.value;
      scheduleSave();
    });
    contentInput.addEventListener('input', () => {
      note.content = contentInput.value;
      scheduleSave();
    });
    sizeSelect.addEventListener('change', () => {
      note.size = sizeSelect.value;
      card.classList.remove('note-card--small', 'note-card--medium', 'note-card--large');
      card.classList.add(`note-card--${note.size}`);
      scheduleSave();
    });

    function renderTodos() {
      todoList.replaceChildren();
      const completedCount = note.todos.filter((todo) => todo.completed).length;
      todoProgress.textContent = `${completedCount}/${note.todos.length}`;
      todoList.classList.toggle('todo-list--empty', note.todos.length === 0);

      note.todos.forEach((todo) => {
        const item = document.createElement('li');
        item.className = 'todo-item';
        item.classList.toggle('todo-item--completed', todo.completed);
        const checkbox = document.createElement('input');
        checkbox.className = 'todo-checkbox';
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.setAttribute('aria-label', `Mark "${todo.text}" ${todo.completed ? 'incomplete' : 'complete'}`);
        checkbox.addEventListener('change', () => {
          todo.completed = checkbox.checked;
          renderTodos();
          scheduleSave();
        });
        const text = document.createElement('span');
        text.className = 'todo-text';
        text.textContent = todo.text;
        const removeButton = document.createElement('button');
        removeButton.className = 'todo-remove';
        removeButton.type = 'button';
        removeButton.textContent = '×';
        removeButton.setAttribute('aria-label', `Remove task "${todo.text}"`);
        removeButton.addEventListener('click', () => {
          note.todos = note.todos.filter((itemTodo) => itemTodo.id !== todo.id);
          renderTodos();
          scheduleSave();
        });
        item.append(checkbox, text, removeButton);
        todoList.appendChild(item);
      });
    }

    todoForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = todoInput.value.trim();
      if (!text) {
        todoInput.focus();
        return;
      }
      if (note.todos.length >= 100) {
        setSaveStatus('A note can have up to 100 tasks.', 'error');
        return;
      }
      note.todos.push({
        id: window.crypto.randomUUID(),
        text,
        completed: false
      });
      todoInput.value = '';
      renderTodos();
      scheduleSave();
      todoInput.focus();
    });

    renderTodos();
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
    content: '',
    size: 'medium',
    todos: []
  };
  searchInput.value = '';
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
searchInput.addEventListener('input', () => renderNotes());
closeWindowButton.addEventListener('click', () => window.notesApi.closeWindow());
window.addEventListener('beforeunload', () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  if (notesLoaded && window.notesApi) {
    window.notesApi.saveNotesBeforeClose(notes);
  }
});

initializeNotes();
