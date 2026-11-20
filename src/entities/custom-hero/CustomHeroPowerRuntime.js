import * as THREE from 'three';
import {
  createLegoBrick,
  markAsSharedAsset,
  disposeTransientObject3D
} from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import {
  getActiveCustomHero,
  findPaletteColor
} from './CustomHeroCatalogAndSave.js';

const _OP09_RING_GEO = markAsSharedAsset(new THREE.RingGeometry(0.65, 1.05, 24).rotateX(-Math.PI / 2));
const _OP09_ICE_SHARD_GEO = markAsSharedAsset(new THREE.ConeGeometry(0.38, 1.65, 5));
const _OP09_GHOST_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.85, 1.85, 0.48));
const _OP09_TMP_VEC = new THREE.Vector3();

// ============================================================================
// MOTOR EM TEMPO REAL DOS 12 PODERES EXCLUSIVOS DO OP-09 (60 FPS)
// ============================================================================

export function initPowerRuntimeState(rt, controller) {
  rt.controller = controller;
  rt.world = controller.world;
  rt.scene = controller.world.scene;
  rt.destructibles = controller.destructibles;

  rt.projectiles = [];
  rt.iceCrystals = [];
  rt.expandingRings = [];
  rt.singularities = [];
  rt.meteors = [];
  rt.afterimages = [];

  rt.airJumpCount = 0;
  rt.hoverboardActive = false;
  rt.chronoTimer = 0;
  rt.chronoCloneTick = 0;
  rt.shieldTimer = 0;
  rt.superCooldown = 0;

  const shieldGeo = new THREE.SphereGeometry(1.35, 18, 14);
  rt.shieldMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true
  });
  rt.personalShieldMesh = new THREE.Mesh(shieldGeo, rt.shieldMat);
  rt.personalShieldMesh.visible = false;
  rt.scene.add(rt.personalShieldMesh);
}

export function onCustomHeroSwitched(rt, newHeroKey) {
  if (newHeroKey !== 'op09') {
    rt.hoverboardActive = false;
    rt.chronoTimer = 0;
    rt.shieldTimer = 0;
    rt.personalShieldMesh.visible = false;
  }
}

export function getCustomHeroSpeedMultiplier(rt) {
  if (rt.controller.minifigure?.currentHeroKey !== 'op09') return 1.0;
  const cfg = getActiveCustomHero();
  if (!cfg.isCreated) return 1.0;
  let mult = 1.0;
  if (cfg.mobilityPowerId === 'triple_acrobat' && rt.controller.keys.sprint) {
    mult = Math.max(mult, 2.2); // ~31 m/s Super-Corrida!
  }
  if (rt.hoverboardActive && cfg.mobilityPowerId === 'light_hoverboard') {
    mult = Math.max(mult, 2.45); // ~34 m/s Hoverboard!
  }
  if (rt.chronoTimer > 0) {
    mult *= 1.75; // +75% Hiper-Velocidade Crono!
  }
  return mult;
}

