import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';

export {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  buildParkedLegoCars,
  createLegoCarMesh
} from './VehicleFleetBuilder.js';

export function buildStreetProps(world) {
  const sidewalkY = 0.28;

  const lampCoords = [
    [-14, -105], [14, -105], [-14, -135], [14, -135],
    [-14, -11.2], [14, -11.2], [-14, 11.2], [14, 11.2],
    [-120, -105], [120, -105], [-120, 105], [120, 105]
  ];

  const poleMat = getLegoMaterial(LEGO_COLORS.darkGrey);
  const bulbMat = getLegoMaterial(0xfef08a, { emissive: 0xfde047, emissiveIntensity: 0.8 });

  lampCoords.forEach(([lx, lz]) => {
    const lamp = new THREE.Group();
    lamp.position.set(lx, sidewalkY, lz);

    const base = createLegoBrick(0.7, 0.3, 0.7, LEGO_COLORS.darkGrey, { studs: true });
    base.position.y = 0.15;
    lamp.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.2, 10), poleMat);
    pole.position.y = 2.75;
    lamp.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.4), poleMat);
    arm.position.set(0, 5.3, lx < 0 ? 0.5 : -0.5);
    lamp.add(arm);

    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.25, 12), bulbMat);
    bulb.position.set(0, 5.15, lx < 0 ? 0.95 : -0.95);
    lamp.add(bulb);

    world.scene.add(lamp);
    const col = world.addCollider(lx, lz, 0.7, 0.7, sidewalkY + 5.4);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: lamp,
        type: 'streetlamp',
        hp: 30,
        radius: 1.0,
        height: 5.3,
        colliders: [col],
        debrisColors: [LEGO_COLORS.darkGrey, LEGO_COLORS.lightGrey, LEGO_COLORS.yellow],
        studDrops: { silver: 5, gold: 3, blue: 0, purple: 0 },
        groundY: sidewalkY
      });
    }
  });

  const hydrantCoords = [
    [-15, -100], [15, -100], [-15, -130], [15, -130],
    [-11.2, -15.5], [11.2, -15.5], [-11.2, 15.5], [11.2, 15.5]
  ];
  const redMat = getLegoMaterial(LEGO_COLORS.red);
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.4 });

  hydrantCoords.forEach(([hx, hz]) => {
    const hyd = new THREE.Group();
    hyd.position.set(hx, sidewalkY, hz);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 14), redMat);
    body.position.y = 0.45;
    hyd.add(body);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), silverMat);
    cap.position.y = 0.96;
    hyd.add(cap);

    const nozzles = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.75, 10), silverMat);
    nozzles.rotation.z = Math.PI / 2;
    nozzles.position.y = 0.62;
    hyd.add(nozzles);

    world.scene.add(hyd);
    const col = world.addCollider(hx, hz, 0.8, 0.8, sidewalkY + 1.15);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: hyd,
        type: 'hydrant',
        hp: 15,
        radius: 0.9,
        height: 1.15,
        colliders: [col],
        debrisColors: [LEGO_COLORS.red, LEGO_COLORS.silver],
        studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
        groundY: sidewalkY
      });
    }
  });

  const crateData = [
    [-19, -98, LEGO_COLORS.orange],
    [-20.5, -98, LEGO_COLORS.yellow],
    [19, -98, LEGO_COLORS.blue],
    [20.5, -98, LEGO_COLORS.green],
    [-19, -18, LEGO_COLORS.orange],
    [19, -18, LEGO_COLORS.blue],
    [680, -340, LEGO_COLORS.red],
    [682, -340, LEGO_COLORS.yellow]
  ];

  crateData.forEach(([cx, cz, color]) => {
    const crate = createLegoBrick(1.3, 1.3, 1.3, color, { studStep: 0.55 });
    crate.position.set(cx, sidewalkY + 0.65, cz);
    world.scene.add(crate);
    const col = world.addCollider(cx, cz, 1.3, 1.3, sidewalkY + 1.3);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: crate,
        type: 'crate',
        hp: 12,
        radius: 1.05,
        height: 1.3,
        colliders: [col],
        debrisColors: [color, LEGO_COLORS.tan, LEGO_COLORS.brown],
        studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
        groundY: sidewalkY
      });
    }
  });
}

