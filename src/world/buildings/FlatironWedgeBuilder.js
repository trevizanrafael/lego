import * as THREE from 'three';
import { mergeBufferGeometries, makeTranslatedBox } from './GeometryMergeUtils.js';
import {
  BUILDING_STYLES,
  getFacadeMaterial,
  getFastStandardMaterial
} from './BuildingStylesAndFacades.js';
import { localToWorldXZ } from './LotGeometry2D.js';
import { IS_SCALED_WORLD } from '../core/WorldLayoutScale.js';

function createWedgePrismGeometry(backW, noseW, length, y0, tierH, scaleFactor = 1.0) {
  const bw = backW * scaleFactor;
  const nw = Math.max(3.2, noseW * scaleFactor);
  const len = length * scaleFactor;
  const hz = len * 0.5;
  const hBack = bw * 0.5;
  const hNose = nw * 0.5;

  // Polígono da base chanfrada (proa apontando para +Z local)
  const pts = [
    [-hBack, -hz],
    [hBack, -hz],
    [hNose, hz - 1.4 * scaleFactor],
    [hNose * 0.52, hz],
    [-hNose * 0.52, hz],
    [-hNose, hz - 1.4 * scaleFactor]
  ];

  const positions = [];
  const normals = [];
  const uvs = [];

  // 1) Paredes laterais com UVs contínuos para janelas acesas (1 repetição a cada ~22m H x ~38m V)
  let perim = 0;
  for (let i = 0; i < pts.length; i++) {
    const [xA, zA] = pts[i];
    const [xB, zB] = pts[(i + 1) % pts.length];
    const dx = xB - xA;
    const dz = zB - zA;
    const segLen = Math.hypot(dx, dz) || 1;
    // Normal externa no plano XZ (pts em sentido anti-horário visto de +Y -> normal externa = (-dz, 0, dx) ou (dz, 0, -dx))
    // Verificação: de (-hBack,-hz) para (+hBack,-hz), dx > 0, dz = 0 -> face traseira aponta para -Z: (dz, 0, -dx)/segLen = (0, 0, -1)!
    const nx = dz / segLen;
    const nz = -dx / segLen;

    const u0 = perim / 22.0;
    const u1 = (perim + segLen) / 22.0;
    const v0 = 0;
    const v1 = tierH / 38.0;
    perim += segLen;

    const yTop = y0 + tierH;

    // Triângulo 1 (ordem anti-horária olhando de fora da face)
    positions.push(xA, y0, zA, xB, y0, zB, xB, yTop, zB);
    normals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz);
    uvs.push(u0, v0, u1, v0, u1, v1);

    // Triângulo 2
    positions.push(xA, y0, zA, xB, yTop, zB, xA, yTop, zA);
    normals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz);
    uvs.push(u0, v0, u1, v1, u0, v1);
  }

  // 2) Tampa superior (+Y) e inferior (-Y) em leque convexo a partir do centroide (0, 0)
  const yTop = y0 + tierH;
  for (let i = 0; i < pts.length; i++) {
    const [xA, zA] = pts[i];
    const [xB, zB] = pts[(i + 1) % pts.length];

    // Topo (+Y): (0, zA..zB) anti-horário visto de cima = (0, yTop, 0) -> (xB, yTop, zB) -> (xA, yTop, zA)
    positions.push(0, yTop, 0, xB, yTop, zB, xA, yTop, zA);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    uvs.push(0.02, 0.01, 0.04, 0.01, 0.02, 0.02);

    // Base (-Y)
    positions.push(0, y0, 0, xA, y0, zA, xB, y0, zB);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
    uvs.push(0.02, 0.01, 0.02, 0.02, 0.04, 0.01);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return { geo, pts };
}

/**
 * Constrói um Arranha-Céu Triangular / Cunha Art-Deco ("Flatiron Building")
 * nas esquinas agudas onde avenidas diagonais cortam a malha urbana!
 */
