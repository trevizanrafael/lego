import * as THREE from 'three';
import { getLegoMaterial, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { TRAIL_CUBE_GEO } from './DestructibleRegistryAndCulling.js';

// ============================================================================
// ASSETS COMPARTILHADOS E PRÉ-AQUECIDOS DO TURBO FANTASMA (ZERO ALOCAÇÃO / GC!)
// ============================================================================
const GHOST_BIKE_BLACK_MAT = markAsSharedAsset(getLegoMaterial(0x090a0d, { roughness: 0.18, clearcoat: 0.78 }));
const GHOST_BIKE_CHROME_MAT = markAsSharedAsset(getLegoMaterial(0xe2e8f0, { metalness: 0.88, roughness: 0.12 }));
const GHOST_BIKE_CYAN_GLOW_MAT = markAsSharedAsset(
  getLegoMaterial(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 2.6, roughness: 0.08 })
);
const GHOST_BIKE_WHITE_CYAN_MAT = markAsSharedAsset(
  getLegoMaterial(0xe0f2fe, { emissive: 0x38bdf8, emissiveIntensity: 3.0, roughness: 0.05 })
);

const GHOST_BIKE_BODY_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.84, 0.54, 2.75));
const GHOST_BIKE_REACTOR_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.28, 0.28, 0.92, 16));
const GHOST_BIKE_CANOPY_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.76, 0.36, 1.38));
const GHOST_BIKE_HEADLIGHT_GEO = markAsSharedAsset(new THREE.OctahedronGeometry(0.24, 1));
const GHOST_BIKE_HANDLEBAR_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.04, 0.04, 0.98, 10));
const GHOST_BIKE_NEON_STRIP_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.055, 0.14, 2.58));
const GHOST_BIKE_TIRE_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.54, 0.54, 0.38, 24));
const GHOST_BIKE_RIM_GEO = markAsSharedAsset(new THREE.TorusGeometry(0.4, 0.07, 10, 24));
const GHOST_BIKE_HUB_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 14));
const GHOST_BIKE_THRUSTER_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.11, 0.15, 0.62, 12));
const GHOST_BIKE_FLAME_GEO = markAsSharedAsset(new THREE.ConeGeometry(0.15, 0.95, 10));

const LIGHT_WALL_H = 1.85;
const LIGHT_WALL_PANEL_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.18, LIGHT_WALL_H, 1.0));
const LIGHT_WALL_RAIL_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.26, 0.14, 1.0));

const WHIP_CRESCENT_OUTER_GEO = markAsSharedAsset(new THREE.TorusGeometry(2.15, 0.16, 10, 28, Math.PI * 1.15));
const WHIP_CRESCENT_CORE_GEO = markAsSharedAsset(new THREE.TorusGeometry(2.08, 0.085, 8, 26, Math.PI * 1.08));
const WHIP_INNER_RING_GEO = markAsSharedAsset(new THREE.TorusGeometry(1.38, 0.09, 8, 24));
const WHIP_TOOTH_GEO = markAsSharedAsset(new THREE.ConeGeometry(0.18, 0.72, 4));
const WHIP_CYAN_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.94 }));
const WHIP_BRIGHT_CYAN_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.98 }));
const WHIP_WHITE_HOT_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 1.0 }));

const GHOST_BIKE_VEHICLE_SPEC = {
  id: 'moto_fantasma_turbo',
  category: 'car',
  isGhostBike: true,
  isMotorcycle: true,
  openTop: true,
  canWheelie: true,
  rammingPower: 'unstoppable',
  maxForward: 68.0,
  turboSpeed: 232.0,
  maxReverse: -36.0,
  accel: 38.0,
  turboAccel: 76.0,
  brakeDecel: 245.0,
  coastFriction: 68.0,
  turnRate: 3.4,
  driftTurnRate: 4.6,
  seatedYOffset: 0.78,
  seatZOffset: -0.26,
  rearAxleZ: 1.15,
  enterRadius: 5.5
};

