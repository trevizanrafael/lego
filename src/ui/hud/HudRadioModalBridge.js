import { getTrackCoverUrl } from '../../audio/TikTokRadioSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export function installHudRadioModalBridge(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _formatRadioTime(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${m}:${String(rem).padStart(2, '0')}`;
    },

    _getSpotifySvgs() {
      if (!this._spotifySvgsCache) {
        this._spotifySvgsCache = {
          musicNote: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
          musicNoteSmall: `<svg class="spotify-inline-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
          heartOutline: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
          heartFilled: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="#1ed760" stroke="#1ed760" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
          camera: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
          trash: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
          plus: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
          refresh: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
          play: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>`,
          pause: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
          pauseSmall: `<svg class="spotify-inline-svg" viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
          speakerSmall: `<svg class="spotify-inline-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
          bassWave: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
        };
      }
      return this._spotifySvgsCache;
    },

    _initTikTokRadioModal() {
      this.spotifyFilterMode = 'all'; // 'all' | 'liked' | 'custom'
      this.spotifySearchQuery = '';
      this._pendingCoverTrackId = null;

      this.tiktokModalEl = document.getElementById('tiktok-radio-modal');
      this.tiktokCloseBtn = document.getElementById('btn-tiktok-close');
      this.tiktokPrevBtn = document.getElementById('btn-tiktok-prev');
      this.tiktokPlayPauseBtn = document.getElementById('btn-tiktok-play-pause');
      this.tiktokNextBtn = document.getElementById('btn-tiktok-next');
      this.tiktokShuffleBtn = document.getElementById('btn-tiktok-shuffle');
      this.spotifyRepeatBtn = document.getElementById('btn-spotify-repeat');
      this.tiktokBassBoostBtn = document.getElementById('btn-tiktok-bass-boost');
      this.tiktokVolSlider = document.getElementById('slider-tiktok-vol');
      this.tiktokVolValEl = document.getElementById('val-tiktok-vol');
      this.tiktokTrackListEl = document.getElementById('tiktok-track-list');
      this.tiktokNowTitleEl = document.getElementById('tiktok-now-playing-title');
      this.tiktokNowMetaEl = document.getElementById('tiktok-now-playing-meta');
      this.tiktokNowStatusEl = document.getElementById('tiktok-now-status-badge');
      this.tiktokImportBtn = document.getElementById('btn-tiktok-import-mp3');
      this.tiktokFileInput = document.getElementById('input-tiktok-mp3-file');
      this.spotifyCoverInput = document.getElementById('input-spotify-cover-file');
      this.tiktokHudPillEl = document.getElementById('hud-tiktok-radio-pill');
      this.hudSpotifyDiscImg = document.getElementById('hud-spotify-disc-img');
      this.hudSpotifyMarqueeTitleEl = document.getElementById('hud-spotify-marquee-title');
      this.tiktokToastEl = document.getElementById('tiktok-radio-toast');
      this.tiktokToastTitleEl = document.getElementById('tiktok-toast-title');

      // Elementos exclusivos da interface Spotify Desktop
      this.spotifyFilterAllBtn = document.getElementById('btn-spotify-filter-all');
      this.spotifyFilterLikedBtn = document.getElementById('btn-spotify-filter-liked');
      this.spotifyFilterCustomBtn = document.getElementById('btn-spotify-filter-custom');
      this.spotifyFeaturedCoverImg = document.getElementById('spotify-featured-cover-img');
      this.spotifyHeroCoverImg = document.getElementById('spotify-hero-cover-img');
      this.spotifyBottomCoverImg = document.getElementById('spotify-bottom-cover-img');
      this.spotifyChangeCurrentCoverBtn = document.getElementById('btn-spotify-change-current-cover');
      this.spotifyClearAllBtn = document.getElementById('btn-spotify-clear-all');
      this.spotifyRestoreDefaultsBtn = document.getElementById('btn-spotify-restore-defaults');
      this.spotifyHeroBannerEl = document.getElementById('spotify-playlist-hero');
      this.spotifyCountBadgeEl = document.getElementById('spotify-playlist-count-badge');
      this.spotifySearchInput = document.getElementById('input-spotify-search');
      this.spotifyBottomTitleEl = document.getElementById('spotify-bottom-title');
      this.spotifyBottomArtistEl = document.getElementById('spotify-bottom-artist');
      this.spotifyLikeCurrentBtn = document.getElementById('btn-spotify-like-current');
      this.spotifyCoverCurrentBtn = document.getElementById('btn-spotify-cover-current');
      this.spotifySeekSlider = document.getElementById('spotify-seek-slider');
      this.spotifyTimeCurEl = document.getElementById('spotify-time-cur');
      this.spotifyTimeDurEl = document.getElementById('spotify-time-dur');

      const setFilter = (mode) => {
        this.spotifyFilterMode = mode;
        this.refreshTikTokRadioUI();
      };
      this.spotifyFilterAllBtn?.addEventListener('click', () => setFilter('all'));
      this.spotifyFilterLikedBtn?.addEventListener('click', () => setFilter('liked'));
      this.spotifyFilterCustomBtn?.addEventListener('click', () => setFilter('custom'));

      this.spotifySearchInput?.addEventListener('input', (e) => {
        this.spotifySearchQuery = String(e.target?.value || '').trim().toLowerCase();
        this.refreshTikTokRadioUI();
      });

      const openCoverPickerForTrack = (trackId) => {
        const targetId = trackId || this.tiktokRadio?.currentTrack?.id;
        if (!targetId) return;
        this._pendingCoverTrackId = targetId;
        if (this.spotifyCoverInput) {
          this.spotifyCoverInput.value = '';
          this.spotifyCoverInput.click?.();
        }
      };

      this.spotifyChangeCurrentCoverBtn?.addEventListener('click', () => {
        openCoverPickerForTrack(this.tiktokRadio?.currentTrack?.id);
      });
      this.spotifyCoverCurrentBtn?.addEventListener('click', () => {
        openCoverPickerForTrack(this.tiktokRadio?.currentTrack?.id);
      });

      this.spotifyCoverInput?.addEventListener('change', (e) => {
        const file = e.target?.files?.[0];
        const targetId = this._pendingCoverTrackId || this.tiktokRadio?.currentTrack?.id;
        if (file && targetId) {
          this.tiktokRadio.setTrackCoverFromFile(targetId, file);
        }
      });

      this.spotifyClearAllBtn?.addEventListener('click', () => {
        this.tiktokRadio.clearAllTracks();
      });

      this.spotifyRestoreDefaultsBtn?.addEventListener('click', () => {
        this.tiktokRadio.restoreDefaultTracks();
      });

      this.spotifyLikeCurrentBtn?.addEventListener('click', () => {
        if (this.tiktokRadio?.currentTrack) {
          this.tiktokRadio.toggleLikeTrack(this.tiktokRadio.currentTrack.id);
        }
      });

      this.tiktokCloseBtn?.addEventListener('click', () => {
        this.setTikTokRadioOpen(false, this._lastController);
      });
      this.tiktokHudPillEl?.addEventListener('click', () => {
        this.toggleTikTokRadioModal(this._lastController);
      });
      this.tiktokPrevBtn?.addEventListener('click', () => {
        this.tiktokRadio.prevTrack(false);
      });
      this.tiktokPlayPauseBtn?.addEventListener('click', () => {
        this.tiktokRadio.togglePlayPause();
      });
      this.tiktokNextBtn?.addEventListener('click', () => {
        this.tiktokRadio.nextTrack(false);
      });
      this.tiktokShuffleBtn?.addEventListener('click', () => {
        this.tiktokRadio.toggleShuffle();
      });
      this.spotifyRepeatBtn?.addEventListener('click', () => {
        this.tiktokRadio.toggleRepeatOne();
      });
      this.tiktokBassBoostBtn?.addEventListener('click', () => {
        this.tiktokRadio.toggleBassBoost();
      });

      if (this.spotifySeekSlider) {
        this.spotifySeekSlider.addEventListener('input', (e) => {
          const val = Math.max(0, Math.min(1000, Number(e.target.value) || 0));
          this.tiktokRadio.seekToRatio(val / 1000);
          this._syncSpotifyTimeBar();
        });
      }

      if (this.tiktokVolSlider) {
        this.tiktokVolSlider.addEventListener('input', (e) => {
          const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
          this.tiktokRadio.setVolume(pct / 100);
        });
      }

      this.tiktokImportBtn?.addEventListener('click', () => {
        if (this.tiktokFileInput) {
          this.tiktokFileInput.value = '';
          this.tiktokFileInput.click?.();
        }
      });

      this.tiktokFileInput?.addEventListener('change', (e) => {
        const files = e.target?.files;
        if (files && files.length > 0) {
          this.tiktokRadio.importLocalAudioFiles(files);
        }
      });

      this.refreshTikTokRadioUI();
    },

    _syncSpotifyTimeBar() {
      if (!this.tiktokRadio) return;
      const info = this.tiktokRadio.getPlaybackTimeInfo();
      if (this.spotifyTimeCurEl) {
        this.spotifyTimeCurEl.textContent = this._formatRadioTime(info.currentSec);
      }
      if (this.spotifyTimeDurEl) {
        this.spotifyTimeDurEl.textContent = this._formatRadioTime(info.durationSec);
      }
      if (this.spotifySeekSlider) {
        this.spotifySeekSlider.value = String(Math.round((info.ratio || 0) * 1000));
      }
    },

    _setMarqueeText(el, text, charThreshold = 20, forceScroll = false) {
      if (!el) return;
      const raw = String(text || '');
      const shouldScroll = Boolean(raw) && (forceScroll || raw.length > charThreshold);
      const cacheKey = `${raw}::${shouldScroll ? 1 : 0}`;
      if (el._lastMarqueeKey === cacheKey) return;
      el._lastMarqueeKey = cacheKey;

      if (!shouldScroll) {
        el.classList.remove('is-scrolling');
        el.textContent = raw;
        if (raw && typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            if (el._lastMarqueeKey !== cacheKey) return;
            if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4) {
              el._lastMarqueeKey = '';
              this._setMarqueeText(el, raw, 0, true);
            }
          });
        }
        return;
      }

      const escaped = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const durSec = Math.max(7.5, Math.min(22, raw.length * 0.28)).toFixed(1);
      el.classList.add('is-scrolling');
      el.innerHTML = `<span class="spotify-marquee-track" data-marquee="${escaped}" style="--marquee-dur:${durSec}s"><span class="spotify-marquee-copy">${escaped}</span></span>`;
    },

    setTikTokRadioOpen(open, controller = null) {
      if (open && (this.isCreatorOpen || this.isCustomsOpen || this.isTitleScreenActive)) return;
      if (controller) {
        this._lastController = controller;
      }
      this.isTikTokRadioOpen = Boolean(open);
      document.body?.classList.toggle('tiktok-radio-open', this.isTikTokRadioOpen);
      if (this.tiktokModalEl) {
        this.tiktokModalEl.classList.toggle('hidden', !this.isTikTokRadioOpen);
      }

      if (this.isTikTokRadioOpen) {
        this._lastController?.resetHeldInputs?.();
        if (this.isFullMapOpen) this.setFullMapOpen(false);
        if (this.isDossierOpen) this.setHeroDossierOpen(false);
        if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
        const promptEl = document.getElementById('pointer-prompt');
        if (promptEl) promptEl.classList.remove('visible');
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
        this.refreshTikTokRadioUI();
      } else if (this._lastController && typeof this._lastController.relockPointer === 'function') {
        this._lastController.relockPointer();
      }
    },

    toggleTikTokRadioModal(controller = null) {
      this.setTikTokRadioOpen(!this.isTikTokRadioOpen, controller);
    },

    showTikTokRadioToast(track = this.tiktokRadio?.currentTrack) {
      if (!this.tiktokToastEl || !track) return;
      if (this.tiktokToastTitleEl) {
        this.tiktokToastTitleEl.textContent = `${track.title} (${track.bpm} BPM)`;
      }
      this.tiktokToastEl.classList.remove('hidden');
      if (this._tiktokToastTimeout) clearTimeout(this._tiktokToastTimeout);
      this._tiktokToastTimeout = setTimeout(() => {
        this.tiktokToastEl?.classList.add('hidden');
      }, 3200);
      if (typeof this._tiktokToastTimeout?.unref === 'function') {
        this._tiktokToastTimeout.unref();
      }
    },

    refreshTikTokRadioUI() {
      if (!this.tiktokRadio) return;
      const svgs = this._getSpotifySvgs();
      const track = this.tiktokRadio.currentTrack;
      const playing = this.tiktokRadio.isPlaying;
      const totalCount = this.tiktokRadio.tracks.length;
      const coverUrl = track ? getTrackCoverUrl(track) : getTrackCoverUrl({ id: 'empty', title: 'VAZIO', color: '#334155', bpm: 0, style: 'SEM FAIXAS' });

      // Filtros da Sidebar
      this.spotifyFilterAllBtn?.classList.toggle('active', this.spotifyFilterMode === 'all');
      this.spotifyFilterLikedBtn?.classList.toggle('active', this.spotifyFilterMode === 'liked');
      this.spotifyFilterCustomBtn?.classList.toggle('active', this.spotifyFilterMode === 'custom');

      // Capas sincronizadas (Sidebar 136x136, Banner Hero 112x112 e Player Inferior 56x56)
      if (this.spotifyFeaturedCoverImg) this.spotifyFeaturedCoverImg.src = coverUrl;
      if (this.spotifyHeroCoverImg) this.spotifyHeroCoverImg.src = coverUrl;
      if (this.spotifyBottomCoverImg) this.spotifyBottomCoverImg.src = coverUrl;

      if (this.spotifyHeroBannerEl) {
        const accent = track?.color || '#1ed760';
        this.spotifyHeroBannerEl.style.background = `linear-gradient(180deg, ${accent}47 0%, rgba(18, 18, 18, 0.95) 85%, #121212 100%)`;
      }
      if (this.spotifyCountBadgeEl) {
        this.spotifyCountBadgeEl.textContent = `${totalCount} ${totalCount === 1 ? 'música na playlist' : 'músicas na playlist'}`;
      }

      if (this.tiktokNowTitleEl) {
        this._setMarqueeText(
          this.tiktokNowTitleEl,
          track ? track.title : 'Playlist vazia — Adicione ou restaure músicas',
          26
        );
      }
      if (this.tiktokNowMetaEl) {
        this.tiktokNowMetaEl.textContent = track
          ? `${track.artist} • ${track.bpm} BPM • ${track.style}`
          : 'Use os botões da barra esquerda para importar MP3 ou restaurar as 8 originais';
      }
      if (this.tiktokNowStatusEl) {
        this.tiktokNowStatusEl.innerHTML =
          playing && track
            ? `${svgs.speakerSmall} <span>Tocando Agora</span>`
            : `${svgs.pauseSmall} <span>Pausado</span>`;
        this.tiktokNowStatusEl.classList.toggle('playing', Boolean(playing && track));
      }

      if (this.spotifyBottomTitleEl) {
        this._setMarqueeText(
          this.spotifyBottomTitleEl,
          track ? track.title : 'Nenhuma música selecionada',
          18
        );
      }
      if (this.spotifyBottomArtistEl) {
        this.spotifyBottomArtistEl.textContent = track ? track.artist : 'Spotify // [P]';
      }
      if (this.spotifyLikeCurrentBtn) {
        const isLiked = Boolean(track?.liked);
        this.spotifyLikeCurrentBtn.classList.toggle('liked', isLiked);
        this.spotifyLikeCurrentBtn.innerHTML = isLiked ? svgs.heartFilled : svgs.heartOutline;
      }

      if (this.tiktokPlayPauseBtn) {
        this.tiktokPlayPauseBtn.innerHTML = playing ? svgs.pause : svgs.play;
      }
      if (this.tiktokShuffleBtn) {
        this.tiktokShuffleBtn.classList.toggle('active', Boolean(this.tiktokRadio.isShuffle));
      }
      if (this.spotifyRepeatBtn) {
        this.spotifyRepeatBtn.classList.toggle('active', Boolean(this.tiktokRadio.isRepeatOne));
      }
      if (this.tiktokBassBoostBtn) {
        const bb = this.tiktokRadio.isBassBoostActive;
        this.tiktokBassBoostBtn.classList.toggle('active', bb);
        this.tiktokBassBoostBtn.innerHTML = `${svgs.bassWave} <span>Bass +6dB: ${bb ? 'ON' : 'OFF'}</span>`;
      }
      if (this.tiktokVolValEl) {
        this.tiktokVolValEl.textContent = `${Math.round(this.tiktokRadio.volume * 100)}%`;
      }
      if (this.tiktokVolSlider) {
        this.tiktokVolSlider.value = String(Math.round(this.tiktokRadio.volume * 100));
      }
      const isHudPlaying = Boolean(playing && track);
      if (this.tiktokHudPillEl) {
        this.tiktokHudPillEl.classList.toggle('playing', isHudPlaying);
      }
      if (this.hudSpotifyDiscImg) {
        if (isHudPlaying && this.hudSpotifyDiscImg._lastSrc !== coverUrl) {
          this.hudSpotifyDiscImg._lastSrc = coverUrl;
          this.hudSpotifyDiscImg.src = coverUrl;
        }
      }
      if (this.hudSpotifyMarqueeTitleEl) {
        if (isHudPlaying) {
          this._setMarqueeText(this.hudSpotifyMarqueeTitleEl, track.title, 0, true);
        } else {
          this._setMarqueeText(this.hudSpotifyMarqueeTitleEl, '', 999, false);
        }
      }

      this._syncSpotifyTimeBar();

      if (this.tiktokTrackListEl) {
        const q = this.spotifySearchQuery || '';
        const filtered = this.tiktokRadio.tracks
          .map((t, idx) => ({ t, idx }))
          .filter(({ t }) => {
            if (this.spotifyFilterMode === 'liked' && !t.liked) return false;
            if (this.spotifyFilterMode === 'custom' && !t.isCustomFile) return false;
            if (q) {
              const hay = `${t.title} ${t.artist} ${t.style}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          });

        if (filtered.length === 0) {
          const emptyMsg =
            totalCount === 0
              ? 'Sua playlist está vazia! Você removeu todas as músicas.'
              : this.spotifyFilterMode === 'liked'
                ? 'Você ainda não curtiu nenhuma música.'
                : this.spotifyFilterMode === 'custom'
                  ? 'Você ainda não importou nenhum arquivo MP3 do seu PC.'
                  : 'Nenhuma música encontrada para essa busca.';
          this.tiktokTrackListEl.innerHTML = `
            <div class="spotify-empty-state">
              <div class="spotify-empty-title">${svgs.musicNote} <span>${emptyMsg}</span></div>
              <div class="spotify-empty-actions">
                <button type="button" class="spotify-action-btn primary" data-spotify-empty-action="import">
                  ${svgs.plus}
                  <span>Adicionar Música (MP3)</span>
                </button>
                <button type="button" class="spotify-action-btn secondary" data-spotify-empty-action="restore">
                  ${svgs.refresh}
                  <span>Restaurar 8 Originais</span>
                </button>
              </div>
            </div>
          `;
          this.tiktokTrackListEl.querySelectorAll('button[data-spotify-empty-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const act = btn.dataset.spotifyEmptyAction;
              if (act === 'import') {
                this.tiktokFileInput?.click?.();
              } else if (act === 'restore') {
                this.spotifyFilterMode = 'all';
                this.tiktokRadio.restoreDefaultTracks();
              }
            });
          });
          return;
        }

        this.tiktokTrackListEl.innerHTML = filtered
          .map(({ t, idx }) => {
            const isCurrent = idx === this.tiktokRadio.currentTrackIndex;
            const rowCover = getTrackCoverUrl(t);
            const numDisplay = isCurrent && playing ? svgs.speakerSmall : String(idx + 1).padStart(2, '0');
            return `
              <div class="spotify-track-row tiktok-track-item ${isCurrent ? 'active' : ''}" data-track-idx="${idx}" data-track-id="${t.id}">
                <span class="spotify-row-num">${numDisplay}</span>
                <div class="spotify-row-main">
                  <img class="spotify-row-cover" src="${rowCover}" alt="Capa" />
                  <div class="spotify-row-text">
                    <span class="spotify-row-title">${t.title}</span>
                    <span class="spotify-row-artist">${t.artist}</span>
                  </div>
                </div>
                <span class="spotify-row-badge">${t.bpm} BPM • ${t.style}</span>
                <div class="spotify-row-actions">
                  <button type="button" class="spotify-row-action-btn ${t.liked ? 'liked' : ''}" data-like-track-id="${t.id}" title="Curtir / Favoritar">
                    ${t.liked ? svgs.heartFilled : svgs.heartOutline}
                  </button>
                  <button type="button" class="spotify-row-action-btn photo-btn" data-cover-track-id="${t.id}" title="Escolher Foto de Capa">
                    ${svgs.camera}
                    <span>Foto</span>
                  </button>
                  <button type="button" class="spotify-row-action-btn delete-btn" data-remove-track-id="${t.id}" title="Remover Música da Playlist">
                    ${svgs.trash}
                  </button>
                </div>
              </div>
            `;
          })
          .join('');

        // Clique na linha toca a música
        this.tiktokTrackListEl.querySelectorAll('.spotify-track-row[data-track-idx]').forEach((row) => {
          row.addEventListener('click', (e) => {
            if (e.target && typeof e.target.closest === 'function' && e.target.closest('.spotify-row-actions')) {
              return;
            }
            const idx = Number(row.dataset.trackIdx);
            this.tiktokRadio.playTrack(idx, false);
          });
        });

        // Botão Curtir na linha
        this.tiktokTrackListEl.querySelectorAll('button[data-like-track-id]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.tiktokRadio.toggleLikeTrack(btn.dataset.likeTrackId);
          });
        });

        // Botão Escolher Foto de Capa na linha
        this.tiktokTrackListEl.querySelectorAll('button[data-cover-track-id]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._pendingCoverTrackId = btn.dataset.coverTrackId;
            if (this.spotifyCoverInput) {
              this.spotifyCoverInput.value = '';
              this.spotifyCoverInput.click?.();
            }
          });
        });

        // Botão Remover Música na linha
        this.tiktokTrackListEl.querySelectorAll('button[data-remove-track-id]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.tiktokRadio.removeTrack(btn.dataset.removeTrackId);
          });
        });
      }
    }
  });
}
