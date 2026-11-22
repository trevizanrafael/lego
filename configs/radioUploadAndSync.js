import {
  RADIO_STORAGE_KEY,
  createDefaultSingleStationState,
  RadioAudioStorageDB,
  collectMigratedLegacyTracksFromBrowser
} from '../src/audio/radio/RadioDefaultCatalogAndStorage.js';

const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm|weba|mpga|mp4)$/i;

export function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(fileOrBlob);
  });
}

export function measureAudioDuration(fileOrBlob) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(fileOrBlob);
      const audio = new Audio();
      const done = (dur) => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(dur) && dur > 2 ? Math.round(dur * 100) / 100 : 150);
      };
      audio.addEventListener('loadedmetadata', () => done(audio.duration), { once: true });
      audio.addEventListener('error', () => done(150), { once: true });
      setTimeout(() => done(audio.duration || 150), 4000);
      audio.src = url;
    } catch (_) {
      resolve(150);
    }
  });
}

export function isSupportedAudioFile(file) {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  const name = String(file.name || '');
  return AUDIO_EXT_RE.test(name);
}

export function eventHasExternalFiles(e) {
  const types = e?.dataTransfer?.types;
  if (!types) return Boolean(e?.dataTransfer?.files?.length);
  return Array.from(types).includes('Files');
}

export async function checkServerHealth(state, dom) {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    state.serverApiAvailable = Boolean(data?.ok);
    if (data.ok && data.ytDlpAvailable) {
      dom.ytdlpDot.classList.add('online');
      dom.ytdlpStatusText.textContent = data.ffmpegAvailable
        ? 'Python + yt-dlp + FFmpeg ONLINE'
        : 'Python + yt-dlp ONLINE';
      return;
    }
    if (data.ok) {
      dom.ytdlpDot.classList.add('online');
      dom.ytdlpStatusText.textContent = 'Servidor Python ativo (yt-dlp ausente)';
      return;
    }
  } catch (_) {
    state.serverApiAvailable = false;
    dom.ytdlpDot.classList.remove('online');
    dom.ytdlpStatusText.textContent = 'Modo estático — rode "npm start" p/ gravar MP3 e YouTube';
  }
}

export async function ensureServerStatus(state, dom) {
  if (state.serverApiAvailable !== null) return state.serverApiAvailable;
  await checkServerHealth(state, dom);
  return Boolean(state.serverApiAvailable);
}

export async function persistFullState(state, dom, syncChannel) {
  const payload = {
    initialized: true,
    stations: state.stations,
    tracks: state.tracks
  };
  try {
    localStorage.setItem(RADIO_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignora
  }
  try {
    syncChannel?.postMessage({ type: 'RADIO_CONFIG_UPDATED', state: payload });
  } catch (_) {
    // Ignora
  }
  const apiReady = await ensureServerStatus(state, dom);
  if (!apiReady) return;
  try {
    const res = await fetch('/api/radio/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 501 || res.status === 405 || res.status === 404) {
      state.serverApiAvailable = false;
    }
  } catch (_) {
    // Ignora caso servidor estático
  }
}

export async function syncPendingIdbTracksToServer(state) {
  if (!state.serverApiAvailable) return false;
  let changed = false;
  for (let i = 0; i < state.tracks.length; i++) {
    const tr = state.tracks[i];
    if (!tr || !String(tr.src || '').startsWith('idb://')) continue;
    const blob = await RadioAudioStorageDB.getAudioBlob(tr.id);
    if (!blob) continue;
    try {
      const meta = {
        id: tr.id,
        fileName: blob.name || `${tr.id}.mp3`,
        mimeType: blob.type || 'audio/mpeg',
        title: tr.title,
        artist: tr.artist,
        durationSec: tr.durationSec,
        source: 'upload'
      };
      const up = await fetch('/api/radio/upload-file', {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'X-Radio-Meta': encodeURIComponent(JSON.stringify(meta))
        },
        body: blob
      });
      if (up.ok) {
        const upJson = await up.json();
        if (upJson?.track?.src) {
          state.tracks[i] = {
            ...tr,
            src: upJson.track.src,
            source: 'upload'
          };
          changed = true;
        }
      }
    } catch (_) {
      // Mantém em IndexedDB caso falhe
    }
  }
  return changed;
}

