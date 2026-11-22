import { soundFX } from '../../audio/SoundFX.js';
import { FACTION_DATA } from '../FactionIconsAndSaveSystem.js';
import { HERO_HUD_THEMES, definePrototypeMethods } from './HudConstantsAndPortraits.js';

const SVG_HEAD =
  '<svg class="qe-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">';

export const ABILITY_SVG_ICONS = {
  barricade: `${SVG_HEAD}<polygon points="3,9 21,9 22,17 2,17"/><line x1="6" y1="17" x2="6" y2="21"/><line x1="18" y1="17" x2="18" y2="21"/><line x1="7" y1="9" x2="10" y2="17"/><line x1="14" y1="9" x2="17" y2="17"/></svg>`,
  rocket: `${SVG_HEAD}<polygon points="19,5 15,5 7,13 11,17 19,9"/><polyline points="7,13 4,14 5,17"/><polyline points="11,17 10,20 7,19"/><line x1="4" y1="20" x2="7" y2="17"/></svg>`,
  cross: `${SVG_HEAD}<polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9" fill="currentColor" fill-opacity="0.18"/></svg>`,
  flare: `${SVG_HEAD}<line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="9" y2="9"/><line x1="15" y1="15" x2="19" y2="19"/><line x1="19" y1="5" x2="15" y2="9"/><polygon points="12,9 15,12 12,15 9,12" fill="currentColor"/></svg>`,
  crate: `${SVG_HEAD}<polygon points="4,7 20,7 21,19 3,19"/><polyline points="7,7 9,4 15,4 17,7"/><line x1="3" y1="12" x2="21" y2="12"/><rect x="10" y="10" width="4" height="4" fill="currentColor"/></svg>`,
  c4: `${SVG_HEAD}<rect x="4" y="8" width="16" height="11"/><line x1="9" y1="8" x2="9" y2="19"/><line x1="15" y1="8" x2="15" y2="19"/><line x1="12" y1="8" x2="12" y2="3"/><polyline points="9,4 12,2 15,4"/><rect x="10" y="11" width="4" height="3" fill="currentColor"/></svg>`,
  shield: `${SVG_HEAD}<polygon points="5,3 19,3 20,12 12,21 4,12" fill="currentColor" fill-opacity="0.14"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="12" y1="12" x2="12" y2="18"/></svg>`,
  charge: `${SVG_HEAD}<polyline points="4,6 11,12 4,18"/><polyline points="11,5 19,12 11,19"/><line x1="2" y1="12" x2="18" y2="12"/></svg>`,
  dome: `${SVG_HEAD}<polygon points="3,18 6,9 12,5 18,9 21,18" fill="currentColor" fill-opacity="0.14"/><line x1="2" y1="18" x2="22" y2="18"/><line x1="12" y1="5" x2="12" y2="18"/><line x1="5" y1="13" x2="19" y2="13"/></svg>`,
  drone: `${SVG_HEAD}<polygon points="9,10 15,10 17,13 15,15 9,15 7,13" fill="currentColor" fill-opacity="0.2"/><line x1="7" y1="10" x2="3" y2="6"/><line x1="17" y1="10" x2="21" y2="6"/><line x1="2" y1="6" x2="6" y2="6"/><line x1="18" y1="6" x2="22" y2="6"/><line x1="12" y1="15" x2="12" y2="19"/></svg>`,
  eye_off: `${SVG_HEAD}<polygon points="2,12 8,6 16,6 22,12 16,18 8,18"/><polygon points="12,9 15,12 12,15 9,12" fill="currentColor"/><line x1="3" y1="21" x2="21" y2="3"/></svg>`,
  pulse: `${SVG_HEAD}<polygon points="12,2 22,12 12,22 2,12"/><polygon points="12,7 17,12 12,17 7,12" fill="currentColor" fill-opacity="0.24"/><rect x="11" y="11" width="2" height="2" fill="currentColor"/></svg>`,
  roll: `${SVG_HEAD}<polyline points="15,4 20,8 15,12"/><polyline points="20,8 8,8 4,13 7,19 17,19"/></svg>`,
  solar: `${SVG_HEAD}<polygon points="12,6 16,8 18,12 16,16 12,18 8,16 6,12 8,8" fill="currentColor" fill-opacity="0.24"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>`,
  quake: `${SVG_HEAD}<polyline points="2,18 7,18 10,9 13,20 16,12 18,18 22,18"/><line x1="6" y1="6" x2="8" y2="9"/><line x1="18" y1="5" x2="16" y2="9"/></svg>`,
  weapons: `${SVG_HEAD}<line x1="4" y1="20" x2="19" y2="5"/><polyline points="14,5 19,5 19,10"/><line x1="20" y1="20" x2="5" y2="5"/><polyline points="10,5 5,5 5,10"/></svg>`,
  katana: `${SVG_HEAD}<line x1="3" y1="21" x2="20" y2="4"/><line x1="6" y1="14" x2="10" y2="18"/><line x1="21" y1="21" x2="4" y2="4"/><line x1="14" y1="18" x2="18" y2="14"/></svg>`,
  bike: `${SVG_HEAD}<polygon points="3,16 6,12 10,16 6,20"/><polygon points="14,16 18,12 21,16 18,20"/><polyline points="6,16 11,9 16,9 18,16"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`,
  bolt: `${SVG_HEAD}<polygon points="13,2 4,14 11,14 10,22 20,10 13,10" fill="currentColor" fill-opacity="0.24"/></svg>`,
  tentacle: `${SVG_HEAD}<polyline points="4,21 6,13 3,7 7,3"/><polyline points="12,21 12,11 15,6 12,2"/><polyline points="20,21 18,14 21,8 17,4"/></svg>`,
  star: `${SVG_HEAD}<polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" fill="currentColor" fill-opacity="0.2"/></svg>`
};

