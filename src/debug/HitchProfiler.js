/**
 * Lightweight runtime hitch & synchronous shader-recompilation profiler.
 * Enabled via `?debug=1` in URL search params (or `forceEnabled: true` in tests).
 */

const DEFAULT_THRESHOLD_MS = 50;
const DEFAULT_MAX_ENTRIES = 64;

export function isHitchProfilerAllowed(searchStr = undefined) {
  const raw =
    typeof searchStr === 'string'
      ? searchStr
      : typeof window !== 'undefined' && window.location && typeof window.location.search === 'string'
        ? window.location.search
        : '';
  if (!raw) return false;
  try {
    const normalized = raw.startsWith('?') ? raw.slice(1) : raw;
    const params = new URLSearchParams(normalized);
    const val = params.get('debug');
    return val === '1' || val === 'true';
  } catch (_) {
    return /(?:^|[?&])debug=(?:1|true)(?:&|$)/i.test(raw);
  }
}

export class HitchProfiler {
  constructor(renderer = null, opts = {}) {
    const thresholdMs = Number.isFinite(opts?.thresholdMs) ? opts.thresholdMs : DEFAULT_THRESHOLD_MS;
    const forceEnabled = Boolean(opts?.forceEnabled);

    this.renderer = renderer || null;
    this.thresholdMs = thresholdMs;
    this.maxEntries = Number.isFinite(opts?.maxEntries) ? opts.maxEntries : DEFAULT_MAX_ENTRIES;
    this.enabled = forceEnabled || isHitchProfilerAllowed(opts?.searchStr);

    this.hitches = [];
    this.longTasks = [];
    this.lastAction = null;

    this.warmupCompleted = false;
    this.baselinePrograms = 0;
    this.baselineGeometries = 0;
    this.baselineTextures = 0;
    this.runtimeShaderCompiles = 0;

    this._prevPrograms = 0;
    this._prevGeometries = 0;
    this._prevTextures = 0;
    this._prevHeapBytes = 0;
    this._hasPrevSnapshot = false;
    this._frameStartMs = null;
    this._observer = null;

    if (this.enabled) {
      this._attachLongTaskObserver();
    }
  }

  _attachLongTaskObserver() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const obs = new PerformanceObserver((list) => {
        const entries = list?.getEntries?.() || [];
        const nowMs = this._now();
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          this.longTasks.push({
            name: e.name || 'longtask',
            startTimeMs: Number((e.startTime || 0).toFixed(2)),
            durationMs: Number((e.duration || 0).toFixed(2)),
            lastAction: this.lastAction ? this.lastAction.label : 'none',
            timestampMs: Number(nowMs.toFixed(2))
          });
          if (this.longTasks.length > this.maxEntries) {
            this.longTasks.shift();
          }
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
      this._observer = obs;
    } catch (_) {
      this._observer = null;
    }
  }

  _now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  _readHeapBytes() {
    return typeof performance !== 'undefined' && performance.memory?.usedJSHeapSize
      ? performance.memory.usedJSHeapSize
      : 0;
  }

  setRenderer(renderer) {
    this.renderer = renderer || null;
  }

  markAction(label, nowMs = this._now()) {
    this.lastAction = {
      label: String(label || 'unknown'),
      timeMs: Number(nowMs)
    };
  }

  markWarmupComplete(renderer = this.renderer) {
    if (renderer) this.renderer = renderer;
    const programs = renderer?.info?.programs?.length ?? 0;
    const geometries = renderer?.info?.memory?.geometries ?? 0;
    const textures = renderer?.info?.memory?.textures ?? 0;
    const heapBytes = this._readHeapBytes();

    this.baselinePrograms = programs;
    this.baselineGeometries = geometries;
    this.baselineTextures = textures;
    this.runtimeShaderCompiles = 0;

    this._prevPrograms = programs;
    this._prevGeometries = geometries;
    this._prevTextures = textures;
    this._prevHeapBytes = heapBytes;
    this._hasPrevSnapshot = true;
    this.warmupCompleted = true;
  }

  beginFrame(nowMs = this._now()) {
    if (!this.enabled) return;
    this._frameStartMs = Number(nowMs);
    if (!this._hasPrevSnapshot && this.renderer) {
      this._prevPrograms = this.renderer?.info?.programs?.length ?? 0;
      this._prevGeometries = this.renderer?.info?.memory?.geometries ?? 0;
      this._prevTextures = this.renderer?.info?.memory?.textures ?? 0;
      this._prevHeapBytes = this._readHeapBytes();
      this._hasPrevSnapshot = true;
    }
  }

