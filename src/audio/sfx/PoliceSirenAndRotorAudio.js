/**
 * Motor WebAudio espacial procedural de perseguição policial (zero dependências externas .mp3/.wav):
 * - Até 4 sirenes simultâneas (WAIL / YELP / PHASER) com filtro horn lowpass, pan estéreo,
 *   abafamento em túnel subterrâneo e efeito Doppler real por velocidade radial relativa.
 * - Até 2 helicópteros com loop posicional de rotor (ruído rosa filtrado + LFO blade-slap ~18.5 Hz
 *   + turbina grave em 78 Hz), pan estéreo, Doppler sutil e abafamento subterrâneo.
 */

const MAX_SIREN_SLOTS = 4;
const MAX_SIREN_DIST = 225;
const SIREN_YELP_DIST = 40;
const SIREN_PHASER_DIST = 16;
const MAX_ROTOR_SLOTS = 2;
const MAX_ROTOR_DIST = 290;
const SOUND_SPEED = 340;

const _clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const _newMeta = (phaseOffset) => ({ phaseOffset, phaserClock: 0, prevX: 0, prevY: 0, prevZ: 0, hasPrev: false });

function _setParamSmooth(param, value, now, tc = 0.028) {
  if (!param) return;
  const v = Number.isFinite(value) ? value : 0;
  if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(v, now, tc);
  else if (typeof param.linearRampToValueAtTime === 'function') param.linearRampToValueAtTime(v, now + tc);
  else if (typeof param.setValueAtTime === 'function') param.setValueAtTime(v, now);
  else param.value = v;
}

function _setParamImmediate(param, value, now = 0) {
  if (!param) return;
  const v = Number.isFinite(value) ? value : 0;
  if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
  if (typeof param.setValueAtTime === 'function') param.setValueAtTime(v, now);
  else param.value = v;
}