const mkLoadout = (faction, accent, qIcon, qLabel, qCooldown, eIcon, eLabel, eCooldown, inMag, reserve, isEnergyInfinite = false) => ({
  faction, accent, qIcon, qLabel, qCooldown, eIcon, eLabel, eCooldown,
  inMag, magSize: Math.max(1, inMag), reserve, isEnergyInfinite
});

export const MOCK_OPERATOR_HUD_LOADOUTS = {
  cv_marretao: mkLoadout('cv', '#dc2626', 'barricade', 'BARRICADA PESADA', 14, 'rocket', 'DISPARO RPG', 18, 65, 260),
  cv_fogueteira: mkLoadout('cv', '#dc2626', 'cross', 'KIT PARAMÉDICO', 15, 'flare', 'ROJÃO DE ALERTA', 12, 32, 160),
  pcc_contador: mkLoadout('pcc', '#3b82f6', 'crate', 'CAIXA DE MUNIÇÃO', 16, 'c4', 'CARGA C4 REMOTA', 14, 30, 150),
  pcc_muralha: mkLoadout('pcc', '#3b82f6', 'shield', 'ESCUDO BALÍSTICO', 12, 'charge', 'INVESTIDA DE CHOQUE', 15, 10, 60),
  ares_bastiao: mkLoadout('ares', '#a855f7', 'dome', 'DOMO ENERGÉTICO', 18, 'drone', 'DRONE DE ASSALTO', 20, 80, 320),
  ares_agulha: mkLoadout('ares', '#a855f7', 'eye_off', 'CAMUFLAGEM ÓPTICA', 16, 'pulse', 'PULSO EMP', 18, 8, 48),
  caveira: mkLoadout(null, '#d99b16', 'roll', 'ROLAMENTO TÁTICO', 4, 'shield', 'REFORÇO BLINDADO', 22, 30, 150),
  solaris: mkLoadout(null, '#ea580c', 'solar', 'SUPERNOVA', 16, 'flare', 'RAIO SOLAR', 10, 0, 0, true),
  tita: mkLoadout(null, '#64748b', 'quake', 'TERREMOTO', 12, 'charge', 'SOCO FOGUETE', 10, 100, 400),
  vingador: mkLoadout(null, '#b91c1c', 'weapons', 'FUROR DE CHUMBO', 16, 'rocket', 'SALVA EXPLOSIVA', 14, 40, 200),
  sombra: mkLoadout(null, '#dc2626', 'katana', 'BOMBA DE FUMAÇA', 12, 'eye_off', 'PASSO FURTIVO', 9, 0, 0, true),
  turbo: mkLoadout(null, '#06b6d4', 'bike', 'MURALHA DE LUZ', 14, 'charge', 'MOTO TURBO', 8, 0, 0, true),
  voltaico: mkLoadout(null, '#38bdf8', 'bolt', 'TEMPESTADE EM CADEIA', 13, 'pulse', 'PULSO EMP', 15, 0, 0, true),
  vortex: mkLoadout(null, '#9333ea', 'tentacle', 'ERUPÇÃO SIMBIONTE', 14, 'quake', 'FORMA COLOSSO', 6, 0, 0, true),
  op09: mkLoadout(null, '#22c55e', 'star', 'SUPREMO OP-09', 16, 'bolt', 'PODER SECUNDÁRIO', 10, 0, 0, true)
};

