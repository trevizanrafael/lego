import * as THREE from 'three';
import {
  getLegoMaterial,
  createLegoBrick,
  markAsSharedAsset
} from '../../materials/LegoMaterials.js';
import {
  getActiveCustomHero,
  setActiveCustomHero,
  findHeadColor,
  findPaletteColor,
  getOp09CatalogEntry
} from './CustomHeroCatalogAndSave.js';

const CUSTOM_FACE_TEX_CACHE = new Map();
const CUSTOM_TORSO_TEX_CACHE = new Map();

// ============================================================================
// 1. TEXTURAS 2D INÉDITAS DE ROSTO, TORSO E RETRATO DA HUD / RODA [TAB]
// ============================================================================
export function drawCustomFaceDetails2D(ctx, cx, cy, scale, faceId) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (faceId === 'aviator_shades') {
    ctx.fillStyle = '#090a0d';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-24, -12, 20, 13, 4);
    ctx.roundRect(4, -12, 20, 13, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.lineTo(26, -8);
    ctx.stroke();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 8, 10, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (faceId === 'tech_visor') {
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(-26, -12, 52, 12);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-22, -9, 44, 6);
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-9, 11);
    ctx.lineTo(9, 11);
    ctx.stroke();
  } else if (faceId === 'domino_mask') {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(-25, -14, 50, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-11, -6.5, 6, 3.5, -0.1, 0, Math.PI * 2);
    ctx.ellipse(11, -6.5, 6, 3.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 8, 9, 0.1 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (faceId === 'urban_goatee') {
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.arc(-10, -6, 3.5, 0, Math.PI * 2);
    ctx.arc(10, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-15, -13, 10, 2.5);
    ctx.fillRect(5, -13, 10, 2.5);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 3.2;
    ctx.strokeRect(-9, 5, 18, 11);
  } else if (faceId === 'bionic_eye') {
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.arc(-10, -6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(3, -14, 16, 16);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(11, -6, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(10, 8);
    ctx.stroke();
  } else if (faceId === 'led_robot') {
    ctx.fillStyle = '#090a0d';
    ctx.roundRect(-23, -15, 46, 29, 5);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-16, -9, 10, 7);
    ctx.fillRect(6, -9, 10, 7);
    for (let gx = -14; gx <= 10; gx += 6) {
      ctx.fillRect(gx, 4, 4, 5);
    }
  } else if (faceId === 'elemental_eyes') {
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-11, -6, 6.5, 4.2, -0.15, 0, Math.PI * 2);
    ctx.ellipse(11, -6, 6.5, 4.2, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 9, 8.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // classic_smile (Cidadão Comum / Sorriso Clássico LEGO!)
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.arc(-10, -6, 3.6, 0, Math.PI * 2);
    ctx.arc(10, -6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-11, -7.2, 1.1, 0, Math.PI * 2);
    ctx.arc(9, -7.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 4, 11, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

export function createCustomFaceTexture(cfg = getActiveCustomHero()) {
  const headCol = findHeadColor(cfg.isCreated ? cfg.headColorId : 'lego_yellow');
  const faceId = cfg.isCreated ? cfg.faceId : 'classic_smile';
  const cacheKey = `${headCol.id}_${faceId}`;
  if (CUSTOM_FACE_TEX_CACHE.has(cacheKey)) {
    return CUSTOM_FACE_TEX_CACHE.get(cacheKey);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = headCol.css;
    ctx.fillRect(0, 0, 256, 256);
    drawCustomFaceDetails2D(ctx, 128, 132, 2.75, faceId);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  markAsSharedAsset(tex);
  CUSTOM_FACE_TEX_CACHE.set(cacheKey, tex);
  return tex;
}

export function createCustomTorsoTexture(cfg = getActiveCustomHero()) {
  const torsoCol = findPaletteColor(cfg.isCreated ? cfg.torsoColorId : 'blue', 0);
  const printId = cfg.isCreated ? cfg.torsoPrintId : 'basic_shirt';
  const cacheKey = `${torsoCol.id}_${printId}`;
  if (CUSTOM_TORSO_TEX_CACHE.has(cacheKey)) {
    return CUSTOM_TORSO_TEX_CACHE.get(cacheKey);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = torsoCol.css;
    ctx.fillRect(0, 0, 256, 256);

    if (printId === 'basic_shirt') {
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(128, 18, 34, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (printId === 'open_jacket') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(88, 0, 80, 256);
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 6;
      ctx.strokeRect(88, -4, 80, 264);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(80, 30, 8, 200);
      ctx.fillRect(168, 30, 8, 200);
    } else if (printId === 'urban_hoodie_pocket') {
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(106, 24);
      ctx.lineTo(106, 92);
      ctx.moveTo(150, 24);
      ctx.lineTo(150, 92);
      ctx.stroke();
      ctx.fillStyle = 'rgba(9,10,13,0.28)';
      ctx.beginPath();
      ctx.moveTo(64, 152);
      ctx.lineTo(192, 152);
      ctx.lineTo(208, 232);
      ctx.lineTo(48, 232);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (printId === 'elegant_suit') {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(92, 0);
      ctx.lineTo(164, 0);
      ctx.lineTo(128, 138);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(120, 14);
      ctx.lineTo(136, 14);
      ctx.lineTo(142, 118);
      ctx.lineTo(128, 138);
      ctx.lineTo(114, 118);
      ctx.closePath();
      ctx.fill();
    } else if (printId === 'star_emblem') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 58 : 25;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = 128 + Math.cos(a) * r;
        const py = 112 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 218, 256, 26);
    } else if (printId === 'atom_emblem') {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 6;
      for (const rot of [0, Math.PI / 3, -Math.PI / 3]) {
        ctx.save();
        ctx.translate(128, 112);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(128, 112, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (printId === 'lab_coat') {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(92, 0, 72, 256);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 92, 256);
      ctx.fillRect(164, 0, 92, 256);
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.strokeRect(22, 130, 52, 62);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(32, 118, 8, 14);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(46, 118, 8, 14);
    } else if (printId === 'futuristic_vest') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(28, 20, 200, 216);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(32, 24, 192, 208);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(98, 66, 60, 42);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(46, 152, 46, 56);
      ctx.fillRect(164, 152, 46, 56);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  markAsSharedAsset(tex);
  CUSTOM_TORSO_TEX_CACHE.set(cacheKey, tex);
  return tex;
}

/**
 * Desenha o Retrato 2D LEGO exato do OP-09 (Cidadão Comum ou Herói Customizado)
 */
export function drawOp09Portrait2D(ctx, w, h, cfg = getActiveCustomHero()) {
  const isCreated = Boolean(cfg?.isCreated);
  const headCol = findHeadColor(isCreated ? cfg.headColorId : 'lego_yellow');
  const torsoCol = findPaletteColor(isCreated ? cfg.torsoColorId : 'blue', 0);
  const hairCol = findPaletteColor(isCreated ? cfg.hairColorId : 'brown', 12);
  const hairId = isCreated ? cfg.hairId : 'none';
  const faceId = isCreated ? cfg.faceId : 'classic_smile';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d1017';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = Math.max(3, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  ctx.lineTo(w * 0.75, 0);
  ctx.stroke();

  const scale = w / 76;
  ctx.save();
  ctx.scale(scale, scale);

  // Pino LEGO superior
  if (hairId === 'none' || hairId === 'dj_headphones') {
    ctx.fillStyle = headCol.css;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(76 * 0.37, 9, 76 * 0.26, 9, 2);
    ctx.fill();
    ctx.stroke();
  }

  // Cabelo comprido / capuz por trás
  if (hairId === 'long_hair' || hairId === 'urban_hoodie') {
    ctx.fillStyle = hairCol.css;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(11, 11, 54, 46, 10);
    ctx.fill();
    ctx.stroke();
  }

  // Cabeça LEGO
  ctx.fillStyle = headCol.css;
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(76 * 0.22, 17, 76 * 0.56, 38, 6);
  ctx.fill();
  ctx.stroke();

  // Ombros / Torso
  ctx.fillStyle = torsoCol.css;
  ctx.beginPath();
  ctx.roundRect(76 * 0.14, 54, 76 * 0.72, 24, 4);
  ctx.fill();
  ctx.stroke();

  // Rosto 2D
  drawCustomFaceDetails2D(ctx, 38, 37, 0.78, faceId);

  // Cabelo / Acessório Superior 2D
  ctx.fillStyle = hairCol.css;
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.2;
  if (hairId === 'classic_quiff') {
    ctx.beginPath();
    ctx.roundRect(15, 10, 46, 12, 5);
    ctx.fill();
    ctx.stroke();
  } else if (hairId === 'urban_mohawk') {
    ctx.fillRect(32, 4, 12, 16);
    ctx.strokeRect(32, 4, 12, 16);
  } else if (hairId === 'afro_power') {
    ctx.beginPath();
    ctx.arc(38, 22, 25, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.stroke();
  } else if (hairId === 'flat_cap') {
    ctx.fillRect(16, 10, 44, 11);
    ctx.strokeRect(16, 10, 44, 11);
    ctx.fillRect(14, 19, 52, 4);
  } else if (hairId === 'beanie') {
    ctx.beginPath();
    ctx.roundRect(15, 8, 46, 15, 7);
    ctx.fill();
    ctx.stroke();
  } else if (hairId === 'astro_helmet') {
    ctx.strokeStyle = hairCol.css;
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 11, 48, 44);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.48)';
    ctx.fillRect(19, 22, 38, 20);
  } else if (hairId === 'dj_headphones') {
    ctx.strokeStyle = hairCol.css;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(38, 30, 25, Math.PI, 0);
    ctx.stroke();
    ctx.fillRect(10, 25, 7, 16);
    ctx.fillRect(59, 25, 7, 16);
  }

  ctx.restore();
}

// ============================================================================
// 2. MONTAGEM 3D DAS PEÇAS INÉDITAS NO RIG DA MINIFIGURA & PREVIEW 3D NO CONSOLE
// ============================================================================
export function attachOp09CustomRigToMinifigure(minifig, cfg = getActiveCustomHero()) {
  const isCreated = Boolean(cfg?.isCreated);
  const hairId = isCreated ? cfg.hairId : 'none';
  const hairCol = findPaletteColor(isCreated ? cfg.hairColorId : 'brown', 12);
  const backId = isCreated ? cfg.backId : 'none';
  const backCol = findPaletteColor(isCreated ? cfg.backColorId : 'crimson', 1);
  const torsoCol = findPaletteColor(isCreated ? cfg.torsoColorId : 'blue', 0);

  const hairMat = getLegoMaterial(hairCol.hex, { roughness: 0.25, clearcoat: 0.4 });
  const backMat = getLegoMaterial(backCol.hex, { roughness: 0.25, clearcoat: 0.4 });
  const darkMat = getLegoMaterial(0x111827, { roughness: 0.3 });

  // 2.1 Cabelos e Acessórios de Cabeça 100% Exclusivos
  if (minifig.headGroup && hairId !== 'none') {
    const hg = new THREE.Group();
    if (hairId === 'classic_quiff') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.78), hairMat);
      top.position.set(0, 0.62, 0.03);
      const wave = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.26), hairMat);
      wave.position.set(0, 0.69, 0.32);
      wave.rotation.x = -0.25;
      hg.add(top, wave);
    } else if (hairId === 'urban_mohawk') {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), hairMat);
        spike.position.set(0, 0.72 - i * 0.03, 0.24 - i * 0.14);
        spike.rotation.x = -i * 0.12;
        hg.add(spike);
      }
    } else if (hairId === 'afro_power') {
      const afro = new THREE.Mesh(new THREE.SphereGeometry(0.54, 18, 14), hairMat);
      afro.position.set(0, 0.56, -0.03);
      hg.add(afro);
    } else if (hairId === 'long_hair') {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.78), hairMat);
      crown.position.set(0, 0.62, 0);
      const backLocks = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.72, 0.24), hairMat);
      backLocks.position.set(0, 0.32, -0.3);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.55), hairMat);
      sideL.position.set(-0.37, 0.36, -0.05);
      const sideR = sideL.clone();
      sideR.position.x = 0.37;
      hg.add(crown, backLocks, sideL, sideR);
    } else if (hairId === 'flat_cap') {
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.39, 0.24, 18), hairMat);
      dome.position.set(0, 0.6, 0);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.42), hairMat);
      brim.position.set(0, 0.5, 0.32);
      hg.add(dome, brim);
    } else if (hairId === 'beanie') {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
        hairMat
      );
      cap.position.set(0, 0.46, 0);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.14, 18), hairMat);
      cuff.position.set(0, 0.52, 0);
      hg.add(cap, cuff);
    } else if (hairId === 'urban_hoodie') {
      const hoodOuter = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.72, 0.82), hairMat);
      hoodOuter.position.set(0, 0.38, -0.06);
      hg.add(hoodOuter);
    } else if (hairId === 'astro_helmet') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.47, 20, 16), hairMat);
      shell.position.set(0, 0.36, 0);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.32, 0.22),
        new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          roughness: 0.08,
          metalness: 0.35,
          transparent: true,
          opacity: 0.62
        })
      );
      visor.position.set(0, 0.36, 0.36);
      hg.add(shell, visor);
    } else if (hairId === 'dj_headphones') {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.41, 0.05, 8, 20, Math.PI),
        hairMat
      );
      arch.position.set(0, 0.36, 0);
      const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), hairMat);
      earL.rotation.z = Math.PI / 2;
      earL.position.set(-0.4, 0.34, 0);
      const earR = earL.clone();
      earR.position.x = 0.4;
      hg.add(arch, earL, earR);
    }
    minifig.headGroup.add(hg);
  }

  // 2.2 Acessórios de Costas 100% Exclusivos (+ Chamas de Jetpack se aplicável)
  minifig.op09JetFlames = [];
  const wantsJetpackMesh =
    backId === 'dual_jetpack' || (isCreated && cfg.mobilityPowerId === 'jetpack_boost' && backId === 'none');

  if (minifig.upperBodyGroup && (backId !== 'none' || wantsJetpackMesh)) {
    const bg = new THREE.Group();
    if (backId === 'classic_cape') {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.16, 0.04), backMat);
      cape.position.set(0, 0.2, -0.25);
      cape.rotation.x = 0.14;
      bg.add(cape);
    } else if (backId === 'dual_jetpack' || wantsJetpackMesh) {
      const pack = createLegoBrick(0.64, 0.54, 0.24, backCol.hex, { studs: false });
      pack.position.set(0, 0.42, -0.32);
      bg.add(pack);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      for (const sx of [-0.2, 0.2]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.58, 12), darkMat);
        cyl.position.set(sx, 0.4, -0.36);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 10), flameMat);
        flame.rotation.x = Math.PI;
        flame.position.set(sx, -0.05, -0.36);
        flame.visible = false;
        minifig.op09JetFlames.push(flame);
        bg.add(cyl, flame);
      }
    } else if (backId === 'tech_wings') {
      for (const s of [-1, 1]) {
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.26, 0.07), backMat);
        w1.position.set(s * 0.62, 0.54, -0.28);
        w1.rotation.z = s * 0.32;
        const w2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.16, 0.05),
          new THREE.MeshBasicMaterial({ color: 0x00f0ff })
        );
        w2.position.set(s * 0.55, 0.32, -0.29);
        w2.rotation.z = s * 0.15;
        bg.add(w1, w2);
      }
    } else if (backId === 'urban_backpack') {
      const bag = createLegoBrick(0.62, 0.62, 0.28, backCol.hex, { studStep: 0.3 });
      bag.position.set(0, 0.4, -0.34);
      bg.add(bag);
    }
    minifig.upperBodyGroup.add(bg);
  }

  // 2.3 Emissores Energéticos Discretos nas Mãos & Prancha Hoverboard de Luz (oculta até ativar!)
  if (isCreated) {
    const glowHex =
      cfg.primaryPowerId === 'cryo_ray'
        ? 0x38bdf8
        : cfg.primaryPowerId === 'emerald_plasma'
          ? 0x22c55e
          : cfg.primaryPowerId === 'sonic_cannon'
            ? 0x00f0ff
            : 0xfacc15;
    const cuffMat = new THREE.MeshBasicMaterial({ color: glowHex });
    for (const handG of [minifig.leftHandGroup, minifig.rightHandGroup]) {
      if (!handG) continue;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 14), cuffMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -0.46, 0);
      handG.add(ring);
    }

    // Prancha Hoverboard LEGO sob os pés (visível quando Hoverboard ativo!)
    const boardGroup = new THREE.Group();
    const deck = createLegoBrick(0.95, 0.12, 2.15, torsoCol.hex, { studStep: 0.45 });
    const neonRim = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.06, 2.22),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    boardGroup.add(deck, neonRim);
    boardGroup.position.set(0, -0.06, 0);
    boardGroup.visible = false;
    minifig.visualRoot.add(boardGroup);
    minifig.op09Hoverboard = boardGroup;
  } else {
    minifig.op09Hoverboard = null;
  }
}

