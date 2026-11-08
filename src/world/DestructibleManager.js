import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { optimizeStaticGroupMeshes, mergeBufferGeometries } from './BuildingGenerator.js';
import { soundFX } from '../audio/SoundFX.js';

export const STUD_TIERS = {
  silver: {
    tier: 'silver',
    value: 10,
    color: 0xe2e8f0,
    emissive: 0x64748b,
    emissiveIntensity: 0.2,
    metalness: 0.65,
    roughness: 0.18
  },
  gold: {
    tier: 'gold',
    value: 100,
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    metalness: 0.55,
    roughness: 0.16
  },
  blue: {
    tier: 'blue',
    value: 1000,
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.45,
    metalness: 0.35,
    roughness: 0.14
  },
  purple: {
    tier: 'purple',
    value: 10000,
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.55,
    metalness: 0.4,
    roughness: 0.12
  }
};

const STUD_BASE_GEO = new THREE.CylinderGeometry(0.28, 0.28, 0.11, 10);
const STUD_TOP_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10);
STUD_TOP_GEO.translate(0, 0.085, 0);
const STUD_COIN_GEO = mergeBufferGeometries([STUD_BASE_GEO.clone(), STUD_TOP_GEO.clone()]);

const DEBRIS_GEOS = [
  new THREE.BoxGeometry(0.55, 0.32, 0.55),
  new THREE.BoxGeometry(0.85, 0.28, 0.45),
  new THREE.BoxGeometry(0.42, 0.42, 0.42),
  new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12)
];

const WATER_DROP_GEO = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const BULLET_GEO = new THREE.CylinderGeometry(0.065, 0.065, 0.85, 8);
BULLET_GEO.rotateX(Math.PI / 2);

const FIREBALL_GEO = new THREE.SphereGeometry(0.34, 14, 14);
const TRAIL_CUBE_GEO = new THREE.BoxGeometry(0.24, 0.24, 0.24);

export class DestructibleManager {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;

    this.objects = [];
    this.debrisList = [];
    this.studsList = [];
    this.ambientStuds = [];
    this.geysers = [];
    this.projectiles = [];
    this.grenades = [];
    this.thrownCars = [];
    this.explosions = [];
    this.fxParticles = [];
    this.lightWallSegments = [];
    this._turboGhostBikeObj = null;

    this.magnetRadius = 5.2;
    this.collectRadius = 0.9;

