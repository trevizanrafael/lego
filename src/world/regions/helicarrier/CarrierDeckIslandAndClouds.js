import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick,
  markAsSharedAsset
} from '../../../materials/LegoMaterials.js';
import { makeFastBox } from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { createMergedCarrierMesh } from './CarrierHullAndTurbines.js';

function _createCarrierCanvasTex(w, h, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  markAsSharedAsset(tex);
  return tex;
}

function _createMainRunwayDeckTexture() {
  return _createCarrierCanvasTex(512, 1024, (ctx, W, H) => {
    // Non-slip dark naval deck asphalt
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Subtle deck panel seams (non-flickering medium contrast)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 3;
    for (let y = 0; y < H; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Yellow-black hazard edge strips
    ctx.fillStyle = '#facc15';
    ctx.fillRect(14, 16, 12, H - 32);
    ctx.fillRect(W - 26, 16, 12, H - 32);

    // White/Red foul lines
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(36, 16, 6, H - 32);
    ctx.fillRect(W - 42, 16, 6, H - 32);

    // Dashed centerline
    ctx.fillStyle = '#f8fafc';
    for (let y = 110; y < H - 120; y += 54) {
      ctx.fillRect(W * 0.5 - 6, y, 12, 28);
    }

    // Twin forward catapult channels (upper half = bow -Z)
    for (const cx of [W * 0.34, W * 0.66]) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 10, 48, 20, 420);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - 13, 48, 3, 420);
      ctx.fillRect(cx + 10, 48, 3, 420);
    }

    // Arresting wires near stern landing zone (lower third)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    for (let wIdx = 0; wIdx < 4; wIdx++) {
      const wy = H - 220 + wIdx * 24;
      ctx.beginPath();
      ctx.moveTo(46, wy);
      ctx.lineTo(W - 46, wy);
      ctx.stroke();
    }

    // Threshold piano keys & numbers 09 / 27
    ctx.fillStyle = '#f8fafc';
    for (let i = 0; i < 6; i++) {
      const kx = 64 + i * 68;
      ctx.fillRect(kx, 22, 28, 36);
      ctx.fillRect(kx, H - 58, 28, 36);
    }

    ctx.fillStyle = '#facc15';
    ctx.font = '900 58px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('09', W * 0.5, 92);
    ctx.save();
    ctx.translate(W * 0.5, H - 94);
    ctx.rotate(Math.PI);
    ctx.fillText('27', 0, 0);
    ctx.restore();
  });
}

function _createAngledDeckTexture() {
  return _createCarrierCanvasTex(256, 512, (ctx, W, H) => {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(10, 12, 10, H - 24);
    ctx.fillRect(W - 20, 12, 10, H - 24);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(28, 12, 6, H - 24);
    ctx.fillRect(W - 34, 12, 6, H - 24);

    // Center recovery dashed guide
    ctx.fillStyle = '#f8fafc';
    for (let y = 60; y < H - 60; y += 44) {
      ctx.fillRect(W * 0.5 - 5, y, 10, 24);
    }
    ctx.fillStyle = '#facc15';
    ctx.font = '900 44px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('18', W * 0.5, 42);
    ctx.fillText('36', W * 0.5, H - 42);
  });
}

function _createHelipadDeckTexture() {
  return _createCarrierCanvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 98, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 114, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 120px "Teko", "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', W * 0.5, H * 0.52);
  });
}

function _createHullBadgeTexture(text = '64', sub = 'HC-64') {
  return _createCarrierCanvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 132px "Teko", "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W * 0.5, H * 0.45);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 32px "JetBrains Mono", monospace';
    ctx.fillText(sub, W * 0.5, H * 0.82);
  });
}

function _createTurntablePadTexture() {
  return _createCarrierCanvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 112, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 84, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AIRCRAFT CUSTOM', W * 0.5, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('HANGAR BAY 01', W * 0.5, H - 28);
  });
}

