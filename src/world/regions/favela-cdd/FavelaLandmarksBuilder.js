import * as THREE from 'three';
import { createLegoBrick } from '../../../materials/LegoMaterials.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ws, wsP, fromWs } from '../../core/WorldLayoutScale.js';
import {
  getFavelaEastBorderX,
  getFavelaElevation,
  WINDING_LADEIRAS,
  getLadeiraZAtX
} from './FavelaElevationAndBatcher.js';

function addFavelaSignBoard(world, x, y, z, width, height, text, subText = '', opts = {}) {
  const rotY = typeof opts.rotY === 'number' ? opts.rotY : opts.rotY ? Math.PI / 2 : 0;
  const mesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: opts.depth || 0.7,
    rotY,
    title: text,
    subText,
    bgColor: opts.bgColor || '#991b1b',
    borderColor: opts.borderColor || '#090a0d',
    textColor: opts.textColor || '#ffffff',
    subColor: opts.subColor || '#facc15',
    doubleSided: true
  });
  world.scene.add(mesh);
}

/**
 * Em escala `3x` (`IS_SCALED_WORLD`), toda a malha de Ladeiras Orgânicas, Becos em Curva de Nível
 * e Escadões já é construída por `FavelaContoursAndAlleys.js`. Mantém esta rotina apenas para `1x`.
 */
export function buildWindingHillsideRoadsAndStaircases(world, batcher) {
  if (IS_SCALED_WORLD) return;

  let ladeiraIdx = 0;
  for (const ladeira of WINDING_LADEIRAS) {
    ladeiraIdx++;
    const zStartWorld = ws(ladeira.zStart);
    const xEast = getFavelaEastBorderX(zStartWorld);
    const xWest = ws(-975);
    const stepX = 6.0;
    let segCounter = 0;

    for (let x = xEast - 3; x >= xWest; x -= stepX) {
      segCounter++;
      const z = getLadeiraZAtX(ladeira, x);
      const nextX = x - stepX;
      const nextZ = getLadeiraZAtX(ladeira, nextX);
      const midX = (x + nextX) * 0.5;
      const midZ = (z + nextZ) * 0.5;
      const y = getFavelaElevation(midX, midZ);
      if (y <= 0.05) continue;

      const roadW = ladeira.hasStairs ? 5.8 : 7.4;
      batcher.addBox('alley_cement', stepX + 1.4, 1.8, roadW, midX, y - 0.72, midZ);

      if (ladeira.hasStairs) {
        const isRed = Math.abs(Math.round(x / stepX)) % 2 === 0;
        batcher.addBox(isRed ? 'cv_red' : 'cv_white', stepX * 0.9, 0.28, roadW - 0.8, midX, y + 0.08, midZ);
      }
      if (segCounter % 5 === 2 && y > 0.35) {
        const poleSide = (segCounter + ladeiraIdx) % 2 === 0 ? 1 : -1;
        const poleZ = midZ + poleSide * (roadW * 0.5 + 0.45);
        const bulbZ = midZ + poleSide * (roadW * 0.5 - 0.9);
        batcher.addBox('retaining_concrete', 0.3, 5.4, 0.3, midX, y + 2.7, poleZ);
        batcher.addBox('favela_bulb_warm', 0.36, 0.26, 0.36, midX, y + 4.98, bulbZ);
        batcher.addBox('wire_black', 0.08, 0.08, roadW + 0.9, midX, y + 5.15, midZ);
        world.nightLampRegistry?.push({
          x: midX, y: y + 4.95, z: bulbZ, groundY: y + 0.1, warm: true, coneH: 4.9, coneR: 3.8
        });
      }
    }
    world.favelaCDDData.staircasesCount += 3;
  }

  for (const baseDesignX of [-595, -695, -805]) {
    const baseX = ws(baseDesignX);
    for (let z = ws(-880); z <= ws(610); z += 8.0) {
      const uz = fromWs(z);
      const x = baseX + ws(Math.sin(uz * 0.018) * 14 + Math.cos(uz * 0.009) * 8);
      const y = getFavelaElevation(x, z);
      if (y > 0.2) batcher.addBox('alley_cement', 4.8, 1.6, 8.8, x, y - 0.68, z);
    }
  }
}

