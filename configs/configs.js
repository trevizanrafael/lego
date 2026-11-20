import {
  RADIO_STORAGE_KEY,
  RADIO_SYNC_CHANNEL,
  STATION_ICONS_SVG,
  getStationIconSvg,
  getTrackCoverUrl,
  createDefaultSingleStationState,
  RadioAudioStorageDB,
  collectMigratedLegacyTracksFromBrowser
} from '../src/audio/radio/RadioDefaultCatalogAndStorage.js';
import { LiveBroadcastClock } from '../src/audio/radio/LiveBroadcastScheduler.js';

const SWATCH_COLORS = ['#facc15', '#00f0ff', '#ef4444', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#38bdf8'];
const ICON_KEYS = Object.keys(STATION_ICONS_SVG).filter((k) => k !== 'off');

const state = {
  stations: [],
  tracks: [],
  searchQuery: '',
  selectedTrackIds: new Set(),
  dragPayload: null,
  editStationColor: '#facc15',
  editStationIcon: 'antenna',
  pendingTrackCoverDataUrl: null
};

const broadcastClock = new LiveBroadcastClock();
const syncChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(RADIO_SYNC_CHANNEL) : null;

const dom = {
  ytdlpDot: document.getElementById('ytdlp-dot'),
  ytdlpStatusText: document.getElementById('ytdlp-status-text'),
  searchInput: document.getElementById('search-tracks-input'),
  btnUploadMp3: document.getElementById('btn-upload-local-mp3'),
  inputLocalMp3: document.getElementById('input-local-mp3'),
  btnNewStation: document.getElementById('btn-new-station'),
  ytForm: document.getElementById('youtube-import-form'),
  ytUrlInput: document.getElementById('yt-url-input'),
  ytStationSelect: document.getElementById('yt-station-select'),
  btnYtSubmit: document.getElementById('btn-yt-submit'),
  feedbackEl: document.getElementById('importer-feedback'),
  bulkBar: document.getElementById('bulk-move-bar'),
  bulkCountLabel: document.getElementById('bulk-count-label'),
  bulkTargetSelect: document.getElementById('bulk-target-station'),
  btnBulkMove: document.getElementById('btn-bulk-move'),
  btnBulkClear: document.getElementById('btn-bulk-clear'),
  boardEl: document.getElementById('stations-board'),
  previewBar: document.getElementById('preview-bar'),
  previewCover: document.getElementById('preview-cover'),
  previewTitle: document.getElementById('preview-title'),
  previewArtist: document.getElementById('preview-artist'),
  previewAudio: document.getElementById('preview-audio'),
  btnClosePreview: document.getElementById('btn-close-preview'),
  stationModal: document.getElementById('station-modal'),
  stationForm: document.getElementById('station-form'),
  stEditId: document.getElementById('st-edit-id'),
  stName: document.getElementById('st-name'),
  stFreq: document.getElementById('st-freq'),
  stGenre: document.getElementById('st-genre'),
  stSwatches: document.getElementById('st-color-swatches'),
  stIconPicker: document.getElementById('st-icon-picker'),
  btnCancelStation: document.getElementById('btn-cancel-station'),
  trackModal: document.getElementById('track-modal'),
  trackForm: document.getElementById('track-form'),
  trEditId: document.getElementById('tr-edit-id'),
  trEditPreview: document.getElementById('tr-edit-preview'),
  btnTrPickCover: document.getElementById('btn-tr-pick-cover'),
  inputTrCover: document.getElementById('input-tr-cover'),
  trTitle: document.getElementById('tr-title'),
  trArtist: document.getElementById('tr-artist'),
  btnCancelTrack: document.getElementById('btn-cancel-track')
};

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function showFeedback(msg, kind = 'info') {
  dom.feedbackEl.textContent = msg;
  dom.feedbackEl.className = `importer-feedback ${kind}`;
  dom.feedbackEl.classList.remove('hidden');
}

function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(fileOrBlob);
  });
}

