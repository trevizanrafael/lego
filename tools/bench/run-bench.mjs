#!/usr/bin/env node
/**
 * tools/bench/run-bench.mjs
 * Benchmark automatizado headless (Playwright + Chromium + servidor HTTP local embutido de alta velocidade)
 * para medir draw calls, triângulos, contagens de cena, ms de CPU por subsistema e capturas visuais
 * das 10 regiões + 6 pontos extras + overview aéreo.
 *
 * Uso: node tools/bench/run-bench.mjs --tag M0 [--preset auto] [--url http://localhost:5173]
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
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

function startEmbeddedStaticServer(rootDir) {
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

function parseArgs(argv) {
  const out = { tag: 'M0', preset: 'auto', url: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tag' && argv[i + 1]) out.tag = argv[++i];
    else if (a === '--preset' && argv[i + 1]) out.preset = argv[++i];
    else if (a === '--url' && argv[i + 1]) out.url = argv[++i];
  }
  return out;
}

function findCachedChromiumExecutable() {
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

const EXTRA_POINTS = [
  { id: 'X_fav_close', label: 'Favela CDD (Becos / Encosta)', x: -2080, y: 24, z: -390, yaw: 0.65, aerialH: 210, aerialDist: 220 },
  { id: 'X_fav_aerial', label: 'Favela CDD (Vista Aérea)', x: -2145, y: 36, z: -405, yaw: 0.4, aerialH: 480, aerialDist: 380 },
  { id: 'X_suburb_close', label: 'Subúrbio Norte (Quadra Residencial)', x: 360, y: 3, z: -1940, yaw: 0.5, aerialH: 260, aerialDist: 260 },
  { id: 'X_ind_close', label: 'Distrito Industrial Leste', x: 2598, y: 8, z: -948, yaw: -0.5, aerialH: 320, aerialDist: 320 },
  { id: 'X_port_close', label: 'Porto Metropolitano Leste', x: 2980, y: 2, z: 1140, yaw: 0.8, aerialH: 300, aerialDist: 320 },
  { id: 'X_sky_downtown', label: 'Voo Alto sobre o Centro', x: 0, y: 240, z: -300, yaw: 0.25, aerialH: 520, aerialDist: 460 }
];

async function main() {
  const args = parseArgs(process.argv);
  const outDir = path.join(ROOT_DIR, 'docs', 'noite', args.tag);
  fs.mkdirSync(outDir, { recursive: true });

  const embedded = args.url ? null : await startEmbeddedStaticServer(ROOT_DIR);
  const baseUrl = (args.url || embedded.baseUrl).replace(/\/$/, '');

  const executablePath = findCachedChromiumExecutable();
  console.log(`[bench:${args.tag}] Usando Chromium: ${executablePath}`);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--window-size=1280,720'
    ]
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await page.route(/https:\/\/(?:unpkg\.com\/three@0\.160\.0|fonts\.googleapis\.com|fonts\.gstatic\.com)\/(.*)/, async (route, request) => {
      const url = request.url();
      const m = url.match(/https:\/\/unpkg\.com\/three@0\.160\.0\/(.*)$/);
      if (m) {
        const rel = m[1].split('?')[0];
        const localPath = path.join(THREE_ROOT, rel);
        if (fs.existsSync(localPath)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: fs.readFileSync(localPath)
          });
          return;
        }
      }
      // Evita qualquer bloqueio de rede em Google Fonts durante o benchmark offline
      await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
    });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      const msg = String(err?.message || err);
      pageErrors.push(msg);
      console.error('[pageerror]', msg);
    });

    const targetUrl = `${baseUrl}/?perf=1`;
    console.log(`[bench:${args.tag}] Abrindo ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.__legoGame?.hud), null, { timeout: 30000 });

    if (args.preset) {
      await page.evaluate((preset) => {
        const g = window.__legoGame;
        if (g?.hud?.settings) g.hud.settings.graphicsQuality = preset;
        g?.hud?.onChangeGraphicsQuality?.(preset);
      }, args.preset);
    }

    const loadStart = Date.now();
    await page.click('#btn-title-new-game');
    await page.waitForSelector('[data-slot-action="start-new"][data-slot="0"]', { timeout: 10000 });
    await page.click('[data-slot-action="start-new"][data-slot="0"]');
    await page.waitForSelector('[data-choose-faction="cv"]', { timeout: 10000 });
    await page.click('[data-choose-faction="cv"]');

    await page.waitForFunction(
      () => Boolean(window.__legoGame?._engineReady && !window.__legoGame?.hud?.isLoadingActive && !window.__legoGame?.hud?.isTitleScreenActive),
      null,
      { timeout: 180000 }
    );
    const loadTimeMs = Date.now() - loadStart;
    console.log(`[bench:${args.tag}] Motor pronto em ${(loadTimeMs / 1000).toFixed(2)}s`);

    const initInfo = await page.evaluate((preset) => {
      const g = window.__legoGame;
      g._benchPaused = true;
      if (preset && g?.graphicsPipeline) g.graphicsPipeline.setPreset(preset);
      const sceneAudit = window.__legoPerf?.auditScene?.() || {};
      const regions = (g.world?.regions || []).map((r) => ({
        id: r.id,
        label: r.shortName || r.name,
        x: r.spawn.x,
        y: r.spawn.y,
        z: r.spawn.z,
        yaw: 0,
        aerialH: r.id === 'aeroporta_avioes' ? 540 : 280,
        aerialDist: 280
      }));
      return {
        sceneAudit,
        colliders: g.world?.colliders?.length || 0,
        mapBuildings: g.world?.mapBuildings?.length || 0,
        mapOrganicRoads: g.world?.mapOrganicRoads?.length || 0,
        pipelineStats: g.graphicsPipeline?.getStats?.() || {},
        regions
      };
    }, args.preset);

    const allPoints = [...initInfo.regions, ...EXTRA_POINTS];
    const pointResults = [];

    for (const pt of allPoints) {
      const metrics = await page.evaluate(async (p) => {
        const THREE = await import('three');
        const g = window.__legoGame;
        const ctl = g.controller;
        if (ctl) {
          if (ctl.currentVehicle) ctl._exitVehicle?.();
          const surfY = p.y > 200 ? p.y : Math.max(p.y, (g.world?.getSurfaceHeightAt?.(p.x, p.z, p.y + 4) ?? p.y) + 0.1);
          ctl.position.set(p.x, surfY, p.z);
          if (ctl.velocity) ctl.velocity.set(0, 0, 0);
          ctl.yaw = p.yaw || 0;
          ctl.pitch = -0.14;
          ctl.isFlying = Boolean(p.y > 180 && p.id === 'X_sky_downtown');
        }

        const stepOnce = (dt) => {
          const pos = g.controller.position;
          const tCtl0 = performance.now();
          g.controller.update(dt);
          const tCtl1 = performance.now();
          g.destructibles.update(dt, pos, { x: -Math.sin(g.controller.yaw || 0), z: -Math.cos(g.controller.yaw || 0) });
          const tDest1 = performance.now();
          g.world.update(dt, pos, g.controller);
          const lcPerf = g.world?.livingCity?._perfTimings;
          const wPerf = g.world?._perfTimings;
          g.perfOverlay.cur.controller = tCtl1 - tCtl0;
          g.perfOverlay.cur.destructibles = tDest1 - tCtl1;
          g.perfOverlay.cur.livingCity = lcPerf?.livingCity || 0;
          g.perfOverlay.cur.factionWar = lcPerf?.factionWar || 0;
          g.perfOverlay.cur.police = lcPerf?.police || 0;
          g.perfOverlay.cur.atmosphere = wPerf?.atmosphere || 0;
          g.perfOverlay.cur.worldTotal = wPerf?.worldTotal || 0;
          const tHud0 = performance.now();
          g.hud.update(dt, g.camera);
          const reg = g.world.getRegionAt(pos.x, pos.y, pos.z);
          g.hud.updateMinimap(pos, g.controller.facingAngle, g.controller.yaw, reg, g.world, 0, dt);
          g.perfOverlay.cur.hud = performance.now() - tHud0;
          g.perfOverlay.beginRenderFrame();
          const tRnd0 = performance.now();
          g._renderScene(dt);
          const rndMs = performance.now() - tRnd0;
          g.perfOverlay.endRenderFrame(rndMs, g.perfOverlay.cur.worldTotal + rndMs + g.perfOverlay.cur.hud + g.perfOverlay.cur.controller);
        };

        stepOnce(0.2); // Aquecimento local (culling completo + entrada de zona)
        window.__legoPerf?.resetWindow?.();
        for (let f = 0; f < 4; f++) {
          stepOnce(0.016);
        }
        g.perfOverlay.updateDom(0.3, true);
        const shotDataUrl = g.renderer.domElement.toDataURL('image/jpeg', 0.82);

        const cam = new THREE.PerspectiveCamera(55, 1280 / 720, 2.0, Math.max(6000, g.camera.far));
        cam.position.set(p.x + (p.aerialDist || 260) * 0.55, p.aerialH || 280, p.z + (p.aerialDist || 260));
        cam.lookAt(p.x, Math.min(40, p.y), p.z);
        cam.updateMatrixWorld(true);
        g.renderer.render(g.scene, cam);
        const aerialDataUrl = g.renderer.domElement.toDataURL('image/jpeg', 0.8);

        return {
          shotDataUrl,
          aerialDataUrl,
          perf: window.__legoPerf?.getWindowStats?.() || {},
          cur: { ...(window.__legoPerf?.overlay?.cur || {}) },
          pipeline: window.__legoGame?.graphicsPipeline?.getStats?.() || {}
        };
      }, pt);

      if (metrics.shotDataUrl?.startsWith('data:image/jpeg;base64,')) {
        fs.writeFileSync(path.join(outDir, `${pt.id}.jpg`), Buffer.from(metrics.shotDataUrl.slice('data:image/jpeg;base64,'.length), 'base64'));
      }
      if (metrics.aerialDataUrl?.startsWith('data:image/jpeg;base64,')) {
        fs.writeFileSync(path.join(outDir, `${pt.id}_aerial.jpg`), Buffer.from(metrics.aerialDataUrl.slice('data:image/jpeg;base64,'.length), 'base64'));
      }
      delete metrics.shotDataUrl;
      delete metrics.aerialDataUrl;

      console.log(
        `  [${pt.id.padEnd(20)}] DC=${String(Math.round(metrics.perf.drawCalls?.avg || 0)).padStart(5)} | ` +
          `TRI=${((metrics.perf.triangles?.avg || 0) / 1e6).toFixed(2)}M | ` +
          `WLD=${(metrics.perf.worldTotal?.avg || 0).toFixed(2)}ms (FAC=${(metrics.perf.factionWar?.avg || 0).toFixed(2)}ms p90=${(metrics.perf.factionWar?.p90 || 0).toFixed(2)}ms)`
      );

      pointResults.push({
        id: pt.id,
        label: pt.label,
        pos: { x: pt.x, y: pt.y, z: pt.z },
        ...metrics
      });
    }

    const overviewDataUrl = await page.evaluate(async () => {
      const THREE = await import('three');
      const g = window.__legoGame;
      const prevFog = g.scene.fog;
      g.scene.fog = null;
      const cam = new THREE.PerspectiveCamera(52, 1280 / 720, 20.0, 32000);
      cam.position.set(0, 9200, 2600);
      cam.lookAt(0, 0, -200);
      cam.updateMatrixWorld(true);
      g.renderer.render(g.scene, cam);
      const url = g.renderer.domElement.toDataURL('image/jpeg', 0.85);
      g.scene.fog = prevFog;
      return url;
    });
    if (overviewDataUrl?.startsWith('data:image/jpeg;base64,')) {
      fs.writeFileSync(path.join(outDir, 'overview.jpg'), Buffer.from(overviewDataUrl.slice('data:image/jpeg;base64,'.length), 'base64'));
    }

    const report = {
      tag: args.tag,
      timestamp: new Date().toISOString(),
      preset: args.preset,
      loadTimeMs,
      sceneAudit: initInfo.sceneAudit,
      colliders: initInfo.colliders,
      mapBuildings: initInfo.mapBuildings,
      mapOrganicRoads: initInfo.mapOrganicRoads,
      pipelineStats: initInfo.pipelineStats,
      pageErrors,
      points: pointResults
    };

    const jsonPath = path.join(ROOT_DIR, 'docs', 'noite', `bench-${args.tag}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[bench:${args.tag}] Salvo em ${jsonPath} + prints em ${outDir}`);
  } finally {
    await browser.close();
    embedded?.server?.close();
  }
}

main().catch((err) => {
  console.error('[bench FATAL]', err);
  process.exit(1);
});
