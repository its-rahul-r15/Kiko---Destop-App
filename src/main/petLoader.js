const path = require('path');
const fs = require('fs');

let loadedPets = [];
let petsDirPath = '';

function getPetsDirectory() {
  if (!petsDirPath) {
    // Check root /pets directory
    petsDirPath = path.resolve(__dirname, '../../pets');
  }
  return petsDirPath;
}

function loadAllPets() {
  const dir = getPetsDirectory();
  loadedPets = [];

  if (!fs.existsSync(dir)) {
    console.warn(`[PetLoader] Pets directory does not exist at ${dir}`);
    return loadedPets;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const petFolder = path.join(dir, entry.name);
        const manifestPath = path.join(petFolder, 'manifest.json');
        
        // Look for image asset (sprite.png, sheet.png, or image.png)
        let imageFileName = 'sprite.png';
        if (!fs.existsSync(path.join(petFolder, imageFileName))) {
          if (fs.existsSync(path.join(petFolder, 'sheet.png'))) {
            imageFileName = 'sheet.png';
          } else if (fs.existsSync(path.join(petFolder, 'image.png'))) {
            imageFileName = 'image.png';
          }
        }

        const imagePath = path.join(petFolder, imageFileName);

        if (!fs.existsSync(manifestPath)) {
          console.warn(`[PetLoader] Skipping ${entry.name}: manifest.json not found.`);
          continue;
        }

        if (!fs.existsSync(imagePath)) {
          console.warn(`[PetLoader] Skipping ${entry.name}: image asset (${imageFileName}) not found.`);
          continue;
        }

        try {
          const raw = fs.readFileSync(manifestPath, 'utf-8');
          const manifest = JSON.parse(raw);

          // Validation of required keys
          if (!manifest.id || !manifest.name) {
            console.warn(`[PetLoader] Skipping ${entry.name}: missing required id or name in manifest.`);
            continue;
          }

          loadedPets.push({
            id: manifest.id,
            name: manifest.name,
            manifest,
            imagePath,
            folderPath: petFolder
          });
        } catch (err) {
          console.error(`[PetLoader] Error parsing manifest for ${entry.name}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[PetLoader] Failed to scan pets directory:', err);
  }

  console.log(`[PetLoader] Successfully loaded ${loadedPets.length} pets.`);
  return loadedPets;
}

function getAllPets() {
  if (loadedPets.length === 0) {
    loadAllPets();
  }
  return loadedPets;
}

function getPetById(id) {
  const all = getAllPets();
  const found = all.find(p => p.id === id);
  if (found) return found;
  // Fallback to first valid pet
  return all.length > 0 ? all[0] : null;
}

module.exports = {
  loadAllPets,
  getAllPets,
  getPetById
};