function measureAudioDuration(fileOrBlob) {
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

async function persistFullState() {
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
  try {
    await fetch('/api/radio/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    // Ignora caso servidor estático
  }
}

async function checkServerHealth() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    if (data.ok && data.ytDlpAvailable) {
      dom.ytdlpDot.classList.add('online');
      dom.ytdlpStatusText.textContent = data.ffmpegAvailable
        ? 'Python + yt-dlp + FFmpeg ONLINE'
        : 'Python + yt-dlp ONLINE';
      return;
    }
    dom.ytdlpStatusText.textContent = 'Servidor ativo (yt-dlp ausente)';
  } catch (_) {
    dom.ytdlpStatusText.textContent = 'Rode "npm start" p/ ativar YouTube->MP3';
  }
}

async function loadInitialRadioState() {
  try {
    const res = await fetch('/api/radio/state', { cache: 'no-store' });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.initialized && Array.isArray(serverData.stations) && serverData.stations.length > 0) {
        state.stations = serverData.stations;
        state.tracks = serverData.tracks || [];
        renderAll();
        return;
      }
    }
  } catch (_) {
    // Tenta localStorage abaixo
  }

  try {
    const cached = localStorage.getItem(RADIO_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.initialized && Array.isArray(parsed.stations) && parsed.stations.length > 0) {
        state.stations = parsed.stations;
        state.tracks = parsed.tracks || [];
        await persistFullState();
        renderAll();
        return;
      }
    }
  } catch (_) {
    // Segue para migração automática
  }

  // Migra 100% das músicas já salvas hoje no navegador do jogador para 1 única Rádio Padrão!
  const migrated = await collectMigratedLegacyTracksFromBrowser();
  const uploaded = [];
  for (const tr of migrated) {
    const blob = await RadioAudioStorageDB.getAudioBlob(tr.id);
    if (blob) {
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
    }
    uploaded.push(tr);
  }

  const initial = createDefaultSingleStationState(uploaded);
  state.stations = initial.stations;
  state.tracks = initial.tracks;
  await persistFullState();
  renderAll();
}

