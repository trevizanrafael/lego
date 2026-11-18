import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick,
  getSharedNpcFaceMaterial
} from '../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from './BuildingGenerator.js';
import { createSignBoardMesh } from '../utils/SignBoardHelper.js';
import { soundFX } from '../audio/SoundFX.js';

// ============================================================================
// 1. CATÁLOGO E ANIMAÇÃO PROCEDURAL DOS 4 EMOTES / DANÇAS [TECLA B]
// ============================================================================
export const HERO_EMOTES = [
  {
    id: 'passinho',
    name: 'PASSINHO DO BAILE',
    label: '🕺 PASSINHO DO BAILE'
  },
  {
    id: 'breakdance',
    name: 'MORTAL / BREAKDANCE LEGO',
    label: '🤸 MORTAL / BREAKDANCE LEGO'
  },
  {
    id: 'hero_pose',
    name: 'POSE SUPREMA DE HERÓI',
    label: '💪 POSE SUPREMA DE HERÓI'
  },
  {
    id: 'air_guitar',
    name: 'AIR GUITAR / COMEMORAÇÃO LEGO',
    label: '🎸 AIR GUITAR / COMEMORAÇÃO LEGO'
  }
];

const HERO_AURA_COLORS = {
  caveira: 0xfacc15,
  solaris: 0xf97316,
  tita: 0xef4444,
  vingador: 0xcbd5e1,
  sombra: 0xff1e42,
  turbo: 0x00f0ff,
  voltaico: 0x38bdf8,
  vortex: 0xa855f7,
  op09: 0x00f0ff
};

function ensureMinifigEmoteAura(minifig) {
  if (minifig._emoteAuraGroup) return minifig._emoteAuraGroup;

  const auraGroup = new THREE.Group();
  auraGroup.visible = false;

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide
  });
  const ringGeo = new THREE.RingGeometry(0.68, 1.05, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.06;
  auraGroup.add(ringMesh);

  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), ringMat);
    auraGroup.add(sp);
    sparks.push(sp);
  }

  minifig.root.add(auraGroup);
  minifig._emoteAuraGroup = auraGroup;
  minifig._emoteAuraMat = ringMat;
  minifig._emoteAuraRing = ringMesh;
  minifig._emoteAuraSparks = sparks;
  return auraGroup;
}

/**
 * Aplica a coreografia 3D em tempo real dos 4 Emotes [B] em qualquer Minifigura ou Big-Fig (Titã / Vórtex Monstro / OP-09)!
 */