export function fireCustomHeroPrimary(rt, aimPoint) {
  const cfg = getActiveCustomHero();
  const c = rt.controller;

  // CIDADÃO COMUM (isCreated === false): Apenas soco simples civil!
  if (!cfg.isCreated) {
    c.primaryCooldown = 0.34;
    c.minifigure.triggerPunch();
    rt.destructibles?.performMeleeAttack(c.position, c.facingAngle, 2.5, 18);
    return;
  }

  const hasteMult = rt.chronoTimer > 0 ? 0.57 : 1.0;
  const origin = new THREE.Vector3(
    c.position.x + Math.sin(c.facingAngle) * 0.95,
    c.position.y + 1.32,
    c.position.z + Math.cos(c.facingAngle) * 0.95
  );
  const dir = aimPoint.clone().sub(origin).normalize();

  if (cfg.primaryPowerId === 'cryo_ray') {
    c.primaryCooldown = 0.17 * hasteMult;
    c.minifigure.triggerShoot();
    soundFX.playHeroSwap();
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    mesh.scale.set(0.8, 0.8, 2.2);
    mesh.position.copy(origin);
    mesh.lookAt(aimPoint);
    rt.scene.add(mesh);
    rt.projectiles.push({
      kind: 'cryo',
      mesh,
      vel: dir.multiplyScalar(64),
      life: 1.4,
      bounced: false
    });
  } else if (cfg.primaryPowerId === 'emerald_plasma') {
    c.primaryCooldown = 0.22 * hasteMult;
    c.minifigure.triggerShoot();
    soundFX.playPlasticHit();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    mesh.position.copy(origin);
    rt.scene.add(mesh);
    const arcVel = dir.multiplyScalar(48);
    arcVel.y += 3.5;
    rt.projectiles.push({
      kind: 'emerald',
      mesh,
      vel: arcVel,
      life: 2.2,
      bounced: false
    });
  } else if (cfg.primaryPowerId === 'sonic_cannon') {
    c.primaryCooldown = 0.28 * hasteMult;
    c.minifigure.triggerShoot();
    soundFX.playTacticalRoll();
    for (let r = 0; r < 2; r++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: r === 0 ? 0x00f0ff : 0xf8fafc,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.55 + r * 0.25, 0.08, 8, 20), ringMat);
      ringMesh.position.copy(origin).addScaledVector(dir, r * 0.9);
      ringMesh.lookAt(aimPoint);
      rt.scene.add(ringMesh);
      rt.projectiles.push({
        kind: 'sonic',
        mesh: ringMesh,
        mat: ringMat,
        vel: dir.clone().multiplyScalar(54),
        life: 0.65,
        scaleRate: 5.5
      });
    }
    rt._damageConeAhead(c.position, c.facingAngle, 15.0, 75, true);
  } else {
    // gravity_fists: Combo veloz de socos gravitacionais dourados/roxos!
    c.primaryCooldown = 0.21 * hasteMult;
    c.minifigure.triggerPunch();
    soundFX.playLegoBreak(false);
    rt._spawnExpandingRing(origin, 0xc084fc, 8.5, 0.35);
    rt._damageConeAhead(c.position, c.facingAngle, 8.5, 115, true);
  }
}

export function handleCustomHeroSpacePress(rt, deltaTap) {
  const cfg = getActiveCustomHero();
  const c = rt.controller;

  if (!cfg.isCreated) {
    if (c.isGrounded) {
      c.velocity.y = c.jumpForce;
      c.isGrounded = false;
    }
    return true;
  }

  if (cfg.mobilityPowerId === 'jetpack_boost') {
    if (c.isFlying) {
      c.velocity.y = Math.max(c.velocity.y, 18.0);
    } else if (!c.isGrounded || deltaTap < 380) {
      c.isFlying = true;
      c.isGrounded = false;
      c.position.y += 0.7;
      c.velocity.y = 14.5;
      soundFX.playTacticalRoll();
    } else {
      c.velocity.y = c.jumpForce;
      c.isGrounded = false;
    }
    return true;
  }

  if (cfg.mobilityPowerId === 'triple_acrobat') {
    if (c.isGrounded) {
      rt.airJumpCount = 1;
      c.velocity.y = c.jumpForce * 1.15;
      c.isGrounded = false;
    } else if (rt.airJumpCount < 3) {
      rt.airJumpCount++;
      c.velocity.y = c.jumpForce * 1.22;
      c.minifigure.triggerTacticalRoll?.();
      soundFX.playTacticalRoll();
      rt._spawnExpandingRing(c.position, 0x38bdf8, 3.2, 0.28);
    }
    return true;
  }

  if (cfg.mobilityPowerId === 'light_hoverboard') {
    if (c.isGrounded && !rt.hoverboardActive && deltaTap >= 380) {
      c.velocity.y = c.jumpForce;
      c.isGrounded = false;
    } else {
      rt.hoverboardActive = !rt.hoverboardActive;
      if (rt.hoverboardActive) {
        c.position.y += 0.35;
        c.velocity.y = Math.max(c.velocity.y, 6.0);
      }
      soundFX.playHeroSwap();
    }
    return true;
  }

  if (cfg.mobilityPowerId === 'tactical_grapple') {
    if (c.isGrounded) {
      c.velocity.y = c.jumpForce;
      c.isGrounded = false;
    } else {
      c._triggerSombraGrapple?.();
    }
    return true;
  }
  return false;
}

