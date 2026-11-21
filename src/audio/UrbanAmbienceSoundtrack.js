/**
 * UrbanAmbienceSoundtrack.js
 * Orquestrador modular das 11 trilhas nativas Dark Ambient de 10 minutos (600s) por bairro.
 *
 * Responsabilidades:
 * - Resolve cada região/sub-região do mapa para o compositor exclusivo em `src/audio/ambience/regions/*`.
 * - Realiza crossfade suave (3.2s) ao cruzar fronteiras de bairros (dry + reverb + delay juntos).
 * - Dispara janela inicial imediata (3.2s) assim que o AudioContext desbloqueia, sem espera muda!
 * - Faz ducking suave automático quando a Rádio FM ([Z]/[P]) está ligada ou perto do palco do Baile (75m).
 */

import { getAmbienceAudioRig } from './ambience/AmbienceSynthPrimitives.js';
import { CENTRO_FINANCEIRO_AMBIENCE } from './ambience/regions/CentroFinanceiroAmbience.js';
import { TORRE_HEROIS_AMBIENCE } from './ambience/regions/TorreHeroisAmbience.js';
import { PARQUE_CENTRAL_AMBIENCE } from './ambience/regions/ParqueCentralAmbience.js';
import { SUBURBIO_NORTE_AMBIENCE } from './ambience/regions/SuburbioNorteAmbience.js';
import { PRAIA_SUL_AMBIENCE } from './ambience/regions/PraiaSulAmbience.js';
import { FAVELA_CDD_AMBIENCE } from './ambience/regions/FavelaCddAmbience.js';
import { INDUSTRIAL_LESTE_AMBIENCE } from './ambience/regions/IndustrialLesteAmbience.js';
import { PORTO_LESTE_AMBIENCE } from './ambience/regions/PortoLesteAmbience.js';
import { AEROPORTO_OESTE_AMBIENCE } from './ambience/regions/AeroportoOesteAmbience.js';
import { ILHA_PRISAO_AMBIENCE } from './ambience/regions/IlhaPrisaoAmbience.js';
import { AEROPORTA_AVIOES_AMBIENCE } from './ambience/regions/AeroportaAvioesAmbience.js';

export const REGION_AMBIENCE_CATALOG = Object.freeze({
  centro_financeiro: CENTRO_FINANCEIRO_AMBIENCE,
  torre_herois: TORRE_HEROIS_AMBIENCE,
  parque_central: PARQUE_CENTRAL_AMBIENCE,
  suburbio_norte: SUBURBIO_NORTE_AMBIENCE,
  praia_sul: PRAIA_SUL_AMBIENCE,
  favela_cdd_cv: FAVELA_CDD_AMBIENCE,
  industrial_leste: INDUSTRIAL_LESTE_AMBIENCE,
  porto_leste: PORTO_LESTE_AMBIENCE,
  aeroporto_oeste: AEROPORTO_OESTE_AMBIENCE,
  ilha_prisao: ILHA_PRISAO_AMBIENCE,
  aeroporta_avioes: AEROPORTA_AVIOES_AMBIENCE
});

const SUBREGION_CANONICAL_MAP = Object.freeze({
  super_banco_interior: 'centro_financeiro',
  lego_customs: 'centro_financeiro',
  metro_subterraneo: 'centro_financeiro',
  metro_central_subsolo: 'centro_financeiro',
  porao_torre_herois: 'torre_herois',
  torre_herois_interior: 'torre_herois'
});

export function resolveCanonicalAmbienceId(rawRegionId) {
  if (!rawRegionId || typeof rawRegionId !== 'string') return 'centro_financeiro';
  if (REGION_AMBIENCE_CATALOG[rawRegionId]) return rawRegionId;
  return SUBREGION_CANONICAL_MAP[rawRegionId] || 'centro_financeiro';
}

export class UrbanAmbienceSoundtrack {
  constructor(sfx) {
    this.sfx = sfx;
    this.isRunning = false;
    this.activeRegionId = 'centro_financeiro';
    this.rawSubRegionId = 'centro_financeiro';
    this.contextState = {
      subRegionId: 'centro_financeiro',
      altitudeY: 0,
      isNight: true,
      timeOfDay: 20
    };

    this._timer = null;
    this._tickIntervalMs = 600;
    this._lastTickMs = 0;
    this._baseCeilingGain = 0.92;
    this._crossfadeSec = 3.2;
    this._pendingInitialBurst = true;
    this._resumeHooked = false;

    this._cursors = new Map();
    for (const id of Object.keys(REGION_AMBIENCE_CATALOG)) {
      this._cursors.set(id, 0);
    }
    this._activeChannels = new Map(); // regionId -> { gainNode, revSend, delSend, state, fadeDeadline }
  }

