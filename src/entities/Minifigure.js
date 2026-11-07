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

/**
 * Presets visuais de Minifigura para o Passo 1 (trocáveis com a tecla C para teste)
 */
export const MINIFIG_PRESETS = {
  caveira: {
    name: 'Comandante Caveira (BOPE)',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.black,
    armColor: LEGO_COLORS.charcoal,
    handColor: LEGO_COLORS.yellow,
    hipColor: LEGO_COLORS.black,
    legColor: LEGO_COLORS.charcoal,
    facePreset: 'caveira',
    torsoPreset: 'caveira',
    headgear: 'beret',
    capeColor: null
  },
  solaris: {
    name: 'Solaris (Guerreiro Solar)',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.red,
    armColor: LEGO_COLORS.gold,
    handColor: LEGO_COLORS.yellow,
    hipColor: LEGO_COLORS.crimson,
    legColor: LEGO_COLORS.red,
    facePreset: 'solaris',
    torsoPreset: 'solaris',
    headgear: 'visor_crown',
    capeColor: LEGO_COLORS.orange
  },
  classic: {
    name: 'Herói LEGO Clássico (Pino no Topo)',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.blue,
    armColor: LEGO_COLORS.blue,
    handColor: LEGO_COLORS.yellow,
    hipColor: LEGO_COLORS.black,
    legColor: LEGO_COLORS.navy,
    facePreset: 'classic',
    torsoPreset: 'classic',
    headgear: 'none',
    capeColor: null
  }
};

export class Minifigure {
  constructor(presetKey = 'caveira') {
    this.root = new THREE.Group();
    this.visualRoot = new THREE.Group();
    this.root.add(this.visualRoot);

    this.animTime = 0;
    this.walkPhase = 0;
    this.state = 'IDLE'; // IDLE, WALK, RUN, JUMP, FALL
    this.landingSquash = 0;
    this.wasGrounded = true;

    // Timers de animação de ataque (Soco / Tiro)
    this.punchTimer = 0;
    this.punchHand = 1; // Alterna mão esquerda (+1) e direita (-1)
    this.shootTimer = 0;

    this.presetOrder = ['caveira', 'solaris', 'classic'];
    this.currentPresetIndex = Math.max(0, this.presetOrder.indexOf(presetKey));

    this.buildModel(MINIFIG_PRESETS[presetKey] || MINIFIG_PRESETS.caveira);
  }

  cyclePreset() {
    this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presetOrder.length;
    const key = this.presetOrder[this.currentPresetIndex];
    const preset = MINIFIG_PRESETS[key];
    this.buildModel(preset);
    return { key, name: preset.name };
  }

  triggerPunch() {
    this.punchTimer = 0.24;
    this.punchHand *= -1;
  }

  triggerShoot() {
    this.shootTimer = 0.18;
  }

  buildModel(preset) {
    // Limpa modelo anterior caso esteja trocando de preset
    while (this.visualRoot.children.length > 0) {
      this.visualRoot.remove(this.visualRoot.children[0]);
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

    // Bloco horizontal da cintura
    const waistMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.42), hipMat);
    waistMesh.position.set(0, 0.07, 0);
    waistMesh.castShadow = true;
    waistMesh.receiveShadow = true;
    this.hipGroup.add(waistMesh);

