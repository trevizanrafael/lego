import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../../../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from '../../BuildingGenerator.js';
import {
  VEHICLE_SPECS,
  createLegoCarMesh
} from '../../VehicleFleetBuilder.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { soundFX } from '../../../audio/SoundFX.js';
import { applyTuningToVehicleObject } from './CustomsVehicleApplier3D.js';

// ============================================================================
// 5. FÍSICA DE VOO PARABÓLICO DOS CARROS LANÇADOS PELA RAMPA CUNHA (WEDGE RAM!)
// ============================================================================
export class StreetCustomsRuntime {
  constructor(world) {
    this.world = world;
    this.launchedCars = [];
  }

  /**
   * Joga qualquer carro atingido pela Rampa Cunha Frontal voando por cima do teto do jogador!
   */
  launchVehicleOverRoof(victimObj, playerPos, fwdX, fwdZ, impactSpeed) {
    if (!victimObj || victimObj.destroyed || victimObj._wedgeActive) return;

    victimObj._wedgeActive = true;
    victimObj.isGrabbed = true; // Pausa o controlador de trânsito de rua durante o voo!
    for (const col of victimObj.colliders || []) {
      col.disabled = true;
    }

    const spd = Math.max(18.0, Math.abs(impactSpeed));
    const upVel = THREE.MathUtils.clamp(14.5 + spd * 0.28, 15.5, 27.5);
    // Empurra levemente para cima/trás relativo ao avanço do jogador para passar limpíssimo por cima do teto!
    const sideJitter = (Math.random() - 0.5) * 5.0;
    const perpX = -fwdZ;
    const perpZ = fwdX;

    victimObj.mesh.position.y += 1.35;
    this.launchedCars.push({
      obj: victimObj,
      vel: new THREE.Vector3(
        fwdX * (spd * 0.25) + perpX * sideJitter,
        upVel,
        fwdZ * (spd * 0.25) + perpZ * sideJitter
      ),
      spinX: 5.2 + Math.random() * 2.5,
      spinZ: (Math.random() - 0.5) * 4.2,
      age: 0
    });

    soundFX.playLegoBreak(false);
    this.world.destructibles?.spawnFlameTrailParticle(
      victimObj.mesh.position.clone(),
      1.35
    );
  }

  update(dt) {
    for (let i = this.launchedCars.length - 1; i >= 0; i--) {
      const item = this.launchedCars[i];
      const obj = item.obj;
      if (!obj || obj.destroyed) {
        this.launchedCars.splice(i, 1);
        continue;
      }

      item.age += dt;
      item.vel.y -= 26.0 * dt;
      obj.mesh.position.addScaledVector(item.vel, dt);
      obj.mesh.rotation.x += item.spinX * dt;
      obj.mesh.rotation.z += item.spinZ * dt;

      const gx = obj.mesh.position.x;
      const gz = obj.mesh.position.z;
      const floorY = this.world.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(gx, gz, obj.mesh.position.y)
        : (this.world.getTerrainHeightAt?.(gx, gz) ?? 0);

      if (item.age > 0.18 && obj.mesh.position.y <= floorY + 0.15) {
        obj.mesh.position.y = floorY;
        obj.mesh.rotation.x = 0;
        obj.mesh.rotation.z = 0;
        obj.basePos.copy(obj.mesh.position);
        obj.baseRot.copy(obj.mesh.rotation);
        obj.groundY = floorY;
        obj._wedgeActive = false;
        obj.isGrabbed = false;

        for (const col of obj.colliders || []) {
          col.minX = gx - 1.4;
          col.maxX = gx + 1.4;
          col.minZ = gz - 2.4;
          col.maxZ = gz + 2.4;
          col.minY = floorY;
          col.maxY = floorY + 2.0;
          col.disabled = false;
        }

        this.world.destructibles?.damageObject(
          obj,
          45,
          new THREE.Vector3(gx, floorY + 0.5, gz)
        );
        this.launchedCars.splice(i, 1);
      }
    }
  }
}

