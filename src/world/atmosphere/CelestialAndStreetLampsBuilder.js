import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { getCachedFacadeMaterials } from '../BuildingGenerator.js';
import { RIVER_BRIDGE_SPECS } from '../RoadGridBuilder.js';
import { WORLD_SCALE, IS_SCALED_WORLD, ROAD, ws, fromWs } from '../core/WorldLayoutScale.js';
import { createSkyDomeUniforms, createSkyDomeMaterial } from './AtmosphereScheduleAndShader.js';

// ============================================================================
// 1. SKYDOME PROCEDURAL (SHADER LEVE) + SOL + LUA CHEIA LEGO + 1.200 ESTRELAS
// ============================================================================
export function initCelestialSkyDomeStarsSunAndMoon(mgr) {
  mgr.celestialRoot = new THREE.Group();
  mgr.celestialRoot.name = 'celestial_sky_root';

  mgr.skyUniforms = createSkyDomeUniforms();
  const skyMat = createSkyDomeMaterial(mgr.skyUniforms);

  mgr.skyDome = new THREE.Mesh(new THREE.SphereGeometry(6600 * WORLD_SCALE, 32, 20), skyMat);
  mgr.skyDome.renderOrder = -10;
  mgr.skyDome.frustumCulled = false;
  mgr.celestialRoot.add(mgr.skyDome);

  // Campo Estelar com 1.200 Estrelas Cintilantes no Hemisfério Celeste
  const starCount = 1200;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const cWhite = new THREE.Color(0xf8fafc);
  const cBlue = new THREE.Color(0xbae6fd);
  const cGold = new THREE.Color(0xfef08a);

  for (let i = 0; i < starCount; i++) {
    const u = ((i * 7919) % 10000) / 10000;
    const v = ((i * 6271) % 10000) / 10000;
    const theta = u * Math.PI * 2;
    const elevation = 0.06 + v * 0.92;
    const rHoriz = Math.sqrt(Math.max(0, 1 - elevation * elevation));
    const rad = 6100 * WORLD_SCALE;

    starPositions[i * 3] = Math.cos(theta) * rHoriz * rad;
    starPositions[i * 3 + 1] = elevation * rad;
    starPositions[i * 3 + 2] = Math.sin(theta) * rHoriz * rad;

    const pick = i % 5 === 0 ? cGold : i % 3 === 0 ? cBlue : cWhite;
    starColors[i * 3] = pick.r;
    starColors[i * 3 + 1] = pick.g;
    starColors[i * 3 + 2] = pick.b;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  mgr.starMat = new THREE.PointsMaterial({
    size: 6.5 * WORLD_SCALE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    fog: false
  });
  mgr.starPoints = new THREE.Points(starGeo, mgr.starMat);
  mgr.starPoints.frustumCulled = false;
  mgr.starPoints.visible = false;
  mgr.celestialRoot.add(mgr.starPoints);

  // Disco Solar Brilhante + Halo Dourado Aditivo (com opacidade contínua sem apagar de repente!)
  mgr.sunDiscGroup = new THREE.Group();
  mgr.sunCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfffbeb,
    transparent: true,
    opacity: 1.0,
    fog: false,
    depthWrite: false
  });
  mgr.sunHaloMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(56 * WORLD_SCALE, 20, 16), mgr.sunCoreMat);
  const sunHalo = new THREE.Mesh(new THREE.SphereGeometry(118 * WORLD_SCALE, 20, 16), mgr.sunHaloMat);
  mgr.sunDiscGroup.add(sunCore, sunHalo);
  mgr.sunDiscGroup.frustumCulled = false;
  mgr.celestialRoot.add(mgr.sunDiscGroup);

  // Lua Cheia Estilizada LEGO com Crateras de Pino + Halo Azul-Prata Luminoso
  mgr.moonGroup = new THREE.Group();
  mgr.moonCoreMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.0,
    fog: false,
    depthWrite: false
  });
  mgr.moonCraterMat = new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.0,
    fog: false,
    depthWrite: false
  });
  mgr.moonHaloMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(52 * WORLD_SCALE, 20, 16), mgr.moonCoreMat);
  const moonHalo = new THREE.Mesh(new THREE.SphereGeometry(128 * WORLD_SCALE, 20, 16), mgr.moonHaloMat);
  const crater1 = new THREE.Mesh(
    new THREE.CylinderGeometry(11 * WORLD_SCALE, 11 * WORLD_SCALE, 6 * WORLD_SCALE, 12),
    mgr.moonCraterMat
  );
  crater1.position.set(-14 * WORLD_SCALE, 12 * WORLD_SCALE, 47 * WORLD_SCALE);
  crater1.rotation.x = Math.PI / 2;
  const crater2 = new THREE.Mesh(
    new THREE.CylinderGeometry(7.5 * WORLD_SCALE, 7.5 * WORLD_SCALE, 6 * WORLD_SCALE, 12),
    mgr.moonCraterMat
  );
  crater2.position.set(15 * WORLD_SCALE, -10 * WORLD_SCALE, 48 * WORLD_SCALE);
  crater2.rotation.x = Math.PI / 2;
  mgr.moonGroup.add(moonDisc, moonHalo, crater1, crater2);
  mgr.moonGroup.visible = false;
  mgr.moonGroup.frustumCulled = false;
  mgr.celestialRoot.add(mgr.moonGroup);

  mgr.scene.add(mgr.celestialRoot);
}