export async function bootstrapRadioState({ state, dom, syncChannel, renderAll }) {
  const apiReady = await ensureServerStatus(state, dom);
  let localCached = null;
  try {
    const cached = localStorage.getItem(RADIO_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.initialized && Array.isArray(parsed.stations) && parsed.stations.length > 0) {
        localCached = parsed;
      }
    }
  } catch (_) {
    // Ignora cache inválido
  }

  if (apiReady) {
    try {
      const res = await fetch('/api/radio/state', { cache: 'no-store' });
      if (res.ok) {
        const serverData = await res.json();
        if (serverData?.initialized && Array.isArray(serverData.stations) && serverData.stations.length > 0) {
          state.stations = serverData.stations;
          state.tracks = serverData.tracks || [];

          if (localCached?.tracks?.length) {
            const knownIds = new Set(state.tracks.map((t) => t.id));
            let mergedAny = false;
            for (const lt of localCached.tracks) {
              if (lt?.id && !knownIds.has(lt.id) && String(lt.src || '').startsWith('idb://')) {
                state.tracks.push(lt);
                knownIds.add(lt.id);
                const targetLocalSt = localCached.stations.find((s) => (s.trackIds || []).includes(lt.id));
                const destSt =
                  (targetLocalSt && state.stations.find((s) => s.id === targetLocalSt.id)) ||
                  state.stations[0];
                if (destSt && !destSt.trackIds.includes(lt.id)) {
                  destSt.trackIds.push(lt.id);
                }
                mergedAny = true;
              }
            }
            const promoted = await syncPendingIdbTracksToServer(state);
            if (mergedAny || promoted) {
              await persistFullState(state, dom, syncChannel);
            }
          }
          renderAll();
          return;
        }
      }
    } catch (_) {
      // Tenta localStorage abaixo
    }
  }

  if (localCached) {
    state.stations = localCached.stations;
    state.tracks = localCached.tracks || [];
    if (apiReady) {
      await syncPendingIdbTracksToServer(state);
      await persistFullState(state, dom, syncChannel);
    }
    renderAll();
    return;
  }

  const migrated = await collectMigratedLegacyTracksFromBrowser();
  const uploaded = [];
  for (const tr of migrated) {
    const blob = await RadioAudioStorageDB.getAudioBlob(tr.id);
    if (blob && apiReady) {
      const dur = await measureAudioDuration(blob);
      const audioDataUrl = await fileToDataUrl(blob);
      if (audioDataUrl) {
        try {
          const up = await fetch('/api/radio/upload-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: tr.id,
              title: tr.title,
              artist: tr.artist,
              durationSec: dur,
              audioDataUrl,
              coverDataUrl: tr.coverDataUrl || '',
              source: 'migrated'
            })
          });
          if (up.ok) {
            const upJson = await up.json();
            if (upJson?.track) {
              uploaded.push(upJson.track);
              continue;
            }
          }
        } catch (_) {
          // Fallback local
        }
      }
    } else if (blob && !apiReady) {
      uploaded.push({ ...tr, src: `idb://${tr.id}` });
      continue;
    }
    uploaded.push(tr);
  }

  const initial = createDefaultSingleStationState(uploaded);
  state.stations = initial.stations;
  state.tracks = initial.tracks;
  await persistFullState(state, dom, syncChannel);
  renderAll();
}

