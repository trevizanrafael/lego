import * as THREE from 'three';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export const DAMAGE_NUMBER_POOL_SIZE = 12;
export const DAMAGE_NUMBER_DURATION_SEC = 0.60;
export const DAMAGE_MERGE_WINDOW_SEC = 0.25;

const _PROJ_SCRATCH = new THREE.Vector3();

function getDocById(id) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return null;
  }
  return document.getElementById(id);
}

function isAttachedNode(el, parentCandidate) {
  if (!el) return false;
  if (el.isConnected || el.parentNode) return true;
  if (Array.isArray(parentCandidate?.children) && parentCandidate.children.includes(el)) {
    return true;
  }
  return false;
}

function resolveTierAndClass(slot) {
  if (slot.isKill) return { tier: 'kill', cls: 'dmg-float-num is-kill' };
  if (slot.isHeadshot) return { tier: 'headshot', cls: 'dmg-float-num is-headshot' };
  if (slot.isVehicle) return { tier: 'vehicle', cls: 'dmg-float-num is-vehicle' };
  if (slot.zone === 'limbs' || slot.zone === 'limb') {
    return { tier: 'limb', cls: 'dmg-float-num is-limb' };
  }
  return { tier: 'body', cls: 'dmg-float-num is-body' };
}

/**
 * Instala na HUD o pool fixo de 12 números de dano flutuantes projetados do 3D
 * com agregação de rajadas/escopeta em janela de 0.25s e zero alocações por tiro.
 */