// ============================================================================
// 2. REDE UNIFICADA DE POSTES, VIADUTOS, PONTES, METRÔ, PÍER E FAVELA (3 DRAW CALLS!)
// ============================================================================
export function initCitywideStreetlampsAndCones(mgr) {
  const terrainAt = (x, z) =>
    typeof mgr.world.getTerrainHeightAt === 'function' ? mgr.world.getTerrainHeightAt(x, z) : 0;

  // 2.1 Importa todos os postes de madeira e gambiarras registrados pelo FavelaCDDBuilder
  if (Array.isArray(mgr.world.nightLampRegistry)) {
    for (const n of mgr.world.nightLampRegistry) {
      mgr.lampNodes.push(n);
    }
  }

  const physicalPoleLocations = []; // Postes metálicos adicionais para Viadutos, Pontes, Píer e Avenidas

  // 2.2 Postes das Grandes Avenidas do Centro, Subúrbio, Praia e Distrito Leste
  const aveLampOff = IS_SCALED_WORLD ? ROAD.mainWidth * 0.5 + 1.8 : 14.8;
  const aveLampStepZ = ws(88);
  for (const rawAx of [-384, -252, -120, 0, 120, 252, 384]) {
    const ax = ws(rawAx);
    for (let az = ws(-760); az <= ws(680); az += aveLampStepZ) {
      const px = ax + aveLampOff;
      const gy = terrainAt(px, az) + (IS_SCALED_WORLD ? 0.02 : 0.28);
      physicalPoleLocations.push({ x: px, y: gy, z: az, h: 6.2 });
      mgr.lampNodes.push({
        x: px - 1.2,
        y: gy + 6.0,
        z: az,
        groundY: gy - 0.22,
        warm: false,
        coneH: 6.1,
        coneR: 4.8
      });
    }
  }

  // 2.3 Luz noturna das luminárias dos viadutos
  for (const spot of mgr.world.viaductLampSpots || []) {
    mgr.lampNodes.push({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      groundY: spot.deckY + 0.04,
      warm: true,
      coneH: 5.2,
      coneR: 4.2
    });
  }

  // 2.4 Postes nas 9 Pontes em Arco sobre o Rio Urbano Leste!
  for (const br of RIVER_BRIDGE_SPECS) {
    for (const bx of [ws(540), ws(560), ws(580)]) {
      const u = (bx - br.xStart) / (br.xEnd - br.xStart);
      const archY = Math.sin(u * Math.PI) * br.archHeight;
      for (const side of [-1, 1]) {
        const pz = br.z + side * (br.width * 0.5 - 1.2);
        physicalPoleLocations.push({ x: bx, y: archY, z: pz, h: 5.0 });
        mgr.lampNodes.push({
          x: bx,
          y: archY + 4.9,
          z: pz - side * 1.0,
          groundY: archY + 0.08,
          warm: true,
          coneH: 4.85,
          coneR: 3.9
        });
      }
    }
  }

  // 2.5 Iluminação das 3 Estações Elevadas do Metrô (+14.85m) & Calçadão/Píer da Roda-Gigante!
  const elevatedStations = [
    { x: ws(-384), z: ws(-180), axis: 'z' },
    { x: ws(0), z: ws(134), axis: 'x' },
    { x: ws(384), z: ws(-117), axis: 'z' }
  ];
  for (const st of elevatedStations) {
    for (const off of [-20, 0, 20]) {
      const lx = st.axis === 'x' ? st.x + off : st.x;
      const lz = st.axis === 'z' ? st.z + off : st.z;
      mgr.lampNodes.push({
        x: lx,
        y: 22.8,
        z: lz,
        groundY: 14.9,
        warm: false,
        coneH: 7.9,
        coneR: 5.8
      });
    }
  }

  const pierLampStep = ws(48);
  for (let pz = ws(1045); pz <= ws(1525); pz += pierLampStep) {
    for (const side of [-11.5, 11.5]) {
      physicalPoleLocations.push({ x: side, y: 1.5, z: pz, h: 5.0 });
      mgr.lampNodes.push({
        x: side * 0.85,
        y: 6.4,
        z: pz,
        groundY: 1.55,
        warm: true,
        coneH: 4.85,
        coneR: 4.2
      });
    }
  }

  // Indexa todos os nós de poste numa Grade Espacial O(1) para o Pool de 4 PointLights!
  for (const node of mgr.lampNodes) {
    const gx = Math.floor(node.x / mgr._lampCellSize);
    const gz = Math.floor(node.z / mgr._lampCellSize);
    const key = `${gx},${gz}`;
    let list = mgr._lampGrid.get(key);
    if (!list) {
      list = [];
      mgr._lampGrid.set(key, list);
    }
    list.push(node);
  }

  // Constrói 1 InstancedMesh único para as hastes metálicas dos postes extras (Viadutos, Pontes, Avenidas, Píer)
  const dummy = new THREE.Object3D();
  if (physicalPoleLocations.length > 0) {
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.0, 8);
    poleGeo.translate(0, 0.5, 0);
    const poleInst = new THREE.InstancedMesh(
      poleGeo,
      getLegoMaterial(0x334155, { metalness: 0.5, roughness: 0.3 }),
      physicalPoleLocations.length
    );
    physicalPoleLocations.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(1, p.h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    mgr.scene.add(poleInst);
  }

  // Constrói os 3 InstancedMeshes Globais Noturnos: Bulbos + Cones Volumétricos + Discos no Asfalto!
  const count = mgr.lampNodes.length;
  const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const coneGeo = new THREE.ConeGeometry(1.0, 1.0, 12, 1, true);
  coneGeo.translate(0, -0.5, 0);
  const poolGeo = new THREE.CircleGeometry(1.0, 14);
  poolGeo.rotateX(-Math.PI / 2);

  mgr.bulbInstMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  mgr.coneInstMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  mgr.poolInstMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  mgr.bulbInstMesh = new THREE.InstancedMesh(bulbGeo, mgr.bulbInstMat, count);
  mgr.coneInstMesh = new THREE.InstancedMesh(coneGeo, mgr.coneInstMat, count);
  mgr.poolInstMesh = new THREE.InstancedMesh(poolGeo, mgr.poolInstMat, count);

  const warmCol = new THREE.Color(0xf58216);
  const coolCol = new THREE.Color(0x5cc8be);

  mgr.lampNodes.forEach((n, idx) => {
    const col = n.warm ? warmCol : coolCol;

    dummy.position.set(n.x, n.y, n.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mgr.bulbInstMesh.setMatrixAt(idx, dummy.matrix);
    mgr.bulbInstMesh.setColorAt(idx, col);

    dummy.position.set(n.x, n.y, n.z);
    dummy.scale.set(n.coneR || 4.2, n.coneH || 5.4, n.coneR || 4.2);
    dummy.updateMatrix();
    mgr.coneInstMesh.setMatrixAt(idx, dummy.matrix);
    mgr.coneInstMesh.setColorAt(idx, col);

    dummy.position.set(n.x, n.groundY + 0.06, n.z);
    dummy.scale.set((n.coneR || 4.2) * 1.15, 1, (n.coneR || 4.2) * 1.15);
    dummy.updateMatrix();
    mgr.poolInstMesh.setMatrixAt(idx, dummy.matrix);
    mgr.poolInstMesh.setColorAt(idx, col);
  });

  mgr.bulbInstMesh.instanceMatrix.needsUpdate = true;
  mgr.coneInstMesh.instanceMatrix.needsUpdate = true;
  mgr.poolInstMesh.instanceMatrix.needsUpdate = true;
  if (mgr.bulbInstMesh.instanceColor) mgr.bulbInstMesh.instanceColor.needsUpdate = true;
  if (mgr.coneInstMesh.instanceColor) mgr.coneInstMesh.instanceColor.needsUpdate = true;
  if (mgr.poolInstMesh.instanceColor) mgr.poolInstMesh.instanceColor.needsUpdate = true;

  mgr.bulbInstMesh.frustumCulled = false;
  mgr.coneInstMesh.frustumCulled = false;
  mgr.poolInstMesh.frustumCulled = false;

  mgr.bulbInstMesh.visible = false;
  mgr.coneInstMesh.visible = false;
  mgr.poolInstMesh.visible = false;

  mgr.scene.add(mgr.bulbInstMesh, mgr.coneInstMesh, mgr.poolInstMesh);
}

// ============================================================================
// 3. BRILHO NEON NOTURNO NOS MARCOS ICÔNICOS (RODA-GIGANTE, TORRE "H", BANCO, TIMES SQ., FARÓIS)
// ============================================================================
export function initLandmarkNeonAndLighthouses(mgr) {
  const makeNeonHaloMat = (hex, maxOp = 0.42) => {
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    mat.userData.maxOpacity = maxOp;
    mgr.landmarkNeonMaterials.push(mat);
    return mat;
  };

  // 3.1 Roda-Gigante da Praia Sul: Aros Neon Magenta & Ciano que giram junto com a roda!
  if (mgr.world.ferrisWheelGroup) {
    const fwNeonCyan = makeNeonHaloMat(0x00f0ff, 0.55);
    const fwNeonPink = makeNeonHaloMat(0xec4899, 0.52);
    for (const rx of [-4.1, 4.1]) {
      const outerGlow = new THREE.Mesh(new THREE.TorusGeometry(32.0, 1.35, 10, 40), fwNeonCyan);
      outerGlow.rotation.y = Math.PI / 2;
      outerGlow.position.x = rx;
      const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(20.0, 1.15, 10, 32), fwNeonPink);
      innerGlow.rotation.y = Math.PI / 2;
      innerGlow.position.x = rx * 0.9;
      mgr.world.ferrisWheelGroup.add(outerGlow, innerGlow);
    }
  }

  // 3.2 Emblema "H" Colossal da Torre dos Heróis + Cúpula Solar
  const heroHaloMat = makeNeonHaloMat(0x00f0ff, 0.45);
  const heroCrownGlow = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 42, 16, 1, true), heroHaloMat);
  heroCrownGlow.position.set(ws(-318), 258, ws(-180));
  mgr.scene.add(heroCrownGlow);

  // 3.3 Fachada Dourada do Super Banco Central + Painéis Neon de Times Square
  const bankGlowMat = makeNeonHaloMat(0xd99b16, 0.14);
  const bankUplight = new THREE.Mesh(new THREE.BoxGeometry(88, 28, 6), bankGlowMat);
  bankUplight.position.set(0, 15, IS_SCALED_WORLD ? ws(-117) - ROAD.mainWidth * 0.5 - 12 : -133);
  mgr.scene.add(bankUplight);

  const tsGlowMat = makeNeonHaloMat(0xd946ef, 0.28);
  const tsHalo = new THREE.Mesh(new THREE.CylinderGeometry(28, 34, 32, 16, 1, true), tsGlowMat);
  tsHalo.position.set(ws(-60), 18, ws(-8));
  mgr.scene.add(tsHalo);

  // 3.4 Feixes Giratórios dos 2 Faróis Marítimos
  const lhBeamGeo = new THREE.ConeGeometry(12.0, 135.0, 14, 1, true);
  lhBeamGeo.rotateX(-Math.PI / 2);
  lhBeamGeo.translate(0, 0, 67.5);
  const lhMat = makeNeonHaloMat(0xfef08a, 0.34);

  for (const [lx, ly, lz, spd] of [
    [0, 34.2, ws(1552), 0.85],
    [ws(-1735), 66.8, ws(945), -0.72]
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, ly, lz);
    const b1 = new THREE.Mesh(lhBeamGeo, lhMat);
    const b2 = new THREE.Mesh(lhBeamGeo, lhMat);
    b2.rotation.y = Math.PI;
    pivot.add(b1, b2);
    pivot.visible = false;
    mgr.scene.add(pivot);
    mgr.lighthouseBeams.push({ pivot, speed: spd });
  }
}