/**
 * Inicializa o registro `world.helicarrierNightFX` e todos os materiais navais/táticos compartilhados.
 */
export function initHelicarrierNightFXAndMaterials(world) {
  const nightFx = {
    deckStripMats: [],
    bridgeWindowMats: [],
    hangarGlowMats: [],
    beaconMeshes: [],
    plasmaMats: []
  };
  world.helicarrierNightFX = nightFx;

  const mats = {
    deckMat: getLegoMaterial(0x1e293b, { roughness: 0.42, metalness: 0.14, clearcoat: 0.18 }),
    hullDarkMat: getLegoMaterial(0x334155, { roughness: 0.28, metalness: 0.34, clearcoat: 0.32 }),
    hullCharcoalMat: getLegoMaterial(0x1e293b, { roughness: 0.32, metalness: 0.42, clearcoat: 0.25 }),
    keelNavyMat: getLegoMaterial(0x0f172a, { roughness: 0.26, metalness: 0.48, clearcoat: 0.22 }),
    armorSilverMat: getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.22, metalness: 0.56 }),
    cautionYellowMat: getLegoMaterial(LEGO_COLORS.yellow, { roughness: 0.24, clearcoat: 0.45 }),
    accentRedMat: getLegoMaterial(LEGO_COLORS.red, { roughness: 0.24, clearcoat: 0.4 }),
    bellyGlowMat: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
    navRedMat: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    navGreenMat: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    runwayLedMat: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    hangarGlowMat: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    bridgeGlowMat: getLegoMaterial(0x38bdf8, {
      roughness: 0.1,
      metalness: 0.25,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45
    })
  };

  nightFx.plasmaMats.push(mats.bellyGlowMat);
  nightFx.hangarGlowMats.push(mats.hangarGlowMat);
  nightFx.bridgeWindowMats.push(mats.bridgeGlowMat);

  return { nightFx, mats };
}

/**
 * 2. CONVÉS DE VOO TEXTURIZADO (PISTA AXIAL, PISTA EM ÂNGULO, 2 CATAPULTAS, 2 ELEVADORES & HELIPONTO)
 */