    // Divisória central do quadril entre as pernas
    const crotchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.4), hipMat);
    crotchMesh.position.set(0, -0.06, 0);
    crotchMesh.castShadow = true;
    this.hipGroup.add(crotchMesh);

    // Perna Esquerda (+X) e Perna Direita (-X)
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

    // Estampa frontal do peito (Trapezoidal leve na frente +Z)
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

    // Capa opcional (ex: Solaris)
    if (preset.capeColor) {
      const capeMat = getLegoMaterial(preset.capeColor, { roughness: 0.45, clearcoat: 0.15 });
      const capeGeo = createTrapezoidTorsoGeometry(1.05, 0.75, 1.15, 0.03);
      this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
      this.capeMesh.position.set(0, 0.22, -0.25);
      this.capeMesh.rotation.x = 0.12;
      this.capeMesh.castShadow = true;
      this.upperBodyGroup.add(this.capeMesh);
    } else {
      this.capeMesh = null;
    }

    // ==========================================
    // 3. BRAÇOS E MÃOS EM GARRA "C" ARTICULADOS
    // ==========================================
    this.leftArmPivot = this._createArm(armMat, handMat, 1);
    this.leftArmPivot.position.set(0.49, 0.66, 0);
    this.upperBodyGroup.add(this.leftArmPivot);

    this.rightArmPivot = this._createArm(armMat, handMat, -1);
    this.rightArmPivot.position.set(-0.49, 0.66, 0);
    this.upperBodyGroup.add(this.rightArmPivot);

    // ==========================================
    // 4. PESCOÇO, CABEÇA CILÍNDRICA & PINO LEGO
    // ==========================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.76, 0);
    this.upperBodyGroup.add(this.headGroup);

    // Pescoço cilíndrico
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20),
      headMat
    );
    neckMesh.position.set(0, 0.04, 0);
    neckMesh.castShadow = true;
    this.headGroup.add(neckMesh);

    // Cabeça cilíndrica clássica LEGO com chanfros suaves
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

    // Chanfro arredondado superior e inferior da cabeça
    const rimGeo = new THREE.TorusGeometry(headRadius - 0.03, 0.03, 12, 32);
    rimGeo.rotateX(Math.PI / 2);
    const topRim = new THREE.Mesh(rimGeo, headMat);
    topRim.position.set(0, 0.33 + headHeight * 0.5, 0);
    this.headGroup.add(topRim);

    const botRim = new THREE.Mesh(rimGeo, headMat);
    botRim.position.set(0, 0.33 - headHeight * 0.5, 0);
    this.headGroup.add(botRim);

    // Rosto impresso na frente da cabeça (+Z)
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

    // Pino Superior Clássico de LEGO (Stud no topo da cabeça)
    const headStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.13, 24),
      headMat
    );
    headStud.position.set(0, 0.33 + headHeight * 0.5 + 0.065, 0);
    headStud.castShadow = true;
    headStud.receiveShadow = true;
    this.headGroup.add(headStud);

    // Acessório de cabeça opcional (Boina com pino / Coroa solar)
    if (preset.headgear === 'beret') {
      const beretGroup = new THREE.Group();
      const beretMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.32, clearcoat: 0.3 });
      const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.4, roughness: 0.2 });

      // Base da boina tática do BOPE inclinada
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

      // Pino LEGO no topo da boina para manter 100% estética de peça encaixável
      const beretStud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20),
        beretMat
      );
      beretStud.position.set(-0.04, 0.77, 0.02);
      beretGroup.add(beretStud);

      // Distintivo dourado na frente da boina
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), goldMat);
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0.1, 0.66, 0.38);
      beretGroup.add(badge);

      this.headGroup.add(beretGroup);
    } else if (preset.headgear === 'visor_crown') {
      const crownMat = getLegoMaterial(LEGO_COLORS.gold, {
        emissive: 0xf59e0b,
        emissiveIntensity: 0.25,
        roughness: 0.18,
        clearcoat: 0.5
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.1, 24), crownMat);
      band.position.set(0, 0.6, 0);
      this.headGroup.add(band);

      // Pino solar dourado no topo da cabeça
      const goldStud = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.14, 24), crownMat);
      goldStud.position.set(0, 0.66, 0);
      this.headGroup.add(goldStud);
    }
  }

  _createLeg(legMat) {
    const pivot = new THREE.Group();

    // Articulação cilíndrica superior da coxa
    const hipRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.35, 18),
      legMat
    );
    hipRoll.rotation.z = Math.PI / 2;
    hipRoll.castShadow = true;
    pivot.add(hipRoll);

    // Perna retangular LEGO
    const legShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.54, 0.38),
      legMat
    );
    legShaft.position.set(0, -0.31, 0);
    legShaft.castShadow = true;
    legShaft.receiveShadow = true;
    pivot.add(legShaft);

    // Pé LEGO (projeta para frente em +Z)
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
    // sideSign: +1 para braço esquerdo (+X), -1 para braço direito (-X)
    const shoulderPivot = new THREE.Group();

    // Grupo interno com a inclinação lateral característica dos braços LEGO
    const armBody = new THREE.Group();
    armBody.rotation.z = sideSign * 0.13;
    shoulderPivot.add(armBody);

    // Ombro arredondado
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), armMat);
    shoulderCap.castShadow = true;
    armBody.add(shoulderCap);

    // Braço superior
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.12, 0.34, 18),
      armMat
    );
    upperArm.position.set(0, -0.17, 0);
    upperArm.castShadow = true;
    armBody.add(upperArm);

    // Antebraço levemente angulado para frente (+Z) como nas minifiguras reais
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.32, 0);
    forearmGroup.rotation.x = -0.22; // Aponta levemente para +Z
    armBody.add(forearmGroup);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.11, 0.24, 18),
      armMat
    );
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    forearmGroup.add(forearm);

    // Punho cilíndrico amarelo
    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.1, 14),
      handMat
    );
    wrist.position.set(0, -0.25, 0);
    forearmGroup.add(wrist);

    // Mão em formato de Garra "C" clássica LEGO
    const clawGeo = new THREE.TorusGeometry(0.095, 0.042, 12, 20, Math.PI * 1.48);
    const clawMesh = new THREE.Mesh(clawGeo, handMat);
    clawMesh.position.set(0, -0.34, 0.02);
    // Rotaciona para a abertura do "C" ficar voltada para frente/baixo
    clawMesh.rotation.y = Math.PI / 2;
    clawMesh.rotation.z = -Math.PI * 0.65;
    clawMesh.castShadow = true;
    forearmGroup.add(clawMesh);

    return shoulderPivot;
  }

  /**
   * Atualiza as animações procedurais do boneco (Respirar, Andar, Correr, Pular e Cair)
   */
  updateAnimation(dt, moveSpeed, maxRunSpeed, isGrounded, verticalVelocity) {
    this.animTime += dt;

    // Detecta impacto de pouso no chão para um squash sutil
    if (isGrounded && !this.wasGrounded) {
      this.landingSquash = 1.0;
    }
    this.wasGrounded = isGrounded;
    this.landingSquash = THREE.MathUtils.lerp(this.landingSquash, 0, Math.min(1, dt * 12));

    // Determina estado atual
    if (!isGrounded) {
      this.state = verticalVelocity > 0.5 ? 'JUMP' : 'FALL';
    } else if (moveSpeed > maxRunSpeed * 0.65) {
      this.state = 'RUN';
    } else if (moveSpeed > 0.2) {
      this.state = 'WALK';
    } else {
      this.state = 'IDLE';
    }

    const lerpSpeed = Math.min(1, dt * 14);

    if (this.state === 'IDLE') {
      // Animação de respirar parado (Idle)
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
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
        this.rightArmPivot.rotation.x,
        -breath * 0.05,
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

      // Balanço alternado de pernas e braços
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
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
        this.rightArmPivot.rotation.x,
        s * armAmp,
        lerpSpeed
      );
      this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.04, lerpSpeed);
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, -0.04, lerpSpeed);

      // Inclinação e rotação sutil de tronco ao andar/correr
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
      // Pose heroica de pulo LEGO (um braço erguido, pernas em passo aéreo)
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
      // Pose de queda com braços abertos equilibrando e pernas preparando o pouso
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

    // Animação da capa caso exista
    if (this.capeMesh) {
      const targetCapeAngle =
        this.state === 'RUN' ? 0.55 :
        this.state === 'WALK' ? 0.3 :
        !isGrounded ? 0.65 : 0.12;
      this.capeMesh.rotation.x = THREE.MathUtils.lerp(
        this.capeMesh.rotation.x,
        targetCapeAngle + Math.sin(this.animTime * 6) * 0.04,
        lerpSpeed
      );
    }

    // Sobreposição de animação de Soco (Combo Corpo a Corpo)
    if (this.punchTimer > 0) {
      this.punchTimer = Math.max(0, this.punchTimer - dt);
      const swing = Math.sin((this.punchTimer / 0.24) * Math.PI);
      if (this.punchHand > 0) {
        this.leftArmPivot.rotation.x = -1.65 * swing;
        this.upperBodyGroup.rotation.y = -0.38 * swing;
      } else {
        this.rightArmPivot.rotation.x = -1.65 * swing;
        this.upperBodyGroup.rotation.y = 0.38 * swing;
      }
      this.upperBodyGroup.rotation.x += 0.18 * swing;
    }

    // Sobreposição de animação de Tiro / Disparo
    if (this.shootTimer > 0) {
      this.shootTimer = Math.max(0, this.shootTimer - dt);
      const recoil = Math.sin((this.shootTimer / 0.18) * Math.PI);
      this.rightArmPivot.rotation.x = -1.55 + recoil * 0.25;
      this.rightArmPivot.rotation.z = -0.05;
    }
  }
}

