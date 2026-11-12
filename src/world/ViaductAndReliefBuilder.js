import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from './BuildingGenerator.js';
import { createSignBoardMesh } from '../utils/SignBoardHelper.js';
import { buildProfileRibbon, buildGradedProfile, sampleProfile } from './ViaductGeometry.js';
import {
  findPortalColumns,
  makeFootingLookup,
  isBuildingAt,
  isInsideAnyRoad,
  onCrossRoad
} from './StreetPortalPlanner.js';

function smoothstep01(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function cosineStep01(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return 0.5 * (1 - Math.cos(Math.PI * c));
}

/**
 * Máscara suave de proteção de pisos internos/sensíveis que devem permanecer em Y = 0.0m:
 * Retorna 0.0 dentro do retângulo interno e sobe suavemente até 1.0 na margem externa `margin`.
 */
function rectFlatKeepoutFactor(x, z, minX, maxX, minZ, maxZ, margin = 24) {
  const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
  const dist = Math.hypot(dx, dz);
  if (dist <= 0.001) return 0;
  if (dist >= margin) return 1;
  return cosineStep01(dist / margin);
}

// ============================================================================
// 1. FUNÇÕES MATEMÁTICAS DE RELEVO URBANO VISÍVEL NAS RUAS E AVENIDAS (6° A 11°!)
// ============================================================================

/**
 * 1.1 Subúrbio Norte em Ladeiras Marcantes & Mirante Costeiro (`Z = -520..-1320`, `X = -658..+538`):
 * - Sobe logo nas primeiras 2 quadras (`Z = -520 -> -780`) para **`+12.0m`** (ladeira nítida ao dirigir!),
 *   e continua subindo até **`+22.0m`** no Mirante Costeiro Norte (`Z = -1240..-1320`)!
 */
export function getNorthSuburbPlateauY(x, z) {
  if (z >= -520 || z < -1324 || x <= -658 || x >= 540.5) return 0;

  let baseH = 0;
  if (z >= -780) {
    // Primeiras 2 quadras (-520 -> -780): sobe firme para +12.0m!
    const tEarly = cosineStep01((-520 - z) / 260.0);
    baseH = 12.0 * tEarly;
  } else {
    // De -780 (+12.0m) até -1245 (+22.0m no Mirante Costeiro Norte!)
    const tLate = cosineStep01((-780 - z) / (-780 - -1245));
    baseH = 12.0 + 10.0 * tLate;
  }

  let wx = 1.0;
  if (x < -636) {
    wx = smoothstep01((x - -658) / 22.0);
  } else if (x > 514) {
    wx = 1.0 - smoothstep01((x - 514) / 26.0);
  }

  const wave = 1.0 + 0.05 * Math.cos((x / 260) * Math.PI);
  return Math.min(22.4, baseH * wx * wave);
}

/**
 * 1.2 Alto do Centro — Distrito Noroeste & Nordeste (`Z = -515..-232`):
 * - Ladeiras marcantes subindo a **`+12.5m..+15.0m`** nas avenidas Norte-Sul (`X = -384, -252, +252, +384`),
 *   fazendo os carros subirem e descerem morros urbanos reais estilo São Francisco / Rio!
 */
export function getNorthwestDowntownHillY(x, z) {
  if (z < -535 || z > -228) return 0;

  let h = 0;

  // A) Colina Urbana Noroeste (Avenidas X = -384 e X = -252, Z = -495..-235 -> Pico +15.0m!)
  if (x >= -512 && x <= -88) {
    const dNW1 = Math.hypot((x - -324) / 228, (z - -386) / 132);
    if (dNW1 < 1) {
      h = Math.max(h, cosineStep01(1 - dNW1) * 15.0);
    }
    const dNW2 = Math.hypot((x - -248) / 155, (z - -312) / 80);
    if (dNW2 < 1) {
      h = Math.max(h, cosineStep01(1 - dNW2) * 13.4);
    }
  }

  // B) Colina Urbana Nordeste (Avenidas X = +252 e X = +384, Z = -495..-235 -> Pico +14.8m!)
  if (x >= 112 && x <= 515) {
    const dNE1 = Math.hypot((x - 324) / 228, (z - -382) / 130);
    if (dNE1 < 1) {
      h = Math.max(h, cosineStep01(1 - dNE1) * 14.8);
    }
    const dNE2 = Math.hypot((x - 256) / 152, (z - -308) / 78);
    if (dNE2 < 1) {
      h = Math.max(h, cosineStep01(1 - dNE2) * 13.2);
    }
  }

  return h;
}

/**
 * 1.2B Colina da Bela Vista / Centro Leste (`X = +130..+495, Z = -220..+120` -> **`+9.5m`**):
 * - Faz as avenidas `Z = -117` e `Z = 0` do lado Leste subirem e descerem visivelmente!
 */
export function getEastDowntownBelaVistaHillY(x, z) {
  if (x <= 125 || x >= 502 || z <= -225 || z >= 125) return 0;

  const dx = (x - 318) / 182.0;
  const dz = (z - -52) / 162.0;
  const d = Math.hypot(dx, dz);
  if (d >= 1.0) return 0;

  // Transição suave antes da Estação Elevada 05 (X = 509, Z = -180) e das Pontes Leste (X >= 526)
  let edgeTaper = 1.0;
  if (x > 462) {
    edgeTaper = 1.0 - smoothstep01((x - 462) / 40.0);
  }
  return cosineStep01(1.0 - d) * 9.6 * edgeTaper;
}

/**
 * 1.3 Crista Panorâmica Sul rumo à Praia (`Z = +406..+722`, `X = -645..+520` -> **`+10.5m`**):
 * - Sobe de `Z = +406` até **`+10.5m`** em `Z ≈ +535` e desce revelando o mar e o Mega Píer até `Z = +710`!
 */
export function getSouthCoastalRidgeY(x, z) {
  if (z <= 406 || z >= 724 || x <= -645 || x >= 522) return 0;

  let profZ = 0;
  if (z <= 535) {
    profZ = cosineStep01((z - 406) / (535 - 406));
  } else if (z <= 710) {
    profZ = THREE.MathUtils.lerp(0.04, 1.0, cosineStep01((710 - z) / (710 - 535)));
  } else {
    profZ = 0.04 * (1.0 - smoothstep01((z - 710) / 14.0));
  }

  let envX = 1.0;
  if (x < -580) envX = smoothstep01((x - -645) / 65);
  else if (x > 465) envX = 1.0 - smoothstep01((x - 465) / 57);

  const gentleWave = 1.0 + 0.05 * Math.sin((x + 180) * 0.008);
  return 10.5 * profZ * envX * gentleWave;
}

/**
 * 1.4 Colinas Verdes em Terraços Orgânicos & Mirante do Parque Central (`X = -486..-68, Z = 158..378`):
 * - Mirante Circular em `Y = +14.0m` (`X = -215, Z = 296`) e Colina Oeste em `Y = +11.4m` (`X = -408, Z = 268`).
 */
export function getCentralParkWestHillsY(x, z) {
  if (x < -486 || x > -68 || z < 158 || z > 378) return 0;

  let h = 0;

  const dx2 = (x - -215) / 62.0;
  const dz2 = (z - 296) / 52.0;
  const d2 = Math.hypot(dx2, dz2);
  if (d2 < 1.0) {
    const flatR = 0.25;
    if (d2 <= flatR) {
      h = Math.max(h, 14.0);
    } else {
      const u = 1.0 - (d2 - flatR) / (1.0 - flatR);
      const smoothH = cosineStep01(u) * 14.0;
      const terraceWave = Math.sin(u * Math.PI * 6.0) * 0.22 * (1 - u * 0.3);
      h = Math.max(h, Math.max(0, smoothH + terraceWave));
    }
  }

  const dx1 = (x - -408) / 54.0;
  const dz1 = (z - 268) / 44.0;
  const d1 = Math.hypot(dx1, dz1);
  if (d1 < 1.0) {
    const flatR1 = 0.22;
    if (d1 <= flatR1) {
      h = Math.max(h, 11.4);
    } else {
      const u1 = 1.0 - (d1 - flatR1) / (1.0 - flatR1);
      h = Math.max(h, cosineStep01(u1) * 11.4);
    }
  }

  if (x >= -408 && x <= -215) {
    const tBridge = (x - -408) / (-215 - -408);
    const bridgeZ = THREE.MathUtils.lerp(268, 296, tBridge);
    const distZ = Math.abs(z - bridgeZ);
    if (distZ < 12.0) {
      const latW = cosineStep01(1.0 - distZ / 12.0);
      const saddleProfile =
        THREE.MathUtils.lerp(11.1, 13.8, smoothstep01(tBridge)) - Math.sin(Math.PI * tBridge) * 2.8;
      h = Math.max(h, saddleProfile * latW);
    }
  }

  if (x >= -205 && x <= -112 && Math.abs(z - 296) < 10.5) {
    const tRamp = smoothstep01((-114 - x) / (-114 - -200));
    const latW = Math.abs(z - 296) <= 5.0 ? 1.0 : cosineStep01(1.0 - (Math.abs(z - 296) - 5.0) / 5.5);
    h = Math.max(h, 14.0 * tRamp * latW);
  }

  if (z >= 230 && z <= 284 && Math.abs(x - -215) < 9.5) {
    const tStair = smoothstep01((z - 232) / (282 - 232));
    const latW = Math.abs(x - -215) <= 4.8 ? 1.0 : cosineStep01(1.0 - (Math.abs(x - -215) - 4.8) / 4.7);
    h = Math.max(h, 14.0 * tStair * latW);
  }

  for (const [gx, gz] of [
    [-355, 212],
    [-355, 324],
    [-135, 212]
  ]) {
    const dg = Math.hypot(x - gx, z - gz);
    if (dg < 19.0) {
      h *= smoothstep01((dg - 12.0) / 7.0);
    }
  }

  return h;
}

/**
 * 1.5 Elevação Industrial Leste (`X = 640..1380, Z = -670..-60` até **`+7.5m`**)
 */
export function getEastIndustrialElevationY(x, z) {
  if (x <= 625 || x >= 1420 || z <= -710 || z >= -45) return 0;

  const envX =
    x < 720
      ? cosineStep01((x - 625) / 95)
      : x > 1280
        ? cosineStep01((1420 - x) / 140)
        : 1.0;
  const envZ =
    z < -580
      ? cosineStep01((z - -710) / 130)
      : z > -165
        ? cosineStep01((-45 - z) / 120)
        : 1.0;

  const ridge = 6.2 + 1.3 * Math.sin((x - 700) * 0.006) * Math.cos((z + 380) * 0.008);
  return Math.min(7.5, Math.max(0, ridge * envX * envZ));
}

/**
 * 1.6 Elevação Costeira & Dunas do Pontal Oeste da Praia (`X = -1350..-760, Z = 780..1010` até **`+8.5m`**)
 */
export function getSouthwestBeachReliefY(x, z) {
  if (x < -1352 || x > -758 || z < 780 || z > 1012) return 0;

  const envX =
    x < -1310
      ? smoothstep01((x - -1352) / 42.0)
      : x > -800
        ? smoothstep01((-758 - x) / 42.0)
        : 1.0;
  const envZ =
    z < 812
      ? smoothstep01((z - 780) / 32.0)
      : z > 980
        ? smoothstep01((1012 - z) / 32.0)
        : 1.0;
  const env = envX * envZ;
  if (env <= 0.001) return 0;

  const duneWave =
    3.1 +
    1.45 * Math.sin((x + 1120) * 0.017) * Math.cos((z - 890) * 0.024) +
    0.95 * Math.cos((x + 920) * 0.029 + (z - 850) * 0.019);

  const rock1 = Math.exp(-(Math.pow((x - -965) / 68, 2) + Math.pow((z - 928) / 44, 2))) * 4.4;
  const rock2 = Math.exp(-(Math.pow((x - -1215) / 74, 2) + Math.pow((z - 898) / 46, 2))) * 3.9;

  return Math.min(8.5, Math.max(0, (duneWave + rock1 + rock2) * env));
}

/**
 * Combina toda a topografia urbana da metrópole preservando estritamente os pisos internos abertos em `Y = 0m`!
 */
export function getUrbanCityReliefY(x, z) {
  // Pista e Terminal do Aeroporto Oeste permanecem 100% nivelados
  if (x <= -1025 && z <= 760) return 0;

  let h = Math.max(
    getNorthSuburbPlateauY(x, z),
    getNorthwestDowntownHillY(x, z),
    getEastDowntownBelaVistaHillY(x, z),
    getSouthCoastalRidgeY(x, z),
    getCentralParkWestHillsY(x, z),
    getEastIndustrialElevationY(x, z),
    getSouthwestBeachReliefY(x, z)
  );
  if (h <= 0.001) return 0;

  // Máscaras enxutas preservando apenas Super Banco + Escadas/Portais do Metrô, Torre dos Heróis, LEGO Customs e Lago!
  h *= rectFlatKeepoutFactor(x, z, -96, 96, -212, 26, 22);
  h *= rectFlatKeepoutFactor(x, z, -372, -264, -234, -126, 22);
  h *= rectFlatKeepoutFactor(x, z, 20, 100, -486, -410, 22);
  h *= rectFlatKeepoutFactor(x, z, -44, 344, 180, 354, 22);

  return h > 0.005 ? h : 0;
}

// ============================================================================
// 2. BATCHER DEDICADO DE VIADUTOS E RELEVO NATURAL (CONTRASTE RODOVIÁRIO + SOMBRAS REAIS!)
// ============================================================================
function createReliefAndViaductBatcher() {
  const palette = {
    // Cinza-rodovia claro e nítido (0x334155) contrastando fortemente com o asfalto escuro térreo!
    viaduct_asphalt: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.62,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    }),
    viaduct_shoulder: getLegoMaterial(0xe2e8f0, { roughness: 0.3, clearcoat: 0.28 }),
    viaduct_concrete: getLegoMaterial(0xcbd5e1, { roughness: 0.32, clearcoat: 0.28 }),
    viaduct_dark_concrete: getLegoMaterial(0x64748b, { roughness: 0.4, clearcoat: 0.22 }),
    viaduct_pillar: getLegoMaterial(0x94a3b8, { roughness: 0.36, clearcoat: 0.24 }),
    safety_yellow: getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.48 }),
    hazard_black: getLegoMaterial(0x0f172a, { roughness: 0.32, clearcoat: 0.3 }),
    highway_green: getLegoMaterial(0x15803d, { roughness: 0.28, clearcoat: 0.38 }),
    steel_pole: getLegoMaterial(0x475569, { roughness: 0.26, metalness: 0.52, clearcoat: 0.5 }),
    brass_gold: getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.18, metalness: 0.7, clearcoat: 0.8 }),
    cliff_rock_dark: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.68, metalness: 0.06 }),
    cliff_rock_mid: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.62, metalness: 0.05 }),
    cliff_rock_light: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.56, metalness: 0.05 }),
    park_turf_top: getLegoMaterial(0x16a34a, { roughness: 0.36, clearcoat: 0.28 }),
    park_turf_mid: getLegoMaterial(0x15803d, { roughness: 0.4, clearcoat: 0.24 }),
    park_stone: getLegoMaterial(0xe2e8f0, { roughness: 0.3, clearcoat: 0.35 }),
    wood_bench: getLegoMaterial(0x78350f, { roughness: 0.42, clearcoat: 0.25 }),
    dune_sand: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.58, metalness: 0.02 }),
    dune_wet: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.52, metalness: 0.04 }),
    lane_white: new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
    lane_yellow: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    lamp_glow: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    sea_foam: new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }

  const studPositionsYellow = [];
  const studPositionsStone = [];

  const pushMatrixTransformedGeo = (key, geo, x, y, z, rotX = 0, rotY = 0, rotZ = 0) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    buckets.get(key).push(geo);
  };

  return {
    studPositionsYellow,
    studPositionsStone,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeTranslatedBox(w, h, d, x, y, z));
    },
    addTiltedBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
      const geo = new THREE.BoxGeometry(w, h, d);
      pushMatrixTransformedGeo(key, geo, x, y, z, rotX, rotY, rotZ);
    },
    addGeometry(key, geo) {
      if (geo) buckets.get(key).push(geo);
    },
    addCylinder(key, rTop, rBot, h, x, y, z, segs = 12, rotX = 0, rotY = 0, rotZ = 0) {
      const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
      pushMatrixTransformedGeo(key, geo, x, y, z, rotX, rotY, rotZ);
    },
    flush(scene) {
      // Sombra real projetada pelos 3 viadutos na avenida térrea lá embaixo!
      const castShadowSet = new Set([
        'viaduct_concrete',
        'viaduct_dark_concrete',
        'viaduct_pillar',
        'safety_yellow',
        'highway_green',
        'cliff_rock_dark',
        'cliff_rock_mid',
        'park_turf_top',
        'park_stone'
      ]);
      for (const [key, geos] of buckets.entries()) {
        if (geos.length === 0) continue;
        const merged = mergeBufferGeometries(geos);
        for (let i = 0; i < geos.length; i++) geos[i].dispose();
        geos.length = 0;
        if (!merged) continue;
        const mat = palette[key];
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = castShadowSet.has(key);
        mesh.receiveShadow = !mat.isMeshBasicMaterial;
        scene.add(mesh);
      }
      buckets.clear();

      const flushStuds = (positions, colorHex) => {
        if (positions.length === 0) return;
        const inst = new THREE.InstancedMesh(
          SHARED_STUD_GEO,
          getLegoMaterial(colorHex, { roughness: 0.25, clearcoat: 0.45 }),
          positions.length
        );
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
          dummy.position.set(positions[i][0], positions[i][1], positions[i][2]);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1.15, 1.15, 1.15);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.receiveShadow = true;
        scene.add(inst);
      };

      flushStuds(studPositionsYellow, 0xfacc15);
      flushStuds(studPositionsStone, 0xcbd5e1);
    }
  };
}