function renderStationDropdowns() {
  const prevYtVal = dom.ytStationSelect.value;
  const optsHtml = state.stations
    .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.freq)})</option>`)
    .join('');
  dom.ytStationSelect.innerHTML = optsHtml;
  dom.bulkTargetSelect.innerHTML = optsHtml;
  if (prevYtVal && state.stations.some((s) => s.id === prevYtVal)) {
    dom.ytStationSelect.value = prevYtVal;
  }
}

function syncBulkBar() {
  const count = state.selectedTrackIds.size;
  dom.bulkBar.classList.toggle('hidden', count === 0);
  dom.bulkCountLabel.textContent = `${count} música${count === 1 ? '' : 's'} selecionada${count === 1 ? '' : 's'}`;
}

function renderBoard() {
  const tracksMap = new Map(state.tracks.map((t) => [t.id, t]));
  const q = state.searchQuery.trim().toLowerCase();
  const nowSec = broadcastClock.getNowSec();

  dom.boardEl.innerHTML = state.stations
    .map((st) => {
      const live = broadcastClock.sampleStationNow(st, tracksMap, nowSec);
      const validIds = (st.trackIds || []).filter((id) => tracksMap.has(id));
      const filteredIds = q
        ? validIds.filter((id) => {
            const t = tracksMap.get(id);
            return (
              String(t.title || '').toLowerCase().includes(q) ||
              String(t.artist || '').toLowerCase().includes(q)
            );
          })
        : validIds;

      const cardsHtml =
        filteredIds.length === 0
          ? `<div class="empty-drop-placeholder">
              ${q ? 'Nenhuma música bate com a busca.' : 'Arraste músicas para cá ou baixe um link do YouTube acima!'}
             </div>`
          : filteredIds
              .map((tid) => {
                const tr = tracksMap.get(tid);
                const checked = state.selectedTrackIds.has(tid) ? 'checked' : '';
                return `
                  <article
                    class="track-card"
                    draggable="true"
                    data-track-id="${escapeHtml(tr.id)}"
                    data-station-id="${escapeHtml(st.id)}"
                  >
                    <input type="checkbox" class="track-select-cb" data-cb-track="${escapeHtml(tr.id)}" ${checked} title="Selecionar p/ mover em lote" />
                    <img class="track-thumb" src="${escapeHtml(getTrackCoverUrl(tr))}" alt="" />
                    <div class="track-info">
                      <div class="track-title" title="${escapeHtml(tr.title)}">${escapeHtml(tr.title)}</div>
                      <div class="track-sub">${escapeHtml(tr.artist)} • ${formatDuration(tr.durationSec)}</div>
                    </div>
                    <div class="track-actions">
                      <button type="button" class="icon-btn" data-action="preview" data-track="${escapeHtml(tr.id)}" title="Ouvir Preview">▶</button>
                      <button type="button" class="icon-btn" data-action="edit-track" data-track="${escapeHtml(tr.id)}" title="Editar Nome / Foto">✎</button>
                      <button type="button" class="icon-btn danger" data-action="remove-track" data-track="${escapeHtml(tr.id)}" data-station="${escapeHtml(st.id)}" title="Excluir Música">✕</button>
                    </div>
                  </article>
                `;
              })
              .join('');

      return `
        <div class="station-column" data-drop-station="${escapeHtml(st.id)}" style="--st-color:${escapeHtml(st.color || '#facc15')}">
          <div class="station-header">
            <div class="station-top-row">
              <div class="station-title-group">
                <div class="station-icon-box">${getStationIconSvg(st.icon)}</div>
                <div style="min-width:0;">
                  <div class="station-freq-tag">${escapeHtml(st.freq)} • ${validIds.length} FAIXA${validIds.length === 1 ? '' : 'S'}</div>
                  <div class="station-name-heading" title="${escapeHtml(st.name)}">${escapeHtml(st.name)}</div>
                </div>
              </div>

              <div class="station-header-btns">
                <button type="button" class="icon-btn" data-action="edit-station" data-station="${escapeHtml(st.id)}" title="Editar Estação">✎</button>
                ${
                  state.stations.length > 1
                    ? `<button type="button" class="icon-btn danger" data-action="delete-station" data-station="${escapeHtml(st.id)}" title="Excluir Estação (move músicas p/ Rádio Padrão)">✕</button>`
                    : ''
                }
              </div>
            </div>

            <div class="station-live-strip">
              <span class="station-live-now">
                ${
                  live?.track
                    ? `NO AR AGORA: <b>${escapeHtml(live.track.title)}</b> (${formatDuration(live.offsetSec)})`
                    : 'ESTAÇÃO SEM PROGRAMAÇÃO ATIVA'
                }
              </span>
            </div>
          </div>

          <div class="station-tracks-dropzone" data-dropzone="${escapeHtml(st.id)}">
            ${cardsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  bindBoardInteractions();
}

function moveTracksToStation(trackIds, fromStationId, toStationId) {
  if (!toStationId || !Array.isArray(trackIds) || trackIds.length === 0) return;
  const dest = state.stations.find((s) => s.id === toStationId);
  if (!dest) return;

  for (const tid of trackIds) {
    if (fromStationId && fromStationId !== toStationId) {
      const src = state.stations.find((s) => s.id === fromStationId);
      if (src) src.trackIds = (src.trackIds || []).filter((id) => id !== tid);
    } else if (!fromStationId) {
      for (const st of state.stations) {
        if (st.id !== toStationId) {
          st.trackIds = (st.trackIds || []).filter((id) => id !== tid);
        }
      }
    }
    if (!dest.trackIds.includes(tid)) {
      dest.trackIds.push(tid);
    }
  }
  state.selectedTrackIds.clear();
  persistFullState();
  renderAll();
}