export function playAbilityReadyPing() {
  try {
    const ctx = soundFX?._ensureContext?.();
    if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return false;
    const now = Number(ctx.currentTime) || 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1175, now + 0.055);
    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);
    osc.connect(gain);
    gain.connect(soundFX.sfxBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.058);
    return true;
  } catch (_) {
    return false;
  }
}

function obtainHudNode(tag, id, ...classes) {
  if (typeof document === 'undefined') return null;
  let el = id && typeof document.getElementById === 'function' ? document.getElementById(id) : null;
  if (!el && typeof document.createElement === 'function') {
    el = document.createElement(tag);
    if (id) el.id = id;
  }
  if (el?.classList) classes.forEach((cls) => cls && el.classList.add(cls));
  return el;
}

function buildAbilitySlotDom(slotId, keyChar) {
  const box = obtainHudNode('div', slotId, 'qe-ability-box', 'is-ready');
  if (!box) return null;
  box.innerHTML = '';
  if (Array.isArray(box.children)) box.children.length = 0;

  const sweep = document.createElement('div');
  sweep.classList.add('qe-cooldown-sweep');
  const iconWrap = document.createElement('span');
  iconWrap.classList.add('qe-icon-wrap');
  const timerTxt = document.createElement('span');
  timerTxt.classList.add('qe-timer-txt');
  const keyTag = document.createElement('kbd');
  keyTag.classList.add('qe-key-tag');
  keyTag.textContent = keyChar;

  box.appendChild(sweep);
  box.appendChild(iconWrap);
  box.appendChild(timerTxt);
  box.appendChild(keyTag);
  return { box, sweep, iconWrap, timerTxt, keyTag };
}

