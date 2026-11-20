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
     * Skyline Abissal & Obscuro de Gotham Noir (<0.8ms/frame a 60 FPS):
     * - Resolução interna limitada a 1280x720
     * - Sprite offscreen único 96x96 `_fogSpriteCanvas` (ZERO createRadialGradient por frame!)
     * - Chuva inteira agrupada em 1 único beginPath() + stroke()
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

      this._fogSpriteCanvas =
        typeof document !== 'undefined' && typeof document.createElement === 'function'
          ? document.createElement('canvas')
          : null;
      if (this._fogSpriteCanvas) {
        this._fogSpriteCanvas.width = 96;
        this._fogSpriteCanvas.height = 96;
        const fCtx = this._fogSpriteCanvas.getContext('2d');
        if (fCtx) {
          const fg = fCtx.createRadialGradient(48, 48, 4, 48, 48, 48);
          fg.addColorStop(0.0, 'rgba(20, 27, 40, 1)');
          fg.addColorStop(0.46, 'rgba(9, 13, 22, 0.54)');
          fg.addColorStop(1.0, 'rgba(1, 2, 4, 0)');
          fCtx.fillStyle = fg;
          fCtx.fillRect(0, 0, 96, 96);
        }
      }

      this._stormClouds = Array.from({ length: 12 }, (_, i) => ({
        x: (i / 12) * 1.3 - 0.15,
        y: 0.04 + (i % 4) * 0.08,
        rx: 0.18 + ((i * 7) % 5) * 0.038,
        ry: 0.065 + (i % 3) * 0.024,
        spd: 0.0045 + (i % 4) * 0.002,
        alpha: 0.24 + (i % 3) * 0.09
      }));

      this._lowFogBanks = Array.from({ length: 9 }, (_, i) => ({
        x: (i / 9) * 1.35 - 0.18,
        y: 0.54 + (i % 3) * 0.11,
        rx: 0.24 + (i % 4) * 0.05,
        ry: 0.09 + (i % 2) * 0.035,
        spd: (i % 2 === 0 ? 1 : -1) * (0.005 + (i % 3) * 0.002),
        alpha: 0.42 + (i % 3) * 0.12
      }));

      this._lightningBolt = {
        timer: 3.8,
        duration: 0,
        maxDuration: 0.26,
        originX: 0.72,
        segments: []
      };

      this._gothamSpires = Array.from({ length: 17 }, (_, i) => ({
        u: 0.04 + (i / 16) * 0.95,
        w: 0.04 + ((i * 11) % 5) * 0.011,
        h: 0.44 + ((i * 29) % 7) * 0.055,
        hasSpire: i % 2 === 0,
        isCathedral: i === 11 || i === 6,
        hasBeacon: i % 6 === 0,
        beaconPhase: i * 1.1
      }));

      this._midSkyscrapers = Array.from({ length: 14 }, (_, i) => {
        const w = 0.05 + ((i * 13) % 4) * 0.013;
        const h = 0.28 + ((i * 19) % 6) * 0.052;
        const cols = 3 + (i % 3);
        const rows = 8 + (i % 6);
        const windows = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((i * 19 + r * 11 + c * 17) % 29 !== 0) continue;
            windows.push({ c, r, phase: (i * 5 + r * 3 + c) * 0.7 });
          }
        }
        return {
          u: 0.03 + (i / 13) * 0.96,
          w,
          h,
          cols,
          setback: i % 2 === 0,
          tone: i % 2 === 0 ? '#020306' : '#04060b',
          windows
        };
      });

      this._favelaRidgeHouses = Array.from({ length: 26 }, (_, i) => {
        const u = i / 26;
        const ridge = Math.max(0, Math.sin((u - 0.34) * Math.PI * 1.35)) * 0.15 + 0.13;
        return {
          u: 0.34 + u * 0.68,
          ridge,
          w: 0.025 + ((i * 7) % 4) * 0.007,
          h: 0.038 + ((i * 11) % 5) * 0.014,
          sloped: i % 2 === 0,
          hasLight: i % 11 === 0
        };
      });

      this._viaductTrails = Array.from({ length: 4 }, (_, i) => ({
        x: (i / 4) * 1.2 - 0.1,
        dir: i % 2 === 0 ? 1 : -1,
        spd: 0.09 + (i % 3) * 0.035,
        len: 32 + (i % 2) * 20,
        isTail: i % 2 === 0,
        laneOffset: i % 2 === 0 ? -2 : 3
      }));

      this._steamPlumes = Array.from({ length: 12 }, (_, i) => ({
        x: 0.14 + ((i * 19) % 21) * 0.042,
        life: i / 12,
        spd: 0.09 + (i % 4) * 0.025,
        drift: ((i % 3) - 1) * 0.016,
        rad: 26 + (i % 4) * 14
      }));

      this._rainDrops = Array.from({ length: 185 }, (_, i) => ({
        x: ((i * 61) % 100) / 100,
        y: ((i * 37) % 100) / 100,
        len: 15 + (i % 5) * 7,
        spd: 0.92 + (i % 4) * 0.24
      }));

      this._renderFavelaBackgroundCanvas(0.016);
    },

    _spawnBranchedLightning(seedTime) {
      const originX = 0.48 + (Math.sin(seedTime * 3.7) * 0.5 + 0.5) * 0.42;
      const segs = [];
      let cx = originX;
      let cy = 0.01;
      for (let s = 0; s < 8; s++) {
        const nx = cx + Math.sin(seedTime * 11.3 + s * 2.7) * 0.025;
        const ny = cy + 0.052 + (s % 2) * 0.013;
        segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, branch: false });
        if (s === 2 || s === 5) {
          const dir = s === 2 ? -1 : 1;
          let bx = nx;
          let by = ny;
          for (let b = 0; b < 3; b++) {
            const bnx = bx + dir * (0.016 + b * 0.008);
            const bny = by + 0.036;
            segs.push({ x1: bx, y1: by, x2: bnx, y2: bny, branch: true });
            bx = bnx;
            by = bny;
          }
        }
        cx = nx;
        cy = ny;
      }
      this._lightningBolt.originX = originX;
      this._lightningBolt.segments = segs;
      this._lightningBolt.maxDuration = 0.26;
      this._lightningBolt.duration = 0.26;
      this._lightningBolt.timer = 6.4 + Math.abs(Math.cos(seedTime * 1.9)) * 5.4;
    },

    _renderFavelaBackgroundCanvas(dt = 0.016) {
      const canvas = this.favelaCanvasEl;
      if (!canvas) return;
      const rawW = typeof window !== 'undefined' ? window.innerWidth : canvas.width || 1280;
      const rawH = typeof window !== 'undefined' ? window.innerHeight : canvas.height || 720;
      const W = Math.min(1280, Math.max(320, rawW));
      const H = Math.min(720, Math.max(240, rawH));
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
      const fogSprite = this._fogSpriteCanvas;

      const lb = this._lightningBolt;
      let flash = 0;
      if (lb) {
        if (lb.duration > 0) {
          lb.duration -= stepDt;
          const norm = Math.max(0, lb.duration / lb.maxDuration);
          flash = norm > 0.52 && norm < 0.7 ? 0.18 : norm * 0.85;
        } else {
          lb.timer -= stepDt;
          if (lb.timer <= 0) {
            this._spawnBranchedLightning(t);
            flash = 0.82;
          }
        }
      }

      // 1. Céu Abissal Quase Breu (#010103 -> #030509 -> #070a12)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0.0, flash > 0.2 ? '#060910' : '#010103');
      skyGrad.addColorStop(0.55, flash > 0.2 ? '#0c121e' : '#030509');
      skyGrad.addColorStop(1.0, flash > 0.2 ? '#121a28' : '#070a12');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      if (fogSprite && this._stormClouds) {
        for (const cl of this._stormClouds) {
          cl.x += cl.spd * stepDt;
          if (cl.x - cl.rx > 1.18) cl.x = -cl.rx - 0.12;
          const cx = cl.x * W + px * 5;
          const cy = cl.y * H + py * 2.5;
          const rw = cl.rx * W;
          const rh = cl.ry * H;
          ctx.globalAlpha = cl.alpha * (flash > 0.2 ? 1.35 : 1.0);
          ctx.drawImage(fogSprite, cx - rw, cy - rh, rw * 2, rh * 2);
        }
        ctx.globalAlpha = 1;
      }

      if (lb && lb.duration > 0 && lb.segments.length > 0) {
        if (fogSprite) {
          const glowX = lb.originX * W;
          ctx.globalAlpha = 0.34 * flash;
          ctx.drawImage(fogSprite, glowX - W * 0.36, -H * 0.08, W * 0.72, H * 0.68);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = '#cbd5e1';
        ctx.globalAlpha = Math.min(0.88, flash);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (const sg of lb.segments) {
          if (sg.branch) continue;
          ctx.moveTo(sg.x1 * W, sg.y1 * H);
          ctx.lineTo(sg.x2 * W, sg.y2 * H);
        }
        ctx.stroke();

        ctx.lineWidth = 0.9;
        ctx.globalAlpha = Math.min(0.52, flash * 0.65);
        ctx.beginPath();
        for (const sg of lb.segments) {
          if (!sg.branch) continue;
          ctx.moveTo(sg.x1 * W, sg.y1 * H);
          ctx.lineTo(sg.x2 * W, sg.y2 * H);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 2. Holofotes Fantasmagóricos e Frios
      for (let b = 0; b < 2; b++) {
        const baseX = W * (0.48 + b * 0.26);
        const baseY = H * 0.86;
        const sway = Math.sin(t * (0.2 + b * 0.07) + b * 2.4) * 0.36;
        const topX = baseX + sway * W * 0.32;
        const topY = -20;
        const beamGrad = ctx.createLinearGradient(baseX, baseY, topX, topY);
        beamGrad.addColorStop(0, 'rgba(148, 163, 184, 0.038)');
        beamGrad.addColorStop(1, 'rgba(2, 3, 6, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(baseX - 10, baseY);
        ctx.lineTo(topX - 105, topY);
        ctx.lineTo(topX + 105, topY);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Silhuetas Monolíticas Negras (#020306) de Catedrais Góticas & Pináculos
      for (const sp of this._gothamSpires) {
        const sx = sp.u * W + px * 7;
        const sw = sp.w * W;
        const sh = sp.h * H;
        const sy = H * 0.87 - sh + py * 3.5;

        ctx.fillStyle = '#020306';
        ctx.fillRect(sx - sw * 0.5, sy, sw, sh + 50);

        if (sp.isCathedral) {
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.5, sy);
          ctx.lineTo(sx - sw * 0.34, sy - 44);
          ctx.lineTo(sx - sw * 0.14, sy);
          ctx.moveTo(sx + sw * 0.14, sy);
          ctx.lineTo(sx + sw * 0.34, sy - 44);
          ctx.lineTo(sx + sw * 0.5, sy);
          ctx.closePath();
          ctx.fill();

          const clockR = Math.max(5, sw * 0.15);
          ctx.fillStyle = 'rgba(180, 145, 85, 0.11)';
          ctx.beginPath();
          ctx.arc(sx, sy + 22, clockR, 0, Math.PI * 2);
          ctx.fill();
        } else if (sp.hasSpire) {
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.42, sy);
          ctx.lineTo(sx, sy - 24);
          ctx.lineTo(sx + sw * 0.42, sy);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(sx - 1, sy - 48, 2, 26);

          if (sp.hasBeacon) {
            const blink = 0.08 + 0.16 * Math.max(0, Math.sin(t * 1.8 + sp.beaconPhase));
            ctx.fillStyle = `rgba(153, 27, 27, ${blink.toFixed(2)})`;
            ctx.fillRect(sx - 1.5, sy - 50, 3, 3);
          }
        }
      }

      if (fogSprite && this._lowFogBanks) {
        for (let i = 0; i < 5; i++) {
          const fb = this._lowFogBanks[i];
          fb.x += fb.spd * stepDt;
          if (fb.x - fb.rx > 1.2) fb.x = -fb.rx - 0.15;
          if (fb.x + fb.rx < -0.2) fb.x = 1.15 + fb.rx;
          const fx = fb.x * W + px * 11;
          const fy = fb.y * H + py * 5;
          const fw = fb.rx * W;
          const fh = fb.ry * H;
          ctx.globalAlpha = fb.alpha;
          ctx.drawImage(fogSprite, fx - fw, fy - fh, fw * 2, fh * 2);
        }
        ctx.globalAlpha = 1;
      }

      // 4. Arranha-céus Monolíticos (#020306 / #04060b) + raríssimos pontos pálidos
      for (const bld of this._midSkyscrapers) {
        const bx = bld.u * W + px * 14;
        const bw = bld.w * W;
        const bh = bld.h * H;
        const by = H * 0.88 - bh + py * 6;

        ctx.fillStyle = bld.tone;
        ctx.fillRect(bx - bw * 0.5, by, bw, bh + 50);
        if (bld.setback) {
          ctx.fillRect(bx - bw * 0.34, by - 15, bw * 0.68, 17);
        }
      }

      ctx.fillStyle = 'rgba(180, 145, 85, 0.18)';
      for (const bld of this._midSkyscrapers) {
        if (bld.windows.length === 0) continue;
        const bx = bld.u * W + px * 14;
        const bw = bld.w * W;
        const bh = bld.h * H;
        const by = H * 0.88 - bh + py * 6;
        const winW = Math.max(2, bw / (bld.cols * 3.1));
        for (const w of bld.windows) {
          if (Math.sin(t * 0.32 + w.phase) < -0.25) continue;
          const wx = bx - bw * 0.36 + (w.c / Math.max(1, bld.cols - 1)) * (bw * 0.72) - winW * 0.5;
          const wy = by + 16 + w.r * 15;
          if (wy > H * 0.8) continue;
          ctx.fillRect(wx, wy, winW, 4);
        }
      }

      if (fogSprite && this._lowFogBanks) {
        for (let i = 5; i < this._lowFogBanks.length; i++) {
          const fb = this._lowFogBanks[i];
          fb.x += fb.spd * stepDt;
          if (fb.x - fb.rx > 1.2) fb.x = -fb.rx - 0.15;
          if (fb.x + fb.rx < -0.2) fb.x = 1.15 + fb.rx;
          const fx = fb.x * W + px * 18;
          const fy = (fb.y + 0.14) * H + py * 7;
          const fw = fb.rx * W * 1.15;
          const fh = fb.ry * H * 1.1;
          ctx.globalAlpha = fb.alpha * 1.15;
          ctx.drawImage(fogSprite, fx - fw, fy - fh, fw * 2, fh * 2);
        }
        ctx.globalAlpha = 1;
      }

      // 5. Primeiro Plano: Silhueta Negra do Morro + Viaduto + Vapor
      const offX = px * 22;
      const offY = py * 8;
      ctx.fillStyle = '#020306';
      ctx.beginPath();
      ctx.moveTo(W * 0.28 + offX, H);
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const rx = W * (0.3 + u * 0.74) + offX;
        const ry = H * (0.91 - Math.max(0, Math.sin(u * Math.PI)) * 0.15) + offY;
        ctx.lineTo(rx, ry);
      }
      ctx.lineTo(W + 60, H);
      ctx.closePath();
      ctx.fill();

      for (const fh of this._favelaRidgeHouses) {
        const hx = fh.u * W + offX;
        const hw = fh.w * W;
        const hh = fh.h * H;
        const hy = H * (1 - fh.ridge) - hh * 0.5 + offY;
        ctx.fillStyle = '#030509';
        ctx.fillRect(hx, hy, hw, hh + 28);
        if (fh.sloped) {
          ctx.beginPath();
          ctx.moveTo(hx - 2, hy);
          ctx.lineTo(hx + hw + 2, hy - 4);
          ctx.lineTo(hx + hw + 2, hy + 1);
          ctx.closePath();
          ctx.fill();
        }
        if (fh.hasLight) {
          ctx.fillStyle = 'rgba(180, 145, 85, 0.15)';
          ctx.fillRect(hx + hw * 0.38, hy + 8, 3, 3.5);
        }
      }

      const deckY = H * 0.84 + offY * 0.55;
      ctx.fillStyle = '#010204';
      ctx.fillRect(-20, deckY, W + 40, 11);
      const pierStep = Math.max(110, W * 0.12);
      for (let pxPos = (offX % pierStep) - pierStep; pxPos < W + pierStep; pxPos += pierStep) {
        ctx.fillRect(pxPos, deckY + 11, 16, H - deckY);
      }

      for (const tr of this._viaductTrails) {
        tr.x += tr.dir * tr.spd * stepDt;
        if (tr.dir > 0 && tr.x > 1.15) tr.x = -0.15;
        if (tr.dir < 0 && tr.x < -0.15) tr.x = 1.15;
        const tx = tr.x * W;
        const ty = deckY + tr.laneOffset;
        ctx.fillStyle = tr.isTail ? 'rgba(127, 29, 29, 0.18)' : 'rgba(180, 145, 85, 0.14)';
        ctx.fillRect(tx - tr.len, ty - 1, tr.len * 2, 1.8);
      }

      if (fogSprite) {
        for (const sp of this._steamPlumes) {
          sp.life += sp.spd * stepDt;
          if (sp.life >= 1) sp.life -= 1;
          const sx = (sp.x + sp.drift * sp.life) * W + offX * 0.45;
          const sy = H * 0.95 - sp.life * H * 0.17;
          const r = sp.rad * (0.65 + sp.life * 1.15);
          ctx.globalAlpha = Math.sin(sp.life * Math.PI) * 0.18;
          ctx.drawImage(fogSprite, sx - r, sy - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }

      const wetY = H * 0.91;
      const wetGrad = ctx.createLinearGradient(0, wetY, 0, H);
      wetGrad.addColorStop(0, 'rgba(2, 3, 6, 0.65)');
      wetGrad.addColorStop(1, '#010103');
      ctx.fillStyle = wetGrad;
      ctx.fillRect(0, wetY, W, H - wetY);

      // 6. Chuva Diagonal Fria em UM ÚNICO beginPath() + stroke()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
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
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - rd.len * 0.24, ry + rd.len);
      }
      ctx.stroke();
    }
  });
}
