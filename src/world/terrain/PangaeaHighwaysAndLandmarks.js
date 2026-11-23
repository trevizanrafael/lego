import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';
import {
  PANGAEA_HIGHWAYS,
  getDistanceToCoastAt,
  getPangaeaElevationAt,
  getHighwayDistanceAt,
  isPointOnOrganicLand
} from '../CoastlineProfile.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../core/WorldLayoutScale.js';
import { buildBorealFjordBridge } from './BridgeAndPierSpecs.js';

/**
 * Constrói as Rodovias Inter-Regionais da Pangeia (`PANGAEA_HIGHWAYS`), Ponte Boreal do Fiorde,
 * Pórticos de Divisa e os 4 Marcos Identitários do Supercontinente (dimensões locais 1x preservadas!).
 */
export function buildPangaeaHighwaysAndLandmarks(world, buckets) {
  const {
    sandGeos,
    cliffGeos,
    turfGeos,
    roadAsphaltGeos,
    roadShoulderGeos,
    roadYellowGeos,
    borderAccentGeos,
    pineTreeTransforms,
    palmTreeTransforms
  } = buckets;

  const hwyPoleCoords = [];
  const segTargetLen = IS_SCALED_WORLD ? 36 : 24;
  for (const hwy of PANGAEA_HIGHWAYS) {
    const roadW = hwy.width || 24;
    for (let p = 0; p < hwy.points.length - 1; p++) {
      const [ax, az] = hwy.points[p];
      const [bx, bz] = hwy.points[p + 1];
      const segDx = bx - ax;
      const segDz = bz - az;
      const totalLen = Math.hypot(segDx, segDz);
      if (totalLen < 2) continue;

      const ux = segDx / totalLen;
      const uz = segDz / totalLen;
      const yaw = Math.atan2(segDx, segDz);

      if (Math.abs(segDx) <= 4 || Math.abs(segDz) <= 4) {
        const horiz = Math.abs(segDx) > Math.abs(segDz);
        world.mapRoads.push({
          x: (ax + bx) * 0.5,
          z: (az + bz) * 0.5,
          w: horiz ? totalLen + roadW * 0.4 : roadW,
          d: horiz ? roadW : totalLen + roadW * 0.4,
          isMain: true
        });
      }

      const subSteps = Math.max(1, Math.ceil(totalLen / segTargetLen));
      const subLen = totalLen / subSteps;
      for (let i = 0; i < subSteps; i++) {
        const t0 = i / subSteps;
        const t1 = (i + 1) / subSteps;
        const sx0 = ax + segDx * t0;
        const sz0 = az + segDz * t0;
        const sx1 = ax + segDx * t1;
        const sz1 = az + segDz * t1;
        const mx = (sx0 + sx1) * 0.5;
        const mz = (sz0 + sz1) * 0.5;

        if (mx > ws(528) && mx < ws(592)) continue;

        const y0 = getPangaeaElevationAt(sx0, sz0);
        const y1 = getPangaeaElevationAt(sx1, sz1);
        const ym = (y0 + y1) * 0.5;
        const dy = y1 - y0;
        const slopePitch = -Math.atan2(dy, subLen);
        const segActualLen = Math.hypot(subLen, dy) + 0.5;

        const sg = new THREE.BoxGeometry(roadW + 5.0, 1.4, segActualLen);
        sg.rotateX(slopePitch);
        sg.rotateY(yaw);
        sg.translate(mx, ym - 0.52, mz);
        roadShoulderGeos.push(sg);

        const rg = new THREE.BoxGeometry(roadW, 0.34, segActualLen);
        rg.rotateX(slopePitch);
        rg.rotateY(yaw);
        rg.translate(mx, ym + 0.14, mz);
        roadAsphaltGeos.push(rg);

        if (i % 2 === 0) {
          for (const off of [-0.55, 0.55]) {
            const yg = new THREE.BoxGeometry(0.45, 0.06, segActualLen * 0.62);
            yg.rotateX(slopePitch);
            yg.rotateY(yaw);
            yg.translate(mx + uz * off, ym + 0.36, mz - ux * off);
            roadYellowGeos.push(yg);
          }
        }

        const poleModulo = IS_SCALED_WORLD ? 4 : 3;
        if (i % poleModulo === 1) {
          hwyPoleCoords.push({
            x: mx + uz * (roadW * 0.5 + 1.6),
            y: ym + 0.25,
            z: mz - ux * (roadW * 0.5 + 1.6),
            yaw
          });
        }
      }
    }
  }

  buildBorealFjordBridge(world, roadAsphaltGeos, cliffGeos);

  if (hwyPoleCoords.length > 0) {
    const dummy = new THREE.Object3D();
    const poleGeo = new THREE.BoxGeometry(0.45, 7.2, 0.45);
    const armGeo = new THREE.BoxGeometry(3.4, 0.28, 0.35);
    const poleMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.4 });
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, hwyPoleCoords.length);
    const armInst = new THREE.InstancedMesh(armGeo, poleMat, hwyPoleCoords.length);
    hwyPoleCoords.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 3.6, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x - Math.cos(p.yaw) * 1.4, p.y + 7.1, p.z + Math.sin(p.yaw) * 1.4);
      dummy.updateMatrix();
      armInst.setMatrixAt(idx, dummy.matrix);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    armInst.instanceMatrix.needsUpdate = true;
    world.scene.add(poleInst, armInst);
  }

  const borderPortals = [
    { x: ws(-1215), z: ws(-1328), yaw: 0, title: 'PLATÔ BOREAL NORTE', color: '#4ade80' },
    { x: ws(964), z: ws(-1328), yaw: 0, title: 'EXPRESSA TÉTIS NORTE', color: '#38bdf8' },
    { x: ws(-1832), z: ws(-1285), yaw: Math.PI / 2, title: 'CABO RADAR NOROESTE', color: '#94a3b8' },
    { x: ws(1634), z: ws(-908), yaw: Math.PI / 2, title: 'PARQUE EÓLICO TÉTIS', color: '#38bdf8' },
    { x: ws(-1832), z: ws(710), yaw: Math.PI / 2, title: 'COSTA DAS DUNAS SUL', color: '#fde047' }
  ];
  const portalHalfSpan = IS_SCALED_WORLD ? ROAD.secondaryWidth * 0.5 + 1.5 : 13.5;
  const portalBeamLen = IS_SCALED_WORLD ? portalHalfSpan * 2 + 2.0 : 29.0;
  for (const bp of borderPortals) {
    const py = getPangaeaElevationAt(bp.x, bp.z);
    const ux = Math.cos(bp.yaw);
    const uz = -Math.sin(bp.yaw);
    for (const s of [-portalHalfSpan, portalHalfSpan]) {
      cliffGeos.push(makeFastBox(1.8, 9.6, 1.8, bp.x + ux * s, py + 4.8, bp.z + uz * s));
    }
    const isZAligned = Math.abs(bp.yaw) > 0.1;
    cliffGeos.push(
      makeFastBox(isZAligned ? 1.8 : portalBeamLen, 1.4, isZAligned ? portalBeamLen : 1.8, bp.x, py + 9.4, bp.z)
    );
    const sign = createSignBoardMesh({
      x: bp.x,
      y: py + 9.4,
      z: bp.z,
      rotY: bp.yaw,
      width: 24,
      height: 3.4,
      depth: 2.1,
      title: bp.title,
      bgColor: '#090a0d',
      borderColor: bp.color,
      textColor: bp.color,
      doubleSided: true
    });
    world.scene.add(sign);
  }

  // 4A. Floresta Boreal de Pinheiros + Mirante Florestal (tamanhos locais 1x!)
  for (let gx = -2250; gx <= 420; gx += 165) {
    for (let gz = -2650; gz <= -1440; gz += 165) {
      const tx = ws(gx + Math.sin(gx * 0.03 + gz * 0.02) * 55);
      const tz = ws(gz + Math.cos(gz * 0.04 - gx * 0.01) * 55);
      if (!isPointOnOrganicLand(tx, tz)) continue;
      if (getDistanceToCoastAt(tx, tz) < 55) continue;
      if (getHighwayDistanceAt(tx, tz) < 28) continue;
      if (Math.abs(tx - ws(560)) < ws(60)) continue;
      const ty = getPangaeaElevationAt(tx, tz);
      pineTreeTransforms.push({ x: tx, y: ty, z: tz, s: 1.15 + ((Math.abs(gx + gz) % 4) * 0.25) });
    }
  }
  {
    const lx = ws(-1265);
    const lz = ws(-2420);
    const ly = getPangaeaElevationAt(lx, lz);
    cliffGeos.push(makeFastBox(26, 2.0, 22, lx, ly + 1.0, lz));
    turfGeos.push(makeFastBox(20, 8.5, 16, lx, ly + 6.0, lz));
    sandGeos.push(makeFastBox(24, 2.2, 20, lx, ly + 11.2, lz));
    cliffGeos.push(makeFastBox(6.5, 22.0, 6.5, lx + 16, ly + 11.0, lz - 6));
    world.addCollider(lx, lz, 26, 22, ly + 12.5, ly);
    world.addCollider(lx + 16, lz - 6, 7.0, 7.0, ly + 22.0, ly);
    world.mapBuildings.push({ x: lx, z: lz, w: 32, d: 24, height: 22, color: '#22c55e', label: 'ESTAÇÃO BOREAL NORTE', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: lx,
        y: ly + 15.2,
        z: lz + 9.2,
        width: 22,
        height: 3.4,
        title: 'PLATÔ BOREAL NORTE',
        bgColor: '#090a0d',
        borderColor: '#4ade80',
        textColor: '#4ade80',
        doubleSided: true
      })
    );
  }

  // 4B. Estação Radar Costeira no Cabo Noroeste (tamanhos locais 1x!)
  {
    const rx = ws(-2920);
    const rz = ws(-1345);
    const ry = getPangaeaElevationAt(rx, rz);
    cliffGeos.push(
      makeFastBox(38, 3.0, 32, rx, ry + 1.5, rz),
      makeFastBox(24, 14.0, 20, rx, ry + 10.0, rz)
    );
    const dishPivot = new THREE.Group();
    dishPivot.position.set(rx, ry + 20.5, rz);
    const dishMat = getLegoMaterial(LEGO_COLORS.lightGrey, { roughness: 0.35, metalness: 0.35 });
    const dishPlate = new THREE.Mesh(new THREE.CylinderGeometry(11.0, 4.5, 3.8, 12), dishMat);
    dishPlate.rotation.x = Math.PI * 0.32;
    const feedArm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 11.0), dishMat);
    feedArm.position.set(0, 4.5, 4.2);
    dishPivot.add(dishPlate, feedArm);
    world.scene.add(dishPivot);
    if (Array.isArray(world.rotatingElements)) {
      world.rotatingElements.push({ mesh: dishPivot, axis: 'y', speed: 0.48 });
    }
    world.addCollider(rx, rz, 38, 32, ry + 18.0, ry);
    world.mapBuildings.push({ x: rx, z: rz, w: 38, d: 32, height: 26, color: '#94a3b8', label: 'CABO RADAR NOROESTE', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: rx,
        y: ry + 12.0,
        z: rz + 14.0,
        width: 22,
        height: 3.4,
        title: 'ESTAÇÃO RADAR NOROESTE',
        bgColor: '#090a0d',
        borderColor: '#94a3b8',
        textColor: '#f8fafc',
        doubleSided: true
      })
    );
  }

  // 4C. Parque Eólico de Tétis (8 Aerogeradores Gigantes em 1x!) & Refinaria
  const turbineCoords = [
    [2240, -1980], [2620, -2060], [2980, -1720], [2960, -1240],
    [2320, -1420], [2480, -680], [2140, -1720], [2840, -820]
  ];
  const turbinePoleMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.25, clearcoat: 0.35 });
  const turbineAccentMat = getLegoMaterial(0x00f0ff, { roughness: 0.2 });
  const hubGeo = new THREE.BoxGeometry(3.2, 3.2, 5.4);
  const bladeGeo = new THREE.BoxGeometry(1.5, 22.0, 0.55);
  const mastGeo = new THREE.CylinderGeometry(1.4, 2.5, 52.0, 10);
  for (const [rawWx, rawWz] of turbineCoords) {
    const wx = ws(rawWx);
    const wz = ws(rawWz);
    if (!isPointOnOrganicLand(wx, wz)) continue;
    const wy = getPangaeaElevationAt(wx, wz);
    const mast = new THREE.Mesh(mastGeo, turbinePoleMat);
    mast.position.set(wx, wy + 26.0, wz);
    mast.matrixAutoUpdate = false;
    mast.updateMatrix();
    world.scene.add(mast);

    const rotorPivot = new THREE.Group();
    rotorPivot.position.set(wx, wy + 52.0, wz + 2.8);
    const hub = new THREE.Mesh(hubGeo, turbineAccentMat);
    for (let b = 0; b < 3; b++) {
      const br = new THREE.Group();
      br.rotation.z = (b / 3) * Math.PI * 2;
      const bl = new THREE.Mesh(bladeGeo, turbinePoleMat);
      bl.position.y = 11.5;
      br.add(bl);
      rotorPivot.add(br);
    }
    rotorPivot.add(hub);
    world.scene.add(rotorPivot);
    if (Array.isArray(world.rotatingElements)) {
      world.rotatingElements.push({ mesh: rotorPivot, axis: 'z', speed: 1.45 + ((rawWx % 5) * 0.12) });
    }
    world.addCollider(wx, wz, 5.5, 5.5, wy + 52.0, wy);
    world.mapBuildings.push({ x: wx, z: wz, w: 14, d: 14, height: 52, color: '#38bdf8', label: 'TORRE EÓLICA' });
  }
  {
    const rx = ws(2740);
    const rz = ws(-1120);
    const ry = getPangaeaElevationAt(rx, rz);
    cliffGeos.push(makeFastBox(46, 2.0, 42, rx, ry + 1.0, rz));
    for (const [ox, oz] of [[-12, -8], [12, -8], [-12, 10], [12, 10]]) {
      const silo = new THREE.CylinderGeometry(7.2, 7.2, 18.0, 12);
      silo.translate(rx + ox, ry + 10.5, rz + oz);
      cliffGeos.push(silo);
      world.addCollider(rx + ox, rz + oz, 14.4, 14.4, ry + 19.5, ry);
    }
    world.mapBuildings.push({ x: rx, z: rz, w: 46, d: 42, height: 22, color: '#3b82f6', label: 'PARQUE EÓLICO & REFINARIA', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: rx,
        y: ry + 22.0,
        z: rz + 19.0,
        width: 24,
        height: 3.4,
        title: 'PARQUE EÓLICO TÉTIS',
        bgColor: '#090a0d',
        borderColor: '#38bdf8',
        textColor: '#38bdf8',
        doubleSided: true
      })
    );
  }

  // 4D. Vila das Dunas Sudoeste & Coqueirais (cabanas em 1x!)
  for (let gx = -3050; gx <= -1750; gx += 170) {
    for (let gz = 880; gz <= 2280; gz += 170) {
      const tx = ws(gx + Math.cos(gx * 0.02 + gz) * 45);
      const tz = ws(gz + Math.sin(gz * 0.03 - gx) * 45);
      if (!isPointOnOrganicLand(tx, tz)) continue;
      const cd = getDistanceToCoastAt(tx, tz);
      if (cd < 18 || cd > ws(180)) continue;
      if (getHighwayDistanceAt(tx, tz) < 28) continue;
      const ty = getPangaeaElevationAt(tx, tz);
      palmTreeTransforms.push({ x: tx, y: ty, z: tz, s: 1.0 + ((Math.abs(gx) % 3) * 0.22) });
    }
  }
  {
    const vx = ws(-2520);
    const vz = ws(2020);
    const vy = getPangaeaElevationAt(vx, vz);
    const houseCols = ['#ef4444', '#fde047', '#38bdf8'];
    [-26, 0, 26].forEach((ox, idx) => {
      const hy = getPangaeaElevationAt(vx + ox, vz);
      sandGeos.push(makeFastBox(15, 2.2, 14, vx + ox, hy + 1.0, vz));
      borderAccentGeos[houseCols[idx]] = borderAccentGeos[houseCols[idx]] || [];
      borderAccentGeos[houseCols[idx]].push(makeFastBox(13, 6.2, 12, vx + ox, hy + 5.2, vz));
      world.addCollider(vx + ox, vz, 15, 14, hy + 8.5, hy);
    });
    world.mapBuildings.push({ x: vx, z: vz, w: 68, d: 18, height: 10, color: '#fde047', label: 'VILA DUNAS SUDOESTE', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: vx,
        y: vy + 10.5,
        z: vz - 11.0,
        width: 22,
        height: 3.4,
        title: 'VILA DUNAS SUDOESTE',
        bgColor: '#090a0d',
        borderColor: '#fde047',
        textColor: '#fde047',
        doubleSided: true
      })
    );
  }
}

