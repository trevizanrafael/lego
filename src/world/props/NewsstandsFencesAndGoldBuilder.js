import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { IS_SCALED_WORLD, ROAD, ws, wsStreetAnchored } from '../core/WorldLayoutScale.js';
import { getScaledUrbanCurbLiftAt } from '../terrain/UrbanSidewalkAndBlockBuilder.js';
import { spawnBreakableWhiteFence } from '../SuburbHouseGenerator.js';

function getSidewalkSurfaceY(world, px, pz) {
  const baseTerrain = world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0;
  if (!IS_SCALED_WORLD) return baseTerrain + 0.28;
  return getScaledUrbanCurbLiftAt(world, px, pz) > 0.05
    ? baseTerrain + 0.02
    : baseTerrain + ROAD.curbHeight;
}

export function buildNewsstandsAndFences(world) {
  const rawFenceSpecs = [
    { x: -28.0, z: -104.0, dx: 0, rotY: 0 },
    { x: 28.0, z: -104.0, dx: 0, rotY: 0 },
    { x: -22.5, z: -16.4, dx: 0, rotY: 0 },
    { x: 22.5, z: -16.4, dx: 0, rotY: 0 },
    { x: -70.75, z: -658.0, dx: -1.25, rotY: 0 },
    { x: -70.75, z: -658.0, dx: 1.25, rotY: 0 },
    { x: 70.75, z: -658.0, dx: -1.25, rotY: 0 },
    { x: 70.75, z: -658.0, dx: 1.25, rotY: 0 },
    { x: -172.0, z: -790.0, dx: 0, rotY: 0 },
    { x: 172.0, z: -790.0, dx: 0, rotY: 0 }
  ];

  rawFenceSpecs.forEach((spec) => {
    const anchored = wsStreetAnchored(spec.x, spec.z, { halfW: 1.2, halfD: 0.4 });
    const fx = anchored.x + spec.dx;
    const fz = anchored.z;
    spawnBreakableWhiteFence(world, fx, fz, 2.2, spec.rotY);
  });
}

export function buildGoldenLegoObjects(world) {
  const bankPlazaVault = wsStreetAnchored(-16.0, -112.0, { halfW: 1.2, halfD: 1.2 });
  const goldVaultLocations = [
    { x: bankPlazaVault.x, z: bankPlazaVault.z, y: IS_SCALED_WORLD ? getSidewalkSurfaceY(world, bankPlazaVault.x, bankPlazaVault.z) : 0.28, scale: 1.0 },
    { x: ws(-318.0), z: ws(-180.0), y: 310.8, scale: 1.35 },
    { x: ws(0.0), z: ws(-80.0), y: 410.4, scale: 1.35 }
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

  const crackedWallLocations = [
    { x: 24.0, z: -116.0, rotY: 0 },
    { x: -26.0, z: -132.0, rotY: Math.PI / 2 },
    { x: -286.0, z: -142.0, rotY: 0 },
    { x: -652.0, z: -88.0, rotY: 0.35 },
    { x: 646.0, z: -292.0, rotY: 0 },
    { x: 848.0, z: 368.0, rotY: Math.PI / 2 }
  ];

  const wallConcreteMat = getLegoMaterial(0x334155, { roughness: 0.38 });
  const crackGlowMat = getLegoMaterial(0x00f0ff, {
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
    roughness: 0.15
  });
  const hazardGoldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.4, roughness: 0.2 });

  crackedWallLocations.forEach((rawLoc) => {
    const p = wsStreetAnchored(rawLoc.x, rawLoc.z, { halfW: 1.8, halfD: 1.8 });
    const locGroundY = getSidewalkSurfaceY(world, p.x, p.z);
    const wallGroup = new THREE.Group();
    wallGroup.position.set(p.x, locGroundY, p.z);
    wallGroup.rotation.y = rawLoc.rotY || 0;

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

    for (const sx of [-w * 0.46, w * 0.46]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, d + 0.1), hazardGoldMat);
      post.position.set(sx, h * 0.5, 0);
      wallGroup.add(post);
    }

    world.scene.add(wallGroup);
    const colW = Math.abs(Math.sin(rawLoc.rotY || 0)) > 0.7 ? d : w;
    const colD = Math.abs(Math.sin(rawLoc.rotY || 0)) > 0.7 ? w : d;
    const col = world.addCollider(p.x, p.z, colW + 0.2, colD + 0.2, locGroundY + h + 0.3, locGroundY);

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
        groundY: locGroundY,
        crackedWallOnly: true
      });
    }
  });

  const silverRawSpecs = [
    { x: 16.0, z: -112.0, elevatedY: null, interiorY: null, scale: 1.0 },
    { x: -15.5, z: -185.0, elevatedY: null, interiorY: 0.36, scale: 1.05 },
    { x: -312.0, z: -192.0, elevatedY: 310.8, interiorY: null, scale: 1.2 },
    { x: 668.0, z: -318.0, elevatedY: null, interiorY: null, scale: 1.1 },
    { x: 838.0, z: 392.0, elevatedY: null, interiorY: null, scale: 1.15 },
    { x: -1085.0, z: -25.0, elevatedY: null, interiorY: null, scale: 1.15 }
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

  silverRawSpecs.forEach((raw) => {
    let lx;
    let lz;
    let ly;
    if (raw.elevatedY !== null) {
      lx = ws(raw.x);
      lz = ws(raw.z);
      ly = raw.elevatedY;
    } else if (raw.interiorY !== null) {
      const p = wsStreetAnchored(raw.x, raw.z, { halfW: 1.2, halfD: 1.2 });
      lx = raw.x;
      lz = p.z;
      ly = raw.interiorY;
    } else {
      const p = wsStreetAnchored(raw.x, raw.z, { halfW: 1.2, halfD: 1.2 });
      lx = p.x;
      lz = p.z;
      ly = IS_SCALED_WORLD ? getSidewalkSurfaceY(world, lx, lz) : 0.28;
    }

    const silverGroup = new THREE.Group();
    silverGroup.position.set(lx, ly, lz);

    const w = 2.0 * raw.scale;
    const h = 2.2 * raw.scale;
    const d = 2.0 * raw.scale;

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
    const col = world.addCollider(lx, lz, w + 0.2, d + 0.2, ly + h + 0.4, ly);

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
        groundY: ly,
        silverOnly: true
      });
    }
  });
}
