/**
 * Catálogo base, ícones vetoriais estilo GTA 6, capas SVG, leitura do IndexedDB legado
 * e sincronização em tempo real entre `/configs` e o jogo (`BroadcastChannel` + `/api/radio/state`).
 */

export const RADIO_STORAGE_KEY = 'lego_gta6_radio_config_v1';
export const LEGACY_SAVE_SLOTS_KEY = 'lego_cdd_saves_v1';
export const RADIO_SYNC_CHANNEL = 'lego_gta6_radio_sync_v1';

export const STATION_ICONS_SVG = {
  antenna: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/><line x1="12" y1="14" x2="12" y2="22"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="2 18 5 7 9.5 12 12 5 14.5 12 19 7 22 18 2 18"/><line x1="3" y1="21" x2="21" y2="21"/></svg>`,
  skull: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a8 8 0 0 0-8 8c0 2.8 1.5 5.2 3.7 6.6V21h8.6v-3.4C18.5 16.2 20 13.8 20 11a8 8 0 0 0-8-8z"/><circle cx="9" cy="11.5" r="1.4"/><circle cx="15" cy="11.5" r="1.4"/><line x1="10" y1="18" x2="10" y2="21"/><line x1="14" y1="18" x2="14" y2="21"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c.6 3.8-2.4 5.8-2.4 9 0 1.9 1.5 3.4 3.4 3.4 2.3 0 3.5-1.9 3.2-4.2 2.4 1.9 3.8 4.8 3 7.9C18.4 21 15.6 22 12 22c-4.6 0-8-3-8-7.5C4 9.6 8 5.8 12 2z"/></svg>`,
  palm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8c0-2.8-2.2-5-5-5-1.5 0-2.8.6-3.8 1.6C6.4 5 8.5 6.4 10 8.5"/><path d="M13 8c1.5-2.6 4.5-4 7.5-3.2-1.8 1.2-3.2 2.8-4 4.7"/><path d="M13 8c3 0 5.8 1.6 7 4.2-2.6-.5-5-.2-7 .8"/><path d="M13 8c-3 .2-5.8 1.8-7 4.4 2.4-.6 4.8-.4 7 .6"/><path d="M13 8c-.4 4.8-1.4 9.5-3 14"/><line x1="6" y1="22" x2="16" y2="22"/></svg>`,
  vinyl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="3"/><path d="M7.5 7.5a6.4 6.4 0 0 1 4.5-1.9"/></svg>`,
  headset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
  off: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`
};

export function getStationIconSvg(iconKey = 'antenna') {
  return STATION_ICONS_SVG[iconKey] || STATION_ICONS_SVG.antenna;
}

