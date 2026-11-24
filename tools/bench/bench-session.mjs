// Infra compartilhada das ferramentas headless (benchmark e inspeção visual):
// servidor estático embutido + localização do Chromium + abertura do jogo até o motor ficar pronto.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
const THREE_ROOT = path.join(ROOT_DIR, 'node_modules', 'three');

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

export function startEmbeddedStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const rawUrl = decodeURIComponent((req.url || '/').split('?')[0]);
        if (rawUrl === '/api/radio/catalog') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ stations: [] }));
          return;
        }
        const rel = rawUrl === '/' ? 'index.html' : rawUrl.replace(/^\/+/, '');
        const fullPath = path.resolve(rootDir, rel);
        if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(fullPath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

export function findCachedChromiumExecutable() {
  // Linux/macOS: variável explícita ou o Chromium do Playwright pré-instalado.
  if (process.env.BENCH_CHROMIUM && fs.existsSync(process.env.BENCH_CHROMIUM)) return process.env.BENCH_CHROMIUM;
  for (const root of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(process.env.HOME || '', '.cache', 'ms-playwright')]) {
    if (!root || !fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const exe = path.join(root, d, sub);
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  const localApp = process.env.LOCALAPPDATA || '';
  const playwrightRoot = path.join(localApp, 'ms-playwright');
  if (fs.existsSync(playwrightRoot)) {
    const dirs = fs.readdirSync(playwrightRoot).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      for (const sub of ['chrome-win64', 'chrome-win']) {
        const exe = path.join(playwrightRoot, d, sub, 'chrome.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  for (const c of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ]) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Nenhum executável Chromium/Chrome encontrado para o benchmark.');
}

/** Abre o jogo headless, inicia um save novo (facção CV) e espera o motor ficar pronto. */
export async function openGameSession({ preset = 'auto', width = 1280, height = 720 } = {}) {
  const { server, baseUrl } = await startEmbeddedStaticServer(ROOT_DIR);
  const browser = await chromium.launch({
    executablePath: findCachedChromiumExecutable(),
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--window-size=${width},${height}`]
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route(/https:\/\/(?:unpkg\.com\/three@0\.160\.0|fonts\.googleapis\.com|fonts\.gstatic\.com)\/(.*)/, async (route, request) => {
    const m = request.url().match(/https:\/\/unpkg\.com\/three@0\.160\.0\/(.*)$/);
    if (m) {
      const localPath = path.join(THREE_ROOT, m[1].split('?')[0]);
      if (fs.existsSync(localPath)) return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(localPath) });
    }
    return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
  });
  page.on('pageerror', (err) => console.error('[pageerror]', String(err?.message || err)));
  await page.goto(`${baseUrl}/?perf=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__legoGame?.hud), null, { timeout: 30000 });
  if (preset) await page.evaluate((p) => { const g = window.__legoGame; if (g?.hud?.settings) g.hud.settings.graphicsQuality = p; g?.hud?.onChangeGraphicsQuality?.(p); }, preset);
  await page.click('#btn-title-new-game');
  await page.click('[data-slot-action="start-new"][data-slot="0"]');
  await page.click('[data-choose-faction="cv"]');
  await page.waitForFunction(() => Boolean(window.__legoGame?._engineReady && !window.__legoGame?.hud?.isLoadingActive && !window.__legoGame?.hud?.isTitleScreenActive), null, { timeout: 180000 });
  await page.evaluate(() => { window.__legoGame._benchPaused = true; });
  const close = async () => { await browser.close().catch(() => {}); server.close(); };
  return { page, browser, close };
}
