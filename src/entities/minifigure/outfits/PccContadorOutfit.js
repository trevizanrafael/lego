import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói a Balaclava Preta Fosca Integral + Óculos Balísticos Azul-Cobalto + ComTac (`pcc_contador_balaclava`)
 * para o operador de precisão Contador (PCC).
 */
export function attachPccContadorHeadgear(minifig) {
  const headGear = new THREE.Group();
  const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.46, clearcoat: 0.12 });
  const cobaltMat = getLegoMaterial(0x1e3a8a, { roughness: 0.3, clearcoat: 0.3 });
  const cobaltLens = getLegoMaterial(0x1d4ed8, {
    roughness: 0.1,
    metalness: 0.35,
    clearcoat: 0.9,
    emissive: 0x1e40af,
    emissiveIntensity: 0.55
  });
  const steelMat = getLegoMaterial(0x334155, { roughness: 0.26, metalness: 0.62 });

  // Touca superior e máscara inferior da balaclava de malha preta fosca
  const balaclavaTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.362, 0.368, 0.21, 28),
    matteBlack
  );
  balaclavaTop.position.set(0, 0.555, 0);
  const balaclavaCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.362, 0.075, 24),
    matteBlack
  );
  balaclavaCrown.position.set(0, 0.69, 0);
  const balaclavaMask = new THREE.Mesh(
    new THREE.CylinderGeometry(0.364, 0.358, 0.24, 28),
    matteBlack
  );
  balaclavaMask.position.set(0, 0.18, 0);
  const cobaltSeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.37, 0.032, 28),
    cobaltMat
  );
  cobaltSeam.position.set(0, 0.47, 0);
  headGear.add(balaclavaTop, balaclavaCrown, balaclavaMask, cobaltSeam);

  // Óculos táticos balísticos com lentes azul-cobalto
  const frameBar = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.08), steelMat);
  frameBar.position.set(0, 0.405, 0.335);
  headGear.add(frameBar);

  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.105, 0.065), cobaltLens);
    lens.position.set(side * 0.138, 0.365, 0.348);
    lens.rotation.y = -side * 0.16;
    const sideTemple = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.34), steelMat);
    sideTemple.position.set(side * 0.35, 0.375, 0.16);
    headGear.add(lens, sideTemple);
  }

  // Abafadores táticos ComTac em aço e preto fosco + microfone discreto
  for (const side of [-1, 1]) {
    const earCup = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.23, 0.21), matteBlack);
    earCup.position.set(side * 0.372, 0.34, 0);
    const earBracket = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.2, 0.05), steelMat);
    earBracket.position.set(side * 0.4, 0.47, 0);
    headGear.add(earCup, earBracket);
  }

  const micArm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.3), steelMat);
  micArm.position.set(-0.27, 0.205, 0.21);
  micArm.rotation.y = 0.48;
  const micCapsule = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.038, 0.055), matteBlack);
  micCapsule.position.set(-0.16, 0.205, 0.35);
  headGear.add(micArm, micCapsule);

  minifig.headGroup.add(headGear);
}

