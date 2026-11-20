/**
 * Sistema de Rádio Ao Vivo Estilo GTA 6 (`TikTokRadioSystem` / `GtaRadioSystem`).
 *
 * Regras centrais:
 * - Sem pular música manualmente (zero nextTrack/prevTrack/seek pelo jogador).
 * - O jogador apenas sintoniza entre as Estações de Rádio (ou desliga em OFF).
 * - Todas as estações rodam simultaneamente no `LiveBroadcastClock`: ao sair de uma estação
 *   e voltar depois, o tempo de reprodução avançou junto com todas as outras rádios.
 * - Sincroniza em tempo real com a rota pública `/configs` (`http://localhost:5173/configs`).
 */

import { soundFX } from './SoundFX.js';
import {
  RADIO_STORAGE_KEY,
  RADIO_SYNC_CHANNEL,
  TIKTOK_RADIO_TRACKS,
  STATION_ICONS_SVG,
  getStationIconSvg,
  getDefaultTrackCoverSvg,
  getTrackCoverUrl,
  createDefaultRadioTracksList,
  createDefaultSingleStationState,
  RadioAudioStorageDB,
  collectMigratedLegacyTracksFromBrowser
} from './radio/RadioDefaultCatalogAndStorage.js';
import { LiveBroadcastClock, getDeterministicStationOrder } from './radio/LiveBroadcastScheduler.js';
import { playFmTuningStaticBurst, triggerSynthFallbackStep } from './radio/RadioSynthAndWebAudio.js';

