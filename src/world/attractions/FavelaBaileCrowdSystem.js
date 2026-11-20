import * as THREE from 'three';
import {
  getLegoMaterial,
  createLegoBrick,
  getSharedNpcFaceMaterial
} from '../../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from '../BuildingGenerator.js';
import { soundFX } from '../../audio/SoundFX.js';
import { animateBaileDjRig, computeBaileNpcDancePose } from './EmoteDanceAnimations.js';

const _dancePoseScratch = {
  hop: 0,
  sideStep: 0,
  leanX: 0,
  twistZ: 0,
  legPitchL: 0,
  legPitchR: 0,
  armPitchL: 0,
  armPitchR: 0,
  armRollL: 0,
  armRollR: 0
};

// ============================================================================
// BAILE FUNK VIVO NA QUADRA DA CDD (PAREDÃO PULSANTE, DJ LEGO & 64 DANÇARINOS DUAL-LOD!)
// ============================================================================
export function initBaileFunkStageAndCrowd(mgr) {
  const cx = -715;
  const cz = -135;
  const yBase = mgr.world.getTerrainHeightAt ? mgr.world.getTerrainHeightAt(cx, cz) : 25.0;
  mgr.baileCenter.set(cx, yBase, cz);

  const paredaoFaceX = cx - 19.0 + 2.85; // -731.15 (face frontal do Paredão voltada para +X!)

  // A) 24 Cones de Alto-Falantes Subwoofer 3D Coloridos que pulsam em escala no grave!
  const coneMatDark = getLegoMaterial(0x111827, { roughness: 0.35 });
  const capColors = [0xfacc15, 0x00f0ff, 0xff1e42, 0xa855f7];
  const capMats = capColors.map((hex) => new THREE.MeshBasicMaterial({ color: hex }));
  const coneGeo = new THREE.CylinderGeometry(0.72, 0.32, 0.36, 14);
  coneGeo.rotateZ(-Math.PI / 2);
  const capGeo = new THREE.SphereGeometry(0.28, 10, 8);

  for (let row = 0; row < 4; row++) {
    const sy = yBase + 1.6 + row * 2.5;
    for (let col = -2; col <= 3; col++) {
      const sz = cz - 8.75 + (col + 2) * 3.5;
      const wooferPivot = new THREE.Group();
      wooferPivot.position.set(paredaoFaceX, sy, sz);

      const cone = new THREE.Mesh(coneGeo, coneMatDark);
      const cap = new THREE.Mesh(capGeo, capMats[(row + col + 4) % capMats.length]);
      cap.position.x = 0.16;
      wooferPivot.add(cone, cap);

      mgr.scene.add(wooferPivot);
      mgr.baileWoofers.push({ pivot: wooferPivot, row });
    }
  }

  // B) Painel Equalizador de LED Colorido atrás do DJ
  const eqColors = [0x22c55e, 0xfacc15, 0xf97316, 0xff1e42, 0x00f0ff, 0xa855f7];
  for (let i = 0; i < 12; i++) {
    const barMat = new THREE.MeshBasicMaterial({ color: eqColors[i % eqColors.length] });
    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.72), barMat);
    barMesh.position.set(paredaoFaceX + 0.15, yBase + 3.8, cz - 4.95 + i * 0.9);
    mgr.scene.add(barMesh);
    mgr.baileEqBars.push(barMesh);
  }

  // C) Mesa de Som / Pickups Duplos + DJ Minifigura LEGO de Fone de Ouvido e Óculos Escuros no Palco!
  const stageX = cx - 14.0; // -729.0
  const stageTopY = yBase + 1.4;
  const boothGroup = new THREE.Group();
  boothGroup.position.set(stageX + 0.85, stageTopY, cz);

  const desk = createLegoBrick(1.3, 1.05, 3.8, 0x090a0d, { studStep: 0.65 });
  desk.position.set(0.65, 0.52, 0);
  const neonFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.65, 3.6),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  );
  neonFront.position.set(1.32, 0.55, 0);
  boothGroup.add(desk, neonFront);

  // 2 Turntables de Vinil + Mixer Central
  const vinylMat = getLegoMaterial(0x090a0d, { roughness: 0.15 });
  const goldMat = getLegoMaterial(0xfacc15, { roughness: 0.2 });
  for (const dz of [-1.05, 1.05]) {
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16), vinylMat);
    platter.position.set(0.65, 1.09, dz);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), goldMat);
    label.position.set(0.65, 1.1, dz);
    boothGroup.add(platter, label);
  }

  // Boneco DJ LEGO Articulado (virado para +X encarando a multidão!)
  const djRoot = new THREE.Group();
  djRoot.rotation.y = Math.PI / 2;
  const legMat = getLegoMaterial(0x1e293b);
  const torsoMat = getLegoMaterial(0xdc2626);
  const yellowMat = getLegoMaterial(0xfacc15);
  const blackMat = getLegoMaterial(0x090a0d);
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  const djLegs = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.72, 0.38), legMat);
  djLegs.position.y = 0.36;
  const djTorso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.76, 0.44), torsoMat);
  djTorso.position.y = 1.1;

  const djHeadPivot = new THREE.Group();
  djHeadPivot.position.y = 1.72;
  const djHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.46, 16),
    getSharedNpcFaceMaterial('civ_shades')
  );
  // Fone de Ouvido Gamer / DJ Ciano & Preto!
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.055, 8, 16, Math.PI),
    blackMat
  );
  band.position.y = 0.08;
  const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12), cyanMat);
  cupL.rotation.z = Math.PI / 2;
  cupL.position.set(-0.35, 0.02, 0);
  const cupR = cupL.clone();
  cupR.position.x = 0.35;
  djHeadPivot.add(djHead, band, cupL, cupR);

  const djLeftArm = new THREE.Group();
  djLeftArm.position.set(-0.52, 1.42, 0);
  const armMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.24), yellowMat);
  armMeshL.position.y = -0.26;
  djLeftArm.add(armMeshL);

  const djRightArm = new THREE.Group();
  djRightArm.position.set(0.52, 1.42, 0);
  const armMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.24), yellowMat);
  armMeshR.position.y = -0.26;
  djRightArm.add(armMeshR);

  djRoot.add(djLegs, djTorso, djHeadPivot, djLeftArm, djRightArm);
  boothGroup.add(djRoot);
  mgr.scene.add(boothGroup);
  mgr.djRig = { root: djRoot, head: djHeadPivot, leftArm: djLeftArm, rightArm: djRightArm };

  // D) 4 Feixes de Laser Coloridos Varrendo a Pista de Dança do Baile!
  const laserGeo = new THREE.ConeGeometry(3.2, 28.0, 10, 1, true);
  laserGeo.translate(0, -14.0, 0);
  const laserHexes = [0x00f0ff, 0xff1e42, 0xfacc15, 0xa855f7];
  for (let l = 0; l < 4; l++) {
    const lMat = new THREE.MeshBasicMaterial({
      color: laserHexes[l],
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const lPivot = new THREE.Group();
    lPivot.position.set(paredaoFaceX + 0.5, yBase + 10.8, cz - 9.0 + l * 6.0);
    lPivot.rotation.z = 0.85;
    const beam = new THREE.Mesh(laserGeo, lMat);
    lPivot.add(beam);
    mgr.scene.add(lPivot);
    mgr.baileLaserPivots.push({ pivot: lPivot, mat: lMat, phase: l * 1.5 });
  }

  // E) Multidão Instanciada do Baile da CDD (64 NPCs em Sistema Dual-LOD: 28 pista central + 36 palco/entorno, 60 FPS!)
  const coreCount = 28; // Preserva compatibilidade com attr.baileCrowd.count === 28
  const partyDefs = [];

  const isInsideObstacle = (px, pz) => {
    // Palco do DJ (cx - 14.0, cz, 5.2 x 13.5) e Paredão (cx - 19.0, cz, 5.4 x 21.0)
    if (px >= cx - 22.5 && px <= cx - 10.6 && Math.abs(pz - cz) <= 11.2) return true;
    // Barracas laterais (cx - 5 e cx + 8 em cz +- 22.5)
    if (Math.abs(pz - (cz - 22.5)) < 3.0 || Math.abs(pz - (cz + 22.5)) < 3.0) {
      if (Math.abs(px - (cx - 5)) < 4.0 || Math.abs(px - (cx + 8)) < 4.0) return true;
    }
    // Mesas plásticas e cadeiras (mx de cx-6 até cx+14 passo 6.5 em cz +- 17.5)
    if (Math.abs(pz - (cz - 17.5)) < 1.8 || Math.abs(pz - (cz + 17.5)) < 1.8) {
      for (let mx = cx - 6; mx <= cx + 14; mx += 6.5) {
        if (Math.abs(px - mx) < 2.2) return true;
      }
    }
    return false;
  };

  // 1) 28 Dançarinos Centrais da Pista Vermelha (longe do palco/mesas, piso limpo em yBase + 0.22)
  for (let i = 0; i < coreCount; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    const dx = cx - 8.2 + row * 4.4 + (((i * 7) % 3) - 1) * 0.55;
    const dz = cz - 12.6 + col * 4.2 + (((i * 11) % 3) - 1) * 0.6;
    partyDefs.push({
      x: dx,
      y: yBase + 0.22,
      z: dz,
      baseYaw: -Math.PI / 2 + ((i % 5) - 2) * 0.16,
      phase: (i * 0.63) % (Math.PI * 2),
      danceStyle: i % 4,
      hasCap: i % 3 !== 0,
      tier: 'core'
    });
  }

  // 2) 2 Dançarinos Hype no Palco ao lado do DJ (yBase + 1.40 em cima do tablado!)
  for (const [sx, sz, syaw] of [
    [cx - 13.8, cz - 4.8, Math.PI * 0.42],
    [cx - 13.8, cz + 4.8, Math.PI * 0.58]
  ]) {
    partyDefs.push({
      x: sx,
      y: yBase + 1.4,
      z: sz,
      baseYaw: syaw,
      phase: sz > cz ? 1.1 : 2.9,
      danceStyle: 3,
      hasCap: true,
      tier: 'stage'
    });
  }

  // 3) 34 Festeiros no Entorno da Pista, Camarotes e Pátio Leste (filtrados contra obstáculos)
  const candidateSlots = [];
  for (let k = 0; k < 6; k++) {
    candidateSlots.push([cx - 6.5 + k * 4.2, cz - 14.8, Math.PI * -0.32, k % 5]);
    candidateSlots.push([cx - 6.5 + k * 4.2, cz + 14.8, Math.PI * -0.68, (k + 2) % 5]);
  }
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 7; c++) {
      candidateSlots.push([
        cx + 9.6 + r * 4.2 + ((c % 2) * 0.6 - 0.3),
        cz - 11.4 + c * 3.8,
        -Math.PI / 2 + ((c % 3) - 1) * 0.18,
        (r * 3 + c) % 4
      ]);
    }
  }
  for (let m = 0; m < 10; m++) {
    const px = cx + 18.2 + (m % 2) * 3.2;
    const pz = cz - 10.5 + Math.floor(m / 2) * 5.2;
    candidateSlots.push([px, pz, -Math.PI / 2 + (((m * 3) % 5) - 2) * 0.2, 4]);
  }

  for (let idx = 0; idx < candidateSlots.length && partyDefs.length < 64; idx++) {
    const [px, pz, pyaw, style] = candidateSlots[idx];
    if (isInsideObstacle(px, pz)) continue;
    partyDefs.push({
      x: px,
      y: yBase + 0.22,
      z: pz,
      baseYaw: pyaw,
      phase: (partyDefs.length * 0.85) % (Math.PI * 2),
      danceStyle: style,
      hasCap: partyDefs.length % 4 !== 1,
      tier: 'outer'
    });
  }

  const totalCount = partyDefs.length;
  const legGeo = new THREE.BoxGeometry(0.28, 0.72, 0.34);
  legGeo.translate(0, -0.36, 0);

  const bodyGeo = mergeBufferGeometries([
    makeTranslatedBox(0.72, 0.14, 0.38, 0, 0.07, 0),
    makeTranslatedBox(0.78, 0.62, 0.42, 0, 0.43, 0)
  ]);

  const headCyl = new THREE.CylinderGeometry(0.31, 0.31, 0.44, 14);
  headCyl.rotateY(Math.PI);
  const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10);
  studGeo.translate(0, 0.27, 0);
  const fullHeadGeo = mergeBufferGeometries([headCyl, studGeo]);
  fullHeadGeo.translate(0, 0.22, 0);

  const armGeo = new THREE.BoxGeometry(0.21, 0.6, 0.22);
  armGeo.translate(0, -0.26, 0);

  const crowdCapGeo = mergeBufferGeometries([
    makeTranslatedBox(0.68, 0.15, 0.68, 0, 0.07, 0),
    makeTranslatedBox(0.56, 0.06, 0.34, 0, 0.03, 0.34)
  ]);

  const farSilhouetteGeo = mergeBufferGeometries([
    makeTranslatedBox(0.68, 0.72, 0.36, 0, 0.36, 0),
    makeTranslatedBox(0.82, 0.74, 0.42, 0, 1.09, 0),
    makeTranslatedBox(0.54, 0.46, 0.54, 0, 1.69, 0)
  ]);

  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 });
  const skinMat = getLegoMaterial(0xfacc15, { roughness: 0.24 });
  const headFaceMat = getSharedNpcFaceMaterial('civ_cool');
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.26 });
  const farMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

  const leftLegInst = new THREE.InstancedMesh(legGeo, pantsMat, totalCount);
  const rightLegInst = new THREE.InstancedMesh(legGeo, pantsMat, totalCount);
  const bodyInst = new THREE.InstancedMesh(bodyGeo, shirtMat, totalCount);
  const headInst = new THREE.InstancedMesh(fullHeadGeo, headFaceMat, totalCount);
  const leftArmInst = new THREE.InstancedMesh(armGeo, skinMat, totalCount);
  const rightArmInst = new THREE.InstancedMesh(armGeo, skinMat, totalCount);
  const capInst = new THREE.InstancedMesh(crowdCapGeo, capMat, totalCount);
  const farLodInst = new THREE.InstancedMesh(farSilhouetteGeo, farMat, totalCount);

  const crowdSphere = new THREE.Sphere(new THREE.Vector3(cx, yBase + 2.0, cz), 55);
  const allInstMeshes = [
    leftLegInst,
    rightLegInst,
    bodyInst,
    headInst,
    leftArmInst,
    rightArmInst,
    capInst,
    farLodInst
  ];
  for (const im of allInstMeshes) {
    im.frustumCulled = false;
    im.boundingSphere = crowdSphere.clone();
  }
  farLodInst.visible = false;

  const shirtPalette = [0xdc2626, 0xfacc15, 0x2563eb, 0x06b6d4, 0x22c55e, 0xec4899, 0xf97316, 0xf8fafc];
  const pantsPalette = [0x0f172a, 0x1e3a8a, 0x334155, 0x1f2937, 0x78350f];
  const capPalette = [0xdc2626, 0xfacc15, 0xf8fafc, 0x06b6d4, 0x090a0d, 0x22c55e];
  const tmpColor = new THREE.Color();

  for (let i = 0; i < totalCount; i++) {
    const sCol = shirtPalette[i % shirtPalette.length];
    const pCol = pantsPalette[(i * 3) % pantsPalette.length];
    const cCol = capPalette[(i * 5) % capPalette.length];
    bodyInst.setColorAt(i, tmpColor.setHex(sCol));
    farLodInst.setColorAt(i, tmpColor.setHex(sCol));
    leftLegInst.setColorAt(i, tmpColor.setHex(pCol));
    rightLegInst.setColorAt(i, tmpColor.setHex(pCol));
    capInst.setColorAt(i, tmpColor.setHex(cCol));
  }
  for (const im of [bodyInst, farLodInst, leftLegInst, rightLegInst, capInst]) {
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  mgr.scene.add(...allInstMeshes);
  mgr.baileCrowd = {
    count: coreCount,
    totalCount,
    dancers: partyDefs.slice(0, coreCount),
    allDancers: partyDefs,
    lodMode: 'near',
    leftLegInst,
    rightLegInst,
    bodyInst,
    headInst,
    leftArmInst,
    rightArmInst,
    capInst,
    farLodInst,
    allInstMeshes
  };

  // Popula matrizes válidas imediatamente no Frame 0 (zero boneco empilhado em 0,0,0!)
  mgr._updateBaileCrowdTransforms(0, null, 1.0, false, false);
  mgr._updateBaileCrowdTransforms(0, null, 1.0, false, true);
}

