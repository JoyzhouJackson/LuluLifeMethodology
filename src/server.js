const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');

const { createDailyPage } = require('./core');
const { createStore } = require('./store');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 5177);
const store = createStore(ROOT);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const rawPath = decodeURIComponent(url.pathname);
  const targetPath = rawPath === '/' ? '/index.html' : rawPath;
  const baseDir = targetPath.startsWith('/uploads') ? store.uploadDir : PUBLIC_DIR;
  const relative = targetPath.startsWith('/uploads')
    ? targetPath.replace(/^\/uploads\/?/, '')
    : targetPath.replace(/^\/+/, '');
  const absolute = path.resolve(baseDir, relative);

  if (!absolute.startsWith(path.resolve(baseDir))) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await fs.readFile(absolute);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(file);
  } catch (error) {
    response.writeHead(404);
    response.end('Not found');
  }
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/data') {
      sendJson(response, 200, await store.load());
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/daily-page') {
      sendJson(response, 200, createDailyPage(await store.load()));
      return;
    }

    if (request.method === 'PUT' && url.pathname === '/api/data') {
      const body = await readBody(request);
      sendJson(response, 200, await store.save(JSON.parse(body.toString('utf8'))));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/upload') {
      const body = await readBody(request);
      const encodedName = String(request.headers['x-file-name'] || 'upload.bin');
      const fileName = decodeURIComponent(encodedName);
      const saved = await store.saveUpload({
        fileName,
        buffer: body,
      });
      sendJson(response, 201, { url: saved.url });
      return;
    }

    sendJson(response, 404, { error: '接口不存在' });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) {
    handleApi(request, response);
    return;
  }
  serveStatic(request, response);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`人生管理系统已启动: http://localhost:${PORT}`);
  });
}

module.exports = { server };