export function triggerCustomHeroMobilityKey(rt) {
  const cfg = getActiveCustomHero();
  const c = rt.controller;
  if (!cfg.isCreated) return;

  if (cfg.mobilityPowerId === 'jetpack_boost') {
    c.isFlying = !c.isFlying;
    c.isSupersonic = false;
    if (c.isFlying) {
      c.isGrounded = false;
      c.position.y += 0.75;
      c.velocity.y = 13.0;
    }
    soundFX.playTacticalRoll();
  } else if (cfg.mobilityPowerId === 'light_hoverboard') {
    rt.hoverboardActive = !rt.hoverboardActive;
    soundFX.playHeroSwap();
  } else if (cfg.mobilityPowerId === 'tactical_grapple') {
    c._triggerSombraGrapple?.();
  } else if (cfg.mobilityPowerId === 'triple_acrobat') {
    c._triggerTacticalRoll?.();
  }
}

export function triggerCustomHeroSuperAbility(rt) {
  const cfg = getActiveCustomHero();
  const c = rt.controller;
  if (!cfg.isCreated || rt.superCooldown > 0) return;

  rt.superCooldown = 2.8;
  const aimData = rt.destructibles.getAimTargetPoint(c.camera, 65);
  const torsoHex = findPaletteColor(cfg.torsoColorId, 0).hex;

  if (cfg.superPowerId === 'singularity_orb') {
    soundFX.playTrueHeroFanfare();
    const spawnPos = c.position
      .clone()
      .add(new THREE.Vector3(Math.sin(c.facingAngle) * 9, 2.2, Math.cos(c.facingAngle) * 9));
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0x1e1b4b })
    );
    const accretion = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.28, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 })
    );
    accretion.rotation.x = Math.PI / 2.3;
    const group = new THREE.Group();
    group.add(core, accretion);
    group.position.copy(spawnPos);
    rt.scene.add(group);
    rt.singularities.push({ group, accretion, pos: spawnPos, timer: 2.35 });
  } else if (cfg.superPowerId === 'repulsor_dome') {
    soundFX.playLegoBreak(true);
    rt.shieldTimer = 4.5;
    rt._spawnExpandingRing(c.position.clone().add(new THREE.Vector3(0, 1.0, 0)), torsoHex, 22.0, 0.55);
    rt._damageRadius(c.position, 19.0, 185, true);
  } else if (cfg.superPowerId === 'lego_meteors') {
    soundFX.playTrueHeroFanfare();
    const center = aimData.point.clone();
    const groundY = rt.world.getTerrainHeightAt ? rt.world.getTerrainHeightAt(center.x, center.z) : 0;
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const rad = i === 0 ? 0 : 5.5;
      const tx = center.x + Math.cos(ang) * rad;
      const tz = center.z + Math.sin(ang) * rad;
      const meteor = createLegoBrick(1.8, 1.8, 1.8, i % 2 === 0 ? 0xf97316 : 0xef4444, { studStep: 0.6 });
      meteor.position.set(tx - 8, groundY + 34 + i * 7, tz - 6);
      rt.scene.add(meteor);
      rt.meteors.push({
        mesh: meteor,
        target: new THREE.Vector3(tx, groundY + 0.5, tz),
        speed: 44.0
      });
    }
  } else if (cfg.superPowerId === 'chrono_haste') {
    soundFX.playHeroSwap();
    rt.chronoTimer = 5.0;
    rt._spawnExpandingRing(c.position, 0x00f0ff, 10.0, 0.4);
  }
}

