import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { soundFX } from '../audio/SoundFX.js';

/**
 * Especificação dos 4 tipos de Studs (Moedinhas LEGO)
 */
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

// Geometria compartilhada de uma Moedinha Stud LEGO (disco cilíndrico + pino central)
const STUD_BASE_GEO = new THREE.CylinderGeometry(0.28, 0.28, 0.11, 18);
const STUD_TOP_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
STUD_TOP_GEO.translate(0, 0.085, 0);

// Geometrias compartilhadas para pecinhas de desmontagem (Debris)
const DEBRIS_GEOS = [
  new THREE.BoxGeometry(0.55, 0.32, 0.55),
  new THREE.BoxGeometry(0.85, 0.28, 0.45),
  new THREE.BoxGeometry(0.42, 0.42, 0.42),
  new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12)
];

const WATER_DROP_GEO = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const PROJECTILE_GEO = new THREE.CylinderGeometry(0.09, 0.09, 0.75, 10);
PROJECTILE_GEO.rotateX(Math.PI / 2);

export class DestructibleManager {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;

    this.objects = [];      // Objetos quebráveis registrados no mapa
    this.debrisList = [];   // Pecinhas LEGO 3D quicando no chão
    this.studsList = [];    // Moedinhas Stud 3D girando e sendo puxadas pelo ímã
    this.geysers = [];      // Chafarizes de água de hidrantes quebrados
    this.projectiles = [];  // Tiros disparados pelo jogador