export {
  TIKTOK_RADIO_TRACKS,
  STATION_ICONS_SVG,
  getStationIconSvg,
  getDefaultTrackCoverSvg,
  getTrackCoverUrl,
  createDefaultRadioTracksList,
  RadioAudioStorageDB,
  getDeterministicStationOrder
};

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    if (typeof FileReader !== 'function' || !(blob instanceof Blob)) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export class TikTokRadioSystem {
  constructor(hud = null) {
    this.hud = hud;
    const initial = createDefaultSingleStationState();
    this.stations = initial.stations;
    this.tracks = initial.tracks;
    this._tracksMap = new Map(this.tracks.map((t) => [t.id, t]));

    this.broadcastClock = new LiveBroadcastClock();
    this.activeStationId = null; // null = RÁDIO DESLIGADA (OFF)
    this._lastTunedStationId = null;
    this.isBassBoostActive = true;
    this.volume = 0.85;

    this._activeLiveState = null;
    this._playingTrackId = null;
    this._stepAccum = 0;
    this._stepIndex = 0;

    this.bassEnergy = 0;
    this.eqLevels = new Array(16).fill(0.08);

    this.radioBus = null;
    this.bassBoostFilter = null;
    this.analyser = null;
    this._freqData = new Uint8Array(32);

    this._audioElement = null;
    this._mediaSourceNode = null;
    this._usingAudioElement = false;
    this._loadedAudioSrc = '';
    this._pendingSeekOffsetSec = null;
    this._syncChannel = null;

    this._rebuildTracksMap();
    this._initLiveSyncAndMigration();
  }

  get isPlaying() {
    return Boolean(this.activeStationId && this.activeStation && this.currentTrack);
  }

  get activeStation() {
    if (!this.activeStationId) return null;
    return this.stations.find((s) => s.id === this.activeStationId) || null;
  }

  get currentTrack() {
    if (!this.activeStation) return null;
    const live = this.getStationLiveNow(this.activeStation.id);
    return live?.track || null;
  }

  _rebuildTracksMap() {
    this._tracksMap = new Map();
    for (const t of this.tracks) {
      if (t && t.id) this._tracksMap.set(t.id, t);
    }
  }

  _initLiveSyncAndMigration() {
    // 1. Tenta carregar cache imediato do localStorage antes do fetch assíncrono
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RADIO_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.initialized && Array.isArray(parsed.stations)) {
          this.applyExternalRadioConfig(parsed, false);
        }
      }
    } catch (_) {
      // Ignora erro de storage
    }

    // 2. Escuta atualizações em tempo real vindas da aba /configs (sem prender event-loop do Node em testes!)
    if (typeof BroadcastChannel === 'function' && !globalThis.__testEnvReady) {
      try {
        this._syncChannel = new BroadcastChannel(RADIO_SYNC_CHANNEL);
        this._syncChannel.unref?.();
        this._syncChannel.onmessage = (ev) => {
          if (ev?.data?.type === 'RADIO_CONFIG_UPDATED' && ev.data.state) {
            this.applyExternalRadioConfig(ev.data.state, false);
          }
        };
      } catch (_) {
        this._syncChannel = null;
      }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === RADIO_STORAGE_KEY && ev.newValue) {
          try {
            this.applyExternalRadioConfig(JSON.parse(ev.newValue), false);
          } catch (_) {
            // Ignora
          }
        }
      });
      window.addEventListener('focus', () => {
        this._pullStateFromServerOnce();
      });
    }

    // 3. No navegador real (com servidor Python em localhost:5173), sincroniza ou migra músicas salvas
    if (
      typeof window !== 'undefined' &&
      typeof fetch === 'function' &&
      String(window.location?.protocol || '').startsWith('http')
    ) {
      this._bootstrapWithServer();
    }
  }

  async _pullStateFromServerOnce() {
    if (typeof fetch !== 'function' || !String(window?.location?.protocol || '').startsWith('http')) {
      return;
    }
    try {
      const res = await fetch('/api/radio/state', { cache: 'no-store' });
      if (!res.ok) return;
      const serverState = await res.json();
      if (serverState?.initialized && Array.isArray(serverState.stations)) {
        this.applyExternalRadioConfig(serverState, false);
      }
    } catch (_) {
      // Ignora em modo offline/headless
    }
  }

  async _bootstrapWithServer() {
    try {
      const res = await fetch('/api/radio/state', { cache: 'no-store' });
      if (!res.ok) return;
      const serverState = await res.json();
      if (serverState?.initialized && Array.isArray(serverState.stations) && serverState.stations.length > 0) {
        this.applyExternalRadioConfig(serverState, false);
        return;
      }

      // Primeira inicialização: migra todas as músicas que o usuário já colocou no navegador para 1 única Rádio Padrão!
      const migratedTracks = await collectMigratedLegacyTracksFromBrowser();
      const uploadedTracks = [];
      for (const tr of migratedTracks) {
        const blob = RadioAudioStorageDB.getSyncMemoryBlob(tr.id);
        if (blob) {
          const audioDataUrl = await blobToDataUrl(blob);
          if (audioDataUrl) {
            try {
              const upRes = await fetch('/api/radio/upload-track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: tr.id,
                  title: tr.title,
                  artist: tr.artist,
                  durationSec: tr.durationSec,
                  audioDataUrl,
                  coverDataUrl: tr.coverDataUrl || '',
                  source: 'migrated'
                })
              });
              if (upRes.ok) {
                const upJson = await upRes.json();
                if (upJson?.track) {
                  uploadedTracks.push(upJson.track);
                  continue;
                }
              }
            } catch (_) {
              // Continua com URL local
            }
          }
        }
        uploadedTracks.push(tr);
      }

      const singleState = createDefaultSingleStationState(uploadedTracks);
      this.applyExternalRadioConfig(singleState, true);
    } catch (_) {
      // Fallback silencioso caso rodando sem server.py
    }
  }

  applyExternalRadioConfig(newState, persist = false) {
    if (!newState || !Array.isArray(newState.stations)) return;
    this.tracks = Array.isArray(newState.tracks) ? newState.tracks.map((t) => ({ ...t })) : [];
    this.stations = newState.stations.map((s) => ({
      id: s.id,
      name: s.name || 'ESTAÇÃO FM',
      freq: s.freq || '100.0 FM',
      genre: s.genre || 'AO VIVO',
      color: s.color || '#facc15',
      icon: s.icon || 'antenna',
      trackIds: Array.isArray(s.trackIds) ? [...s.trackIds] : []
    }));
    this._rebuildTracksMap();

    // Se a estação sintonizada foi excluída ou ficou vazia, reavalia reprodução
    if (this.activeStationId) {
      const stillExists = this.stations.find((s) => s.id === this.activeStationId);
      if (!stillExists || stillExists.trackIds.length === 0) {
        this.tuneStation(null, { showToast: false, playStatic: false });
      } else {
        this._syncPlaybackToLiveBroadcast(false);
      }
    }

    if (persist) {
      this._persistRadioConfig();
    } else {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(
            RADIO_STORAGE_KEY,
            JSON.stringify({ initialized: true, stations: this.stations, tracks: this.tracks })
          );
        }
      } catch (_) {
        // Ignora
      }
    }
    this.hud?.refreshTikTokRadioUI?.();
  }

  _persistRadioConfig() {
    const payload = {
      initialized: true,
      stations: this.stations,
      tracks: this.tracks
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RADIO_STORAGE_KEY, JSON.stringify(payload));
      }
    } catch (_) {
      // Ignora
    }
    try {
      this._syncChannel?.postMessage({ type: 'RADIO_CONFIG_UPDATED', state: payload });
    } catch (_) {
      // Ignora
    }
    if (
      typeof window !== 'undefined' &&
      typeof fetch === 'function' &&
      String(window.location?.protocol || '').startsWith('http')
    ) {
      fetch('/api/radio/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  /**
   * Consulta o que está passando AO VIVO agora em qualquer estação (usado na Roda Radial e no Player).
   */
  getStationLiveNow(stationId, customNowSec = null) {
    if (!stationId || stationId === 'off') return null;
    const st = this.stations.find((s) => s.id === stationId);
    if (!st) return null;
    return this.broadcastClock.sampleStationNow(st, this._tracksMap, customNowSec);
  }

  getWheelSlots() {
    const nowSec = this.broadcastClock.getNowSec();
    const slots = [
      {
        id: 'off',
        isOff: true,
        name: 'RÁDIO DESLIGADA',
        freq: 'OFF',
        genre: 'SILÊNCIO TÁTICO',
        color: '#94a3b8',
        icon: 'off',
        live: null
      }
    ];
    for (const st of this.stations) {
      slots.push({
        ...st,
        isOff: false,
        live: this.getStationLiveNow(st.id, nowSec)
      });
    }
    return slots;
  }

  /**
   * Sintoniza uma estação de rádio (ou desliga com `null` / `'off'`).
   * NUNCA permite escolher/pular música manualmente: entra direto no timestamp ao vivo da estação!
   */
  tuneStation(stationIdOrNull, opts = {}) {
    const { showToast = true, playStatic = true } = opts;
    const targetId = !stationIdOrNull || stationIdOrNull === 'off' ? null : String(stationIdOrNull);

    if (targetId === null) {
      const changed = this.activeStationId !== null;
      this.activeStationId = null;
      this._activeLiveState = null;
      this._playingTrackId = null;
      soundFX.tiktokRadioActive = false;
      this._stopAudioElement();
      if (changed && playStatic) {
        playFmTuningStaticBurst(this.radioBus, this.volume * 0.65);
      }
      this.hud?.refreshTikTokRadioUI?.();
      if (changed && showToast) {
        this.hud?.showTikTokRadioToast?.(null, null);
      }
      return null;
    }

    const station = this.stations.find((s) => s.id === targetId);
    if (!station) return null;

    const changedStation = this.activeStationId !== station.id;
    this.activeStationId = station.id;
    this._lastTunedStationId = station.id;

    if (changedStation && playStatic) {
      this._ensureAudioNodes();
      playFmTuningStaticBurst(this.radioBus, this.volume);
    }

    const live = this._syncPlaybackToLiveBroadcast(true);
    this.hud?.refreshTikTokRadioUI?.();
    if (showToast && live?.track) {
      this.hud?.showTikTokRadioToast?.(live.track, station);
    }
    return live;
  }

  togglePower(showToast = true) {
    if (this.activeStationId) {
      this.tuneStation(null, { showToast, playStatic: true });
      return false;
    }
    const preferred =
      (this._lastTunedStationId && this.stations.find((s) => s.id === this._lastTunedStationId)?.id) ||
      this.stations[0]?.id ||
      null;
    if (!preferred) return false;
    this.tuneStation(preferred, { showToast, playStatic: true });
    return Boolean(this.isPlaying);
  }

  /**
   * Alterna para a próxima/anterior estação da roda (incluindo o slot OFF), estilo botões [ e ] no GTA.
   */
  stepStation(delta = 1, showToast = true) {
    const order = ['off', ...this.stations.map((s) => s.id)];
    if (order.length <= 1) return null;
    const curKey = this.activeStationId || 'off';
    const curIdx = Math.max(0, order.indexOf(curKey));
    const step = delta < 0 ? -1 : 1;
    const nextKey = order[(curIdx + step + order.length) % order.length];
    return this.tuneStation(nextKey === 'off' ? null : nextKey, { showToast, playStatic: true });
  }

  /**
   * Utilitários de gerenciamento de estações e Drag & Drop entre rádios (usados por `/configs` e testes).
   */
  createStation({ name, freq = '99.9 FM', genre = 'FM', color = '#00f0ff', icon = 'bolt' } = {}) {
    const id = `station_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const st = {
      id,
      name: String(name || 'NOVA RÁDIO').trim().toUpperCase(),
      freq: String(freq || '99.9 FM').trim().toUpperCase(),
      genre: String(genre || 'PROGRAMAÇÃO AO VIVO').trim().toUpperCase(),
      color: color || '#00f0ff',
      icon: STATION_ICONS_SVG[icon] ? icon : 'antenna',
      trackIds: []
    };
    this.stations.push(st);
    this._persistRadioConfig();
    this.hud?.refreshTikTokRadioUI?.();
    return st;
  }

  moveTrackBetweenStations(trackId, fromStationId, toStationId, targetIndex = -1) {
    if (!trackId || !toStationId || !this._tracksMap.has(trackId)) return false;
    const dest = this.stations.find((s) => s.id === toStationId);
    if (!dest) return false;

    if (fromStationId && fromStationId !== toStationId) {
      const src = this.stations.find((s) => s.id === fromStationId);
      if (src) {
        src.trackIds = src.trackIds.filter((id) => id !== trackId);
      }
    }

    dest.trackIds = dest.trackIds.filter((id) => id !== trackId);
    if (targetIndex >= 0 && targetIndex <= dest.trackIds.length) {
      dest.trackIds.splice(targetIndex, 0, trackId);
    } else {
      dest.trackIds.push(trackId);
    }

    if (this.activeStationId) {
      this._syncPlaybackToLiveBroadcast(false);
    }
    this._persistRadioConfig();
    this.hud?.refreshTikTokRadioUI?.();
    return true;
  }

  _ensureAudioNodes() {
    const ctx = soundFX._ensureContext?.();
    if (!ctx) return null;

    if (!this.radioBus) {
      this.radioBus = ctx.createGain();
      this.bassBoostFilter = ctx.createBiquadFilter ? ctx.createBiquadFilter() : null;
      this.analyser = ctx.createAnalyser ? ctx.createAnalyser() : null;

      if (this.bassBoostFilter) {
        this.bassBoostFilter.type = 'lowshelf';
        if (this.bassBoostFilter.frequency?.setValueAtTime) {
          this.bassBoostFilter.frequency.setValueAtTime(95, ctx.currentTime);
        }
        const boostDb = this.isBassBoostActive ? 6.0 : 0.0;
        if (this.bassBoostFilter.gain?.setValueAtTime) {
          this.bassBoostFilter.gain.setValueAtTime(boostDb, ctx.currentTime);
        }
      }

      if (this.analyser) {
        this.analyser.fftSize = 64;
        this._freqData = new Uint8Array(this.analyser.frequencyBinCount || 32);
      }

      const dest = soundFX.musicBus || ctx.destination;
      if (this.bassBoostFilter && this.analyser) {
        this.radioBus.connect(this.bassBoostFilter);
        this.bassBoostFilter.connect(this.analyser);
        this.analyser.connect(dest);
      } else if (this.bassBoostFilter) {
        this.radioBus.connect(this.bassBoostFilter);
        this.bassBoostFilter.connect(dest);
      } else {
        this.radioBus.connect(dest);
      }
      this._applyVolume();
    }
    return ctx;
  }

  _applyVolume() {
    const ctx = soundFX.ctx;
    if (this.radioBus && ctx) {
      this.radioBus.gain.setValueAtTime(Math.max(0, Math.min(1.25, this.volume)), ctx.currentTime);
    }
    if (this._audioElement) {
      this._audioElement.volume = Math.max(0, Math.min(1, this.volume));
    }
  }

  setVolume(vol0to1, persist = true) {
    this.volume = Math.max(0, Math.min(1, Number(vol0to1) || 0));
    this._applyVolume();
    this.hud?.refreshTikTokRadioUI?.();
    if (persist) this.hud?.saveCurrentProgress?.();
  }

  stopAllPlayback() {
    this.activeStationId = null;
    this._activeLiveState = null;
    this._playingTrackId = null;
    this.bassEnergy = 0;
    this._stepAccum = 0;
    this._stepIndex = 0;
    soundFX.tiktokRadioActive = false;
    soundFX.baileBeatPulse = 0;
    this._stopAudioElement();
    for (let i = 0; i < 16; i++) this.eqLevels[i] = 0.08;
    this.hud?.refreshTikTokRadioUI?.();
  }

  _stopAudioElement() {
    this._usingAudioElement = false;
    this._pendingSeekOffsetSec = null;
    if (this._audioElement) {
      try {
        this._audioElement.pause();
      } catch (_) {
        // Ignora em mock
      }
    }
  }

  _syncPlaybackToLiveBroadcast(forceReseek = false) {
    const station = this.activeStation;
    if (!station) {
      this.stopAllPlayback();
      return null;
    }

    const live = this.getStationLiveNow(station.id);
    if (!live || !live.track) {
      this._activeLiveState = null;
      this._playingTrackId = null;
      soundFX.tiktokRadioActive = false;
      this._stopAudioElement();
      return null;
    }

    const prevTrackId = this._playingTrackId;
    this._activeLiveState = live;
    soundFX.tiktokRadioActive = true;

    const trackChanged = prevTrackId !== live.track.id;
    if (trackChanged || forceReseek) {
      this._playingTrackId = live.track.id;
      this._stepIndex = Math.floor((live.offsetSec / Math.max(1, live.durationSec)) * 64) % 64;
      this._startOrSeekTrackAudio(live.track, live.offsetSec);
      if (trackChanged && prevTrackId !== null && !forceReseek) {
        this.hud?.refreshTikTokRadioUI?.();
        this.hud?.showTikTokRadioToast?.(live.track, station);
      }
    }
    return live;
  }

  _startOrSeekTrackAudio(track, offsetSec = 0) {
    if (!track) return;
    const canUseHtmlAudio =
      Boolean(track.src) &&
      (track.isCustomFile || track.src.startsWith('/data/radio/') || track.src.startsWith('blob:') || track.src.startsWith('data:audio')) &&
      typeof window !== 'undefined' &&
      typeof window.Audio === 'function';

    if (!canUseHtmlAudio) {
      this._stopAudioElement();
      return;
    }

    try {
      if (!this._audioElement) {
        this._audioElement = new window.Audio();
        this._audioElement.crossOrigin = 'anonymous';
        this._audioElement.preload = 'auto';
        this._audioElement.addEventListener('loadedmetadata', () => {
          const realDur = Number(this._audioElement?.duration);
          const curTr = this._playingTrackId ? this._tracksMap.get(this._playingTrackId) : null;
          if (curTr && Number.isFinite(realDur) && realDur > 3 && Math.abs((curTr.durationSec || 0) - realDur) > 1.5) {
            curTr.durationSec = Math.round(realDur * 100) / 100;
          }
          if (this._pendingSeekOffsetSec !== null && Number.isFinite(realDur) && realDur > 1) {
            try {
              this._audioElement.currentTime = Math.min(realDur - 0.15, Math.max(0, this._pendingSeekOffsetSec));
            } catch (_) {
              // Ignora
            }
            this._pendingSeekOffsetSec = null;
          }
        });
      }

      this._audioElement.loop = false;
      this._audioElement.volume = Math.max(0, Math.min(1, this.volume));

      const ctx = this._ensureAudioNodes();
      if (ctx && typeof ctx.createMediaElementSource === 'function' && !this._mediaSourceNode) {
        this._mediaSourceNode = ctx.createMediaElementSource(this._audioElement);
        this._mediaSourceNode.connect(this.radioBus);
      }

      if (this._loadedAudioSrc !== track.src) {
        this._loadedAudioSrc = track.src;
        this._audioElement.src = track.src;
      }

      if (this._audioElement.readyState >= 1 && Number.isFinite(this._audioElement.duration) && this._audioElement.duration > 1) {
        this._audioElement.currentTime = Math.min(this._audioElement.duration - 0.15, Math.max(0, offsetSec));
        this._pendingSeekOffsetSec = null;
      } else {
        this._pendingSeekOffsetSec = offsetSec;
      }

      const p = this._audioElement.play();
      this._usingAudioElement = true;
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          this._usingAudioElement = false;
        });
      }
    } catch (_) {
      this._usingAudioElement = false;
    }
  }

  getPlaybackTimeInfo() {
    if (!this.activeStationId) {
      return { currentSec: 0, durationSec: 0, ratio: 0 };
    }
    const live = this.getStationLiveNow(this.activeStationId);
    if (!live) return { currentSec: 0, durationSec: 0, ratio: 0 };
    return {
      currentSec: live.offsetSec,
      durationSec: live.durationSec,
      ratio: live.ratio
    };
  }

  exportSaveState() {
    return {
      version: 2,
      volume: this.volume,
      isBassBoostActive: Boolean(this.isBassBoostActive),
      activeStationId: this.activeStationId
    };
  }

  importSaveState(savedRadioState) {
    this.stopAllPlayback();
    if (!savedRadioState || typeof savedRadioState !== 'object') {
      this.hud?.refreshTikTokRadioUI?.();
      return;
    }
    if (typeof savedRadioState.volume === 'number') {
      this.volume = Math.max(0, Math.min(1, savedRadioState.volume));
      this._applyVolume();
    }
    if (typeof savedRadioState.isBassBoostActive === 'boolean') {
      this.isBassBoostActive = savedRadioState.isBassBoostActive;
    }
    // Se vier um save legado antigo com faixas customizadas e só 1 rádio padrão, preserva sem perder nada
    if (Array.isArray(savedRadioState.tracks) && savedRadioState.tracks.length > 0 && savedRadioState.version !== 2) {
      const customLegacy = savedRadioState.tracks.filter((t) => Boolean(t?.isCustomFile));
      const baseList = customLegacy.length > 0 ? customLegacy : savedRadioState.tracks;
      const stState = createDefaultSingleStationState(
        baseList.map((t) => ({
          ...t,
          durationSec: Math.max(8, Number(t.durationSec) || (t.isCustomFile ? 150 : 92))
        }))
      );
      this.applyExternalRadioConfig(stState, false);
    }
    this.hud?.refreshTikTokRadioUI?.();
  }

  update(dt = 0.016) {
    if (!this.activeStationId) {
      this.bassEnergy = Math.max(0, this.bassEnergy - dt * 5.0);
      for (let i = 0; i < 16; i++) {
        this.eqLevels[i] = Math.max(0.08, this.eqLevels[i] - dt * 3.2);
      }
      return;
    }

    const live = this._syncPlaybackToLiveBroadcast(false);
    if (!live || !live.track) return;

    const bpm = live.track.bpm || 132;
    const stepDuration = 60 / bpm / 4;

    if (!this._usingAudioElement) {
      this._stepAccum += dt;
      while (this._stepAccum >= stepDuration) {
        this._stepAccum -= stepDuration;
        triggerSynthFallbackStep(this, live.track, this._stepIndex);
        this._stepIndex = (this._stepIndex + 1) % 64;
      }
    }

    this.bassEnergy = Math.max(0, this.bassEnergy - dt * 4.8);
    if (this.analyser && this._usingAudioElement && typeof this.analyser.getByteFrequencyData === 'function') {
      this.analyser.getByteFrequencyData(this._freqData);
      let lowSum = 0;
      for (let b = 0; b < 4; b++) lowSum += this._freqData[b] || 0;
      this.bassEnergy = Math.max(this.bassEnergy, Math.min(1.0, lowSum / (4 * 230)));
    }

    soundFX.baileBeatPulse = Math.max(soundFX.baileBeatPulse || 0, this.bassEnergy);
  }
}

export { TikTokRadioSystem as GtaRadioSystem };
