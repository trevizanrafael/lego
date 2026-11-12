import { soundFX } from './SoundFX.js';

/**
 * CATÁLOGO DAS 8 FAIXAS VIRAIS DO TIKTOK + SUPORTE A IMPORTAÇÃO DE MP3 LOCAL & FOTOS DE CAPA
 */
export const TIKTOK_RADIO_TRACKS = [
  {
    id: 'mtg_automotivo',
    title: 'MTG AUTOMOTIVO BIBI / MANDELÃO VIRAL',
    artist: 'DJ LEGO MANDELÃO • TIKTOK VIRAL',
    bpm: 132,
    style: 'FUNK AUTOMOTIVO',
    color: '#00f2fe',
    src: '/music/tiktok/mtg_automotivo.mp3'
  },
  {
    id: 'brazilian_phonk',
    title: 'BRAZILIAN DANÇA PHONK (GIGACHAD EDIT)',
    artist: 'PHONK RIO 808 • VIRAL EDIT',
    bpm: 140,
    style: 'BRAZILIAN PHONK',
    color: '#fe0979',
    src: '/music/tiktok/brazilian_phonk.mp3'
  },
  {
    id: 'montagem_coral',
    title: 'MONTAGEM CORAL // BRUXARIA TIKTOK',
    artist: 'DJ SUBMUNDO • MONTAGEM 021',
    bpm: 136,
    style: 'MONTAGEM VIRAL',
    color: '#a855f7',
    src: '/music/tiktok/montagem_coral.mp3'
  },
  {
    id: 'passinho_viral',
    title: 'PASSINHO DO TAMBORZÃO 2000 (DANCINHA)',
    artist: 'BONDE DO BLOCO • TREND OFICIAL',
    bpm: 130,
    style: 'TREND DE DANÇA',
    color: '#facc15',
    src: '/music/tiktok/passinho_viral.mp3'
  },
  {
    id: 'slowed_reverb',
    title: 'AFTER DARK // NIGHT DRIVE (SLOWED + REVERB)',
    artist: 'NEON METROPOLIS • SYNTHWAVE',
    bpm: 108,
    style: 'AESTHETIC SYNTH',
    color: '#38bdf8',
    src: '/music/tiktok/slowed_reverb.mp3'
  },
  {
    id: 'tokyo_drift_phonk',
    title: 'TOKYO MIDNIGHT PHONK (5★ PURSUIT)',
    artist: 'COWBELL KING • DRIFT KING',
    bpm: 150,
    style: 'DRIFT PHONK',
    color: '#ef4444',
    src: '/music/tiktok/tokyo_drift_phonk.mp3'
  },
  {
    id: 'trap_viral_bounce',
    title: 'MILLION DOLLAR BOUNCE (TIKTOK TRAP)',
    artist: 'LIL STUD 808 • VIRAL BOUNCE',
    bpm: 138,
    style: 'VIRAL TRAP',
    color: '#22c55e',
    src: '/music/tiktok/trap_viral_bounce.mp3'
  },
  {
    id: 'sigma_meme_beat',
    title: 'SIGMA RIZZ // PIXEL MEME CORE',
    artist: 'CHAD BLOCK • HYPERPOP',
    bpm: 128,
    style: 'HYPERPOP MEME',
    color: '#f97316',
    src: '/music/tiktok/sigma_meme_beat.mp3'
  }
];

const _defaultCoverCache = new Map();

/**
 * Gera uma Capa de Álbum SVG (DataURL) estilizada no padrão Spotify/LEGO para cada música
 * quando o jogador ainda não escolheu uma foto customizada do PC.
 */
