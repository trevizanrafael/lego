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
  // HERÓI #3: TITÃ BLINDADO (MECHA BIG-FIG) — METRALHADORA, SOCO FOGUETE, TERREMOTO E ARREMESSO DE CARRO
  // ============================================================================

  spawnTitaRotaryBullet(origin, targetPoint) {
    soundFX.playRifleShot();
    const dir = targetPoint.clone().sub(origin).normalize();
    const mat = getLegoMaterial(0x00f0ff, {
      emissive: 0x38bdf8,
      emissiveIntensity: 2.2,
      roughness: 0.1
    });
    const mesh = new THREE.Mesh(BULLET_GEO, mat);
    mesh.scale.set(1.6, 1.6, 2.0);
    mesh.position.copy(origin);
    mesh.lookAt(targetPoint);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      type: 'bullet',
      vel: dir.multiplyScalar(78),
      life: 1.3,
      damage: 24,
      isSolar: false
    });
  }

  /**
   * Soco Foguete do Titã Blindado: estoura Paredes Rachadas (cracked_wall) e arremessa objetos!
   */
  triggerTitaRocketPunch(playerPos, facingAngle) {
    soundFX.playExplosion(1.15);
    const impactCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 2.6,
      playerPos.y + 1.35,
      playerPos.z + Math.cos(facingAngle) * 2.6
    );

    const ringGeo = new THREE.TorusGeometry(1, 0.15, 12, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(impactCenter);
    ringMesh.rotation.y = facingAngle;
    this.scene.add(ringMesh);

    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85
    });
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 14), sphereMat);
    sphereMesh.position.copy(impactCenter);
    this.scene.add(sphereMesh);

    this.explosions.push({
      sphereMesh,
      ringMesh,
      maxRadius: 5.8,
      age: 0,
      duration: 0.34
    });

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - impactCenter.x;
      const dz = obj.basePos.z - impactCenter.z;
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - impactCenter.y);
      if (Math.hypot(dx, dz) <= obj.radius + 4.8 && dy <= obj.height + 2.5) {
        this.damageObject(obj, 120, impactCenter, false, {
          canBreakCrackedWall: true,
          canBreakSilver: false
        });
      }
    }
  }

  /**
   * Terremoto de Escudo [Q] e Impacto Sísmico do Superpulo do Titã Blindado!
   */
  triggerTitaGroundSlam(centerPos, radius = 10.5, damage = 95) {
    soundFX.playExplosion(1.35);
    const slamCenter = centerPos.clone();
    slamCenter.y += 0.35;

    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.72
    });
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), sphereMat);
    sphereMesh.position.copy(slamCenter);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.16, 12, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(slamCenter);
    this.scene.add(ringMesh);

    this.explosions.push({
      sphereMesh,
      ringMesh,
      maxRadius: radius,
      age: 0,
      duration: 0.45
    });

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dHoriz = Math.hypot(obj.basePos.x - slamCenter.x, obj.basePos.z - slamCenter.z);
      const dVert = Math.abs(obj.basePos.y - centerPos.y);
      if (dHoriz <= radius + obj.radius && dVert <= 4.5) {
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
  // HERÓI #4: VINGADOR DE CHUMBO — DUAS SMGs, ESCOPETA DE IMPACTO & BAZUCA RPG
  // ============================================================================

  spawnDualSmgBullets(leftOrigin, rightOrigin, targetPoint) {
    soundFX.playRifleShot();
    const tracerMat = getLegoMaterial(0xe2e8f0, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.0,
      roughness: 0.1
    });

    for (const orig of [leftOrigin, rightOrigin]) {
      const spreadTarget = targetPoint.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8)
      );
      const dir = spreadTarget.sub(orig).normalize();
      const mesh = new THREE.Mesh(BULLET_GEO, tracerMat);
      mesh.position.copy(orig);
      mesh.lookAt(targetPoint);
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        type: 'bullet',
        vel: dir.multiplyScalar(82),
        life: 1.1,
        damage: 13,
        isSolar: false
      });
    }
  }

  spawnShotgunBlast(origin, targetPoint) {
    soundFX.playExplosion(0.75);
    const mainDir = targetPoint.clone().sub(origin).normalize();
    const pelletMat = getLegoMaterial(0xf97316, {
      emissive: 0xfef08a,
      emissiveIntensity: 2.2
    });

    for (let i = 0; i < 7; i++) {
      const spreadDir = mainDir.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.18,
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.18
        )
      ).normalize();

      const mesh = new THREE.Mesh(BULLET_GEO, pelletMat);
      mesh.scale.set(1.4, 1.4, 1.2);
      mesh.position.copy(origin);
      mesh.lookAt(origin.clone().add(spreadDir));
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        type: 'bullet',
        vel: spreadDir.multiplyScalar(64),
        life: 0.48,
        damage: 18,
        isSolar: false
      });
    }
  }

  /**
   * Dispara Foguete da Bazuca RPG do Vingador de Chumbo (destrói Objetos Prateados Brilhantes e Blindados!)
   */
  spawnRpgRocket(origin, targetPoint) {
    soundFX.playExplosion(0.95);
    const dir = targetPoint.clone().sub(origin).normalize();

    const rocketGroup = new THREE.Group();
    const bodyMat = getLegoMaterial(0x365314, { roughness: 0.3 });
    const noseMat = getLegoMaterial(0xd97706, { emissive: 0xef4444, emissiveIntensity: 1.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.65, 10), bodyMat);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 10), noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.45;
    rocketGroup.add(body, nose);

    rocketGroup.position.copy(origin);
    rocketGroup.lookAt(targetPoint);
    this.scene.add(rocketGroup);

    this.projectiles.push({
      mesh: rocketGroup,
      type: 'fireball',
      vel: dir.multiplyScalar(56),
      life: 2.0,
      damage: 165,
      blastRadius: 7.5,
      isSolar: false,
      canBreakSilver: true,
      canBreakCrackedWall: true
    });
  }

  // ============================================================================
  // HERÓI #5: SOMBRA ESCARLATE (SHINOBI CYBER) — KATANAS, FUMAÇA E PUXÃO MAGNÉTICO
  // ============================================================================

  performKatanaSlash(playerPos, facingAngle) {
    soundFX.playPunchSwing();
    const slashCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.9,
      playerPos.y + 1.15,
      playerPos.z + Math.cos(facingAngle) * 1.9
    );

    // Onda de corte escarlate brilhante
    const waveGeo = new THREE.TorusGeometry(1.45, 0.08, 8, 24, Math.PI * 1.15);
    waveGeo.rotateX(Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xff1e42,
      transparent: true,
      opacity: 0.92
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.copy(slashCenter);
    waveMesh.rotation.y = facingAngle - Math.PI * 0.55;
    this.scene.add(waveMesh);

    this.fxParticles.push({
      mesh: waveMesh,
      vel: new THREE.Vector3(Math.sin(facingAngle) * 12, 0, Math.cos(facingAngle) * 12),
      life: 0.22,
      maxLife: 0.22
    });

    for (const obj of this.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - slashCenter.x;
      const dz = obj.basePos.z - slashCenter.z;
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - slashCenter.y);
      if (Math.hypot(dx, dz) <= obj.radius + 2.8 && dy <= obj.height + 1.6) {
        this.damageObject(obj, 36, slashCenter, false);
      }
    }
  }

  spawnSmokeBombCloud(centerPos) {
    soundFX.playTacticalRoll();
    const colors = [0x18181b, 0x27272a, 0x991b1b, 0xdc2626];
    for (let i = 0; i < 20; i++) {
      const c = colors[i % colors.length];
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.88
      });
      const puff = new THREE.Mesh(FIREBALL_GEO, mat);
      const angle = (i / 20) * Math.PI * 2;
      const r = 0.4 + Math.random() * 0.9;
      puff.position.set(
        centerPos.x + Math.cos(angle) * r,
        centerPos.y + 0.4 + Math.random() * 1.1,
        centerPos.z + Math.sin(angle) * r
      );
      puff.scale.setScalar(1.4 + Math.random() * 1.2);
      this.scene.add(puff);

      this.fxParticles.push({
        mesh: puff,
        vel: new THREE.Vector3(
          Math.cos(angle) * (2.5 + Math.random() * 3.0),
          1.8 + Math.random() * 2.6,
          Math.sin(angle) * (2.5 + Math.random() * 3.0)
        ),
        life: 0.75,
        maxLife: 0.75
      });
    }
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

    // 2. Projéteis (Fuzil Tático & Bolas de Fogo do Solaris)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      if (p.type === 'fireball' && Math.random() < 0.65) {
        this.spawnFlameTrailParticle(p.mesh.position, 0.7);
      }

      let hit = false;
      for (const obj of this.objects) {
        if (obj.destroyed || obj.isDriven) continue;
        const dx = p.mesh.position.x - obj.basePos.x;
        const dz = p.mesh.position.z - obj.basePos.z;
        const dy = p.mesh.position.y - (obj.basePos.y + obj.height * 0.5);

        if (Math.hypot(dx, dz) <= obj.radius + 0.4 && Math.abs(dy) <= obj.height * 0.65 + 0.45) {
          if (p.type === 'fireball') {
            this._triggerExplosion(
              p.mesh.position.clone(),
              p.blastRadius ?? 4.2,
              p.damage,
              false,
              Boolean(p.isSupernovaBlast),
              {
                canBreakSilver: Boolean(p.canBreakSilver),
                canBreakCrackedWall: Boolean(p.canBreakCrackedWall)
              }
            );
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

      if (!hit && p.mesh.position.y <= 0.1) {
        if (p.type === 'fireball') {
          this._triggerExplosion(
            p.mesh.position.clone(),
            p.blastRadius ?? 4.2,
            p.damage,
            false,
            Boolean(p.isSupernovaBlast),
            {
              canBreakSilver: Boolean(p.canBreakSilver),
              canBreakCrackedWall: Boolean(p.canBreakCrackedWall)
            }
          );
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
        this.scene.remove(ex.sphereMesh);
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
      ex.sphereMesh.scale.setScalar(r * (ex.isSupernova ? 0.58 : 0.65));
      ex.sphereMesh.material.opacity = (1 - t) * 0.78;

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
      fp.mesh.material.opacity = ratio;
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
