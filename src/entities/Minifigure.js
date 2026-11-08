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
    this.crownFlameMeshes = [];
    this.solarMantleStrips = [];
    this.solarMantleGroup = null;
    this.titaMinigunBarrelGroup = null;
    this.titaDashFlameMeshes = [];
    this.titaSirenLights = [];
    this.stompTimer = 0;
    this.titaJumpChargeRatio = 0;
    this.isDashing = false;
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
      this.visualRoot.scale.set(1.78, 1.62, 1.78);
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
   * Cria 28 partículas 3D de fogo solar ascendente orbitando o Solaris
   */
  _buildSolarAuraParticles() {
    const fireColors = [0xffffff, 0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
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

    // Sobreposição de Tiro / Disparo de Armas 3D + Giro Insano dos 6 Canos da Minigun Vulcan!
    if (this.shootTimer > 0) {
      this.shootTimer = Math.max(0, this.shootTimer - dt);
      if (this.titaMinigunBarrelGroup) {
        this.titaMinigunBarrelGroup.rotation.z += 38.0 * dt;
      }
      const recoil = Math.sin((this.shootTimer / 0.16) * Math.PI);
      this.rightArmPivot.rotation.x = -1.52 + recoil * 0.14;
      this.rightArmPivot.position.z = -recoil * 0.1;
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