function addOverheadHighwayGantry(world, batcher, x, deckY, z, spanW, axis, signText, subText = '') {
  const halfSpan = spanW * 0.5 + 0.55;
  const gantryH = 6.5;
  const beamY = deckY + gantryH;

  if (axis === 'z_const') {
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x, deckY + gantryH * 0.5, z - halfSpan);
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x, deckY + gantryH * 0.5, z + halfSpan);
    batcher.addBox('steel_pole', 0.85, 0.9, spanW + 1.8, x, beamY, z);
  } else {
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x - halfSpan, deckY + gantryH * 0.5, z);
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x + halfSpan, deckY + gantryH * 0.5, z);
    batcher.addBox('steel_pole', spanW + 1.8, 0.9, 0.85, x, beamY, z);
  }

  const boardW = Math.min(13.6, spanW - 2.0);
  const boardH = 2.65;
  const signMesh = createSignBoardMesh({
    x,
    y: beamY + 0.18,
    z,
    width: boardW,
    height: boardH,
    depth: 0.55,
    rotY: axis === 'z_const' ? Math.PI / 2 : 0,
    title: signText,
    subText,
    bgColor: '#14532d',
    borderColor: '#f8fafc',
    topStripeColor: '#facc15',
    textColor: '#ffffff',
    subColor: '#fde047',
    doubleSided: true
  });
  world.scene.add(signMesh);
}