function bindBoardInteractions() {
  // Checkboxes p/ seleção em lote
  dom.boardEl.querySelectorAll('.track-select-cb').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const tid = e.target.dataset.cbTrack;
      if (e.target.checked) state.selectedTrackIds.add(tid);
      else state.selectedTrackIds.delete(tid);
      syncBulkBar();
    });
  });

  // Drag & Drop de cards entre rádios
  dom.boardEl.querySelectorAll('.track-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      const tid = card.dataset.trackId;
      const fromSt = card.dataset.stationId;
      const movingIds =
        state.selectedTrackIds.has(tid) && state.selectedTrackIds.size > 1
          ? Array.from(state.selectedTrackIds)
          : [tid];
      state.dragPayload = { trackIds: movingIds, fromStationId: fromSt };
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(state.dragPayload));
      }
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dom.boardEl.querySelectorAll('.station-column').forEach((c) => c.classList.remove('drag-over'));
    });
  });

  // Zonas de Drop nas colunas das estações (+ suporte a soltar arquivos MP3 direto do Windows!)
  dom.boardEl.querySelectorAll('.station-column').forEach((col) => {
    const targetStId = col.dataset.dropStation;
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        await uploadLocalAudioFiles(e.dataTransfer.files, targetStId);
        return;
      }

      const payload = state.dragPayload;
      if (payload && Array.isArray(payload.trackIds)) {
        moveTracksToStation(payload.trackIds, payload.fromStationId, targetStId);
        state.dragPayload = null;
      }
    });
  });

  // Botões de ação (Preview, Editar Faixa, Excluir Faixa, Editar/Excluir Estação)
  dom.boardEl.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const act = btn.dataset.action;
      if (act === 'preview') {
        startPreviewTrack(btn.dataset.track);
      } else if (act === 'edit-track') {
        openTrackModal(btn.dataset.track);
      } else if (act === 'remove-track') {
        await deleteTrackFromStationOrAll(btn.dataset.track, btn.dataset.station);
      } else if (act === 'edit-station') {
        openStationModal(btn.dataset.station);
      } else if (act === 'delete-station') {
        deleteStationSafely(btn.dataset.station);
      }
    });
  });
}

function startPreviewTrack(trackId) {
  const tr = state.tracks.find((t) => t.id === trackId);
  if (!tr) return;
  if (!tr.src) {
    showFeedback('Esta faixa usa sintetizador interno do jogo (importe MP3 ou YouTube p/ áudio real).', 'info');
    return;
  }
  dom.previewCover.src = getTrackCoverUrl(tr);
  dom.previewTitle.textContent = tr.title;
  dom.previewArtist.textContent = tr.artist;
  dom.previewAudio.src = tr.src;
  dom.previewBar.classList.remove('hidden');
  dom.previewAudio.play().catch(() => {});
}

async function deleteTrackFromStationOrAll(trackId, stationId) {
  const st = state.stations.find((s) => s.id === stationId);
  if (st) {
    st.trackIds = (st.trackIds || []).filter((id) => id !== trackId);
  }
  const stillUsedElsewhere = state.stations.some((s) => (s.trackIds || []).includes(trackId));
  if (!stillUsedElsewhere) {
    state.tracks = state.tracks.filter((t) => t.id !== trackId);
    try {
      await fetch('/api/radio/delete-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId })
      });
    } catch (_) {
      // Ignora
    }
  }
  state.selectedTrackIds.delete(trackId);
  await persistFullState();
  renderAll();
}

function deleteStationSafely(stationId) {
  if (state.stations.length <= 1) return;
  const target = state.stations.find((s) => s.id === stationId);
  if (!target) return;
  const fallback = state.stations.find((s) => s.id !== stationId);
  if (fallback && Array.isArray(target.trackIds)) {
    for (const tid of target.trackIds) {
      if (!fallback.trackIds.includes(tid)) fallback.trackIds.push(tid);
    }
  }
  state.stations = state.stations.filter((s) => s.id !== stationId);
  persistFullState();
  renderAll();
  showFeedback(`Estação "${target.name}" removida. As músicas foram preservadas em "${fallback.name}".`, 'info');
}

