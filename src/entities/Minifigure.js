import * as THREE from 'three';
import {
  MINIFIG_PRESETS,
  resolveHeroPreset,
  installMinifigMethods
} from './minifigure/HeroProfilesCatalog.js';
import { baseRigMethods } from './minifigure/MinifigBaseRigBuilder.js';
import { bigFigRigMethods } from './minifigure/BigFigRigBuilder.js';
import { ballisticWeaponMethods } from './minifigure/WeaponAndGearBuilder.js';
import { energyAndMeleeWeaponMethods } from './minifigure/EnergyAndMeleeWeaponsBuilder.js';
import { caveiraOutfitMethods } from './minifigure/outfits/CaveiraBopeOutfit.js';
import { vingadorOutfitMethods } from './minifigure/outfits/VingadorPunisherOutfit.js';
import { sombraOutfitMethods } from './minifigure/outfits/SombraShinobiOutfit.js';
import { solarisOutfitMethods } from './minifigure/outfits/SolarisSunKingOutfit.js';
import { turboOutfitMethods } from './minifigure/outfits/TurboGhostRiderOutfit.js';
import { voltaicoOutfitMethods } from './minifigure/outfits/VoltaicoStormlordOutfit.js';
import { vortexOutfitMethods } from './minifigure/outfits/VortexSymbioteOutfit.js';
import { updateMinifigSecondaryVfx } from './minifigure/MinifigVfxAndClothAnimator.js';
import {
  locomotionMethods,
  updateFlightAndGroundLocomotion
} from './minifigure/MinifigLocomotionAnimator.js';
import {
  combatAndEmoteMethods,
  updateEmoteOrRollInterrupt,
  updateCombatAndPowerPoses
} from './minifigure/MinifigCombatAnimator.js';

export { MINIFIG_PRESETS };

/**
 * Fachada principal articulada 3D de Minifiguras e Big-Figs do jogo.
 * A construção anatômica, arsenais, trajes táticos/elementais e animadores procedurais
 * residem nos submódulos coesos em `./minifigure/*` e `./minifigure/outfits/*`.
 */
export class Minifigure {
  constructor(presetKey = 'caveira') {
    this.root = new THREE.Group();
    this.visualRoot = new THREE.Group();
    this.root.add(this.visualRoot);

    this.animTime = 0;
    this.walkPhase = 0;
    this.state = 'IDLE'; // IDLE, WALK, RUN, JUMP, FALL, ROLL, HOVER, COMET, DRIVE
    this.landingSquash = 0;
    this.wasGrounded = true;

    this.punchTimer = 0;
    this.punchDuration = 0.22;
    this.punchComboStep = 0; // 0: Jab Esquerdo, 1: Direto Cruzado, 2: Gancho Duplo
    this.combatStanceTimer = 0;
    this.shootTimer = 0;
    this.muzzleFlashTimer = 0;
    this.rollTimer = 0;
    this.rollDuration = 0.42;
    this.isBeaming = false;

    this.currentHeroKey = presetKey;
    this.flameParticles = [];
    this.crownFlameMeshes = [];
    this.solarMantleStrips = [];
    this.solarMantleGroup = null;
    this.titaMinigunBarrelGroup = null;
    this.titaDashFlameMeshes = [];
    this.titaSirenLights = [];
    this.stompTimer = 0;
    this.stompDuration = 0.42;
    this.titaJumpChargeRatio = 0;
    this.isDashing = false;
    this.sombraScarfStrips = [];
    this.katanaAuraFlames = [];
    this.vingadorCoatTails = [];
    this.vingadorSkullEyes = [];
    this.vingadorBackShotgun = null;
    this.vingadorBackRpg = null;
    this.vingadorHolsteredPistols = [];
    this.vingadorDualRecoilSide = 1;
    this.vingadorFurorActive = false;
    this.isDiveSliding = false;
    this.muzzleFlashMesh = null;
    this.leftMuzzleFlashMesh = null;
    this.rifleGroup = null;
    this.vingadorWeapon = 'dual_smg'; // 'dual_smg' | 'shotgun' | 'rpg'
    this.isCarryingCar = false;
    this.isGrappling = false;
    this.isStealth = false;
    this.isBigFig = false;

    this.setHero(presetKey);
  }

  setHero(presetKey) {
    const preset = resolveHeroPreset(presetKey);
    this.currentHeroKey = preset.key;
    this.isBigFig = Boolean(preset.isBigFig);
    this.isStealth = false;
    this.vingadorFurorActive = false;
    this.isDiveSliding = false;
    this.buildModel(preset);
    return preset;
  }

  updateAnimation(
    dt,
    moveSpeed,
    maxRunSpeed,
    isGrounded,
    verticalVelocity,
    isFlying = false,
    isSupersonic = false,
    flightPitch = 0,
    flightBank = 0
  ) {
    this.animTime += dt;

    updateMinifigSecondaryVfx(
      this,
      dt,
      moveSpeed,
      maxRunSpeed,
      isGrounded,
      isFlying,
      isSupersonic
    );

    const lerpSpeed = Math.min(1, dt * 14);

    if (updateEmoteOrRollInterrupt(this, dt, moveSpeed, isGrounded, isFlying)) {
      return;
    }

    updateFlightAndGroundLocomotion(
      this,
      dt,
      lerpSpeed,
      moveSpeed,
      maxRunSpeed,
      isGrounded,
      verticalVelocity,
      isFlying,
      isSupersonic,
      flightPitch,
      flightBank
    );

    updateCombatAndPowerPoses(this, dt, lerpSpeed, isGrounded, verticalVelocity);
  }
}

installMinifigMethods(Minifigure.prototype, {
  ...baseRigMethods,
  ...bigFigRigMethods,
  ...ballisticWeaponMethods,
  ...energyAndMeleeWeaponMethods,
  ...caveiraOutfitMethods,
  ...vingadorOutfitMethods,
  ...sombraOutfitMethods,
  ...solarisOutfitMethods,
  ...turboOutfitMethods,
  ...voltaicoOutfitMethods,
  ...vortexOutfitMethods,
  ...locomotionMethods,
  ...combatAndEmoteMethods
});