function _hashIdToPhase(id) {
  const str = String(id);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function _resetTelemetry(state) {
  state.activeSirenCount = 0;
  state.activeRotorCount = 0;
  state.slotModes = ['idle', 'idle', 'idle', 'idle'];
  state.slotPans = [0, 0, 0, 0];
  state.lastDopplerRatios = [];
  state.lastRotorDopplerRatios = [];
}

function _ensurePursuitState(sfx) {
  if (!sfx._pursuitAudioState) {
    sfx._pursuitAudioState = {
      ctx: null, clock: 0, sirenSlots: [], rotorSlots: [], rotorNoiseBuffer: null,
      entityMeta: new WeakMap(), idMeta: new Map(), nextPhaseSeed: 0, inTunnel: false
    };
    _resetTelemetry(sfx._pursuitAudioState);
  }
  return sfx._pursuitAudioState;
}

function _getEntityMeta(state, ent, fallbackIndex) {
  const rawId = ent?.id ?? ent?.carObj?.id ?? ent?.obj?.id;
  if (rawId !== undefined && rawId !== null) {
    let meta = state.idMeta.get(rawId);
    if (!meta) {
      if (state.idMeta.size >= 128) state.idMeta.delete(state.idMeta.keys().next().value);
      meta = _newMeta(_hashIdToPhase(rawId));
      state.idMeta.set(rawId, meta);
    }
    return meta;
  }
  const keyObj = ent?.carObj || ent?.obj || ent;
  if (keyObj && typeof keyObj === 'object') {
    let meta = state.entityMeta.get(keyObj);
    if (!meta) {
      meta = _newMeta(((state.nextPhaseSeed++ * 0.61803398875) + fallbackIndex * 0.23) % 1);
      state.entityMeta.set(keyObj, meta);
    }
    return meta;
  }
  return _newMeta((fallbackIndex * 0.27) % 1);
}

function _extractPos(ent) {
  if (!ent) return null;
  const src = ent.pos || ent.position || ent.carObj?.mesh?.position || ent.mesh?.position || ent;
  if (typeof src.x !== 'number' || typeof src.z !== 'number') return null;
  return { x: src.x, y: typeof src.y === 'number' ? src.y : 0, z: src.z };
}

function _extractVel(ent, pos, meta, dt) {
  let vx = 0, vy = 0, vz = 0;
  const vObj = ent?.vel || ent?.velocity || ent?.carObj?.vel || ent?.carObj?.velocity;
  if (vObj && (typeof vObj.x === 'number' || typeof vObj.z === 'number')) {
    vx = vObj.x || 0; vy = vObj.y || 0; vz = vObj.z || 0;
  } else if (typeof ent?.vx === 'number' || typeof ent?.vz === 'number') {
    vx = ent.vx || 0; vy = ent.vy || 0; vz = ent.vz || 0;
  } else if (typeof ent?.speed === 'number' && typeof ent?.heading === 'number') {
    vx = Math.sin(ent.heading) * ent.speed; vy = ent.vy || 0; vz = Math.cos(ent.heading) * ent.speed;
  } else if (meta?.hasPrev && dt > 0.0005) {
    vx = _clamp((pos.x - meta.prevX) / dt, -95, 95);
    vy = _clamp((pos.y - meta.prevY) / dt, -60, 60);
    vz = _clamp((pos.z - meta.prevZ) / dt, -95, 95);
  }
  if (meta) { meta.prevX = pos.x; meta.prevY = pos.y; meta.prevZ = pos.z; meta.hasPrev = true; }
  return { x: vx, y: vy, z: vz };
}

function _computeDoppler(vel, cand, pVelX, pVelY, pVelZ, minRatio, maxRatio) {
  const safeDist = Math.max(0.001, cand.dist);
  const nearSmooth = cand.dist < 1.0 ? cand.dist : 1.0;
  const relRadialVel =
    (((vel.x - pVelX) * -cand.dx + (vel.y - pVelY) * -cand.dy + (vel.z - pVelZ) * -cand.dz) / safeDist) * nearSmooth;
  return _clamp(1 + relRadialVel / SOUND_SPEED, minRatio, maxRatio);
}

function _selectClosestActive(rawList, pPos, maxDist, maxSlots, isSiren) {
  const candidates = [];
  for (let i = 0; i < rawList.length; i++) {
    const ent = rawList[i];
    if (!ent || ent.destroyed || ent.active === false) continue;
    if (isSiren && (ent.retreating || ent.sirenEnabled === false || ent.carObj?.destroyed || ent.carObj?.isDriven)) continue;
    if (!isSiren && ent.obj?.destroyed) continue;
    const pos = _extractPos(ent);
    if (!pos) continue;
    const dx = pos.x - pPos.x, dy = pos.y - pPos.y, dz = pos.z - pPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < maxDist) candidates.push({ ent, pos, dx, dy, dz, dist, horizDist: Math.hypot(dx, dz) });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, maxSlots);
}

function _createSpatialOutputChain(ctx, dest, filterFreq, filterQ, now) {
  const outGain = ctx.createGain();
  _setParamImmediate(outGain.gain, 0.0001, now);
  const filter = typeof ctx.createBiquadFilter === 'function' ? ctx.createBiquadFilter() : null;
  if (filter) {
    filter.type = 'lowpass';
    _setParamImmediate(filter.frequency, filterFreq, now);
    _setParamImmediate(filter.Q, filterQ, now);
  }
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  if (panner) {
    _setParamImmediate(panner.pan, 0, now);
    panner.connect(outGain);
  }
  outGain.connect(dest);
  return { filter, panner, outGain, postFilterDest: panner || outGain };
}

function _createSirenVoiceSlot(sfx, ctx) {
  const now = ctx.currentTime || 0;
  const { filter, panner, outGain, postFilterDest } = _createSpatialOutputChain(ctx, sfx.sfxBus || ctx.destination, 2400, 2.1, now);
  const oscMain = ctx.createOscillator(), oscHarm = ctx.createOscillator();
  const mainMix = ctx.createGain(), harmMix = ctx.createGain();
  oscMain.type = 'sawtooth';
  oscHarm.type = 'triangle';
  _setParamImmediate(oscMain.frequency, 680, now);
  _setParamImmediate(oscHarm.frequency, 685, now);
  _setParamImmediate(mainMix.gain, 0.62, now);
  _setParamImmediate(harmMix.gain, 0.44, now);

  const inputStage = filter || postFilterDest;
  oscMain.connect(mainMix); oscHarm.connect(harmMix);
  mainMix.connect(inputStage); harmMix.connect(inputStage);
  if (filter) filter.connect(postFilterDest);
  oscMain.start?.(now); oscHarm.start?.(now);
  return { oscMain, oscHarm, mainMix, harmMix, filter, panner, outGain };
}