  setContext(meta = {}) {
    if (!meta || typeof meta !== 'object') return;
    if (typeof meta.altitudeY === 'number') this.contextState.altitudeY = meta.altitudeY;
    if (typeof meta.isNight === 'boolean') this.contextState.isNight = meta.isNight;
    if (typeof meta.timeOfDay === 'number') this.contextState.timeOfDay = meta.timeOfDay;
    if (meta.regionId) {
      this.setRegion(meta.regionId);
    }
  }

  setRegion(rawRegionId) {
    const subId = rawRegionId || 'centro_financeiro';
    this.rawSubRegionId = subId;
    this.contextState.subRegionId = subId;

    const nextId = resolveCanonicalAmbienceId(subId);
    if (nextId === this.activeRegionId) return;

    const prevId = this.activeRegionId;
    this.activeRegionId = nextId;

    const ctx = this.sfx?.ctx;
    if (!this.isRunning || !ctx || ctx.state !== 'running') {
      this._pendingInitialBurst = true;
      return;
    }

    const rig = getAmbienceAudioRig(ctx, this.sfx.musicBus || ctx.destination);
    if (!rig) return;

    const now = ctx.currentTime || 0;
    const prevCh = this._activeChannels.get(prevId);
    if (prevCh?.gainNode?.gain) {
      prevCh.state = 'fading';
      prevCh.fadeDeadline = now + this._crossfadeSec + 0.5;
      try {
        prevCh.gainNode.gain.cancelScheduledValues?.(now);
        prevCh.gainNode.gain.setValueAtTime?.(Math.max(0.0002, prevCh.gainNode.gain.value || 0.7), now);
        prevCh.gainNode.gain.linearRampToValueAtTime?.(0.0001, now + this._crossfadeSec);
      } catch (_) {}
    }

    this._ensureChannelActive(rig, nextId, true);
    // Dispara janela ampla (2.8s) imediata no novo bairro para entrada musical sem espera
    this._scheduleRegionSlice(rig, nextId, 2.8);
    this._pendingInitialBurst = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._pendingInitialBurst = true;
    this._lastTickMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (this._timer) clearInterval(this._timer);
    if (!globalThis.__testEnvReady) {
      this._timer = setInterval(() => this._onTick(), this._tickIntervalMs);
      if (typeof this._timer?.unref === 'function') {
        this._timer.unref();
      }
    }
    this._onTick(true);
  }

  stop() {
    this.isRunning = false;
    this._pendingInitialBurst = true;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    const ctx = this.sfx?.ctx;
    if (ctx) {
      const now = ctx.currentTime || 0;
      for (const ch of this._activeChannels.values()) {
        try {
          ch.gainNode?.gain?.setValueAtTime?.(0.0001, now);
          ch.gainNode?.disconnect?.();
          ch.revSend?.disconnect?.();
          ch.delSend?.disconnect?.();
        } catch (_) {}
      }
    }
    this._activeChannels.clear();
  }

  _onContextUnlocked() {
    if (!this.isRunning) {
      this.start();
      return;
    }
    if (this._pendingInitialBurst) {
      this._onTick(true);
    }
  }

  _ensureChannelActive(rig, regionId, fadeIn = false) {
    const ctx = rig.ctx;
    const now = ctx.currentTime || 0;
    const composer = REGION_AMBIENCE_CATALOG[regionId] || CENTRO_FINANCEIRO_AMBIENCE;
    const targetGain = Math.max(0.2, Math.min(1.0, composer.baseGain ?? 0.88));

    let ch = this._activeChannels.get(regionId);
    if (!ch) {
      const gainNode = ctx.createGain();
      gainNode._isRegionChannelBus = true;
      gainNode.gain.setValueAtTime?.(fadeIn ? 0.001 : targetGain, now);
      if (fadeIn && typeof gainNode.gain.linearRampToValueAtTime === 'function') {
        gainNode.gain.linearRampToValueAtTime(targetGain, now + this._crossfadeSec);
      }

      // Conecta dry + reverb + delay através do próprio canal do bairro (crossfade unificado!)
      gainNode.connect(rig.dryBus);
      let revSend = null;
      let delSend = null;
      if (rig.reverbInput) {
        revSend = ctx.createGain();
        revSend.gain.setValueAtTime?.(0.68, now);
        gainNode.connect(revSend);
        revSend.connect(rig.reverbInput);
      }
      if (rig.delayInput) {
        delSend = ctx.createGain();
        delSend.gain.setValueAtTime?.(0.32, now);
        gainNode.connect(delSend);
        delSend.connect(rig.delayInput);
      }

      ch = { gainNode, revSend, delSend, state: 'active', fadeDeadline: Infinity };
      this._activeChannels.set(regionId, ch);
    } else if (ch.state === 'fading') {
      ch.state = 'active';
      ch.fadeDeadline = Infinity;
      try {
        ch.gainNode.gain.cancelScheduledValues?.(now);
        ch.gainNode.gain.setValueAtTime?.(Math.max(0.002, ch.gainNode.gain.value || 0.3), now);
        ch.gainNode.gain.linearRampToValueAtTime?.(targetGain, now + this._crossfadeSec * 0.75);
      } catch (_) {}
    }
    return ch;
  }