export function installDamageNumbersHud(LegoHud) {
  if (!LegoHud || typeof LegoHud.prototype?.spawnDamageNumber === 'function') {
    return;
  }

  definePrototypeMethods(LegoHud, {
    _initDamageNumbersHud() {
      if (this.settings && this.settings.damageNumbers === undefined) {
        this.settings.damageNumbers = true;
      }
      if (Array.isArray(this._damageNumberSlots) && this._damageNumberSlots.length === DAMAGE_NUMBER_POOL_SIZE) {
        return;
      }

      let layer = this.damageNumbersLayerEl || getDocById('damage-numbers-layer');
      if (!layer && typeof document !== 'undefined' && typeof document.createElement === 'function') {
        layer = document.createElement('div');
        if (layer) layer.id = 'damage-numbers-layer';
      }

      if (layer) {
        layer.className = 'damage-numbers-layer';
        layer.setAttribute?.('aria-hidden', 'true');
        const host = getDocById('ui-overlay') || (typeof document !== 'undefined' ? document.body : null);
        if (host && !isAttachedNode(layer, host)) {
          host.appendChild?.(layer);
        }
        this.damageNumbersLayerEl = layer;
      }

      const existingSpans = Array.isArray(layer?.children)
        ? layer.children
        : layer?.childNodes
          ? Array.from(layer.childNodes)
          : [];

      const slots = [];
      for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
        let el = existingSpans[i] || null;
        if (!el && layer && typeof document !== 'undefined' && typeof document.createElement === 'function') {
          el = document.createElement('span');
          if (el) {
            el.className = 'dmg-float-num';
            el.setAttribute?.('aria-hidden', 'true');
            layer.appendChild?.(el);
          }
        }
        if (el) {
          el.className = 'dmg-float-num';
          el.textContent = '';
          if (el.style) {
            el.style.opacity = '0';
            el.style.transform = 'translate3d(-9999px, -9999px, 0)';
          }
        }
        slots.push({
          el,
          active: false,
          age: 0,
          duration: DAMAGE_NUMBER_DURATION_SEC,
          worldX: 0,
          worldY: 0,
          worldZ: 0,
          jitterX: 0,
          accumDamage: 0,
          targetRef: null,
          zone: 'torso',
          tier: 'body',
          isHeadshot: false,
          isKill: false,
          isVehicle: false
        });
      }
      this._damageNumberSlots = slots;
      this._dmgJitterCursor = 0;
    },

    _applyDamageSlotDom(slot) {
      const { tier, cls } = resolveTierAndClass(slot);
      slot.tier = tier;
      const el = slot.el;
      if (!el) return;
      el.className = cls;
      if (el.dataset) el.dataset.tier = tier;
      const rounded = Math.max(1, Math.round(slot.accumDamage));
      el.textContent = slot.isHeadshot ? `✕ ${rounded}` : `${rounded}`;
    },

    _projectDamageSlot(slot, cam) {
      const el = slot.el;
      if (!el || !el.style || !cam || typeof cam.matrixWorldInverse === 'undefined') return;

      const progress = THREE.MathUtils.clamp(slot.age / slot.duration, 0, 1);
      _PROJ_SCRATCH.set(slot.worldX, slot.worldY + progress * 0.45, slot.worldZ);
      _PROJ_SCRATCH.project(cam);

      if (
        _PROJ_SCRATCH.z > 1 ||
        _PROJ_SCRATCH.z < -1 ||
        !Number.isFinite(_PROJ_SCRATCH.x) ||
        !Number.isFinite(_PROJ_SCRATCH.y)
      ) {
        el.style.opacity = '0';
        return;
      }

      const vw = typeof window !== 'undefined' && Number(window.innerWidth) > 0 ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' && Number(window.innerHeight) > 0 ? window.innerHeight : 720;
      const px = (_PROJ_SCRATCH.x * 0.5 + 0.5) * vw + slot.jitterX;
      const py = (-_PROJ_SCRATCH.y * 0.5 + 0.5) * vh - progress * 26;
      const opacity = progress <= 0.55 ? 1.0 : Math.max(0, 1.0 - (progress - 0.55) / 0.45);
      const scale = slot.isHeadshot || slot.isKill
        ? (progress < 0.15 ? 1.22 - progress * 0.8 : 1.1)
        : 1.0;

      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
    },

    setDamageNumbersEnabled(enabled) {
      this._initDamageNumbersHud();
      const on = Boolean(enabled);
      if (!this.settings) this.settings = {};
      this.settings.damageNumbers = on;
      if (!on) {
        this.clearDamageNumbersHud();
        this.damageNumbersLayerEl?.classList?.add('hidden');
      } else {
        this.damageNumbersLayerEl?.classList?.remove('hidden');
      }
      return on;
    },

    spawnDamageNumber(opts = {}) {
      if (this.settings?.damageNumbers === false) return null;
      const amount = Number(opts?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;

      this._initDamageNumbersHud();
      const slots = this._damageNumberSlots;
      if (!slots || slots.length === 0) return null;

      const targetObj = opts?.targetObj || null;
      const wp = opts?.worldPos || targetObj?.mesh?.position || targetObj?.basePos || null;
      const wx = Number(wp?.x) || 0;
      const wy = (Number(wp?.y) || 0) + (opts?.worldPos ? 0.12 : 1.35);
      const wz = Number(wp?.z) || 0;

      if (targetObj) {
        for (let i = 0; i < slots.length; i++) {
          const s = slots[i];
          if (s.active && s.targetRef === targetObj && s.age <= DAMAGE_MERGE_WINDOW_SEC) {
            s.accumDamage += amount;
            s.age = 0;
            s.worldX = wx;
            s.worldY = wy;
            s.worldZ = wz;
            s.isHeadshot = s.isHeadshot || Boolean(opts?.isHeadshot);
            s.isKill = s.isKill || Boolean(opts?.isKill);
            s.isVehicle = s.isVehicle || Boolean(opts?.isVehicle);
            if (opts?.zone === 'head' || s.isHeadshot) s.zone = 'head';
            else if (opts?.zone === 'torso' && (s.zone === 'limbs' || s.zone === 'limb')) s.zone = 'torso';
            this._applyDamageSlotDom(s);
            if (this._lastCamera) {
              this._projectDamageSlot(s, this._lastCamera);
            } else if (s.el?.style) {
              s.el.style.opacity = '1';
            }
            return s;
          }
        }
      }

      let chosen = null;
      let oldestSlot = slots[0];
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s.active) {
          chosen = s;
          break;
        }
        if (s.age > oldestSlot.age) {
          oldestSlot = s;
        }
      }
      const slot = chosen || oldestSlot;
      const jitterStep = ((this._dmgJitterCursor = ((this._dmgJitterCursor || 0) + 1) % 7) - 3);

      slot.active = true;
      slot.age = 0;
      slot.duration = DAMAGE_NUMBER_DURATION_SEC;
      slot.worldX = wx;
      slot.worldY = wy;
      slot.worldZ = wz;
      slot.jitterX = jitterStep * 4.5;
      slot.accumDamage = amount;
      slot.targetRef = targetObj;
      slot.zone = opts?.zone || 'torso';
      slot.isHeadshot = Boolean(opts?.isHeadshot);
      slot.isKill = Boolean(opts?.isKill);
      slot.isVehicle = Boolean(opts?.isVehicle);

      this._applyDamageSlotDom(slot);
      if (this._lastCamera) {
        this._projectDamageSlot(slot, this._lastCamera);
      } else if (slot.el?.style) {
        slot.el.style.opacity = '1';
      }
      return slot;
    },

    updateDamageNumbersHud(dt = 0.016, camera = null) {
      if (camera) this._lastCamera = camera;
      if (this.settings?.damageNumbers === false) return;
      const slots = this._damageNumberSlots;
      if (!slots) return;

      const step = Math.max(0, Number(dt) || 0);
      const cam = camera || this._lastCamera || null;

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot.active) continue;
        slot.age += step;
        if (slot.age >= slot.duration) {
          slot.active = false;
          slot.targetRef = null;
          slot.accumDamage = 0;
          if (slot.el) {
            slot.el.className = 'dmg-float-num';
            slot.el.textContent = '';
            if (slot.el.style) {
              slot.el.style.opacity = '0';
              slot.el.style.transform = 'translate3d(-9999px, -9999px, 0)';
            }
          }
          continue;
        }
        if (cam) {
          this._projectDamageSlot(slot, cam);
        }
      }
    },

    clearDamageNumbersHud() {
      const slots = this._damageNumberSlots;
      if (!slots) return;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        slot.active = false;
        slot.age = 0;
        slot.accumDamage = 0;
        slot.targetRef = null;
        if (slot.el) {
          slot.el.className = 'dmg-float-num';
          slot.el.textContent = '';
          if (slot.el.style) {
            slot.el.style.opacity = '0';
            slot.el.style.transform = 'translate3d(-9999px, -9999px, 0)';
          }
        }
      }
    }
  });
}