function _getOrCreateRotorNoiseBuffer(state, ctx) {
  if (state.rotorNoiseBuffer && state.ctx === ctx) return state.rotorNoiseBuffer;
  if (typeof ctx.createBuffer !== 'function') return null;
  const sr = Number(ctx.sampleRate) || 44100;
  const len = Math.max(64, Math.floor(sr * 1.5));
  const buffer = ctx.createBuffer(1, len, sr);
  const data = typeof buffer.getChannelData === 'function' ? buffer.getChannelData(0) : null;
  if (data) {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      data[i] = _clamp((b0 + b1 + b2 + w * 0.18) * 0.22, -1, 1);
    }
    const fade = Math.min(64, Math.floor(len * 0.05));
    for (let i = 0; i < fade; i++) data[i] = data[i] * (i / fade) + data[len - fade + i] * (1 - i / fade);
  }
  state.rotorNoiseBuffer = buffer;
  return buffer;
}

function _createRotorVoiceSlot(sfx, state, ctx) {
  const now = ctx.currentTime || 0;
  const { filter, panner, outGain, postFilterDest } = _createSpatialOutputChain(ctx, sfx.sfxBus || ctx.destination, 310, 1.35, now);
  const noiseBuf = _getOrCreateRotorNoiseBuffer(state, ctx);
  const chopGate = ctx.createGain(), lfoDepth = ctx.createGain(), humGain = ctx.createGain();
  const lfoOsc = ctx.createOscillator(), humOsc = ctx.createOscillator();
  lfoOsc.type = 'sine'; humOsc.type = 'triangle';
  _setParamImmediate(chopGate.gain, 0.56, now);
  _setParamImmediate(lfoOsc.frequency, 18.5, now);
  _setParamImmediate(lfoDepth.gain, 0.44, now);
  _setParamImmediate(humOsc.frequency, 78, now);
  _setParamImmediate(humGain.gain, 0.34, now);

  let noiseSrc = null, fallbackBladeOsc = null;
  const chopEntry = filter || chopGate;
  if (noiseBuf && typeof ctx.createBufferSource === 'function') {
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    noiseSrc.connect(chopEntry);
  } else {
    fallbackBladeOsc = ctx.createOscillator();
    fallbackBladeOsc.type = 'sawtooth';
    _setParamImmediate(fallbackBladeOsc.frequency, 116, now);
    fallbackBladeOsc.connect(chopEntry);
  }
  if (filter) filter.connect(chopGate);
  lfoOsc.connect(lfoDepth);
  try { lfoDepth.connect(chopGate.gain); } catch (_) {}
  chopGate.connect(postFilterDest);
  humOsc.connect(humGain);
  humGain.connect(postFilterDest);
  noiseSrc?.start?.(now); fallbackBladeOsc?.start?.(now); lfoOsc.start?.(now); humOsc.start?.(now);
  return { noiseSrc, fallbackBladeOsc, filter, chopGate, lfoOsc, lfoDepth, humOsc, humGain, panner, outGain };
}

function _ensurePoolsForContext(sfx, state, ctx, needSirens, needRotors) {
  if (!ctx) return;
  if (state.ctx && state.ctx !== ctx) stopPursuitSirenAndRotorAudio(sfx);
  state.ctx = ctx;
  while (needSirens && state.sirenSlots.length < MAX_SIREN_SLOTS) state.sirenSlots.push(_createSirenVoiceSlot(sfx, ctx));
  while (needRotors && state.rotorSlots.length < MAX_ROTOR_SLOTS) state.rotorSlots.push(_createRotorVoiceSlot(sfx, state, ctx));
}

