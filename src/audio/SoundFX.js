/**
 * Sintetizador de efeitos sonoros estilo LEGO via Web Audio API (zero dependências externas)
 */
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
      gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
    gain.connect(ctx.destination);

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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);

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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.31);
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
    gain.connect(ctx.destination);

    bassOsc.start(now);
    pingOsc.start(now);
    bassOsc.stop(now + 0.16);
    pingOsc.stop(now + 0.16);
  }
}

export const soundFX = new SoundFX();