export function damageConeAhead(rt, origin, yaw, maxDist, damage, knockCars = false) {
  if (!rt.destructibles) return;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const candidates = rt.destructibles.getObjectsNear(origin.x, origin.z, maxDist + 2.0);
  for (let i = 0; i < candidates.length; i++) {
    const obj = candidates[i];
    if (obj.destroyed || obj.isDriven) continue;
    const dx = obj.mesh.position.x - origin.x;
    const dz = obj.mesh.position.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist || d < 0.01) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot > 0.38) {
      rt.destructibles.damageObject(obj, damage, origin, false, {
        canBreakCrackedWall: knockCars
      });
    }
  }
}

export function damageRadius(rt, center, radius, damage, canBreakHeavy = false) {
  if (!rt.destructibles) return;
  const candidates = rt.destructibles.getObjectsNear(center.x, center.z, radius + 2.0);
  for (let i = 0; i < candidates.length; i++) {
    const obj = candidates[i];
    if (obj.destroyed || obj.isDriven) continue;
    const d = Math.hypot(obj.mesh.position.x - center.x, obj.mesh.position.z - center.z);
    if (d <= radius) {
      rt.destructibles.damageObject(obj, damage, center, false, {
        canBreakCrackedWall: canBreakHeavy,
        canBreakSilver: canBreakHeavy
      });
    }
  }
}

export function spawnExpandingRing(rt, pos, hex, maxScale = 12.0, duration = 0.45) {
  const mat = new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(_OP09_RING_GEO, mat);
  mesh.position.set(pos.x, pos.y + 0.25, pos.z);
  rt.scene.add(mesh);
  rt.expandingRings.push({ mesh, mat, life: duration, maxLife: duration, maxScale });
}

export function spawnIceCrystalCluster(rt, pos) {
  const group = new THREE.Group();
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.1,
    transparent: true,
    opacity: 0.82
  });
  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(_OP09_ICE_SHARD_GEO, iceMat);
    shard.position.set((i - 1) * 0.42, 0.75, (i % 2) * 0.25);
    shard.rotation.z = (i - 1) * 0.28;
    group.add(shard);
  }
  group.position.set(pos.x, pos.y, pos.z);
  rt.scene.add(group);
  rt.iceCrystals.push({ group, mat: iceMat, life: 2.2 });
}