export function buildCarrierFlightDeckElevatorsAndCatapults({ cfg, hullStructureGroup, mats }) {
  const { deckD } = cfg;
  const elevCharcoal = [];
  const elevYellow = [];
  const elevSilver = [];

  // Plataformas dos 2 Elevadores de Aeronaves (Estibordo Vante & Bombordo Ré)
  const elevators = [
    { x: 40, z: -84, w: 22, d: 28 },
    { x: -42, z: 72, w: 22, d: 28 }
  ];
  for (const el of elevators) {
    elevCharcoal.push(makeFastBox(el.w, 2.6, el.d, el.x, -1.6, el.z));
    elevYellow.push(
      makeFastBox(el.w + 1.2, 0.4, 1.4, el.x, 0.26, el.z - el.d * 0.5),
      makeFastBox(el.w + 1.2, 0.4, 1.4, el.x, 0.26, el.z + el.d * 0.5),
      makeFastBox(1.4, 0.4, el.d, el.x - el.w * 0.5, 0.26, el.z),
      makeFastBox(1.4, 0.4, el.d, el.x + el.w * 0.5, 0.26, el.z)
    );
    // Pistões hidráulicos visíveis sob o elevador
    elevSilver.push(
      makeFastBox(1.8, 8.0, 1.8, el.x - 6, -6.0, el.z - 8),
      makeFastBox(1.8, 8.0, 1.8, el.x + 6, -6.0, el.z + 8)
    );
  }

  // JBD (Defletores de Jato) e trilhos de catapulta elevados na proa
  for (const cx of [-22, -6]) {
    elevCharcoal.push(makeFastBox(5.2, 1.2, 1.6, cx, 0.72, -16));
    elevYellow.push(makeFastBox(5.4, 0.3, 1.8, cx, 1.22, -16));
  }

  for (const [boxes, mat, cast] of [
    [elevCharcoal, mats.hullCharcoalMat, true],
    [elevYellow, mats.cautionYellowMat, false],
    [elevSilver, mats.armorSilverMat, false]
  ]) {
    const m = createMergedCarrierMesh(boxes, mat, cast, true);
    if (m) hullStructureGroup.add(m);
  }

  const mainRunwayMat = new THREE.MeshStandardMaterial({
    map: _createMainRunwayDeckTexture(),
    roughness: 0.68,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2
  });
  const mainRunway = new THREE.Mesh(new THREE.PlaneGeometry(38, deckD - 16), mainRunwayMat);
  mainRunway.rotation.x = -Math.PI / 2;
  mainRunway.position.set(-14, 0.44, 0);
  mainRunway.receiveShadow = true;
  hullStructureGroup.add(mainRunway);

  const angledRunwayMat = new THREE.MeshStandardMaterial({
    map: _createAngledDeckTexture(),
    roughness: 0.68,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2
  });
  const angledRunway = new THREE.Mesh(new THREE.PlaneGeometry(24, 146), angledRunwayMat);
  angledRunway.rotation.x = -Math.PI / 2;
  angledRunway.position.set(-54, 0.44, 10);
  angledRunway.receiveShadow = true;
  hullStructureGroup.add(angledRunway);

  // Heliponto Tático (H) alinhado exatamente sob o Helicóptero Falcon-X (mundo: 22, 410.45, 32 -> local: 22, 0.45, 82)
  const helipadMat = new THREE.MeshStandardMaterial({
    map: _createHelipadDeckTexture(),
    roughness: 0.62,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -3
  });
  const helipad = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), helipadMat);
  helipad.rotation.x = -Math.PI / 2;
  helipad.position.set(22, 0.46, 82);
  helipad.receiveShadow = true;
  hullStructureGroup.add(helipad);
}

/**
 * 3. TORRE DE COMANDO MULTINÍVEL (ILHA DE CONTROLE + PONTE + RADARES + MASTRO)
 */
