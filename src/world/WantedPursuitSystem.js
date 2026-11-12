import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from './BuildingGenerator.js';
import { VEHICLE_SPECS, createLegoCarMesh } from './VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from './MetroSystemBuilder.js';
import { soundFX } from '../audio/SoundFX.js';

// ============================================================================
// CONSTANTES DE ESCALADA GTA (0 A 5 ESTRELAS) & GEOMETRIAS 3D COMPARTILHADAS
// ============================================================================
export const WANTED_STAR_THRESHOLDS = [0, 100, 230, 400, 620, 900];

export const WANTED_TIER_INFO = {
  0: { stars: 0, label: 'CIDADE PACÍFICA', division: 'PATRULHA CIVIL' },
  1: { stars: 1, label: 'PATRULHA LOCAL', division: '190 // RP LOCAL' },
  2: { stars: 2, label: 'CERCO URBANO', division: 'INTERCEPTOR V8 // PIT' },
  3: { stars: 3, label: 'BLOQUEIO & ÁGUIA', division: 'GRUPAMENTO AÉREO ÁGUIA' },
  4: { stars: 4, label: 'CHOQUE PESADO', division: 'BOPE // CAVEIRÃO BLINDADO' },
  5: { stars: 5, label: 'CAÇADORES ANTI-HERÓI', division: 'DIVISÃO ESPECIAL // EXO-DRONES' }
};

let SHARED_PURSUIT_GEOS = null;

function getSharedPursuitGeos() {
  if (SHARED_PURSUIT_GEOS) return SHARED_PURSUIT_GEOS;

  // Giroflex Policial (Base + Cúpula Vermelha + Cúpula Azul)
  const lightbarBaseGeo = makeTranslatedBox(1.15, 0.1, 0.34, 0, 0, 0);
  const lightbarRedGeo = makeTranslatedBox(0.46, 0.16, 0.3, -0.32, 0.11, 0);
  const lightbarBlueGeo = makeTranslatedBox(0.46, 0.16, 0.3, 0.32, 0.11, 0);

  // Minifigura Policial / Choque / Exoesqueleto Anti-Herói (compacta e super leve a 60 FPS!)
  const officerBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(0.32, 0.56, 0.34, -0.19, 0.28, 0),
    makeTranslatedBox(0.32, 0.56, 0.34, 0.19, 0.28, 0),
    makeTranslatedBox(0.76, 0.72, 0.42, 0, 0.92, 0),
    makeTranslatedBox(0.22, 0.56, 0.24, -0.5, 0.94, 0.12),
    makeTranslatedBox(0.22, 0.56, 0.24, 0.5, 0.94, 0.18)
  ]);
  const officerHeadGeo = mergeBufferGeometries([
    (() => {
      const h = new THREE.CylinderGeometry(0.29, 0.29, 0.38, 12);
      h.translate(0, 1.48, 0);
      return h;
    })(),
    (() => {
      const cap = new THREE.CylinderGeometry(0.34, 0.33, 0.14, 12);
      cap.translate(0, 1.72, 0.03);
      return cap;
    })()
  ]);
  const officerGunGeo = makeTranslatedBox(0.14, 0.18, 0.68, 0.5, 0.92, 0.48);
  const riotShieldGeo = makeTranslatedBox(0.78, 1.25, 0.1, -0.48, 0.88, 0.38);

  // Exoesqueleto Caçador de Super-Humanos (Big-Fig Tecnológico 5 Estrelas!)
  const exoArmorGeo = mergeBufferGeometries([
    makeTranslatedBox(0.52, 0.92, 0.54, -0.34, 0.46, 0),
    makeTranslatedBox(0.52, 0.92, 0.54, 0.34, 0.46, 0),
    makeTranslatedBox(1.36, 1.18, 0.78, 0, 1.52, 0),
    makeTranslatedBox(0.42, 0.95, 0.44, -0.92, 1.55, 0.18),
    makeTranslatedBox(0.42, 0.95, 0.44, 0.92, 1.55, 0.24),
    // Lançadores de Mísseis nos Ombros
    makeTranslatedBox(0.44, 0.38, 0.62, -0.68, 2.24, -0.05),
    makeTranslatedBox(0.44, 0.38, 0.62, 0.68, 2.24, -0.05),
    (() => {
      const helm = new THREE.CylinderGeometry(0.42, 0.46, 0.52, 10);
      helm.translate(0, 2.34, 0.04);
      return helm;
    })()
  ]);
  const exoVisorGeo = mergeBufferGeometries([
    makeTranslatedBox(0.68, 0.18, 0.14, 0, 2.36, 0.44),
    makeTranslatedBox(0.52, 0.36, 0.12, 0, 1.58, 0.42),
    makeTranslatedBox(0.28, 0.28, 0.88, 0.92, 1.48, 0.68)
  ]);

  // Helicóptero Policial Tático "ÁGUIA" (3–5 Estrelas)
  const heliHullGeo = mergeBufferGeometries([
    makeTranslatedBox(2.2, 1.85, 4.6, 0, 0, 0.35),
    makeTranslatedBox(1.65, 1.25, 1.8, 0, -0.2, 3.15),
    makeTranslatedBox(0.68, 0.72, 4.8, 0, 0.28, -4.15),
    makeTranslatedBox(0.22, 1.65, 1.15, 0, 0.85, -6.25),
    // Esquis de pouso
    makeTranslatedBox(0.18, 0.18, 4.2, -1.25, -1.35, 0.4),
    makeTranslatedBox(0.18, 0.18, 4.2, 1.25, -1.35, 0.4),
    makeTranslatedBox(0.16, 0.62, 0.16, -1.15, -1.02, 1.4),
    makeTranslatedBox(0.16, 0.62, 0.16, 1.15, -1.02, 1.4),
    makeTranslatedBox(0.16, 0.62, 0.16, -1.15, -1.02, -0.8),
    makeTranslatedBox(0.16, 0.62, 0.16, 1.15, -1.02, -0.8)
  ]);
  const heliCanopyGeo = makeTranslatedBox(1.85, 1.05, 1.75, 0, 0.22, 2.55);
  const heliRotorGeo = mergeBufferGeometries([
    makeTranslatedBox(9.6, 0.08, 0.42, 0, 0, 0),
    makeTranslatedBox(0.42, 0.08, 9.6, 0, 0, 0),
    (() => {
      const hub = new THREE.CylinderGeometry(0.28, 0.28, 0.35, 10);
      return hub;
    })()
  ]);

  // Cone Branco Volumétrico do Holofote Noturno (Altura normalizada = 1.0, vértice em Y=0 apontando p/ baixo!)
  const spotlightConeGeo = (() => {
    const g = new THREE.ConeGeometry(1.0, 1.0, 16, 1, true);
    // Cone padrão tem ponta em +0.5 e base em -0.5 -> translada -0.5 em Y p/ ponta ficar em Y=0 (helicóptero) e base aberta em Y=-1 (chão)!
    g.translate(0, -0.5, 0);
    return g;
  })();
  const spotlightDiscGeo = (() => {
    const d = new THREE.CircleGeometry(1.0, 20);
    d.rotateX(-Math.PI / 2);
    return d;
  })();

  // Drone Rápido Caçador Anti-Herói (5 Estrelas)
  const droneBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(1.35, 0.42, 1.55, 0, 0, 0),
    makeTranslatedBox(2.45, 0.12, 0.22, 0, 0.12, 0.68),
    makeTranslatedBox(2.45, 0.12, 0.22, 0, 0.12, -0.68),
    (() => {
      const r1 = new THREE.TorusGeometry(0.45, 0.07, 6, 12);
      r1.rotateX(Math.PI / 2);
      r1.translate(-1.22, 0.14, 0.68);
      return r1;
    })(),
    (() => {
      const r2 = new THREE.TorusGeometry(0.45, 0.07, 6, 12);
      r2.rotateX(Math.PI / 2);
      r2.translate(1.22, 0.14, 0.68);
      return r2;
    })(),
    (() => {
      const r3 = new THREE.TorusGeometry(0.45, 0.07, 6, 12);
      r3.rotateX(Math.PI / 2);
      r3.translate(-1.22, 0.14, -0.68);
      return r3;
    })(),
    (() => {
      const r4 = new THREE.TorusGeometry(0.45, 0.07, 6, 12);
      r4.rotateX(Math.PI / 2);
      r4.translate(1.22, 0.14, -0.68);
      return r4;
    })()
  ]);
  const droneEyeGeo = makeTranslatedBox(0.55, 0.2, 0.2, 0, -0.02, 0.82);

  // Rampa de Salto LEGO das Barreiras Policiais (3+ Estrelas)
  const roadblockRampGeo = (() => {
    const g = new THREE.BoxGeometry(4.2, 0.35, 5.6);
    g.rotateX(-0.32);
    g.translate(0, 0.88, 0);
    const support = makeTranslatedBox(4.0, 1.55, 0.8, 0, 0.78, 2.2);
    return mergeBufferGeometries([g, support]);
  })();

  // Cones / Barricadas Policiais
  const rbBarricadeGeo = mergeBufferGeometries([
    makeTranslatedBox(2.2, 0.34, 0.22, 0, 0.88, 0),
    makeTranslatedBox(0.18, 1.05, 0.62, -0.88, 0.52, 0),
    makeTranslatedBox(0.18, 1.05, 0.62, 0.88, 0.52, 0),
    (() => {
      const s1 = SHARED_STUD_GEO.clone();
      s1.translate(-0.6, 1.1, 0);
      return s1;
    })(),
    (() => {
      const s2 = SHARED_STUD_GEO.clone();
      s2.translate(0.6, 1.1, 0);
      return s2;
    })()
  ]);

  // Míssil Teleguiado & Rede Energética (5 Estrelas)
  const missileGeo = (() => {
    const body = new THREE.CylinderGeometry(0.12, 0.14, 1.15, 8);
    body.rotateX(Math.PI / 2);
    const tip = new THREE.ConeGeometry(0.14, 0.38, 8);
    tip.rotateX(Math.PI / 2);
    tip.translate(0, 0, 0.74);
    return mergeBufferGeometries([body, tip]);
  })();

  const energyNetProjectileGeo = new THREE.IcosahedronGeometry(0.65, 1);
  const energyCageGeo = new THREE.IcosahedronGeometry(1.75, 1);
  const policeBulletGeo = (() => {
    const b = new THREE.CylinderGeometry(0.055, 0.055, 0.78, 6);
    b.rotateX(Math.PI / 2);
    return b;
  })();

  SHARED_PURSUIT_GEOS = {
    lightbarBaseGeo,
    lightbarRedGeo,
    lightbarBlueGeo,
    officerBodyGeo,
    officerHeadGeo,
    officerGunGeo,
    riotShieldGeo,
    exoArmorGeo,
    exoVisorGeo,
    heliHullGeo,
    heliCanopyGeo,
    heliRotorGeo,
    spotlightConeGeo,
    spotlightDiscGeo,
    droneBodyGeo,
    droneEyeGeo,
    roadblockRampGeo,
    rbBarricadeGeo,
    missileGeo,
    energyNetProjectileGeo,
    energyCageGeo,
    policeBulletGeo
  };

  return SHARED_PURSUIT_GEOS;
}