    this.beamSoundCooldown = 0;
    this._initSolarBeamMesh();
  }

  _initSolarBeamMesh() {
    // 1. Feixe Principal de 3 Cilindros Concêntricos (Núcleo Branco + Manto Dourado + Aura Magma)
    this.solarBeamGroup = new THREE.Group();
    this.solarBeamGroup.visible = false;

    const coreGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 16);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.beamCore = new THREE.Mesh(coreGeo, coreMat);

    const mantleGeo = new THREE.CylinderGeometry(0.45, 0.45, 1, 18);
    mantleGeo.translate(0, 0.5, 0);
    mantleGeo.rotateX(Math.PI / 2);
    const mantleMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78
    });
    this.beamGlow = new THREE.Mesh(mantleGeo, mantleMat);

    const coronaGeo = new THREE.CylinderGeometry(0.72, 0.72, 1, 18);
    coronaGeo.translate(0, 0.5, 0);
    coronaGeo.rotateX(Math.PI / 2);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.44
    });
    this.beamCorona = new THREE.Mesh(coronaGeo, coronaMat);

    this.solarBeamGroup.add(this.beamCore, this.beamGlow, this.beamCorona);
    this.scene.add(this.solarBeamGroup);

    // 2. Orbe Concentrador Solar nas Mãos (Muzzle Sun Sphere + 2 Anéis Solares Giratórios)
    this.solarMuzzleGroup = new THREE.Group();
    this.solarMuzzleGroup.visible = false;
    const muzzleSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const muzzleOuter = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.72 })
    );
    this.muzzleRingA = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.055, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    this.muzzleRingB = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    this.muzzleRingB.rotation.x = Math.PI / 2;
    this.solarMuzzleGroup.add(muzzleSphere, muzzleOuter, this.muzzleRingA, this.muzzleRingB);
    this.scene.add(this.solarMuzzleGroup);

    // 3. 8 Anéis de Choque Solar (Beam Rings) que viajam da mão até o impacto
    this.solarBeamRings = [];
    const beamRingGeo = new THREE.TorusGeometry(0.62, 0.06, 8, 20);
    for (let i = 0; i < 8; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xfef08a : 0xf97316,
        transparent: true,
        opacity: 0.88
      });
      const ringMesh = new THREE.Mesh(beamRingGeo, ringMat);
      ringMesh.visible = false;
      this.scene.add(ringMesh);
      this.solarBeamRings.push(ringMesh);
    }

    // 4. Vórtice de Magma de 1.6m no Ponto de Impacto
    this.beamHitSphere = new THREE.Group();
    this.beamHitSphere.visible = false;

    const hitCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const hitDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.78 })
    );
    const vortexRingGeo = new THREE.TorusGeometry(1.6, 0.14, 10, 28);
    vortexRingGeo.rotateX(Math.PI / 2);
    this.beamVortexRing = new THREE.Mesh(
      vortexRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.92 })
    );
    this.beamVortexSpikes = new THREE.Group();
    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 1.35, 5),
        new THREE.MeshBasicMaterial({ color: s % 2 === 0 ? 0xfef08a : 0xef4444 })
      );
      spike.position.set(Math.cos(ang) * 1.15, 0.45, Math.sin(ang) * 1.15);
      spike.rotation.z = -Math.cos(ang) * 0.42;
      spike.rotation.x = Math.sin(ang) * 0.42;
      this.beamVortexSpikes.add(spike);
    }
    this.beamHitSphere.add(hitCore, hitDome, this.beamVortexRing, this.beamVortexSpikes);
    this.scene.add(this.beamHitSphere);

    // 5. Medidor 3D de Carga da Supernova [Q] no Chão embaixo do Solaris
    this._initSupernovaChargeMeter();
  }

  _initSupernovaChargeMeter() {
    this.supernovaChargeGroup = new THREE.Group();
    this.supernovaChargeGroup.visible = false;

    // 24 Segmentos de Progresso Circular ao redor dos pés do Solaris (0% -> 100%)
    this.chargeArcSegments = [];
    const segCount = 24;
    const segRadius = 1.95;
    const segGeo = new THREE.BoxGeometry(0.36, 0.16, 0.24);
    for (let i = 0; i < segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2;
      const segMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.95
      });
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.position.set(
        Math.sin(angle) * segRadius,
        0.12,
        Math.cos(angle) * segRadius
      );
      segMesh.rotation.y = angle;
      this.supernovaChargeGroup.add(segMesh);
      this.chargeArcSegments.push(segMesh);
    }

    // Runa Solar Giratória Interna nos pés do Solaris
    this.chargeInnerSunGroup = new THREE.Group();
    const innerRingGeo = new THREE.TorusGeometry(1.35, 0.08, 8, 28);
    innerRingGeo.rotateX(Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9
    });
    this.chargeInnerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.chargeInnerRing.position.y = 0.08;
    this.chargeInnerSunGroup.add(this.chargeInnerRing);

    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * Math.PI * 2;
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.85, 4),
        new THREE.MeshBasicMaterial({ color: r % 2 === 0 ? 0xfacc15 : 0xf97316 })
      );
      ray.rotation.x = Math.PI / 2;
      ray.rotation.z = -ang;
      ray.position.set(Math.sin(ang) * 0.95, 0.09, Math.cos(ang) * 0.95);
      this.chargeInnerSunGroup.add(ray);
    }
    this.supernovaChargeGroup.add(this.chargeInnerSunGroup);

    // Anel Expansivo de Alcance da Explosão no Chão (cresce em tempo real de 12m até 52m!)
    const rangeRingGeo = new THREE.TorusGeometry(1.0, 0.018, 10, 64);
    rangeRingGeo.rotateX(Math.PI / 2);
    this.chargeRangeRingMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.88
    });
    this.chargeRangeRing = new THREE.Mesh(rangeRingGeo, this.chargeRangeRingMat);
    this.chargeRangeRing.position.y = 0.14;
    this.supernovaChargeGroup.add(this.chargeRangeRing);

    const rangeSubRingGeo = new THREE.TorusGeometry(1.0, 0.01, 8, 48);
    rangeSubRingGeo.rotateX(Math.PI / 2);
    this.chargeSubRingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.65
    });
    this.chargeSubRing = new THREE.Mesh(rangeSubRingGeo, this.chargeSubRingMat);
    this.chargeSubRing.position.y = 0.12;
    this.supernovaChargeGroup.add(this.chargeSubRing);

    this.scene.add(this.supernovaChargeGroup);
  }

  registerDestructible({
    mesh,
    type,
    hp = 30,
    radius = 1.4,
    height = 2.0,
    colliders = [],
    debrisColors = [LEGO_COLORS.red, LEGO_COLORS.lightGrey],
    studDrops = { silver: 4, gold: 2, blue: 0, purple: 0 },
    groundY = 0.26,
    goldOnly = false,
    crackedWallOnly = false,
    silverOnly = false
  }) {
    const basePos = mesh.position.clone();
    const baseRot = mesh.rotation.clone();
    if (mesh && !mesh.userData?.isOptimizedGroup) {
      optimizeStaticGroupMeshes(mesh, []);
    }

    const item = {
      mesh,
      type,
      hp,
      maxHp: hp,
      radius,
      height,
      colliders,
      debrisColors,
      studDrops,
      groundY,
      goldOnly,
      crackedWallOnly,
      silverOnly,
      heatLevel: 0,
      basePos,
      baseRot,
      destroyed: false,
      shakeTimer: 0,
      respawnTimer: 0
    };

    this.objects.push(item);
    return item;
  }

  spawnAmbientStud(x, y, z, tierKey = 'gold') {
    const tierCfg = STUD_TIERS[tierKey] || STUD_TIERS.gold;
    const mesh = this._createStudMesh(tierCfg);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    const stud = {
      mesh,
      basePos: new THREE.Vector3(x, y, z),
      tier: tierCfg.tier,
      value: tierCfg.value,
      magnetized: false,
      collected: false
    };
    this.ambientStuds.push(stud);
    return stud;
  }

  rebuildAll() {
    for (const obj of this.objects) {
      if (obj.destroyed) {
        this._restoreObject(obj);
      } else {
        obj.hp = obj.maxHp;
        obj.heatLevel = 0;
      }
    }
    for (const s of this.ambientStuds) {
      s.collected = false;
      s.magnetized = false;
      s.mesh.visible = true;
      s.mesh.position.copy(s.basePos);
    }
    for (const g of this.geysers) {
      for (const drop of g.drops) {
        this.scene.remove(drop.mesh);
      }
    }
    this.geysers.length = 0;
  }

  _restoreObject(obj) {
    obj.destroyed = false;
    obj.hp = obj.maxHp;
    obj.heatLevel = 0;
    obj.shakeTimer = 0;
    obj.mesh.visible = true;
    obj.mesh.position.copy(obj.basePos);
    obj.mesh.rotation.copy(obj.baseRot);
    obj.mesh.scale.set(1, 1, 1);
    for (const col of obj.colliders) {
      col.disabled = false;
    }
  }

  /**
   * Calcula o ponto 3D exato que está na mira central (#crosshair) estilo Fortnite
   */
  getAimTargetPoint(camera, maxDist = 75) {
    const rayOrigin = camera.position.clone();
    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);

    let closestDist = maxDist;
    let hitObj = null;

    // 1. Verifica interseção do raio da mira central com a esfera/cilindro dos objetos quebráveis (ignorando o veículo atual do jogador!)
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;

      const objCenter = new THREE.Vector3(
        obj.basePos.x,
        obj.basePos.y + obj.height * 0.5,
        obj.basePos.z
      );
      const toCenter = objCenter.sub(rayOrigin);
      const t = toCenter.dot(rayDir);
      if (t < 1.5 || t > closestDist) continue;

      const closestPt = rayOrigin.clone().addScaledVector(rayDir, t);
      const dx = closestPt.x - obj.basePos.x;
      const dz = closestPt.z - obj.basePos.z;
      const dy = Math.abs(closestPt.y - (obj.basePos.y + obj.height * 0.5));

      if (Math.hypot(dx, dz) <= obj.radius * 0.95 && dy <= obj.height * 0.65) {
        closestDist = t;
        hitObj = obj;
      }
    }

    // 2. Se não bateu num objeto quebrável e o raio aponta para o chão, calcula o toque no asfalto
    if (!hitObj && rayDir.y < -0.02) {
      const groundT = -rayOrigin.y / rayDir.y;
      if (groundT > 2.0 && groundT < closestDist) {
        closestDist = groundT;
      }
    }

    const point = rayOrigin.addScaledVector(rayDir, closestDist);
    return { point, hitObj, distance: closestDist };
  }

  performMeleeAttack(playerPos, facingAngle, range = 2.7, damage = 20) {
    soundFX.playPunchSwing();

    const attackCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.35,
      playerPos.y + 1.0,
      playerPos.z + Math.cos(facingAngle) * 1.35
    );

    let hitAny = false;
    for (const obj of this.objects) {
      if (obj.destroyed) continue;

      const dx = obj.basePos.x - attackCenter.x;
      const dz = obj.basePos.z - attackCenter.z;
      const distHoriz = Math.hypot(dx, dz);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - attackCenter.y);

      if (distHoriz <= obj.radius + range * 0.55 && dy <= obj.height + 1.4) {
        this.damageObject(obj, damage, attackCenter, false);
        hitAny = true;
      }
    }

    return hitAny;
  }

  /**
   * Dispara projétil rápido do Fuzil Tático do Comandante Caveira
   */
  spawnRifleBullet(origin, targetPoint) {
    soundFX.playRifleShot();

    const dir = targetPoint.clone().sub(origin).normalize();
    const mat = getLegoMaterial(LEGO_COLORS.yellow, {
      emissive: 0xfef08a,
      emissiveIntensity: 1.8,
      roughness: 0.1
    });

    const mesh = new THREE.Mesh(BULLET_GEO, mat);
    mesh.position.copy(origin);
    mesh.lookAt(targetPoint);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      type: 'bullet',
      vel: dir.multiplyScalar(72),
      life: 1.2,
      damage: 14,
      isSolar: false
    });
  }

  /**
   * Dispara Bola de Fogo Explosiva do Solaris
   */
  spawnFireball(origin, targetPoint) {
    soundFX.playFireballCast();

    const dir = targetPoint.clone().sub(origin).normalize();
    const group = new THREE.Group();

    const coreMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 2.0
    });
    const core = new THREE.Mesh(FIREBALL_GEO, coreMat);
    group.add(core);

    group.position.copy(origin);
    this.scene.add(group);

    this.projectiles.push({
      mesh: group,
      type: 'fireball',
      vel: dir.multiplyScalar(42),
      life: 1.8,
      damage: 30,
      isSolar: true
    });
  }

  /**
   * Dispara projéteis exclusivos das Armas Veiculares (Metralhadora .50 CV, Canhão Plasma A.R.E.S. e Canhão do Tanque Titan-M1)
   */
  spawnVehicleProjectile(origin, targetPoint, weaponType) {
    const dir = targetPoint.clone().sub(origin).normalize();

    if (weaponType === 'smg' || weaponType === 'machinegun') {
      soundFX.playRifleShot();
      const tracerMat = getLegoMaterial(0xf97316, {
        emissive: 0xfef08a,
        emissiveIntensity: 2.4,
        roughness: 0.1
      });
      const mesh = new THREE.Mesh(BULLET_GEO, tracerMat);
      mesh.scale.set(1.8, 1.8, 2.4);
      mesh.position.copy(origin);
      mesh.lookAt(targetPoint);
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        type: 'bullet',
        vel: dir.multiplyScalar(88),
        life: 1.4,
        damage: weaponType === 'machinegun' ? 28 : 20,
        isSolar: false
      });
    } else if (weaponType === 'plasma_laser') {
      soundFX.playFireballCast();
      const plasmaGroup = new THREE.Group();
      const plasmaMat = getLegoMaterial(0x00f0ff, {
        emissive: 0xa855f7,
        emissiveIntensity: 2.8,
        roughness: 0.08
      });
      const bolt = new THREE.Mesh(BULLET_GEO, plasmaMat);
      bolt.scale.set(2.4, 2.4, 3.8);
      plasmaGroup.add(bolt);
      plasmaGroup.position.copy(origin);
      plasmaGroup.lookAt(targetPoint);
      this.scene.add(plasmaGroup);

      this.projectiles.push({
        mesh: plasmaGroup,
        type: 'fireball',
        vel: dir.multiplyScalar(76),
        life: 1.6,
        damage: 65,
        blastRadius: 4.8,
        isSolar: true
      });
    } else if (weaponType === 'tank_cannon') {
      soundFX.playExplosion(1.1);
      const shellGroup = new THREE.Group();
      const shellMat = getLegoMaterial(0xfacc15, {
        emissive: 0xef4444,
        emissiveIntensity: 2.5
      });
      const shell = new THREE.Mesh(FIREBALL_GEO, shellMat);
      shell.scale.setScalar(1.45);
      shellGroup.add(shell);
      shellGroup.position.copy(origin);
      this.scene.add(shellGroup);

      this.projectiles.push({
        mesh: shellGroup,
        type: 'fireball',
        vel: dir.multiplyScalar(68),
        life: 2.0,
        damage: 260,
        blastRadius: 9.5,
        isSupernovaBlast: true,
        isSolar: true,
        canBreakCrackedWall: true,
        canBreakSilver: true
      });
    }
  }

  // ============================================================================
  // HERÓI #3: TITÃ BLINDADO (PM ROBÔ MUTANTE GIGANTE — PMESP)
  // ============================================================================

  spawnTitaRotaryBullet(origin, targetPoint) {
    soundFX.playMinigunShot();
    const jitterTarget = targetPoint.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.42,
        (Math.random() - 0.5) * 0.32,
        (Math.random() - 0.5) * 0.42
      )
    );
    const dir = jitterTarget.clone().sub(origin).normalize();
    const mat = getLegoMaterial(0xfef2f2, {
      emissive: 0xef4444,
      emissiveIntensity: 2.6,
      roughness: 0.1
    });
    const mesh = new THREE.Mesh(BULLET_GEO, mat);
    mesh.scale.set(1.5, 1.5, 2.8);
    mesh.position.copy(origin);
    mesh.lookAt(jitterTarget);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      type: 'bullet',
      vel: dir.multiplyScalar(105),
      life: 1.25,
      damage: 22,
      isSolar: false
    });
  }

  /**
   * Investida / Dash Demolidor do Titã Blindado [Mouse 2 / V]:
   * Avança a jato sem cooldown, estoura Paredes Rachadas (cracked_wall) e arremessa carros!
   */
  triggerTitaRocketPunch(playerPos, facingAngle) {
    soundFX.playExplosion(1.05);
    const impactCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 2.8,
      playerPos.y + 1.45,
      playerPos.z + Math.cos(facingAngle) * 2.8
    );

    const ringGeo = new THREE.TorusGeometry(1, 0.16, 12, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(impactCenter);
    ringMesh.rotation.y = facingAngle;
    this.scene.add(ringMesh);

    const whiteRingGeo = new THREE.TorusGeometry(1, 0.1, 10, 28);
    const whiteRingMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.92
    });
    const whiteRingMesh = new THREE.Mesh(whiteRingGeo, whiteRingMat);
    whiteRingMesh.position.copy(impactCenter);
    whiteRingMesh.rotation.y = facingAngle;
    this.scene.add(whiteRingMesh);

    this.explosions.push({
      sphereMesh: null,
      ringMesh,
      extraMeshes: [whiteRingMesh],
      extraRings: [{ mesh: whiteRingMesh, speedMult: 1.32 }],
      maxRadius: 6.4,
      age: 0,
      duration: 0.28
    });

    for (let i = 0; i < 14; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0xf8fafc,
        transparent: true,
        opacity: 0.95
      });
      const pMesh = new THREE.Mesh(DEBRIS_STUD_GEO, pMat);
      pMesh.position.copy(impactCenter);
      this.scene.add(pMesh);
      const ang = facingAngle + (Math.random() - 0.5) * 1.4;
      const spd = 12 + Math.random() * 18;
      this.fxParticles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(
          Math.sin(ang) * spd,
          2 + Math.random() * 8,
          Math.cos(ang) * spd
        ),
        life: 0.28 + Math.random() * 0.18,
        maxLife: 0.45
      });
    }

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - impactCenter.x;
      const dz = obj.basePos.z - impactCenter.z;
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - impactCenter.y);
      if (Math.hypot(dx, dz) <= obj.radius + 5.4 && dy <= obj.height + 3.0) {
        this.damageObject(obj, 140, impactCenter, false, {
          canBreakCrackedWall: true,
          canBreakSilver: false
        });
      }
    }
  }

  /**
   * Pisada Sísmica no Chão [Q] e Impacto do Super-Pulo do Titã Blindado:
   * - SEM esfera central ("bola com rosquinha"): 100% onda de choque terrestre!
   * - Rachaduras radiais no asfalto + 20 Placas de Asfalto/Rocha 3D levantando do chão + 3 Anéis Sísmicos!
   */
  triggerTitaGroundSlam(centerPos, radius = 22.0, damage = 150, groundY = null) {
    soundFX.playSeismicStomp();
    const floorY = groundY !== null
      ? groundY
      : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(centerPos.x, centerPos.z) : centerPos.y);
    const slamCenter = new THREE.Vector3(centerPos.x, floorY + 0.12, centerPos.z);

    // Anel Sísmico Principal (Vermelho PMESP) colado no chão
    const ringGeo = new THREE.TorusGeometry(1, 0.18, 12, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.96
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(slamCenter);
    this.scene.add(ringMesh);

    const extraMeshes = [];
    const extraRings = [];

    // 2 Anéis Sísmicos Secundários no Chão (Branco Policial e Cinza Aço)
    const ringConfigs = [
      { color: 0xf8fafc, tube: 0.13, speedMult: 1.22, yOff: 0.08 },
      { color: 0x94a3b8, tube: 0.11, speedMult: 0.78, yOff: 0.05 }
    ];
    for (const rc of ringConfigs) {
      const rGeo = new THREE.TorusGeometry(1, rc.tube, 10, 44);
      rGeo.rotateX(Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: rc.color,
        transparent: true,
        opacity: 0.92
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(centerPos.x, floorY + rc.yOff, centerPos.z);
      this.scene.add(rMesh);
      extraMeshes.push(rMesh);
      extraRings.push({ mesh: rMesh, speedMult: rc.speedMult });
    }

    // 20 Placas de Asfalto / Rocha 3D e Cristais Sísmicos Vermelhos erguendo-se em círculo ao redor do pé do Titã
    const eruptionSpikes = [];
    const slabCount = 20;
    for (let i = 0; i < slabCount; i++) {
      const isOuter = i >= 10;
      const idxInRing = isOuter ? i - 10 : i;
      const angle = (idxInRing / 10) * Math.PI * 2 + (isOuter ? 0.31 : 0);
      const dist = isOuter ? radius * 0.68 : radius * 0.32;
      const slabH = (isOuter ? 3.4 : 2.5) + Math.random() * 1.4;
      const slabW = isOuter ? 1.55 : 1.15;

      const slabGeo = new THREE.BoxGeometry(slabW, slabH, 0.52);
      slabGeo.translate(0, slabH * 0.5, 0);
      const slabColor = i % 3 === 0 ? 0xef4444 : i % 2 === 0 ? 0x334155 : 0x475569;
      const slabMat = new THREE.MeshBasicMaterial({
        color: slabColor,
        transparent: true,
        opacity: 0.96
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(
        centerPos.x + Math.cos(angle) * dist,
        floorY,
        centerPos.z + Math.sin(angle) * dist
      );
      slabMesh.rotation.y = -angle + Math.PI * 0.5;
      slabMesh.rotation.x = -0.38; // Inclinado para fora como asfalto quebrado erguido pelo pisão!
      slabMesh.scale.set(1, 0.01, 1);
      this.scene.add(slabMesh);
      extraMeshes.push(slabMesh);
      eruptionSpikes.push({
        mesh: slabMesh,
        delay: isOuter ? 0.12 : 0.02
      });
    }

    // 8 Fendas / Rachaduras Radiais Luminosas no Chão
    for (let i = 0; i < 8; i++) {
      const crackAng = (i / 8) * Math.PI * 2;
      const crackLen = radius * 0.82;
      const crackGeo = new THREE.BoxGeometry(0.28, 0.08, crackLen);
      crackGeo.translate(0, 0.04, crackLen * 0.5);
      const crackMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0xf8fafc,
        transparent: true,
        opacity: 0.92
      });
      const crackMesh = new THREE.Mesh(crackGeo, crackMat);
      crackMesh.position.set(centerPos.x, floorY + 0.03, centerPos.z);
      crackMesh.rotation.y = crackAng;
      this.scene.add(crackMesh);
      extraMeshes.push(crackMesh);
      eruptionSpikes.push({
        mesh: crackMesh,
        delay: 0.0
      });
    }

    // 32 Estilhaços de Asfalto e Faíscas Vermelhas voando para o alto
    for (let i = 0; i < 32; i++) {
      const pColor = i % 3 === 0 ? 0xef4444 : i % 2 === 0 ? 0x334155 : 0xf8fafc;
      const pMat = new THREE.MeshBasicMaterial({
        color: pColor,
        transparent: true,
        opacity: 0.95
      });
      const pMesh = new THREE.Mesh(i % 2 === 0 ? DEBRIS_BRICK_GEO : DEBRIS_STUD_GEO, pMat);
      const ang = Math.random() * Math.PI * 2;
      const rOff = 1.0 + Math.random() * (radius * 0.55);
      pMesh.position.set(
        centerPos.x + Math.cos(ang) * rOff,
        floorY + 0.35,
        centerPos.z + Math.sin(ang) * rOff
      );
      pMesh.scale.setScalar(1.35);
      this.scene.add(pMesh);
      const spd = 8 + Math.random() * 22;
      this.fxParticles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(
          Math.cos(ang) * spd,
          9 + Math.random() * 18,
          Math.sin(ang) * spd
        ),
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8
      });
    }

    this.explosions.push({
      sphereMesh: null,
      ringMesh,
      extraMeshes,
      extraRings,
      eruptionSpikes,
      maxRadius: radius,
      age: 0,
      duration: 0.62
    });

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dHoriz = Math.hypot(obj.basePos.x - slamCenter.x, obj.basePos.z - slamCenter.z);
      const dVert = Math.abs(obj.basePos.y - floorY);
      if (dHoriz <= radius + obj.radius && dVert <= 7.5) {
        this.damageObject(obj, damage, slamCenter, false, {
          canBreakCrackedWall: true,
          canBreakSilver: false
        });
      }
    }
  }

  /**
   * Arremessa um carro agarrado pelo Titã Blindado na direção da mira, explodindo no impacto!
   */
  throwGrabbedCar(carObj, origin, targetPoint, worldColliders = []) {
    if (!carObj) return;
    soundFX.playPunchSwing();

    carObj.isGrabbed = false;
    carObj.mesh.position.copy(origin);
    const dir = targetPoint.clone().sub(origin).normalize();
    const speed = 42.0;
    const vel = dir.multiplyScalar(speed);
    if (dir.y > -0.2) vel.y += 4.5;

    this.thrownCars.push({
      carObj,
      vel,
      worldColliders,
      timer: 2.2
    });
  }

  // ============================================================================
  // HERÓI #4: VINGADOR DE CHUMBO (O JUSTICEIRO) — CASTIGADORAS .50, DOZE 18 BAGOS, BAZUCA ROCKET JUMP & FUROR [Q]
  // ============================================================================

  /**
   * Ejeta uma cápsula de munição dourada/vermelha 3D que gira no ar
   */
  _spawnEjectedBrassShell(origin, isShotgunShell = false) {
    const shellMat = new THREE.MeshBasicMaterial({
      color: isShotgunShell ? 0xdc2626 : 0xfacc15,
      transparent: true,
      opacity: 0.95
    });
    const shellMesh = new THREE.Mesh(TRAIL_CUBE_GEO, shellMat);
    shellMesh.position.copy(origin);
    shellMesh.scale.set(isShotgunShell ? 0.65 : 0.45, isShotgunShell ? 0.65 : 0.45, isShotgunShell ? 1.35 : 0.95);
    this.scene.add(shellMesh);

    this.fxParticles.push({
      mesh: shellMesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 5.5,
        3.2 + Math.random() * 3.5,
        (Math.random() - 0.5) * 5.5
      ),
      life: 0.55,
      maxLife: 0.55
    });
  }

  /**
   * Micro-explosão de impacto da Munição Calibre .50 Explosiva/Perfurante das "Castigadoras Gêmeas"
   */
  _triggerMicroImpactBlast(hitPos) {
    soundFX.playPlasticHit();
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.92
    });
    const flashSphere = new THREE.Mesh(FIREBALL_GEO, flashMat);
    flashSphere.position.copy(hitPos);
    flashSphere.scale.setScalar(1.85);
    this.scene.add(flashSphere);
    this.fxParticles.push({
      mesh: flashSphere,
      vel: new THREE.Vector3(0, 0.5, 0),
      life: 0.14,
      maxLife: 0.14
    });

    const sparkColors = [0xffffff, 0xfef08a, 0xf97316, 0xef4444];
    for (let i = 0; i < 8; i++) {
      const sMat = new THREE.MeshBasicMaterial({
        color: sparkColors[i % sparkColors.length],
        transparent: true,
        opacity: 0.95
      });
      const spark = new THREE.Mesh(TRAIL_CUBE_GEO, sMat);
      spark.position.copy(hitPos);
      spark.scale.setScalar(0.85);
      this.scene.add(spark);
      this.fxParticles.push({
        mesh: spark,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 14.0,
          2.5 + Math.random() * 8.5,
          (Math.random() - 0.5) * 14.0
        ),
        life: 0.24,
        maxLife: 0.24
      });
    }

    // Dano explosivo concentrado ao redor do ponto de impacto do calibre .50
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - hitPos.x, obj.basePos.z - hitPos.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - hitPos.y);
      if (d <= obj.radius + 2.4 && dy <= obj.height + 1.8) {
        this.damageObject(obj, 22, hitPos, false, { canBreakCrackedWall: true });
      }
    }
  }

  /**
   * ARMA 1 ("CASTIGADORAS GÊMEAS"): Dispara Munição Calibre .50 Explosiva/Perfurante Alternada (115 m/s)
   */
  spawnDualSmgBullets(leftOrigin, rightOrigin, targetPoint, recoilSide = 0) {
    soundFX.playRifleShot();
    soundFX.playExplosion(0.32);

    const coreMat = getLegoMaterial(0xffffff, {
      emissive: 0xfef08a,
      emissiveIntensity: 2.6,
      roughness: 0.08
    });
    const jacketMat = getLegoMaterial(0xff1e42, {
      emissive: 0xf97316,
      emissiveIntensity: 2.2,
      roughness: 0.12
    });

    const origins = recoilSide < 0 ? [leftOrigin] : recoilSide > 0 ? [rightOrigin] : [leftOrigin, rightOrigin];
    for (const orig of origins) {
      this._spawnEjectedBrassShell(orig, false);

      const spreadTarget = targetPoint.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.32, (Math.random() - 0.5) * 0.45)
      );
      const dir = spreadTarget.sub(orig).normalize();

      const bulletGroup = new THREE.Group();
      const coreMesh = new THREE.Mesh(BULLET_GEO, coreMat);
      coreMesh.scale.set(2.1, 2.1, 1.8);
      const auraMesh = new THREE.Mesh(BULLET_GEO, jacketMat);
      auraMesh.scale.set(2.9, 2.9, 1.4);
      bulletGroup.add(auraMesh, coreMesh);

      bulletGroup.position.copy(orig);
      bulletGroup.lookAt(orig.clone().add(dir));
      this.scene.add(bulletGroup);

      this.projectiles.push({
        mesh: bulletGroup,
        type: 'punisher_50cal',
        vel: dir.multiplyScalar(115.0),
        life: 0.95,
        damage: 36,
        isSolar: false,
        canBreakCrackedWall: true
      });
    }
  }

  /**
   * ARMA 2 (ESCOPETA DE TAMBOR "JUIZ FINAL"): Dispara 18 BAGOS INCENDIÁRIOS (Dragon's Breath) em cone denso!
   */
  spawnShotgunBlast(origin, targetPoint) {
    soundFX.playExplosion(0.92);
    soundFX.playRifleShot();
    this._spawnEjectedBrassShell(origin, true);

    const mainDir = targetPoint.clone().sub(origin).normalize();
    const pelletColors = [0xffffff, 0xfef08a, 0xf97316, 0xef4444];

    // Cortina de fumaça e fogo na boca do cano da Doze
    for (let s = 0; s < 10; s++) {
      const smokeMat = new THREE.MeshBasicMaterial({
        color: s < 5 ? 0xf97316 : 0x334155,
        transparent: true,
        opacity: 0.86
      });
      const puff = new THREE.Mesh(FIREBALL_GEO, smokeMat);
      puff.position.copy(origin).addScaledVector(mainDir, 0.5 + Math.random() * 0.8);
      puff.scale.setScalar(0.9 + Math.random() * 0.9);
      this.scene.add(puff);
      this.fxParticles.push({
        mesh: puff,
        vel: mainDir.clone().multiplyScalar(8 + Math.random() * 10).add(
          new THREE.Vector3((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 5)
        ),
        life: 0.28,
        maxLife: 0.28
      });
    }

    // 18 BAGOS INCENDIÁRIOS DE CALIBRE 12 (18 pellets) varrendo tudo à frente!
    for (let i = 0; i < 18; i++) {
      const pColor = pelletColors[i % pelletColors.length];
      const pelletMat = getLegoMaterial(pColor, {
        emissive: i % 2 === 0 ? 0xf97316 : 0xef4444,
        emissiveIntensity: 2.5
      });

      const spreadDir = mainDir.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.26,
          (Math.random() - 0.5) * 0.16,
          (Math.random() - 0.5) * 0.26
        )
      ).normalize();

      const mesh = new THREE.Mesh(BULLET_GEO, pelletMat);
      mesh.scale.set(1.85, 1.85, 1.5);
      mesh.position.copy(origin);
      mesh.lookAt(origin.clone().add(spreadDir));
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        type: 'shotgun_pellet',
        vel: spreadDir.multiplyScalar(74.0 + (Math.random() - 0.5) * 10.0),
        life: 0.46,
        damage: 22,
        isSolar: false,
        canBreakCrackedWall: true
      });
    }
  }

  /**
   * ARMA 3 (BAZUCA PESADA "ANIQUILADORA"): Dispara Foguete Rápido (85 m/s) que destrói LEGO Prateado e aplica ROCKET JUMP 4X!
   */
  spawnRpgRocket(origin, targetPoint, onExplode = null) {
    soundFX.playExplosion(1.05);
    const dir = targetPoint.clone().sub(origin).normalize();

    const rocketGroup = new THREE.Group();
    const bodyMat = getLegoMaterial(0x1e293b, { roughness: 0.25, metalness: 0.5 });
    const noseMat = getLegoMaterial(0xdc2626, { emissive: 0xef4444, emissiveIntensity: 1.8 });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 12), bodyMat);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.38, 12), noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.52;
    const jetCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 10), thrusterMat);
    jetCone.rotation.x = -Math.PI / 2;
    jetCone.position.z = -0.52;
    rocketGroup.add(body, nose, jetCone);

    rocketGroup.position.copy(origin);
    rocketGroup.lookAt(targetPoint);
    this.scene.add(rocketGroup);

    this.projectiles.push({
      mesh: rocketGroup,
      type: 'rpg_rocket',
      vel: dir.multiplyScalar(85.0),
      life: 2.2,
      damage: 210,
      blastRadius: 9.5,
      isSolar: false,
      canBreakSilver: true,
      canBreakCrackedWall: true,
      onExplode
    });
  }

  /**
   * HABILIDADE [Q] DO VINGADOR DE CHUMBO ("INVESTIDA IMPLACÁVEL + FUROR DO JUSTICEIRO"):
   * Dispara uma Onda de Choque de Calibre 12 em 360° nos pés dele que destrói obstáculos próximos e impulsiona o Dash!
   */
  spawnVingadorThrusterBlast(centerPos) {
    soundFX.playExplosion(1.1);
    soundFX.playTacticalRoll();

    const origin = new THREE.Vector3(centerPos.x, centerPos.y + 0.55, centerPos.z);

    // Anel de Choque de Calibre 12 ejetando cartuchos e chamas em 360°
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const isFire = i % 2 === 0;
      const pMat = new THREE.MeshBasicMaterial({
        color: isFire ? 0xf97316 : 0x1e293b,
        transparent: true,
        opacity: 0.92
      });
      const puff = new THREE.Mesh(isFire ? TRAIL_CUBE_GEO : FIREBALL_GEO, pMat);
      puff.position.set(
        origin.x + Math.cos(angle) * 0.7,
        origin.y,
        origin.z + Math.sin(angle) * 0.7
      );
      puff.scale.setScalar(isFire ? 1.65 : 1.35);
      this.scene.add(puff);

      this.fxParticles.push({
        mesh: puff,
        vel: new THREE.Vector3(
          Math.cos(angle) * (14.0 + Math.random() * 8.0),
          1.5 + Math.random() * 4.0,
          Math.sin(angle) * (14.0 + Math.random() * 8.0)
        ),
        life: 0.36,
        maxLife: 0.36
      });

      if (i % 2 === 0) {
        this._spawnEjectedBrassShell(origin, i % 4 === 0);
      }
    }

    // Destrói obstáculos próximos nos pés durante a largada da Investida!
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - origin.x, obj.basePos.z - origin.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - origin.y);
      if (d <= obj.radius + 6.8 && dy <= obj.height + 3.2) {
        this.damageObject(obj, 130, origin, false, { canBreakCrackedWall: true });
      }
    }
  }

  /**
   * Rastro de Fumaça Escura do Sobretudo + Cápsulas de Munição Douradas Ejetadas durante o "Furor do Justiceiro" [Q]
   */
  spawnVingadorShellAndSmokeTrail(pos) {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.35 ? 0xdc2626 : 0x111827,
      transparent: true,
      opacity: 0.84
    });
    const puff = new THREE.Mesh(TRAIL_CUBE_GEO, smokeMat);
    puff.position.set(
      pos.x + (Math.random() - 0.5) * 0.65,
      pos.y + 0.25 + Math.random() * 0.65,
      pos.z + (Math.random() - 0.5) * 0.65
    );
    puff.scale.setScalar(1.35);
    this.scene.add(puff);

    this.fxParticles.push({
      mesh: puff,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        1.2 + Math.random() * 2.2,
        (Math.random() - 0.5) * 2.2
      ),
      life: 0.34,
      maxLife: 0.34
    });

    if (Math.random() < 0.45) {
      this._spawnEjectedBrassShell(new THREE.Vector3(pos.x, pos.y + 1.1, pos.z), false);
    }
  }

  // ============================================================================
  // HERÓI #5: SOMBRA ESCARLATE (CYBER-SHINOBI MÍSTICO) — COMBO LUA DE SANGUE, FUMAÇA E PUXÃO
  // ============================================================================

  /**
   * Poder Místico das Katanas [Mouse 1 / V] — COMBO DE 3 CORTES DA LUA DE SANGUE:
   * - 1º Golpe: Fenda Diagonal Direita (+35°)
   * - 2º Golpe: Fenda Diagonal Esquerda (-35°)
   * - 3º Golpe: Corte Duplo Cruzado em X Gigante (Lua de Sangue)
   * Dispara um Projétil de Lâmina Crescente Espiritual Grande (3.6m de envergadura:
   * Núcleo Branco-Rosado + Lâmina Vermelho-Sangue + Sombra Negra Externa) que viaja
   * a 56 m/s por até 32m cortando e explodindo todos os objetos e veículos pelo caminho!
   */
  performKatanaSlash(playerPos, facingAngle, targetPoint = null) {
    soundFX.playPunchSwing();
    soundFX.playLaserShot();

    this._katanaComboIndex = ((this._katanaComboIndex || 0) + 1) % 3;
    const isCrossX = this._katanaComboIndex === 0;
    const rollAngles = isCrossX
      ? [0.61, -0.61]
      : [this._katanaComboIndex === 1 ? 0.61 : -0.61];

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.35,
      playerPos.y + 1.28,
      playerPos.z + Math.cos(facingAngle) * 1.35
    );

    const slashDir = targetPoint
      ? targetPoint.clone().sub(origin).normalize()
      : new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle)).normalize();

    const slashGroup = new THREE.Group();
    const crescentRadius = isCrossX ? 2.15 : 1.8;

    const buildCrescentArc = (rollAngle) => {
      const arcWrapper = new THREE.Group();

      // 1. Sombra Negra Externa (Aura Obsidiana)
      const shadowGeo = new THREE.TorusGeometry(crescentRadius * 1.04, 0.16, 8, 28, Math.PI * 1.15);
      shadowGeo.rotateX(Math.PI / 2);
      shadowGeo.rotateY(-Math.PI * 0.575);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x090a0d,
        transparent: true,
        opacity: 0.88
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.scale.set(1.0, 0.35, 1.35);
      arcWrapper.add(shadowMesh);

      // 2. Lâmina Crescente Principal Vermelho-Sangue (0xff1e42)
      const crimsonGeo = new THREE.TorusGeometry(crescentRadius, 0.12, 10, 28, Math.PI * 1.12);
      crimsonGeo.rotateX(Math.PI / 2);
      crimsonGeo.rotateY(-Math.PI * 0.56);
      const crimsonMat = new THREE.MeshBasicMaterial({
        color: 0xff1e42,
        transparent: true,
        opacity: 0.96
      });
      const crimsonMesh = new THREE.Mesh(crimsonGeo, crimsonMat);
      crimsonMesh.scale.set(1.0, 0.42, 1.28);
      arcWrapper.add(crimsonMesh);

      // 3. Núcleo Branco-Rosado Incandescente (0xfecaca)
      const coreGeo = new THREE.TorusGeometry(crescentRadius * 0.96, 0.065, 8, 26, Math.PI * 1.05);
      coreGeo.rotateX(Math.PI / 2);
      coreGeo.rotateY(-Math.PI * 0.525);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfecaca,
        transparent: true,
        opacity: 0.98
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.scale.set(1.0, 0.45, 1.22);
      arcWrapper.add(coreMesh);

      arcWrapper.rotation.z = rollAngle;
      return arcWrapper;
    };

    for (const ang of rollAngles) {
      slashGroup.add(buildCrescentArc(ang));
    }

    slashGroup.position.copy(origin);
    slashGroup.lookAt(origin.clone().add(slashDir));
    this.scene.add(slashGroup);

    // Pétalas e faíscas místicas escarlates/negras no momento do corte
    for (let i = 0; i < (isCrossX ? 18 : 10); i++) {
      const pColor = i % 3 === 0 ? 0x090a0d : i % 2 === 0 ? 0xff1e42 : 0xfecaca;
      const pMat = new THREE.MeshBasicMaterial({
        color: pColor,
        transparent: true,
        opacity: 0.94
      });
      const pMesh = new THREE.Mesh(TRAIL_CUBE_GEO, pMat);
      pMesh.position.copy(origin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 1.8,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.8
        )
      );
      pMesh.scale.set(1.4, 0.4, 2.2);
      this.scene.add(pMesh);
      this.fxParticles.push({
        mesh: pMesh,
        vel: slashDir.clone().multiplyScalar(18 + Math.random() * 16).add(
          new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8)
        ),
        life: 0.32 + Math.random() * 0.18,
        maxLife: 0.5
      });
    }

    // Dano imediato corpo a corpo + Projétil Perfuratriz de 56 m/s (alcance ~32m = 0.58s)
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - origin.x;
      const dz = obj.basePos.z - origin.z;
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - origin.y);
      if (Math.hypot(dx, dz) <= obj.radius + 3.4 && dy <= obj.height + 2.2) {
        this.damageObject(obj, isCrossX ? 120 : 75, origin, false, {
          canBreakCrackedWall: true
        });
      }
    }

    this.projectiles.push({
      mesh: slashGroup,
      type: 'katana_slash',
      vel: slashDir.clone().multiplyScalar(56.0),
      life: 0.58,
      damage: isCrossX ? 120 : 75,
      slashRadius: isCrossX ? 2.8 : 2.2,
      hitObjects: new Set(),
      canBreakCrackedWall: true
    });
  }

  /**
   * Cortina de Fumaça Negra Obsidiana & Chamas Escarlates da Bomba de Fumaça [Q] do Sombra Escarlate
   */
  spawnSmokeBombCloud(centerPos) {
    soundFX.playTacticalRoll();
    const colors = [0x090a0d, 0x18181b, 0x991b1b, 0xff1e42];
    for (let i = 0; i < 28; i++) {
      const c = colors[i % colors.length];
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.92
      });
      const puff = new THREE.Mesh(FIREBALL_GEO, mat);
      const angle = (i / 28) * Math.PI * 2;
      const r = 0.35 + Math.random() * 1.25;
      puff.position.set(
        centerPos.x + Math.cos(angle) * r,
        centerPos.y + 0.35 + Math.random() * 1.35,
        centerPos.z + Math.sin(angle) * r
      );
      puff.scale.setScalar(1.65 + Math.random() * 1.45);
      this.scene.add(puff);

      this.fxParticles.push({
        mesh: puff,
        vel: new THREE.Vector3(
          Math.cos(angle) * (3.5 + Math.random() * 4.5),
          2.2 + Math.random() * 3.5,
          Math.sin(angle) * (3.5 + Math.random() * 4.5)
        ),
        life: 0.85,
        maxLife: 0.85
      });
    }
  }

  /**
   * Rastro sutil de Sombras Obsidiana e Pétalas Escarlates nos pés do Sombra Escarlate na Corrida / Furtividade / Dive-Grapple
   */
  spawnSombraShadowStepTrail(pos, scaleMult = 1.0) {
    const colors = [0x090a0d, 0x18181b, 0xdc2626, 0xff1e42];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 0.86
    });
    const mesh = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.7,
      pos.y + 0.18 + Math.random() * 0.45,
      pos.z + (Math.random() - 0.5) * 0.7
    );
    mesh.scale.set(1.3 * scaleMult, 0.45 * scaleMult, 1.8 * scaleMult);
    this.scene.add(mesh);

    this.fxParticles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        1.2 + Math.random() * 2.4,
        (Math.random() - 0.5) * 2.4
      ),
      life: 0.32,
      maxLife: 0.32
    });
  }

  performMagneticPull(playerPos, aimData) {
    soundFX.playHeroSwap();
    const origin = playerPos.clone().add(new THREE.Vector3(0, 1.25, 0));
    const targetPt = aimData.point.clone();

    // Partículas magnéticas puxando da mira até o Sombra Escarlate
    for (let i = 0; i < 10; i++) {
      const u = i / 10;
      const pt = new THREE.Vector3().lerpVectors(targetPt, origin, u);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff1e42 : 0xa855f7,
        transparent: true,
        opacity: 0.92
      });
      const mesh = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
      mesh.position.copy(pt);
      this.scene.add(mesh);

      const pullVel = origin.clone().sub(pt).normalize().multiplyScalar(18.0);
      this.fxParticles.push({
        mesh,
        vel: pullVel,
        life: 0.32,
        maxLife: 0.32
      });
    }

    if (aimData.hitObj && !aimData.hitObj.destroyed) {
      this.damageObject(aimData.hitObj, 48, origin, false);
    }

    // Magnetiza todos os studs próximos em um raio amplo de 28m!
    for (const s of this.studsList) {
      if (s.mesh.position.distanceTo(origin) <= 28.0) {
        s.magnetized = true;
      }
    }
    for (const s of this.ambientStuds) {
      if (!s.collected && s.mesh.position.distanceTo(origin) <= 28.0) {
        s.magnetized = true;
      }
    }
  }

  // ============================================================================
  // HERÓI #6: TURBO FANTASMA (OP-06) — MOTO ENERGÉTICA CIANO, MURALHA DE LUZ & CORRENTES DE PLASMA
  // ============================================================================

  /**
   * Invoca ou materializa instantaneamente a Moto Energética Ciano ("INTERCEPTOR FANTASMA")
   * na posição exata do jogador para o Turbo Fantasma já sair pilotando!
   */
  summonTurboEnergyBike(pos, facingAngle) {
    soundFX.playHeroSwap();
    soundFX.playLaserShot();

    // Explosão de Portal de Plasma Ciano na invocação
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x22d3ee : 0xe0f2fe,
        transparent: true,
        opacity: 0.94
      });
      const spark = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
      spark.position.set(pos.x + Math.cos(ang) * 1.4, pos.y + 0.6, pos.z + Math.sin(ang) * 1.4);
      spark.scale.setScalar(1.4);
      this.scene.add(spark);
      this.fxParticles.push({
        mesh: spark,
        vel: new THREE.Vector3(Math.cos(ang) * 8.5, 4.5 + Math.random() * 4.5, Math.sin(ang) * 8.5),
        life: 0.45,
        maxLife: 0.45
      });
    }

    if (this._turboGhostBikeObj) {
      const bike = this._turboGhostBikeObj;
      bike.destroyed = false;
      bike.hp = bike.maxHp;
      bike.isGrabbed = false;
      bike.mesh.visible = true;
      bike.mesh.position.set(pos.x, pos.y, pos.z);
      bike.mesh.rotation.set(0, facingAngle, 0);
      bike.basePos.copy(bike.mesh.position);
      for (const col of bike.colliders) col.disabled = true;
      return bike;
    }

    // Constrói a Moto Energética Futurista Ciano 3D (Estilo Tron / Ghost Rider Ciano)
    const bikeGroup = new THREE.Group();
    bikeGroup.position.set(pos.x, pos.y, pos.z);
    bikeGroup.rotation.set(0, facingAngle, 0);

    const blackMat = getLegoMaterial(0x090a0d, { roughness: 0.2, clearcoat: 0.7 });
    const chromeMat = getLegoMaterial(0xe2e8f0, { metalness: 0.85, roughness: 0.14 });
    const cyanGlow = getLegoMaterial(0x22d3ee, {
      emissive: 0x06b6d4,
      emissiveIntensity: 2.5,
      roughness: 0.08
    });
    const whiteCyanGlow = getLegoMaterial(0xe0f2fe, {
      emissive: 0x38bdf8,
      emissiveIntensity: 2.8,
      roughness: 0.06
    });

    // Chassi aerodinâmico baixo e alongado
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.56, 2.65), blackMat);
    body.position.set(0, 0.62, 0);
    body.castShadow = true;
    bikeGroup.add(body);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.34, 1.32), cyanGlow);
    canopy.position.set(0, 0.92, 0.38);
    canopy.rotation.x = 0.22;
    bikeGroup.add(canopy);

    // Faixas laterais de neon ciano + Reator central
    for (const sx of [-0.45, 0.45]) {
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 2.48), whiteCyanGlow);
      neonStrip.position.set(sx, 0.64, 0);
      bikeGroup.add(neonStrip);
    }

    // Rodas de Luz Ciano Neon Gigantes (Dianteira e Traseira)
    for (const wz of [-1.05, 1.05]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.36, 24), blackMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(0, 0.52, wz);
      const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.065, 10, 24), cyanGlow);
      rimGlow.rotation.y = Math.PI / 2;
      rimGlow.position.set(0.19, 0.52, wz);
      const rimGlowL = rimGlow.clone();
      rimGlowL.position.x = -0.19;
      bikeGroup.add(tire, rimGlow, rimGlowL);
    }

    // Escapamentos Duplos de Plasma Traseiros
    for (const sx of [-0.26, 0.26]) {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.55, 12), chromeMat);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(sx, 0.72, -1.35);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 10), whiteCyanGlow);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(sx, 0.72, -1.78);
      bikeGroup.add(thruster, flame);
    }

    bikeGroup.userData.isDriveableCar = true;
    bikeGroup.userData.carName = 'MOTO FANTASMA CIANO';
    bikeGroup.userData.vehicleSpec = {
      category: 'car',
      maxSpeed: 54.0,
      turboMaxSpeed: 76.0,
      accel: 46.0,
      turnRate: 3.4,
      seatHeight: 0.55,
      cameraDist: 7.4,
      kmh: 280,
      isGhostBike: true
    };

    this.scene.add(bikeGroup);
    const bikeObj = this.registerDestructible({
      mesh: bikeGroup,
      type: 'car',
      hp: 260,
      radius: 1.6,
      height: 1.4,
      colliders: [],
      debrisColors: [0x090a0d, 0x22d3ee, 0xe0f2fe],
      studDrops: { silver: 4, gold: 4, blue: 2, purple: 0 },
      groundY: pos.y
    });
    this._turboGhostBikeObj = bikeObj;
    return bikeObj;
  }

  /**
   * Cria um segmento sólido da Muralha de Luz Ciano (Light Wall estilo Tron) atrás do Turbo Fantasma!
   * Qualquer veículo ou objeto quebrável que tocar na Muralha de Luz capota e explode instantaneamente!
   */
  spawnTurboLightWallSegment(fromPos, toPos) {
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.35 || len > 18.0) return;

    const midX = (fromPos.x + toPos.x) * 0.5;
    const midZ = (fromPos.z + toPos.z) * 0.5;
    const baseY = Math.min(fromPos.y, toPos.y);
    const wallH = 1.75;
    const yaw = Math.atan2(dx, dz);

    const wallGroup = new THREE.Group();
    wallGroup.position.set(midX, baseY + wallH * 0.5, midZ);
    wallGroup.rotation.y = yaw;

    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.72
    });
    const wallPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, wallH, len + 0.15), wallMat);
    wallGroup.add(wallPanel);

    const railMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.96
    });
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, len + 0.18), railMat);
    topRail.position.y = wallH * 0.5;
    const botRail = topRail.clone();
    botRail.position.y = -wallH * 0.5 + 0.08;
    wallGroup.add(topRail, botRail);

    this.scene.add(wallGroup);
    this.lightWallSegments.push({
      mesh: wallGroup,
      wallMat,
      railMat,
      midPos: new THREE.Vector3(midX, baseY + wallH * 0.5, midZ),
      halfLen: len * 0.5 + 0.4,
      life: 3.8,
      maxLife: 3.8
    });
  }

  /**
   * Açoite de Correntes Giratórias de Plasma Ciano [Mouse 1 / V] do Turbo Fantasma:
   * Chicoteia correntes incandescentes em arco frontal amplo + lança lâmina giratória de corrente (32m)!
   */
  performTurboChainWhip(playerPos, facingAngle, targetPoint = null) {
    soundFX.playPunchSwing();
    soundFX.playLaserShot();

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.35,
      playerPos.y + 1.25,
      playerPos.z + Math.cos(facingAngle) * 1.35
    );
    const dir = targetPoint
      ? targetPoint.clone().sub(origin).normalize()
      : new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle)).normalize();

    const whipGroup = new THREE.Group();
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.98 });

    const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.11, 8, 28), cyanMat);
    ringOuter.rotation.x = Math.PI / 2;
    const ringInner = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 24), whiteMat);
    ringInner.rotation.x = Math.PI / 2;
    whipGroup.add(ringOuter, ringInner);

    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2;
      const hook = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 4), whiteMat);
      hook.position.set(Math.cos(ang) * 2.2, 0, Math.sin(ang) * 2.2);
      hook.rotation.x = Math.PI / 2;
      hook.rotation.z = -ang;
      whipGroup.add(hook);
    }

    whipGroup.position.copy(origin);
    this.scene.add(whipGroup);

    // Dano imediato em arco largo de 6.5m ao redor do chicote de correntes
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - origin.x, obj.basePos.z - origin.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - origin.y);
      if (d <= obj.radius + 5.8 && dy <= obj.height + 2.6) {
        this.damageObject(obj, 95, origin, false, { canBreakCrackedWall: true });
      }
    }

    this.projectiles.push({
      mesh: whipGroup,
      type: 'katana_slash',
      vel: dir.clone().multiplyScalar(54.0),
      life: 0.62,
      damage: 90,
      slashRadius: 2.6,
      hitObjects: new Set(),
      canBreakCrackedWall: true
    });
  }

  // ============================================================================
  // HERÓI #7: VOLTAICO (OP-07) — CORRENTE DE RAIOS (CHAIN LIGHTNING), TELEPORTE & PULSO EMP
  // ============================================================================

  /**
   * Desenha um Raio Elétrico 3D Quebrado (Zig-Zag) entre 2 pontos no espaço!
   */
  _spawnJaggedLightningBolt(startPt, endPt, radius = 0.09, duration = 0.24, isSkyBolt = false) {
    const dist = startPt.distanceTo(endPt);
    const segments = Math.max(4, Math.min(14, Math.ceil(dist / 2.6)));
    const boltGroup = new THREE.Group();

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: isSkyBolt ? 0x38bdf8 : 0x22d3ee,
      transparent: true,
      opacity: 0.85
    });

    const pts = [startPt.clone()];
    for (let i = 1; i < segments; i++) {
      const u = i / segments;
      const p = new THREE.Vector3().lerpVectors(startPt, endPt, u);
      const jitter = isSkyBolt ? 1.45 : 0.75;
      p.x += (Math.random() - 0.5) * jitter;
      p.y += (Math.random() - 0.5) * jitter * 0.7;
      p.z += (Math.random() - 0.5) * jitter;
      pts.push(p);
    }
    pts.push(endPt.clone());

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const segLen = Math.max(0.05, a.distanceTo(b));
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

      const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, segLen, 6), i % 2 === 0 ? coreMat : glowMat);
      segMesh.position.copy(mid);
      segMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      boltGroup.add(segMesh);
    }

    this.scene.add(boltGroup);
    this.fxParticles.push({
      mesh: boltGroup,
      vel: new THREE.Vector3(0, 0, 0),
      life: duration,
      maxLife: duration
    });
  }

  /**
   * Dispara Corrente de Raios (Chain Lightning) [Mouse 1] do Voltaico:
   * Atinge o alvo mirado e salta automaticamente em cadeia para até 6 objetos/veículos/geradores próximos!
   */
  fireChainLightning(origin, targetPoint) {
    soundFX.playLaserShot();

    const visited = new Set();
    let currentPt = origin.clone();

    // 1º Salto: do Cetro Tesla até o ponto/objeto mirado
    let firstTargetObj = null;
    let bestDist = 8.5;
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const objCenter = new THREE.Vector3(obj.basePos.x, obj.basePos.y + obj.height * 0.5, obj.basePos.z);
      const d = objCenter.distanceTo(targetPoint);
      if (d < bestDist + obj.radius) {
        bestDist = d;
        firstTargetObj = obj;
      }
    }

    const firstPt = firstTargetObj
      ? new THREE.Vector3(firstTargetObj.basePos.x, firstTargetObj.basePos.y + firstTargetObj.height * 0.5, firstTargetObj.basePos.z)
      : targetPoint.clone();

    this._spawnJaggedLightningBolt(currentPt, firstPt, 0.11, 0.26, false);
    this._triggerMicroImpactBlast(firstPt);

    if (firstTargetObj) {
      visited.add(firstTargetObj);
      this.damageObject(firstTargetObj, 75, currentPt, true, {
        canBreakCrackedWall: true,
        canBreakSilver: true
      });
    }
    currentPt = firstPt;

    // Saltos em Cadeia (Chain Lightning — até 5 saltos extras em raio de 18m cada!)
    for (let bounce = 0; bounce < 5; bounce++) {
      let nextObj = null;
      let minDist = 18.0;
      for (const obj of this.objects) {
        if (obj.destroyed || obj.isDriven || visited.has(obj)) continue;
        const d = Math.hypot(obj.basePos.x - currentPt.x, obj.basePos.z - currentPt.z);
        if (d < minDist) {
          minDist = d;
          nextObj = obj;
        }
      }
      if (!nextObj) break;

      visited.add(nextObj);
      const nextPt = new THREE.Vector3(
        nextObj.basePos.x,
        nextObj.basePos.y + nextObj.height * 0.5,
        nextObj.basePos.z
      );
      this._spawnJaggedLightningBolt(currentPt, nextPt, 0.085, 0.28, false);
      this.damageObject(nextObj, 65, currentPt, true, {
        canBreakCrackedWall: true,
        canBreakSilver: true
      });
      currentPt = nextPt;
    }
  }

  /**
   * Teleporte Elétrico (Lightning Blink) [Mouse 2 / F] do Voltaico:
   * Derruba um Raio Gigante do Céu na saída e outro no destino, causando choque elétrico na chegada!
   */
  spawnLightningTeleportStrike(fromPos, toPos) {
    soundFX.playExplosion(0.55);
    soundFX.playLaserShot();

    const skyFrom = new THREE.Vector3(fromPos.x, fromPos.y + 42.0, fromPos.z);
    const skyTo = new THREE.Vector3(toPos.x, toPos.y + 42.0, toPos.z);
    this._spawnJaggedLightningBolt(skyFrom, fromPos, 0.24, 0.34, true);
    this._spawnJaggedLightningBolt(skyTo, toPos, 0.28, 0.38, true);
    this._spawnJaggedLightningBolt(
      new THREE.Vector3(fromPos.x, fromPos.y + 1.2, fromPos.z),
      new THREE.Vector3(toPos.x, toPos.y + 1.2, toPos.z),
      0.14,
      0.3,
      false
    );

    // Choque elétrico de chegada (9m de raio)
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - toPos.x, obj.basePos.z - toPos.z);
      if (d <= obj.radius + 9.0 && Math.abs(obj.basePos.y - toPos.y) <= 6.5) {
        this.damageObject(obj, 90, toPos, true, { canBreakCrackedWall: true });
      }
    }
  }

  /**
   * Super Pulso EMP & Tempestade de Trovões [Q] do Voltaico (Raio 28m):
   * Expande um domo eletromagnético azul-ciano e derruba 10 raios do céu ao redor!
   */
  triggerVoltaicoEmpPulse(centerPos, radius = 28.0) {
    soundFX.playExplosion(1.3);
    soundFX.playLaserShot();

    const center = new THREE.Vector3(centerPos.x, centerPos.y + 1.1, centerPos.z);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.92
    });
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), domeMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.08, 10, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    this.explosions.push({
      sphereMesh,
      ringMesh,
      innerCoreMesh: null,
      extraMeshes: [],
      extraRings: [],
      eruptionSpikes: [],
      isSupernova: true,
      maxRadius: radius,
      age: 0,
      duration: 0.65
    });

    // Derruba 10 Raios Gigantes do Céu em círculo ao redor do Voltaico
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const dist = 6.0 + (i % 3) * 6.5;
      const strikePt = new THREE.Vector3(
        centerPos.x + Math.cos(ang) * dist,
        centerPos.y,
        centerPos.z + Math.sin(ang) * dist
      );
      const skyPt = new THREE.Vector3(strikePt.x, strikePt.y + 46.0, strikePt.z);
      this._spawnJaggedLightningBolt(skyPt, strikePt, 0.22, 0.45, true);
    }

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - centerPos.x, obj.basePos.z - centerPos.z);
      if (d <= radius + obj.radius && Math.abs(obj.basePos.y - centerPos.y) <= 14.0) {
        this.damageObject(obj, 165, center, true, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
  }

  // ============================================================================
  // HERÓI #8: VÓRTEX (OP-08 — COLOSSO SIMBIONTE) — TENTÁCULOS, LAÇO ABISSAL & ERUPÇÃO [Q]
  // ============================================================================

  /**
   * Explosão de Biomassa Simbionte Negra/Roxa ao alternar com [F] entre Forma Ágil e Forma Big-Fig Monstruosa!
   */
  spawnSymbioteMorphBurst(centerPos, toMonster = true) {
    soundFX.playHeroSwap();
    soundFX.playExplosion(toMonster ? 0.75 : 0.45);

    const colors = [0x090a0d, 0x581c87, 0x9333ea, 0xa855f7];
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.94
      });
      const blob = new THREE.Mesh(FIREBALL_GEO, mat);
      blob.position.set(centerPos.x, centerPos.y + 1.2, centerPos.z);
      blob.scale.setScalar(toMonster ? 1.55 : 1.15);
      this.scene.add(blob);
      this.fxParticles.push({
        mesh: blob,
        vel: new THREE.Vector3(
          Math.cos(ang) * (7.5 + Math.random() * 6.5),
          2.5 + Math.random() * 5.5,
          Math.sin(ang) * (7.5 + Math.random() * 6.5)
        ),
        life: 0.42,
        maxLife: 0.42
      });
    }
  }

  /**
   * Devastação de Tentáculos Simbiontes [Mouse 1 / V] do Vórtex:
   * Lança 4 tentáculos colossais negros/roxos para frente estraçalhando veículos e Paredes Rachadas!
   */
  performVortexTentacleStrike(playerPos, facingAngle, isMonsterForm = false) {
    soundFX.playPunchSwing();
    soundFX.playExplosion(isMonsterForm ? 0.65 : 0.38);

    const reach = isMonsterForm ? 16.5 : 11.5;
    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.2,
      playerPos.y + (isMonsterForm ? 2.1 : 1.3),
      playerPos.z + Math.cos(facingAngle) * 1.2
    );

    // Cria 4 Lanças/Tentáculos Simbiontes 3D disparando em leque frontal
    for (let t = -1.5; t <= 1.5; t += 1.0) {
      const spreadYaw = facingAngle + t * 0.22;
      const tipPt = new THREE.Vector3(
        origin.x + Math.sin(spreadYaw) * reach,
        playerPos.y + 0.6,
        origin.z + Math.cos(spreadYaw) * reach
      );
      const midPt = new THREE.Vector3().addVectors(origin, tipPt).multiplyScalar(0.5);
      const len = origin.distanceTo(tipPt);

      const tentMat = new THREE.MeshBasicMaterial({
        color: Math.abs(t) < 1 ? 0x090a0d : 0x9333ea,
        transparent: true,
        opacity: 0.95
      });
      const tentMesh = new THREE.Mesh(
        new THREE.ConeGeometry(isMonsterForm ? 0.46 : 0.3, len, 8),
        tentMat
      );
      tentMesh.position.copy(midPt);
      tentMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tipPt.clone().sub(origin).normalize()
      );
      this.scene.add(tentMesh);
      this.fxParticles.push({
        mesh: tentMesh,
        vel: new THREE.Vector3(0, 0.5, 0),
        life: 0.26,
        maxLife: 0.26
      });
    }

    // Dano em cone/área frontal destruindo carros e Paredes Rachadas!
    const strikeCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * (reach * 0.55),
      playerPos.y + 1.2,
      playerPos.z + Math.cos(facingAngle) * (reach * 0.55)
    );
    const hitRadius = isMonsterForm ? 10.5 : 7.2;
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - strikeCenter.x, obj.basePos.z - strikeCenter.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - strikeCenter.y);
      if (d <= obj.radius + hitRadius && dy <= obj.height + 4.5) {
        this.damageObject(obj, isMonsterForm ? 160 : 95, origin, false, {
          canBreakCrackedWall: true,
          canBreakSilver: isMonsterForm
        });
      }
    }
  }

  /**
   * Laço Abissal Simbionte [Mouse 2 / G] do Vórtex:
   * - Se houver um Helicóptero, Avião ou Veículo próximo da linha de mira (até 85m), lança um Tentáculo Gigante,
   *   agarra o veículo e o PUXA VIOLENTAMENTE PARA O CHÃO na frente do Vórtex, explodindo no impacto!
   * - Caso contrário, retorna o ponto de ancoragem para puxar o próprio Vórtex em um salto simbionte!
   */
  performAbyssalLasso(playerPos, facingAngle, camera, worldColliders = []) {
    soundFX.playPunchSwing();

    const origin = new THREE.Vector3(playerPos.x, playerPos.y + 1.6, playerPos.z);
    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);

    // 1. Procura veículo aéreo ou terrestre próximo à linha de mira (até 85m) para puxar e esmagar no chão!
    let bestVehicle = null;
    let bestScore = Infinity;
    for (const obj of this.objects) {
      if (obj.destroyed || obj.type !== 'car' || obj.isDriven) continue;
      const vPos = obj.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const toVec = vPos.clone().sub(origin);
      const dist = toVec.length();
      if (dist < 3.0 || dist > 85.0) continue;
      const forwardDot = toVec.clone().normalize().dot(rayDir);
      if (forwardDot < 0.72) continue;
      const perpDist = dist * Math.sqrt(Math.max(0, 1 - forwardDot * forwardDot));
      if (perpDist <= (obj.radius || 3.0) + 5.5 && dist < bestScore) {
        bestScore = dist;
        bestVehicle = obj;
      }
    }

    const drawSymbioteTendril = (targetPt) => {
      const dist = origin.distanceTo(targetPt);
      const mid = new THREE.Vector3().addVectors(origin, targetPt).multiplyScalar(0.5);
      const tendrilMat = new THREE.MeshBasicMaterial({
        color: 0x9333ea,
        transparent: true,
        opacity: 0.95
      });
      const tendrilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, dist, 8), tendrilMat);
      tendrilMesh.position.copy(mid);
      tendrilMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        targetPt.clone().sub(origin).normalize()
      );
      this.scene.add(tendrilMesh);
      this.fxParticles.push({
        mesh: tendrilMesh,
        vel: new THREE.Vector3(0, 0, 0),
        life: 0.32,
        maxLife: 0.32
      });
    };

    if (bestVehicle) {
      const vehPos = bestVehicle.mesh.position.clone();
      drawSymbioteTendril(vehPos);

      // Puxa o helicóptero/veículo violentamente em direção ao chão na frente do Vórtex!
      const slamPoint = new THREE.Vector3(
        playerPos.x + Math.sin(facingAngle) * 7.5,
        playerPos.y + 0.2,
        playerPos.z + Math.cos(facingAngle) * 7.5
      );
      this.throwGrabbedCar(bestVehicle, vehPos, slamPoint, worldColliders);
      return { pulledVehicle: bestVehicle, pullPoint: null };
    }

    // Fallback: puxa o próprio Vórtex até o ponto mirado!
    const aimData = this.getAimTargetPoint(camera, 68);
    drawSymbioteTendril(aimData.point);
    return { pulledVehicle: null, pullPoint: aimData.point };
  }

  /**
   * Erupção Abissal de Tentáculos e Espinhos [Q] do Vórtex (Raio 24m):
   * Faz brotar 24 espinhos e tentáculos negros/roxos gigantes do asfalto em 360°!
   */
  triggerVortexAbyssalEruption(centerPos, radius = 24.0, groundY = 0) {
    soundFX.playExplosion(1.35);

    const floorY = groundY ?? centerPos.y;
    const center = new THREE.Vector3(centerPos.x, floorY + 1.0, centerPos.z);

    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x581c87,
      transparent: true,
      opacity: 0.72
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.94
    });

    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), sphereMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.08, 10, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    const extraMeshes = [];
    const eruptionSpikes = [];
    const spikeColors = [0x090a0d, 0x581c87, 0x9333ea, 0xa855f7];

    for (let s = 0; s < 22; s++) {
      const ang = (s / 22) * Math.PI * 2;
      const dist = (0.3 + (s % 3) * 0.28) * radius;
      const h = 6.5 + (s % 4) * 2.5;
      const sMat = new THREE.MeshBasicMaterial({
        color: spikeColors[s % spikeColors.length],
        transparent: true,
        opacity: 0.96
      });
      const sGeo = new THREE.ConeGeometry(0.75, h, 6);
      sGeo.translate(0, h * 0.5, 0);
      const sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.position.set(centerPos.x + Math.cos(ang) * dist, floorY, centerPos.z + Math.sin(ang) * dist);
      sMesh.rotation.z = -Math.cos(ang) * 0.28;
      sMesh.rotation.x = Math.sin(ang) * 0.28;
      sMesh.scale.set(1, 0.05, 1);
      this.scene.add(sMesh);
      extraMeshes.push(sMesh);
      eruptionSpikes.push({ mesh: sMesh, delay: (s % 3) * 0.08 });
    }

    this.explosions.push({
      sphereMesh,
      ringMesh,
      innerCoreMesh: null,
      extraMeshes,
      extraRings: [],
      eruptionSpikes,
      isSupernova: true,
      maxRadius: radius,
      age: 0,
      duration: 0.78
    });

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - centerPos.x, obj.basePos.z - centerPos.z);
      if (d <= radius + obj.radius && Math.abs(obj.basePos.y - floorY) <= 12.0) {
        this.damageObject(obj, 175, center, false, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
  }

  /**
   * Arremessa Granada Explosiva / Carga de Impulso Tático (Estilo Satchel da Raze) do Comandante Caveira:
   * Vai na direção exata da mira, suporta detonação manual imediata no ar [Mouse 2] e explode ao tocar qualquer superfície!
   */
  throwGrenade(origin, targetPoint, worldColliders = [], onExplode = null, getTerrainHeightAt = null) {
    soundFX.playPunchSwing();

    const nadeGroup = new THREE.Group();
    const bodyMat = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.45 });
    const strapMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.2, metalness: 0.6 });
    const topLedMat = getLegoMaterial(LEGO_COLORS.orange, {
      emissive: 0xf97316,
      emissiveIntensity: 2.4
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.44), bodyMat);
    body.castShadow = true;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.12), strapMat);
    const topStud = new THREE.Mesh(SHARED_STUD_GEO, topLedMat);
    topStud.position.y = 0.14;
    nadeGroup.add(body, strap, topStud);

    nadeGroup.position.copy(origin);
    this.scene.add(nadeGroup);

    const dir = targetPoint.clone().sub(origin).normalize();
    const dist = origin.distanceTo(targetPoint);
    const speed = 36.0;
    const vel = dir.multiplyScalar(speed);
    if (dist > 6.0 && dir.y > -0.25) {
      vel.y += Math.min(4.5, dist * 0.14);
    }

    this.grenades.push({
      mesh: nadeGroup,
      vel,
      worldColliders,
      onExplode,
      getTerrainHeightAt,
      age: 0,
      timer: 1.5
    });
  }

  /**
   * Detona manualmente no ar a Carga Explosiva (Satchel) mais recente do Comandante Caveira ao apertar Mouse 2 novamente!
   */
  detonateActiveCaveiraGrenade() {
    if (!this.grenades || this.grenades.length === 0) return false;
    const g = this.grenades.pop();
    const blastPos = g.mesh.position.clone();
    this._triggerExplosion(blastPos, 8.2, 85, true, false);
    if (typeof g.onExplode === 'function') {
      g.onExplode(blastPos);
    }
    this.scene.remove(g.mesh);
    return true;
  }

  /**
   * Gera rastro de fumaça cinza-escura + faíscas laranjas/douradas nas botas do Caveira durante o Blast Jump!
   */
  spawnCaveiraBlastJumpTrail(pos) {
    const colors = [0x1e293b, 0x334155, 0xf97316, 0xfacc15];
    for (let i = 0; i < 2; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.55,
        pos.y + 0.18 + Math.random() * 0.35,
        pos.z + (Math.random() - 0.5) * 0.55
      );
      mesh.scale.setScalar(1.15);
      this.scene.add(mesh);

      this.fxParticles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 2.6,
          0.8 + Math.random() * 2.2,
          (Math.random() - 0.5) * 2.6
        ),
        life: 0.34,
        maxLife: 0.34
      });
    }
  }

  /**
   * Atualiza o Feixe Solar Imperial Pesado (Mouse 2 do Solaris — derrete objetos de Ouro LEGO e queima alvos)
   * Inclui Orbe Concentrador Solar nas mãos, 3 Cilindros Concêntricos, 8 Anéis de Choque viajando pelo feixe e Vórtice de Magma no impacto!
   */
  updateSolarBeam(isActive, handOrigin, aimData, dt) {
    if (!isActive) {
      this.solarBeamGroup.visible = false;
      this.beamHitSphere.visible = false;
      if (this.solarMuzzleGroup) this.solarMuzzleGroup.visible = false;
      if (this.solarBeamRings) {
        for (const r of this.solarBeamRings) r.visible = false;
      }
      return;
    }

    this.solarBeamGroup.visible = true;
    this.beamHitSphere.visible = true;
    if (this.solarMuzzleGroup) this.solarMuzzleGroup.visible = true;

    const targetPt = aimData.point;
    const dist = Math.max(0.5, handOrigin.distanceTo(targetPt));
    const nowSec = performance.now() * 0.001;

    this.solarBeamGroup.position.copy(handOrigin);
    this.solarBeamGroup.lookAt(targetPt);
    const pulse = 0.92 + Math.sin(nowSec * 36.0) * 0.22;
    this.solarBeamGroup.scale.set(pulse, pulse, dist);

    // Orbe Concentrador Solar nas mãos com 2 anéis dourados giratórios
    if (this.solarMuzzleGroup) {
      this.solarMuzzleGroup.position.copy(handOrigin);
      this.solarMuzzleGroup.lookAt(targetPt);
      const muzzleScale = 0.9 + Math.sin(nowSec * 42.0) * 0.18;
      this.solarMuzzleGroup.scale.setScalar(muzzleScale);
      if (this.muzzleRingA) {
        this.muzzleRingA.rotation.z += dt * 12.0;
        this.muzzleRingA.rotation.x = Math.sin(nowSec * 8.0) * 0.45;
      }
      if (this.muzzleRingB) {
        this.muzzleRingB.rotation.y += dt * 15.0;
        this.muzzleRingB.rotation.z += dt * 9.0;
      }
    }

    // 8 Anéis de Choque Solar (Beam Rings) viajando rapidamente da mão até o ponto de impacto
    if (this.solarBeamRings && this.solarBeamRings.length > 0) {
      const ringCount = this.solarBeamRings.length;
      for (let i = 0; i < ringCount; i++) {
        const ring = this.solarBeamRings[i];
        ring.visible = true;
        const u = ((nowSec * 3.8 + i / ringCount) % 1.0);
        ring.position.lerpVectors(handOrigin, targetPt, u);
        ring.lookAt(targetPt);
        ring.rotation.z = nowSec * 10.0 + i * 0.8;
        const s = 0.65 + Math.sin(u * Math.PI) * 0.75;
        ring.scale.setScalar(s);
        ring.material.opacity = (1.0 - u * 0.55) * 0.92;
      }
    }

    // Vórtice de Magma de 1.6m girando no ponto de impacto
    this.beamHitSphere.position.copy(targetPt);
    const hitScale = 0.92 + Math.sin(nowSec * 38.0) * 0.24;
    this.beamHitSphere.scale.setScalar(hitScale);
    if (this.beamVortexRing) {
      this.beamVortexRing.rotation.z += dt * 10.0;
    }
    if (this.beamVortexSpikes) {
      this.beamVortexSpikes.rotation.y -= dt * 14.0;
    }

    // Rugido termonuclear grave contínuo
    this.beamSoundCooldown -= dt;
    if (this.beamSoundCooldown <= 0) {
      this.beamSoundCooldown = 0.085;
      soundFX.playSolarBeamTick();
    }

    // Solta faíscas solares intensas no ponto de impacto
    if (Math.random() < 0.82) {
      this.spawnFlameTrailParticle(targetPt, 1.25);
    }

    // Aplica dano solar contínuo pesado (derrete objetos de Ouro LEGO rapidamente!)
    const beamDps = 62;
    if (aimData.hitObj && !aimData.hitObj.destroyed) {
      this.damageObject(aimData.hitObj, beamDps * dt, targetPt, true);
    } else {
      for (const obj of this.objects) {
        if (obj.destroyed) continue;
        const dHoriz = Math.hypot(obj.basePos.x - targetPt.x, obj.basePos.z - targetPt.z);
        const dVert = Math.abs((obj.basePos.y + obj.height * 0.5) - targetPt.y);
        if (dHoriz <= obj.radius + 1.15 && dVert <= obj.height * 0.75 + 0.9) {
          this.damageObject(obj, beamDps * dt, targetPt, true);
        }
      }
    }
  }

  /**
   * Atualiza o Medidor 3D de Força & Alcance da Supernova [Q] no chão embaixo dos pés do Solaris
   */
  updateSupernovaChargeVisual(isActive, playerPos, chargeRatio = 0, currentRadius = 12, dt = 0.016, groundY = null) {
    if (!this.supernovaChargeGroup) return;
    if (!isActive) {
      this.supernovaChargeGroup.visible = false;
      return;
    }

    this.supernovaChargeGroup.visible = true;
    const clamped = THREE.MathUtils.clamp(chargeRatio, 0, 1);
    const floorY = groundY !== null ? groundY : playerPos.y;
    this.supernovaChargeGroup.position.set(playerPos.x, floorY + 0.05, playerPos.z);

    // Cor progressiva da carga: Amarelo (0-35%) -> Laranja (35-75%) -> Vermelho Magma (75-97%) -> Branco-Ouro Piscante (100%)
    const isMax = clamped >= 0.98;
    const flashWhite = isMax && Math.sin(performance.now() * 0.045) > 0;
    const activeColorHex = flashWhite
      ? 0xffffff
      : clamped >= 0.75
        ? 0xef4444
        : clamped >= 0.35
          ? 0xf97316
          : 0xfacc15;

    const totalSegs = this.chargeArcSegments.length;
    const litCount = Math.max(1, Math.ceil(clamped * totalSegs));
    for (let i = 0; i < totalSegs; i++) {
      const seg = this.chargeArcSegments[i];
      if (i < litCount) {
        seg.material.color.setHex(activeColorHex);
        seg.material.opacity = 0.96;
        const pop = i === litCount - 1 ? 1.45 : 1.0 + clamped * 0.35;
        seg.scale.set(1.0, pop, 1.0 + clamped * 0.3);
      } else {
        seg.material.color.setHex(0x451a03);
        seg.material.opacity = 0.35;
        seg.scale.set(0.85, 0.55, 0.85);
      }
    }

    // Runa Solar Giratória Interna acelerando com a carga
    if (this.chargeInnerSunGroup) {
      this.chargeInnerSunGroup.rotation.y += dt * (2.5 + clamped * 14.0);
      const innerScale = 0.95 + clamped * 0.55;
      this.chargeInnerSunGroup.scale.set(innerScale, 1.0, innerScale);
    }

    // Anel Expansivo de Alcance Real no Chão (12m -> 52m!)
    if (this.chargeRangeRing) {
      this.chargeRangeRing.scale.set(currentRadius, currentRadius, 1.0);
      this.chargeRangeRingMat.color.setHex(activeColorHex);
      this.chargeRangeRingMat.opacity = 0.75 + Math.sin(performance.now() * 0.025) * 0.2;
    }
    if (this.chargeSubRing) {
      const subR = currentRadius * (0.55 + (performance.now() * 0.0015 % 0.45));
      this.chargeSubRing.scale.set(subR, subR, 1.0);
      this.chargeSubRingMat.color.setHex(flashWhite ? 0xffffff : 0xfef08a);
    }

    // Solta fagulhas solares ascendentes na borda do medidor durante o carregamento
    if (Math.random() < 0.45 + clamped * 0.5) {
      const ang = Math.random() * Math.PI * 2;
      const r = 1.6 + Math.random() * (1.5 + clamped * 4.5);
      this.spawnFlameTrailParticle(
        new THREE.Vector3(
          playerPos.x + Math.cos(ang) * r,
          floorY + 0.25,
          playerPos.z + Math.sin(ang) * r
        ),
        0.95 + clamped * 0.9
      );
    }
  }

  /**
   * Poder Especial [Q] SUPERNOVA CARREGÁVEL do Solaris:
   * - Tap rápido [Q] (chargeRatio ~ 0): Raio 12m, Dano 110
   * - Carga Máxima [Q] (chargeRatio = 1.0): Explosão Colossal de Raio 52m e Dano 350!
   */
  triggerSupernova(centerPos, chargeRatio = 0, groundY = null) {
    if (this.supernovaChargeGroup) {
      this.supernovaChargeGroup.visible = false;
    }
    const clampedCharge = THREE.MathUtils.clamp(chargeRatio, 0, 1);
    const blastRadius = THREE.MathUtils.lerp(12.0, 52.0, clampedCharge);
    const blastDamage = THREE.MathUtils.lerp(110.0, 350.0, clampedCharge);

    const origin = centerPos.clone();
    origin.y += 1.1;
    const floorY = groundY !== null ? groundY : centerPos.y;

    this._triggerExplosion(origin, blastRadius, blastDamage, false, true, {
      canBreakCrackedWall: true,
      canBreakSilver: clampedCharge >= 0.35,
      chargeRatio: clampedCharge,
      groundY: floorY
    });
  }

  /**
   * Cria uma explosão 3D em área (Granada, Bola de Fogo, Bazuca RPG ou Supernova Multi-Camadas)
   */
  _triggerExplosion(center, radius, maxDamage, isFlashbang = false, isSupernova = false, damageOpts = {}) {
    const chargeRatio = damageOpts.chargeRatio ?? 0;
    soundFX.playExplosion(isSupernova ? 1.5 + chargeRatio * 1.1 : isFlashbang ? 1.25 : 0.9);

    const sphereColor = isFlashbang ? 0xfef9c3 : 0xf97316;
    const sphereMat = new THREE.MeshBasicMaterial({
      color: sphereColor,
      transparent: true,
      opacity: 0.88
    });
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 22), sphereMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, isSupernova ? 0.08 : 0.12, 12, 40);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.94
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    const extraMeshes = [];
    const extraRings = [];
    const eruptionSpikes = [];
    let innerCoreMesh = null;

    // SUPERNOVA MULTI-CAMADAS CINEMATOGRÁFICA DO SOLARIS:
    // 1) Núcleo Duplo de Plasma (Branco-Solar interno + Domo Magma externo)
    // 2) 3 Ondas de Choque Concêntricas + 2 Anéis Solares Cruzados em X
    // 3) Coroa de 12 a 24 Pilares/Lanças de Erupção Solar brotando do chão
    // 4) 60+ Meteoros de Fogo LEGO 3D voando em todas as direções!
    if (isSupernova) {
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.96
      });
      innerCoreMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), innerMat);
      innerCoreMesh.position.copy(center);
      this.scene.add(innerCoreMesh);
      extraMeshes.push(innerCoreMesh);

      const ringConfigs = [
        { color: 0xf97316, speedMult: 1.18, tiltX: 0, tiltZ: 0 },
        { color: 0xef4444, speedMult: 0.76, tiltX: 0, tiltZ: 0 },
        { color: 0xfef08a, speedMult: 1.02, tiltX: 0.42, tiltZ: 0.35 },
        { color: 0xfacc15, speedMult: 1.02, tiltX: -0.42, tiltZ: -0.35 }
      ];
      for (const rc of ringConfigs) {
        const rGeo = new THREE.TorusGeometry(1, 0.055, 10, 36);
        rGeo.rotateX(Math.PI / 2);
        const rMat = new THREE.MeshBasicMaterial({
          color: rc.color,
          transparent: true,
          opacity: 0.9
        });
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.position.copy(center);
        rMesh.rotation.x = rc.tiltX;
        rMesh.rotation.z = rc.tiltZ;
        this.scene.add(rMesh);
        extraMeshes.push(rMesh);
        extraRings.push({ mesh: rMesh, speedMult: rc.speedMult });
      }

      // Coroa de 12 a 24 Pilares/Lanças de Erupção Solar 3D brotando do chão em círculos concêntricos!
      const spikeCount = Math.round(12 + chargeRatio * 12);
      const floorY = damageOpts.groundY ?? Math.max(0, center.y - 1.1);
      const spikeColors = [0xffffff, 0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
      for (let s = 0; s < spikeCount; s++) {
        const isOuterRing = s >= spikeCount * 0.45;
        const ringRatio = isOuterRing ? 0.68 : 0.34;
        const angle = (s / (isOuterRing ? Math.ceil(spikeCount * 0.55) : Math.floor(spikeCount * 0.45))) * Math.PI * 2 + (isOuterRing ? 0.25 : 0);
        const distFromCenter = radius * ringRatio * (0.85 + (s % 3) * 0.08);
        const maxSpikeH = (4.5 + chargeRatio * 11.5) * (isOuterRing ? 0.85 : 1.15);
        const spikeR = (0.55 + chargeRatio * 1.1) * (isOuterRing ? 0.9 : 1.1);

        const spikeMat = new THREE.MeshBasicMaterial({
          color: spikeColors[s % spikeColors.length],
          transparent: true,
          opacity: 0.94
        });
        const spikeGeo = new THREE.ConeGeometry(spikeR, maxSpikeH, 5);
        spikeGeo.translate(0, maxSpikeH * 0.5, 0);
        const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
        spikeMesh.position.set(
          center.x + Math.cos(angle) * distFromCenter,
          floorY,
          center.z + Math.sin(angle) * distFromCenter
        );
        // Inclina levemente as lanças de magma para fora a partir do epicentro
        spikeMesh.rotation.z = -Math.cos(angle) * 0.22;
        spikeMesh.rotation.x = Math.sin(angle) * 0.22;
        spikeMesh.scale.set(1, 0.05, 1);
        this.scene.add(spikeMesh);
        extraMeshes.push(spikeMesh);
        eruptionSpikes.push({
          mesh: spikeMesh,
          delay: isOuterRing ? 0.12 : 0.0
        });
      }

      // 60+ Meteoros e Fagulhas de Fogo LEGO 3D voando para fora
      const meteorCount = Math.round(36 + chargeRatio * 34);
      for (let m = 0; m < meteorCount; m++) {
        const ang = (m / meteorCount) * Math.PI * 2 + Math.random() * 0.2;
        const elev = 0.15 + Math.random() * 0.85;
        const speed = (16 + Math.random() * 26) * (0.65 + chargeRatio * 0.85);
        const mColor = spikeColors[m % spikeColors.length];
        const mMat = new THREE.MeshBasicMaterial({
          color: mColor,
          transparent: true,
          opacity: 0.95
        });
        const mMesh = new THREE.Mesh(TRAIL_CUBE_GEO, mMat);
        mMesh.position.copy(center);
        mMesh.scale.setScalar(1.3 + chargeRatio * 1.6);
        this.scene.add(mMesh);

        const life = 0.55 + Math.random() * 0.45;
        this.fxParticles.push({
          mesh: mMesh,
          vel: new THREE.Vector3(
            Math.cos(ang) * Math.cos(elev) * speed,
            Math.sin(elev) * speed * 0.85,
            Math.sin(ang) * Math.cos(elev) * speed
          ),
          life,
          maxLife: life
        });
      }
    }

    this.explosions.push({
      sphereMesh,
      ringMesh,
      innerCoreMesh,
      extraMeshes,
      extraRings,
      eruptionSpikes,
      isSupernova,
      maxRadius: radius,
      age: 0,
      duration: isSupernova ? 0.72 + chargeRatio * 0.38 : 0.36
    });

    // Causa dano em todos os objetos quebráveis dentro do raio (exceto o próprio veículo que o jogador está dirigindo!)
    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven || obj.isGrabbed) continue;
      const objPos = new THREE.Vector3(
        obj.basePos.x,
        obj.basePos.y + obj.height * 0.5,
        obj.basePos.z
      );
      const dist = objPos.distanceTo(center);
      if (dist <= radius + obj.radius) {
        this.damageObject(obj, maxDamage, center, isSupernova, damageOpts);
      }
    }
  }

  /**
   * Cria partícula de rastro de chamas (Voo de Cometa / Feixe Solar)
   */
  spawnFlameTrailParticle(pos, scale = 1.0) {
    const colors = [0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.45,
      pos.y + (Math.random() - 0.5) * 0.45,
      pos.z + (Math.random() - 0.5) * 0.45
    );
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);

    this.fxParticles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        1.5 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2.4
      ),
      life: 0.38,
      maxLife: 0.38
    });
  }

  /**
   * Efeito visual ao trocar de herói (inclusive no meio do ar!)
   */
  spawnHeroSwapEffect(pos, colorHex = 0xfacc15) {
    soundFX.playHeroSwap();
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
      mesh.position.set(
        pos.x + Math.cos(angle) * 0.6,
        pos.y + 1.0,
        pos.z + Math.sin(angle) * 0.6
      );
      this.scene.add(mesh);

      this.fxParticles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * 4.5,
          2.2 + Math.random() * 2.5,
          Math.sin(angle) * 4.5
        ),
        life: 0.42,
        maxLife: 0.42
      });
    }
  }

  damageObject(obj, amount, hitOrigin = null, isSolar = false, damageOpts = {}) {
    if (obj.destroyed) return;

    // Objetos de Ouro LEGO só derretem com o Raio Solar Contínuo ou Supernova do Solaris!
    if (obj.goldOnly && !isSolar) {
      obj.shakeTimer = 0.12;
      soundFX.playMetalRicochet();
      return;
    }

    // Paredes Rachadas só quebram com Soco Foguete / Terremoto / Carro Arremessado do Titã Blindado ou RPG!
    if (obj.crackedWallOnly && !damageOpts.canBreakCrackedWall && !isSolar) {
      obj.shakeTimer = 0.12;
      soundFX.playMetalRicochet();
      return;
    }

    // Objetos Prateados Brilhantes só explodem com a Bazuca RPG do Vingador de Chumbo ou Carro Arremessado!
    if (obj.silverOnly && !damageOpts.canBreakSilver && !isSolar) {
      obj.shakeTimer = 0.12;
      soundFX.playMetalRicochet();
      return;
    }

    obj.hp -= amount;
    obj.shakeTimer = 0.2;

    if (obj.hp > 0) {
      if (amount >= 5) {
        soundFX.playPlasticHit();
        this._spawnDebris(obj, 2, 0.6);
      }
    } else {
      this._shatterObject(obj, hitOrigin);
    }
  }

  _shatterObject(obj) {
    obj.destroyed = true;
    obj.isGrabbed = false;
    obj.respawnTimer = 28.0;
    obj.mesh.visible = false;

    for (const col of obj.colliders) {
      col.disabled = true;
    }

    const isBig =
      obj.type === 'car' ||
      obj.type === 'newsstand' ||
      obj.type === 'gold_vault' ||
      obj.type === 'cracked_wall' ||
      obj.type === 'silver_lego' ||
      obj.type === 'gas_pump' ||
      obj.type === 'bank_vault_door';
    soundFX.playLegoBreak(isBig);

    const pieceCount =
      obj.type === 'car' || obj.type === 'bank_vault_door' || obj.type === 'cracked_wall' ? 24 :
      obj.type === 'gold_vault' || obj.type === 'silver_lego' || obj.type === 'gas_pump' ? 20 :
      obj.type === 'newsstand' ? 18 :
      obj.type === 'streetlamp' ? 14 : 11;
    const upwardBoost = obj.type === 'car' || obj.type === 'gas_pump' ? 1.65 : isBig ? 1.25 : 0.95;
    this._spawnDebris(obj, pieceCount, upwardBoost);

    this._spawnStudShower(obj);

    if (obj.type === 'hydrant') {
      this._createWaterGeyser(obj.basePos.clone(), obj.groundY);
    } else if (obj.type === 'gas_pump' || obj.type === 'fuel_truck' || obj.type === 'explosive_barrel') {
      // Bombas do Posto e Caminhões-Tanque explodem em reação em cadeia e jogam carros pro alto!
      const blastCenter = obj.basePos.clone();
      blastCenter.y += 1.0;
      this._triggerExplosion(blastCenter, 36.0, 110, false, true);
    }
  }

  _spawnDebris(obj, count, scaleFactor = 1.0) {
    const center = obj.basePos.clone();
    center.y += Math.min(1.2, obj.height * 0.45);

    for (let i = 0; i < count; i++) {
      const colorHex = obj.debrisColors[i % obj.debrisColors.length];
      const mat = getLegoMaterial(colorHex, { roughness: 0.22, clearcoat: 0.45 });
      const geo = DEBRIS_GEOS[i % DEBRIS_GEOS.length];

      const pieceGroup = new THREE.Group();
      const body = new THREE.Mesh(geo, mat);
      body.castShadow = true;
      pieceGroup.add(body);

      if (i % 4 !== 3) {
        const stud = new THREE.Mesh(SHARED_STUD_GEO, mat);
        stud.position.y = 0.16;
        pieceGroup.add(stud);
      }

      const angle = Math.random() * Math.PI * 2;
      const horizSpeed = (2.2 + Math.random() * 5.8) * scaleFactor;

      pieceGroup.position.set(
        center.x + (Math.random() - 0.5) * obj.radius * 0.8,
        center.y + Math.random() * 0.6,
        center.z + (Math.random() - 0.5) * obj.radius * 0.8
      );

      this.scene.add(pieceGroup);

      this.debrisList.push({
        mesh: pieceGroup,
        vel: new THREE.Vector3(
          Math.cos(angle) * horizSpeed,
          4.2 + Math.random() * 6.5 * scaleFactor,
          Math.sin(angle) * horizSpeed
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14
        ),
        groundY: obj.groundY + 0.16,
        life: 3.2 + Math.random() * 1.4,
        maxLife: 4.6
      });
    }
  }

  _spawnStudShower(obj) {
    const drops = obj.studDrops;
    const tiersToSpawn = [];

    for (const [tierKey, count] of Object.entries(drops)) {
      for (let i = 0; i < count; i++) {
        tiersToSpawn.push(STUD_TIERS[tierKey] || STUD_TIERS.silver);
      }
    }

    const origin = obj.basePos.clone();
    origin.y += 0.65;

    tiersToSpawn.forEach((tierCfg, idx) => {
      const studGroup = this._createStudMesh(tierCfg);
      const angle = (idx / Math.max(1, tiersToSpawn.length)) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const speed = 2.0 + Math.random() * 4.4;

      studGroup.position.set(
        origin.x + Math.cos(angle) * 0.35,
        origin.y + Math.random() * 0.4,
        origin.z + Math.sin(angle) * 0.35
      );

      this.scene.add(studGroup);

      this.studsList.push({
        mesh: studGroup,
        tier: tierCfg.tier,
        value: tierCfg.value,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          5.5 + Math.random() * 4.2,
          Math.sin(angle) * speed
        ),
        groundY: obj.groundY + 0.14,
        age: 0,
        magnetized: false
      });
    });
  }

  _createStudMesh(tierCfg) {
    const mat = getLegoMaterial(tierCfg.color, {
      roughness: tierCfg.roughness,
      metalness: tierCfg.metalness,
      clearcoat: 0.65,
      emissive: tierCfg.emissive,
      emissiveIntensity: tierCfg.emissiveIntensity
    });

    const coinMesh = new THREE.Mesh(STUD_COIN_GEO, mat);
    coinMesh.rotation.z = 0.22;
    return coinMesh;
  }

  _createWaterGeyser(position, groundY) {
    const waterMat = getLegoMaterial(0x38bdf8, {
      roughness: 0.1,
      clearcoat: 0.8,
      transparent: true,
      opacity: 0.82,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25
    });
    const foamMat = getLegoMaterial(0xf8fafc, { roughness: 0.2 });

    const drops = [];
    const dropCount = 26;

    for (let i = 0; i < dropCount; i++) {
      const mesh = new THREE.Mesh(WATER_DROP_GEO, i % 3 === 0 ? foamMat : waterMat);
      this._resetGeyserDrop(mesh, position, groundY);
      this.scene.add(mesh);
      drops.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.8,
          6.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 1.8
        )
      });
    }

    this.geysers.push({
      origin: position,
      groundY,
      timer: 14.0,
      drops
    });
  }

  _resetGeyserDrop(mesh, origin, groundY) {
    mesh.position.set(
      origin.x + (Math.random() - 0.5) * 0.25,
      groundY + 0.2,
      origin.z + (Math.random() - 0.5) * 0.25
    );
  }

  update(dt, playerPosition) {
    // 1. Tremor e respawn de objetos quebráveis
    for (const obj of this.objects) {
      if (obj.destroyed) {
        obj.respawnTimer -= dt;
        if (obj.respawnTimer <= 0) {
          this._restoreObject(obj);
        }
        continue;
      }

      if (obj.isDriven || obj.isGrabbed) {
        obj.mesh.visible = true;
        continue;
      }

      if (playerPosition) {
        const dx = obj.basePos.x - playerPosition.x;
        const dz = obj.basePos.z - playerPosition.z;
        const distSq = dx * dx + dz * dz;
        const maxCullSq = obj.type === 'car' ? 680 * 680 : 420 * 420;
        const shouldBeVisible = distSq <= maxCullSq;
        if (obj.mesh.visible !== shouldBeVisible) {
          obj.mesh.visible = shouldBeVisible;
        }
        if (!shouldBeVisible) continue;
      }

      if (obj.shakeTimer > 0) {
        obj.shakeTimer -= dt;
        if (obj.shakeTimer <= 0) {
          obj.shakeTimer = 0;
          obj.mesh.position.copy(obj.basePos);
          obj.mesh.rotation.copy(obj.baseRot);
        } else {
          const intensity = obj.shakeTimer * 0.45;
          obj.mesh.position.x = obj.basePos.x + (Math.random() - 0.5) * intensity;
          obj.mesh.position.z = obj.basePos.z + (Math.random() - 0.5) * intensity;
          obj.mesh.rotation.z = (Math.random() - 0.5) * intensity * 0.5;
        }
      }
    }

    // 2. Projéteis (Fuzil Tático, Bolas de Fogo do Solaris & Lâminas Crescentes da Lua de Sangue do Sombra)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      if (p.type === 'katana_slash') {
        if (Math.random() < 0.85) {
          this.spawnSombraShadowStepTrail(p.mesh.position, 1.4);
        }
        const slashR = p.slashRadius ?? 2.2;
        for (const obj of this.objects) {
          if (obj.destroyed || obj.isDriven || (p.hitObjects && p.hitObjects.has(obj))) continue;
          const dx = p.mesh.position.x - obj.basePos.x;
          const dz = p.mesh.position.z - obj.basePos.z;
          const dy = p.mesh.position.y - (obj.basePos.y + obj.height * 0.5);
          if (Math.hypot(dx, dz) <= obj.radius + slashR && Math.abs(dy) <= obj.height * 0.75 + 1.4) {
            if (p.hitObjects) p.hitObjects.add(obj);
            this.damageObject(obj, p.damage, p.mesh.position, false, {
              canBreakCrackedWall: Boolean(p.canBreakCrackedWall)
            });
          }
        }
        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      if ((p.type === 'fireball' || p.type === 'rpg_rocket') && Math.random() < 0.78) {
        this.spawnFlameTrailParticle(p.mesh.position, p.type === 'rpg_rocket' ? 1.1 : 0.7);
      } else if (p.type === 'shotgun_pellet' && Math.random() < 0.35) {
        this.spawnFlameTrailParticle(p.mesh.position, 0.55);
      }

      let hit = false;
      for (const obj of this.objects) {
        if (obj.destroyed || obj.isDriven) continue;
        const dx = p.mesh.position.x - obj.basePos.x;
        const dz = p.mesh.position.z - obj.basePos.z;
        const dy = p.mesh.position.y - (obj.basePos.y + obj.height * 0.5);

        if (Math.hypot(dx, dz) <= obj.radius + 0.45 && Math.abs(dy) <= obj.height * 0.65 + 0.5) {
          if (p.type === 'fireball' || p.type === 'rpg_rocket') {
            const blastPos = p.mesh.position.clone();
            this._triggerExplosion(
              blastPos,
              p.blastRadius ?? 4.2,
              p.damage,
              false,
              Boolean(p.isSupernovaBlast),
              {
                canBreakSilver: Boolean(p.canBreakSilver),
                canBreakCrackedWall: Boolean(p.canBreakCrackedWall)
              }
            );
            if (typeof p.onExplode === 'function') {
              p.onExplode(blastPos);
            }
          } else if (p.type === 'punisher_50cal') {
            this.damageObject(obj, p.damage, p.mesh.position, false, {
              canBreakCrackedWall: true
            });
            this._triggerMicroImpactBlast(p.mesh.position.clone());
          } else {
            this.damageObject(obj, p.damage, p.mesh.position, p.isSolar, {
              canBreakSilver: Boolean(p.canBreakSilver),
              canBreakCrackedWall: Boolean(p.canBreakCrackedWall)
            });
          }
          hit = true;
          break;
        }
      }

      // Colisão contra prédios/muros (world.colliders) para Bazuca RPG e Calibre .50 (permite Rocket Jump em paredes!)
      if (!hit && (p.type === 'rpg_rocket' || p.type === 'punisher_50cal') && this.world?.colliders) {
        const px = p.mesh.position.x;
        const py = p.mesh.position.y;
        const pz = p.mesh.position.z;
        for (const col of this.world.colliders) {
          if (col.disabled) continue;
          const colMinY = col.minY ?? 0;
          if (
            px >= col.minX - 0.25 &&
            px <= col.maxX + 0.25 &&
            pz >= col.minZ - 0.25 &&
            pz <= col.maxZ + 0.25 &&
            py >= colMinY &&
            py <= col.maxY
          ) {
            if (p.type === 'rpg_rocket') {
              const blastPos = p.mesh.position.clone();
              this._triggerExplosion(blastPos, p.blastRadius ?? 9.5, p.damage, false, true, {
                canBreakSilver: true,
                canBreakCrackedWall: true
              });
              if (typeof p.onExplode === 'function') {
                p.onExplode(blastPos);
              }
            } else {
              this._triggerMicroImpactBlast(p.mesh.position.clone());
            }
            hit = true;
            break;
          }
        }
      }

      const floorY = this.world?.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(p.mesh.position.x, p.mesh.position.z)
        : 0;
      if (!hit && p.mesh.position.y <= floorY + 0.22) {
        const blastPos = new THREE.Vector3(p.mesh.position.x, floorY + 0.2, p.mesh.position.z);
        if (p.type === 'fireball' || p.type === 'rpg_rocket') {
          this._triggerExplosion(
            blastPos,
            p.blastRadius ?? 4.2,
            p.damage,
            false,
            Boolean(p.isSupernovaBlast),
            {
              canBreakSilver: Boolean(p.canBreakSilver),
              canBreakCrackedWall: Boolean(p.canBreakCrackedWall)
            }
          );
          if (typeof p.onExplode === 'function') {
            p.onExplode(blastPos);
          }
        } else if (p.type === 'punisher_50cal') {
          this._triggerMicroImpactBlast(blastPos);
        }
        hit = true;
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 2B. Carros arremessados pelo Titã Blindado (giram no ar e explodem ao bater!)
    for (let i = this.thrownCars.length - 1; i >= 0; i--) {
      const tc = this.thrownCars[i];
      tc.timer -= dt;
      tc.vel.y -= 20.0 * dt;
      const carObj = tc.carObj;
      if (!carObj || carObj.destroyed) {
        this.thrownCars.splice(i, 1);
        continue;
      }
      carObj.mesh.position.addScaledVector(tc.vel, dt);
      carObj.mesh.rotation.x += dt * 7.5;
      carObj.mesh.rotation.z += dt * 5.2;

      const cx = carObj.mesh.position.x;
      const cy = carObj.mesh.position.y;
      const cz = carObj.mesh.position.z;
      let hitAny = cy <= (carObj.groundY ?? 0) + 0.25;

      if (!hitAny) {
        for (const obj of this.objects) {
          if (obj.destroyed || obj === carObj || obj.isDriven) continue;
          const dHoriz = Math.hypot(cx - obj.basePos.x, cz - obj.basePos.z);
          const dVert = Math.abs(cy - (obj.basePos.y + obj.height * 0.5));
          if (dHoriz <= obj.radius + 2.2 && dVert <= obj.height + 1.8) {
            hitAny = true;
            break;
          }
        }
      }

      if (hitAny || tc.timer <= 0) {
        const blastPos = carObj.mesh.position.clone();
        carObj.basePos.copy(blastPos);
        this._shatterObject(carObj);
        this._triggerExplosion(blastPos, 9.5, 180, false, true, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
        this.thrownCars.splice(i, 1);
      }
    }

    // 3. Granadas Explosivas / Impulso do Comandante Caveira (Detonação imediata em qualquer colisão!)
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.age = (g.age || 0) + dt;
      g.timer -= dt;
      g.vel.y -= 18.0 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 12;
      g.mesh.rotation.z += dt * 9;

      const gx = g.mesh.position.x;
      const gy = g.mesh.position.y;
      const gz = g.mesh.position.z;
      const r = 0.22;

      let hitCollision = false;

      // A) Tocou no terreno real (funciona em ruas planas, morros da CDD e pontes!)
      const groundY = typeof g.getTerrainHeightAt === 'function' ? g.getTerrainHeightAt(gx, gz) : 0;
      if (gy <= groundY + 0.22) {
        g.mesh.position.y = groundY + 0.22;
        hitCollision = true;
      }

      // B) Tocou em qualquer colisor estático do mapa (calçada, prédio, muro, carro, etc.)
      if (!hitCollision && g.worldColliders) {
        for (const col of g.worldColliders) {
          if (col.disabled) continue;
          const colMinY = col.minY ?? 0;
          if (
            gx + r >= col.minX &&
            gx - r <= col.maxX &&
            gz + r >= col.minZ &&
            gz - r <= col.maxZ &&
            gy - r <= col.maxY &&
            gy + r >= colMinY
          ) {
            hitCollision = true;
            break;
          }
        }
      }

      // C) Tocou em qualquer objeto quebrável
      if (!hitCollision) {
        for (const obj of this.objects) {
          if (obj.destroyed) continue;
          const dHoriz = Math.hypot(gx - obj.basePos.x, gz - obj.basePos.z);
          const dVert = Math.abs(gy - (obj.basePos.y + obj.height * 0.5));
          if (dHoriz <= obj.radius + r && dVert <= obj.height * 0.6 + r) {
            hitCollision = true;
            break;
          }
        }
      }

      if (hitCollision || g.timer <= 0) {
        const blastPos = g.mesh.position.clone();
        this._triggerExplosion(blastPos, 6.8, 70, true, false);
        if (typeof g.onExplode === 'function') {
          g.onExplode(blastPos);
        }
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }

    // 4. Animação de Esferas, Ondas de Choque e Pilares de Erupção (Granada / Bola de Fogo / Supernova)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.age += dt;
      const t = ex.age / ex.duration;
      if (t >= 1) {
        if (ex.sphereMesh) {
          this.scene.remove(ex.sphereMesh);
        }
        this.scene.remove(ex.ringMesh);
        if (ex.extraMeshes) {
          for (const m of ex.extraMeshes) {
            this.scene.remove(m);
          }
        }
        this.explosions.splice(i, 1);
        continue;
      }

      const r = THREE.MathUtils.lerp(0.5, ex.maxRadius, Math.pow(t, 0.52));
      if (ex.sphereMesh) {
        ex.sphereMesh.scale.setScalar(r * (ex.isSupernova ? 0.58 : 0.65));
        ex.sphereMesh.material.opacity = (1 - t) * 0.78;
      }

      ex.ringMesh.scale.setScalar(r);
      ex.ringMesh.material.opacity = (1 - t) * 0.92;

      if (ex.innerCoreMesh) {
        ex.innerCoreMesh.scale.setScalar(r * 0.36);
        ex.innerCoreMesh.material.opacity = Math.max(0, (1 - t * 1.15) * 0.96);
      }

      if (ex.extraRings) {
        for (const er of ex.extraRings) {
          const erRadius = Math.min(ex.maxRadius * 1.25, r * er.speedMult);
          er.mesh.scale.setScalar(erRadius);
          er.mesh.material.opacity = Math.max(0, (1 - t) * 0.88);
        }
      }

      if (ex.eruptionSpikes) {
        for (const sp of ex.eruptionSpikes) {
          const localT = Math.max(0, (t - sp.delay) / (1 - sp.delay));
          const growY = localT < 0.35
            ? localT / 0.35
            : Math.max(0.05, 1.0 - (localT - 0.35) / 0.65);
          sp.mesh.scale.set(1.0, growY, 1.0);
          sp.mesh.material.opacity = Math.max(0, (1 - localT) * 0.95);
        }
      }
    }

    // 5. Partículas de rastro de chamas e troca de herói
    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const fp = this.fxParticles[i];
      fp.life -= dt;
      if (fp.life <= 0) {
        this.scene.remove(fp.mesh);
        this.fxParticles.splice(i, 1);
        continue;
      }
      fp.mesh.position.addScaledVector(fp.vel, dt);
      fp.mesh.rotation.x += dt * 6;
      fp.mesh.rotation.y += dt * 6;
      const ratio = fp.life / fp.maxLife;
      fp.mesh.scale.setScalar(ratio);
      if (fp.mesh.material) {
        fp.mesh.material.opacity = ratio;
      }
    }

    // 5b. Segmentos da Muralha de Luz Ciano (Turbo Fantasma) — capota e explode veículos que encostarem!
    for (let i = this.lightWallSegments.length - 1; i >= 0; i--) {
      const seg = this.lightWallSegments[i];
      seg.life -= dt;
      if (seg.life <= 0) {
        this.scene.remove(seg.mesh);
        this.lightWallSegments.splice(i, 1);
        continue;
      }
      if (seg.life < 0.65) {
        const fade = seg.life / 0.65;
        seg.wallMat.opacity = 0.72 * fade;
        seg.railMat.opacity = 0.96 * fade;
      }
      // Checa colisão de objetos/veículos da rua com a Muralha de Luz (após 0.15s da criação)
      if (seg.maxLife - seg.life > 0.15) {
        for (const obj of this.objects) {
          if (obj.destroyed || obj.isDriven || obj.isGrabbed) continue;
          const d = Math.hypot(obj.basePos.x - seg.midPos.x, obj.basePos.z - seg.midPos.z);
          if (d <= obj.radius + seg.halfLen && Math.abs(obj.basePos.y - seg.midPos.y) <= 2.6) {
            this.damageObject(obj, 220, seg.midPos, false, { canBreakCrackedWall: true });
          }
        }
      }
    }

    // 6. Pecinhas LEGO desmontadas (Debris)
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life -= dt;

      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debrisList.splice(i, 1);
        continue;
      }

      d.vel.y -= 24.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;

      if (d.mesh.position.y <= d.groundY) {
        d.mesh.position.y = d.groundY;
        if (Math.abs(d.vel.y) > 1.2) {
          d.vel.y = -d.vel.y * 0.48;
        } else {
          d.vel.y = 0;
        }
        d.vel.x *= 0.78;
        d.vel.z *= 0.78;
        d.rotVel.multiplyScalar(0.75);
      }

      if (d.life < 0.6) {
        const s = Math.max(0.01, d.life / 0.6);
        d.mesh.scale.setScalar(s);
      }
    }

    // 7. Studs 3D e Coleta com Ímã
    const playerChest = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + 1.1,
      playerPosition.z
    );

    for (let i = this.studsList.length - 1; i >= 0; i--) {
      const s = this.studsList[i];
      s.age += dt;
      s.mesh.rotation.y += dt * 4.5;

      const distToPlayer = s.mesh.position.distanceTo(playerChest);

      if (s.age > 0.18 && distToPlayer < this.magnetRadius) {
        s.magnetized = true;
      }

      if (s.magnetized) {
        const dir = playerChest.clone().sub(s.mesh.position);
        const dist = dir.length();

        if (dist <= this.collectRadius) {
          soundFX.playStudCollect(s.value);
          if (this.hud) {
            this.hud.addStuds(s.value, s.tier);
          }
          this.scene.remove(s.mesh);
          this.studsList.splice(i, 1);
          continue;
        }

        dir.normalize();
        const pullSpeed = 19.5 + (this.magnetRadius - Math.min(this.magnetRadius, dist)) * 3.8;
        s.mesh.position.addScaledVector(dir, pullSpeed * dt);
      } else {
        s.vel.y -= 22.0 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);

        if (s.mesh.position.y <= s.groundY) {
          s.mesh.position.y = s.groundY;
          if (Math.abs(s.vel.y) > 1.0) {
            s.vel.y = -s.vel.y * 0.56;
          } else {
            s.vel.y = 0;
          }
          s.vel.x *= 0.82;
          s.vel.z *= 0.82;
        }
      }
    }

    // 7b. Studs estáticos de recompensa (como as dezenas de Studs na Sala do Cofre do Banco!)
    for (let i = 0; i < this.ambientStuds.length; i++) {
      const s = this.ambientStuds[i];
      if (s.collected) continue;

      const sdx = s.mesh.position.x - playerChest.x;
      const sdz = s.mesh.position.z - playerChest.z;
      const sDistSq = sdx * sdx + sdz * sdz;
      if (sDistSq > 180 * 180) {
        if (s.mesh.visible) s.mesh.visible = false;
        continue;
      }
      if (!s.mesh.visible) s.mesh.visible = true;

      s.mesh.rotation.y += dt * 4.5;

      const distToPlayer = s.mesh.position.distanceTo(playerChest);
      if (distToPlayer < this.magnetRadius) {
        s.magnetized = true;
      }

      if (s.magnetized) {
        const dir = playerChest.clone().sub(s.mesh.position);
        const dist = dir.length();
        if (dist <= this.collectRadius) {
          s.collected = true;
          s.mesh.visible = false;
          soundFX.playStudCollect(s.value);
          if (this.hud) {
            this.hud.addStuds(s.value, s.tier);
          }
          continue;
        }
        dir.normalize();
        const pullSpeed = 19.5 + (this.magnetRadius - Math.min(this.magnetRadius, dist)) * 3.8;
        s.mesh.position.addScaledVector(dir, pullSpeed * dt);
      }
    }

    // 8. Chafarizes de água de hidrantes
    for (let i = this.geysers.length - 1; i >= 0; i--) {
      const g = this.geysers[i];
      g.timer -= dt;

      if (g.timer <= 0) {
        for (const drop of g.drops) {
          this.scene.remove(drop.mesh);
        }
        this.geysers.splice(i, 1);
        continue;
      }

      for (const drop of g.drops) {
        drop.vel.y -= 18.0 * dt;
        drop.mesh.position.addScaledVector(drop.vel, dt);
        drop.mesh.rotation.x += dt * 5;
        drop.mesh.rotation.y += dt * 4;

        if (drop.mesh.position.y <= g.groundY) {
          this._resetGeyserDrop(drop.mesh, g.origin, g.groundY);
          drop.vel.set(
            (Math.random() - 0.5) * 1.9,
            6.8 + Math.random() * 4.2,
            (Math.random() - 0.5) * 1.9
          );
        }
      }
    }
  }
}
