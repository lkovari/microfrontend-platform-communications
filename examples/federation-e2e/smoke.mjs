import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const examplesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(examplesRoot, 'dist');

const mimeByExt = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
};

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext in mimeByExt) {
    return mimeByExt[ext];
  }
  return 'application/octet-stream';
}

function createStaticServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let relative = url.pathname;
        if (relative === '/') {
          relative = '/host/index.html';
        }
        if (relative.startsWith('/host/')) {
          relative = path.join('host', relative.slice('/host/'.length));
        } else if (relative.startsWith('/remote-orders/')) {
          relative = path.join('remote-orders', relative.slice('/remote-orders/'.length));
        } else if (relative.startsWith('/')) {
          relative = relative.slice(1);
        }
        const filePath = path.join(distRoot, relative);
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function main() {
  const server = await createStaticServer();
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected server address');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/host/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const bridge = window.__MFE_BRIDGE__;
      const hostLog = document.getElementById('host-log')?.textContent ?? '';
      return bridge !== undefined && bridge.protocolVersion === 1 && hostLog.includes('host received');
    });
    const hostLog = await page.textContent('#host-log');
    if (!hostLog?.includes('host received')) {
      throw new Error(`host did not receive person:updated: ${hostLog}`);
    }
    console.info('federation smoke: bridge handshake and publish/subscribe roundtrip OK');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