export function buildCVBocasAndHeavyBarricades(world, batcher) {
  const bocas = [
    { ...wsP(-524, -382), label: 'BOCA NORTE-1 (CV)' },
    { ...wsP(-524, -250), label: 'BOCA CENTRAL-NORTE (CV)' },
    { ...wsP(-524, -117), label: 'BOCA PRINCIPAL CDD (CV)' },
    { ...wsP(-524, 36), label: 'BOCA CENTRAL CDD (CV)' },
    { ...wsP(-524, 134), label: 'BOCA CAMPINHO (CV)' },
    { ...wsP(-524, 380), label: 'BOCA SUL (CV)' },
    { ...wsP(-654, -640), label: 'BOCA SUBÚRBIO-OESTE (CV)' },
    { ...wsP(-654, 540), label: 'BOCA ORLA-OESTE (CV)' }
  ];

  for (let i = 0; i < bocas.length; i++) {
    const b = bocas[i];
    const by = getFavelaElevation(b.x, b.z);
    world.favelaCDDData.bocasCount++;

    for (const side of [-1, 1]) {
      const bz = b.z + side * 6.2;
      batcher.addBox('retaining_concrete', 2.4, 1.4, 4.2, b.x, by + 0.7, bz);
      batcher.addBox('cv_red', 2.46, 0.36, 4.26, b.x, by + 1.24, bz);
      world.addCollider(b.x, bz, 2.4, 4.2, by + 1.45, by - 0.5);

      const railX = b.x + 2.4;
      const railZ = b.z + side * 3.0;
      batcher.addSlopedBox('rebar_iron', 0.28, 2.15, 0.28, railX, by + 1.05, railZ, 0.35, 0.25);
      batcher.addSlopedBox('rebar_iron', 0.28, 2.15, 0.28, railX, by + 1.05, railZ, -0.35, -0.25);
      world.addCollider(railX, railZ, 1.6, 1.6, by + 2.1, by - 0.4);
    }

    const wreckX = b.x - 1.5;
    const wreckZ = b.z + 10.5;
    const wy = getFavelaElevation(wreckX, wreckZ);
    batcher.addBox('cv_black', 2.5, 1.15, 4.5, wreckX, wy + 0.52, wreckZ, 0.22);
    batcher.addBox('rebar_iron', 2.15, 0.72, 2.35, wreckX, wy + 1.28, wreckZ - 0.15, 0.22);
    world.addCollider(wreckX, wreckZ, 2.7, 4.7, wy + 1.7, wy - 0.4);

    const boothX = b.x - 2.8;
    const boothZ = b.z - 10.2;
    const bty = getFavelaElevation(boothX, boothZ);
    batcher.addBox('sandbag_tan', 3.4, 1.2, 3.4, boothX, bty + 0.5, boothZ);
    batcher.addBox('rebar_iron', 0.18, 3.3, 0.18, boothX, bty + 1.65, boothZ);
    batcher.addSlopedBox('zinc_roof', 4.1, 0.16, 4.1, boothX, bty + 3.35, boothZ, 0.1, 0);
    world.addCollider(boothX, boothZ, 3.4, 3.4, bty + 1.25, bty - 0.4);

    if (i < 6) {
      addFavelaSignBoard(
        world,
        b.x + 1.2,
        by + 4.4,
        b.z,
        14.0,
        2.4,
        'COMPLEXO DA CIDADE DE DEUS',
        'TERRITÓRIO 100% CV • REDUZA A VELOCIDADE',
        { rotY: true, bgColor: '#991b1b', borderColor: '#090a0d', textColor: '#ffffff', subColor: '#facc15' }
      );
    }

    for (const side of [-1, 1]) {
      const barrelGroup = new THREE.Group();
      const body = createLegoBrick(1.08, 1.56, 1.08, 0xb91c1c, { studs: false });
      body.position.y = 0.78;
      const stripe = createLegoBrick(1.12, 0.26, 1.12, 0xfacc15, { studs: false });
      stripe.position.y = 0.88;
      barrelGroup.add(body, stripe);

      const bx = b.x + 1.8;
      const bz = b.z + side * 8.6;
      const barrelY = getFavelaElevation(bx, bz);
      barrelGroup.position.set(bx, barrelY, bz);
      world.scene.add(barrelGroup);

      const bCol = world.addCollider(bx, bz, 1.1, 1.1, barrelY + 1.6, barrelY - 0.2);
      world.destructibles?.registerDestructible({
        mesh: barrelGroup,
        type: 'explosive_barrel',
        hp: 25,
        radius: 1.2,
        height: 1.6,
        colliders: [bCol],
        debrisColors: [0xb91c1c, 0xfacc15, 0x090a0d],
        studDrops: { silver: 2, gold: 3, blue: 1, purple: 0 },
        groundY: barrelY
      });
    }
  }
}

