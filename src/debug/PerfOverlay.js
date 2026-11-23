/**
 * PerfOverlay.js
 * Instrumentação de performance em tempo real (`?perf=1`) + auditoria de cena para benchmark automatizado.
 * Segue `IDV.md` (AAA Frameless Dark UI, JetBrains Mono tabular, zero caixotes arredondados, zero GC por frame).
 */

const SAMPLE_CAP = 180;

export function isPerfOverlayAllowed(searchStr = undefined) {
  const raw =
    typeof searchStr === 'string'
      ? searchStr
      : typeof window !== 'undefined' && window.location && typeof window.location.search === 'string'
        ? window.location.search
        : '';
  if (!raw) return false;
  try {
    const normalized = raw.startsWith('?') ? raw.slice(1) : raw;
    const params = new URLSearchParams(normalized);
    const val = params.get('perf');
    return val === '1' || val === 'true';
  } catch (_) {
    return /(?:^|[?&])perf=(?:1|true)(?:&|$)/i.test(raw);
  }
}

export function auditSceneGraph(scene, camera = null) {
  const mats = new Set();
  const geos = new Set();
  let meshes = 0;
  let instancedMeshes = 0;
  let totalInstances = 0;
  let shadowCasters = 0;
  let transparentMeshes = 0;
  let frustumUnculled = 0;
  let totalTriangles = 0;
  let dirLights = 0;
  let pointLights = 0;
  let spotLights = 0;
  let hemiLights = 0;

  if (scene && typeof scene.traverse === 'function') {
    scene.traverse((obj) => {
      if (!obj) return;
      if (obj.isDirectionalLight) dirLights++;
      else if (obj.isPointLight) pointLights++;
      else if (obj.isSpotLight) spotLights++;
      else if (obj.isHemisphereLight) hemiLights++;

      if (!obj.isMesh && !obj.isInstancedMesh && !obj.isBatchedMesh) return;
      meshes++;
      if (obj.frustumCulled === false) frustumUnculled++;
      if (obj.castShadow) shadowCasters++;

      let instCount = 1;
      if (obj.isInstancedMesh) {
        instancedMeshes++;
        instCount = Number.isFinite(obj.count) ? obj.count : 0;
        totalInstances += instCount;
      }

      const geo = obj.geometry;
      if (geo) {
        geos.add(geo);
        const idx = geo.index;
        const pos = geo.attributes?.position;
        const triPer = idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
        totalTriangles += triPer * Math.max(1, instCount);
      }

      const matList = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      let hasTransp = false;
      for (let i = 0; i < matList.length; i++) {
        const m = matList[i];
        if (!m) continue;
        mats.add(m);
        if (m.transparent) hasTransp = true;
      }
      if (hasTransp) transparentMeshes++;
    });
  }

  let physicalMaterials = 0;
  let standardMaterials = 0;
  let basicMaterials = 0;
  let lambertMaterials = 0;
  let shaderMaterials = 0;
  for (const m of mats) {
    if (m.isMeshPhysicalMaterial) physicalMaterials++;
    else if (m.isMeshStandardMaterial) standardMaterials++;
    else if (m.isMeshBasicMaterial) basicMaterials++;
    else if (m.isMeshLambertMaterial) lambertMaterials++;
    else if (m.isShaderMaterial || m.isRawShaderMaterial) shaderMaterials++;
  }

  const fog = scene?.fog || null;
  return {
    meshes,
    instancedMeshes,
    totalInstances,
    shadowCasters,
    uniqueMaterials: mats.size,
    physicalMaterials,
    standardMaterials,
    basicMaterials,
    lambertMaterials,
    shaderMaterials,
    uniqueGeometries: geos.size,
    totalTriangles,
    transparentMeshes,
    frustumUnculled,
    lights: { directional: dirLights, point: pointLights, spot: spotLights, hemisphere: hemiLights },
    cameraFar: camera?.far ?? null,
    fogDensity: fog?.isFogExp2 ? fog.density : null,
    fogNear: fog?.isFog ? fog.near : null,
    fogFar: fog?.isFog ? fog.far : null
  };
}

function computeMeanAndP90(buf, count) {
  if (count <= 0) return { avg: 0, p90: 0, max: 0 };
  let sum = 0;
  let max = 0;
  const copy = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const v = buf[i];
    sum += v;
    if (v > max) max = v;
    copy[i] = v;
  }
  copy.sort();
  const p90Idx = Math.min(count - 1, Math.floor(count * 0.9));
  return {
    avg: Number((sum / count).toFixed(3)),
    p90: Number(copy[p90Idx].toFixed(3)),
    max: Number(max.toFixed(3))
  };
}

