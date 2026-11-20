import {
  getHeroInfo,
  syncOp09CatalogSlot,
  drawHeroLegoPortrait,
  renderHeroDossierModal
} from '../HeroWheelAndDossier.js';
import { FACTION_DATA } from '../FactionIconsAndSaveSystem.js';

export const HERO_HUD_THEMES = {
  caveira: { accent: '#d99b16', chips: [['M1', 'FUZIL'], ['M2', 'GRANADA'], ['Q', 'ROLAR'], ['E', 'VEÍCULO']] },
  solaris: { accent: '#ea580c', chips: [['M1', 'ORBES'], ['M2', 'RAIO'], ['Q', 'SUPERNOVA'], ['ESP', 'VOAR']] },
  tita: { accent: '#64748b', chips: [['M1', 'MINIGUN'], ['M2', 'DASH'], ['Q', 'SISMO'], ['F', 'AGARRAR']] },
  vingador: { accent: '#b91c1c', chips: [['M1', 'DISPARO'], ['R', 'ARMA'], ['Q', 'FUROR'], ['E', 'VEÍCULO']] },
  sombra: { accent: '#dc2626', chips: [['M1', 'KATANAS'], ['M2', 'GANCHO'], ['Q', 'FUMAÇA'], ['C', 'ROLAR']] },
  turbo: { accent: '#06b6d4', chips: [['M1', 'CORRENTE'], ['F', 'MOTO'], ['Q', 'MURALHA'], ['SHIFT', 'DRIFT']] },
  voltaico: { accent: '#38bdf8', chips: [['M1', 'RAIOS'], ['F', 'BLINK'], ['Q', 'EMP'], ['E', 'VEÍCULO']] },
  vortex: { accent: '#9333ea', chips: [['M1', 'TENTÁCULO'], ['F', 'COLOSSO'], ['Q', 'ERUPÇÃO'], ['V', 'GOLPE']] },
  op09: { accent: '#22c55e', chips: [['M1', 'ATAQUE'], ['F', 'MOBIL.'], ['Q', 'ULTIMATE'], ['H', 'FICHA']] }
};

/**
 * Anexa métodos ao protótipo preservando `enumerable: false` igual a métodos nativos de classe ES6.
 */
export function definePrototypeMethods(TargetClass, methodsObj) {
  const descriptors = Object.getOwnPropertyDescriptors(methodsObj);
  for (const [key, desc] of Object.entries(descriptors)) {
    Object.defineProperty(TargetClass.prototype, key, {
      ...desc,
      enumerable: false
    });
  }
}