// ============================================================================
// 3. FALÉSIAS COSTEIRAS NORTE (+22.0m), COLINAS DO PARQUE (+14.0m) & DUNAS SUL
// ============================================================================

function buildNorthSuburbCoastalAndRiverCliffs(world, batcher) {
  let rockIdx = 0;
  for (let x = -650; x <= 534; x += 14) {
    const topY = getNorthSuburbPlateauY(x, -1318);
    if (topY < 1.0) continue;
    const hMain = topY + 2.4;
    const key1 = rockIdx % 2 === 0 ? 'cliff_rock_dark' : 'cliff_rock_mid';
    const key2 = rockIdx % 3 === 0 ? 'cliff_rock_light' : 'cliff_rock_mid';

    batcher.addBox(key1, 14.5, hMain, 5.8, x, topY - hMain * 0.5, -1320.2);
    batcher.addBox(
      key2,
      11.4,
      hMain * 0.62,
      4.0,
      x + ((rockIdx % 3) - 1) * 1.4,
      hMain * 0.31 - 0.8,
      -1323.6
    );
    batcher.addBox('cliff_rock_dark', 8.6, 2.8, 3.4, x - 1.2, 0.5, -1325.8);
    batcher.addBox('sea_foam', 14.2, 0.14, 2.4, x, -0.36, -1327.2);

    batcher.addBox('viaduct_concrete', 14.2, 1.08, 1.1, x, topY + 0.54, -1318.2);
    for (let sx = x - 5.0; sx <= x + 5.0; sx += 2.5) {
      batcher.studPositionsStone.push([sx, topY + 1.14, -1318.2]);
    }
    world.addCollider(x, -1318.5, 14.2, 1.8, topY + 1.25, topY - 1.5);
    rockIdx++;
  }

  for (let z = -546; z >= -1316; z -= 14) {
    const topY = getNorthSuburbPlateauY(534, z);
    if (topY < 0.6) continue;
    const hMain = topY + 2.4;
    const key1 = rockIdx % 2 === 0 ? 'cliff_rock_mid' : 'cliff_rock_dark';

    batcher.addBox(key1, 5.4, hMain, 14.5, 539.8, topY - hMain * 0.5, z);
    batcher.addBox('cliff_rock_light', 3.4, hMain * 0.56, 10.8, 542.6, hMain * 0.28 - 0.8, z);
    batcher.addBox('viaduct_concrete', 1.1, 1.05, 14.2, 538.2, topY + 0.52, z);
    for (let sz = z - 5.0; sz <= z + 5.0; sz += 2.5) {
      batcher.studPositionsStone.push([538.2, topY + 1.12, sz]);
    }
    world.addCollider(538.4, z, 1.8, 14.2, topY + 1.25, topY - 1.5);
    rockIdx++;
  }
}