export const TIKTOK_RADIO_TRACKS = [
  {
    id: 'mtg_automotivo',
    title: 'MTG AUTOMOTIVO BIBI / MANDELÃO',
    artist: 'DJ MANDELÃO 021',
    bpm: 132,
    durationSec: 96,
    style: 'FUNK AUTOMOTIVO',
    color: '#00f2fe',
    src: '/music/tiktok/mtg_automotivo.mp3'
  },
  {
    id: 'brazilian_phonk',
    title: 'BRAZILIAN DANÇA PHONK',
    artist: 'PHONK RIO 808',
    bpm: 140,
    durationSec: 92,
    style: 'BRAZILIAN PHONK',
    color: '#fe0979',
    src: '/music/tiktok/brazilian_phonk.mp3'
  },
  {
    id: 'montagem_coral',
    title: 'MONTAGEM CORAL // SUBMUNDO',
    artist: 'DJ SUBMUNDO',
    bpm: 136,
    durationSec: 88,
    style: 'MONTAGEM',
    color: '#a855f7',
    src: '/music/tiktok/montagem_coral.mp3'
  },
  {
    id: 'passinho_viral',
    title: 'PASSINHO DO TAMBORZÃO 2000',
    artist: 'BONDE DO BLOCO',
    bpm: 130,
    durationSec: 94,
    style: 'TAMBORZÃO',
    color: '#facc15',
    src: '/music/tiktok/passinho_viral.mp3'
  },
  {
    id: 'slowed_reverb',
    title: 'AFTER DARK // NIGHT DRIVE',
    artist: 'NEON METROPOLIS',
    bpm: 108,
    durationSec: 104,
    style: 'NIGHT SYNTH',
    color: '#38bdf8',
    src: '/music/tiktok/slowed_reverb.mp3'
  },
  {
    id: 'tokyo_drift_phonk',
    title: 'MIDNIGHT PURSUIT PHONK',
    artist: 'COWBELL KING',
    bpm: 150,
    durationSec: 90,
    style: 'DRIFT PHONK',
    color: '#ef4444',
    src: '/music/tiktok/tokyo_drift_phonk.mp3'
  },
  {
    id: 'trap_viral_bounce',
    title: 'MILLION DOLLAR BOUNCE',
    artist: 'STUD 808',
    bpm: 138,
    durationSec: 95,
    style: 'TRAP',
    color: '#22c55e',
    src: '/music/tiktok/trap_viral_bounce.mp3'
  },
  {
    id: 'sigma_meme_beat',
    title: 'CYBER RIZZ // HYPERBEAT',
    artist: 'CHAD BLOCK',
    bpm: 128,
    durationSec: 86,
    style: 'HYPERBEAT',
    color: '#f97316',
    src: '/music/tiktok/sigma_meme_beat.mp3'
  }
];

const _defaultCoverCache = new Map();