export function updateCustomHeroPowerRuntime(rt, dt) {
  const c = rt.controller;
  const mf = c.minifigure;
  const isOp09 = mf?.currentHeroKey === 'op09';
  const cfg = getActiveCustomHero();

  if (rt.superCooldown > 0) rt.superCooldown = Math.max(0, rt.superCooldown - dt);

  if (isOp09 && c.isGrounded) {
    rt.airJumpCount = 0;
  }

  // Chamas duplas do Jetpack e Flutuação da Prancha Hoverboard (inclusive sobre a água!)
  if (isOp09 && mf.op09JetFlames) {
    const showJet = Boolean(cfg.isCreated && c.isFlying);
    for (const fl of mf.op09JetFlames) {
      fl.visible = showJet;
      if (showJet) fl.scale.y = 0.8 + Math.random() * 0.5;
    }
  }

  if (isOp09 && mf.op09Hoverboard) {
    const showBoard = Boolean(cfg.isCreated && rt.hoverboardActive && !c.currentVehicle);
    mf.op09Hoverboard.visible = showBoard;
    if (showBoard) {
      const waterHere = rt.world.isDeepWaterAt?.(c.position.x, c.position.z, { forCar: true });
      if (waterHere) {
        const wy = (rt.world.getWaterSurfaceY?.(c.position.x, c.position.z) ?? -0.4) + 0.45;
        if (c.position.y <= wy + 0.25) {
          c.position.y = wy;
          c.velocity.y = Math.max(0, c.velocity.y);
          c.isGrounded = true;
        }
      }
    }
  }

  // Escudo Pessoal 360° e Clones Translúcidos da Aceleração Crono
  if (rt.shieldTimer > 0 && isOp09) {
    rt.shieldTimer -= dt;
    rt.personalShieldMesh.visible = rt.shieldTimer > 0;
    rt.personalShieldMesh.position.set(c.position.x, c.position.y + 1.05, c.position.z);
    rt.personalShieldMesh.rotation.y += dt * 2.5;
    rt.shieldMat.opacity = 0.35;
  } else {
    rt.personalShieldMesh.visible = false;
  }

  if (rt.chronoTimer > 0 && isOp09) {
    rt.chronoTimer -= dt;
    rt.chronoCloneTick -= dt;
    if (rt.chronoCloneTick <= 0 && c.getHorizontalSpeed() > 2.0) {
      rt.chronoCloneTick = 0.085;
      const cloneHex = findPaletteColor(cfg.torsoColorId, 0).hex;
      const ghostMat = new THREE.MeshBasicMaterial({
        color: cloneHex,
        transparent: true,
        opacity: 0.52
      });
      const ghost = new THREE.Mesh(_OP09_GHOST_GEO, ghostMat);
      ghost.position.set(c.position.x, c.position.y + 0.95, c.position.z);
      ghost.rotation.y = c.facingAngle;
      rt.scene.add(ghost);
      rt.afterimages.push({ mesh: ghost, mat: ghostMat, life: 0.38 });
    }
  }

  for (let i = rt.afterimages.length - 1; i >= 0; i--) {
    const a = rt.afterimages[i];
    a.life -= dt;
    a.mat.opacity = Math.max(0, a.life * 1.3);
    if (a.life <= 0) {
      rt.scene.remove(a.mesh);
      disposeTransientObject3D(a.mesh);
      rt.afterimages.splice(i, 1);
    }
  }

  // Projéteis (Raio Criogênico, Plasma Esmeralda Quicante e Onda Sônica)
  for (let i = rt.projectiles.length - 1; i >= 0; i--) {
    const p = rt.projectiles[i];
    p.life -= dt;
    if (p.kind === 'emerald') {
      p.vel.y -= 24.0 * dt;
    }
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.scaleRate) {
      p.mesh.scale.addScalar(p.scaleRate * dt);
      if (p.mat) p.mat.opacity = Math.max(0, p.life * 1.3);
    }

    const pos = p.mesh.position;
    const gY = rt.world.getTerrainHeightAt ? rt.world.getTerrainHeightAt(pos.x, pos.z) : 0;

    if (p.kind === 'emerald' && pos.y <= gY + 0.35) {
      if (!p.bounced) {
        // Quica 1 vez no chão!
        p.bounced = true;
        pos.y = gY + 0.36;
        p.vel.y = Math.abs(p.vel.y) * 0.72 + 5.0;
        rt._spawnExpandingRing(pos, 0x4ade80, 4.5, 0.25);
      } else {
        rt._spawnExpandingRing(pos, 0x22c55e, 9.5, 0.38);
        rt._damageRadius(pos, 7.5, 110, true);
        soundFX.playLegoBreak(false);
        p.life = 0;
      }
    } else if (p.kind === 'cryo' && pos.y <= gY + 0.25) {
      _OP09_TMP_VEC.set(pos.x, gY, pos.z);
      rt._spawnIceCrystalCluster(_OP09_TMP_VEC);
      rt._damageRadius(pos, 5.5, 90, false);
      p.life = 0;
    }

    if (p.life > 0 && p.kind !== 'sonic' && rt.destructibles) {
      const nearby = rt.destructibles.getObjectsNear(pos.x, pos.z, 6.0);
      for (let ni = 0; ni < nearby.length; ni++) {
        const obj = nearby[ni];
        if (obj.destroyed || obj.isDriven || obj.isAlliedToPlayer) continue;
        const d = Math.hypot(obj.mesh.position.x - pos.x, obj.mesh.position.z - pos.z);
        if (d <= obj.radius + 0.85 && Math.abs(pos.y - (obj.mesh.position.y + 1.0)) < 2.2) {
          rt.destructibles.damageObject(obj, 95, pos, false, { canBreakCrackedWall: true });
          if (p.kind === 'cryo') {
            _OP09_TMP_VEC.set(pos.x, obj.groundY || gY, pos.z);
            rt._spawnIceCrystalCluster(_OP09_TMP_VEC);
          } else {
            rt._spawnExpandingRing(pos, 0x22c55e, 7.5, 0.32);
          }
          p.life = 0;
          break;
        }
      }
    }

    if (p.life <= 0) {
      rt.scene.remove(p.mesh);
      disposeTransientObject3D(p.mesh);
      rt.projectiles.splice(i, 1);
    }
  }

  // Cristais de Gelo 3D temporários
  for (let i = rt.iceCrystals.length - 1; i >= 0; i--) {
    const ic = rt.iceCrystals[i];
    ic.life -= dt;
    ic.mat.opacity = Math.min(0.82, Math.max(0, ic.life * 0.6));
    if (ic.life <= 0) {
      rt.scene.remove(ic.group);
      disposeTransientObject3D(ic.group);
      rt.iceCrystals.splice(i, 1);
    }
  }

  // Anéis Expansivos
  for (let i = rt.expandingRings.length - 1; i >= 0; i--) {
    const r = rt.expandingRings[i];
    r.life -= dt;
    const u = 1.0 - Math.max(0, r.life / r.maxLife);
    r.mesh.scale.setScalar(1.0 + u * r.maxScale);
    r.mat.opacity = (1.0 - u) * 0.85;
    if (r.life <= 0) {
      rt.scene.remove(r.mesh);
      disposeTransientObject3D(r.mesh);
      rt.expandingRings.splice(i, 1);
    }
  }

  // Singularidades / Buracos Negros Portáteis (sugam objetos, carros e Studs num raio de 22m!)
  for (let i = rt.singularities.length - 1; i >= 0; i--) {
    const sg = rt.singularities[i];
    sg.timer -= dt;
    sg.accretion.rotation.z += dt * 9.0;

    if (rt.destructibles) {
      const nearby = rt.destructibles.getObjectsNear(sg.pos.x, sg.pos.z, 22.5);
      for (let ni = 0; ni < nearby.length; ni++) {
        const obj = nearby[ni];
        if (obj.destroyed || obj.isDriven || obj.goldOnly || obj.type === 'bank_vault_door') continue;
        const dx = sg.pos.x - obj.mesh.position.x;
        const dz = sg.pos.z - obj.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 22.0 && d > 1.4) {
          rt.destructibles.wakeObjectMatrix?.(obj.mesh);
          obj.mesh.position.x += (dx / d) * 14.0 * dt;
          obj.mesh.position.z += (dz / d) * 14.0 * dt;
          obj.basePos.copy(obj.mesh.position);
        }
      }
      // Magnetiza todos os Studs num raio de 22m!
      for (const studList of [rt.destructibles.studsList, rt.destructibles.ambientStuds]) {
        if (!Array.isArray(studList)) continue;
        for (const st of studList) {
          if (st.collected) continue;
          if (st.mesh.position.distanceTo(sg.pos) <= 22.0) {
            st.magnetized = true;
          }
        }
      }
    }

    if (sg.timer <= 0) {
      rt._spawnExpandingRing(sg.pos, 0xa855f7, 20.0, 0.5);
      rt._damageRadius(sg.pos, 14.0, 220, true);
      soundFX.playLegoBreak(true);
      rt.scene.remove(sg.group);
      disposeTransientObject3D(sg.group);
      rt.singularities.splice(i, 1);
    }
  }

  // Chuva de 5 Meteoros LEGO
  for (let i = rt.meteors.length - 1; i >= 0; i--) {
    const m = rt.meteors[i];
    _OP09_TMP_VEC.copy(m.target).sub(m.mesh.position);
    const dist = _OP09_TMP_VEC.length();
    m.mesh.rotation.x += dt * 6;
    m.mesh.rotation.y += dt * 5;
    if (dist <= m.speed * dt + 0.6) {
      rt._spawnExpandingRing(m.target, 0xf97316, 11.0, 0.42);
      rt._damageRadius(m.target, 9.5, 175, true);
      soundFX.playLegoBreak(true);
      rt.scene.remove(m.mesh);
      disposeTransientObject3D(m.mesh);
      rt.meteors.splice(i, 1);
    } else {
      m.mesh.position.addScaledVector(_OP09_TMP_VEC.multiplyScalar(1 / Math.max(0.001, dist)), m.speed * dt);
    }
  }
}