export function buildCarrierCommandIsland(world, { cfg, hullStructureGroup, mats, nightFx }) {
  const { hx, hy, hz } = cfg;
  const txRel = 36;
  const tzRel = -18;
  world.addCollider(hx + txRel, hz + tzRel, 18, 54, hy + 34.5, hy);

  const islandGroup = new THREE.Group();
  islandGroup.position.set(txRel, 0.4, tzRel);
  hullStructureGroup.add(islandGroup);

  const islandDark = [];
  const islandChar = [];
  const islandSilver = [];
  const islandYellow = [];

  // Nível 1: Base Blindada de Controle de Voo (18 x 16 x 54)
  islandChar.push(
    makeFastBox(18, 16, 54, 0, 8, 0),
    makeFastBox(19.4, 1.4, 55.4, 0, 16.5, 0)
  );
  // Nível 2: Torre da Ponte de Navegação & Pri-Fly (14 x 12 x 36)
  islandDark.push(
    makeFastBox(14, 12, 36, 0, 23, 0),
    makeFastBox(17.5, 2.2, 16, -2.5, 26.5, -8)
  );
  // Nível 3: Deck de Radares e Chaminé Blindada
  islandChar.push(
    makeFastBox(10, 6.5, 22, 0, 32.2, 2),
    makeFastBox(6, 7.5, 8, 1.5, 33.0, 12)
  );
  islandSilver.push(
    makeFastBox(1.1, 20, 1.1, 0, 44.5, 8),
    makeFastBox(8.5, 0.55, 0.55, 0, 49.5, 8),
    makeFastBox(5.5, 0.45, 0.45, 0, 52.5, 8)
  );
  islandYellow.push(
    makeFastBox(14.6, 0.5, 36.6, 0, 29.2, 0)
  );

  for (const [boxes, mat, cast] of [
    [islandChar, mats.hullCharcoalMat, true],
    [islandDark, mats.hullDarkMat, true],
    [islandSilver, mats.armorSilverMat, false],
    [islandYellow, mats.cautionYellowMat, false]
  ]) {
    const m = createMergedCarrierMesh(boxes, mat, cast, true);
    if (m) islandGroup.add(m);
  }

  // Vidraças inclinadas iluminadas da Ponte Principal & Pri-Fly
  const bridgeGlassMat = getLegoMaterial(0x38bdf8, {
    roughness: 0.08,
    metalness: 0.24,
    transparent: true,
    opacity: 0.84
  });
  const mainBridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.4, 31.5), bridgeGlassMat);
  mainBridgeGlass.position.set(-6.6, 25.2, 0);
  mainBridgeGlass.rotation.z = 0.22;
  const priFlyGlass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.2, 14.5), mats.bridgeGlowMat);
  priFlyGlass.position.set(-9.4, 15.6, 12);
  priFlyGlass.rotation.z = 0.16;
  const bridgeInteriorGlow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 26), mats.bridgeGlowMat);
  bridgeInteriorGlow.position.set(-4.5, 25.0, 0);
  islandGroup.add(mainBridgeGlass, priFlyGlass, bridgeInteriorGlow);

  // Placas Numéricas "64" nas faces da Ilha
  const hullBadgeMat = new THREE.MeshStandardMaterial({
    map: _createHullBadgeTexture('64', 'HELICARRIER'),
    roughness: 0.35
  });
  for (const [bx, bz, ry] of [
    [-9.15, 0, -Math.PI / 2],
    [9.15, 0, Math.PI / 2]
  ]) {
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), hullBadgeMat);
    badge.position.set(bx, 9.5, bz);
    badge.rotation.y = ry;
    islandGroup.add(badge);
  }

  // Radares Giratórios Duplos na Ilha
  const carrierRadarMain = new THREE.Group();
  carrierRadarMain.position.set(0, 37.5, -5);
  const radarDish1 = createLegoBrick(13.5, 3.2, 2.2, LEGO_COLORS.yellow);
  carrierRadarMain.add(radarDish1);
  islandGroup.add(carrierRadarMain);
  world.rotatingElements.push({ mesh: carrierRadarMain, axis: 'y', speed: 2.3 });

  const carrierRadarAux = new THREE.Group();
  carrierRadarAux.position.set(0, 41.0, 4);
  const radarDish2 = createLegoBrick(7.5, 2.0, 1.4, LEGO_COLORS.silver);
  carrierRadarAux.add(radarDish2);
  islandGroup.add(carrierRadarAux);
  world.rotatingElements.push({ mesh: carrierRadarAux, axis: 'y', speed: -3.6 });

  // Farol vermelho aeronáutico no topo do mastro da ilha
  const mastBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), mats.navRedMat);
  mastBeacon.position.set(0, 55.2, 8);
  islandGroup.add(mastBeacon);
  nightFx.beaconMeshes.push(mastBeacon);
}

/**
 * 5. HANGAR / OFICINA DE PERSONALIZAÇÃO DE AERONAVES NO CONVÉS (VISÍVEL + INTERATIVO!)
 */
