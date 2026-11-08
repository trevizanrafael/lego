import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createMinifigFaceTexture,
  createMinifigTorsoTexture
} from '../materials/LegoMaterials.js';

/**
 * Cria a geometria trapezoidal clássica do tronco de uma Minifigura LEGO
 */
function createTrapezoidTorsoGeometry(bottomWidth = 0.78, topWidth = 0.94, height = 0.76, depth = 0.44) {
  const geom = new THREE.BoxGeometry(1, height, depth, 1, 1, 1);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const isTop = y > 0;
    const halfW = (isTop ? topWidth : bottomWidth) * 0.5;
    pos.setX(i, x > 0 ? halfW : -halfW);
  }

  geom.computeVertexNormals();
  return geom;
}

export const MINIFIG_PRESETS = {
  caveira: {
    key: 'caveira',
    name: 'Comandante Caveira (BOPE)',
    subtitle: 'Fuzil Tático • Granada • Rolamento',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.black,
    armColor: LEGO_COLORS.charcoal,
    handColor: LEGO_COLORS.yellow,
    hipColor: LEGO_COLORS.black,
    legColor: LEGO_COLORS.charcoal,
    facePreset: 'caveira',
    torsoPreset: 'caveira',
    headgear: 'beret',
    capeColor: null,
    weapon: 'rifle',
    fireAura: false
  },
  solaris: {
    key: 'solaris',
    name: 'Solaris (Guerreiro Solar)',
    subtitle: 'Voo Cometa • Raio Solar • Supernova',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.red,
    armColor: LEGO_COLORS.gold,
    handColor: LEGO_COLORS.yellow,
    hipColor: LEGO_COLORS.crimson,
    legColor: LEGO_COLORS.red,
    facePreset: 'solaris',
    torsoPreset: 'solaris',
    headgear: 'visor_crown',
    capeColor: LEGO_COLORS.orange,
    weapon: 'solar_orbs',
    fireAura: true
  },
  tita: {
    key: 'tita',
    name: 'Titã Blindado (Big-Fig)',
    subtitle: 'Soco Foguete [V] • Arremessar Carro [Mouse 2] • Terremoto [Q]',
    headColor: 0x0f172a,
    torsoColor: 0x0f172a,
    armColor: 0x1e3a8a,
    handColor: LEGO_COLORS.gold,
    hipColor: LEGO_COLORS.gold,
    legColor: 0x0f172a,
    facePreset: 'tita',
    torsoPreset: 'tita',
    headgear: 'mecha_helmet',
    capeColor: null,
    weapon: 'tita_rig',
    fireAura: false,
    isBigFig: true
  },
  vingador: {
    key: 'vingador',
    name: 'Vingador de Chumbo',
    subtitle: '[R] Trocar Arma: Duas SMGs • Escopeta • Bazuca RPG',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x111827,
    armColor: 0x1f2937,
    handColor: LEGO_COLORS.darkGrey,
    hipColor: LEGO_COLORS.silver,
    legColor: 0x090a0d,
    facePreset: 'vingador',
    torsoPreset: 'vingador',
    headgear: 'tactical_bandana',
    capeColor: null,
    weapon: 'vingador_arsenal',
    fireAura: false
  },
  sombra: {
    key: 'sombra',
    name: 'Sombra Escarlate',
    subtitle: 'Gancho Magnético [Mouse 2] • Katanas • Fumaça Invisível [Q] • Puxão [G]',
    headColor: 0x090a0d,
    torsoColor: 0x090a0d,
    armColor: 0x18181b,
    handColor: LEGO_COLORS.red,
    hipColor: LEGO_COLORS.red,
    legColor: 0x090a0d,
    facePreset: 'sombra',
    torsoPreset: 'sombra',
    headgear: 'ninja_hood',
    capeColor: 0x991b1b,
    weapon: 'dual_katanas',
    fireAura: false
  }
};

export class Minifigure {
  constructor(presetKey = 'caveira') {
    this.root = new THREE.Group();
    this.visualRoot = new THREE.Group();
    this.root.add(this.visualRoot);

    this.animTime = 0;
    this.walkPhase = 0;
    this.state = 'IDLE'; // IDLE, WALK, RUN, JUMP, FALL, ROLL, HOVER, COMET
    this.landingSquash = 0;
    this.wasGrounded = true;

    this.punchTimer = 0;
    this.punchDuration = 0.22;
    this.punchComboStep = 0; // 0: Jab Esquerdo, 1: Direto Cruzado, 2: Gancho Duplo
    this.combatStanceTimer = 0; // Mantém a guarda erguida entre socos!
    this.shootTimer = 0;
    this.muzzleFlashTimer = 0;
    this.rollTimer = 0;
    this.rollDuration = 0.42;
    this.isBeaming = false;

    this.currentHeroKey = presetKey;
    this.flameParticles = [];
    this.muzzleFlashMesh = null;
    this.leftMuzzleFlashMesh = null;
    this.rifleGroup = null;
    this.vingadorWeapon = 'dual_smg'; // 'dual_smg' | 'shotgun' | 'rpg'
    this.isCarryingCar = false;
    this.isGrappling = false;
    this.isStealth = false;
    this.isBigFig = false;

    this.setHero(presetKey);
  }

  setHero(presetKey) {
    const preset = MINIFIG_PRESETS[presetKey] || MINIFIG_PRESETS.caveira;
    this.currentHeroKey = preset.key;
    this.isBigFig = Boolean(preset.isBigFig);
    this.isStealth = false;
    this.buildModel(preset);
    return preset;
  }