export function updateBaileCrowdTransforms(
  mgr,
  t,
  playerPos,
  hypeMult,
  isPlayerDancingHere,
  farLodOnly
) {
  if (!mgr.baileCrowd) return;
  const {
    allDancers,
    leftLegInst,
    rightLegInst,
    bodyInst,
    headInst,
    leftArmInst,
    rightArmInst,
    capInst,
    farLodInst
  } = mgr.baileCrowd;
  const dmy = mgr._dummy;
  dmy.rotation.order = 'YXZ';

  for (let i = 0; i < allDancers.length; i++) {
    const d = allDancers[i];
    const ph = t * 11.2 + d.phase;
    const beat = Math.sin(ph);
    const halfBeat = Math.sin(ph * 0.5);
    const dblBeat = Math.sin(ph * 2.0);

    let yaw = d.baseYaw + halfBeat * 0.22;
    if (isPlayerDancingHere && playerPos) {
      const pdx = playerPos.x - d.x;
      const pdz = playerPos.z - d.z;
      if (pdx * pdx + pdz * pdz < 144) {
        yaw = Math.atan2(pdx, pdz);
      }
    }

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const p = computeBaileNpcDancePose(
      d.danceStyle,
      beat,
      halfBeat,
      dblBeat,
      hypeMult,
      _dancePoseScratch
    );

    const px = d.x + cosY * p.sideStep;
    const pz = d.z - sinY * p.sideStep;

    if (farLodOnly) {
      dmy.position.set(px, d.y + p.hop, pz);
      dmy.rotation.set(0, yaw, p.twistZ);
      dmy.scale.set(1, 1, 1);
      dmy.updateMatrix();
      farLodInst.setMatrixAt(i, dmy.matrix);
      continue;
    }

    const hipY = d.y + 0.72 + p.hop;
    const shoulderY = hipY + 0.68;

    dmy.position.set(px - cosY * 0.21, hipY, pz + sinY * 0.21);
    dmy.rotation.set(p.legPitchL, yaw, 0);
    dmy.scale.set(1, 1, 1);
    dmy.updateMatrix();
    leftLegInst.setMatrixAt(i, dmy.matrix);

    dmy.position.set(px + cosY * 0.21, hipY, pz - sinY * 0.21);
    dmy.rotation.set(p.legPitchR, yaw, 0);
    dmy.updateMatrix();
    rightLegInst.setMatrixAt(i, dmy.matrix);

    dmy.position.set(px, hipY, pz);
    dmy.rotation.set(p.leanX, yaw, p.twistZ);
    dmy.updateMatrix();
    bodyInst.setMatrixAt(i, dmy.matrix);

    dmy.position.set(px, hipY + 0.74, pz);
    dmy.rotation.set(p.leanX * 0.6 + beat * 0.09, yaw, p.twistZ * 0.5);
    dmy.updateMatrix();
    headInst.setMatrixAt(i, dmy.matrix);

    if (d.hasCap) {
      dmy.position.set(px, hipY + 1.16, pz);
      dmy.rotation.set(p.leanX * 0.6 + beat * 0.09, yaw, p.twistZ * 0.5);
      dmy.scale.set(1, 1, 1);
    } else {
      dmy.position.set(px, hipY + 1.16, pz);
      dmy.scale.set(0, 0, 0);
    }
    dmy.updateMatrix();
    capInst.setMatrixAt(i, dmy.matrix);

    dmy.scale.set(1, 1, 1);
    dmy.position.set(px - cosY * 0.49, shoulderY, pz + sinY * 0.49);
    dmy.rotation.set(p.armPitchL, yaw, p.armRollL);
    dmy.updateMatrix();
    leftArmInst.setMatrixAt(i, dmy.matrix);

    dmy.position.set(px + cosY * 0.49, shoulderY, pz - sinY * 0.49);
    dmy.rotation.set(p.armPitchR, yaw, p.armRollR);
    dmy.updateMatrix();
    rightArmInst.setMatrixAt(i, dmy.matrix);
  }

  if (farLodOnly) {
    farLodInst.instanceMatrix.needsUpdate = true;
  } else {
    leftLegInst.instanceMatrix.needsUpdate = true;
    rightLegInst.instanceMatrix.needsUpdate = true;
    bodyInst.instanceMatrix.needsUpdate = true;
    headInst.instanceMatrix.needsUpdate = true;
    capInst.instanceMatrix.needsUpdate = true;
    leftArmInst.instanceMatrix.needsUpdate = true;
    rightArmInst.instanceMatrix.needsUpdate = true;
  }
}

