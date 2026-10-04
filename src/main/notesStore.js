const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let notesFilePath = '';

function getNotesFilePath() {
  if (!notesFilePath) {
    notesFilePath = path.join(app.getPath('userData'), 'notes.json');
  }
  return notesFilePath;
}

function loadNotes() {
  const filePath = getNotesFilePath();
  try {
    const notes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(notes)) {
      throw new Error('Notes file must contain a list.');
    }
    return notes;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    console.error('[Notes] Failed to load notes:', error);
    throw error;
  }
}

function saveNotes(notes) {
  const filePath = getNotesFilePath();
  const tempPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(tempPath, JSON.stringify(notes, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.error('[Notes] Failed to remove an incomplete notes file:', cleanupError);
    }
    console.error('[Notes] Failed to save notes:', error);
    throw error;
  }
  return notes;
}

module.exports = {
  loadNotes,
  saveNotes
};