  endFrame(nowMs = this._now(), renderer = this.renderer) {
    if (!this.enabled) return null;
    const dur = this._frameStartMs !== null ? Math.max(0, Number(nowMs) - this._frameStartMs) : 0;
    this._frameStartMs = null;
    return this.recordFrame(dur, renderer, nowMs);
  }

  recordFrame(frameDurationMs, renderer = this.renderer, nowMs = this._now()) {
    if (renderer && !this.renderer) this.renderer = renderer;
    if (!this.enabled) return null;

    const programsAfter = renderer?.info?.programs?.length ?? 0;
    const geometriesAfter = renderer?.info?.memory?.geometries ?? 0;
    const texturesAfter = renderer?.info?.memory?.textures ?? 0;
    const heapBytes = this._readHeapBytes();

    const programsBefore = this._hasPrevSnapshot
      ? this._prevPrograms
      : this.warmupCompleted
        ? this.baselinePrograms
        : programsAfter;
    const geometriesBefore = this._hasPrevSnapshot
      ? this._prevGeometries
      : this.warmupCompleted
        ? this.baselineGeometries
        : geometriesAfter;
    const texturesBefore = this._hasPrevSnapshot
      ? this._prevTextures
      : this.warmupCompleted
        ? this.baselineTextures
        : texturesAfter;
    const heapBefore = this._hasPrevSnapshot ? this._prevHeapBytes : heapBytes;

    const programsDelta = programsAfter - programsBefore;
    const geometriesDelta = geometriesAfter - geometriesBefore;
    const texturesDelta = texturesAfter - texturesBefore;
    const heapDeltaBytes = heapBytes - heapBefore;

    this._prevPrograms = programsAfter;
    this._prevGeometries = geometriesAfter;
    this._prevTextures = texturesAfter;
    this._prevHeapBytes = heapBytes;
    this._hasPrevSnapshot = true;

    if (this.warmupCompleted && programsDelta > 0) {
      this.runtimeShaderCompiles += programsDelta;
    }

    const isFrameHitch = frameDurationMs > this.thresholdMs;
    const isPostWarmupCompile = this.warmupCompleted && programsDelta > 0;
    if (!isFrameHitch && !isPostWarmupCompile) {
      return null;
    }

    const lastAction = this.lastAction ? this.lastAction.label : 'none';
    const actionAgeMs = this.lastAction
      ? Math.max(0, Number((nowMs - this.lastAction.timeMs).toFixed(2)))
      : null;

    const entry = {
      frameMs: Number(frameDurationMs.toFixed(2)),
      lastAction,
      actionAgeMs,
      programsBefore,
      programsAfter,
      programsDelta,
      geometriesDelta,
      texturesDelta,
      heapDeltaBytes,
      heapMB: Number((heapBytes / (1024 * 1024)).toFixed(2)),
      timestampMs: Number(nowMs.toFixed(2))
    };

    this.hitches.push(entry);
    if (this.hitches.length > this.maxEntries) {
      this.hitches.shift();
    }

    if (!globalThis.__testEnvReady) {
      console.warn(
        `[HitchProfiler] ${entry.frameMs}ms | action=${entry.lastAction} (age=${entry.actionAgeMs ?? '-'}ms) | ` +
          `programs=${programsBefore}->${programsAfter} (+${programsDelta}) | ` +
          `geos=${geometriesDelta >= 0 ? '+' : ''}${geometriesDelta} tex=${texturesDelta >= 0 ? '+' : ''}${texturesDelta} | ` +
          `heap=${entry.heapMB}MB`
      );
    }

    return entry;
  }

  getReport() {
    const currentPrograms = this.renderer?.info?.programs?.length ?? this._prevPrograms ?? 0;
    return {
      enabled: this.enabled,
      thresholdMs: this.thresholdMs,
      warmupCompleted: this.warmupCompleted,
      hitches: [...this.hitches],
      longTasks: [...this.longTasks],
      baselinePrograms: this.baselinePrograms,
      currentPrograms,
      runtimeShaderCompiles: this.runtimeShaderCompiles
    };
  }

  dispose() {
    if (this._observer && typeof this._observer.disconnect === 'function') {
      try {
        this._observer.disconnect();
      } catch (_) {}
    }
    this._observer = null;
  }
}
