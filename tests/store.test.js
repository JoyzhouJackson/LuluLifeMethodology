const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createStore } = require('../src/store');

test('store creates default data, saves changes, and reloads them', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'life-system-'));
  const store = createStore(root);

  const first = await store.load();
  first.quickNotes.push({ id: 'note-1', content: '慢慢来。' });
  await store.save(first);

  const second = await store.load();
  assert.equal(second.quickNotes[0].content, '慢慢来。');
});

test('uploaded file names are sanitized and stored under uploads directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'life-system-'));
  const store = createStore(root);

  const saved = await store.saveUpload({
    fileName: '../reward photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-image'),
  });

  assert.match(saved.url, /^\/uploads\//);
  assert.doesNotMatch(saved.url, /\.\./);
  assert.equal(await fs.readFile(saved.absolutePath, 'utf8'), 'fake-image');
});
