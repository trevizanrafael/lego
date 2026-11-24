import {
  PAD, PAD_NAMES, VIEW_HOLD_SECONDS, MENU_REPEAT_DELAY, MENU_REPEAT_RATE, MENU_REPEATING,
  DIGITAL_STICK_THRESHOLD, applyRadialDeadzone, applyLookCurve, detectGamepadFamily,
  isAirVehicleCategory, readButtonPressed, resolveBindingsForContext
} from './GamepadBindings.js';
import { GamepadVirtualCursor } from './GamepadVirtualCursor.js';
import { applyGamepadAimAssist } from './GamepadAimAssist.js';

const LOOK_SPEED_YAW = 3.1;
const LOOK_SPEED_PITCH = 2.2;

function defaultEmitKey(controller, code, isDown) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof KeyboardEvent === 'function') {
    window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true }));
    return;
  }
  controller?._onKey?.({ code, repeat: false, preventDefault() {}, target: null }, isDown);
}

/**
 * Lê o controle a cada frame e converte para o mesmo pipeline do teclado/mouse:
 * botões viram `KeyboardEvent` sintéticos (menus e HUD respondem sem código novo),
 * analógicos alimentam `analogMove`/`analogSteer`/`yaw`/`pitch` do controlador.
 */
export class GamepadInputRuntime {
  constructor(controller, hud, options = {}) {
    this.controller = controller;
    this.hud = hud;
    this.getGamepads = options.getGamepads || (() => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []));
    this.emitKey = options.emitKey || ((code, isDown) => defaultEmitKey(this.controller, code, isDown));
    this.cursor = options.cursor === undefined ? new GamepadVirtualCursor() : options.cursor;
    this.connected = false;
    this.family = 'xbox';
    this.lastInputTime = -Infinity;
    this._time = 0;
    this._prevPressed = Object.create(null);
    this._heldBindings = Object.create(null);
    this._repeatTimers = Object.create(null);
    this._viewHeldTime = 0;
    this._viewRadioOpened = false;
    this._prevStickDigital = { forward: false, backward: false, left: false, right: false };
    this._prevContext = 'foot';
    this._rumbleTimer = 0;
    this._aimWasHeld = false;
    this._suppressUntilRelease = new Set();
  }

  _showConnectedToast(padId) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    let el = document.getElementById?.('gamepad-connected-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gamepad-connected-toast';
      el.className = 'gamepad-connected-toast';
      document.body?.appendChild?.(el);
    }
    const isEn = this.hud?.settings?.language === 'en';
    const label = this.family === 'playstation' ? 'PLAYSTATION' : 'XBOX';
    el.textContent = `🎮 ${isEn ? 'CONTROLLER CONNECTED' : 'CONTROLE CONECTADO'} // ${label}`;
    el.title = String(padId || '');
    el.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
  }

  _activePad() {
    const pads = this.getGamepads() || [];
    let best = null;
    for (const p of pads) {
      if (!p || p.connected === false) continue;
      if (!best || (p.timestamp || 0) > (best.timestamp || 0)) best = p;
    }
    return best;
  }

  _resolveContext() {
    const hud = this.hud || {};
    const ctl = this.controller || {};
    if (hud.isCreatorOpen || hud.isCustomsOpen || hud.isAircraftStudioOpen || hud.isFullMapOpen || hud.isTikTokRadioOpen) return 'cursor';
    if (
      hud.isTitleScreenActive || hud.isPauseMenuOpen || hud.isConfirmDialogOpen || hud.isLoadingActive ||
      hud.isCharacterGridOpen || hud.isHeroWheelOpen || hud.isDossierOpen
    ) return 'menu';
    if (hud.isRadioWheelOpen) return 'radio';
    if (ctl.currentVehicle) {
      const category = ctl.currentVehicle.mesh?.userData?.vehicleSpec?.category;
      return isAirVehicleCategory(category) ? 'air' : 'vehicle';
    }
    return 'foot';
  }

  _releaseAllHeld() {
    for (const name of Object.keys(this._heldBindings)) {
      this._sendBinding(this._heldBindings[name], false);
      delete this._heldBindings[name];
    }
    const ctl = this.controller;
    if (ctl) {
      ctl.analogMove = null;
      ctl.analogSteer = null;
      if (ctl.keys) for (const k of Object.keys(this._prevStickDigital)) if (this._prevStickDigital[k]) ctl.keys[k] = false;
    }
    this._prevStickDigital = { forward: false, backward: false, left: false, right: false };
  }

  _sendBinding(binding, isDown) {
    if (!binding) return;
    if (binding.startsWith('mouse:')) {
      const button = Number(binding.slice(6));
      if (isDown) this.controller?._handlePointerButtonDown?.(button, { fromGamepad: true });
      else this.controller?._handlePointerButtonUp?.(button);
      return;
    }
    this.emitKey(binding, isDown);
  }

  _markActivity() {
    this.lastInputTime = this._time;
    const ctl = this.controller;
    if (ctl && !ctl.hasEnteredGame && !this.hud?.isTitleScreenActive) {
      ctl.hasEnteredGame = true;
      const promptEl = typeof document !== 'undefined' ? document.getElementById?.('pointer-prompt') : null;
      promptEl?.classList?.remove('visible');
    }
  }

  /** Chamado uma vez por frame pelo loop principal (inclusive com menus abertos). */
  poll(dt = 1 / 60) {
    this._time += dt;
    const pad = this._activePad();
    if (!pad) {
      if (this.connected) { this.connected = false; this._releaseAllHeld(); this.cursor?.hide?.(); }
      return;
    }
    if (!this.connected) {
      this.connected = true;
      this.family = detectGamepadFamily(pad.id);
      this._showConnectedToast(pad.id);
    }

    const pressed = Object.create(null);
    for (const name of PAD_NAMES) pressed[name] = readButtonPressed(pad.buttons?.[PAD[name]], name);

    const context = this._resolveContext();
    if (context !== this._prevContext) {
      this._releaseAllHeld();
      this._repeatTimers = Object.create(null);
      // O botão que abriu/fechou o menu continua apertado: ignora até soltar para não disparar de novo.
      const radioSwap = context === 'radio' || this._prevContext === 'radio';
      for (const name of PAD_NAMES) if (pressed[name] && !(radioSwap && name === 'VIEW')) this._suppressUntilRelease.add(name);
      this._prevContext = context;
    }
    for (const name of [...this._suppressUntilRelease]) {
      if (pressed[name]) pressed[name] = false;
      else this._suppressUntilRelease.delete(name);
    }
    if (context === 'cursor') this.cursor?.show?.(); else this.cursor?.hide?.();
    const axes = pad.axes || [];
    const left = applyRadialDeadzone(axes[0] || 0, axes[1] || 0);
    const right = applyRadialDeadzone(axes[2] || 0, axes[3] || 0);
    if (left.mag > 0 || right.mag > 0 || PAD_NAMES.some((n) => pressed[n])) this._markActivity();

    if (context === 'cursor') this._updateCursorContext(dt, pressed, left, right);
    else if (context === 'menu') this._updateMenuContext(dt, pressed, left);
    else if (context === 'radio') this._updateRadioContext(pressed, right);
    else this._updateGameplayContext(dt, context, pressed, left, right);

    for (const name of PAD_NAMES) this._prevPressed[name] = pressed[name];
  }

  _edge(pressed, name) {
    if (pressed[name] && !this._prevPressed[name]) return 'down';
    if (!pressed[name] && this._prevPressed[name]) return 'up';
    return null;
  }

  _updateGameplayContext(dt, context, pressed, left, right) {
    const ctl = this.controller;
    const bindings = resolveBindingsForContext(context);

    for (const name of PAD_NAMES) {
      if (name === 'VIEW') continue;
      const binding = bindings[name];
      if (!binding) continue;
      const edge = this._edge(pressed, name);
      if (edge === 'down') { this._heldBindings[name] = binding; this._sendBinding(binding, true); }
      else if (edge === 'up' && this._heldBindings[name]) { this._sendBinding(this._heldBindings[name], false); delete this._heldBindings[name]; }
    }
    this._updateViewButton(dt, pressed);

    if (ctl?.keys) {
      const isVehicle = context === 'vehicle' || context === 'air';
      const digital = {
        forward: !isVehicle && left.y < -DIGITAL_STICK_THRESHOLD,
        backward: !isVehicle && left.y > DIGITAL_STICK_THRESHOLD,
        left: left.x < -DIGITAL_STICK_THRESHOLD,
        right: left.x > DIGITAL_STICK_THRESHOLD
      };
      for (const k of Object.keys(digital)) {
        if (digital[k] !== this._prevStickDigital[k]) {
          ctl.keys[k] = digital[k];
          if (digital[k]) ctl.minifigure?.stopEmote?.();
        }
      }
      this._prevStickDigital = digital;
      ctl.analogMove = !isVehicle && left.mag > 0 ? { x: left.x, y: -left.y, mag: left.mag } : null;
      ctl.analogSteer = isVehicle && left.mag > 0 ? -left.x : null;
    }

    if (ctl && right.mag > 0) {
      const sens = Math.min(2.5, Math.max(0.2, Number(this.hud?.settings?.gamepadSensitivity ?? 1.0)));
      const aimScale = ctl.operatorWeapons?.getAimSensitivityScale?.() ?? 1.0;
      const invert = this.hud?.settings?.invertY ? -1 : 1;
      ctl.yaw -= applyLookCurve(right.x) * LOOK_SPEED_YAW * sens * aimScale * dt;
      const nextPitch = (ctl.pitch || 0) + applyLookCurve(right.y) * LOOK_SPEED_PITCH * sens * aimScale * invert * dt;
      ctl.pitch = Math.max(-1.48, Math.min(1.48, nextPitch));
    }

    const aimHeld = context === 'foot' && pressed.LT;
    if (aimHeld && this.hud?.settings?.gamepadAimAssist !== false) {
      applyGamepadAimAssist(ctl, dt, { justPressed: !this._aimWasHeld });
    }
    this._aimWasHeld = aimHeld;

    this._updateFireRumble(dt, pressed, context);
  }

  _updateViewButton(dt, pressed) {
    const edge = this._edge(pressed, 'VIEW');
    if (pressed.VIEW) {
      this._viewHeldTime += dt;
      if (!this._viewRadioOpened && this._viewHeldTime >= VIEW_HOLD_SECONDS) {
        this._viewRadioOpened = true;
        this.emitKey('KeyZ', true);
      }
    } else if (edge === 'up') {
      if (this._viewRadioOpened) this.emitKey('KeyZ', false);
      else { this.emitKey('KeyM', true); this.emitKey('KeyM', false); }
      this._viewHeldTime = 0;
      this._viewRadioOpened = false;
    }
  }

  _updateRadioContext(pressed, right) {
    if (right.mag > 0) this.hud?.updateRadioWheelAim?.(right.x * 24, right.y * 24);
    if (this._edge(pressed, 'LEFT') === 'down') this.emitKey('BracketLeft', true);
    if (this._edge(pressed, 'RIGHT') === 'down') this.emitKey('BracketRight', true);
    if (this._edge(pressed, 'B') === 'down') { this.emitKey('Escape', true); this.emitKey('Escape', false); }
    if (this._edge(pressed, 'VIEW') === 'up') {
      if (this._viewRadioOpened) this.emitKey('KeyZ', false);
      this._viewHeldTime = 0;
      this._viewRadioOpened = false;
    }
  }

  _updateMenuContext(dt, pressed, left) {
    const bindings = resolveBindingsForContext('menu');
    const stickDir = {
      UP: left.y < -DIGITAL_STICK_THRESHOLD, DOWN: left.y > DIGITAL_STICK_THRESHOLD,
      LEFT: left.x < -DIGITAL_STICK_THRESHOLD, RIGHT: left.x > DIGITAL_STICK_THRESHOLD
    };
    for (const name of Object.keys(bindings)) {
      const isHeld = pressed[name] || Boolean(stickDir[name]);
      const wasHeld = this._repeatTimers[name] !== undefined;
      if (isHeld && !wasHeld) {
        this._repeatTimers[name] = MENU_REPEAT_DELAY;
        this.emitKey(bindings[name], true);
        this.emitKey(bindings[name], false);
      } else if (isHeld && MENU_REPEATING.has(name)) {
        this._repeatTimers[name] -= dt;
        if (this._repeatTimers[name] <= 0) {
          this._repeatTimers[name] = MENU_REPEAT_RATE;
          this.emitKey(bindings[name], true);
          this.emitKey(bindings[name], false);
        }
      } else if (!isHeld && wasHeld) {
        delete this._repeatTimers[name];
      }
    }
    if (this.hud?.isHeroWheelOpen && left.mag > 0.6) this.hud.setHeroWheelDirection?.(left.x * 20, left.y * 20);
  }

  _updateCursorContext(dt, pressed, left, right) {
    const cursor = this.cursor;
    const stick = left.mag > 0 ? left : right;
    if (stick.mag > 0) cursor?.move?.(stick.x, stick.y, dt);
    if (this._edge(pressed, 'A') === 'down') cursor?.press?.();
    if (this._edge(pressed, 'A') === 'up') cursor?.release?.();
    for (const name of ['B', 'MENU']) {
      if (this._edge(pressed, name) === 'down') { this.emitKey('Escape', true); this.emitKey('Escape', false); }
    }
    if (this.hud?.isFullMapOpen && this._edge(pressed, 'VIEW') === 'up') { this.emitKey('KeyM', true); this.emitKey('KeyM', false); }
  }

  _updateFireRumble(dt, pressed, context) {
    this._rumbleTimer = Math.max(0, this._rumbleTimer - dt);
    const firing = (context === 'foot' && pressed.RT) || ((context === 'vehicle') && pressed.B) || (context === 'air' && pressed.R3);
    if (firing && this._rumbleTimer <= 0) {
      this._rumbleTimer = 0.11;
      this.rumble(0.18, 0.35, 60);
    }
  }

  /** Vibração (dual-rumble) quando o navegador/controle suportar. Silencioso caso contrário. */
  rumble(strong = 0.5, weak = 0.5, durationMs = 120) {
    const pad = this._activePad();
    const actuator = pad?.vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') return false;
    try {
      const res = actuator.playEffect('dual-rumble', { duration: durationMs, strongMagnitude: strong, weakMagnitude: weak });
      if (res && typeof res.catch === 'function') res.catch(() => {});
    } catch (_) { return false; }
    return true;
  }
}
