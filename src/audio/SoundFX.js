import {
  initSoundFXState,
  ensureWebAudioContext,
  applySoundBusVolumes,
  setSoundVolumes,
  playCarEngineStartLoop,
  playCarHornLoop,
  playRadioAlertSirenLoop,
  playMetroDingDongLoop,
  startWarMusicLoop,
  stopWarMusicLoop,
  setBossMusicIntensityState,
  updateBaileSpatialProximityLoop
} from './sfx/WebAudioCoreAndLoops.js';
import {
  playStudCollectSfx,
  playPlasticHitSfx,
  playMetalRicochetSfx,
  playLegoBreakSfx,
  playRifleShotSfx,
  playMinigunShotSfx,
  playSeismicStompSfx,
  playFireballCastSfx,
  playExplosionSfx,
  playSolarBeamTickSfx,
  playSolarChargeTickSfx,
  playTacticalRollSfx,
  playHeroSwapSfx,
  playPunchSwingSfx,
  playTrueHeroFanfareSfx,
  playLaserShotSfx,
  playSatelliteZoomStepSfx,
  playNpcGunshotSfx,
  playHealTickSfx,
  playEmoteJingleSfx,
  playKillConfirmSfx,
  playHitmarkerTickSfx,
  playSniperBoltShotSfx,
  playScopeZoomClickSfx
} from './sfx/CombatAndUiSoundEffects.js';
import {
  updatePursuitSirenAndRotorAudio,
  stopPursuitSirenAndRotorAudio
} from './sfx/PoliceSirenAndRotorAudio.js';

/**
 * Fachada fina do sintetizador de efeitos sonoros estilo LEGO via Web Audio API (zero dependências externas).
 * Delega o núcleo WebAudio/loops contínuos para `WebAudioCoreAndLoops` e combate/UI para `CombatAndUiSoundEffects`.
 */
class SoundFX {
  constructor() {
    initSoundFXState(this);
  }

  // Núcleo WebAudio, Barramentos de Ganho e Loops Contínuos / Veículos / Metrô / Perseguição
  _canPlaySfx() {
    return (this.masterVolume ?? 1) > 0.001 && (this.sfxVolume ?? 1) > 0.001;
  }
  _ensureContext() { return ensureWebAudioContext(this); }
  _applyBusVolumes() { return applySoundBusVolumes(this); }
  setVolumes(opts = {}) { return setSoundVolumes(this, opts); }
  playCarEngineStart() { return playCarEngineStartLoop(this); }
  playCarHorn(volumeScale = 1.0, isPoliceSiren = false) { return playCarHornLoop(this, volumeScale, isPoliceSiren); }
  playRadioAlertSiren() { return playRadioAlertSirenLoop(this); }
  playMetroDingDong(volume = 0.65) { return playMetroDingDongLoop(this, volume); }
  startWarMusic() { return startWarMusicLoop(this); }
  stopWarMusic() { return stopWarMusicLoop(this); }
  setBossMusicIntensity(active) { return setBossMusicIntensityState(this, active); }
  updateBaileSpatialProximity(distanceMeters, dt = 0.016) { return updateBaileSpatialProximityLoop(this, distanceMeters, dt); }
  updatePursuitAudio(payload = {}) { return updatePursuitSirenAndRotorAudio(this, payload); }
  stopPursuitAudio() { return stopPursuitSirenAndRotorAudio(this); }
  setAmbienceContext(meta = {}) { return this.urbanAmbience?.setContext(meta); }
  setAmbienceRegion(regionId) { return this.urbanAmbience?.setRegion(regionId); }

  // Combate, Destruição LEGO, Coleta de Studs, Poderes dos Heróis e UI
  playStudCollect(value = 10) { return playStudCollectSfx(this, value); }
  playPlasticHit() { return playPlasticHitSfx(this); }
  playMetalRicochet() { return playMetalRicochetSfx(this); }
  playLegoBreak(isBig = false) { return playLegoBreakSfx(this, isBig); }
  playRifleShot() { return playRifleShotSfx(this); }
  playMinigunShot() { return playMinigunShotSfx(this); }
  playSeismicStomp() { return playSeismicStompSfx(this); }
  playFireballCast() { return playFireballCastSfx(this); }
  playExplosion(scale = 1.0) { return playExplosionSfx(this, scale); }
  playSolarBeamTick() { return playSolarBeamTickSfx(this); }
  playSolarChargeTick(chargeRatio = 0) { return playSolarChargeTickSfx(this, chargeRatio); }
  playTacticalRoll() { return playTacticalRollSfx(this); }
  playHeroSwap() { return playHeroSwapSfx(this); }
  playPunchSwing() { return playPunchSwingSfx(this); }
  playTrueHeroFanfare() { return playTrueHeroFanfareSfx(this); }
  playLaserShot() { return playLaserShotSfx(this); }
  playSatelliteZoomStep(isDown = false, step = 1) { return playSatelliteZoomStepSfx(this, isDown, step); }
  playNpcGunshot(faction = 'cv', isRpg = false, volumeScale = 1.0) { return playNpcGunshotSfx(this, faction, isRpg, volumeScale); }
  playHealTick() { return playHealTickSfx(this); }
  playEmoteJingle(emoteIdx = 0) { return playEmoteJingleSfx(this, emoteIdx); }
  playKillConfirm() { return playKillConfirmSfx(this); }
  playHitmarkerTick() { return playHitmarkerTickSfx(this); }
  playHeadshotTink() {
    if (!this._canPlaySfx()) return false;
    const ctx = this._ensureContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const dest = this.sfxBus || ctx.destination;

    const pingOsc = ctx.createOscillator();
    const harmOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    pingOsc.type = 'sine';
    pingOsc.frequency.setValueAtTime(1850, now);
    pingOsc.frequency.exponentialRampToValueAtTime(2450, now + 0.075);
    harmOsc.type = 'triangle';
    harmOsc.frequency.setValueAtTime(2450, now);
    harmOsc.frequency.exponentialRampToValueAtTime(3080, now + 0.07);
    pingGain.gain.setValueAtTime(0.115, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    pingOsc.connect(pingGain);
    harmOsc.connect(pingGain);
    pingGain.connect(dest);
    pingOsc.start(now);
    harmOsc.start(now);
    pingOsc.stop(now + 0.078);
    harmOsc.stop(now + 0.074);

    const transOsc = ctx.createOscillator();
    const transGain = ctx.createGain();
    transOsc.type = 'triangle';
    transOsc.frequency.setValueAtTime(3200, now);
    transOsc.frequency.exponentialRampToValueAtTime(1950, now + 0.022);
    transGain.gain.setValueAtTime(0.075, now);
    transGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    transOsc.connect(transGain);
    transGain.connect(dest);
    transOsc.start(now);
    transOsc.stop(now + 0.025);
    return true;
  }
  playSniperBoltShot() { return playSniperBoltShotSfx(this); }
  playScopeZoomClick(zoom = 4.0) { return playScopeZoomClickSfx(this, zoom); }
}

export const soundFX = new SoundFX();
