import * as THREE from 'three';
import { getLegoMaterial, createLegoBrick } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';
import { soundFX } from '../../audio/SoundFX.js';

// ============================================================================
// 1. MONTANHA-RUSSA OCEÂNICA EM CIRCUITO FECHADO (`X = -36, Z = 1235`, PICO `Y = 38m`!)
// ============================================================================
export function initOceanRollerCoaster(mgr) {
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

  mgr.coasterCurve = new THREE.CatmullRomCurve3(waypoints, true, 'catmullrom', 0.45);

  // Constrói Trilhos Duplos Vermelhos, Dormentes Amarelos e Colunas Brancas no Mar (3 Draw Calls!)
  const samples = 210;
  const leftPts = [];
  const rightPts = [];
  const tieGeos = [];
  const pillarGeos = [];
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < samples; i++) {
    const u = i / samples;
    const pt = mgr.coasterCurve.getPointAt(u);
    const tan = mgr.coasterCurve.getTangentAt(u).normalize();
    const side = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    const bankAngle = mgr._getCoasterBankAt(u);
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
  mgr.scene.add(railMesh, tieMesh, pillarMesh);

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
  mgr.scene.add(platMesh);
  mgr.world.addCollider(-31.2, 1235, 6.2, 28.0, 4.0, 1.6);
  mgr.world.addCollider(-26.2, 1235, 4.0, 8.0, 2.2, 1.6);
  mgr.world.addCollider(-27.2, 1235, 4.0, 6.0, 2.8, 1.6);
  mgr.world.addCollider(-28.2, 1235, 4.0, 4.0, 3.4, 1.6);

  const coasterSign = createSignBoardMesh({
    x: -28.0,
    y: 7.2,
    z: 1235,
    width: 15.5,
    height: 2.4,
    depth: 0.4,
    rotY: Math.PI / 2,
    title: '🎢 MONTANHA-RUSSA OCEÂNICA',
    subText: 'QUEDA DE 38m SOBRE O MAR • EMBARQUE [F]',
    bgColor: '#090a0d',
    borderColor: '#ef4444',
    textColor: '#facc15',
    subColor: '#00f0ff'
  });
  mgr.scene.add(coasterSign);

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

    mgr.scene.add(carGroup);
    mgr.coasterCars.push(carGroup);
  }
  mgr._updateCoasterTrainTransforms();
}

export function getCoasterBankAt(u) {
  // Inclina nas curvas oceânicas (u ≈ 0.45..0.68 e u ≈ 0.88..0.98) e fica 0° na estação!
  if (u >= 0.42 && u <= 0.68) {
    return Math.sin(((u - 0.42) / 0.26) * Math.PI) * 0.58;
  }
  if (u >= 0.86 && u <= 0.98) {
    return -Math.sin(((u - 0.86) / 0.12) * Math.PI) * 0.42;
  }
  return 0;
}