// Interseção rápida Segmento 2D vs AABB (detecta esconderijos atrás de prédios e becos da Favela!)
function segmentIntersectsRect2D(ax, az, bx, bz, minX, maxX, minZ, maxZ) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;

  const clip = (p, q) => {
    if (Math.abs(p) < 1e-6) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return (
    clip(-dx, ax - minX) &&
    clip(dx, maxX - ax) &&
    clip(-dz, az - minZ) &&
    clip(dz, maxZ - az) &&
    t0 <= t1
  );
}

// ============================================================================
// GERENCIADOR PRINCIPAL: SISTEMA DE PROCURADO ESCALÁVEL (1 A 5 ESTRELAS) + FUGA
// ============================================================================
export class WantedPursuitSystem {
  constructor(livingCity) {
    this.livingCity = livingCity;
    this.world = livingCity.world;
    this.scene = livingCity.scene;
    this.destructibles = livingCity.destructibles;
    this.hud = livingCity.hud;

    this.stars = 0;
    this.chaosScore = 0;
    this._hasLineOfSight = false;
    this.isEscaping = false;
    this.escapeTimer = 0;
    this.escapeDuration = 18.0;

    // Vida e Regeneração Tática na Perseguição (6s sem tomar tiro regenera os 4 Corações!)
    this.timeSinceLastDamage = 99.0;
    this.playerHitIFrameTimer = 0;

    // Forças Policiais & Anti-Herói Ativas
    this.pursuitVehicles = [];
    this.footUnits = [];
    this.roadblocks = [];
    this.eagleHeli = null;
    this.eagleHeliRespawnCooldown = 0;
    this.hunterDrones = [];
    this.enemyProjectiles = []; // tiros policiais, redes energéticas e mísseis teleguiados!
    this.energyCageMesh = null;

    // Timers internos (60 FPS cravados)
    this._spawnTickTimer = 0.6;
    this._pursuitEngageGraceTimer = 0;
    this._consecutivePropsDestroyed = 0;
    this._propComboResetTimer = 0;
    this._roadblockCooldown = 8.0;
    this._sirenPulseTimer = 0;
    this._strobeClock = 0;
    this._lastPlayerPos = new THREE.Vector3();
    this._lastKnownPlayerPos = new THREE.Vector3();
    this._playerVelDir = new THREE.Vector3(0, 0, 1);

    this._initSharedMaterials();
    this._bindDestructibleChaosHooks();
  }

