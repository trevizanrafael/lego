import * as THREE from 'three';
import {
  PALETTE,
  GLOW_CACHE,
  PartBuilder,
  plastic,
  metal,
  goldMaterial,
  glow,
  glass,
  makeCanvasTexture,
  camoMaterial,
  addBaseTorsoAndBelt,
  addLeg,
  addArm,
  addSwatHelmetBase,
  addSlantedBeretBase,
  buildWeapon,
  addMedicBackpackKit,
  addRpgLauncherKit,
  addC4DemolitionKit,
  addShieldOffhand
} from './SoldierSharedRigAndWeapons.js';
import { applyBossHeadKit, applyBossBodyKit } from './BossAndAnimationHelpers.js';

export function torsoDecalTexture(faction, role) {
  return makeCanvasTexture(`decal_${faction}_${role}`, 128, 128, (ctx) => {
    const p = PALETTE[faction];
    ctx.clearRect(0, 0, 128, 128);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cross = (color, outline = '#ffffff') => {
      ctx.fillStyle = outline;
      ctx.fillRect(49, 33, 30, 62);
      ctx.fillRect(33, 49, 62, 30);
      ctx.fillStyle = color;
      ctx.fillRect(54, 38, 20, 52);
      ctx.fillRect(38, 54, 52, 20);
    };

    if (role === 'medic') {
      cross(faction === 'cv' ? '#dc2626' : faction === 'pcc' ? '#38bdf8' : faction === 'bope' ? '#facc15' : '#d946ef');
      return;
    }

    if (faction === 'guard') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(14, 40, 100, 74);
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.moveTo(58, 8);
      ctx.lineTo(70, 8);
      ctx.lineTo(68, 40);
      ctx.lineTo(60, 40);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 19px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText('SEGURANÇA', 64, 84);
      ctx.fillRect(40, 96, 48, 4);
      return;
    }
    if (faction === 'pf') {
      ctx.fillStyle = '#0b1226';
      ctx.fillRect(16, 14, 96, 100);
      ctx.font = 'bold 50px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText('PF', 64, 70);
      ctx.font = 'bold 14px Teko, Impact, sans-serif';
      ctx.fillText('POLÍCIA FEDERAL', 64, 96);
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 3; i++) ctx.fillRect(26 + i * 27, 100, 22, 12);
      return;
    }

    if (faction === 'bope') {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(64, 50, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(50, 62, 28, 18);
      ctx.fillStyle = '#0b0c0f';
      ctx.beginPath();
      ctx.arc(55, 50, 6, 0, Math.PI * 2);
      ctx.arc(73, 50, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(56, 70, 3, 10);
      ctx.fillRect(63, 70, 3, 10);
      ctx.fillRect(70, 70, 3, 10);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(30, 22);
      ctx.lineTo(98, 90);
      ctx.stroke();
      ctx.font = 'bold 22px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText('BOPE', 64, 112);
      return;
    }

    if (faction === 'cv') {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(34, 8);
      ctx.quadraticCurveTo(64, 52, 94, 8);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(64, 44, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 44px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#dc2626';
      ctx.fillText('CV', 64, 102);
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 2;
      ctx.strokeText('CV', 64, 102);
    } else if (faction === 'pcc') {
      ctx.fillStyle = '#0b1226';
      ctx.fillRect(20, 14, 88, 100);
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 3; i++) ctx.fillRect(26 + i * 27, 70, 22, 34);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(20, 54, 88, 8);
      ctx.font = 'bold 26px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('PCC', 64, 44);
    } else {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(22, 14, 84, 96);
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = 64 + Math.cos(a) * 20;
        const y = 56 + Math.sin(a) * 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.arc(64, 56, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, 96);
      ctx.lineTo(98, 96);
      ctx.stroke();
    }
    void p;
  });
}

