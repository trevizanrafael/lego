import * as THREE from 'three';
import { configureCrispCanvasTexture, markAsSharedAsset } from './PaletteAndPbrCache.js';
import { paintCoreHeroFace } from './HeroCoreFacePainters.js';
import { paintVigilanteHeroFace } from './HeroVigilanteFacePainters.js';
import { paintElementalHeroFace } from './HeroElementalFacePainters.js';

/**
 * Geradores procedurais Canvas 2D de rostos para heróis, expressões civis e facções urbanas,
 * com caches compartilhados de texturas e materiais faciais de NPCs.
 */
const HERO_FACE_TEX_CACHE = new Map();
export const SHARED_NPC_FACE_TEXTURES = new Map();
const SHARED_NPC_FACE_MATERIALS = new Map();

export function createMinifigFaceTexture(preset = 'caveira') {
  const cacheKey = typeof preset === 'string' ? preset : null;
  if (cacheKey && HERO_FACE_TEX_CACHE.has(cacheKey)) {
    return HERO_FACE_TEX_CACHE.get(cacheKey);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fundo amarelo clássico LEGO (ou customizado)
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // O centro da face no CylinderGeometry (com rotação padrão) fica em X = 256
  const cx = 256;
  const cy = 128;

  const paintedHero =
    paintCoreHeroFace(ctx, preset, cx, cy) ||
    paintVigilanteHeroFace(ctx, preset, cx) ||
    paintElementalHeroFace(ctx, preset, cx);

  if (!paintedHero) {
    // Rosto clássico LEGO feliz/aventureiro
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.arc(cx - 30, cy - 10, 10, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy - 10, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 33, cy - 13, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 27, cy - 13, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#171717';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 12, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const tex = configureCrispCanvasTexture(new THREE.CanvasTexture(canvas), 8);
  if (cacheKey) {
    markAsSharedAsset(tex);
    HERO_FACE_TEX_CACHE.set(cacheKey, tex);
  }
  return tex;
}

export function createNpcFaceTexture(faceKey = 'civ_smile') {
  if (SHARED_NPC_FACE_TEXTURES.has(faceKey)) {
    return SHARED_NPC_FACE_TEXTURES.get(faceKey);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const cx = 128;

  if (faceKey === 'pcc_balaclava') {
    // Balaclava Preta Tática do PCC com costura azul-marinho e fenda dos olhos furiosos
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 256, 128);

    // Faixas táticas laterais azul-escuro/branco
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 14, 256, 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 24, 256, 2.5);

    // Abertura amarela LEGO da fenda dos olhos na balaclava
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(cx - 46, 38, 92, 28, 8);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Sobrancelhas furiosas e olhos ferozes
    for (const s of [-1, 1]) {
      const ex = cx + s * 22;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 53, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, 51, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(ex - s * 13, 47);
      ctx.lineTo(ex + s * 11, 41);
      ctx.stroke();
    }

    // Costura respiratória inferior da balaclava
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let x = cx - 24; x <= cx + 24; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 78);
      ctx.lineTo(x, 96);
      ctx.stroke();
    }
  } else if (faceKey === 'ares_cyber') {
    // Capacete Cyber-Militar A.R.E.S. com Visor Neon Roxo/Magenta em V
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 58, 22, 116, 86);

    // Visor Neon Magenta/Roxo em V
    ctx.fillStyle = '#d946ef';
    ctx.beginPath();
    ctx.moveTo(cx - 48, 36);
    ctx.lineTo(cx, 48);
    ctx.lineTo(cx + 48, 36);
    ctx.lineTo(cx + 42, 58);
    ctx.lineTo(cx, 66);
    ctx.lineTo(cx - 42, 58);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.moveTo(cx - 36, 42);
    ctx.lineTo(cx, 51);
    ctx.lineTo(cx + 36, 42);
    ctx.lineTo(cx + 32, 49);
    ctx.lineTo(cx, 57);
    ctx.lineTo(cx - 32, 49);
    ctx.closePath();
    ctx.fill();

    // Grade vocal cyber
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    for (let x = cx - 24; x <= cx + 24; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 76);
      ctx.lineTo(x, 98);
      ctx.stroke();
    }
  } else if (faceKey === 'cv_juliet') {
    // Soldado do CV: Rosto Amarelo LEGO mal-encarado com Bandana Vermelha e Óculos Juliet Espelhado Rubi/Fogo
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    // Faixa da Bandana Vermelha na testa
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 8, 256, 22);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 27, 256, 3);

    // Armação X-Metal Prata Escura da Juliet + Ponte nasal
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 56, 46);
    ctx.lineTo(cx + 56, 46);
    ctx.stroke();

    // Lentes Ovais Espelhadas Rubi/Fogo (Juliet)
    for (const s of [-1, 1]) {
      const lx = cx + s * 25;
      const grad = ctx.createLinearGradient(lx - 18, 36, lx + 18, 60);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(0.55, '#f97316');
      grad.addColorStop(1, '#facc15');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(lx, 48, 21, 12, s * -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#090a0d';
      ctx.stroke();

      // Reflexo branco diagonal na lente espelhada
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx - 10, 42);
      ctx.lineTo(lx + 4, 52);
      ctx.stroke();
    }

    // Boca mal-encarada de dentes cerrados + cicatriz e cavanhaque
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 24, 74, 48, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 22, 82);
    ctx.lineTo(cx + 22, 82);
    for (let x = cx - 12; x <= cx + 12; x += 12) {
      ctx.moveTo(x, 74);
      ctx.lineTo(x, 90);
    }
    ctx.stroke();
  } else if (faceKey === 'bope_tactical') {
    // Policial do BOPE: Pintura de guerra camuflada nas bochechas + expressão feroz de operações especiais
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    // Listras de pintura de guerra preta/cinza nas bochechas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    for (const s of [-1, 1]) {
      ctx.fillRect(cx + s * 28 - 12, 62, 24, 6);
      ctx.fillRect(cx + s * 28 - 10, 72, 20, 5);
    }

    // Olhos focados + sobrancelhas táticas grossas
    for (const s of [-1, 1]) {
      const ex = cx + s * 22;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, 46, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ex - s * 14, 40);
      ctx.lineTo(ex + s * 12, 34);
      ctx.stroke();
    }

    // Boca firme tática + tira de jugular do capacete/boina
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 18, 82);
    ctx.lineTo(cx, 78);
    ctx.lineTo(cx + 18, 82);
    ctx.stroke();
  } else if (faceKey === 'civ_panic') {
    // Pedestre Civil em PÂNICO: Olhos arregalados e boca aberta em "O" gritando!
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    for (const s of [-1, 1]) {
      const ex = cx + s * 22;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, 48, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Sobrancelhas arqueadas de susto
      ctx.beginPath();
      ctx.moveTo(ex - s * 12, 30);
      ctx.lineTo(ex + s * 12, 37);
      ctx.stroke();
    }

    // Boca aberta gritando em "O"
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(cx, 82, 14, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 9, 67, 18, 5);
  } else if (faceKey === 'civ_shades') {
    // Pedestre Civil com Óculos de Sol Estiloso e Sorriso Confiante
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#090a0d';
    ctx.fillRect(cx - 50, 38, 100, 5);
    for (const s of [-1, 1]) {
      const lx = cx + s * 23;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(lx - 18, 38, 36, 20, 5);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx - 10, 42);
      ctx.lineTo(lx + 4, 54);
      ctx.stroke();
    }

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, 72, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (faceKey === 'civ_cool') {
    // Pedestre Civil Descolado com Sobrancelha Arqueada e Sorriso de Canto
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    for (const s of [-1, 1]) {
      const ex = cx + s * 21;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, 46, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ex - 11, s < 0 ? 36 : 33);
      ctx.lineTo(ex + 11, s < 0 ? 34 : 38);
      ctx.stroke();
    }

    // Sorriso confiante com dentes brancos
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(cx + 2, 72, 19, 0.08 * Math.PI, 0.88 * Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // civ_smile: Rosto LEGO Clássico Sorridente
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    for (const s of [-1, 1]) {
      const ex = cx + s * 21;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2.2, 45.8, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.arc(ex, 44, 12, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    }

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, 70, 21, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const tex = configureCrispCanvasTexture(new THREE.CanvasTexture(canvas), 8);
  markAsSharedAsset(tex);
  SHARED_NPC_FACE_TEXTURES.set(faceKey, tex);
  return tex;
}

export function getSharedNpcFaceMaterial(faceKey = 'civ_smile') {
  if (SHARED_NPC_FACE_MATERIALS.has(faceKey)) {
    return SHARED_NPC_FACE_MATERIALS.get(faceKey);
  }
  const tex = createNpcFaceTexture(faceKey);
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.2,
    clearcoat: 0.45
  });
  markAsSharedAsset(mat);
  SHARED_NPC_FACE_MATERIALS.set(faceKey, mat);
  return mat;
}
