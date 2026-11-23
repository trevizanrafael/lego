import { localToWorldXZ } from '../../buildings/LotGeometry2D.js';
import { getFavelaElevation } from './FavelaElevationAndBatcher.js';

const BRICK_TINTS = [0xffffff, 0xf5e7dd, 0xead8cc, 0xdfcabc];
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

/**
 * Seleciona acabamento autêntico (~83% tijolo baiano cru + reboco/chapisco mal feito, ~17% pintura gasta/CV).
 */
export function pickAuthenticWallFinish(world, seed, floorIdx = 0) {
  const roll = hashInt(seed * 31 + floorIdx * 17) % 100;
  if (roll < 36) {
    world.favelaCDDData.brickBaianoCount++;
    return {
      tileId: 0,
      tintHex: BRICK_TINTS[roll % BRICK_TINTS.length],
      mapColor: '#9a3c1a'
    };
  }
  if (roll < 55) {
    world.favelaCDDData.brickBaianoCount++;
    return {
      tileId: 1,
      tintHex: HALF_PLASTER_TINTS[roll % HALF_PLASTER_TINTS.length],
      mapColor: '#854027'
    };
  }
  if (roll < 83) {
    world.favelaCDDData.cementRawCount++;
    return {
      tileId: 2,
      tintHex: CEMENT_TINTS[roll % CEMENT_TINTS.length],
      mapColor: '#525866'
    };
  }
  world.favelaCDDData.cvPaintedCount++;
  const p = PAINTED_SPECS[roll % PAINTED_SPECS.length];
  return {
    tileId: 3,
    tintHex: p.tint,
    mapColor: p.mapHex
  };
}

function addLocalBox(batcher, key, lw, lh, ld, lx, ly, lz, cx, yBase, cz, cosY, sinY, rotY, tintHex = null) {
  const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
  batcher.addBox(key, lw, lh, ld, wp.x, yBase + ly, wp.z, rotY, tintHex);
}

function addLocalWallBox(batcher, tileId, tintHex, lw, lh, ld, lx, ly, lz, cx, yBase, cz, cosY, sinY, rotY) {
  const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
  batcher.addWallBox(tileId, tintHex, lw, lh, ld, wp.x, yBase + ly, wp.z, rotY);
}

function addLocalSlopedBox(batcher, key, lw, lh, ld, lx, ly, lz, rotX, rotZ, cx, yBase, cz, cosY, sinY, rotY) {
  const wp = localToWorldXZ(cx, cz, lx, lz, cosY, sinY);
  batcher.addSlopedBox(key, lw, lh, ld, wp.x, yBase + ly, wp.z, rotX, rotZ, rotY);
}

/**
 * Constrói 1 lote autêntico de barraco / sobrado / ponto comunitário na encosta da CDD:
 *   - Alicerce escalonado de concreto (`retaining_concrete`) embutido na ladeira (zero flutuação!)
 *   - Paredes com atlas 2x2 de Tijolo Baiano, Reboco Parcial, Chapisco Cinza e Pintura Descascando
 *   - Puxadinhos em balanço sobre o beco, meia-laje assimétrica, escada externa de concreto
 *   - Laje com vergalhões ("esperas de pilar"), telha de zinco inclinada, caixa d'água azul e varal
 *   - Muro de quintal / edícula lateral opcional fechando o tecido contínuo da viela
 *   - Colisor `OBB` justo orientado em `rotY` + registro rotacionado em `world.mapBuildings`
 */