export function buildFlatironWedgeBuilding(world, cfg = {}) {
  const {
    cx,
    cz,
    backWidth = 34,
    noseWidth = 6.2,
    length = 54,
    height = 132,
    rotY = 0,
    styleKey = 'black_granite_gold',
    seed = 1,
    spire = true,
    registerMap = true
  } = cfg;

  const style = BUILDING_STYLES[styleKey] || BUILDING_STYLES.black_granite_gold;
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0;
  const defaultPad = IS_SCALED_WORLD && world?._urbanBlockGrid ? 0.02 : 0.28;
  const yBase = cfg.yBase ?? (terrainY + defaultPad);
  const facadeMat = getFacadeMaterial(styleKey, seed);

  const tier1H = Math.round(height * 0.72 * 10) / 10;
  const tier2H = Math.round(height * 0.16 * 10) / 10;
  const tier3H = Math.max(3.0, height - tier1H - tier2H);
  const tier2TopY = tier1H + tier2H;

  const p1 = createWedgePrismGeometry(backWidth, noseWidth, length, 0, tier1H, 1.0);
  const p2 = createWedgePrismGeometry(backWidth, noseWidth, length, tier1H, tier2H, 0.80);
  const p3 = createWedgePrismGeometry(backWidth, noseWidth, length, tier2TopY, tier3H, 0.62);
  const bodyGeo = mergeBufferGeometries([p1.geo, p2.geo, p3.geo]);
  p1.geo.dispose();
  p2.geo.dispose();
  p3.geo.dispose();

  // Acabamentos Art-Deco (cornijas triangulares, coluna de proa, mureta de coroamento e pináculo)
  const trimGeos = [];
  const skirtDepth = 6.5;
  const baseSkirt = createWedgePrismGeometry(backWidth + 0.8, noseWidth + 0.7, length + 0.8, -skirtDepth, skirtDepth + 0.1, 1.0);
  trimGeos.push(baseSkirt.geo);

  for (let cy = 22; cy < tier1H - 4; cy += 26) {
    trimGeos.push(createWedgePrismGeometry(backWidth + 1.1, noseWidth + 0.9, length + 1.1, cy - 0.45, 0.9, 1.0).geo);
  }
  trimGeos.push(
    createWedgePrismGeometry(backWidth + 1.3, noseWidth + 1.0, length + 1.3, tier1H - 0.55, 1.1, 1.0).geo,
    createWedgePrismGeometry(backWidth + 1.1, noseWidth + 0.9, length + 1.1, tier2TopY - 0.45, 0.9, 0.80).geo,
    createWedgePrismGeometry(backWidth + 0.9, noseWidth + 0.8, length + 0.9, height, 1.45, 0.62).geo
  );

  // Coluna cilíndrica monumental na proa aguda do Flatiron
  const prowZ = length * 0.5 - 0.6;
  const prowCol = new THREE.CylinderGeometry(noseWidth * 0.34, noseWidth * 0.38, tier1H, 10);
  prowCol.translate(0, tier1H * 0.5, prowZ);
  trimGeos.push(prowCol);

  const spireH = spire ? 22 : 0;
  if (spire) {
    const mastZ = length * 0.12;
    const spireBase = new THREE.ConeGeometry(Math.min(2.6, backWidth * 0.08), spireH * 0.36, 6);
    spireBase.translate(0, height + spireH * 0.18, mastZ);
    const spireMast = new THREE.CylinderGeometry(0.15, 0.44, spireH, 6);
    spireMast.translate(0, height + spireH * 0.5, mastZ);
    trimGeos.push(spireBase, spireMast);
  }

  const mergedTrimGeo = mergeBufferGeometries(trimGeos);
  for (let i = 0; i < trimGeos.length; i++) trimGeos[i].dispose();

  const baseH = Math.min(6.6, height * 0.25);
  const groundWedge = createWedgePrismGeometry(backWidth + 0.55, noseWidth + 0.5, length + 0.55, 0, baseH, 1.0);
  const lod1Geo = createWedgePrismGeometry(backWidth, noseWidth, length, 0, height, 0.94).geo;
  const lod2Geo = createWedgePrismGeometry(backWidth, noseWidth, length, 0, height, 0.92).geo;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  // Colisores OBB compostos acompanhando o afunilamento da cunha + degraus superiores
  if (cfg.collide !== false && typeof world.addObbCollider === 'function') {
    const minY0 = Math.max(0, yBase - skirtDepth);
    const addTierWedgeColliders = (yBottom, yTop, scale) => {
      const lenS = length * scale;
      const slices = [
        [-0.33, 0.34],
        [0.0, 0.34],
        [0.31, 0.32]
      ];
      for (const [uCenter, uSpan] of slices) {
        const t = uCenter + 0.5; // 0 = fundo (-Z), 1 = proa (+Z)
        const sliceW = THREE.MathUtils.lerp(backWidth * scale, Math.max(3.4, noseWidth * scale), t);
        const sliceD = lenS * uSpan;
        const localZ = uCenter * lenS;
        const wp = localToWorldXZ(cx, cz, 0, localZ, cosY, sinY);
        world.addObbCollider(wp.x, wp.z, sliceW, sliceD, rotY, yTop, yBottom);
      }
    };

    addTierWedgeColliders(minY0, yBase + tier1H, 1.0);
    addTierWedgeColliders(yBase + tier1H, yBase + tier2TopY, 0.80);
    addTierWedgeColliders(yBase + tier2TopY, yBase + height + 1.45, 0.62);

    if (typeof world.addCylinderCollider === 'function') {
      const noseWp = localToWorldXZ(cx, cz, 0, prowZ, cosY, sinY);
      world.addCylinderCollider(noseWp.x, noseWp.z, Math.max(1.8, noseWidth * 0.42), yBase + tier1H, minY0);
      if (spire) {
        const spireWp = localToWorldXZ(cx, cz, 0, length * 0.12, cosY, sinY);
        world.addCylinderCollider(spireWp.x, spireWp.z, 0.85, yBase + height + spireH, yBase + height);
      }
    }
  }

  // Registro poligonal para o Minimapa 4096px e Mapa Tático [M]
  if (registerMap && Array.isArray(world.mapBuildings)) {
    const polygon = p1.pts.map(([lx, lz]) => {
      const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
      return [wp.x, wp.z];
    });
    world.mapBuildings.push({
      x: cx,
      z: cz,
      w: backWidth,
      d: length,
      rotY,
      polygon,
      isFlatiron: true,
      height,
      styleKey,
      color: cfg.mapColor || style.mapColor,
      label: cfg.label || null
    });
  }

  if (world._buildingLodBatcher && cfg.batch !== false) {
    world._buildingLodBatcher.addDetailedBuildingEntry({
      cx,
      cz,
      yBase,
      rotY,
      styleKey,
      style,
      facadeMat,
      bodyGeo,
      trimGeo: mergedTrimGeo,
      groundGeo: groundWedge.geo,
      w: backWidth,
      h: height,
      d: length,
      useArtDecoSetbacks: true,
      tier1H,
      topCrownW: backWidth * 0.62,
      topCrownD: length * 0.62,
      lod1CustomGeo: lod1Geo,
      lod2CustomGeo: lod2Geo
    });
    return null;
  }

  lod1Geo.dispose();
  lod2Geo.dispose();
  const group = new THREE.Group();
  group.position.set(cx, yBase, cz);
  group.rotation.y = rotY;
  group.userData = { isDetailedBuilding: true, isFlatiron: true, styleKey, height, width: backWidth, depth: length };

  const bodyMesh = new THREE.Mesh(bodyGeo, facadeMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  const trimMesh = new THREE.Mesh(mergedTrimGeo, getFastStandardMaterial(style.pillarHex, 0.28, 0.18));
  trimMesh.receiveShadow = true;
  const groundMesh = new THREE.Mesh(groundWedge.geo, getFastStandardMaterial(style.baseHex, 0.32, 0.1));
  groundMesh.receiveShadow = true;
  group.add(bodyMesh, trimMesh, groundMesh);
  world.scene.add(group);
  return group;
}