export function buildCDDSoccerFieldVarzea(world, batcher, cx, yBase, cz) {
  const fieldW = 44;
  const fieldD = 68;

  batcher.addBox('retaining_concrete', fieldW + 3, 4.5, fieldD + 3, cx, yBase - 2.15, cz);
  batcher.addBox('varzea_dirt', fieldW, 0.18, fieldD, cx, yBase + 0.08, cz);
  for (let gz = cz - 22; gz <= cz + 22; gz += 11) {
    batcher.addBox('varzea_grass', fieldW - 8, 0.2, 6.0, cx, yBase + 0.09, gz);
  }

  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.42, cx, yBase + 0.1, cz);
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.42, cx, yBase + 0.1, cz - fieldD * 0.5 + 2);
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.42, cx, yBase + 0.1, cz + fieldD * 0.5 - 2);
  batcher.addBox('cv_white', 0.42, 0.22, fieldD - 4, cx - fieldW * 0.5 + 2, yBase + 0.1, cz);
  batcher.addBox('cv_white', 0.42, 0.22, fieldD - 4, cx + fieldW * 0.5 - 2, yBase + 0.1, cz);

  for (const endDir of [-1, 1]) {
    const gz = cz + endDir * (fieldD * 0.5 - 2.5);
    batcher.addBox('cv_white', 0.36, 3.4, 0.36, cx - 5.2, yBase + 1.7, gz);
    batcher.addBox('cv_white', 0.36, 3.4, 0.36, cx + 5.2, yBase + 1.7, gz);
    batcher.addBox('cv_white', 10.8, 0.36, 0.36, cx, yBase + 3.4, gz);
    batcher.addBox('fence_mesh', 10.4, 3.2, 1.3, cx, yBase + 1.6, gz + endDir * 0.75);
    world.addCollider(cx, gz + endDir * 0.75, 10.8, 1.6, yBase + 3.5, yBase - 0.4);
  }

  for (const sideX of [-1, 1]) {
    const fx = cx + sideX * (fieldW * 0.5 + 1.0);
    for (let fz = cz - 28; fz <= cz + 28; fz += 14) {
      if (Math.abs(fz - cz) < 6) continue;
      batcher.addBox('rebar_iron', 0.32, 4.4, 0.32, fx, yBase + 2.2, fz);
      batcher.addBox('fence_mesh', 0.16, 4.0, 13.6, fx, yBase + 2.0, fz);
      world.addCollider(fx, fz, 0.65, 13.6, yBase + 4.4, yBase - 0.4);
    }
  }

  const bleachX = cx - fieldW * 0.5 - 4.2;
  for (let step = 0; step < 4; step++) {
    const sx = bleachX - step * 1.3;
    const sh = (step + 1) * 0.9;
    batcher.addBox('retaining_concrete', 1.3, sh + 2.0, fieldD - 8, sx, yBase + sh * 0.5 - 1.0, cz);
    batcher.addBox(step % 2 === 0 ? 'cv_red' : 'cement_slab', 1.35, 0.2, fieldD - 8, sx, yBase + sh, cz);
    world.addCollider(sx, cz, 1.3, fieldD - 8, yBase + sh, yBase - 0.5);
  }

  addFavelaSignBoard(
    world,
    bleachX - 5.2,
    yBase + 5.2,
    cz,
    36.0,
    3.5,
    'CAMPINHO DA CIDADE DE DEUS (VÁRZEA)',
    'COMANDO VERMELHO • TROPA DA CDD',
    { rotY: true, bgColor: '#991b1b', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );

  const floodConeGeo = new THREE.ConeGeometry(11.5, 19.0, 14, 1, true);
  floodConeGeo.translate(0, -9.5, 0);
  const floodConeMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = cx + sx * (fieldW * 0.5 + 1.8);
    const tz = cz + sz * (fieldD * 0.5 - 1.5);
    batcher.addBox('rebar_iron', 0.5, 13.8, 0.5, tx, yBase + 6.9, tz);
    batcher.addBox('cv_black', 2.5, 1.3, 0.62, tx, yBase + 13.8, tz);
    batcher.addBox('floodlight_panel', 2.25, 1.0, 0.7, tx, yBase + 13.8, tz);

    const cone = new THREE.Mesh(floodConeGeo, floodConeMat);
    cone.position.set(tx, yBase + 13.5, tz);
    cone.lookAt(cx, yBase + 0.2, cz + sz * 8.0);
    cone.rotateX(Math.PI / 2);
    cone.visible = false;
    world.scene.add(cone);
    world.favelaSoccerFloodCones.push({ mesh: cone, mat: floodConeMat });

    world.nightLampRegistry?.push({
      x: cx + sx * 8.0, y: yBase + 11.5, z: cz + sz * 14.0,
      groundY: yBase + 0.12, warm: false, coneH: 11.4, coneR: 8.5
    });
  }

  world.mapBuildings.push({ x: cx, z: cz, w: fieldW, d: fieldD, height: 4, color: '#16a34a', label: 'CAMPINHO CDD' });
  world.favelaSoccerData = { x: cx, y: yBase, z: cz, fieldW, fieldD };
  world.favelaCDDData.soccerCenter = { x: cx, y: yBase, z: cz };
  world.favelaCDDData.hasSoccerField = true;
}

