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
    this.rifleGroup = null;

    this.setHero(presetKey);
  }

  setHero(presetKey) {
    const preset = MINIFIG_PRESETS[presetKey] || MINIFIG_PRESETS.caveira;
    this.currentHeroKey = preset.key;
    this.buildModel(preset);
    return preset;
  }

  buildModel(preset) {
    while (this.visualRoot.children.length > 0) {
      this.visualRoot.remove(this.visualRoot.children[0]);
    }
    this.flameParticles = [];
    this.muzzleFlashMesh = null;
    this.rifleGroup = null;

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
    }
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

    if (this.muzzleFlashMesh) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      this.muzzleFlashMesh.visible = this.muzzleFlashTimer > 0;
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
    this.leftArmPivot.position.set(0.49, 0.66, 0);
    this.rightArmPivot.position.set(-0.49, 0.66, 0);
    this.leftArmPivot.rotation.y = 0;
    this.rightArmPivot.rotation.y = 0;
    this.upperBodyGroup.position.z = 0;
    if (this.leftHandGroup && this.rightHandGroup) {
      this.leftHandGroup.rotation.x = -0.22;
      this.rightHandGroup.rotation.x = -0.22;
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

    // Sobreposição de Tiro / Disparo de Fuzil ou Bola de Fogo
    if (this.shootTimer > 0) {
      this.shootTimer = Math.max(0, this.shootTimer - dt);
      const recoil = Math.sin((this.shootTimer / 0.16) * Math.PI);
      this.rightArmPivot.rotation.x = -1.52 + recoil * 0.16;
      this.rightArmPivot.position.z = -recoil * 0.12;
      this.rightArmPivot.rotation.z = -0.04;
      if (this.rightHandGroup) this.rightHandGroup.rotation.x = -0.15;
    }
  }
}
