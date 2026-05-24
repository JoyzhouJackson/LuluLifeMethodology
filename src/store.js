const fs = require('node:fs/promises');
const path = require('node:path');

const { createDefaultData, ensureData } = require('./core');

function sanitizeFileName(fileName) {
  const parsed = path.parse(fileName || 'upload.bin');
  const base = parsed.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
  return `${Date.now()}-${base || 'upload'}${ext || '.bin'}`;
}

function createStore(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  const uploadDir = path.join(dataDir, 'uploads');
  const dataFile = path.join(dataDir, 'life-system.json');

  async function ensureDirs() {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  async function load() {
    await ensureDirs();
    try {
      const raw = await fs.readFile(dataFile, 'utf8');
      return ensureData(JSON.parse(raw));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const defaults = createDefaultData();
      await save(defaults);
      return defaults;
    }
  }

  async function save(data) {
    await ensureDirs();
    const normalized = ensureData(data);
    await fs.writeFile(dataFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
  }

  async function saveUpload({ fileName, buffer }) {
    await ensureDirs();
    const safeName = sanitizeFileName(fileName);
    const absolutePath = path.join(uploadDir, safeName);
    await fs.writeFile(absolutePath, buffer);
    return {
      absolutePath,
      url: `/uploads/${safeName}`,
    };
  }

  return {
    dataDir,
    dataFile,
    uploadDir,
    load,
    save,
    saveUpload,
  };
}

module.exports = {
  createStore,
  sanitizeFileName,
};