export const pccContadorOutfitMethods = {
  /**
   * Equipa o Rig 3D Completo do Contador (PCC — Dano/Suporte de Precisão):
   * - FRENTE: Colete tático organizado preto/azul-cobalto, blocos C4 + detonador clacker e porta-mags DMR;
   * - COSTAS: Maleta rígida compacta de suprimento de munição com trincos de aço;
   * - BRAÇOS & PERNAS: Ombreiras enxutas, computador balístico de pulso, coldre secundário e botas pretas;
   * - ARMA: Fuzil de Precisão Semiautomático DMR (`pcc_dmr`) com luneta e supressor longo (`this.rifleGroup`).
   */
  _attachPccContadorRig() {
    const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.38, clearcoat: 0.18 });
    const darkNavy = getLegoMaterial(0x0f172a, { roughness: 0.34, clearcoat: 0.22 });
    const cobaltMat = getLegoMaterial(0x1e3a8a, { roughness: 0.28, clearcoat: 0.32 });
    const steelMat = getLegoMaterial(0x334155, { roughness: 0.25, metalness: 0.62 });
    const brushedSteel = getLegoMaterial(0x64748b, { roughness: 0.22, metalness: 0.72 });
    const c4Putty = getLegoMaterial(0x475569, { roughness: 0.45 });
    const cobaltGlow = getLegoMaterial(0x38bdf8, { emissive: 0x2563eb, emissiveIntensity: 1.9 });
    const redLed = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.0 });

    // 1. FRENTE — COLETE ORGANIZADO COM FRISO COBALTO, TIJOLOS C4 & CLACKER
    const frontVest = new THREE.Group();

    const plateBody = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.56, 0.08), matteBlack);
    plateBody.position.set(0, 0.39, 0.23);
    plateBody.castShadow = true;
    const cobaltTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.045, 0.09), cobaltMat);
    cobaltTrim.position.set(0, 0.62, 0.235);
    frontVest.add(plateBody, cobaltTrim);

    for (const sx of [-0.24, 0.24]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.51), matteBlack);
      strap.position.set(sx, 0.755, 0);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.075), steelMat);
      buckle.position.set(sx, 0.685, 0.24);
      frontVest.add(strap, buckle);
    }

    // Dois blocos de C4 encapados + detonador clacker M57 no peito superior
    for (const cx of [-0.18, -0.02]) {
      const c4Brick = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.065), c4Putty);
      c4Brick.position.set(cx, 0.49, 0.275);
      const tapeBand = new THREE.Mesh(new THREE.BoxGeometry(0.136, 0.045, 0.07), matteBlack);
      tapeBand.position.set(cx, 0.49, 0.275);
      const c4Light = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), redLed);
      c4Light.position.set(cx, 0.56, 0.31);
      frontVest.add(c4Brick, tapeBand, c4Light);
    }

    const clacker = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.065), cobaltMat);
    clacker.position.set(0.2, 0.5, 0.275);
    const clackerHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), brushedSteel);
    clackerHandle.position.set(0.2, 0.58, 0.275);
    frontVest.add(clacker, clackerHandle);

    // 3 porta-carregadores retos de 7.62 DMR
    for (const mx of [-0.21, 0, 0.21]) {
      const dmrPouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.21, 0.085), darkNavy);
      dmrPouch.position.set(mx, 0.22, 0.268);
      const dmrMagTop = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.045, 0.065), brushedSteel);
      dmrMagTop.position.set(mx, 0.335, 0.268);
      frontVest.add(dmrPouch, dmrMagTop);
    }

    this.upperBodyGroup.add(frontVest);

    // 2. COSTAS — MALETA RÍGIDA COMPACTA DE SUPRIMENTO DE MUNIÇÃO
    const supplyCase = new THREE.Group();
    supplyCase.position.set(0, 0.42, -0.28);

    const caseShell = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.2), darkNavy);
    caseShell.castShadow = true;
    supplyCase.add(caseShell);

    for (const rx of [-0.18, 0, 0.18]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.48, 0.035), steelMat);
      rib.position.set(rx, 0, -0.11);
      supplyCase.add(rib);
    }

    const cobaltStrip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.055, 0.03), cobaltMat);
    cobaltStrip.position.set(0, 0.16, -0.115);
    const caseHandle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), brushedSteel);
    caseHandle.position.set(0, 0.29, -0.02);
    const spareCanister = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.5, 14), matteBlack);
    spareCanister.rotation.z = Math.PI / 2;
    spareCanister.position.set(0, -0.31, -0.02);
    supplyCase.add(cobaltStrip, caseHandle, spareCanister);

    this.upperBodyGroup.add(supplyCase);

    // 3. OMBROS ENXUTOS, TELEMETRIA BALÍSTICA NO PULSO, CINTO E PERNAS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.34), matteBlack);
      pauldron.position.set(sign * 0.05, -0.03, 0);
      pauldron.rotation.z = -sign * 0.11;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.35), cobaltMat);
      trim.position.set(sign * 0.05, 0.04, 0);
      trim.rotation.z = -sign * 0.11;
      armPivot.add(pauldron, trim);
    }

    const wristComputer = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.26), darkNavy);
    wristComputer.position.set(0, -0.17, 0);
    const ballisticScreen = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.14), cobaltGlow);
    ballisticScreen.position.set(0.11, -0.17, 0.02);
    this.leftHandGroup.add(wristComputer, ballisticScreen);

    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.115, 0.47), matteBlack);
    beltBand.position.set(0, 0.08, 0);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.055), brushedSteel);
    buckle.position.set(0, 0.08, 0.242);
    beltGroup.add(beltBand, buckle);
    this.hipGroup.add(beltGroup);

    const sidearmHolster = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.21, 0.16), matteBlack);
    sidearmHolster.position.set(-0.19, -0.22, 0.03);
    this.rightLegPivot.add(sidearmHolster);

    const chargePouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.19), darkNavy);
    chargePouch.position.set(0.19, -0.22, 0.02);
    this.leftLegPivot.add(chargePouch);

    for (const legPivot of [this.leftLegPivot, this.rightLegPivot]) {
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, 0.11), matteBlack);
      kneePad.position.set(0, -0.39, 0.18);
      const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), steelMat);
      kneeCap.position.set(0, -0.39, 0.23);
      const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.17, 0.54), matteBlack);
      bootSole.position.set(0, -0.64, 0.07);
      legPivot.add(kneePad, kneeCap, bootSole);
    }

    // 4. ARMA PRIMÁRIA — FUZIL DE PRECISÃO DMR COM LUNETA & SUPRESSOR (`pcc_dmr`)
    const dmr = new THREE.Group();

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.19, 0.64), matteBlack);
    receiver.position.set(0, 0.02, 0.22);
    receiver.castShadow = true;
    const cobaltAccent = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.032, 0.38), cobaltMat);
    cobaltAccent.position.set(0, 0.055, 0.2);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.13, 0.52), steelMat);
    handguard.position.set(0, 0.035, 0.72);
    dmr.add(receiver, cobaltAccent, handguard);

    const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.62, 12), brushedSteel);
    longBarrel.rotation.x = Math.PI / 2;
    longBarrel.position.set(0, 0.04, 0.96);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.36, 14), matteBlack);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.04, 1.32);
    dmr.add(longBarrel, suppressor);

    // Carregador reto de 20 tiros + coronha de atirador com apoio de bochecha
    const straightMag = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.24, 0.13), steelMat);
    straightMag.position.set(0, -0.16, 0.33);
    const sniperStock = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.2, 0.36), matteBlack);
    sniperStock.position.set(0, -0.01, -0.22);
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.06, 0.2), cobaltMat);
    cheekRest.position.set(0, 0.09, -0.18);
    dmr.add(straightMag, sniperStock, cheekRest);

    // Luneta telescópica superior com objetiva azul-cobalto
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.28), steelMat);
    scopeMount.position.set(0, 0.145, 0.26);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.44, 14), matteBlack);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.2, 0.28);
    const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.046, 0.12, 14), matteBlack);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0, 0.2, 0.53);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 12), cobaltGlow);
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.2, 0.585);
    dmr.add(scopeMount, scopeTube, scopeBell, scopeLens);

    const flashMat = getLegoMaterial(0xe0f2fe, {
      emissive: 0x38bdf8,
      emissiveIntensity: 2.3,
      transparent: true,
      opacity: 0.9
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.8, 0.8, 2.3);
    this.muzzleFlashMesh.position.set(0, 0.04, 1.58);
    this.muzzleFlashMesh.visible = false;
    dmr.add(this.muzzleFlashMesh);

    dmr.position.set(0, -0.34, 0.12);
    dmr.rotation.x = Math.PI / 2 - 0.15;
    this.rightHandGroup.add(dmr);
    this.rifleGroup = dmr;
  }
};