async function uploadLocalAudioFiles(fileList, targetStationId) {
  const files = Array.from(fileList || []).filter((f) => f && f.type.startsWith('audio/'));
  if (files.length === 0) return;
  const stId = targetStationId || dom.ytStationSelect.value || state.stations[0]?.id;

  showFeedback(`Enviando ${files.length} arquivo(s) MP3...`, 'info');
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const cleanTitle = String(file.name || `MP3 ${i + 1}`).replace(/\.[a-z0-9]{2,4}$/i, '');
    const dur = await measureAudioDuration(file);
    const audioDataUrl = await fileToDataUrl(file);
    const id = `mp3_${Date.now()}_${i}`;

    try {
      const res = await fetch('/api/radio/upload-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: cleanTitle,
          artist: 'ACERVO LOCAL',
          durationSec: dur,
          audioDataUrl,
          stationId: stId
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.track) {
          state.tracks.push(data.track);
          const st = state.stations.find((s) => s.id === stId) || state.stations[0];
          if (st && !st.trackIds.includes(data.track.id)) st.trackIds.push(data.track.id);
          continue;
        }
      }
    } catch (_) {
      // Fallback caso estático
    }
  }

  await persistFullState();
  renderAll();
  showFeedback(`${files.length} música(s) adicionada(s) com sucesso!`, 'success');
}

function openStationModal(stationId = null) {
  const editing = stationId ? state.stations.find((s) => s.id === stationId) : null;
  dom.stEditId.value = editing ? editing.id : '';
  dom.stName.value = editing ? editing.name : '';
  dom.stFreq.value = editing ? editing.freq : `${(94 + state.stations.length * 3.2).toFixed(1)} FM`;
  dom.stGenre.value = editing ? editing.genre || '' : '';
  state.editStationColor = editing?.color || SWATCH_COLORS[state.stations.length % SWATCH_COLORS.length];
  state.editStationIcon = editing?.icon || ICON_KEYS[state.stations.length % ICON_KEYS.length];

  renderModalPickers();
  dom.stationModal.classList.remove('hidden');
  dom.stName.focus();
}

function renderModalPickers() {
  dom.stSwatches.innerHTML = SWATCH_COLORS.map(
    (c) => `<button type="button" class="color-swatch ${c === state.editStationColor ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`
  ).join('');
  dom.stSwatches.querySelectorAll('.color-swatch').forEach((b) => {
    b.addEventListener('click', () => {
      state.editStationColor = b.dataset.color;
      renderModalPickers();
    });
  });

  dom.stIconPicker.innerHTML = ICON_KEYS.map(
    (k) => `<button type="button" class="icon-choice ${k === state.editStationIcon ? 'active' : ''}" data-icon="${k}">${getStationIconSvg(k)}</button>`
  ).join('');
  dom.stIconPicker.querySelectorAll('.icon-choice').forEach((b) => {
    b.addEventListener('click', () => {
      state.editStationIcon = b.dataset.icon;
      renderModalPickers();
    });
  });
}

function openTrackModal(trackId) {
  const tr = state.tracks.find((t) => t.id === trackId);
  if (!tr) return;
  dom.trEditId.value = tr.id;
  dom.trTitle.value = tr.title || '';
  dom.trArtist.value = tr.artist || '';
  state.pendingTrackCoverDataUrl = null;
  dom.trEditPreview.src = getTrackCoverUrl(tr);
  dom.trackModal.classList.remove('hidden');
}

function renderAll() {
  renderStationDropdowns();
  syncBulkBar();
  renderBoard();
}

// EVENTOS GLOBAIS DO /CONFIGS
dom.searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value || '';
  renderBoard();
});

dom.btnUploadMp3.addEventListener('click', () => {
  dom.inputLocalMp3.value = '';
  dom.inputLocalMp3.click();
});

dom.inputLocalMp3.addEventListener('change', (e) => {
  if (e.target.files?.length) uploadLocalAudioFiles(e.target.files, dom.ytStationSelect.value);
});

dom.btnNewStation.addEventListener('click', () => openStationModal(null));
dom.btnCancelStation.addEventListener('click', () => dom.stationModal.classList.add('hidden'));

dom.stationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = dom.stEditId.value;
  const name = dom.stName.value.trim().toUpperCase();
  const freq = dom.stFreq.value.trim().toUpperCase();
  const genre = dom.stGenre.value.trim().toUpperCase() || 'AO VIVO';

  if (editId) {
    const st = state.stations.find((s) => s.id === editId);
    if (st) {
      st.name = name;
      st.freq = freq;
      st.genre = genre;
      st.color = state.editStationColor;
      st.icon = state.editStationIcon;
    }
  } else {
    state.stations.push({
      id: `station_${Date.now()}`,
      name,
      freq,
      genre,
      color: state.editStationColor,
      icon: state.editStationIcon,
      trackIds: []
    });
  }

  dom.stationModal.classList.add('hidden');
  await persistFullState();
  renderAll();
});