// ============================================================================
// 4. POOL DINÂMICO DE APENAS 4 THREE.PointLight REAIS (SEM SOMBRA, DISTANCE = 28)
//    (Mantidas sempre na cena com intensity=0 de dia -> ZERO recompilação de shader!)
// ============================================================================
export function initDynamicFourPointLightPool(mgr) {
  for (let i = 0; i < 4; i++) {
    const pl = new THREE.PointLight(0xfbbf24, 0.0, 28.0, 1.6);
    pl.castShadow = false;
    pl.position.set(0, -500, 0);
    mgr.scene.add(pl);
    mgr.pointLightPool.push(pl);
  }
}

export function updateClosestFourPointLights(mgr, playerPos, nightFactor) {
  // Dentro do Super Banco Central: redireciona o pool de 4 PointLights mesmo de dia!
  const inSuperBank =
    playerPos &&
    Math.abs(playerPos.x) <= 74 &&
    fromWs(playerPos.z) >= -229 &&
    fromWs(playerPos.z) <= -130 &&
    playerPos.y < 41;

  if (inSuperBank) {
    const floorIdx = Math.max(0, Math.min(3, Math.floor(Math.max(0, playerPos.y) / 10)));
    const lightY = floorIdx * 10 + 7.2;
    const baseX = THREE.MathUtils.clamp(playerPos.x, -46, 46);
    const baseZ = THREE.MathUtils.clamp(playerPos.z, -212, -148);
    const offsets = [
      [-16, -12],
      [16, -12],
      [-16, 12],
      [16, 12]
    ];
    const warmColor = floorIdx === 3 ? 0xfde68a : 0xffe4a0;
    for (let i = 0; i < mgr.pointLightPool.length; i++) {
      const pl = mgr.pointLightPool[i];
      const [ox, oz] = offsets[i] || [0, 0];
      pl.color.setHex(warmColor);
      pl.position.set(
        THREE.MathUtils.clamp(baseX + ox, -64, 64),
        lightY,
        THREE.MathUtils.clamp(baseZ + oz, -222, -138)
      );
      pl.intensity = 2.6;
    }
    return;
  }

  if (!playerPos || nightFactor <= 0.05) {
    for (const pl of mgr.pointLightPool) {
      pl.intensity = 0.0;
    }
    return;
  }

  const gx = Math.floor(playerPos.x / mgr._lampCellSize);
  const gz = Math.floor(playerPos.z / mgr._lampCellSize);

  // Mantém os 4 nós mais próximos sem alocar arrays nem ordenar listas grandes
  let b0 = null, b1 = null, b2 = null, b3 = null;
  let d0 = Infinity, d1 = Infinity, d2 = Infinity, d3 = Infinity;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const cell = mgr._lampGrid.get(`${gx + dx},${gz + dz}`);
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const n = cell[i];
        const distSq =
          (n.x - playerPos.x) * (n.x - playerPos.x) +
          (n.y - playerPos.y) * (n.y - playerPos.y) * 0.5 +
          (n.z - playerPos.z) * (n.z - playerPos.z);

        if (distSq < d0) {
          d3 = d2; b3 = b2;
          d2 = d1; b2 = b1;
          d1 = d0; b1 = b0;
          d0 = distSq; b0 = n;
        } else if (distSq < d1) {
          d3 = d2; b3 = b2;
          d2 = d1; b2 = b1;
          d1 = distSq; b1 = n;
        } else if (distSq < d2) {
          d3 = d2; b3 = b2;
          d2 = distSq; b2 = n;
        } else if (distSq < d3) {
          d3 = distSq; b3 = n;
        }
      }
    }
  }

  const best = [b0, b1, b2, b3];
  for (let i = 0; i < 4; i++) {
    const pl = mgr.pointLightPool[i];
    const node = best[i];
    if (node) {
      pl.position.set(node.x, node.y - 0.35, node.z);
      pl.color.setHex(node.warm ? 0xfbbf24 : 0xbae6fd);
      pl.intensity = nightFactor * 2.15;
    } else {
      pl.intensity = 0.0;
    }
  }
}