export function buildNewsstandsAndFences(world) {
  const sidewalkY = 0.28;

  const stands = [
    { x: -24, z: -102, awningColor: LEGO_COLORS.red },
    { x: 24, z: -102, awningColor: LEGO_COLORS.blue }
  ];

  stands.forEach((cfg) => {
    const standGroup = new THREE.Group();
    standGroup.position.set(cfg.x, sidewalkY, cfg.z);

    const counter = createLegoBrick(2.8, 1.1, 1.8, LEGO_COLORS.tan, { studStep: 0.6 });
    counter.position.set(0, 0.55, 0);
    standGroup.add(counter);

    const backWall = createLegoBrick(2.8, 1.2, 0.45, LEGO_COLORS.darkGrey, { studs: false });
    backWall.position.set(0, 1.65, -0.65);
    standGroup.add(backWall);

    const awning = createLegoBrick(3.1, 0.38, 2.1, cfg.awningColor, { studStep: 0.6 });
    awning.position.set(0, 2.35, 0);
    standGroup.add(awning);

    world.scene.add(standGroup);
    const col = world.addCollider(cfg.x, cfg.z, 2.8, 2.1, sidewalkY + 2.55);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: standGroup,
        type: 'newsstand',
        hp: 34,
        radius: 1.9,
        height: 2.6,
        colliders: [col],
        debrisColors: [cfg.awningColor, LEGO_COLORS.tan, LEGO_COLORS.white],
        studDrops: { silver: 6, gold: 4, blue: 2, purple: 0 },
        groundY: sidewalkY
      });
    }
  });

  const fencePositions = [
    { x: -28.0, z: -104.0, rotY: 0 },
    { x: 28.0, z: -104.0, rotY: 0 },
    { x: -22.5, z: -11.4, rotY: 0 },
    { x: 22.5, z: -11.4, rotY: 0 }
  ];

  fencePositions.forEach((f) => {
    const fenceGroup = new THREE.Group();
    fenceGroup.position.set(f.x, sidewalkY, f.z);
    fenceGroup.rotation.y = f.rotY;

    const railTop = createLegoBrick(2.2, 0.9, 0.25, LEGO_COLORS.white, { studStep: 0.45 });
    railTop.position.set(0, 0.45, 0);
    fenceGroup.add(railTop);
    world.scene.add(fenceGroup);

    const col = world.addCollider(f.x, f.z, 2.2, 0.45, sidewalkY + 0.95);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: fenceGroup,
        type: 'fence',
        hp: 10,
        radius: 1.25,
        height: 1.0,
        colliders: [col],
        debrisColors: [LEGO_COLORS.white, LEGO_COLORS.lightGrey],
        studDrops: { silver: 3, gold: 1, blue: 0, purple: 0 },
        groundY: sidewalkY
      });
    }
  });
}

