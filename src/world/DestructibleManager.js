import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
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

const STUD_BASE_GEO = new THREE.CylinderGeometry(0.28, 0.28, 0.11, 18);
const STUD_TOP_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
STUD_TOP_GEO.translate(0, 0.085, 0);

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
    this.geysers = [];
    this.projectiles = [];
    this.grenades = [];
    this.explosions = [];
    this.fxParticles = [];

    this.magnetRadius = 5.2;
    this.collectRadius = 0.9;

    this.beamSoundCooldown = 0;
    this._initSolarBeamMesh();
  }

  _initSolarBeamMesh() {
    this.solarBeamGroup = new THREE.Group();
    this.solarBeamGroup.visible = false;

    const coreGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 14);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.beamCore = new THREE.Mesh(coreGeo, coreMat);

    const glowGeo = new THREE.CylinderGeometry(0.26, 0.26, 1, 16);
    glowGeo.translate(0, 0.5, 0);
    glowGeo.rotateX(Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.62
    });
    this.beamGlow = new THREE.Mesh(glowGeo, glowMat);

    const hitSphereMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9
    });
    this.beamHitSphere = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 14), hitSphereMat);

    this.solarBeamGroup.add(this.beamCore, this.beamGlow);
    this.scene.add(this.solarBeamGroup);
    this.scene.add(this.beamHitSphere);
    this.beamHitSphere.visible = false;
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
    goldOnly = false
  }) {
    const basePos = mesh.position.clone();
    const baseRot = mesh.rotation.clone();

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

  rebuildAll() {
    for (const obj of this.objects) {
      if (obj.destroyed) {
        this._restoreObject(obj);
      } else {
        obj.hp = obj.maxHp;
        obj.heatLevel = 0;
      }
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

    // 1. Verifica interseção do raio da mira central com a esfera/cilindro dos objetos quebráveis
    for (const obj of this.objects) {
      if (obj.destroyed) continue;

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
   * Arremessa Granada Explosiva / Impulso Tático (Estilo Raze) do Comandante Caveira:
   * Vai na direção exata da mira e explode IMEDIATAMENTE ao tocar qualquer colisão (chão, parede, calçada ou objeto)!
   */
  throwGrenade(origin, targetPoint, worldColliders = [], onExplode = null) {
    soundFX.playPunchSwing();

    const nadeGroup = new THREE.Group();
    const bodyMat = getLegoMaterial(LEGO_COLORS.darkGreen, { roughness: 0.3 });
    const topLedMat = getLegoMaterial(LEGO_COLORS.orange, {
      emissive: 0xf97316,
      emissiveIntensity: 2.0
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 14), bodyMat);
    body.castShadow = true;
    const topStud = new THREE.Mesh(SHARED_STUD_GEO, topLedMat);
    topStud.position.y = 0.18;
    nadeGroup.add(body, topStud);

    nadeGroup.position.copy(origin);
    this.scene.add(nadeGroup);

    const dir = targetPoint.clone().sub(origin).normalize();
    const dist = origin.distanceTo(targetPoint);
    const speed = 34.0;
    const vel = dir.multiplyScalar(speed);
    // Leve compensação parabólica apenas para arremessos longos
    if (dist > 6.0 && dir.y > -0.25) {
      vel.y += Math.min(4.5, dist * 0.14);
    }

    this.grenades.push({
      mesh: nadeGroup,
      vel,
      worldColliders,
      onExplode,
      timer: 1.5
    });
  }

  /**
   * Atualiza o Raio Solar Contínuo (derrete objetos de Ouro LEGO e queima alvos)
   */
  updateSolarBeam(isActive, handOrigin, aimData, dt) {
    if (!isActive) {
      this.solarBeamGroup.visible = false;
      this.beamHitSphere.visible = false;
      return;
    }

    this.solarBeamGroup.visible = true;
    this.beamHitSphere.visible = true;

    const targetPt = aimData.point;
    const dist = Math.max(0.5, handOrigin.distanceTo(targetPt));

    this.solarBeamGroup.position.copy(handOrigin);
    this.solarBeamGroup.lookAt(targetPt);
    const pulse = 0.85 + Math.sin(performance.now() * 0.035) * 0.25;
    this.solarBeamGroup.scale.set(pulse, pulse, dist);

    this.beamHitSphere.position.copy(targetPt);
    this.beamHitSphere.scale.setScalar(0.8 + Math.sin(performance.now() * 0.04) * 0.28);

    // Som contínuo de laser solar
    this.beamSoundCooldown -= dt;
    if (this.beamSoundCooldown <= 0) {
      this.beamSoundCooldown = 0.07;
      soundFX.playSolarBeamTick();
    }

    // Solta faíscas solares no ponto de impacto
    if (Math.random() < 0.55) {
      this.spawnFlameTrailParticle(targetPt, 0.85);
    }

    // Aplica dano solar contínuo (capaz de derreter objetos de Ouro LEGO!)
    if (aimData.hitObj && !aimData.hitObj.destroyed) {
      this.damageObject(aimData.hitObj, 42 * dt, targetPt, true);
    } else {
      // Verifica também objetos muito próximos ao ponto de impacto do feixe
      for (const obj of this.objects) {
        if (obj.destroyed) continue;
        const dHoriz = Math.hypot(obj.basePos.x - targetPt.x, obj.basePos.z - targetPt.z);
        const dVert = Math.abs((obj.basePos.y + obj.height * 0.5) - targetPt.y);
        if (dHoriz <= obj.radius + 0.65 && dVert <= obj.height * 0.7 + 0.6) {
          this.damageObject(obj, 42 * dt, targetPt, true);
        }
      }
    }
  }

  /**
   * Poder Especial Supernova do Solaris (Explosão Solar em Área)
   */
  triggerSupernova(centerPos) {
    const origin = centerPos.clone();
    origin.y += 1.1;
    this._triggerExplosion(origin, 11.5, 95, false, true);
  }

  /**
   * Cria uma explosão 3D em área (Granada, Bola de Fogo ou Supernova)
   */
  _triggerExplosion(center, radius, maxDamage, isFlashbang = false, isSupernova = false) {
    soundFX.playExplosion(isSupernova ? 1.6 : isFlashbang ? 1.25 : 0.9);

    const sphereColor = isFlashbang ? 0xfef9c3 : 0xf97316;
    const sphereMat = new THREE.MeshBasicMaterial({
      color: sphereColor,
      transparent: true,
      opacity: 0.88
    });
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), sphereMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.12, 12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.92
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    this.explosions.push({
      sphereMesh,
      ringMesh,
      maxRadius: radius,
      age: 0,
      duration: isSupernova ? 0.55 : 0.36
    });

    // Causa dano em todos os objetos quebráveis dentro do raio
    for (const obj of this.objects) {
      if (obj.destroyed) continue;
      const objPos = new THREE.Vector3(
        obj.basePos.x,
        obj.basePos.y + obj.height * 0.5,
        obj.basePos.z
      );
      const dist = objPos.distanceTo(center);
      if (dist <= radius + obj.radius) {
        this.damageObject(obj, maxDamage, center, isSupernova);
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

  damageObject(obj, amount, hitOrigin = null, isSolar = false) {
    if (obj.destroyed) return;

    // Objetos de Ouro LEGO só derretem com o Raio Solar Contínuo ou Supernova do Solaris!
    if (obj.goldOnly && !isSolar) {
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
    obj.respawnTimer = 28.0;
    obj.mesh.visible = false;

    for (const col of obj.colliders) {
      col.disabled = true;
    }

    const isBig = obj.type === 'car' || obj.type === 'newsstand' || obj.type === 'gold_vault';
    soundFX.playLegoBreak(isBig);

    const pieceCount =
      obj.type === 'car' ? 24 :
      obj.type === 'gold_vault' ? 20 :
      obj.type === 'newsstand' ? 18 :
      obj.type === 'streetlamp' ? 14 : 11;
    this._spawnDebris(obj, pieceCount, isBig ? 1.25 : 0.95);

    this._spawnStudShower(obj);

    if (obj.type === 'hydrant') {
      this._createWaterGeyser(obj.basePos.clone(), obj.groundY);
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

    const group = new THREE.Group();
    const base = new THREE.Mesh(STUD_BASE_GEO, mat);
    base.castShadow = true;
    const top = new THREE.Mesh(STUD_TOP_GEO, mat);
    group.add(base, top);

    group.rotation.z = 0.22;
    return group;
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

      if (obj.shakeTimer > 0) {
        obj.shakeTimer -= dt;
        const intensity = obj.shakeTimer * 0.45;
        obj.mesh.position.x = obj.basePos.x + (Math.random() - 0.5) * intensity;
        obj.mesh.position.z = obj.basePos.z + (Math.random() - 0.5) * intensity;
        obj.mesh.rotation.z = (Math.random() - 0.5) * intensity * 0.5;
      } else {
        obj.mesh.position.copy(obj.basePos);
        obj.mesh.rotation.copy(obj.baseRot);
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
        if (obj.destroyed) continue;
        const dx = p.mesh.position.x - obj.basePos.x;
        const dz = p.mesh.position.z - obj.basePos.z;
        const dy = p.mesh.position.y - (obj.basePos.y + obj.height * 0.5);

        if (Math.hypot(dx, dz) <= obj.radius + 0.4 && Math.abs(dy) <= obj.height * 0.65 + 0.45) {
          if (p.type === 'fireball') {
            this._triggerExplosion(p.mesh.position.clone(), 4.2, p.damage, false, false);
          } else {
            this.damageObject(obj, p.damage, p.mesh.position, p.isSolar);
          }
          hit = true;
          break;
        }
      }

      if (!hit && p.mesh.position.y <= 0.1) {
        if (p.type === 'fireball') {
          this._triggerExplosion(p.mesh.position.clone(), 4.2, p.damage, false, false);
        }
        hit = true;
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Granadas Explosivas / Impulso do Comandante Caveira (Detonação imediata em qualquer colisão!)
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.timer -= dt;
      g.vel.y -= 18.0 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 12;
      g.mesh.rotation.z += dt * 9;

      const gx = g.mesh.position.x;
      const gy = g.mesh.position.y;
      const gz = g.mesh.position.z;
      const r = 0.2;

      let hitCollision = false;

      // A) Tocou no asfalto
      if (gy <= 0.18) {
        g.mesh.position.y = 0.18;
        hitCollision = true;
      }

      // B) Tocou em qualquer colisor estático do mapa (calçada, prédio, muro, carro, etc.)
      if (!hitCollision && g.worldColliders) {
        for (const col of g.worldColliders) {
          if (col.disabled) continue;
          if (
            gx + r >= col.minX &&
            gx - r <= col.maxX &&
            gz + r >= col.minZ &&
            gz - r <= col.maxZ &&
            gy - r <= col.maxY
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

    // 4. Animação de Esferas e Anéis de Explosão (Granada / Bola de Fogo / Supernova)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.age += dt;
      const t = ex.age / ex.duration;
      if (t >= 1) {
        this.scene.remove(ex.sphereMesh);
        this.scene.remove(ex.ringMesh);
        this.explosions.splice(i, 1);
        continue;
      }

      const r = THREE.MathUtils.lerp(0.5, ex.maxRadius, Math.pow(t, 0.55));
      ex.sphereMesh.scale.setScalar(r * 0.65);
      ex.sphereMesh.material.opacity = (1 - t) * 0.78;

      ex.ringMesh.scale.setScalar(r);
      ex.ringMesh.material.opacity = (1 - t) * 0.9;
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