function buildCentralParkHillsAndMirante(world, batcher) {
  const minX = -480;
  const maxX = -98;
  const minZ = 166;
  const maxZ = 370;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(width, depth, 92, 52);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLowGrass = new THREE.Color(0x15803d);
  const cMidGrass = new THREE.Color(0x16a34a);
  const cHighGrass = new THREE.Color(0x22c55e);
  const cStonePath = new THREE.Color(0xcbd5e1);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = getUrbanCityReliefY(vx, vz);
    if (vy <= 0.36) {
      pos.setY(i, 0.26);
      colors[i * 3] = cLowGrass.r;
      colors[i * 3 + 1] = cLowGrass.g;
      colors[i * 3 + 2] = cLowGrass.b;
    } else {
      pos.setY(i, vy + 0.04);
      const isRamp =
        (vx >= -202 && vx <= -114 && Math.abs(vz - 296) < 5.2) ||
        (vz >= 232 && vz <= 282 && Math.abs(vx - -215) < 5.0);
      if (isRamp) {
        tmp.copy(cStonePath);
      } else if (vy > 9.5) {
        tmp.copy(cMidGrass).lerp(cHighGrass, Math.min(1, (vy - 9.5) / 4.5));
      } else {
        tmp.copy(cLowGrass).lerp(cMidGrass, vy / 9.5);
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const hillMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.03
    })
  );
  hillMesh.receiveShadow = true;
  hillMesh.castShadow = true;
  world.scene.add(hillMesh);

  const addHillTerraceRings = (cx, cz, rx, rz, levels) => {
    for (const lv of levels) {
      const segs = 22;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2;
        const px = cx + Math.cos(ang) * rx * lv.scale;
        const pz = cz + Math.sin(ang) * rz * lv.scale;
        if (Math.abs(px - -215) < 8.5 && pz < cz) continue;
        if (px > cx + 8 && Math.abs(pz - 296) < 8.5) continue;
        const ty = getUrbanCityReliefY(px, pz);
        if (ty < 1.5) continue;
        batcher.addBox('cliff_rock_mid', 6.8, 1.55, 6.8, px, ty - 0.58, pz);
        batcher.addBox('park_turf_top', 7.2, 0.38, 7.2, px, ty + 0.08, pz);
        batcher.studPositionsStone.push([px, ty + 0.32, pz]);
      }
    }
  };
  addHillTerraceRings(-408, 268, 50, 40, [{ scale: 0.8 }, { scale: 0.54 }]);
  addHillTerraceRings(-215, 296, 58, 48, [{ scale: 0.82 }, { scale: 0.58 }, { scale: 0.4 }]);

  for (let z = 233; z <= 281; z += 2.2) {
    const sy = getUrbanCityReliefY(-215, z);
    batcher.addBox('park_stone', 9.2, 0.48, 2.35, -215, sy - 0.1, z);
    batcher.addBox('cliff_rock_light', 0.65, 0.88, 2.35, -215 - 4.7, sy + 0.32, z);
    batcher.addBox('cliff_rock_light', 0.65, 0.88, 2.35, -215 + 4.7, sy + 0.32, z);
  }
  for (let x = -116; x >= -198; x -= 3.0) {
    const ry = getUrbanCityReliefY(x, 296);
    batcher.addBox('park_stone', 3.2, 0.45, 9.2, x, ry - 0.08, 296);
    batcher.addBox('cliff_rock_light', 3.2, 0.82, 0.65, x, ry + 0.3, 296 - 4.7);
    batcher.addBox('cliff_rock_light', 3.2, 0.82, 0.65, x, ry + 0.3, 296 + 4.7);
  }

  const mx = -215;
  const mz = 296;
  const my = 14.0;
  const miranteR = 14.2;

  batcher.addCylinder('park_stone', miranteR, miranteR + 1.0, 0.6, mx, my + 0.14, mz, 28);
  batcher.addCylinder('brass_gold', 4.8, 4.8, 0.64, mx, my + 0.17, mz, 20);
  batcher.addCylinder('viaduct_dark_concrete', 2.5, 2.5, 0.68, mx, my + 0.19, mz, 16);

  const railSegs = 24;
  for (let i = 0; i < railSegs; i++) {
    const ang = (i / railSegs) * Math.PI * 2;
    const rx = mx + Math.cos(ang) * (miranteR - 0.7);
    const rz = mz + Math.sin(ang) * (miranteR - 0.7);
    if (Math.hypot(rx - (mx + miranteR - 0.7), rz - mz) < 4.8) continue;
    if (Math.hypot(rx - mx, rz - (mz - miranteR + 0.7)) < 4.8) continue;

    batcher.addBox('park_stone', 2.6, 1.05, 2.6, rx, my + 0.85, rz);
    batcher.studPositionsStone.push([rx, my + 1.44, rz]);
    world.addCollider(rx, rz, 2.4, 2.4, my + 1.45, my);
  }

  const telescopes = [
    { x: mx + 9.6, z: mz - 5.4, rotY: Math.PI * 0.35 },
    { x: mx + 9.6, z: mz + 5.4, rotY: Math.PI * 0.62 },
    { x: mx - 7.0, z: mz - 8.6, rotY: -Math.PI * 0.78 }
  ];
  for (const tel of telescopes) {
    batcher.addCylinder('steel_pole', 0.18, 0.28, 1.35, tel.x, my + 1.05, tel.z, 10);
    batcher.addCylinder('brass_gold', 0.26, 0.26, 0.24, tel.x, my + 1.75, tel.z, 10);
    batcher.addTiltedBox('brass_gold', 0.32, 0.32, 1.35, tel.x, my + 1.98, tel.z, -0.14, tel.rotY, 0);
    batcher.addTiltedBox(
      'steel_pole',
      0.38,
      0.38,
      0.35,
      tel.x + Math.sin(tel.rotY) * 0.62,
      my + 2.06,
      tel.z + Math.cos(tel.rotY) * 0.62,
      -0.14,
      tel.rotY,
      0
    );
    world.addCollider(tel.x, tel.z, 1.1, 1.1, my + 2.2, my);
  }

  const benches = [
    { x: mx - 5.4, z: mz + 6.0, rotY: 0 },
    { x: mx + 5.0, z: mz + 6.6, rotY: 0 },
    { x: mx - 7.0, z: mz - 1.5, rotY: Math.PI / 2 },
    { x: mx - 10.6, z: mz + 2.2, rotY: Math.PI / 2 }
  ];
  for (const b of benches) {
    const w = b.rotY === 0 ? 3.4 : 1.1;
    const d = b.rotY === 0 ? 1.1 : 3.4;
    batcher.addBox('wood_bench', w, 0.52, d, b.x, my + 0.62, b.z);
    batcher.addBox('brass_gold', w * 0.92, 0.14, d * 0.92, b.x, my + 0.92, b.z);
  }
  for (const [lx, lz] of [
    [mx - 8.8, mz - 8.8],
    [mx + 8.8, mz - 8.8],
    [mx - 8.8, mz + 8.8],
    [mx + 8.8, mz + 8.8]
  ]) {
    batcher.addCylinder('hazard_black', 0.16, 0.24, 3.8, lx, my + 2.25, lz, 8);
    batcher.addBox('lamp_glow', 0.72, 0.72, 0.72, lx, my + 4.3, lz);
  }

  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    for (let s = 0; s < 12; s++) {
      const ang = (s / 12) * Math.PI * 2;
      const kind = s % 4 === 0 ? 'purple' : s % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(
        mx + Math.cos(ang) * 6.0,
        my + 0.68,
        mz + Math.sin(ang) * 6.0,
        kind
      );
    }
  }

  world.mapBuildings.push({
    x: mx,
    z: mz,
    w: 28,
    d: 28,
    height: 15,
    color: '#4ade80',
    isLandmark: true,
    label: 'MIRANTE DO PARQUE (+14.0m)'
  });
}

