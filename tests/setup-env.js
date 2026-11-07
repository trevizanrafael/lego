/**
 * Ambiente DOM / Canvas 2D / Web Audio simulado para rodar todos os testes 3D em Node.js
 */
export function setupTestEnvironment() {
  if (typeof globalThis.window !== 'undefined' && globalThis.__testEnvReady) {
    return;
  }

  const elementsById = new Map();

  function createMockElement(tag = 'div', id = '') {
    const classes = new Set();
    const el = {
      tagName: tag.toUpperCase(),
      id,
      innerHTML: '',
      textContent: '',
      dataset: {},
      style: {},
      children: [],
      width: 256,
      height: 256,
      offsetWidth: 100,
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        toggle: (name, force) => {
          const shouldAdd = force !== undefined ? Boolean(force) : !classes.has(name);
          if (shouldAdd) classes.add(name);
          else classes.delete(name);
          return shouldAdd;
        },
        contains: (name) => classes.has(name)
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      addEventListener(type, fn) {
        this._listeners = this._listeners || {};
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(fn);
      },
      dispatchEvent(evt) {
        const list = (this._listeners && this._listeners[evt.type]) || [];
        list.forEach((fn) => fn(evt));
      },
      requestPointerLock() {
        globalThis.document.pointerLockElement = this;
      },
      getContext() {
        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          lineCap: 'butt',
          fillRect() {},
          clearRect() {},
          beginPath() {},
          closePath() {},
          moveTo() {},
          lineTo() {},
          arc() {},
          ellipse() {},
          roundRect() {},
          fill() {},
          stroke() {},
          createRadialGradient() {
            return { addColorStop() {} };
          }
        };
      }
    };
    if (id) elementsById.set(id, el);
    return el;
  }

  // Pré-cria os elementos da HUD esperados pelo jogo
  const hudIds = [
    'game-container',
    'hud-stud-count',
    'hud-stud-gain',
    'hud-stud-coin',
    'hud-char-name',
    'hud-char-sub',
    'hud-op-tag',
    'hud-portrait-canvas',
    'hud-hearts',
    'true-hero-segments',
    'true-hero-percent',
    'true-hero-badge',
    'crosshair',
    'pill-caveira',
    'pill-solaris',
    'pointer-prompt',
    'controls-hud',
    'fps-counter',
    'anim-state'
  ];
  hudIds.forEach((id) => createMockElement(id.includes('canvas') ? 'canvas' : 'div', id));

  const winListeners = {};
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener(type, fn) {
      winListeners[type] = winListeners[type] || [];
      winListeners[type].push(fn);
    },
    dispatchEvent(evt) {
      const list = winListeners[evt.type] || [];
      list.forEach((fn) => fn(evt));
    },
    AudioContext: class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.destination = {};
      }
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          start() {},
          stop() {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
    }
  };

  globalThis.document = {
    pointerLockElement: null,
    createElement(tag) {
      return createMockElement(tag);
    },
    getElementById(id) {
      if (!elementsById.has(id)) {
        createMockElement('div', id);
      }
      return elementsById.get(id);
    },
    addEventListener(type, fn) {
      winListeners[type] = winListeners[type] || [];
      winListeners[type].push(fn);
    }
  };

  globalThis.__testEnvReady = true;
}