  _scheduleRegionSlice(rig, regionId, sliceSec) {
    const composer = REGION_AMBIENCE_CATALOG[regionId];
    if (!composer || typeof composer.scheduleWindow !== 'function') return;

    const ch = this._ensureChannelActive(rig, regionId, false);
    const duration = composer.durationSec || 600;
    const cur = this._cursors.get(regionId) || 0;
    const startTime = (rig.ctx.currentTime || 0) + 0.03;

    composer.scheduleWindow({
      cursorSec: cur,
      windowDurSec: sliceSec,
      rig,
      targetNode: ch.gainNode,
      startTime,
      contextState: this.contextState
    });

    this._cursors.set(regionId, (cur + sliceSec) % duration);
  }

  step(dtSec = 0.6) {
    const sfx = this.sfx;
    if (!sfx || !this.isRunning) return false;
    if ((sfx.masterVolume ?? 0.85) * (sfx.musicVolume ?? 0.55) <= 0.008) return false;

    const ctx = sfx._ensureContext?.();
    if (!ctx) return false;

    if (ctx.state !== 'running') {
      if (!this._resumeHooked && typeof ctx.resume === 'function') {
        this._resumeHooked = true;
        ctx.resume()
          .then(() => {
            this._resumeHooked = false;
            if (this.isRunning && ctx.state === 'running') {
              this._onTick(true);
            }
          })
          .catch(() => {
            this._resumeHooked = false;
          });
      }
      return false;
    }

    const rig = getAmbienceAudioRig(ctx, sfx.musicBus || ctx.destination);
    if (!rig) return false;

    const now = ctx.currentTime || 0;
    const baileMix = Math.max(0, Math.min(1, sfx.baileFunkMix || 0));
    const shouldDuck = Boolean(sfx.tiktokRadioActive) || baileMix > 0.96;
    const desiredCeiling = shouldDuck
      ? 0.0001
      : this._baseCeilingGain * Math.max(0.05, 1.0 - baileMix * 0.94);

    if (rig.masterOut?.gain) {
      if (typeof rig.masterOut.gain.setTargetAtTime === 'function') {
        rig.masterOut.gain.setTargetAtTime(desiredCeiling, now, 0.25);
      } else {
        rig.masterOut.gain.setValueAtTime?.(desiredCeiling, now);
      }
    }

    for (const [id, ch] of this._activeChannels.entries()) {
      if (ch.state === 'fading' && now >= ch.fadeDeadline) {
        try {
          ch.gainNode?.disconnect?.();
          ch.revSend?.disconnect?.();
          ch.delSend?.disconnect?.();
        } catch (_) {}
        this._activeChannels.delete(id);
      }
    }

    // Na primeira janela desbloqueada, dispara 3.2s de uma vez para som imediato!
    const effectiveSlice = this._pendingInitialBurst
      ? Math.max(2.8, dtSec)
      : Math.max(0.1, Math.min(2.5, dtSec));

    for (const [id, cur] of this._cursors.entries()) {
      if (id !== this.activeRegionId) {
        const dur = REGION_AMBIENCE_CATALOG[id]?.durationSec || 600;
        this._cursors.set(id, (cur + effectiveSlice * 0.25) % dur);
      }
    }

    if (shouldDuck) return false;

    this._pendingInitialBurst = false;
    this._scheduleRegionSlice(rig, this.activeRegionId, effectiveSlice);
    return true;
  }

  _onTick(isInitial = false) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsedSec = isInitial
      ? 3.0
      : Math.max(0.25, Math.min(1.5, (nowMs - this._lastTickMs) * 0.001));
    this._lastTickMs = nowMs;
    this.step(elapsedSec);
  }
}