export function flushPangaeaTreeInstances(world, pineTreeTransforms, palmTreeTransforms) {
  if (pineTreeTransforms.length > 0) {
    const dummy = new THREE.Object3D();
    const crownGeo = new THREE.ConeGeometry(4.2, 11.2, 6);
    const trunkGeo = new THREE.CylinderGeometry(0.9, 1.15, 5.4, 6);
    const crownInst = new THREE.InstancedMesh(crownGeo, getLegoMaterial(0x166534, { roughness: 0.55 }), pineTreeTransforms.length);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, getLegoMaterial(0x78350f, { roughness: 0.7 }), pineTreeTransforms.length);
    pineTreeTransforms.forEach((tr, idx) => {
      dummy.position.set(tr.x, tr.y + 6.4 * tr.s, tr.z);
      dummy.rotation.set(0, (idx * 0.7) % (Math.PI * 2), 0);
      dummy.scale.set(tr.s, tr.s, tr.s);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tr.x, tr.y + 2.2 * tr.s, tr.z);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);
    });
    crownInst.instanceMatrix.needsUpdate = true;
    trunkInst.instanceMatrix.needsUpdate = true;
    world.scene.add(crownInst, trunkInst);
  }

  if (palmTreeTransforms.length > 0) {
    const dummy = new THREE.Object3D();
    const palmCrownGeo = new THREE.ConeGeometry(4.8, 3.6, 5);
    const palmTrunkGeo = new THREE.CylinderGeometry(0.55, 0.85, 8.6, 6);
    const palmCrownInst = new THREE.InstancedMesh(palmCrownGeo, getLegoMaterial(0x22c55e, { roughness: 0.45 }), palmTreeTransforms.length);
    const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, getLegoMaterial(0x92400e, { roughness: 0.7 }), palmTreeTransforms.length);
    palmTreeTransforms.forEach((tr, idx) => {
      dummy.position.set(tr.x, tr.y + 8.6 * tr.s, tr.z);
      dummy.rotation.set(0.08, (idx * 1.1) % (Math.PI * 2), 0.08);
      dummy.scale.set(tr.s, tr.s, tr.s);
      dummy.updateMatrix();
      palmCrownInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tr.x, tr.y + 4.1 * tr.s, tr.z);
      dummy.rotation.set(0.05, 0, -0.05);
      dummy.updateMatrix();
      palmTrunkInst.setMatrixAt(idx, dummy.matrix);
    });
    palmCrownInst.instanceMatrix.needsUpdate = true;
    palmTrunkInst.instanceMatrix.needsUpdate = true;
    world.scene.add(palmCrownInst, palmTrunkInst);
  }
}