function buildPooledGhostBikeGroup() {
  const bikeGroup = markAsSharedAsset(new THREE.Group());
  bikeGroup.name = 'TurboGhostBikeGroup';

  const body = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_BODY_GEO, GHOST_BIKE_BLACK_MAT));
  body.position.set(0, 0.58, 0);
  body.castShadow = true;
  bikeGroup.add(body);

  const reactorCore = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_REACTOR_GEO, GHOST_BIKE_WHITE_CYAN_MAT));
  reactorCore.rotation.z = Math.PI / 2;
  reactorCore.position.set(0, 0.56, 0.12);
  bikeGroup.add(reactorCore);

  const canopy = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_CANOPY_GEO, GHOST_BIKE_CYAN_GLOW_MAT));
  canopy.position.set(0, 0.9, 0.44);
  canopy.rotation.x = 0.24;
  bikeGroup.add(canopy);

  const skullHeadlight = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_HEADLIGHT_GEO, GHOST_BIKE_WHITE_CYAN_MAT));
  skullHeadlight.position.set(0, 0.78, 1.36);
  bikeGroup.add(skullHeadlight);

  const handlebar = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_HANDLEBAR_GEO, GHOST_BIKE_CHROME_MAT));
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.06, 0.48);
  bikeGroup.add(handlebar);

  for (const sx of [-0.45, 0.45]) {
    const neonStrip = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_NEON_STRIP_GEO, GHOST_BIKE_WHITE_CYAN_MAT));
    neonStrip.position.set(sx, 0.64, 0);
    bikeGroup.add(neonStrip);
  }

  const wheels = [];
  for (const [wz, isFront] of [[-1.15, false], [1.15, true]]) {
    const steerGroup = markAsSharedAsset(new THREE.Group());
    steerGroup.position.set(0, 0.54, wz);
    const spinGroup = markAsSharedAsset(new THREE.Group());

    const tire = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_TIRE_GEO, GHOST_BIKE_BLACK_MAT));
    tire.rotation.z = Math.PI / 2;
    const rimGlow = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_RIM_GEO, GHOST_BIKE_CYAN_GLOW_MAT));
    rimGlow.rotation.y = Math.PI / 2;
    rimGlow.position.set(0.2, 0, 0);
    const rimGlowL = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_RIM_GEO, GHOST_BIKE_CYAN_GLOW_MAT));
    rimGlowL.rotation.y = Math.PI / 2;
    rimGlowL.position.set(-0.2, 0, 0);
    const hubGlow = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_HUB_GEO, GHOST_BIKE_WHITE_CYAN_MAT));
    hubGlow.rotation.z = Math.PI / 2;

    spinGroup.add(tire, rimGlow, rimGlowL, hubGlow);
    steerGroup.add(spinGroup);
    bikeGroup.add(steerGroup);
    wheels.push({ steerGroup, spinGroup, isFront });
  }
  bikeGroup.userData.wheels = wheels;

  const turboFlames = [];
  for (const sx of [-0.28, 0.28]) {
    const thruster = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_THRUSTER_GEO, GHOST_BIKE_CHROME_MAT));
    thruster.rotation.x = Math.PI / 2;
    thruster.position.set(sx, 0.74, -1.38);
    const flame = markAsSharedAsset(new THREE.Mesh(GHOST_BIKE_FLAME_GEO, GHOST_BIKE_WHITE_CYAN_MAT));
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(sx, 0.74, -1.96);
    flame.visible = false;
    bikeGroup.add(thruster, flame);
    turboFlames.push(flame);
  }
  bikeGroup.userData.turboFlames = turboFlames;
  bikeGroup.userData.isOptimizedGroup = true;
  bikeGroup.userData.isDriveableCar = true;
  bikeGroup.userData.carName = 'MOTO FANTASMA CIANO (740 KM/H)';
  bikeGroup.userData.vehicleSpec = GHOST_BIKE_VEHICLE_SPEC;

  return bikeGroup;
}

function createPooledLightWallSlot() {
  const group = markAsSharedAsset(new THREE.Group());
  const wallMat = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.76 }));
  const railMat = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.98 }));
  const panelMesh = markAsSharedAsset(new THREE.Mesh(LIGHT_WALL_PANEL_GEO, wallMat));
  const topRail = markAsSharedAsset(new THREE.Mesh(LIGHT_WALL_RAIL_GEO, railMat));
  topRail.position.y = LIGHT_WALL_H * 0.5;
  const botRail = markAsSharedAsset(new THREE.Mesh(LIGHT_WALL_RAIL_GEO, railMat));
  botRail.position.y = -LIGHT_WALL_H * 0.5 + 0.08;
  group.add(panelMesh, topRail, botRail);
  return { group, panelMesh, topRail, botRail, wallMat, railMat, midPos: new THREE.Vector3() };
}