export function applyEmoteAnimationToMinifigure(minifig, dt) {
  if (!minifig || !minifig.activeEmote) {
    if (minifig?._emoteAuraGroup) {
      minifig._emoteAuraGroup.visible = false;
    }
    return false;
  }

  minifig.emoteTimer = (minifig.emoteTimer || 0) + dt;
  const t = minifig.emoteTimer;
  const id = minifig.activeEmote;
  const auraGroup = ensureMinifigEmoteAura(minifig);

  const heroColor =
    minifig.currentHeroKey === 'op09' && minifig.preset?.torsoColor
      ? minifig.preset.torsoColor
      : (HERO_AURA_COLORS[minifig.currentHeroKey] ?? 0xfacc15);
  minifig._emoteAuraMat.color.setHex(heroColor);

  // Reseta base limpa dos pivôs antes de aplicar a pose do emote
  const headObj = minifig.headGroup || minifig.headPivot;
  minifig.visualRoot.position.set(0, 0, 0);
  minifig.visualRoot.rotation.set(0, 0, 0);
  minifig.upperBodyGroup.position.set(0, minifig._baseUpperY ?? 0.86, 0);
  minifig.upperBodyGroup.rotation.set(0, 0, 0);
  if (headObj) headObj.rotation.set(0, 0, 0);
  minifig.leftArmPivot.rotation.set(0, 0, 0);
  minifig.rightArmPivot.rotation.set(0, 0, 0);
  minifig.leftLegPivot.rotation.set(0, 0, 0);
  minifig.rightLegPivot.rotation.set(0, 0, 0);

  if (id === 'passinho') {
    // 1. PASSINHO DO BAILE: Jogo veloz de pernas alternadas + ginga de ombros + giro 360° a cada compasso!
    const beat = t * 11.5;
    const barPhase = (t % 2.4) / 2.4;
    const spin = barPhase > 0.72 ? ((barPhase - 0.72) / 0.28) * Math.PI * 2 : 0;

    minifig.visualRoot.position.y = Math.abs(Math.sin(beat)) * 0.16;
    minifig.visualRoot.rotation.y = spin;
    minifig.leftLegPivot.rotation.x = Math.sin(beat) * 0.72;
    minifig.rightLegPivot.rotation.x = -Math.sin(beat) * 0.72;
    minifig.leftLegPivot.rotation.z = Math.cos(beat * 0.5) * 0.16;
    minifig.rightLegPivot.rotation.z = Math.cos(beat * 0.5) * 0.16;

    minifig.upperBodyGroup.rotation.y = Math.sin(beat * 0.5) * 0.35;
    minifig.upperBodyGroup.rotation.z = Math.cos(beat) * 0.12;
    minifig.leftArmPivot.rotation.x = -1.15 + Math.sin(beat) * 0.55;
    minifig.rightArmPivot.rotation.x = -1.15 - Math.sin(beat) * 0.55;
    minifig.leftArmPivot.rotation.z = 0.35;
    minifig.rightArmPivot.rotation.z = -0.35;
    if (headObj) headObj.rotation.y = -Math.sin(beat * 0.5) * 0.28;
    auraGroup.visible = false;
  } else if (id === 'breakdance') {
    // 2. MORTAL / BREAKDANCE LEGO: Salto mortal acrobático seguido de moinho giratório e pose de aterrissagem!
    const cycle = t % 1.85;
    if (cycle < 0.75) {
      const u = cycle / 0.75;
      minifig.visualRoot.position.y = Math.sin(u * Math.PI) * 1.35;
      minifig.visualRoot.rotation.x = -u * Math.PI * 2;
      minifig.leftArmPivot.rotation.x = -2.4;
      minifig.rightArmPivot.rotation.x = -2.4;
      minifig.leftLegPivot.rotation.x = 0.55;
      minifig.rightLegPivot.rotation.x = -0.55;
    } else if (cycle < 1.35) {
      const u = (cycle - 0.75) / 0.6;
      minifig.visualRoot.position.y = 0.15;
      minifig.visualRoot.rotation.y = u * Math.PI * 4;
      minifig.upperBodyGroup.rotation.x = 0.65;
      minifig.leftArmPivot.rotation.z = 1.25;
      minifig.rightArmPivot.rotation.z = -1.25;
      minifig.leftLegPivot.rotation.z = 0.52;
      minifig.rightLegPivot.rotation.z = -0.52;
    } else {
      // Pose heroica cravada no chão
      minifig.visualRoot.position.y = -0.14;
      minifig.upperBodyGroup.rotation.x = 0.32;
      minifig.leftLegPivot.rotation.x = -0.85;
      minifig.rightLegPivot.rotation.x = 0.55;
      minifig.rightArmPivot.rotation.x = 0.35;
      minifig.leftArmPivot.rotation.x = -2.35;
      minifig.leftArmPivot.rotation.z = 0.35;
    }
    auraGroup.visible = false;
  } else if (id === 'hero_pose') {
    // 3. POSE SUPREMA DE HERÓI: Peito estufado, braços flexionados/cruzados e Aura 3D da cor do personagem!
    const pulse = Math.sin(t * 5.0);
    minifig.visualRoot.position.y = 0.05 + Math.abs(pulse) * 0.05;
    minifig.upperBodyGroup.rotation.x = -0.16;
    if (headObj) {
      headObj.rotation.x = -0.08 + pulse * 0.05;
      headObj.rotation.y = Math.sin(t * 2.2) * 0.22;
    }

    minifig.leftArmPivot.rotation.x = -1.48;
    minifig.rightArmPivot.rotation.x = -1.48;
    minifig.leftArmPivot.rotation.y = -0.62;
    minifig.rightArmPivot.rotation.y = 0.62;
    minifig.leftArmPivot.rotation.z = 0.25 + pulse * 0.06;
    minifig.rightArmPivot.rotation.z = -0.25 - pulse * 0.06;

    auraGroup.visible = true;
    const rScale = 1.0 + Math.sin(t * 7.0) * 0.18;
    minifig._emoteAuraRing.scale.set(rScale, rScale, 1);
    minifig._emoteAuraSparks.forEach((sp, idx) => {
      const ang = t * 3.5 + (idx / 6) * Math.PI * 2;
      const yUp = ((t * 1.8 + idx * 0.35) % 1.0) * 2.1;
      sp.position.set(Math.cos(ang) * 0.85, 0.2 + yUp, Math.sin(ang) * 0.85);
      sp.rotation.set(t * 5, t * 4, 0);
    });
  } else {
    // 4. AIR GUITAR / COMEMORAÇÃO LEGO: Pulinhos clássicos de vitória + palhetada rápida de guitarra invisível!
    const hop = Math.abs(Math.sin(t * 9.5));
    const strum = Math.sin(t * 24.0);
    minifig.visualRoot.position.y = hop * 0.36;
    minifig.upperBodyGroup.rotation.x = -0.18 + Math.sin(t * 9.5) * 0.14;
    minifig.upperBodyGroup.rotation.y = -0.35;
    if (headObj) headObj.rotation.x = Math.sin(t * 19.0) * 0.26;

    // Braço esquerdo segurando o braço da guitarra imaginária, braço direito palhetando!
    minifig.leftArmPivot.rotation.x = -1.35;
    minifig.leftArmPivot.rotation.z = 0.65;
    minifig.rightArmPivot.rotation.x = -1.05 + strum * 0.38;
    minifig.rightArmPivot.rotation.z = -0.28;

    minifig.leftLegPivot.rotation.x = -hop * 0.45;
    minifig.rightLegPivot.rotation.x = hop * 0.35;
    auraGroup.visible = false;
  }

  return true;
}

// ============================================================================
// 2. GERENCIADOR DAS 3 GRANDES ATRAÇÕES INTERATIVAS (BAILE CDD + MEGA PÍER!)
// ============================================================================
export class InteractiveAttractionsManager {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.time = 0;

    // 1. Baile Funk da CDD (X = -715, Z = -135, Y ≈ 25.0m)
    this.baileCenter = new THREE.Vector3(-715, 25.0, -135);
    this.baileWoofers = [];
    this.baileEqBars = [];
    this.baileLaserPivots = [];
    this.djRig = null;
    this.baileCrowd = null;

    // 2. Atrações Embarcáveis do Mega Píer (Montanha-Russa, Roda-Gigante 73m e Big Drop 58m)
    this.coasterCurve = null;
    this.coasterCars = [];
    this.coasterU = 0.042; // Começa na plataforma de embarque!
    this.coasterStopTimer = 2.0;
    this.coasterSpeed = 0;
    this.coasterStationPos = new THREE.Vector3(-36, 4.2, 1235);

