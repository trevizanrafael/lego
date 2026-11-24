#!/usr/bin/env node
// Inspeção visual de um ponto do mapa: captura a vista de rua e a aérea (mesma câmera do
// benchmark) e faz raycast em pixels escolhidos, dizendo QUAL objeto/material/LOD está lá.
// Uso: node tools/bench/inspect-view.mjs --region centro_financeiro --out docs/noite/inspect \
//        [--pick aerial:230,330 --pick street:700,250] [--force-lod0]
import fs from 'node:fs';
import path from 'node:path';
import { openGameSession, ROOT_DIR } from './bench-session.mjs';

const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const picks = []; args.forEach((a, i) => { if (a === '--pick') picks.push(args[i + 1]); });
const region = val('--region', 'centro_financeiro');
const outDir = path.resolve(ROOT_DIR, val('--out', 'docs/noite/inspect'));
const forceLod0 = args.includes('--force-lod0');
const forward = Number(val('--forward', '0'));
const yawArg = Number(val('--yaw', '0'));
fs.mkdirSync(outDir, { recursive: true });

const { page, close } = await openGameSession();
try {
  const res = await page.evaluate(async ({ region, picks, forceLod0, forward, yawArg }) => {
    const THREE = await import('three');
    const g = window.__legoGame;
    const r = (g.world.regions || []).find((x) => x.id === region);
    if (!r) return { error: `região ${region} não encontrada` };
    const p = { x: r.spawn.x - Math.sin(yawArg) * forward, y: r.spawn.y, z: r.spawn.z - Math.cos(yawArg) * forward, aerialH: 280, aerialDist: 280 };
    const ctl = g.controller;
    ctl.position.set(p.x, Math.max(p.y, (g.world.getSurfaceHeightAt?.(p.x, p.z, p.y + 4) ?? p.y) + 0.1), p.z);
    ctl.yaw = yawArg; ctl.pitch = -0.05;
    const step = (dt) => { g.controller.update(dt); g.world.update(dt, ctl.position, ctl); g._renderScene(dt); };
    step(0.2); for (let i = 0; i < 4; i++) step(0.016);
    if (forceLod0) g.scene.traverse((o) => { if (o.isLOD) { o.autoUpdate = false; o.levels.forEach((l, i) => { l.object.visible = i === 0; }); } });
    g._renderScene(0.016);
    const street = g.renderer.domElement.toDataURL('image/jpeg', 0.85);
    const cam = new THREE.PerspectiveCamera(55, 1280 / 720, 2.0, Math.max(6000, g.camera.far));
    cam.position.set(p.x + p.aerialDist * 0.55, p.aerialH, p.z + p.aerialDist);
    cam.lookAt(p.x, Math.min(40, p.y), p.z);
    cam.updateMatrixWorld(true);
    g.renderer.render(g.scene, cam);
    const aerial = g.renderer.domElement.toDataURL('image/jpeg', 0.85);
    const ray = new THREE.Raycaster();
    const out = [];
    for (const spec of picks) {
      const [view, xy] = spec.split(':');
      const [px, py] = xy.split(',').map(Number);
      const c = view === 'aerial' ? cam : g.camera;
      ray.setFromCamera(new THREE.Vector2((px / 1280) * 2 - 1, -(py / 720) * 2 + 1), c);
      const hits = ray.intersectObjects(g.scene.children, true).filter((h) => h.object.visible !== false && h.object.isMesh);
      const h = hits.find((hh) => { let v = true; for (let q = hh.object; q; q = q.parent) if (q.visible === false) v = false; return v; });
      if (!h) { out.push({ spec, hit: null }); continue; }
      const o = h.object; const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const chain = []; let lodInfo = null;
      for (let q = o; q; q = q.parent) {
        chain.push(q.name || q.type);
        if (q.parent?.isLOD) lodInfo = { lod: q.parent.name, level: q.parent.levels.findIndex((l) => l.object === q), current: q.parent.getCurrentLevel?.() };
      }
      out.push({
        spec, dist: +h.distance.toFixed(1), point: h.point.toArray().map((v) => +v.toFixed(1)),
        chain: chain.slice(0, 6), lodInfo,
        material: { type: m?.type, name: m?.name, color: m?.color?.getHexString?.(), emissive: m?.emissive?.getHexString?.(), emissiveIntensity: m?.emissiveIntensity, map: Boolean(m?.map), emissiveMap: Boolean(m?.emissiveMap), vertexColors: m?.vertexColors },
        geo: { uv: Boolean(o.geometry?.attributes?.uv), color: Boolean(o.geometry?.attributes?.color), verts: o.geometry?.attributes?.position?.count }
      });
    }
    return { street, aerial, out };
  }, { region, picks, forceLod0, forward, yawArg });
  if (res.error) throw new Error(res.error);
  const tag = forceLod0 ? '_lod0' : '';
  fs.writeFileSync(path.join(outDir, `${region}${tag}_street.jpg`), Buffer.from(res.street.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(outDir, `${region}${tag}_aerial.jpg`), Buffer.from(res.aerial.split(',')[1], 'base64'));
  console.log(JSON.stringify(res.out, null, 1));
} finally {
  await close();
}