export function buildAuthenticFavelaParcel(world, batcher, spec) {
  const {
    cx,
    cz,
    w,
    d,
    floors,
    rotY,
    seed,
    alleySign = 1,
    spotKind = 'house',
    yardSideW = 0
  } = spec;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const hw = w * 0.5;
  const hd = d * 0.5;

  const cCenter = getFavelaElevation(cx, cz);
  const c1 = localToWorldXZ(cx, cz, -hw, -hd, cosY, sinY);
  const c2 = localToWorldXZ(cx, cz, hw, -hd, cosY, sinY);
  const c3 = localToWorldXZ(cx, cz, hw, hd, cosY, sinY);
  const c4 = localToWorldXZ(cx, cz, -hw, hd, cosY, sinY);
  const y1 = getFavelaElevation(c1.x, c1.z);
  const y2 = getFavelaElevation(c2.x, c2.z);
  const y3 = getFavelaElevation(c3.x, c3.z);
  const y4 = getFavelaElevation(c4.x, c4.z);
  const minCornerY = Math.min(cCenter, y1, y2, y3, y4);
  const maxCornerY = Math.max(cCenter, y1, y2, y3, y4);

  const yBase = Math.max(cCenter, maxCornerY - 0.38) + 0.14;
  const yFootBottom = Math.min(minCornerY - 2.6, yBase - 3.9);
  const foundH = Math.max(2.4, yBase - yFootBottom);

  // 1. Alicerce escalonado de concreto armado ancorado na encosta
  addLocalBox(batcher, 'retaining_concrete', w + 0.42, foundH * 0.55, d + 0.42, 0, -foundH * 0.72, 0, cx, yBase, cz, cosY, sinY, rotY);
  addLocalBox(batcher, 'retaining_concrete', w + 0.18, foundH * 0.52, d + 0.18, 0, -foundH * 0.24, 0, cx, yBase, cz, cosY, sinY, rotY);

  // 2. Casos especiais comunitários: Igrejinha do Morro & Ponto de Mototáxi
  if (spotKind === 'chapel') {
    const chH = 5.4;
    world.favelaCDDData.cvPaintedCount++;
    addLocalWallBox(batcher, 3, 0xdce3ec, w, chH, d, 0, chH * 0.5, 0, cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'favela_blue_faded', w + 0.16, 0.75, d + 0.16, 0, 0.38, 0, cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'favela_blue_faded', 1.35, 2.5, 0.18, 0, 1.25, alleySign * (hd + 0.06), cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'window_lit', 0.9, 1.4, d * 0.55, 0, 3.1, 0, cx, yBase, cz, cosY, sinY, rotY);
    addLocalWallBox(batcher, 3, 0xdce3ec, w * 0.52, 1.85, 0.55, 0, chH + 0.92, alleySign * (hd - 0.3), cx, yBase, cz, cosY, sinY, rotY);
    addLocalSlopedBox(batcher, 'zinc_roof', w * 0.58, 0.16, d + 0.6, -w * 0.24, chH + 0.55, 0, 0, 0.24, cx, yBase, cz, cosY, sinY, rotY);
    addLocalSlopedBox(batcher, 'zinc_roof', w * 0.58, 0.16, d + 0.6, w * 0.24, chH + 0.55, 0, 0, -0.24, cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'cv_white', 0.18, 2.35, 0.18, 0, chH + 2.85, alleySign * (hd - 0.3), cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'cv_white', 1.25, 0.18, 0.18, 0, chH + 3.35, alleySign * (hd - 0.3), cx, yBase, cz, cosY, sinY, rotY);

    const topY = yBase + chH + 1.9;
    world.addObbCollider(cx, cz, w, d, rotY, topY, yFootBottom);
    world.mapBuildings.push({ x: cx, z: cz, w, d, rotY, height: topY - yBase, color: '#cbd5e1', isFavelaParcel: true });
    world.favelaCDDData.housesCount++;
    return { topY, yBase };
  }

  // 3. Andares do Barraco / Sobrado / Birosca / Mototáxi
  const floorH = 3.18 + (hashInt(seed + 5) % 4) * 0.08;
  let curLocalY = 0;
  let mapColor = '#9a3c1a';
  let topSlabW = w;
  let topSlabLx = 0;
  let topSlabLz = 0;

  for (let f = 0; f < floors; f++) {
    const finish = pickAuthenticWallFinish(world, seed, f);
    if (f === 0) mapColor = finish.mapColor;

    const hasOverhang = f > 0 && ((seed + f) & 1) === 0;
    const overhangD = hasOverhang ? 0.52 + (hashInt(seed + f * 9) % 3) * 0.11 : 0;
    const isHalfTopStory = f === floors - 1 && floors >= 2 && hashInt(seed + 71) % 3 === 0;

    const fw = isHalfTopStory ? w * 0.62 : w;
    const fd = d + overhangD;
    const lx = isHalfTopStory ? ((seed & 1 ? 1 : -1) * (w - fw) * 0.5) : 0;
    const lz = overhangD * 0.5 * alleySign;

    addLocalWallBox(batcher, finish.tileId, finish.tintHex, fw, floorH, fd, lx, curLocalY + floorH * 0.5, lz, cx, yBase, cz, cosY, sinY, rotY);

    // Mãos-francesas sob o puxadinho em balanço
    if (hasOverhang) {
      const strutZ = alleySign * (hd + overhangD * 0.45);
      const strutTilt = alleySign * -0.52;
      for (const sx of [-fw * 0.34, fw * 0.34]) {
        addLocalSlopedBox(batcher, 'rebar_iron', 0.11, 0.95, 0.11, lx + sx, curLocalY - 0.32, strutZ, strutTilt, 0, cx, yBase, cz, cosY, sinY, rotY);
      }
    }

    // Birosca / Boteco de esquina ou Ponto de Mototáxi no térreo
    if (f === 0 && (spotKind === 'birosca' || spotKind === 'mototaxi')) {
      const frontZ = alleySign * (hd + 0.08);
      addLocalBox(batcher, 'zinc_roof', fw * 0.68, 2.15, 0.12, 0, 1.08, frontZ, cx, yBase, cz, cosY, sinY, rotY);
      const awningKey = spotKind === 'mototaxi' ? 'favela_yellow_faded' : (seed & 1 ? 'cv_red' : 'favela_yellow_faded');
      addLocalSlopedBox(batcher, awningKey, fw * 0.86, 0.11, 1.55, 0, 2.48, alleySign * (hd + 0.72), alleySign * 0.22, 0, cx, yBase, cz, cosY, sinY, rotY);
      addLocalBox(batcher, 'favela_bulb_warm', 0.24, 0.22, 0.24, 0, 2.28, alleySign * (hd + 0.95), cx, yBase, cz, cosY, sinY, rotY);
    } else {
      // Janelas pequenas assimétricas reais (sem faixa envidraçada de prédio comercial!)
      const winRoll = hashInt(seed * 13 + f * 29) % 10;
      const winMat = winRoll < 4 ? 'window_lit' : winRoll < 6 ? 'window_orange' : winRoll === 6 ? 'window_tv_blue' : 'window_dark';
      const winX = lx + ((hashInt(seed + f) % 3) - 1) * (fw * 0.2);
      const winZ = lz + alleySign * (fd * 0.5 + 0.05);
      addLocalBox(batcher, winMat, Math.min(1.25, fw * 0.34), 0.88, 0.12, winX, curLocalY + 1.85, winZ, cx, yBase, cz, cosY, sinY, rotY);
      if (f === 0 && seed % 2 === 0) {
        addLocalBox(batcher, 'rebar_iron', 0.92, 2.05, 0.1, lx - winX * 0.45, 1.03, winZ, cx, yBase, cz, cosY, sinY, rotY);
      }
    }

    // Laje intermediária ou cobertura de concreto
    const slabW = (isHalfTopStory ? w : fw) + 0.44;
    const slabD = fd + 0.44;
    addLocalBox(batcher, 'cement_slab', slabW, 0.24, slabD, isHalfTopStory ? 0 : lx, curLocalY + floorH + 0.12, lz, cx, yBase, cz, cosY, sinY, rotY);

    // Mureta de tijolo na meia-laje aberta
    if (isHalfTopStory) {
      const openSign = lx > 0 ? -1 : 1;
      const openX = openSign * (w * 0.31);
      addLocalWallBox(batcher, 0, 0xead8cc, w * 0.36, 0.92, fd * 0.94, openX, curLocalY + 0.46, lz, cx, yBase, cz, cosY, sinY, rotY);
    }

    topSlabW = fw;
    topSlabLx = lx;
    topSlabLz = lz;
    curLocalY += floorH + 0.22;
  }

  // Escada externa estreita de cimento em parte dos sobrados
  if (floors >= 2 && hashInt(seed + 41) % 4 === 0) {
    const stairSide = (seed & 1 ? 1 : -1) * (hw + 0.38);
    addLocalSlopedBox(batcher, 'cement_slab', 0.72, 0.22, 3.6, stairSide, floorH * 0.52, 0, 0.68, 0, cx, yBase, cz, cosY, sinY, rotY);
    addLocalSlopedBox(batcher, 'rebar_iron', 0.08, 0.08, 3.6, stairSide + (stairSide > 0 ? 0.3 : -0.3), floorH * 0.52 + 0.78, 0, 0.68, 0, cx, yBase, cz, cosY, sinY, rotY);
  }

  // 4. Laje Superior: Esperas de Vergalhão + Telha de Zinco Inclinada + Caixa d'Água Azul + Varal
  for (const [rx, rz] of [
    [-hw + 0.22, -hd + 0.22],
    [hw - 0.22, -hd + 0.22],
    [-hw + 0.22, hd - 0.22],
    [hw - 0.22, hd - 0.22]
  ]) {
    addLocalBox(batcher, 'rebar_iron', 0.09, 1.15, 0.09, rx, curLocalY + 0.55, topSlabLz + rz, cx, yBase, cz, cosY, sinY, rotY);
  }

  if (hashInt(seed + 19) % 4 !== 0) {
    const tankLx = topSlabLx - topSlabW * 0.22;
    const tankLz = topSlabLz - d * 0.18;
    const tp = localToWorldXZ(cx, cz, tankLx, tankLz, cosY, sinY);
    batcher.addCylinder('water_tank_blue', 0.92, 0.84, 1.32, tp.x, yBase + curLocalY + 0.66, tp.z, 8);
    batcher.addCylinder('water_tank_lid', 0.98, 0.96, 0.16, tp.x, yBase + curLocalY + 1.38, tp.z, 8);
    world.favelaCDDData.waterTanksCount++;
  }

  const roofRoll = hashInt(seed + 63) % 4;
  if (roofRoll <= 1) {
    const pitch = (seed & 1 ? 1 : -1) * 0.15;
    addLocalBox(batcher, 'wood_pole', 0.14, 1.15, 0.14, topSlabLx - topSlabW * 0.34, curLocalY + 0.56, topSlabLz, cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'wood_pole', 0.14, 0.72, 0.14, topSlabLx + topSlabW * 0.34, curLocalY + 0.36, topSlabLz, cx, yBase, cz, cosY, sinY, rotY);
    addLocalSlopedBox(batcher, 'zinc_roof', topSlabW + 0.55, 0.11, d + 0.55, topSlabLx, curLocalY + 1.05, topSlabLz, 0, pitch, cx, yBase, cz, cosY, sinY, rotY);
  } else if (roofRoll === 2) {
    addLocalSlopedBox(batcher, 'zinc_roof', topSlabW * 0.68, 0.11, d + 0.45, topSlabLx + topSlabW * 0.16, curLocalY + 0.92, topSlabLz, alleySign * 0.14, 0, cx, yBase, cz, cosY, sinY, rotY);
  } else {
    // Varal com roupas penduradas na laje aberta
    addLocalBox(batcher, 'wire_black', topSlabW * 0.74, 0.06, 0.06, topSlabLx, curLocalY + 1.25, topSlabLz + d * 0.18, cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'cv_red', 0.68, 0.58, 0.08, topSlabLx - 0.55, curLocalY + 0.92, topSlabLz + d * 0.18, cx, yBase, cz, cosY, sinY, rotY);
    addLocalBox(batcher, 'favela_yellow_faded', 0.64, 0.52, 0.08, topSlabLx + 0.45, curLocalY + 0.95, topSlabLz + d * 0.18, cx, yBase, cz, cosY, sinY, rotY);
  }

  // 5. Extensão lateral de Quintal Murado / Puxadinho Térreo (fecha vazios entre lotes na curva do beco!)
  let totalObbW = w;
  let obbCx = cx;
  let obbCz = cz;
  if (yardSideW >= 2.2) {
    const yardLx = hw + yardSideW * 0.5;
    const yp = localToWorldXZ(cx, cz, yardLx, 0, cosY, sinY);
    const yYard = getFavelaElevation(yp.x, yp.z);
    if (Math.abs(yYard - cCenter) < 3.6) {
      addLocalBox(batcher, 'retaining_concrete', yardSideW, foundH * 0.75, d * 0.92, yardLx, -foundH * 0.36, 0, cx, yBase, cz, cosY, sinY, rotY);
      addLocalWallBox(batcher, seed % 2, 0xead8cc, yardSideW, 1.95, 0.28, yardLx, 0.98, alleySign * (hd - 0.14), cx, yBase, cz, cosY, sinY, rotY);
      addLocalWallBox(batcher, 2, 0x767d88, yardSideW, 1.85, 0.28, yardLx, 0.92, -alleySign * (hd - 0.14), cx, yBase, cz, cosY, sinY, rotY);
      if (seed % 3 !== 0) {
        addLocalWallBox(batcher, 1, 0xe8ded6, yardSideW * 0.65, 2.55, d * 0.68, yardLx - yardSideW * 0.14, 1.28, -alleySign * d * 0.1, cx, yBase, cz, cosY, sinY, rotY);
        addLocalSlopedBox(batcher, 'zinc_roof', yardSideW * 0.72, 0.1, d * 0.76, yardLx - yardSideW * 0.14, 2.66, -alleySign * d * 0.1, alleySign * 0.14, 0, cx, yBase, cz, cosY, sinY, rotY);
      }
      const midShift = localToWorldXZ(cx, cz, yardSideW * 0.5, 0, cosY, sinY);
      obbCx = midShift.x;
      obbCz = midShift.z;
      totalObbW = w + yardSideW;
    }
  }

  const topY = yBase + curLocalY + 1.15;
  world.addObbCollider(obbCx, obbCz, totalObbW, d, rotY, Math.max(yFootBottom + 2.0, topY), yFootBottom);

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w,
    d,
    rotY,
    height: topY - yBase,
    color: mapColor,
    isFavelaParcel: true
  });

  world.favelaCDDData.housesCount++;
  return { topY, yBase };
}