export async function importLocalAudioFiles({
  fileList,
  targetStationId,
  state,
  dom,
  syncChannel,
  showFeedback,
  renderAll
}) {
  const rawList = Array.from(fileList || []).filter(Boolean);
  if (rawList.length === 0) return;
  const files = rawList.filter(isSupportedAudioFile);
  if (files.length === 0) {
    showFeedback('Formato inválido. Arraste arquivos de áudio (.mp3, .wav, .m4a, .ogg, .flac, .opus).', 'error');
    return;
  }

  if (!state.stations.length) {
    const fallbackInit = createDefaultSingleStationState([]);
    state.stations = fallbackInit.stations;
  }
  const destSt =
    state.stations.find((s) => s.id === targetStationId) ||
    state.stations.find((s) => s.id === dom.ytStationSelect.value) ||
    state.stations[0];
  const stId = destSt?.id || 'station_padrao';

  const apiReady = await ensureServerStatus(state, dom);
  showFeedback(`Importando ${files.length} música(s) para "${destSt?.name || 'Rádio'}"...`, 'info');

  let addedCount = 0;
  let usedLocalFallback = false;
  let lastError = '';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const cleanTitle = String(file.name || `MP3 ${i + 1}`)
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .trim();
    const dur = await measureAudioDuration(file);
    const id = `mp3_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`;

    let uploadedTrack = null;
    if (apiReady && state.serverApiAvailable !== false) {
      try {
        const meta = {
          id,
          fileName: file.name || `${id}.mp3`,
          mimeType: file.type || 'audio/mpeg',
          title: cleanTitle || `FAIXA ${i + 1}`,
          artist: 'ACERVO LOCAL',
          durationSec: dur,
          stationId: stId,
          source: 'upload'
        };
        const res = await fetch('/api/radio/upload-file', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Radio-Meta': encodeURIComponent(JSON.stringify(meta))
          },
          body: file
        });
        if (res.status === 501 || res.status === 405 || res.status === 404) {
          state.serverApiAvailable = false;
        } else if (res.ok) {
          const data = await res.json();
          if (data?.ok && data?.track) {
            uploadedTrack = data.track;
          } else if (data?.error) {
            lastError = data.error;
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          lastError = errJson?.error || `HTTP ${res.status}`;
        }
      } catch (err) {
        lastError = err?.message || 'falha de rede';
      }
    }

    if (!uploadedTrack) {
      const savedBlobOk = await RadioAudioStorageDB.saveAudioBlob(id, file);
      if (savedBlobOk) {
        uploadedTrack = {
          id,
          title: cleanTitle || `FAIXA ${i + 1}`,
          artist: 'ACERVO LOCAL',
          durationSec: dur,
          src: `idb://${id}`,
          coverUrl: '',
          coverDataUrl: null,
          source: 'upload-idb',
          isCustomFile: true
        };
        usedLocalFallback = true;
      }
    }

    if (uploadedTrack) {
      const existingIdx = state.tracks.findIndex((t) => t.id === uploadedTrack.id);
      if (existingIdx >= 0) state.tracks[existingIdx] = uploadedTrack;
      else state.tracks.push(uploadedTrack);

      const st = state.stations.find((s) => s.id === stId) || state.stations[0];
      if (st) {
        if (!Array.isArray(st.trackIds)) st.trackIds = [];
        if (!st.trackIds.includes(uploadedTrack.id)) st.trackIds.push(uploadedTrack.id);
      }
      addedCount++;
    }
  }

  if (addedCount === 0) {
    showFeedback(`Não foi possível importar o MP3 (${lastError || 'erro ao ler arquivo'}).`, 'error');
    return;
  }

  await persistFullState(state, dom, syncChannel);
  renderAll();
  if (usedLocalFallback) {
    showFeedback(
      `${addedCount} música(s) adicionada(s) em "${destSt?.name}"! (Modo estático: use "npm start" / python server.py p/ salvar na pasta data/radio/media).`,
      'success'
    );
  } else {
    showFeedback(`${addedCount} música(s) enviada(s) para "${destSt?.name}" com sucesso!`, 'success');
  }
}