export function updatePursuitSirenAndRotorAudio(sfx, payload = {}) {
  const state = _ensurePursuitState(sfx);
  const dt = _clamp(Number(payload.dt) || 0.016, 0.001, 0.25);
  const stars = Number(payload.stars) || 0;
  const isSearching = Boolean(payload.isSearching);
  const inTunnel = Boolean(payload.inTunnel);
  const pPos = _extractPos(payload.playerPos);
  state.inTunnel = inTunnel;

  if (!payload.active || stars <= 0 || !pPos) {
    _resetTelemetry(state);
    if (sfx.ctx) {
      const now = sfx.ctx.currentTime || 0;
      for (const slot of state.sirenSlots) _setParamSmooth(slot.outGain.gain, 0.0001, now, 0.06);
      for (const slot of state.rotorSlots) _setParamSmooth(slot.outGain.gain, 0.0001, now, 0.07);
    }
    return state;
  }

  state.clock += dt;
  const pVelX = Number(payload.playerVel?.x ?? payload.playerVel?.vx) || 0;
  const pVelY = Number(payload.playerVel?.y ?? payload.playerVel?.vy) || 0;
  const pVelZ = Number(payload.playerVel?.z ?? payload.playerVel?.vz) || 0;
  const rightX = Number.isFinite(payload.cameraRight?.x) ? payload.cameraRight.x : 1;
  const rightZ = Number.isFinite(payload.cameraRight?.z) ? payload.cameraRight.z : 0;

  const rawVehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];
  const rawHelis = Array.isArray(payload.helicopters) ? payload.helicopters : payload.helicopters ? [payload.helicopters] : [];
  const topSirens = _selectClosestActive(rawVehicles, pPos, MAX_SIREN_DIST, MAX_SIREN_SLOTS, true);
  const topHelis = _selectClosestActive(rawHelis, pPos, MAX_ROTOR_DIST, MAX_ROTOR_SLOTS, false);

  const ctx = topSirens.length > 0 || topHelis.length > 0 ? sfx._ensureContext?.() : sfx.ctx;
  _ensurePoolsForContext(sfx, state, ctx, topSirens.length > 0, topHelis.length > 0);
  const now = ctx ? ctx.currentTime || 0 : 0;

  state.activeSirenCount = topSirens.length;
  state.lastDopplerRatios = [];

  for (let s = 0; s < MAX_SIREN_SLOTS; s++) {
    const slot = state.sirenSlots[s];
    const cand = topSirens[s];
    if (!cand) {
      state.slotModes[s] = 'idle';
      state.slotPans[s] = 0;
      if (slot) _setParamSmooth(slot.outGain.gain, 0.0001, now, 0.05);
      continue;
    }

    const meta = _getEntityMeta(state, cand.ent, s);
    const vel = _extractVel(cand.ent, cand.pos, meta, dt);
    const doppler = _computeDoppler(vel, cand, pVelX, pVelY, pVelZ, 0.84, 1.18);
    state.lastDopplerRatios.push(doppler);

    let mode = 'wail', rawMainFreq = 680, rawHarmFreq = 685;
    if (cand.dist >= SIREN_YELP_DIST || isSearching) {
      meta.phaserClock = 0;
      const u = 0.5 - 0.5 * Math.cos(Math.PI * 2 * (state.clock * 0.38 + meta.phaseOffset));
      rawMainFreq = 590 * Math.pow(1180 / 590, u);
      rawHarmFreq = rawMainFreq * 1.007;
    } else if (cand.dist < SIREN_PHASER_DIST && stars >= 3 && (meta.phaserClock % 2.8) < 1.15) {
      mode = 'phaser';
      meta.phaserClock += dt;
      const cyc = (state.clock * 7.5 + meta.phaseOffset) % 1;
      const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
      rawMainFreq = 700 * Math.pow(1420 / 700, tri);
      rawHarmFreq = cyc < 0.5 ? rawMainFreq * 1.24 : rawMainFreq * 0.84;
    } else {
      mode = 'yelp';
      meta.phaserClock = cand.dist < SIREN_PHASER_DIST && stars >= 3 ? meta.phaserClock + dt : 0;
      const cyc = (state.clock * 3.3 + meta.phaseOffset) % 1;
      const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
      rawMainFreq = 660 * Math.pow(1340 / 660, tri * tri * (3 - 2 * tri));
      rawHarmFreq = rawMainFreq * 1.008;
    }

    const pan = _clamp((cand.dx * rightX + cand.dz * rightZ) / Math.max(8, cand.dist), -0.92, 0.92);
    const distAtten = 1 / (1 + Math.pow(cand.dist / 26, 1.55));
    const edgeFade = cand.dist > 195 ? (MAX_SIREN_DIST - cand.dist) / 30 : 1;
    const targetGain = Math.max(0.0001, 0.088 * distAtten * edgeFade * (inTunnel ? 0.32 : 1.0));
    const cutoffHz = inTunnel ? 520 : 2400 - Math.min(520, cand.dist * 2.1);

    state.slotModes[s] = mode;
    state.slotPans[s] = pan;
    if (slot) {
      _setParamSmooth(slot.oscMain.frequency, rawMainFreq * doppler, now, 0.022);
      _setParamSmooth(slot.oscHarm.frequency, rawHarmFreq * doppler, now, 0.022);
      if (slot.filter) _setParamSmooth(slot.filter.frequency, cutoffHz, now, 0.045);
      if (slot.panner) _setParamSmooth(slot.panner.pan, pan, now, 0.035);
      _setParamSmooth(slot.outGain.gain, targetGain, now, 0.032);
    }
  }

  state.activeRotorCount = topHelis.length;
  state.lastRotorDopplerRatios = [];

  for (let r = 0; r < MAX_ROTOR_SLOTS; r++) {
    const slot = state.rotorSlots[r];
    const cand = topHelis[r];
    if (!cand) {
      if (slot) _setParamSmooth(slot.outGain.gain, 0.0001, now, 0.06);
      continue;
    }

    const meta = _getEntityMeta(state, cand.ent, r + 8);
    const vel = _extractVel(cand.ent, cand.pos, meta, dt);
    const doppler = _computeDoppler(vel, cand, pVelX, pVelY, pVelZ, 0.90, 1.10);
    state.lastRotorDopplerRatios.push(doppler);

    const overhead = _clamp(1 - cand.horizDist / 65, 0, 1);
    const cutoffHz = inTunnel ? 170 : 240 + overhead * 180;
    const pan = _clamp((cand.dx * rightX + cand.dz * rightZ) / Math.max(12, cand.horizDist), -0.88, 0.88);
    const distAtten = 1 / (1 + Math.pow(cand.dist / 62, 1.45));
    const edgeFade = cand.dist > 245 ? (MAX_ROTOR_DIST - cand.dist) / 45 : 1;
    const targetGain = Math.max(0.0001, 0.135 * distAtten * edgeFade * (1 + overhead * 0.35) * (inTunnel ? 0.18 : 1.0));

    if (slot) {
      if (slot.noiseSrc?.playbackRate) _setParamSmooth(slot.noiseSrc.playbackRate, doppler, now, 0.04);
      if (slot.fallbackBladeOsc) _setParamSmooth(slot.fallbackBladeOsc.frequency, 116 * doppler, now, 0.035);
      if (slot.filter) _setParamSmooth(slot.filter.frequency, cutoffHz, now, 0.05);
      _setParamSmooth(slot.lfoOsc.frequency, (18.5 + r * 0.45) * doppler, now, 0.035);
      _setParamSmooth(slot.humOsc.frequency, (78 - overhead * 4) * doppler, now, 0.04);
      _setParamSmooth(slot.humGain.gain, 0.32 + overhead * 0.18, now, 0.05);
      if (slot.panner) _setParamSmooth(slot.panner.pan, pan, now, 0.04);
      _setParamSmooth(slot.outGain.gain, targetGain, now, 0.045);
    }
  }
  return state;
}

function _teardownVoiceSlot(slot, stopKeys, now) {
  _setParamImmediate(slot.outGain?.gain, 0, now);
  for (const k of stopKeys) { try { slot[k]?.stop?.(now); } catch (_) {} }
  for (const node of Object.values(slot)) { try { node?.disconnect?.(); } catch (_) {} }
}

export function stopPursuitSirenAndRotorAudio(sfx) {
  const state = _ensurePursuitState(sfx);
  const now = sfx?.ctx?.currentTime || 0;
  for (const slot of state.sirenSlots) _teardownVoiceSlot(slot, ['oscMain', 'oscHarm'], now);
  for (const slot of state.rotorSlots) _teardownVoiceSlot(slot, ['noiseSrc', 'fallbackBladeOsc', 'lfoOsc', 'humOsc'], now);
  state.sirenSlots.length = 0;
  state.rotorSlots.length = 0;
  _resetTelemetry(state);
  state.inTunnel = false;
  return state;
}
