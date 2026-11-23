import * as THREE from 'three';
import { getLegoMaterial, markAsSharedAsset } from '../materials/LegoMaterials.js';

const SIGN_REDRAW_REGISTRY = [];
const SIGN_EDGE_MAT_CACHE = new Map();
const SIGN_SLOT_CACHE = new Map();
const SIGN_BOX_GEO_CACHE = new Map();
const SIGN_ATLAS_PAGES = {
  wide: [],     // 2048x256 pages com 4 slots de 1024x128 (2x2)
  standard: []  // 2048x256 pages com 8 slots de 512x128 (4x2)
};

let fontReadyListenerBound = false;
let fontsReadyResolved = false;

function getSharedSignBoxGeometry(w, h, d, doubleSided, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
  const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${doubleSided ? 1 : 0}_${u0.toFixed(4)}_${v0.toFixed(4)}_${u1.toFixed(4)}_${v1.toFixed(4)}`;
  const cached = SIGN_BOX_GEO_CACHE.get(key);
  if (cached) return cached;

  const geo = new THREE.BoxGeometry(w, h, d);
  if (u0 !== 0 || v0 !== 0 || u1 !== 1 || v1 !== 1) {
    const uv = geo.attributes.uv;
    if (uv && uv.count >= 24) {
      const du = u1 - u0;
      const dv = v1 - v0;
      for (let i = 16; i < 24; i++) {
        uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
      }
      uv.needsUpdate = true;
    }
  }
  geo.clearGroups();
  // BoxGeometry gera 6 faces de 6 índices cada: 0..5(+X), 6..11(-X), 12..17(+Y), 18..23(-Y), 24..29(+Z), 30..35(-Z)
  geo.addGroup(0, 24, 0);
  geo.addGroup(24, 6, 4);
  geo.addGroup(30, 6, doubleSided ? 5 : 0);

  markAsSharedAsset(geo);
  SIGN_BOX_GEO_CACHE.set(key, geo);
  return geo;
}

function getSharedSignEdgeMaterial(edgeHex) {
  if (SIGN_EDGE_MAT_CACHE.has(edgeHex)) {
    return SIGN_EDGE_MAT_CACHE.get(edgeHex);
  }
  const mat = getLegoMaterial(edgeHex, { roughness: 0.48, metalness: 0.14 });
  SIGN_EDGE_MAT_CACHE.set(edgeHex, mat);
  return mat;
}

function ensureFontReadyRedrawListener() {
  if (fontReadyListenerBound) return;
  fontReadyListenerBound = true;

  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(() => {
      fontsReadyResolved = true;
      for (let i = 0; i < SIGN_REDRAW_REGISTRY.length; i++) {
        try {
          SIGN_REDRAW_REGISTRY[i]();
        } catch (_) {
          // ignora placas descartadas
        }
      }
      SIGN_REDRAW_REGISTRY.length = 0;
    });
  }
}

export function measureCanvasTextWidth(ctx, text, fontSize) {
  const str = String(text ?? '');
  if (!str) return 0;
  if (ctx && typeof ctx.measureText === 'function') {
    const m = ctx.measureText(str);
    if (m && typeof m.width === 'number' && m.width > 0) {
      return m.width;
    }
  }
  return str.length * fontSize * 0.62;
}

export function fitAndDrawText(
  ctx,
  text,
  centerX,
  centerY,
  maxWidth,
  initialFontSize,
  opts = {}
) {
  const str = String(text ?? '').trim();
  if (!str || !ctx) return initialFontSize;

  const minFontSize = opts.minFontSize ?? 12;
  const fontWeight = opts.fontWeight ?? '900';
  const fontFamily = opts.fontFamily ?? '"Chakra Petch", Arial, sans-serif';
  const fillStyle = opts.color ?? '#ffffff';

  let fontSize = Math.max(minFontSize, Math.round(initialFontSize));
  while (fontSize > minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const w = measureCanvasTextWidth(ctx, str, fontSize);
    if (w <= maxWidth) break;
    fontSize -= 2;
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, centerX, centerY);
  return fontSize;
}

export function createCustomCanvasSignTexture(boardWidth, boardHeight, drawFn, opts = {}) {
  ensureFontReadyRedrawListener();

  const canvasH = opts.canvasHeight ?? 256;
  const aspect = Math.max(0.35, Math.abs(boardWidth) / Math.max(0.25, Math.abs(boardHeight)));
  const defaultMinW = canvasH <= 128 ? 256 : 512;
  const minW = aspect < 1.0 ? Math.min(256, canvasH * 2) : (opts.minCanvasW ?? defaultMinW);
  const canvasW = THREE.MathUtils.clamp(Math.round(canvasH * aspect), minW, 2048);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;

  const render = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawFn(ctx, canvasW, canvasH);
    tex.needsUpdate = true;
  };

  render();
  if (!fontsReadyResolved) {
    SIGN_REDRAW_REGISTRY.push(render);
  }
  return tex;
}

function allocateSignAtlasSlot(isWide, drawSlotFn) {
  ensureFontReadyRedrawListener();
  const pool = isWide ? SIGN_ATLAS_PAGES.wide : SIGN_ATLAS_PAGES.standard;
  const cols = isWide ? 4 : 8;
  const rows = isWide ? 6 : 8;
  const capacity = cols * rows;
  const slotW = 2048 / cols;
  const slotH = Math.floor(256 / rows);

  let page = pool.length > 0 ? pool[pool.length - 1] : null;
  if (!page || page.used >= capacity) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    markAsSharedAsset(tex);

    const faceMat = markAsSharedAsset(new THREE.MeshBasicMaterial({ map: tex }));
    faceMat.userData.isSignAtlasMaterial = true;
    page = { canvas, ctx, tex, faceMat, used: 0 };
    pool.push(page);
  }

  const slotIdx = page.used++;
  const col = slotIdx % cols;
  const row = Math.floor(slotIdx / cols);
  const px = col * slotW;
  const py = row * slotH;

  const renderSlot = () => {
    const ctx = page.ctx;
    if (!ctx) return;
    ctx.save?.();
    ctx.clearRect?.(px, py, slotW, slotH);
    if (typeof ctx.beginPath === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect?.(px, py, slotW, slotH);
      ctx.clip();
    }
    ctx.translate?.(px, py);
    drawSlotFn(ctx, slotW, slotH);
    ctx.restore?.();
    page.tex.needsUpdate = true;
  };

  renderSlot();
  if (!fontsReadyResolved) {
    SIGN_REDRAW_REGISTRY.push(renderSlot);
  }

  const padU = 1 / 2048;
  const padV = 1 / 256;
  const u0 = px / 2048 + padU;
  const u1 = (px + slotW) / 2048 - padU;
  // CanvasTexture flipY=true: row 0 (topo) -> v em [0.5, 1.0], row 1 (base) -> v em [0.0, 0.5]
  const v0 = 1 - (py + slotH) / 256 + padV;
  const v1 = 1 - py / 256 - padV;

  return { faceMat: page.faceMat, u0, v0, u1, v1 };
}

/**
 * Cria uma Placa 3D Universal empacotada em páginas de Atlas 2048x256 (reduz ~115 materiais para ~14),
 * preservando array de 6 materiais, mipmaps trilineares e zero corte lateral.
 */
export function createSignBoardMesh(opts = {}) {
  const boardWidth = Math.max(0.4, Number(opts.width ?? 8.0));
  const boardHeight = Math.max(0.3, Number(opts.height ?? 1.8));
  const thickness = Math.max(0.08, Number(opts.depth ?? 0.45));

  const title = String(opts.title ?? '').trim();
  const subText = String(opts.subText ?? '').trim();
  const bgColor = opts.bgColor ?? '#090a0d';
  const borderColor = opts.borderColor ?? '#facc15';
  const textColor = opts.textColor ?? '#ffffff';
  const subColor = opts.subColor ?? '#facc15';
  const topStripeColor = opts.topStripeColor ?? null;
  const bottomStripeColor = opts.bottomStripeColor ?? null;
  const edgeHex = opts.edgeHex ?? new THREE.Color(bgColor).getHex();
  const doubleSided = opts.doubleSided !== false;

  const aspect = boardWidth / boardHeight;
  const isWide = aspect >= 4.5 || boardWidth >= 18;
  const aspectBucket = aspect.toFixed(1);
  const slotCacheKey = `${title}|${subText}|${bgColor}|${borderColor}|${textColor}|${subColor}|${topStripeColor || ''}|${bottomStripeColor || ''}|${aspectBucket}|${isWide ? 'W' : 'S'}`;

  let slot = SIGN_SLOT_CACHE.get(slotCacheKey);
  if (!slot) {
    slot = allocateSignAtlasSlot(isWide, (ctx, W, H) => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      if (topStripeColor) {
        const stripeH = Math.round(H * 0.11);
        ctx.fillStyle = topStripeColor;
        ctx.fillRect(0, 0, W, stripeH);
      }
      if (bottomStripeColor) {
        const stripeH = Math.round(H * 0.09);
        ctx.fillStyle = bottomStripeColor;
        ctx.fillRect(0, H - stripeH, W, stripeH);
      }

      if (borderColor) {
        const bw = Math.max(3, Math.round(H * 0.045));
        const pad = Math.round(bw * 0.9);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = bw;
        ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      }

      const maxTextW = W * 0.82;
      if (subText) {
        fitAndDrawText(ctx, title, W * 0.5, H * 0.41, maxTextW, Math.round(H * 0.31), {
          color: textColor,
          fontWeight: '900',
          fontFamily: opts.titleFont ?? '"Chakra Petch", Arial, sans-serif'
        });
        fitAndDrawText(ctx, subText, W * 0.5, H * 0.73, maxTextW, Math.round(H * 0.175), {
          color: subColor,
          fontWeight: '800',
          fontFamily: opts.subFont ?? '"JetBrains Mono", "Chakra Petch", monospace'
        });
      } else {
        fitAndDrawText(ctx, title, W * 0.5, H * 0.52, maxTextW, Math.round(H * 0.42), {
          color: textColor,
          fontWeight: '900',
          fontFamily: opts.titleFont ?? '"Chakra Petch", Arial, sans-serif'
        });
      }
    });
    SIGN_SLOT_CACHE.set(slotCacheKey, slot);
  }

  const edgeMat = getSharedSignEdgeMaterial(edgeHex);
  const faceMat = slot.faceMat;

  const materials = [
    edgeMat,
    edgeMat,
    edgeMat,
    edgeMat,
    faceMat,
    doubleSided ? faceMat : edgeMat
  ];

  const mesh = new THREE.Mesh(
    getSharedSignBoxGeometry(boardWidth, boardHeight, thickness, doubleSided, slot.u0, slot.v0, slot.u1, slot.v1),
    materials
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  if (opts.position) {
    mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
  } else if (typeof opts.x === 'number') {
    mesh.position.set(opts.x, opts.y ?? 0, opts.z ?? 0);
  }
  if (typeof opts.rotY === 'number') {
    mesh.rotation.y = opts.rotY;
  }

  return mesh;
}