export function decalMaterial(faction, role) {
  const key = `decalmat_${faction}_${role}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const tex = torsoDecalTexture(faction, role);
  const mat = tex
    ? new THREE.MeshPhysicalMaterial({
      map: tex,
      transparent: true,
      roughness: 0.25,
      clearcoat: 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    })
    : null;
  GLOW_CACHE.set(key, mat);
  return mat;
}

function resolveFactionClassStyle(faction, role, p) {
  const isBoss = role === 'boss';
  const isMedic = role === 'medic';
  const isTank = role === 'tank';
  const isSpecial = role === 'special';

  let torsoHex = p.black;
  let sleeveHex = p.main;
  let hipHex = p.black;
  let legMat = camoMaterial(faction);
  let bootMat = plastic(p.black);
  let faceKey = 'default';
  let weaponKind = 'ak';

  if (faction === 'cv') {
    torsoHex = isMedic ? 0xf8fafc : p.black;
    sleeveHex = isMedic ? 0xf8fafc : isTank ? p.dark : 0xfacc15;
    if (role === 'rifleman' || isSpecial) sleeveHex = 0xfacc15;
    hipHex = 0x2a2a1e;
    faceKey = isMedic ? 'medic_calm' : isBoss ? 'boss_grin' : 'cv_angry';
    weaponKind = isTank ? 'shotgun' : isMedic ? 'healgun' : isBoss ? 'minigun' : 'ak';
  } else if (faction === 'pcc') {
    torsoHex = isMedic ? 0x0f172a : p.main;
    sleeveHex = p.dark;
    hipHex = p.black;
    legMat = plastic(0x111827);
    faceKey = isMedic ? 'medic_calm' : isBoss ? 'boss_grin' : 'pcc_mask';
    weaponKind = isTank ? 'smg' : isMedic ? 'healgun' : isSpecial ? 'detonator' : isBoss ? 'minigun' : 'smg';
  } else if (faction === 'guard') {
    torsoHex = 0xf1f5f9;
    sleeveHex = 0xf1f5f9;
    hipHex = 0x111827;
    legMat = plastic(0x111827);
    faceKey = isMedic ? 'medic_calm' : 'default';
    weaponKind = isTank ? 'shotgun' : isMedic ? 'healgun' : 'smg';
  } else if (faction === 'pf') {
    torsoHex = p.main;
    sleeveHex = 0x111827;
    hipHex = p.black;
    legMat = plastic(0x1f2937);
    faceKey = isMedic ? 'medic_calm' : 'default';
    weaponKind = isMedic ? 'healgun' : isTank ? 'smg' : isBoss ? 'minigun' : 'ak';
  } else if (faction === 'bope') {
    torsoHex = p.main;
    sleeveHex = p.dark;
    hipHex = p.black;
    legMat = plastic(0x1f2328);
    faceKey = isMedic ? 'medic_calm' : 'default';
    weaponKind = isMedic ? 'healgun' : isTank ? 'shotgun' : isBoss ? 'minigun' : 'ak';
  } else {
    torsoHex = isMedic ? 0xe2e8f0 : p.main;
    sleeveHex = isMedic ? 0xe2e8f0 : p.dark;
    hipHex = p.black;
    legMat = plastic(0x475569, { metalness: 0.35 });
    bootMat = metal(0x1e293b);
    faceKey = isMedic ? 'medic_calm' : isBoss ? 'boss_grin' : 'default';
    weaponKind = isMedic ? 'healgun' : isBoss ? 'minigun' : 'laser';
  }

  const handMat = plastic(
    faction === 'ares' ? 0x1e293b : faction === 'pcc' || faction === 'bope' || faction === 'pf' ? 0x111827 : 0xfacc15
  );

  return {
    torsoMat: plastic(torsoHex),
    sleeveMat: plastic(sleeveHex),
    hipMat: plastic(hipHex),
    legMat,
    bootMat,
    handMat,
    faceKey,
    weaponKind
  };
}

function applyFactionHeadKit(H, faction, role, ctx) {
  const { p, mainMat, blackMat, accentMat, gold, headTopY } = ctx;
  const isBoss = role === 'boss';
  const isMedic = role === 'medic';
  const isTank = role === 'tank';

  if (isBoss && applyBossHeadKit(H, faction, ctx)) {
    return;
  }

  if (faction === 'cv') {
    if (isTank) {
      H.sphere(0.36, mainMat, [0, 0.3, 0], [1, 0.95, 1], 16);
      H.box(0.5, 0.2, 0.12, glass(0x0b0b0b, 0.75), [0, 0.28, 0.3]);
      H.box(0.06, 0.4, 0.06, accentMat, [0, 0.52, 0.0]);
    } else if (isMedic) {
      H.cyl(0.29, 0.29, 0.14, plastic(0xf8fafc), [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.22, plastic(0xf8fafc), [0, headTopY - 0.07, 0.3]);
      H.box(0.12, 0.04, 0.04, mainMat, [0, headTopY + 0.04, 0.27]);
      H.box(0.04, 0.12, 0.04, mainMat, [0, headTopY + 0.04, 0.27]);
    } else {
      H.add(
        new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        mainMat,
        [0, headTopY - 0.1, 0],
        [0, 0, 0],
        [1, 0.62, 1]
      );
      H.box(0.34, 0.04, 0.24, mainMat, [0, headTopY - 0.09, -0.32]);
      H.stud(blackMat, [0, headTopY + 0.07, 0], 0.7);
      H.cyl(0.285, 0.29, 0.17, plastic(p.main), [0, 0.13, 0], [0, 0, 0], 16, [1, 1, 1]);
      H.box(0.14, 0.18, 0.06, plastic(p.main), [0, 0.0, 0.28], [0.2, 0, 0]);
    }
  } else if (faction === 'pcc') {
    if (isTank) {
      addSwatHelmetBase(H, blackMat, p.accent, 0.55);
      H.box(0.64, 0.05, 0.6, blackMat, [0, 0.42, 0]);
    } else if (isMedic) {
      H.cyl(0.29, 0.29, 0.12, plastic(0x0f172a), [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.2, plastic(0x0f172a), [0, headTopY - 0.07, 0.3]);
      H.box(0.1, 0.03, 0.04, accentMat, [0, headTopY + 0.0, 0.27]);
      H.box(0.03, 0.1, 0.04, accentMat, [0, headTopY + 0.0, 0.27]);
    } else {
      H.cyl(0.29, 0.29, 0.14, blackMat, [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.24, blackMat, [0, headTopY - 0.08, 0.3]);
      H.box(0.14, 0.08, 0.03, accentMat, [0, headTopY - 0.0, 0.29]);
      H.cyl(0.08, 0.08, 0.06, blackMat, [-0.3, 0.26, 0], [0, 0, Math.PI / 2], 10);
      H.cyl(0.08, 0.08, 0.06, blackMat, [0.3, 0.26, 0], [0, 0, Math.PI / 2], 10);
      H.box(0.03, 0.03, 0.2, blackMat, [0.3, 0.14, 0.12], [0.4, 0, 0]);
    }
  } else if (faction === 'guard') {
    H.cyl(0.3, 0.29, 0.16, plastic(0x1e3a8a), [0, headTopY + 0.0, 0], [0, 0, 0], 16);
    H.box(0.38, 0.04, 0.22, blackMat, [0, headTopY - 0.07, 0.3]);
    H.box(0.1, 0.1, 0.03, gold, [0, headTopY + 0.02, 0.3]);
  } else if (faction === 'pf') {
    if (isTank) {
      addSwatHelmetBase(H, blackMat, 0x0b0b0b, 0.7);
      H.box(0.3, 0.08, 0.03, accentMat, [0, 0.52, 0.27]);
    } else {
      H.cyl(0.29, 0.29, 0.14, blackMat, [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.24, blackMat, [0, headTopY - 0.08, 0.3]);
      H.box(0.18, 0.07, 0.03, accentMat, [0, headTopY - 0.0, 0.29]);
      H.box(0.5, 0.08, 0.05, glass(0x0b0b0b, 0.8), [0, 0.32, 0.275]);
    }
  } else if (faction === 'bope') {
    if (isTank) {
      addSwatHelmetBase(H, blackMat, 0x0b0b0b, 0.7);
    } else {
      addSlantedBeretBase(H, blackMat, headTopY);
      H.box(0.1, 0.1, 0.03, accentMat, [-0.12, headTopY + 0.0, 0.3]);
    }
  } else {
    const helmMat = isMedic ? plastic(0xe2e8f0) : metal(0x475569);
    H.sphere(0.34, helmMat, [0, 0.33, 0], [1, 0.95, 1.02], 16);
    H.box(0.5, 0.11, 0.08, glow(isMedic ? 0x22c55e : 0x22d3ee, 2.2), [0, 0.32, 0.3]);
    H.box(0.08, 0.2, 0.08, glow(p.accent, 1.4), [0.32, 0.36, -0.05]);
    if (isTank) {
      H.box(0.7, 0.08, 0.5, metal(0x334155), [0, 0.55, -0.02]);
    }
  }
}

function applyFactionClassBodyKit(parts, faction, role, ctx) {
  const { p, mainMat, blackMat, accentMat, gold } = ctx;
  const T = parts.torso;
  const isBoss = role === 'boss';
  const isMedic = role === 'medic';
  const isTank = role === 'tank';
  const isSpecial = role === 'special';

  if (faction === 'cv' && !isMedic && !isTank) {
    T.torus(0.2, 0.025, gold, [0, 1.42, 0.12], [Math.PI / 2 - 0.25, 0, 0], Math.PI * 2, 18);
    T.box(0.1, 0.12, 0.04, gold, [0, 1.24, 0.245]);
  }
  if (isTank) {
    const vest = faction === 'ares' ? metal(0x334155) : faction === 'pcc' ? blackMat : plastic(p.dark);
    T.box(0.92, 0.6, 0.12, vest, [0, 1.18, 0.24]);
    T.box(0.92, 0.6, 0.12, vest, [0, 1.18, -0.24]);
    T.box(0.36, 0.14, 0.5, vest, [-0.5, 1.56, 0], [0, 0, 0.3]);
    T.box(0.36, 0.14, 0.5, vest, [0.5, 1.56, 0], [0, 0, -0.3]);
    for (let i = 0; i < 3; i++) {
      T.box(0.2, 0.16, 0.08, faction === 'ares' ? glow(p.accent, 1.1) : plastic(0x1f2937), [-0.27 + i * 0.27, 1.0, 0.33]);
    }
    if (faction === 'ares') {
      T.cyl(0.18, 0.18, 0.5, metal(0x475569), [0, 1.22, -0.42], [0, 0, 0], 12);
      T.cyl(0.12, 0.12, 0.52, glow(p.accent, 2.0), [0, 1.22, -0.42], [0, 0, 0], 12);
    }
  }
  if (isMedic) {
    addMedicBackpackKit(T, faction, p, mainMat, accentMat);
  }
  if (faction === 'pcc' && !isMedic) {
    T.box(0.16, 0.18, 0.1, plastic(0x111827), [0.3, 1.36, 0.27]);
    T.cyl(0.012, 0.012, 0.2, metal(0x64748b), [0.34, 1.52, 0.27], [0, 0, 0], 6);
  }
  if (faction === 'ares' && !isTank && !isBoss) {
    T.box(0.3, 0.12, 0.46, metal(0x334155), [-0.5, 1.56, 0], [0, 0, 0.32]);
    T.box(0.3, 0.12, 0.46, metal(0x334155), [0.5, 1.56, 0], [0, 0, -0.32]);
    T.box(0.22, 0.03, 0.47, glow(p.accent, 1.4), [-0.5, 1.63, 0], [0, 0, 0.32]);
    T.box(0.22, 0.03, 0.47, glow(p.accent, 1.4), [0.5, 1.63, 0], [0, 0, -0.32]);
  }

  if (isSpecial && faction === 'cv') {
    addRpgLauncherKit(T);
  } else if (isSpecial && faction === 'pcc') {
    addC4DemolitionKit(T);
  } else if (isSpecial && faction === 'ares') {
    T.box(0.5, 0.5, 0.22, metal(0x334155), [0, 1.2, -0.34]);
    T.cyl(0.02, 0.02, 0.6, metal(0x94a3b8), [0.18, 1.7, -0.36], [0, 0, 0], 6);
    T.sphere(0.05, glow(p.accent, 2.2), [0.18, 2.0, -0.36]);
    const D = parts.drone;
    D.box(0.5, 0.12, 0.5, metal(0x334155), [0, 0, 0]);
    D.sphere(0.13, glow(0x22d3ee, 2.0), [0, -0.08, 0.12]);
    for (const [dx, dz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
      D.box(0.32, 0.04, 0.06, metal(0x475569), [dx * 0.5, 0, dz * 0.5], [0, Math.atan2(dx, dz), 0]);
      D.cyl(0.16, 0.16, 0.03, glass(p.accent, 0.5), [dx, 0.05, dz], [0, 0, 0], 14);
    }
    D.box(0.08, 0.08, 0.3, glow(p.accent, 1.8), [0, -0.02, 0.32]);
  }
  if (isMedic && faction === 'ares') {
    const D = parts.drone;
    D.sphere(0.2, plastic(0xe2e8f0), [0, 0, 0], [1, 0.75, 1], 14);
    D.torus(0.24, 0.035, glow(0x22c55e, 1.8), [0, 0, 0], [Math.PI / 2, 0, 0]);
    D.box(0.08, 0.22, 0.04, glow(0x22c55e, 2.0), [0, 0, 0.18]);
    D.box(0.22, 0.08, 0.04, glow(0x22c55e, 2.0), [0, 0, 0.18]);
  }

  let hasShield = false;
  if (isTank || isBoss) {
    hasShield = true;
    addShieldOffhand(parts.offhand, faction, p, mainMat, blackMat, accentMat);
  }

  if (isBoss) {
    applyBossBodyKit(T, faction, ctx);
  }

  return hasShield;
}

export function buildSoldierBlueprint(faction, role) {
  const p = PALETTE[faction] || PALETTE.cv;
  const parts = {
    torso: new PartBuilder(),
    head: new PartBuilder(),
    leftArm: new PartBuilder(),
    rightArm: new PartBuilder(),
    leftLeg: new PartBuilder(),
    rightLeg: new PartBuilder(),
    weapon: new PartBuilder(),
    offhand: new PartBuilder(),
    drone: new PartBuilder()
  };

  const style = resolveFactionClassStyle(faction, role, p);
  const gold = goldMaterial();
  const ctx = {
    p,
    mainMat: plastic(p.main),
    blackMat: plastic(p.black),
    accentMat: plastic(p.accent),
    gold,
    headTopY: 0.5
  };

  const decal = decalMaterial(faction, role === 'boss' ? 'rifleman' : role);
  addBaseTorsoAndBelt(parts.torso, faction, p, style.torsoMat, style.hipMat, gold, decal);
  addLeg(parts.leftLeg, style.legMat, style.bootMat, -1);
  addLeg(parts.rightLeg, style.legMat, style.bootMat, 1);
  addArm(parts.leftArm, style.sleeveMat, style.handMat, -1);
  addArm(parts.rightArm, style.sleeveMat, style.handMat, 1);

  applyFactionHeadKit(parts.head, faction, role, ctx);
  const hasShield = applyFactionClassBodyKit(parts, faction, role, ctx);
  const muzzle = buildWeapon(parts.weapon, faction, style.weaponKind);

  const built = {};
  for (const [k, b] of Object.entries(parts)) built[k] = b.build();

  return {
    faction,
    role,
    parts: built,
    faceKey: style.faceKey,
    hasShield,
    hasDrone: built.drone.length > 0,
    weaponKind: style.weaponKind,
    muzzle
  };
}