  _initSharedMaterials() {
    this.mats = {
      policeBlack: getLegoMaterial(0x111827),
      policeWhite: getLegoMaterial(LEGO_COLORS.white),
      policeBlue: getLegoMaterial(0x1d4ed8),
      bopeGold: getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.2 }),
      skinYellow: getLegoMaterial(LEGO_COLORS.yellow),
      gunSteel: getLegoMaterial(LEGO_COLORS.charcoal, { metalness: 0.45 }),
      riotShield: getLegoMaterial(0x38bdf8, { transparent: true, opacity: 0.62, roughness: 0.1 }),
      exoArmor: getLegoMaterial(0x0f172a, { metalness: 0.68, roughness: 0.18 }),
      exoNeon: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      exoRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      strobeRedOn: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
      strobeBlueOn: new THREE.MeshBasicMaterial({ color: 0x2563eb }),
      strobeOff: getLegoMaterial(0x1e293b),
      heliGlass: getLegoMaterial(0x38bdf8, { transparent: true, opacity: 0.55, roughness: 0.08 }),
      spotlightCone: new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      spotlightDisc: new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      orangePlastic: getLegoMaterial(LEGO_COLORS.orange),
      yellowHazard: getLegoMaterial(LEGO_COLORS.yellow),
      policeBullet: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      missileBody: getLegoMaterial(0xe11d48, { emissive: 0xbe123c, emissiveIntensity: 0.5 }),
      energyNetWire: new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.92
      })
    };
  }

  _bindDestructibleChaosHooks() {
    if (!this.destructibles) return;

    const prevDamaged = this.destructibles.onObjectDamaged;
    this.destructibles.onObjectDamaged = (obj, dmg, hitOrigin, opts) => {
      if (typeof prevDamaged === 'function') prevDamaged(obj, dmg, hitOrigin, opts);
      this._handlePlayerDamagedObject(obj, dmg);
    };

    const prevDestroyed = this.destructibles.onObjectDestroyed;
    this.destructibles.onObjectDestroyed = (obj, hitOrigin, opts) => {
      if (typeof prevDestroyed === 'function') prevDestroyed(obj, hitOrigin, opts);
      this._handlePlayerDestroyedObject(obj);
    };
  }

  // ==========================================================================
  // 1. CONTROLE DE CAOS & ESCALADA DE ESTRELAS (0 A 5 ESTRELAS)
  // ==========================================================================
  _isFactionWarContext(obj) {
    if (obj?.isFactionWarUnit) return true;
    if (this.livingCity?.factionWar?.isInvasionActive && !obj?.isPoliceUnit) return true;
    return false;
  }

  _handlePlayerDamagedObject(obj, dmg) {
    if (!obj || obj.isDriven || this._isFactionWarContext(obj)) return;

    const carType = obj.mesh?.userData?.carType || '';
    const isPoliceTarget =
      Boolean(obj.isPoliceUnit) ||
      carType === 'interceptor_v8' ||
      carType === 'caveirao_bope';

    // Atacar viatura / policial deliberadamente já chama atenção policial!
    if (isPoliceTarget && dmg >= 22) {
      this.addChaos(Math.max(52, dmg * 0.9), true);
    }
  }

  _handlePlayerDestroyedObject(obj) {
    if (!obj || this._isFactionWarContext(obj)) return;

    const carType = obj.mesh?.userData?.carType || '';
    const isPoliceTarget =
      Boolean(obj.isPoliceUnit) ||
      obj.type === 'police_helicopter' ||
      obj.type === 'hunter_drone' ||
      carType === 'interceptor_v8' ||
      carType === 'caveirao_bope';

    if (isPoliceTarget) {
      // Destruir viatura / helicóptero Águia / unidade policial sobe muito o nível de procurado!
      this.addChaos(120, true);
      return;
    }

    if (obj.type === 'car') {
      // Destruir 1 carro por acidente = 54 (< 100, ainda 0★); destruir 2+ carros em sequência acende 1★ -> 5★!
      this.addChaos(54, true);
      return;
    }

    if (obj.type === 'atm_machine') {
      // Explodir Caixas Eletrônicos LEGO em sequência chama a polícia!
      this.addChaos(56, true);
      return;
    }

    if (obj.type === 'gas_pump' || obj.type === 'fuel_truck' || obj.type === 'bank_vault_door') {
      this.addChaos(125, true);
      return;
    }

    if (obj.isStreetProp) {
      this._consecutivePropsDestroyed = (this._consecutivePropsDestroyed || 0) + 1;
      this._propComboResetTimer = 14.0;

      // Quebrar 1 a 4 pequenos objetos por acidente soma calor moderado (< 100, sem acionar 1★);
      // a partir do 5º objeto seguido, cada prop destruído soma +38 de chaosScore com isMajorCrime = true,
      // acionando 1★ no 5º objeto e permitindo escalar de 0★ até 5★ destruindo a cidade!
      if (this.stars === 0 && this._consecutivePropsDestroyed <= 3) {
        this.chaosScore = Math.min(85, this.chaosScore + 14);
      } else if (this.stars === 0 && this._consecutivePropsDestroyed === 4) {
        this.chaosScore = Math.min(85, this.chaosScore + 30);
      } else {
        const propChaos = Math.max(38, Math.min(44, (obj.chaosValue || 10) + 32));
        this.addChaos(propChaos, true);
      }
    }
  }

  addChaos(points, isMajorCrime = false) {
    if (points <= 0) return;
    this.chaosScore = Math.min(1150, this.chaosScore + points);

    if (this.stars > 0 && isMajorCrime) {
      // Cometer novo crime durante procurado renova o alerta policial e trava sua última posição conhecida!
      this.isEscaping = false;
      this.escapeTimer = 0;
      this._hasLineOfSight = true;
      this._pursuitEngageGraceTimer = Math.max(this._pursuitEngageGraceTimer, 8.0);
      if (this._lastPlayerPos && (this._lastPlayerPos.x !== 0 || this._lastPlayerPos.z !== 0)) {
        this._lastKnownPlayerPos.copy(this._lastPlayerPos);
      }
    }

    this._recomputeStarsFromChaos();
  }

  setWantedStars(targetStars) {
    const clamped = Math.max(0, Math.min(5, Math.floor(targetStars)));
    if (clamped === 0) {
      this.clearWanted('manual');
      return;
    }
    this.chaosScore = WANTED_STAR_THRESHOLDS[clamped] + 15;
    this._recomputeStarsFromChaos(clamped);
  }

  _spawnImmediateWaveForStars(playerPos) {
    const refPos =
      playerPos && (playerPos.x !== 0 || playerPos.z !== 0)
        ? playerPos
        : new THREE.Vector3(0, 0.5, -140);

    const inTunnel = this._isPlayerInUndergroundTunnel(refPos);
    if (!inTunnel) {
      const desiredCars = this._getDesiredVehicleCount();
      const targetImmediate = Math.min(desiredCars, Math.max(2, this.stars));
      let activeCars = this.pursuitVehicles.filter((v) => !v.retreating && !v.carObj?.destroyed).length;
      let safety = 0;
      while (activeCars < targetImmediate && safety < 5) {
        this._spawnPursuitVehicle(refPos);
        activeCars++;
        safety++;
      }
    }

    if (this.stars >= 3 && !this.eagleHeli && this.eagleHeliRespawnCooldown <= 0) {
      this._spawnEagleHelicopter(refPos);
    }

    if (this.stars >= 5 && !inTunnel) {
      while (this.hunterDrones.length < 2) {
        this._spawnHunterDrone(refPos);
      }
    }
  }

  _recomputeStarsFromChaos(forcedStars = null) {
    let nextStars = this.stars;
    if (forcedStars !== null) {
      nextStars = forcedStars;
    } else {
      for (let s = 5; s >= 1; s--) {
        if (this.chaosScore >= WANTED_STAR_THRESHOLDS[s]) {
          nextStars = Math.max(nextStars, s);
          break;
        }
      }
    }

    if (nextStars > this.stars) {
      const prevStars = this.stars;
      this.stars = nextStars;
      this.isEscaping = false;
      this.escapeTimer = 0;
      this.escapeDuration = this.stars >= 4 ? 25.0 : 18.0;
      this._hasLineOfSight = true;
      this._pursuitEngageGraceTimer = Math.max(this._pursuitEngageGraceTimer, 10.0);
      this._spawnTickTimer = 0;
      if (this._lastPlayerPos && (this._lastPlayerPos.x !== 0 || this._lastPlayerPos.z !== 0)) {
        this._lastKnownPlayerPos.copy(this._lastPlayerPos);
      }

      // Despacha viaturas, Helicóptero Águia (3★+) e Drones/Exos (5★) no MESMO FRAME em que ganha a estrela!
      this._spawnImmediateWaveForStars(this._lastPlayerPos);

      soundFX.playCarHorn(0.95, true);
      const tier = WANTED_TIER_INFO[this.stars] || WANTED_TIER_INFO[1];
      this.hud?.updateWantedHud?.(this.stars, false, 0, this.escapeDuration, tier);
      if (prevStars === 0 || this.stars >= 3) {
        this.hud?.showWantedBanner?.(
          `PROCURADO: ${'★'.repeat(this.stars)}`,
          `${tier.label} // ${tier.division}`,
          this.stars >= 5 ? 'antihero' : 'pursuit'
        );
      }
    }
  }

  // ==========================================================================
  // 2. LIMPEZA DE PROCURADO, "PAY 'N' SPRAY" (LEGO CUSTOMS) E "DETIDO"
  // ==========================================================================
  hasCloseWitnessOnGarageEntry(entryPos, witnessRadius = 28.0) {
    if (this.stars <= 0 || !entryPos) return false;
    const rSq = witnessRadius * witnessRadius;

    for (const pv of this.pursuitVehicles) {
      if (pv.retreating || pv.carObj?.destroyed) continue;
      const pos = pv.carObj.mesh.position;
      const dx = pos.x - entryPos.x;
      const dz = pos.z - entryPos.z;
      if (dx * dx + dz * dz <= rSq && !this._isSegmentBlockedByBuilding(pos.x, pos.z, entryPos.x, entryPos.z)) {
        return true;
      }
    }
    for (const fu of this.footUnits) {
      if (fu.obj?.destroyed) continue;
      const pos = fu.mesh.position;
      const dx = pos.x - entryPos.x;
      const dz = pos.z - entryPos.z;
      if (dx * dx + dz * dz <= rSq && !this._isSegmentBlockedByBuilding(pos.x, pos.z, entryPos.x, entryPos.z)) {
        return true;
      }
    }
    return false;
  }

  clearWantedByPaintJob() {
    if (this.stars <= 0) return false;
    const cleared = this.stars;
    this.clearWanted('paint_job');
    soundFX.playTrueHeroFanfare();
    this.hud?.showWantedBanner?.(
      'PINTURA NOVA // 0 ESTRELAS!',
      `CARRO DISFARÇADO NA LEGO CUSTOMS • ${cleared}★ DESPISTADAS NA HORA!`,
      'escaped'
    );
    return true;
  }

  clearWanted(reason = 'escaped', meta = {}) {
    this.stars = 0;
    this.chaosScore = 0;
    this.isEscaping = false;
    this.escapeTimer = 0;
    this._hasLineOfSight = false;
    this._pursuitEngageGraceTimer = 0;
    this._consecutivePropsDestroyed = 0;
    this._propComboResetTimer = 0;

    // Viaturas desligam sirene e giroflex e vão embora pacificamente!
    for (const pv of this.pursuitVehicles) {
      pv.retreating = true;
      pv.retreatLife = 5.5;
      if (pv.strobeRed) pv.strobeRed.material = this.mats.strobeOff;
      if (pv.strobeBlue) pv.strobeBlue.material = this.mats.strobeOff;
    }

    // Remove tropas a pé, bloqueios, Águia, drones e projéteis
    this._clearAllFootUnits();
    this._clearAllRoadblocks();
    this._removeEagleHelicopter();
    this._clearAllHunterDrones();
    this._clearAllEnemyProjectiles();
    if (this.energyCageMesh) {
      this.energyCageMesh.visible = false;
    }

    // Restaura os 4 Corações cheios após despistar a polícia
    if (this.livingCity) {
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    }

    this.hud?.updateWantedHud?.(0, false, 0, 18, WANTED_TIER_INFO[0]);

    if (reason === 'escaped' && meta.studBonus > 0) {
      soundFX.playTrueHeroFanfare();
      this.hud?.addStuds?.(meta.studBonus, 'blue');
      this.hud?.showWantedBanner?.(
        'FUGA PERFEITA!',
        `POLÍCIA DESPISTADA • BÔNUS DE FUGA +${meta.studBonus.toLocaleString('pt-BR')} STUDS!`,
        'escaped'
      );
    }
  }

  triggerPlayerBusted(controller = null) {
    const bustedStars = Math.max(1, this.stars);
    const currentStuds = this.hud?.totalStuds || 0;
    const fine = Math.min(currentStuds, Math.min(2500, bustedStars * 350));

    if (this.hud && fine > 0) {
      this.hud.totalStuds = Math.max(0, this.hud.totalStuds - fine);
      this.hud.displayedStuds = this.hud.totalStuds;
      if (this.hud.studCountEl) {
        this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
      }
    }

    this.clearWanted('busted');
    if (reasonNeedsReset(controller)) {
      if (controller.currentVehicle) {
        controller.exitVehicle?.();
      }
      controller.energyNetSlowTimer = 0;
      const spawnX = 0;
      const spawnZ = -88;
      const spawnY = (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(spawnX, spawnZ) : 0) + 0.5;
      controller.position.set(spawnX, spawnY, spawnZ);
      controller.velocity?.set?.(0, 0, 0);
      if (controller.minifigure?.group) {
        controller.minifigure.group.position.copy(controller.position);
      }
    }

    if (this.livingCity) {
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    }

    soundFX.playExplosion(0.65);
    this.hud?.showWantedBanner?.(
      'DETIDO!',
      fine > 0
        ? `LIBERADO NA DELEGACIA CENTRAL • FIANÇA: -${fine.toLocaleString('pt-BR')} STUDS`
        : 'LIBERADO NA DELEGACIA CENTRAL • FICHA LIMPA!',
      'busted'
    );
  }

  applyPursuitDamageToPlayer(amount, controller = null) {
    if (this.stars <= 0 || !this.livingCity) return;
    if (this.playerHitIFrameTimer > 0) return;
    if (controller?.rollTimer > 0) return; // Esquiva com rolamento tático!

    this.playerHitIFrameTimer = 0.35;
    this.timeSinceLastDamage = 0;

    // Se estiver num veículo blindado/tunado, absorve parte do impacto
    const inVehicleMult = controller?.currentVehicle ? 0.65 : 1.0;
    const finalDmg = Math.max(2, Math.round(amount * inVehicleMult));

    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - finalDmg);
    this.hud?.setPlayerHealth?.(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);
    soundFX.playPlasticHit();

    if (this.livingCity.playerHp <= 0) {
      this.triggerPlayerBusted(controller);
    }
  }

  // ==========================================================================
  // 3. CÁLCULO DE LINHA DE VISÃO (_hasLineOfSight) & ESCONDERIJOS TÁTICOS!
  // ==========================================================================
  _isPlayerInUndergroundTunnel(playerPos) {
    if (!playerPos) return false;
    if (playerPos.y < -1.85) return true;
    const cutY = getMetroCutoutFloorY(playerPos.x, playerPos.z);
    return cutY !== null && playerPos.y < -1.2;
  }

  _isPlayerUnderViaduct(playerPos) {
    if (!playerPos || !Array.isArray(this.world?.elevatedDecks)) return false;
    for (let i = 0; i < this.world.elevatedDecks.length; i++) {
      const d = this.world.elevatedDecks[i];
      if (
        playerPos.x >= d.minX - 1.5 &&
        playerPos.x <= d.maxX + 1.5 &&
        playerPos.z >= d.minZ - 1.5 &&
        playerPos.z <= d.maxZ + 1.5
      ) {
        const deckTopY = typeof d.getTopY === 'function' ? d.getTopY(playerPos.x, playerPos.z) : (d.topY ?? 11.5);
        if (playerPos.y < deckTopY - 2.6) {
          return true;
        }
      }
    }
    return false;
  }

  _isSegmentBlockedByBuilding(ax, az, bx, bz) {
    const buildings = this.world?.mapBuildings;
    if (!Array.isArray(buildings)) return false;
    const minSegX = Math.min(ax, bx) - 1;
    const maxSegX = Math.max(ax, bx) + 1;
    const minSegZ = Math.min(az, bz) - 1;
    const maxSegZ = Math.max(az, bz) + 1;

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if ((b.height || 10) < 3.2) continue;
      const hw = b.w * 0.5;
      const hd = b.d * 0.5;
      const bMinX = b.x - hw;
      const bMaxX = b.x + hw;
      const bMinZ = b.z - hd;
      const bMaxZ = b.z + hd;
      if (bMaxX < minSegX || bMinX > maxSegX || bMaxZ < minSegZ || bMinZ > maxSegZ) continue;
      if (segmentIntersectsRect2D(ax, az, bx, bz, bMinX, bMaxX, bMinZ, bMaxZ)) {
        return true;
      }
    }
    return false;
  }

  _isInsideCoveredGarage(playerPos) {
    // Dentro do galpão coberto da LEGO Customs (X = 39..97, Z = -482..-426)
    return (
      playerPos.x > 40.5 &&
      playerPos.x < 95.5 &&
      playerPos.z > -480.5 &&
      playerPos.z < -427.5 &&
      playerPos.y < 13.5
    );
  }

  _computeLineOfSight(playerPos, controller) {
    if (!playerPos || this.stars <= 0) return false;

    // 1. Bomba de Fumaça / Invisibilidade do Sombra Escarlate quebra a visão na hora!
    if ((controller?.stealthTimer || 0) > 0) {
      return false;
    }

    // 2. Acima da camada alta de nuvens!
    const cloudCeiling = this.stars >= 5 ? 235.0 : 185.0;
    if (playerPos.y > cloudCeiling) {
      return false;
    }

    const inUnderground = this._isPlayerInUndergroundTunnel(playerPos);
    const underViaduct = this._isPlayerUnderViaduct(playerPos);
    const insideGarage = this._isInsideCoveredGarage(playerPos);

    // 3. Janela de Graça de Engajamento Policial (primeiros 10s após ganhar estrela ou 8s após crime a céu aberto):
    //    garante que a polícia trava no alvo e nunca perde visão no mesmo segundo, exceto se entrar em esconderijo real!
    if (this._pursuitEngageGraceTimer > 0 && !inUnderground && !underViaduct && !insideGarage) {
      this._lastKnownPlayerPos.copy(playerPos);
      return true;
    }

    // 4. Linha de Visão Aérea (Helicóptero Águia 3★+ e Drones Caçadores 5★ — alcance de 165m):
    //    Túneis do Metrô, Viadutos e Teto da Oficina cortam a visão aérea IMEDIATAMENTE!
    let aerialHasLOS = false;
    if (!inUnderground && !underViaduct && !insideGarage) {
      if (this.eagleHeli && !this.eagleHeli.obj?.destroyed) {
        const hPos = this.eagleHeli.mesh.position;
        const dist2D = Math.hypot(hPos.x - playerPos.x, hPos.z - playerPos.z);
        if (dist2D <= 165.0) {
          aerialHasLOS = true;
        }
      }
      if (!aerialHasLOS && this.hunterDrones.length > 0) {
        for (const dr of this.hunterDrones) {
          if (dr.obj?.destroyed) continue;
          const d3 = dr.mesh.position.distanceTo(playerPos);
          if (d3 <= 165.0) {
            aerialHasLOS = true;
            break;
          }
        }
      }
    }

    // 5. Linha de Visão Terrestre (Viaturas até 145m, Tropas até 115m + Radar Tático < 65m fora de refúgio!)
    let groundHasLOS = false;
    if (!inUnderground) {
      const inTacticalRefuge = underViaduct || insideGarage;

      for (const pv of this.pursuitVehicles) {
        if (pv.retreating || pv.carObj?.destroyed) continue;
        const vPos = pv.carObj.mesh.position;
        const dy = Math.abs(vPos.y - playerPos.y);
        if (dy > 18.0) continue; // Jogador no alto de prédio ou viaduto fora da rua da viatura!
        const dist = Math.hypot(vPos.x - playerPos.x, vPos.z - playerPos.z);
        if (dist > 145.0) continue;
        if (
          dist <= 16.0 ||
          (!inTacticalRefuge && dist <= 65.0) ||
          !this._isSegmentBlockedByBuilding(vPos.x, vPos.z, playerPos.x, playerPos.z)
        ) {
          groundHasLOS = true;
          break;
        }
      }

      if (!groundHasLOS) {
        for (const fu of this.footUnits) {
          if (fu.obj?.destroyed) continue;
          const fPos = fu.mesh.position;
          if (Math.abs(fPos.y - playerPos.y) > 14.0) continue;
          const dist = Math.hypot(fPos.x - playerPos.x, fPos.z - playerPos.z);
          if (dist > 115.0) continue;
          if (
            dist <= 15.0 ||
            (!inTacticalRefuge && dist <= 65.0) ||
            !this._isSegmentBlockedByBuilding(fPos.x, fPos.z, playerPos.x, playerPos.z)
          ) {
            groundHasLOS = true;
            break;
          }
        }
      }
    }

    if (aerialHasLOS || groundHasLOS) {
      this._lastKnownPlayerPos.copy(playerPos);
      return true;
    }

    return false;
  }

  // ==========================================================================
  // 4. SPAWN DE FORÇAS ESCALÁVEIS (1★ A 5★)
  // ==========================================================================
  _findPursuitSpawnPos(playerPos, minDist = 32, maxDist = 56, preferAhead = true) {
    const mainAvenuesX = [-516, -384, -252, -120, 0, 120, 252, 384, 612];
    const mainAvenuesZ = [-512, -382, -250, -117, 0, 134, 384, 710];

    const isValidPursuitCoord = (cx, cz, requireLOS = false) => {
      if (getMetroCutoutFloorY(cx, cz) !== null) return false;
      if (this.world?.isDeepWaterAt?.(cx, cz, { forCar: true })) return false;
      if (this._isInsideCoveredGarage({ x: cx, y: 0, z: cz })) return false;
      const d = Math.hypot(cx - playerPos.x, cz - playerPos.z);
      if (d < 24.0) return false;
      if (requireLOS && this._isSegmentBlockedByBuilding(cx, cz, playerPos.x, playerPos.z)) {
        return false;
      }
      return true;
    };

    // 1º: Prioriza spawnar viaturas alinhadas às Avenidas Principais perto do jogador (32m..56m) com Linha de Visão limpa!
    const dirSign = preferAhead ? 1 : -1;
    const fwdZ = Math.abs(this._playerVelDir.z) > 0.25 ? Math.sign(this._playerVelDir.z) * dirSign : dirSign;
    const fwdX = Math.abs(this._playerVelDir.x) > 0.25 ? Math.sign(this._playerVelDir.x) * dirSign : dirSign;

    const aveCandidates = [];
    for (const ax of mainAvenuesX) {
      if (Math.abs(playerPos.x - ax) <= 46) {
        const dist = minDist + Math.random() * (maxDist - minDist);
        aveCandidates.push({ x: ax, z: playerPos.z + fwdZ * dist });
        aveCandidates.push({ x: ax, z: playerPos.z - fwdZ * dist });
      }
    }
    for (const az of mainAvenuesZ) {
      if (Math.abs(playerPos.z - az) <= 46) {
        const dist = minDist + Math.random() * (maxDist - minDist);
        aveCandidates.push({ x: playerPos.x + fwdX * dist, z: az });
        aveCandidates.push({ x: playerPos.x - fwdX * dist, z: az });
      }
    }

    for (const requireLOS of [true, false]) {
      for (const cand of aveCandidates) {
        const cx = THREE.MathUtils.clamp(cand.x, -1720, 1540);
        const cz = THREE.MathUtils.clamp(cand.z, -1240, 960);
        const safe = this.livingCity?._findSafeStreetSpawn
          ? this.livingCity._findSafeStreetSpawn(cx, cz, 2.6)
          : { x: cx, z: cz };
        if (isValidPursuitCoord(safe.x, safe.z, requireLOS)) {
          const y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
          return { x: safe.x, y, z: safe.z };
        }
      }
    }

    // 2º: Candidatos radiais curtos (32m..56m) priorizando Linha de Visão limpa!
    const baseAngle = Math.atan2(this._playerVelDir.x, this._playerVelDir.z);
    for (const requireLOS of [true, false]) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const spread = preferAhead ? (Math.random() - 0.5) * 1.15 : Math.random() * Math.PI * 2;
        const ang = preferAhead ? baseAngle + spread : spread;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const rawX = THREE.MathUtils.clamp(playerPos.x + Math.sin(ang) * dist, -1720, 1540);
        const rawZ = THREE.MathUtils.clamp(playerPos.z + Math.cos(ang) * dist, -1240, 960);

        const safe = this.livingCity?._findSafeStreetSpawn
          ? this.livingCity._findSafeStreetSpawn(rawX, rawZ, 2.8)
          : { x: rawX, z: rawZ };
        if (isValidPursuitCoord(safe.x, safe.z, requireLOS)) {
          const y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
          return { x: safe.x, y, z: safe.z };
        }
      }
    }

    const fallbackX = playerPos.x + 42;
    const fallbackZ = playerPos.z;
    const fy = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fallbackX, fallbackZ) : 0;
    return { x: fallbackX, y: fy, z: fallbackZ };
  }

  _attachPoliceLightbar(carMesh, roofY = 1.65) {
    const G = getSharedPursuitGeos();
    const group = new THREE.Group();
    group.position.set(0, roofY, -0.1);
    const base = new THREE.Mesh(G.lightbarBaseGeo, this.mats.gunSteel);
    const strobeRed = new THREE.Mesh(G.lightbarRedGeo, this.mats.strobeRedOn);
    const strobeBlue = new THREE.Mesh(G.lightbarBlueGeo, this.mats.strobeBlueOn);
    group.add(base, strobeRed, strobeBlue);
    carMesh.add(group);
    return { strobeRed, strobeBlue };
  }

  _getDesiredVehicleCount() {
    if (this.stars <= 0) return 0;
    if (this.stars === 1) return 2;
    if (this.stars === 2) return 4;
    if (this.stars === 3) return 4;
    if (this.stars === 4) return 5;
    return 5;
  }

  _pickPursuitVehicleConfig() {
    if (this.stars === 1) {
      return {
        vType: 'interceptor_v8',
        color: 0x111827,
        roofColor: LEGO_COLORS.white,
        speed: 31.0,
        hp: 150,
        role: 'patrol',
        roofLightY: 1.58
      };
    }
    if (this.stars === 2 || this.stars === 3) {
      return {
        vType: 'interceptor_v8',
        color: 0x0f172a,
        roofColor: LEGO_COLORS.white,
        speed: 40.0,
        hp: 190,
        role: 'pit_interceptor',
        roofLightY: 1.58
      };
    }
    if (this.stars === 4) {
      const heavy = this.pursuitVehicles.length % 2 === 0;
      return heavy
        ? {
            vType: 'caveirao_bope',
            color: 0x090a0d,
            roofColor: 0x111827,
            speed: 37.5,
            hp: 360,
            role: 'bope_heavy',
            roofLightY: 2.32
          }
        : {
            vType: 'pickup_offroad',
            color: 0x1e293b,
            roofColor: 0x090a0d,
            speed: 41.5,
            hp: 250,
            role: 'choque_pickup',
            roofLightY: 1.92
          };
    }
    // 5 ESTRELAS: Blindados Futuristas da Divisão Caçadores Anti-Herói!
    const useHoverApc = this.pursuitVehicles.length % 2 === 0 && VEHICLE_SPECS.hover_apc_ares;
    return {
      vType: useHoverApc ? 'hover_apc_ares' : 'caveirao_bope',
      color: 0x090a0d,
      roofColor: 0x06b6d4,
      speed: 49.0,
      hp: 440,
      role: 'antihero_apc',
      roofLightY: 2.25
    };
  }

  _spawnPursuitVehicle(playerPos) {
    const cfg = this._pickPursuitVehicleConfig();
    const spec = VEHICLE_SPECS[cfg.vType] || VEHICLE_SPECS.interceptor_v8;
    const preferAhead = this.pursuitVehicles.length % 2 === 0;
    const spawn = this._findPursuitSpawnPos(playerPos, 32, 56, preferAhead);
    const heading = Math.atan2(playerPos.x - spawn.x, playerPos.z - spawn.z);

    const carMesh = createLegoCarMesh({
      x: spawn.x,
      z: spawn.z,
      rotY: heading,
      color: cfg.color,
      roofColor: cfg.roofColor,
      type: cfg.vType
    });
    carMesh.position.set(spawn.x, spawn.y, spawn.z);
    carMesh.rotation.y = heading;
    carMesh.userData.carType = cfg.vType;
    carMesh.userData.carName =
      cfg.role === 'antihero_apc' ? 'BLINDADO ANTI-HERÓI' : spec.name || 'VIATURA POLICIAL';
    carMesh.userData.vehicleSpec = spec;
    carMesh.userData.skipStaticMerge = true;

    const { strobeRed, strobeBlue } = this._attachPoliceLightbar(carMesh, cfg.roofLightY);
    this.scene.add(carMesh);

    const col = this.world.addCollider(spawn.x, spawn.z, 2.6, 5.0, spawn.y + 1.8, spawn.y);
    const carObj = this.destructibles.registerDestructible({
      mesh: carMesh,
      type: 'car',
      hp: cfg.hp,
      radius: 2.75,
      height: 2.2,
      colliders: [col],
      debrisColors: [cfg.color, cfg.roofColor, 0xef4444, 0x2563eb],
      studDrops: { silver: 4, gold: 8, blue: 3, purple: cfg.role === 'antihero_apc' ? 1 : 0 },
      groundY: spawn.y,
      isPoliceUnit: true,
      noAutoRespawn: true
    });

    const unit = {
      carObj,
      col,
      role: cfg.role,
      maxSpeed: cfg.speed,
      speed: cfg.speed * 0.72,
      heading,
      strobeRed,
      strobeBlue,
      pitCooldown: 1.5,
      deployedTroops: false,
      stuckTimer: 0,
      farNoLosTimer: 0,
      pursuitEngageTime: 0,
      retreating: false,
      retreatLife: 0
    };
    this.pursuitVehicles.push(unit);
    return unit;
  }

  _spawnFootTrooper(spawnPos, tierStars = this.stars) {
    if (this.footUnits.length >= (tierStars >= 5 ? 7 : tierStars >= 4 ? 6 : 4)) return null;
    const G = getSharedPursuitGeos();
    const isExo = tierStars >= 5;
    const isRiotElite = tierStars === 4;

    const group = new THREE.Group();
    group.userData.isOptimizedGroup = true;
    group.position.set(spawnPos.x, spawnPos.y, spawnPos.z);

    if (isExo) {
      // Exoesqueleto Caçador de Super-Humanos (5★)!
      const armor = new THREE.Mesh(G.exoArmorGeo, this.mats.exoArmor);
      armor.castShadow = true;
      const visor = new THREE.Mesh(G.exoVisorGeo, this.mats.exoNeon);
      group.add(armor, visor);
    } else {
      const body = new THREE.Mesh(
        G.officerBodyGeo,
        isRiotElite ? this.mats.policeBlack : this.mats.policeBlue
      );
      body.castShadow = true;
      const head = new THREE.Mesh(G.officerHeadGeo, this.mats.skinYellow);
      const gun = new THREE.Mesh(G.officerGunGeo, this.mats.gunSteel);
      group.add(body, head, gun);
      if (isRiotElite) {
        const shield = new THREE.Mesh(G.riotShieldGeo, this.mats.riotShield);
        group.add(shield);
      }
    }

    this.scene.add(group);
    const obj = this.destructibles.registerDestructible({
      mesh: group,
      type: 'npc_fighter',
      hp: isExo ? 240 : isRiotElite ? 120 : 65,
      radius: isExo ? 1.45 : 0.95,
      height: isExo ? 2.6 : 1.85,
      colliders: [],
      debrisColors: isExo
        ? [0x0f172a, 0x00f0ff, 0xef4444]
        : [0x1d4ed8, 0x111827, LEGO_COLORS.yellow],
      studDrops: isExo
        ? { silver: 2, gold: 8, blue: 6, purple: 1 }
        : { silver: 4, gold: 4, blue: 1, purple: 0 },
      groundY: spawnPos.y,
      isPoliceUnit: true,
      noAutoRespawn: true
    });
    obj.isCombatNpc = true;
    obj.isTankNpc = isRiotElite || isExo;

    const unit = {
      mesh: group,
      obj,
      isExo,
      isRiotElite,
      moveSpeed: isExo ? 16.5 : isRiotElite ? 9.5 : 8.5,
      shootCooldown: 0.7 + Math.random() * 0.7,
      specialCooldown: 2.2 + Math.random() * 1.5
    };
    this.footUnits.push(unit);
    return unit;
  }

  // --------------------------------------------------------------------------
  // 3 ESTRELAS: HELICÓPTERO POLICIAL TÁTICO "ÁGUIA" + HOLOFOTE NOTURNO!
  // --------------------------------------------------------------------------
  _spawnEagleHelicopter(playerPos) {
    if (this.eagleHeli || this.eagleHeliRespawnCooldown > 0) return;
    const G = getSharedPursuitGeos();

    const heliGroup = new THREE.Group();
    heliGroup.userData.skipStaticMerge = true;
    const startX = playerPos.x - 65;
    const startZ = playerPos.z - 65;
    const startY = Math.max(playerPos.y + 36, 40);
    heliGroup.position.set(startX, startY, startZ);

    const hull = new THREE.Mesh(G.heliHullGeo, this.mats.policeBlack);
    hull.castShadow = true;
    const canopy = new THREE.Mesh(G.heliCanopyGeo, this.mats.heliGlass);
    const rotor = new THREE.Mesh(G.heliRotorGeo, this.mats.gunSteel);
    rotor.position.set(0, 1.25, 0.35);

    const strobeRed = new THREE.Mesh(G.lightbarRedGeo, this.mats.strobeRedOn);
    strobeRed.position.set(-0.6, -1.05, 1.6);
    const strobeBlue = new THREE.Mesh(G.lightbarBlueGeo, this.mats.strobeBlueOn);
    strobeBlue.position.set(0.6, -1.05, 1.6);

    heliGroup.add(hull, canopy, rotor, strobeRed, strobeBlue);
    this.scene.add(heliGroup);

    // Cone Branco Volumétrico do Holofote + Disco de Luz no Chão (Ativados à Noite!)
    const coneMesh = new THREE.Mesh(G.spotlightConeGeo, this.mats.spotlightCone);
    coneMesh.visible = false;
    const discMesh = new THREE.Mesh(G.spotlightDiscGeo, this.mats.spotlightDisc);
    discMesh.visible = false;
    this.scene.add(coneMesh, discMesh);

    const obj = this.destructibles.registerDestructible({
      mesh: heliGroup,
      type: 'police_helicopter',
      hp: 260,
      radius: 3.6,
      height: 3.2,
      colliders: [],
      debrisColors: [0x111827, LEGO_COLORS.white, 0x38bdf8, 0xfacc15],
      studDrops: { silver: 0, gold: 12, blue: 8, purple: 2 },
      groundY: 0,
      isPoliceUnit: true,
      noAutoRespawn: true
    });

    obj.onShattered = () => {
      coneMesh.visible = false;
      discMesh.visible = false;
      this.scene.remove(coneMesh, discMesh);
      this.eagleHeli = null;
      this.eagleHeliRespawnCooldown = 22.0; // Janela tática p/ dar fuga ao derrubar o Águia!
    };

    this.eagleHeli = {
      mesh: heliGroup,
      rotor,
      strobeRed,
      strobeBlue,
      coneMesh,
      discMesh,
      obj,
      orbitPhase: Math.random() * Math.PI * 2,
      shootTimer: 1.6
    };
  }

  _removeEagleHelicopter() {
    if (!this.eagleHeli) return;
    if (this.eagleHeli.coneMesh) this.scene.remove(this.eagleHeli.coneMesh);
    if (this.eagleHeli.discMesh) this.scene.remove(this.eagleHeli.discMesh);
    if (this.eagleHeli.obj) {
      this.eagleHeli.obj.onShattered = null;
      this.destructibles.unregisterDestructible(this.eagleHeli.obj);
    } else if (this.eagleHeli.mesh) {
      this.scene.remove(this.eagleHeli.mesh);
    }
    this.eagleHeli = null;
  }

  // --------------------------------------------------------------------------
  // 3+ ESTRELAS: BARREIRAS POLICIAIS NAS AVENIDAS À SUA FRENTE (+ RAMPA LEGO!)
  // --------------------------------------------------------------------------
  _trySpawnRoadblockAhead(playerPos) {
    if (this.roadblocks.length >= 2) return false;
    if (this._isPlayerInUndergroundTunnel(playerPos) || playerPos.y > 28) return false;

    const projDist = 96.0;
    const rawX = playerPos.x + this._playerVelDir.x * projDist;
    const rawZ = playerPos.z + this._playerVelDir.z * projDist;

    // Alinha à avenida principal mais próxima para bloquear a pista de verdade!
    const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
    const mainAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];

    let bestX = rawX;
    let bestZ = rawZ;
    let blockRotY = 0;
    let snapped = false;

    if (Math.abs(this._playerVelDir.z) >= Math.abs(this._playerVelDir.x)) {
      for (const ax of mainAvenuesX) {
        if (Math.abs(rawX - ax) < 26) {
          bestX = ax;
          blockRotY = 0; // Barreira atravessada no eixo X fechando a avenida Norte-Sul!
          snapped = true;
          break;
        }
      }
    } else {
      for (const az of mainAvenuesZ) {
        if (Math.abs(rawZ - az) < 26) {
          bestZ = az;
          blockRotY = Math.PI / 2; // Barreira atravessada no eixo Z fechando a avenida Leste-Oeste!
          snapped = true;
          break;
        }
      }
    }

    if (!snapped) return false;
    if (getMetroCutoutFloorY(bestX, bestZ) !== null) return false;
    if (this.world?.isDeepWaterAt?.(bestX, bestZ, { forCar: true })) return false;

    const groundY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(bestX, bestZ) : 0;
    const G = getSharedPursuitGeos();

    const props = [];
    const cosR = Math.cos(blockRotY);
    const sinR = Math.sin(blockRotY);
    const toWorld = (lx, lz) => ({
      x: bestX + lx * cosR + lz * sinR,
      z: bestZ - lx * sinR + lz * cosR
    });

    // 2 Viaturas atravessadas em V no meio da avenida
    for (const side of [-1, 1]) {
      const p = toWorld(side * 4.8, 0);
      const vRot = blockRotY + Math.PI / 2 + side * 0.28;
      const carMesh = createLegoCarMesh({
        x: p.x,
        z: p.z,
        rotY: vRot,
        color: 0x0f172a,
        roofColor: LEGO_COLORS.white,
        type: 'interceptor_v8'
      });
      carMesh.position.set(p.x, groundY, p.z);
      carMesh.rotation.y = vRot;
      carMesh.userData.carType = 'interceptor_v8';
      carMesh.userData.carName = 'BLOQUEIO POLICIAL';
      carMesh.userData.vehicleSpec = VEHICLE_SPECS.interceptor_v8;
      this._attachPoliceLightbar(carMesh, 1.58);
      this.scene.add(carMesh);

      const col = this.world.addCollider(p.x, p.z, 4.6, 2.6, groundY + 1.8, groundY);
      const cObj = this.destructibles.registerDestructible({
        mesh: carMesh,
        type: 'car',
        hp: 140,
        radius: 2.6,
        height: 2.0,
        colliders: [col],
        debrisColors: [0x0f172a, LEGO_COLORS.white, 0xef4444, 0x2563eb],
        studDrops: { silver: 3, gold: 6, blue: 2, purple: 0 },
        groundY,
        isPoliceUnit: true,
        noAutoRespawn: true
      });
      props.push(cObj);
    }

    // 5 Barricadas Laranjas LEGO estouráveis à frente das viaturas
    for (let bi = -2; bi <= 2; bi++) {
      const bp = toWorld(bi * 2.5, -3.2);
      const bGroup = new THREE.Group();
      bGroup.userData.isOptimizedGroup = true;
      bGroup.position.set(bp.x, groundY, bp.z);
      bGroup.rotation.y = blockRotY;
      bGroup.add(new THREE.Mesh(G.rbBarricadeGeo, this.mats.orangePlastic));
      this.scene.add(bGroup);

      const bObj = this.destructibles.registerDestructible({
        mesh: bGroup,
        type: 'orange_barricade',
        hp: 12,
        radius: 1.2,
        height: 1.1,
        colliders: [],
        debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white],
        studDrops: { silver: 2, gold: 1, blue: 0, purple: 0 },
        groundY,
        isPoliceUnit: true,
        noAutoRespawn: true
      });
      props.push(bObj);
    }

    // Rampa de Emergência Amarela lateral para furar o bloqueio VOANDO por cima!
    const rp = toWorld(9.8, -1.5);
    const rampMesh = new THREE.Mesh(G.roadblockRampGeo, this.mats.yellowHazard);
    // Aponta a rampa para subir na direção do jogador que está vindo!
    const toPlayerAng = Math.atan2(playerPos.x - rp.x, playerPos.z - rp.z);
    rampMesh.position.set(rp.x, groundY, rp.z);
    rampMesh.rotation.y = toPlayerAng;
    this.scene.add(rampMesh);

    this.roadblocks.push({
      x: bestX,
      y: groundY,
      z: bestZ,
      rampPos: { x: rp.x, y: groundY, z: rp.z },
      rampMesh,
      props,
      age: 0
    });
    return true;
  }

  _clearRoadblock(rb) {
    if (rb.rampMesh) this.scene.remove(rb.rampMesh);
    for (const pObj of rb.props) {
      this.destructibles.unregisterDestructible(pObj);
    }
  }

  _clearAllRoadblocks() {
    for (const rb of this.roadblocks) {
      this._clearRoadblock(rb);
    }
    this.roadblocks.length = 0;
  }

  // --------------------------------------------------------------------------
  // 5 ESTRELAS: DRONES CAÇADORES ANTI-HERÓI (ACOMPANHAM HERÓIS RÁPIDOS / VOADORES!)
  // --------------------------------------------------------------------------
  _spawnHunterDrone(playerPos) {
    if (this.hunterDrones.length >= 3) return null;
    const G = getSharedPursuitGeos();
    const ang = Math.random() * Math.PI * 2;
    const group = new THREE.Group();
    group.userData.isOptimizedGroup = true;
    group.position.set(
      playerPos.x + Math.cos(ang) * 48,
      Math.max(playerPos.y + 8.5, 10.0),
      playerPos.z + Math.sin(ang) * 48
    );

    const body = new THREE.Mesh(G.droneBodyGeo, this.mats.exoArmor);
    const eye = new THREE.Mesh(G.droneEyeGeo, this.mats.exoRed);
    group.add(body, eye);
    this.scene.add(group);

    const obj = this.destructibles.registerDestructible({
      mesh: group,
      type: 'hunter_drone',
      hp: 95,
      radius: 1.45,
      height: 1.2,
      colliders: [],
      debrisColors: [0x0f172a, 0x00f0ff, 0xef4444],
      studDrops: { silver: 0, gold: 6, blue: 4, purple: 1 },
      groundY: 0,
      isPoliceUnit: true,
      noAutoRespawn: true
    });

    const drone = {
      mesh: group,
      obj,
      orbitOffset: ang,
      fireCooldown: 1.4 + Math.random() * 1.4
    };
    this.hunterDrones.push(drone);
    return drone;
  }

  _clearAllHunterDrones() {
    for (const dr of this.hunterDrones) {
      this.destructibles.unregisterDestructible(dr.obj);
    }
    this.hunterDrones.length = 0;
  }

  _clearAllFootUnits() {
    for (const fu of this.footUnits) {
      this.destructibles.unregisterDestructible(fu.obj);
    }
    this.footUnits.length = 0;
  }

  // ==========================================================================
  // 5. TIROS POLICIAIS, REDES ENERGÉTICAS & MÍSSEIS TELEGUIADOS (5 ESTRELAS!)
  // ==========================================================================
  _spawnPursuitProjectile(origin, targetPos, kind = 'bullet') {
    if (this.enemyProjectiles.length >= 28) return;
    const G = getSharedPursuitGeos();
    const dir = targetPos.clone().sub(origin).normalize();

    let mesh;
    let speed = 56;
    let life = 1.9;
    let damage = 8;

    if (kind === 'missile') {
      mesh = new THREE.Mesh(G.missileGeo, this.mats.missileBody);
      speed = 38.0;
      life = 3.4;
      damage = 24;
      soundFX.playExplosion(0.32);
    } else if (kind === 'energy_net') {
      mesh = new THREE.Mesh(G.energyNetProjectileGeo, this.mats.energyNetWire);
      speed = 46.0;
      life = 2.4;
      damage = 10;
      soundFX.playLaserShot();
    } else {
      mesh = new THREE.Mesh(G.policeBulletGeo, this.mats.policeBullet);
      speed = 62.0;
      life = 1.6;
      damage = this.stars >= 4 ? 11 : 7;
    }

    mesh.position.copy(origin);
    mesh.lookAt(targetPos);
    this.scene.add(mesh);

    this.enemyProjectiles.push({
      mesh,
      kind,
      vel: dir.multiplyScalar(speed),
      speed,
      life,
      damage
    });
  }

  _clearAllEnemyProjectiles() {
    for (const p of this.enemyProjectiles) {
      this.scene.remove(p.mesh);
    }
    this.enemyProjectiles.length = 0;
  }

  _applyEnergyNetHit(playerPos, controller) {
    if (!controller) return;
    controller.energyNetSlowTimer = 1.85;
    // Puxa levemente heróis voadores para baixo sem travar controles!
    if (controller.isFlying && controller.velocity) {
      controller.velocity.y = Math.min(controller.velocity.y, -8.5);
    }
    if (!this.energyCageMesh) {
      const G = getSharedPursuitGeos();
      this.energyCageMesh = new THREE.Mesh(G.energyCageGeo, this.mats.energyNetWire);
      this.scene.add(this.energyCageMesh);
    }
    this.energyCageMesh.visible = true;
    this.energyCageMesh.position.set(playerPos.x, playerPos.y + 1.1, playerPos.z);
  }

  // ==========================================================================
  // 6. LOOP PRINCIPAL (60 FPS CRAVADOS!)
  // ==========================================================================
  update(dt, playerPos, controller = null) {
    if (!playerPos) return;

    // Atualiza vetor de movimento do jogador (p/ posicionar Barreiras Policiais à frente!)
    const moveDx = playerPos.x - this._lastPlayerPos.x;
    const moveDz = playerPos.z - this._lastPlayerPos.z;
    const moveLen = Math.hypot(moveDx, moveDz);
    if (moveLen > 0.08) {
      this._playerVelDir.set(moveDx / moveLen, 0, moveDz / moveLen);
    } else if (controller && typeof controller.vehicleHeading === 'number' && controller.currentVehicle) {
      this._playerVelDir.set(Math.sin(controller.vehicleHeading), 0, Math.cos(controller.vehicleHeading));
    }
    this._lastPlayerPos.copy(playerPos);

    if (this.playerHitIFrameTimer > 0) {
      this.playerHitIFrameTimer = Math.max(0, this.playerHitIFrameTimer - dt);
    }
    if (this.eagleHeliRespawnCooldown > 0) {
      this.eagleHeliRespawnCooldown = Math.max(0, this.eagleHeliRespawnCooldown - dt);
    }
    if (this._pursuitEngageGraceTimer > 0) {
      this._pursuitEngageGraceTimer = Math.max(0, this._pursuitEngageGraceTimer - dt);
    }
    if (this._propComboResetTimer > 0) {
      this._propComboResetTimer = Math.max(0, this._propComboResetTimer - dt);
      if (this._propComboResetTimer <= 0) {
        this._consecutivePropsDestroyed = 0;
      }
    }

    // Gaiola Visual da Rede Energética (5 Estrelas)
    if (this.energyCageMesh && this.energyCageMesh.visible) {
      if ((controller?.energyNetSlowTimer || 0) > 0) {
        this.energyCageMesh.position.set(playerPos.x, playerPos.y + 1.15, playerPos.z);
        this.energyCageMesh.rotation.y += dt * 4.5;
        this.energyCageMesh.rotation.x += dt * 2.8;
      } else {
        this.energyCageMesh.visible = false;
      }
    }

    // ------------------------------------------------------------------------
    // MODO PACÍFICO (0 ESTRELAS): Decai barra oculta de caos e recicla viaturas em retirada
    // ------------------------------------------------------------------------
    if (this.stars === 0) {
      if (this.chaosScore > 0) {
        this.chaosScore = Math.max(0, this.chaosScore - dt * 14.0);
      }
      if (this.pursuitVehicles.length > 0) {
        this._updatePursuitVehicles(dt, playerPos, controller);
      }
      return;
    }

    // ------------------------------------------------------------------------
    // REGENERAÇÃO AUTOMÁTICA DOS 4 CORAÇÕES APÓS 6 SEGUNDOS SEM TOMAR TIRO!
    // ------------------------------------------------------------------------
    this.timeSinceLastDamage += dt;
    if (
      this.timeSinceLastDamage >= 6.0 &&
      this.livingCity &&
      this.livingCity.playerHp < this.livingCity.playerMaxHp
    ) {
      this.livingCity.playerHp = Math.min(
        this.livingCity.playerMaxHp,
        this.livingCity.playerHp + dt * 46.0
      );
      const stillHealing = this.livingCity.playerHp < this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(
        this.livingCity.playerHp,
        this.livingCity.playerMaxHp,
        stillHealing
      );
    }

    // ------------------------------------------------------------------------
    // SPAWN / MANUTENÇÃO DAS FORÇAS POLICIAIS DE ACORDO COM A ESTRELA (1★..5★)
    // Sempre mantém a frota ativa quando this.stars > 0 (sem deadlock com isEscaping!)
    // ------------------------------------------------------------------------
    this._spawnTickTimer -= dt;
    if (this._spawnTickTimer <= 0) {
      this._spawnTickTimer = 1.25;
      const desiredCars = this._getDesiredVehicleCount();
      let activeCars = this.pursuitVehicles.filter((v) => !v.retreating && !v.carObj?.destroyed).length;
      if (activeCars < desiredCars && !this._isPlayerInUndergroundTunnel(playerPos)) {
        const spawnBatch = activeCars === 0 ? Math.min(2, desiredCars) : 1;
        for (let b = 0; b < spawnBatch; b++) {
          this._spawnPursuitVehicle(playerPos);
        }
      }

      if (this.stars >= 3 && !this.eagleHeli && this.eagleHeliRespawnCooldown <= 0) {
        this._spawnEagleHelicopter(playerPos);
      }

      if (this.stars >= 5 && this.hunterDrones.length < 2 && !this._isPlayerInUndergroundTunnel(playerPos)) {
        this._spawnHunterDrone(playerPos);
      }
    }

    // Bloqueios Policiais nas Avenidas à frente (3+ Estrelas)
    if (this.stars >= 3 && !this.isEscaping) {
      this._roadblockCooldown -= dt;
      if (this._roadblockCooldown <= 0) {
        const playerSpeed = moveLen / Math.max(0.001, dt);
        if (playerSpeed > 14.0 && this._trySpawnRoadblockAhead(playerPos)) {
          this._roadblockCooldown = 14.0;
        } else {
          this._roadblockCooldown = 3.0;
        }
      }
    }

    // Sirene policial ambiente durante perseguição ativa
    this._strobeClock += dt * 11.0;
    if (!this.isEscaping) {
      this._sirenPulseTimer -= dt;
      if (this._sirenPulseTimer <= 0 && this.pursuitVehicles.length > 0) {
        this._sirenPulseTimer = 3.4 + Math.random() * 1.6;
        soundFX.playCarHorn(0.42, true);
      }
    }

    // Atualiza todas as unidades
    this._updatePursuitVehicles(dt, playerPos, controller);
    this._updateFootUnits(dt, playerPos, controller);
    this._updateEagleHelicopter(dt, playerPos, controller);
    this._updateHunterDrones(dt, playerPos, controller);
    this._updateRoadblocks(dt, playerPos, controller);
    this._updateEnemyProjectiles(dt, playerPos, controller);

    // ------------------------------------------------------------------------
    // MECÂNICA DE FUGA REAL ("DAR FUGA" IGUAL AO GTA — 18s OU 25s EM 4-5★!)
    // ------------------------------------------------------------------------
    this._hasLineOfSight = this._computeLineOfSight(playerPos, controller);
    this.escapeDuration = this.stars >= 4 ? 25.0 : 18.0;

    if (!this._hasLineOfSight) {
      this.isEscaping = true;
      this.escapeTimer += dt;
      if (this.escapeTimer >= this.escapeDuration) {
        const escapedStars = this.stars;
        const studBonus = escapedStars * 1500;
        this.clearWanted('escaped', { studBonus, escapedStars });
        return;
      }
    } else {
      this.isEscaping = false;
      this.escapeTimer = Math.max(0, this.escapeTimer - dt * 2.2);
    }

    const tier = WANTED_TIER_INFO[this.stars] || WANTED_TIER_INFO[1];
    this.hud?.updateWantedHud?.(
      this.stars,
      this.isEscaping,
      this.escapeTimer,
      this.escapeDuration,
      tier
    );
  }

  _updatePursuitVehicles(dt, playerPos, controller) {
    const redPhase = Math.sin(this._strobeClock) > 0;
    const playerCar = controller?.currentVehicle;
    const playerSpeedAbs = Math.abs(controller?.vehicleSpeed || 0);
    const inUnderground = this._isPlayerInUndergroundTunnel(playerPos);

    for (let i = this.pursuitVehicles.length - 1; i >= 0; i--) {
      const pv = this.pursuitVehicles[i];
      const carObj = pv.carObj;

      // Se o jogador roubou a própria viatura policial ou ela foi destruída, desvincula da IA!
      if (!carObj || carObj.destroyed || carObj.isDriven) {
        this.pursuitVehicles.splice(i, 1);
        continue;
      }

      const mesh = carObj.mesh;
      const pos = mesh.position;
      const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

      if (pv.retreating) {
        pv.retreatLife -= dt;
        pos.x += Math.sin(pv.heading) * 22.0 * dt;
        pos.z += Math.cos(pv.heading) * 22.0 * dt;
        if (pv.retreatLife <= 0 || dist > 160) {
          this.destructibles.unregisterDestructible(carObj);
          this.pursuitVehicles.splice(i, 1);
        }
        continue;
      }

      pv.pursuitEngageTime = (pv.pursuitEngageTime || 0) + dt;

      // Giroflex alternando Vermelho / Azul!
      if (pv.strobeRed && pv.strobeBlue) {
        pv.strobeRed.material = redPhase ? this.mats.strobeRedOn : this.mats.strobeOff;
        pv.strobeBlue.material = !redPhase ? this.mats.strobeBlueOn : this.mats.strobeOff;
      }

      if (pv.pitCooldown > 0) pv.pitCooldown -= dt;

      // 2+ Estrelas: desembarca policiais/BOPE/Exoesqueletos Anti-Herói quando próximo (< 34m) ou após 6s de cerco!
      if (
        this.stars >= 2 &&
        !pv.deployedTroops &&
        dist < 34.0 &&
        (!playerCar || playerSpeedAbs < 12.0 || pv.pursuitEngageTime >= 6.0) &&
        Math.abs(playerPos.y - pos.y) < 5.5
      ) {
        pv.deployedTroops = true;
        const count = this.stars >= 4 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const sideOff = k === 0 ? -2.4 : 2.4;
          this._spawnFootTrooper(
            {
              x: pos.x + Math.cos(pv.heading) * sideOff,
              y: pos.y,
              z: pos.z - Math.sin(pv.heading) * sideOff
            },
            this.stars
          );
        }
      }

      // Se perdeu o jogador de vista, dirige até a última posição conhecida (_lastKnownPlayerPos) e vasculha ao redor!
      let targetX = playerPos.x;
      let targetZ = playerPos.z;
      if (this.isEscaping) {
        const lkx = this._lastKnownPlayerPos.x || playerPos.x;
        const lkz = this._lastKnownPlayerPos.z || playerPos.z;
        const distToLastKnown = Math.hypot(lkx - pos.x, lkz - pos.z);
        if (distToLastKnown > 16.0) {
          targetX = lkx;
          targetZ = lkz;
        } else {
          const searchAng = this._strobeClock * 0.25 + i * 1.57;
          targetX = lkx + Math.cos(searchAng) * 28.0;
          targetZ = lkz + Math.sin(searchAng) * 28.0;
        }
      } else if (pv.role === 'patrol' && playerCar) {
        // 1★ tenta fechar sua passagem na frente!
        targetX = playerPos.x + this._playerVelDir.x * 12.0;
        targetZ = playerPos.z + this._playerVelDir.z * 12.0;
      } else if (pv.role === 'pit_interceptor' && playerCar) {
        // 2★–3★ encosta na traseira lateral para executar PIT Maneuver!
        const rightX = this._playerVelDir.z;
        const rightZ = -this._playerVelDir.x;
        const sideSign = i % 2 === 0 ? 1 : -1;
        targetX = playerPos.x - this._playerVelDir.x * 2.2 + rightX * sideSign * 2.4;
        targetZ = playerPos.z - this._playerVelDir.z * 2.2 + rightZ * sideSign * 2.4;
      }

      const desiredHeading = Math.atan2(targetX - pos.x, targetZ - pos.z);
      let angleDiff = desiredHeading - pv.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      pv.heading += THREE.MathUtils.clamp(angleDiff, -3.6 * dt, 3.6 * dt);

      const shouldBrake = !playerCar && dist < 11.5 && !this.isEscaping;
      const desiredSpd = shouldBrake ? 0 : this.isEscaping ? pv.maxSpeed * 0.65 : pv.maxSpeed;
      pv.speed = THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * 3.8));

      const stepDist = pv.speed * dt;
      const nextX = pos.x + Math.sin(pv.heading) * stepDist;
      const nextZ = pos.z + Math.cos(pv.heading) * stepDist;

      const isStepBlocked = (tx, tz) =>
        Boolean(this.world?.isDeepWaterAt?.(tx, tz, { forCar: true })) ||
        getMetroCutoutFloorY(tx, tz) !== null ||
        this._isSegmentBlockedByBuilding(pos.x, pos.z, tx, tz);

      if (isStepBlocked(nextX, nextZ)) {
        pv.stuckTimer = (pv.stuckTimer || 0) + dt;
        const steerAngles = [
          pv.heading + 0.65,
          pv.heading - 0.65,
          pv.heading + Math.PI * 0.5,
          pv.heading - Math.PI * 0.5
        ];
        let foundClear = false;
        for (const candAng of steerAngles) {
          const cx = pos.x + Math.sin(candAng) * Math.max(2.2, stepDist);
          const cz = pos.z + Math.cos(candAng) * Math.max(2.2, stepDist);
          if (!isStepBlocked(cx, cz)) {
            pv.heading = candAng;
            pos.x = pos.x + Math.sin(candAng) * stepDist * 0.85;
            pos.z = pos.z + Math.cos(candAng) * stepDist * 0.85;
            pos.y = this.world?.getSurfaceHeightAt
              ? this.world.getSurfaceHeightAt(pos.x, pos.z, pos.y)
              : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(pos.x, pos.z) : 0);
            foundClear = true;
            break;
          }
        }
        if (!foundClear) {
          pv.heading += (i % 2 === 0 ? 1 : -1) * 1.15;
          pv.speed *= 0.45;
        }
      } else {
        pv.stuckTimer = Math.max(0, (pv.stuckTimer || 0) - dt * 1.5);
        pos.x = nextX;
        pos.z = nextZ;
        pos.y = this.world?.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(pos.x, pos.z, pos.y)
          : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(pos.x, pos.z) : 0);
      }

      // Reposicionamento Anti-Preso / Anti-Distância: se ficou presa > 2.2s ou > 115m sem visão por > 3.5s, reposiciona a 35..58m!
      const blockedToPlayer = this._isSegmentBlockedByBuilding(pos.x, pos.z, playerPos.x, playerPos.z);
      if (dist > 115.0 && blockedToPlayer && !inUnderground) {
        pv.farNoLosTimer = (pv.farNoLosTimer || 0) + dt;
      } else {
        pv.farNoLosTimer = 0;
      }

      if (
        !inUnderground &&
        (pv.stuckTimer > 2.2 || pv.farNoLosTimer > 3.5 || (dist > 175 && !this.isEscaping))
      ) {
        const resp = this._findPursuitSpawnPos(playerPos, 35, 58, i % 2 === 0);
        pos.set(resp.x, resp.y, resp.z);
        pv.heading = Math.atan2(playerPos.x - resp.x, playerPos.z - resp.z);
        pv.stuckTimer = 0;
        pv.farNoLosTimer = 0;
      }

      mesh.rotation.y = pv.heading;
      carObj.basePos.copy(pos);
      carObj.groundY = pos.y;
      if (pv.col) {
        pv.col.minX = pos.x - 1.3;
        pv.col.maxX = pos.x + 1.3;
        pv.col.minZ = pos.z - 2.4;
        pv.col.maxZ = pos.z + 2.4;
        pv.col.minY = pos.y;
        pv.col.maxY = pos.y + 1.8;
      }

      // Colisão física / PIT Maneuver contra o carro do jogador (2+ Estrelas!)
      if (playerCar && dist < 4.3 && Math.abs(playerPos.y - pos.y) < 2.5 && pv.pitCooldown <= 0) {
        pv.pitCooldown = 1.35;
        soundFX.playPlasticHit();
        if (this.stars >= 2 && typeof controller.vehicleHeading === 'number') {
          const spinDir = i % 2 === 0 ? 1 : -1;
          controller.vehicleHeading += spinDir * (this.stars >= 4 ? 0.34 : 0.24);
          controller.vehicleSpeed *= 0.86;
          this.destructibles._spawnElectricSparks(
            new THREE.Vector3((pos.x + playerPos.x) * 0.5, pos.y + 0.7, (pos.z + playerPos.z) * 0.5),
            6
          );
        } else if (controller) {
          controller.vehicleSpeed *= 0.88;
        }
      }
    }
  }

  _updateFootUnits(dt, playerPos, controller) {
    for (let i = this.footUnits.length - 1; i >= 0; i--) {
      const fu = this.footUnits[i];
      if (!fu.obj || fu.obj.destroyed) {
        this.footUnits.splice(i, 1);
        continue;
      }
      const pos = fu.mesh.position;
      const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
      if (dist > 145) {
        this.destructibles.unregisterDestructible(fu.obj);
        this.footUnits.splice(i, 1);
        continue;
      }

      const ang = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      fu.mesh.rotation.y = ang;

      if (dist > 11.0 && !this.isEscaping) {
        const nx = pos.x + Math.sin(ang) * fu.moveSpeed * dt;
        const nz = pos.z + Math.cos(ang) * fu.moveSpeed * dt;
        if (!this._isSegmentBlockedByBuilding(pos.x, pos.z, nx, nz)) {
          pos.x = nx;
          pos.z = nz;
          pos.y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0;
          fu.obj.basePos.copy(pos);
        }
      }

      if (this.isEscaping) continue;

      fu.shootCooldown -= dt;
      if (fu.shootCooldown <= 0 && dist < 68.0) {
        fu.shootCooldown = fu.isExo ? 0.85 : fu.isRiotElite ? 0.95 : 1.35;
        const muzzle = new THREE.Vector3(pos.x, pos.y + (fu.isExo ? 1.8 : 1.15), pos.z);
        const aim = new THREE.Vector3(
          playerPos.x + (Math.random() - 0.5) * 1.4,
          playerPos.y + 1.0,
          playerPos.z + (Math.random() - 0.5) * 1.4
        );
        this._spawnPursuitProjectile(muzzle, aim, 'bullet');
      }

      // 5 Estrelas: Exoesqueleto Anti-Herói dispara Rede Energética & Míssil Teleguiado!
      if (fu.isExo) {
        fu.specialCooldown -= dt;
        if (fu.specialCooldown <= 0 && dist < 95.0) {
          fu.specialCooldown = 3.4;
          const muzzle = new THREE.Vector3(pos.x, pos.y + 2.35, pos.z);
          const kind = Math.random() < 0.5 ? 'energy_net' : 'missile';
          this._spawnPursuitProjectile(
            muzzle,
            new THREE.Vector3(playerPos.x, playerPos.y + 1.1, playerPos.z),
            kind
          );
        }
      }
    }
  }

  _updateEagleHelicopter(dt, playerPos, controller) {
    if (!this.eagleHeli) return;
    if (this.eagleHeli.obj?.destroyed) {
      this._removeEagleHelicopter();
      return;
    }

    const heli = this.eagleHeli;
    heli.rotor.rotation.y += dt * 26.0;
    heli.orbitPhase += dt * 0.55;

    const redPhase = Math.sin(this._strobeClock * 1.2) > 0;
    heli.strobeRed.material = redPhase ? this.mats.strobeRedOn : this.mats.strobeOff;
    heli.strobeBlue.material = !redPhase ? this.mats.strobeBlueOn : this.mats.strobeOff;

    const inTunnel = this._isPlayerInUndergroundTunnel(playerPos);
    const underViaduct = this._isPlayerUnderViaduct(playerPos);
    const heliBlind = inTunnel || underViaduct || (controller?.stealthTimer || 0) > 0;

    // Se perdeu visão (ex.: entrou nos Túneis do Metrô ou debaixo do Viaduto), sobrevoa confuso sem grudar!
    const targetX = heliBlind
      ? heli.mesh.position.x + Math.cos(heli.orbitPhase) * 18.0 * dt * 8
      : playerPos.x + Math.cos(heli.orbitPhase) * 16.0;
    const targetZ = heliBlind
      ? heli.mesh.position.z + Math.sin(heli.orbitPhase) * 18.0 * dt * 8
      : playerPos.z + Math.sin(heli.orbitPhase) * 16.0;
    const groundAtHeli = this.world?.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(heli.mesh.position.x, heli.mesh.position.z)
      : 0;
    const desiredY = Math.max(groundAtHeli + 36.0, (heliBlind ? 0 : playerPos.y) + 34.0);

    const chaseLerp = Math.min(1, dt * (heliBlind ? 0.6 : 2.3));
    heli.mesh.position.x = THREE.MathUtils.lerp(heli.mesh.position.x, targetX, chaseLerp);
    heli.mesh.position.z = THREE.MathUtils.lerp(heli.mesh.position.z, targetZ, chaseLerp);
    heli.mesh.position.y = THREE.MathUtils.lerp(heli.mesh.position.y, desiredY, Math.min(1, dt * 2.5));
    heli.mesh.lookAt(playerPos.x, heli.mesh.position.y - 4.0, playerPos.z);
    heli.obj.basePos.copy(heli.mesh.position);

    // Holofote Branco Noturno seguindo o jogador no chão (0 SpotLights reais -> 100% 60 FPS!)
    const nightFactor = this.world?.atmosphere?.nightFactor ?? 0;
    const showSpotlight = nightFactor > 0.16 && !inTunnel;
    heli.coneMesh.visible = showSpotlight;
    heli.discMesh.visible = showSpotlight && !underViaduct;

    if (showSpotlight) {
      const origin = new THREE.Vector3(
        heli.mesh.position.x,
        heli.mesh.position.y - 1.2,
        heli.mesh.position.z
      );
      const spotGroundY = this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(playerPos.x, playerPos.z, playerPos.y)
        : 0;
      const spotTarget = heliBlind
        ? new THREE.Vector3(
            heli.mesh.position.x + Math.sin(heli.orbitPhase * 2) * 12,
            groundAtHeli + 0.08,
            heli.mesh.position.z + Math.cos(heli.orbitPhase * 2) * 12
          )
        : new THREE.Vector3(playerPos.x, spotGroundY + 0.08, playerPos.z);

      const beamVec = spotTarget.clone().sub(origin);
      const beamLen = Math.max(6.0, beamVec.length());
      heli.coneMesh.position.copy(origin);
      heli.coneMesh.scale.set(5.4, beamLen, 5.4);
      // Orienta o eixo -Y do cone para apontar exatamente para `spotTarget`!
      const downAxis = new THREE.Vector3(0, -1, 0);
      heli.coneMesh.quaternion.setFromUnitVectors(downAxis, beamVec.clone().normalize());
      this.mats.spotlightCone.opacity = 0.14 + nightFactor * 0.16;

      heli.discMesh.position.copy(spotTarget);
      heli.discMesh.scale.setScalar(5.6);
      this.mats.spotlightDisc.opacity = 0.22 + nightFactor * 0.2;
    }

    // 4+ Estrelas: Atirador de elite do Águia faz disparos espaçados se tiver linha de visão!
    if (this.stars >= 4 && !heliBlind && !this.isEscaping) {
      heli.shootTimer -= dt;
      if (heli.shootTimer <= 0) {
        heli.shootTimer = 1.65;
        this._spawnPursuitProjectile(
          heli.mesh.position.clone().add(new THREE.Vector3(0, -1.3, 0)),
          playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.0, (Math.random() - 0.5) * 2.2)),
          'bullet'
        );
      }
    }
  }

  _updateHunterDrones(dt, playerPos, controller) {
    for (let i = this.hunterDrones.length - 1; i >= 0; i--) {
      const dr = this.hunterDrones[i];
      if (!dr.obj || dr.obj.destroyed) {
        this.hunterDrones.splice(i, 1);
        continue;
      }

      dr.orbitOffset += dt * 1.85;
      const blind = this._isPlayerInUndergroundTunnel(playerPos) || (controller?.stealthTimer || 0) > 0;
      const desired = blind
        ? new THREE.Vector3(
            dr.mesh.position.x + Math.cos(dr.orbitOffset) * 10 * dt,
            Math.max(12, dr.mesh.position.y),
            dr.mesh.position.z + Math.sin(dr.orbitOffset) * 10 * dt
          )
        : new THREE.Vector3(
            playerPos.x + Math.cos(dr.orbitOffset + i * 2.1) * 14.0,
            Math.max(playerPos.y + 4.8, 5.5),
            playerPos.z + Math.sin(dr.orbitOffset + i * 2.1) * 14.0
          );

      const toTarget = desired.sub(dr.mesh.position);
      const dist = toTarget.length();
      const maxStep = 52.0 * dt; // Rápido o bastante p/ acompanhar heróis voadores e carros a 300+ km/h!
      if (dist > 0.05) {
        dr.mesh.position.addScaledVector(toTarget.normalize(), Math.min(dist, maxStep));
      }
      dr.mesh.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);
      dr.obj.basePos.copy(dr.mesh.position);

      if (!blind && !this.isEscaping) {
        dr.fireCooldown -= dt;
        if (dr.fireCooldown <= 0 && dr.mesh.position.distanceTo(playerPos) < 88.0) {
          dr.fireCooldown = 2.6 + Math.random() * 1.2;
          const kind = i % 2 === 0 ? 'energy_net' : 'missile';
          this._spawnPursuitProjectile(
            dr.mesh.position.clone(),
            playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
            kind
          );
        }
      }
    }
  }

  _updateRoadblocks(dt, playerPos, controller) {
    const carObj = controller?.currentVehicle;
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.age += dt;
      const dist = Math.hypot(playerPos.x - rb.x, playerPos.z - rb.z);

      // Rampa de Emergência da Barreira: se o jogador passar em velocidade pela rampa, decola por cima do bloqueio!
      if (carObj && controller && Math.abs(controller.vehicleSpeed || 0) > 16.0) {
        const rDist = Math.hypot(
          carObj.mesh.position.x - rb.rampPos.x,
          carObj.mesh.position.z - rb.rampPos.z
        );
        if (rDist < 3.4 && Math.abs(carObj.mesh.position.y - rb.rampPos.y) < 2.2) {
          controller._hydraulicJumpVelY = Math.max(controller._hydraulicJumpVelY || 0, 16.5);
          controller._hydraulicAirOffset = Math.max(controller._hydraulicAirOffset || 0, 0.35);
          soundFX.playCarHorn(0.65, false);
        }
      }

      if (rb.age > 35.0 || dist > 230.0) {
        this._clearRoadblock(rb);
        this.roadblocks.splice(i, 1);
      }
    }
  }

  _updateEnemyProjectiles(dt, playerPos, controller) {
    const targetCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.05, playerPos.z);

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.life -= dt;

      // Míssil Teleguiado (5 Estrelas) faz curva suave perseguindo o jogador/carro/herói voador!
      if (p.kind === 'missile') {
        const desiredDir = targetCenter.clone().sub(p.mesh.position).normalize();
        const curDir = p.vel.clone().normalize();
        curDir.lerp(desiredDir, Math.min(1, dt * 3.2)).normalize();
        p.vel.copy(curDir.multiplyScalar(p.speed));
        p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
        if (Math.random() < 0.7) {
          this.destructibles.spawnFlameTrailParticle(p.mesh.position, 0.65, 0xf97316);
        }
      } else if (p.kind === 'energy_net') {
        p.mesh.rotation.x += dt * 8.0;
        p.mesh.rotation.y += dt * 8.0;
      }

      p.mesh.position.addScaledVector(p.vel, dt);

      const hitRadius = controller?.currentVehicle ? 2.45 : 1.15;
      const distToPlayer = p.mesh.position.distanceTo(targetCenter);

      let removeProj = p.life <= 0;
      if (distToPlayer <= hitRadius) {
        if (p.kind === 'energy_net') {
          this._applyEnergyNetHit(playerPos, controller);
        } else if (p.kind === 'missile') {
          this.destructibles._triggerExplosion(p.mesh.position.clone(), 5.2, 35, false, false, {
            fromPursuitPolice: true
          });
        }
        this.applyPursuitDamageToPlayer(p.damage, controller);
        removeProj = true;
      } else {
        const floorY = this.world?.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(p.mesh.position.x, p.mesh.position.z)
          : 0;
        if (p.mesh.position.y <= floorY + 0.15) {
          if (p.kind === 'missile') {
            this.destructibles._triggerExplosion(p.mesh.position.clone(), 5.0, 30, false, false, {
              fromPursuitPolice: true
            });
          }
          removeProj = true;
        }
      }

      if (removeProj) {
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }
}

function reasonNeedsReset(controller) {
  return Boolean(controller && controller.position);
}