    this.magnetRadius = 4.8; // Raio em que os Studs começam a voar até o boneco
    this.collectRadius = 0.85;
  }

  /**
   * Registra um objeto quebrável do cenário
   */
  registerDestructible({
    mesh,
    type,
    hp = 30,
    radius = 1.4,
    height = 2.0,
    colliders = [],
    debrisColors = [LEGO_COLORS.red, LEGO_COLORS.lightGrey],
    studDrops = { silver: 4, gold: 2, blue: 0, purple: 0 },
    groundY = 0.26
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
      basePos,
      baseRot,
      destroyed: false,
      shakeTimer: 0,
      respawnTimer: 0
    };

    this.objects.push(item);
    return item;
  }

  /**
   * Reconstrói imediatamente todos os objetos quebrados da rua (Tecla R)
   */
  rebuildAll() {
    for (const obj of this.objects) {
      if (obj.destroyed) {
        this._restoreObject(obj);
      } else {
        obj.hp = obj.maxHp;
      }
    }
    // Remove chafarizes antigos
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
   * Aplica golpe corpo a corpo (Soco/Chute LEGO) numa área à frente do boneco
   */
  performMeleeAttack(playerPos, facingAngle, range = 2.6, damage = 18) {
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
        this.damageObject(obj, damage, attackCenter);
        hitAny = true;
      }
    }

    return hitAny;
  }

  /**
   * Dispara um projétil luminoso LEGO na direção da mira
   */
  spawnProjectile(origin, direction) {
    soundFX.playShot();

    const mat = getLegoMaterial(LEGO_COLORS.yellow, {
      emissive: 0xfacc15,
      emissiveIntensity: 1.4,
      roughness: 0.1
    });

    const mesh = new THREE.Mesh(PROJECTILE_GEO, mat);
    mesh.position.copy(origin);
    const targetPt = origin.clone().add(direction);
    mesh.lookAt(targetPt);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      vel: direction.clone().normalize().multiplyScalar(52),
      life: 1.4,
      damage: 16
    });
  }

  /**
   * Causa dano a um objeto quebrável, soltando pecinhas e desmontando ao chegar a 0 de HP
   */
  damageObject(obj, amount, hitOrigin = null) {
    if (obj.destroyed) return;

    obj.hp -= amount;
    obj.shakeTimer = 0.22;

    if (obj.hp > 0) {
      soundFX.playPlasticHit();
      // Solta 2 ou 3 pecinhas plásticas menores a cada batida para feedback imediato
      this._spawnDebris(obj, 3, 0.65);
    } else {
      this._shatterObject(obj, hitOrigin);
    }
  }

  _shatterObject(obj) {
    obj.destroyed = true;
    obj.respawnTimer = 28.0; // Renasce depois de 28s ou apertando R
    obj.mesh.visible = false;

    // Desativa colisores para o jogador poder passar pelo local
    for (const col of obj.colliders) {
      col.disabled = true;
    }

    const isBig = obj.type === 'car' || obj.type === 'newsstand';
    soundFX.playLegoBreak(isBig);

    // 1. Explosão de pecinhas 3D coloridas que quicam no chão
    const pieceCount =
      obj.type === 'car' ? 24 :
      obj.type === 'newsstand' ? 18 :
      obj.type === 'streetlamp' ? 14 : 11;
    this._spawnDebris(obj, pieceCount, isBig ? 1.25 : 0.95);

    // 2. Chuva de Studs (Prata, Ouro, Azul e Roxo)
    this._spawnStudShower(obj);

    // 3. Se for um Hidrante, cria o esguicho / chafariz de água 3D!
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

      // Adiciona pino LEGO no topo das pecinhas retangulares
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

    // Inclina levemente a moedinha para brilhar mais ao girar
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
      this._resetGeyserDrop(mesh, position, groundY, i / dropCount);
      this.scene.add(mesh);
      drops.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.8,
          6.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 1.8
        ),
        phase: i / dropCount
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
    // 1. Atualiza tremor de dano e respawn dos objetos quebráveis
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

    // 2. Atualiza projéteis disparados pelo jogador
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      let hit = false;
      for (const obj of this.objects) {
        if (obj.destroyed) continue;
        const dx = p.mesh.position.x - obj.basePos.x;
        const dz = p.mesh.position.z - obj.basePos.z;
        const dy = p.mesh.position.y - (obj.basePos.y + obj.height * 0.5);

        if (Math.hypot(dx, dz) <= obj.radius + 0.35 && Math.abs(dy) <= obj.height * 0.65 + 0.4) {
          this.damageObject(obj, p.damage, p.mesh.position);
          hit = true;
          break;
        }
      }

      if (hit || p.life <= 0 || p.mesh.position.y < 0.05) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Atualiza física de quique das pecinhas LEGO desmontadas (Debris)
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

      // Quique no chão / calçada
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

      // Encolhe suavemente nos últimos 0.6s de vida
      if (d.life < 0.6) {
        const s = Math.max(0.01, d.life / 0.6);
        d.mesh.scale.setScalar(s);
      }
    }

    // 4. Atualiza física e coleta magnética dos Studs (Moedinhas LEGO)
    const playerChest = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + 1.1,
      playerPosition.z
    );

    for (let i = this.studsList.length - 1; i >= 0; i--) {
      const s = this.studsList[i];
      s.age += dt;

      // Giro brilhante contínuo da moedinha
      s.mesh.rotation.y += dt * 4.5;

      const distToPlayer = s.mesh.position.distanceTo(playerChest);

      // Ativa ímã se o jogador passar perto (após 0.18s do pulo inicial da moeda)
      if (s.age > 0.18 && distToPlayer < this.magnetRadius) {
        s.magnetized = true;
      }

      if (s.magnetized) {
        const dir = playerChest.clone().sub(s.mesh.position);
        const dist = dir.length();

        if (dist <= this.collectRadius) {
          // Coletou o Stud!
          soundFX.playStudCollect(s.value);
          if (this.hud) {
            this.hud.addStuds(s.value, s.tier);
          }
          this.scene.remove(s.mesh);
          this.studsList.splice(i, 1);
          continue;
        }

        dir.normalize();
        const pullSpeed = 18.5 + (this.magnetRadius - Math.min(this.magnetRadius, dist)) * 3.5;
        s.mesh.position.addScaledVector(dir, pullSpeed * dt);
      } else {
        // Física de queda e quique da moedinha no chão
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

    // 5. Atualiza chafarizes de água dos hidrantes quebrados
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

