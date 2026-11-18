import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick,
  markAsSharedAsset
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeFastBox } from '../BuildingGenerator.js';

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

function _createMergedMesh(rawBoxes, mat, castShadow = true, receiveShadow = true) {
  if (!rawBoxes || rawBoxes.length === 0) return null;
  const geo = mergeBufferGeometries(rawBoxes);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * 10. NO CÉU (ALTITUDE Y = 410m): AEROPORTA-AVIÕES MONUMENTAL REMODELADO (REFERÊNCIA S.H.I.E.L.D. HELICARRIER)
 * - Casco multicamadas com proa afilada, recortes mecânicos laterais, quilha dupla e reator repulsor
 * - Convés detalhado: pista axial 09/27, pista em ângulo bombordo, 2 catapultas, cabos de parada, 2 elevadores e heliponto
 * - Torre de comando multinível com ponte inclinada iluminada, radares giratórios e mastro de comunicações
 * - Hangar / Oficina de Personalização de Aeronaves no convés de popa estibordo
 * - LOD em 3 níveis + InstancedMesh para guarda-corpos, luzes de pouso, escotilhas e detalhes repetidos (60 FPS!)
 */
export function buildSkyHelicarrier(world) {
  const hx = 0;
  const hy = 410.0;
  const hz = -50;
  const deckW = 104;
  const deckD = 260;
  const hullThickness = 26.0;

  const carrierGroup = new THREE.Group();
  carrierGroup.position.set(hx, hy, hz);
  carrierGroup.userData = { isHelicarrier: true, altitude: hy, hullThickness };
  world.scene.add(carrierGroup);
  world.helicarrierGroup = carrierGroup;

  // Registra materiais noturnos do porta-aviões para iluminação dinâmica Dia/Noite
  const nightFx = {
    deckStripMats: [],
    bridgeWindowMats: [],
    hangarGlowMats: [],
    beaconMeshes: [],
    plasmaMats: []
  };
  world.helicarrierNightFX = nightFx;

  // Colisores principais (preservando estritamente minY = 384, maxY = 410.4 para pouso sólido e testes!)
  world.addCollider(hx, hz, deckW, deckD, hy + 0.4, hy - hullThickness);
  world.addCollider(hx - 54, hz + 10, 28, 156, hy + 0.4, hy - 18.0);

  // Materiais LEGO navais e táticos
  const deckMat = getLegoMaterial(0x1e293b, { roughness: 0.42, metalness: 0.14, clearcoat: 0.18 });
  const hullDarkMat = getLegoMaterial(0x334155, { roughness: 0.28, metalness: 0.34, clearcoat: 0.32 });
  const hullCharcoalMat = getLegoMaterial(0x1e293b, { roughness: 0.32, metalness: 0.42, clearcoat: 0.25 });
  const keelNavyMat = getLegoMaterial(0x0f172a, { roughness: 0.26, metalness: 0.48, clearcoat: 0.22 });
  const armorSilverMat = getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.22, metalness: 0.56 });
  const cautionYellowMat = getLegoMaterial(LEGO_COLORS.yellow, { roughness: 0.24, clearcoat: 0.45 });
  const accentRedMat = getLegoMaterial(LEGO_COLORS.red, { roughness: 0.24, clearcoat: 0.4 });
  const bellyGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const navRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const navGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const runwayLedMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const hangarGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const bridgeGlowMat = getLegoMaterial(0x38bdf8, {
    roughness: 0.1,
    metalness: 0.25,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45
  });
  nightFx.plasmaMats.push(bellyGlowMat);
  nightFx.hangarGlowMats.push(hangarGlowMat);
  nightFx.bridgeWindowMats.push(bridgeGlowMat);

  // ============================================================================
  // A) LOD DE 3 NÍVEIS DO PORTA-AVIÕES
  // ============================================================================
  const carrierLOD = new THREE.LOD();
  carrierGroup.add(carrierLOD);
  world.helicarrierLOD = carrierLOD;

  const lod0 = new THREE.Group(); // Detalhe completo (< 460m)
  const lod1 = new THREE.Group(); // Detalhe médio (460..1150m)
  const lod2 = new THREE.Group(); // Silhueta distante (> 1150m)
  carrierLOD.addLevel(lod0, 0);
  carrierLOD.addLevel(lod1, 460);
  carrierLOD.addLevel(lod2, 1150);

  // Grupos compartilhados visíveis em LOD 0 + LOD 1 (estrutura principal do casco, convés e torre)
  const sharedCore01 = new THREE.Group();
  lod0.add(sharedCore01);
  // Nota: THREE.LOD alterna visibilidade dos níveis diretos; portanto clonamos referências leves de estrutura
  // ou colocamos o núcleo compartilhado fora do LOD (em carrierGroup) e colocamos detalhes progressivos nos níveis!
  // Colocar estrutura base em carrierGroup e detalhes médios/finos no LOD evita duplicar draw calls!
  lod0.remove(sharedCore01);
  const hullStructureGroup = new THREE.Group();
  carrierGroup.add(hullStructureGroup);

  // ============================================================================
  // 1. CASCO ESCULPIDO MULTICAMADAS (PROA AFILADA, RECORTES LATERAIS, HANGAR E QUILHA)
  // ============================================================================
  const hullDarkBoxes = [];
  const hullCharcoalBoxes = [];
  const keelBoxes = [];
  const silverBoxes = [];
  const yellowBoxes = [];

  // Convés principal superior (espessura 3.4m, topo em hy + 0.4 -> centro local y = -1.3)
  hullDarkBoxes.push(makeFastBox(deckW, 3.4, deckD, 0, -1.3, 0));
  // Proa afilada em 3 degraus (-Z)
  hullDarkBoxes.push(
    makeFastBox(82, 3.2, 14, 0, -1.4, -135),
    makeFastBox(56, 3.0, 12, 0, -1.5, -147),
    makeFastBox(28, 2.8, 8, 0, -1.6, -156)
  );
  // Popa escalonada (+Z)
  hullDarkBoxes.push(
    makeFastBox(86, 3.2, 12, 0, -1.4, 134),
    makeFastBox(62, 3.0, 10, 0, -1.5, 144)
  );
  // Extensão lateral angulada bombordo (Pista de pouso secundária)
  hullDarkBoxes.push(makeFastBox(28, 3.2, 156, -54, -1.5, 10));
  // Chanfros dianteiro e traseiro da pista angulada
  hullDarkBoxes.push(
    makeFastBox(18, 3.0, 18, -51, -1.6, -74),
    makeFastBox(18, 3.0, 18, -51, -1.6, 94)
  );

  // Casco intermediário blindado com recortes para elevadores e baías mecânicas
  hullCharcoalBoxes.push(
    makeFastBox(deckW - 14, 11.2, deckD - 28, 0, -8.6, 0),
    makeFastBox(70, 9.5, 18, 0, -8.2, -134),
    makeFastBox(40, 8.0, 12, 0, -7.8, -148),
    makeFastBox(72, 9.5, 14, 0, -8.2, 132)
  );

  // Sponsons laterais, baías de hangar recortadas e vigas em balanço sob a pista angulada
  for (const side of [-1, 1]) {
    // Passarela / sponson contínuo na borda do convés
    hullCharcoalBoxes.push(makeFastBox(4.2, 2.2, deckD - 32, side * (deckW * 0.5 + 1.2), -2.4, 0));
    // Módulos mecânicos laterais alternados (reentrâncias no casco em vez de parede lisa!)
    for (let rz = -108; rz <= 108; rz += 36) {
      hullDarkBoxes.push(makeFastBox(5.5, 7.6, 16.0, side * (deckW * 0.5 - 6.0), -8.2, rz));
      silverBoxes.push(makeFastBox(2.2, 10.6, 3.4, side * (deckW * 0.5 - 3.6), -8.6, rz + 18));
      yellowBoxes.push(makeFastBox(2.4, 0.8, 12.0, side * (deckW * 0.5 - 4.0), -4.1, rz));
    }
  }
  // Treliças de sustentação sob o convés angulado bombordo
  for (let tz = -58; tz <= 74; tz += 22) {
    silverBoxes.push(makeFastBox(16, 2.0, 2.2, -52, -4.6, tz));
    hullCharcoalBoxes.push(makeFastBox(4.0, 6.2, 3.2, -46, -6.4, tz));
  }

  // Quilha dupla inferior chanfrada (até Y = 384m -> local y = -26.0)
  keelBoxes.push(
    makeFastBox(deckW - 30, 6.0, deckD - 54, 0, -17.2, 0),
    makeFastBox(deckW - 50, 5.2, deckD - 86, 0, -22.8, 0),
    makeFastBox(42, 4.2, 118, 0, -23.8, -4)
  );

  // Plataformas dos 2 Elevadores de Aeronaves (Estibordo Vante & Bombordo Ré)
  const elevators = [
    { x: 40, z: -84, w: 22, d: 28 },
    { x: -42, z: 72, w: 22, d: 28 }
  ];
  for (const el of elevators) {
    hullCharcoalBoxes.push(makeFastBox(el.w, 2.6, el.d, el.x, -1.6, el.z));
    yellowBoxes.push(
      makeFastBox(el.w + 1.2, 0.4, 1.4, el.x, 0.26, el.z - el.d * 0.5),
      makeFastBox(el.w + 1.2, 0.4, 1.4, el.x, 0.26, el.z + el.d * 0.5),
      makeFastBox(1.4, 0.4, el.d, el.x - el.w * 0.5, 0.26, el.z),
      makeFastBox(1.4, 0.4, el.d, el.x + el.w * 0.5, 0.26, el.z)
    );
    // Pistões hidráulicos visíveis sob o elevador
    silverBoxes.push(
      makeFastBox(1.8, 8.0, 1.8, el.x - 6, -6.0, el.z - 8),
      makeFastBox(1.8, 8.0, 1.8, el.x + 6, -6.0, el.z + 8)
    );
  }

  // JBD (Defletores de Jato) e trilhos de catapulta elevados na proa
  for (const cx of [-22, -6]) {
    hullCharcoalBoxes.push(makeFastBox(5.2, 1.2, 1.6, cx, 0.72, -16));
    yellowBoxes.push(makeFastBox(5.4, 0.3, 1.8, cx, 1.22, -16));
  }

  // Baías de Hangar Laterais Iluminadas (no casco abaixo do convés)
  const hangarBayGlowLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 34), hangarGlowMat);
  hangarBayGlowLeft.position.set(-deckW * 0.5 + 6.4, -8.2, 22);
  const hangarBayGlowRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 34), hangarGlowMat);
  hangarBayGlowRight.position.set(deckW * 0.5 - 6.4, -8.2, 22);
  hullStructureGroup.add(hangarBayGlowLeft, hangarBayGlowRight);

  // Reator Repulsor Central sob a Quilha + Anel Blindado
  const bellyCore = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 1.4, 24), bellyGlowMat);
  bellyCore.position.set(0, -25.8, 0);
  const bellyRing = new THREE.Mesh(new THREE.TorusGeometry(16.2, 1.6, 10, 24), armorSilverMat);
  bellyRing.rotation.x = Math.PI / 2;
  bellyRing.position.set(0, -25.4, 0);
  hullStructureGroup.add(bellyCore, bellyRing);

  // Propulsores Traseiros Principais na Popa (+Z)
  for (const rx of [-18, 0, 18]) {
    const thrusterRim = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 4.5, 16), hullCharcoalMat);
    thrusterRim.rotation.x = Math.PI / 2;
    thrusterRim.position.set(rx, -7.8, 140);
    const thrusterGlow = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.8, 16), bellyGlowMat);
    thrusterGlow.rotation.x = Math.PI / 2;
    thrusterGlow.position.set(rx, -7.8, 142.3);
    hullStructureGroup.add(thrusterRim, thrusterGlow);
  }

  const mHullDark = _createMergedMesh(hullDarkBoxes, hullDarkMat, true, true);
  const mHullChar = _createMergedMesh(hullCharcoalBoxes, hullCharcoalMat, true, true);
  const mKeel = _createMergedMesh(keelBoxes, keelNavyMat, false, true);
  const mSilver = _createMergedMesh(silverBoxes, armorSilverMat, false, true);
  const mYellow = _createMergedMesh(yellowBoxes, cautionYellowMat, false, true);
  for (const m of [mHullDark, mHullChar, mKeel, mSilver, mYellow]) {
    if (m) hullStructureGroup.add(m);
  }

  // ============================================================================
  // 2. CONVÉS DE VOO TEXTURIZADO (PISTA AXIAL, PISTA EM ÂNGULO, CATAPULTAS & HELIPONTO)
  // ============================================================================
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

  // ============================================================================
  // 3. TORRE DE COMANDO MULTINÍVEL (ILHA DE CONTROLE + PONTE + RADAIS + MASTRO)
  // ============================================================================
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
    makeFastBox(19.4, 1.4, 55.4, 0, 16.5, 0) // Varanda / Passadiço Intermediário
  );
  // Nível 2: Torre da Ponte de Navegação & Pri-Fly (14 x 12 x 36)
  islandDark.push(
    makeFastBox(14, 12, 36, 0, 23, 0),
    makeFastBox(17.5, 2.2, 16, -2.5, 26.5, -8) // Asa de Passadiço sobre o convés!
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
    [islandChar, hullCharcoalMat, true],
    [islandDark, hullDarkMat, true],
    [islandSilver, armorSilverMat, false],
    [islandYellow, cautionYellowMat, false]
  ]) {
    const m = _createMergedMesh(boxes, mat, cast, true);
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
  const priFlyGlass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.2, 14.5), bridgeGlowMat);
  priFlyGlass.position.set(-9.4, 15.6, 12);
  priFlyGlass.rotation.z = 0.16;
  const bridgeInteriorGlow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 26), bridgeGlowMat);
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
  const mastBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), navRedMat);
  mastBeacon.position.set(0, 55.2, 8);
  islandGroup.add(mastBeacon);
  nightFx.beaconMeshes.push(mastBeacon);

  // ============================================================================
  // 4. QUATRO TURBINAS ROTORAS GIGANTES COM CAREGAGEM DUPLA & EMPUXO PLASMA
  // ============================================================================
  const turbineOffsets = [
    [-68, -86],
    [68, -86],
    [-68, 86],
    [68, 86]
  ];
  const turbHullMat = getLegoMaterial(LEGO_COLORS.charcoal, { metalness: 0.42, roughness: 0.24 });
  const turbRingMat = getLegoMaterial(LEGO_COLORS.darkGrey, { metalness: 0.38, roughness: 0.28 });

  for (const [txOff, tzOff] of turbineOffsets) {
    const turbGroup = new THREE.Group();
    turbGroup.position.set(txOff, -5.5, tzOff);

    // Braço estrutural duplo ligando a turbina ao casco
    const strutMain = new THREE.Mesh(new THREE.BoxGeometry(24, 9.2, 15.5), turbRingMat);
    strutMain.position.set(txOff > 0 ? -14 : 14, -1.0, 0);
    const strutPipe = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 4.4), armorSilverMat);
    strutPipe.position.set(txOff > 0 ? -14 : 14, 3.8, 0);
    const hazardBand = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 16.2), cautionYellowMat);
    hazardBand.position.set(txOff > 0 ? -12 : 12, -1.0, 0);
    turbGroup.add(strutMain, strutPipe, hazardBand);

    // Carenagem dupla (externa + anel superior + anel inferior)
    const outerShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(20.5, 20.5, 12.2, 28, 1, true),
      turbHullMat
    );
    const innerLiner = new THREE.Mesh(
      new THREE.CylinderGeometry(18.0, 18.0, 11.6, 24, 1, true),
      armorSilverMat
    );
    const topArmorRing = new THREE.Mesh(new THREE.RingGeometry(16.8, 21.6, 28), turbRingMat);
    topArmorRing.rotation.x = -Math.PI / 2;
    topArmorRing.position.y = 6.1;
    const botArmorRing = new THREE.Mesh(new THREE.RingGeometry(16.8, 21.2, 28), turbRingMat);
    botArmorRing.rotation.x = Math.PI / 2;
    botArmorRing.position.y = -6.1;

    // Anel luminoso de repulsão de plasma
    const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(17.2, 17.2, 2.4, 28), bellyGlowMat);
    coreGlow.position.y = -2.2;

    // Hélice superior de 4 pás + cubo blindado
    const rotorGroup = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(34, 0.9, 3.4), turbHullMat);
      blade.rotation.y = (b * Math.PI) / 4;
      rotorGroup.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.4, 3.6, 16), armorSilverMat);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.2, 12), cautionYellowMat);
    hubCap.position.y = 2.0;
    rotorGroup.add(hub, hubCap);
    rotorGroup.position.y = 2.4;

    turbGroup.add(outerShroud, innerLiner, topArmorRing, botArmorRing, coreGlow, rotorGroup);
    hullStructureGroup.add(turbGroup);

    world.rotatingElements.push({ mesh: rotorGroup, axis: 'y', speed: 7.5 });
    world.addCollider(hx + txOff, hz + tzOff, 36, 36, hy + 0.4, hy - 12.0);
  }

  // ============================================================================
  // 5. HANGAR / OFICINA DE PERSONALIZAÇÃO DE AERONAVES NO CONVÉS (POPA ESTIBORDO)
  //    Mundo: Pad = (20, 410.45, 64) | Console = (34, 410.45, 64) | Decolagem = (-14, 410.45, 36)
  // ============================================================================
  const hangarLocalX = 20;
  const hangarLocalZ = 114; // -> Mundo Z = hz + 114 = +64
  const padMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({
      map: _createTurntablePadTexture(),
      roughness: 0.45,
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

  // Pórtico Tático Aberto do Hangar Aéreo (não fecha a pista nem bloqueia entrada de jatos/helicópteros!)
  const gantryBoxes = [
    makeFastBox(1.8, 8.6, 1.8, hangarLocalX - 10.5, 4.7, hangarLocalZ - 8.5),
    makeFastBox(1.8, 8.6, 1.8, hangarLocalX + 10.5, 4.7, hangarLocalZ - 8.5),
    makeFastBox(1.8, 8.6, 1.8, hangarLocalX - 10.5, 4.7, hangarLocalZ + 8.5),
    makeFastBox(1.8, 8.6, 1.8, hangarLocalX + 10.5, 4.7, hangarLocalZ + 8.5),
    makeFastBox(23.2, 1.4, 2.2, hangarLocalX, 9.2, hangarLocalZ - 8.5),
    makeFastBox(23.2, 1.4, 2.2, hangarLocalX, 9.2, hangarLocalZ + 8.5),
    makeFastBox(2.0, 1.2, 19.0, hangarLocalX + 10.5, 9.2, hangarLocalZ)
  ];
  const gantryMesh = _createMergedMesh(gantryBoxes, hullCharcoalMat, true, true);
  if (gantryMesh) hullStructureGroup.add(gantryMesh);

  const gantryStrip = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.36, 0.45), hangarGlowMat);
  gantryStrip.position.set(hangarLocalX, 9.95, hangarLocalZ - 8.5);
  const gantryStrip2 = gantryStrip.clone();
  gantryStrip2.position.z = hangarLocalZ + 8.5;
  hullStructureGroup.add(gantryStrip, gantryStrip2);

  // Console Tático do Personalizador de Aeronaves [E]
  const consoleLocalX = 34;
  const consoleLocalZ = 114;
  const consoleBody = createLegoBrick(2.4, 1.5, 1.8, LEGO_COLORS.black, { studStep: 0.6 });
  consoleBody.position.set(consoleLocalX, 1.15, consoleLocalZ);
  const consoleScreen = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.22), hangarGlowMat);
  consoleScreen.position.set(consoleLocalX - 0.15, 2.05, consoleLocalZ);
  consoleScreen.rotation.y = -Math.PI / 2;
  hullStructureGroup.add(consoleBody, consoleScreen);
  world.addCollider(hx + consoleLocalX, hz + consoleLocalZ, 2.4, 1.8, hy + 2.4, hy);

  world.helicarrierHangarData = {
    padPos: { x: hx + hangarLocalX, y: hy + 0.48, z: hz + hangarLocalZ },
    consolePos: { x: hx + consoleLocalX, y: hy + 0.45, z: hz + consoleLocalZ },
    launchPos: { x: hx - 14, y: hy + 0.48, z: hz + 86, rotY: Math.PI }, // ( -14, 410.48, 36 ) olhando -Z
    heliLaunchPos: { x: hx + 22, y: hy + 0.48, z: hz + 82, rotY: Math.PI }
  };

  // ============================================================================
  // 6. DETALHES INSTANCIADOS EM LOD 0 (< 460m): GUARDA-CORPOS, LUZES, ESCOTILHAS, TRATORES & CONTÊINERES
  // ============================================================================
  const dummy = new THREE.Object3D();

  // 6.1 Guarda-corpos do perímetro (InstancedMesh para alto FPS)
  const stanchionPos = [];
  const railSegments = [];
  // Bordas Leste e Oeste do convés principal
  for (let rz = -120; rz <= 120; rz += 10) {
    stanchionPos.push([deckW * 0.5 - 0.6, 1.05, rz]);
    if (rz < -70 || rz > 90) {
      stanchionPos.push([-deckW * 0.5 + 0.6, 1.05, rz]);
    }
  }
  // Borda externa da pista angulada bombordo
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
  const postInst = new THREE.InstancedMesh(postGeo, armorSilverMat, stanchionPos.length);
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
    const railMesh = _createMergedMesh(railBoxes, cautionYellowMat, false, false);
    if (railMesh) lod0.add(railMesh);
  }

  // 6.2 Luzes de Pouso da Pista & Luzes de Navegação (InstancedMesh em LOD 0 + Beacons principais em LOD 1/2)
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
  // Luzes de aproximação na popa (verdes e vermelhas)
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

  // 6.3 Escotilhas, calços de roda e pinos LEGO decorativos nas passarelas (InstancedMesh)
  const hatchCoords = [
    [10, -110], [10, -68], [10, 12], [-34, -108], [-34, 96], [42, 16]
  ];
  const hatchGeo = new THREE.BoxGeometry(2.6, 0.34, 2.6);
  const hatchInst = new THREE.InstancedMesh(hatchGeo, armorSilverMat, hatchCoords.length);
  hatchCoords.forEach(([lx, lz], idx) => {
    dummy.position.set(lx, 0.56, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hatchInst.setMatrixAt(idx, dummy.matrix);
  });
  hatchInst.instanceMatrix.needsUpdate = true;
  lod0.add(hatchInst);

  // Studs LEGO nas bordas do convés (visual LEGO autêntico em InstancedMesh!)
  const studCoords = [];
  for (let sz = -124; sz <= 124; sz += 8) {
    studCoords.push([49.5, 0.42, sz], [-36.5, 0.42, sz]);
  }
  const studInst = new THREE.InstancedMesh(SHARED_STUD_GEO, hullDarkMat, studCoords.length);
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
    // Trator de reboque amarelo compacto
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

  // Carrinhos de munição/combustível próximos à torre (fora da pista!)
  for (const [cx, cz] of [
    [25, -42],
    [25, -24]
  ]) {
    supportRed.push(makeFastBox(1.8, 1.1, 3.0, cx, 1.05, cz));
    supportCharcoal.push(makeFastBox(2.0, 0.4, 3.2, cx, 0.6, cz));
  }
  // Contêineres táticos nas laterais da popa/vante (fora da trajetória de decolagem!)
  supportBlue.push(makeFastBox(4.2, 3.2, 8.8, 44, 2.0, 92));
  supportYellow.push(makeFastBox(4.2, 3.2, 8.8, 44, 2.0, 104));
  world.addCollider(hx + 44, hz + 92, 4.4, 9.0, hy + 3.6, hy);
  world.addCollider(hx + 44, hz + 104, 4.4, 9.0, hy + 3.6, hy);

  for (const [boxes, mat] of [
    [supportYellow, cautionYellowMat],
    [supportCharcoal, hullCharcoalMat],
    [supportRed, accentRedMat],
    [supportBlue, getLegoMaterial(LEGO_COLORS.blue)]
  ]) {
    const m = _createMergedMesh(boxes, mat, true, true);
    if (m) lod0.add(m);
  }

  // 6.5 Luzes laterais de navegação (Bombordo Vermelho / Estibordo Verde) — visíveis em LOD 0 e LOD 1
  const navGeo = new THREE.BoxGeometry(1.3, 1.3, 3.2);
  for (let rz = -96; rz <= 96; rz += 32) {
    const lightL = new THREE.Mesh(navGeo, navRedMat);
    lightL.position.set(-deckW * 0.5 - 1.2, -1.6, rz);
    const lightR = new THREE.Mesh(navGeo, navGreenMat);
    lightR.position.set(deckW * 0.5 + 1.2, -1.6, rz);
    hullStructureGroup.add(lightL, lightR);
    nightFx.beaconMeshes.push(lightL, lightR);
  }

  // 6.6 LOD 1 (Médio) e LOD 2 (Silhueta leve) recebem marcadores visuais leves para evitar popping
  const lod1Trim = _createMergedMesh(
    [
      makeFastBox(deckW + 2, 0.5, 2.0, 0, 0.4, -128),
      makeFastBox(deckW + 2, 0.5, 2.0, 0, 0.4, 128)
    ],
    cautionYellowMat,
    false,
    false
  );
  if (lod1Trim) lod1.add(lod1Trim);

  const lod2Beacon = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 8), bellyGlowMat);
  lod2Beacon.position.set(0, -26.2, 0);
  lod2.add(lod2Beacon);

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