export function installHudConstantsAndPortraits(LegoHud) {
  definePrototypeMethods(LegoHud, {
    syncOp09UI() {
      const info = syncOp09CatalogSlot();
      if (this.currentHeroKey === 'op09') {
        this.setCharacterPortrait('op09', info.name);
      }
    },

    setCharacterPortrait(presetKey, displayName) {
      this.currentHeroKey = presetKey;
      const info = getHeroInfo(presetKey);
      const theme = HERO_HUD_THEMES[presetKey] || HERO_HUD_THEMES.caveira;
      if (this.operatorChassisEl?.style?.setProperty) {
        this.operatorChassisEl.style.setProperty('--hero-accent', theme.accent);
      }
      if (this.abilityStripEl) {
        this.abilityStripEl.innerHTML = theme.chips
          .map(([k, lbl]) => `<span class="ability-chip"><b>${k}</b> ${lbl}</span>`)
          .join('');
      }
      if (this.charNameEl) {
        this.charNameEl.textContent = (displayName || info.name).toUpperCase();
      }
      if (this.opTagEl) {
        this.opTagEl.textContent = info.opCode;
      }
      if (this.crosshairEl) {
        this.crosshairEl.dataset.hero = presetKey;
      }
      if (this.portraitCanvas) {
        const ctx = this.portraitCanvas.getContext('2d');
        drawHeroLegoPortrait(ctx, this.portraitCanvas.width, this.portraitCanvas.height, presetKey);
      }
      this.updateVingadorWeaponHud();
      if (this.isDossierOpen) {
        renderHeroDossierModal(this, presetKey);
      }
    },

    /**
     * Abre/Fecha a Ficha Tática Individual [H] do personagem que o jogador está usando
     */
    setHeroDossierOpen(open, controller = null) {
      if (open && (this.isCreatorOpen || this.isCustomsOpen)) return;
      if (controller) {
        this._lastController = controller;
      }
      this.isDossierOpen = Boolean(open);
      if (this.dossierModalEl) {
        this.dossierModalEl.classList.toggle('hidden', !this.isDossierOpen);
      }
      if (this.isDossierOpen) {
        this._lastController?.resetHeldInputs?.();
        if (this.isFullMapOpen) this.setFullMapOpen(false);
        if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
        if (this.isTikTokRadioOpen) this.setTikTokRadioOpen(false);
        const activeKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira';
        renderHeroDossierModal(this, activeKey);
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
      } else if (this._lastController && typeof this._lastController.relockPointer === 'function') {
        this._lastController.relockPointer();
      }
    },

    toggleHeroDossier(controller = null) {
      this.setHeroDossierOpen(!this.isDossierOpen, controller);
    },

    setPlayerFaction(factionKey = 'cv', notifyWorld = true, conqueredTerritories = null) {
      const fData = FACTION_DATA[factionKey] || FACTION_DATA.cv;
      this.playerFaction = fData.id;
      if (notifyWorld && typeof this.onSelectFaction === 'function' && !this._isSyncingFaction) {
        this._isSyncingFaction = true;
        try {
          this.onSelectFaction(fData.id, conqueredTerritories);
        } finally {
          this._isSyncingFaction = false;
        }
      }
    },

    /**
     * Constrói o Cenário Panorâmico Ilustrado da Favela LEGO (Cidade de Deus) em 3 Camadas Parallax
     * para rodar leve a 60 FPS no fundo da Tela Inicial sem usar o motor 3D no fundo!
     */
    _initFavelaBackgroundCanvas() {
      this._favelaTime = 0;
      this._titleMouseX = 0;
      this._titleMouseY = 0;

      window.addEventListener('mousemove', (e) => {
        if (!this.isTitleScreenActive) return;
        this._titleMouseX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
        this._titleMouseY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      });

      // Arranha-céus Art-Deco / Brutalistas de fundo (silhueta sombria estilo Gotham)
      this._gothamSpires = Array.from({ length: 18 }, (_, i) => ({
        u: 0.04 + (i / 18) * 0.96,
        w: 0.036 + ((i * 13) % 5) * 0.011,
        h: 0.34 + ((i * 29) % 7) * 0.055,
        hasSpire: i % 3 === 0,
        hasCrown: i % 2 === 0,
        seed: i * 31
      }));

      // Camadas densas sombrias do morro (sem pinos de brinquedo, tons queimados/chumbo)
      const darkUrbanPalette = [
        '#1a1d26',
        '#241816',
        '#2d1817',
        '#141b29',
        '#26221d',
        '#17211c',
        '#1e2430',
        '#331915'
      ];

      this._favelaLayers = [0, 1, 2].map((layerIdx) => {
        const count = layerIdx === 0 ? 36 : layerIdx === 1 ? 46 : 40;
        const houses = [];
        for (let i = 0; i < count; i++) {
          const u = i / count;
          const hillCurve =
            Math.sin(u * Math.PI) * 0.19 +
            Math.cos((u - 0.62) * Math.PI * 2.1) * 0.08 +
            (layerIdx === 0 ? 0.30 : layerIdx === 1 ? 0.19 : 0.09);
          const w = 0.030 + ((i * 17) % 5) * 0.008;
          const h = 0.055 + ((i * 23) % 6) * 0.020;
          const color =
            layerIdx === 0
              ? '#0a0d14'
              : darkUrbanPalette[(i * 7 + layerIdx * 3) % darkUrbanPalette.length];
          const hasAntenna = layerIdx > 0 && (i * 5) % 3 === 0;
          const hasSlopedRoof = (i + layerIdx) % 2 === 0;
          const winRows = 2 + (i % 3);
          const winCols = 2 + ((i + 1) % 2);
          houses.push({
            u: u - 0.04 + ((i * 13) % 7) * 0.003,
            hillCurve,
            w,
            h,
            color,
            hasAntenna,
            hasSlopedRoof,
            winRows,
            winCols,
            seed: i * 19 + layerIdx * 101
          });
        }
        return {
          parallax: (layerIdx + 1) * 14,
          houses
        };
      });

      // Chuva diagonal densa cortando a noite + fagulhas baixas de sódio/sangue
      this._rainDrops = Array.from({ length: 190 }, (_, i) => ({
        x: ((i * 61) % 100) / 100,
        y: ((i * 37) % 100) / 100,
        len: 14 + (i % 5) * 7,
        spd: 0.75 + (i % 4) * 0.22,
        alpha: 0.10 + (i % 4) * 0.045
      }));

      this._favelaEmbers = Array.from({ length: 28 }, (_, i) => ({
        x: ((i * 53) % 100) / 100,
        y: ((i * 29) % 100) / 100,
        spdY: 0.025 + (i % 5) * 0.01,
        spdX: ((i % 3) - 1) * 0.012,
        size: 1.5 + (i % 2.5),
        color: i % 2 === 0 ? '#d99b16' : '#b91c1c'
      }));

      this._renderFavelaBackgroundCanvas(0.016);
    },

    _renderFavelaBackgroundCanvas(dt = 0.016) {
      const canvas = this.favelaCanvasEl;
      if (!canvas) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      this._favelaTime += dt;
      const t = this._favelaTime;
      const px = this._titleMouseX;
      const py = this._titleMouseY;

      // Clarão esporádico de relâmpago nas nuvens carregadas de tempestade
      const lightningWave = Math.sin(t * 0.85) * Math.sin(t * 2.35 + 1.2);
      const flash = lightningWave > 0.90 ? (lightningWave - 0.90) * 6.5 : 0;

      // 1. Céu Tempestuoso de Gotham (Chumbo / Azul-Abissal / Bruma Rubra no Horizonte)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0.0, flash > 0.1 ? '#182232' : '#030509');
      skyGrad.addColorStop(0.45, flash > 0.1 ? '#223044' : '#0b131e');
      skyGrad.addColorStop(0.80, '#1c1219');
      skyGrad.addColorStop(1.0, '#2b1312');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Feixes de Holofote Frio / Helicóptero Tático varrendo a tempestade
      for (let b = 0; b < 3; b++) {
        const baseX = W * (0.34 + b * 0.24);
        const baseY = H * 0.88;
        const sway = Math.sin(t * (0.42 + b * 0.13) + b * 1.9) * 0.48;
        const topX = baseX + Math.sin(sway) * W * 0.36;
        const topY = -40;

        const beamGrad = ctx.createLinearGradient(baseX, baseY, topX, topY);
        beamGrad.addColorStop(0, b === 1 ? 'rgba(217, 155, 22, 0.12)' : 'rgba(120, 165, 195, 0.13)');
        beamGrad.addColorStop(1, 'rgba(15, 25, 38, 0.0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(baseX - 14, baseY);
        ctx.lineTo(topX - 120, topY);
        ctx.lineTo(topX + 120, topY);
        ctx.lineTo(baseX + 14, baseY);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Skyline Art-Deco Sombrio de Gotham ao fundo (Torres com agulhas e luzes vermelhas)
      for (const sp of this._gothamSpires) {
        const sx = sp.u * W + px * 8;
        const sw = sp.w * W;
        const sh = sp.h * H;
        const sy = H * 0.86 - sh + py * 4;

        ctx.fillStyle = flash > 0.15 ? '#0d131d' : '#06080e';
        ctx.fillRect(sx - sw * 0.5, sy, sw, sh + 80);

        if (sp.hasCrown) {
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.5, sy);
          ctx.lineTo(sx, sy - 18);
          ctx.lineTo(sx + sw * 0.5, sy);
          ctx.closePath();
          ctx.fill();
        }
        if (sp.hasSpire) {
          ctx.fillRect(sx - 1.5, sy - 44, 3, 44);
          ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
          ctx.fillRect(sx - 2, sy - 46, 4, 4);
        }

        // Filetes verticais de janelas âmbar/frias distantes
        ctx.fillStyle = 'rgba(217, 155, 22, 0.16)';
        for (let wy = sy + 16; wy < H * 0.72; wy += 18) {
          if ((Math.floor(wy) + sp.seed) % 3 === 0) continue;
          ctx.fillRect(sx - sw * 0.26, wy, 3, 8);
          ctx.fillRect(sx + sw * 0.16, wy + 4, 3, 8);
        }
      }

      // 4. Camadas Sombrias do Morro & Submundo Urbano (Sem studs, com telhados chanfrados)
      this._favelaLayers.forEach((layer, lIdx) => {
        const offX = px * layer.parallax;
        const offY = py * (layer.parallax * 0.42);

        ctx.fillStyle = lIdx === 0 ? '#070910' : lIdx === 1 ? '#090b12' : '#05060a';
        ctx.beginPath();
        ctx.moveTo(-60, H + 40);
        for (let step = 0; step <= 24; step++) {
          const u = step / 24;
          const hillY =
            H * (1.0 - (Math.sin(u * Math.PI) * 0.19 + (lIdx === 0 ? 0.30 : lIdx === 1 ? 0.19 : 0.09)));
          ctx.lineTo(u * (W + 120) - 60 + offX, hillY + offY);
        }
        ctx.lineTo(W + 60, H + 40);
        ctx.closePath();
        ctx.fill();

        for (const h of layer.houses) {
          const bx = h.u * (W + 140) - 40 + offX;
          const bw = h.w * W;
          const bh = h.h * H;
          const by = H * (1.0 - h.hillCurve) - bh * 0.65 + offY;

          ctx.fillStyle = h.color;
          ctx.fillRect(bx, by, bw, bh + 90);
          ctx.strokeStyle = '#040508';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, bw, bh + 90);

          if (h.hasSlopedRoof) {
            ctx.fillStyle = '#12161f';
            ctx.beginPath();
            ctx.moveTo(bx - 3, by);
            ctx.lineTo(bx + bw + 3, by - 7);
            ctx.lineTo(bx + bw + 3, by + 2);
            ctx.lineTo(bx - 3, by + 2);
            ctx.closePath();
            ctx.fill();
          }

          if (h.hasAntenna) {
            ctx.strokeStyle = '#333b4a';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx + bw * 0.72, by);
            ctx.lineTo(bx + bw * 0.72, by - 19);
            ctx.stroke();
          }

          const winW = Math.max(3, bw / (h.winCols * 2.8));
          const winH = 5;
          for (let r = 0; r < h.winRows; r++) {
            for (let c = 0; c < h.winCols; c++) {
              const flicker = Math.sin(t * 1.1 + h.seed + r * 7 + c * 13);
              if (flicker < -0.15) continue;
              const wx = bx + ((c + 0.5) / h.winCols) * bw - winW * 0.5;
              const wy = by + 12 + r * 15;
              ctx.fillStyle = (h.seed + r + c) % 4 === 0 ? '#b91c1c' : '#d98216';
              ctx.fillRect(wx, wy, winW, winH);
            }
          }
        }
      });

      // 5. Neblina Urbana Baixa (Smog) flutuando na base
      const smogGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      smogGrad.addColorStop(0, 'rgba(10, 15, 22, 0)');
      smogGrad.addColorStop(1, 'rgba(7, 10, 15, 0.78)');
      ctx.fillStyle = smogGrad;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);

      // 6. Chuva Diagonal Cortando a Tela
      ctx.lineWidth = 1.15;
      for (const rd of this._rainDrops) {
        rd.y += rd.spd * dt;
        rd.x -= rd.spd * 0.18 * dt;
        if (rd.y > 1.05) {
          rd.y = -0.05;
          rd.x = (rd.x + 1.37) % 1.0;
        }
        if (rd.x < -0.05) rd.x += 1.05;
        const rx = rd.x * W;
        const ry = rd.y * H;
        ctx.strokeStyle = `rgba(165, 190, 215, ${rd.alpha})`;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - rd.len * 0.24, ry + rd.len);
        ctx.stroke();
      }

      // 7. Brasas / Faíscas Sombrias
      for (const emb of this._favelaEmbers) {
        emb.y -= emb.spdY * dt;
        emb.x += emb.spdX * dt;
        if (emb.y < -0.05) emb.y = 1.05;
        if (emb.x < 0) emb.x = 1;
        if (emb.x > 1) emb.x = 0;
        ctx.fillStyle = emb.color;
        ctx.fillRect(emb.x * W, emb.y * H, emb.size, emb.size);
      }

      // Vinheta Assimétrica Pesada (mais escura na esquerda onde fica a coluna tática do Menu!)
      const leftGrad = ctx.createLinearGradient(0, 0, W * 0.65, 0);
      leftGrad.addColorStop(0, 'rgba(4, 5, 9, 0.90)');
      leftGrad.addColorStop(0.55, 'rgba(6, 8, 13, 0.55)');
      leftGrad.addColorStop(1, 'rgba(6, 8, 13, 0.0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, W, H);
    }
  });
}