function buildSouthwestBeachDunesAndRockHeadland(world, batcher) {
  const minX = -1352;
  const maxX = -758;
  const minZ = 780;
  const maxZ = 1012;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(width, depth, 76, 36);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xfde047);
  const cWarmSand = new THREE.Color(0xf59e0b);
  const cCoastalRock = new THREE.Color(0x64748b);
  const cCoastalVegetation = new THREE.Color(0x16a34a);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = getSouthwestBeachReliefY(vx, vz);
    pos.setY(i, vy > 0.08 ? vy : -0.04);

    if (vy > 6.2) {
      tmp.copy(cCoastalRock);
    } else if (vy > 4.2) {
      tmp.copy(cWarmSand).lerp(cCoastalVegetation, 0.35);
    } else {
      tmp.copy(cSand).lerp(cWarmSand, vy / 4.5);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const duneMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.03
    })
  );
  duneMesh.receiveShadow = true;
  world.scene.add(duneMesh);

  for (const [rx, rz] of [
    [-965, 928],
    [-1215, 898]
  ]) {
    const ry = getSouthwestBeachReliefY(rx, rz);
    batcher.addBox('cliff_rock_dark', 16.0, 2.2, 12.0, rx, ry - 0.4, rz);
    batcher.addBox('cliff_rock_light', 10.5, 1.8, 8.5, rx + 2.5, ry + 0.35, rz - 1.5);
    batcher.addBox('wood_bench', 8.4, 0.35, 8.4, rx - 1.5, ry + 0.25, rz + 1.0);
    batcher.studPositionsStone.push([rx + 2.5, ry + 1.3, rz - 1.5]);
  }
}

function buildCDDCanyonPassRetainingWalls(batcher) {
  for (let x = -984; x <= -540; x += 24) {
    for (const side of [-1, 1]) {
      const wz = side * 16.5;
      batcher.addBox('cliff_rock_dark', 23.6, 5.2, 3.2, x, 2.6, wz);
      batcher.addBox('viaduct_concrete', 23.8, 0.85, 3.5, x, 5.5, wz);
      batcher.addBox('safety_yellow', 11.0, 0.42, 3.6, x - 5.5, 1.2, wz);
      batcher.addBox('hazard_black', 11.0, 0.42, 3.6, x + 5.5, 1.2, wz);
    }
  }
}

// ============================================================================
// 4. CONSTRUTOR DE VIADUTO EXPRESSO SUSPENSO (+12.4m ACIMA DA RUA LOCAL & 100% VAZADO!)
// ============================================================================

// ============================================================================
// PISTA CONTÍNUA + APOIOS FORA DA RUA (compartilhados pelos viadutos e rampas de acesso)
// ============================================================================
function interpolateSamplesY(samples, c) {
  if (c <= samples[0].c) return samples[0].y;
  const last = samples[samples.length - 1];
  if (c >= last.c) return last.y;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].c <= c) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  return a.y + ((b.y - a.y) * (c - a.c)) / Math.max(1e-6, b.c - a.c);
}

function addContinuousDeck(batcher, samples, axis, fixedCoord, deckWidth, opts = {}) {
  if (!samples || samples.length < 2) return;
  const { deckThickness = 0.95, railW = 0.68, railH = 1.15, railGaps = [], girders = true } = opts;
  const halfW = deckWidth * 0.5;
  const rib = (key, c0, c1, top, thick, faces, sub = samples) =>
    batcher.addGeometry(key, buildProfileRibbon(sub, axis, fixedCoord, c0, c1, top, thick, faces));
  const topOnly = { top: true, bottom: false, sides: false };

  // Laje + vigas longitudinais inferiores
  rib('viaduct_concrete', -halfW, halfW, 0, deckThickness);
  if (girders) {
    for (const side of [-1, 1]) {
      const g = side * (halfW - 2.1);
      rib('viaduct_dark_concrete', g - 0.475, g + 0.475, -deckThickness + 0.03, 0.78);
    }
  }
  // Asfalto, faixa dupla amarela central e linhas de acostamento
  rib('viaduct_asphalt', -(halfW - railW), halfW - railW, 0.07, 0.1, { top: true, bottom: false, sides: true });
  for (const d of [-0.28, 0.28]) rib('lane_yellow', d - 0.11, d + 0.11, 0.095, 0.02, topOnly);
  for (const side of [-1, 1]) {
    const o = side * (halfW - railW - 0.45);
    rib('viaduct_shoulder', o - 0.17, o + 0.17, 0.09, 0.02, topOnly);
  }
  // Linhas brancas tracejadas das faixas (cada traço também segue o perfil)
  const cStart = samples[0].c;
  const cEnd = samples[samples.length - 1].c;
  for (let c = cStart + 3; c + 3.3 <= cEnd - 3; c += 6) {
    const dash = [0, 1.1, 2.2, 3.3].map((k) => ({ c: c + k, y: interpolateSamplesY(samples, c + k) }));
    for (const side of [-1, 1]) {
      const o = side * deckWidth * 0.24;
      rib('lane_white', o - 0.11, o + 0.11, 0.095, 0.02, topOnly, dash);
    }
  }
  // Muretas laterais (com aberturas opcionais) e friso amarelo na face externa da laje
  for (const side of [-1, 1]) {
    const inner = side * (halfW - railW);
    const outer = side * halfW;
    const gaps = railGaps.filter((g) => g.side === side);
    let runs = [samples];
    for (const g of gaps) {
      runs = runs.flatMap((run) => {
        const before = run.filter((p) => p.c <= g.c0);
        const after = run.filter((p) => p.c >= g.c1);
        return [before, after].filter((r) => r.length >= 2);
      });
    }
    for (const run of runs) {
      rib('viaduct_concrete', Math.min(inner, outer), Math.max(inner, outer), railH, railH + 0.3, undefined, run);
    }
    const band0 = side > 0 ? halfW : -halfW - 0.05;
    rib('safety_yellow', band0, band0 + 0.05, -0.1, 0.38);
  }
}

/** Collider de objeto/prédio no lugar do pilar (ignora coisas no alto, como tabuleiros). */
function isColumnSpotBlocked(world, x, z, half) {
  const r = half + 0.3;
  const cols = world.getCollidersNear ? world.getCollidersNear(x, z, r + 1) : world.colliders || [];
  for (const col of cols) {
    if (col.disabled) continue;
    if ((col.minY ?? 0) > 6.0 || col.maxY < 0.8) continue;
    if (x + r > col.minX && x - r < col.maxX && z + r > col.minZ && z - r < col.maxZ) return true;
  }
  return false;
}

/**
 * Apoios de um viaduto reto (ao longo de X ou Z), sem nada no meio da rua:
 *  - tabuleiro alto (vão livre >= 5m): PÓRTICO com um pilar em cada calçada de verdade e viga atravessando a rua;
 *  - rampa baixa (onde carro não passa por baixo): pilar central compacto sob a própria rampa;
 *  - em cima de rua transversal: nenhum apoio.
 */