// ============================================================================
// 5. ATUALIZAÇÃO POR FRAME DO CÉU, SOMBRAS SOLARES E ILUMINAÇÃO URBANA NOTURNA
// ============================================================================
export function updateCelestialAndSunShadow(mgr, dt, playerPos, controller) {
  const s = mgr._sampled;
  const nf = mgr.nightFactor;

  // 1) Calcula trajetória orbital do Sol (Nasce a Leste +X às 06:00 -> Zênite às 12:00 -> Põe-se a Oeste -X atrás da CDD às 18:00!)
  const sunAngle = ((mgr.timeHours - 6.0) / 12.0) * Math.PI;
  const sunX = Math.cos(sunAngle); // +1 Leste (06h) -> 0 (12h) -> -1 Oeste atrás da CDD (18h)
  const sunY = Math.sin(sunAngle); // 0 horizonte -> +1 meio-dia -> 0 pôr do sol -> negativo à noite
  mgr._sunDir.set(sunX, sunY, 0.24).normalize();

  // Lua Cheia sobe alta no céu noturno projetando sombras prateadas legíveis!
  const moonElev = Math.max(0.42, -sunY * 0.85 + 0.25);
  mgr._moonDir.set(-sunX * 0.65, moonElev, 0.38).normalize();

  // 2) Atualiza SkyDome, Fog, Sol, Lua LEGO e as 1.200 Estrelas
  const anchorX = playerPos ? playerPos.x : 0;
  const anchorZ = playerPos ? playerPos.z : 0;
  mgr.celestialRoot.position.set(anchorX, 0, anchorZ);

  mgr.skyUniforms.uZenithColor.value.copy(s.zenith);
  mgr.skyUniforms.uMidColor.value.copy(s.mid);
  mgr.skyUniforms.uHorizonColor.value.copy(s.horizon);
  mgr.skyUniforms.uSunGlowColor.value.copy(s.sunGlow);
  mgr.skyUniforms.uSunDir.value.copy(mgr._sunDir);
  const isGoldenHour = mgr.timeHours >= 16.4 && mgr.timeHours <= 18.85;
  const isSunrise = mgr.timeHours >= 5.3 && mgr.timeHours <= 7.6;
  const horizonWarmth = Math.exp(-Math.pow((sunY - 0.06) / 0.22, 2));
  const dayLift = THREE.MathUtils.smoothstep(sunY, -0.14, 0.35);
  mgr.skyUniforms.uGlowStrength.value = 0.06 + dayLift * 0.14 + horizonWarmth * 0.12;

  if (mgr.scene.fog) {
    mgr.scene.fog.color.copy(s.horizon);
  }
  if (mgr.scene.background && mgr.scene.background.isColor) {
    mgr.scene.background.copy(s.horizon);
  }

  // Disco Solar (transição suave de opacidade no horizonte — zero corte brusco de 1 frame!)
  const sunVisFade = THREE.MathUtils.smoothstep(sunY, -0.14, 0.04);
  mgr.sunDiscGroup.visible = sunVisFade > 0.005;
  if (mgr.sunDiscGroup.visible) {
    mgr.sunDiscGroup.position.copy(mgr._sunDir).multiplyScalar(5850 * WORLD_SCALE);
    const sunScale = isGoldenHour || isSunrise ? 1.48 : 1.0;
    mgr.sunDiscGroup.scale.setScalar(sunScale);
    mgr.sunCoreMat.color.copy(isGoldenHour ? s.sunGlow : s.dirColor);
    mgr.sunCoreMat.opacity = sunVisFade;
    mgr.sunHaloMat.color.copy(s.sunGlow);
    mgr.sunHaloMat.opacity = (isGoldenHour ? 0.38 : 0.24) * sunVisFade;
  }

  // Lua Cheia LEGO + 1.200 Estrelas Cintilantes
  mgr.moonGroup.visible = nf > 0.06;
  if (mgr.moonGroup.visible) {
    mgr.moonGroup.position.copy(mgr._moonDir).multiplyScalar(5650 * WORLD_SCALE);
    mgr.moonGroup.lookAt(anchorX, 0, anchorZ);
    mgr.moonCoreMat.opacity = nf;
    mgr.moonCraterMat.opacity = nf * 0.75;
    mgr.moonHaloMat.opacity = nf * 0.42;
  }

  mgr.starPoints.visible = nf > 0.08;
  if (mgr.starPoints.visible) {
    const twinkle = 0.88 + Math.sin(mgr._animTime * 2.2) * 0.12;
    mgr.starMat.opacity = Math.max(0, (nf - 0.08) / 0.92) * 0.92 * twinkle;
    mgr.starPoints.rotation.y += dt * 0.004;
  }

  // 3) Atualiza Luz Direcional (Sol de dia / Pôr do Sol longo / Lua Cheia à noite!) + HemisphereLight
  if (mgr.hemiLight) {
    mgr.hemiLight.color.copy(s.hemiSky);
    mgr.hemiLight.groundColor.copy(s.hemiGnd);
    mgr.hemiLight.intensity = s.hemiInt;
  }

  if (mgr.scene && typeof mgr.scene.environmentIntensity === 'number') {
    const sY = mgr._sunDir.y;
    const envInt =
      sY >= 0.12
        ? THREE.MathUtils.lerp(0.38, 0.6, THREE.MathUtils.clamp((sY - 0.12) / 0.4, 0, 1))
        : THREE.MathUtils.lerp(0.14, 0.38, THREE.MathUtils.clamp((sY + 0.16) / 0.28, 0, 1));
    mgr.scene.environmentIntensity = Number(envInt.toFixed(3));
  }

  if (mgr.sunLight) {
    mgr.sunLight.color.copy(s.dirColor);
    mgr.sunLight.intensity = s.dirInt;

    const activeLightDir = sunY > 0.06 ? mgr._sunDir : mgr._moonDir;
    mgr._lightOrbitDir.copy(activeLightDir);
    mgr._lightOrbitDir.y = Math.max(0.22, mgr._lightOrbitDir.y); // Sombras longas lindas no pôr do sol sem achatar!
    mgr._lightOrbitDir.normalize();

    const shadowCam = mgr.sunLight.shadow?.camera;
    const desiredHalf =
      controller?.isFlying || (playerPos && playerPos.y > 45) ? 150 : 95;
    if (shadowCam && shadowCam.right !== desiredHalf) {
      shadowCam.left = -desiredHalf;
      shadowCam.right = desiredHalf;
      shadowCam.top = desiredHalf;
      shadowCam.bottom = -desiredHalf;
      shadowCam.updateProjectionMatrix();
    }

    const rawX = playerPos ? playerPos.x : 0;
    const rawY = playerPos ? playerPos.y : 0;
    const rawZ = playerPos ? playerPos.z : 0;

    // Texel snapping ortográfico: elimina shimmer das bordas das sombras ao mover
    if (!mgr._snapRight) {
      mgr._snapRight = new THREE.Vector3();
      mgr._snapUp = new THREE.Vector3();
    }
    mgr._snapRight.set(0, 1, 0).cross(mgr._lightOrbitDir);
    if (mgr._snapRight.lengthSq() > 1e-6) {
      mgr._snapRight.normalize();
    } else {
      mgr._snapRight.set(1, 0, 0);
    }
    mgr._snapUp.copy(mgr._lightOrbitDir).cross(mgr._snapRight).normalize();

    const mapRes = Math.max(256, mgr.sunLight.shadow?.mapSize?.width || 2048);
    const texelWorld = (desiredHalf * 2) / mapRes;
    mgr.sunLight.shadow.normalBias = Math.max(0.05, texelWorld * 0.48);
    mgr.sunLight.shadow.bias = -0.0005;
    const u = rawX * mgr._snapRight.x + rawY * mgr._snapRight.y + rawZ * mgr._snapRight.z;
    const v = rawX * mgr._snapUp.x + rawY * mgr._snapUp.y + rawZ * mgr._snapUp.z;
    const w =
      rawX * mgr._lightOrbitDir.x +
      rawY * mgr._lightOrbitDir.y +
      rawZ * mgr._lightOrbitDir.z;
    const su = Math.floor(u / texelWorld + 0.5) * texelWorld;
    const sv = Math.floor(v / texelWorld + 0.5) * texelWorld;

    const targetX = mgr._snapRight.x * su + mgr._snapUp.x * sv + mgr._lightOrbitDir.x * w;
    const targetY = mgr._snapRight.y * su + mgr._snapUp.y * sv + mgr._lightOrbitDir.y * w;
    const targetZ = mgr._snapRight.z * su + mgr._snapUp.z * sv + mgr._lightOrbitDir.z * w;

    mgr.sunLight.position.set(
      targetX + mgr._lightOrbitDir.x * 260,
      targetY + mgr._lightOrbitDir.y * 260,
      targetZ + mgr._lightOrbitDir.z * 260
    );
    mgr.sunLight.target.position.set(targetX, targetY, targetZ);
    mgr.sunLight.target.updateMatrixWorld();
  }
}