/**
 * Enquadramento e rotação ao vivo do preview 3D sobre o Pedestal Holográfico do console
 */
export function updateCustomHeroStudioCamera(studio, dt) {
  if (!studio.isOpen || !studio.controller) return;
  const ped = studio.world?.customizerLabPedestal?.pedestalPos || { x: -332, y: -7.55, z: -167 };
  studio.controller.minifigure.root.position.set(ped.x, ped.y, ped.z);
  studio.controller.minifigure.root.rotation.set(0, studio.previewYaw, 0);
  studio.controller.minifigure.updateAnimation?.(dt, 0, 13.5, true, 0, false, false, 0, 0);

  // Enquadramento de Estúdio 3D deslocado levemente à esquerda para o boneco ficar livre ao lado do painel direito!
  const cam = studio.controller.camera;
  cam.position.set(ped.x + 3.85, ped.y + 1.55, ped.z + 0.65);
  cam.lookAt(ped.x, ped.y + 1.15, ped.z - 0.85);
}

/**
 * Aplica o rascunho atual do console em tempo real ao rig 3D da minifigura e ao retrato da HUD
 */
export function applyLiveDraftTo3DMinifig(studio) {
  setActiveCustomHero(studio.draft);
  if (studio.controller?.minifigure) {
    studio.controller.minifigure.setHero('op09');
    studio.controller.minifigure.root.rotation.y = studio.previewYaw;
  }
  const entry = getOp09CatalogEntry();
  studio.hud?.setCharacterPortrait('op09', entry.name);
}