export function buildGoldenLegoObjects(world) {
  const sidewalkY = 0.28;
  const goldVaultLocations = [
    // Praça em frente ao Super Banco Central
    { x: -16.0, z: -112.0, y: sidewalkY, scale: 1.0 },
    // Topo da Torre dos Heróis (Y = 310.8m)
    { x: -318.0, z: -180.0, y: 310.8, scale: 1.35 },
    // Convés do Aeroporta-Aviões no Céu (Y = 410.4m)
    { x: 0.0, z: -80.0, y: 410.4, scale: 1.35 }
  ];

  const goldShinyMat = getLegoMaterial(LEGO_COLORS.gold, {
    metalness: 0.72,
    roughness: 0.14,
    clearcoat: 0.85,
    emissive: 0xd97706,
    emissiveIntensity: 0.28
  });

  goldVaultLocations.forEach((loc) => {
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(loc.x, loc.y, loc.z);

    const w = 1.9 * loc.scale;
    const h = 2.1 * loc.scale;
    const d = 1.9 * loc.scale;

    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldShinyMat);
    core.position.y = h * 0.5;
    core.castShadow = true;
    vaultGroup.add(core);

    const topPlate = createLegoBrick(w, 0.25, d, LEGO_COLORS.gold, {
      metalness: 0.7,
      roughness: 0.15,
      studStep: 0.5
    });
    topPlate.position.y = h + 0.125;
    vaultGroup.add(topPlate);

    world.scene.add(vaultGroup);
    const col = world.addCollider(loc.x, loc.z, w + 0.2, d + 0.2, loc.y + h + 0.3, loc.y);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: vaultGroup,
        type: 'gold_vault',
        hp: 45,
        radius: w * 0.85,
        height: h + 0.5,
        colliders: [col],
        debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.yellow, 0xfef08a],
        studDrops: { silver: 0, gold: 8, blue: 4, purple: 2 },
        groundY: loc.y,
        goldOnly: true
      });
    }
  });

  // ============================================================================
  // PASSO 5A: PAREDES RACHADAS LEGO (Destruídas pelo Soco Foguete / Terremoto do Titã Blindado!)
  // ============================================================================
  const crackedWallLocations = [
    { x: 24.0, z: -116.0, y: sidewalkY, rotY: 0 },
    { x: -26.0, z: -132.0, y: sidewalkY, rotY: Math.PI / 2 },
    { x: -286.0, z: -142.0, y: sidewalkY, rotY: 0 },
    { x: -652.0, z: -88.0, y: sidewalkY, rotY: 0.35 },
    { x: 646.0, z: -292.0, y: sidewalkY, rotY: 0 },
    { x: 848.0, z: 368.0, y: sidewalkY, rotY: Math.PI / 2 }
  ];

  const wallConcreteMat = getLegoMaterial(0x334155, { roughness: 0.38 });
  const crackGlowMat = getLegoMaterial(0x00f0ff, {
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
    roughness: 0.15
  });
  const hazardGoldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.4, roughness: 0.2 });

  crackedWallLocations.forEach((loc) => {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(loc.x, loc.y, loc.z);
    wallGroup.rotation.y = loc.rotY || 0;

    const w = 3.6;
    const h = 3.2;
    const d = 1.05;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallConcreteMat);
    slab.position.y = h * 0.5;
    slab.castShadow = true;
    slab.receiveShadow = true;
    wallGroup.add(slab);

    const topBrick = createLegoBrick(w, 0.28, d, LEGO_COLORS.darkGrey, { studStep: 0.6 });
    topBrick.position.y = h + 0.14;
    wallGroup.add(topBrick);

    // Fendas rachadas brilhantes nas duas faces indicando ponto de impacto do Titã Blindado!
    const crackAngles = [
      { x: 0, y: 1.6, w: 0.22, h: 1.9, rz: 0.48 },
      { x: -0.45, y: 1.95, w: 0.16, h: 1.25, rz: -0.62 },
      { x: 0.52, y: 1.25, w: 0.16, h: 1.3, rz: -0.55 },
      { x: 0.1, y: 1.6, w: 0.36, h: 0.36, rz: Math.PI / 4 }
    ];
    for (const c of crackAngles) {
      const fissure = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, d + 0.08), crackGlowMat);
      fissure.position.set(c.x, c.y, 0);
      fissure.rotation.z = c.rz;
      wallGroup.add(fissure);
    }

    // Pilares laterais de alerta amarelo/preto
    for (const sx of [-w * 0.46, w * 0.46]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, d + 0.1), hazardGoldMat);
      post.position.set(sx, h * 0.5, 0);
      wallGroup.add(post);
    }

    world.scene.add(wallGroup);
    const colW = Math.abs(Math.sin(loc.rotY || 0)) > 0.7 ? d : w;
    const colD = Math.abs(Math.sin(loc.rotY || 0)) > 0.7 ? w : d;
    const col = world.addCollider(loc.x, loc.z, colW + 0.2, colD + 0.2, loc.y + h + 0.3, loc.y);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: wallGroup,
        type: 'cracked_wall',
        hp: 60,
        radius: 2.1,
        height: h + 0.4,
        colliders: [col],
        debrisColors: [0x334155, LEGO_COLORS.darkGrey, LEGO_COLORS.gold, 0x00f0ff],
        studDrops: { silver: 0, gold: 8, blue: 5, purple: 2 },
        groundY: loc.y,
        crackedWallOnly: true
      });
    }
  });

  // ============================================================================
  // PASSO 5B: OBJETOS PRATEADOS BRILHANTES LEGO (Destruídos pela Bazuca RPG do Vingador de Chumbo!)
  // ============================================================================
  const silverVaultLocations = [
    { x: 16.0, z: -112.0, y: sidewalkY, scale: 1.0 },
    { x: -15.5, z: -185.0, y: 0.36, scale: 1.05 },
    { x: -312.0, z: -192.0, y: 310.8, scale: 1.2 },
    { x: 668.0, z: -318.0, y: sidewalkY, scale: 1.1 },
    { x: 838.0, z: 392.0, y: sidewalkY, scale: 1.15 },
    { x: -1085.0, z: -25.0, y: sidewalkY, scale: 1.15 }
  ];

  const silverMirrorMat = getLegoMaterial(0xe2e8f0, {
    metalness: 0.88,
    roughness: 0.08,
    clearcoat: 0.95,
    emissive: 0x475569,
    emissiveIntensity: 0.25
  });
  const redBeaconMat = getLegoMaterial(0xef4444, {
    emissive: 0xef4444,
    emissiveIntensity: 1.6
  });

  silverVaultLocations.forEach((loc) => {
    const silverGroup = new THREE.Group();
    silverGroup.position.set(loc.x, loc.y, loc.z);

    const w = 2.0 * loc.scale;
    const h = 2.2 * loc.scale;
    const d = 2.0 * loc.scale;

    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), silverMirrorMat);
    core.position.y = h * 0.5;
    core.castShadow = true;
    silverGroup.add(core);

    const topPlate = createLegoBrick(w, 0.26, d, LEGO_COLORS.silver, {
      metalness: 0.85,
      roughness: 0.1,
      studStep: 0.5
    });
    topPlate.position.y = h + 0.13;
    silverGroup.add(topPlate);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.25, 14), redBeaconMat);
    beacon.position.y = h + 0.38;
    silverGroup.add(beacon);

    world.scene.add(silverGroup);
    const col = world.addCollider(loc.x, loc.z, w + 0.2, d + 0.2, loc.y + h + 0.4, loc.y);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: silverGroup,
        type: 'silver_lego',
        hp: 55,
        radius: w * 0.88,
        height: h + 0.5,
        colliders: [col],
        debrisColors: [0xe2e8f0, LEGO_COLORS.silver, LEGO_COLORS.lightGrey, 0xef4444],
        studDrops: { silver: 6, gold: 8, blue: 5, purple: 2 },
        groundY: loc.y,
        silverOnly: true
      });
    }
  });
}

