/**
 * Sintetizador de efeitos sonoros estilo LEGO via Web Audio API (zero dependências externas)
 */
class SoundFX {
  constructor() {
    this.ctx = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.masterVolume = 0.85;
    this.musicVolume = 0.55;
    this.sfxVolume = 0.9;
    this.isMusicPlaying = false;
    this.isBossMusicActive = false;
    this._musicInterval = null;
    this._musicStep = 0;
    this.baileFunkMix = 0;
    this.baileBeatPulse = 0;
    this.tiktokRadioActive = false;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus.connect(this.ctx.destination);
        this.musicBus.connect(this.ctx.destination);
        this._applyBusVolumes();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _applyBusVolumes() {
    if (!this.ctx) return;
    if (this.sfxBus) {
      this.sfxBus.gain.setValueAtTime(
        Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume)),
        this.ctx.currentTime
      );
    }
    if (this.musicBus) {
      this.musicBus.gain.setValueAtTime(
        Math.max(0, Math.min(1, this.masterVolume * this.musicVolume)),
        this.ctx.currentTime
      );
    }
  }

  setVolumes({ masterVolume, musicVolume, sfxVolume } = {}) {
    if (typeof masterVolume === 'number') this.masterVolume = Math.max(0, Math.min(1, masterVolume));
    if (typeof musicVolume === 'number') this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    if (typeof sfxVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    this._applyBusVolumes();
  }

  playStudCollect(value = 10) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq =
      value >= 10000 ? 1320 :
      value >= 1000 ? 1100 :
      value >= 100 ? 920 : 780;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.065);

    osc2.frequency.setValueAtTime(baseFreq * 2.0, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + 0.14);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.015);
    osc1.stop(now + 0.17);
    osc2.stop(now + 0.17);
  }

  playPlasticHit() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(280 + Math.random() * 90, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.06);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  playMetalRicochet() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playLegoBreak(isBig = false) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clatterCount = isBig ? 9 : 6;

    for (let i = 0; i < clatterCount; i++) {
      const delay = i * 0.028 + Math.random() * 0.015;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i % 2 === 0 ? 'triangle' : 'square';
      const f = (isBig ? 240 : 340) + Math.random() * 480;
      osc.frequency.setValueAtTime(f, now + delay);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, now + delay + 0.055);

      gain.gain.setValueAtTime(0.1, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.065);
    }
  }

  /**
   * Som de disparo do Fuzil Tático do Comandante Caveira
   */
  playRifleShot() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.075);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
  }

  /**
   * Som de disparo em altíssima cadência da Minigun Vulcan de 6 Canos do Titã Blindado (PMESP)
   */
  playMinigunShot() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(290 + Math.random() * 75, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.042);

    subOsc.type = 'square';
    subOsc.frequency.setValueAtTime(135 + Math.random() * 25, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.042);

    gain.gain.setValueAtTime(0.095, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.048);
    subOsc.stop(now + 0.048);
  }

  /**
   * Som de Pisada Sísmica Pesada [Q] do Titã Blindado esmagando o asfalto
   */
  playSeismicStomp() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const crunchOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.48);

    crunchOsc.type = 'square';
    crunchOsc.frequency.setValueAtTime(185, now);
    crunchOsc.frequency.exponentialRampToValueAtTime(34, now + 0.36);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    crunchOsc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    crunchOsc.start(now);
    osc.stop(now + 0.52);
    crunchOsc.stop(now + 0.4);
  }

  /**
   * Som de disparo de Bola de Fogo do Solaris
   */
  playFireballCast() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Som de Explosão (Granada do Caveira / Bola de Fogo / Supernova)
   */
  playExplosion(scale = 1.0) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.38 * scale;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + duration);

    gain.gain.setValueAtTime(Math.min(0.26, 0.18 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Rugido Termonuclear Grave e Potente do Feixe Solar Imperial (Mouse 2 do Solaris)
   * Substitui o apito agudo antigo por grave de plasma sawtooth (95Hz–130Hz) + harmônico médio (220Hz–310Hz)
   */
  playSolarBeamTick() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bassOsc = ctx.createOscillator();
    const plasmaOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    bassOsc.type = 'sawtooth';
    const bassFreq = 95 + Math.random() * 35;
    bassOsc.frequency.setValueAtTime(bassFreq, now);
    bassOsc.frequency.exponentialRampToValueAtTime(68, now + 0.095);

    plasmaOsc.type = 'triangle';
    const midFreq = 220 + Math.random() * 90;
    plasmaOsc.frequency.setValueAtTime(midFreq, now);
    plasmaOsc.frequency.exponentialRampToValueAtTime(165, now + 0.095);

    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    bassOsc.connect(gain);
    plasmaOsc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    bassOsc.start(now);
    plasmaOsc.start(now);
    bassOsc.stop(now + 0.105);
    plasmaOsc.stop(now + 0.105);
  }

  /**
   * Pulso Crescente de Carregamento da Supernova [Q] do Solaris (0% -> 100%)
   */
  playSolarChargeTick(chargeRatio = 0) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseF = 110 + chargeRatio * 340;
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseF, now);
    osc1.frequency.exponentialRampToValueAtTime(baseF * 1.18, now + 0.09);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseF * 1.5, now);
    osc2.frequency.exponentialRampToValueAtTime(baseF * 1.85, now + 0.09);

    gain.gain.setValueAtTime(0.065 + chargeRatio * 0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.1);
    osc2.stop(now + 0.1);
  }

  /**
   * Som de Rolamento Tático / Esquiva
   */
  playTacticalRoll() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.24);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Som de Troca Instantânea de Herói (Tab / 1 / 2)
   */
  playHeroSwap() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [440, 660, 880];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  playPunchSwing() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  playTrueHeroFanfare() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.29);
    });
  }

  /**
   * Som de partida de motor / ignição ao entrar no veículo com [E]
   */
  playCarEngineStart() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.28);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.31);
  }

  /**
   * Som de Disparo de Plasma Ciano / Descarga Elétrica / Chicote Energético (Turbo, Voltaico e Vórtex)
   */
  playLaserShot() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(920 + Math.random() * 180, now);
    osc1.frequency.exponentialRampToValueAtTime(115, now + 0.14);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(480 + Math.random() * 90, now);
    osc2.frequency.exponentialRampToValueAtTime(65, now + 0.14);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.155);
    osc2.stop(now + 0.155);
  }

  /**
   * Som de pulso de câmera de satélite estilo GTA V (Zoom Out / Zoom In em etapas)
   */
  playSatelliteZoomStep(isDown = false, step = 1) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Grave de impacto de lente + bip de telemetria orbital
    const bassOsc = ctx.createOscillator();
    const pingOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    bassOsc.type = 'triangle';
    pingOsc.type = 'sine';

    const basePitch = isDown ? 520 + step * 140 : 880 - step * 140;
    bassOsc.frequency.setValueAtTime(110, now);
    bassOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    pingOsc.frequency.setValueAtTime(basePitch, now);
    pingOsc.frequency.exponentialRampToValueAtTime(basePitch * (isDown ? 1.18 : 0.82), now + 0.12);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    bassOsc.connect(gain);
    pingOsc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);

    bassOsc.start(now);
    pingOsc.start(now);
    bassOsc.stop(now + 0.16);
    pingOsc.stop(now + 0.16);
  }

  /**
   * Buzina de Trânsito Urbano (Duplo tom automotivo ou Sirene curta policial YELP)
   */
  playCarHorn(volumeScale = 1.0, isPoliceSiren = false) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const vol = Math.max(0.015, Math.min(0.14, 0.11 * volumeScale));
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isPoliceSiren) {
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(640, now);
      osc1.frequency.exponentialRampToValueAtTime(1280, now + 0.14);
      osc1.frequency.exponentialRampToValueAtTime(660, now + 0.28);

      osc2.frequency.setValueAtTime(648, now);
      osc2.frequency.exponentialRampToValueAtTime(1292, now + 0.14);
      osc2.frequency.exponentialRampToValueAtTime(668, now + 0.28);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.31);
      osc2.stop(now + 0.31);
    } else {
      const f1 = 370 + Math.random() * 45;
      const f2 = f1 * 1.25;
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(f1, now);
      osc2.frequency.setValueAtTime(f2, now);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.setValueAtTime(vol * 0.9, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    }
  }

  /**
   * Disparo Espacial Atenuado por Distância dos NPCs (BOPE, CV, PCC e A.R.E.S.)
   */
  playNpcGunshot(faction = 'cv', isRpg = false, volumeScale = 1.0) {
    const ctx = this._ensureContext();
    if (!ctx || volumeScale <= 0.02) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = Math.max(0.01, Math.min(0.11, 0.095 * volumeScale));

    if (isRpg) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.19);
      gain.gain.setValueAtTime(vol * 1.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
      return;
    }

    if (faction === 'ares') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(840 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(135, now + 0.09);
    } else if (faction === 'cv') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340 + Math.random() * 55, now);
      osc.frequency.exponentialRampToValueAtTime(72, now + 0.075);
    } else if (faction === 'pcc') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(460 + Math.random() * 70, now);
      osc.frequency.exponentialRampToValueAtTime(98, now + 0.065);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(410 + Math.random() * 50, now);
      osc.frequency.exponentialRampToValueAtTime(88, now + 0.07);
    }

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Sirene Tática de Alerta de Evento Urbano / Esquadrão de Elite
   */
  playRadioAlertSiren() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880.0, 587.33, 1174.66];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.095;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.095);
    });
  }

  /**
   * Som cristalino do Feixe de Cura Médico (Heal Beam estilo Girassol/Cientista PvZ GW2)
   */
  playHealTick() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseF = 660 + Math.random() * 220;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.35, now + 0.11);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.125);
  }

  /**
   * GROOVE URBANO SOLAR & HEROICO ESTILO LEGO MARVEL ("MANHATTAN FREE ROAM THEME")
   * Sequenciador leve em Dó Maior / Sol Mixolídio (115 BPM): baixo elétrico saltitante,
   * acordes solares suaves de piano elétrico e melodia aventureira para passear e voar pela cidade!
   */
  startWarMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this._musicStep = 0;

    if (this._musicInterval) {
      clearInterval(this._musicInterval);
    }

    // 115 BPM -> semicolcheia suave a cada 130ms
    this._musicInterval = setInterval(() => {
      if (!this.isMusicPlaying || this.masterVolume * this.musicVolume <= 0.01) return;
      const ctx = this._ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const step = this._musicStep % 32;
      this._musicStep++;
      const now = ctx.currentTime;
      const dest = this.musicBus || ctx.destination;

      if (this.tiktokRadioActive) return;

      const baileMix = Math.max(0, Math.min(1, this.baileFunkMix || 0));
      const cityMix = Math.max(0, 1.0 - baileMix * 0.92);

      // ======================================================================
      // A) BATIDÃO INSTRUMENTAL FUNK CARIOCA LEGO (PAREDÃO DA CDD — ATÉ 75m!)
      // ======================================================================
      if (baileMix > 0.02) {
        const s16 = step % 16;

        // 1. Bumbo Grave 808 Encorpado do Paredão ("BOOM ... BOOM-BOOM")
        if (s16 === 0 || s16 === 6 || s16 === 10 || s16 === 14) {
          this.baileBeatPulse = 1.0;
          const subOsc = ctx.createOscillator();
          const punchOsc = ctx.createOscillator();
          const subGain = ctx.createGain();
          subOsc.type = 'sine';
          punchOsc.type = 'triangle';
          const root808 = step < 16 ? 55.0 : 49.0; // A1 -> G1
          subOsc.frequency.setValueAtTime(142, now);
          subOsc.frequency.exponentialRampToValueAtTime(root808, now + 0.055);
          punchOsc.frequency.setValueAtTime(195, now);
          punchOsc.frequency.exponentialRampToValueAtTime(root808 * 1.5, now + 0.045);

          subGain.gain.setValueAtTime(0.32 * baileMix, now);
          subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
          subOsc.connect(subGain);
          punchOsc.connect(subGain);
          subGain.connect(dest);
          subOsc.start(now);
          punchOsc.start(now);
          subOsc.stop(now + 0.22);
          punchOsc.stop(now + 0.08);
        }

        // 2. Tamborim Carioca Sincopado ("Telecoteco" clássico do Tamborzão!)
        if (s16 === 2 || s16 === 3 || s16 === 7 || s16 === 11 || s16 === 12 || s16 === 15) {
          const tambOsc = ctx.createOscillator();
          const tambGain = ctx.createGain();
          tambOsc.type = s16 % 2 === 0 ? 'square' : 'triangle';
          const fStart = s16 === 3 || s16 === 12 ? 880 : 740;
          tambOsc.frequency.setValueAtTime(fStart, now);
          tambOsc.frequency.exponentialRampToValueAtTime(360, now + 0.048);
          tambGain.gain.setValueAtTime(0.11 * baileMix, now);
          tambGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
          tambOsc.connect(tambGain);
          tambGain.connect(dest);
          tambOsc.start(now);
          tambOsc.stop(now + 0.06);
        }

        // 3. Riff de Metais / Synth Funk Carioca Divertido Estilo LEGO
        const funkHook = [
          440.0, 0, 0, 523.25, 0, 0, 587.33, 0,
          523.25, 0, 440.0, 0, 392.0, 0, 440.0, 0
        ];
        const hookFreq = funkHook[s16];
        if (hookFreq > 0) {
          const hOsc = ctx.createOscillator();
          const hGain = ctx.createGain();
          hOsc.type = 'sawtooth';
          hOsc.frequency.setValueAtTime(hookFreq, now);
          hGain.gain.setValueAtTime(0.068 * baileMix, now);
          hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          hOsc.connect(hGain);
          hGain.connect(dest);
          hOsc.start(now);
          hOsc.stop(now + 0.13);
        }
      }

      if (cityMix <= 0.03) return;

      // 1. Batida Urbana Suave (Groove leve de passeio sem peso militar)
      if (step === 0 || step === 6 || step === 10 || step === 16 || step === 22 || step === 26) {
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(108, now);
        kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.095);
        kickGain.gain.setValueAtTime(0.13 * cityMix, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
        kickOsc.connect(kickGain);
        kickGain.connect(dest);
        kickOsc.start(now);
        kickOsc.stop(now + 0.11);
      }

      // Rim / Clap suave nos tempos 4, 12, 20, 28 + Hi-hat leve nos pares
      if (step % 8 === 4) {
        const rimOsc = ctx.createOscillator();
        const rimGain = ctx.createGain();
        rimOsc.type = 'triangle';
        rimOsc.frequency.setValueAtTime(340, now);
        rimOsc.frequency.exponentialRampToValueAtTime(155, now + 0.055);
        rimGain.gain.setValueAtTime(0.055 * cityMix, now);
        rimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        rimOsc.connect(rimGain);
        rimGain.connect(dest);
        rimOsc.start(now);
        rimOsc.stop(now + 0.065);
      } else if (step % 2 === 0) {
        const hatOsc = ctx.createOscillator();
        const hatGain = ctx.createGain();
        hatOsc.type = 'sine';
        hatOsc.frequency.setValueAtTime(1480 + (step % 4) * 120, now);
        hatGain.gain.setValueAtTime(0.016 * cityMix, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
        hatOsc.connect(hatGain);
        hatGain.connect(dest);
        hatOsc.start(now);
        hatOsc.stop(now + 0.032);
      }

      // 2. Acordes Solares Alegres (C Major -> G Major -> F Major7 -> G6)
      if (step % 8 === 0) {
        const chordBank = [
          [261.63, 329.63, 392.0], // C4 - E4 - G4
          [246.94, 293.66, 392.0], // B3 - D4 - G4
          [261.63, 349.23, 440.0], // C4 - F4 - A4
          [293.66, 392.0, 493.88]  // D4 - G4 - B4
        ];
        const chord = chordBank[Math.floor(step / 8) % 4];
        for (const freq of chord) {
          const chOsc = ctx.createOscillator();
          const chGain = ctx.createGain();
          chOsc.type = 'sine';
          chOsc.frequency.setValueAtTime(freq, now);
          chGain.gain.setValueAtTime(0.032 * cityMix, now);
          chGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
          chOsc.connect(chGain);
          chGain.connect(dest);
          chOsc.start(now);
          chOsc.stop(now + 0.44);
        }
      }

      // 3. Linha de Baixo Leve & Saltitante (Funky Urban Groove em Dó Maior)
      const bassPattern = [
        130.81, 0, 130.81, 164.81, 196.0, 0, 164.81, 146.83,
        98.0, 0, 98.0, 123.47, 146.83, 0, 164.81, 146.83,
        87.31, 0, 87.31, 110.0, 130.81, 0, 146.83, 130.81,
        98.0, 0, 123.47, 0, 146.83, 164.81, 196.0, 0
      ];
      const bassFreq = bassPattern[step];
      if (bassFreq > 0) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        bassGain.gain.setValueAtTime(0.082 * cityMix, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
        bassOsc.connect(bassGain);
        bassGain.connect(dest);
        bassOsc.start(now);
        bassOsc.stop(now + 0.12);
      }

      // 4. Tema Melódico Heroico & Aventureiro Estilo LEGO Marvel
      const leadMelody = [
        523.25, 0, 659.25, 0, 783.99, 0, 659.25, 587.33,
        587.33, 0, 659.25, 783.99, 0, 0, 587.33, 0,
        523.25, 0, 587.33, 0, 659.25, 0, 880.0, 783.99,
        659.25, 0, 587.33, 523.25, 587.33, 0, 0, 0
      ];
      const leadFreq = leadMelody[step];
      if (leadFreq > 0) {
        const leadOsc = ctx.createOscillator();
        const leadGain = ctx.createGain();
        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadFreq, now);
        leadGain.gain.setValueAtTime(0.048 * cityMix, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        leadOsc.connect(leadGain);
        leadGain.connect(dest);
        leadOsc.start(now);
        leadOsc.stop(now + 0.23);
      }
    }, 130);
    if (this._musicInterval && typeof this._musicInterval.unref === 'function') {
      this._musicInterval.unref();
    }
  }

  stopWarMusic() {
    this.isMusicPlaying = false;
    if (this._musicInterval) {
      clearInterval(this._musicInterval);
      this._musicInterval = null;
    }
  }

  setBossMusicIntensity(active) {
    this.isBossMusicActive = Boolean(active);
  }

  /**
   * Atualiza o crossfade espacial por proximidade (0..1 num raio de 75m) do Paredão do Baile da CDD!
   */
  updateBaileSpatialProximity(distanceMeters, dt = 0.016) {
    const maxRadius = 75.0;
    const rawRatio = distanceMeters < maxRadius ? 1.0 - distanceMeters / maxRadius : 0;
    // Curva suave (quadrática na borda e máxima perto do palco)
    const targetMix = rawRatio > 0 ? Math.min(1.0, Math.pow(rawRatio, 1.25) * 1.18) : 0;
    const blend = Math.min(1.0, dt * 4.5);
    this.baileFunkMix += (targetMix - this.baileFunkMix) * blend;
    if (this.baileFunkMix < 0.002) this.baileFunkMix = 0;

    if (targetMix > 0.05 && !this.isMusicPlaying) {
      this.startWarMusic();
    }
    this.baileBeatPulse = Math.max(0, (this.baileBeatPulse || 0) - dt * 6.5);
    return this.baileFunkMix;
  }

  playEmoteJingle(emoteIdx = 0) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notesByEmote = [
      [440, 554.37, 659.25],
      [523.25, 659.25, 783.99],
      [392.0, 523.25, 783.99],
      [329.63, 440.0, 659.25]
    ];
    const notes = notesByEmote[emoteIdx % notesByEmote.length];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  /**
   * Sinal sonoro suave "Ding-Dong" (Mi5 -> Dó5 harmônico) de abertura/fechamento de portas nas 5 Estações do Metrô LEGO
   */
  playMetroDingDong(volume = 0.65) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = Math.max(0.05, Math.min(1.0, volume)) * 0.16;
    const chimeNotes = [
      { freq: 659.25, delay: 0.0, dur: 0.36 },  // E5 ("Ding")
      { freq: 523.25, delay: 0.24, dur: 0.48 }  // C5 ("Dong")
    ];

    for (const note of chimeNotes) {
      const t = now + note.delay;
      const oscMain = ctx.createOscillator();
      const oscHarm = ctx.createOscillator();
      const gain = ctx.createGain();

      oscMain.type = 'sine';
      oscMain.frequency.setValueAtTime(note.freq, t);

      oscHarm.type = 'triangle';
      oscHarm.frequency.setValueAtTime(note.freq * 2.0, t);

      gain.gain.setValueAtTime(0.001, t);
      if (typeof gain.gain.linearRampToValueAtTime === 'function') {
        gain.gain.linearRampToValueAtTime(vol, t + 0.018);
      } else {
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.018);
      }
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);

      oscMain.connect(gain);
      oscHarm.connect(gain);
      gain.connect(this.sfxBus || ctx.destination);

      oscMain.start(t);
      oscHarm.start(t);
      oscMain.stop(t + note.dur + 0.02);
      oscHarm.stop(t + note.dur + 0.02);
    }
  }
}

export const soundFX = new SoundFX();
