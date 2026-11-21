import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './setup-env.js';
import { soundFX } from '../src/audio/SoundFX.js';
import {
  REGION_AMBIENCE_CATALOG,
  UrbanAmbienceSoundtrack,
  resolveCanonicalAmbienceId
} from '../src/audio/UrbanAmbienceSoundtrack.js';
import { MAP_REGIONS } from '../src/world/MapRegionsData.js';

function createMockWebAudioContext() {
  const createdOscFreqs = [];
  const createdPeakGains = [];

  const makeParam = (initial = 0) => ({
    value: initial,
    setValueAtTime(v) {
      this.value = v;
    },
    linearRampToValueAtTime(v) {
      this.value = v;
      createdPeakGains.push(v);
    },
    exponentialRampToValueAtTime(v) {
      this.value = v;
    },
    setTargetAtTime(v) {
      this.value = v;
    },
    cancelScheduledValues() {}
  });

  const makeNode = (extra = {}) => ({
    connect() {
      return this;
    },
    disconnect() {},
    ...extra
  });

  return {
    state: 'running',
    currentTime: 10,
    sampleRate: 22050,
    destination: makeNode(),
    createdOscFreqs,
    createdPeakGains,
    resume: () => Promise.resolve(),
    createGain() {
      return makeNode({ gain: makeParam(1) });
    },
    createOscillator() {
      const freq = makeParam(110);
      const origSet = freq.setValueAtTime.bind(freq);
      freq.setValueAtTime = (v) => {
        origSet(v);
        createdOscFreqs.push(v);
      };
      return makeNode({
        type: 'sine',
        frequency: freq,
        detune: makeParam(0),
        start() {},
        stop() {}
      });
    },
    createBiquadFilter() {
      return makeNode({
        type: 'lowpass',
        frequency: makeParam(500),
        Q: makeParam(1)
      });
    },
    createStereoPanner() {
      return makeNode({ pan: makeParam(0) });
    },
    createDelay() {
      return makeNode({ delayTime: makeParam(0.5) });
    },
    createConvolver() {
      return makeNode({ buffer: null });
    },
    createBuffer(channels, length, sampleRate) {
      const chArrays = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        duration: length / sampleRate,
        getChannelData: (c) => chArrays[c]
      };
    },
    createBufferSource() {
      return makeNode({
        buffer: null,
        loop: false,
        start() {},
        stop() {}
      });
    }
  };
}

