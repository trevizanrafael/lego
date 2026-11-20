import { soundFX } from '../../audio/SoundFX.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export function installOperatorCombatAndVehicleHud(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initHearts() {
      if (!this.heartsContainer) return;
      this.heartsContainer.innerHTML = '';
      for (let i = 0; i < this.maxHearts; i++) {
        const heart = document.createElement('div');
        heart.className = 'lego-heart active';
        heart.innerHTML = `
          <svg viewBox="0 0 32 30" width="23" height="22">
            <polygon points="16,28 3,15 3,7 8,2 13,2 16,6 19,2 24,2 29,7 29,15"
              fill="#ef4444" stroke="#090a0d" stroke-width="2.6" stroke-linejoin="miter"/>
            <polygon points="8,5 12,5 14,8 6,12 6,7" fill="rgba(255,255,255,0.45)"/>
          </svg>
        `;
        this.heartsContainer.appendChild(heart);
      }
    },

    setHearts(activeCount) {
      const clamped = Math.max(0, Math.min(this.maxHearts, Math.round(activeCount)));
      if (this._lastRenderedHearts === clamped) {
        this.hearts = clamped;
        return;
      }
      this.hearts = clamped;
      this._lastRenderedHearts = clamped;
      if (typeof this.heartsContainer?.querySelectorAll !== 'function') return;
      const nodes = this.heartsContainer.querySelectorAll('.lego-heart');
      nodes.forEach((node, idx) => {
        node.classList.toggle('active', idx < this.hearts);
      });
    },

    /**
     * Atualiza a vida do jogador (250 HP) exclusivamente nos 4 Corações LEGO Clássicos
     */
    setPlayerHealth(hp, maxHp = 250, isHealing = false) {
      this.playerMaxHp = Math.max(1, maxHp);
      this.playerHp = Math.max(0, Math.min(this.playerMaxHp, Math.round(hp)));

      const ratio = this.playerHp / this.playerMaxHp;
      const pctStr = `${(ratio * 100).toFixed(1)}%`;
      if (this.hpBarFillEl && this._lastHpPctStr !== pctStr) {
        this._lastHpPctStr = pctStr;
        this.hpBarFillEl.style.width = pctStr;
        if (this.hpGhostFillEl) {
          this.hpGhostFillEl.style.width = pctStr;
        }
      }
      const hpTxt = `${this.playerHp}/${this.playerMaxHp}`;
      if (this.hpBarTextEl && this._lastHpTxt !== hpTxt) {
        this._lastHpTxt = hpTxt;
        this.hpBarTextEl.textContent = hpTxt;
      }
      if (this.hpBarWrapEl) {
        this.hpBarWrapEl.classList.toggle('critical-hp', ratio > 0 && ratio <= 0.3);
        this.hpBarWrapEl.classList.toggle('healing-hp', Boolean(isHealing));
      }

      const activeHearts =
        this.playerHp <= 0
          ? 0
          : Math.max(0, Math.min(4, Math.ceil(ratio * 4)));
      this.setHearts(activeHearts);

      const bHealing = Boolean(isHealing);
      if (this.heartsContainer && this._lastHealingPulse !== bHealing) {
        this._lastHealingPulse = bHealing;
        this.heartsContainer.classList.toggle('healing-pulse', bHealing);
      }
    },

    _initSpeedometerBars() {
      if (!this.speedoBarsEl) return;
      this.speedoBarsEl.innerHTML = '';
      this._speedoBarNodes = [];
      for (let i = 0; i < 14; i++) {
        const bar = document.createElement('div');
        bar.className = 'speedo-bar-seg';
        this.speedoBarsEl.appendChild(bar);
        this._speedoBarNodes.push(bar);
      }
    },

    /**
     * Atualiza o Scroll de Silhuetas Estilo CS no canto superior direito para o Vingador de Chumbo (OP-04)
     */
    updateVingadorWeaponHud(activeWeapon = this.currentVingadorWeapon, isFurorActive = this.isVingadorFuror) {
      this.currentVingadorWeapon = activeWeapon || 'dual_smg';
      this.isVingadorFuror = Boolean(isFurorActive);
      if (!this.vingadorWeaponHudEl) return;

      const shouldShow = this.currentHeroKey === 'vingador' && !this._isDrivingVehicle;
      this.vingadorWeaponHudEl.classList.toggle('hidden', !shouldShow);
      if (!shouldShow) return;

      this.vingadorWeaponHudEl.classList.toggle('furor-active', this.isVingadorFuror);

      const order = ['dual_smg', 'shotgun', 'rpg'];
      const activeIdx = Math.max(0, order.indexOf(this.currentVingadorWeapon));
      const prevWeapon = order[(activeIdx + order.length - 1) % order.length];
      const nextWeapon = order[(activeIdx + 1) % order.length];

      for (const slotEl of this.vingadorSlotEls) {
        const wKey = slotEl.dataset.weapon;
        slotEl.classList.remove('slot-prev', 'slot-active', 'slot-next');
        if (wKey === this.currentVingadorWeapon) {
          slotEl.classList.add('slot-active');
        } else if (wKey === prevWeapon) {
          slotEl.classList.add('slot-prev');
        } else if (wKey === nextWeapon) {
          slotEl.classList.add('slot-next');
        }
      }
    },

    /**
     * Atualiza o Velocímetro Estilizado IDV no canto superior direito (visível apenas quando em um veículo)
     */
    updateVehicleSpeedometer(vehicleObj, rawSpeed = 0, verticalSpeed = 0, isTurbo = false, isDrifting = false) {
      const wasDriving = this._isDrivingVehicle;
      this._isDrivingVehicle = Boolean(vehicleObj);
      if (wasDriving !== this._isDrivingVehicle) {
        this.updateVingadorWeaponHud();
      }

      if (!this.speedoContainerEl) return;

      if (!vehicleObj) {
        if (this._lastSpeedoHidden !== true) {
          this._lastSpeedoHidden = true;
          this.speedoContainerEl.classList.add('hidden');
        }
        return;
      }

      if (this._lastSpeedoHidden !== false) {
        this._lastSpeedoHidden = false;
        this.speedoContainerEl.classList.remove('hidden');
      }
      const bTurbo = Boolean(isTurbo);
      const bDrift = Boolean(isDrifting);
      if (this._lastSpeedoTurbo !== bTurbo) {
        this._lastSpeedoTurbo = bTurbo;
        this.speedoContainerEl.classList.toggle('turbo-active', bTurbo);
      }
      if (this._lastSpeedoDrift !== bDrift) {
        this._lastSpeedoDrift = bDrift;
        this.speedoContainerEl.classList.toggle('drift-active', bDrift);
      }

      const carName = (vehicleObj.mesh?.userData?.carName || 'VEÍCULO TÁTICO').toUpperCase();
      const spec = vehicleObj.mesh?.userData?.vehicleSpec || {};
      const category = spec.category || 'car';

      const totalSpeed = Math.hypot(rawSpeed, verticalSpeed || 0);
      const kmh = Math.round(totalSpeed * (45 / 14));
      const maxKmh = spec.kmh || 140;

      if (this.speedoNameEl && this._lastSpeedoName !== carName) {
        this._lastSpeedoName = carName;
        this.speedoNameEl.textContent = carName;
      }
      if (this.speedoKmhEl && this._lastSpeedoKmh !== kmh) {
        this._lastSpeedoKmh = kmh;
        this.speedoKmhEl.textContent = String(kmh).padStart(3, '0');
      }

      if (this.speedoGearEl) {
        let gear = 'N';
        if (category === 'helicopter' || category === 'plane') {
          gear = 'AIR';
        } else if (category === 'boat') {
          gear = rawSpeed < -0.5 ? 'R' : kmh > 2 ? 'NAV' : 'N';
        } else if (rawSpeed < -0.5) {
          gear = 'R';
        } else if (kmh > 1) {
          const gearNum = Math.min(6, Math.max(1, Math.ceil((kmh / maxKmh) * 6)));
          gear = `D${gearNum}`;
        }
        if (this._lastSpeedoGear !== gear) {
          this._lastSpeedoGear = gear;
          this.speedoGearEl.textContent = gear;
        }
      }

      if (this.speedoModeEl) {
        let modeText = 'TRAÇÃO URBANA';
        if (bTurbo) {
          modeText = 'NITRO // ATIVO';
        } else if (bDrift) {
          modeText = 'DRIFT // TÁTICO';
        } else if (category === 'helicopter' || category === 'plane') {
          modeText = 'PROPULSÃO AÉREA';
        } else if (category === 'boat') {
          modeText = 'PROPULSÃO NAVAL';
        }
        if (this._lastSpeedoMode !== modeText) {
          this._lastSpeedoMode = modeText;
          this.speedoModeEl.textContent = modeText;
        }
      }

      if (this._speedoBarNodes.length > 0) {
        const ratio = Math.min(1, kmh / Math.max(60, maxKmh));
        const litCount = kmh > 1 ? Math.max(1, Math.round(ratio * this._speedoBarNodes.length)) : 0;
        if (this._lastSpeedoLitCount !== litCount) {
          this._lastSpeedoLitCount = litCount;
          this._speedoBarNodes.forEach((bar, idx) => {
            const active = idx < litCount;
            bar.classList.toggle('lit', active);
            bar.classList.toggle('high', active && idx >= 9 && idx < 12);
            bar.classList.toggle('redline', active && idx >= 12);
          });
        }
      }
    },

    addStuds(amount, colorName = 'silver') {
      this.totalStuds += amount;

      if (this.studCoinEl) {
        this.studCoinEl.dataset.tier = colorName;
        this.studCoinEl.classList.remove('pop');
        void this.studCoinEl.offsetWidth;
        this.studCoinEl.classList.add('pop');
      }

      if (this.studGainEl) {
        this.studGainEl.textContent = `+${amount.toLocaleString('pt-BR')}`;
        this.studGainEl.dataset.tier = colorName;
        this.studGainEl.classList.add('show');
        clearTimeout(this._gainTimeout);
        this._gainTimeout = setTimeout(() => {
          this.studGainEl.classList.remove('show');
        }, 1100);
      }
    },

    /** Blocos Dourados (recompensa dos grandes eventos) */
    addGoldenBrick(amount = 1) {
      this.goldenBricks = (this.goldenBricks || 0) + amount;
      soundFX.playTrueHeroFanfare();
      this.showWantedBanner('BLOCO DOURADO +' + amount, `TOTAL: ${this.goldenBricks}`, 'escaped', 3200);
      this.saveCurrentProgress();
    },

    showRegionTransitionToast(region) {
      if (!this.regionToastEl) return;
      if (!this.settings?.showRegionToast || this.isTitleScreenActive || this.isLoadingActive) {
        this.regionToastEl.classList.add('hidden');
        return;
      }
      if (!region) return;

      if (this.regionToastCodeEl) this.regionToastCodeEl.textContent = `SETOR ${region.code || 'R-01'}`;
      if (this.regionToastTitleEl) this.regionToastTitleEl.textContent = region.name || '';
      if (this.regionToastSubEl) this.regionToastSubEl.textContent = region.subtitle || '';

      this.regionToastEl.classList.remove('hidden');
      if (this._toastTimeout) clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        this.regionToastEl?.classList.add('hidden');
      }, 2600);
    },

    /**
     * Atualiza o Painel de Estrelas de Procurado LEGO (0★ = 100% oculto; 1–5★ = Dourado/Piscante; Fuga = Piscando Azul/Cinza)
     */
    updateWantedHud(stars = 0, isEscaping = false, escapeTimer = 0, escapeDuration = 18.0, tierInfo = null) {
      this.wantedStars = Math.max(0, Math.min(5, Math.floor(stars)));
      this.wantedIsEscaping = Boolean(isEscaping && this.wantedStars > 0);

      if (!this.wantedPanelEl) return;

      if (this.wantedStars <= 0) {
        if (this._lastWantedStars !== 0) {
          this._lastWantedStars = 0;
          this._lastWantedEscaping = false;
          this._lastWantedStatusText = '';
          this.wantedPanelEl.classList.add('hidden');
          this.wantedPanelEl.classList.remove('escaping-mode', 'antihero-mode');
        }
        return;
      }

      if (
        this._lastWantedStars !== this.wantedStars ||
        this._lastWantedEscaping !== this.wantedIsEscaping
      ) {
        this._lastWantedStars = this.wantedStars;
        this._lastWantedEscaping = this.wantedIsEscaping;
        this.wantedPanelEl.classList.remove('hidden');
        this.wantedPanelEl.classList.toggle('escaping-mode', this.wantedIsEscaping);
        this.wantedPanelEl.classList.toggle(
          'antihero-mode',
          this.wantedStars >= 5 && !this.wantedIsEscaping
        );

        if (this.wantedStarNodes.length > 0) {
          this.wantedStarNodes.forEach((node, idx) => {
            node.classList.toggle('active', idx < this.wantedStars);
          });
        }
        if (this.wantedEscapeWrapEl) {
          this.wantedEscapeWrapEl.classList.toggle('hidden', !this.wantedIsEscaping);
        }
      }

      if (this.wantedStatusTagEl) {
        const statusText = this.wantedIsEscaping
          ? 'DESPISTANDO... // SEM VISÃO'
          : this.wantedStars >= 5
            ? '5★ // CAÇADORES ANTI-HERÓI'
            : `PROCURADO // ${tierInfo?.label || 'CERCO POLICIAL'}`;
        if (this._lastWantedStatusText !== statusText) {
          this._lastWantedStatusText = statusText;
          this.wantedStatusTagEl.textContent = statusText;
        }
      }

      if (this.wantedEscapeWrapEl && this.wantedIsEscaping) {
        const pct = Math.max(0, Math.min(100, (escapeTimer / Math.max(1, escapeDuration)) * 100));
        const pctStr = `${pct.toFixed(1)}%`;
        const remSec = `${Math.max(1, Math.ceil(escapeDuration - escapeTimer))}s`;
        if (this.wantedEscapeFillEl && this._lastWantedPctStr !== pctStr) {
          this._lastWantedPctStr = pctStr;
          this.wantedEscapeFillEl.style.width = pctStr;
        }
        if (this.wantedEscapeSecEl && this._lastWantedRemSec !== remSec) {
          this._lastWantedRemSec = remSec;
          this.wantedEscapeSecEl.textContent = remSec;
        }
      }
    },

    showWantedBanner(title, subtitle = '', variant = 'pursuit', durationMs = 3100) {
      if (!this.wantedBannerEl) return;
      if (this.isTitleScreenActive || this.isLoadingActive) return;

      this.wantedBannerEl.dataset.variant = variant;
      if (this.wantedBannerTitleEl) this.wantedBannerTitleEl.textContent = title || '';
      if (this.wantedBannerSubEl) this.wantedBannerSubEl.textContent = subtitle || '';
      this.wantedBannerEl.classList.remove('hidden');

      if (this._wantedBannerTimeout) clearTimeout(this._wantedBannerTimeout);
      this._wantedBannerTimeout = setTimeout(() => {
        this.wantedBannerEl?.classList.add('hidden');
      }, durationMs);
      if (typeof this._wantedBannerTimeout?.unref === 'function') {
        this._wantedBannerTimeout.unref();
      }
    },

    /**
     * Desativado no Modo Livre para manter a tela limpa sem alertas de guerra.
     */
    showTacticalAlertToast(_code, _title, _subtitle = '', _accentColor = '#facc15', _icon = 'emergency', _durationMs = 3800) {
      return;
    },

    /**
     * Mantido como no-op para manter a tela limpa sem painéis de ameaça/boss no topo
     */
    updateWorldWarHud() {}
  });
}