export function updateCoasterTrainTransforms(mgr) {
  if (!mgr.coasterCurve || mgr.coasterCars.length === 0) return;
  const upVec = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < mgr.coasterCars.length; i++) {
    const carU = (mgr.coasterU - i * 0.0145 + 1.0) % 1.0;
    const pt = mgr.coasterCurve.getPointAt(carU);
    const tan = mgr.coasterCurve.getTangentAt(carU).normalize();
    const bank = mgr._getCoasterBankAt(carU);

    const car = mgr.coasterCars[i];
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

// ============================================================================
// 2. RODA-GIGANTE COLOSSAL (73m!) COM 16 CABINES NIVELADAS & PLATAFORMA [E]
// ============================================================================
export function initFerrisWheelLevelingAndPlatform(mgr) {
  mgr.ferrisWheelGroup = mgr.world.ferrisWheelGroup || null;
  mgr.ferrisCabins = mgr.world.ferrisWheelCabins || [];

  // Escadaria frontal e Letreiro na Base da Roda-Gigante (`X = 0, Z = 1480, Y = 4.2m`)
  const stairGeos = [
    makeTranslatedBox(12.0, 0.85, 4.0, 0, 2.02, 1452.0),
    makeTranslatedBox(12.0, 1.7, 4.0, 0, 2.45, 1454.0)
  ];
  const stairMesh = new THREE.Mesh(
    mergeBufferGeometries(stairGeos),
    getLegoMaterial(0xf8fafc, { roughness: 0.28 })
  );
  mgr.scene.add(stairMesh);
  mgr.world.addCollider(0, 1452.0, 12.0, 4.0, 2.45, 1.6);
  mgr.world.addCollider(0, 1454.0, 12.0, 4.0, 3.3, 1.6);

  const ferrisSign = createSignBoardMesh({
    x: 0,
    y: 7.4,
    z: 1455.0,
    width: 18.0,
    height: 2.4,
    depth: 0.42,
    rotY: Math.PI,
    title: '🎡 RODA-GIGANTE COLOSSAL (73m)',
    subText: '16 CABINES PANORÂMICAS NIVELADAS • EMBARQUE [F]',
    bgColor: '#090a0d',
    borderColor: '#00f0ff',
    textColor: '#facc15',
    subColor: '#f8fafc'
  });
  mgr.scene.add(ferrisSign);
}

// ============================================================================
// 3. TORRE DE QUEDA LIVRE "BIG DROP" DE 58 METROS (`X = +24, Z = 1325`)
// ============================================================================
export function initBigDropTowerGondola(mgr) {
  const gondola = new THREE.Group();
  gondola.position.set(24, mgr.bigDropY, 1325);

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

  mgr.scene.add(gondola);
  mgr.bigDropGondola = gondola;

  const dropSign = createSignBoardMesh({
    x: 24,
    y: 6.8,
    z: 1317.5,
    width: 13.5,
    height: 2.2,
    depth: 0.4,
    rotY: Math.PI,
    title: '🗼 BIG DROP TOWER (58m)',
    subText: 'SUSPENSE NO TOPO & QUEDA LIVRE • [F]',
    bgColor: '#090a0d',
    borderColor: '#ec4899',
    textColor: '#facc15',
    subColor: '#00f0ff'
  });
  mgr.scene.add(dropSign);
}

// ============================================================================
// 4. EMBARQUE [E], ASSENTOS E CÂMERAS DAS ATRAÇÕES DO MEGA PÍER
// ============================================================================
export function findNearbyPierAttraction(mgr, playerPos) {
  if (!playerPos) return null;

  // 1. Montanha-Russa Oceânica (perto da Plataforma `(-31.2, 4.0, 1235)` ou do 1º Vagão!)
  const dCoasterPlat = Math.hypot(playerPos.x - -31.5, playerPos.z - 1235);
  const leadCar = mgr.coasterCars[0];
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

export function getLowestFerrisCabinIndex(mgr) {
  if (!mgr.ferrisWheelGroup || mgr.ferrisCabins.length === 0) return 0;
  let bestIdx = 0;
  let lowestY = Infinity;
  const wp = new THREE.Vector3();
  mgr.ferrisWheelGroup.updateMatrixWorld(true);
  mgr.ferrisCabins.forEach((cab, idx) => {
    cab.getWorldPosition(wp);
    if (wp.y < lowestY) {
      lowestY = wp.y;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

export function getPierRideSeatTransform(mgr, rideState) {
  if (!rideState) return null;

  if (rideState.type === 'roller_coaster' && mgr.coasterCars[0]) {
    const car = mgr.coasterCars[0];
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

  if (rideState.type === 'ferris_wheel' && mgr.ferrisCabins.length > 0) {
    const cab = mgr.ferrisCabins[rideState.cabinIdx || 0] || mgr.ferrisCabins[0];
    mgr.ferrisWheelGroup?.updateMatrixWorld(true);
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

  if (rideState.type === 'big_drop' && mgr.bigDropGondola) {
    const gPos = mgr.bigDropGondola.position;
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

// ============================================================================
// 5. ATUALIZAÇÃO EM TEMPO REAL DOS 3 BRINQUEDOS DO MEGA PÍER
// ============================================================================
export function updatePierAmusementParkRides(mgr, dt, controller) {
  // 1. Montanha-Russa Oceânica (para 4s na estação `u ≈ 0.042` a cada volta!)
  if (mgr.coasterCurve) {
    if (mgr.coasterStopTimer > 0) {
      mgr.coasterStopTimer = Math.max(0, mgr.coasterStopTimer - dt);
      mgr.coasterSpeed = 0;
    } else {
      const curPt = mgr.coasterCurve.getPointAt(mgr.coasterU);
      // Velocidade física gravitacional: sobe a rampa a 13.5 m/s e despenca a até 43 m/s!
      const dropEnergy = Math.max(0, 40.5 - curPt.y);
      const targetSpd = mgr.coasterU < 0.28
        ? 13.5
        : THREE.MathUtils.clamp(14.0 + Math.sqrt(dropEnergy) * 4.6, 14.0, 43.0);
      mgr.coasterSpeed = THREE.MathUtils.lerp(mgr.coasterSpeed, targetSpd, Math.min(1, dt * 5));

      const totalLen = mgr.coasterCurve.getLength() || 520;
      const prevU = mgr.coasterU;
      mgr.coasterU = (mgr.coasterU + (mgr.coasterSpeed * dt) / totalLen) % 1.0;

      // Ao cruzar o ponto da Estação (`u = 0.042`), estaciona por 4.0 segundos!
      if (prevU < 0.042 && mgr.coasterU >= 0.042) {
        mgr.coasterU = 0.042;
        mgr.coasterStopTimer = 4.0;
      }
    }
    mgr._updateCoasterTrainTransforms();
  }

  // 2. Roda-Gigante Colossal (73m) mantendo todas as 16 Cabines 100% na vertical!
  if (mgr.ferrisWheelGroup) {
    mgr.ferrisWheelGroup.rotation.x += 0.22 * dt;
    const wheelRotX = mgr.ferrisWheelGroup.rotation.x;
    for (let i = 0; i < mgr.ferrisCabins.length; i++) {
      mgr.ferrisCabins[i].rotation.x = -wheelRotX;
    }
  }

  // 3. Torre de Queda Livre "Big Drop" (58m: Embarque -> Subida -> 2s Suspense -> Queda Livre -> Freio!)
  if (mgr.bigDropGondola) {
    const minY = 3.2;
    const topY = 58.0;

    if (mgr.bigDropState === 'BOARDING') {
      mgr.bigDropY = minY;
      mgr.bigDropTimer -= dt;
      if (mgr.bigDropTimer <= 0) {
        mgr.bigDropState = 'CLIMBING';
      }
    } else if (mgr.bigDropState === 'CLIMBING') {
      mgr.bigDropY += 9.5 * dt;
      if (mgr.bigDropY >= topY) {
        mgr.bigDropY = topY;
        mgr.bigDropState = 'SUSPENSE';
        mgr.bigDropTimer = 2.0; // 2 segundos de suspense lá no topo!
      }
    } else if (mgr.bigDropState === 'SUSPENSE') {
      mgr.bigDropTimer -= dt;
      if (mgr.bigDropTimer <= 0) {
        mgr.bigDropState = 'FREEFALL';
        mgr.bigDropVelY = -4.0;
      }
    } else if (mgr.bigDropState === 'FREEFALL') {
      mgr.bigDropVelY -= 38.0 * dt;
      mgr.bigDropY += mgr.bigDropVelY * dt;
      if (mgr.bigDropY <= 12.5) {
        mgr.bigDropState = 'BRAKING';
        if (controller?.activeRide?.type === 'big_drop') {
          controller.cameraShakeTimer = 0.35;
          soundFX.playTacticalRoll();
        }
      }
    } else if (mgr.bigDropState === 'BRAKING') {
      mgr.bigDropY = THREE.MathUtils.lerp(mgr.bigDropY, minY, Math.min(1, dt * 6.5));
      if (mgr.bigDropY <= minY + 0.12) {
        mgr.bigDropY = minY;
        mgr.bigDropVelY = 0;
        mgr.bigDropState = 'BOARDING';
        mgr.bigDropTimer = 3.5;
      }
    }

    mgr.bigDropGondola.position.y = mgr.bigDropY;
  }
}