export class PerfOverlay {
  constructor(renderer = null, opts = {}) {
    this.renderer = renderer || null;
    this.enabled = Boolean(opts.forceEnabled) || isPerfOverlayAllowed(opts.searchStr);
    this.el = null;
    this._refreshAccum = 0;

    this.cur = {
      controller: 0,
      destructibles: 0,
      livingCity: 0,
      factionWar: 0,
      police: 0,
      atmosphere: 0,
      worldTotal: 0,
      hud: 0,
      render: 0,
      frame: 0,
      drawCalls: 0,
      triangles: 0,
      programs: 0,
      geometries: 0,
      textures: 0
    };

    this._keys = [
      'controller',
      'destructibles',
      'livingCity',
      'factionWar',
      'police',
      'atmosphere',
      'worldTotal',
      'hud',
      'render',
      'frame',
      'drawCalls',
      'triangles'
    ];
    this._ring = {};
    for (const k of this._keys) {
      this._ring[k] = new Float64Array(SAMPLE_CAP);
    }
    this._ringCursor = 0;
    this._ringCount = 0;

    if (this.renderer?.info) {
      this.renderer.info.autoReset = false;
    }
    if (this.enabled) {
      this._mountDom();
    }
  }

  setRenderer(renderer) {
    this.renderer = renderer || null;
    if (this.renderer?.info) {
      this.renderer.info.autoReset = false;
    }
  }

  beginRenderFrame() {
    if (this.renderer?.info) {
      this.renderer.info.autoReset = false;
      this.renderer.info.reset();
    }
  }

  endRenderFrame(renderMs = 0, frameMs = 0) {
    const info = this.renderer?.info;
    this.cur.render = renderMs;
    this.cur.frame = frameMs;
    this.cur.drawCalls = info?.render?.calls ?? 0;
    this.cur.triangles = info?.render?.triangles ?? 0;
    this.cur.programs = info?.programs?.length ?? 0;
    this.cur.geometries = info?.memory?.geometries ?? 0;
    this.cur.textures = info?.memory?.textures ?? 0;

    const idx = this._ringCursor;
    for (let i = 0; i < this._keys.length; i++) {
      const k = this._keys[i];
      this._ring[k][idx] = this.cur[k] || 0;
    }
    this._ringCursor = (idx + 1) % SAMPLE_CAP;
    if (this._ringCount < SAMPLE_CAP) this._ringCount++;
  }

  resetWindow() {
    this._ringCursor = 0;
    this._ringCount = 0;
  }

  getWindowStats() {
    const out = {};
    const n = this._ringCount;
    for (let i = 0; i < this._keys.length; i++) {
      const k = this._keys[i];
      out[k] = computeMeanAndP90(this._ring[k], n);
    }
    out.samples = n;
    out.programs = this.cur.programs;
    out.geometries = this.cur.geometries;
    out.textures = this.cur.textures;
    return out;
  }

  _mountDom() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function' || this.el) return;
    const el = document.createElement('div');
    if (!el) return;
    el.id = 'hud-perf-overlay';
    el.setAttribute?.('aria-hidden', 'true');
    if (el.style) {
      el.style.cssText = [
        'font-family:"JetBrains Mono",monospace',
        'font-size:10.5px',
        'line-height:1.35',
        'color:#e2e8f0',
        'text-align:right',
        'text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,0.95)',
        'pointer-events:none',
        'user-select:none',
        'white-space:pre',
        'margin-top:4px',
        'letter-spacing:0.2px'
      ].join(';');
    }
    const host =
      (typeof document.getElementById === 'function' &&
        (document.getElementById('top-right-cluster') || document.getElementById('ui-overlay'))) ||
      document.body;
    host?.appendChild?.(el);
    this.el = el;
  }

  updateDom(dtSec = 0.016, visible = true) {
    if (!this.enabled) return;
    if (!this.el) this._mountDom();
    if (!this.el) return;
    if (!visible) {
      if (this.el.style.display !== 'none') this.el.style.display = 'none';
      return;
    }
    if (this.el.style.display === 'none') this.el.style.display = '';
    this._refreshAccum += Math.max(0, dtSec || 0);
    if (this._refreshAccum < 0.25) return;
    this._refreshAccum = 0;

    const c = this.cur;
    const trisK = (c.triangles / 1000).toFixed(0);
    this.el.textContent =
      `DC ${c.drawCalls} · TRI ${trisK}k · PRG ${c.programs}\n` +
      `GEO ${c.geometries} · TEX ${c.textures}\n` +
      `RND ${c.render.toFixed(1)} · WLD ${c.worldTotal.toFixed(1)} · FAC ${c.factionWar.toFixed(1)} ms\n` +
      `CIT ${c.livingCity.toFixed(1)} · POL ${c.police.toFixed(1)} · CTL ${c.controller.toFixed(1)} ms`;
  }

  dispose() {
    if (this.el?.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
  }
}