    this.ferrisWheelGroup = null;
    this.ferrisCabins = [];
    this.ferrisWheelCenter = new THREE.Vector3(0, 42.0, 1480);
    this.ferrisWheelRadius = 31.0;
    this.ferrisStationPos = new THREE.Vector3(0, 4.2, 1480);

    this.bigDropGondola = null;
    this.bigDropState = 'BOARDING'; // 'BOARDING' | 'CLIMBING' | 'SUSPENSE' | 'FREEFALL' | 'BRAKING'
    this.bigDropTimer = 2.5;
    this.bigDropY = 3.2;
    this.bigDropVelY = 0;
    this.bigDropBasePos = new THREE.Vector3(24, 3.2, 1325);

    this._dummy = new THREE.Object3D();
    this._tmpTan = new THREE.Vector3();
    this._tmpPos = new THREE.Vector3();

    this._initBaileFunkStageAndCrowd();
    this._initOceanRollerCoaster();
    this._initFerrisWheelLevelingAndPlatform();
    this._initBigDropTowerGondola();
  }

  // --------------------------------------------------------------------------
  // 2.1 BAILE FUNK VIVO NA QUADRA DA CDD (PAREDÃO PULSANTE, DJ LEGO & 28 DANÇARINOS!)
  // --------------------------------------------------------------------------
  _initBaileFunkStageAndCrowd() {
    const cx = -715;
    const cz = -135;
    const yBase = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(cx, cz) : 25.0;
    this.baileCenter.set(cx, yBase, cz);

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

        this.scene.add(wooferPivot);
        this.baileWoofers.push({ pivot: wooferPivot, row });
      }
    }

    // B) Painel Equalizador de LED Colorido atrás do DJ
    const eqColors = [0x22c55e, 0xfacc15, 0xf97316, 0xff1e42, 0x00f0ff, 0xa855f7];
    for (let i = 0; i < 12; i++) {
      const barMat = new THREE.MeshBasicMaterial({ color: eqColors[i % eqColors.length] });
      const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.72), barMat);
      barMesh.position.set(paredaoFaceX + 0.15, yBase + 3.8, cz - 4.95 + i * 0.9);
      this.scene.add(barMesh);
      this.baileEqBars.push(barMesh);
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
    this.scene.add(boothGroup);
    this.djRig = { root: djRoot, head: djHeadPivot, leftArm: djLeftArm, rightArm: djRightArm };

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
      this.scene.add(lPivot);
      this.baileLaserPivots.push({ pivot: lPivot, mat: lMat, phase: l * 1.5 });
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

    this.scene.add(...allInstMeshes);
    this.baileCrowd = {
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
    this._updateBaileCrowdTransforms(0, null, 1.0, false, false);
    this._updateBaileCrowdTransforms(0, null, 1.0, false, true);
  }

  _updateBaileCrowdTransforms(t, playerPos, hypeMult, isPlayerDancingHere, farLodOnly) {
    if (!this.baileCrowd) return;
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
    } = this.baileCrowd;
    const dmy = this._dummy;
    dmy.rotation.order = 'YXZ';

    for (let i = 0; i < allDancers.length; i++) {
      const d = allDancers[i];
      const ph = t * 11.2 + d.phase;
      const beat = Math.sin(ph);
      const halfBeat = Math.sin(ph * 0.5);
      const dblBeat = Math.sin(ph * 2.0);
      const style = d.danceStyle;

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

      let hop = Math.abs(beat) * 0.22 * hypeMult;
      let sideStep = 0;
      let leanX = 0.05;
      let twistZ = beat * 0.08;
      let legPitchL = 0;
      let legPitchR = 0;
      let armPitchL = -1.6;
      let armPitchR = -1.6;
      let armRollL = 0.22;
      let armRollR = -0.22;

      if (style === 0) {
        hop = Math.abs(dblBeat) * 0.24 * hypeMult;
        sideStep = halfBeat * 0.26;
        legPitchL = Math.max(-0.65, Math.min(0.65, beat * 0.58));
        legPitchR = -legPitchL;
        armPitchL = -1.35 + beat * 0.55;
        armPitchR = -1.35 - beat * 0.55;
        leanX = 0.12;
      } else if (style === 1) {
        hop = Math.pow(Math.max(0, beat), 2) * 0.34 * hypeMult;
        armPitchL = -2.45 + dblBeat * 0.38;
        armPitchR = -2.45 + dblBeat * 0.38;
        armRollL = 0.32;
        armRollR = -0.32;
        legPitchL = Math.abs(beat) * 0.22;
        legPitchR = Math.abs(beat) * 0.22;
      } else if (style === 2) {
        sideStep = halfBeat * 0.42;
        hop = Math.abs(beat) * 0.16 * hypeMult;
        legPitchL = halfBeat * 0.36;
        legPitchR = -halfBeat * 0.36;
        armPitchL = -2.1 + beat * 0.35;
        armPitchR = -0.55 - beat * 0.25;
        twistZ = halfBeat * 0.14;
      } else if (style === 3) {
        hop = Math.abs(dblBeat) * 0.22 * hypeMult;
        leanX = 0.16;
        armPitchL = -2.05 + Math.abs(dblBeat) * 0.32;
        armPitchR = -2.05 + Math.abs(dblBeat) * 0.32;
        armRollL = -0.25 + Math.abs(dblBeat) * 0.24;
        armRollR = 0.25 - Math.abs(dblBeat) * 0.24;
      } else {
        hop = Math.abs(halfBeat) * 0.08 * hypeMult;
        armPitchL = -0.4 + halfBeat * 0.28;
        armPitchR = -0.9 - beat * 0.22;
        legPitchL = halfBeat * 0.14;
        legPitchR = -halfBeat * 0.14;
        twistZ = halfBeat * 0.06;
      }

      const px = d.x + cosY * sideStep;
      const pz = d.z - sinY * sideStep;

      if (farLodOnly) {
        dmy.position.set(px, d.y + hop, pz);
        dmy.rotation.set(0, yaw, twistZ);
        dmy.scale.set(1, 1, 1);
        dmy.updateMatrix();
        farLodInst.setMatrixAt(i, dmy.matrix);
        continue;
      }

      const hipY = d.y + 0.72 + hop;
      const shoulderY = hipY + 0.68;

      dmy.position.set(px - cosY * 0.21, hipY, pz + sinY * 0.21);
      dmy.rotation.set(legPitchL, yaw, 0);
      dmy.scale.set(1, 1, 1);
      dmy.updateMatrix();
      leftLegInst.setMatrixAt(i, dmy.matrix);

      dmy.position.set(px + cosY * 0.21, hipY, pz - sinY * 0.21);
      dmy.rotation.set(legPitchR, yaw, 0);
      dmy.updateMatrix();
      rightLegInst.setMatrixAt(i, dmy.matrix);

      dmy.position.set(px, hipY, pz);
      dmy.rotation.set(leanX, yaw, twistZ);
      dmy.updateMatrix();
      bodyInst.setMatrixAt(i, dmy.matrix);

      dmy.position.set(px, hipY + 0.74, pz);
      dmy.rotation.set(leanX * 0.6 + beat * 0.09, yaw, twistZ * 0.5);
      dmy.updateMatrix();
      headInst.setMatrixAt(i, dmy.matrix);

      if (d.hasCap) {
        dmy.position.set(px, hipY + 1.16, pz);
        dmy.rotation.set(leanX * 0.6 + beat * 0.09, yaw, twistZ * 0.5);
        dmy.scale.set(1, 1, 1);
      } else {
        dmy.position.set(px, hipY + 1.16, pz);
        dmy.scale.set(0, 0, 0);
      }
      dmy.updateMatrix();
      capInst.setMatrixAt(i, dmy.matrix);

      dmy.scale.set(1, 1, 1);
      dmy.position.set(px - cosY * 0.49, shoulderY, pz + sinY * 0.49);
      dmy.rotation.set(armPitchL, yaw, armRollL);
      dmy.updateMatrix();
      leftArmInst.setMatrixAt(i, dmy.matrix);

      dmy.position.set(px + cosY * 0.49, shoulderY, pz - sinY * 0.49);
      dmy.rotation.set(armPitchR, yaw, armRollR);
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

  // --------------------------------------------------------------------------
  // 2.2 MONTANHA-RUSSA OCEÂNICA EM CIRCUITO FECHADO (`X = -36, Z = 1235`, PICO `Y = 38m`!)
  // --------------------------------------------------------------------------
  _initOceanRollerCoaster() {
    // Circuito fechado sobre o Píer e as ondas do Oceano Atlântico!
    const waypoints = [
      new THREE.Vector3(-36, 4.2, 1218),  // Entrada da Estação no Píer
      new THREE.Vector3(-36, 4.2, 1235),  // Ponto exato de parada/embarque [E]!
      new THREE.Vector3(-36, 4.4, 1252),  // Saída da Estação
      new THREE.Vector3(-48, 21.0, 1276), // Rampa íngreme de subida (Chain Lift)
      new THREE.Vector3(-60, 38.2, 1304), // PICO MÁXIMO DE 38 METROS SOBRE O MAR!
      new THREE.Vector3(-88, 6.2, 1348),  // Mergulho abissal rasante sobre as ondas do Atlântico!
      new THREE.Vector3(-92, 19.5, 1396), // Curva oceânica inclinada (Banked Turn Sul)
      new THREE.Vector3(-66, 28.0, 1418), // Topo panorâmico Sul de frente para a Roda-Gigante
      new THREE.Vector3(-52, 9.4, 1372),  // Vale de alta velocidade (Airtime Dip)
      new THREE.Vector3(-56, 22.5, 1326), // Colina Camelback de Airtime
      new THREE.Vector3(-48, 8.8, 1278),  // Retorno veloz beirando o Píer
      new THREE.Vector3(-38, 5.0, 1202)   // Curva Norte suave alinhando com a Estação
    ];

    this.coasterCurve = new THREE.CatmullRomCurve3(waypoints, true, 'catmullrom', 0.45);

    // Constrói Trilhos Duplos Vermelhos, Dormentes Amarelos e Colunas Brancas no Mar (3 Draw Calls!)
    const samples = 210;
    const leftPts = [];
    const rightPts = [];
    const tieGeos = [];
    const pillarGeos = [];
    const upVec = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < samples; i++) {
      const u = i / samples;
      const pt = this.coasterCurve.getPointAt(u);
      const tan = this.coasterCurve.getTangentAt(u).normalize();
      const side = new THREE.Vector3().crossVectors(tan, upVec).normalize();
      const bankAngle = this._getCoasterBankAt(u);
      side.applyAxisAngle(tan, bankAngle);

      leftPts.push(pt.clone().addScaledVector(side, -0.82));
      rightPts.push(pt.clone().addScaledVector(side, 0.82));

      if (i % 2 === 0) {
        const tie = new THREE.BoxGeometry(1.95, 0.16, 0.34);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
        const bankQ = new THREE.Quaternion().setFromAxisAngle(tan, bankAngle);
        q.premultiply(bankQ);
        m.compose(pt, q, new THREE.Vector3(1, 1, 1));
        tie.applyMatrix4(m);
        tieGeos.push(tie);
      }

      if (i % 9 === 0) {
        const floorY = Math.abs(pt.x) <= 47 ? 1.6 : -2.5;
        const colH = pt.y - floorY;
        if (colH > 1.2) {
          pillarGeos.push(makeTranslatedBox(0.85, colH, 0.85, pt.x, floorY + colH * 0.5, pt.z));
        }
      }
    }

    const leftCurve = new THREE.CatmullRomCurve3(leftPts, true);
    const rightCurve = new THREE.CatmullRomCurve3(rightPts, true);
    const railGeo = mergeBufferGeometries([
      new THREE.TubeGeometry(leftCurve, 180, 0.13, 7, true),
      new THREE.TubeGeometry(rightCurve, 180, 0.13, 7, true)
    ]);

    const railMesh = new THREE.Mesh(railGeo, getLegoMaterial(0xef4444, { roughness: 0.2, clearcoat: 0.5 }));
    const tieMesh = new THREE.Mesh(
      mergeBufferGeometries(tieGeos),
      getLegoMaterial(0xfacc15, { roughness: 0.25 })
    );
    const pillarMesh = new THREE.Mesh(
      mergeBufferGeometries(pillarGeos),
      getLegoMaterial(0xf8fafc, { roughness: 0.3 })
    );
    this.scene.add(railMesh, tieMesh, pillarMesh);

    // Plataforma de Embarque Acessível no Píer (`X = -36, Z = 1235, Y = 4.0m`) + Escada Larga desde `Y = 1.6m`!
    const platGeos = [
      makeTranslatedBox(6.2, 2.4, 28.0, -31.2, 2.8, 1235),
      makeTranslatedBox(4.0, 0.6, 8.0, -26.2, 1.9, 1235),
      makeTranslatedBox(4.0, 1.2, 6.0, -27.2, 2.2, 1235),
      makeTranslatedBox(4.0, 1.8, 4.0, -28.2, 2.5, 1235)
    ];
    const platMesh = new THREE.Mesh(
      mergeBufferGeometries(platGeos),
      getLegoMaterial(0x1e293b, { roughness: 0.35 })
    );
    this.scene.add(platMesh);
    this.world.addCollider(-31.2, 1235, 6.2, 28.0, 4.0, 1.6);
    this.world.addCollider(-26.2, 1235, 4.0, 8.0, 2.2, 1.6);
    this.world.addCollider(-27.2, 1235, 4.0, 6.0, 2.8, 1.6);
    this.world.addCollider(-28.2, 1235, 4.0, 4.0, 3.4, 1.6);

    const coasterSign = createSignBoardMesh({
      x: -28.0,
      y: 7.2,
      z: 1235,
      width: 15.5,
      height: 2.4,
      depth: 0.4,
      rotY: Math.PI / 2,
      title: '🎢 MONTANHA-RUSSA OCEÂNICA',
      subText: 'QUEDA DE 38m SOBRE O MAR • EMBARQUE [E]',
      bgColor: '#090a0d',
      borderColor: '#ef4444',
      textColor: '#facc15',
      subColor: '#00f0ff'
    });
    this.scene.add(coasterSign);

    // Trem LEGO de 3 Vagões Articulados!
    const carColors = [0xef4444, 0xfacc15, 0x06b6d4];
    for (let c = 0; c < 3; c++) {
      const carGroup = new THREE.Group();
      const body = createLegoBrick(2.1, 0.95, 3.2, carColors[c], { studStep: 0.65 });
      body.position.y = 0.58;
      const nose = createLegoBrick(1.9, 0.72, 0.9, 0xf8fafc, { studs: false });
      nose.position.set(0, 0.52, 1.85);
      const lapBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.14, 0.22),
        getLegoMaterial(0x090a0d)
      );
      lapBar.position.set(0, 1.15, 0.35);
      carGroup.add(body, nose, lapBar);

      if (c === 0) {
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        for (const lx of [-0.6, 0.6]) {
          const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 10), hlMat);
          hl.rotation.x = Math.PI / 2;
          hl.position.set(lx, 0.62, 2.32);
          carGroup.add(hl);
        }
      }

      this.scene.add(carGroup);
      this.coasterCars.push(carGroup);
    }
    this._updateCoasterTrainTransforms();
  }

  _getCoasterBankAt(u) {
    // Inclina nas curvas oceânicas (u ≈ 0.45..0.68 e u ≈ 0.88..0.98) e fica 0° na estação!
    if (u >= 0.42 && u <= 0.68) {
      return Math.sin(((u - 0.42) / 0.26) * Math.PI) * 0.58;
    }
    if (u >= 0.86 && u <= 0.98) {
      return -Math.sin(((u - 0.86) / 0.12) * Math.PI) * 0.42;
    }
    return 0;
  }

  _updateCoasterTrainTransforms() {
    if (!this.coasterCurve || this.coasterCars.length === 0) return;
    const upVec = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.coasterCars.length; i++) {
      const carU = (this.coasterU - i * 0.0145 + 1.0) % 1.0;
      const pt = this.coasterCurve.getPointAt(carU);
      const tan = this.coasterCurve.getTangentAt(carU).normalize();
      const bank = this._getCoasterBankAt(carU);

      const car = this.coasterCars[i];
      car.position.copy(pt);
      const lookMat = new THREE.Matrix4().lookAt(pt, pt.clone().add(tan), upVec);
      // Em Three.js Matrix4.lookAt aponta -Z para target, então giramos Y em PI para +Z ser frente!
      const q = new THREE.Quaternion().setFromRotationMatrix(lookMat);
      const flipQ = new THREE.Quaternion().setFromAxisAngle(upVec, Math.PI);
      q.multiply(flipQ);
      const bankQ = new THREE.Quaternion().setFromAxisAngle(tan, bank);
      q.premultiply(bankQ);
      car.quaternion.copy(q);
    }
  }

  // --------------------------------------------------------------------------
  // 2.3 RODA-GIGANTE COLOSSAL (73m!) COM 16 CABINES NIVELADAS & PLATAFORMA [E]
  // --------------------------------------------------------------------------
  _initFerrisWheelLevelingAndPlatform() {
    this.ferrisWheelGroup = this.world.ferrisWheelGroup || null;
    this.ferrisCabins = this.world.ferrisWheelCabins || [];

    // Escadaria frontal e Letreiro na Base da Roda-Gigante (`X = 0, Z = 1480, Y = 4.2m`)
    const stairGeos = [
      makeTranslatedBox(12.0, 0.85, 4.0, 0, 2.02, 1452.0),
      makeTranslatedBox(12.0, 1.7, 4.0, 0, 2.45, 1454.0)
    ];
    const stairMesh = new THREE.Mesh(
      mergeBufferGeometries(stairGeos),
      getLegoMaterial(0xf8fafc, { roughness: 0.28 })
    );
    this.scene.add(stairMesh);
    this.world.addCollider(0, 1452.0, 12.0, 4.0, 2.45, 1.6);
    this.world.addCollider(0, 1454.0, 12.0, 4.0, 3.3, 1.6);

    const ferrisSign = createSignBoardMesh({
      x: 0,
      y: 7.4,
      z: 1455.0,
      width: 18.0,
      height: 2.4,
      depth: 0.42,
      rotY: Math.PI,
      title: '🎡 RODA-GIGANTE COLOSSAL (73m)',
      subText: '16 CABINES PANORÂMICAS NIVELADAS • EMBARQUE [E]',
      bgColor: '#090a0d',
      borderColor: '#00f0ff',
      textColor: '#facc15',
      subColor: '#f8fafc'
    });
    this.scene.add(ferrisSign);
  }

  // --------------------------------------------------------------------------
  // 2.4 TORRE DE QUEDA LIVRE "BIG DROP" DE 58 METROS (`X = +24, Z = 1325`)
  // --------------------------------------------------------------------------
  _initBigDropTowerGondola() {
    const gondola = new THREE.Group();
    gondola.position.set(24, this.bigDropY, 1325);

    const ringFrame = createLegoBrick(9.4, 1.4, 9.4, 0xec4899, { studStep: 0.8 });
    ringFrame.position.y = 0.7;
    const neonTrim = new THREE.Mesh(
      new THREE.BoxGeometry(9.7, 0.28, 9.7),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    neonTrim.position.y = 1.48;
    gondola.add(ringFrame, neonTrim);

    // Assentos amarelos com trava de ombro preta nas 4 faces da gôndola!
    const seatMat = getLegoMaterial(0xfacc15, { roughness: 0.22 });
    const barMat = getLegoMaterial(0x090a0d, { roughness: 0.35 });
    for (const [sx, sz] of [
      [-2.2, -4.9],
      [2.2, -4.9],
      [-2.2, 4.9],
      [2.2, 4.9],
      [-4.9, -2.2],
      [-4.9, 2.2],
      [4.9, -2.2],
      [4.9, 2.2]
    ]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.1), seatMat);
      seat.position.set(sx, 0.85, sz);
      const harness = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.28), barMat);
      harness.position.set(sx, 1.25, sz * 1.05);
      gondola.add(seat, harness);
    }

    this.scene.add(gondola);
    this.bigDropGondola = gondola;

    const dropSign = createSignBoardMesh({
      x: 24,
      y: 6.8,
      z: 1317.5,
      width: 13.5,
      height: 2.2,
      depth: 0.4,
      rotY: Math.PI,
      title: '🗼 BIG DROP TOWER (58m)',
      subText: 'SUSPENSE NO TOPO & QUEDA LIVRE • [E]',
      bgColor: '#090a0d',
      borderColor: '#ec4899',
      textColor: '#facc15',
      subColor: '#00f0ff'
    });
    this.scene.add(dropSign);
  }

  // --------------------------------------------------------------------------
  // 2.5 BUSCA DE ATRAÇÃO PRÓXIMA PARA PROMPT [E] E EMBARQUE DO JOGADOR
  // --------------------------------------------------------------------------
  findNearbyAttraction(playerPos) {
    if (!playerPos) return null;

    // 1. Montanha-Russa Oceânica (perto da Plataforma `(-31.2, 4.0, 1235)` ou do 1º Vagão!)
    const dCoasterPlat = Math.hypot(playerPos.x - -31.5, playerPos.z - 1235);
    const leadCar = this.coasterCars[0];
    const dCoasterCar = leadCar
      ? Math.hypot(playerPos.x - leadCar.position.x, playerPos.z - leadCar.position.z)
      : Infinity;
    if (
      (dCoasterPlat <= 8.5 && Math.abs(playerPos.y - 3.2) <= 3.5) ||
      (dCoasterCar <= 6.5 && Math.abs(playerPos.y - leadCar.position.y) <= 4.0)
    ) {
      return {
        type: 'roller_coaster',
        label: 'ANDAR NA MONTANHA-RUSSA',
        exitPos: new THREE.Vector3(-30.5, 4.05, 1235)
      };
    }

    // 2. Roda-Gigante Colossal (`X = 0, Z = 1480` — plataforma e escadaria `Z = 1452..1492`)
    const dFerris = Math.hypot(playerPos.x - 0, playerPos.z - 1468);
    if (dFerris <= 18.5 && playerPos.y >= 1.2 && playerPos.y <= 8.5) {
      return {
        type: 'ferris_wheel',
        label: 'ENTRAR NA RODA-GIGANTE',
        exitPos: new THREE.Vector3(0, 4.25, 1458)
      };
    }

    // 3. Torre de Queda Livre Big Drop (`X = 24, Z = 1325`)
    const dDrop = Math.hypot(playerPos.x - 24, playerPos.z - 1325);
    if (dDrop <= 9.5 && playerPos.y >= 1.2 && playerPos.y <= 7.5) {
      return {
        type: 'big_drop',
        label: 'ENTRAR NO BIG DROP',
        exitPos: new THREE.Vector3(24, 1.65, 1316.5)
      };
    }

    return null;
  }

  /**
   * Retorna o índice da cabine mais baixa da Roda-Gigante no momento do embarque
   */
  getLowestFerrisCabinIndex() {
    if (!this.ferrisWheelGroup || this.ferrisCabins.length === 0) return 0;
    let bestIdx = 0;
    let lowestY = Infinity;
    const wp = new THREE.Vector3();
    this.ferrisWheelGroup.updateMatrixWorld(true);
    this.ferrisCabins.forEach((cab, idx) => {
      cab.getWorldPosition(wp);
      if (wp.y < lowestY) {
        lowestY = wp.y;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  /**
   * Calcula a posição 3D e rotação em tempo real do assento do jogador em qualquer uma das 3 atrações!
   */
  getRideSeatTransform(rideState) {
    if (!rideState) return null;

    if (rideState.type === 'roller_coaster' && this.coasterCars[0]) {
      const car = this.coasterCars[0];
      car.updateMatrixWorld(true);
      const seatWorldPos = new THREE.Vector3(0, 0.65, 0.15).applyMatrix4(car.matrixWorld);
      return {
        pos: seatWorldPos,
        quat: car.quaternion.clone(),
        yaw: Math.atan2(
          2 * (car.quaternion.w * car.quaternion.y + car.quaternion.x * car.quaternion.z),
          1 - 2 * (car.quaternion.y * car.quaternion.y + car.quaternion.x * car.quaternion.x)
        ),
        camDist: 8.5,
        camHeight: 2.8
      };
    }

    if (rideState.type === 'ferris_wheel' && this.ferrisCabins.length > 0) {
      const cab = this.ferrisCabins[rideState.cabinIdx || 0] || this.ferrisCabins[0];
      this.ferrisWheelGroup?.updateMatrixWorld(true);
      const wp = new THREE.Vector3();
      cab.getWorldPosition(wp);
      wp.y -= 0.85; // Piso interno da cabine nivelada!
      return {
        pos: wp,
        quat: null, // Cabine permanece 100% nivelada na vertical!
        yaw: Math.PI, // Olhando de frente para a Praia, Favela e Skyline!
        camDist: 10.5,
        camHeight: 2.3
      };
    }

    if (rideState.type === 'big_drop' && this.bigDropGondola) {
      const gPos = this.bigDropGondola.position;
      return {
        pos: new THREE.Vector3(gPos.x, gPos.y + 0.55, gPos.z - 4.95),
        quat: null,
        yaw: Math.PI, // Assento norte encarando toda a Orla e a Cidade!
        camDist: 9.8,
        camHeight: 2.4
      };
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // 2.6 UPDATE EM TEMPO REAL (60 FPS) DO BAILE E DAS 3 ATRAÇÕES DO PÍER
  // --------------------------------------------------------------------------
  update(dt, playerPos = null, controller = null) {
    this.time += dt;
    const t = this.time;

    // 1. Áudio Espacial por Proximidade (< 75m) + Pulsação do Paredão + DJ + Multidão do Baile da CDD!
    const distToBaile = playerPos ? playerPos.distanceTo(this.baileCenter) : 999;
    soundFX.updateBaileSpatialProximity(distToBaile, dt);

    // Mesmo visto de longe (ex.: 140m), o Paredão pulsa visualmente no ritmo de 130 BPM!
    const synthBeat = Math.pow(Math.max(0, Math.sin(t * 13.6)), 3);
    const beatKick = Math.max(soundFX.baileBeatPulse || 0, synthBeat);

    if (distToBaile < 240) {
      for (let i = 0; i < this.baileWoofers.length; i++) {
        const w = this.baileWoofers[i];
        const s = 1.0 + beatKick * (w.row < 2 ? 0.38 : 0.26);
        w.pivot.scale.set(1.0 + beatKick * 0.25, s, s);
      }

      for (let i = 0; i < this.baileEqBars.length; i++) {
        const bar = this.baileEqBars[i];
        const eqH = 0.4 + Math.abs(Math.sin(t * 11.0 + i * 0.7)) * (1.2 + beatKick * 1.4);
        bar.scale.y = eqH;
      }

      if (this.djRig) {
        this.djRig.head.rotation.x = Math.sin(t * 13.6) * 0.25;
        this.djRig.head.rotation.y = Math.sin(t * 3.4) * 0.35;
        // Mão direita fazendo scratch no disco, mão esquerda levantando a galera!
        this.djRig.rightArm.rotation.x = -1.25 + Math.sin(t * 22.0) * 0.28;
        this.djRig.leftArm.rotation.x = -2.45 + Math.sin(t * 13.6) * 0.45;
      }

      const nightFactor = this.world.atmosphere?.nightFactor || 0;
      const isPlayerDancingHere = Boolean(controller?.minifigure?.activeEmote && distToBaile < 36.0);
      const hypeMult = 1.0 + nightFactor * 0.45 + (isPlayerDancingHere ? 0.45 : 0);

      for (const ls of this.baileLaserPivots) {
        ls.pivot.rotation.x = Math.sin(t * 2.4 + ls.phase) * 0.55;
        ls.pivot.rotation.z = 0.75 + Math.cos(t * 1.9 + ls.phase) * 0.32;
        ls.mat.opacity = 0.16 + nightFactor * 0.36;
      }
    }

    if (this.baileCrowd) {
      const nightFactor = this.world.atmosphere?.nightFactor || 0;
      const isPlayerDancingHere = Boolean(controller?.minifigure?.activeEmote && distToBaile < 36.0);
      const hypeMult = 1.0 + nightFactor * 0.45 + (isPlayerDancingHere ? 0.45 : 0);

      // LOD em 2 níveis com histerese para evitar sumir na tela ou cair FPS:
      // LOD Near (< 150..165m): 64 NPCs com 7 partes articuladas e 5 estilos de dança
      // LOD Far (150..420..445m): 64 silhuetas unificadas (1 draw call) dançando à distância
      const prevMode = this.baileCrowd.lodMode || 'near';
      let nextMode = 'hidden';
      if (distToBaile <= (prevMode === 'near' ? 165 : 150)) {
        nextMode = 'near';
      } else if (distToBaile <= (prevMode === 'far' ? 445 : 420)) {
        nextMode = 'far';
      }
      this.baileCrowd.lodMode = nextMode;

      const {
        leftLegInst,
        rightLegInst,
        bodyInst,
        headInst,
        leftArmInst,
        rightArmInst,
        capInst,
        farLodInst
      } = this.baileCrowd;
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
        this._updateBaileCrowdTransforms(
          t,
          playerPos,
          hypeMult,
          isPlayerDancingHere,
          nextMode === 'far'
        );
      }
    }

    // 2. Montanha-Russa Oceânica (para 4s na estação `u ≈ 0.042` a cada volta!)
    if (this.coasterCurve) {
      if (this.coasterStopTimer > 0) {
        this.coasterStopTimer = Math.max(0, this.coasterStopTimer - dt);
        this.coasterSpeed = 0;
      } else {
        const curPt = this.coasterCurve.getPointAt(this.coasterU);
        // Velocidade física gravitacional: sobe a rampa a 13.5 m/s e despenca a até 43 m/s!
        const dropEnergy = Math.max(0, 40.5 - curPt.y);
        const targetSpd = this.coasterU < 0.28
          ? 13.5
          : THREE.MathUtils.clamp(14.0 + Math.sqrt(dropEnergy) * 4.6, 14.0, 43.0);
        this.coasterSpeed = THREE.MathUtils.lerp(this.coasterSpeed, targetSpd, Math.min(1, dt * 5));

        const totalLen = this.coasterCurve.getLength() || 520;
        const prevU = this.coasterU;
        this.coasterU = (this.coasterU + (this.coasterSpeed * dt) / totalLen) % 1.0;

        // Ao cruzar o ponto da Estação (`u = 0.042`), estaciona por 4.0 segundos!
        if (prevU < 0.042 && this.coasterU >= 0.042) {
          this.coasterU = 0.042;
          this.coasterStopTimer = 4.0;
        }
      }
      this._updateCoasterTrainTransforms();
    }

    // 3. Roda-Gigante Colossal (73m) mantendo todas as 16 Cabines 100% na vertical!
    if (this.ferrisWheelGroup) {
      this.ferrisWheelGroup.rotation.x += 0.22 * dt;
      const wheelRotX = this.ferrisWheelGroup.rotation.x;
      for (let i = 0; i < this.ferrisCabins.length; i++) {
        this.ferrisCabins[i].rotation.x = -wheelRotX;
      }
    }

    // 4. Torre de Queda Livre "Big Drop" (58m: Embarque -> Subida -> 2s Suspense -> Queda Livre -> Freio!)
    if (this.bigDropGondola) {
      const minY = 3.2;
      const topY = 58.0;

      if (this.bigDropState === 'BOARDING') {
        this.bigDropY = minY;
        this.bigDropTimer -= dt;
        if (this.bigDropTimer <= 0) {
          this.bigDropState = 'CLIMBING';
        }
      } else if (this.bigDropState === 'CLIMBING') {
        this.bigDropY += 9.5 * dt;
        if (this.bigDropY >= topY) {
          this.bigDropY = topY;
          this.bigDropState = 'SUSPENSE';
          this.bigDropTimer = 2.0; // 2 segundos de suspense lá no topo!
        }
      } else if (this.bigDropState === 'SUSPENSE') {
        this.bigDropTimer -= dt;
        if (this.bigDropTimer <= 0) {
          this.bigDropState = 'FREEFALL';
          this.bigDropVelY = -4.0;
        }
      } else if (this.bigDropState === 'FREEFALL') {
        this.bigDropVelY -= 38.0 * dt;
        this.bigDropY += this.bigDropVelY * dt;
        if (this.bigDropY <= 12.5) {
          this.bigDropState = 'BRAKING';
          if (controller?.activeRide?.type === 'big_drop') {
            controller.cameraShakeTimer = 0.35;
            soundFX.playTacticalRoll();
          }
        }
      } else if (this.bigDropState === 'BRAKING') {
        this.bigDropY = THREE.MathUtils.lerp(this.bigDropY, minY, Math.min(1, dt * 6.5));
        if (this.bigDropY <= minY + 0.12) {
          this.bigDropY = minY;
          this.bigDropVelY = 0;
          this.bigDropState = 'BOARDING';
          this.bigDropTimer = 3.5;
        }
      }

      this.bigDropGondola.position.y = this.bigDropY;
    }
  }
}