describe('TRILHA SONORA NATIVA DARK AMBIENT — 10 MINUTOS EXCLUSIVOS POR BAIRRO', () => {
  it('1. Catálogo cobre todos os 11 bairros com 600s (10 min), 5 movimentos e identidades distintas', () => {
    const expectedIds = [
      ...MAP_REGIONS.map((r) => r.id),
      'favela_cdd_cv'
    ];
    assert.equal(expectedIds.length, 11);

    const signatureByRegion = new Map();
    for (const id of expectedIds) {
      const composer = REGION_AMBIENCE_CATALOG[id];
      assert.ok(composer, `Compositor ausente para o bairro ${id}`);
      assert.equal(composer.id, id);
      assert.equal(composer.durationSec, 600, `${id} deve ter exatamente 600s (10 minutos)`);
      assert.ok(Array.isArray(composer.movements) && composer.movements.length === 5, `${id} deve ter 5 movimentos`);
      assert.equal(composer.movements[0].startSec, 0);
      assert.equal(composer.movements[4].endSec, 600);
      assert.equal(typeof composer.scheduleWindow, 'function');

      const mockCtx = createMockWebAudioContext();
      const fakeSfx = {
        ctx: mockCtx,
        musicBus: mockCtx.createGain(),
        masterVolume: 0.85,
        musicVolume: 0.55,
        baileFunkMix: 0,
        tiktokRadioActive: false,
        _ensureContext: () => mockCtx
      };
      const engine = new UrbanAmbienceSoundtrack(fakeSfx);
      engine.isRunning = true;
      engine.setRegion(id);

      // Simula os 600 segundos inteiros (10 minutos) em passos de 1.0s
      for (let s = 0; s < 600; s++) {
        mockCtx.currentTime = 10 + s;
        engine.step(1.0);
      }

      assert.ok(
        mockCtx.createdOscFreqs.length >= 60,
        `${id} deve gerar camadas harmônicas/drones ricas ao longo dos 10 min (gerou ${mockCtx.createdOscFreqs.length})`
      );

      // Garante volume ambiente calibrado e controlado (nenhuma voz individual estoura acima de 0.34)
      const maxVoicePeak = Math.max(...mockCtx.createdPeakGains.filter((v) => v < 0.8));
      assert.ok(maxVoicePeak >= 0.02 && maxVoicePeak <= 0.34, `Pico de voz fora da faixa audível ambiente em ${id}: ${maxVoicePeak}`);

      const avgHz =
        mockCtx.createdOscFreqs.reduce((acc, v) => acc + v, 0) / mockCtx.createdOscFreqs.length;
      signatureByRegion.set(id, `${mockCtx.createdOscFreqs.length}:${avgHz.toFixed(1)}`);
      engine.stop();
    }

    // Garante que cada bairro realmente toca uma composição própria diferente
    assert.equal(signatureByRegion.size, 11);
    const uniqueSignatures = new Set(signatureByRegion.values());
    assert.equal(uniqueSignatures.size, 11, 'Cada um dos 11 bairros deve ter assinatura musical única');
  });

  it('2. Crossfade suave entre bairros, sub-regiões (Banco/Metrô/Porão) e Ducking automático da Rádio GTA 6', () => {
    assert.equal(resolveCanonicalAmbienceId('super_banco_interior'), 'centro_financeiro');
    assert.equal(resolveCanonicalAmbienceId('metro_subterraneo'), 'centro_financeiro');
    assert.equal(resolveCanonicalAmbienceId('porao_torre_herois'), 'torre_herois');
    assert.equal(resolveCanonicalAmbienceId('ilha_prisao'), 'ilha_prisao');

    const mockCtx = createMockWebAudioContext();
    const fakeSfx = {
      ctx: mockCtx,
      musicBus: mockCtx.createGain(),
      masterVolume: 0.85,
      musicVolume: 0.55,
      baileFunkMix: 0,
      tiktokRadioActive: false,
      _ensureContext: () => mockCtx
    };

    const engine = new UrbanAmbienceSoundtrack(fakeSfx);
    engine.isRunning = true;
    engine.setContext({ regionId: 'centro_financeiro', altitudeY: 1.0, isNight: true });
    assert.equal(engine.step(1.0), true);
    assert.equal(engine._activeChannels.get('centro_financeiro')?.state, 'active');

    // Cruza a ponte para a Ilha da Prisão -> canal antigo entra em crossfade ('fading') e novo fica 'active'
    engine.setContext({ regionId: 'ilha_prisao', altitudeY: 2.0, isNight: true });
    assert.equal(engine._activeChannels.get('centro_financeiro')?.state, 'fading');
    assert.equal(engine._activeChannels.get('ilha_prisao')?.state, 'active');

    // Após 4 segundos, o canal antigo termina o fade e é desconectado/limpo
    mockCtx.currentTime += 4.5;
    engine.step(1.0);
    assert.equal(engine._activeChannels.has('centro_financeiro'), false);
    assert.equal(engine._activeChannels.has('ilha_prisao'), true);

    // Ligar a Rádio FM ([Z]/[P]) faz ducking imediato e pausa geração de vozes nativas
    fakeSfx.tiktokRadioActive = true;
    assert.equal(engine.step(1.0), false);

    fakeSfx.tiktokRadioActive = false;
    assert.equal(engine.step(1.0), true);
    engine.stop();

    // Segurança headless no singleton soundFX
    soundFX.setAmbienceContext({ regionId: 'favela_cdd_cv', altitudeY: 26, isNight: true });
    soundFX.startWarMusic();
    soundFX.stopWarMusic();
  });
});