export const TURBO_GHOST_HERO_VFX_METHODS = {
  /**
   * Pré-constrói e registra a Moto Energética Ciano uma única vez (invisível e inativa)
   * para pré-aquecer shaders no boot e reutilizar a mesma instância sem alocações em runtime!
   */
  prewarmTurboGhostBike() {
    if (this._turboGhostBikeObj && this._turboGhostBikeMesh) {
      return this._turboGhostBikeObj;
    }

    const bikeGroup = buildPooledGhostBikeGroup();
    bikeGroup.position.set(0, -500, 0);
    bikeGroup.visible = false;
    bikeGroup.matrixAutoUpdate = true;
    bikeGroup.matrixWorldAutoUpdate = false;

    if (this.scene) {
      this.scene.add(bikeGroup);
    }

    const bikeCollider = {
      minX: -0.65,
      maxX: 0.65,
      minY: -500,
      maxY: -498.55,
      minZ: -1.4,
      maxZ: 1.4,
      disabled: true
    };

    const bikeObj = this.registerDestructible({
      mesh: bikeGroup,
      type: 'car',
      hp: 420,
      radius: 1.65,
      height: 1.45,
      colliders: [bikeCollider],
      debrisColors: [0x090a0d, 0x22d3ee, 0xe0f2fe],
      studDrops: { silver: 4, gold: 4, blue: 2, purple: 0 },
      groundY: -500,
      noAutoRespawn: true
    });

    bikeObj.destroyed = true;
    bikeObj.mesh.visible = false;
    for (const col of bikeObj.colliders) {
      col.disabled = true;
    }

    this._turboGhostBikeMesh = bikeGroup;
    this._turboGhostBikeObj = bikeObj;
    return bikeObj;
  },

  /**
   * Invoca ou rematerializa instantaneamente no lugar a Moto Energética Ciano ("INTERCEPTOR FANTASMA")
   */
  summonTurboEnergyBike(spawnPos, facingAngle = 0) {
    soundFX.playHeroSwap();
    soundFX.playLaserShot();

    const px = spawnPos?.x ?? 0;
    const pz = spawnPos?.z ?? 0;
    const groundY = Number.isFinite(spawnPos?.y)
      ? spawnPos.y
      : this.world?.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(px, pz)
        : 0;

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      this._spawnFxParticle(
        TRAIL_CUBE_GEO, i % 2 === 0 ? 0x22d3ee : 0xe0f2fe, 0.95,
        px + cosA * 1.4, groundY + 0.6, pz + sinA * 1.4,
        1.4, 1.4, 1.4,
        cosA * 8.5, 4.5 + Math.random() * 4.5, sinA * 8.5,
        0.45, 0.45
      );
    }

    const bikeObj = this.prewarmTurboGhostBike();
    const bikeGroup = bikeObj.mesh;
    if (this.scene && bikeGroup.parent !== this.scene) this.scene.add(bikeGroup);
    if (!this.objects.includes(bikeObj)) this.objects.push(bikeObj);
    if (bikeObj._isDynamicIndexed && !this._dynamicObjects.includes(bikeObj)) {
      this._dynamicObjects.push(bikeObj);
    }

    bikeObj.destroyed = false;
    bikeObj.hp = bikeObj.maxHp;
    bikeObj.isGrabbed = false;
    bikeObj.isDriven = false;
    bikeObj.heatLevel = 0;
    bikeObj.shakeTimer = 0;
    bikeObj.respawnTimer = 0;

    bikeGroup.position.set(px, groundY, pz);
    bikeGroup.rotation.set(0, facingAngle, 0);
    bikeGroup.scale.set(1, 1, 1);
    bikeGroup.visible = true;
    bikeGroup.matrixAutoUpdate = true;
    bikeGroup.matrixWorldAutoUpdate = true;
    bikeGroup.updateMatrixWorld(true);

    if (Array.isArray(bikeGroup.userData?.turboFlames)) {
      for (const fl of bikeGroup.userData.turboFlames) {
        if (fl) fl.visible = false;
      }
    }

    bikeObj.basePos.set(px, groundY, pz);
    bikeObj.baseRot.set(0, facingAngle, 0);
    bikeObj.groundY = groundY;

    const col = bikeObj.colliders?.[0];
    if (col) {
      col.minX = px - 0.65;
      col.maxX = px + 0.65;
      col.minY = groundY;
      col.maxY = groundY + 1.45;
      col.minZ = pz - 1.4;
      col.maxZ = pz + 1.4;
      col.disabled = false;
      this.world?.updateDynamicCollider?.(col);
    }

    this._updateDynamicObjectCell?.(bikeObj);
    return bikeObj;
  },

  /**
   * Cria um segmento sólido da Muralha de Luz Ciano (Light Wall estilo Tron) usando pool zero-alocação
   */
  spawnTurboLightWallSegment(fromPos, toPos) {
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.35 || len > 26.0) return;

    if (!this._lightWallPool) this._lightWallPool = [];
    let slot = this._lightWallPool.find((s) => !s.group.parent);
    if (!slot) {
      slot = createPooledLightWallSlot();
      this._lightWallPool.push(slot);
    }

    const midX = (fromPos.x + toPos.x) * 0.5;
    const midZ = (fromPos.z + toPos.z) * 0.5;
    const baseY = Math.min(fromPos.y, toPos.y);
    const yaw = Math.atan2(dx, dz);

    slot.group.position.set(midX, baseY + LIGHT_WALL_H * 0.5, midZ);
    slot.group.rotation.set(0, yaw, 0);
    slot.panelMesh.scale.set(1, 1, len + 0.18);
    slot.topRail.scale.set(1, 1, len + 0.2);
    slot.botRail.scale.set(1, 1, len + 0.2);
    slot.wallMat.opacity = 0.76;
    slot.railMat.opacity = 0.98;

    this.scene.add(slot.group);
    this.lightWallSegments.push({
      mesh: slot.group,
      wallMat: slot.wallMat,
      railMat: slot.railMat,
      midPos: slot.midPos.set(midX, baseY + LIGHT_WALL_H * 0.5, midZ),
      halfLen: len * 0.5 + 0.45,
      life: 4.5,
      maxLife: 4.5
    });
  },

  /**
   * Golpe da Espada Colossal de Plasma Ciano + Projétil Motosserra de Corrente [Mouse 1 / V]
   */
  performTurboChainWhip(playerPos, facingAngle, targetPoint = null) {
    soundFX.playPunchSwing();
    soundFX.playLaserShot();

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.45,
      playerPos.y + 1.28,
      playerPos.z + Math.cos(facingAngle) * 1.45
    );
    const dir = targetPoint
      ? targetPoint.clone().sub(origin).normalize()
      : new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle)).normalize();

    const projGroup = new THREE.Group();
    const crescentOuter = new THREE.Mesh(WHIP_CRESCENT_OUTER_GEO, WHIP_CYAN_MAT);
    crescentOuter.rotation.x = Math.PI / 2;
    crescentOuter.rotation.z = -Math.PI * 0.08;

    const crescentCore = new THREE.Mesh(WHIP_CRESCENT_CORE_GEO, WHIP_WHITE_HOT_MAT);
    crescentCore.rotation.x = Math.PI / 2;
    crescentCore.rotation.z = -Math.PI * 0.04;
    projGroup.add(crescentOuter, crescentCore);

    const sawRingGroup = new THREE.Group();
    const innerRing = new THREE.Mesh(WHIP_INNER_RING_GEO, WHIP_BRIGHT_CYAN_MAT);
    innerRing.rotation.x = Math.PI / 2;
    sawRingGroup.add(innerRing);

    for (let b = 0; b < 8; b++) {
      const ang = (b / 8) * Math.PI * 2;
      const tooth = new THREE.Mesh(
        WHIP_TOOTH_GEO,
        b % 2 === 0 ? WHIP_WHITE_HOT_MAT : WHIP_BRIGHT_CYAN_MAT
      );
      tooth.position.set(Math.cos(ang) * 1.55, 0, Math.sin(ang) * 1.55);
      tooth.rotation.x = Math.PI / 2;
      tooth.rotation.z = -ang - 0.35;
      sawRingGroup.add(tooth);
    }
    projGroup.add(sawRingGroup);
    projGroup.userData.spinRing = sawRingGroup;

    projGroup.position.copy(origin);
    projGroup.lookAt(origin.clone().add(dir));
    this.scene.add(projGroup);

    const turboNear = this.getObjectsNear(origin.x, origin.z, 11.5);
    for (let i = 0; i < turboNear.length; i++) {
      const obj = turboNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - origin.x, obj.basePos.z - origin.z);
      const dy = Math.abs(obj.basePos.y + obj.height * 0.5 - origin.y);
      if (d <= obj.radius + 7.2 && dy <= obj.height + 3.2) {
        this.damageObject(obj, 185, origin, false, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }

    this.projectiles.push({
      mesh: projGroup,
      type: 'turbo_plasma_slash',
      vel: dir.clone().multiplyScalar(82.0),
      life: 0.95,
      damage: 195,
      slashRadius: 3.8,
      hitObjects: new Set(),
      canBreakCrackedWall: true,
      canBreakSilver: true
    });
  }
};