// ============================================================================
// 6. CONSTRUÇÃO FÍSICA 3D DA OFICINA "LEGO CUSTOMS" EM X = 60, Z = -448 (92m x 96m)
// ============================================================================
export function buildLegoCustomsGarage(world, bx = 60, bz = -448, bw = 92, bd = 96) {
  world._addCityBlockSidewalk(bx, bz, bw, bd, LEGO_COLORS.sidewalk);

  const floorY = 0.30;
  const darkBrickGeos = [];
  const steelGeos = [];
  const yellowGeos = [];
  const cyanGeos = [];
  const redToolGeos = [];
  const blueNitroGeos = [];
  const tireBlackGeos = [];
  const glassGeos = [];

  // 6.1 Pátio Asfaltado Drive-Thru & Piso Epóxi Escuro da Oficina (82m x 86m)
  const yardW = bw - 8; // 84m (X = 18..102)
  const yardD = bd - 8; // 88m (Z = -492..-404)
  darkBrickGeos.push(makeTranslatedBox(yardW, 0.08, yardD, bx, floorY, bz));

  // Faixas-guia luminosas Ciano e Amarelo Alerta levando da Av. Central (Oeste) e Av. Z=-382 (Sul) até o Elevador Hidráulico!
  const liftX = 68.0;
  const liftZ = -454.0;
  yellowGeos.push(
    makeTranslatedBox(32.0, 0.05, 0.65, 33.0, floorY + 0.05, liftZ - 4.8),
    makeTranslatedBox(32.0, 0.05, 0.65, 33.0, floorY + 0.05, liftZ + 4.8),
    makeTranslatedBox(0.65, 0.05, 26.0, liftX - 4.8, floorY + 0.05, -417.0),
    makeTranslatedBox(0.65, 0.05, 26.0, liftX + 4.8, floorY + 0.05, -417.0)
  );
  cyanGeos.push(
    makeTranslatedBox(28.0, 0.06, 0.45, 35.0, floorY + 0.055, liftZ),
    makeTranslatedBox(0.45, 0.06, 22.0, liftX, floorY + 0.055, -419.0)
  );

  // 6.2 Galpão Automotivo Drive-Thru Aberto (58m x 56m: X = 39..97, Z = -482..-426, Altura = 14.5m)
  // 2 Portões Largos Sempre Abertos (20m largura x 9.5m altura): Portão Oeste (X = 39, Z = -454) & Portão Sul (X = 68, Z = -426)!
  const gMinX = 39.0;
  const gMaxX = 97.0;
  const gMinZ = -482.0;
  const gMaxZ = -426.0;
  const gW = gMaxX - gMinX; // 58m
  const gD = gMaxZ - gMinZ; // 56m
  const wallH = 14.2;
  const wallT = 1.8;
  const gateW = 20.0;
  const gateH = 9.6;

  // Parede Norte (Z = -482) — Fechada
  darkBrickGeos.push(makeTranslatedBox(gW, wallH, wallT, liftX, floorY + wallH * 0.5, gMinZ + wallT * 0.5));
  world.addCollider(liftX, gMinZ + wallT * 0.5, gW, wallT, floorY + wallH, floorY);

  // Parede Leste (X = 97) — Fechada
  darkBrickGeos.push(makeTranslatedBox(wallT, wallH, gD, gMaxX - wallT * 0.5, floorY + wallH * 0.5, liftZ));
  world.addCollider(gMaxX - wallT * 0.5, liftZ, wallT, gD, floorY + wallH, floorY);

  // Parede Sul (Z = -426) — Portão Drive-Thru Sul de 20m sempre aberto!
  const southSegW = (gW - gateW) * 0.5; // 19m de cada lado
  const sLeftX = gMinX + southSegW * 0.5;
  const sRightX = gMaxX - southSegW * 0.5;
  const sWallZ = gMaxZ - wallT * 0.5;
  darkBrickGeos.push(
    makeTranslatedBox(southSegW, wallH, wallT, sLeftX, floorY + wallH * 0.5, sWallZ),
    makeTranslatedBox(southSegW, wallH, wallT, sRightX, floorY + wallH * 0.5, sWallZ),
    makeTranslatedBox(gateW, wallH - gateH, wallT, liftX, floorY + gateH + (wallH - gateH) * 0.5, sWallZ)
  );
  yellowGeos.push(
    makeTranslatedBox(0.7, gateH, wallT + 0.25, liftX - gateW * 0.5, floorY + gateH * 0.5, sWallZ),
    makeTranslatedBox(0.7, gateH, wallT + 0.25, liftX + gateW * 0.5, floorY + gateH * 0.5, sWallZ),
    makeTranslatedBox(gW + 0.4, 0.75, wallT + 0.3, liftX, floorY + gateH + 0.4, sWallZ)
  );
  world.addCollider(sLeftX, sWallZ, southSegW, wallT, floorY + wallH, floorY);
  world.addCollider(sRightX, sWallZ, southSegW, wallT, floorY + wallH, floorY);
  world.addCollider(liftX, sWallZ, gateW, wallT, floorY + wallH, floorY + gateH);

  // Parede Oeste (X = 39) — Portão Drive-Thru Oeste de 20m sempre aberto virado para a Av. Central!
  const westSegD = (gD - gateW) * 0.5; // 18m de cada lado
  const wNorthZ = gMinZ + westSegD * 0.5;
  const wSouthZ = gMaxZ - westSegD * 0.5;
  const wWallX = gMinX + wallT * 0.5;
  darkBrickGeos.push(
    makeTranslatedBox(wallT, wallH, westSegD, wWallX, floorY + wallH * 0.5, wNorthZ),
    makeTranslatedBox(wallT, wallH, westSegD, wWallX, floorY + wallH * 0.5, wSouthZ),
    makeTranslatedBox(wallT, wallH - gateH, gateW, wWallX, floorY + gateH + (wallH - gateH) * 0.5, liftZ)
  );
  cyanGeos.push(
    makeTranslatedBox(wallT + 0.25, gateH, 0.7, wWallX, floorY + gateH * 0.5, liftZ - gateW * 0.5),
    makeTranslatedBox(wallT + 0.25, gateH, 0.7, wWallX, floorY + gateH * 0.5, liftZ + gateW * 0.5),
    makeTranslatedBox(wallT + 0.3, 0.75, gD + 0.4, wWallX, floorY + gateH + 0.4, liftZ)
  );
  world.addCollider(wWallX, wNorthZ, wallT, westSegD, floorY + wallH, floorY);
  world.addCollider(wWallX, wSouthZ, wallT, westSegD, floorY + wallH, floorY);
  world.addCollider(wWallX, liftZ, wallT, gateW, floorY + wallH, floorY + gateH);

  // Teto Industrial Metálico com Claraboia Central e Tubos Neon no Teto (Y = 14.5m)
  steelGeos.push(makeTranslatedBox(gW + 1.2, 1.1, gD + 1.2, liftX, floorY + wallH + 0.55, liftZ));
  glassGeos.push(makeTranslatedBox(22.0, 1.3, 22.0, liftX, floorY + wallH + 0.6, liftZ));
  world.addCollider(liftX, liftZ, gW + 1.2, gD + 1.2, floorY + wallH + 1.1, floorY + wallH);

  for (let nz = gMinZ + 8; nz <= gMaxZ - 8; nz += 10) {
    cyanGeos.push(makeTranslatedBox(gW - 8, 0.28, 0.55, liftX, floorY + wallH - 0.35, nz));
  }

  // 6.3 ELEVADOR HIDRÁULICO CENTRAL AMARELO/PRETO (`X = 68, Z = -454`) + CONSOLE DE DIAGNÓSTICO
  steelGeos.push(makeTranslatedBox(9.2, 0.14, 11.6, liftX, floorY + 0.08, liftZ));
  yellowGeos.push(
    // Duas rampas paralelas do elevador automotivo (baixas em 0.16m para qualquer carro subir suave!)
    makeTranslatedBox(1.35, 0.18, 9.8, liftX - 1.95, floorY + 0.12, liftZ),
    makeTranslatedBox(1.35, 0.18, 9.8, liftX + 1.95, floorY + 0.12, liftZ),
    // 2 Colunas Hidráulicas Laterais (X = liftX ± 4.6m -> 9.2m de vão livre no meio!)
    makeTranslatedBox(0.95, 6.2, 0.95, liftX - 4.65, floorY + 3.1, liftZ),
    makeTranslatedBox(0.95, 6.2, 0.95, liftX + 4.65, floorY + 3.1, liftZ),
    makeTranslatedBox(10.2, 0.55, 0.95, liftX, floorY + 6.35, liftZ)
  );
  cyanGeos.push(
    makeTranslatedBox(9.6, 0.12, 0.32, liftX, floorY + 0.14, liftZ - 5.6),
    makeTranslatedBox(9.6, 0.12, 0.32, liftX, floorY + 0.14, liftZ + 5.6),
    makeTranslatedBox(8.8, 0.24, 0.45, liftX, floorY + 6.0, liftZ)
  );
  world.addCollider(liftX - 4.65, liftZ, 1.1, 1.1, floorY + 6.5, floorY);
  world.addCollider(liftX + 4.65, liftZ, 1.1, 1.1, floorY + 6.5, floorY);

  // Console Tático ao lado do Elevador Hidráulico
  const consolePos = { x: liftX + 5.8, y: floorY, z: liftZ + 2.8 };
  redToolGeos.push(makeTranslatedBox(1.8, 1.45, 1.4, consolePos.x, floorY + 0.72, consolePos.z));
  cyanGeos.push(makeTranslatedBox(1.4, 0.85, 0.18, consolePos.x - 0.1, floorY + 1.75, consolePos.z));

  // 6.4 BANCADAS DE FERRAMENTAS VERMELHAS, PILHAS DE PNEUS LEGO E CILINDROS DE NITRO AZUIS!
  // Bancadas de ferramentas na parede Norte
  for (let bxOff = -18; bxOff <= 18; bxOff += 12) {
    redToolGeos.push(
      makeTranslatedBox(7.5, 1.6, 2.2, liftX + bxOff, floorY + 0.8, gMinZ + 3.2),
      makeTranslatedBox(7.5, 1.8, 0.6, liftX + bxOff, floorY + 3.4, gMinZ + 2.3)
    );
    steelGeos.push(makeTranslatedBox(7.7, 0.18, 2.4, liftX + bxOff, floorY + 1.65, gMinZ + 3.2));
    world.addCollider(liftX + bxOff, gMinZ + 3.2, 7.7, 2.4, floorY + 3.5, floorY);
  }

  // Cilindros de Nitro (NOS) Azuis na Parede Leste
  for (let i = 0; i < 8; i++) {
    const cz = liftZ - 14 + i * 3.8;
    const cyl = new THREE.CylinderGeometry(0.45, 0.45, 2.6, 12);
    cyl.translate(gMaxX - 3.2, floorY + 1.3, cz);
    blueNitroGeos.push(cyl);
    yellowGeos.push(makeTranslatedBox(0.35, 0.35, 0.35, gMaxX - 3.2, floorY + 2.72, cz));
  }
  world.addCollider(gMaxX - 3.2, liftZ, 1.8, 30.0, floorY + 3.0, floorY);

  // Pilhas de Pneus LEGO nos cantos internos e na frente da oficina
  const tireStacks = [
    [gMinX + 4.2, gMinZ + 5.5, 4],
    [gMinX + 6.8, gMinZ + 5.5, 3],
    [gMaxX - 4.5, gMaxZ - 5.5, 4],
    [gMinX - 2.8, liftZ - 13.0, 3],
    [gMinX - 2.8, liftZ + 13.0, 3]
  ];
  for (const [tx, tz, count] of tireStacks) {
    for (let k = 0; k < count; k++) {
      const tg = new THREE.CylinderGeometry(1.05, 1.05, 0.68, 16);
      tg.translate(tx, floorY + 0.35 + k * 0.7, tz);
      tireBlackGeos.push(tg);
    }
    world.addCollider(tx, tz, 2.2, 2.2, floorY + count * 0.72, floorY);
  }

  // 6.5 TERMINAL EXTERNO DE RETIRADA DOS 3 CARROS SALVOS NA GARAGEM PESSOAL (`X = 32, Z = -416`)
  const retrievalTerminalPos = { x: 33.5, y: floorY, z: -416.0 };
  const deliverySpawnPos = { x: 25.0, y: floorY + 0.08, z: -416.0, rotY: 0 };
  darkBrickGeos.push(makeTranslatedBox(2.2, 2.4, 1.6, retrievalTerminalPos.x, floorY + 1.2, retrievalTerminalPos.z));
  yellowGeos.push(
    makeTranslatedBox(2.4, 0.25, 1.8, retrievalTerminalPos.x, floorY + 2.48, retrievalTerminalPos.z),
    makeTranslatedBox(6.6, 0.06, 10.5, deliverySpawnPos.x, floorY + 0.05, deliverySpawnPos.z)
  );
  cyanGeos.push(makeTranslatedBox(1.6, 0.95, 0.16, retrievalTerminalPos.x - 0.95, floorY + 1.65, retrievalTerminalPos.z));
  world.addCollider(retrievalTerminalPos.x, retrievalTerminalPos.z, 2.2, 1.6, floorY + 2.6, floorY);

  // 6.6 LETREIROS NEON GIGANTES NO TOPO E NOS 2 PORTÕES ABERTOS!
  const mainRoofSignW = createSignBoardMesh({
    x: gMinX - 0.5,
    y: floorY + wallH + 4.2,
    z: liftZ,
    width: 34.0,
    height: 5.4,
    depth: 0.9,
    rotY: -Math.PI / 2,
    title: 'LEGO CUSTOMS • TUNING & NITRO',
    subText: 'MOTOR NV.10 • PINTURA • ADESIVOS • RAMPA CUNHA',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    subColor: '#00f0ff'
  });
  const mainRoofSignS = createSignBoardMesh({
    x: liftX,
    y: floorY + wallH + 4.2,
    z: gMaxZ + 0.5,
    width: 34.0,
    height: 5.4,
    depth: 0.9,
    rotY: 0,
    title: 'LEGO CUSTOMS • OFICINA DE RUA',
    subText: 'DRIVE-THRU ABERTO • ENTRE COM SEU VEÍCULO [E]',
    bgColor: '#090a0d',
    borderColor: '#00f0ff',
    textColor: '#facc15',
    subColor: '#f8fafc'
  });
  const westGateSign = createSignBoardMesh({
    x: gMinX - 0.35,
    y: floorY + gateH + 2.1,
    z: liftZ,
    width: 19.5,
    height: 2.3,
    depth: 0.45,
    rotY: -Math.PI / 2,
    title: '► BOX HIDRÁULICO // TUNAR [E]',
    subText: 'CARROS & MOTOS • REGULAGEM 0 A 10',
    bgColor: '#090a0d',
    borderColor: '#00f0ff',
    textColor: '#00f0ff',
    subColor: '#facc15'
  });
  const southGateSign = createSignBoardMesh({
    x: liftX,
    y: floorY + gateH + 2.1,
    z: gMaxZ + 0.35,
    width: 19.5,
    height: 2.3,
    depth: 0.45,
    rotY: 0,
    title: '▲ ENTRADA DRIVE-THRU // LEGO CUSTOMS',
    subText: 'PINTURA • MONSTER TRUCK • UNDERGLOW NEON',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    subColor: '#00f0ff'
  });
  world.scene.add(mainRoofSignW, mainRoofSignS, westGateSign, southGateSign);

  // Merge estático em 8 Draw Calls para manter 60 FPS cravados!
  const addMerged = (geos, mat, cast = false) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeBufferGeometries(geos), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    world.scene.add(m);
  };

  addMerged(darkBrickGeos, getLegoMaterial(0x111827, { roughness: 0.36 }), true);
  addMerged(steelGeos, getLegoMaterial(0x475569, { metalness: 0.5, roughness: 0.25 }), true);
  addMerged(yellowGeos, getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.5 }));
  addMerged(cyanGeos, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
  addMerged(redToolGeos, getLegoMaterial(0xdc2626, { roughness: 0.22, clearcoat: 0.45 }));
  addMerged(blueNitroGeos, getLegoMaterial(0x0284c7, { metalness: 0.45, roughness: 0.18 }));
  addMerged(tireBlackGeos, getLegoMaterial(0x090a0d, { roughness: 0.7 }));
  addMerged(
    glassGeos,
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      roughness: 0.1
    })
  );

  // Registra contorno destacado no Minimapa e Mapa [M]
  world.mapBuildings.push({
    x: liftX,
    z: liftZ,
    w: gW,
    d: gD,
    height: wallH,
    color: '#1e293b',
    isLandmark: true,
    label: 'LEGO CUSTOMS'
  });

  // 6.7 Estaciona 2 Carros Esportivos no Pátio Externo Oeste para quem chegar a pé já pegar e tunar!
  const courtesyCars = [
    { x: 25.0, z: -474.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: 0x090a0d, type: 'apex_gtx' },
    { x: 25.0, z: -484.0, rotY: Math.PI / 2, color: 0xf97316, roofColor: 0xf8fafc, type: 'trovao_v8' }
  ];
  for (const cfg of courtesyCars) {
    spawnDraggableCustomVehicle(world, cfg);
  }

  if (!world.customsRuntime) {
    world.customsRuntime = new StreetCustomsRuntime(world);
  }

  world.legoCustomsData = {
    liftPos: { x: liftX, y: floorY + 0.16, z: liftZ },
    consolePos,
    retrievalTerminalPos,
    deliverySpawnPos,
    courtyardExitPos: { x: 25.5, y: floorY + 0.08, z: liftZ, rotY: -Math.PI / 2 }
  };
}