export function buildCVBailePlazaAndGiantParedao(world, batcher, cx, yBase, cz) {
  const plazaW = 50;
  const plazaD = 58;

  batcher.addBox('retaining_concrete', plazaW + 2, 4.5, plazaD + 2, cx, yBase - 2.15, cz);
  batcher.addBox('alley_cement', plazaW, 0.14, plazaD, cx, yBase + 0.07, cz);
  batcher.addBox('cv_dark_red', plazaW - 10, 0.07, plazaD - 10, cx + 1, yBase + 0.17, cz);

  const paredaoX = cx - 19.0;
  const paredaoW = 5.4;
  const paredaoH = 11.5;
  const paredaoD = 21.0;

  batcher.addBox('cv_black', paredaoW, paredaoH, paredaoD, paredaoX, yBase + paredaoH * 0.5, cz);
  batcher.addBox('cv_red', paredaoW + 0.3, 1.1, paredaoD + 0.5, paredaoX, yBase + paredaoH + 0.55, cz);
  world.addCollider(paredaoX, cz, paredaoW, paredaoD, yBase + paredaoH + 1.2, yBase - 0.5);

  for (let row = 0; row < 4; row++) {
    const sy = yBase + 1.6 + row * 2.5;
    const neonKey = row % 2 === 0 ? 'neon_red' : row === 1 ? 'neon_gold' : 'neon_cyan';
    batcher.addBox(neonKey, 0.32, 0.26, paredaoD - 1.2, paredaoX + paredaoW * 0.5 + 0.14, sy + 1.1, cz);
    for (let col = -2; col <= 2; col++) {
      const sz = cz + col * 3.8;
      batcher.addBox('cv_red', 0.42, 1.95, 3.1, paredaoX + paredaoW * 0.5 + 0.1, sy, sz);
      batcher.addBox('cv_black', 0.58, 1.25, 1.95, paredaoX + paredaoW * 0.5 + 0.2, sy, sz);
    }
  }

  batcher.addBox('retaining_concrete', 5.2, 1.4, 13.5, paredaoX + 5.0, yBase + 0.7, cz);
  batcher.addBox('neon_red', 0.28, 0.28, 13.7, paredaoX + 7.6, yBase + 1.4, cz);
  world.addCollider(paredaoX + 5.0, cz, 5.2, 13.5, yBase + 1.4, yBase - 0.3);

  addFavelaSignBoard(
    world,
    paredaoX + paredaoW * 0.5 + 0.4,
    yBase + paredaoH + 2.4,
    cz,
    21.0,
    3.4,
    'BAILE DA CIDADE DE DEUS',
    'PAREDÃO MONSTRO • COMANDO VERMELHO',
    { rotY: true, bgColor: '#090a0d', borderColor: '#ff1e42', textColor: '#ff1e42', subColor: '#facc15' }
  );

  for (const sideZ of [-1, 1]) {
    const stallZ = cz + sideZ * 22.5;
    for (const sx of [cx - 5, cx + 8]) {
      batcher.addWallBox(0, 0xead8cc, 6.2, 3.1, 4.2, sx, yBase + 1.55, stallZ);
      batcher.addSlopedBox('zinc_roof', 7.0, 0.16, 5.1, sx, yBase + 3.25, stallZ, sideZ * -0.12, 0);
      world.addCollider(sx, stallZ, 6.2, 4.2, yBase + 3.5, yBase - 0.4);
    }
  }

  for (let mx = cx - 6; mx <= cx + 14; mx += 6.5) {
    for (const mz of [cz - 17.5, cz + 17.5]) {
      const tMat = Math.abs(Math.round(mx + mz)) % 2 === 0 ? 'cv_red' : 'favela_yellow_faded';
      batcher.addBox(tMat, 1.5, 0.82, 1.5, mx, yBase + 0.41, mz);
    }
  }

  for (let lz = cz - 18; lz <= cz + 18; lz += 12) {
    batcher.addBox('wire_black', 36.0, 0.08, 0.08, cx, yBase + 8.5, lz);
    for (let lx = cx - 12; lx <= cx + 12; lx += 6.0) {
      batcher.addBox('favela_bulb_warm', 0.28, 0.28, 0.28, lx, yBase + 8.32, lz);
    }
  }

  const skyBeamGeo = new THREE.ConeGeometry(5.8, 72.0, 14, 1, true);
  skyBeamGeo.translate(0, 36.0, 0);
  for (const ts of [
    { dz: -7.5, hex: 0xec4899, phase: 0.0 },
    { dz: 0.0, hex: 0x00f0ff, phase: 2.1 },
    { dz: 7.5, hex: 0xfacc15, phase: 4.2 }
  ]) {
    const mat = new THREE.MeshBasicMaterial({
      color: ts.hex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const pivot = new THREE.Group();
    pivot.position.set(paredaoX, yBase + paredaoH + 1.35, cz + ts.dz);
    pivot.add(new THREE.Mesh(skyBeamGeo, mat));
    pivot.visible = false;
    world.scene.add(pivot);
    world.favelaBaileSkytrackers.push({ pivot, mat, phase: ts.phase });
  }

  world.nightLampRegistry?.push({ x: cx, y: yBase + 8.2, z: cz, groundY: yBase + 0.15, warm: true, coneH: 8.0, coneR: 7.5 });

  if (IS_SCALED_WORLD) {
    const miranteEastX = ws(-702) + 12;
    const plazaEastX = cx + plazaW * 0.5;
    if (miranteEastX > plazaEastX + 1) {
      const mW = miranteEastX - plazaEastX;
      const mCX = (plazaEastX + miranteEastX) * 0.5;
      batcher.addBox('retaining_concrete', mW + 1.5, 4.5, 35.5, mCX, yBase - 2.15, cz);
      batcher.addBox('alley_cement', mW + 0.5, 0.14, 34, mCX, yBase + 0.07, cz);
      batcher.addBox('retaining_concrete', mW - 2, 0.9, 0.42, mCX, yBase + 0.45, cz - 16.6);
      batcher.addBox('retaining_concrete', mW - 2, 0.9, 0.42, mCX, yBase + 0.45, cz + 16.6);
    }
  }

  world.mapBuildings.push({ x: cx, z: cz, w: plazaW, d: plazaD, height: 12, color: '#dc2626', label: 'BAILE DO CV (PAREDÃO)' });
  world.favelaBaileCenter = new THREE.Vector3(cx, yBase, cz);
  world.favelaBaileData = {
    x: cx, y: yBase, z: cz, cx, cz, yBase, plazaW, plazaD, paredaoX,
    paredaoFaceX: paredaoX + 2.85, stageX: paredaoX + 5.0, stageTopY: yBase + 1.4
  };
  world.favelaCDDData.baileCenter = { x: cx, y: yBase, z: cz };
  world.favelaCDDData.hasBaileParedao = true;
}

export function buildRedBaronSummitFortress(world, batcher, cx, yBase, cz) {
  const fortW = 46;
  const fortD = 60;

  batcher.addBox('retaining_concrete', fortW + 4, 5.0, fortD + 4, cx, yBase - 2.4, cz);
  batcher.addBox('alley_cement', fortW + 2, 0.3, fortD + 2, cx, yBase + 0.05, cz);

  const towerX = cx + 10;
  const towerZ = cz - 46;
  const towerY = getFavelaElevation(towerX, towerZ);
  const towerH = 32.0;

  batcher.addBox('retaining_concrete', 14.0, 4.5, 14.0, towerX, towerY - 2.0, towerZ);
  for (const [dx, dz] of [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]]) {
    batcher.addBox('retaining_concrete', 2.2, 16.0, 2.2, towerX + dx, towerY + 8.0, towerZ + dz);
  }
  batcher.addCylinder('cement_slab', 9.5, 9.5, 5.0, towerX, towerY + 18.5, towerZ, 12);
  batcher.addCylinder('cv_white', 9.6, 9.6, 5.0, towerX, towerY + 23.5, towerZ, 12);
  batcher.addCylinder('cv_red', 9.5, 9.5, 5.0, towerX, towerY + 28.5, towerZ, 12);
  batcher.addCylinder('retaining_concrete', 10.1, 10.1, 1.1, towerX, towerY + 31.55, towerZ, 12);
  batcher.addBox('rebar_iron', 0.55, 9.0, 0.55, towerX, towerY + 36.5, towerZ);
  world.addCollider(towerX, towerZ, 15.5, 15.5, towerY + towerH, towerY - 2);

  const aeroHaloMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const haloSphereGeo = new THREE.SphereGeometry(2.4, 10, 10);
  for (const [bx, by, bz, phase] of [
    [towerX, towerY + 41.5, towerZ, 0.0],
    [cx - 8, yBase + 25.9, cz - 5, 1.6]
  ]) {
    batcher.addBox('neon_red', 1.1, 1.1, 1.1, bx, by, bz);
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, by, bz);
    const halo = new THREE.Mesh(haloSphereGeo, aeroHaloMat.clone());
    bGroup.add(halo);
    world.scene.add(bGroup);
    world.favelaSummitBeacons.push({ group: bGroup, haloMat: halo.material, phase });
  }

  for (const side of [1, -1]) {
    addFavelaSignBoard(
      world,
      towerX + side * 10.2,
      towerY + 23.5,
      towerZ,
      24.0,
      4.6,
      'CIDADE DE DEUS',
      side > 0 ? 'COMANDO VERMELHO • QG CENTRAL' : 'FORTALEZA DO BARÃO VERMELHO',
      { rotY: true, bgColor: '#991b1b', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
    );
  }

  batcher.addWallBox(0, 0xe8d6ca, fortW, 3.2, 1.3, cx, yBase + 1.6, cz - fortD * 0.5);
  batcher.addWallBox(0, 0xe8d6ca, fortW, 3.2, 1.3, cx, yBase + 1.6, cz + fortD * 0.5);
  batcher.addWallBox(1, 0xe8ded6, 1.3, 3.2, fortD, cx - fortW * 0.5, yBase + 1.6, cz);
  batcher.addWallBox(0, 0xe8d6ca, 1.3, 3.2, 20, cx + fortW * 0.5, yBase + 1.6, cz - 19);
  batcher.addWallBox(0, 0xe8d6ca, 1.3, 3.2, 20, cx + fortW * 0.5, yBase + 1.6, cz + 19);
  batcher.addBox('sandbag_tan', 2.2, 1.35, 15, cx + fortW * 0.5 + 1.2, yBase + 0.68, cz - 17);
  batcher.addBox('sandbag_tan', 2.2, 1.35, 15, cx + fortW * 0.5 + 1.2, yBase + 0.68, cz + 17);

  for (const [tx, tz] of [[cx - 21, cz - 28], [cx + 21, cz - 28], [cx - 21, cz + 28], [cx + 21, cz + 28]]) {
    batcher.addWallBox(1, 0xe2d6ce, 5.0, 11.0, 5.0, tx, yBase + 5.5, tz);
    batcher.addBox('cement_slab', 6.0, 0.8, 6.0, tx, yBase + 11.4, tz);
    batcher.addBox('sandbag_tan', 5.4, 1.1, 5.4, tx, yBase + 12.3, tz);
    world.addCollider(tx, tz, 5.4, 5.4, yBase + 13.5, yBase - 0.5);
  }

  const mansionX = cx - 6;
  batcher.addWallBox(2, 0x737a87, 24, 6.0, 34, mansionX, yBase + 3.0, cz);
  batcher.addBox('cement_slab', 24.8, 0.65, 34.8, mansionX, yBase + 6.2, cz);
  batcher.addWallBox(0, 0xf2e4da, 20, 5.8, 28, mansionX, yBase + 9.2, cz);
  batcher.addBox('window_lit', 20.3, 1.5, 18, mansionX, yBase + 9.5, cz);
  batcher.addBox('cement_slab', 22.8, 0.65, 30.8, mansionX, yBase + 12.3, cz);
  batcher.addWallBox(3, 0xa82828, 15, 5.0, 19, mansionX - 2, yBase + 15.0, cz);
  batcher.addBox('cement_slab', 17, 0.65, 21, mansionX - 2, yBase + 17.7, cz);
  batcher.addBox('rebar_iron', 0.36, 8.0, 0.36, mansionX - 2, yBase + 21.8, cz - 5);
  batcher.addBox('cv_red', 4.2, 2.4, 0.2, mansionX + 0.1, yBase + 24.2, cz - 5);
  world.addCollider(mansionX, cz, 24, 34, yBase + 18.2, yBase - 0.5);

  const poolX = cx + 12.5;
  batcher.addBox('cement_slab', 10.5, 1.05, 19.0, poolX, yBase + 0.52, cz);
  batcher.addBox('pool_water', 8.8, 1.12, 17.2, poolX, yBase + 0.58, cz);

  if (typeof world.destructibles?.spawnAmbientStud === 'function') {
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const kind = i % 4 === 0 ? 'purple' : i % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(poolX + Math.cos(ang) * 6.0, yBase + 1.2, cz + Math.sin(ang) * 9.0, kind);
    }
  }

  world.mapBuildings.push(
    { x: towerX, z: towerZ, w: 19, d: 19, height: 32, color: '#dc2626', label: "CAIXA D'ÁGUA CDD" },
    { x: cx, z: cz, w: fortW, d: fortD, height: 18, color: '#991b1b', label: 'QG BARÃO VERMELHO (CV)' }
  );

  world.favelaFortressData = { x: cx, y: yBase, z: cz, fortW, fortD, towerX, towerZ };
  world.favelaCDDData.fortressCenter = { x: cx, y: yBase, z: cz };
  world.favelaCDDData.hasRedBaronFortress = true;
  world.favelaCDDData.hasCommunityWaterTower = true;
}