function addViaductSupports(world, batcher, cfg) {
  const { axis, fixedCoord, startC, endC, deckWidth, getHeightAlong, getGroundAlong, underside, spacing = 22 } = cfg;
  const roads = Array.isArray(world.mapRoads) ? world.mapRoads : [];
  const alongZ = axis === 'x_const';
  const isFooting = makeFootingLookup(world, { ignoreBlock: (b) => b.isViaductDeck });
  const groundAt = (x, z) => (world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(x, z)) : 0);
  const beamH = 1.2;
  const colW = 1.4;
  const placed = [];

  for (let pc0 = startC + 14; pc0 <= endC - 14; pc0 += spacing) {
    for (const sh of [0, 3, -3, 6, -6, 9, -9]) {
      const pc = pc0 + sh;
      if (pc < startC + 8 || pc > endC - 8) continue;
      const deckY = getHeightAlong(pc);
      if (deckY === null) continue;
      const undersideY = deckY - underside;
      const groundC = getGroundAlong(pc);
      const clear = undersideY - groundC;
      if (clear < 1.2) break; // rampa encostando no chão (aterro): sem pilar
      const x = alongZ ? fixedCoord : pc;
      const z = alongZ ? pc : fixedCoord;
      if (onCrossRoad(roads, x, z, alongZ, 3.0)) continue;

      if (clear >= 5.0) {
        const beamTop = undersideY;
        const beamBottom = beamTop - beamH;
        const cols = findPortalColumns({
          x,
          z,
          alongZ,
          roads,
          isFooting,
          isBuilding: (px, pz) => isBuildingAt(world, px, pz),
          fits: (c) => {
            if (isColumnSpotBlocked(world, c.x, c.z, colW * 0.5)) return false;
            c.groundY = groundAt(c.x, c.z);
            return beamBottom - c.groundY >= 3.0;
          }
        });
        if (!cols) continue;
        for (const c of cols) {
          const h = beamBottom - c.groundY;
          batcher.addBox('viaduct_pillar', colW, h + 0.8, colW, c.x, c.groundY + h * 0.5 - 0.4, c.z);
          batcher.addBox('safety_yellow', colW + 0.24, 0.9, colW + 0.24, c.x, c.groundY + 0.45, c.z);
          batcher.addBox('hazard_black', colW + 0.26, 0.26, colW + 0.26, c.x, c.groundY + 0.98, c.z);
          world.addCollider(c.x, c.z, colW + 0.1, colW + 0.1, beamBottom, c.groundY);
        }
        const a = cols[0];
        const b = cols[1];
        const span = Math.hypot(b.x - a.x, b.z - a.z) + colW;
        const sx = alongZ ? span : 1.8;
        const sz = alongZ ? 1.8 : span;
        const bx = (a.x + b.x) * 0.5;
        const bz = (a.z + b.z) * 0.5;
        batcher.addBox('viaduct_concrete', sx, beamH, sz, bx, beamTop - beamH * 0.5, bz);
        world.addCollider(bx, bz, sx, sz, beamTop, beamBottom);
        placed.push({ kind: 'portal', c: pc, cols, beamBottom });
      } else {
        // Rampa baixa: pilar central sob a rampa (ali embaixo já não passa carro)
        if (isColumnSpotBlocked(world, x, z, 1.1)) continue;
        const g = groundAt(x, z);
        const h = undersideY - g;
        batcher.addBox('viaduct_pillar', 2.2, h + 0.6, 2.2, x, g + h * 0.5 - 0.3, z);
        batcher.addBox('safety_yellow', 2.44, 0.8, 2.44, x, g + 0.4, z);
        const capW = deckWidth - 3.0;
        batcher.addBox('viaduct_dark_concrete', alongZ ? capW : 1.8, 0.7, alongZ ? 1.8 : capW, x, undersideY - 0.35, z);
        world.addCollider(x, z, 2.3, 2.3, undersideY, g);
        placed.push({ kind: 'central', c: pc });
      }
      break;
    }
  }
  if (!world.viaductSupports) world.viaductSupports = [];
  world.viaductSupports.push(...placed.map((p) => ({ ...p, axis, fixedCoord })));
  return placed;
}

// Largura das avenidas principais (28m): viadutos e rampas usam a mesma largura para encaixar na rua.
const AVENUE_WIDTH = 28.0;
const CENTRAL_RAMP_HALF_W = AVENUE_WIDTH * 0.5;