export function getDefaultTrackCoverSvg(track) {
  if (!track) return '';
  const cacheKey = `${track.id}_${track.color || '#facc15'}_${track.title || ''}`;
  if (_defaultCoverCache.has(cacheKey)) {
    return _defaultCoverCache.get(cacheKey);
  }
  const accent = track.color || '#facc15';
  const initials =
    String(track.title || 'FM')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'FM';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.88"/>
        <stop offset="60%" stop-color="#0d1017" stop-opacity="0.98"/>
        <stop offset="100%" stop-color="#06070a" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" fill="url(#g)"/>
    <circle cx="80" cy="80" r="48" fill="#090a0d" stroke="${accent}" stroke-width="3"/>
    <circle cx="80" cy="80" r="16" fill="${accent}"/>
    <circle cx="80" cy="80" r="5.5" fill="#090a0d"/>
    <text x="132" y="34" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-weight="900" font-size="18">${initials}</text>
  </svg>`;
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  _defaultCoverCache.set(cacheKey, dataUrl);
  return dataUrl;
}

export function getTrackCoverUrl(track) {
  if (!track) return '';
  if (track.coverUrl && typeof track.coverUrl === 'string') return track.coverUrl;
  if (track.coverDataUrl && typeof track.coverDataUrl === 'string') return track.coverDataUrl;
  return getDefaultTrackCoverSvg(track);
}

export function createDefaultRadioTracksList() {
  return TIKTOK_RADIO_TRACKS.map((t) => ({
    ...t,
    isCustomFile: false,
    coverDataUrl: null,
    coverUrl: ''
  }));
}

export function createDefaultSingleStationState(tracksList = null) {
  const tracks = Array.isArray(tracksList) ? tracksList : createDefaultRadioTracksList();
  return {
    initialized: true,
    stations: [
      {
        id: 'station_padrao',
        name: 'RÁDIO PADRÃO',
        freq: '101.5 FM',
        genre: 'MINHAS MÚSICAS',
        color: '#facc15',
        icon: 'antenna',
        trackIds: tracks.map((t) => t.id)
      }
    ],
    tracks
  };
}

/**
 * Armazenamento IndexedDB compatível com o banco legado `LegoSpotifyRadioDB_v1`
 * para resgatar 100% dos MP3 que o usuário já salvou no navegador!
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
    if (_memAudioBlobs.has(trackId)) return _memAudioBlobs.get(trackId);
    const db = await this._openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(trackId);
        req.onsuccess = () => {
          if (req.result) _memAudioBlobs.set(trackId, req.result);
          resolve(req.result || null);
        };
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  },

  async getAllLegacyBlobEntries() {
    const db = await this._openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => {
          const keys = Array.isArray(keysReq.result) ? keysReq.result : [];
          if (keys.length === 0) {
            resolve([]);
            return;
          }
          const entries = [];
          let pending = keys.length;
          for (const k of keys) {
            const g = store.get(k);
            g.onsuccess = () => {
              if (g.result) entries.push({ id: String(k), blob: g.result });
              if (--pending === 0) resolve(entries);
            };
            g.onerror = () => {
              if (--pending === 0) resolve(entries);
            };
          }
        };
        keysReq.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
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
      // Ignora
    }
  }
};

/**
 * Coleta automaticamente as músicas que o usuário já tinha salvo nos Slots de Save (`lego_cdd_saves_v1`)
 * e no IndexedDB (`LegoSpotifyRadioDB_v1`) para iniciar numa única Rádio Padrão!
 */
export async function collectMigratedLegacyTracksFromBrowser() {
  const byId = new Map();
  let foundAnySavedSlot = false;
  let slotTracksOrdered = [];

  try {
    const rawSlots = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_SAVE_SLOTS_KEY) : null;
    if (rawSlots) {
      const slots = JSON.parse(rawSlots);
      if (Array.isArray(slots)) {
        for (const slot of slots) {
          const list = slot?.radioState?.tracks;
          if (!Array.isArray(list) || list.length === 0) continue;
          foundAnySavedSlot = true;
          if (slotTracksOrdered.length === 0) {
            slotTracksOrdered = list;
          }
          for (const tr of list) {
            if (!tr || !tr.id) continue;
            if (!byId.has(tr.id) || tr.coverDataUrl) {
              byId.set(tr.id, { ...tr });
            }
          }
        }
      }
    }
  } catch (_) {
    // Ignora erro de parse
  }

  const idbEntries = await RadioAudioStorageDB.getAllLegacyBlobEntries();
  for (const { id, blob } of idbEntries) {
    _memAudioBlobs.set(id, blob);
    if (!byId.has(id)) {
      const cleanTitle = String(blob?.name || id).replace(/\.[a-z0-9]{2,4}$/i, '').toUpperCase();
      byId.set(id, {
        id,
        title: cleanTitle || 'MINHA MÚSICA SALVA',
        artist: 'MEU ACERVO',
        durationSec: 150,
        isCustomFile: true,
        src: '',
        coverDataUrl: null
      });
    } else {
      byId.get(id).isCustomFile = true;
    }
  }

  const allCollected = Array.from(byId.values());
  const customOnly = allCollected.filter((t) => Boolean(t.isCustomFile));

  // Se o usuário já colocou músicas próprias (MP3s dele), inicia a Rádio Padrão APENAS com as músicas dele!
  let chosen = customOnly.length > 0 ? customOnly : foundAnySavedSlot ? slotTracksOrdered : createDefaultRadioTracksList();
  if (!Array.isArray(chosen) || chosen.length === 0) {
    chosen = createDefaultRadioTracksList();
  }

  return chosen.map((t) => {
    const blob = _memAudioBlobs.get(t.id);
    let src = t.src || '';
    if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      src = URL.createObjectURL(blob);
    }
    return {
      id: t.id,
      title: t.title || 'FAIXA SEM TÍTULO',
      artist: t.artist || 'RÁDIO FM',
      bpm: Number(t.bpm) || 132,
      durationSec: Math.max(8, Number(t.durationSec) || (t.isCustomFile ? 150 : 92)),
      style: t.style || 'FM',
      color: t.color || '#facc15',
      src,
      isCustomFile: Boolean(t.isCustomFile),
      coverUrl: t.coverUrl || t.coverDataUrl || '',
      coverDataUrl: t.coverDataUrl || t.coverUrl || null
    };
  });
}