/**
 * Cria e registra um veículo dirigível completo no mundo (usado no pátio da oficina e ao chamar carros salvos!)
 */
export function spawnDraggableCustomVehicle(world, cfg, customTuning = null) {
  const type = customTuning?.carType || cfg.type || 'apex_gtx';
  const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.apex_gtx;
  const carGroup = createLegoCarMesh({
    type,
    color: cfg.color ?? 0xfacc15,
    roofColor: cfg.roofColor ?? 0x090a0d
  });

  const yBase = cfg.y ?? (world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.x, cfg.z) : 0) + 0.3;
  carGroup.position.set(cfg.x, yBase, cfg.z);
  carGroup.rotation.y = cfg.rotY || 0;
  carGroup.userData.carType = type;
  carGroup.userData.carName = spec.name;
  carGroup.userData.vehicleSpec = spec;
  world.scene.add(carGroup);

  const isMoto = Boolean(spec.isMotorcycle);
  const isBus = type === 'onibus_urbano';
  const baseW = isMoto ? 1.45 : isBus ? 2.9 : 2.5;
  const baseD = isMoto ? 3.8 : isBus ? 8.5 : 5.0;
  const col1 = world.addCollider(cfg.x, cfg.z, baseW, baseD, yBase + 1.25, yBase);
  const col2 = world.addCollider(cfg.x, cfg.z, baseW * 0.85, baseD * 0.6, yBase + (isBus ? 2.95 : 2.05), yBase);

  let entry = null;
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: carGroup,
      type: 'car',
      hp: spec.hp,
      radius: Math.max(baseW, baseD) * 0.52,
      height: isBus ? 3.0 : 2.1,
      colliders: [col1, col2],
      debrisColors: [0xfacc15, 0x090a0d, 0xdc2626, 0x38bdf8],
      studDrops: spec.studDrops,
      groundY: yBase
    });
    entry = world.destructibles.objects[world.destructibles.objects.length - 1];
  }

  if (entry && customTuning) {
    applyTuningToVehicleObject(entry, customTuning);
  }

  return entry;
}
