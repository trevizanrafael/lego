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

export const HERO_HUD_KIT_STRIPS = HERO_HUD_THEMES;

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
     * Constrói o Skyline Tempestuoso de Gotham Noir (3 Planos Gótico/Brutalista + Morro + Viaduto)
     * em Canvas 2D leve para rodar cravado a 60 FPS no fundo do Menu Inicial.
     */
    _initFavelaBackgroundCanvas() {
      this._favelaTime = 0;
      this._titleMouseX = 0;
      this._titleMouseY = 0;

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('mousemove', (e) => {
          if (!this.isTitleScreenActive) return;
          this._titleMouseX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
          this._titleMouseY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
        });
      }

      // Camadas pesadas de nuvens de tempestade derivando lentamente
      this._stormClouds = Array.from({ length: 14 }, (_, i) => ({
        x: (i / 14) * 1.25 - 0.12,
        y: 0.05 + (i % 4) * 0.085,
        rx: 0.16 + ((i * 7) % 5) * 0.035,
        ry: 0.055 + (i % 3) * 0.022,
        spd: 0.006 + (i % 4) * 0.0025,
        alpha: 0.34 + (i % 3) * 0.12
      }));

      // Estado de relâmpago ramificado ocasional
      this._lightningBolt = {
        timer: 2.2,
        duration: 0,
        maxDuration: 0.32,
        originX: 0.68,
        segments: []
      };

      // Plano 1 (Fundo): Torres Góticas Colossais + Pináculos + Catedral/Torre do Relógio
      this._gothamSpires = Array.from({ length: 17 }, (_, i) => ({
        u: 0.03 + (i / 16) * 0.96,
        w: 0.038 + ((i * 11) % 5) * 0.011,
        h: 0.42 + ((i * 29) % 7) * 0.055,
        hasSpire: i % 2 === 0,
        isCathedral: i === 11,
        beaconPhase: i * 0.9,
        seed: i * 37
      }));

      // Plano 2 (Médio): Arranha-céus Brutalistas / Art-Deco com janelas em sódio, gelo e carmesim
      const windowColors = ['#c28e2b', '#7dd3fc', '#991b1b', '#c28e2b'];
      this._midSkyscrapers = Array.from({ length: 14 }, (_, i) => {
        const w = 0.048 + ((i * 13) % 4) * 0.013;
        const h = 0.27 + ((i * 19) % 6) * 0.052;
        const cols = 3 + (i % 3);
        const rows = 8 + (i % 6);
        const windows = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (((i * 17 + r * 7 + c * 13) % 11) > 2) continue;
            windows.push({
              c,
              r,
              color: windowColors[(i + r + c) % windowColors.length],
              phase: (i * 5 + r * 3 + c) * 0.7
            });
          }
        }
        return {
          u: 0.02 + (i / 13) * 0.98,
          w,
          h,
          cols,
          rows,
          setback: i % 2 === 0,
          tone: i % 2 === 0 ? '#060911' : '#0a0e18',
          windows
        };
      });

      // Plano 3 (Primeiro Plano): Silhueta escura do Morro/Favela + Viaduto Elevado + Vapor de Bueiros
      this._favelaRidgeHouses = Array.from({ length: 28 }, (_, i) => {
        const u = i / 28;
        const ridge = Math.max(0, Math.sin((u - 0.35) * Math.PI * 1.35)) * 0.16 + 0.14;
        return {
          u: 0.32 + u * 0.72,
          ridge,
          w: 0.024 + ((i * 7) % 4) * 0.007,
          h: 0.038 + ((i * 11) % 5) * 0.014,
          sloped: i % 2 === 0,
          antenna: i % 4 === 0,
          litColor: i % 5 === 0 ? '#991b1b' : '#c28e2b',
          hasLight: i % 3 !== 0
        };
      });

      this._viaductTrails = Array.from({ length: 9 }, (_, i) => ({
        x: (i / 9) * 1.2 - 0.1,
        dir: i % 2 === 0 ? 1 : -1,
        spd: 0.11 + (i % 4) * 0.045,
        len: 36 + (i % 3) * 24,
        color: i % 2 === 0 ? '#dc2626' : '#c28e2b',
        laneOffset: i % 2 === 0 ? -2 : 3
      }));

      this._steamPlumes = Array.from({ length: 16 }, (_, i) => ({
        x: 0.08 + ((i * 19) % 23) * 0.04,
        life: (i / 16),
        spd: 0.12 + (i % 4) * 0.035,
        drift: ((i % 3) - 1) * 0.018,
        rad: 18 + (i % 4) * 11
      }));

      // Chuva torrencial prateada/azulada na diagonal + cinzas sutis
      this._rainDrops = Array.from({ length: 210 }, (_, i) => ({
        x: ((i * 61) % 100) / 100,
        y: ((i * 37) % 100) / 100,
        len: 16 + (i % 5) * 8,
        spd: 0.88 + (i % 4) * 0.25,
        alpha: 0.11 + (i % 4) * 0.05
      }));

      this._favelaEmbers = Array.from({ length: 26 }, (_, i) => ({
        x: ((i * 53) % 100) / 100,
        y: ((i * 29) % 100) / 100,
        spdY: 0.022 + (i % 5) * 0.009,
        spdX: -0.015 - (i % 3) * 0.008,
        size: 1.4 + (i % 2),
        color: i % 3 === 0 ? '#94a3b8' : i % 3 === 1 ? '#c28e2b' : '#991b1b'
      }));

      this._renderFavelaBackgroundCanvas(0.016);
    },

    _spawnBranchedLightning(seedTime) {
      const originX = 0.42 + ((Math.sin(seedTime * 3.7) * 0.5 + 0.5) * 0.48);
      const segs = [];
      let cx = originX;
      let cy = 0.02;
      for (let s = 0; s < 9; s++) {
        const nx = cx + Math.sin(seedTime * 11.3 + s * 2.7) * 0.028;
        const ny = cy + 0.052 + (s % 2) * 0.014;
        segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, width: Math.max(1.1, 2.8 - s * 0.22) });
        if (s === 2 || s === 5) {
          const dir = s === 2 ? -1 : 1;
          let bx = nx;
          let by = ny;
          for (let b = 0; b < 4; b++) {
            const bnx = bx + dir * (0.018 + b * 0.008);
            const bny = by + 0.038;
            segs.push({ x1: bx, y1: by, x2: bnx, y2: bny, width: 1.1 });
            bx = bnx;
            by = bny;
          }
        }
        cx = nx;
        cy = ny;
      }
      this._lightningBolt.originX = originX;
      this._lightningBolt.segments = segs;
      this._lightningBolt.maxDuration = 0.30;
      this._lightningBolt.duration = 0.30;
      this._lightningBolt.timer = 4.2 + (Math.abs(Math.cos(seedTime * 1.9)) * 3.4);
    },

    _renderFavelaBackgroundCanvas(dt = 0.016) {
      const canvas = this.favelaCanvasEl;
      if (!canvas) return;
      const W = typeof window !== 'undefined' ? window.innerWidth : canvas.width || 1280;
      const H = typeof window !== 'undefined' ? window.innerHeight : canvas.height || 720;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const stepDt = Math.min(0.05, Math.max(0.001, dt));
      this._favelaTime += stepDt;
      const t = this._favelaTime;
      const px = this._titleMouseX;
      const py = this._titleMouseY;

      // Atualiza relâmpago ramificado
      const lb = this._lightningBolt;
      let flash = 0;
      if (lb) {
        if (lb.duration > 0) {
          lb.duration -= stepDt;
          const norm = Math.max(0, lb.duration / lb.maxDuration);
          flash = norm > 0.55 && norm < 0.72 ? 0.25 : norm;
        } else {
          lb.timer -= stepDt;
          if (lb.timer <= 0) {
            this._spawnBranchedLightning(t);
            flash = 0.95;
          }
        }
      }

      // 1. Céu Abissal Noturno (#020306 -> #070b14 -> #101726)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0.0, flash > 0.2 ? '#0b1322' : '#020306');
      skyGrad.addColorStop(0.52, flash > 0.2 ? '#16243b' : '#070b14');
      skyGrad.addColorStop(1.0, flash > 0.2 ? '#1d2b44' : '#101726');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Camadas de nuvens pesadas de tempestade
      if (this._stormClouds) {
        for (const cl of this._stormClouds) {
          cl.x += cl.spd * stepDt;
          if (cl.x - cl.rx > 1.15) cl.x = -cl.rx - 0.1;
          const cx = cl.x * W + px * 6;
          const cy = cl.y * H + py * 3;
          const rw = cl.rx * W;
          const rh = cl.ry * H;
          const cGrad = ctx.createRadialGradient(cx, cy, rh * 0.15, cx, cy, rw);
          const tone = flash > 0.25 ? '28, 42, 66' : '11, 16, 28';
          cGrad.addColorStop(0, `rgba(${tone}, ${cl.alpha})`);
          cGrad.addColorStop(1, 'rgba(4, 6, 12, 0)');
          ctx.fillStyle = cGrad;
          ctx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2);
        }
      }

      // Relâmpago ramificado no céu iluminando atrás das torres
      if (lb && lb.duration > 0 && lb.segments.length > 0) {
        const glowX = lb.originX * W;
        const boltGlow = ctx.createRadialGradient(glowX, H * 0.18, 10, glowX, H * 0.22, W * 0.34);
        boltGlow.addColorStop(0, `rgba(186, 230, 253, ${0.28 * flash})`);
        boltGlow.addColorStop(1, 'rgba(125, 211, 252, 0)');
        ctx.fillStyle = boltGlow;
        ctx.fillRect(0, 0, W, H * 0.65);

        ctx.strokeStyle = `rgba(186, 230, 253, ${Math.min(1, flash * 1.15)})`;
        for (const sg of lb.segments) {
          ctx.lineWidth = sg.width;
          ctx.beginPath();
          ctx.moveTo(sg.x1 * W, sg.y1 * H);
          ctx.lineTo(sg.x2 * W, sg.y2 * H);
          ctx.stroke();
        }
      }

      // 2. Holofotes Táticos no Céu (2 azul-aço/gelo + 1 âmbar/policial distante)
      for (let b = 0; b < 3; b++) {
        const baseX = W * (0.36 + b * 0.23);
        const baseY = H * 0.84;
        const sway = Math.sin(t * (0.28 + b * 0.09) + b * 2.1) * 0.42;
        const topX = baseX + sway * W * 0.34;
        const topY = -30;
        const beamGrad = ctx.createLinearGradient(baseX, baseY, topX, topY);
        beamGrad.addColorStop(
          0,
          b === 2 ? 'rgba(194, 142, 43, 0.075)' : 'rgba(125, 211, 252, 0.085)'
        );
        beamGrad.addColorStop(1, 'rgba(7, 11, 20, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(baseX - 12, baseY);
        ctx.lineTo(topX - 115, topY);
        ctx.lineTo(topX + 115, topY);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Plano de Fundo: Torres Góticas Colossais + Catedral/Torre do Relógio + Luzes de Aviação
      for (const sp of this._gothamSpires) {
        const sx = sp.u * W + px * 8;
        const sw = sp.w * W;
        const sh = sp.h * H;
        const sy = H * 0.86 - sh + py * 4;

        ctx.fillStyle = flash > 0.25 ? '#0b111e' : '#04070d';
        ctx.fillRect(sx - sw * 0.5, sy, sw, sh + 60);

        if (sp.isCathedral) {
          // Torres gêmeas pontiagudas + mostrador iluminado da Torre de Relógio Gótica
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.5, sy);
          ctx.lineTo(sx - sw * 0.34, sy - 42);
          ctx.lineTo(sx - sw * 0.16, sy);
          ctx.moveTo(sx + sw * 0.16, sy);
          ctx.lineTo(sx + sw * 0.34, sy - 42);
          ctx.lineTo(sx + sw * 0.5, sy);
          ctx.closePath();
          ctx.fill();

          const clockR = Math.max(6, sw * 0.18);
          ctx.fillStyle = 'rgba(194, 142, 43, 0.28)';
          ctx.beginPath();
          ctx.arc(sx, sy + 22, clockR, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        } else if (sp.hasSpire) {
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.42, sy);
          ctx.lineTo(sx, sy - 22);
          ctx.lineTo(sx + sw * 0.42, sy);
          ctx.closePath();
          ctx.fill();

          ctx.fillRect(sx - 1.2, sy - 50, 2.4, 30);
          const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.6 + sp.beaconPhase));
          ctx.fillStyle = `rgba(220, 38, 38, ${blink.toFixed(2)})`;
          ctx.fillRect(sx - 2, sy - 52, 4, 4);
        }
      }

      // 4. Plano Médio: Arranha-céus Brutalistas / Art-Deco (#060911 / #0a0e18)
      for (const bld of this._midSkyscrapers) {
        const bx = bld.u * W + px * 16;
        const bw = bld.w * W;
        const bh = bld.h * H;
        const by = H * 0.87 - bh + py * 7;

        ctx.fillStyle = bld.tone;
        ctx.fillRect(bx - bw * 0.5, by, bw, bh + 60);
        if (bld.setback) {
          ctx.fillRect(bx - bw * 0.34, by - 16, bw * 0.68, 18);
        }
        ctx.strokeStyle = flash > 0.25 ? 'rgba(125, 211, 252, 0.16)' : '#030509';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx - bw * 0.5, by, bw, bh + 60);

        const winW = Math.max(2.5, bw / (bld.cols * 2.8));
        const winH = 5;
        for (const w of bld.windows) {
          if (Math.sin(t * 0.45 + w.phase) < -0.65) continue;
          const wx = bx - bw * 0.38 + (w.c / Math.max(1, bld.cols - 1)) * (bw * 0.76) - winW * 0.5;
          const wy = by + 14 + w.r * 14;
          if (wy > H * 0.80) continue;
          ctx.fillStyle = w.color;
          ctx.globalAlpha = 0.58;
          ctx.fillRect(wx, wy, winW, winH);
        }
        ctx.globalAlpha = 1;
      }

      // 5. Primeiro Plano: Silhueta escura do Morro/Favela + Viaduto Elevado + Bueiros + Asfalto Molhado
      const offX = px * 26;
      const offY = py * 10;
      ctx.fillStyle = '#04060b';
      ctx.beginPath();
      ctx.moveTo(W * 0.25 + offX, H);
      for (let s = 0; s <= 18; s++) {
        const u = s / 18;
        const rx = W * (0.28 + u * 0.76) + offX;
        const ry = H * (0.90 - Math.max(0, Math.sin(u * Math.PI)) * 0.17) + offY;
        ctx.lineTo(rx, ry);
      }
      ctx.lineTo(W + 80, H);
      ctx.closePath();
      ctx.fill();

      for (const fh of this._favelaRidgeHouses) {
        const hx = fh.u * W + offX;
        const hw = fh.w * W;
        const hh = fh.h * H;
        const hy = H * (1 - fh.ridge) - hh * 0.5 + offY;
        ctx.fillStyle = '#070a12';
        ctx.fillRect(hx, hy, hw, hh + 30);
        if (fh.sloped) {
          ctx.beginPath();
          ctx.moveTo(hx - 2, hy);
          ctx.lineTo(hx + hw + 2, hy - 5);
          ctx.lineTo(hx + hw + 2, hy + 1);
          ctx.closePath();
          ctx.fill();
        }
        if (fh.antenna) {
          ctx.strokeStyle = '#1c2536';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(hx + hw * 0.7, hy);
          ctx.lineTo(hx + hw * 0.7, hy - 14);
          ctx.stroke();
        }
        if (fh.hasLight) {
          ctx.fillStyle = fh.litColor;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(hx + hw * 0.35, hy + 8, 3.5, 4);
          ctx.globalAlpha = 1;
        }
      }

      // Viaduto Elevado + Pilares + Rastros Horizontais de Faróis Vermelhos/Âmbar
      const deckY = H * 0.82 + offY * 0.6;
      ctx.fillStyle = '#030509';
      ctx.fillRect(-20, deckY, W + 40, 12);
      ctx.fillStyle = '#121826';
      ctx.fillRect(-20, deckY, W + 40, 2);
      const pierStep = Math.max(110, W * 0.11);
      ctx.fillStyle = '#030509';
      for (let pxPos = (offX % pierStep) - pierStep; pxPos < W + pierStep; pxPos += pierStep) {
        ctx.fillRect(pxPos, deckY + 12, 18, H - deckY);
      }

      for (const tr of this._viaductTrails) {
        tr.x += tr.dir * tr.spd * stepDt;
        if (tr.dir > 0 && tr.x > 1.15) tr.x = -0.15;
        if (tr.dir < 0 && tr.x < -0.15) tr.x = 1.15;
        const tx = tr.x * W;
        const ty = deckY + tr.laneOffset;
        const tGrad = ctx.createLinearGradient(tx - tr.len, ty, tx + tr.len, ty);
        tGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        tGrad.addColorStop(0.5, tr.color);
        tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = tGrad;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(tx - tr.len, ty - 1.5, tr.len * 2, 2.5);
      }
      ctx.globalAlpha = 1;

      // Vapor / Fumaça subindo dos bueiros
      for (const sp of this._steamPlumes) {
        sp.life += sp.spd * stepDt;
        if (sp.life >= 1) sp.life -= 1;
        const sx = (sp.x + sp.drift * sp.life) * W + offX * 0.5;
        const sy = H * 0.94 - sp.life * H * 0.18;
        const r = sp.rad * (0.6 + sp.life * 1.1);
        const alpha = Math.sin(sp.life * Math.PI) * 0.11;
        const stGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
        stGrad.addColorStop(0, `rgba(148, 163, 184, ${alpha.toFixed(3)})`);
        stGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = stGrad;
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }

      // Base de Asfalto Molhado & Reflexos Verticais Distorcidos
      const wetY = H * 0.90;
      const wetGrad = ctx.createLinearGradient(0, wetY, 0, H);
      wetGrad.addColorStop(0, 'rgba(4, 6, 10, 0.55)');
      wetGrad.addColorStop(1, '#020306');
      ctx.fillStyle = wetGrad;
      ctx.fillRect(0, wetY, W, H - wetY);

      for (let rIdx = 0; rIdx < 12; rIdx++) {
        const rx = ((rIdx * 0.085 + 0.04) * W + offX * 0.4) % W;
        const col = rIdx % 3 === 0 ? '125, 211, 252' : rIdx % 3 === 1 ? '194, 142, 43' : '220, 38, 38';
        const refGrad = ctx.createLinearGradient(rx, wetY, rx, H);
        refGrad.addColorStop(0, `rgba(${col}, 0.16)`);
        refGrad.addColorStop(1, `rgba(${col}, 0.0)`);
        ctx.fillStyle = refGrad;
        ctx.fillRect(rx - 8, wetY, 16, H - wetY);
      }

      // 6. Chuva Torrencial Diagonal Prateada/Azulada + Cinzas
      ctx.lineWidth = 1.15;
      for (const rd of this._rainDrops) {
        rd.y += rd.spd * stepDt;
        rd.x -= rd.spd * 0.21 * stepDt;
        if (rd.y > 1.06) {
          rd.y = -0.06;
          rd.x = (rd.x + 1.37) % 1.0;
        }
        if (rd.x < -0.05) rd.x += 1.05;
        const rx = rd.x * W;
        const ry = rd.y * H;
        ctx.strokeStyle = `rgba(186, 230, 253, ${rd.alpha})`;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - rd.len * 0.26, ry + rd.len);
        ctx.stroke();
      }

      for (const emb of this._favelaEmbers) {
        emb.y -= emb.spdY * stepDt;
        emb.x += emb.spdX * stepDt;
        if (emb.y < -0.04) emb.y = 1.04;
        if (emb.x < -0.02) emb.x = 1.02;
        if (emb.x > 1.02) emb.x = -0.02;
        ctx.fillStyle = emb.color;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(emb.x * W, emb.y * H, emb.size, emb.size);
      }
      ctx.globalAlpha = 1;

      // 7. Vinheta Assimétrica Noir (contraste cirúrgico na coluna esquerda de comando)
      const leftGrad = ctx.createLinearGradient(0, 0, W * 0.66, 0);
      leftGrad.addColorStop(0, 'rgba(2, 3, 6, 0.92)');
      leftGrad.addColorStop(0.52, 'rgba(4, 6, 10, 0.58)');
      leftGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, W, H);
    }
  });
}