function buildSegmentedExpressViaduct(world, batcher, cfg) {
  const {
    id,
    axis,
    fixedCoord,
    startC,
    endC,
    rampStartLen,
    rampEndLen,
    clearanceTarget = 12.4,
    startGroundY = 0,
    endGroundY = 0,
    deckWidth = 16.0,
    blockedPillarCoords = [],
    gantries = []
  } = cfg;

  const sampleGroundAlong = (c) => {
    const gx = axis === 'z_const' ? c : fixedCoord;
    const gz = axis === 'z_const' ? fixedCoord : c;
    return world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(gx, gz)) : 0;
  };

  // Envelope suavizado do solo local para que o tabuleiro mantenha SEMPRE +11.8m..+13.2m de vão livre acima da rua abaixo!
  const sampleSmoothedGround = (c) => {
    const g0 = sampleGroundAlong(c);
    const gL = sampleGroundAlong(Math.max(startC, c - 18));
    const gR = sampleGroundAlong(Math.min(endC, c + 18));
    return Math.max(g0, (gL + g0 * 2 + gR) * 0.25);
  };

  const flatStart = startC + rampStartLen;
  const flatEnd = endC - rampEndLen;
  // Trecho elevado com perfil "de projeto": rampas retas (até 5%) e concordâncias suaves, sempre com o vão livre
  // exigido sobre a rua — sem copiar cada ondulação do relevo (antes o tabuleiro ficava torto no meio).
  const middleProfile = buildGradedProfile((c) => sampleSmoothedGround(c) + clearanceTarget, flatStart, flatEnd, {
    maxGrade: 0.05,
    smoothHalf: 24
  });
  const flatStartDeckY = middleProfile(flatStart);
  const flatEndDeckY = middleProfile(flatEnd);

  const getHeightAlong = (c) => {
    if (c < startC || c > endC) return null;
    if (c < flatStart) {
      const t = cosineStep01((c - startC) / Math.max(1, rampStartLen));
      return THREE.MathUtils.lerp(startGroundY, flatStartDeckY, t);
    }
    if (c > flatEnd) {
      const t = cosineStep01((endC - c) / Math.max(1, rampEndLen));
      return THREE.MathUtils.lerp(endGroundY, flatEndDeckY, t);
    }
    return middleProfile(c);
  };

  const halfW = deckWidth * 0.5;
  const deckEntry =
    axis === 'z_const'
      ? {
          id,
          minX: startC,
          maxX: endC,
          minZ: fixedCoord - halfW,
          maxZ: fixedCoord + halfW,
          thresholdBelow: 2.5,
          getDeckY: (x) => getHeightAlong(x),
          getTopY: (x) => getHeightAlong(x)
        }
      : {
          id,
          minX: fixedCoord - halfW,
          maxX: fixedCoord + halfW,
          minZ: startC,
          maxZ: endC,
          thresholdBelow: 2.5,
          getDeckY: (_x, z) => getHeightAlong(z),
          getTopY: (_x, z) => getHeightAlong(z)
        };
  world.elevatedDecks.push(deckEntry);

  if (axis === 'z_const') {
    world.mapBlocks.push({
      x: (startC + endC) * 0.5,
      z: fixedCoord,
      w: endC - startC,
      d: deckWidth,
      color: '#475569',
      isViaductDeck: true
    });
  } else {
    world.mapBlocks.push({
      x: fixedCoord,
      z: (startC + endC) * 0.5,
      w: deckWidth,
      d: endC - startC,
      color: '#475569',
      isViaductDeck: true
    });
  }

  const step = 6.0;
  const totalLen = endC - startC;
  const numSteps = Math.round(totalLen / step);
  const realStep = totalLen / numSteps;
  const deckThickness = 0.95;
  const railW = 0.68;
  const railH = 1.15;

  for (let i = 0; i < numSteps; i++) {
    const c0 = startC + i * realStep;
    const c1 = c0 + realStep;
    const cm = (c0 + c1) * 0.5;
    const y0 = getHeightAlong(c0);
    const y1 = getHeightAlong(c1);
    const ym = (y0 + y1) * 0.5;

    const cx = axis === 'z_const' ? cm : fixedCoord;
    const cz = axis === 'z_const' ? fixedCoord : cm;
    const localGroundY = sampleGroundAlong(cm);
    const clearanceAboveGround = ym - localGroundY;

    // (Laje, vigas, asfalto e faixas são fitas contínuas geradas depois do laço — sem emendas na pista.)

    // REGRA CRÍTICA: Aterro fechado APENAS no comecinho da rampa (< 1.35m, primeiros ~10-12m)!
    // Todo o restante da rampa (1.35m até 12.8m+) é 100% VAZADO E SUSPENSO sobre colunas!
    const isLowEmbankment = clearanceAboveGround < 1.35;

    for (const side of [-1, 1]) {
      if (id === 'viaduct_ew_north' && side === 1 && cm > -CENTRAL_RAMP_HALF_W && cm < CENTRAL_RAMP_HALF_W) {
        continue;
      }

      const edgeOff = side * (halfW - railW * 0.5);
      const rx = axis === 'z_const' ? cx : cx + edgeOff;
      const rz = axis === 'z_const' ? cz + edgeOff : cz;

      batcher.studPositionsYellow.push([rx, ym + railH + 0.06, rz]);

      if (isLowEmbankment) {
        const embH = Math.max(0.5, ym - localGroundY + 1.0);
        batcher.addBox(
          'viaduct_dark_concrete',
          axis === 'z_const' ? realStep + 0.1 : railW + 0.2,
          embH,
          axis === 'z_const' ? railW + 0.2 : realStep + 0.1,
          rx,
          ym - embH * 0.5,
          rz
        );
        world.addCollider(
          rx,
          rz,
          axis === 'z_const' ? realStep : railW + 0.2,
          axis === 'z_const' ? railW + 0.2 : realStep,
          ym + 1.45,
          localGroundY - 0.5
        );
      } else {
        // Mureta suspensa no alto: NUNCA desce colisor até o chão, deixando passagem 100% livre por baixo!
        const minSegY = Math.min(y0, y1) - deckThickness;
        const maxSegY = Math.max(y0, y1);
        world.addCollider(
          rx,
          rz,
          axis === 'z_const' ? realStep : railW + 0.2,
          axis === 'z_const' ? railW + 0.2 : realStep,
          maxSegY + 1.45,
          minSegY
        );
      }

      if (!isLowEmbankment && i % 6 === 3) {
        batcher.addBox('steel_pole', 0.26, 4.8, 0.26, rx, ym + railH + 2.4, rz);
        const armInward = -side * 1.35;
        const ax = axis === 'z_const' ? rx : rx + armInward * 0.5;
        const az = axis === 'z_const' ? rz + armInward * 0.5 : rz;
        batcher.addBox(
          'steel_pole',
          axis === 'z_const' ? 0.24 : 1.5,
          0.22,
          axis === 'z_const' ? 1.5 : 0.24,
          ax,
          ym + railH + 4.75,
          az
        );
        const gx = axis === 'z_const' ? rx : rx + armInward;
        const gz = axis === 'z_const' ? rz + armInward : rz;
        batcher.addBox('lamp_glow', 0.55, 0.2, 0.55, gx, ym + railH + 4.62, gz);
      }
    }

    if (isLowEmbankment && clearanceAboveGround > 0.15) {
      const coreH = clearanceAboveGround + 1.0;
      batcher.addBox(
        'viaduct_pillar',
        axis === 'z_const' ? realStep + 0.08 : deckWidth - 1.2,
        coreH,
        axis === 'z_const' ? deckWidth - 1.2 : realStep + 0.08,
        cx,
        ym - 0.25 - coreH * 0.5,
        cz
      );
    }
  }

  // 4) PISTA CONTÍNUA (fitas extrudadas ao longo do perfil — zero emendas/degraus na inclinação)
  const samples = sampleProfile(getHeightAlong, startC, endC, 2);
  addContinuousDeck(batcher, samples, axis, fixedCoord, deckWidth, {
    deckThickness,
    railW,
    railH,
    // Junção com as rampas centrais do Viaduto 1: mureta do lado +Z aberta na largura da rampa
    railGaps: id === 'viaduct_ew_north' ? [{ side: 1, c0: -CENTRAL_RAMP_HALF_W, c1: CENTRAL_RAMP_HALF_W }] : []
  });

  // 5) APOIOS FORA DA RUA: onde o tabuleiro está alto, PÓRTICO com um pilar em cada calçada de verdade e
  //    viga atravessando a avenida; na rampa baixa (onde não passa carro por baixo), pilar central sob a rampa.
  addViaductSupports(world, batcher, {
    axis,
    fixedCoord,
    startC,
    endC,
    deckWidth,
    getHeightAlong,
    getGroundAlong: sampleGroundAlong,
    underside: deckThickness + 0.78
  });

  for (const g of gantries) {
    const gy = getHeightAlong(g.c) ?? (sampleGroundAlong(g.c) + clearanceTarget);
    const gx = axis === 'z_const' ? g.c : fixedCoord;
    const gz = axis === 'z_const' ? fixedCoord : g.c;
    addOverheadHighwayGantry(world, batcher, gx, gy, gz, deckWidth, axis, g.text, g.sub);
  }

  return { getHeightAlong };
}

