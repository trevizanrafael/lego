/**
 * Ponte da Roda Radial de Estações & HUD Contextual Ao Vivo Estilo GTA 6.
 *
 * - Segurar [Z] ou [P] abre a Roda Radial de Rádios (`#gta6-radio-wheel-overlay`).
 * - Mover o mouse ou usar `[` / `]` sintoniza cada estação AO VIVO em tempo real.
 * - Zero botão de pular música: exibe apenas a transmissão sincronizada atual de cada rádio.
 */

import { getTrackCoverUrl, getStationIconSvg } from '../../audio/TikTokRadioSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function installHudRadioModalBridge(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _formatRadioTime(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${m}:${String(rem).padStart(2, '0')}`;
    },

    _initTikTokRadioModal() {
      this.isRadioWheelOpen = false;
      this.isTikTokRadioOpen = false;
      this._radioWheelHighlightedId = 'off';
      this._radioPointerVec = { x: 0, y: 0 };

      this.radioWheelOverlayEl = document.getElementById('gta6-radio-wheel-overlay');
      this.radioWheelNodesRingEl = document.getElementById('gta6-wheel-nodes-ring');
      this.radioWheelCenterFreqEl = document.getElementById('gta6-wheel-station-freq');
      this.radioWheelCenterNameEl = document.getElementById('gta6-wheel-station-name');
      this.radioWheelCenterGenreEl = document.getElementById('gta6-wheel-station-genre');
      this.radioWheelCoverWrapEl = document.getElementById('gta6-wheel-cover-wrap');
      this.radioWheelCoverImgEl = document.getElementById('gta6-wheel-cover-img');
      this.radioWheelTrackTitleEl = document.getElementById('gta6-wheel-track-title');
      this.radioWheelTrackArtistEl = document.getElementById('gta6-wheel-track-artist');
      this.radioWheelLiveFillEl = document.getElementById('gta6-wheel-live-fill');
      this.radioWheelLiveTimeEl = document.getElementById('gta6-wheel-live-time');

      this.tiktokHudPillEl = document.getElementById('hud-tiktok-radio-pill');
      this.hudSpotifyDiscImg = document.getElementById('hud-spotify-disc-img');
      this.hudRadioStationTagEl = document.getElementById('hud-radio-station-tag');
      this.hudSpotifyMarqueeTitleEl = document.getElementById('hud-spotify-marquee-title');
      this.hudRadioArtistSubEl = document.getElementById('hud-radio-artist-sub');

      this.tiktokToastEl = document.getElementById('tiktok-radio-toast');
      this.tiktokToastStationEl = document.getElementById('tiktok-toast-station');
      this.tiktokToastTitleEl = document.getElementById('tiktok-toast-title');
      this.tiktokToastArtistEl = document.getElementById('tiktok-toast-artist');
      this.tiktokToastCoverEl = document.getElementById('tiktok-toast-cover');

      this.tiktokHudPillEl?.addEventListener('click', () => {
        this.tiktokRadio?.stepStation?.(1, true);
      });

      this.refreshTikTokRadioUI();
    },

    setRadioWheelOpen(open, controller = null) {
      if (open && (this.isCreatorOpen || this.isCustomsOpen || this.isAircraftStudioOpen || this.isTitleScreenActive || this.isLoadingActive)) {
        return;
      }
      if (controller) {
        this._lastController = controller;
      }
      const nextOpen = Boolean(open);
      if (this.isRadioWheelOpen === nextOpen) return;

      this.isRadioWheelOpen = nextOpen;
      this.isTikTokRadioOpen = nextOpen;
      this._radioPointerVec.x = 0;
      this._radioPointerVec.y = 0;
      document.body?.classList.toggle('gta6-radio-wheel-active', nextOpen);

      if (this.radioWheelOverlayEl) {
        this.radioWheelOverlayEl.classList.toggle('hidden', !nextOpen);
      }

      if (nextOpen) {
        this._radioWheelHighlightedId = this.tiktokRadio?.activeStationId || 'off';
        this._renderRadioWheelSlots();
        this._syncRadioWheelCenterLive();
      }
    },

    // Aliases legados p/ compatibilidade com pausas/transições de tela do jogo
    setTikTokRadioOpen(open, controller = null) {
      this.setRadioWheelOpen(open, controller);
    },

    toggleTikTokRadioModal(controller = null) {
      this.setRadioWheelOpen(!this.isRadioWheelOpen, controller);
    },

    /**
     * Aponta na Roda Radial estilo GTA 6 usando movimento do mouse (com ou sem PointerLock).
     */
    updateRadioWheelAim(moveX, moveY) {
      if (!this.isRadioWheelOpen || !this.tiktokRadio) return;
      this._radioPointerVec.x = Math.max(-180, Math.min(180, this._radioPointerVec.x + moveX));
      this._radioPointerVec.y = Math.max(-180, Math.min(180, this._radioPointerVec.y + moveY));

      const mag = Math.hypot(this._radioPointerVec.x, this._radioPointerVec.y);
      if (mag < 26) return;

      const slots = this.tiktokRadio.getWheelSlots();
      if (slots.length === 0) return;

      // Slot 0 ('off') fica na base (PI/2 = 90° p/ baixo) igual GTA; demais distribuídos em 360°
      const angle = Math.atan2(this._radioPointerVec.y, this._radioPointerVec.x);
      let bestSlot = slots[0];
      let bestDiff = Infinity;

      for (let i = 0; i < slots.length; i++) {
        const slotAngle = Math.PI / 2 + (i / slots.length) * Math.PI * 2;
        const diff = Math.abs(Math.atan2(Math.sin(angle - slotAngle), Math.cos(angle - slotAngle)));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSlot = slots[i];
        }
      }

      if (bestSlot && bestSlot.id !== this._radioWheelHighlightedId) {
        this._selectRadioWheelSlot(bestSlot.id);
      }
    },

    stepRadioWheelSelection(delta = 1) {
      if (!this.tiktokRadio) return;
      this.tiktokRadio.stepStation(delta, !this.isRadioWheelOpen);
      this._radioWheelHighlightedId = this.tiktokRadio.activeStationId || 'off';
      if (this.isRadioWheelOpen) {
        this._renderRadioWheelSlots();
        this._syncRadioWheelCenterLive();
      }
    },

    _selectRadioWheelSlot(slotId) {
      this._radioWheelHighlightedId = slotId || 'off';
      this.tiktokRadio?.tuneStation(slotId === 'off' ? null : slotId, {
        showToast: false,
        playStatic: true
      });
      this._renderRadioWheelSlots();
      this._syncRadioWheelCenterLive();
    },

    _renderRadioWheelSlots() {
      if (!this.radioWheelNodesRingEl || !this.tiktokRadio) return;
      const slots = this.tiktokRadio.getWheelSlots();
      const radiusPx = 192;
      const activeId = this.tiktokRadio.activeStationId || 'off';

      this.radioWheelNodesRingEl.innerHTML = slots
        .map((slot, idx) => {
          const theta = Math.PI / 2 + (idx / slots.length) * Math.PI * 2;
          const x = Math.round(Math.cos(theta) * radiusPx);
          const y = Math.round(Math.sin(theta) * radiusPx);
          const isSelected = slot.id === activeId;
          const accent = slot.color || '#facc15';
          const shortLabel = slot.isOff ? 'OFF' : slot.freq || slot.name.slice(0, 8);
          return `
            <button
              type="button"
              class="gta6-wheel-node ${isSelected ? 'is-active' : ''} ${slot.isOff ? 'is-off' : ''}"
              data-station-id="${escapeHtml(slot.id)}"
              style="--node-x:${x}px; --node-y:${y}px; --station-color:${escapeHtml(accent)};"
            >
              <span class="gta6-node-icon">${getStationIconSvg(slot.icon)}</span>
              <span class="gta6-node-freq">${escapeHtml(shortLabel)}</span>
            </button>
          `;
        })
        .join('');

      if (typeof this.radioWheelNodesRingEl.querySelectorAll === 'function') {
        this.radioWheelNodesRingEl.querySelectorAll('.gta6-wheel-node').forEach((btn) => {
          btn.addEventListener('mouseenter', () => {
            const sid = btn.dataset.stationId || 'off';
            if (sid !== this._radioWheelHighlightedId) {
              this._selectRadioWheelSlot(sid);
            }
          });
          btn.addEventListener('click', () => {
            const sid = btn.dataset.stationId || 'off';
            this._selectRadioWheelSlot(sid);
            this.setRadioWheelOpen(false, this._lastController);
          });
        });
      }
    },

    _syncRadioWheelCenterLive() {
      if (!this.isRadioWheelOpen || !this.tiktokRadio) return;
      const st = this.tiktokRadio.activeStation;
      if (!st) {
        if (this.radioWheelCenterFreqEl) this.radioWheelCenterFreqEl.textContent = 'FM OFF';
        if (this.radioWheelCenterNameEl) this.radioWheelCenterNameEl.textContent = 'RÁDIO DESLIGADA';
        if (this.radioWheelCenterGenreEl) this.radioWheelCenterGenreEl.textContent = 'SILÊNCIO TÁTICO';
        this.radioWheelCoverWrapEl?.classList.add('hidden');
        if (this.radioWheelTrackTitleEl) this.radioWheelTrackTitleEl.textContent = 'SINTONIZE UMA ESTAÇÃO AO REDOR';
        if (this.radioWheelTrackArtistEl) this.radioWheelTrackArtistEl.textContent = 'Gerencie suas rádios em localhost:5173/configs';
        return;
      }

      const live = this.tiktokRadio.getStationLiveNow(st.id);
      if (this.radioWheelCenterFreqEl) {
        this.radioWheelCenterFreqEl.textContent = `${st.freq} • NO AR`;
        this.radioWheelCenterFreqEl.style.color = st.color || '#facc15';
      }
      if (this.radioWheelCenterNameEl) this.radioWheelCenterNameEl.textContent = st.name;
      if (this.radioWheelCenterGenreEl) this.radioWheelCenterGenreEl.textContent = st.genre || 'TRANSMISSÃO AO VIVO';

      if (live && live.track) {
        this.radioWheelCoverWrapEl?.classList.remove('hidden');
        if (this.radioWheelCoverImgEl) {
          this.radioWheelCoverImgEl.src = getTrackCoverUrl(live.track);
        }
        if (this.radioWheelTrackTitleEl) this.radioWheelTrackTitleEl.textContent = live.track.title;
        if (this.radioWheelTrackArtistEl) this.radioWheelTrackArtistEl.textContent = live.track.artist;
        if (this.radioWheelLiveFillEl) {
          this.radioWheelLiveFillEl.style.width = `${Math.round((live.ratio || 0) * 100)}%`;
          this.radioWheelLiveFillEl.style.background = st.color || '#facc15';
        }
        if (this.radioWheelLiveTimeEl) {
          this.radioWheelLiveTimeEl.textContent = `AO VIVO • ${this._formatRadioTime(live.offsetSec)} / ${this._formatRadioTime(live.durationSec)}`;
        }
      } else {
        this.radioWheelCoverWrapEl?.classList.add('hidden');
        if (this.radioWheelTrackTitleEl) this.radioWheelTrackTitleEl.textContent = 'SEM FAIXAS NESTA ESTAÇÃO';
        if (this.radioWheelTrackArtistEl) this.radioWheelTrackArtistEl.textContent = 'Arraste músicas em localhost:5173/configs';
      }
    },

    _syncSpotifyTimeBar() {
      if (this.isRadioWheelOpen) {
        this._syncRadioWheelCenterLive();
      }
    },

    showTikTokRadioToast(track, station = null) {
      if (!this.tiktokToastEl) return;
      const st = station || this.tiktokRadio?.activeStation || null;

      if (!st || !track) {
        if (this.tiktokToastStationEl) this.tiktokToastStationEl.textContent = 'FM // OFF';
        if (this.tiktokToastTitleEl) this.tiktokToastTitleEl.textContent = 'RÁDIO DESLIGADA';
        if (this.tiktokToastArtistEl) this.tiktokToastArtistEl.textContent = '';
        this.tiktokToastCoverEl?.classList.add('hidden');
      } else {
        if (this.tiktokToastStationEl) {
          this.tiktokToastStationEl.textContent = `${st.freq} // ${st.name}`;
          this.tiktokToastStationEl.style.color = st.color || '#facc15';
        }
        if (this.tiktokToastTitleEl) this.tiktokToastTitleEl.textContent = track.title;
        if (this.tiktokToastArtistEl) this.tiktokToastArtistEl.textContent = track.artist;
        if (this.tiktokToastCoverEl) {
          this.tiktokToastCoverEl.src = getTrackCoverUrl(track);
          this.tiktokToastCoverEl.classList.remove('hidden');
        }
      }

      this.tiktokToastEl.classList.remove('hidden');
      if (this._tiktokToastTimeout) clearTimeout(this._tiktokToastTimeout);
      this._tiktokToastTimeout = setTimeout(() => {
        this.tiktokToastEl?.classList.add('hidden');
      }, 4200);
      this._tiktokToastTimeout?.unref?.();
    },

    refreshTikTokRadioUI() {
      const radio = this.tiktokRadio;
      if (!radio) return;

      const st = radio.activeStation;
      const live = st ? radio.getStationLiveNow(st.id) : null;
      const track = live?.track || null;
      const playing = Boolean(st && track);

      if (this.tiktokHudPillEl) {
        this.tiktokHudPillEl.classList.toggle('playing', playing);
        const accent = st?.color || '#facc15';
        if (typeof this.tiktokHudPillEl.style?.setProperty === 'function') {
          this.tiktokHudPillEl.style.setProperty('--radio-accent', accent);
        } else if (this.tiktokHudPillEl.style) {
          this.tiktokHudPillEl.style['--radio-accent'] = accent;
        }
      }
      if (playing) {
        if (this.hudSpotifyDiscImg) this.hudSpotifyDiscImg.src = getTrackCoverUrl(track);
        if (this.hudRadioStationTagEl) this.hudRadioStationTagEl.textContent = `${st.freq} • ${st.name}`;
        if (this.hudSpotifyMarqueeTitleEl) this.hudSpotifyMarqueeTitleEl.textContent = track.title;
        if (this.hudRadioArtistSubEl) this.hudRadioArtistSubEl.textContent = track.artist;
      }

      if (this.isRadioWheelOpen) {
        this._renderRadioWheelSlots();
        this._syncRadioWheelCenterLive();
      }
    }
  });
}