  buildModel(preset) {
    while (this.visualRoot.children.length > 0) {
      this.visualRoot.remove(this.visualRoot.children[0]);
    }
    this.flameParticles = [];
    this.muzzleFlashMesh = null;
    this.leftMuzzleFlashMesh = null;
    this.rifleGroup = null;
    this.dualSmgLeft = null;
    this.dualSmgRight = null;
    this.shotgunGroup = null;
    this.rpgGroup = null;
    this.leftKatanaGroup = null;
    this.rightKatanaGroup = null;
    this.titaShieldGroup = null;
    this.titaCannonGroup = null;

    if (preset.isBigFig) {
      this.visualRoot.scale.set(1.68, 1.56, 1.68);
    } else {
      this.visualRoot.scale.set(1, 1, 1);
    }

    const headMat = getLegoMaterial(preset.headColor, { roughness: 0.2, clearcoat: 0.5 });
    const torsoMat = getLegoMaterial(preset.torsoColor, { roughness: 0.24, clearcoat: 0.45 });
    const armMat = getLegoMaterial(preset.armColor, { roughness: 0.24, clearcoat: 0.45 });
    const handMat = getLegoMaterial(preset.handColor, { roughness: 0.22, clearcoat: 0.45 });
    const hipMat = getLegoMaterial(preset.hipColor, { roughness: 0.26, clearcoat: 0.4 });
    const legMat = getLegoMaterial(preset.legColor, { roughness: 0.25, clearcoat: 0.42 });

    // ==========================================
    // 1. QUADRIL / PELVE & PERNAS ARTICULADAS
    // ==========================================
    this.hipGroup = new THREE.Group();
    this.hipGroup.position.set(0, 0.72, 0);
    this.visualRoot.add(this.hipGroup);

    const waistMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.42), hipMat);
    waistMesh.position.set(0, 0.07, 0);
    waistMesh.castShadow = true;
    waistMesh.receiveShadow = true;
    this.hipGroup.add(waistMesh);

    const crotchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.4), hipMat);
    crotchMesh.position.set(0, -0.06, 0);
    crotchMesh.castShadow = true;
    this.hipGroup.add(crotchMesh);

    this.leftLegPivot = this._createLeg(legMat);
    this.leftLegPivot.position.set(0.21, 0, 0);
    this.hipGroup.add(this.leftLegPivot);

    this.rightLegPivot = this._createLeg(legMat);
    this.rightLegPivot.position.set(-0.21, 0, 0);
    this.hipGroup.add(this.rightLegPivot);

    // ==========================================
    // 2. TRONCO TRAPEZOIDAL (UPPER BODY)
    // ==========================================
    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.position.set(0, 0.86, 0);
    this.visualRoot.add(this.upperBodyGroup);

    const torsoGeo = createTrapezoidTorsoGeometry(0.78, 0.94, 0.76, 0.44);
    this.torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    this.torsoMesh.position.set(0, 0.38, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.upperBodyGroup.add(this.torsoMesh);

    const torsoTex = createMinifigTorsoTexture(preset.torsoPreset);
    const chestDecalGeo = createTrapezoidTorsoGeometry(0.74, 0.88, 0.72, 0.01);
    const chestDecalMat = getLegoMaterial(0xffffff, {
      map: torsoTex,
      roughness: 0.22,
      clearcoat: 0.45
    });
    const chestDecal = new THREE.Mesh(chestDecalGeo, chestDecalMat);
    chestDecal.position.set(0, 0.38, 0.221);
    this.upperBodyGroup.add(chestDecal);

    if (preset.capeColor) {
      const capeMat = getLegoMaterial(preset.capeColor, {
        roughness: 0.35,
        clearcoat: 0.2,
        emissive: 0xea580c,
        emissiveIntensity: 0.22
      });
      const capeGeo = createTrapezoidTorsoGeometry(1.08, 0.76, 1.18, 0.03);
      this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
      this.capeMesh.position.set(0, 0.22, -0.25);
      this.capeMesh.rotation.x = 0.12;
      this.capeMesh.castShadow = true;
      this.upperBodyGroup.add(this.capeMesh);
    } else {
      this.capeMesh = null;
    }

    // ==========================================
    // 3. BRAÇOS, MÃOS E ARMAMENTO / PODER 3D
    // ==========================================
    const leftArmData = this._createArm(armMat, handMat, 1);
    this.leftArmPivot = leftArmData.shoulderPivot;
    this.leftHandGroup = leftArmData.forearmGroup;
    this.leftArmPivot.position.set(0.49, 0.66, 0);
    this.upperBodyGroup.add(this.leftArmPivot);

    const rightArmData = this._createArm(armMat, handMat, -1);
    this.rightArmPivot = rightArmData.shoulderPivot;
    this.rightHandGroup = rightArmData.forearmGroup;
    this.rightArmPivot.position.set(-0.49, 0.66, 0);
    this.upperBodyGroup.add(this.rightArmPivot);

    if (preset.weapon === 'rifle') {
      this._attachTacticalRifle(this.rightHandGroup);
    } else if (preset.weapon === 'solar_orbs') {
      this._attachSolarOrbs(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'tita_rig') {
      this._attachTitaBigFigRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'vingador_arsenal') {
      this._attachVingadorArsenal(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'dual_katanas') {
      this._attachDualKatanas(this.leftHandGroup, this.rightHandGroup);
    }

    if (preset.fireAura) {
      this._buildSolarAuraParticles();
    }

    // ==========================================
    // 4. PESCOÇO, CABEÇA CILÍNDRICA & PINO LEGO
    // ==========================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.76, 0);
    this.upperBodyGroup.add(this.headGroup);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20),
      headMat
    );
    neckMesh.position.set(0, 0.04, 0);
    neckMesh.castShadow = true;
    this.headGroup.add(neckMesh);

    const headHeight = 0.52;
    const headRadius = 0.35;
    const headCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 32),
      headMat
    );
    headCylinder.position.set(0, 0.33, 0);
    headCylinder.castShadow = true;
    headCylinder.receiveShadow = true;
    this.headGroup.add(headCylinder);

    const rimGeo = new THREE.TorusGeometry(headRadius - 0.03, 0.03, 12, 32);
    rimGeo.rotateX(Math.PI / 2);
    const topRim = new THREE.Mesh(rimGeo, headMat);
    topRim.position.set(0, 0.33 + headHeight * 0.5, 0);
    this.headGroup.add(topRim);

    const botRim = new THREE.Mesh(rimGeo, headMat);
    botRim.position.set(0, 0.33 - headHeight * 0.5, 0);
    this.headGroup.add(botRim);

    const faceTex = createMinifigFaceTexture(preset.facePreset);
    const faceMat = new THREE.MeshPhysicalMaterial({
      map: faceTex,
      roughness: 0.2,
      clearcoat: 0.45
    });
    const faceShellGeo = new THREE.CylinderGeometry(
      headRadius + 0.003,
      headRadius + 0.003,
      headHeight * 0.9,
      32,
      1,
      true,
      -Math.PI * 0.45,
      Math.PI * 0.9
    );
    const faceShell = new THREE.Mesh(faceShellGeo, faceMat);
    faceShell.position.set(0, 0.33, 0);
    this.headGroup.add(faceShell);

    const headStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.13, 24),
      headMat
    );
    headStud.position.set(0, 0.33 + headHeight * 0.5 + 0.065, 0);
    headStud.castShadow = true;
    headStud.receiveShadow = true;
    this.headGroup.add(headStud);

    if (preset.headgear === 'beret') {
      const beretGroup = new THREE.Group();
      const beretMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.32, clearcoat: 0.3 });
      const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.4, roughness: 0.2 });

      const beretBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.37, 0.12, 24),
        beretMat
      );
      beretBase.position.set(0, 0.62, 0);
      beretGroup.add(beretBase);

      const beretTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.40, 0.12, 24),
        beretMat
      );
      beretTop.position.set(-0.04, 0.69, 0.02);
      beretTop.rotation.z = 0.14;
      beretTop.castShadow = true;
      beretGroup.add(beretTop);

      const beretStud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20),
        beretMat
      );
      beretStud.position.set(-0.04, 0.77, 0.02);
      beretGroup.add(beretStud);

      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), goldMat);
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0.1, 0.66, 0.38);
      beretGroup.add(badge);

      this.headGroup.add(beretGroup);
    } else if (preset.headgear === 'visor_crown') {
      const crownMat = getLegoMaterial(LEGO_COLORS.gold, {
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        roughness: 0.16,
        clearcoat: 0.55
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.11, 24), crownMat);
      band.position.set(0, 0.6, 0);
      this.headGroup.add(band);

      // Cristais de fogo solares na testa
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.08), crownMat);
      crest.position.set(0, 0.66, 0.36);
      crest.rotation.z = Math.PI / 4;
      this.headGroup.add(crest);

      const goldStud = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.14, 24), crownMat);
      goldStud.position.set(0, 0.67, 0);
      this.headGroup.add(goldStud);
    } else if (preset.headgear === 'mecha_helmet') {
      // Capacete Mecha-Policial do Titã Blindado (Big-Fig) com antenas laterais e visor ciano
      const helmMat = getLegoMaterial(0x1e3a8a, { roughness: 0.2, metalness: 0.45 });
      const goldMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.18, metalness: 0.55 });
      const cyanMat = getLegoMaterial(0x00f0ff, { emissive: 0x00f0ff, emissiveIntensity: 1.4 });

      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.39, 0.16, 24), helmMat);
      dome.position.set(0, 0.62, 0);
      this.headGroup.add(dome);

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.48), goldMat);
      crest.position.set(0, 0.72, 0.04);
      this.headGroup.add(crest);

      const visorBar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.11, 0.14), cyanMat);
      visorBar.position.set(0, 0.42, 0.33);
      this.headGroup.add(visorBar);

      for (const side of [-1, 1]) {
        const earPod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.24), helmMat);
        earPod.position.set(side * 0.37, 0.36, 0);
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), goldMat);
        antenna.position.set(side * 0.39, 0.58, -0.06);
        this.headGroup.add(earPod, antenna);
      }
    } else if (preset.headgear === 'tactical_bandana') {
      // Cabelo Militar + Bandana Tática Preta/Prateada do Vingador de Chumbo
      const hairMat = getLegoMaterial(0x090a0d, { roughness: 0.35 });
      const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.6, roughness: 0.2 });

      const hairCap = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.38, 0.14, 24), hairMat);
      hairCap.position.set(0, 0.62, 0);
      this.headGroup.add(hairCap);

      const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.368, 0.368, 0.09, 24), silverMat);
      headband.position.set(0, 0.54, 0);
      this.headGroup.add(headband);

      const knotTail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.1), hairMat);
      knotTail.position.set(0, 0.46, -0.38);
      knotTail.rotation.x = 0.35;
      this.headGroup.add(knotTail);
    } else if (preset.headgear === 'ninja_hood') {
      // Capuz Shinobi Completo do Sombra Escarlate com Crista Vermelha Neon
      const hoodMat = getLegoMaterial(0x090a0d, { roughness: 0.28 });
      const redMat = getLegoMaterial(LEGO_COLORS.red, { emissive: 0xdc2626, emissiveIntensity: 0.35 });

      const hoodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.39, 0.16, 24), hoodMat);
      hoodTop.position.set(0, 0.61, 0);
      this.headGroup.add(hoodTop);

      const scarfCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.41, 0.14, 24), redMat);
      scarfCollar.position.set(0, 0.11, 0);
      this.headGroup.add(scarfCollar);

      const ninjaCrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), redMat);
      ninjaCrest.position.set(0, 0.55, 0.36);
      this.headGroup.add(ninjaCrest);
    }
  }

  /**
   * Equipa o Chassi Colossal Big-Fig do Titã Blindado (#3):
   * - Ombreiras blindadas largas com pinos LEGO e giroflex ciano/dourado
   * - Reator de Peito 3D + Mochila Propulsora a Jato nas costas
   * - Escudo Policial de Terremoto no braço esquerdo + Metralhadora Rotativa Pesada e Punho Foguete no direito!
   */
  _attachTitaBigFigRig(leftHandGroup, rightHandGroup) {
    const navyMat = getLegoMaterial(0x1e3a8a, { roughness: 0.2, metalness: 0.35 });
    const darkSteel = getLegoMaterial(0x0f172a, { roughness: 0.25, metalness: 0.5 });
    const goldMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.18, metalness: 0.6 });
    const cyanGlow = getLegoMaterial(0x00f0ff, { emissive: 0x00f0ff, emissiveIntensity: 1.8 });

    // 1. Ombreiras Colossais (Big-Fig Broad Shoulders) + Pinos LEGO
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      armPivot.position.x = sign * 0.58;
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.56), navyMat);
      pauldron.position.set(sign * 0.08, 0.08, 0);
      pauldron.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.58), goldMat);
      stripe.position.set(sign * 0.08, 0.18, 0);
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14), goldMat);
      stud.position.set(sign * 0.08, 0.28, 0);
      armPivot.add(pauldron, stripe, stud);
    }

    // 2. Reator de Energia Ciano 3D no peito + Propulsores Dorsais (Jetpack Pesado)
    const reactorRing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20), goldMat);
    reactorRing.rotation.x = Math.PI / 2;
    reactorRing.position.set(0, 0.42, 0.24);
    const reactorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), cyanGlow);
    reactorCore.rotation.x = Math.PI / 2;
    reactorCore.position.set(0, 0.42, 0.25);
    this.upperBodyGroup.add(reactorRing, reactorCore);

    const jetpack = new THREE.Group();
    jetpack.position.set(0, 0.44, -0.32);
    const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.28), darkSteel);
    jetpack.add(packBox);
    for (const sx of [-0.2, 0.2]) {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.36, 14), goldMat);
      thruster.position.set(sx, -0.18, -0.06);
      const nozzleGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), cyanGlow);
      nozzleGlow.position.set(sx, -0.36, -0.06);
      jetpack.add(thruster, nozzleGlow);
    }
    this.upperBodyGroup.add(jetpack);

    // 3. Punhos Colossais Big-Fig nas duas mãos
    for (const hand of [leftHandGroup, rightHandGroup]) {
      const bigFist = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.32), goldMat);
      bigFist.position.set(0, -0.34, 0.04);
      bigFist.castShadow = true;
      hand.add(bigFist);
    }

    // 4. Braço Esquerdo: Escudo de Choque Sísmico (Terremoto de Escudo [Q])
    const shield = new THREE.Group();
    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.92, 0.62), navyMat);
    shieldPlate.castShadow = true;
    const shieldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.14), goldMat);
    const shieldVisor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.44), cyanGlow);
    shieldVisor.position.set(0, 0.22, 0);
    shield.add(shieldPlate, shieldTrim, shieldVisor);
    shield.position.set(0.18, -0.24, 0.12);
    leftHandGroup.add(shield);
    this.titaShieldGroup = shield;

    // 5. Braço Direito: Metralhadora Rotativa Pesada acoplada + Muzzle Flash
    const cannon = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.56), darkSteel);
    housing.position.set(-0.14, 0, 0.24);
    cannon.add(housing);
    for (const [bx, by] of [[-0.08, 0.05], [-0.2, 0.05], [-0.08, -0.05], [-0.2, -0.05]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.58, 10), goldMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, by, 0.62);
      cannon.add(barrel);
    }

    const flashMat = getLegoMaterial(0x00f0ff, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.92
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.9, 0.9, 2.4);
    this.muzzleFlashMesh.position.set(-0.14, 0, 0.98);
    this.muzzleFlashMesh.visible = false;
    cannon.add(this.muzzleFlashMesh);

    cannon.position.set(0, -0.32, 0.08);
    cannon.rotation.x = Math.PI / 2 - 0.12;
    rightHandGroup.add(cannon);
    this.titaCannonGroup = cannon;
  }

  /**
   * Constrói o Arsenal Triplo 3D do Vingador de Chumbo (#4):
   * 1) Duas Submetralhadoras (Dual SMGs nas duas mãos)
   * 2) Escopeta de Impacto (Pump-Action Shotgun pesada)
   * 3) Bazuca RPG (Lança-Foguetes anticarro/antiprata)
   */
  _attachVingadorArsenal(leftHandGroup, rightHandGroup) {
    const gunMetal = getLegoMaterial(0x1e293b, { roughness: 0.25, metalness: 0.5 });
    const darkBlack = getLegoMaterial(0x090a0d, { roughness: 0.32 });
    const silverMat = getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.18, metalness: 0.7 });
    const redShellMat = getLegoMaterial(LEGO_COLORS.red, { roughness: 0.25 });
    const oliveMat = getLegoMaterial(0x365314, { roughness: 0.32 });
    const warheadMat = getLegoMaterial(0xd97706, { roughness: 0.22, metalness: 0.45 });
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.9
    });

    // 1. DUAS SUBMETRALHADORAS (Dual SMGs)
    const buildSmg = (isLeft) => {
      const smg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42), gunMetal);
      body.position.set(0, 0, 0.18);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.28, 10), silverMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, 0.46);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.09), darkBlack);
      mag.position.set(0, -0.18, 0.16);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.32), silverMat);
      rail.position.set(0, 0.09, 0.18);
      smg.add(body, barrel, mag, rail);

      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), flashMat);
      flash.scale.set(0.8, 0.8, 2.0);
      flash.position.set(0, 0.03, 0.66);
      flash.visible = false;
      smg.add(flash);
      if (isLeft) this.leftMuzzleFlashMesh = flash;
      else this.muzzleFlashMesh = flash;

      smg.position.set(0, -0.34, 0.1);
      smg.rotation.x = Math.PI / 2 - 0.15;
      return smg;
    };

    this.dualSmgLeft = buildSmg(true);
    this.dualSmgRight = buildSmg(false);
    leftHandGroup.add(this.dualSmgLeft);
    rightHandGroup.add(this.dualSmgRight);

    // 2. ESCOPETA DE IMPACTO (Heavy Tactical Shotgun)
    const shotgun = new THREE.Group();
    const sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.56), darkBlack);
    sgReceiver.position.set(0, 0, 0.24);
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.68, 12), silverMat);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, 0.05, 0.64);
    const sgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.58, 10), gunMetal);
    sgTube.rotation.x = Math.PI / 2;
    sgTube.position.set(0, -0.03, 0.58);
    const sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.28), redShellMat);
    sgPump.position.set(0, -0.04, 0.58);
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.28), darkBlack);
    sgStock.position.set(0, -0.03, -0.14);
    shotgun.add(sgReceiver, sgBarrel, sgTube, sgPump, sgStock);
    shotgun.position.set(0, -0.34, 0.12);
    shotgun.rotation.x = Math.PI / 2 - 0.15;
    rightHandGroup.add(shotgun);
    this.shotgunGroup = shotgun;

    // 3. BAZUCA RPG (Destruidora de Objetos Prateados & Blindados)
    const rpg = new THREE.Group();
    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 1.18, 14), oliveMat);
    rpgTube.rotation.x = Math.PI / 2;
    rpgTube.position.set(0, 0.06, 0.34);
    const rpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.09, 0.24, 14), darkBlack);
    rpgBell.rotation.x = Math.PI / 2;
    rpgBell.position.set(0, 0.06, -0.28);
    const warheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 14), warheadMat);
    warheadCone.rotation.x = Math.PI / 2;
    warheadCone.position.set(0, 0.06, 1.06);
    const rpgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.12), darkBlack);
    rpgGrip.position.set(0, -0.1, 0.26);
    rpg.add(rpgTube, rpgBell, warheadCone, rpgGrip);
    rpg.position.set(0, -0.34, 0.12);
    rpg.rotation.x = Math.PI / 2 - 0.15;
    rightHandGroup.add(rpg);
    this.rpgGroup = rpg;

    this.setVingadorWeapon(this.vingadorWeapon || 'dual_smg');
  }

  /**
   * Alterna a arma ativa do Vingador de Chumbo ('dual_smg' | 'shotgun' | 'rpg')
   */
  setVingadorWeapon(weaponKey) {
    this.vingadorWeapon = weaponKey;
    if (this.dualSmgLeft) this.dualSmgLeft.visible = weaponKey === 'dual_smg';
    if (this.dualSmgRight) this.dualSmgRight.visible = weaponKey === 'dual_smg';
    if (this.shotgunGroup) this.shotgunGroup.visible = weaponKey === 'shotgun';
    if (this.rpgGroup) this.rpgGroup.visible = weaponKey === 'rpg';
    return this.vingadorWeapon;
  }

  /**
   * Equipa as Duas Katanas Energizadas Escarlates do Sombra Escarlate (#5) + Bainhas Cruzadas nas Costas
   */
  _attachDualKatanas(leftHandGroup, rightHandGroup) {
    const hiltMat = getLegoMaterial(0x090a0d, { roughness: 0.3 });
    const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.2 });
    const bladeMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 1.95,
      roughness: 0.1,
      clearcoat: 0.8
    });

    const buildKatana = () => {
      const katana = new THREE.Group();
      const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.34, 10), hiltMat);
      tsuka.rotation.x = Math.PI / 2;
      tsuka.position.set(0, 0, -0.04);

      const tsuba = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.035), goldMat);
      tsuba.position.set(0, 0, 0.13);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.085, 0.98), bladeMat);
      blade.position.set(0, 0.01, 0.64);
      blade.castShadow = true;

      katana.add(tsuka, tsuba, blade);
      katana.position.set(0, -0.34, 0.08);
      katana.rotation.x = Math.PI / 2 - 0.18;
      return katana;
    };

    this.leftKatanaGroup = buildKatana();
    this.rightKatanaGroup = buildKatana();
    leftHandGroup.add(this.leftKatanaGroup);
    rightHandGroup.add(this.rightKatanaGroup);

    // Bainhas cruzadas em X nas costas do Sombra Escarlate
    for (const sign of [-1, 1]) {
      const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.08), hiltMat);
      scabbard.position.set(0, 0.42, -0.27);
      scabbard.rotation.z = sign * 0.58;
      this.upperBodyGroup.add(scabbard);
    }
  }

  /**
   * Ativa/desativa o efeito visual furtivo (Invisibilidade da Bomba de Fumaça do Sombra Escarlate)
   */
  setStealthVisual(isStealth) {
    if (this.isStealth === isStealth) return;
    this.isStealth = isStealth;
    this.visualRoot.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child.userData._origMatCloned) {
          child.material = child.material.clone();
          child.userData._origMatCloned = true;
        }
        child.material.transparent = isStealth;
        child.material.opacity = isStealth ? 0.26 : 1.0;
      }
    });
  }

  /**
   * Constrói o Fuzil Tático 3D do Comandante Caveira (BOPE) na mão direita
   */
  _attachTacticalRifle(handGroup) {
    const rifle = new THREE.Group();
    const gunMetal = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.35 });
    const darkBlack = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.35 });
    const goldAccent = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.2 });

    // Corpo receptor do fuzil
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.58), gunMetal);
    receiver.position.set(0, 0, 0.22);
    receiver.castShadow = true;
    rifle.add(receiver);

    // Cano longo com quebra-chamas
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.52, 12), darkBlack);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.62);
    rifle.add(barrel);

    // Guarda-mão tático com trilho
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.34), darkBlack);
    handguard.position.set(0, 0.02, 0.58);
    rifle.add(handguard);

    // Carregador curvo (Magazine)
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.12), darkBlack);
    mag.position.set(0, -0.17, 0.32);
    mag.rotation.x = 0.22;
    rifle.add(mag);

    // Coronha traseira
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.26), darkBlack);
    stock.position.set(0, -0.02, -0.14);
    rifle.add(stock);

    // Mira Holográfica superior + detalhe dourado BOPE
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.18), goldAccent);
    scope.position.set(0, 0.13, 0.24);
    rifle.add(scope);

    // Clarão de disparo (Muzzle Flash) na ponta do cano
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.9
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.8, 0.8, 2.2);
    this.muzzleFlashMesh.position.set(0, 0.03, 0.96);
    this.muzzleFlashMesh.visible = false;
    rifle.add(this.muzzleFlashMesh);

    rifle.position.set(0, -0.34, 0.12);
    rifle.rotation.x = Math.PI / 2 - 0.15;
    handGroup.add(rifle);
    this.rifleGroup = rifle;
  }

  /**
   * Adiciona esferas de energia solar flamejantes nas mãos do Solaris
   */
  _attachSolarOrbs(leftHandGroup, rightHandGroup) {
    const orbMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      transparent: true,
      opacity: 0.88
    });

    for (const hand of [leftHandGroup, rightHandGroup]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), orbMat);
      orb.position.set(0, -0.36, 0.08);
      hand.add(orb);
    }
  }

  /**
   * Cria partículas 3D de fogo LEGO orbitando o Solaris
   */
  _buildSolarAuraParticles() {
    const fireColors = [0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);

    for (let i = 0; i < 10; i++) {
      const mat = getLegoMaterial(fireColors[i % fireColors.length], {
        emissive: fireColors[i % fireColors.length],
        emissiveIntensity: 1.2
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.visualRoot.add(mesh);
      this.flameParticles.push({
        mesh,
        angle: (i / 10) * Math.PI * 2,
        speed: 2.5 + (i % 3) * 0.8,
        radius: 0.52 + (i % 2) * 0.16,
        yOffset: (i / 10) * 1.8
      });
    }
  }

  _createLeg(legMat) {
    const pivot = new THREE.Group();

    const hipRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.35, 18),
      legMat
    );
    hipRoll.rotation.z = Math.PI / 2;
    hipRoll.castShadow = true;
    pivot.add(hipRoll);

    const legShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.54, 0.38),
      legMat
    );
    legShaft.position.set(0, -0.31, 0);
    legShaft.castShadow = true;
    legShaft.receiveShadow = true;
    pivot.add(legShaft);

    const footMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.16, 0.52),
      legMat
    );
    footMesh.position.set(0, -0.64, 0.07);
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;
    pivot.add(footMesh);

    return pivot;
  }

  _createArm(armMat, handMat, sideSign) {
    const shoulderPivot = new THREE.Group();

    const armBody = new THREE.Group();
    armBody.rotation.z = sideSign * 0.13;
    shoulderPivot.add(armBody);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), armMat);
    shoulderCap.castShadow = true;
    armBody.add(shoulderCap);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.12, 0.34, 18),
      armMat
    );
    upperArm.position.set(0, -0.17, 0);
    upperArm.castShadow = true;
    armBody.add(upperArm);

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.32, 0);
    forearmGroup.rotation.x = -0.22;
    armBody.add(forearmGroup);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.11, 0.24, 18),
      armMat
    );
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    forearmGroup.add(forearm);

    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.1, 14),
      handMat
    );
    wrist.position.set(0, -0.25, 0);
    forearmGroup.add(wrist);

    const clawGeo = new THREE.TorusGeometry(0.095, 0.042, 12, 20, Math.PI * 1.48);
    const clawMesh = new THREE.Mesh(clawGeo, handMat);
    clawMesh.position.set(0, -0.34, 0.02);
    clawMesh.rotation.y = Math.PI / 2;
    clawMesh.rotation.z = -Math.PI * 0.65;
    clawMesh.castShadow = true;
    forearmGroup.add(clawMesh);

    return { shoulderPivot, forearmGroup };
  }

  triggerPunch() {
    this.punchDuration = 0.22;
    this.punchTimer = this.punchDuration;
    this.combatStanceTimer = 0.85; // Mantém os punhos na guarda alta após socar
    this.punchComboStep = (this.punchComboStep + 1) % 3;
  }

  triggerShoot() {
    this.shootTimer = 0.16;
    this.muzzleFlashTimer = 0.055;
  }

  triggerTacticalRoll() {
    if (this.rollTimer > 0) return false;
    this.rollTimer = this.rollDuration;
    return true;
  }

  /**
   * Diminui visualmente a Minifigura e a coloca sentada 100% dentro da cabine do carro ao apertar [E],
   * voltando ao tamanho 100% normal ao sair do carro!
   */
  setSeatedInVehicle(isSeated, steerAngle = 0, openTop = false, isMotorcycle = false, wheeliePitch = 0) {
    if (isSeated) {
      this.state = 'DRIVE';
      this.root.scale.setScalar(isMotorcycle ? 0.78 : openTop ? 0.58 : 0.44);
      this.visualRoot.scale.setScalar(1.0);
      this.visualRoot.position.set(0, 0, isMotorcycle ? 0.0 : -0.12);
      this.visualRoot.rotation.set(0, 0, 0);
      if (this.hipGroup) {
        this.hipGroup.position.set(0, isMotorcycle ? 0.42 : 0.36, 0);
      }
      this.upperBodyGroup.position.set(0, isMotorcycle ? 0.52 : 0.44, 0);
      if (isMotorcycle) {
        // Postura esportiva/tática montado na moto: tronco inclinado à frente segurando o guidão e pernas abraçando o tanque
        this.upperBodyGroup.rotation.set(0.28, steerAngle * 0.25, 0);
        this.leftLegPivot.rotation.set(-0.98, 0, 0.24);
        this.rightLegPivot.rotation.set(-0.98, 0, -0.24);
        this.leftArmPivot.rotation.set(-1.32 + steerAngle * 0.35, 0, 0.16);
        this.rightArmPivot.rotation.set(-1.32 - steerAngle * 0.35, 0, -0.16);
        this.headGroup.rotation.set(-0.18 - wheeliePitch * 0.32, steerAngle * 0.35, 0);
      } else {
        this.upperBodyGroup.rotation.set(0.05, steerAngle * 0.25, 0);
        this.leftLegPivot.rotation.set(-1.55, 0, 0);
        this.rightLegPivot.rotation.set(-1.55, 0, 0);
        this.leftArmPivot.rotation.set(-1.35 + steerAngle * 0.4, 0, 0.12);
        this.rightArmPivot.rotation.set(-1.35 - steerAngle * 0.4, 0, -0.12);
        this.headGroup.rotation.set(0, steerAngle * 0.35, 0);
      }
      if (this.rifleGroup) this.rifleGroup.visible = false;
      if (this.capeMesh) this.capeMesh.visible = false;
    } else {
      this.root.scale.setScalar(1.0);
      if (this.isBigFig) {
        this.visualRoot.scale.set(1.68, 1.56, 1.68);
      } else {
        this.visualRoot.scale.setScalar(1.0);
      }
      this.visualRoot.position.set(0, 0, 0);
      this.visualRoot.rotation.set(0, 0, 0);
      if (this.hipGroup) {
        this.hipGroup.position.set(0, 0.72, 0);
      }
      this.upperBodyGroup.position.set(0, 0.86, 0);
      this.upperBodyGroup.rotation.set(0, 0, 0);
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      if (this.rifleGroup) this.rifleGroup.visible = true;
      if (this.capeMesh) this.capeMesh.visible = true;
    }
  }

  /**
   * Atualiza animações do boneco incluindo Rolamento Tático, Hover e Voo Supersônico de Cometa
   */
  updateAnimation(
    dt,
    moveSpeed,
    maxRunSpeed,
    isGrounded,
    verticalVelocity,
    isFlying = false,
    isSupersonic = false,
    flightPitch = 0,
    flightBank = 0
  ) {
    this.animTime += dt;

    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    if (this.muzzleFlashMesh) {
      this.muzzleFlashMesh.visible = this.muzzleFlashTimer > 0;
    }
    if (this.leftMuzzleFlashMesh) {
      this.leftMuzzleFlashMesh.visible = this.muzzleFlashTimer > 0;
    }

    if (isGrounded && !this.wasGrounded) {
      this.landingSquash = 1.0;
    }
    this.wasGrounded = isGrounded;
    this.landingSquash = THREE.MathUtils.lerp(this.landingSquash, 0, Math.min(1, dt * 12));

    // Atualiza partículas de fogo do Solaris
    if (this.flameParticles.length > 0) {
      for (const fp of this.flameParticles) {
        fp.angle += dt * fp.speed * (isSupersonic ? 2.5 : 1.0);
        const yCycle = ((this.animTime * 1.4 + fp.yOffset) % 1.9);
        fp.mesh.position.set(
          Math.cos(fp.angle) * fp.radius,
          0.25 + yCycle,
          Math.sin(fp.angle) * fp.radius
        );
        fp.mesh.rotation.x += dt * 4;
        fp.mesh.rotation.y += dt * 5;
        const s = 1.0 - (yCycle / 1.9) * 0.65;
        fp.mesh.scale.setScalar(isSupersonic ? s * 1.45 : s);
      }
    }

    const lerpSpeed = Math.min(1, dt * 14);

    // 1. Animação de Rolamento Tático 360° (Comandante Caveira) girando no centro de massa (sem entrar no chão!)
    if (this.rollTimer > 0) {
      this.rollTimer = Math.max(0, this.rollTimer - dt);
      this.state = 'ROLL';
      const progress = 1.0 - this.rollTimer / this.rollDuration;
      const theta = progress * Math.PI * 2;

      // Pivô no centro do tronco (pivotY = 0.96) + leve impulso vertical na cambalhota
      // Isso garante que a cabeça e os pés NUNCA atravessem o chão (y >= 0 em todos os ângulos!)
      const pivotY = 0.96;
      const rollCenterY = pivotY + Math.sin(progress * Math.PI) * 0.32;

      this.visualRoot.rotation.x = theta;
      this.visualRoot.position.y = rollCenterY - pivotY * Math.cos(theta);
      this.visualRoot.position.z = -pivotY * Math.sin(theta);

      // Postura encolhida de cambalhota tática (pernas flexionadas para frente, queixo no peito, braços fechados)
      const tuck = Math.sin(progress * Math.PI);
      this.upperBodyGroup.rotation.x = 0.48 * tuck;
      this.upperBodyGroup.rotation.y = 0;
      this.headGroup.rotation.x = 0.35 * tuck;

      this.leftLegPivot.rotation.x = -1.35 * tuck;
      this.rightLegPivot.rotation.x = -1.35 * tuck;
      this.leftArmPivot.rotation.x = -1.45 * tuck;
      this.rightArmPivot.rotation.x = -1.45 * tuck;
      if (this.leftHandGroup && this.rightHandGroup) {
        this.leftHandGroup.rotation.x = -0.95 * tuck;
        this.rightHandGroup.rotation.x = -0.95 * tuck;
      }
      return;
    } else {
      this.visualRoot.position.z = THREE.MathUtils.lerp(this.visualRoot.position.z, 0, lerpSpeed);
      // No Voo de Cometa, inclina o corpo no ângulo exato de subida/mergulho (estilo avião/jato!)
      const targetBodyPitch = isFlying && isSupersonic ? (Math.PI * 0.48 - flightPitch) : 0;
      const targetBodyBank = isFlying ? flightBank : 0;
      this.visualRoot.rotation.x = THREE.MathUtils.lerp(
        this.visualRoot.rotation.x,
        targetBodyPitch,
        lerpSpeed
      );
      this.visualRoot.rotation.z = THREE.MathUtils.lerp(
        this.visualRoot.rotation.z,
        targetBodyBank,
        lerpSpeed
      );
    }

    // 2. Estados de Voo 3D (Solaris: Hover e Voo Supersônico de Cometa)
    if (isFlying) {
      this.state = isSupersonic ? 'COMET' : 'HOVER';
      const hoverBob = Math.sin(this.animTime * 3.8) * 0.14;
      this.visualRoot.position.y = THREE.MathUtils.lerp(
        this.visualRoot.position.y,
        0.18 + hoverBob,
        lerpSpeed
      );

      if (isSupersonic) {
        // Pose de Voo Supersônico de Cometa (corpo inclinado, braços estendidos, cabeça olhando para frente)
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, 0.15, lerpSpeed);
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, lerpSpeed);

        this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0.18, lerpSpeed);
        this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.28, lerpSpeed);

        this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -2.75, lerpSpeed);
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -2.75, lerpSpeed);
        this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.12, lerpSpeed);
        this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.12, lerpSpeed);

        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.75, lerpSpeed);
      } else {
        // Pose de Levitação Heroica (Hover)
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(
          this.upperBodyGroup.rotation.x,
          moveSpeed > 0.5 ? 0.22 : 0.04,
          lerpSpeed
        );
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, lerpSpeed);

        this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, -0.28, lerpSpeed);
        this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.16, lerpSpeed);

        this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.55, lerpSpeed);
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -0.55, lerpSpeed);
        this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.35, lerpSpeed);
        this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.35, lerpSpeed);

        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0, lerpSpeed);
      }
    } else {
      // 3. Estados Terrestres / Pulo / Queda
      if (!isGrounded) {
        this.state = verticalVelocity > 0.5 ? 'JUMP' : 'FALL';
      } else if (moveSpeed > maxRunSpeed * 0.65) {
        this.state = 'RUN';
      } else if (moveSpeed > 0.2) {
        this.state = 'WALK';
      } else {
        this.state = 'IDLE';
      }

      if (this.state === 'IDLE') {
        const breath = Math.sin(this.animTime * 2.6);
        const subtleLook = Math.sin(this.animTime * 1.1);

        this.visualRoot.position.y = THREE.MathUtils.lerp(
          this.visualRoot.position.y,
          -this.landingSquash * 0.08,
          lerpSpeed
        );

        this.upperBodyGroup.position.y = THREE.MathUtils.lerp(
          this.upperBodyGroup.position.y,
          0.86 + breath * 0.015,
          lerpSpeed
        );
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(
          this.upperBodyGroup.rotation.x,
          breath * 0.025 + this.landingSquash * 0.14,
          lerpSpeed
        );
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, lerpSpeed);

        this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0, lerpSpeed);
        this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0, lerpSpeed);

        this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          this.leftArmPivot.rotation.x,
          breath * 0.05,
          lerpSpeed
        );
        // Se for o Comandante Caveira com Fuzil, segura o fuzil em posição tática pronta
        const idleRightArmX = this.currentHeroKey === 'caveira' ? -0.62 : -breath * 0.05;
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          this.rightArmPivot.rotation.x,
          idleRightArmX,
          lerpSpeed
        );
        this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0, lerpSpeed);
        this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0, lerpSpeed);

        this.headGroup.rotation.y = THREE.MathUtils.lerp(
          this.headGroup.rotation.y,
          subtleLook * 0.12,
          lerpSpeed * 0.5
        );
        this.headGroup.rotation.x = THREE.MathUtils.lerp(
          this.headGroup.rotation.x,
          -breath * 0.02,
          lerpSpeed
        );
      } else if (this.state === 'WALK' || this.state === 'RUN') {
        const isRunning = this.state === 'RUN';
        const freq = isRunning ? 15.5 : 10.5;
        this.walkPhase += dt * freq;

        const legAmp = isRunning ? 0.92 : 0.58;
        const armAmp = isRunning ? 0.98 : 0.52;
        const bounceAmp = isRunning ? 0.11 : 0.055;
        const forwardLean = isRunning ? 0.16 : 0.05;

        const s = Math.sin(this.walkPhase);
        const bounce = Math.abs(Math.sin(this.walkPhase)) * bounceAmp;

        this.visualRoot.position.y = THREE.MathUtils.lerp(
          this.visualRoot.position.y,
          bounce - this.landingSquash * 0.06,
          lerpSpeed
        );

        this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
          this.leftLegPivot.rotation.x,
          s * legAmp,
          lerpSpeed
        );
        this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
          this.rightLegPivot.rotation.x,
          -s * legAmp,
          lerpSpeed
        );

        this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          this.leftArmPivot.rotation.x,
          -s * armAmp,
          lerpSpeed
        );
        const rightTargetX =
          this.currentHeroKey === 'caveira' ? -0.75 + s * 0.25 : s * armAmp;
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          this.rightArmPivot.rotation.x,
          rightTargetX,
          lerpSpeed
        );
        this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.04, lerpSpeed);
        this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.04, lerpSpeed);

        this.upperBodyGroup.position.y = THREE.MathUtils.lerp(this.upperBodyGroup.position.y, 0.86, lerpSpeed);
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(
          this.upperBodyGroup.rotation.x,
          forwardLean,
          lerpSpeed
        );
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(
          this.upperBodyGroup.rotation.y,
          -s * (isRunning ? 0.14 : 0.07),
          lerpSpeed
        );

        this.headGroup.rotation.y = THREE.MathUtils.lerp(
          this.headGroup.rotation.y,
          s * 0.06,
          lerpSpeed
        );
        this.headGroup.rotation.x = THREE.MathUtils.lerp(
          this.headGroup.rotation.x,
          -forwardLean * 0.6,
          lerpSpeed
        );
      } else if (this.state === 'JUMP') {
        this.visualRoot.position.y = THREE.MathUtils.lerp(this.visualRoot.position.y, 0, lerpSpeed);
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, -0.08, lerpSpeed);
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0.08, lerpSpeed);

        this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, -0.55, lerpSpeed);
        this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.45, lerpSpeed);

        this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -2.1, lerpSpeed);
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, 0.65, lerpSpeed);
        this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.18, lerpSpeed);
        this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.18, lerpSpeed);

        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.15, lerpSpeed);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, lerpSpeed);
      } else if (this.state === 'FALL') {
        const airFlutter = Math.sin(this.animTime * 18) * 0.08;
        this.visualRoot.position.y = THREE.MathUtils.lerp(this.visualRoot.position.y, 0, lerpSpeed);
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, 0.12, lerpSpeed);

        this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
          this.leftLegPivot.rotation.x,
          0.25 + airFlutter,
          lerpSpeed
        );
        this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
          this.rightLegPivot.rotation.x,
          -0.25 - airFlutter,
          lerpSpeed
        );

        this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -1.25, lerpSpeed);
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -1.25, lerpSpeed);
        this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.45, lerpSpeed);
        this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.45, lerpSpeed);

        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.15, lerpSpeed);
      }
    }

    // Capa esvoaçante do Solaris
    if (this.capeMesh) {
      const targetCapeAngle =
        isSupersonic ? 0.18 :
        isFlying ? 0.42 :
        this.state === 'RUN' ? 0.55 :
        this.state === 'WALK' ? 0.3 :
        !isGrounded ? 0.65 : 0.12;
      this.capeMesh.rotation.x = THREE.MathUtils.lerp(
        this.capeMesh.rotation.x,
        targetCapeAngle + Math.sin(this.animTime * 7) * 0.05,
        lerpSpeed
      );
    }

    // Pose de canalização do Raio Solar Contínuo (Solaris)
    if (this.isBeaming) {
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -1.52, lerpSpeed);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -1.52, lerpSpeed);
      this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.12, lerpSpeed);
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.12, lerpSpeed);
    }

    // Reseta deslocamentos lineares dos ombros/cotovelos antes de aplicar o combo de soco
    const shoulderX = this.isBigFig ? 0.58 : 0.49;
    this.leftArmPivot.position.set(shoulderX, 0.66, 0);
    this.rightArmPivot.position.set(-shoulderX, 0.66, 0);
    this.leftArmPivot.rotation.y = 0;
    this.rightArmPivot.rotation.y = 0;
    this.upperBodyGroup.position.z = 0;
    if (this.leftHandGroup && this.rightHandGroup) {
      this.leftHandGroup.rotation.x = -0.22;
      this.rightHandGroup.rotation.x = -0.22;
    }

    // Pose do Titã Blindado segurando um carro levantado acima da cabeça!
    if (this.isCarryingCar) {
      this.leftArmPivot.rotation.x = -2.85;
      this.rightArmPivot.rotation.x = -2.85;
      this.leftArmPivot.rotation.z = 0.22;
      this.rightArmPivot.rotation.z = -0.22;
    }

    // Pose acrobática do Sombra Escarlate balançando no Gancho Magnético!
    if (this.isGrappling) {
      this.leftArmPivot.rotation.x = -2.55;
      this.rightArmPivot.rotation.x = 0.45;
      this.upperBodyGroup.rotation.x = 0.32;
    }

    // Guarda de Boxe / Combate e Soco Reto Horizontal (Jab -> Direto -> Gancho)
    if (this.combatStanceTimer > 0) {
      this.combatStanceTimer = Math.max(0, this.combatStanceTimer - dt);
      const stanceWeight = Math.min(1, this.combatStanceTimer * 4.5);

      // Posição base de guarda alta (punhos na altura do peito/queixo, cotovelos flexionados)
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -1.35, stanceWeight);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -1.35, stanceWeight);
      this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(this.leftArmPivot.rotation.y, -0.32, stanceWeight);
      this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(this.rightArmPivot.rotation.y, 0.32, stanceWeight);

      if (this.leftHandGroup && this.rightHandGroup) {
        this.leftHandGroup.rotation.x = THREE.MathUtils.lerp(-0.22, -0.85, stanceWeight);
        this.rightHandGroup.rotation.x = THREE.MathUtils.lerp(-0.22, -0.85, stanceWeight);
      }
    }

    if (this.punchTimer > 0) {
      this.punchTimer = Math.max(0, this.punchTimer - dt);
      // Curva explosiva de soco: avança muito rápido (primeiros 30%) e retrai para a guarda
      const t = 1.0 - this.punchTimer / this.punchDuration;
      const thrust = t < 0.32 ? (t / 0.32) : Math.max(0, 1.0 - (t - 0.32) / 0.68);
      const snap = Math.sin(thrust * Math.PI * 0.5);

      this.upperBodyGroup.position.z = 0.14 * snap;
      this.upperBodyGroup.rotation.x = 0.16 * snap;

      if (this.punchComboStep === 1) {
        // Golpe 1: JAB ESQUERDO RETO (na linha do ombro/queixo, esticando o cotovelo para frente)
        this.leftArmPivot.rotation.x = -1.56;
        this.leftArmPivot.rotation.y = -0.22 * snap;
        this.leftArmPivot.position.z = -0.1 * (1 - snap) + 0.34 * snap;
        if (this.leftHandGroup) this.leftHandGroup.rotation.x = -0.85 * (1 - snap);

        // Mão direita permanece fechada na guarda alta protegendo o rosto
        this.rightArmPivot.rotation.x = -1.32;
        this.rightArmPivot.rotation.y = 0.38;
        this.rightArmPivot.position.z = -0.12;
        if (this.rightHandGroup) this.rightHandGroup.rotation.x = -0.95;

        this.upperBodyGroup.rotation.y = -0.48 * snap;
      } else if (this.punchComboStep === 2) {
        // Golpe 2: DIRETO CRUZADO DE DIREITA (rotação forte de ombro e quadril)
        this.rightArmPivot.rotation.x = -1.56;
        this.rightArmPivot.rotation.y = 0.24 * snap;
        this.rightArmPivot.position.z = -0.12 * (1 - snap) + 0.36 * snap;
        if (this.rightHandGroup) this.rightHandGroup.rotation.x = -0.85 * (1 - snap);

        // Mão esquerda recolhida na guarda alta
        this.leftArmPivot.rotation.x = -1.32;
        this.leftArmPivot.rotation.y = -0.38;
        this.leftArmPivot.position.z = -0.12;
        if (this.leftHandGroup) this.leftHandGroup.rotation.x = -0.95;

        this.upperBodyGroup.rotation.y = 0.54 * snap;
      } else {
        // Golpe 3: GANCHO CRUZADO HORIZONTAL (Hook lateral na linha do peito)
        this.leftArmPivot.rotation.x = -1.58;
        this.leftArmPivot.rotation.y = 0.45 - 0.85 * snap;
        this.leftArmPivot.position.z = 0.32 * snap;
        if (this.leftHandGroup) this.leftHandGroup.rotation.x = -0.55;

        this.rightArmPivot.rotation.x = -1.35;
        this.rightArmPivot.rotation.y = 0.35;
        this.upperBodyGroup.rotation.y = -0.62 * snap;
      }
    }

    // Sobreposição de Tiro / Disparo de Armas 3D
    if (this.shootTimer > 0) {
      this.shootTimer = Math.max(0, this.shootTimer - dt);
      const recoil = Math.sin((this.shootTimer / 0.16) * Math.PI);
      this.rightArmPivot.rotation.x = -1.52 + recoil * 0.16;
      this.rightArmPivot.position.z = -recoil * 0.12;
      this.rightArmPivot.rotation.z = -0.04;
      if (this.rightHandGroup) this.rightHandGroup.rotation.x = -0.15;

      if (this.currentHeroKey === 'vingador' && this.vingadorWeapon === 'dual_smg') {
        this.leftArmPivot.rotation.x = -1.52 + recoil * 0.16;
        this.leftArmPivot.position.z = -recoil * 0.12;
        this.leftArmPivot.rotation.z = 0.04;
        if (this.leftHandGroup) this.leftHandGroup.rotation.x = -0.15;
      }
    }
  }
}
