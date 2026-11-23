import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';
import { FACTION_THEME, TERRITORY_ZONES } from './TerritoryZonesAndConfigs.js';

// ============================================================================
// CONSTRUÇÃO FÍSICA 3D DOS PORTÕES, GARAGENS E 3 OUTPOSTS DE CADA TERRITÓRIO
// (Chamado por FavelaCDDBuilder.js, EastPortBuilder.js e LivingCityManager.js)
// ============================================================================
export function buildTerritoryInfrastructureForZone(world, zoneKey) {
  if (!world || !TERRITORY_ZONES[zoneKey]) return null;
  if (!world.territoryInfra) {
    world.territoryInfra = {};
  }
  if (world.territoryInfra[zoneKey]) {
    return world.territoryInfra[zoneKey];
  }

  const zone = TERRITORY_ZONES[zoneKey];
  const theme = FACTION_THEME[zone.defaultOwner] || FACTION_THEME.cv;
  const infra = {
    zoneKey,
    gates: [],
    garages: [],
    outposts: []
  };

  const terrainAt = (x, z) =>
    typeof world.getTerrainHeightAt === 'function' ? world.getTerrainHeightAt(x, z) : 0;

  // 1. PORTÕES DE FRONTEIRA LEGO (Guarita + Mastro com Bandeira Dinâmica + Pórtico + Cancela)
  for (const gSpec of zone.gates) {
    const yBase = terrainAt(gSpec.x, gSpec.z);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(gSpec.x, yBase, gSpec.z);
    gateGroup.rotation.y = gSpec.rotY || 0;

    // Guarita Blindada LEGO no acostamento esquerdo (-13.2m) deixando a pista 100% livre para carros e comboios!
    const boothWall = createLegoBrick(3.6, 3.3, 3.6, theme.secondaryHex, { studStep: 0.9 });
    boothWall.position.set(-13.2, 1.65, 0);
    const boothStripe = createLegoBrick(3.75, 0.55, 3.75, theme.hex, { studs: false });
    boothStripe.position.set(-13.2, 2.35, 0);
    const boothRoof = createLegoBrick(4.2, 0.42, 4.2, theme.accentHex, { studStep: 0.9 });
    boothRoof.position.set(-13.2, 3.5, 0);
    const boothVisor = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.85, 3.72),
      getLegoMaterial(0x38bdf8, { roughness: 0.12, emissive: 0x0284c7, emissiveIntensity: 0.35 })
    );
    boothVisor.position.set(-13.2, 2.15, 0);

    // Mastro Alto (8.8m) + Bandeira 3D Dinâmica que troca de cor ao conquistar o território!
    const poleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 8.8, 10),
      getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.55, roughness: 0.25 })
    );
    poleMesh.position.set(-13.2, 4.4, -1.5);

    const flagMat = new THREE.MeshStandardMaterial({
      color: theme.hex,
      emissive: new THREE.Color(theme.hex),
      emissiveIntensity: 0.35,
      roughness: 0.28
    });
    const flagMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.85, 0.18), flagMat);
    flagMesh.position.set(-11.4, 7.65, -1.5);

    // Pilar Direito (+13.2m) + Cancela Listrada Erguida em 38° + Barricada Lateral LEGO
    const rightPillar = createLegoBrick(2.4, 7.6, 2.4, theme.secondaryHex, { studStep: 0.8 });
    rightPillar.position.set(13.2, 3.8, 0);
    const leftGantryCol = createLegoBrick(2.0, 7.6, 2.0, theme.secondaryHex, { studs: false });
    leftGantryCol.position.set(-10.8, 3.8, 1.4);

    const boomPivot = new THREE.Group();
    boomPivot.position.set(11.8, 1.35, 0);
    boomPivot.rotation.z = 0.62; // Cancela semi-erguida permitindo passagem fluida de veículos!
    const boomBar = createLegoBrick(6.2, 0.26, 0.28, theme.hex, { studs: false });
    boomBar.position.set(-3.1, 0, 0);
    const boomTip = createLegoBrick(1.4, 0.3, 0.32, LEGO_COLORS.yellow, { studs: false });
    boomTip.position.set(-5.6, 0, 0);
    boomPivot.add(boomBar, boomTip);

    // Viga Superior do Pórtico (Y = +7.5m — altura livre de 7.1m para caminhões, ônibus e APCs!)
    const gantryBeam = createLegoBrick(26.4, 0.75, 1.2, theme.secondaryHex, { studStep: 1.2 });
    gantryBeam.position.set(1.2, 7.55, 0.7);

    const signMesh = createSignBoardMesh({
      x: 1.2,
      y: 8.55,
      z: 0.7,
      width: 15.5,
      height: 2.35,
      depth: 0.55,
      rotY: 0,
      title: gSpec.title,
      subText: gSpec.subText,
      bgColor: '#090a0d',
      borderColor: theme.color,
      textColor: '#f8fafc',
      subColor: theme.color,
      doubleSided: true
    });

    gateGroup.add(
      boothWall,
      boothStripe,
      boothRoof,
      boothVisor,
      poleMesh,
      flagMesh,
      rightPillar,
      leftGantryCol,
      boomPivot,
      gantryBeam,
      signMesh
    );
    world.scene.add(gateGroup);

    // Colisor apenas na guarita lateral esquerda para nunca travar a pista!
    const cosR = Math.cos(gSpec.rotY || 0);
    const sinR = Math.sin(gSpec.rotY || 0);
    const boothWorldX = gSpec.x + -13.2 * cosR;
    const boothWorldZ = gSpec.z - -13.2 * sinR;
    world.addCollider(boothWorldX, boothWorldZ, 4.0, 4.0, yBase + 3.9, yBase - 1.5);

    infra.gates.push({
      id: gSpec.id,
      x: gSpec.x,
      z: gSpec.z,
      group: gateGroup,
      flagMesh,
      flagMat,
      stripeMesh: boothStripe,
      boomBar
    });
  }

  // 2. GARAGENS OFICIAIS DO TIME + FROTA EXCLUSIVA DIRIGÍVEL ESTACIONADA (2 por Território)
  for (const gar of zone.garages) {
    const gy = terrainAt(gar.x, gar.z);
    const garGroup = new THREE.Group();
    garGroup.position.set(gar.x, gy, gar.z);
    garGroup.rotation.y = gar.rotY || 0;

    // Piso demarcado de oficina tática LEGO (18.6m x 8.6m) + Cobertura sustentada nos cantos traseiros
    const padFloor = createLegoBrick(18.6, 0.22, 8.6, 0x1e293b, { studs: false });
    padFloor.position.set(0, 0.08, 0);
    const padBorder = createLegoBrick(19.0, 0.14, 9.0, theme.hex, { studs: false });
    padBorder.position.set(0, 0.03, 0);

    for (const px of [-8.8, 8.8]) {
      for (const pz of [-3.8, 3.6]) {
        const colMesh = createLegoBrick(0.75, 4.8, 0.75, theme.secondaryHex, { studs: false });
        colMesh.position.set(px, 2.4, pz);
        garGroup.add(colMesh);
      }
    }

    const backWall = createLegoBrick(18.2, 3.6, 0.55, theme.secondaryHex, { studStep: 1.0 });
    backWall.position.set(0, 1.8, -4.1);
    const canopyRoof = createLegoBrick(19.2, 0.48, 9.2, theme.secondaryHex, { studStep: 1.2 });
    canopyRoof.position.set(0, 4.95, 0);
    const neonTrim = new THREE.Mesh(
      new THREE.BoxGeometry(19.3, 0.22, 0.32),
      new THREE.MeshBasicMaterial({ color: theme.hex })
    );
    neonTrim.position.set(0, 4.72, 4.55);

    const garSign = createSignBoardMesh({
      x: 0,
      y: 5.95,
      z: 4.35,
      width: 13.5,
      height: 1.85,
      depth: 0.45,
      rotY: 0,
      title: gar.title,
      subText: `FROTA EXCLUSIVA // ${theme.name}`,
      bgColor: '#090a0d',
      borderColor: theme.color,
      textColor: '#facc15',
      subColor: theme.color,
      doubleSided: true
    });

    garGroup.add(padFloor, padBorder, backWall, canopyRoof, neonTrim, garSign);
    world.scene.add(garGroup);

    // Estaciona os 3 veículos exclusivos da facção prontos para dirigir com [E]!
    const parkedVehicles = [];
    const cosG = Math.cos(gar.rotY || 0);
    const sinG = Math.sin(gar.rotY || 0);

    for (const vCfg of gar.fleet) {
      const spec = VEHICLE_SPECS[vCfg.type] || VEHICLE_SPECS.suv_pcc;
      const vx = gar.x + vCfg.dx * cosG + vCfg.dz * sinG;
      const vz = gar.z - vCfg.dx * sinG + vCfg.dz * cosG;
      const vy = terrainAt(vx, vz) + 0.18;

      const useLite = !spec.isMotorcycle;
      const carMesh = createLegoCarMesh({
        x: vx,
        z: vz,
        rotY: gar.rotY || 0,
        color: vCfg.color,
        roofColor: vCfg.roofColor,
        type: vCfg.type,
        trafficLite: useLite
      });
      if (useLite) {
        carMesh.userData._fullRebuildCfg = {
          color: vCfg.color,
          roofColor: vCfg.roofColor,
          type: vCfg.type
        };
      }
      carMesh.position.set(vx, vy, vz);
      carMesh.rotation.y = gar.rotY || 0;
      carMesh.userData.carType = vCfg.type;
      carMesh.userData.carName = vCfg.customName || spec.name;
      carMesh.userData.vehicleSpec = spec;
      carMesh.userData.factionGarageOwner = zoneKey;
      world.scene.add(carMesh);

      const isMoto = Boolean(spec.isMotorcycle);
      const col = world.addCollider(
        vx,
        vz,
        isMoto ? 1.4 : 2.5,
        isMoto ? 2.6 : 4.8,
        vy + (isMoto ? 1.3 : 1.7),
        vy
      );

      let destructible = null;
      if (world.destructibles) {
        destructible = world.destructibles.registerDestructible({
          mesh: carMesh,
          type: 'car',
          hp: spec.hp,
          radius: isMoto ? 1.8 : 2.75,
          height: isMoto ? 1.6 : 2.2,
          colliders: [col],
          debrisColors: [vCfg.color, vCfg.roofColor || 0x090a0d, theme.accentHex],
          studDrops: spec.studDrops,
          groundY: vy
        });
      }
      parkedVehicles.push({ mesh: carMesh, destructible, spec });
    }

    infra.garages.push({
      id: gar.id,
      x: gar.x,
      z: gar.z,
      group: garGroup,
      neonTrim,
      parkedVehicles
    });
  }

  // 3. OS 3 PONTOS DE SPAWN TÁTICOS / POSTOS DE COMANDO (OUTPOSTS P1, P2, P3)
  for (const op of zone.outposts) {
    const oy = terrainAt(op.x, op.z);
    const opGroup = new THREE.Group();
    opGroup.position.set(op.x, oy, op.z);

    // Piso Tático Demarcado LEGO (9.4m x 9.4m) em área aberta
    const baseSlab = createLegoBrick(9.4, 0.22, 9.4, 0x0f172a, { studs: false });
    baseSlab.position.set(0, 0.08, 0);

    const ringGeo = new THREE.RingGeometry(3.85, 4.55, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: theme.hex,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0.21, 0);

    // 4 Balizas de Canto com Studs Luminosos
    const bollardMats = new THREE.MeshStandardMaterial({
      color: theme.hex,
      emissive: new THREE.Color(theme.hex),
      emissiveIntensity: 0.45,
      roughness: 0.25
    });
    for (const bx of [-4.1, 4.1]) {
      for (const bz of [-4.1, 4.1]) {
        const post = createLegoBrick(0.65, 1.05, 0.65, theme.secondaryHex, { studs: false });
        post.position.set(bx, 0.58, bz);
        const cap = new THREE.Mesh(SHARED_STUD_GEO, bollardMats);
        cap.scale.set(1.6, 1.6, 1.6);
        cap.position.set(bx, 1.16, bz);
        opGroup.add(post, cap);
      }
    }

    // Torre de Antena de Rádio LEGO na borda do piso (+3.6m, -3.6m) deixando o centro livre!
    const towerX = 3.55;
    const towerZ = -3.55;
    const towerBase = createLegoBrick(1.8, 1.6, 1.8, theme.secondaryHex, { studStep: 0.6 });
    towerBase.position.set(towerX, 0.85, towerZ);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.34, 8.4, 8),
      getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.6, roughness: 0.25 })
    );
    mast.position.set(towerX, 5.2, towerZ);

    // Prato de Radar Giratório + Giroflex/Farol Esférico no Topo + Holofote Vertical Translúcido
    const dishGroup = new THREE.Group();
    dishGroup.position.set(towerX, 7.6, towerZ);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.55, 10, 1, true),
      getLegoMaterial(theme.accentHex, { metalness: 0.4, roughness: 0.22 })
    );
    dish.rotation.z = Math.PI / 2.4;
    dish.position.set(0.45, 0, 0);
    dishGroup.add(dish);

    const beaconMat = new THREE.MeshBasicMaterial({ color: theme.hex });
    const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), beaconMat);
    beaconMesh.position.set(towerX, 9.65, towerZ);

    const sirenBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.28), beaconMat);
    sirenBar.position.set(towerX, 9.15, towerZ);

    const spotlightMat = new THREE.MeshBasicMaterial({
      color: theme.hex,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const spotlightCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 3.1, 13.5, 14, 1, true),
      spotlightMat
    );
    spotlightCone.position.set(0, 6.85, 0);

    const opSign = createSignBoardMesh({
      x: towerX,
      y: 2.55,
      z: towerZ,
      width: 3.4,
      height: 1.05,
      depth: 0.26,
      rotY: -Math.PI / 4,
      title: `${op.code} // ${theme.shortTag}`,
      subText: 'POSTO DE COMANDO',
      bgColor: '#090a0d',
      borderColor: theme.color,
      textColor: '#f8fafc',
      subColor: theme.color,
      doubleSided: true
    });

    opGroup.add(
      baseSlab,
      ringMesh,
      towerBase,
      mast,
      dishGroup,
      beaconMesh,
      sirenBar,
      spotlightCone,
      opSign
    );
    world.scene.add(opGroup);

    world.addCollider(op.x + towerX, op.z + towerZ, 1.9, 1.9, oy + 4.5, oy - 1.0);

    infra.outposts.push({
      id: op.id,
      code: op.code,
      name: op.name,
      x: op.x,
      y: oy,
      z: op.z,
      ownerFaction: zone.defaultOwner,
      group: opGroup,
      ringMesh,
      beaconMesh,
      ringMat,
      bollardMats,
      beaconMat,
      spotlightMat,
      spotlightCone,
      dishGroup,
      sirenBar
    });
  }

  world.territoryInfra[zoneKey] = infra;
  return infra;
}

export const territoryInfrastructureMethods = {
  _syncZone3DColors(zoneKey) {
    const st = this.territories[zoneKey];
    const infra = this.world.territoryInfra?.[zoneKey];
    if (!st || !infra) return;

    const zoneTheme = FACTION_THEME[st.ownerFaction] || FACTION_THEME.cv;
    for (const g of infra.gates) {
      if (g.flagMat) {
        g.flagMat.color.setHex(zoneTheme.hex);
        g.flagMat.emissive.setHex(zoneTheme.hex);
      }
    }
    for (const opState of st.outposts) {
      const opTheme = FACTION_THEME[opState.ownerFaction] || zoneTheme;
      opState.ringMat?.color.setHex(opTheme.hex);
      opState.bollardMats?.color.setHex(opTheme.hex);
      opState.bollardMats?.emissive.setHex(opTheme.hex);
      opState.beaconMat?.color.setHex(opTheme.hex);
      opState.spotlightMat?.color.setHex(opTheme.hex);
    }
  }
};
