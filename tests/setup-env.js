/**
 * Ambiente DOM / Canvas 2D / Web Audio simulado para rodar todos os testes 3D em Node.js
 */
export function setupTestEnvironment() {
  if (typeof globalThis.window !== 'undefined' && globalThis.__testEnvReady) {
    return;
  }

  const elementsById = new Map();

  function parseHtmlInteractiveChildren(html) {
    const out = [];
    if (typeof html !== 'string' || (!html.includes('<button') && !html.includes('<input'))) {
      return out;
    }
    const tagRe = /<(button|input)\b([^>]*)>/gi;
    let match;
    while ((match = tagRe.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const attrs = match[2] || '';
      const idMatch = attrs.match(/\bid="([^"]*)"/i);
      const child = createMockElement(tag, idMatch ? idMatch[1] : '');
      const clsMatch = attrs.match(/\bclass="([^"]*)"/i);
      if (clsMatch) {
        clsMatch[1]
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => child.classList.add(c));
      }
      if (/\bdisabled\b/i.test(attrs)) {
        child.disabled = true;
      }
      const valMatch = attrs.match(/\bvalue="([^"]*)"/i);
      if (valMatch) {
        child.value = valMatch[1];
      }
      const styleMatch = attrs.match(/\bstyle="([^"]*)"/i);
      if (styleMatch) {
        styleMatch[1].split(';').forEach((pair) => {
          const [rawK, rawV] = pair.split(':');
          if (!rawK || rawV === undefined) return;
          const prop = rawK
            .trim()
            .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          child.style[prop] = rawV.trim();
        });
      }
      const dataRe = /\bdata-([a-z0-9-]+)="([^"]*)"/gi;
      let dm;
      while ((dm = dataRe.exec(attrs)) !== null) {
        const camel = dm[1].replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        child.dataset[camel] = dm[2];
      }
      out.push(child);
    }
    return out;
  }

  function matchesSimpleSelector(el, sel) {
    const parts = String(sel || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return true;
    return parts.some((part) => {
      if (part.startsWith('.')) {
        return el.classList.contains(part.slice(1));
      }
      const attrMatch = part.match(/^([a-z0-9]+)?\[data-([a-z0-9-]+)(?:="([^"]*)")?\]$/i);
      if (attrMatch) {
        if (attrMatch[1] && el.tagName !== attrMatch[1].toUpperCase()) return false;
        const camel = attrMatch[2].replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        if (!(camel in el.dataset)) return false;
        if (attrMatch[3] !== undefined && el.dataset[camel] !== attrMatch[3]) return false;
        return true;
      }
      return el.tagName === part.toUpperCase();
    });
  }

  function createMockElement(tag = 'div', id = '') {
    const classes = new Set();
    let _html = '';
    const el = {
      tagName: tag.toUpperCase(),
      id,
      get innerHTML() {
        return _html;
      },
      set innerHTML(val) {
        _html = String(val ?? '');
        this._parsedChildren = parseHtmlInteractiveChildren(_html);
      },
      textContent: '',
      value: '',
      disabled: false,
      dataset: {},
      style: {},
      children: [],
      _parsedChildren: null,
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
      querySelectorAll(selector) {
        if (Array.isArray(this._parsedChildren) && this._parsedChildren.length > 0 && selector) {
          return this._parsedChildren.filter((c) => matchesSimpleSelector(c, selector));
        }
        return this.children;
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
      click() {
        if (this.disabled) return;
        this.dispatchEvent({ type: 'click', target: this, currentTarget: this });
      },
      requestPointerLock() {
        globalThis.document.pointerLockElement = this;
      },
      getContext() {
        return {
          fillStyle: '',
          strokeStyle: '',
          font: '',
          textAlign: 'left',
          lineWidth: 1,
          lineCap: 'butt',
          fillRect() {},
          strokeRect() {},
          clearRect() {},
          fillText() {},
          beginPath() {},
          closePath() {},
          moveTo() {},
          lineTo() {},
          quadraticCurveTo() {},
          bezierCurveTo() {},
          arc() {},
          ellipse() {},
          roundRect() {},
          fill() {},
          stroke() {},
          save() {},
          restore() {},
          translate() {},
          rotate() {},
          scale() {},
          clip() {},
          drawImage() {},
          setLineDash() {},
          strokeText() {},
          createLinearGradient() {
            return { addColorStop() {} };
          },
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
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
      createBiquadFilter() {
        return {
          type: 'lowshelf',
          frequency: { value: 95, setValueAtTime() {} },
          gain: { value: 0, setValueAtTime() {} },
          Q: { value: 1, setValueAtTime() {} },
          connect() {}
        };
      }
      createAnalyser() {
        return {
          fftSize: 64,
          frequencyBinCount: 32,
          getByteFrequencyData(arr) {
            if (arr) {
              for (let i = 0; i < arr.length; i++) arr[i] = 140;
            }
          },
          connect() {}
        };
      }
    }
  };

  globalThis.document = {
    body: createMockElement('body'),
    pointerLockElement: null,
    exitPointerLock() {
      this.pointerLockElement = null;
    },
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

  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
  }

  // Permite que cada teste remonte a cidade do zero sem acumular listeners antigos
  // (cada listener segura o mundo/controle inteiro e impede o GC entre montagens).
  globalThis.__resetTestListeners = () => {
    for (const key of Object.keys(winListeners)) delete winListeners[key];
    for (const el of elementsById.values()) {
      if (el && el._listeners) el._listeners = {};
    }
  };

  globalThis.__testEnvReady = true;
}

export function resetTestListeners() {
  globalThis.__resetTestListeners?.();
}