export function buildCarrierCustomizationHangar(world, { cfg, hullStructureGroup, mats, nightFx }) {
  const { hx, hy, hz } = cfg;
  const hangarLocalX = 20;
  const hangarLocalZ = 114; // -> Mundo Z = hz + 114 = +64

  const padMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({
      map: _createTurntablePadTexture(),
      roughness: 0.42,
      metalness: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    })
  );
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.set(hangarLocalX, 0.47, hangarLocalZ);
  padMesh.receiveShadow = true;
  hullStructureGroup.add(padMesh);

  const padHaloMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide
  });
  nightFx.hangarGlowMats.push(padHaloMat);
  const padRing = new THREE.Mesh(new THREE.RingGeometry(8.8, 10.2, 36), padHaloMat);
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.set(hangarLocalX, 0.52, hangarLocalZ);
  hullStructureGroup.add(padRing);

  const bayBoxes = [
    makeFastBox(2.2, 10.5, 24.0, hangarLocalX - 12.2, 5.65, hangarLocalZ),
    makeFastBox(2.2, 10.5, 24.0, hangarLocalX + 12.2, 5.65, hangarLocalZ),
    makeFastBox(26.6, 10.5, 2.2, hangarLocalX, 5.65, hangarLocalZ + 11.2),
    makeFastBox(27.4, 1.4, 25.4, hangarLocalX, 11.3, hangarLocalZ)
  ];
  const bayMesh = createMergedCarrierMesh(bayBoxes, mats.hullCharcoalMat, true, true);
  if (bayMesh) hullStructureGroup.add(bayMesh);

  world.addCollider(hx + hangarLocalX - 12.2, hz + hangarLocalZ, 2.4, 24.2, hy + 11.5, hy);
  world.addCollider(hx + hangarLocalX + 12.2, hz + hangarLocalZ, 2.4, 24.2, hy + 11.5, hy);
  world.addCollider(hx + hangarLocalX, hz + hangarLocalZ + 11.2, 26.6, 2.4, hy + 11.5, hy);

  const portalBarTop = new THREE.Mesh(new THREE.BoxGeometry(25.0, 0.65, 0.8), mats.hangarGlowMat);
  portalBarTop.position.set(hangarLocalX, 11.0, hangarLocalZ - 12.2);
  const portalPostL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 10.4, 0.8), mats.cautionYellowMat);
  portalPostL.position.set(hangarLocalX - 11.4, 5.6, hangarLocalZ - 12.2);
  const portalPostR = portalPostL.clone();
  portalPostR.position.x = hangarLocalX + 11.4;
  hullStructureGroup.add(portalBarTop, portalPostL, portalPostR);

  const hangarSign = createSignBoardMesh({
    x: hx + hangarLocalX,
    y: hy + 14.4,
    z: hz + hangarLocalZ - 12.2,
    width: 24.0,
    height: 4.4,
    depth: 0.9,
    title: 'HANGAR • PERSONALIZAR [F]',
    bgColor: '#090a0d',
    borderColor: '#00f0ff',
    textColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(hangarSign);

  // Mini-jato holográfico giratório exibido sobre a mesa giratória do Hangar
  const showcasePivot = new THREE.Group();
  showcasePivot.position.set(hangarLocalX, 2.6, hangarLocalZ);
  const holoMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
  const hFuse = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 5.6), holoMat);
  const hWing = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.16, 1.9), holoMat);
  hWing.position.z = 0.2;
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.8), holoMat);
  hTail.position.set(0, 0.5, 2.2);
  showcasePivot.add(hFuse, hWing, hTail);
  hullStructureGroup.add(showcasePivot);
  world.rotatingElements.push({ mesh: showcasePivot, axis: 'y', speed: 0.95 });
  world.helicarrierShowcaseHolo = showcasePivot;

  // Console Principal na entrada do Hangar + Terminal Rápido logo ao lado do Spawn (-14, -34)
  const buildHangarConsole = (lx, lz) => {
    const consoleBody = createLegoBrick(2.6, 1.6, 1.8, LEGO_COLORS.black, { studStep: 0.6 });
    consoleBody.position.set(lx, 1.2, lz);
    const consoleScreen = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 0.28), mats.hangarGlowMat);
    consoleScreen.position.set(lx, 2.25, lz - 0.55);
    hullStructureGroup.add(consoleBody, consoleScreen);
    world.addCollider(hx + lx, hz + lz, 2.6, 1.8, hy + 2.6, hy);
  };
  const consoleLocalX = 10;
  const consoleLocalZ = 100;
  const quickLocalX = -14;
  const quickLocalZ = 16;
  buildHangarConsole(consoleLocalX, consoleLocalZ);
  buildHangarConsole(quickLocalX, quickLocalZ);

  const quickSign = createSignBoardMesh({
    x: hx + quickLocalX,
    y: hy + 4.8,
    z: hz + quickLocalZ,
    width: 11.5,
    height: 2.5,
    depth: 0.5,
    title: 'CUSTOMIZAR [F] / [K]',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#00f0ff',
    doubleSided: true
  });
  world.scene.add(quickSign);

  world.helicarrierHangarData = {
    padPos: { x: hx + hangarLocalX, y: hy + 0.48, z: hz + hangarLocalZ },
    consolePos: { x: hx + consoleLocalX, y: hy + 0.45, z: hz + consoleLocalZ },
    quickConsolePos: { x: hx + quickLocalX, y: hy + 0.45, z: hz + quickLocalZ },
    launchPos: { x: hx - 14, y: hy + 0.48, z: hz + 86, rotY: Math.PI },
    heliLaunchPos: { x: hx + 22, y: hy + 0.48, z: hz + 82, rotY: Math.PI }
  };
}

