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
    subtitle: 'Fuzil Tático • Carga Explosiva • Rolamento',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.black,
    armColor: LEGO_COLORS.charcoal,
    handColor: 0x111827,
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
    name: 'Solaris (Rei do Sol)',
    subtitle: 'Voo Cometa • Raio Solar • Supernova',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x7f1d1d,
    armColor: LEGO_COLORS.gold,
    handColor: 0xfef08a,
    hipColor: 0xf59e0b,
    legColor: 0x7f1d1d,
    facePreset: 'solaris',
    torsoPreset: 'solaris',
    headgear: 'visor_crown',
    capeColor: null,
    weapon: 'solar_orbs',
    fireAura: true
  },
  tita: {
    key: 'tita',
    name: 'Titã Blindado (PMESP)',
    subtitle: 'Minigun 6 Canos [Mouse 1] • Dash [Mouse 2] • Pisada Sísmica [Q]',
    headColor: 0x334155,
    torsoColor: 0x475569,
    armColor: 0x475569,
    handColor: 0xdc2626,
    hipColor: 0x090a0d,
    legColor: 0x334155,
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
    subtitle: '[R] Trocar Arma: Castigadoras .50 • Doze 18 Bagos • Bazuca Rocket Jump • [Q] Furor',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x0c0e13,
    armColor: 0x10131a,
    handColor: 0x090a0d,
    hipColor: 0xe2e8f0,
    legColor: 0x0c0e13,
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
    subtitle: 'Gancho 360° [Mouse 2] • Katanas Lua de Sangue [Mouse 1] • Rolamento Invisível [Q]',
    headColor: 0x090a0d,
    torsoColor: 0x090a0d,
    armColor: 0x18181b,
    handColor: LEGO_COLORS.red,
    hipColor: 0x991b1b,
    legColor: 0x090a0d,
    facePreset: 'sombra',
    torsoPreset: 'sombra',
    headgear: 'ninja_hood',
    capeColor: null,
    weapon: 'dual_katanas',
    fireAura: false
  },
  turbo: {
    key: 'turbo',
    name: 'Turbo Fantasma',
    subtitle: 'Moto Fantasma Ciano [Mouse 2] • Correntes de Plasma [Mouse 1] • Arrancada Muralha [Q]',
    headColor: 0xe2e8f0,
    torsoColor: 0x090a0d,
    armColor: 0x090a0d,
    handColor: 0x22d3ee,
    hipColor: 0x090a0d,
    legColor: 0x090a0d,
    facePreset: 'turbo',
    torsoPreset: 'turbo',
    headgear: 'ghost_flame_skull',
    capeColor: null,
    weapon: 'turbo_chains',
    fireAura: true
  },
  voltaico: {
    key: 'voltaico',
    name: 'Voltaico (Tempestade)',
    subtitle: 'Chain Lightning [Mouse 1] • Teleporte Elétrico [Mouse 2] • Super Pulso EMP [Q]',
    headColor: 0x0f172a,
    torsoColor: 0x1d4ed8,
    armColor: 0x1e3a8a,
    handColor: 0x38bdf8,
    hipColor: 0x1e3a8a,
    legColor: 0x0f172a,
    facePreset: 'voltaico',
    torsoPreset: 'voltaico',
    headgear: 'tesla_crown',
    capeColor: null,
    weapon: 'voltaico_staff',
    fireAura: false
  },
  vortex: {
    key: 'vortex',
    name: 'Vórtex (Simbionte)',
    subtitle: 'Metamorfose Big-Fig [F] • Tentáculos [Mouse 1] • Laço Abissal [Mouse 2] • Erupção [Q]',
    headColor: 0x050608,
    torsoColor: 0x050608,
    armColor: 0x050608,
    handColor: 0x050608,
    hipColor: 0x050608,
    legColor: 0x050608,
    facePreset: 'vortex',
    torsoPreset: 'vortex',
    headgear: 'symbiote_crest',
    capeColor: null,
    weapon: 'vortex_tentacles',
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
    this.crownFlameMeshes = [];
    this.solarMantleStrips = [];
    this.solarMantleGroup = null;
    this.titaMinigunBarrelGroup = null;
    this.titaDashFlameMeshes = [];
    this.titaSirenLights = [];
    this.stompTimer = 0;
    this.stompDuration = 0.42;
    this.titaJumpChargeRatio = 0;
    this.isDashing = false;
    this.sombraScarfStrips = [];
    this.katanaAuraFlames = [];
    this.vingadorCoatTails = [];
    this.vingadorSkullEyes = [];
    this.vingadorBackShotgun = null;
    this.vingadorBackRpg = null;
    this.vingadorHolsteredPistols = [];
    this.vingadorDualRecoilSide = 1;
    this.vingadorFurorActive = false;
    this.isDiveSliding = false;
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
    this.vingadorFurorActive = false;
    this.isDiveSliding = false;
    this.buildModel(preset);
    return preset;
  }

  buildModel(preset) {
    while (this.visualRoot.children.length > 0) {
      this.visualRoot.remove(this.visualRoot.children[0]);
    }
    this.flameParticles = [];
    this.crownFlameMeshes = [];
    this.solarMantleStrips = [];
    this.solarMantleGroup = null;
    this.titaMinigunBarrelGroup = null;
    this.titaDashFlameMeshes = [];
    this.titaSirenLights = [];
    this.stompTimer = 0;
    this.titaJumpChargeRatio = 0;
    this.isDashing = false;
    this.sombraScarfStrips = [];
    this.katanaAuraFlames = [];
    this.vingadorCoatTails = [];
    this.vingadorSkullEyes = [];
    this.vingadorBackShotgun = null;
    this.vingadorBackRpg = null;
    this.vingadorHolsteredPistols = [];
    this.vingadorFurorActive = false;
    this.isDiveSliding = false;
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
    this.turboFlameMeshes = [];
    this.turboChainGroups = [];
    this.voltaicoArcs = [];
    this.voltaicoCrownSpikes = [];
    this.voltaicoBackArcSegments = [];
    this.voltaicoLeftClawGroup = null;
    this.voltaicoStaffOrb = null;
    this.vortexTentacles = [];
    this.vortexTongueSegments = [];
    this.vortexMonsterSpikes = [];
    this.isVortexMonster = false;

    if (preset.isBigFig) {
      this.visualRoot.scale.set(1.78, 1.62, 1.78);
    } else if (preset.key === 'sombra') {
      this.visualRoot.scale.set(0.92, 1.07, 0.92);
    } else if (preset.key === 'vortex') {
      this.visualRoot.scale.set(1.06, 1.08, 1.06);
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
      this._attachCaveiraBopeRig();
    } else if (preset.weapon === 'solar_orbs') {
      this._attachSolarOrbs(this.leftHandGroup, this.rightHandGroup);
      this._attachSolarisSunKingRig();
    } else if (preset.weapon === 'tita_rig') {
      this._attachTitaBigFigRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'vingador_arsenal') {
      this._attachVingadorArmorAndCoat(preset);
      this._attachVingadorArsenal(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'dual_katanas') {
      this._attachDualKatanas(this.leftHandGroup, this.rightHandGroup);
      this._attachSombraShinobiRig();
    } else if (preset.weapon === 'turbo_chains') {
      this._attachTurboGhostRiderRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'voltaico_staff') {
      this._attachVoltaicoTeslaRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'vortex_tentacles') {
      this._attachVortexSymbioteRig(this.leftHandGroup, this.rightHandGroup);
    }

    if (preset.fireAura) {
      this._buildSolarAuraParticles(preset.key);
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
      const beretMat = getLegoMaterial(0x090a0d, { roughness: 0.34, clearcoat: 0.25 });
      const graphiteMat = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.4 });
      const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.55, roughness: 0.18 });
      const skullWhiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.22 });
      const orangeGlow = getLegoMaterial(0xf97316, { emissive: 0xf97316, emissiveIntensity: 1.8 });

      // Aba inferior tática da Boina Preta Oficial do BOPE
      const beretRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.395, 0.375, 0.11, 28),
        beretMat
      );
      beretRim.position.set(0, 0.61, 0);
      beretGroup.add(beretRim);

      // Fita dourada/preta de comando na base da boina
      const beretTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.398, 0.398, 0.026, 28),
        goldMat
      );
      beretTrim.position.set(0, 0.57, 0);
      beretGroup.add(beretTrim);

      // Topo volumoso inclinado lateralmente da Boina Militar BOPE
      const beretTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.42, 0.14, 28),
        beretMat
      );
      beretTop.position.set(-0.055, 0.69, 0.02);
      beretTop.rotation.z = 0.19;
      beretTop.castShadow = true;
      beretGroup.add(beretTop);

      const beretFlap = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.09, 0.48),
        beretMat
      );
      beretFlap.position.set(-0.24, 0.65, 0.02);
      beretFlap.rotation.z = 0.42;
      beretGroup.add(beretFlap);

      const beretStud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.08, 20),
        beretMat
      );
      beretStud.position.set(-0.05, 0.77, 0.02);
      beretGroup.add(beretStud);

      // Insígnia 3D da Faca na Caveira na frente da Boina (Escudo Dourado + Mini Crânio + Facas Cruzadas)
      const badgeGroup = new THREE.Group();
      badgeGroup.position.set(0.11, 0.66, 0.385);
      const badgeShield = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 18), goldMat);
      badgeShield.rotation.x = Math.PI / 2;
      const miniSkull = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), skullWhiteMat);
      miniSkull.position.set(0, 0.01, 0.018);
      const miniJaw = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.026), skullWhiteMat);
      miniJaw.position.set(0, -0.022, 0.018);
      for (const s of [-1, 1]) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.14, 0.016), goldMat);
        blade.rotation.z = s * 0.65;
        blade.position.set(0, 0, 0.01);
        badgeGroup.add(blade);
      }
      badgeGroup.add(badgeShield, miniSkull, miniJaw);
      beretGroup.add(badgeGroup);

      // Headset Tático Militar 3D (ComTac Ear Defenders) nas laterais da cabeça + Microfone Boom 3D
      for (const side of [-1, 1]) {
        const earCup = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.22), graphiteMat);
        earCup.position.set(side * 0.37, 0.34, 0);
        earCup.castShadow = true;
        const earCushion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.24), beretMat);
        earCushion.position.set(side * 0.33, 0.34, 0);
        const earBracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.05), goldMat);
        earBracket.position.set(side * 0.39, 0.48, 0);
        beretGroup.add(earCup, earCushion, earBracket);
      }

      // Antena curta no abafador esquerdo + Haste de Microfone curvando até a boca
      const comAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8), beretMat);
      comAntenna.position.set(0.4, 0.56, -0.06);
      beretGroup.add(comAntenna);

      const micBoom = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.34), beretMat);
      micBoom.position.set(0.28, 0.21, 0.22);
      micBoom.rotation.y = -0.52;
      const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), orangeGlow);
      micTip.position.set(0.16, 0.21, 0.37);
      beretGroup.add(micBoom, micTip);

      this.headGroup.add(beretGroup);
    } else if (preset.headgear === 'visor_crown') {
      // =========================================================================
      // COROA REAL DE RAIOS SOLARES 3D (SUNBURST CROWN) + CABELO DE FOGO VIVO
      // =========================================================================
      const crownGroup = new THREE.Group();
      const crownMat = getLegoMaterial(LEGO_COLORS.gold, {
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.14,
        clearcoat: 0.65
      });
      const crimsonCrownMat = getLegoMaterial(0x7f1d1d, {
        roughness: 0.22,
        clearcoat: 0.5
      });
      const whiteSolarMat = getLegoMaterial(0xffffff, {
        emissive: 0xfef08a,
        emissiveIntensity: 2.4,
        roughness: 0.08
      });
      const flameGoldMat = getLegoMaterial(0xfef08a, {
        emissive: 0xfacc15,
        emissiveIntensity: 2.1,
        roughness: 0.1
      });
      const flameOrangeMat = getLegoMaterial(0xf97316, {
        emissive: 0xea580c,
        emissiveIntensity: 1.9,
        roughness: 0.12
      });
      const flameRedMat = getLegoMaterial(0xef4444, {
        emissive: 0xdc2626,
        emissiveIntensity: 1.75,
        roughness: 0.14
      });

      // Aro Imperial da Coroa em Ouro Metálico + Friso Carmesim
      const lowerTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.382, 0.376, 0.045, 28),
        crimsonCrownMat
      );
      lowerTrim.position.set(0, 0.56, 0);
      crownGroup.add(lowerTrim);

      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.382, 0.12, 28),
        crownMat
      );
      band.position.set(0, 0.615, 0);
      band.castShadow = true;
      crownGroup.add(band);

      // Brasão Solar Diamante na testa da Coroa + Joia de Plasma Branco-Solar
      const frontCrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.075),
        crownMat
      );
      frontCrest.position.set(0, 0.66, 0.37);
      frontCrest.rotation.z = Math.PI / 4;
      crownGroup.add(frontCrest);

      const frontGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.085, 0),
        whiteSolarMat
      );
      frontGem.position.set(0, 0.66, 0.41);
      crownGroup.add(frontGem);

      // 7 Pontas/Raios Solares 3D ao redor da Coroa (as 3 frontais mais altas com cristais emissivos)
      const spikeCount = 7;
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const isFront = Math.cos(angle) > 0.25;
        const isCenterFront = Math.abs(Math.sin(angle)) < 0.2 && Math.cos(angle) > 0.8;
        const spikeHeight = isCenterFront ? 0.34 : isFront ? 0.26 : 0.19;
        const spikeRadius = isCenterFront ? 0.075 : 0.058;

        const spikePivot = new THREE.Group();
        spikePivot.position.set(
          Math.sin(angle) * 0.365,
          0.66,
          Math.cos(angle) * 0.365
        );
        spikePivot.rotation.y = angle;
        spikePivot.rotation.x = 0.22; // Inclina os raios solares majestosamente para fora

        const spikeMesh = new THREE.Mesh(
          new THREE.ConeGeometry(spikeRadius, spikeHeight, 4),
          crownMat
        );
        spikeMesh.position.y = spikeHeight * 0.5;
        spikeMesh.rotation.y = Math.PI / 4;
        spikeMesh.castShadow = true;
        spikePivot.add(spikeMesh);

        if (isFront) {
          const crystalInlay = new THREE.Mesh(
            new THREE.ConeGeometry(spikeRadius * 0.52, spikeHeight * 0.72, 4),
            whiteSolarMat
          );
          crystalInlay.position.set(0, spikeHeight * 0.46, 0.022);
          crystalInlay.rotation.y = Math.PI / 4;
          spikePivot.add(crystalInlay);
        }

        crownGroup.add(spikePivot);
      }

      // CABELO DE FOGO VIVO 3D (14 Línguas / Prismas de Chamas Animadas brotando de dentro da coroa!)
      const flameMats = [flameRedMat, flameOrangeMat, flameGoldMat, whiteSolarMat];
      for (let i = 0; i < 14; i++) {
        const layer = i < 8 ? 0 : 1; // 8 línguas externas + 6 línguas internas altas no topo
        const angle = (i / (layer === 0 ? 8 : 6)) * Math.PI * 2 + layer * 0.4;
        const radialDist = layer === 0 ? 0.23 : 0.11;
        const baseH = layer === 0 ? 0.28 + (i % 3) * 0.06 : 0.38 + (i % 2) * 0.08;
        const baseR = layer === 0 ? 0.095 : 0.11;
        const mat = flameMats[(i + layer) % flameMats.length];

        const flameMesh = new THREE.Mesh(
          new THREE.ConeGeometry(baseR, baseH, 5),
          mat
        );
        const baseY = 0.62 + baseH * 0.42;
        flameMesh.position.set(
          Math.sin(angle) * radialDist,
          baseY,
          Math.cos(angle) * radialDist
        );
        flameMesh.rotation.x = Math.cos(angle) * (layer === 0 ? 0.26 : 0.12);
        flameMesh.rotation.z = -Math.sin(angle) * (layer === 0 ? 0.26 : 0.12);
        crownGroup.add(flameMesh);

        this.crownFlameMeshes.push({
          mesh: flameMesh,
          baseY,
          baseScaleY: 1.0,
          phase: i * 0.75,
          speed: 7.5 + (i % 4) * 2.2,
          baseRotX: flameMesh.rotation.x,
          baseRotZ: flameMesh.rotation.z
        });
      }

      // Núcleo incandescente central de plasma no topo da cabeça
      const coreFlame = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 14),
        flameGoldMat
      );
      coreFlame.position.set(0, 0.66, 0);
      crownGroup.add(coreFlame);

      this.headGroup.add(crownGroup);
    } else if (preset.headgear === 'mecha_helmet') {
      // =========================================================================
      // CAPACETE BLINDADO DE CIBORGUE MUTANTE DA PMESP (BRANCO, CINZA E VERMELHO)
      // =========================================================================
      const pmWhiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.6 });
      const pmGreyMat = getLegoMaterial(0x334155, { roughness: 0.24, metalness: 0.45 });
      const pmBlackMat = getLegoMaterial(0x090a0d, { roughness: 0.3, metalness: 0.4 });
      const pmRedMat = getLegoMaterial(0xdc2626, { roughness: 0.2, clearcoat: 0.55 });
      const redLaserMat = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });
      const blueSirenMat = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 2.0 });

      // Domo Policial Superior em Branco PMESP + Faixa Vermelha Institucional
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.4, 0.16, 28), pmWhiteMat);
      dome.position.set(0, 0.62, 0);
      dome.castShadow = true;
      this.headGroup.add(dome);

      const redBand = new THREE.Mesh(new THREE.CylinderGeometry(0.402, 0.402, 0.05, 28), pmRedMat);
      redBand.position.set(0, 0.56, 0);
      this.headGroup.add(redBand);

      // Crista Blindada Central Vermelha/Cinza + 2 Giroflex Policiais 3D no Topo do Capacete
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.54), pmRedMat);
      crest.position.set(0, 0.72, 0.02);
      this.headGroup.add(crest);

      for (const side of [-1, 1]) {
        const sirenPod = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.08, 0.18),
          side < 0 ? redLaserMat : blueSirenMat
        );
        sirenPod.position.set(side * 0.19, 0.71, 0.06);
        this.headGroup.add(sirenPod);
        this.titaSirenLights.push({ mesh: sirenPod, isRed: side < 0 });
      }

      // Visor Tático Vermelho-Laser 3D em V agressivo na testa/olhos
      const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.16), pmBlackMat);
      visorFrame.position.set(0, 0.42, 0.32);
      const visorLaser = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.18), redLaserMat);
      visorLaser.position.set(0, 0.42, 0.33);
      this.headGroup.add(visorFrame, visorLaser);

      // Queixeira / Mandíbula Mecânica Pesada 3D (Juggernaut Jaw Guard) na parte inferior do rosto
      const jawGuard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.26), pmGreyMat);
      jawGuard.position.set(0, 0.16, 0.24);
      const jawGrill = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.28), pmBlackMat);
      jawGrill.position.set(0, 0.16, 0.25);
      const jawGlow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.29), redLaserMat);
      jawGlow.position.set(0, 0.16, 0.255);
      this.headGroup.add(jawGuard, jawGrill, jawGlow);

      // Blindagem auricular lateral + Antenas Táticas da PMESP
      for (const side of [-1, 1]) {
        const earPod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.28), pmGreyMat);
        earPod.position.set(side * 0.38, 0.36, 0);
        const earStripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.29), pmRedMat);
        earStripe.position.set(side * 0.38, 0.36, 0);
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 8), pmBlackMat);
        antenna.position.set(side * 0.4, 0.6, -0.06);
        this.headGroup.add(earPod, earStripe, antenna);
      }
    } else if (preset.headgear === 'tactical_bandana') {
      // =========================================================================
      // CABELO MILITAR PENTEADO PARA TRÁS (FRANK CASTLE) + FAIXA TÁTICA PRETA 3D
      // =========================================================================
      const hairMat = getLegoMaterial(0x090a0d, { roughness: 0.34, clearcoat: 0.22 });
      const bandMat = getLegoMaterial(0x111827, { roughness: 0.28, clearcoat: 0.3 });
      const silverTrimMat = getLegoMaterial(0xe2e8f0, { metalness: 0.65, roughness: 0.18 });

      // Topo volumoso do cabelo penteado para trás
      const hairCap = new THREE.Mesh(new THREE.CylinderGeometry(0.372, 0.382, 0.16, 28), hairMat);
      hairCap.position.set(0, 0.62, -0.01);
      hairCap.castShadow = true;
      this.headGroup.add(hairCap);

      // Mechas superiores e frontais 3D em relevo jogadas para trás (Slicked-back military locks)
      for (let i = -2; i <= 2; i++) {
        const strand = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.085, 0.44),
          hairMat
        );
        strand.position.set(i * 0.125, 0.68 - Math.abs(i) * 0.014, -0.01);
        strand.rotation.x = -0.14;
        strand.rotation.z = -i * 0.08;
        strand.castShadow = true;
        this.headGroup.add(strand);
      }

      // Costeletas e nuca 3D do corte militar
      const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.14), hairMat);
      backHair.position.set(0, 0.44, -0.31);
      this.headGroup.add(backHair);

      for (const side of [-1, 1]) {
        const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.16), hairMat);
        sideburn.position.set(side * 0.345, 0.42, 0.04);
        this.headGroup.add(sideburn);
      }

      // Faixa Tática Preta (Headband) amarrada na testa com detalhe metálico frontal
      const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.374, 0.374, 0.088, 28), bandMat);
      headband.position.set(0, 0.535, 0);
      this.headGroup.add(headband);

      const frontStudPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.04), silverTrimMat);
      frontStudPlate.position.set(0, 0.535, 0.365);
      this.headGroup.add(frontStudPlate);

      // Nó traseiro e 2 fitas curtas da bandana atrás da cabeça
      const bandKnot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), bandMat);
      bandKnot.position.set(0, 0.52, -0.37);
      this.headGroup.add(bandKnot);

      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.045), bandMat);
        tail.position.set(side * 0.065, 0.41, -0.4);
        tail.rotation.x = 0.34;
        tail.rotation.z = side * 0.24;
        this.headGroup.add(tail);
      }
    } else if (preset.headgear === 'ninja_hood') {
      // =========================================================================
      // CAPUZ SHINOBI ASSASSINO 3D + MÁSCARA ONI MENPO + CHIFRES ESCARLATES
      // =========================================================================
      const hoodMat = getLegoMaterial(0x090a0d, { roughness: 0.28, clearcoat: 0.35 });
      const darkSteelMat = getLegoMaterial(0x1e293b, { roughness: 0.22, metalness: 0.55 });
      const silverMat = getLegoMaterial(0xe2e8f0, { roughness: 0.2, metalness: 0.65 });
      const redMat = getLegoMaterial(0xdc2626, { roughness: 0.22, clearcoat: 0.5 });
      const crimsonGlowMat = getLegoMaterial(0xff1e42, {
        emissive: 0xef4444,
        emissiveIntensity: 2.1,
        roughness: 0.12
      });

      // Domo do Capuz Shinobi 3D em preto fosco + Abas laterais de assassino
      const hoodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.388, 0.398, 0.18, 28), hoodMat);
      hoodTop.position.set(0, 0.62, 0);
      hoodTop.castShadow = true;
      this.headGroup.add(hoodTop);

      const hoodPeak = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.24), hoodMat);
      hoodPeak.position.set(0, 0.58, 0.24);
      hoodPeak.rotation.x = 0.24;
      this.headGroup.add(hoodPeak);

      for (const side of [-1, 1]) {
        const sideCowl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.36), hoodMat);
        sideCowl.position.set(side * 0.36, 0.36, -0.02);
        this.headGroup.add(sideCowl);
      }

      // Bandana Escarlate 3D na Testa + Placa Metálica Hachigane com Runa Mística
      const headband3D = new THREE.Mesh(new THREE.CylinderGeometry(0.376, 0.376, 0.09, 28), redMat);
      headband3D.position.set(0, 0.53, 0);
      this.headGroup.add(headband3D);

      const hachiganePlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.095, 0.06), darkSteelMat);
      hachiganePlate.position.set(0, 0.53, 0.365);
      const runeCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.07), crimsonGlowMat);
      runeCore.position.set(0, 0.53, 0.37);
      this.headGroup.add(hachiganePlate, runeCore);

      // 2 Chifres Curtos de Demônio Oni em Vermelho-Escarlate Brilhante na testa
      for (const side of [-1, 1]) {
        const oniHorn = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.22, 5), crimsonGlowMat);
        oniHorn.position.set(side * 0.16, 0.66, 0.32);
        oniHorn.rotation.x = 0.42;
        oniHorn.rotation.z = -side * 0.28;
        this.headGroup.add(oniHorn);
      }

      // Meia-Máscara Oni / Menpo 3D cobrindo a mandíbula com 2 Presas Prateadas 3D
      const menpoGuard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.24), hoodMat);
      menpoGuard.position.set(0, 0.19, 0.23);
      const menpoTrim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.25), redMat);
      menpoTrim.position.set(0, 0.29, 0.235);
      this.headGroup.add(menpoGuard, menpoTrim);

      for (const side of [-1, 1]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1, 4), silverMat);
        fang.position.set(side * 0.13, 0.23, 0.36);
        fang.rotation.x = Math.PI;
        this.headGroup.add(fang);
      }

      // 2 Pontas da Bandana voando atrás da nuca
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.045), redMat);
        tail.position.set(side * 0.12, 0.42, -0.4);
        tail.rotation.x = 0.42;
        tail.rotation.z = side * 0.22;
        this.headGroup.add(tail);
      }
    } else if (preset.headgear === 'ghost_flame_skull') {
      // =========================================================================
      // CABEÇA DE CRÂNIO 3D REAL + CABELEIRA DE FOGO FANTASMA EM 3 CAMADAS FLUINDO PARA TRÁS!
      // (Zero aro cinza de panela e zero cones retos de gelo!)
      // =========================================================================
      const skullBoneMat = getLegoMaterial(0xe2e8f0, { roughness: 0.22, metalness: 0.25 });
      const darkVoidMat = getLegoMaterial(0x090a0d, { roughness: 0.35 });
      const deepBlueFlameMat = getLegoMaterial(0x0284c7, {
        emissive: 0x0369a1,
        emissiveIntensity: 2.0,
        roughness: 0.1
      });
      const cyanFlameMat = getLegoMaterial(0x06b6d4, {
        emissive: 0x00f5d4,
        emissiveIntensity: 2.4,
        roughness: 0.08
      });
      const whitePlasmaMat = getLegoMaterial(0xffffff, {
        emissive: 0x67e8f9,
        emissiveIntensity: 3.0,
        roughness: 0.05
      });

      // 1. Relevo 3D do Crânio (Sobrancelhas Ósseas Franzidas, Maçãs do Rosto Angulares e Mandíbula de Caveira 3D)
      for (const side of [-1, 1]) {
        const browBone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.09), skullBoneMat);
        browBone.position.set(side * 0.12, 0.45, 0.33);
        browBone.rotation.z = -side * 0.28;
        browBone.rotation.y = side * 0.24;

        const cheekBone = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 0.12), skullBoneMat);
        cheekBone.position.set(side * 0.21, 0.27, 0.28);
        cheekBone.rotation.y = side * 0.42;
        cheekBone.rotation.z = side * 0.18;

        const eyeFlame = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.18, 5), whitePlasmaMat);
        eyeFlame.position.set(side * 0.14, 0.39, 0.34);
        eyeFlame.rotation.x = -0.55;
        eyeFlame.rotation.z = -side * 0.45;

        this.headGroup.add(browBone, cheekBone, eyeFlame);
      }

      // Mandíbula Inferior 3D de Caveira com Dentes Esculpidos e Fenda de Plasma Ciano
      const skullJawGroup = new THREE.Group();
      const jawBone = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.22), skullBoneMat);
      jawBone.position.set(0, 0.11, 0.26);
      const jawPlasmaCore = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.23), cyanFlameMat);
      jawPlasmaCore.position.set(0, 0.15, 0.265);
      skullJawGroup.add(jawBone, jawPlasmaCore);

      for (let t = -2; t <= 2; t++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.068, 0.04), skullBoneMat);
        tooth.position.set(t * 0.055, 0.15, 0.368);
        skullJawGroup.add(tooth);
      }
      const nasalCavity = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.09, 3), darkVoidMat);
      nasalCavity.position.set(0, 0.27, 0.355);
      skullJawGroup.add(nasalCavity);
      this.headGroup.add(skullJawGroup);

      // 2. Cabeleira de Fogo Fantasma Vivo em 3 Camadas de Cores (20 labaredas orgânicas fluindo para trás e para cima!)
      const flameLayers = [deepBlueFlameMat, cyanFlameMat, whitePlasmaMat];
      for (let i = 0; i < 20; i++) {
        const u = i / 20;
        const ang = u * Math.PI * 2;
        const ringLayer = i % 3; // 0 = externa azul-elétrico, 1 = média ciano neon, 2 = interna branco-plasma
        const r = ringLayer === 0 ? 0.31 : ringLayer === 1 ? 0.23 : 0.14;
        const h = 0.42 + (i % 4) * 0.11 + (ringLayer === 2 ? 0.08 : 0);
        const mat = flameLayers[ringLayer];

        const flameTongue = new THREE.Mesh(new THREE.ConeGeometry(0.105, h, 5), mat);
        // Achata o cone para parecer uma língua/labareda de fogo real e não um cone redondo de gelo!
        flameTongue.scale.set(1.28, 1.0, 0.54);

        const posX = Math.sin(ang) * r;
        const posZ = Math.cos(ang) * r - 0.08;
        const posY = 0.56 + h * 0.34 - (posZ < 0 ? Math.abs(posZ) * 0.22 : 0);
        flameTongue.position.set(posX, posY, posZ);

        // Todas as chamas fluem agressivamente para trás (-X rotation) como fogo soprado pelo vento!
        const baseRotX = -0.52 - (1 - Math.cos(ang)) * 0.22;
        const baseRotZ = -Math.sin(ang) * 0.32;
        flameTongue.rotation.set(baseRotX, Math.sin(ang) * 0.25, baseRotZ);

        this.headGroup.add(flameTongue);
        this.turboFlameMeshes.push({
          mesh: flameTongue,
          phase: i * 0.55,
          speed: 14.0 + (i % 5) * 2.8,
          baseRotX,
          baseRotZ,
          baseScaleX: 1.28,
          baseScaleZ: 0.54
        });
      }
    } else if (preset.headgear === 'tesla_crown') {
      // =========================================================================
      // ELMO DO DEUS DA TEMPESTADE + COROA DE 14 RELÂMPAGOS VIVOS + ASAS EM ZIGUEZAGUE + QUEIXEIRA EM V 3D!
      // =========================================================================
      const cobaltMat = getLegoMaterial(0x1d4ed8, { roughness: 0.18, metalness: 0.55 });
      const silverTitanium = getLegoMaterial(0xe2e8f0, { roughness: 0.15, metalness: 0.82 });
      const goldMat = getLegoMaterial(0xfacc15, { roughness: 0.16, metalness: 0.78 });
      const electricBlueMat = getLegoMaterial(0x0284c7, {
        emissive: 0x0284c7,
        emissiveIntensity: 1.9,
        roughness: 0.1
      });
      const arcGlowMat = getLegoMaterial(0x38bdf8, {
        emissive: 0x38bdf8,
        emissiveIntensity: 2.5,
        roughness: 0.08
      });
      const whiteBoltMat = getLegoMaterial(0xffffff, {
        emissive: 0xe0f2fe,
        emissiveIntensity: 2.8,
        roughness: 0.06
      });

      // 1. Base Superior do Elmo Condutor + Diadema Frontal Angular em Aço Prateado e Ouro Condutor
      const helmDomed = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.388, 0.14, 28), cobaltMat);
      helmDomed.position.set(0, 0.61, 0);
      this.headGroup.add(helmDomed);

      for (const side of [-1, 1]) {
        const browSilver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.075), silverTitanium);
        browSilver.position.set(side * 0.11, 0.54, 0.355);
        browSilver.rotation.z = -side * 0.24;
        browSilver.rotation.y = side * 0.26;
        const browGold = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 0.082), goldMat);
        browGold.position.set(side * 0.11, 0.57, 0.358);
        browGold.rotation.z = -side * 0.24;
        browGold.rotation.y = side * 0.26;
        this.headGroup.add(browSilver, browGold);
      }

      // Crista Central em Formato de Raio Ciano Neon apontando para cima/trás na testa
      const crestGroup = new THREE.Group();
      crestGroup.position.set(0, 0.52, 0.378);
      const crestSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.16, 0.055), arcGlowMat);
      crestSeg1.position.set(0, 0.06, 0);
      crestSeg1.rotation.z = 0.22;
      const crestSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.16, 0.052), whiteBoltMat);
      crestSeg2.position.set(0.02, 0.17, -0.03);
      crestSeg2.rotation.z = -0.26;
      crestSeg2.rotation.x = -0.28;
      const crestTip = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.22, 4), arcGlowMat);
      crestTip.position.set(-0.01, 0.31, -0.09);
      crestTip.rotation.x = -0.45;
      crestGroup.add(crestSeg1, crestSeg2, crestTip);
      this.headGroup.add(crestGroup);

      // 2. Asas Laterais em Formato de Relâmpago (Ziguezague 3D em 3 segmentos — Ouro Metálico + Borda Ciano Emissiva)
      for (const side of [-1, 1]) {
        const wingGroup = new THREE.Group();
        wingGroup.position.set(side * 0.375, 0.48, 0.06);
        wingGroup.rotation.y = -side * 0.22;
        wingGroup.rotation.z = -side * 0.16;

        // Segmento 1 do Ziguezague
        const seg1Gold = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.22), goldMat);
        seg1Gold.position.set(0, 0.03, -0.06);
        seg1Gold.rotation.x = 0.42;
        const seg1Cyan = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.23), arcGlowMat);
        seg1Cyan.position.set(side * 0.008, 0.075, -0.06);
        seg1Cyan.rotation.x = 0.42;

        // Segmento 2 do Ziguezague (Dobra angular do raio)
        const seg2Gold = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, 0.2), silverTitanium);
        seg2Gold.position.set(side * 0.015, 0.08, -0.2);
        seg2Gold.rotation.x = -0.18;
        const seg2Cyan = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.035, 0.21), whiteBoltMat);
        seg2Cyan.position.set(side * 0.02, 0.12, -0.2);
        seg2Cyan.rotation.x = -0.18;

        // Segmento 3 do Ziguezague (Ponta afiada de relâmpago para trás/cima)
        const seg3Blade = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.3, 4), goldMat);
        seg3Blade.scale.set(0.45, 1.0, 1.0);
        seg3Blade.position.set(side * 0.025, 0.19, -0.36);
        seg3Blade.rotation.x = -1.12;
        const seg3Edge = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.32, 4), arcGlowMat);
        seg3Edge.scale.set(0.45, 1.0, 1.0);
        seg3Edge.position.set(side * 0.032, 0.22, -0.37);
        seg3Edge.rotation.x = -1.12;

        wingGroup.add(seg1Gold, seg1Cyan, seg2Gold, seg2Cyan, seg3Blade, seg3Edge);
        this.headGroup.add(wingGroup);
      }

      // 3. Cabeleira / Coroa de 14 Arcos de Relâmpago Cristalizado 3D no Topo (Pulsando em updateAnimation!)
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const radius = 0.22 + (i % 2) * 0.08;
        const h = 0.34 + (i % 3) * 0.11;
        const mat = i % 3 === 0 ? whiteBoltMat : i % 2 === 0 ? arcGlowMat : electricBlueMat;

        const boltGroup = new THREE.Group();
        boltGroup.position.set(Math.sin(ang) * radius, 0.66, Math.cos(ang) * radius - 0.03);
        const baseRotX = -0.34 - Math.cos(ang) * 0.24;
        const baseRotZ = -Math.sin(ang) * 0.28;
        boltGroup.rotation.set(baseRotX, 0, baseRotZ);

        // Raio em 2 facetas em ziguezague (não é cone liso nem lâmpada!)
        const lowerShard = new THREE.Mesh(new THREE.BoxGeometry(0.055, h * 0.55, 0.055), mat);
        lowerShard.position.set(0, h * 0.24, 0);
        lowerShard.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.22;

        const upperTip = new THREE.Mesh(new THREE.ConeGeometry(0.058, h * 0.68, 4), i % 2 === 0 ? whiteBoltMat : arcGlowMat);
        upperTip.position.set((i % 2 === 0 ? 1 : -1) * 0.02, h * 0.68, -0.02);
        upperTip.rotation.z = (i % 2 === 0 ? -1 : 1) * 0.18;
        upperTip.rotation.x = -0.18;

        boltGroup.add(lowerShard, upperTip);
        this.headGroup.add(boltGroup);
        this.voltaicoCrownSpikes.push({
          mesh: boltGroup,
          phase: i * 0.65,
          speed: 18.0 + (i % 4) * 3.5,
          baseRotX,
          baseRotZ
        });
      }

      // 4. Máscara / Queixeira Angular 3D de Titânio Prateado e Azul-Cobalto em formato de V (Estilo Raiden / Cyber-Thor)
      const maskGroup = new THREE.Group();
      for (const side of [-1, 1]) {
        const jawPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.12), cobaltMat);
        jawPlate.position.set(side * 0.13, 0.19, 0.31);
        jawPlate.rotation.y = side * 0.36;
        jawPlate.rotation.z = -side * 0.18;

        const jawTrim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.036, 0.13), silverTitanium);
        jawTrim.position.set(side * 0.13, 0.26, 0.315);
        jawTrim.rotation.y = side * 0.36;
        jawTrim.rotation.z = -side * 0.22;

        const cyanSlit1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.132), arcGlowMat);
        cyanSlit1.position.set(side * 0.13, 0.2, 0.318);
        cyanSlit1.rotation.y = side * 0.36;
        cyanSlit1.rotation.z = -side * 0.22;

        const cyanSlit2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.132), whiteBoltMat);
        cyanSlit2.position.set(side * 0.12, 0.15, 0.318);
        cyanSlit2.rotation.y = side * 0.36;
        cyanSlit2.rotation.z = -side * 0.22;

        maskGroup.add(jawPlate, jawTrim, cyanSlit1, cyanSlit2);
      }
      const chinPoint = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), silverTitanium);
      chinPoint.rotation.x = Math.PI;
      chinPoint.rotation.y = Math.PI / 4;
      chinPoint.position.set(0, 0.14, 0.365);
      maskGroup.add(chinPoint);
      this.headGroup.add(maskGroup);
    } else if (preset.headgear === 'symbiote_crest') {
      // =========================================================================
      // CABEÇA DO VENOM: TENDÕES DE BIOMASSA NEGRA + MANDÍBULA 3D DE PRESAS + LÍNGUA LONGA 3D!
      // =========================================================================
      const symbioteBlack = getLegoMaterial(0x050608, { roughness: 0.08, clearcoat: 1.0 });
      const boneWhite = getLegoMaterial(0xf8fafc, { roughness: 0.16, clearcoat: 0.5 });
      const tongueMat = getLegoMaterial(0xdb2777, {
        emissive: 0x9333ea,
        emissiveIntensity: 1.45,
        roughness: 0.12,
        clearcoat: 0.95
      });

      // 1. Tendões de Biomassa Negra Líquida curvados para trás rente ao crânio (Zero conezinhos rosas!)
      for (let i = -2; i <= 2; i++) {
        const ridge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.048, 0.34, 8),
          symbioteBlack
        );
        ridge.position.set(i * 0.095, 0.58 - Math.abs(i) * 0.03, -0.18 - Math.abs(i) * 0.03);
        ridge.rotation.x = -1.18;
        ridge.rotation.z = -i * 0.16;
        this.headGroup.add(ridge);
      }

      // 2. Mandíbula Inferior Simbionte 3D Aberta + 8 Presas 3D Brancas Pontiagudas (Arcada Superior e Inferior)
      const jawGroup = new THREE.Group();
      const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.26), symbioteBlack);
      lowerJaw.position.set(0, 0.09, 0.25);
      lowerJaw.rotation.x = 0.26;
      jawGroup.add(lowerJaw);

      for (const side of [-1, 1]) {
        const jawCheek = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.19, 0.22), symbioteBlack);
        jawCheek.position.set(side * 0.22, 0.16, 0.22);
        jawCheek.rotation.z = -side * 0.15;
        jawGroup.add(jawCheek);
      }

      // 8 Presas 3D Brancas Afiadas (4 superiores descendo + 4 inferiores subindo)
      const fangXPositions = [-0.16, -0.06, 0.06, 0.16];
      for (let f = 0; f < fangXPositions.length; f++) {
        const fx = fangXPositions[f];
        const isOuter = Math.abs(fx) > 0.1;
        const fangLen = isOuter ? 0.095 : 0.072;

        const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.02, fangLen, 5), boneWhite);
        upperFang.position.set(fx, 0.24, 0.355 - Math.abs(fx) * 0.12);
        upperFang.rotation.x = Math.PI - 0.12;
        jawGroup.add(upperFang);

        const lowerFang = new THREE.Mesh(new THREE.ConeGeometry(0.019, fangLen * 0.92, 5), boneWhite);
        lowerFang.position.set(fx, 0.13, 0.365 - Math.abs(fx) * 0.12);
        lowerFang.rotation.x = 0.18;
        jawGroup.add(lowerFang);
      }
      this.headGroup.add(jawGroup);

      // 3. LÍNGUA LONGA SERPENTEANTE 3D DO VENOM (3 Segmentos Encadeados com Juntas Esféricas!)
      const tongueRoot = new THREE.Group();
      tongueRoot.position.set(0, 0.15, 0.31);
      tongueRoot.rotation.x = Math.PI * 0.48; // Aponta para frente/fora da bocarra
      this.headGroup.add(tongueRoot);

      const tSegConfigs = [
        { len: 0.17, rBot: 0.044, rTop: 0.036, baseX: 0.22, baseZ: 0.12 },
        { len: 0.16, rBot: 0.036, rTop: 0.024, baseX: -0.42, baseZ: 0.22 },
        { len: 0.15, rBot: 0.024, rTop: 0.008, baseX: -0.35, baseZ: -0.18 }
      ];

      let parentTongueNode = tongueRoot;
      for (let t = 0; t < tSegConfigs.length; t++) {
        const cfg = tSegConfigs[t];
        const segPivot = new THREE.Group();
        if (t > 0) {
          segPivot.position.set(0, tSegConfigs[t - 1].len, 0);
        }
        segPivot.rotation.x = cfg.baseX;
        segPivot.rotation.z = cfg.baseZ;

        const jointSphere = new THREE.Mesh(new THREE.SphereGeometry(cfg.rBot * 1.02, 8, 8), tongueMat);
        segPivot.add(jointSphere);

        const cylGeo = new THREE.CylinderGeometry(cfg.rTop, cfg.rBot, cfg.len, 8);
        cylGeo.translate(0, cfg.len * 0.5, 0);
        const cylMesh = new THREE.Mesh(cylGeo, tongueMat);
        segPivot.add(cylMesh);

        if (t === tSegConfigs.length - 1) {
          const tipCone = new THREE.Mesh(new THREE.ConeGeometry(cfg.rTop * 1.2, 0.09, 6), tongueMat);
          tipCone.position.set(0, cfg.len + 0.04, 0);
          segPivot.add(tipCone);
        }

        parentTongueNode.add(segPivot);
        parentTongueNode = segPivot;
        this.vortexTongueSegments.push({
          pivot: segPivot,
          baseX: cfg.baseX,
          baseZ: cfg.baseZ,
          index: t
        });
      }
    }
  }

  /**
   * HERÓI #6: TURBO FANTASMA (OP-06 — CYBER-GHOST RIDER DE PLASMA CIANO):
   * 1) Jaqueta de Couro 3D Aberta com Rebites Cromados + Reator Ciano e 3 Pares de Costelas Metálicas 3D
   * 2) Corrente 3D Real Elo por Elo (14 elos TorusGeometry entrelaçados, ZERO tábuas cinzas no peito!)
   * 3) Ombreiras Duplas com 3 Espinhos Curvos + Chamas Ciano, Joelheiras de Caveira 3D e Botas Biker com Fivelas
   * 4) Costas: Motor V-Twin Fantasma + 4 Escapamentos Cromados com Chamas 100% Alinhadas Dentro da Boca de Cada Cano!
   * 5) Mãos: Espada "Hellfire V8" com Guarda de Motor V-Twin e Chicote de Corrente de 10 Elos com Adaga-Gancho!
   */
  _attachTurboGhostRiderRig(leftHandGroup, rightHandGroup) {
    const leatherBlack = getLegoMaterial(0x090a0d, { roughness: 0.28, clearcoat: 0.45 });
    const darkSteel = getLegoMaterial(0x1e293b, { metalness: 0.72, roughness: 0.24 });
    const chromeSteel = getLegoMaterial(0xe2e8f0, { metalness: 0.86, roughness: 0.14 });
    const skullBoneMat = getLegoMaterial(0xf8fafc, { roughness: 0.2, metalness: 0.25 });
    const deepBlueFlame = getLegoMaterial(0x0284c7, {
      emissive: 0x0369a1,
      emissiveIntensity: 2.0,
      roughness: 0.1
    });
    const cyanGlow = getLegoMaterial(0x06b6d4, {
      emissive: 0x00f5d4,
      emissiveIntensity: 2.4,
      roughness: 0.08
    });
    const whiteHotMat = getLegoMaterial(0xffffff, {
      emissive: 0x67e8f9,
      emissiveIntensity: 3.0,
      roughness: 0.05
    });

    // =========================================================================
    // 1. JAQUETA DE COURO 3D ABERTA + COSTELAS DE PLASMA E REATOR CENTRAL
    // =========================================================================
    const jacketGroup = new THREE.Group();

    // Gola Alta de Couro Levantada (High Biker Collar) com borda cromada e labaredas na nuca
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.36, 0.18, 20, 1, true, Math.PI * 0.22, Math.PI * 1.56),
      leatherBlack
    );
    collar.position.set(0, 0.79, -0.02);
    jacketGroup.add(collar);

    for (let nf = -1; nf <= 1; nf++) {
      const neckFlame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 5), nf === 0 ? whiteHotMat : cyanGlow);
      neckFlame.scale.set(1.2, 1.0, 0.55);
      neckFlame.position.set(nf * 0.12, 0.88, -0.18);
      neckFlame.rotation.set(-0.42, 0, -nf * 0.22);
      jacketGroup.add(neckFlame);
      this.turboFlameMeshes.push({
        mesh: neckFlame,
        phase: nf * 1.1,
        speed: 15.0,
        baseRotX: -0.42,
        baseRotZ: -nf * 0.22,
        baseScaleX: 1.2,
        baseScaleZ: 0.55
      });
    }

    // Lapelas Frontais 3D em V de Couro Preto com Rebites Cônicos Cromados (Chrome Studs) e Zíperes
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.64, 0.075), leatherBlack);
      lapel.position.set(side * 0.25, 0.44, 0.195);
      lapel.rotation.y = side * 0.18;
      lapel.rotation.z = -side * 0.08;

      const zipperLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.62, 0.085), chromeSteel);
      zipperLine.position.set(side * 0.145, 0.44, 0.21);
      zipperLine.rotation.z = -side * 0.12;
      jacketGroup.add(lapel, zipperLine);

      for (const sy of [0.66, 0.52, 0.38]) {
        const stud = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 6), chromeSteel);
        stud.rotation.x = Math.PI / 2;
        stud.position.set(side * 0.24, sy, 0.245);
        jacketGroup.add(stud);
      }
    }

    // Centro do Peito Aberto: Reator Turbo de Fogo Ciano 3D Pulsante + 3 Pares de Costelas Metálicas Cromadas
    const chestRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20), chromeSteel);
    chestRing.position.set(0, 0.48, 0.225);
    const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.036, 16), whiteHotMat);
    chestCore.rotation.x = Math.PI / 2;
    chestCore.position.set(0, 0.48, 0.225);
    jacketGroup.add(chestRing, chestCore);

    for (let r = 0; r < 3; r++) {
      const ribY = 0.61 - r * 0.13;
      const ribW = 0.16 - r * 0.015;
      for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, 0.032, 0.045), chromeSteel);
        rib.position.set(side * (0.09 + r * 0.01), ribY, 0.222);
        rib.rotation.z = -side * 0.18;
        rib.rotation.y = side * 0.22;
        jacketGroup.add(rib);
      }
    }

    // =========================================================================
    // 2. CORRENTE DE MOTOQUEIRO 3D REAL ELO POR ELO (14 Elos TorusGeometry Entrelaçados!)
    // =========================================================================
    for (let i = 0; i < 14; i++) {
      const isFront = i < 7;
      const idx = isFront ? i : i - 7;
      const t = idx / 6;
      const lx = THREE.MathUtils.lerp(0.24, -0.25, t);
      const ly = THREE.MathUtils.lerp(0.73, 0.16, t);
      const lz = isFront ? 0.238 + Math.sin(t * Math.PI) * 0.022 : -0.215 - Math.sin(t * Math.PI) * 0.015;

      const linkMat = i % 3 === 0 ? cyanGlow : i % 2 === 0 ? chromeSteel : darkSteel;
      const chainLink = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 7, 14), linkMat);
      chainLink.position.set(lx, ly, lz);
      chainLink.rotation.z = -0.68;
      if (i % 2 === 1) {
        chainLink.rotation.x = Math.PI * 0.42;
        chainLink.rotation.y = 0.45;
      } else {
        chainLink.rotation.x = 0.12;
      }
      jacketGroup.add(chainLink);
    }

    this.upperBodyGroup.add(jacketGroup);

    // =========================================================================
    // 3. OMBREIRAS DE MOTOQUEIRO FANTASMA COM ESPINHOS CURVOS E CHAMAS CIANO
    // =========================================================================
    const armPivots = [
      { pivot: this.leftArmPivot, side: -1 },
      { pivot: this.rightArmPivot, side: 1 }
    ];
    for (const { pivot, side } of armPivots) {
      if (!pivot) continue;
      const pauldronGroup = new THREE.Group();

      const upperPad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.36), leatherBlack);
      upperPad.position.set(side * 0.06, 0.06, 0);
      upperPad.rotation.z = -side * 0.24;

      const lowerPad = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.33), darkSteel);
      lowerPad.position.set(side * 0.09, -0.03, 0);
      lowerPad.rotation.z = -side * 0.38;

      const chromeRim = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.032, 0.38), chromeSteel);
      chromeRim.position.set(side * 0.065, 0.11, 0);
      chromeRim.rotation.z = -side * 0.24;
      pauldronGroup.add(upperPad, lowerPad, chromeRim);

      // 3 Espinhos Metálicos Longos e Afiados + 2 Labaredas de Fogo Ciano em cada ombro
      for (const sz of [-0.11, 0, 0.11]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.22, 6), chromeSteel);
        spike.position.set(side * 0.13, 0.21, sz);
        spike.rotation.z = -side * 0.48;
        pauldronGroup.add(spike);
      }

      for (const fz of [-0.06, 0.06]) {
        const shFlame = new THREE.Mesh(
          new THREE.ConeGeometry(0.065, 0.26, 5),
          fz < 0 ? cyanGlow : whiteHotMat
        );
        shFlame.scale.set(1.2, 1.0, 0.55);
        shFlame.position.set(side * 0.08, 0.24, fz - 0.04);
        const bRotX = -0.38;
        const bRotZ = -side * 0.35;
        shFlame.rotation.set(bRotX, 0, bRotZ);
        pauldronGroup.add(shFlame);
        this.turboFlameMeshes.push({
          mesh: shFlame,
          phase: side + fz * 5.0,
          speed: 15.5,
          baseRotX: bRotX,
          baseRotZ: bRotZ,
          baseScaleX: 1.2,
          baseScaleZ: 0.55
        });
      }

      pivot.add(pauldronGroup);
    }

    // =========================================================================
    // 4. BRAÇADEIRAS COM CORRENTES + CINTURÃO DE CORRENTE + JOELHEIRAS DE CAVEIRA E BOTAS BIKER
    // =========================================================================
    for (const group of [leftHandGroup, rightHandGroup]) {
      if (!group) continue;
      const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.118, 0.22, 14), leatherBlack);
      bracer.position.set(0, -0.06, 0);
      group.add(bracer);

      for (const cy of [-0.12, -0.05, 0.02]) {
        const wristChain = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.018, 6, 14), chromeSteel);
        wristChain.rotation.x = Math.PI / 2 + 0.15;
        wristChain.position.set(0, cy, 0);
        group.add(wristChain);
      }
    }

    if (this.hipGroup) {
      const beltLeather = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.13, 0.45), leatherBlack);
      beltLeather.position.set(0, 0.08, 0);
      this.hipGroup.add(beltLeather);

      // Elos de Corrente Cromados ao redor da cintura
      for (let bx = -0.32; bx <= 0.32; bx += 0.16) {
        if (Math.abs(bx) < 0.08) continue;
        const beltLink = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 6, 12), chromeSteel);
        beltLink.position.set(bx, 0.08, 0.235);
        this.hipGroup.add(beltLink);
      }

      // Fivela Central de Caveira Cromada com Olhos Ciano
      const skullBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.05), skullBoneMat);
      skullBuckle.position.set(0, 0.08, 0.238);
      const buckleEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.055), cyanGlow);
      buckleEyeL.position.set(-0.032, 0.095, 0.242);
      const buckleEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.055), cyanGlow);
      buckleEyeR.position.set(0.032, 0.095, 0.242);
      this.hipGroup.add(skullBuckle, buckleEyeL, buckleEyeR);
    }

    const legPivots = [
      { pivot: this.leftLegPivot, side: -1 },
      { pivot: this.rightLegPivot, side: 1 }
    ];
    for (const { pivot, side } of legPivots) {
      if (!pivot) continue;
      // Joelheira 3D em formato de Crânio Metálico (Skull Knee Guard) com olhos ciano brilhantes
      const kneeSkull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.08), chromeSteel);
      kneeSkull.position.set(0, -0.34, 0.21);
      const kneeJaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.08), skullBoneMat);
      kneeJaw.position.set(0, -0.41, 0.215);
      const kneeEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.09), cyanGlow);
      kneeEyeL.position.set(-0.045, -0.33, 0.215);
      const kneeEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.09), cyanGlow);
      kneeEyeR.position.set(0.045, -0.33, 0.215);

      // Bota Pesada de Motoqueiro (Biker Combat Boot) com 3 fivelas prateadas laterais e espora de plasma
      const bootShin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.45), leatherBlack);
      bootShin.position.set(0, -0.53, 0.01);
      const bootChromeFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.47), darkSteel);
      bootChromeFront.position.set(0, -0.53, 0.02);

      for (const by of [-0.45, -0.53, -0.61]) {
        const buckleStrap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.028, 0.26), chromeSteel);
        buckleStrap.position.set(side * 0.01, by, 0.04);
        pivot.add(buckleStrap);
      }

      const bootToeCap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.1, 0.16), chromeSteel);
      bootToeCap.position.set(0, -0.66, 0.27);
      const heelSpur = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.16, 4), cyanGlow);
      heelSpur.rotation.x = -Math.PI / 2;
      heelSpur.position.set(0, -0.62, -0.25);

      pivot.add(kneeSkull, kneeJaw, kneeEyeL, kneeEyeR, bootShin, bootChromeFront, bootToeCap, heelSpur);
    }

    // =========================================================================
    // 5. COSTAS: MOTOR V8 FANTASMA 3D + 4 ESCAPAMENTOS COM FOGO 100% ALINHADO NA BOCA DO CANO!
    // =========================================================================
    const backRig = new THREE.Group();
    backRig.position.set(0, 0.44, -0.28);

    // Bloco Central do Motor V-Twin / Turbina Fantasma com Aletas de Refrigeração e Núcleo de Plasma
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.18), leatherBlack);
    const engineChromeFrame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.14), darkSteel);
    backRig.add(engineBlock, engineChromeFrame);

    for (let fin = -2; fin <= 2; fin++) {
      const coolingFin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.024, 0.16), chromeSteel);
      coolingFin.position.set(0, fin * 0.07, -0.01);
      backRig.add(coolingFin);
    }

    const turbineRim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.032, 10, 20), chromeSteel);
    turbineRim.position.set(0, 0.02, -0.1);
    const turbinePlasma = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), whiteHotMat);
    turbinePlasma.rotation.x = Math.PI / 2;
    turbinePlasma.position.set(0, 0.02, -0.1);
    backRig.add(turbineRim, turbinePlasma);

    // 4 Canos de Escapamento Cromados (2 de cada lado) — Chamas como FILHAS diretas de cada pipeGroup!
    const pipeSpecs = [
      { sx: -0.2, sy: 0.12, sz: -0.04, rotZ: 0.62, rotX: -0.32, pipeLen: 0.52 },
      { sx: 0.2, sy: 0.12, sz: -0.04, rotZ: -0.62, rotX: -0.32, pipeLen: 0.52 },
      { sx: -0.22, sy: -0.04, sz: -0.06, rotZ: 0.88, rotX: -0.26, pipeLen: 0.46 },
      { sx: 0.22, sy: -0.04, sz: -0.06, rotZ: -0.88, rotX: -0.26, pipeLen: 0.46 }
    ];

    for (let p = 0; p < pipeSpecs.length; p++) {
      const ps = pipeSpecs[p];
      const pipeGroup = new THREE.Group();
      pipeGroup.position.set(ps.sx, ps.sy, ps.sz);
      pipeGroup.rotation.z = ps.rotZ;
      pipeGroup.rotation.x = ps.rotX;

      const pipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.046, ps.pipeLen, 14), chromeSteel);
      const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.054, ps.pipeLen * 0.6, 12), darkSteel);
      const muzzleRim = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.012, 8, 14), leatherBlack);
      muzzleRim.rotation.x = Math.PI / 2;
      muzzleRim.position.set(0, ps.pipeLen * 0.5, 0);

      // Chama Externa Ciano + Chama Interna Branco-Plasma posicionadas EXATAMENTE na boca do cano (0, pipeLen/2 + h*0.35, 0)
      const flameHeight = 0.34;
      const exhaustFlameGroup = new THREE.Group();
      exhaustFlameGroup.position.set(0, ps.pipeLen * 0.5 + flameHeight * 0.35, 0);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.068, flameHeight, 7), cyanGlow);
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.042, flameHeight * 0.78, 6), whiteHotMat);
      innerFlame.position.set(0, -0.02, 0);
      exhaustFlameGroup.add(outerFlame, innerFlame);

      pipeGroup.add(pipeMesh, heatShield, muzzleRim, exhaustFlameGroup);
      backRig.add(pipeGroup);

      this.turboFlameMeshes.push({
        mesh: exhaustFlameGroup,
        phase: p * 0.9,
        speed: 22.0,
        baseRotX: 0,
        baseRotZ: 0,
        isExhaust: true
      });
    }

    this.upperBodyGroup.add(backRig);

    // =========================================================================
    // 6. MÃO ESQUERDA: CHICOTE DE CORRENTE DE FOGO FANTASMA (10 ELOS + ADAGA-GANCHO SERRILHADA)
    // =========================================================================
    const chainGroup = new THREE.Group();
    chainGroup.position.set(0.04, -0.28, 0.12);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.26, 12), leatherBlack);
    handle.rotation.x = Math.PI / 2;
    const handlePommel = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12), chromeSteel);
    handlePommel.position.set(0, 0, -0.13);
    chainGroup.add(handle, handlePommel);

    // 10 Elos Metálicos finos e detalhados em curva natural com brilho Ciano Neon
    for (let l = 0; l < 10; l++) {
      const u = l / 9;
      const linkMat = l % 3 === 0 ? whiteHotMat : l % 2 === 0 ? cyanGlow : chromeSteel;
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.013, 7, 14), linkMat);
      const curveY = -Math.sin(u * Math.PI * 0.75) * 0.22;
      const curveX = Math.sin(u * Math.PI) * 0.05;
      link.position.set(curveX, curveY, 0.15 + l * 0.088);
      if (l % 2 === 0) {
        link.rotation.y = Math.PI / 2;
      } else {
        link.rotation.x = 0.35;
      }
      chainGroup.add(link);
    }

    // Adaga-Gancho Serrilhada de Aço Negro e Plasma Ciano na ponta da corrente
    const daggerGroup = new THREE.Group();
    daggerGroup.position.set(0, -0.16, 1.04);
    daggerGroup.rotation.x = 0.38;

    const daggerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.035, 0.1, 10), chromeSteel);
    daggerCollar.rotation.x = Math.PI / 2;
    const daggerSpine = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.08, 0.28), leatherBlack);
    daggerSpine.position.set(0, 0.01, 0.14);
    const daggerBlade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 4), cyanGlow);
    daggerBlade.scale.set(0.38, 1.0, 1.0);
    daggerBlade.rotation.x = Math.PI / 2;
    daggerBlade.rotation.z = Math.PI / 4;
    daggerBlade.position.set(0, 0, 0.22);

    const hookBarb = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), whiteHotMat);
    hookBarb.position.set(0, -0.09, 0.18);
    hookBarb.rotation.x = -2.35;

    daggerGroup.add(daggerCollar, daggerSpine, daggerBlade, hookBarb);
    chainGroup.add(daggerGroup);

    leftHandGroup.add(chainGroup);
    this.turboChainGroups.push(chainGroup);

    // =========================================================================
    // 7. MÃO DIREITA: ESPADA "HELLFIRE V8" DE PLASMA CIANO (BLOCO V-TWIN NA GUARDA + LABAREDAS)
    // =========================================================================
    const swordGroup = new THREE.Group();

    // Punho envolto em couro preto com elos cromados e pomo de crânio ciano
    const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.44, 12), leatherBlack);
    swordGrip.rotation.x = Math.PI / 2;
    swordGrip.position.set(0, 0, -0.06);
    swordGroup.add(swordGrip);

    for (const gz of [-0.22, -0.12, -0.02, 0.08]) {
      const gripRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14), chromeSteel);
      gripRing.position.set(0, 0, gz);
      swordGroup.add(gripRing);
    }

    const pommelSkull = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.1), skullBoneMat);
    pommelSkull.position.set(0, 0, -0.31);
    const pommelEyes = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.032, 0.045), cyanGlow);
    pommelEyes.position.set(0, 0.015, -0.32);
    swordGroup.add(pommelSkull, pommelEyes);

    // Guarda da Espada (Crossguard): Bloco de Motor V-Twin Cromado e Preto Fosco (Zero tijolo cinza liso!)
    const vTwinCenter = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.16), leatherBlack);
    vTwinCenter.position.set(0, 0, 0.18);
    const guardReactorRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.016, 8, 16), chromeSteel);
    guardReactorRing.rotation.y = Math.PI / 2;
    guardReactorRing.position.set(0, 0, 0.18);
    const guardReactor = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 12), whiteHotMat);
    guardReactor.position.set(0, 0, 0.18);
    swordGroup.add(vTwinCenter, guardReactorRing, guardReactor);

    // 2 Cilindros V-Twin + 2 Ponteiras de Escapamento Laterais com Chamas Alinhadas na Boca
    for (const side of [-1, 1]) {
      const cylinderHead = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.16, 10), darkSteel);
      cylinderHead.position.set(0, side * 0.11, 0.16);
      cylinderHead.rotation.x = side * 0.45;
      const finCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.035, 10), chromeSteel);
      finCap.position.set(0, side * 0.16, 0.19);
      finCap.rotation.x = side * 0.45;

      const sidePipeGroup = new THREE.Group();
      sidePipeGroup.position.set(0, side * 0.14, 0.22);
      sidePipeGroup.rotation.z = side > 0 ? -0.35 : Math.PI + 0.35;
      sidePipeGroup.rotation.x = -0.38;

      const sidePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.18, 10), chromeSteel);
      const sideFlame = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.22, 6), cyanGlow);
      sideFlame.position.set(0, 0.09 + 0.08, 0);
      const sideInner = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.16, 5), whiteHotMat);
      sideInner.position.set(0, 0.09 + 0.06, 0);
      sidePipeGroup.add(sidePipe, sideFlame, sideInner);

      swordGroup.add(cylinderHead, finCap, sidePipeGroup);
    }

    // Lâmina Larga de Aço Obsidiana Negro (#090a0d) + Fio Duplo Chanfrado de Fogo Ciano e Núcleo Branco-Elétrico
    const bladeObsidianCore = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 1.48), leatherBlack);
    bladeObsidianCore.position.set(0, 0, 0.98);
    const bladeChromeFuller = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.038, 1.36), chromeSteel);
    bladeChromeFuller.position.set(0, 0, 0.94);

    // Fio superior e inferior de Plasma Ciano + Branco-Quente
    const edgeTopCyan = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.065, 1.54), cyanGlow);
    edgeTopCyan.position.set(0, 0.085, 1.01);
    const edgeTopWhite = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 1.52), whiteHotMat);
    edgeTopWhite.position.set(0, 0.065, 1.0);

    const edgeBotCyan = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 1.48), deepBlueFlame);
    edgeBotCyan.position.set(0, -0.075, 0.98);

    const swordTip = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.38, 4), whiteHotMat);
    swordTip.rotation.x = Math.PI / 2;
    swordTip.rotation.z = Math.PI / 4;
    swordTip.scale.set(0.32, 1.0, 1.0);
    swordTip.position.set(0, 0.01, 1.92);

    swordGroup.add(bladeObsidianCore, bladeChromeFuller, edgeTopCyan, edgeTopWhite, edgeBotCyan, swordTip);

    // 8 Labaredas Orgânicas de Fogo Fantasma lambendo o fio da lâmina para trás
    for (let t = 0; t < 8; t++) {
      const mat = t % 3 === 0 ? whiteHotMat : t % 2 === 0 ? cyanGlow : deepBlueFlame;
      const bladeFlame = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.22, 5), mat);
      bladeFlame.scale.set(0.55, 1.0, 1.25);
      bladeFlame.position.set(0, 0.135, 0.38 + t * 0.18);
      bladeFlame.rotation.x = -0.68;
      swordGroup.add(bladeFlame);
    }

    swordGroup.position.set(0, -0.34, 0.1);
    swordGroup.rotation.x = Math.PI / 2 - 0.14;
    rightHandGroup.add(swordGroup);
    this.turboSwordGroup = swordGroup;
  }

  /**
   * HERÓI #7: VOLTAICO (OP-07 — DEUS DO TROVÃO CYBER-ELÉTRICO / SENHOR DA TEMPESTADE):
   * 1) Peitoral Blindado de Alta Tensão 3D + Reator de Tempestade com 4 Arcos em X + Gola Blindada
   * 2) Ombreiras Duplas de Bobina de Trovão 3D com 2 Pinos Condutores + Aletas de Relâmpago Ciano
   * 3) Manoplas Eletromagnéticas 3D + Cinturão do Trovão com Tassets + Joelheiras de Raio e Grevas/Botas com Propulsores
   * 4) Costas: Gerador Dorsal recuado (z = -0.34) + 5 Segmentos em Ziguezague Real entre os Terminais (Zero tracinho na nuca!)
   * 5) Mãos: Alabarda / Tridente de Guerra "Tempestade Imperial" (1.65m) na Direita + Garra de Arco Voltaico Giratório na Esquerda!
   */
  _attachVoltaicoTeslaRig(leftHandGroup, rightHandGroup) {
    const cobaltArmor = getLegoMaterial(0x1d4ed8, { roughness: 0.18, metalness: 0.55 });
    const darkTitanium = getLegoMaterial(0x0f172a, { roughness: 0.22, metalness: 0.65 });
    const silverTitanium = getLegoMaterial(0xe2e8f0, { roughness: 0.14, metalness: 0.85 });
    const goldConductor = getLegoMaterial(0xfacc15, { roughness: 0.16, metalness: 0.78 });
    const electricCyan = getLegoMaterial(0x38bdf8, {
      emissive: 0x38bdf8,
      emissiveIntensity: 2.5,
      roughness: 0.08
    });
    const whiteSpark = getLegoMaterial(0xffffff, {
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.8,
      roughness: 0.05
    });

    // =========================================================================
    // 1. PEITORAL BLINDADO DE ALTA TENSÃO 3D (3D STORMLORD CUIRASS) + GOLA BLINDADA
    // =========================================================================
    const cuirassGroup = new THREE.Group();

    // Placas Peitorais Angulares Esquerda/Direita em Azul-Cobalto, Titânio Prateado e Frisos Dourados
    for (const side of [-1, 1]) {
      const pecPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.095), cobaltArmor);
      pecPlate.position.set(side * 0.19, 0.56, 0.2);
      pecPlate.rotation.y = side * 0.14;
      pecPlate.rotation.z = -side * 0.08;

      const pecSilverTrim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.105), silverTitanium);
      pecSilverTrim.position.set(side * 0.19, 0.68, 0.205);
      pecSilverTrim.rotation.y = side * 0.14;
      pecSilverTrim.rotation.z = -side * 0.14;

      const absPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.08), darkTitanium);
      absPlate.position.set(side * 0.16, 0.27, 0.195);
      absPlate.rotation.y = side * 0.1;

      const goldRib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.092), goldConductor);
      goldRib.position.set(side * 0.17, 0.34, 0.205);
      goldRib.rotation.z = side * 0.18;

      cuirassGroup.add(pecPlate, pecSilverTrim, absPlate, goldRib);
    }

    // Reator de Tempestade / Bobina de Plasma 3D em Alto-Relevo no Centro do Peito
    const chestRingGold = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.028, 10, 24), goldConductor);
    chestRingGold.position.set(0, 0.49, 0.245);
    const chestRingSilver = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 20), silverTitanium);
    chestRingSilver.rotation.x = Math.PI / 2;
    chestRingSilver.position.set(0, 0.49, 0.23);
    const chestPlasmaCore = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.038, 18), whiteSpark);
    chestPlasmaCore.rotation.x = Math.PI / 2;
    chestPlasmaCore.position.set(0, 0.49, 0.25);
    this.voltaicoArcs.push(chestPlasmaCore);
    cuirassGroup.add(chestRingGold, chestRingSilver, chestPlasmaCore);

    // 4 Arcos de Raio 3D irradiando em X pelo Peito a partir do Reator Central
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const xArc1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.032), electricCyan);
        xArc1.position.set(sx * 0.14, 0.49 + sy * 0.1, 0.248);
        xArc1.rotation.z = sx * sy * 0.62;
        const xArc2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.032), goldConductor);
        xArc2.position.set(sx * 0.24, 0.49 + sy * 0.16, 0.242);
        xArc2.rotation.z = sx * sy * 0.32;
        cuirassGroup.add(xArc1, xArc2);
      }
    }

    // Gola Blindada de Alta Tensão (Storm Collar) ao redor do pescoço com condutores dourados
    const backCollar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), cobaltArmor);
    backCollar.position.set(0, 0.81, -0.17);
    cuirassGroup.add(backCollar);
    for (const side of [-1, 1]) {
      const sideCollar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.34), silverTitanium);
      sideCollar.position.set(side * 0.25, 0.8, -0.01);
      sideCollar.rotation.z = -side * 0.22;
      const collarNode = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), goldConductor);
      collarNode.position.set(side * 0.27, 0.86, 0.06);
      cuirassGroup.add(sideCollar, collarNode);
    }

    this.upperBodyGroup.add(cuirassGroup);

    // =========================================================================
    // 2. OMBREIRAS DE BOBINA DE TROVÃO 3D (3D THUNDER-COIL PAULDRONS)
    // =========================================================================
    const armPivots = [
      { pivot: this.leftArmPivot, side: -1 },
      { pivot: this.rightArmPivot, side: 1 }
    ];
    for (const { pivot, side } of armPivots) {
      if (!pivot) continue;
      const pauldronGroup = new THREE.Group();
      pauldronGroup.position.set(side * 0.06, 0.04, 0);

      // Duas placas sobrepostas esculpidas em Azul-Cobalto, Prata e Ouro
      const upperShield = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.36), cobaltArmor);
      upperShield.position.set(side * 0.05, 0.04, 0);
      upperShield.rotation.z = -side * 0.28;

      const lowerShield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.33), silverTitanium);
      lowerShield.position.set(side * 0.08, -0.06, 0);
      lowerShield.rotation.z = -side * 0.42;

      const goldRim = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.038, 0.38), goldConductor);
      goldRim.position.set(side * 0.055, 0.09, 0);
      goldRim.rotation.z = -side * 0.28;
      pauldronGroup.add(upperShield, lowerShield, goldRim);

      // 2 Pinos Condutores de Bobina + Aletas de Relâmpago Ciano Neon apontando para fora/cima
      for (const zOff of [-0.08, 0.08]) {
        const coilPin = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.16, 12), goldConductor);
        coilPin.position.set(side * 0.12, 0.16, zOff);
        coilPin.rotation.z = -side * 0.48;

        const pinTip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), whiteSpark);
        pinTip.position.set(side * 0.16, 0.22, zOff);

        const cyanFin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), electricCyan);
        cyanFin.scale.set(1.0, 1.0, 0.45);
        cyanFin.position.set(side * 0.18, 0.14, zOff * 1.15);
        cyanFin.rotation.z = -side * 0.85;

        pauldronGroup.add(coilPin, pinTip, cyanFin);
      }

      pivot.add(pauldronGroup);
    }

    // =========================================================================
    // 3. MANOPLAS ELETROMAGNÉTICAS 3D (STORM GAUNTLETS) NOS DOIS ANTEBRAÇOS
    // =========================================================================
    const handGroups = [
      { group: leftHandGroup, side: -1 },
      { group: rightHandGroup, side: 1 }
    ];
    for (const { group, side } of handGroups) {
      if (!group) continue;
      const gauntletCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.24, 14), cobaltArmor);
      gauntletCuff.position.set(0, -0.06, 0);

      const gauntletGoldBand = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.02, 8, 16), goldConductor);
      gauntletGoldBand.rotation.x = Math.PI / 2;
      gauntletGoldBand.position.set(0, 0.02, 0);

      // Lâmina lateral em formato de raio ciano no antebraço
      const wristBolt1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.075), electricCyan);
      wristBolt1.position.set(side * 0.135, -0.02, 0.02);
      wristBolt1.rotation.x = -0.35;
      const wristBolt2 = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.18, 4), whiteSpark);
      wristBolt2.position.set(side * 0.145, 0.09, -0.03);
      wristBolt2.rotation.x = -0.45;

      group.add(gauntletCuff, gauntletGoldBand, wristBolt1, wristBolt2);
    }

    // =========================================================================
    // 4. CINTURÃO DO TROVÃO + TASSETS + JOELHEIRAS DE RAIO E GREVAS/BOTAS BLINDADAS 3D
    // =========================================================================
    if (this.hipGroup) {
      const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.13, 0.46), goldConductor);
      beltBand.position.set(0, 0.08, 0);
      this.hipGroup.add(beltBand);

      // Fivela Central em formato de Relâmpago Ciano/Branco
      const buckleBack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 6), silverTitanium);
      buckleBack.rotation.x = Math.PI / 2;
      buckleBack.position.set(0, 0.08, 0.235);
      const buckleBolt = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.04), whiteSpark);
      buckleBolt.position.set(0, 0.08, 0.255);
      buckleBolt.rotation.z = -0.32;
      this.hipGroup.add(buckleBack, buckleBolt);

      // 2 Placas Laterais de Armadura (Tassets) nas coxas
      for (const side of [-1, 1]) {
        const tassetPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.38), cobaltArmor);
        tassetPlate.position.set(side * 0.42, -0.06, 0);
        tassetPlate.rotation.z = -side * 0.18;
        const tassetTrim = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.4), goldConductor);
        tassetTrim.position.set(side * 0.43, -0.17, 0);
        tassetTrim.rotation.z = -side * 0.18;
        this.hipGroup.add(tassetPlate, tassetTrim);
      }
    }

    const legPivots = [
      { pivot: this.leftLegPivot, side: -1 },
      { pivot: this.rightLegPivot, side: 1 }
    ];
    for (const { pivot, side } of legPivots) {
      if (!pivot) continue;
      // Placa de coxa prateada/azul
      const thighGuard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.45), cobaltArmor);
      thighGuard.position.set(0, -0.18, 0.01);

      // Joelheira Angular Dourada/Ciano em formato de Raio
      const kneeDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), goldConductor);
      kneeDiamond.scale.set(1.0, 1.35, 0.65);
      kneeDiamond.position.set(0, -0.36, 0.22);
      const kneeCyanSpike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), electricCyan);
      kneeCyanSpike.position.set(0, -0.31, 0.25);
      kneeCyanSpike.rotation.x = 0.25;

      // Greva / Caneleira Blindada em Azul-Cobalto e Prata + Propulsores Elétricos Brilhantes
      const shinGreave = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.46), silverTitanium);
      shinGreave.position.set(0, -0.52, 0.01);
      const shinCobalt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.48), cobaltArmor);
      shinCobalt.position.set(0, -0.52, 0.02);

      const shinThruster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.5), electricCyan);
      shinThruster.position.set(side * 0.16, -0.52, 0.01);

      // Bota Blindada Pesada com Biqueira Prateada/Dourada
      const bootPlate = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.12, 0.54), cobaltArmor);
      bootPlate.position.set(0, -0.66, 0.05);
      const bootGoldToe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.14), goldConductor);
      bootGoldToe.position.set(0, -0.67, 0.28);

      pivot.add(thighGuard, kneeDiamond, kneeCyanSpike, shinGreave, shinCobalt, shinThruster, bootPlate, bootGoldToe);
    }

    // =========================================================================
    // 5. COSTAS: GERADOR DORSAL (z = -0.34) + ARCO VOLTAICO EM ZIGUEZAGUE REAL (5 SEGMENTOS)
    // =========================================================================
    const teslaPack = new THREE.Group();
    teslaPack.position.set(0, 0.46, -0.34);

    const baseBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.2), darkTitanium);
    const packArmor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.23), cobaltArmor);
    const packReactorRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 8, 18), goldConductor);
    packReactorRing.position.set(0, 0.02, -0.12);
    const packReactorCore = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), electricCyan);
    packReactorCore.position.set(0, 0.02, -0.12);
    this.voltaicoArcs.push(packReactorCore);
    teslaPack.add(baseBox, packArmor, packReactorRing, packReactorCore);

    // 2 Bobinas Tesla Dorsais Inclinadas para Fora
    const coilTilt = 0.44;
    for (const sx of [-0.26, 0.26]) {
      const coilGroup = new THREE.Group();
      coilGroup.position.set(sx, 0.26, -0.04);
      coilGroup.rotation.z = -Math.sign(sx) * coilTilt;

      const coreRod = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.082, 0.58, 14), silverTitanium);
      coilGroup.add(coreRod);

      for (let r = 0; r < 4; r++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.115 - r * 0.01, 0.022, 8, 18),
          r % 2 === 0 ? goldConductor : electricCyan
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -0.14 + r * 0.11, 0);
        coilGroup.add(ring);
      }

      const terminalSphere = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), whiteSpark);
      terminalSphere.position.set(0, 0.32, 0);
      coilGroup.add(terminalSphere);
      this.voltaicoArcs.push(terminalSphere);

      teslaPack.add(coilGroup);
    }

    // Cálculo exato dos 2 Terminais Superiores no espaço do teslaPack:
    // Left: (-0.396, 0.550, -0.04), Right: (+0.396, 0.550, -0.04)
    const termX = 0.26 + 0.32 * Math.sin(coilTilt);
    const termY = 0.26 + 0.32 * Math.cos(coilTilt);
    const termZ = -0.04;

    // 5 Segmentos 3D em Ziguezague de Relâmpago conectando os dois terminais por trás das costas (ZERO barra na nuca!)
    const numSegs = 5;
    for (let s = 0; s < numSegs; s++) {
      const segMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6),
        s % 2 === 0 ? whiteSpark : electricCyan
      );
      teslaPack.add(segMesh);
      this.voltaicoBackArcSegments.push({
        mesh: segMesh,
        index: s,
        total: numSegs,
        termX,
        termY,
        termZ
      });
    }

    this.upperBodyGroup.add(teslaPack);

    // =========================================================================
    // 6. MÃO ESQUERDA: MANOPLA DE ARCO VOLTAICO GIRATÓRIO + 3 GARRAS DE RELÂMPAGO
    // =========================================================================
    const leftClawGroup = new THREE.Group();
    leftClawGroup.position.set(0, -0.32, 0.14);

    const conductorRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 20), goldConductor);
    leftClawGroup.add(conductorRing);

    const centerSpark = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), whiteSpark);
    leftClawGroup.add(centerSpark);

    for (let c = 0; c < 3; c++) {
      const ang = (c / 3) * Math.PI * 2;
      const arcClaw = new THREE.Group();
      arcClaw.rotation.z = ang;

      const emitterNode = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), silverTitanium);
      emitterNode.position.set(0, 0.16, 0);

      const boltSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.18), electricCyan);
      boltSeg1.position.set(0, 0.17, 0.09);
      boltSeg1.rotation.x = 0.28;

      const boltTip = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.22, 4), whiteSpark);
      boltTip.rotation.x = Math.PI / 2 + 0.35;
      boltTip.position.set(0, 0.12, 0.24);

      arcClaw.add(emitterNode, boltSeg1, boltTip);
      leftClawGroup.add(arcClaw);
    }

    leftHandGroup.add(leftClawGroup);
    this.voltaicoLeftClawGroup = leftClawGroup;

    // =========================================================================
    // 7. MÃO DIREITA: ALABARDA / TRIDENTE DE GUERRA "TEMPESTADE IMPERIAL" (1.65m)
    // =========================================================================
    const staffGroup = new THREE.Group();
    staffGroup.position.set(0, -0.26, 0.14);

    // Haste Longa Blindada em Titânio Escuro e Azul-Cobalto + Pomo de Cristal Ciano na base
    const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 1.34, 12), darkTitanium);
    mainShaft.rotation.x = Math.PI / 2;
    mainShaft.position.set(0, 0, 0.38);
    staffGroup.add(mainShaft);

    const shaftArmorSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.52, 12), cobaltArmor);
    shaftArmorSleeve.rotation.x = Math.PI / 2;
    shaftArmorSleeve.position.set(0, 0, 0.62);
    staffGroup.add(shaftArmorSleeve);

    const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 8, 14), goldConductor);
    pommelRing.position.set(0, 0, -0.28);
    const pommelSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), electricCyan);
    pommelSpike.rotation.x = -Math.PI / 2;
    pommelSpike.position.set(0, 0, -0.37);
    staffGroup.add(pommelRing, pommelSpike);

    for (const zRing of [0.18, 0.48, 0.78, 0.94]) {
      const coilRing = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.018, 8, 16), goldConductor);
      coilRing.position.set(0, 0, zRing);
      staffGroup.add(coilRing);
    }

    // Guarda Eletromagnética (Crossguard) em Ouro e Prata com Núcleo de Plasma e 2 Asas de Raio
    const crossguardBlock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.14), goldConductor);
    crossguardBlock.position.set(0, 0, 1.06);
    const crossguardSilver = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.1), silverTitanium);
    crossguardSilver.position.set(0, 0, 1.06);
    staffGroup.add(crossguardBlock, crossguardSilver);

    const halberdCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 1), whiteSpark);
    halberdCore.position.set(0, 0, 1.08);
    staffGroup.add(halberdCore);
    this.voltaicoStaffOrb = halberdCore;

    // 2 Asas Laterais de Raio + 2 Garras Condutoras do Tridente soltando faíscas para a Lâmina Central
    for (const side of [-1, 1]) {
      // Asa de Raio na Guarda
      const guardWing = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28, 4), electricCyan);
      guardWing.scale.set(0.45, 1.0, 1.0);
      guardWing.position.set(side * 0.22, 0, 1.02);
      guardWing.rotation.z = -side * 1.15;
      guardWing.rotation.x = -0.35;

      // Garra Condutora Lateral do Tridente (Dourada/Azul)
      const prongBase = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.24), cobaltArmor);
      prongBase.position.set(side * 0.15, 0, 1.18);
      prongBase.rotation.y = -side * 0.18;

      const prongBlade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 4), goldConductor);
      prongBlade.scale.set(0.55, 1.0, 1.0);
      prongBlade.rotation.x = Math.PI / 2;
      prongBlade.rotation.z = Math.PI / 4;
      prongBlade.position.set(side * 0.16, 0, 1.42);

      // Faísca saltando da Garra Lateral para a Lâmina Central
      const prongSpark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.025), whiteSpark);
      prongSpark.position.set(side * 0.08, 0, 1.38);
      prongSpark.rotation.y = side * 0.42;

      staffGroup.add(guardWing, prongBase, prongBlade, prongSpark);
    }

    // Lâmina Central Longa, Larga e Afiada de Cristal de Trovão Branco-Ciano (Adeus cotonete!)
    const spearSpine = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.38), silverTitanium);
    spearSpine.position.set(0, 0, 1.28);

    const spearPlasmaEdge = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.62, 4), electricCyan);
    spearPlasmaEdge.rotation.x = Math.PI / 2;
    spearPlasmaEdge.rotation.z = Math.PI / 4;
    spearPlasmaEdge.scale.set(1.0, 0.28, 1.0);
    spearPlasmaEdge.position.set(0, 0, 1.42);

    const spearWhiteCore = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.58, 4), whiteSpark);
    spearWhiteCore.rotation.x = Math.PI / 2;
    spearWhiteCore.rotation.z = Math.PI / 4;
    spearWhiteCore.scale.set(1.0, 0.34, 1.0);
    spearWhiteCore.position.set(0, 0, 1.44);

    staffGroup.add(spearSpine, spearPlasmaEdge, spearWhiteCore);
    rightHandGroup.add(staffGroup);
  }

  /**
   * HERÓI #8: VÓRTEX (OP-08 — COLOSSO SIMBIONTE / ESTILO VENOM & KNULL):
   * 1) Peitoral e Abdômen Musculoso 3D + Emblema da Aranha Simbionte Branca em Alto-Relevo 3D
   * 2) Ombreiras Orgânicas Angulares com Espinhos de Osso Branco e Biomassa Negra (Zero bolas de boliche!)
   * 3) Antebraços Afilados com Lâminas Serrilhadas de Biomassa + 4 Garras Longas e Curvas em Branco-Osso
   * 4) Quadril e Pernas Simbiontes Musculosas 3D com Joelheiras de Osso, Espinhos de Panturrilha e 3 Garras nos Pés
   * 5) Costas: Núcleo Dorsal + 4 Tentáculos Orgânicos de 5 Segmentos Encadeados com Juntas Esféricas e Ponta de Foice (Zero buracos!)
   */
  _attachVortexSymbioteRig(leftHandGroup, rightHandGroup) {
    const symbioteBlack = getLegoMaterial(0x050608, { roughness: 0.08, clearcoat: 1.0 });
    const darkBiomass = getLegoMaterial(0x11131a, { roughness: 0.14, clearcoat: 0.92 });
    const pureWhite = getLegoMaterial(0xffffff, {
      emissive: 0xf8fafc,
      emissiveIntensity: 0.35,
      roughness: 0.14,
      clearcoat: 0.6
    });
    const boneWhite = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.5 });
    const deepVeinPurple = getLegoMaterial(0x7e22ce, {
      emissive: 0x581c87,
      emissiveIntensity: 1.35,
      roughness: 0.16
    });

    // =========================================================================
    // 1. PEITORAL MUSCULOSO 3D + EMBLEMA DA ARANHA SIMBIONTE BRANCA EM ALTO-RELEVO
    // =========================================================================
    const chestGroup = new THREE.Group();

    for (const side of [-1, 1]) {
      // Músculos Peitorais Superiores Esculpidos 3D
      const pecMuscle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.065), symbioteBlack);
      pecMuscle.position.set(side * 0.18, 0.52, 0.215);
      pecMuscle.rotation.y = -side * 0.14;
      pecMuscle.rotation.z = -side * 0.06;
      chestGroup.add(pecMuscle);

      // Gomos Abdominais Simbiontes 3D (6-Pack Esculpido)
      for (let row = 0; row < 2; row++) {
        const abMuscle = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.05), darkBiomass);
        abMuscle.position.set(side * 0.11, 0.31 - row * 0.13, 0.215);
        chestGroup.add(abMuscle);
      }
    }

    // EMBLEMA DA ARANHA SIMBIONTE BRANCA EM ALTO-RELEVO 3D (Frente e Costas!)
    const build3DSpiderEmblem = (zPos, zSign) => {
      const emblem = new THREE.Group();
      // Corpo central pontiagudo da Aranha do Venom
      const headSpike = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 4), pureWhite);
      headSpike.position.set(0, 0.62, zPos);
      const thorax = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.18, 0.028), pureWhite);
      thorax.position.set(0, 0.48, zPos);
      thorax.rotation.z = Math.PI / 4;
      const abdomenBlade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 4), pureWhite);
      abdomenBlade.position.set(0, 0.26, zPos);
      abdomenBlade.rotation.x = Math.PI;
      emblem.add(headSpike, thorax, abdomenBlade);

      // 8 Pernas Angulares em Ziguezague 3D (4 de cada lado abraçando o torso!)
      const legConfigs = [
        { y0: 0.55, x1: 0.17, y1: 0.65, x2: 0.34, y2: 0.72, rot1: -0.52, rot2: -0.35 },
        { y0: 0.49, x1: 0.19, y1: 0.54, x2: 0.38, y2: 0.58, rot1: -0.25, rot2: -0.18 },
        { y0: 0.42, x1: 0.19, y1: 0.39, x2: 0.37, y2: 0.28, rot1: 0.18, rot2: 0.55 },
        { y0: 0.35, x1: 0.16, y1: 0.24, x2: 0.31, y2: 0.11, rot1: 0.58, rot2: 0.75 }
      ];
      for (const lc of legConfigs) {
        for (const s of [-1, 1]) {
          const innerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.026), pureWhite);
          innerSeg.position.set(s * (lc.x1 * 0.52), (lc.y0 + lc.y1) * 0.5, zPos + zSign * 0.004);
          innerSeg.rotation.z = -s * lc.rot1;

          const outerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.024, 0.026), pureWhite);
          outerSeg.position.set(s * ((lc.x1 + lc.x2) * 0.5), (lc.y1 + lc.y2) * 0.5, zPos);
          outerSeg.rotation.z = -s * lc.rot2;
          outerSeg.rotation.y = s * zSign * 0.18;

          emblem.add(innerSeg, outerSeg);
        }
      }
      return emblem;
    };

    chestGroup.add(build3DSpiderEmblem(0.254, 1));
    this.upperBodyGroup.add(chestGroup);

    // =========================================================================
    // 2. OMBREIRAS ORGÂNICAS ANGULARES (ADEUS BOLAS DE BOLICHE!)
    // =========================================================================
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const bioPauldron = new THREE.Group();

      // Placas Musculares Chanfradas de Biomassa Negra Líquida sobrepostas no ombro
      const upperArmor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.38), symbioteBlack);
      upperArmor.position.set(sign * 0.06, 0.07, 0);
      upperArmor.rotation.z = -sign * 0.28;

      const lowerArmor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.35), darkBiomass);
      lowerArmor.position.set(sign * 0.09, -0.03, 0);
      lowerArmor.rotation.z = -sign * 0.38;

      const whiteTendon = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.03, 0.12), pureWhite);
      whiteTendon.position.set(sign * 0.065, 0.11, 0.04);
      whiteTendon.rotation.z = -sign * 0.28;
      bioPauldron.add(upperArmor, lowerArmor, whiteTendon);

      // 3 Espinhos Curvos de Osso Branco e Biomassa Negra inclinados para trás/fora
      for (let s = -1; s <= 1; s++) {
        const spikeLen = s === 0 ? 0.28 : 0.21;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.042, spikeLen, 5),
          s === 0 ? boneWhite : symbioteBlack
        );
        spike.position.set(sign * (0.14 + Math.abs(s) * 0.03), 0.19, s * 0.1);
        spike.rotation.z = -sign * 0.58;
        spike.rotation.x = -0.32 + s * 0.18;
        bioPauldron.add(spike);
        this.vortexMonsterSpikes.push(spike);
      }

      armPivot.add(bioPauldron);
    }

    // =========================================================================
    // 3. ANTEBRAÇOS COM LÂMINAS SIMBIONTES + 4 GARRAS PREDATÓRIAS CURVAS (ADEUS CAIXOTE!)
    // =========================================================================
    for (const [hand, sign] of [[leftHandGroup, 1], [rightHandGroup, -1]]) {
      const forearmBio = new THREE.Group();

      // Carapaça orgânica afilada envolvendo o antebraço
      const bioSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.142, 0.27, 12),
        symbioteBlack
      );
      bioSleeve.position.set(0, -0.14, 0);
      forearmBio.add(bioSleeve);

      // 2 Barbatanas / Lâminas Serrilhadas de Biomassa Negra e Veia Roxa nos Cotovelos (Estilo Carnificina / Prototype)
      for (let b = 0; b < 2; b++) {
        const finBlade = new THREE.Mesh(
          new THREE.ConeGeometry(0.045, 0.34 - b * 0.07, 4),
          b === 0 ? symbioteBlack : deepVeinPurple
        );
        finBlade.scale.set(0.45, 1.0, 1.35);
        finBlade.position.set(sign * 0.13, -0.06 - b * 0.1, -0.08);
        finBlade.rotation.x = -0.68;
        finBlade.rotation.z = -sign * 0.28;
        forearmBio.add(finBlade);
      }

      // Dorso da mão orgânico + 4 Garras Longas, Finas e Curvas em Branco-Osso (#f8fafc) + Polegar Afiado
      const handBack = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        symbioteBlack
      );
      handBack.scale.set(1.05, 0.75, 1.25);
      handBack.position.set(0, -0.31, 0.04);
      forearmBio.add(handBack);

      for (let c = 0; c < 4; c++) {
        const spreadX = (c - 1.5) * 0.046;
        const clawFinger = new THREE.Group();
        clawFinger.position.set(spreadX, -0.34, 0.11);

        const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.1, 6), symbioteBlack);
        knuckle.rotation.x = Math.PI * 0.42;
        knuckle.position.set(0, -0.02, 0.04);

        const boneTalon = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.24, 5), boneWhite);
        boneTalon.position.set(0, -0.08, 0.16);
        boneTalon.rotation.x = Math.PI * 0.66;
        clawFinger.add(knuckle, boneTalon);
        forearmBio.add(clawFinger);
      }

      // Garra do polegar interna
      const thumbTalon = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.19, 5), boneWhite);
      thumbTalon.position.set(-sign * 0.095, -0.34, 0.09);
      thumbTalon.rotation.x = Math.PI * 0.62;
      thumbTalon.rotation.z = sign * 0.35;
      forearmBio.add(thumbTalon);

      hand.add(forearmBio);
    }

    // =========================================================================
    // 4. QUADRIL E PERNAS SIMBIONTES MUSCULOSAS 3D (JOELHEIRAS DE OSSO & GARRAS NOS PÉS)
    // =========================================================================
    const waistTendonGroup = new THREE.Group();
    const beltCore = new THREE.Mesh(new THREE.BoxGeometry(0.81, 0.12, 0.45), symbioteBlack);
    beltCore.position.set(0, 0.07, 0);
    waistTendonGroup.add(beltCore);

    for (const side of [-1, 1]) {
      const beltVein = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.032, 0.46), pureWhite);
      beltVein.position.set(side * 0.22, 0.08, 0);
      beltVein.rotation.z = -side * 0.16;
      waistTendonGroup.add(beltVein);
    }
    this.hipGroup.add(waistTendonGroup);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const legBioGroup = new THREE.Group();

      // Musculatura Esculpida da Coxa + Veia Simbionte Branca
      const thighMuscle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.45), symbioteBlack);
      thighMuscle.position.set(0, -0.2, 0.01);
      const thighVein = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.46), pureWhite);
      thighVein.position.set(sign * 0.12, -0.2, 0.01);
      thighVein.rotation.z = -sign * 0.14;

      // Joelheira Pontiaguda de Osso Branco 3D
      const kneeArmor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.12), darkBiomass);
      kneeArmor.position.set(0, -0.38, 0.2);
      const kneeBoneSpike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 5), boneWhite);
      kneeBoneSpike.position.set(0, -0.36, 0.28);
      kneeBoneSpike.rotation.x = Math.PI * 0.36;

      // Caneleira de Biomassa + Espinho Traseiro na Panturrilha
      const shinGreave = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.26, 0.45), symbioteBlack);
      shinGreave.position.set(0, -0.54, 0.01);
      const calfSpike = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 5), symbioteBlack);
      calfSpike.position.set(0, -0.46, -0.26);
      calfSpike.rotation.x = -Math.PI * 0.68;

      // 3 Garras Brancas Afiadas na ponta de cada pé!
      for (let tc = -1; tc <= 1; tc++) {
        const footTalon = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 4), boneWhite);
        footTalon.position.set(tc * 0.095, -0.68, 0.28);
        footTalon.rotation.x = Math.PI * 0.52;
        legBioGroup.add(footTalon);
      }

      legBioGroup.add(thighMuscle, thighVein, kneeArmor, kneeBoneSpike, shinGreave, calfSpike);
      legPivot.add(legBioGroup);
    }

    // =========================================================================
    // 5. COSTAS: NÚCLEO DORSAL + 4 TENTÁCULOS ORGÂNICOS DE 5 SEGMENTOS ENCADEADOS
    //    COM JUNTAS ESFÉRICAS E PONTA DE FOICE (ZERO BURACOS E ZERO CONE ROSA!)
    // =========================================================================
    const dorsalCore = new THREE.Group();
    const backMass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 0.11), symbioteBlack);
    backMass.position.set(0, 0.42, -0.23);
    dorsalCore.add(backMass);
    dorsalCore.add(build3DSpiderEmblem(-0.29, -1));
    this.upperBodyGroup.add(dorsalCore);

    const tentacleConfigs = [
      { x: 0.22, y: 0.58, rotZ: -0.58, rotY: 0.34, side: 1, phase: 0.0 },
      { x: -0.22, y: 0.58, rotZ: 0.58, rotY: -0.34, side: -1, phase: 1.57 },
      { x: 0.25, y: 0.3, rotZ: -1.02, rotY: 0.44, side: 1, phase: 3.14 },
      { x: -0.25, y: 0.3, rotZ: 1.02, rotY: -0.44, side: -1, phase: 4.71 }
    ];

    const segSpec = [
      { len: 0.34, rBot: 0.088, rTop: 0.072, baseRotX: -0.28, baseRotZ: 0.16 },
      { len: 0.32, rBot: 0.072, rTop: 0.058, baseRotX: -0.22, baseRotZ: 0.18 },
      { len: 0.30, rBot: 0.058, rTop: 0.044, baseRotX: 0.24, baseRotZ: -0.22 },
      { len: 0.28, rBot: 0.044, rTop: 0.030, baseRotX: 0.28, baseRotZ: -0.18 },
      { len: 0.25, rBot: 0.030, rTop: 0.018, baseRotX: -0.20, baseRotZ: 0.14 }
    ];

    for (const cfg of tentacleConfigs) {
      const rootPivot = new THREE.Group();
      rootPivot.position.set(cfg.x, cfg.y, -0.25);
      rootPivot.rotation.z = cfg.rotZ;
      rootPivot.rotation.y = cfg.rotY;

      const chainedSegments = [];
      let parentNode = rootPivot;

      for (let s = 0; s < segSpec.length; s++) {
        const sp = segSpec[s];
        const segPivot = new THREE.Group();
        if (s > 0) {
          // Filho exato no topo (0, prevLen, 0) do segmento anterior — NUNCA desencaixa!
          segPivot.position.set(0, segSpec[s - 1].len, 0);
        }
        const initRotX = sp.baseRotX;
        const initRotZ = sp.baseRotZ * cfg.side;
        segPivot.rotation.x = initRotX;
        segPivot.rotation.z = initRotZ;

        // Junta Esférica Preta + Anel Bioluminescente Roxo-Abissal Escuro na articulação
        const ballJoint = new THREE.Mesh(
          new THREE.SphereGeometry(sp.rBot * 1.08, 10, 10),
          symbioteBlack
        );
        segPivot.add(ballJoint);

        if (s % 2 === 1) {
          const veinRing = new THREE.Mesh(
            new THREE.TorusGeometry(sp.rBot * 1.02, 0.012, 6, 12),
            deepVeinPurple
          );
          veinRing.rotation.x = Math.PI / 2;
          segPivot.add(veinRing);
        }

        // Segmento cônico afilado de Biomassa Negra Líquida (origem na base y = 0)
        const cylGeo = new THREE.CylinderGeometry(sp.rTop, sp.rBot, sp.len, 10);
        cylGeo.translate(0, sp.len * 0.5, 0);
        const cylMesh = new THREE.Mesh(cylGeo, symbioteBlack);
        cylMesh.castShadow = true;
        segPivot.add(cylMesh);

        // Espinho orgânico dorsal (Branco-Osso ou Preto) ao longo do tentáculo
        if (s >= 1 && s <= 3) {
          const dorsalThorn = new THREE.Mesh(
            new THREE.ConeGeometry(sp.rTop * 0.65, 0.14, 4),
            s === 2 ? boneWhite : symbioteBlack
          );
          dorsalThorn.position.set(0, sp.len * 0.55, -sp.rBot * 0.85);
          dorsalThorn.rotation.x = -Math.PI * 0.65;
          segPivot.add(dorsalThorn);
        }

        // Na extremidade do 5º segmento: LÂMINA DE FOICE / FERRÃO PREDATÓRIO (Sem cone rosa!)
        if (s === segSpec.length - 1) {
          const scytheGroup = new THREE.Group();
          scytheGroup.position.set(0, sp.len, 0);

          const mainBlade = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.34, 4), symbioteBlack);
          mainBlade.scale.set(0.38, 1.0, 1.45);
          mainBlade.position.set(0, 0.15, 0.04);
          mainBlade.rotation.x = 0.38;

          const razorEdge = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.32, 4), boneWhite);
          razorEdge.scale.set(0.26, 1.0, 1.15);
          razorEdge.position.set(0, 0.15, 0.065);
          razorEdge.rotation.x = 0.42;

          const veinCore = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.22, 0.032), deepVeinPurple);
          veinCore.position.set(0, 0.11, 0.02);
          veinCore.rotation.x = 0.38;

          const backBarb = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.15, 4), boneWhite);
          backBarb.position.set(0, 0.04, -0.04);
          backBarb.rotation.x = -Math.PI * 0.68;

          scytheGroup.add(mainBlade, razorEdge, veinCore, backBarb);
          segPivot.add(scytheGroup);
        }

        parentNode.add(segPivot);
        parentNode = segPivot;
        chainedSegments.push({
          pivot: segPivot,
          baseRotX: initRotX,
          baseRotZ: initRotZ,
          segIndex: s
        });
      }

      this.upperBodyGroup.add(rootPivot);
      this.vortexTentacles.push({
        pivot: rootPivot,
        segments: chainedSegments,
        baseRotZ: cfg.rotZ,
        baseRotY: cfg.rotY,
        side: cfg.side,
        phase: cfg.phase
      });
    }
  }

  /**
   * HERÓI #8 (Vórtex): Alterna em tempo real entre Forma Normal Ágil e Forma Big-Fig Monstruosa Colossal [F]!
   */
  setVortexMonsterForm(isMonster) {
    if (this.currentHeroKey !== 'vortex') return;
    this.isVortexMonster = Boolean(isMonster);
    this.isBigFig = this.isVortexMonster;

    if (this.isVortexMonster) {
      // Forma Big-Fig Monstruosa Colossal (Quase o dobro do tamanho + ombros largos + espinhos gigantes!)
      this.visualRoot.scale.set(1.88, 1.74, 1.88);
      for (const sp of this.vortexMonsterSpikes) {
        sp.scale.set(1.45, 1.65, 1.45);
      }
      for (const t of this.vortexTentacles) {
        t.pivot.scale.setScalar(1.32);
      }
    } else {
      // Forma Simbionte Ágil
      this.visualRoot.scale.set(1.06, 1.08, 1.06);
      for (const sp of this.vortexMonsterSpikes) {
        sp.scale.set(1, 1, 1);
      }
      for (const t of this.vortexTentacles) {
        t.pivot.scale.setScalar(1.0);
      }
    }
  }

  /**
   * Equipa a Armadura e Equipamento Tático 3D Completo do Comandante Caveira (BOPE — OP-01):
   * - FRENTE: Colete Balístico 3D (Plate Carrier), Emblema 3D Faca na Caveira, 3 Porta-Carregadores, 2 Granadas/Cargas e Rádio Militar com Antena;
   * - COSTAS: Mochila Tática Militar 3D (BOPE Assault Pack), Tubo C4 de Demolição e Faca de Combate Tática embainhada na diagonal;
   * - OMBROS & BRAÇOS: Ombreiras Blindadas Chanfradas 3D com friso dourado, Cotoveleiras e Relógio/Detonador Tático GPS no pulso;
   * - CINTO & PERNAS: Cinto de Utilidades 3D, Coldre de Coxa com Pistola 3D, Bolsa de Explosivos, Joelheiras Blindadas e Coturnos Pesados.
   */
  _attachCaveiraBopeRig() {
    const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.35, clearcoat: 0.2 });
    const tacticalGraphite = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.4 });
    const darkSteel = getLegoMaterial(0x334155, { roughness: 0.25, metalness: 0.55 });
    const goldMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.18, metalness: 0.65 });
    const skullWhite = getLegoMaterial(0xf8fafc, { roughness: 0.22 });
    const oliveDrab = getLegoMaterial(0x365314, { roughness: 0.35 });
    const orangeLed = getLegoMaterial(0xf97316, { emissive: 0xf97316, emissiveIntensity: 2.0 });
    const redLed = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.8 });

    // =========================================================================
    // 1. FRENTE — COLETE BALÍSTICO PESADO 3D (PLATE CARRIER) + EMBLEMA BOPE 3D
    // =========================================================================
    const frontVest = new THREE.Group();

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.08), matteBlack);
    chestPlate.position.set(0, 0.39, 0.23);
    chestPlate.castShadow = true;
    frontVest.add(chestPlate);

    const upperTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.045, 0.09), goldMat);
    upperTrim.position.set(0, 0.62, 0.235);
    frontVest.add(upperTrim);

    // Tiras de ombro 3D conectando frente e costas do colete
    for (const sx of [-0.25, 0.25]) {
      const strapTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.52), matteBlack);
      strapTop.position.set(sx, 0.76, 0);
      const strapBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.08), goldMat);
      strapBuckle.position.set(sx, 0.69, 0.24);
      frontVest.add(strapTop, strapBuckle);
    }

    // Emblema 3D da Caveira com Facas Cruzadas em alto-relevo no centro do peito
    const chestEmblem = new THREE.Group();
    chestEmblem.position.set(0, 0.47, 0.278);
    for (const s of [-1, 1]) {
      const crossedKnife = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.26, 0.015), goldMat);
      crossedKnife.rotation.z = s * 0.68;
      chestEmblem.add(crossedKnife);
    }
    const skullCranium = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 14), skullWhite);
    skullCranium.scale.set(1.0, 1.05, 0.6);
    skullCranium.position.set(0, 0.02, 0.01);
    const skullJaw = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.05), skullWhite);
    skullJaw.position.set(0, -0.045, 0.01);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.03), matteBlack);
    eyeL.position.set(-0.024, 0.022, 0.045);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.03), matteBlack);
    eyeR.position.set(0.024, 0.022, 0.045);
    chestEmblem.add(skullCranium, skullJaw, eyeL, eyeR);
    frontVest.add(chestEmblem);

    // 3 Porta-Carregadores 3D de Fuzil (Mag Pouches) na parte inferior do colete
    for (const mx of [-0.21, 0, 0.21]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.09), tacticalGraphite);
      pouch.position.set(mx, 0.22, 0.265);
      pouch.castShadow = true;
      const pouchFlap = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.06, 0.1), matteBlack);
      pouchFlap.position.set(mx, 0.29, 0.268);
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.06), goldMat);
      magTip.position.set(mx, 0.33, 0.265);
      frontVest.add(pouch, pouchFlap, magTip);
    }

    // 2 Cargas Explosivas / Granadas Táticas 3D (com LED laranja) no peito direito
    for (const [gx, gy] of [[-0.24, 0.52], [-0.13, 0.52]]) {
      const nadeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 12), oliveDrab);
      nadeBody.position.set(gx, gy, 0.275);
      const nadeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 12), goldMat);
      nadeRing.position.set(gx, gy, 0.275);
      const nadeLed = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10), orangeLed);
      nadeLed.position.set(gx, gy + 0.07, 0.275);
      frontVest.add(nadeBody, nadeRing, nadeLed);
    }

    // Rádio Militar Tático 3D no ombro esquerdo com Antena Longa subindo atrás da cabeça
    const radioBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), tacticalGraphite);
    radioBox.position.set(0.24, 0.54, 0.265);
    const radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), redLed);
    radioLed.position.set(0.21, 0.6, 0.31);
    const radioAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.56, 8), matteBlack);
    radioAntenna.position.set(0.27, 0.88, -0.12);
    frontVest.add(radioBox, radioLed, radioAntenna);

    this.upperBodyGroup.add(frontVest);

    // =========================================================================
    // 2. COSTAS — MOCHILA DE ASSALTO TÁTICA 3D + C4 + FACA DE COMBATE DORSAL
    // =========================================================================
    const backPackGroup = new THREE.Group();
    backPackGroup.position.set(0, 0.41, -0.29);

    // Corpo principal da Mochila Militar 3D (BOPE Assault Pack)
    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.22), matteBlack);
    packMain.castShadow = true;
    backPackGroup.add(packMain);

    // Bolsos modulares superiores e inferiores em grafite blindado
    const upperPocket = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.08), tacticalGraphite);
    upperPocket.position.set(0, 0.14, -0.13);
    const lowerPocket = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.09), tacticalGraphite);
    lowerPocket.position.set(0, -0.12, -0.135);
    const goldPatch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.02), goldMat);
    goldPatch.position.set(0, 0.18, -0.175);
    backPackGroup.add(upperPocket, lowerPocket, goldPatch);

    // Pinos LEGO (Studs) táticos na mochila
    for (const sx of [-0.16, 0.16]) {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), darkSteel);
      stud.rotation.x = Math.PI / 2;
      stud.position.set(sx, -0.12, -0.19);
      backPackGroup.add(stud);
    }

    // Rolo / Tubo de Demolição C4 preso embaixo da mochila com luz laranja de carga
    const breachTube = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.64, 16), tacticalGraphite);
    breachTube.rotation.z = Math.PI / 2;
    breachTube.position.set(0, -0.32, -0.04);
    for (const sx of [-0.22, 0.22]) {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.045, 16), goldMat);
      strap.rotation.z = Math.PI / 2;
      strap.position.set(sx, -0.32, -0.04);
      backPackGroup.add(strap);
    }
    const c4ChargeLight = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), orangeLed);
    c4ChargeLight.position.set(0, -0.32, -0.13);
    backPackGroup.add(breachTube, c4ChargeLight);

    // Faca de Combate Tática 3D (Faca na Caveira) embainhada na diagonal nas costas
    const knifeGroup = new THREE.Group();
    knifeGroup.position.set(-0.18, 0.18, -0.16);
    knifeGroup.rotation.z = -0.58;
    const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.045), matteBlack);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.055), goldMat);
    guard.position.set(0, 0.22, 0);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 10), matteBlack);
    grip.position.set(0, 0.31, 0);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), goldMat);
    pommel.position.set(0, 0.41, 0);
    knifeGroup.add(scabbard, guard, grip, pommel);
    backPackGroup.add(knifeGroup);

    this.upperBodyGroup.add(backPackGroup);

    // =========================================================================
    // 3. OMBROS & BRAÇOS — OMBREIRAS BLINDADAS 3D, COTOVELEIRAS & DETONADOR GPS
    // =========================================================================
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.36), matteBlack);
      pauldron.position.set(sign * 0.06, -0.04, 0);
      pauldron.rotation.z = -sign * 0.12;
      pauldron.castShadow = true;

      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.045, 0.37), goldMat);
      goldStripe.position.set(sign * 0.06, 0.04, 0);
      goldStripe.rotation.z = -sign * 0.12;

      const patchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.18), darkSteel);
      patchPlate.position.set(sign * 0.19, -0.05, 0);
      armPivot.add(pauldron, goldStripe, patchPlate);
    }

    for (const [handGrp, isLeft] of [[this.leftHandGroup, true], [this.rightHandGroup, false]]) {
      // Braçadeira / Cotoveleira Tática 3D no antebraço
      const vambrace = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.26), matteBlack);
      vambrace.position.set(0, -0.11, 0);
      handGrp.add(vambrace);

      if (isLeft) {
        // Detonador Tático / Relógio GPS Militar com tela luminosa laranja no pulso esquerdo!
        const wristPad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.27), tacticalGraphite);
        wristPad.position.set(0, -0.2, 0);
        const wristScreen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.14), orangeLed);
        wristScreen.position.set(0.11, -0.2, 0.02);
        handGrp.add(wristPad, wristScreen);
      }
    }

    // =========================================================================
    // 4. CINTO TÁTICO 3D, COLDRE DE COXA COM PISTOLA, JOELHEIRAS E COTURNOS
    // =========================================================================
    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.48), matteBlack);
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.06), goldMat);
    beltBuckle.position.set(0, 0.08, 0.245);
    beltGroup.add(beltBand, beltBuckle);

    for (const bx of [-0.36, 0.36]) {
      const sidePouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.18), tacticalGraphite);
      sidePouch.position.set(bx, 0.07, 0.08);
      beltGroup.add(sidePouch);
    }
    this.hipGroup.add(beltGroup);

    // Perna Direita: Coldre Tático de Coxa 3D (Drop-Leg Holster) + Pistola 3D + Joelheira + Coturno
    const holsterStrap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.06, 0.4), matteBlack);
    holsterStrap.position.set(0, -0.22, 0);
    const holsterBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.16), tacticalGraphite);
    holsterBox.position.set(-0.2, -0.22, 0.04);
    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.12), matteBlack);
    pistolGrip.position.set(-0.2, -0.1, 0.02);
    pistolGrip.rotation.x = -0.25;
    const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.18), darkSteel);
    pistolSlide.position.set(-0.2, -0.14, 0.06);
    this.rightLegPivot.add(holsterStrap, holsterBox, pistolGrip, pistolSlide);

    // Perna Esquerda: Bolsa Tática de Explosivos / Sub-Carga na Coxa
    const leftThighStrap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.06, 0.4), matteBlack);
    leftThighStrap.position.set(0, -0.22, 0);
    const leftThighPouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), tacticalGraphite);
    leftThighPouch.position.set(0.2, -0.22, 0.02);
    const pouchBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.08), goldMat);
    pouchBuckle.position.set(0.2, -0.18, 0.02);
    this.leftLegPivot.add(leftThighStrap, leftThighPouch, pouchBuckle);

    // Joelheiras Táticas Blindadas 3D + Coturnos Pesados do BOPE nas duas pernas
    for (const legPivot of [this.leftLegPivot, this.rightLegPivot]) {
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.12), matteBlack);
      kneePad.position.set(0, -0.39, 0.18);
      const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.06), darkSteel);
      kneeCap.position.set(0, -0.39, 0.23);

      const bootCuff = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.16, 0.41), matteBlack);
      bootCuff.position.set(0, -0.54, 0.01);
      const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.55), matteBlack);
      bootSole.position.set(0, -0.64, 0.07);
      const bootBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.42), goldMat);
      bootBuckle.position.set(0, -0.49, 0.01);
      legPivot.add(kneePad, kneeCap, bootCuff, bootSole, bootBuckle);
    }
  }

  /**
   * Equipa o Chassi Colossal de "PM Robô Mutante Gigante da PMESP" (Titã Blindado #3):
   * - Paleta Institucional da PM de São Paulo: Vermelho (#dc2626 / #ef4444), Cinza-Bandeirante (#475569 / #334155), Branco Policial (#f8fafc) e Preto Tático (#090a0d)
   * - Peitoral Blindado 3D Estufado + Gola/Trapézio Mecânico Gigante + Barra de Giroflex Policial nas Costas
   * - Ombreiras Colossais de Viatura + Tubos de Bio-Energia Vermelha Pulsante (Mutant Bio-Cables)
   * - Mochila Propulsora Dupla a Jato + Pernas Blindadas com Pistões Hidráulicos e Botas Esmagadoras
   * - Escudo de Choque PMESP no braço esquerdo + Minigun Vulcan Rotativa de 6 Canos no braço direito!
   */
  _attachTitaBigFigRig(leftHandGroup, rightHandGroup) {
    const pmWhite = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.6 });
    const pmGrey = getLegoMaterial(0x475569, { roughness: 0.24, metalness: 0.45 });
    const pmDarkGrey = getLegoMaterial(0x1e293b, { roughness: 0.26, metalness: 0.55 });
    const pmBlack = getLegoMaterial(0x090a0d, { roughness: 0.32, metalness: 0.35 });
    const pmRed = getLegoMaterial(0xdc2626, { roughness: 0.2, clearcoat: 0.55 });
    const silverSteel = getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.16, metalness: 0.75 });
    const redGlow = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });
    const whiteRedCore = getLegoMaterial(0xffffff, { emissive: 0xfca5a5, emissiveIntensity: 2.5 });
    const blueSiren = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 2.0 });

    // =========================================================================
    // 1. PEITORAL BLINDADO 3D ESTUFADO + GOLA MECÂNICA GIGANTE + REATOR PMESP
    // =========================================================================
    const chestRig = new THREE.Group();

    // Placa Peitoral Superior Estufada em Branco Policial (estilo Hulkbuster/Juggernaut)
    const upperChestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.44, 0.16),
      pmWhite
    );
    upperChestPlate.position.set(0, 0.52, 0.22);
    upperChestPlate.castShadow = true;
    chestRig.add(upperChestPlate);

    // Placa Abdominal Hidráulica em Cinza-Bandeirante + Pistões Laterais Prateados
    const lowerAbPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.3, 0.12),
      pmGrey
    );
    lowerAbPlate.position.set(0, 0.21, 0.21);
    chestRig.add(lowerAbPlate);

    for (const side of [-1, 1]) {
      // Faixas Diagonais Vermelhas Institucionais da PMESP no peito
      const chevronStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.11, 0.045),
        pmRed
      );
      chevronStripe.position.set(side * 0.28, 0.56, 0.295);
      chevronStripe.rotation.z = -side * 0.34;
      chestRig.add(chevronStripe);

      // Pistões Hidráulicos Abdominais 3D
      const abPiston = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12),
        silverSteel
      );
      abPiston.position.set(side * 0.34, 0.24, 0.25);
      chestRig.add(abPiston);
    }

    // Gola Blindada / Trapézio Mecânico Gigante (Hunched Mech Collar) envolvendo o pescoço
    const mechCollarBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.24, 0.28),
      pmDarkGrey
    );
    mechCollarBack.position.set(0, 0.78, -0.1);
    chestRig.add(mechCollarBack);

    for (const side of [-1, 1]) {
      const trapArmor = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.22, 0.44),
        pmWhite
      );
      trapArmor.position.set(side * 0.36, 0.76, 0.02);
      trapArmor.rotation.z = -side * 0.22;
      const trapStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.29, 0.06, 0.45),
        pmRed
      );
      trapStripe.position.set(side * 0.36, 0.82, 0.02);
      trapStripe.rotation.z = -side * 0.22;
      chestRig.add(trapArmor, trapStripe);
    }

    // Barra de Giroflex Policial 3D (Sirene Luminosa Vermelha/Branca/Azul) no topo do Trapézio
    const lightbarBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.06, 0.16),
      pmBlack
    );
    lightbarBase.position.set(0, 0.92, -0.14);
    const lightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.14), redGlow);
    lightLeft.position.set(-0.21, 0.96, -0.14);
    const lightCenter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.14), pmWhite);
    lightCenter.position.set(0, 0.96, -0.14);
    const lightRight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.14), blueSiren);
    lightRight.position.set(0.21, 0.96, -0.14);
    chestRig.add(lightbarBase, lightLeft, lightCenter, lightRight);
    this.titaSirenLights.push(
      { mesh: lightLeft, isRed: true },
      { mesh: lightRight, isRed: false }
    );

    // Reator Policial Vermelho-Rubro 3D no centro do peito
    const reactorRing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 22), pmBlack);
    reactorRing.rotation.x = Math.PI / 2;
    reactorRing.position.set(0, 0.44, 0.29);
    const reactorOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20), redGlow);
    reactorOuter.rotation.x = Math.PI / 2;
    reactorOuter.position.set(0, 0.44, 0.3);
    const reactorInner = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), whiteRedCore);
    reactorInner.position.set(0, 0.44, 0.33);
    chestRig.add(reactorRing, reactorOuter, reactorInner);

    // Cabos de Bio-Energia Mutante Vermelha (Mutant Bio-Cables) conectando as costas aos ombros
    for (const side of [-1, 1]) {
      const bioCable = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.042, 10, 20, Math.PI * 0.95),
        redGlow
      );
      bioCable.position.set(side * 0.42, 0.62, -0.16);
      bioCable.rotation.y = side * 0.65;
      bioCable.rotation.x = 0.35;
      chestRig.add(bioCable);
    }

    this.upperBodyGroup.add(chestRig);

    // =========================================================================
    // 2. OMBREIRAS DE VIATURA BLINDADA + BRAÇOS MUTANTES HIDRÁULICOS
    // =========================================================================
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      armPivot.position.x = sign * 0.62;
      const pauldronGroup = new THREE.Group();

      // Bloco principal da Ombreira Colossal em Branco Policial + Base Cinza-Bandeirante
      const pauldronUpper = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.62), pmWhite);
      pauldronUpper.position.set(sign * 0.1, 0.12, 0);
      pauldronUpper.rotation.z = -sign * 0.12;
      pauldronUpper.castShadow = true;

      const pauldronLower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.64), pmGrey);
      pauldronLower.position.set(sign * 0.09, -0.06, 0);
      pauldronLower.rotation.z = -sign * 0.12;

      // Faixa Vermelha Institucional PMESP + Pistão Hidráulico Prateado + Pinos LEGO Vermelhos
      const pmStripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.65), pmRed);
      pmStripe.position.set(sign * 0.1, 0.04, 0);
      pmStripe.rotation.z = -sign * 0.12;

      const shoulderPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 12), silverSteel);
      shoulderPiston.position.set(sign * 0.24, -0.06, -0.14);

      for (const sz of [-0.14, 0.14]) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 14), pmRed);
        stud.position.set(sign * 0.12, 0.28, sz);
        pauldronGroup.add(stud);
      }

      pauldronGroup.add(pauldronUpper, pauldronLower, pmStripe, shoulderPiston);
      armPivot.add(pauldronGroup);
    }

    // Manoplas Hidráulicas Musculosas & Punhos Colossais Vermelhos/Pretos nas duas mãos
    for (const [hand, sign] of [[leftHandGroup, 1], [rightHandGroup, -1]]) {
      const forearmArmor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.34), pmGrey);
      forearmArmor.position.set(0, -0.12, 0);
      const forearmStripe = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.07, 0.35), pmRed);
      forearmStripe.position.set(0, -0.12, 0);
      const wristPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10), silverSteel);
      wristPiston.position.set(sign * 0.16, -0.14, -0.06);

      const bigFist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.36), pmRed);
      bigFist.position.set(0, -0.35, 0.04);
      bigFist.castShadow = true;
      const knucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), silverSteel);
      knucklePlate.position.set(0, -0.36, 0.19);
      hand.add(forearmArmor, forearmStripe, wristPiston, bigFist, knucklePlate);
    }

    // =========================================================================
    // 3. COSTAS — MOCHILA PROPULSORA DUPLA A JATO + REATOR DORSAL MUTANTE
    // =========================================================================
    const jetpack = new THREE.Group();
    jetpack.position.set(0, 0.44, -0.34);

    const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.6, 0.3), pmDarkGrey);
    packBox.castShadow = true;
    const packWhiteCap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.32), pmWhite);
    packWhiteCap.position.set(0, 0.22, 0);
    const packRedStripe = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.08, 0.33), pmRed);
    packRedStripe.position.set(0, 0.1, 0);

    // Cilindro Central de Bio-Gás Mutante Vermelho sob pressão
    const bioTank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 16), redGlow);
    bioTank.position.set(0, -0.04, -0.14);
    jetpack.add(packBox, packWhiteCap, packRedStripe, bioTank);

    // 2 Megaturbinas Traseiras Inclinadas + Chamas de Propulsão 3D (Dash / Super-Pulo)
    for (const sx of [-0.26, 0.26]) {
      const thrusterHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.42, 16), silverSteel);
      thrusterHousing.position.set(sx, -0.18, -0.08);
      thrusterHousing.rotation.x = 0.18;

      const nozzleRim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.08, 16), pmBlack);
      nozzleRim.position.set(sx, -0.38, -0.11);
      nozzleRim.rotation.x = 0.18;

      const nozzleGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), redGlow);
      nozzleGlow.position.set(sx, -0.41, -0.12);
      nozzleGlow.rotation.x = 0.18;

      const jetFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.58, 10), redGlow);
      jetFlame.position.set(sx, -0.68, -0.17);
      jetFlame.rotation.x = Math.PI + 0.18;
      jetFlame.visible = false;
      this.titaDashFlameMeshes.push(jetFlame);

      jetpack.add(thrusterHousing, nozzleRim, nozzleGlow, jetFlame);
    }
    this.upperBodyGroup.add(jetpack);

    // =========================================================================
    // 4. PERNAS BLINDADAS COM PISTÕES HIDRÁULICOS & BOTAS ESMAGADORAS
    // =========================================================================
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.15, 0.48), pmBlack);
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.08), pmRed);
    beltBuckle.position.set(0, 0.08, 0.24);
    this.hipGroup.add(beltBand, beltBuckle);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      // Placa de Coxa Blindada Branca/Vermelha da PMESP
      const thighArmor = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.24, 0.44), pmWhite);
      thighArmor.position.set(0, -0.18, 0.02);
      const thighStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.45), pmRed);
      thighStripe.position.set(0, -0.18, 0.02);

      // Joelheira Mecha Vermelha/Cinza + Pistões Hidráulicos Laterais Prateados
      const kneeArmor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.16), pmRed);
      kneeArmor.position.set(0, -0.38, 0.19);
      const kneeCore = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), redGlow);
      kneeCore.position.set(0, -0.38, 0.26);

      const legPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.44, 10), silverSteel);
      legPiston.position.set(sign * 0.21, -0.38, 0.02);

      // Bota Esmagadora Colossal de Aço (Pisada Sísmica [Q]!)
      const heavyBoot = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.22, 0.48), pmDarkGrey);
      heavyBoot.position.set(0, -0.54, 0.03);
      const stomperSole = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.6), pmBlack);
      stomperSole.position.set(0, -0.64, 0.09);
      const toeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.16), silverSteel);
      toeGuard.position.set(0, -0.61, 0.34);

      legPivot.add(thighArmor, thighStripe, kneeArmor, kneeCore, legPiston, heavyBoot, stomperSole, toeGuard);
    }

    // =========================================================================
    // 5. BRAÇO ESQUERDO: ESCUDO DE CHOQUE DA TROPA DE CHOQUE PMESP
    // =========================================================================
    const shield = new THREE.Group();
    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.96, 0.66), pmDarkGrey);
    shieldPlate.castShadow = true;
    const shieldWhiteTop = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.34, 0.64), pmWhite);
    shieldWhiteTop.position.set(0, 0.28, 0);
    const shieldRedStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.65), pmRed);
    shieldRedStripe.position.set(0, 0.06, 0);
    const shieldVisor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.46), redGlow);
    shieldVisor.position.set(0, 0.26, 0);
    const shieldBumper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.68), silverSteel);
    shieldBumper.position.set(0, -0.36, 0);

    shield.add(shieldPlate, shieldWhiteTop, shieldRedStripe, shieldVisor, shieldBumper);
    shield.position.set(0.22, -0.24, 0.12);
    leftHandGroup.add(shield);
    this.titaShieldGroup = shield;

    // =========================================================================
    // 6. BRAÇO DIREITO: MINIGUN VULCAN PESADA DE 6 CANOS GIRATÓRIOS + TAMBOR PMESP
    // =========================================================================
    const cannon = new THREE.Group();

    // Carcaça Blindada Traseira da Minigun em Preto Fosco, Cinza e Vermelho PMESP
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.56), pmBlack);
    housing.position.set(-0.16, 0, 0.2);
    housing.castShadow = true;
    const housingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.08, 0.52), pmRed);
    housingStripe.position.set(-0.16, 0.06, 0.2);
    cannon.add(housing, housingStripe);

    // Tambor Lateral de Munição Pesada (Ammo Drum) + Cinta de Balas Metálica
    const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 16), pmRed);
    ammoDrum.rotation.z = Math.PI / 2;
    ammoDrum.position.set(-0.34, -0.1, 0.18);
    const drumCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 16), pmWhite);
    drumCap.rotation.z = Math.PI / 2;
    drumCap.position.set(-0.34, -0.1, 0.18);
    const ammoChute = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.18), silverSteel);
    ammoChute.position.set(-0.26, -0.02, 0.22);
    cannon.add(ammoDrum, drumCap, ammoChute);

    // Conjunto Rotativo de 6 Canos Longos de Aço Prateado (gira em altíssima velocidade ao atirar!)
    const barrelCluster = new THREE.Group();
    barrelCluster.position.set(-0.16, 0, 0.48);

    const barrelCount = 6;
    const clusterRadius = 0.088;
    const barrelLength = 0.78;
    for (let b = 0; b < barrelCount; b++) {
      const ang = (b / barrelCount) * Math.PI * 2;
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, barrelLength, 10),
        silverSteel
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(
        Math.cos(ang) * clusterRadius,
        Math.sin(ang) * clusterRadius,
        barrelLength * 0.5
      );
      barrelCluster.add(barrel);
    }

    // 2 Anéis Espaçadores Rotativos segurando os 6 canos da Minigun
    for (const ringZ of [0.22, 0.64]) {
      const clampRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.055, 16),
        ringZ > 0.5 ? pmRed : pmDarkGrey
      );
      clampRing.rotation.x = Math.PI / 2;
      clampRing.position.set(0, 0, ringZ);
      barrelCluster.add(clampRing);
    }

    cannon.add(barrelCluster);
    this.titaMinigunBarrelGroup = barrelCluster;

    // Clarão de Fogo Vermelho/Amarelo na ponta dos 6 canos da Minigun
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xef4444,
      emissiveIntensity: 2.6,
      transparent: true,
      opacity: 0.94
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), flashMat);
    this.muzzleFlashMesh.scale.set(1.0, 1.0, 2.8);
    this.muzzleFlashMesh.position.set(-0.16, 0, 1.38);
    this.muzzleFlashMesh.visible = false;
    cannon.add(this.muzzleFlashMesh);

    cannon.position.set(0, -0.32, 0.08);
    cannon.rotation.x = Math.PI / 2 - 0.12;
    rightHandGroup.add(cannon);
    this.titaCannonGroup = cannon;
  }

  /**
   * Constrói o Visual 3D Completo do Vingador de Chumbo (#4 — Estilo O Justiceiro / Frank Castle):
   * - Sobretudo Longo de Couro Preto 3D (Gola Alta Levantada, Lapelas Abertas com Botões Prateados, Ombreiras com Tachas e Abas Traseiras/Laterais Articuladas até os joelhos)
   * - Peitoral Balístico 3D com a Caveira Branca do Justiceiro em Alto-Relevo + Bandoleiras Cruzadas em X (Cartuchos 12GA e Granadas 40mm)
   * - Cinto Tático Branco/Prata Clássico do Justiceiro + Coldres Duplos de Coxa + Joelheiras Metálicas + Botas Pesadas
   * - Arsenal Guardado Visível nas Costas (Escopeta e Bazuca cruzadas nas costas quando não estão na mão!)
   */
  _attachVingadorArmorAndCoat() {
    const leatherMat = getLegoMaterial(0x10131a, { roughness: 0.42, clearcoat: 0.24 });
    const matteBlackMat = getLegoMaterial(0x090a0d, { roughness: 0.32, clearcoat: 0.28 });
    const kevlarMat = getLegoMaterial(0x141821, { roughness: 0.35, metalness: 0.25 });
    const skullWhiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.5 });
    const chromeSilverMat = getLegoMaterial(0xd8dde6, { roughness: 0.16, metalness: 0.78, clearcoat: 0.6 });
    const redShellMat = getLegoMaterial(0xdc2626, { roughness: 0.22 });
    const brassMat = getLegoMaterial(0xfacc15, { roughness: 0.18, metalness: 0.68 });
    const oliveMat = getLegoMaterial(0x365314, { roughness: 0.32 });
    const eyeGlowMat = getLegoMaterial(0xffffff, {
      emissive: 0xf8fafc,
      emissiveIntensity: 1.4,
      roughness: 0.1
    });

    const rigGroup = new THREE.Group();
    this.vingadorCoatTails = [];
    this.vingadorSkullEyes = [];
    this.vingadorHolsteredPistols = [];

    // 1. GOLA ALTA LEVANTADA DO SOBRETUDO DE COURO PRETO (High Upturned Trenchcoat Collar)
    const backCollar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.11), leatherMat);
    backCollar.position.set(0, 0.78, -0.2);
    backCollar.rotation.x = -0.14;
    rigGroup.add(backCollar);

    for (const side of [-1, 1]) {
      const sideCollar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.38), leatherMat);
      sideCollar.position.set(side * 0.34, 0.77, -0.02);
      sideCollar.rotation.z = -side * 0.18;
      sideCollar.castShadow = true;

      // Lapelas Frontais Abertas 3D (Front Leather Lapels) deixando o centro do peito aberto para a Caveira Branca!
      const frontLapel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.08), leatherMat);
      frontLapel.position.set(side * 0.35, 0.38, 0.22);
      frontLapel.rotation.y = -side * 0.22;
      frontLapel.castShadow = true;

      // Botões metálicos prateados nas lapelas do sobretudo
      for (const by of [0.58, 0.38, 0.18]) {
        const lapelBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10), chromeSilverMat);
        lapelBtn.rotation.x = Math.PI / 2;
        lapelBtn.position.set(side * 0.36, by, 0.26);
        rigGroup.add(lapelBtn);
      }

      rigGroup.add(sideCollar, frontLapel);
    }

    // Costas superiores do Sobretudo de Couro Preto com costuras e cinto dorsal
    const coatBackPanel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.76, 0.09), leatherMat);
    coatBackPanel.position.set(0, 0.38, -0.23);
    coatBackPanel.castShadow = true;
    const backStrap = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.11), matteBlackMat);
    backStrap.position.set(0, 0.12, -0.24);
    const backBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.12), chromeSilverMat);
    backBuckle.position.set(0, 0.12, -0.245);
    rigGroup.add(coatBackPanel, backStrap, backBuckle);

    // 2. ABAS TRASEIRAS E LATERAIS ARTICULADAS DO SOBRETUDO (Trenchcoat Tails até os joelhos y = -0.38)
    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.22, 0.04, -0.22);

      // Aba traseira principal (dividida por fenda central traseira)
      const backTail = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.68, 0.065), leatherMat);
      backTail.position.set(0, -0.32, 0);
      backTail.castShadow = true;

      // Barra chanfrada inferior e tira de ajuste com fivela prateada
      const hemTrim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.075), matteBlackMat);
      hemTrim.position.set(0, -0.63, 0);
      const tailStrap = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.06, 0.08), matteBlackMat);
      tailStrap.position.set(0, -0.36, -0.01);
      const tailStud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.09), chromeSilverMat);
      tailStud.position.set(side * 0.08, -0.36, -0.015);

      // Aba lateral do sobretudo cobrindo a lateral da coxa
      const sideFlap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.64, 0.38), leatherMat);
      sideFlap.position.set(side * 0.21, -0.3, 0.16);
      sideFlap.castShadow = true;

      tailPivot.add(backTail, hemTrim, tailStrap, tailStud, sideFlap);
      tailPivot.rotation.x = 0.12;
      tailPivot.rotation.z = side * 0.06;
      rigGroup.add(tailPivot);

      this.vingadorCoatTails.push({
        pivot: tailPivot,
        side,
        baseRotX: 0.12,
        baseRotZ: side * 0.06,
        phase: side < 0 ? 0 : 1.4
      });
    }

    // 3. PEITORAL BALÍSTICO 3D COM A CAVEIRA BRANCA DO JUSTICEIRO EM ALTO-RELEVO
    const vestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.66, 0.06), kevlarMat);
    vestPlate.position.set(0, 0.39, 0.22);
    rigGroup.add(vestPlate);

    // Crânio Superior e Têmporas em Alto-Relevo 3D Branco
    const skullCranium = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.045), skullWhiteMat);
    skullCranium.position.set(0, 0.56, 0.252);
    const skullForehead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.048), skullWhiteMat);
    skullForehead.position.set(0, 0.65, 0.252);
    rigGroup.add(skullCranium, skullForehead);

    // Maçãs do rosto angulares 3D + Ponte Nasal + Órbitas Oculares Furiosas
    for (const side of [-1, 1]) {
      const cheekBone = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.048), skullWhiteMat);
      cheekBone.position.set(side * 0.14, 0.4, 0.254);
      cheekBone.rotation.z = -side * 0.25;

      const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.052), matteBlackMat);
      eyeSocket.position.set(side * 0.11, 0.49, 0.256);
      eyeSocket.rotation.z = -side * 0.28;

      const eyeCore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.036, 0.056), eyeGlowMat.clone());
      eyeCore.position.set(side * 0.11, 0.49, 0.258);
      eyeCore.rotation.z = -side * 0.28;
      this.vingadorSkullEyes.push(eyeCore);

      rigGroup.add(cheekBone, eyeSocket, eyeCore);
    }

    const nasalCavity = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 3), matteBlackMat);
    nasalCavity.position.set(0, 0.41, 0.26);
    rigGroup.add(nasalCavity);

    // 4 Dentes Compridos Icônicos da Caveira do Justiceiro descendo até o abdômen
    for (const tx of [-0.12, -0.04, 0.04, 0.12]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.25, 0.048), skullWhiteMat);
      tooth.position.set(tx, 0.23, 0.254);
      rigGroup.add(tooth);
    }

    // 4. BANDOLEIRAS 3D CRUZADAS EM X (Cartuchos Vermelhos/Dourados de Calibre 12 + Granadas 40mm)
    const bandolier1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.84, 0.5), matteBlackMat);
    bandolier1.position.set(0, 0.42, 0.01);
    bandolier1.rotation.z = 0.56;
    const bandolier2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.84, 0.49), matteBlackMat);
    bandolier2.position.set(0, 0.42, 0.01);
    bandolier2.rotation.z = -0.56;
    rigGroup.add(bandolier1, bandolier2);

    // 6 Cartuchos 3D de Escopeta Calibre 12 atravessados no peito
    for (let i = 0; i < 6; i++) {
      const t = (i - 2.5) * 0.105;
      const shellGroup = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.075, 8), redShellMat);
      const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 8), brassMat);
      brass.position.y = -0.042;
      shellGroup.add(hull, brass);
      shellGroup.position.set(-t * 0.85, 0.43 + t, 0.268);
      shellGroup.rotation.z = -0.95;
      rigGroup.add(shellGroup);
    }

    // 3 Granadas 3D de 40mm Douradas/Prateadas no outro lado da bandoleira
    for (let i = 0; i < 3; i++) {
      const grenGroup = new THREE.Group();
      const gBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.065, 10), chromeSilverMat);
      const gTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), brassMat);
      gTip.position.y = 0.032;
      grenGroup.add(gBody, gTip);
      grenGroup.position.set(-0.2 + i * 0.08, 0.62 - i * 0.09, 0.265);
      grenGroup.rotation.z = 0.65;
      rigGroup.add(grenGroup);
    }

    // 5. OMBREIRAS DE COURO COM TACHAS PRATEADAS & BRAÇADEIRAS TÁTICAS NOS DOIS BRAÇOS
    for (const [armPivot, forearmGroup, side] of [
      [this.leftArmPivot, this.leftHandGroup, 1],
      [this.rightArmPivot, this.rightHandGroup, -1]
    ]) {
      const epaulette = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.34), leatherMat);
      epaulette.position.set(side * 0.04, 0.06, 0);
      epaulette.rotation.z = -side * 0.16;
      armPivot.add(epaulette);

      for (const sz of [-0.1, 0, 0.1]) {
        const stud = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.045, 6), chromeSilverMat);
        stud.position.set(side * 0.06, 0.12, sz);
        armPivot.add(stud);
      }

      if (forearmGroup) {
        const bracer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.25), matteBlackMat);
        bracer.position.set(0, -0.15, 0);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.26), chromeSilverMat);
        buckle.position.set(0, -0.15, 0);
        forearmGroup.add(bracer, buckle);
      }
    }

    // 6. CINTO TÁTICO BRANCO/PRATA CLÁSSICO DO JUSTICEIRO + COLDRES DE COXA + JOELHEIRAS METÁLICAS
    const beltStrap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.5), matteBlackMat);
    beltStrap.position.set(0, 0.07, 0);
    this.hipGroup.add(beltStrap);

    const centerBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.06), skullWhiteMat);
    centerBuckle.position.set(0, 0.07, 0.25);
    this.hipGroup.add(centerBuckle);

    // Pouches brancos/prateados ao redor da cintura
    for (const [px, pz, rotY] of [
      [-0.24, 0.24, 0],
      [0.24, 0.24, 0],
      [-0.43, 0, Math.PI / 2],
      [0.43, 0, Math.PI / 2],
      [-0.22, -0.24, 0],
      [0.22, -0.24, 0]
    ]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), skullWhiteMat);
      pouch.position.set(px, 0.07, pz);
      pouch.rotation.y = rotY;
      this.hipGroup.add(pouch);
    }

    for (const [legPivot, side] of [
      [this.leftLegPivot, 1],
      [this.rightLegPivot, -1]
    ]) {
      // Coldre Tático 3D na Coxa + Pistola .50 Guardada (visível quando usa Escopeta ou Bazuca)
      const thighStrap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.44), matteBlackMat);
      thighStrap.position.set(0, -0.22, 0);
      const holsterBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.2), leatherMat);
      holsterBox.position.set(side * 0.21, -0.22, 0.02);

      const holsteredGun = new THREE.Group();
      const hgSlide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), chromeSilverMat);
      hgSlide.position.set(side * 0.22, -0.16, 0.02);
      const hgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.1, 0.16), matteBlackMat);
      hgGrip.position.set(side * 0.22, -0.05, -0.03);
      holsteredGun.add(hgSlide, hgGrip);
      this.vingadorHolsteredPistols.push(holsteredGun);

      // Joelheira Metálica Blindada + Bota Pesada de Assalto
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.08), chromeSilverMat);
      kneePad.position.set(0, -0.38, 0.22);
      const bootCuff = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.45), matteBlackMat);
      bootCuff.position.set(0, -0.58, 0.02);

      legPivot.add(thighStrap, holsterBox, holsteredGun, kneePad, bootCuff);
    }

    // 7. ARSENAL GUARDADO VISÍVEL NAS COSTAS (Escopeta "Juiz Final" e Bazuca "Aniquiladora" cruzadas em X!)
    const backShotgun = new THREE.Group();
    const bSgBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.56), matteBlackMat);
    const bSgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.65, 10), chromeSilverMat);
    bSgBarrel.rotation.x = Math.PI / 2;
    bSgBarrel.position.set(0, 0.04, 0.45);
    const bSgDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 14), matteBlackMat);
    bSgDrum.rotation.x = Math.PI / 2;
    bSgDrum.position.set(0, -0.12, 0.12);
    const bSgDrumRim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.15, 12), redShellMat);
    bSgDrumRim.rotation.x = Math.PI / 2;
    bSgDrumRim.position.set(0, -0.12, 0.12);
    backShotgun.add(bSgBody, bSgBarrel, bSgDrum, bSgDrumRim);
    backShotgun.position.set(-0.06, 0.44, -0.33);
    backShotgun.rotation.set(0.15, Math.PI / 2, 0.68);
    rigGroup.add(backShotgun);
    this.vingadorBackShotgun = backShotgun;

    const backRpg = new THREE.Group();
    const bRpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 1.08, 12), oliveMat);
    bRpgTube.rotation.x = Math.PI / 2;
    const bRpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.085, 0.22, 12), matteBlackMat);
    bRpgBell.rotation.x = Math.PI / 2;
    bRpgBell.position.set(0, 0, -0.58);
    const bRpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 12), redShellMat);
    bRpgWarhead.rotation.x = Math.PI / 2;
    bRpgWarhead.position.set(0, 0, 0.66);
    backRpg.add(bRpgTube, bRpgBell, bRpgWarhead);
    backRpg.position.set(0.06, 0.46, -0.42);
    backRpg.rotation.set(-0.15, Math.PI / 2, -0.68);
    rigGroup.add(backRpg);
    this.vingadorBackRpg = backRpg;

    this.upperBodyGroup.add(rigGroup);
  }

  /**
   * Constrói o Arsenal Triplo Remodelado 3D do Vingador de Chumbo (#4 — O Justiceiro):
   * 1) "CASTIGADORAS GÊMEAS" — Duas Desert Eagles / Auto-Magnums Calibre .50 em Aço Cromado & Preto com Mira Laser e Caveira
   * 2) ESCOPETA DE TAMBOR "JUIZ FINAL" (Estilo AA-12 / SPAS-12 com Tambor Gigante, Escudo Térmico, Cartuchos e Baioneta Serrilhada)
   * 3) BAZUCA PESADA "ANIQUILADORA" (Tubo Militar Verde-Oliva/Preto com Ogiva Vermelha/Preta Aparente, Visor Óptico e Mira Laser)
   */
  _attachVingadorArsenal(leftHandGroup, rightHandGroup) {
    const gunMetal = getLegoMaterial(0x1e293b, { roughness: 0.22, metalness: 0.58 });
    const matteBlack = getLegoMaterial(0x111318, { roughness: 0.3, clearcoat: 0.25 });
    const chromeSilver = getLegoMaterial(0xd8dde6, { roughness: 0.14, metalness: 0.82, clearcoat: 0.65 });
    const skullWhite = getLegoMaterial(0xf8fafc, { roughness: 0.2 });
    const redShellMat = getLegoMaterial(0xdc2626, { roughness: 0.22 });
    const brassMat = getLegoMaterial(0xfacc15, { roughness: 0.18, metalness: 0.7 });
    const oliveMat = getLegoMaterial(0x365314, { roughness: 0.32 });
    const redLaserMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 2.5,
      roughness: 0.1
    });
    const scopeGreenMat = getLegoMaterial(0x22c55e, {
      emissive: 0x16a34a,
      emissiveIntensity: 2.0
    });
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 2.6,
      transparent: true,
      opacity: 0.94
    });

    // =========================================================================
    // 1. ARMA 1: "CASTIGADORAS GÊMEAS" (DUAS DESERT EAGLES / AUTO-MAGNUMS .50)
    // =========================================================================
    const buildPunisherMagnum = (isLeft) => {
      const gun = new THREE.Group();

      // Frame inferior em Preto Fosco + Cabo ergonômico com Emblema da Caveira Branca
      const lowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.11, 0.56), matteBlack);
      lowerFrame.position.set(0, -0.02, 0.24);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.15), matteBlack);
      grip.position.set(0, -0.15, 0.02);
      grip.rotation.x = -0.22;

      // Carregador estendido calibre .50 saindo da base do punho
      const extMag = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.22, 0.11), gunMetal);
      extMag.position.set(0, -0.28, 0.06);
      extMag.rotation.x = -0.22;
      const magBumper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.14), chromeSilver);
      magBumper.position.set(0, -0.38, 0.08);

      // Emblema da Caveira Branca nas laterais do cabo
      const skullGripDecal = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.11, 0.09), skullWhite);
      skullGripDecal.position.set(0, -0.13, 0.02);
      skullGripDecal.rotation.x = -0.22;

      // Ferrolho Triangular Pesado (Slide da Desert Eagle .50) em Aço Prata Cromado
      const heavySlide = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.145, 0.62), chromeSilver);
      heavySlide.position.set(0, 0.075, 0.27);
      heavySlide.castShadow = true;

      // Ranhuras de ventilação laterais e trilho superior Picatinny no cano cromado
      for (const vz of [0.18, 0.28, 0.38, 0.48]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.045, 0.04), matteBlack);
        vent.position.set(0, 0.085, vz);
        gun.add(vent);
      }
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.032, 0.54), matteBlack);
      topRail.position.set(0, 0.155, 0.26);

      // Compensador de Freio de Boca Gigante na ponta (Muzzle Brake Calibre .50)
      const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.16, 0.16), matteBlack);
      muzzleBrake.position.set(0, 0.07, 0.64);
      const boreHole = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.18, 12), chromeSilver);
      boreHole.rotation.x = Math.PI / 2;
      boreHole.position.set(0, 0.075, 0.65);

      // Módulo de Mira Laser Vermelha 3D embaixo do cano + Feixe Laser Curto
      const laserPod = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.075, 0.22), matteBlack);
      laserPod.position.set(0, -0.08, 0.42);
      const laserLens = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10), redLaserMat);
      laserLens.rotation.x = Math.PI / 2;
      laserLens.position.set(0, -0.08, 0.54);
      const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.55, 6), redLaserMat);
      laserBeam.rotation.x = Math.PI / 2;
      laserBeam.position.set(0, -0.08, 0.82);

      gun.add(
        lowerFrame,
        grip,
        extMag,
        magBumper,
        skullGripDecal,
        heavySlide,
        topRail,
        muzzleBrake,
        boreHole,
        laserPod,
        laserLens,
        laserBeam
      );

      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), flashMat);
      flash.scale.set(0.95, 0.95, 2.4);
      flash.position.set(0, 0.075, 0.82);
      flash.visible = false;
      gun.add(flash);
      if (isLeft) this.leftMuzzleFlashMesh = flash;
      else this.muzzleFlashMesh = flash;

      gun.position.set(0, -0.34, 0.1);
      gun.rotation.x = Math.PI / 2 - 0.15;
      return gun;
    };

    this.dualSmgLeft = buildPunisherMagnum(true);
    this.dualSmgRight = buildPunisherMagnum(false);
    leftHandGroup.add(this.dualSmgLeft);
    rightHandGroup.add(this.dualSmgRight);

    // =========================================================================
    // 2. ARMA 2: ESCOPETA AUTOMÁTICA DE TAMBOR "JUIZ FINAL" (AA-12 / SPAS-12)
    // =========================================================================
    const shotgun = new THREE.Group();

    // Receiver robusto preto/prata com trilho tático superior
    const sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.64), matteBlack);
    sgReceiver.position.set(0, 0.02, 0.24);
    const sgSidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.42), chromeSilver);
    sgSidePlate.position.set(0, 0.03, 0.22);

    // Tambor Cilíndrico Gigante (Drum Magazine de 20 Cartuchos) embaixo do receiver!
    const drumGroup = new THREE.Group();
    drumGroup.position.set(0, -0.2, 0.32);
    const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.2, 18), matteBlack);
    drumBody.rotation.x = Math.PI / 2;
    const drumFace = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.21, 16), chromeSilver);
    drumFace.rotation.x = Math.PI / 2;
    const drumCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), redShellMat);
    drumCenter.rotation.x = Math.PI / 2;
    drumGroup.add(drumBody, drumFace, drumCenter);
    shotgun.add(drumGroup);

    // Cano Duplo / Largo + Escudo Térmico Perfurado (Perforated Heat Shield)
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.82, 14), chromeSilver);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, 0.08, 0.72);
    const sgGasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.68, 12), gunMetal);
    sgGasTube.rotation.x = Math.PI / 2;
    sgGasTube.position.set(0, -0.01, 0.66);
    const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.11, 0.56), matteBlack);
    heatShield.position.set(0, 0.1, 0.68);
    const sgMuzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.072, 0.16, 12), matteBlack);
    sgMuzzleBrake.rotation.x = Math.PI / 2;
    sgMuzzleBrake.position.set(0, 0.08, 1.14);

    // 4 Cartuchos Vermelhos/Dourados presos no Side-Saddle lateral
    for (let i = 0; i < 4; i++) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), redShellMat);
      shell.position.set(0.095, 0.03, 0.1 + i * 0.08);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.025, 8), brassMat);
      rim.position.set(0.095, -0.02, 0.1 + i * 0.08);
      shotgun.add(shell, rim);
    }

    // Baioneta Serrilhada Prateada embaixo da ponta do cano!
    const bayonetBlade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.38), chromeSilver);
    bayonetBlade.position.set(0, -0.08, 1.08);
    const bayonetTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), chromeSilver);
    bayonetTip.rotation.x = Math.PI / 2;
    bayonetTip.position.set(0, -0.08, 1.34);

    // Coronha tática vazada
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.34), matteBlack);
    sgStock.position.set(0, -0.02, -0.18);

    shotgun.add(
      sgReceiver,
      sgSidePlate,
      sgBarrel,
      sgGasTube,
      heatShield,
      sgMuzzleBrake,
      bayonetBlade,
      bayonetTip,
      sgStock
    );
    shotgun.position.set(0, -0.34, 0.12);
    shotgun.rotation.x = Math.PI / 2 - 0.15;
    rightHandGroup.add(shotgun);
    this.shotgunGroup = shotgun;

    // =========================================================================
    // 3. ARMA 3: BAZUCA PESADA "ANIQUILADORA" (LANÇA-FOGUETES COM ROCKET JUMP)
    // =========================================================================
    const rpg = new THREE.Group();

    // Tubo Militar Pesado Verde-Oliva e Preto Fosco com anéis de reforço
    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 1.32, 16), oliveMat);
    rpgTube.rotation.x = Math.PI / 2;
    rpgTube.position.set(0, 0.08, 0.38);

    for (const rz of [-0.1, 0.25, 0.65, 0.95]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.07, 16), matteBlack);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.08, rz);
      rpg.add(band);
    }

    // Bocal Traseiro de Exaustão Flarejado (Venturi Cone)
    const rpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.105, 0.28, 16), matteBlack);
    rpgBell.rotation.x = Math.PI / 2;
    rpgBell.position.set(0, 0.08, -0.36);

    // Ogiva Cônica Vermelha/Preta Aparente na Frente + Aletas Estabilizadoras
    const warheadBody = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.1, 0.24, 14), matteBlack);
    warheadBody.rotation.x = Math.PI / 2;
    warheadBody.position.set(0, 0.08, 1.12);
    const warheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.38, 14), redShellMat);
    warheadCone.rotation.x = Math.PI / 2;
    warheadCone.position.set(0, 0.08, 1.41);
    const warheadTip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 10), chromeSilver);
    warheadTip.rotation.x = Math.PI / 2;
    warheadTip.position.set(0, 0.08, 1.62);

    // Visor Óptico Iluminado Lateral + Mira Laser Vermelha + Emblema de Caveira Branca
    const opticHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.26), matteBlack);
    opticHousing.position.set(0.15, 0.16, 0.48);
    const opticLens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12), scopeGreenMat);
    opticLens.rotation.x = Math.PI / 2;
    opticLens.position.set(0.15, 0.16, 0.48);
    const rpgLaser = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 10), redLaserMat);
    rpgLaser.rotation.x = Math.PI / 2;
    rpgLaser.position.set(-0.14, 0.12, 0.72);
    const rpgSkullStencil = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.12, 0.16), skullWhite);
    rpgSkullStencil.position.set(0, 0.08, 0.46);

    const rpgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.24, 0.13), matteBlack);
    rpgGrip.position.set(0, -0.1, 0.26);
    const rpgForegrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.11), matteBlack);
    rpgForegrip.position.set(0, -0.09, 0.68);

    rpg.add(
      rpgTube,
      rpgBell,
      warheadBody,
      warheadCone,
      warheadTip,
      opticHousing,
      opticLens,
      rpgLaser,
      rpgSkullStencil,
      rpgGrip,
      rpgForegrip
    );
    rpg.position.set(0, -0.34, 0.12);
    rpg.rotation.x = Math.PI / 2 - 0.15;
    rightHandGroup.add(rpg);
    this.rpgGroup = rpg;

    this.setVingadorWeapon(this.vingadorWeapon || 'dual_smg');
  }

  /**
   * Alterna a arma ativa do Vingador de Chumbo ('dual_smg' | 'shotgun' | 'rpg')
   * e atualiza automaticamente o Arsenal 3D Guardado nas Costas e nos Coldres!
   */
  setVingadorWeapon(weaponKey) {
    this.vingadorWeapon = weaponKey;
    if (this.dualSmgLeft) this.dualSmgLeft.visible = weaponKey === 'dual_smg';
    if (this.dualSmgRight) this.dualSmgRight.visible = weaponKey === 'dual_smg';
    if (this.shotgunGroup) this.shotgunGroup.visible = weaponKey === 'shotgun';
    if (this.rpgGroup) this.rpgGroup.visible = weaponKey === 'rpg';

    // Mostra nas costas exatamente as armas que NÃO estão na mão no momento!
    if (this.vingadorBackShotgun) {
      this.vingadorBackShotgun.visible = weaponKey !== 'shotgun';
    }
    if (this.vingadorBackRpg) {
      this.vingadorBackRpg.visible = weaponKey !== 'rpg';
    }
    if (this.vingadorHolsteredPistols && this.vingadorHolsteredPistols.length > 0) {
      for (const hp of this.vingadorHolsteredPistols) {
        hp.visible = weaponKey !== 'dual_smg';
      }
    }
    return this.vingadorWeapon;
  }

  /**
   * Ativa/desativa o brilho incandescente nos olhos da Caveira do Peito durante o "Furor do Justiceiro" [Q]
   */
  setVingadorFurorVisual(isActive) {
    this.vingadorFurorActive = Boolean(isActive);
    if (this.vingadorSkullEyes && this.vingadorSkullEyes.length > 0) {
      for (const eye of this.vingadorSkullEyes) {
        if (eye.material) {
          eye.material.color.setHex(isActive ? 0xff1e42 : 0xffffff);
          eye.material.emissive.setHex(isActive ? 0xef4444 : 0xf8fafc);
          eye.material.emissiveIntensity = isActive ? 3.2 : 1.4;
        }
      }
    }
  }

  /**
   * Aplica coice alternado nos braços esquerdo/direito ao disparar as "Castigadoras Gêmeas" (.50)
   */
  triggerVingadorDualRecoil() {
    this.shootTimer = 0.14;
    this.muzzleFlashTimer = 0.05;
    this.vingadorDualRecoilSide = -this.vingadorDualRecoilSide;
    return this.vingadorDualRecoilSide;
  }

  /**
   * Equipa as Duas Katanas Longas Místicas ("Muramasa da Lua de Sangue") do Sombra Escarlate (#5):
   * - Lâmina Larga e Longa (1.42m x 0.16m) com Dorso Obsidiana + Fio de Plasma Escarlate + Ponta Kissaki
   * - Guarda Tsuba Ornamental Dourada/Preta + Cabo Tsuka Longo Trançado com Pomo Dourado
   * - Aura de Chamas Espirituais Escarlates/Negras nas lâminas + 2 Bainhas Saya Cruzadas nas Costas
   */
  _attachDualKatanas(leftHandGroup, rightHandGroup) {
    const obsidianMat = getLegoMaterial(0x090a0d, { roughness: 0.22, metalness: 0.55, clearcoat: 0.6 });
    const darkRedMat = getLegoMaterial(0x991b1b, { roughness: 0.25 });
    const crimsonWrapMat = getLegoMaterial(0xdc2626, { roughness: 0.22 });
    const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.68, roughness: 0.16 });
    const bladeEdgeMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 2.35,
      roughness: 0.08,
      clearcoat: 0.85
    });
    const whiteRoseCoreMat = getLegoMaterial(0xfecaca, {
      emissive: 0xffffff,
      emissiveIntensity: 2.1,
      roughness: 0.06
    });
    const shadowFlameMat = getLegoMaterial(0x18181b, {
      emissive: 0x991b1b,
      emissiveIntensity: 0.85
    });

    const buildKatana = (sideSign) => {
      const katana = new THREE.Group();

      // 1. Cabo Longo Trançado (Tsuka — 0.42m) em Preto Obsidiana com Losangos Escarlates (Tsuka-ito) + Pomo Dourado
      const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.42, 12), obsidianMat);
      tsuka.rotation.x = Math.PI / 2;
      tsuka.position.set(0, 0, -0.08);
      katana.add(tsuka);

      for (let w = 0; w < 5; w++) {
        const wrapRing = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.036), crimsonWrapMat);
        wrapRing.position.set(0, 0, -0.23 + w * 0.075);
        wrapRing.rotation.z = Math.PI / 4;
        katana.add(wrapRing);
      }

      const kashiraPommel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.05, 12), goldMat);
      kashiraPommel.rotation.x = Math.PI / 2;
      kashiraPommel.position.set(0, 0, -0.30);
      katana.add(kashiraPommel);

      // 2. Guarda Ornamental Dourada & Obsidiana (Tsuba) + Colarinho da Lâmina (Habaki)
      const tsubaOuter = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.042), goldMat);
      tsubaOuter.position.set(0, 0, 0.14);
      tsubaOuter.rotation.z = Math.PI / 4;
      const tsubaInner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.048), obsidianMat);
      tsubaInner.position.set(0, 0, 0.14);
      const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.15, 0.09), goldMat);
      habaki.position.set(0, 0.005, 0.19);
      katana.add(tsubaOuter, tsubaInner, habaki);

      // 3. Lâmina Larga e Longa (1.42m comprimento x 0.16m largura total):
      // Dorso Traseiro (Mune) em Aço Negro Obsidiana
      const bladeSpine = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.092, 1.38), obsidianMat);
      bladeSpine.position.set(0, -0.028, 0.88);
      bladeSpine.castShadow = true;
      katana.add(bladeSpine);

      // Fio de Corte Largo Chanfrado (Ha) em Plasma Escarlate Incandescente
      const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 1.42), bladeEdgeMat);
      bladeEdge.position.set(0, 0.032, 0.90);
      bladeEdge.castShadow = true;
      katana.add(bladeEdge);

      // Linha de têmpera espiritual (Hamon) Branco-Rosada Incandescente entre o dorso e o fio
      const hamonLine = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, 1.38), whiteRoseCoreMat);
      hamonLine.position.set(0, 0.004, 0.89);
      katana.add(hamonLine);

      // Ponta Angular de Katana (Kissaki) na extremidade
      const kissakiTip = new THREE.Mesh(new THREE.ConeGeometry(0.088, 0.26, 4), bladeEdgeMat);
      kissakiTip.rotation.x = Math.PI / 2;
      kissakiTip.rotation.z = Math.PI / 4;
      kissakiTip.scale.set(0.38, 1.0, 1.0);
      kissakiTip.position.set(0, 0.008, 1.68);
      katana.add(kissakiTip);

      // 4. Aura Mística de Chamas Espirituais Escarlates e Negras deslizando pela lâmina
      for (let f = 0; f < 4; f++) {
        const auraCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.048, 0.22, 4),
          f % 2 === 0 ? bladeEdgeMat : shadowFlameMat
        );
        const baseZ = 0.36 + f * 0.32;
        auraCone.position.set(sideSign * 0.02, 0.055, baseZ);
        auraCone.rotation.x = -Math.PI * 0.35;
        katana.add(auraCone);
        this.katanaAuraFlames.push({
          mesh: auraCone,
          baseZ,
          phase: f * 1.3 + (sideSign > 0 ? 0 : 0.8)
        });
      }

      katana.position.set(0, -0.34, 0.08);
      katana.rotation.x = Math.PI / 2 - 0.16;
      return katana;
    };

    this.leftKatanaGroup = buildKatana(1);
    this.rightKatanaGroup = buildKatana(-1);
    leftHandGroup.add(this.leftKatanaGroup);
    rightHandGroup.add(this.rightKatanaGroup);

    // 2 Bainhas Cruzadas em X nas Costas (Saya) em Laca Preta com Anéis Dourados e Escarlates
    for (const sign of [-1, 1]) {
      const sayaGroup = new THREE.Group();
      const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.24, 0.12), obsidianMat);
      scabbard.castShadow = true;
      sayaGroup.add(scabbard);

      for (const ringY of [-0.42, 0.0, 0.42]) {
        const ring = new THREE.Mesh(
          new THREE.BoxGeometry(0.088, 0.055, 0.132),
          ringY === 0 ? goldMat : crimsonWrapMat
        );
        ring.position.set(0, ringY, 0);
        sayaGroup.add(ring);
      }

      const kojiriTip = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.09, 0.126), goldMat);
      kojiriTip.position.set(0, -0.62, 0);
      sayaGroup.add(kojiriTip);

      sayaGroup.position.set(0, 0.42, -0.28);
      sayaGroup.rotation.z = sign * 0.56;
      this.upperBodyGroup.add(sayaGroup);
    }
  }

  /**
   * Equipa a Armadura Cyber-Shinobi Mística 3D Completa & Cachecol Longo Esvoaçante do Sombra Escarlate (#5):
   * - Cachecol Ninja Longo de Duas Caudas Esfarrapadas (4 segmentos articulados que ondulam no vento)
   * - Ombreiras Ninja Segmentadas 3D (Shinobi Pauldrons) em Preto Obsidiana e Vermelho-Sangue
   * - Peitoral Furtivo 3D (Shinobi Chest Rig) com Amuleto Espiritual Escarlate Pulsante e 3 Kunais 3D
   * - Braçadeiras Tekko-Kagi com Lâminas Serrilhadas nos Antebraços
   * - Cinturão Obi Escarlate com 2 Bombas de Fumaça Esféricas, Shurikens 3D, Coldres de Coxa e Caneleiras Suneate
   */
  _attachSombraShinobiRig() {
    const obsidianMat = getLegoMaterial(0x090a0d, { roughness: 0.24, metalness: 0.45, clearcoat: 0.5 });
    const darkGraphiteMat = getLegoMaterial(0x18181b, { roughness: 0.28, metalness: 0.4 });
    const silverMat = getLegoMaterial(0xe2e8f0, { roughness: 0.18, metalness: 0.7 });
    const bloodRedMat = getLegoMaterial(0x991b1b, { roughness: 0.26, clearcoat: 0.4 });
    const crimsonMat = getLegoMaterial(0xdc2626, { roughness: 0.22, clearcoat: 0.5 });
    const scarletGlowMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 2.2,
      roughness: 0.1
    });
    const whiteCoreMat = getLegoMaterial(0xfecaca, {
      emissive: 0xffffff,
      emissiveIntensity: 2.0
    });

    // =========================================================================
    // 1. CACHECOL NINJA LONGO DE DUAS CAUDAS ESFARRAPADAS (FLOWING SHINOBI SCARF)
    // =========================================================================
    const scarfCollarGroup = new THREE.Group();
    const neckWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.43, 0.16, 24), crimsonMat);
    neckWrap.position.set(0, 0.73, 0.01);
    const neckWrapLower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.11, 24), bloodRedMat);
    neckWrapLower.position.set(0, 0.65, -0.02);
    scarfCollarGroup.add(neckWrap, neckWrapLower);

    // Duas caudas longas articuladas em 4 segmentos descendo pelas costas e ondulando no vento
    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.18, 0.68, -0.31);
      tailPivot.rotation.z = side * 0.14;

      const segGroup = new THREE.Group();
      for (let s = 0; s < 4; s++) {
        const segW = 0.22 - s * 0.025;
        const segH = 0.26;
        const segMat = s % 2 === 0 ? crimsonMat : bloodRedMat;
        const segMesh = new THREE.Mesh(new THREE.BoxGeometry(segW, segH, 0.036), segMat);
        segMesh.position.set(0, -0.13 - s * 0.23, -s * 0.03);
        segMesh.rotation.x = 0.08 * s;
        segMesh.castShadow = true;
        segGroup.add(segMesh);

        // Friso energético escarlate nas bordas do cachecol
        const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(segW + 0.015, 0.03, 0.04), scarletGlowMat);
        edgeTrim.position.set(0, -0.24 - s * 0.23, -s * 0.03);
        segGroup.add(edgeTrim);
      }

      // Ponta esfarrapada em V na extremidade do cachecol
      const raggedTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 4), scarletGlowMat);
      raggedTip.position.set(0, -1.08, -0.12);
      raggedTip.rotation.x = Math.PI;
      raggedTip.scale.set(1.1, 1.0, 0.35);
      segGroup.add(raggedTip);

      tailPivot.add(segGroup);
      scarfCollarGroup.add(tailPivot);

      this.sombraScarfStrips.push({
        pivot: tailPivot,
        tipCone: raggedTip,
        baseRotZ: side * 0.14,
        phase: side > 0 ? 0.0 : 1.65
      });
    }
    this.upperBodyGroup.add(scarfCollarGroup);

    // =========================================================================
    // 2. PEITORAL FURTIVO 3D (SHINOBI CHEST RIG) + AMULETO + 3 KUNAIS 3D
    // =========================================================================
    const chestRig = new THREE.Group();

    const chestPlateMain = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.06), obsidianMat);
    chestPlateMain.position.set(0, 0.42, 0.22);
    chestRig.add(chestPlateMain);

    // Correias blindadas cruzadas em X no peito
    for (const sign of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.68, 0.075), bloodRedMat);
      strap.position.set(0, 0.42, 0.23);
      strap.rotation.z = sign * 0.52;
      chestRig.add(strap);
    }

    // Amuleto / Núcleo Espiritual Escarlate Pulsante no centro do peito
    const amuletFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.085), obsidianMat);
    amuletFrame.position.set(0, 0.44, 0.24);
    amuletFrame.rotation.z = Math.PI / 4;
    const amuletCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.095), scarletGlowMat);
    amuletCore.position.set(0, 0.44, 0.245);
    amuletCore.rotation.z = Math.PI / 4;
    const amuletDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), whiteCoreMat);
    amuletDot.position.set(0, 0.44, 0.295);
    chestRig.add(amuletFrame, amuletCore, amuletDot);

    // 3 Kunais / Adagas Ninja 3D presas diagonalmente no peito
    for (let k = -1; k <= 1; k++) {
      const kunaiGrp = new THREE.Group();
      const kBlade = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 4), silverMat);
      kBlade.position.set(0, 0.07, 0);
      const kHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), crimsonMat);
      kHandle.position.set(0, -0.02, 0);
      const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12), silverMat);
      kRing.position.set(0, -0.065, 0);
      kunaiGrp.add(kBlade, kHandle, kRing);
      kunaiGrp.position.set(-0.22 + k * 0.085, 0.54 - k * 0.04, 0.265);
      kunaiGrp.rotation.z = -0.45;
      chestRig.add(kunaiGrp);
    }

    this.upperBodyGroup.add(chestRig);

    // =========================================================================
    // 3. OMBREIRAS NINJA SEGMENTADAS 3D (SHINOBI PAULDRONS)
    // =========================================================================
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldronGrp = new THREE.Group();

      const upperPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.38), obsidianMat);
      upperPlate.position.set(sign * 0.06, 0.04, 0);
      upperPlate.rotation.z = -sign * 0.24;

      const lowerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.36), darkGraphiteMat);
      lowerPlate.position.set(sign * 0.08, -0.06, 0);
      lowerPlate.rotation.z = -sign * 0.32;

      const crimsonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.04, 0.39), scarletGlowMat);
      crimsonEdge.position.set(sign * 0.065, 0.08, 0);
      crimsonEdge.rotation.z = -sign * 0.24;

      // Aleta afiada de assassino apontando para cima/fora na ombreira
      const bladeFin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 4), crimsonMat);
      bladeFin.position.set(sign * 0.16, 0.13, -0.02);
      bladeFin.rotation.z = -sign * 0.55;

      pauldronGrp.add(upperPlate, lowerPlate, crimsonEdge, bladeFin);
      armPivot.add(pauldronGrp);
    }

    // =========================================================================
    // 4. ANTEBRAÇOS BLINDADOS (TEKKO-KAGI) COM LÂMINAS LATERAIS SERRILHADAS
    // =========================================================================
    for (const [handGrp, sign] of [[this.leftHandGroup, 1], [this.rightHandGroup, -1]]) {
      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.25), obsidianMat);
      gauntlet.position.set(0, -0.12, 0);
      const gauntletStrap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.045, 0.26), crimsonMat);
      gauntletStrap.position.set(0, -0.12, 0);

      // 2 Lâminas laterais serrilhadas (Tekko-Kagi) em cada antebraço
      for (const zOff of [-0.04, 0.04]) {
        const clawFin = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.22, 4), scarletGlowMat);
        clawFin.position.set(sign * 0.14, -0.08, zOff);
        clawFin.rotation.z = -sign * 0.38;
        handGrp.add(clawFin);
      }
      handGrp.add(gauntlet, gauntletStrap);
    }

    // =========================================================================
    // 5. CINTURÃO SHINOBI (OBI), BOMBAS DE FUMAÇA, SHURIKENS 3D & CANELEIRAS SUNEATE
    // =========================================================================
    const beltGrp = new THREE.Group();
    const obiSash = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 0.46), crimsonMat);
    obiSash.position.set(0, 0.08, 0);
    beltGrp.add(obiSash);

    // 2 Bombas de Fumaça Esféricas 3D na frente da cintura
    for (const side of [-1, 1]) {
      const smokeBomb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), darkGraphiteMat);
      smokeBomb.position.set(side * 0.26, 0.08, 0.24);
      const bombRing = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.025, 12), scarletGlowMat);
      bombRing.position.set(side * 0.26, 0.08, 0.24);
      beltGrp.add(smokeBomb, bombRing);
    }

    // 2 Shurikens Prateadas/Vermelhas de 4 Pontas presas nas laterais do cinto
    for (const side of [-1, 1]) {
      const shuriken = new THREE.Group();
      const sStar1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.16), silverMat);
      const sStar2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.16), silverMat);
      sStar2.rotation.x = Math.PI / 4;
      const sCore = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), scarletGlowMat);
      sCore.rotation.z = Math.PI / 2;
      shuriken.add(sStar1, sStar2, sCore);
      shuriken.position.set(side * 0.42, 0.08, 0.04);
      beltGrp.add(shuriken);
    }
    this.hipGroup.add(beltGrp);

    // Protetores de Coxa com Kunais e Caneleiras Ninja Blindadas (Suneate) nas duas pernas
    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const thighHolster = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.44), crimsonMat);
      thighHolster.position.set(0, -0.22, 0);

      const thighKunai = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), silverMat);
      thighKunai.position.set(sign * 0.19, -0.22, 0.04);
      thighKunai.rotation.x = Math.PI;

      const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.1), obsidianMat);
      kneeGuard.position.set(0, -0.38, 0.2);
      const kneeGem = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.11), scarletGlowMat);
      kneeGem.position.set(0, -0.38, 0.205);

      const suneateShin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.45), obsidianMat);
      suneateShin.position.set(0, -0.54, 0.01);
      const shinTrim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.46), bloodRedMat);
      shinTrim.position.set(0, -0.46, 0.01);

      legPivot.add(thighHolster, thighKunai, kneeGuard, kneeGem, suneateShin, shinTrim);
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
   * Constrói o Fuzil de Assalto Pesado do BOPE (IA2 / PARA-FAL / M4 Tático Preto Fosco e Grafite)
   * com Mira Holográfica Vermelha, Módulo Laser PEQ, Lança-Granadas Sub-Cano (M203) e Supressor Tático
   */
  _attachTacticalRifle(handGroup) {
    const rifle = new THREE.Group();
    const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.34, clearcoat: 0.2 });
    const gunMetal = getLegoMaterial(0x1f2937, { roughness: 0.25, metalness: 0.55 });
    const steelMat = getLegoMaterial(0x475569, { roughness: 0.22, metalness: 0.65 });
    const goldAccent = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.18 });
    const redLaserMat = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });

    // 1. Corpo receptor pesado (Upper & Lower Receiver) em preto fosco e aço grafite
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.62), matteBlack);
    receiver.position.set(0, 0.01, 0.22);
    receiver.castShadow = true;
    rifle.add(receiver);

    const upperRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.88), gunMetal);
    upperRail.position.set(0, 0.12, 0.36);
    rifle.add(upperRail);

    const bopeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.136, 0.03, 0.36), goldAccent);
    bopeTrim.position.set(0, 0.05, 0.18);
    rifle.add(bopeTrim);

    // 2. Guarda-mão longo ventilado com trilhos Picatinny
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.14, 0.44), gunMetal);
    handguard.position.set(0, 0.03, 0.64);
    handguard.castShadow = true;
    rifle.add(handguard);

    // 3. Cano pesado de aço + Supressor/Quebra-Chamas Tático na ponta
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.62, 12), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.78);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.26, 14), matteBlack);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.04, 1.04);
    const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 14), goldAccent);
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.set(0, 0.04, 0.94);
    rifle.add(barrel, suppressor, muzzleRing);

    // 4. Lança-Granadas Tático acoplado sob o cano (Underbarrel M203 — dispara as bombas de impulso!)
    const glTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.38, 12), matteBlack);
    glTube.rotation.x = Math.PI / 2;
    glTube.position.set(0, -0.075, 0.66);
    const glGrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.26), gunMetal);
    glGrip.position.set(0, -0.075, 0.64);
    const glMuzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 12), goldAccent);
    glMuzzle.rotation.x = Math.PI / 2;
    glMuzzle.position.set(0, -0.075, 0.85);
    rifle.add(glTube, glGrip, glMuzzle);

    // 5. Carregador curvo estendido de 40 tiros com base dourada
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.32, 0.13), matteBlack);
    mag.position.set(0, -0.2, 0.33);
    mag.rotation.x = 0.24;
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.045, 0.14), goldAccent);
    magBase.position.set(0, -0.35, 0.37);
    magBase.rotation.x = 0.24;
    rifle.add(mag, magBase);

    // 6. Coronha Tática Retrátil (SOPMOD Stock)
    const stockTube = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10), gunMetal);
    stockTube.rotation.x = Math.PI / 2;
    stockTube.position.set(0, 0.02, -0.14);
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.14), matteBlack);
    stockPad.position.set(0, -0.02, -0.24);
    rifle.add(stockTube, stockPad);

    // 7. Mira Holográfica EOTech Vazada com Lente Vermelha Emissiva + Laser Lateral PEQ-15
    const holoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.18), matteBlack);
    holoFrame.position.set(0, 0.18, 0.24);
    const holoLens = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), redLaserMat);
    holoLens.position.set(0, 0.19, 0.28);
    const peqBox = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.16), matteBlack);
    peqBox.position.set(-0.07, 0.06, 0.72);
    const peqLaser = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), redLaserMat);
    peqLaser.position.set(-0.07, 0.06, 0.81);
    rifle.add(holoFrame, holoLens, peqBox, peqLaser);

    // 8. Clarão de disparo (Muzzle Flash) na ponta do supressor
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.92
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.85, 0.85, 2.4);
    this.muzzleFlashMesh.position.set(0, 0.04, 1.24);
    this.muzzleFlashMesh.visible = false;
    rifle.add(this.muzzleFlashMesh);

    rifle.position.set(0, -0.34, 0.12);
    rifle.rotation.x = Math.PI / 2 - 0.15;
    handGroup.add(rifle);
    this.rifleGroup = rifle;
  }

  /**
   * Adiciona esferas de plasma solar incandescente + anéis solares giratórios nas mãos do Solaris
   */
  _attachSolarOrbs(leftHandGroup, rightHandGroup) {
    const coreMat = getLegoMaterial(0xffffff, {
      emissive: 0xfef08a,
      emissiveIntensity: 2.5,
      roughness: 0.08
    });
    const orbMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 1.85,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const ringMat = getLegoMaterial(LEGO_COLORS.gold, {
      emissive: 0xfacc15,
      emissiveIntensity: 1.6,
      metalness: 0.65,
      roughness: 0.15
    });

    for (const hand of [leftHandGroup, rightHandGroup]) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), coreMat);
      core.position.set(0, -0.36, 0.09);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 14), orbMat);
      orb.position.set(0, -0.36, 0.09);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 20), ringMat);
      ring.position.set(0, -0.36, 0.09);
      ring.rotation.x = Math.PI / 3;
      hand.add(core, orb, ring);
    }
  }

  /**
   * Equipa a Armadura Imperial Completa 3D do Solaris ("Rei do Sol" — OP-02):
   * 1) Peitoral Imperial Dourado 3D com Sol Relevado de 8 Raios e Reator Solar Esférico Pulsante
   * 2) Ombreiras de Raios Solares 3D (Sunburst Pauldrons) com Pontas Douradas e Chamas Vivas nos Ombros
   * 3) Braçadeiras Reais Douradas (Vambraces) com Lâminas de Fogo nos Pulsos
   * 4) Cinto Imperial Dourado + Grevas/Botas Douradas com Asas Solares nas Pernas
   * 5) Manto Real de Fogo Vivo 3D nas Costas (Gola Alta Imperial + Halo Solar Dorsal + 5 Caudas de Fogo Animadas)
   */
  _attachSolarisSunKingRig() {
    const royalGold = getLegoMaterial(LEGO_COLORS.gold, {
      emissive: 0xd97706,
      emissiveIntensity: 0.38,
      metalness: 0.68,
      roughness: 0.15,
      clearcoat: 0.65
    });
    const deepCrimson = getLegoMaterial(0x7f1d1d, {
      roughness: 0.22,
      clearcoat: 0.5
    });
    const whitePlasma = getLegoMaterial(0xffffff, {
      emissive: 0xfef08a,
      emissiveIntensity: 2.6,
      roughness: 0.06
    });
    const solarYellow = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.1,
      roughness: 0.1
    });
    const solarOrange = getLegoMaterial(0xf97316, {
      emissive: 0xea580c,
      emissiveIntensity: 1.85,
      roughness: 0.12
    });
    const solarRed = getLegoMaterial(0xef4444, {
      emissive: 0xdc2626,
      emissiveIntensity: 1.65,
      roughness: 0.15
    });

    // =========================================================================
    // 1. PEITORAL IMPERIAL 3D COM SOL RELEVADO DE 8 RAIOS & REATOR SOLAR
    // =========================================================================
    const chestArmor = new THREE.Group();

    // Placa Peitoral Superior Dourada esculpida
    const upperCuirass = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.34, 0.065),
      royalGold
    );
    upperCuirass.position.set(0, 0.52, 0.215);
    upperCuirass.castShadow = true;
    chestArmor.add(upperCuirass);

    // Placa Abdominal Segmentada Carmesim/Ouro
    const lowerCuirass = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.26, 0.055),
      deepCrimson
    );
    lowerCuirass.position.set(0, 0.24, 0.212);
    chestArmor.add(lowerCuirass);

    const abGoldTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.05, 0.062),
      royalGold
    );
    abGoldTrim.position.set(0, 0.33, 0.215);
    chestArmor.add(abGoldTrim);

    // Emblema 3D do Sol de 8 Pontas cravado no centro do peito
    const sunEmblemGroup = new THREE.Group();
    sunEmblemGroup.position.set(0, 0.48, 0.252);

    const sunRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.155, 0.036, 20),
      royalGold
    );
    sunRing.rotation.x = Math.PI / 2;
    sunEmblemGroup.add(sunRing);

    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2;
      const isMainRay = r % 2 === 0;
      const rayLen = isMainRay ? 0.16 : 0.11;
      const rayMesh = new THREE.Mesh(
        new THREE.ConeGeometry(isMainRay ? 0.042 : 0.03, rayLen, 4),
        isMainRay ? royalGold : solarYellow
      );
      rayMesh.position.set(
        Math.cos(angle) * (0.14 + rayLen * 0.32),
        Math.sin(angle) * (0.14 + rayLen * 0.32),
        0.005
      );
      rayMesh.rotation.z = angle - Math.PI / 2;
      sunEmblemGroup.add(rayMesh);
    }

    // Reator Solar Esférico Branco-Ouro Pulsante no coração da armadura
    const reactorSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 16, 16),
      whitePlasma
    );
    reactorSphere.position.set(0, 0, 0.018);
    sunEmblemGroup.add(reactorSphere);

    chestArmor.add(sunEmblemGroup);
    this.upperBodyGroup.add(chestArmor);

    // =========================================================================
    // 2. OMBREIRAS DE RAIOS SOLARES 3D (SUNBURST PAULDRONS) + CHAMAS NOS OMBROS
    // =========================================================================
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldronGroup = new THREE.Group();

      // Base curva da ombreira imperial dourada + camada interna carmesim
      const pauldronMain = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.26, 0.42),
        royalGold
      );
      pauldronMain.position.set(sign * 0.08, 0.02, 0);
      pauldronMain.rotation.z = -sign * 0.18;
      pauldronMain.castShadow = true;

      const pauldronUnder = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.12, 0.44),
        deepCrimson
      );
      pauldronUnder.position.set(sign * 0.07, -0.08, 0);
      pauldronUnder.rotation.z = -sign * 0.15;
      pauldronGroup.add(pauldronMain, pauldronUnder);

      // 3 Espinhos / Raios Solares 3D apontando para cima/fora em cada ombro
      for (let s = -1; s <= 1; s++) {
        const spikeH = s === 0 ? 0.24 : 0.18;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.052, spikeH, 4),
          royalGold
        );
        spike.position.set(sign * (0.19 + (s === 0 ? 0.03 : 0)), 0.14, s * 0.12);
        spike.rotation.z = -sign * 0.62;
        spike.rotation.x = s * 0.28;
        pauldronGroup.add(spike);
      }

      // Chamas 3D vivas subindo das ombreiras
      for (let f = 0; f < 2; f++) {
        const shoulderFlame = new THREE.Mesh(
          new THREE.ConeGeometry(0.068, 0.24, 5),
          f === 0 ? solarOrange : solarYellow
        );
        const baseY = 0.21 + f * 0.04;
        shoulderFlame.position.set(sign * 0.12, baseY, (f - 0.5) * 0.1);
        pauldronGroup.add(shoulderFlame);
        this.crownFlameMeshes.push({
          mesh: shoulderFlame,
          baseY,
          baseScaleY: 1.0,
          phase: sign * 1.5 + f * 1.1,
          speed: 8.5,
          baseRotX: 0,
          baseRotZ: -sign * 0.15
        });
      }

      armPivot.add(pauldronGroup);
    }

    // =========================================================================
    // 3. BRAÇADEIRAS REAIS DOURADAS (VAMBRACES) COM LÂMINAS DE FOGO NOS PULSOS
    // =========================================================================
    for (const [handGrp, sign] of [[this.leftHandGroup, 1], [this.rightHandGroup, -1]]) {
      const vambrace = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.2, 0.27),
        royalGold
      );
      vambrace.position.set(0, -0.12, 0);
      const crimsonBand = new THREE.Mesh(
        new THREE.BoxGeometry(0.268, 0.055, 0.278),
        deepCrimson
      );
      crimsonBand.position.set(0, -0.12, 0);

      // Aleta de chama solar lateral no antebraço
      const flameFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.24, 4),
        solarOrange
      );
      flameFin.position.set(sign * 0.15, -0.06, -0.04);
      flameFin.rotation.z = -sign * 0.35;
      handGrp.add(vambrace, crimsonBand, flameFin);
    }

    // =========================================================================
    // 4. CINTO REAL SOLAR + GREVAS & BOTAS IMPERIAIS DOURADAS NAS PERNAS
    // =========================================================================
    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.13, 0.48),
      royalGold
    );
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16),
      whitePlasma
    );
    beltBuckle.rotation.x = Math.PI / 2;
    beltBuckle.position.set(0, 0.08, 0.235);

    // Kama / Faixas laterais douradas de guerreiro real no quadril
    for (const side of [-1, 1]) {
      const hipTasset = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.28, 0.44),
        royalGold
      );
      hipTasset.position.set(side * 0.41, -0.06, 0);
      hipTasset.rotation.z = -side * 0.14;
      beltGroup.add(hipTasset);
    }
    beltGroup.add(beltBand, beltBuckle);
    this.hipGroup.add(beltGroup);

    // Grevas Douradas (Joelheiras Solares + Botas Imperiais com Asas de Fogo)
    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const kneeSun = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.12),
        royalGold
      );
      kneeSun.position.set(0, -0.36, 0.18);
      const kneeGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06, 0),
        solarYellow
      );
      kneeGem.position.set(0, -0.36, 0.245);

      const greaveBoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.37, 0.22, 0.42),
        royalGold
      );
      greaveBoot.position.set(0, -0.53, 0.01);

      const bootSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.17, 0.55),
        royalGold
      );
      bootSole.position.set(0, -0.64, 0.07);

      const wingFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.22, 4),
        solarOrange
      );
      wingFin.position.set(sign * 0.2, -0.48, -0.05);
      wingFin.rotation.z = -sign * 0.3;

      legPivot.add(kneeSun, kneeGem, greaveBoot, bootSole, wingFin);
    }

    // =========================================================================
    // 5. MANTO REAL DE FOGO VIVO 3D NAS COSTAS (GOLA ALTA + HALO + 5 CAUDAS)
    // =========================================================================
    const mantleGroup = new THREE.Group();
    mantleGroup.position.set(0, 0.68, -0.22);

    // Gola Alta Imperial Dourada e Carmesim atrás da nuca + Ombreira Traseira
    const collarBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.16, 0.14),
      royalGold
    );
    collarBase.position.set(0, 0.02, -0.02);
    mantleGroup.add(collarBase);

    for (let c = -2; c <= 2; c++) {
      const collarFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.065, 0.26 - Math.abs(c) * 0.03, 4),
        c % 2 === 0 ? royalGold : solarOrange
      );
      collarFin.position.set(c * 0.16, 0.18, -0.05);
      collarFin.rotation.x = -0.28;
      collarFin.rotation.z = -c * 0.14;
      mantleGroup.add(collarFin);
    }

    // Halo / Anel Solar Dorsal 3D flutuando atrás dos ombros
    const dorsalHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.032, 10, 28),
      royalGold
    );
    dorsalHalo.position.set(0, -0.12, -0.11);
    mantleGroup.add(dorsalHalo);

    // 5 Fitas / Caudas Articuladas de Fogo Vivo e Ouro descendo pelas costas
    const stripCount = 5;
    for (let i = 0; i < stripCount; i++) {
      const normX = i - 2; // -2, -1, 0, 1, 2
      const stripPivot = new THREE.Group();
      stripPivot.position.set(normX * 0.19, -0.04, -0.04 - Math.abs(normX) * 0.015);
      const baseRotZ = normX * 0.08;
      stripPivot.rotation.z = baseRotZ;
      stripPivot.rotation.x = 0.16;

      const stripLen = 1.24 - Math.abs(normX) * 0.08;
      const stripW = i === 2 ? 0.24 : 0.19;

      // Segmento superior: Carmesim Imperial & Ouro Real
      const topSeg = new THREE.Mesh(
        new THREE.BoxGeometry(stripW, stripLen * 0.36, 0.035),
        i % 2 === 0 ? deepCrimson : royalGold
      );
      topSeg.position.set(0, -stripLen * 0.18, 0);
      topSeg.castShadow = true;

      // Segmento médio: Laranja Magma Emissivo
      const midSeg = new THREE.Mesh(
        new THREE.BoxGeometry(stripW * 0.9, stripLen * 0.38, 0.032),
        i % 2 === 0 ? solarRed : solarOrange
      );
      midSeg.position.set(0, -stripLen * 0.52, -0.01);

      // Ponta inferior em formato de Língua de Fogo Branca/Dourada Incandescente!
      const tipCone = new THREE.Mesh(
        new THREE.ConeGeometry(stripW * 0.52, stripLen * 0.42, 4),
        i === 2 ? whitePlasma : solarYellow
      );
      tipCone.position.set(0, -stripLen * 0.88, -0.015);
      tipCone.rotation.x = Math.PI; // Ponta virada para baixo como língua de chama
      tipCone.rotation.y = Math.PI / 4;

      stripPivot.add(topSeg, midSeg, tipCone);
      mantleGroup.add(stripPivot);

      this.solarMantleStrips.push({
        pivot: stripPivot,
        tipCone,
        phase: i * 0.85,
        baseRotZ,
        normX
      });
    }

    this.solarMantleGroup = mantleGroup;
    this.upperBodyGroup.add(mantleGroup);
  }

  /**
   * Cria 28 partículas 3D de fogo ascendente orbitando o Solaris (Solar) ou Turbo Fantasma (Plasma Ciano)
   */
  _buildSolarAuraParticles(presetKey = 'solaris') {
    const fireColors =
      presetKey === 'turbo'
        ? [0xffffff, 0x67e8f9, 0x00f5d4, 0x06b6d4, 0x0284c7]
        : [0xffffff, 0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
    const boxGeo = new THREE.BoxGeometry(0.13, 0.16, 0.13);
    const coneGeo = new THREE.ConeGeometry(0.085, 0.22, 4);

    for (let i = 0; i < 28; i++) {
      const color = fireColors[i % fireColors.length];
      const mat = getLegoMaterial(color, {
        emissive: color,
        emissiveIntensity: i % 5 === 0 ? 2.2 : 1.55
      });
      const mesh = new THREE.Mesh(i % 2 === 0 ? coneGeo : boxGeo, mat);
      this.visualRoot.add(mesh);
      this.flameParticles.push({
        mesh,
        angle: (i / 28) * Math.PI * 2,
        speed: 2.6 + (i % 4) * 0.85,
        radius: 0.46 + (i % 3) * 0.14,
        yOffset: (i / 28) * 2.1
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

  triggerStomp() {
    this.stompDuration = 0.42;
    this.stompTimer = this.stompDuration;
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
      if (this.solarMantleGroup) this.solarMantleGroup.visible = false;
    } else {
      this.root.scale.setScalar(1.0);
      if (this.isBigFig) {
        this.visualRoot.scale.set(1.78, 1.62, 1.78);
      } else if (this.currentHeroKey === 'sombra') {
        this.visualRoot.scale.set(0.92, 1.07, 0.92);
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
      if (this.solarMantleGroup) this.solarMantleGroup.visible = true;
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
    if (this.currentHeroKey === 'vingador' && this.vingadorWeapon === 'dual_smg') {
      const flashActive = this.muzzleFlashTimer > 0;
      if (this.leftMuzzleFlashMesh) {
        this.leftMuzzleFlashMesh.visible = flashActive && this.vingadorDualRecoilSide < 0;
      }
      if (this.muzzleFlashMesh) {
        this.muzzleFlashMesh.visible = flashActive && this.vingadorDualRecoilSide > 0;
      }
    } else {
      if (this.muzzleFlashMesh) {
        this.muzzleFlashMesh.visible = this.muzzleFlashTimer > 0;
      }
      if (this.leftMuzzleFlashMesh) {
        this.leftMuzzleFlashMesh.visible = this.muzzleFlashTimer > 0;
      }
    }

    if (isGrounded && !this.wasGrounded) {
      this.landingSquash = 1.0;
    }
    this.wasGrounded = isGrounded;
    this.landingSquash = THREE.MathUtils.lerp(this.landingSquash, 0, Math.min(1, dt * 12));

    // Atualiza partículas de fogo do Solaris + Cabelo de Fogo Vivo + Manto Real de Chamas
    if (this.flameParticles.length > 0) {
      for (const fp of this.flameParticles) {
        fp.angle += dt * fp.speed * (isSupersonic ? 2.5 : 1.0);
        const yCycle = ((this.animTime * 1.65 + fp.yOffset) % 2.1);
        fp.mesh.position.set(
          Math.cos(fp.angle) * fp.radius,
          0.2 + yCycle,
          Math.sin(fp.angle) * fp.radius
        );
        fp.mesh.rotation.x += dt * 4.5;
        fp.mesh.rotation.y += dt * 5.5;
        const s = 1.0 - (yCycle / 2.1) * 0.62;
        fp.mesh.scale.setScalar(isSupersonic ? s * 1.55 : s);
      }
    }

    if (this.crownFlameMeshes && this.crownFlameMeshes.length > 0) {
      const fireBoost = isSupersonic ? 1.45 : isFlying || this.isBeaming ? 1.25 : 1.0;
      for (const cf of this.crownFlameMeshes) {
        const wave = Math.sin(this.animTime * cf.speed + cf.phase);
        const wave2 = Math.cos(this.animTime * (cf.speed * 1.3) + cf.phase);
        const scaleY = (0.85 + (wave * 0.5 + 0.5) * 0.45) * fireBoost;
        const scaleXZ = 0.92 + wave2 * 0.14;
        cf.mesh.scale.set(scaleXZ, scaleY, scaleXZ);
        cf.mesh.rotation.x = cf.baseRotX + wave * 0.14;
        cf.mesh.rotation.z = cf.baseRotZ + wave2 * 0.14;
      }
    }

    if (this.solarMantleStrips && this.solarMantleStrips.length > 0) {
      const speedRatio = Math.min(1.5, moveSpeed / Math.max(1, maxRunSpeed));
      const baseLift = isSupersonic
        ? 0.58
        : isFlying
          ? 0.34 + speedRatio * 0.22
          : 0.16 + speedRatio * 0.35;
      const waveFreq = isSupersonic ? 18.0 : isFlying ? 11.0 : 6.5 + speedRatio * 5.0;
      const waveAmp = isSupersonic ? 0.22 : 0.12 + speedRatio * 0.12;
      for (const strip of this.solarMantleStrips) {
        const w = Math.sin(this.animTime * waveFreq + strip.phase);
        const wSide = Math.cos(this.animTime * (waveFreq * 0.75) + strip.phase);
        strip.pivot.rotation.x = baseLift + w * waveAmp;
        strip.pivot.rotation.z = strip.baseRotZ + wSide * 0.08;
        if (strip.tipCone) {
          strip.tipCone.scale.y = 0.85 + (w * 0.5 + 0.5) * 0.45;
        }
      }
    }

    // Ondulação no vento do Cachecol Ninja Longo de 2 Caudas + Aura Mística nas Katanas do Sombra Escarlate
    if (this.sombraScarfStrips && this.sombraScarfStrips.length > 0) {
      const speedRatio = Math.min(1.8, moveSpeed / Math.max(1, maxRunSpeed));
      const baseLift = this.isGrappling
        ? 0.82
        : !isGrounded
          ? 0.55
          : 0.22 + speedRatio * 0.48;
      const waveFreq = 8.0 + speedRatio * 7.5;
      const waveAmp = 0.14 + speedRatio * 0.14;
      for (const sc of this.sombraScarfStrips) {
        const w = Math.sin(this.animTime * waveFreq + sc.phase);
        const wSide = Math.cos(this.animTime * (waveFreq * 0.8) + sc.phase);
        sc.pivot.rotation.x = baseLift + w * waveAmp;
        sc.pivot.rotation.z = sc.baseRotZ + wSide * 0.12;
        if (sc.tipCone) {
          sc.tipCone.scale.y = 0.85 + (w * 0.5 + 0.5) * 0.5;
        }
      }
    }

    if (this.katanaAuraFlames && this.katanaAuraFlames.length > 0) {
      for (const kf of this.katanaAuraFlames) {
        const pulse = 0.8 + Math.sin(this.animTime * 14.0 + kf.phase) * 0.35;
        const slide = Math.sin(this.animTime * 9.0 + kf.phase) * 0.08;
        kf.mesh.scale.set(1.0, pulse, 1.0);
        kf.mesh.position.z = kf.baseZ + slide;
      }
    }

    // Ondulação das Abas Traseiras e Laterais do Sobretudo de Couro Preto do Vingador de Chumbo (O Justiceiro)
    if (this.vingadorCoatTails && this.vingadorCoatTails.length > 0) {
      const speedRatio = Math.min(1.6, moveSpeed / Math.max(1, maxRunSpeed));
      const baseLift = this.isDiveSliding
        ? 0.88
        : !isGrounded
          ? 0.56
          : 0.14 + speedRatio * 0.42;
      const waveFreq = 7.5 + speedRatio * 6.5;
      const waveAmp = 0.08 + speedRatio * 0.12;
      for (const ct of this.vingadorCoatTails) {
        const w = Math.sin(this.animTime * waveFreq + ct.phase);
        ct.pivot.rotation.x = baseLift + w * waveAmp;
        ct.pivot.rotation.z = ct.baseRotZ + ct.side * (speedRatio * 0.09 + Math.abs(w) * 0.06);
      }
    }

    // Chamas Ciano da Caveira, Escapamentos V8 + Giro de Correntes do Turbo Fantasma (OP-06)
    if (this.turboFlameMeshes && this.turboFlameMeshes.length > 0) {
      for (const tf of this.turboFlameMeshes) {
        const w = Math.sin(this.animTime * tf.speed + tf.phase);
        if (tf.isExhaust) {
          tf.mesh.scale.set(0.92 + w * 0.12, 0.8 + (w * 0.5 + 0.5) * 0.65, 0.92 + w * 0.12);
        } else {
          const sx = tf.baseScaleX || 0.95;
          const sz = tf.baseScaleZ || 0.95;
          tf.mesh.scale.set(sx, 0.85 + (w * 0.5 + 0.5) * 0.55, sz);
          tf.mesh.rotation.x = tf.baseRotX + w * 0.18;
          tf.mesh.rotation.z = tf.baseRotZ + Math.cos(this.animTime * tf.speed + tf.phase) * 0.15;
        }
      }
    }
    if (this.turboChainGroups && this.turboChainGroups.length > 0) {
      const spinAmp = this.punchTimer > 0 ? 18.0 : 4.5;
      for (let i = 0; i < this.turboChainGroups.length; i++) {
        this.turboChainGroups[i].rotation.z = Math.sin(this.animTime * spinAmp + i * Math.PI) * 0.35;
      }
    }

    // Pulso de Bobinas Tesla, Coroa de 14 Relâmpagos, Arco Dorsal em Ziguezague e Garra Voltaica do Voltaico (OP-07)
    if (this.voltaicoArcs && this.voltaicoArcs.length > 0) {
      const sparkScale = 0.9 + Math.sin(this.animTime * 28.0) * 0.18;
      for (const arc of this.voltaicoArcs) {
        arc.scale.setScalar(sparkScale);
      }
    }
    if (this.voltaicoCrownSpikes && this.voltaicoCrownSpikes.length > 0) {
      for (const cs of this.voltaicoCrownSpikes) {
        const w = Math.sin(this.animTime * cs.speed + cs.phase);
        cs.mesh.scale.set(0.94, 0.86 + (w * 0.5 + 0.5) * 0.45, 0.94);
        cs.mesh.rotation.x = cs.baseRotX + w * 0.14;
        cs.mesh.rotation.z = cs.baseRotZ + Math.cos(this.animTime * cs.speed + cs.phase) * 0.12;
      }
    }
    if (this.voltaicoBackArcSegments && this.voltaicoBackArcSegments.length > 0) {
      const first = this.voltaicoBackArcSegments[0];
      const n = first.total;
      const tx = first.termX;
      const ty = first.termY;
      const tz = first.termZ;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = -tx + u * (tx * 2);
        if (i === 0 || i === n) {
          pts.push(new THREE.Vector3(x, ty, tz));
        } else {
          const zigSign = i % 2 === 0 ? 1 : -1;
          const jitterY = Math.sin(this.animTime * 34.0 + i * 2.1) * 0.055 + zigSign * 0.065;
          const jitterZ = -0.04 + Math.cos(this.animTime * 29.0 + i * 1.7) * 0.035;
          pts.push(new THREE.Vector3(x, ty + 0.05 + jitterY, tz + jitterZ));
        }
      }
      const upAxis = new THREE.Vector3(0, 1, 0);
      for (let s = 0; s < this.voltaicoBackArcSegments.length; s++) {
        const seg = this.voltaicoBackArcSegments[s].mesh;
        const pA = pts[s];
        const pB = pts[s + 1];
        const dir = new THREE.Vector3().subVectors(pB, pA);
        const len = Math.max(0.001, dir.length());
        seg.position.copy(pA).addScaledVector(dir, 0.5);
        seg.scale.set(1, len, 1);
        seg.quaternion.setFromUnitVectors(upAxis, dir.normalize());
      }
    }
    if (this.voltaicoLeftClawGroup) {
      this.voltaicoLeftClawGroup.rotation.z += dt * (this.punchTimer > 0 ? 18.0 : 6.5);
      const clawPulse = 0.94 + Math.sin(this.animTime * 24.0) * 0.14;
      this.voltaicoLeftClawGroup.scale.setScalar(clawPulse);
    }
    if (this.voltaicoStaffOrb) {
      this.voltaicoStaffOrb.rotation.x += dt * 7.5;
      this.voltaicoStaffOrb.rotation.y += dt * 9.5;
      const orbPulse = 0.92 + Math.sin(this.animTime * 22.0) * 0.22;
      this.voltaicoStaffOrb.scale.setScalar(orbPulse);
    }

    // Ondulação Viva dos 4 Tentáculos Simbiontes de 5 Segmentos + Língua Longa 3D do Vórtex (OP-08)
    if (this.vortexTentacles && this.vortexTentacles.length > 0) {
      const attackBoost = this.punchTimer > 0 ? 2.4 : 1.0;
      for (const t of this.vortexTentacles) {
        const w1 = Math.sin(this.animTime * 4.2 * attackBoost + t.phase);
        const w2 = Math.cos(this.animTime * 3.1 * attackBoost + t.phase);
        t.pivot.rotation.z = t.baseRotZ + w1 * 0.16 * attackBoost;
        t.pivot.rotation.y = t.baseRotY + w2 * 0.22 * attackBoost;
        t.pivot.rotation.x = this.punchTimer > 0 ? 0.65 : w1 * 0.1;

        if (t.segments) {
          for (const seg of t.segments) {
            const segWave = Math.sin(this.animTime * 5.6 * attackBoost + t.phase - seg.segIndex * 0.72);
            const segSide = Math.cos(this.animTime * 4.4 * attackBoost + t.phase - seg.segIndex * 0.65);
            seg.pivot.rotation.x = seg.baseRotX + segWave * 0.22 * attackBoost;
            seg.pivot.rotation.z = seg.baseRotZ + segSide * 0.18 * attackBoost;
          }
        }
      }
    }

    if (this.vortexTongueSegments && this.vortexTongueSegments.length > 0) {
      for (const ts of this.vortexTongueSegments) {
        const tw = Math.sin(this.animTime * 7.5 - ts.index * 0.85);
        const tz = Math.cos(this.animTime * 5.8 - ts.index * 0.75);
        ts.pivot.rotation.x = ts.baseX + tw * 0.18;
        ts.pivot.rotation.z = ts.baseZ + tz * 0.24;
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
        const isSombraRun = this.currentHeroKey === 'sombra' && isRunning;
        const freq = isSombraRun ? 19.5 : isRunning ? 15.5 : 10.5;
        this.walkPhase += dt * freq;

        const legAmp = isSombraRun ? 1.08 : isRunning ? 0.92 : 0.58;
        const armAmp = isRunning ? 0.98 : 0.52;
        const bounceAmp = isRunning ? 0.11 : 0.055;
        const forwardLean = isSombraRun ? 0.46 : isRunning ? 0.16 : 0.05;

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

        if (isSombraRun) {
          // Postura de Corrida Shinobi: braços e Katanas voltados para trás cortando o vento!
          this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
            this.leftArmPivot.rotation.x,
            0.95 + s * 0.12,
            lerpSpeed
          );
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
            this.rightArmPivot.rotation.x,
            0.95 - s * 0.12,
            lerpSpeed
          );
          this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.28, lerpSpeed);
          this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.28, lerpSpeed);
        } else {
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
        }

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
          isSombraRun ? -0.36 : -forwardLean * 0.6,
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
        if (this.currentHeroKey === 'voltaico') {
          // Pose de Planagem Eletromagnética / Levitação do Deus do Trovão (Voltaico no ar!)
          const hoverPulse = Math.sin(this.animTime * 8.5) * 0.08;
          this.visualRoot.position.y = THREE.MathUtils.lerp(this.visualRoot.position.y, 0.14 + hoverPulse, lerpSpeed);
          this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, 0.18, lerpSpeed);
          this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, -0.35, lerpSpeed);
          this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.22, lerpSpeed);
          this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -1.65, lerpSpeed);
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -1.45, lerpSpeed);
          this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.52, lerpSpeed);
          this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.42, lerpSpeed);
          this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.12, lerpSpeed);
        } else {
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
    const shoulderX = this.isBigFig ? 0.62 : 0.49;
    this.leftArmPivot.position.set(shoulderX, 0.66, 0);
    this.rightArmPivot.position.set(-shoulderX, 0.66, 0);
    this.leftArmPivot.rotation.y = 0;
    this.rightArmPivot.rotation.y = 0;
    this.upperBodyGroup.position.z = 0;
    if (this.leftHandGroup && this.rightHandGroup) {
      this.leftHandGroup.rotation.x = -0.22;
      this.rightHandGroup.rotation.x = -0.22;
    }

    // Atualiza Giroflex Policial 3D e Chamas dos Propulsores Dorsais do Titã Blindado (PMESP)
    if (this.titaSirenLights && this.titaSirenLights.length > 0) {
      const sirenCycle = Math.sin(this.animTime * 14.0) > 0;
      for (const s of this.titaSirenLights) {
        const active = s.isRed ? sirenCycle : !sirenCycle;
        s.mesh.scale.setScalar(active ? 1.16 : 0.88);
      }
    }
    if (this.titaDashFlameMeshes && this.titaDashFlameMeshes.length > 0) {
      const showJetFlames =
        this.isDashing ||
        this.titaJumpChargeRatio > 0.05 ||
        (!isGrounded && verticalVelocity > 2.0);
      const flamePulse = 0.85 + Math.sin(this.animTime * 42.0) * 0.35;
      for (const jf of this.titaDashFlameMeshes) {
        jf.visible = showJetFlames;
        if (showJetFlames) {
          const boost = this.isDashing ? 1.45 : 0.8 + this.titaJumpChargeRatio * 0.85;
          jf.scale.set(1.0, flamePulse * boost, 1.0);
        }
      }
    }

    // Pose de Agachamento Hidráulico enquanto segura [Espaço] para carregar o Super-Pulo do Titã!
    if (this.titaJumpChargeRatio > 0.01 && isGrounded) {
      const c = this.titaJumpChargeRatio;
      this.visualRoot.position.y = -c * 0.28;
      this.upperBodyGroup.rotation.x = c * 0.38;
      this.leftLegPivot.rotation.x = -c * 0.65;
      this.rightLegPivot.rotation.x = -c * 0.65;
      this.leftArmPivot.rotation.x = -0.75 - c * 0.45;
      this.rightArmPivot.rotation.x = -0.75 - c * 0.45;
      this.leftArmPivot.rotation.z = 0.28;
      this.rightArmPivot.rotation.z = -0.28;
    }

    // Animação 3D de Pisada Sísmica Pesada [Q] do Titã Blindado (Ergue a perna direita bem alto e esmaga o asfalto!)
    if (this.stompTimer > 0) {
      this.stompTimer = Math.max(0, this.stompTimer - dt);
      const progress = 1.0 - this.stompTimer / this.stompDuration;
      if (progress < 0.44) {
        // Fase 1: Ergue o joelho/bota direita bem alto e abre os braços carregando o impacto
        const u = progress / 0.44;
        const ease = Math.sin(u * Math.PI * 0.5);
        this.upperBodyGroup.rotation.x = -0.24 * ease;
        this.rightLegPivot.rotation.x = -1.48 * ease;
        this.leftLegPivot.rotation.x = 0.18 * ease;
        this.leftArmPivot.rotation.x = -2.15 * ease;
        this.rightArmPivot.rotation.x = -2.15 * ease;
        this.leftArmPivot.rotation.z = 0.36 * ease;
        this.rightArmPivot.rotation.z = -0.36 * ease;
      } else {
        // Fase 2: Crava a Bota Esmagadora no chão com todo o peso do chassi!
        const u = (progress - 0.44) / 0.56;
        const impact = 1.0 - u;
        this.visualRoot.position.y = -0.22 * impact;
        this.upperBodyGroup.rotation.x = 0.34 * impact;
        this.rightLegPivot.rotation.x = 0.15 * impact;
        this.leftLegPivot.rotation.x = -0.22 * impact;
        this.leftArmPivot.rotation.x = -0.85 * impact;
        this.rightArmPivot.rotation.x = -0.85 * impact;
      }
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

    // Pose de Mergulho Tático / Combat Slide [Q] do Vingador de Chumbo (Estilo Max Payne / Justiceiro)!
    if (this.isDiveSliding) {
      this.visualRoot.position.y = isGrounded ? -0.24 : 0.08;
      this.upperBodyGroup.rotation.x = isGrounded ? -0.36 : 0.48;
      this.leftLegPivot.rotation.x = isGrounded ? -1.15 : 0.52;
      this.rightLegPivot.rotation.x = isGrounded ? 0.38 : -0.35;
      this.leftArmPivot.rotation.x = -1.62;
      this.rightArmPivot.rotation.x = -1.62;
      this.leftArmPivot.rotation.z = 0.18;
      this.rightArmPivot.rotation.z = -0.18;
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
      // Curva explosiva de soco / corte de Katana / Espada de Plasma: avança muito rápido e retrai para a guarda
      const t = 1.0 - this.punchTimer / this.punchDuration;
      const thrust = t < 0.32 ? (t / 0.32) : Math.max(0, 1.0 - (t - 0.32) / 0.68);
      const snap = Math.sin(thrust * Math.PI * 0.5);

      this.upperBodyGroup.position.z = 0.14 * snap;
      this.upperBodyGroup.rotation.x = 0.16 * snap;

      if (this.currentHeroKey === 'sombra') {
        // Coreografia de 3 Cortes da Lua de Sangue com as Duas Katanas:
        const slashProgress = Math.min(1, t * 1.45);
        if (this.punchComboStep === 1) {
          // 1º Corte: Fenda Diagonal Direita (+35°)
          this.rightArmPivot.rotation.x = -2.2 + slashProgress * 1.35;
          this.rightArmPivot.rotation.y = -0.65 + slashProgress * 1.35;
          this.rightArmPivot.rotation.z = -0.58;
          this.leftArmPivot.rotation.x = -0.85;
          this.leftArmPivot.rotation.z = 0.35;
          this.upperBodyGroup.rotation.y = 0.68 * snap;
        } else if (this.punchComboStep === 2) {
          // 2º Corte: Fenda Diagonal Esquerda (-35°)
          this.leftArmPivot.rotation.x = -2.2 + slashProgress * 1.35;
          this.leftArmPivot.rotation.y = 0.65 - slashProgress * 1.35;
          this.leftArmPivot.rotation.z = 0.58;
          this.rightArmPivot.rotation.x = -0.85;
          this.rightArmPivot.rotation.z = -0.35;
          this.upperBodyGroup.rotation.y = -0.68 * snap;
        } else {
          // 3º Corte: Corte Duplo Cruzado em X (Lua de Sangue)
          this.leftArmPivot.rotation.x = -2.35 + slashProgress * 1.55;
          this.rightArmPivot.rotation.x = -2.35 + slashProgress * 1.55;
          this.leftArmPivot.rotation.y = 0.75 - slashProgress * 1.45;
          this.rightArmPivot.rotation.y = -0.75 + slashProgress * 1.45;
          this.leftArmPivot.rotation.z = 0.52;
          this.rightArmPivot.rotation.z = -0.52;
          this.upperBodyGroup.rotation.x = 0.34 * snap;
        }
      } else if (this.currentHeroKey === 'turbo') {
        // Coreografia de 3 Golpes da Espada Colossal de Plasma Ciano + Corrente do Turbo Fantasma:
        const slashProgress = Math.min(1, t * 1.42);
        if (this.punchComboStep === 1) {
          // 1º Golpe: Talho Horizontal Amplo da Espada de Plasma (Direita -> Esquerda)
          this.rightArmPivot.rotation.x = -1.62;
          this.rightArmPivot.rotation.y = -1.15 + slashProgress * 2.25;
          this.rightArmPivot.rotation.z = -0.85;
          if (this.rightHandGroup) this.rightHandGroup.rotation.x = 0.35;
          this.leftArmPivot.rotation.x = -1.1;
          this.leftArmPivot.rotation.z = 0.45;
          this.upperBodyGroup.rotation.y = -0.75 + slashProgress * 1.45;
          this.upperBodyGroup.rotation.x = 0.28 * snap;
        } else if (this.punchComboStep === 2) {
          // 2º Golpe: Corte Ascendente Rasgando o Ar + Chicotada de Corrente na Mão Esquerda!
          this.rightArmPivot.rotation.x = -0.55 - slashProgress * 2.15;
          this.rightArmPivot.rotation.y = 0.45 - slashProgress * 0.9;
          this.rightArmPivot.rotation.z = -0.35;
          this.leftArmPivot.rotation.x = -2.1 + slashProgress * 1.25;
          this.leftArmPivot.rotation.y = 0.85 - slashProgress * 1.55;
          this.leftArmPivot.rotation.z = 0.65;
          this.upperBodyGroup.rotation.y = 0.65 - slashProgress * 1.3;
          this.upperBodyGroup.rotation.x = -0.22 * snap;
        } else {
          // 3º Golpe: TORNADO DE PLASMA 360° (Giro completo do corpo com Espada + Corrente abertas!)
          this.visualRoot.rotation.y = slashProgress * Math.PI * 2;
          this.rightArmPivot.rotation.x = -1.58;
          this.rightArmPivot.rotation.z = -1.15;
          this.leftArmPivot.rotation.x = -1.58;
          this.leftArmPivot.rotation.z = 1.15;
          this.upperBodyGroup.rotation.x = 0.32 * snap;
        }
      } else if (this.currentHeroKey === 'vortex') {
        // Coreografia Brutal de 3 Golpes Simbiontes do Vórtex (Garras + Tentáculos Dorsais):
        const slashProgress = Math.min(1, t * 1.4);
        if (this.punchComboStep === 1) {
          // 1º Golpe: Chicotada Dupla de Garras e Tentáculos
          this.leftArmPivot.rotation.x = -2.1 + slashProgress * 1.2;
          this.rightArmPivot.rotation.x = -2.1 + slashProgress * 1.2;
          this.leftArmPivot.rotation.y = 0.9 - slashProgress * 1.7;
          this.rightArmPivot.rotation.y = 0.9 - slashProgress * 1.7;
          this.upperBodyGroup.rotation.y = 0.72 - slashProgress * 1.44;
        } else if (this.punchComboStep === 2) {
          // 2º Golpe: Pinça Predatória Simbionte (Esmaga com os dois braços e tentáculos no centro!)
          this.leftArmPivot.rotation.x = -1.62;
          this.rightArmPivot.rotation.x = -1.62;
          this.leftArmPivot.rotation.y = -0.95 + slashProgress * 1.45;
          this.rightArmPivot.rotation.y = 0.95 - slashProgress * 1.45;
          this.leftArmPivot.rotation.z = 0.65 * (1 - slashProgress);
          this.rightArmPivot.rotation.z = -0.65 * (1 - slashProgress);
          this.upperBodyGroup.rotation.x = 0.42 * snap;
        } else {
          // 3º Golpe: Rugido & Impale Abissal (Abre o peito pro rugido e crava os tentáculos à frente!)
          this.leftArmPivot.rotation.x = -2.65 + slashProgress * 1.85;
          this.rightArmPivot.rotation.x = -2.65 + slashProgress * 1.85;
          this.leftArmPivot.rotation.z = 0.48;
          this.rightArmPivot.rotation.z = -0.48;
          this.upperBodyGroup.rotation.x = -0.35 * (1 - slashProgress) + 0.48 * slashProgress;
        }
      } else if (this.punchComboStep === 1) {
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
    } else if (this.visualRoot.rotation.y !== 0) {
      this.visualRoot.rotation.y = THREE.MathUtils.lerp(this.visualRoot.rotation.y, 0, lerpSpeed);
      if (Math.abs(this.visualRoot.rotation.y) < 0.01) {
        this.visualRoot.rotation.y = 0;
      }
    }

    // Sobreposição de Tiro / Disparo de Armas 3D + Giro Insano dos 6 Canos da Minigun Vulcan!
    if (this.shootTimer > 0) {
      this.shootTimer = Math.max(0, this.shootTimer - dt);
      if (this.titaMinigunBarrelGroup) {
        this.titaMinigunBarrelGroup.rotation.z += 38.0 * dt;
      }
      const recoil = Math.sin((this.shootTimer / 0.16) * Math.PI);

      if (this.currentHeroKey === 'vingador' && this.vingadorWeapon === 'dual_smg') {
        // Coice alternado nos dois braços para as "Castigadoras Gêmeas" (.50)!
        const leftKick = this.vingadorDualRecoilSide < 0 ? recoil * 0.28 : recoil * 0.06;
        const rightKick = this.vingadorDualRecoilSide > 0 ? recoil * 0.28 : recoil * 0.06;
        this.leftArmPivot.rotation.x = -1.52 + leftKick;
        this.leftArmPivot.position.z = -leftKick * 0.65;
        this.leftArmPivot.rotation.z = 0.06;
        if (this.leftHandGroup) this.leftHandGroup.rotation.x = -0.14;

        this.rightArmPivot.rotation.x = -1.52 + rightKick;
        this.rightArmPivot.position.z = -rightKick * 0.65;
        this.rightArmPivot.rotation.z = -0.06;
        if (this.rightHandGroup) this.rightHandGroup.rotation.x = -0.14;
      } else {
        this.rightArmPivot.rotation.x = -1.52 + recoil * 0.18;
        this.rightArmPivot.position.z = -recoil * 0.12;
        this.rightArmPivot.rotation.z = -0.04;
        if (this.rightHandGroup) this.rightHandGroup.rotation.x = -0.15;
      }
    }
  }
}