export function updateBaileFunkStageAndCrowd(mgr, dt, t, playerPos, controller) {
  // 1. Áudio Espacial por Proximidade (< 75m) + Pulsação do Paredão + DJ + Multidão do Baile da CDD!
  const distToBaile = playerPos ? playerPos.distanceTo(mgr.baileCenter) : 999;
  soundFX.updateBaileSpatialProximity(distToBaile, dt);

  // Mesmo visto de longe (ex.: 140m), o Paredão pulsa visualmente no ritmo de 130 BPM!
  const synthBeat = Math.pow(Math.max(0, Math.sin(t * 13.6)), 3);
  const beatKick = Math.max(soundFX.baileBeatPulse || 0, synthBeat);

  if (distToBaile < 240) {
    for (let i = 0; i < mgr.baileWoofers.length; i++) {
      const w = mgr.baileWoofers[i];
      const s = 1.0 + beatKick * (w.row < 2 ? 0.38 : 0.26);
      w.pivot.scale.set(1.0 + beatKick * 0.25, s, s);
    }

    for (let i = 0; i < mgr.baileEqBars.length; i++) {
      const bar = mgr.baileEqBars[i];
      const eqH = 0.4 + Math.abs(Math.sin(t * 11.0 + i * 0.7)) * (1.2 + beatKick * 1.4);
      bar.scale.y = eqH;
    }

    animateBaileDjRig(mgr.djRig, t);

    const nightFactor = mgr.world.atmosphere?.nightFactor || 0;
    for (const ls of mgr.baileLaserPivots) {
      ls.pivot.rotation.x = Math.sin(t * 2.4 + ls.phase) * 0.55;
      ls.pivot.rotation.z = 0.75 + Math.cos(t * 1.9 + ls.phase) * 0.32;
      ls.mat.opacity = 0.16 + nightFactor * 0.36;
    }
  }

  if (mgr.baileCrowd) {
    const nightFactor = mgr.world.atmosphere?.nightFactor || 0;
    const isPlayerDancingHere = Boolean(controller?.minifigure?.activeEmote && distToBaile < 36.0);
    const hypeMult = 1.0 + nightFactor * 0.45 + (isPlayerDancingHere ? 0.45 : 0);

    // LOD em 2 níveis com histerese para evitar sumir na tela ou cair FPS:
    // LOD Near (< 150..165m): 64 NPCs com 7 partes articuladas e 5 estilos de dança
    // LOD Far (150..420..445m): 64 silhuetas unificadas (1 draw call) dançando à distância
    const prevMode = mgr.baileCrowd.lodMode || 'near';
    let nextMode = 'hidden';
    if (distToBaile <= (prevMode === 'near' ? 165 : 150)) {
      nextMode = 'near';
    } else if (distToBaile <= (prevMode === 'far' ? 445 : 420)) {
      nextMode = 'far';
    }
    mgr.baileCrowd.lodMode = nextMode;

    const {
      leftLegInst,
      rightLegInst,
      bodyInst,
      headInst,
      leftArmInst,
      rightArmInst,
      capInst,
      farLodInst
    } = mgr.baileCrowd;
    const nearVisible = nextMode === 'near';
    leftLegInst.visible = nearVisible;
    rightLegInst.visible = nearVisible;
    bodyInst.visible = nearVisible;
    headInst.visible = nearVisible;
    leftArmInst.visible = nearVisible;
    rightArmInst.visible = nearVisible;
    capInst.visible = nearVisible;
    farLodInst.visible = nextMode === 'far';

    if (nextMode !== 'hidden') {
      mgr._updateBaileCrowdTransforms(
        t,
        playerPos,
        hypeMult,
        isPlayerDancingHere,
        nextMode === 'far'
      );
    }
  }
}
