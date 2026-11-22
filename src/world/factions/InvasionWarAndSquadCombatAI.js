import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { animateFactionSoldier } from '../../entities/FactionSoldierBuilder.js';
import { BANK_SPEC } from '../regions/SuperBankBuilder.js';
import { FACTION_THEME } from './TerritoryZonesAndConfigs.js';
import { updateAllyHqUnitBehavior } from './GarrisonPeaceAndAlliesAI.js';
import {
  ensureSharedWarGeometries,
  ALLY_BULLET_MAT,
  ROCKET_MAT,
  getFactionBulletMat
} from './CombatUnitsAndConvoys3D.js';

// ============================================================================
// IA TÁTICA DE COMBATE DE ESQUADRÕES 1X1, PROJÉTEIS, EXPLOSÕES RPG/C4 E BOSSES
// ============================================================================

export const invasionSquadCombatMethods = {
  _updateCombatUnitsAndHealBeams(dt, playerPos, controller, zoneState) {
    for (const beam of this.healBeams) {
      beam.visible = false;
    }
    const healState = { beamIdx: 0, playerBeingHealed: false };

    for (let i = this.combatNpcs.length - 1; i >= 0; i--) {
      const npc = this.combatNpcs[i];
      const obj = npc.destructible;
      if (!obj || obj.destroyed) {
        if (obj) this.destructibles.unregisterDestructible(obj);
        this.combatNpcs.splice(i, 1);
        continue;
      }

      const root = npc.visual.root;
      const pos = root.position;
      npc.visual.allyMarker.visible = npc.isAllied;
      npc.visual.allyMarker.rotation.y += dt * 2.8;
      animateFactionSoldier(npc.visual, this._animClock, npc.patrolAngle);

      if (npc.muzzleTimer > 0) {
        npc.muzzleTimer -= dt;
        if (npc.muzzleTimer <= 0) {
          npc.visual.muzzleFlash.visible = false;
        }
      }

      if (obj._signalMarkedTimer > 0) {
        obj._signalMarkedTimer = Math.max(0, obj._signalMarkedTimer - dt);
      }

      if (npc.stunTimer > 0) {
        npc.stunTimer = Math.max(0, npc.stunTimer - dt);
        npc.visual.muzzleFlash.visible = false;
        npc.visual.leftLeg.rotation.x *= 0.85;
        npc.visual.rightLeg.rotation.x *= 0.85;
        obj.basePos.copy(pos);
        continue;
      }

      // ======================================================================
      // MODO 1: QG ALIADO EM PAZ (Patrulha calma, Continência/Aceno e Cura!)
      // ======================================================================
      if (this.activeMode === 'ALLY_HQ') {
        updateAllyHqUnitBehavior(this, npc, dt, playerPos, healState);
        continue;
      }

      // ======================================================================
      // MODO 2: GUERRA DE INVASÃO 1X1 (SUA FACÇÃO vs FACÇÃO DONA DO TERRITÓRIO)
      // ======================================================================
      // Médico de Combate Aliado acompanha o jogador e cura com Feixe Médico 3D!
      if (npc.isAllied && npc.role === 'medic') {
        const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (this.livingCity.playerHp < this.livingCity.playerMaxHp && dPlayer < 20) {
          this._applyPlayerHeal(dt * 34, pos, playerPos, healState.beamIdx++);
          healState.playerBeingHealed = true;
        }
        if (dPlayer > 6.5) {
          const step = Math.min(dPlayer - 5.5, npc.speed * dt);
          const res = this.livingCity._resolveBuildingCollision(
            pos.x + ((playerPos.x - pos.x) / dPlayer) * step,
            pos.z + ((playerPos.z - pos.z) / dPlayer) * step,
            0.95
          );
          pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
          npc.walkPhase += dt * 8.5;
          npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.55;
          npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.55;
          obj.basePos.copy(pos);
          continue;
        }
      }

      // RECUO / CHEGADA: corre até o ponto designado antes de voltar a lutar
      if (npc.retreating && npc.patrolAnchor) {
        const rdx = npc.patrolAnchor.x - pos.x;
        const rdz = npc.patrolAnchor.z - pos.z;
        const rd = Math.hypot(rdx, rdz);
        if (rd < 3.2) {
          npc.retreating = false;
        } else {
          const step = Math.min(rd, npc.speed * 1.25 * dt);
          const res = this.livingCity._resolveBuildingCollision(
            pos.x + (rdx / rd) * step,
            pos.z + (rdz / rd) * step,
            npc.isBoss ? 1.85 : 0.95
          );
          if (res.collided && Math.hypot(res.x - pos.x, res.z - pos.z) < step * 0.2) {
            npc.retreating = false; // travou em parede: volta a lutar
          }
          pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          root.rotation.y = Math.atan2(rdx, rdz);
          npc.walkPhase += dt * 11;
          npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.7;
          npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.7;
          obj.basePos.copy(pos);
          continue;
        }
      }

      // Seleção de alvo 1x1 (Aliados focam Defensores; Defensores focam Aliados ou Jogador!)
      let bestTargetPos = null;
      let bestTargetNpc = null;
      let bestDist = 72;

      for (const other of this.combatNpcs) {
        if (other === npc || other.isAllied === npc.isAllied) continue;
        if (!other.destructible || other.destructible.destroyed) continue;
        const oPos = other.visual.root.position;
        if (Math.abs(oPos.y - pos.y) > 4.5) continue; // outro andar: não enxerga através da laje
        const d = Math.hypot(oPos.x - pos.x, oPos.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          bestTargetNpc = other;
          bestTargetPos = oPos;
        }
      }

      const isPlayerStealthed = Boolean(
        controller?.operatorAbilities?.isStealthed?.() || (controller?.stealthTimer || 0) > 0
      );
      if (!npc.isAllied && !isPlayerStealthed) {
        const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (dPlayer < bestDist * 0.92 && dPlayer < 65 && Math.abs(playerPos.y - pos.y) < 4.5) {
          bestDist = dPlayer;
          bestTargetNpc = null;
          bestTargetPos = playerPos;
        }
      }

      // Movimento tático (Aliados avançam junto com o jogador quando sem alvo próximo)
      let moveTarget = bestTargetPos;
      let stopRange = npc.isBoss ? 14.0 : 16.5;
      if (!moveTarget && npc.isAllied && this.activeMode === 'BANK_HEIST') {
        // Seu time segue você no mesmo andar; em outro andar, segura a posição
        moveTarget = Math.abs(playerPos.y - pos.y) < 3 ? playerPos : npc.patrolAnchor;
        stopRange = 5;
      } else if (!moveTarget && npc.isAllied && zoneState && this.activeMode === 'COUNTER_ATTACK') {
        // Defesa da bandeira: aliados seguram o pátio
        moveTarget = npc.patrolAnchor || zoneState.spec.bossCourtyard;
        stopRange = 4.5;
      } else if (!moveTarget && npc.isAllied && zoneState) {
        // Aliados avançam para o objetivo ativo da sequência
        const nextOp = zoneState.outposts[zoneState.activeIndex];
        const court = zoneState.bossPhaseTriggered ? zoneState.spec.bossCourtyard : null;
        moveTarget = nextOp ? { x: nextOp.x, z: nextOp.z } : court || playerPos;
        stopRange = 6.5;
      } else if (!moveTarget && !npc.isAllied && npc.patrolAnchor) {
        // Defensor sem alvo volta a guardar o seu ponto
        moveTarget = npc.patrolAnchor;
        stopRange = 3.5;
      }
      // Especialista C4: corre direto no alvo para detonar
      if (npc.role === 'special' && npc.faction === 'pcc' && bestTargetPos && !npc.isAllied) {
        stopRange = 1.2;
      }

      if (moveTarget) {
        const dx = moveTarget.x - pos.x;
        const dz = moveTarget.z - pos.z;
        const dist = Math.hypot(dx, dz);
        root.rotation.y = Math.atan2(dx, dz);

        if (dist > stopRange) {
          const step = Math.min(dist - stopRange * 0.85, npc.speed * dt);
          const res = this.livingCity._resolveBuildingCollision(
            pos.x + (dx / dist) * step,
            pos.z + (dz / dist) * step,
            npc.isBoss ? 1.85 : 0.95
          );
          pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          npc.walkPhase += dt * (npc.isBoss ? 6.0 : 8.5);
          npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.55;
          npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.55;
        } else {
          npc.visual.leftLeg.rotation.x *= 0.85;
          npc.visual.rightLeg.rotation.x *= 0.85;
        }
      }

      // Ataque Especial de Terremoto dos Bosses Colossais Big-Fig
      if ((npc.isBoss || npc.heavyClass === 'brute') && bestTargetPos && bestDist < 12.5) {
        npc.slamCooldown -= dt;
        if (npc.slamCooldown <= 0) {
          npc.slamCooldown = 5.2;
          this._triggerBossGroundSlam(
            npc,
            bestTargetPos === playerPos ? controller : null,
            playerPos
          );
        }
      }

      // Demolidor C4 do PCC: detona ao encostar no alvo
      if (npc.role === 'special' && npc.faction === 'pcc' && bestTargetPos && bestDist < 3.4) {
        this._detonateC4Runner(
          npc,
          bestTargetPos === playerPos ? controller : null,
          playerPos,
          zoneState
        );
        continue;
      }

      // Disparo com verificação estrita de Linha de Visão (Zero tiro através de paredes!)
      npc.fireCooldown -= dt;
      if (bestTargetPos && bestDist < 54 && npc.fireCooldown <= 0) {
        npc.fireCooldown =
          npc.heavyClass === 'elite'
            ? 0.2 // atira pra caramba
            : npc.heavyClass === 'brute'
              ? 0.75
              : npc.isBoss
                ? 0.55
                : npc.role === 'tank'
                  ? 0.95
                  : npc.role === 'special'
                    ? npc.faction === 'cv'
                      ? 3.2 // RPG: lento e pesado
                      : npc.faction === 'ares'
                        ? 0.42 // drone: rajada rápida
                        : 1.1
                    : 0.82 + Math.random() * 0.35;
        if (this._hasClearLineOfSight(pos.x, pos.z, bestTargetPos.x, bestTargetPos.z)) {
          this._fireUnitProjectile(npc, bestTargetPos, bestTargetNpc);
        }
      }

      obj.basePos.copy(pos);
    }

    if (!healState.playerBeingHealed && this.hud?.heartsContainer) {
      this.hud.heartsContainer.classList.remove('healing-pulse');
    }
  },

  _fireUnitProjectile(npc, targetPos, targetNpc) {
    const geos = ensureSharedWarGeometries();
    const theme = FACTION_THEME[npc.faction] || FACTION_THEME.cv;
    const origin = npc.visual.root.position;
    const isRpg = npc.role === 'special' && npc.faction === 'cv';
    const isDrone = npc.role === 'special' && npc.faction === 'ares' && npc.visual.drone;
    const startY =
      origin.y +
      (npc.isBoss ? 3.1 : npc.hitH ? npc.hitH * 0.6 : isDrone ? 2.7 : isRpg ? 1.62 : 1.38);
    const targetY = (targetPos.y ?? origin.y) + (targetNpc?.isBoss ? 2.6 : 1.2);

    const dir = new THREE.Vector3(
      targetPos.x - origin.x + (Math.random() - 0.5) * 1.4,
      targetY - startY,
      targetPos.z - origin.z + (Math.random() - 0.5) * 1.4
    ).normalize();

    const bulletMesh = new THREE.Mesh(
      isRpg ? geos.rocketGeo : geos.bulletGeo,
      isRpg
        ? ROCKET_MAT
        : npc.isAllied
          ? ALLY_BULLET_MAT
          : getFactionBulletMat(npc.faction, theme.hex)
    );
    bulletMesh.position.set(origin.x + dir.x * 1.1, startY, origin.z + dir.z * 1.1);
    bulletMesh.lookAt(bulletMesh.position.clone().add(dir));
    this.scene.add(bulletMesh);

    npc.visual.muzzleFlash.visible = true;
    npc.muzzleTimer = 0.08;

    this.npcProjectiles.push({
      mesh: bulletMesh,
      originPos: bulletMesh.position.clone(),
      vel: dir.multiplyScalar(npc.isBoss ? 48 : isRpg ? 26 : 42),
      isAllied: npc.isAllied,
      damage:
        npc.heavyClass === 'elite'
          ? 6
          : npc.heavyClass === 'brute'
            ? 13
            : npc.isBoss
              ? 16
              : isRpg
                ? 22
                : isDrone
                  ? 4
                  : npc.faction === 'guard'
                    ? 5
                    : npc.role === 'tank'
                      ? 11
                      : 8,
      splash: isRpg ? 5.5 : 0,
      life: isRpg ? 2.4 : 1.45
    });
  },

  _triggerBossGroundSlam(bossNpc, controller, playerPos) {
    const geos = ensureSharedWarGeometries();
    const theme = FACTION_THEME[bossNpc.faction] || FACTION_THEME.cv;
    const bPos = bossNpc.visual.root.position;

    const ringMat = new THREE.MeshBasicMaterial({
      color: theme.hex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(geos.shockwaveGeo, ringMat);
    ringMesh.position.set(bPos.x, bPos.y + 0.25, bPos.z);
    this.scene.add(ringMesh);
    this.activeShockwaves.push({ mesh: ringMesh, mat: ringMat, scale: 1.0, life: 0.55 });

    // Dano em área nos oponentes próximos
    for (const other of this.combatNpcs) {
      if (
        other.isAllied === bossNpc.isAllied ||
        !other.destructible ||
        other.destructible.destroyed
      ) {
        continue;
      }
      const d = Math.hypot(
        other.visual.root.position.x - bPos.x,
        other.visual.root.position.z - bPos.z
      );
      if (d < 11.5) {
        this.destructibles.damageObject(other.destructible, 65, bPos, false, {
          fromEnemyNpc: true
        });
      }
    }

    if (!bossNpc.isAllied && playerPos) {
      const dp = Math.hypot(playerPos.x - bPos.x, playerPos.z - bPos.z);
      if (dp < 10.5 && Math.abs(playerPos.y - bPos.y) < 3.5) {
        this._damagePlayerInInvasion(18, controller, null, bPos);
      }
    }
  },

  _updateProjectilesAndShockwaves(dt, playerPos, controller, zoneState) {
    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];
      sw.life -= dt;
      sw.scale += dt * (sw.isFlash ? 9.0 : 18.0);
      sw.mesh.scale.setScalar(sw.scale);
      sw.mat.opacity = Math.max(0, sw.life * (sw.isFlash ? 2.2 : 1.6));
      if (sw.life <= 0) {
        if (sw.mesh.parent) sw.mesh.parent.remove(sw.mesh);
        sw.mat.dispose?.();
        this.activeShockwaves.splice(i, 1);
      }
    }

    for (let i = this.npcProjectiles.length - 1; i >= 0; i--) {
      const p = this.npcProjectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      const px = p.mesh.position.x;
      const py = p.mesh.position.y;
      const pz = p.mesh.position.z;

      if (p.life <= 0 || this.livingCity._isInsideBuilding(px, pz, 0.15)) {
        if (p.splash) {
          this._npcExplosion(p.mesh.position, p.splash, p.damage, p.isAllied, controller, zoneState);
        }
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
        continue;
      }

      if (!p.isAllied && controller?.operatorAbilities?.isProjectileBlocked?.(p.mesh.position, p.originPos)) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const npc of this.combatNpcs) {
        if (npc.isAllied === p.isAllied || !npc.destructible || npc.destructible.destroyed) continue;
        const nPos = npc.visual.root.position;
        const hitR = npc.hitR ?? (npc.isBoss ? 2.3 : 1.05);
        const hitH = npc.hitH ?? (npc.isBoss ? 5.0 : 2.3);
        if (
          Math.abs(px - nPos.x) < hitR &&
          Math.abs(pz - nPos.z) < hitR &&
          py >= nPos.y &&
          py <= nPos.y + hitH
        ) {
          this.destructibles.damageObject(
            npc.destructible,
            p.damage * 2.2,
            p.mesh.position,
            false,
            { fromEnemyNpc: true }
          );
          hit = true;
          break;
        }
      }

      if (!hit && !p.isAllied && this.isInvasionActive && playerPos) {
        if (
          Math.abs(px - playerPos.x) < 0.95 &&
          Math.abs(pz - playerPos.z) < 0.95 &&
          py >= playerPos.y - 0.2 &&
          py <= playerPos.y + 2.3
        ) {
          this._damagePlayerInInvasion(p.damage, controller, zoneState, p.originPos || p.mesh.position);
          hit = true;
        }
      }

      if (hit) {
        if (p.splash) {
          this._npcExplosion(p.mesh.position, p.splash, p.damage, p.isAllied, controller, zoneState);
        }
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
      }
    }
  },

  /**
   * Explosão de facção (RPG / C4): só fere o lado oposto e o jogador (se vier do inimigo).
   */
  _npcExplosion(center, radius, damage, fromAllied, controller, zoneState) {
    const geos = ensureSharedWarGeometries();
    soundFX.playExplosion(0.85);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.9
    });
    const flash = new THREE.Mesh(geos.blastGeo, flashMat);
    flash.position.copy(center);
    this.scene.add(flash);
    this.activeShockwaves.push({
      mesh: flash,
      mat: flashMat,
      scale: 0.6,
      life: 0.4,
      isFlash: true
    });

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geos.shockwaveGeo, ringMat);
    ring.position.set(center.x, center.y - 0.6, center.z);
    this.scene.add(ring);
    this.activeShockwaves.push({ mesh: ring, mat: ringMat, scale: 1.0, life: 0.45 });

    for (const other of this.combatNpcs) {
      if (other.isAllied === fromAllied || !other.destructible || other.destructible.destroyed) {
        continue;
      }
      const op = other.visual.root.position;
      const d = Math.hypot(op.x - center.x, op.z - center.z);
      if (d < radius) {
        this.destructibles.damageObject(
          other.destructible,
          damage * 3 * (1 - d / (radius * 1.4)),
          center,
          false,
          { fromEnemyNpc: true }
        );
      }
    }
    const pp = this._lastController?.position;
    if (!fromAllied && pp) {
      const dp = Math.hypot(pp.x - center.x, pp.z - center.z);
      if (dp < radius && Math.abs(pp.y - center.y) < 4) {
        this._damagePlayerInInvasion(damage * (1 - dp / (radius * 1.3)), controller, zoneState, center);
      }
    }
  },

  _detonateC4Runner(npc, controller, playerPos, zoneState) {
    const pos = npc.visual.root.position.clone();
    pos.y += 1.0;
    this._npcExplosion(pos, 6.5, 30, npc.isAllied, controller, zoneState);
    if (npc.destructible && !npc.destructible.destroyed) {
      this.destructibles.damageObject(npc.destructible, 99999, pos, false, { fromEnemyNpc: true });
    }
  },

  _damagePlayerInInvasion(amount, controller, zoneState = null, attackerPos = null) {
    if (!this.isInvasionActive || amount <= 0) return;
    if (controller?.operatorAbilities?.isStealthed?.() && attackerPos && controller?.position) {
      const dist = Math.hypot(attackerPos.x - controller.position.x, attackerPos.z - controller.position.z);
      if (dist > 6.0) return;
    }
    const baseDmg = controller?.currentVehicle ? amount * 0.35 : amount;
    const dmg = this.livingCity?.applyMitigatedDamageToPlayer
      ? this.livingCity.applyMitigatedDamageToPlayer(baseDmg, controller, { attackerPos })
      : baseDmg;
    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - dmg);
    this.hud?.setPlayerHealth(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);

    if (this.livingCity.playerHp <= 0) {
      if (controller) this._lastController = controller;
      if (this.activeMode === 'BANK_HEIST' && this.bankHeist.isActive) {
        const c = this._lastController;
        const sx = 0;
        const sz = BANK_SPEC.frontZ + 14;
        this.bankHeist.onPlayerDown();
        this.livingCity.playerHp = this.livingCity.playerMaxHp;
        this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
        if (c?.position) {
          if (c.currentVehicle) c.exitVehicle?.();
          c.position.set(sx, this._groundAt(sx, sz, 1) + 0.5, sz);
          c.velocity?.set(0, 0, 0);
          if (c.minifigure?.root) c.minifigure.root.position.copy(c.position);
        }
        return;
      }
      if (this.activeMode === 'COUNTER_ATTACK' && this.counterAttack.isActive) {
        this.counterAttack._lose('VOCÊ CAIU DEFENDENDO A BANDEIRA');
        return;
      }
      this._failInvasion(
        zoneState || this.territories[this.activeZoneId],
        'VOCÊ CAIU!',
        'RECUO TÁTICO PARA O PORTÃO // OS POSTOS VOLTARAM AO DONO'
      );
    }
  }
};