export function installAbilityCooldownHud(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initAbilityCooldownHud() {
      if (typeof document === 'undefined') return;
      const qeRow = obtainHudNode('div', 'hud-qe-cooldowns', 'hud-qe-row');
      if (!qeRow) return;
      qeRow.innerHTML = '';
      if (Array.isArray(qeRow.children)) qeRow.children.length = 0;

      const slotQ = buildAbilitySlotDom('hud-slot-q', 'Q');
      const slotE = buildAbilitySlotDom('hud-slot-e', 'E');
      const ammoWrap = obtainHudNode('div', 'hud-ammo-counter', 'hud-ammo-counter');
      ammoWrap.innerHTML = '';
      if (Array.isArray(ammoWrap.children)) ammoWrap.children.length = 0;

      const digitsRow = document.createElement('div');
      digitsRow.classList.add('ammo-digits-row');
      const magEl = obtainHudNode('span', 'hud-ammo-mag', 'ammo-mag');
      magEl.textContent = '30';
      const sepEl = document.createElement('span');
      sepEl.classList.add('ammo-sep');
      sepEl.textContent = '/';
      const reserveEl = obtainHudNode('span', 'hud-ammo-reserve', 'ammo-reserve');
      reserveEl.textContent = '150';
      digitsRow.appendChild(magEl);
      digitsRow.appendChild(sepEl);
      digitsRow.appendChild(reserveEl);

      const reloadTag = document.createElement('span');
      reloadTag.classList.add('ammo-reload-tag');
      reloadTag.textContent = 'RECARREGANDO';
      const microBar = document.createElement('div');
      microBar.classList.add('ammo-micro-bar');
      const microFill = document.createElement('div');
      microFill.classList.add('ammo-micro-fill');
      microBar.appendChild(microFill);

      ammoWrap.appendChild(digitsRow);
      ammoWrap.appendChild(reloadTag);
      ammoWrap.appendChild(microBar);
      qeRow.appendChild(slotQ.box);
      qeRow.appendChild(slotE.box);
      qeRow.appendChild(ammoWrap);

      if (this.abilityStripEl?.classList) this.abilityStripEl.classList.add('hidden');
      const rightCol =
        this.hpBarWrapEl?.parentElement ||
        this.abilityStripEl?.parentElement ||
        (typeof this.operatorChassisEl?.querySelector === 'function'
          ? this.operatorChassisEl.querySelector('.hud-right-col')
          : null) ||
        this.operatorChassisEl;
      if (rightCol && !qeRow.parentElement) {
        if (this.abilityStripEl?.parentElement === rightCol && typeof rightCol.insertBefore === 'function') {
          rightCol.insertBefore(qeRow, this.abilityStripEl);
        } else if (typeof rightCol.appendChild === 'function') {
          rightCol.appendChild(qeRow);
        }
      }

      this.qeRowEl = qeRow;
      this.slotQEl = slotQ.box;
      this.slotEEl = slotE.box;
      this.slotQRefs = slotQ;
      this.slotERefs = slotE;
      this.ammoCounterEl = ammoWrap;
      this.ammoMagEl = magEl;
      this.ammoReserveEl = reserveEl;
      this.ammoMicroFillEl = microFill;
      this._qeHudState = {
        accent: '',
        q: { icon: '', label: '', isCooling: false, isActive: false, pct: '100%', txt: '', pulseTimer: null },
        e: { icon: '', label: '', isCooling: false, isActive: false, pct: '100%', txt: '', pulseTimer: null },
        ammo: { visible: null, mag: '', reserve: '', low: false, reloading: false, charging: false, barPct: '' }
      };
      this.configureAbilityHudForCharacter(this.currentHeroKey || 'caveira');
    },

    configureAbilityHudForCharacter(charKey, customDescriptor = null) {
      if (!this.qeRowEl) this._initAbilityCooldownHud();
      if (!this.qeRowEl || !this._qeHudState) return;

      const base = MOCK_OPERATOR_HUD_LOADOUTS[charKey] || MOCK_OPERATOR_HUD_LOADOUTS.caveira;
      const desc = customDescriptor ? { ...base, ...customDescriptor } : base;
      const factionId = desc.faction || this.playerFaction;
      const accent =
        customDescriptor?.accent ||
        FACTION_DATA[factionId]?.color ||
        desc.accent ||
        HERO_HUD_THEMES[charKey]?.accent ||
        '#dc2626';

      if (this._qeHudState.accent !== accent) {
        this._qeHudState.accent = accent;
        this.qeRowEl.style?.setProperty?.('--qe-accent', accent);
      }

      const slots = [
        ['q', this.slotQRefs, desc.q?.icon || desc.qIcon || 'roll', desc.q?.label || desc.qLabel || 'HABILIDADE Q', 'Q'],
        ['e', this.slotERefs, desc.e?.icon || desc.eIcon || 'shield', desc.e?.label || desc.eLabel || 'HABILIDADE E', 'E']
      ];
      for (const [key, refs, iconKey, label, keyChar] of slots) {
        const st = this._qeHudState[key];
        if (st.pulseTimer) {
          clearTimeout(st.pulseTimer);
          st.pulseTimer = null;
        }
        refs.box.classList.remove('just-ready-pulse', 'is-cooling', 'is-active-buff');
        refs.box.classList.add('is-ready');
        refs.box.style?.setProperty?.('--cd-pct', '100%');
        refs.sweep.style?.setProperty?.('--cd-pct', '100%');
        refs.timerTxt.textContent = '';
        Object.assign(st, { isCooling: false, isActive: false, pct: '100%', txt: '' });
        if (st.icon !== iconKey) {
          st.icon = iconKey;
          refs.iconWrap.innerHTML = ABILITY_SVG_ICONS[iconKey] || ABILITY_SVG_ICONS.star;
        }
        const fullLabel = `[${keyChar}] ${label}`;
        if (st.label !== fullLabel) {
          st.label = fullLabel;
          refs.box.title = fullLabel;
          if (typeof refs.box.setAttribute === 'function') refs.box.setAttribute('aria-label', fullLabel);
        }
      }

      const isEnergyInfinite = Boolean(desc.isEnergyInfinite ?? (desc.showAmmo === false));
      this.updateWeaponAmmoHud({
        inMag: desc.ammo?.inMag ?? desc.inMag ?? 30,
        magSize: desc.ammo?.magSize ?? desc.magSize ?? 30,
        reserve: desc.ammo?.reserve ?? desc.reserve ?? 120,
        isReloading: false,
        reloadProgress: 0,
        showAmmo: !isEnergyInfinite,
        chargeRatio: 0
      });
    },

    updateAbilityCooldowns({
      qRemaining = 0, qTotal = 0, qActive = false,
      eRemaining = 0, eTotal = 0, eActive = false
    } = {}) {
      if (!this.qeRowEl) this._initAbilityCooldownHud();
      if (!this._qeHudState) return;
      this._syncSingleAbilitySlot('q', this.slotQRefs, qRemaining, qTotal, qActive);
      this._syncSingleAbilitySlot('e', this.slotERefs, eRemaining, eTotal, eActive);
    },

    _syncSingleAbilitySlot(slotKey, refs, remRaw, totRaw, activeRaw) {
      if (!refs?.box) return;
      const st = this._qeHudState[slotKey];
      const rem = Math.max(0, Number(remRaw) || 0);
      const tot = Math.max(0, Number(totRaw) || 0);
      const isCooling = rem > 0.001;
      const isActive = Boolean(activeRaw);
      const wasCooling = st.isCooling;

      const pctNum = isCooling
        ? (tot > 0.001 ? Math.max(0, Math.min(100, ((tot - rem) / tot) * 100)) : 0)
        : 100;
      const pctStr = `${pctNum.toFixed(1)}%`;
      const txtStr = isCooling ? (rem >= 10 ? String(Math.ceil(rem)) : rem.toFixed(1)) : '';

      if (wasCooling !== isCooling) {
        st.isCooling = isCooling;
        refs.box.classList.toggle('is-cooling', isCooling);
        refs.box.classList.toggle('is-ready', !isCooling);
        if (wasCooling && !isCooling) {
          refs.box.classList.add('just-ready-pulse');
          if (st.pulseTimer) clearTimeout(st.pulseTimer);
          st.pulseTimer = setTimeout(() => {
            refs.box.classList.remove('just-ready-pulse');
            st.pulseTimer = null;
          }, 260);
          st.pulseTimer?.unref?.();
          playAbilityReadyPing();
        }
      }
      if (st.isActive !== isActive) {
        st.isActive = isActive;
        refs.box.classList.toggle('is-active-buff', isActive);
      }
      if (st.pct !== pctStr) {
        st.pct = pctStr;
        refs.box.style?.setProperty?.('--cd-pct', pctStr);
        refs.sweep.style?.setProperty?.('--cd-pct', pctStr);
      }
      if (st.txt !== txtStr) {
        st.txt = txtStr;
        refs.timerTxt.textContent = txtStr;
      }
    },

    updateWeaponAmmoHud({
      inMag = 30, magSize = 30, reserve = 120,
      isReloading = false, reloadProgress = 0, showAmmo = true, chargeRatio = 0, isEnergyInfinite = false
    } = {}) {
      if (!this.qeRowEl) this._initAbilityCooldownHud();
      if (!this.ammoCounterEl || !this._qeHudState) return;

      const st = this._qeHudState.ammo;
      const visible = !isEnergyInfinite && Boolean(showAmmo);
      if (st.visible !== visible) {
        st.visible = visible;
        this.ammoCounterEl.classList.toggle('hidden', !visible);
        this.ammoCounterEl.classList.toggle('is-energy-infinite', !visible);
      }
      if (!visible) return;

      const magVal = Math.max(0, Math.floor(Number(inMag) || 0));
      const maxMag = Math.max(1, Math.floor(Number(magSize) || 1));
      const resVal = Math.max(0, Math.floor(Number(reserve) || 0));
      const magStr = String(magVal);
      const resStr = String(resVal);
      const isLow = magVal <= Math.ceil(maxMag * 0.25);
      const bReload = Boolean(isReloading);
      const cRatio = Math.max(0, Math.min(1, Number(chargeRatio) || 0));
      const rRatio = Math.max(0, Math.min(1, Number(reloadProgress) || 0));
      const bCharging = !bReload && cRatio > 0.005;
      const barPct = `${((bReload ? (rRatio > 0 ? rRatio : 1) : cRatio) * 100).toFixed(1)}%`;

      if (st.mag !== magStr) {
        st.mag = magStr;
        this.ammoMagEl.textContent = magStr;
      }
      if (st.reserve !== resStr) {
        st.reserve = resStr;
        this.ammoReserveEl.textContent = resStr;
      }
      if (st.low !== isLow) {
        st.low = isLow;
        this.ammoCounterEl.classList.toggle('low-ammo', isLow);
      }
      if (st.reloading !== bReload) {
        st.reloading = bReload;
        this.ammoCounterEl.classList.toggle('is-reloading', bReload);
      }
      if (st.charging !== bCharging) {
        st.charging = bCharging;
        this.ammoCounterEl.classList.toggle('is-charging', bCharging);
      }
      if ((bReload || bCharging) && st.barPct !== barPct) {
        st.barPct = barPct;
        this.ammoMicroFillEl.style.width = barPct;
        this.ammoMicroFillEl.style?.setProperty?.('--ammo-bar-pct', barPct);
      }
    }
  });
}