function buildViaduct1CentralAccessRamps(world, batcher, junctionDeckTopY) {
  const zTop = -382 + AVENUE_WIDTH * 0.5; // encosta na borda sul do Viaduto 1 (largura da avenida)
  const zBot = -282;
  const totalW = AVENUE_WIDTH; // mesma largura da Av. X = 0: a rampa encaixa 100% na rua
  const halfW = totalW * 0.5;
  const botGroundY = getUrbanCityReliefY(0, zBot);

  const getRampY = (z) => {
    if (z < zTop - 1.0 || z > zBot) return null;
    if (z <= zTop) return junctionDeckTopY;
    const t = cosineStep01((zBot - z) / (zBot - zTop));
    return THREE.MathUtils.lerp(botGroundY, junctionDeckTopY, t);
  };

  world.elevatedDecks.push({
    id: 'viaduct_ew_central_ramp_pair',
    minX: -halfW,
    maxX: halfW,
    minZ: zTop - 1.0,
    maxZ: zBot,
    thresholdBelow: 2.5,
    getDeckY: (_x, z) => getRampY(z),
    getTopY: (_x, z) => getRampY(z)
  });

  world.mapBlocks.push({
    x: 0,
    z: (zTop + zBot) * 0.5,
    w: totalW,
    d: zBot - zTop,
    color: '#64748b',
    isViaductDeck: true
  });

  const numSteps = 16;
  const dzStep = (zBot - zTop) / numSteps;

  for (let i = 0; i < numSteps; i++) {
    const z0 = zTop + i * dzStep;
    const z1 = z0 + dzStep;
    const zm = (z0 + z1) * 0.5;
    const y0 = getRampY(z0);
    const y1 = getRampY(z1);
    const ym = (y0 + y1) * 0.5;
    const gY = getUrbanCityReliefY(0, zm);
    const clr = ym - gY;

    for (const side of [-1, 1]) {
      const rx = side * (halfW - 0.35);
      batcher.studPositionsYellow.push([rx, ym + 1.16, zm]);

      // Apenas os últimos metros de toque no chão (< 1.35m) são fechados; o resto é 100% suspenso!
      if (clr < 1.35) {
        const embH = Math.max(0.5, clr + 1.0);
        batcher.addBox('viaduct_dark_concrete', 0.75, embH, dzStep + 0.1, rx, ym - embH * 0.5, zm);
        world.addCollider(rx, zm, 0.8, dzStep, ym + 1.4, gY - 0.5);
      } else {
        world.addCollider(rx, zm, 0.8, dzStep, Math.max(y0, y1) + 1.4, Math.min(y0, y1) - 0.86);
      }
    }
  }

  // Pista contínua (sem emendas) com divisória amarela central e muretas
  const rampSamples = sampleProfile(getRampY, zTop, zBot, 2);
  addContinuousDeck(batcher, rampSamples, 'x_const', 0, totalW, {
    deckThickness: 0.86,
    railW: 0.68,
    railH: 1.12,
    girders: false
  });
  batcher.addGeometry('safety_yellow', buildProfileRibbon(rampSamples, 'x_const', 0, -0.275, 0.275, 0.45, 0.45));

  // Apoios fora da rua (pórtico nas calçadas da Av. X = 0 onde está alto; pilar central onde a rampa é baixa)
  addViaductSupports(world, batcher, {
    axis: 'x_const',
    fixedCoord: 0,
    startC: zTop,
    endC: zBot,
    deckWidth: totalW,
    getHeightAlong: getRampY,
    getGroundAlong: (z) => getUrbanCityReliefY(0, z),
    underside: 0.86,
    spacing: 20
  });

  addOverheadHighwayGantry(
    world,
    batcher,
    0,
    getRampY(-360),
    -360,
    totalW,
    'x_const',
    'ACESSO CENTRO / SUPER BANCO',
    'SUBIDA OESTE • SAÍDA LESTE'
  );
}

// ============================================================================
// 5. ENTRYPOINT PRINCIPAL EXPORTADO PARA `TestBlockWorld.js`
// ============================================================================
export function buildViaductsAndNaturalRelief(world) {
  if (!world.elevatedDecks) world.elevatedDecks = [];
  const batcher = createReliefAndViaductBatcher();

  // 1) Falésias Rochosas Norte (+22.0m), Colinas/Mirante do Parque (+14.0m), Dunas Sul e Cânion CDD:
  buildNorthSuburbCoastalAndRiverCliffs(world, batcher);
  buildCentralParkHillsAndMirante(world, batcher);
  buildSouthwestBeachDunesAndRockHeadland(world, batcher);
  buildCDDCanyonPassRetainingWalls(batcher);

  // 2) REDE DOS 3 GRANDES VIADUTOS EXPRESSOS SUSPENSOS (+12.4m ACIMA DA RUA LOCAL ABAIXO!):

  // VIADUTO 01 — Elevado Metropolitano Leste-Oeste (`Z = -382`, `X = -465..+465`, +12.4m acima da avenida abaixo!)
  const v1 = buildSegmentedExpressViaduct(world, batcher, {
    id: 'viaduct_ew_north',
    axis: 'z_const',
    fixedCoord: -382,
    startC: -465,
    endC: 465,
    rampStartLen: 68,
    rampEndLen: 68,
    clearanceTarget: 12.4,
    startGroundY: getUrbanCityReliefY(-465, -382),
    endGroundY: getUrbanCityReliefY(465, -382),
    deckWidth: AVENUE_WIDTH, // mesma largura da avenida embaixo: a rampa encaixa 100% na rua
    blockedPillarCoords: [-384, -252, -120, 0, 120, 252, 384],
    gantries: [
      { c: -318, text: 'ELEVADO METROPOLITANO', sub: 'ALTO COMERCIAL • PONTE LESTE' },
      { c: 62, text: 'SAÍDA CENTRO / SUPER BANCO', sub: 'VÃO LIVRE ELEVADO' },
      { c: 318, text: 'PONTE LESTE • DISTRITO PCC', sub: 'VIA EXPRESSA ELEVADA' }
    ]
  });
  buildViaduct1CentralAccessRamps(world, batcher, v1.getHeightAlong(0));

  // VIADUTO 02 — Viaduto Panorâmico Norte-Sul (`X = +252`, `Z = -84..+520`, +12.4m acima da avenida abaixo!)
  buildSegmentedExpressViaduct(world, batcher, {
    id: 'viaduct_ns_panoramic',
    axis: 'x_const',
    fixedCoord: 252,
    startC: -84,
    endC: 520,
    rampStartLen: 66,
    rampEndLen: 68,
    clearanceTarget: 12.4,
    startGroundY: getUrbanCityReliefY(252, -84),
    endGroundY: getUrbanCityReliefY(252, 520),
    deckWidth: AVENUE_WIDTH, // mesma largura da avenida embaixo: a rampa encaixa 100% na rua
    blockedPillarCoords: [0, 134, 187, 268, 349, 402],
    gantries: [
      { c: 65, text: 'VIADUTO PANORÂMICO LAGO', sub: 'PARQUE CENTRAL • PRAIA SUL' },
      { c: 395, text: 'CRISTA COSTEIRA • ORLA SUL', sub: 'DESCIDA PANORÂMICA' }
    ]
  });

  // VIADUTO 03 — Viaduto Expresso Oeste / Acesso Aeroporto-CDD (`Z = 0`, `X = -1036..-466`, +12.4m acima da avenida abaixo!)
  buildSegmentedExpressViaduct(world, batcher, {
    id: 'viaduct_west_airport',
    axis: 'z_const',
    fixedCoord: 0,
    startC: -1036,
    endC: -466,
    rampStartLen: 68,
    rampEndLen: 48,
    clearanceTarget: 12.4,
    startGroundY: 0.28,
    endGroundY: getUrbanCityReliefY(-466, 0),
    deckWidth: AVENUE_WIDTH, // mesma largura da avenida embaixo: a rampa encaixa 100% na rua
    blockedPillarCoords: [-1020, -516],
    gantries: [
      { c: -890, text: 'EXPRESSO AEROPORTO • CENTRO', sub: 'CORREDOR CIDADE DE DEUS' },
      { c: -560, text: 'TORRE DOS HERÓIS • TIMES SQ.', sub: 'VIA EXPRESSA OESTE' }
    ]
  });

  batcher.flush(world.scene);

  world.viaductAndReliefData = {
    viaductsCount: 3,
    hasCentralAccessRamps: true,
    northPlateauHeight: 22.0,
    northwestHillHeight: 14.6,
    northeastHillHeight: 14.2,
    eastBelaVistaHillHeight: 9.6,
    southCoastalRidgeHeight: 10.5,
    eastIndustrialElevationHeight: 7.5,
    centralParkMiranteHeight: 14.0,
    southwestDunesMaxHeight: 8.5
  };
}