dom.ytForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = dom.ytUrlInput.value.trim();
  const stationId = dom.ytStationSelect.value || state.stations[0]?.id;
  if (!url) return;

  dom.btnYtSubmit.disabled = true;
  dom.btnYtSubmit.textContent = 'EXTRAINDO MP3...';
  showFeedback('Baixando áudio MP3 e thumbnail oficial do YouTube via Python (yt-dlp)... aguarde alguns segundos.', 'info');

  try {
    const res = await fetch('/api/radio/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, stationId })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Falha ao processar link do YouTube.');
    }

    if (data.state?.stations) {
      state.stations = data.state.stations;
      state.tracks = data.state.tracks;
    }
    dom.ytUrlInput.value = '';
    try {
      localStorage.setItem(RADIO_STORAGE_KEY, JSON.stringify({ initialized: true, stations: state.stations, tracks: state.tracks }));
      syncChannel?.postMessage({ type: 'RADIO_CONFIG_UPDATED', state: { initialized: true, stations: state.stations, tracks: state.tracks } });
    } catch (_) {
      // Ignora
    }
    renderAll();
    showFeedback(`Importado com sucesso: "${data.track.title}" (${formatDuration(data.track.durationSec)})!`, 'success');
  } catch (err) {
    showFeedback(`Erro ao importar do YouTube: ${err.message}`, 'error');
  } finally {
    dom.btnYtSubmit.disabled = false;
    dom.btnYtSubmit.textContent = 'BAIXAR DO YOUTUBE';
  }
});

dom.btnBulkMove.addEventListener('click', () => {
  moveTracksToStation(Array.from(state.selectedTrackIds), null, dom.bulkTargetSelect.value);
});

dom.btnBulkClear.addEventListener('click', () => {
  state.selectedTrackIds.clear();
  renderAll();
});

dom.btnClosePreview.addEventListener('click', () => {
  dom.previewAudio.pause();
  dom.previewBar.classList.add('hidden');
});

dom.btnCancelTrack.addEventListener('click', () => dom.trackModal.classList.add('hidden'));
dom.btnTrPickCover.addEventListener('click', () => dom.inputTrCover.click());
dom.inputTrCover.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const dataUrl = await fileToDataUrl(f);
  if (dataUrl) {
    state.pendingTrackCoverDataUrl = dataUrl;
    dom.trEditPreview.src = dataUrl;
  }
});

dom.trackForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tr = state.tracks.find((t) => t.id === dom.trEditId.value);
  if (!tr) return;
  tr.title = dom.trTitle.value.trim();
  tr.artist = dom.trArtist.value.trim();
  if (state.pendingTrackCoverDataUrl) {
    try {
      const up = await fetch('/api/radio/upload-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tr.id,
          title: tr.title,
          artist: tr.artist,
          durationSec: tr.durationSec,
          src: tr.src,
          coverDataUrl: state.pendingTrackCoverDataUrl
        })
      });
      if (up.ok) {
        const upJson = await up.json();
        if (upJson?.track?.coverUrl) {
          tr.coverUrl = upJson.track.coverUrl;
          tr.coverDataUrl = upJson.track.coverUrl;
        }
      } else {
        tr.coverUrl = state.pendingTrackCoverDataUrl;
        tr.coverDataUrl = state.pendingTrackCoverDataUrl;
      }
    } catch (_) {
      tr.coverUrl = state.pendingTrackCoverDataUrl;
      tr.coverDataUrl = state.pendingTrackCoverDataUrl;
    }
  }
  dom.trackModal.classList.add('hidden');
  await persistFullState();
  renderAll();
});

// Atualiza a cada 2s o mostrador "NO AR AGORA" em cada coluna de rádio
setInterval(() => {
  if (!state.dragPayload && dom.stationModal.classList.contains('hidden') && dom.trackModal.classList.contains('hidden')) {
    renderBoard();
  }
}, 2000);

checkServerHealth();
loadInitialRadioState();
