/**
 * UrbanAmbienceSoundtrack.js
 * Orquestrador modular das 11 trilhas nativas Dark Ambient de 10 minutos (600s) por bairro.
 *
 * Responsabilidades:
 * - Resolve cada região/sub-região do mapa para o compositor exclusivo em `src/audio/ambience/regions/*`.
 * - Realiza crossfade suave (3.2s) ao cruzar fronteiras de bairros sem cortes secos.
 * - Mantém cursores independentes dentro do arco de 600s (5 movimentos) de cada bairro.
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
    this._baseCeilingGain = 0.22;
    this._crossfadeSec = 3.2;

    // Cursores individuais de 0..600s por bairro + nós de crossfade ativos
    this._cursors = new Map();
    for (const id of Object.keys(REGION_AMBIENCE_CATALOG)) {
      this._cursors.set(id, 0);
    }
    this._activeChannels = new Map(); // regionId -> { gainNode, state: 'active' | 'fading', fadeDeadline }
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
    if (!this.isRunning || !ctx || ctx.state !== 'running') return;

    const rig = getAmbienceAudioRig(ctx, this.sfx.musicBus || ctx.destination);
    if (!rig) return;

    const now = ctx.currentTime || 0;
    const prevCh = this._activeChannels.get(prevId);
    if (prevCh?.gainNode?.gain) {
      prevCh.state = 'fading';
      prevCh.fadeDeadline = now + this._crossfadeSec + 0.5;
      try {
        prevCh.gainNode.gain.cancelScheduledValues?.(now);
        prevCh.gainNode.gain.setValueAtTime(Math.max(0.0002, prevCh.gainNode.gain.value || 0.5), now);
        prevCh.gainNode.gain.linearRampToValueAtTime(0.0001, now + this._crossfadeSec);
      } catch (_) {}
    }

    this._ensureChannelActive(rig, nextId, true);
    // Dispara imediatamente a primeira janela do novo bairro para transição sem buraco
    this._scheduleRegionSlice(rig, nextId, 0.75);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
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
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    const ctx = this.sfx?.ctx;
    if (ctx) {
      const now = ctx.currentTime || 0;
      for (const ch of this._activeChannels.values()) {
        try {
          ch.gainNode?.gain?.setValueAtTime(0.0001, now);
          ch.gainNode?.disconnect?.();
        } catch (_) {}
      }
    }
    this._activeChannels.clear();
  }

  _ensureChannelActive(rig, regionId, fadeIn = false) {
    const ctx = rig.ctx;
    const now = ctx.currentTime || 0;
    const composer = REGION_AMBIENCE_CATALOG[regionId] || CENTRO_FINANCEIRO_AMBIENCE;
    const targetGain = Math.max(0.1, Math.min(1.0, composer.baseGain ?? 0.85));

    let ch = this._activeChannels.get(regionId);
    if (!ch) {
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(fadeIn ? 0.0002 : targetGain, now);
      if (fadeIn && typeof gainNode.gain.linearRampToValueAtTime === 'function') {
        gainNode.gain.linearRampToValueAtTime(targetGain, now + this._crossfadeSec);
      }
      gainNode.connect(rig.dryBus);
      ch = { gainNode, state: 'active', fadeDeadline: Infinity };
      this._activeChannels.set(regionId, ch);
    } else if (ch.state === 'fading') {
      ch.state = 'active';
      ch.fadeDeadline = Infinity;
      try {
        ch.gainNode.gain.cancelScheduledValues?.(now);
        ch.gainNode.gain.setValueAtTime(Math.max(0.001, ch.gainNode.gain.value || 0.2), now);
        ch.gainNode.gain.linearRampToValueAtTime(targetGain, now + this._crossfadeSec * 0.75);
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
    const startTime = (rig.ctx.currentTime || 0) + 0.04;

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

  /**
   * Avança determinísticamente `dtSec` segundos (útil tanto para o timer real quanto para testes).
   */
  step(dtSec = 0.6) {
    const sfx = this.sfx;
    if (!sfx || !this.isRunning) return false;
    if ((sfx.masterVolume ?? 0.85) * (sfx.musicVolume ?? 0.55) <= 0.008) return false;

    const ctx = sfx._ensureContext?.();
    if (!ctx || ctx.state !== 'running') return false;

    const rig = getAmbienceAudioRig(ctx, sfx.musicBus || ctx.destination);
    if (!rig) return false;

    const now = ctx.currentTime || 0;
    const baileMix = Math.max(0, Math.min(1, sfx.baileFunkMix || 0));
    const shouldDuck = Boolean(sfx.tiktokRadioActive) || baileMix > 0.96;
    const desiredCeiling = shouldDuck
      ? 0.0001
      : this._baseCeilingGain * Math.max(0.04, 1.0 - baileMix * 0.94);

    if (rig.masterOut?.gain) {
      if (typeof rig.masterOut.gain.setTargetAtTime === 'function') {
        rig.masterOut.gain.setTargetAtTime(desiredCeiling, now, 0.28);
      } else {
        rig.masterOut.gain.setValueAtTime(desiredCeiling, now);
      }
    }

    // Limpa canais de bairros anteriores cujo crossfade de saída já terminou
    for (const [id, ch] of this._activeChannels.entries()) {
      if (ch.state === 'fading' && now >= ch.fadeDeadline) {
        try {
          ch.gainNode?.disconnect?.();
        } catch (_) {}
        this._activeChannels.delete(id);
      }
    }

    // Deriva lentamente os cursores inativos para que revisitar um bairro pegue outro trecho dos 10 min
    const clampedSlice = Math.max(0.1, Math.min(2.0, dtSec));
    for (const [id, cur] of this._cursors.entries()) {
      if (id !== this.activeRegionId) {
        const dur = REGION_AMBIENCE_CATALOG[id]?.durationSec || 600;
        this._cursors.set(id, (cur + clampedSlice * 0.25) % dur);
      }
    }

    if (shouldDuck) return false;

    this._scheduleRegionSlice(rig, this.activeRegionId, clampedSlice);
    return true;
  }

  _onTick(isInitial = false) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsedSec = isInitial ? 0.75 : Math.max(0.25, Math.min(1.5, (nowMs - this._lastTickMs) * 0.001));
    this._lastTickMs = nowMs;
    this.step(elapsedSec);
  }
}
