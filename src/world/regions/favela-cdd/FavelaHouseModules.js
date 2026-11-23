import { localToWorldXZ } from '../../buildings/LotGeometry2D.js';
import { getFavelaElevation } from './FavelaElevationAndBatcher.js';

const BRICK_TINTS = [0xffffff, 0xf6e6db, 0xecd7c8, 0xe0c8b8];
const HALF_PLASTER_TINTS = [0xf2eae4, 0xe5dbd3, 0xdad0c8];
const CEMENT_TINTS = [0x828996, 0x737a87, 0x666d79, 0x8d94a1];
const PAINTED_SPECS = [
  { tint: 0xc69440, mapHex: '#a16207' }, // Ocre desbotado
  { tint: 0x4b7d9f, mapHex: '#1d4ed8' }, // Azul colonial gasto
  { tint: 0xcfd6e0, mapHex: '#94a3b8' }, // Cal branca encardida
  { tint: 0xb62b2b, mapHex: '#b91c1c' }, // Vermelho CV envelhecido
  { tint: 0x992222, mapHex: '#991b1b' }  // Vermelho sangue escuro CV
];

function hashInt(seed) {
  let h = (seed * 1664525 + 1013904223) | 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

export function pickAuthenticWallFinish(world, seed, floorIdx = 0) {
  const roll = hashInt(seed * 31 + floorIdx * 17) % 100;
  if (roll < 37) {
    world.favelaCDDData.brickBaianoCount++;
    return { tileId: 0, tintHex: BRICK_TINTS[roll % BRICK_TINTS.length], mapColor: '#9a3c1a' };
  }
  if (roll < 56) {
    world.favelaCDDData.brickBaianoCount++;
    return { tileId: 1, tintHex: HALF_PLASTER_TINTS[roll % HALF_PLASTER_TINTS.length], mapColor: '#854027' };
  }
  if (roll < 83) {
    world.favelaCDDData.cementRawCount++;
    return { tileId: 2, tintHex: CEMENT_TINTS[roll % CEMENT_TINTS.length], mapColor: '#525866' };
  }
  world.favelaCDDData.cvPaintedCount++;
  const p = PAINTED_SPECS[roll % PAINTED_SPECS.length];
  return { tileId: 3, tintHex: p.tint, mapColor: p.mapHex };
}

function addLocalBox(batcher, key, lw, lh, ld, lx, ly, lz, cx, yBase, cz, cosY, sinY, rotY, lodMode = 'auto', skipBottom = false) {
  const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
  batcher.addBox(key, lw, lh, ld, wp.x, yBase + ly, wp.z, rotY, null, lodMode, skipBottom);
}

function addLocalWallBox(batcher, tileId, tintHex, lw, lh, ld, lx, ly, lz, cx, yBase, cz, cosY, sinY, rotY, lodMode = 'both', skipBottom = true) {
  const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
  batcher.addWallBox(tileId, tintHex, lw, lh, ld, wp.x, yBase + ly, wp.z, rotY, lodMode, skipBottom);
}

function addLocalSlopedBox(batcher, key, lw, lh, ld, lx, ly, lz, rotX, rotZ, cx, yBase, cz, cosY, sinY, rotY, lodMode = 'auto', skipBottom = false) {
  const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
  batcher.addSlopedBox(key, lw, lh, ld, wp.x, yBase + ly, wp.z, rotX, rotZ, rotY, null, lodMode, skipBottom);
}

/**
 * Constrói 1 lote ou sub-bloco germinado parede-com-parede (`subUnits`) na encosta da CDD:
 *   - Alicerce contínuo + Laje de Fundo (`retaining_concrete` + `cement_slab`) unindo fundos entre fitas
 *   - LOD Nível 1 (`>= 650m`): 1 prisma de parede + 1 cobertura por meio-bloco (~20 triângulos!)
 *   - LOD Nível 0 (`0..650m`): casas coladas parede-com-parede em 2 estágios verticais (corpo térreo/médio +
 *     puxadinho/meia-laje superior), telhas de zinco inclinadas, caixas d'água hexagonais azuis, vergalhões e biroscas
 */
export function buildAuthenticFavelaParcel(world, batcher, spec) {
  const {
    cx,
    cz,
    w,
    d,
    floors = 2,
    rotY,
    seed,
    alleySign = 1,
    spotKind = 'house',
    subUnits = null,
    rearTerraceD = 1.45,
    travessaSlabW = 0,
    registerParcel = true
  } = spec;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  if (spotKind === 'chapel') {
    const hw = w * 0.5, hd = d * 0.5, cCenter = getFavelaElevation(cx, cz);
    const c1 = localToWorldXZ(cx, cz, -hw, -hd, cosY, sinY), c2 = localToWorldXZ(cx, cz, hw, hd, cosY, sinY);
    const minY = Math.min(cCenter, getFavelaElevation(c1.x, c1.z), getFavelaElevation(c2.x, c2.z));
    const maxY = Math.max(cCenter, getFavelaElevation(c1.x, c1.z), getFavelaElevation(c2.x, c2.z));
    const yBase = Math.max(cCenter, maxY - 0.35) + 0.14;
    const yFootBottom = Math.min(minY - 2.6, yBase - 3.8), foundH = Math.max(2.4, yBase - yFootBottom), chH = 5.4;

    world.favelaCDDData.cvPaintedCount++;
    addLocalBox(batcher, 'retaining_concrete', w + 0.4, foundH, d + 0.4, 0, -foundH * 0.5, 0, cx, yBase, cz, cosY, sinY, rotY, 'both', true);
    addLocalWallBox(batcher, 3, 0xdce3ec, w, chH, d, 0, chH * 0.5, 0, cx, yBase, cz, cosY, sinY, rotY, 'both', true);
    addLocalBox(batcher, 'favela_blue_faded', w + 0.16, 0.75, d + 0.16, 0, 0.38, 0, cx, yBase, cz, cosY, sinY, rotY, 'l0', true);
    addLocalBox(batcher, 'favela_blue_faded', 1.35, 2.5, 0.18, 0, 1.25, alleySign * (hd + 0.06), cx, yBase, cz, cosY, sinY, rotY, 'l0', true);
    addLocalBox(batcher, 'window_lit', 0.9, 1.4, 0.16, 0, 3.1, alleySign * (hd + 0.05), cx, yBase, cz, cosY, sinY, rotY);
    addLocalWallBox(batcher, 3, 0xdce3ec, w * 0.52, 1.85, 0.55, 0, chH + 0.92, alleySign * (hd - 0.3), cx, yBase, cz, cosY, sinY, rotY, 'l0', true);
    addLocalSlopedBox(batcher, 'zinc_roof', w * 0.58, 0.16, d + 0.6, -w * 0.24, chH + 0.55, 0, 0, 0.24, cx, yBase, cz, cosY, sinY, rotY, 'both', true);
    addLocalSlopedBox(batcher, 'zinc_roof', w * 0.58, 0.16, d + 0.6, w * 0.24, chH + 0.55, 0, 0, -0.24, cx, yBase, cz, cosY, sinY, rotY, 'both', true);
    addLocalBox(batcher, 'cv_white', 0.18, 2.35, 0.18, 0, chH + 2.85, alleySign * (hd - 0.3), cx, yBase, cz, cosY, sinY, rotY, 'l0');
    addLocalBox(batcher, 'cv_white', 1.25, 0.18, 0.18, 0, chH + 3.35, alleySign * (hd - 0.3), cx, yBase, cz, cosY, sinY, rotY, 'l0');

    const topY = yBase + chH + 1.9;
    world.addObbCollider(cx, cz, w, d, rotY, topY, yFootBottom);
    world.mapBuildings.push({ x: cx, z: cz, w, d, rotY, height: topY - yBase, color: '#cbd5e1', isFavelaParcel: true });
    world.favelaCDDData.housesCount++;
    return { topY, yBase };
  }

  const units = subUnits && subUnits.length > 0 ? subUnits : [{ w, d, floors, zShift: 0, spotKind }];
  const overlapSeam = units.length > 1 ? 0.2 : 0;
  let spanW = 0;
  for (let i = 0; i < units.length; i++) spanW += units[i].w - (i > 0 ? overlapSeam : 0);

  const hSpan = spanW * 0.5, hd = d * 0.5;
  const cCenter = getFavelaElevation(cx, cz);
  const c1 = localToWorldXZ(cx, cz, -hSpan, -hd, cosY, sinY), c2 = localToWorldXZ(cx, cz, hSpan, -hd, cosY, sinY);
  const c3 = localToWorldXZ(cx, cz, hSpan, hd, cosY, sinY), c4 = localToWorldXZ(cx, cz, -hSpan, hd, cosY, sinY);
  const y1 = getFavelaElevation(c1.x, c1.z), y2 = getFavelaElevation(c2.x, c2.z);
  const y3 = getFavelaElevation(c3.x, c3.z), y4 = getFavelaElevation(c4.x, c4.z);
  const minCornerY = Math.min(cCenter, y1, y2, y3, y4), maxCornerY = Math.max(cCenter, y1, y2, y3, y4);

  const groupYBase = Math.max(cCenter, maxCornerY - 0.55) + 0.12;
  const yFootBottom = Math.min(minCornerY - 2.8, groupYBase - 4.2);
  const foundH = Math.max(2.6, groupYBase - yFootBottom);

  // 1. Alicerce contínuo + Laje de Fundo concretada em Nível 0 (fecha 100% da costura traseira!)
  const plinthD = d + rearTerraceD + 0.35;
  const plinthLz = -alleySign * (rearTerraceD * 0.5);
  addLocalBox(batcher, 'retaining_concrete', spanW + 0.38, foundH, plinthD, 0, -foundH * 0.5, plinthLz, cx, groupYBase, cz, cosY, sinY, rotY, 'l0', true);
  if (rearTerraceD >= 0.6) {
    addLocalBox(batcher, 'cement_slab', spanW + 0.44, 0.26, rearTerraceD + 0.5, 0, 0.05, -alleySign * (hd + rearTerraceD * 0.5 - 0.1), cx, groupYBase, cz, cosY, sinY, rotY, 'l0', true);
  }
  if (travessaSlabW >= 1.2) {
    addLocalBox(batcher, 'alley_cement', travessaSlabW + 0.45, foundH * 0.88, plinthD, hSpan + travessaSlabW * 0.5, -foundH * 0.44 + 0.04, plinthLz, cx, groupYBase, cz, cosY, sinY, rotY, 'l0', true);
  }

  // 2. Unidades germinadas parede-com-parede (Nível 0: 2 estágios verticais enxutos + telhados ricos!)
  let cursorLx = -hSpan;
  let maxClusterTopY = groupYBase + 3.5;
  let primaryMapColor = '#9a3c1a';
  let l1Finish = null, l1MaxH = 3.4;

  for (let u = 0; u < units.length; u++) {
    const unit = units[u];
    const uSeed = seed * 17 + u * 53;
    const uw = unit.w, ud = unit.d, uFloors = unit.floors, uKind = unit.spotKind || 'house';
    const ulx = cursorLx + uw * 0.5, ulz = unit.zShift || 0;
    cursorLx += uw - overlapSeam;

    const uWorld = localToWorldXZ(cx, cz, ulx, ulz, cosY, sinY);
    const uYOff = Math.max(-0.55, Math.min(0.65, getFavelaElevation(uWorld.x, uWorld.z) - cCenter));
    const uBaseY = groupYBase + uYOff;
    const floorH = 3.14 + (hashInt(uSeed + 5) % 4) * 0.07;

    const baseFinish = pickAuthenticWallFinish(world, uSeed, 0);
    if (u === 0) { primaryMapColor = baseFinish.mapColor; l1Finish = baseFinish; }

    let curY = 0, topW = uw, topLx = ulx, topLz = ulz;

    if (uFloors === 1) {
      addLocalWallBox(batcher, baseFinish.tileId, baseFinish.tintHex, uw, floorH + 0.4, ud, ulx, floorH * 0.5 - 0.2, ulz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);
      addLocalBox(batcher, 'cement_slab', uw + 0.36, 0.22, ud + 0.36, ulx, floorH + 0.11, ulz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);
      curY = floorH + 0.2;
    } else {
      const lowerFloors = uFloors - 1;
      const lowerH = lowerFloors * floorH;
      addLocalWallBox(batcher, baseFinish.tileId, baseFinish.tintHex, uw, lowerH + 0.4, ud, ulx, lowerH * 0.5 - 0.2, ulz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);
      addLocalBox(batcher, 'cement_slab', uw + 0.34, 0.2, ud + 0.34, ulx, lowerH + 0.1, ulz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);

      const topFinish = pickAuthenticWallFinish(world, uSeed, 1);
      const hasOverhang = (uSeed & 1) === 0;
      const overhangD = hasOverhang ? 0.55 + (hashInt(uSeed + 9) % 3) * 0.12 : 0;
      const isHalfTop = hashInt(uSeed + 71) % 3 === 0;
      const fw = isHalfTop ? uw * 0.62 : uw;
      const fd = ud + overhangD;
      const flx = isHalfTop ? ulx + (uSeed & 2 ? 1 : -1) * (uw - fw) * 0.5 : ulx;
      const flz = ulz + overhangD * 0.5 * alleySign;
      const yTopStart = lowerH + 0.18;

      addLocalWallBox(batcher, topFinish.tileId, topFinish.tintHex, fw, floorH, fd, flx, yTopStart + floorH * 0.5, flz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', !hasOverhang);
      addLocalBox(batcher, 'cement_slab', fw + 0.38, 0.22, fd + 0.38, flx, yTopStart + floorH + 0.11, flz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);

      if (hasOverhang && (uSeed & 3) === 0) {
        addLocalSlopedBox(batcher, 'rebar_iron', 0.1, 0.9, 0.1, flx, yTopStart - 0.3, ulz + alleySign * (ud * 0.5 + overhangD * 0.45), alleySign * -0.52, 0, cx, uBaseY, cz, cosY, sinY, rotY, 'l0');
      }
      if (isHalfTop) {
        const openSign = flx > ulx ? -1 : 1;
        addLocalWallBox(batcher, 0, 0xead8cc, uw * 0.36, 0.88, ud * 0.92, ulx + openSign * (uw * 0.31), yTopStart + 0.44, ulz, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);
      }
      topW = fw; topLx = flx; topLz = flz;
      curY = yTopStart + floorH + 0.2;
    }

    // Fachada térrea: Birosca/Mototáxi ou janela iluminada
    if (uKind === 'birosca' || uKind === 'mototaxi') {
      addLocalBox(batcher, 'zinc_roof', uw * 0.66, 2.05, 0.12, ulx, 1.03, ulz + alleySign * (ud * 0.5 + 0.07), cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);
      const awningKey = uKind === 'mototaxi' ? 'favela_yellow_faded' : (uSeed & 1 ? 'cv_red' : 'favela_yellow_faded');
      addLocalSlopedBox(batcher, awningKey, uw * 0.88, 0.11, 1.48, ulx, 2.44, ulz + alleySign * (ud * 0.5 + 0.68), alleySign * 0.22, 0, cx, uBaseY, cz, cosY, sinY, rotY, 'l0');
      addLocalBox(batcher, 'favela_bulb_warm', 0.24, 0.22, 0.24, ulx, 2.24, ulz + alleySign * (ud * 0.5 + 0.9), cx, uBaseY, cz, cosY, sinY, rotY);
    } else if (uSeed % 2 === 0) {
      const wRoll = hashInt(uSeed * 13) % 8;
      const winKey = wRoll < 4 ? 'window_lit' : wRoll < 6 ? 'window_orange' : 'window_tv_blue';
      const winY = uFloors >= 2 ? floorH + 1.85 : 1.78;
      addLocalBox(batcher, winKey, Math.min(1.25, topW * 0.34), 0.86, 0.12, topLx, winY, topLz + alleySign * (ud * 0.5 + 0.34), cx, uBaseY, cz, cosY, sinY, rotY);
    }

    // Topo: Caixa d'água azul hexagonal (16 tris), telha de zinco inclinada, vergalhão e varal
    if ((u + seed) % 2 === 0) {
      const tp = localToWorldXZ(cx, cz, topLx - topW * 0.18, topLz - ud * 0.16, cosY, sinY);
      batcher.addCylinder('water_tank_blue', 0.94, 0.84, 1.34, tp.x, uBaseY + curY + 0.67, tp.z, 6, 'l0');
      world.favelaCDDData.waterTanksCount++;
    }
    if (u === 0 || u === units.length - 1) {
      addLocalBox(batcher, 'rebar_iron', 0.09, 1.08, 0.09, ulx + (u === 0 ? -uw * 0.42 : uw * 0.42), curY + 0.54, topLz + ud * 0.38, cx, uBaseY, cz, cosY, sinY, rotY, 'l0');
    }

    const roofRoll = hashInt(uSeed + 63) % 4;
    if (roofRoll <= 2) {
      const pitchZ = roofRoll === 0 ? (uSeed & 1 ? 1 : -1) * 0.15 : 0;
      const pitchX = roofRoll !== 0 ? alleySign * (roofRoll === 1 ? 0.14 : -0.13) : 0;
      addLocalSlopedBox(batcher, 'zinc_roof', roofRoll === 2 ? topW * 0.76 : topW + 0.52, 0.11, ud + 0.54, topLx, curY + 0.84, topLz, pitchX, pitchZ, cx, uBaseY, cz, cosY, sinY, rotY, 'l0', true);
    } else if (u === 1) {
      addLocalBox(batcher, 'cv_red', 0.68, 0.54, 0.08, topLx - 0.42, curY + 0.85, topLz + ud * 0.18, cx, uBaseY, cz, cosY, sinY, rotY, 'l0');
      addLocalBox(batcher, 'favela_yellow_faded', 0.62, 0.5, 0.08, topLx + 0.42, curY + 0.88, topLz + ud * 0.18, cx, uBaseY, cz, cosY, sinY, rotY, 'l0');
    }

    const unitTopAbsY = uBaseY + curY + 0.92;
    if (unitTopAbsY > maxClusterTopY) maxClusterTopY = unitTopAbsY;
    if (curY + uYOff > l1MaxH) l1MaxH = curY + uYOff;
  }

  // 3. Silhueta Nível 1 (`>= 650m`): prisma macro com topo de laje no próprio Atlas (~10–20 tris por meio-bloco!)
  const fin1 = l1Finish || { tileId: 0, tintHex: 0xffffff };
  const h1 = l1MaxH + foundH * 0.65;
  addLocalWallBox(batcher, fin1.tileId, fin1.tintHex, spanW, h1, d, 0, l1MaxH - h1 * 0.5, 0, cx, groupYBase, cz, cosY, sinY, rotY, 'l1', true);
  if ((seed & 3) === 0) {
    addLocalBox(batcher, 'zinc_roof', spanW + 0.35, 0.24, d + 0.35, 0, l1MaxH + 0.12, 0, cx, groupYBase, cz, cosY, sinY, rotY, 'l1', true);
  }

  world.addObbCollider(cx, cz, spanW, d, rotY, Math.max(yFootBottom + 2.0, maxClusterTopY), yFootBottom);

  if (registerParcel) {
    world.mapBuildings.push({
      x: cx, z: cz, w: units[0].w, d, rotY,
      height: maxClusterTopY - groupYBase, color: primaryMapColor, isFavelaParcel: true
    });
    world.favelaCDDData.housesCount++;
  }

  return { topY: maxClusterTopY, yBase: groupYBase, spanW };
}