export function updateCityEmissivesLampsAndLandmarks(mgr, dt, nf) {
  // 4) Iluminação Artificial dos 135 Arranha-Céus (emissiveMap) e da Favela CDD ("Presépio Urbano" até 1.6!)
  const facadeMats = getCachedFacadeMaterials();
  const skyWinIntensity = nf * 1.45;
  for (let i = 0; i < facadeMats.length; i++) {
    facadeMats[i].emissiveIntensity = skyWinIntensity;
  }
  if (Array.isArray(mgr.world.southBeachEmissiveMats)) {
    for (let i = 0; i < mgr.world.southBeachEmissiveMats.length; i++) {
      mgr.world.southBeachEmissiveMats[i].emissiveIntensity = skyWinIntensity;
    }
  }

  if (mgr.world.favelaEmissiveMats) {
    const favWinInt = nf * 1.6;
    for (const m of mgr.world.favelaEmissiveMats.windows) {
      if (m) m.emissiveIntensity = favWinInt;
    }
    for (const m of mgr.world.favelaEmissiveMats.bulbs) {
      if (m) m.emissiveIntensity = 0.2 + nf * 1.8;
    }
  }

  // 5) Postes Instanciados (Avenidas, Favela, Viadutos, Pontes, Píer, Metrô) + Marcos da CDD e Orla
  const lampRamp = THREE.MathUtils.smoothstep(nf, 0.32, 1.0);
  const lampsOn = nf > 0.05;
  mgr.bulbInstMesh.visible = lampsOn;
  mgr.coneInstMesh.visible = lampsOn;
  mgr.poolInstMesh.visible = lampsOn;
  if (lampsOn) {
    mgr.coneInstMat.opacity = lampRamp * 0.24;
    mgr.poolInstMat.opacity = lampRamp * 0.36;
  }

  // Campinho da CDD (4 Refletores), Baile do Morro (3 Skytrackers giratórios) & Luzes Aeronáuticas no Topo!
  if (Array.isArray(mgr.world.favelaSoccerFloodCones)) {
    for (const fc of mgr.world.favelaSoccerFloodCones) {
      fc.mesh.visible = nf > 0.08;
      fc.mat.opacity = lampRamp * 0.22;
    }
  }
  if (Array.isArray(mgr.world.favelaBaileSkytrackers)) {
    for (const st of mgr.world.favelaBaileSkytrackers) {
      st.pivot.visible = nf > 0.08;
      if (st.pivot.visible) {
        st.mat.opacity = lampRamp * 0.26;
        st.pivot.rotation.z = Math.sin(mgr._animTime * 0.9 + st.phase) * 0.38;
        st.pivot.rotation.x = Math.cos(mgr._animTime * 0.72 + st.phase) * 0.32;
      }
    }
  }
  if (Array.isArray(mgr.world.favelaSummitBeacons)) {
    for (const sb of mgr.world.favelaSummitBeacons) {
      const blink = Math.sin(mgr._animTime * 5.2 + sb.phase) > -0.15;
      sb.group.visible = nf > 0.05 ? blink : true;
      sb.haloMat.opacity = nf > 0.05 && blink ? 0.85 : 0.15;
    }
  }

  for (const mat of mgr.landmarkNeonMaterials) {
    mat.opacity = lampRamp * (mat.userData.maxOpacity || 0.28);
  }

  const hcFx = mgr.world?.helicarrierNightFX;
  if (hcFx) {
    const pulse = 0.5 + 0.5 * Math.sin(mgr._animTime * 4.2);
    const blink = Math.sin(mgr._animTime * 5.0) > 0.15;
    for (const m of hcFx.bridgeWindowMats || []) {
      if (m && 'emissiveIntensity' in m) {
        m.emissiveIntensity = 0.32 + nf * 1.15;
      }
    }
    for (const m of hcFx.deckStripMats || []) {
      if (m?.color) {
        const b = 0.58 + nf * 0.42 * (0.85 + 0.15 * pulse);
        m.color.setRGB(b, b, b);
      }
    }
    for (const m of hcFx.hangarGlowMats || []) {
      if (m?.color) {
        m.color.setHSL(0.55, 0.9, 0.38 + nf * 0.24 * (0.8 + 0.2 * pulse));
      }
    }
    for (const bMesh of hcFx.beaconMeshes || []) {
      if (bMesh) {
        bMesh.visible = nf > 0.08 ? blink : pulse > 0.35;
      }
    }
    for (const m of hcFx.plasmaMats || []) {
      if (m?.color) {
        m.color.setHSL(0.52, 1.0, 0.45 + 0.15 * pulse + nf * 0.1);
      }
    }
  }

  for (const lb of mgr.lighthouseBeams) {
    lb.pivot.visible = nf > 0.1;
    if (lb.pivot.visible) {
      lb.pivot.rotation.y += dt * lb.speed;
    }
  }

  return lampRamp;
}