/**
 * 6 & 7. DETALHES INSTANCIADOS EM LOD 0/1: GUARDA-CORPOS, LUZES, ESCOTILHAS, TRATORES, CONTÊINERES & CAIXAS QUEBRÁVEIS
 */
export function buildCarrierInstancedDeckProps(world, { cfg, hullStructureGroup, lod0, lod1, mats, nightFx }) {
  const { hx, hy, hz, deckW } = cfg;
  const dummy = new THREE.Object3D();

  // 6.1 Guarda-corpos do perímetro (InstancedMesh para alto FPS)
  const stanchionPos = [];
  const railSegments = [];
  for (let rz = -120; rz <= 120; rz += 10) {
    stanchionPos.push([deckW * 0.5 - 0.6, 1.05, rz]);
    if (rz < -70 || rz > 90) {
      stanchionPos.push([-deckW * 0.5 + 0.6, 1.05, rz]);
    }
  }
  for (let rz = -62; rz <= 82; rz += 10) {
    stanchionPos.push([-67.4, 1.05, rz]);
  }
  for (let i = 0; i < stanchionPos.length; i++) {
    const p = stanchionPos[i];
    if (i > 0 && Math.abs(p[0] - stanchionPos[i - 1][0]) < 0.2 && Math.abs(p[2] - stanchionPos[i - 1][2]) <= 10.5) {
      railSegments.push([p[0], 1.55, (p[2] + stanchionPos[i - 1][2]) * 0.5, 0.12, 0.12, 10.0]);
    }
  }

  const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.3, 6);
  const postInst = new THREE.InstancedMesh(postGeo, mats.armorSilverMat, stanchionPos.length);
  stanchionPos.forEach((p, idx) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    postInst.setMatrixAt(idx, dummy.matrix);
  });
  postInst.instanceMatrix.needsUpdate = true;
  lod0.add(postInst);

  if (railSegments.length > 0) {
    const railBoxes = railSegments.map((r) => makeFastBox(r[3], r[4], r[5], r[0], r[1], r[2]));
    const railMesh = createMergedCarrierMesh(railBoxes, mats.cautionYellowMat, false, false);
    if (railMesh) lod0.add(railMesh);
  }

  // 6.2 Luzes de Pouso da Pista & Luzes de Navegação (InstancedMesh em LOD 0)
  const deckLights = [];
  for (let rz = -114; rz <= 114; rz += 12) {
    deckLights.push({ x: -32.5, y: 0.48, z: rz, color: 0xfacc15 });
    deckLights.push({ x: 4.5, y: 0.48, z: rz, color: 0xfacc15 });
    deckLights.push({ x: -14, y: 0.46, z: rz, color: 0xf8fafc });
  }
  for (let rz = -62; rz <= 82; rz += 14) {
    deckLights.push({ x: -65.5, y: 0.48, z: rz, color: 0x38bdf8 });
    deckLights.push({ x: -42.5, y: 0.48, z: rz, color: 0x38bdf8 });
  }
  for (const ax of [-26, -20, -8, -2]) {
    deckLights.push({ x: ax, y: 0.48, z: 122, color: 0x22c55e });
  }
  const ledGeo = new THREE.BoxGeometry(0.65, 0.24, 0.85);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  nightFx.deckStripMats.push(ledMat);
  const ledInst = new THREE.InstancedMesh(ledGeo, ledMat, deckLights.length);
  const cTmp = new THREE.Color();
  deckLights.forEach((dl, idx) => {
    dummy.position.set(dl.x, dl.y, dl.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ledInst.setMatrixAt(idx, dummy.matrix);
    ledInst.setColorAt(idx, cTmp.setHex(dl.color));
  });
  ledInst.instanceMatrix.needsUpdate = true;
  if (ledInst.instanceColor) ledInst.instanceColor.needsUpdate = true;
  lod0.add(ledInst);

  // 6.3 Escotilhas e pinos LEGO decorativos nas passarelas (InstancedMesh)
  const hatchCoords = [
    [10, -110], [10, -68], [10, 12], [-34, -108], [-34, 96], [42, 16]
  ];
  const hatchGeo = new THREE.BoxGeometry(2.6, 0.34, 2.6);
  const hatchInst = new THREE.InstancedMesh(hatchGeo, mats.armorSilverMat, hatchCoords.length);
  hatchCoords.forEach(([lx, lz], idx) => {
    dummy.position.set(lx, 0.56, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hatchInst.setMatrixAt(idx, dummy.matrix);
  });
  hatchInst.instanceMatrix.needsUpdate = true;
  lod0.add(hatchInst);

  const studCoords = [];
  for (let sz = -124; sz <= 124; sz += 8) {
    studCoords.push([49.5, 0.42, sz], [-36.5, 0.42, sz]);
  }
  const studInst = new THREE.InstancedMesh(SHARED_STUD_GEO, mats.hullDarkMat, studCoords.length);
  studCoords.forEach(([sx, sy, sz], idx) => {
    dummy.position.set(sx, sy, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1.4, 1.2, 1.4);
    dummy.updateMatrix();
    studInst.setMatrixAt(idx, dummy.matrix);
  });
  studInst.instanceMatrix.needsUpdate = true;
  lod0.add(studInst);

  // 6.4 Veículos de Apoio no Convés (2 Tratores de Reboque + Carrinhos de Combustível/Munição + Contêineres)
  const supportYellow = [];
  const supportCharcoal = [];
  const supportRed = [];
  const supportBlue = [];

  for (const [vx, vz] of [
    [34, -104],
    [12, 108]
  ]) {
    supportYellow.push(
      makeFastBox(2.6, 1.0, 4.4, vx, 0.95, vz),
      makeFastBox(2.2, 0.85, 1.6, vx, 1.85, vz + 0.5)
    );
    supportCharcoal.push(
      makeFastBox(2.9, 0.75, 1.0, vx, 0.78, vz + 1.4),
      makeFastBox(2.9, 0.75, 1.0, vx, 0.78, vz - 1.4)
    );
    world.addCollider(hx + vx, hz + vz, 2.8, 4.5, hy + 2.3, hy);
  }

  for (const [cx, cz] of [
    [25, -42],
    [25, -24]
  ]) {
    supportRed.push(makeFastBox(1.8, 1.1, 3.0, cx, 1.05, cz));
    supportCharcoal.push(makeFastBox(2.0, 0.4, 3.2, cx, 0.6, cz));
  }
  supportBlue.push(makeFastBox(4.2, 3.2, 8.8, 44, 2.0, 92));
  supportYellow.push(makeFastBox(4.2, 3.2, 8.8, 44, 2.0, 104));
  world.addCollider(hx + 44, hz + 92, 4.4, 9.0, hy + 3.6, hy);
  world.addCollider(hx + 44, hz + 104, 4.4, 9.0, hy + 3.6, hy);

  for (const [boxes, mat] of [
    [supportYellow, mats.cautionYellowMat],
    [supportCharcoal, mats.hullCharcoalMat],
    [supportRed, mats.accentRedMat],
    [supportBlue, getLegoMaterial(LEGO_COLORS.blue)]
  ]) {
    const m = createMergedCarrierMesh(boxes, mat, true, true);
    if (m) lod0.add(m);
  }

  // 6.5 Luzes laterais de navegação (Bombordo Vermelho / Estibordo Verde)
  const navGeo = new THREE.BoxGeometry(1.3, 1.3, 3.2);
  for (let rz = -96; rz <= 96; rz += 32) {
    const lightL = new THREE.Mesh(navGeo, mats.navRedMat);
    lightL.position.set(-deckW * 0.5 - 1.2, -1.6, rz);
    const lightR = new THREE.Mesh(navGeo, mats.navGreenMat);
    lightR.position.set(deckW * 0.5 + 1.2, -1.6, rz);
    hullStructureGroup.add(lightL, lightR);
    nightFx.beaconMeshes.push(lightL, lightR);
  }

  // 6.6 LOD 1 (Médio)
  const lod1Trim = createMergedCarrierMesh(
    [
      makeFastBox(deckW + 2, 0.5, 2.0, 0, 0.4, -128),
      makeFastBox(deckW + 2, 0.5, 2.0, 0, 0.4, 128)
    ],
    mats.cautionYellowMat,
    false,
    false
  );
  if (lod1Trim) lod1.add(lod1Trim);

  // 7. CAIXAS QUEBRÁVEIS TÁTICAS NO CONVÉS (mantidas em world.destructibles)
  for (const [cx, cz, cColor] of [
    [hx + 16, hz - 48, LEGO_COLORS.gold],
    [hx + 18.5, hz - 48, LEGO_COLORS.green],
    [hx + 16, hz + 56, LEGO_COLORS.orange]
  ]) {
    const mCrate = createLegoBrick(1.8, 1.6, 1.8, cColor, { studStep: 0.6 });
    mCrate.position.set(cx, hy + 1.2, cz);
    world.scene.add(mCrate);
    const mCol = world.addCollider(cx, cz, 1.8, 1.8, hy + 2.0, hy);
    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: mCrate,
        type: 'crate',
        hp: 20,
        radius: 1.4,
        height: 1.6,
        colliders: [mCol],
        debrisColors: [cColor, LEGO_COLORS.darkGrey, LEGO_COLORS.yellow],
        studDrops: { silver: 4, gold: 5, blue: 2, purple: 1 },
        groundY: hy + 0.4
      });
    }
  }
}

export function buildLegoClouds(world) {
  const cloudCoords = [
    [-145, 398, -110], [150, 418, -95], [-130, 428, 35], [160, 392, 40],
    [0, 442, -230], [-210, 385, -210], [220, 405, -180],
    [-550, 275, -480], [480, 290, -560], [-320, 285, 480],
    [620, 270, 340], [-920, 265, 160], [1040, 280, 620]
  ];

  cloudCoords.forEach(([cx, cy, cz]) => {
    const cloud = new THREE.Group();
    const b1 = createLegoBrick(34, 6.0, 20, LEGO_COLORS.white, { studStep: 3.5, castShadow: false });
    const b2 = createLegoBrick(22, 5.2, 14, LEGO_COLORS.white, { studStep: 3.5, castShadow: false });
    const b3 = createLegoBrick(16, 4.2, 12, LEGO_COLORS.white, { studStep: 3.5, castShadow: false });
    b2.position.set(7.5, 4.2, 2.0);
    b3.position.set(-8.0, 3.0, -2.5);
    cloud.add(b1, b2, b3);
    cloud.position.set(cx, cy, cz);
    world.scene.add(cloud);
    world.clouds.push(cloud);
  });
}