export function getDefaultTrackCoverSvg(track) {
  if (!track) return '';
  const cacheKey = `${track.id}_${track.color || '#1ed760'}_${track.title || ''}`;
  if (_defaultCoverCache.has(cacheKey)) {
    return _defaultCoverCache.get(cacheKey);
  }

  const accent = track.color || '#1ed760';
  const shortTag = String(track.style || 'BEAT')
    .slice(0, 14)
    .toUpperCase()
    .replace(/[<>&"']/g, '');
  const initials = String(track.title || 'TK')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || '♪';
  const bpm = Number(track.bpm) || 130;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.92"/>
        <stop offset="55%" stop-color="#12131a" stop-opacity="0.96"/>
        <stop offset="100%" stop-color="#07080c" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" fill="url(#bg)"/>
    <circle cx="128" cy="32" r="52" fill="${accent}" opacity="0.16"/>
    <circle cx="80" cy="78" r="46" fill="#090a0d" stroke="${accent}" stroke-width="3"/>
    <circle cx="80" cy="78" r="32" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="6 4"/>
    <circle cx="80" cy="78" r="14" fill="${accent}"/>
    <circle cx="80" cy="78" r="5" fill="#090a0d"/>
    <rect x="10" y="10" width="44" height="18" rx="3" fill="#090a0d" opacity="0.82"/>
    <text x="32" y="23" text-anchor="middle" fill="#1ed760" font-family="monospace" font-weight="800" font-size="11">${bpm} BPM</text>
    <text x="134" y="36" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="18" opacity="0.9">${initials}</text>
    <rect x="10" y="128" width="140" height="22" rx="4" fill="#090a0d" opacity="0.86" stroke="${accent}" stroke-width="1.2"/>
    <text x="80" y="143" text-anchor="middle" fill="#f8fafc" font-family="monospace" font-weight="700" font-size="10.5">${shortTag}</text>
  </svg>`;

  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  _defaultCoverCache.set(cacheKey, dataUrl);
  return dataUrl;
}

export function getTrackCoverUrl(track) {
  if (!track) return '';
  if (track.coverDataUrl && typeof track.coverDataUrl === 'string') {
    return track.coverDataUrl;
  }
  return getDefaultTrackCoverSvg(track);
}

/**
 * Armazenamento Persistente de Arquivos .MP3/.WAV em IndexedDB (com fallback em Memória para testes)
 */
const _memAudioBlobs = new Map();
const IDB_NAME = 'LegoSpotifyRadioDB_v1';
const IDB_STORE = 'audioBlobs';

export const RadioAudioStorageDB = {
  _openDB() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = window.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  },

  async saveAudioBlob(trackId, blobOrFile) {
    if (!trackId || !blobOrFile) return false;
    _memAudioBlobs.set(trackId, blobOrFile);
    const db = await this._openDB();
    if (!db) return true;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(blobOrFile, trackId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  },

  getSyncMemoryBlob(trackId) {
    return _memAudioBlobs.get(trackId) || null;
  },

  async getAudioBlob(trackId) {
    if (!trackId) return null;
    if (_memAudioBlobs.has(trackId)) {
      return _memAudioBlobs.get(trackId);
    }
    const db = await this._openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(trackId);
        req.onsuccess = () => {
          if (req.result) {
            _memAudioBlobs.set(trackId, req.result);
          }
          resolve(req.result || null);
        };
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  },

  async deleteAudioBlob(trackId) {
    if (!trackId) return;
    _memAudioBlobs.delete(trackId);
    const db = await this._openDB();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(trackId);
    } catch (_) {
      // Ignora erro de IDB
    }
  },

  async clearAllAudioBlobs() {
    _memAudioBlobs.clear();
    const db = await this._openDB();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
    } catch (_) {
      // Ignora erro de IDB
    }
  }
};

/**
 * Arranjos musicais multi-pista (Baixo 808, Cowbell Phonk, Synth Lead, Acordes e Percussão)
 * para tocar todas as 8 faixas virais imediatamente com alta energia e zero dependência externa!
 */
const SYNTH_ARRANGEMENTS = {
  mtg_automotivo: {
    kickSteps: [0, 3, 6, 8, 11, 14],
    subNotes: [55.0, 55.0, 55.0, 61.74, 55.0, 55.0, 49.0, 51.91],
    tambSteps: [2, 3, 5, 7, 10, 11, 13, 15],
    leadWave: 'sawtooth',
    leadPattern: [
      659.25, 0, 698.46, 659.25, 0, 587.33, 659.25, 0,
      659.25, 0, 783.99, 698.46, 659.25, 0, 587.33, 523.25
    ],
    cowbellPattern: [0, 0, 880, 0, 0, 0, 932.33, 0, 0, 0, 880, 0, 1046.5, 0, 880, 0]
  },
  brazilian_phonk: {
    kickSteps: [0, 3, 6, 10, 12, 14],
    subNotes: [49.0, 49.0, 58.27, 55.0, 49.0, 49.0, 43.65, 46.25],
    tambSteps: [2, 4, 7, 10, 12, 15],
    leadWave: 'square',
    leadPattern: [
      392.0, 0, 466.16, 0, 523.25, 0, 587.33, 523.25,
      466.16, 0, 392.0, 0, 349.23, 392.0, 466.16, 0
    ],
    cowbellPattern: [
      783.99, 0, 783.99, 932.33, 0, 783.99, 1046.5, 0,
      932.33, 0, 783.99, 0, 698.46, 783.99, 932.33, 0
    ]
  },
  montagem_coral: {
    kickSteps: [0, 4, 6, 8, 11, 14],
    subNotes: [51.91, 51.91, 51.91, 46.25, 41.2, 41.2, 46.25, 49.0],
    tambSteps: [2, 3, 6, 7, 10, 11, 14, 15],
    leadWave: 'sawtooth',
    leadPattern: [
      622.25, 0, 0, 698.46, 0, 0, 783.99, 0,
      830.61, 0, 783.99, 0, 698.46, 0, 622.25, 0
    ],
    chords: [
      [311.13, 392.0, 466.16],
      [277.18, 349.23, 415.3],
      [246.94, 311.13, 369.99],
      [293.66, 369.99, 440.0]
    ]
  },
  passinho_viral: {
    kickSteps: [0, 3, 6, 10, 14],
    subNotes: [65.41, 65.41, 58.27, 58.27, 49.0, 49.0, 55.0, 61.74],
    tambSteps: [1, 2, 4, 6, 7, 9, 11, 12, 14, 15],
    leadWave: 'triangle',
    leadPattern: [
      523.25, 659.25, 783.99, 0, 659.25, 783.99, 1046.5, 0,
      880.0, 783.99, 659.25, 523.25, 587.33, 659.25, 523.25, 0
    ],
    cowbellPattern: [0, 1046.5, 0, 0, 0, 987.77, 0, 0, 0, 880.0, 0, 0, 783.99, 0, 880.0, 0]
  },
  slowed_reverb: {
    kickSteps: [0, 6, 8, 14],
    subNotes: [43.65, 43.65, 36.71, 36.71, 41.2, 41.2, 49.0, 49.0],
    tambSteps: [4, 12],
    leadWave: 'triangle',
    leadPattern: [
      349.23, 440.0, 523.25, 659.25, 587.33, 440.0, 523.25, 349.23,
      329.63, 440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 440.0
    ],
    chords: [
      [174.61, 261.63, 349.23, 440.0],
      [146.83, 220.0, 293.66, 369.99],
      [164.81, 246.94, 329.63, 415.3],
      [196.0, 293.66, 392.0, 493.88]
    ]
  },
  tokyo_drift_phonk: {
    kickSteps: [0, 2, 6, 8, 10, 14],
    subNotes: [46.25, 46.25, 46.25, 51.91, 46.25, 46.25, 41.2, 43.65],
    tambSteps: [4, 12],
    leadWave: 'sawtooth',
    leadPattern: [
      466.16, 466.16, 0, 493.88, 0, 554.37, 0, 466.16,
      466.16, 0, 554.37, 493.88, 466.16, 0, 415.3, 466.16
    ],
    cowbellPattern: [
      932.33, 932.33, 0, 987.77, 0, 1108.73, 0, 932.33,
      932.33, 0, 1108.73, 987.77, 932.33, 0, 830.61, 932.33
    ]
  },
  trap_viral_bounce: {
    kickSteps: [0, 3, 7, 10, 13],
    subNotes: [55.0, 55.0, 65.41, 61.74, 49.0, 49.0, 58.27, 55.0],
    tambSteps: [4, 12],
    leadWave: 'sine',
    leadPattern: [
      440.0, 0, 523.25, 587.33, 0, 659.25, 587.33, 523.25,
      440.0, 0, 392.0, 440.0, 523.25, 0, 440.0, 0
    ],
    cowbellPattern: [0, 0, 0, 880, 0, 0, 0, 987.77, 0, 0, 0, 880, 0, 1046.5, 0, 0]
  },
  sigma_meme_beat: {
    kickSteps: [0, 4, 8, 11, 14],
    subNotes: [58.27, 58.27, 65.41, 69.3, 77.78, 77.78, 69.3, 65.41],
    tambSteps: [2, 4, 6, 10, 12, 14],
    leadWave: 'square',
    leadPattern: [
      466.16, 587.33, 698.46, 932.33, 880.0, 698.46, 587.33, 466.16,
      523.25, 659.25, 783.99, 1046.5, 932.33, 783.99, 698.46, 587.33
    ],
    cowbellPattern: [932.33, 0, 1174.66, 0, 932.33, 0, 1396.91, 0, 1046.5, 0, 1318.51, 0, 1174.66, 0, 932.33, 0]
  }
};

export function createDefaultRadioTracksList() {
  return TIKTOK_RADIO_TRACKS.map((t) => ({
    ...t,
    isCustomFile: false,
    liked: false,
    coverDataUrl: null
  }));
}

export class TikTokRadioSystem {
  constructor(hud = null) {
    this.hud = hud;
    this.tracks = createDefaultRadioTracksList();
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isShuffle = false;
    this.isRepeatOne = false;
    this.isBassBoostActive = true;
    this.volume = 0.85;

    // Progresso da faixa sintética (1:30 por ciclo) ou real (<audio>)
    this.synthElapsedSec = 0;
    this.synthDurationSec = 90;

    // Energia de Grave em Tempo Real (0.0 a 1.0) e 16 Barras do Equalizador Neon
    this.bassEnergy = 0;
    this.eqLevels = new Array(16).fill(0.12);

    // Nós WebAudio
    this.radioBus = null;
    this.bassBoostFilter = null;
    this.analyser = null;
    this._freqData = new Uint8Array(32);

    // Sequenciador Procedural / Player de Arquivo Local
    this._stepTimer = null;
    this._stepIndex = 0;
    this._stepAccum = 0;
    this._audioElement = null;
    this._mediaSourceNode = null;
    this._usingAudioElement = false;
  }

  get currentTrack() {
    if (this.tracks.length === 0) return null;
    return this.tracks[this.currentTrackIndex] || this.tracks[0] || null;
  }

  _ensureAudioNodes() {
    const ctx = soundFX._ensureContext();
    if (!ctx) return null;

    if (!this.radioBus) {
      this.radioBus = ctx.createGain();
      this.bassBoostFilter = ctx.createBiquadFilter
        ? ctx.createBiquadFilter()
        : null;
      this.analyser = ctx.createAnalyser ? ctx.createAnalyser() : null;

      if (this.bassBoostFilter) {
        this.bassBoostFilter.type = 'lowshelf';
        if (this.bassBoostFilter.frequency?.setValueAtTime) {
          this.bassBoostFilter.frequency.setValueAtTime(95, ctx.currentTime);
        } else if (this.bassBoostFilter.frequency) {
          this.bassBoostFilter.frequency.value = 95;
        }
        const boostDb = this.isBassBoostActive ? 6.5 : 0.0;
        if (this.bassBoostFilter.gain?.setValueAtTime) {
          this.bassBoostFilter.gain.setValueAtTime(boostDb, ctx.currentTime);
        } else if (this.bassBoostFilter.gain) {
          this.bassBoostFilter.gain.value = boostDb;
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
      this.radioBus.gain.setValueAtTime(
        Math.max(0, Math.min(1.25, this.volume)),
        ctx.currentTime
      );
    }
    if (this._audioElement) {
      this._audioElement.volume = Math.max(0, Math.min(1, this.volume));
    }
  }

  setVolume(vol0to1, persist = true) {
    this.volume = Math.max(0, Math.min(1, Number(vol0to1) || 0));
    this._applyVolume();
    this.hud?.refreshTikTokRadioUI?.();
    if (persist) {
      this.hud?.saveCurrentProgress?.();
    }
  }

  toggleBassBoost(forceBool = undefined, persist = true) {
    this.isBassBoostActive =
      forceBool !== undefined ? Boolean(forceBool) : !this.isBassBoostActive;
    const ctx = this._ensureAudioNodes();
    if (this.bassBoostFilter && ctx) {
      const boostDb = this.isBassBoostActive ? 6.5 : 0.0;
      if (this.bassBoostFilter.gain?.setValueAtTime) {
        this.bassBoostFilter.gain.setValueAtTime(boostDb, ctx.currentTime);
      } else if (this.bassBoostFilter.gain) {
        this.bassBoostFilter.gain.value = boostDb;
      }
    }
    this.hud?.refreshTikTokRadioUI?.();
    if (persist) {
      this.hud?.saveCurrentProgress?.();
    }
    return this.isBassBoostActive;
  }

  toggleShuffle(forceBool = undefined, persist = true) {
    this.isShuffle = forceBool !== undefined ? Boolean(forceBool) : !this.isShuffle;
    this.hud?.refreshTikTokRadioUI?.();
    if (persist) {
      this.hud?.saveCurrentProgress?.();
    }
    return this.isShuffle;
  }

  toggleRepeatOne(forceBool = undefined, persist = true) {
    this.isRepeatOne = forceBool !== undefined ? Boolean(forceBool) : !this.isRepeatOne;
    if (this._audioElement) {
      this._audioElement.loop = this.isRepeatOne;
    }
    this.hud?.refreshTikTokRadioUI?.();
    if (persist) {
      this.hud?.saveCurrentProgress?.();
    }
    return this.isRepeatOne;
  }

  /**
   * Para completamente toda reprodução da rádio (usado ao Salvar e Sair para o Menu Inicial ou trocar Save)
   */
  stopAllPlayback() {
    this.isPlaying = false;
    this._pausedTrackId = null;
    this.bassEnergy = 0;
    this._stepIndex = 0;
    this._stepAccum = 0;
    this.synthElapsedSec = 0;
    soundFX.tiktokRadioActive = false;
    soundFX.baileBeatPulse = 0;

    this._stopAudioElement();
    if (this._audioElement) {
      try {
        this._audioElement.currentTime = 0;
      } catch (_) {
        // Ignora erro em mock
      }
    }
    for (let i = 0; i < 16; i++) {
      this.eqLevels[i] = 0.08;
    }
    this.hud?.refreshTikTokRadioUI?.();
  }

  playTrack(indexOrId, showToast = true) {
    if (this.tracks.length === 0) {
      this.stopAllPlayback();
      return null;
    }

    let idx = this.currentTrackIndex;
    if (typeof indexOrId === 'number') {
      idx = ((indexOrId % this.tracks.length) + this.tracks.length) % this.tracks.length;
    } else if (typeof indexOrId === 'string') {
      const found = this.tracks.findIndex((t) => t.id === indexOrId);
      if (found >= 0) idx = found;
    }

    if (idx < 0 || idx >= this.tracks.length) idx = 0;

    this.currentTrackIndex = idx;
    this.isPlaying = true;
    this._pausedTrackId = null;
    this._stepIndex = 0;
    this._stepAccum = 0;
    this.synthElapsedSec = 0;
    soundFX.tiktokRadioActive = true;

    this._ensureAudioNodes();
    this._startCurrentTrackEngine();

    this.hud?.refreshTikTokRadioUI?.();
    if (showToast && this.currentTrack) {
      this.hud?.showTikTokRadioToast?.(this.currentTrack);
    }
    return this.currentTrack;
  }

  pause() {
    this.isPlaying = false;
    this._pausedTrackId = this.currentTrack?.id || null;
    soundFX.tiktokRadioActive = false;
    this.bassEnergy = 0;
    if (this._audioElement) {
      try {
        this._audioElement.pause();
      } catch (_) {
        // Ignora erro em mock
      }
    }
    this.hud?.refreshTikTokRadioUI?.();
  }

  togglePlayPause() {
    if (this.tracks.length === 0) return false;
    if (this.isPlaying) {
      this.pause();
    } else if (this.currentTrack && this._pausedTrackId === this.currentTrack.id) {
      // Retoma exatamente do ponto onde pausou (tanto MP3 quanto Synth)
      this.isPlaying = true;
      this._pausedTrackId = null;
      soundFX.tiktokRadioActive = true;
      this._ensureAudioNodes();
      if (
        this.currentTrack.isCustomFile &&
        this._audioElement &&
        this._loadedAudioSrc === this.currentTrack.src
      ) {
        try {
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
      this.hud?.refreshTikTokRadioUI?.();
    } else {
      this.playTrack(this.currentTrackIndex, true);
    }
    return this.isPlaying;
  }

  nextTrack(showToast = true) {
    if (this.tracks.length === 0) return null;
    let nextIdx;
    if (this.isShuffle && this.tracks.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * this.tracks.length);
      } while (nextIdx === this.currentTrackIndex);
    } else {
      nextIdx = (this.currentTrackIndex + 1) % this.tracks.length;
    }
    return this.playTrack(nextIdx, showToast);
  }

  prevTrack(showToast = true) {
    if (this.tracks.length === 0) return null;
    const prevIdx = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    return this.playTrack(prevIdx, showToast);
  }

  /**
   * Alterna o "Curtir" (❤️) de uma música da playlist e salva no Slot
   */
  toggleLikeTrack(trackId = null) {
    const targetId = trackId || this.currentTrack?.id;
    const track = this.tracks.find((t) => t.id === targetId);
    if (!track) return false;
    track.liked = !track.liked;
    this.hud?.refreshTikTokRadioUI?.();
    this.hud?.saveCurrentProgress?.();
    return track.liked;
  }

  /**
   * Define diretamente a foto de capa (DataURL) de uma música e salva no Slot
   */
  setTrackCoverDataUrl(trackId, coverDataUrl) {
    const targetId = trackId || this.currentTrack?.id;
    const track = this.tracks.find((t) => t.id === targetId);
    if (!track || !coverDataUrl) return false;
    track.coverDataUrl = String(coverDataUrl);
    this.hud?.refreshTikTokRadioUI?.();
    this.hud?.saveCurrentProgress?.();
    return true;
  }

  /**
   * Lê um arquivo de imagem (.png/.jpg/.webp) do PC, redimensiona para 160x160 (object-fit: cover)
   * e aplica como foto de capa da música escolhida!
   */
  async setTrackCoverFromFile(trackId, imageFile) {
    const targetId = trackId || this.currentTrack?.id;
    const track = this.tracks.find((t) => t.id === targetId);
    if (!track || !imageFile) return null;

    // Suporte direto caso passem string DataURL ou objeto mock com dataUrl nos testes
    if (typeof imageFile === 'string' && imageFile.startsWith('data:image/')) {
      this.setTrackCoverDataUrl(targetId, imageFile);
      return imageFile;
    }
    if (typeof imageFile.dataUrl === 'string' && imageFile.dataUrl.startsWith('data:image/')) {
      this.setTrackCoverDataUrl(targetId, imageFile.dataUrl);
      return imageFile.dataUrl;
    }

    const rawDataUrl = await new Promise((resolve) => {
      if (typeof FileReader === 'function' && (imageFile instanceof Blob || imageFile._isMockBlob)) {
        try {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(imageFile);
          return;
        } catch (_) {
          // Fallback abaixo
        }
      }
      // Fallback para ambiente de teste sem FileReader real
      const label = String(imageFile.name || 'FOTO').slice(0, 12).toUpperCase();
      const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#1ed760"/><text x="80" y="85" text-anchor="middle" fill="#090a0d" font-size="16" font-weight="bold">${label}</text></svg>`;
      resolve(`data:image/svg+xml;utf8,${encodeURIComponent(mockSvg)}`);
    });

    if (!rawDataUrl) return null;

    // No navegador com Image & Canvas, redimensiona para 160x160 JPEG leve p/ caber com folga no Save Slot!
    const resizedDataUrl = await new Promise((resolve) => {
      if (
        rawDataUrl.startsWith('data:image/svg+xml') ||
        typeof Image === 'undefined' ||
        typeof document === 'undefined'
      ) {
        resolve(rawDataUrl);
        return;
      }
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            if (!ctx || !img.width || !img.height) {
              resolve(rawDataUrl);
              return;
            }
            const scale = Math.max(160 / img.width, 160 / img.height);
            const sw = 160 / scale;
            const sh = 160 / scale;
            const sx = (img.width - sw) * 0.5;
            const sy = (img.height - sh) * 0.5;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 160, 160);
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.82);
            resolve(jpegUrl && jpegUrl.startsWith('data:image/') ? jpegUrl : rawDataUrl);
          } catch (_) {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      } catch (_) {
        resolve(rawDataUrl);
      }
    });

    this.setTrackCoverDataUrl(targetId, resizedDataUrl);
    return resizedDataUrl;
  }

  /**
   * Remove 1 música específica (por ID ou índice) da playlist e salva no Slot
   */
  removeTrack(trackIdOrIndex) {
    if (this.tracks.length === 0) return false;
    let idx = -1;
    if (typeof trackIdOrIndex === 'number') {
      idx = trackIdOrIndex;
    } else if (typeof trackIdOrIndex === 'string') {
      idx = this.tracks.findIndex((t) => t.id === trackIdOrIndex);
    }
    if (idx < 0 || idx >= this.tracks.length) return false;

    const wasPlaying = this.isPlaying;
    const wasCurrent = idx === this.currentTrackIndex;
    const [removed] = this.tracks.splice(idx, 1);

    if (removed?.isCustomFile && removed.id) {
      RadioAudioStorageDB.deleteAudioBlob(removed.id);
    }

    if (this.tracks.length === 0) {
      this.currentTrackIndex = 0;
      this.stopAllPlayback();
    } else if (wasCurrent) {
      this.currentTrackIndex = idx % this.tracks.length;
      if (wasPlaying) {
        this.playTrack(this.currentTrackIndex, false);
      }
    } else if (idx < this.currentTrackIndex) {
      this.currentTrackIndex = Math.max(0, this.currentTrackIndex - 1);
    }

    this.hud?.refreshTikTokRadioUI?.();
    this.hud?.saveCurrentProgress?.();
    return true;
  }

  /**
   * Remove TODAS as músicas da playlist, parando a reprodução e salvando a lista vazia no Slot
   */
  clearAllTracks() {
    this.stopAllPlayback();
    RadioAudioStorageDB.clearAllAudioBlobs();
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.hud?.refreshTikTokRadioUI?.();
    this.hud?.saveCurrentProgress?.();
    return true;
  }

  /**
   * Restaura as 8 faixas virais originais sem apagar os MP3 customizados nem as fotos que o jogador já colocou!
   */
  restoreDefaultTracks() {
    const existingById = new Map(this.tracks.map((t) => [t.id, t]));
    const restoredList = [];

    for (const def of TIKTOK_RADIO_TRACKS) {
      if (existingById.has(def.id)) {
        restoredList.push(existingById.get(def.id));
        existingById.delete(def.id);
      } else {
        restoredList.push({
          ...def,
          isCustomFile: false,
          liked: false,
          coverDataUrl: null
        });
      }
    }

    // Mantém os MP3 customizados adicionados pelo jogador após as 8 originais
    for (const customTrack of existingById.values()) {
      restoredList.push(customTrack);
    }

    this.tracks = restoredList;
    if (this.currentTrackIndex >= this.tracks.length) {
      this.currentTrackIndex = 0;
    }
    this.hud?.refreshTikTokRadioUI?.();
    this.hud?.saveCurrentProgress?.();
    return this.tracks;
  }

  /**
   * Importa arquivos .mp3/.wav/.ogg reais do PC do jogador, salva no IndexedDB + Save Slot
   * e adiciona direto na playlist da Rádio Spotify [P]!
   */
  importLocalAudioFiles(fileList) {
    if (!fileList || fileList.length === 0) return [];
    const added = [];
    const createObjUrl = (f) => {
      if (
        typeof Blob !== 'undefined' &&
        f instanceof Blob &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
      ) {
        return URL.createObjectURL(f);
      }
      return f?.mockUrl || `/music/tiktok/${f?.name || 'custom.mp3'}`;
    };

    const palette = ['#1ed760', '#00f2fe', '#fe0979', '#facc15', '#a855f7'];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      const rawName = String(file.name || `MP3 IMPORTADO ${i + 1}`)
        .replace(/\.[a-z0-9]{2,4}$/i, '')
        .toUpperCase();
      const trackId = `custom_mp3_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`;
      const customTrack = {
        id: trackId,
        title: rawName,
        artist: 'MEU MP3 LOCAL • PC',
        bpm: 135,
        style: 'MP3 LOCAL',
        color: palette[(this.tracks.length + i) % palette.length],
        src: createObjUrl(file),
        isCustomFile: true,
        liked: false,
        coverDataUrl: file.coverDataUrl || null
      };
      RadioAudioStorageDB.saveAudioBlob(trackId, file);
      this.tracks.push(customTrack);
      added.push(customTrack);
    }

    if (added.length > 0) {
      const firstNewIdx = this.tracks.indexOf(added[0]);
      this.playTrack(firstNewIdx, true);
      this.hud?.saveCurrentProgress?.();
    }
    return added;
  }

  /**
   * Retorna informações de tempo (atual e duração total) para a barra de progresso do player Spotify
   */
  getPlaybackTimeInfo() {
    if (this.tracks.length === 0) {
      return { currentSec: 0, durationSec: 0, ratio: 0 };
    }
    if (
      this._usingAudioElement &&
      this._audioElement &&
      Number.isFinite(this._audioElement.duration) &&
      this._audioElement.duration > 0
    ) {
      const cur = Math.max(0, Number(this._audioElement.currentTime) || 0);
      const dur = Math.max(1, Number(this._audioElement.duration) || 90);
      return {
        currentSec: cur,
        durationSec: dur,
        ratio: Math.max(0, Math.min(1, cur / dur))
      };
    }
    const dur = this.synthDurationSec || 90;
    const cur = Math.max(0, Math.min(dur, this.synthElapsedSec || 0));
    return {
      currentSec: cur,
      durationSec: dur,
      ratio: Math.max(0, Math.min(1, cur / dur))
    };
  }

  /**
   * Avança/retrocede a posição da música pela barra de progresso (0.0 a 1.0)
   */
  seekToRatio(ratio0to1) {
    if (this.tracks.length === 0) return;
    const clamped = Math.max(0, Math.min(1, Number(ratio0to1) || 0));
    if (
      this._usingAudioElement &&
      this._audioElement &&
      Number.isFinite(this._audioElement.duration) &&
      this._audioElement.duration > 0
    ) {
      try {
        this._audioElement.currentTime = clamped * this._audioElement.duration;
      } catch (_) {
        // Ignora erro
      }
      return;
    }
    this.synthElapsedSec = clamped * (this.synthDurationSec || 90);
    this._stepIndex = Math.floor(clamped * 64) % 64;
  }

  /**
   * Exporta o estado completo da Rádio (playlist, curtidas, fotos de capa, volume, filtros) para salvar no Slot!
   */
  exportSaveState() {
    return {
      volume: this.volume,
      isShuffle: Boolean(this.isShuffle),
      isRepeatOne: Boolean(this.isRepeatOne),
      isBassBoostActive: Boolean(this.isBassBoostActive),
      currentTrackId: this.currentTrack?.id || null,
      tracks: this.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        bpm: Number(t.bpm) || 132,
        style: t.style || 'VIRAL BEAT',
        color: t.color || '#1ed760',
        src: t.isCustomFile ? '' : t.src,
        isCustomFile: Boolean(t.isCustomFile),
        liked: Boolean(t.liked),
        coverDataUrl: t.coverDataUrl || null
      }))
    };
  }

  /**
   * Restaura o estado completo da Rádio a partir do Slot de Save carregado
   */
  importSaveState(savedRadioState) {
    this.stopAllPlayback();

    if (!savedRadioState || typeof savedRadioState !== 'object' || !Array.isArray(savedRadioState.tracks)) {
      this.tracks = createDefaultRadioTracksList();
      this.currentTrackIndex = 0;
      this.hud?.refreshTikTokRadioUI?.();
      return;
    }

    if (typeof savedRadioState.volume === 'number') {
      this.volume = Math.max(0, Math.min(1, savedRadioState.volume));
      this._applyVolume();
    }
    this.isShuffle = Boolean(savedRadioState.isShuffle);
    this.isRepeatOne = Boolean(savedRadioState.isRepeatOne);
    if (typeof savedRadioState.isBassBoostActive === 'boolean') {
      this.toggleBassBoost(savedRadioState.isBassBoostActive, false);
    }

    const createObjUrl = (f) => {
      if (
        typeof Blob !== 'undefined' &&
        f instanceof Blob &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
      ) {
        return URL.createObjectURL(f);
      }
      return f?.mockUrl || `/music/tiktok/${f?.name || 'custom.mp3'}`;
    };

    this.tracks = savedRadioState.tracks.map((savedTrack) => {
      const defMatch = TIKTOK_RADIO_TRACKS.find((d) => d.id === savedTrack.id);
      const isCustom = Boolean(savedTrack.isCustomFile);
      let restoredSrc = isCustom ? savedTrack.src || '' : savedTrack.src || defMatch?.src || '';

      if (isCustom) {
        const memBlob = RadioAudioStorageDB.getSyncMemoryBlob(savedTrack.id);
        if (memBlob) {
          restoredSrc = createObjUrl(memBlob);
        } else {
          RadioAudioStorageDB.getAudioBlob(savedTrack.id).then((blob) => {
            if (blob) {
              const target = this.tracks.find((tr) => tr.id === savedTrack.id);
              if (target) {
                target.src = createObjUrl(blob);
              }
            }
          });
        }
      }

      return {
        id: savedTrack.id,
        title: savedTrack.title || defMatch?.title || 'FAIXA CUSTOM',
        artist: savedTrack.artist || defMatch?.artist || 'ARTISTA LEGO',
        bpm: Number(savedTrack.bpm) || defMatch?.bpm || 132,
        style: savedTrack.style || defMatch?.style || 'VIRAL BEAT',
        color: savedTrack.color || defMatch?.color || '#1ed760',
        src: restoredSrc,
        isCustomFile: isCustom,
        liked: Boolean(savedTrack.liked),
        coverDataUrl: savedTrack.coverDataUrl || null
      };
    });

    if (this.tracks.length === 0) {
      this.currentTrackIndex = 0;
    } else if (savedRadioState.currentTrackId) {
      const foundIdx = this.tracks.findIndex((t) => t.id === savedRadioState.currentTrackId);
      this.currentTrackIndex = foundIdx >= 0 ? foundIdx : 0;
    } else {
      this.currentTrackIndex = 0;
    }

    this.hud?.refreshTikTokRadioUI?.();
  }

  _stopAudioElement() {
    this._usingAudioElement = false;
    if (this._audioElement) {
      try {
        this._audioElement.pause();
      } catch (_) {
        // Ignora erro em ambiente mock
      }
    }
  }

  _startCurrentTrackEngine() {
    this._stopAudioElement();
    const track = this.currentTrack;
    if (!track) return;

    // Se for arquivo local importado pelo jogador (blob:) e Audio estiver disponível no navegador, toca o arquivo real!
    if (
      track.isCustomFile &&
      track.src &&
      typeof window !== 'undefined' &&
      typeof window.Audio === 'function'
    ) {
      try {
        if (!this._audioElement) {
          this._audioElement = new window.Audio();
          this._audioElement.crossOrigin = 'anonymous';
          this._audioElement.addEventListener('ended', () => {
            if (this.isPlaying && this._usingAudioElement) {
              if (this.isRepeatOne) {
                this.playTrack(this.currentTrackIndex, false);
              } else {
                this.nextTrack(true);
              }
            }
          });
        }
        this._audioElement.loop = Boolean(this.isRepeatOne);
        this._audioElement.src = track.src;
        this._loadedAudioSrc = track.src;
        this._audioElement.volume = Math.max(0, Math.min(1, this.volume));
        const ctx = this._ensureAudioNodes();
        if (ctx && typeof ctx.createMediaElementSource === 'function' && !this._mediaSourceNode) {
          this._mediaSourceNode = ctx.createMediaElementSource(this._audioElement);
          this._mediaSourceNode.connect(this.radioBus);
        }
        const playPromise = this._audioElement.play();
        this._usingAudioElement = true;
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            this._usingAudioElement = false;
          });
        }
        return;
      } catch (_) {
        this._usingAudioElement = false;
      }
    }
  }

  /**
   * Dispara um passo (semicolcheia 1/16) do Sintetizador Viral Multi-Pista (808 + Cowbell Phonk + Tamborzão + Lead)
   */
  _triggerSynthStep(step) {
    const ctx = this._ensureAudioNodes();
    if (!ctx || !this.radioBus) return;

    const track = this.currentTrack;
    const arr = SYNTH_ARRANGEMENTS[track?.id] || SYNTH_ARRANGEMENTS.mtg_automotivo;
    const s16 = step % 16;
    const barIdx = Math.floor(step / 4) % 8;
    const now = ctx.currentTime;
    const bassBoostGain = this.isBassBoostActive ? 1.38 : 1.0;

    // 1. BUMBO 808 / SUB-BASS PESADO DE PAREDÃO & PHONK
    if (arr.kickSteps.includes(s16)) {
      this.bassEnergy = Math.min(1.0, 0.92 * bassBoostGain);
      const subOsc = ctx.createOscillator();
      const punchOsc = ctx.createOscillator();
      const subGain = ctx.createGain();

      const rootFreq = arr.subNotes[barIdx % arr.subNotes.length] || 55.0;
      subOsc.type = 'sine';
      punchOsc.type = 'triangle';

      subOsc.frequency.setValueAtTime(155, now);
      subOsc.frequency.exponentialRampToValueAtTime(rootFreq, now + 0.055);
      punchOsc.frequency.setValueAtTime(220, now);
      punchOsc.frequency.exponentialRampToValueAtTime(rootFreq * 1.45, now + 0.045);

      const kickVol = Math.min(0.45, 0.32 * bassBoostGain);
      subGain.gain.setValueAtTime(kickVol, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      subOsc.connect(subGain);
      punchOsc.connect(subGain);
      subGain.connect(this.radioBus);

      subOsc.start(now);
      punchOsc.start(now);
      subOsc.stop(now + 0.23);
      punchOsc.stop(now + 0.09);
    }

    // 2. COWBELL METÁLICO DE PHONK (808 Cowbell clássico de Drift / Gigachad)
    if (arr.cowbellPattern && arr.cowbellPattern[s16] > 0) {
      const cbFreq = arr.cowbellPattern[s16];
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const cbGain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(cbFreq, now);
      osc2.frequency.setValueAtTime(cbFreq * 1.48, now);

      cbGain.gain.setValueAtTime(0.095, now);
      cbGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc1.connect(cbGain);
      osc2.connect(cbGain);
      cbGain.connect(this.radioBus);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.09);
      osc2.stop(now + 0.09);
    }

    // 3. TAMBORZÃO / CLAP / HI-HAT TRAP
    if (arr.tambSteps && arr.tambSteps.includes(s16)) {
      const percOsc = ctx.createOscillator();
      const percGain = ctx.createGain();
      percOsc.type = s16 % 2 === 0 ? 'square' : 'triangle';
      const pFreq = s16 === 4 || s16 === 12 ? 920 : 720;
      percOsc.frequency.setValueAtTime(pFreq, now);
      percOsc.frequency.exponentialRampToValueAtTime(280, now + 0.048);

      percGain.gain.setValueAtTime(0.09, now);
      percGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      percOsc.connect(percGain);
      percGain.connect(this.radioBus);
      percOsc.start(now);
      percOsc.stop(now + 0.06);
    } else if (s16 % 2 === 1) {
      // Hi-hat fechado rápido de Trap / Phonk
      const hatOsc = ctx.createOscillator();
      const hatGain = ctx.createGain();
      hatOsc.type = 'sine';
      hatOsc.frequency.setValueAtTime(3400 + (s16 % 4) * 420, now);
      hatGain.gain.setValueAtTime(0.024, now);
      hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      hatOsc.connect(hatGain);
      hatGain.connect(this.radioBus);
      hatOsc.start(now);
      hatOsc.stop(now + 0.03);
    }

    // 4. HOOK / MELODIA SYNTH VIRAL
    if (arr.leadPattern && arr.leadPattern[s16] > 0) {
      const leadFreq = arr.leadPattern[s16];
      const leadOsc = ctx.createOscillator();
      const leadGain = ctx.createGain();
      leadOsc.type = arr.leadWave || 'sawtooth';
      leadOsc.frequency.setValueAtTime(leadFreq, now);
      leadGain.gain.setValueAtTime(0.085, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      leadOsc.connect(leadGain);
      leadGain.connect(this.radioBus);
      leadOsc.start(now);
      leadGain.stop(now + 0.15);
    }

    // 5. ACORDES DE MONTAGEM / SYNTHWAVE (nos tempos 0 e 8)
    if (arr.chords && s16 % 8 === 0) {
      const chordIdx = Math.floor(step / 8) % arr.chords.length;
      const chord = arr.chords[chordIdx];
      for (const f of chord) {
        const chOsc = ctx.createOscillator();
        const chGain = ctx.createGain();
        chOsc.type = 'triangle';
        chOsc.frequency.setValueAtTime(f, now);
        chGain.gain.setValueAtTime(0.038, now);
        chGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        chOsc.connect(chGain);
        chGain.connect(this.radioBus);
        chOsc.start(now);
        chOsc.stop(now + 0.5);
      }
    }
  }

  /**
   * Atualiza o sequenciador da Rádio, extrai a energia do grave (bassEnergy)
   * e alimenta o pulso de luzes/dança (soundFX.baileBeatPulse) e as 16 barras do equalizador!
   */
  update(dt = 0.016) {
    if (!this.isPlaying || this.tracks.length === 0) {
      this.bassEnergy = Math.max(0, this.bassEnergy - dt * 5.0);
      for (let i = 0; i < 16; i++) {
        this.eqLevels[i] = Math.max(0.08, this.eqLevels[i] - dt * 3.2);
      }
      return;
    }

    soundFX.tiktokRadioActive = true;
    const track = this.currentTrack;
    const bpm = track?.bpm || 132;
    const stepDuration = 60 / bpm / 4; // 1/16 note

    if (!this._usingAudioElement) {
      this.synthElapsedSec += dt;
      if (this.synthElapsedSec >= this.synthDurationSec) {
        this.synthElapsedSec = 0;
        if (!this.isRepeatOne && this.tracks.length > 1) {
          this.nextTrack(false);
          return;
        }
      }

      this._stepAccum += dt;
      while (this._stepAccum >= stepDuration) {
        this._stepAccum -= stepDuration;
        this._triggerSynthStep(this._stepIndex);
        this._stepIndex = (this._stepIndex + 1) % 64;
      }
    }

    // Atualiza energia do grave e as 16 barras do Equalizador Neon
    this.bassEnergy = Math.max(0, this.bassEnergy - dt * 4.8);
    if (this.analyser && this._usingAudioElement && typeof this.analyser.getByteFrequencyData === 'function') {
      this.analyser.getByteFrequencyData(this._freqData);
      let lowSum = 0;
      for (let b = 0; b < 4; b++) lowSum += this._freqData[b] || 0;
      this.bassEnergy = Math.max(this.bassEnergy, Math.min(1.0, lowSum / (4 * 230)));
    }

    const phase = performance.now ? performance.now() * 0.012 : this._stepIndex * 0.6;
    for (let i = 0; i < 16; i++) {
      const bassInfluence = i < 5 ? this.bassEnergy * 0.95 : this.bassEnergy * 0.55;
      const wave = 0.25 + 0.32 * Math.abs(Math.sin(phase + i * 0.55));
      const targetBar = Math.min(1.0, Math.max(0.12, bassInfluence + wave * 0.55));
      this.eqLevels[i] += (targetBar - this.eqLevels[i]) * Math.min(1, dt * 16.0);
    }

    // Sincroniza o grave da Rádio com o paredão/luzes/emotes do jogo!
    soundFX.baileBeatPulse = Math.max(soundFX.baileBeatPulse || 0, this.bassEnergy);
  }
}
