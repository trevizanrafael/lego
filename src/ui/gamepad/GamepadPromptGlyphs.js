// Transcrição automática dos prompts de teclado para o controle.
// Quando o último dispositivo usado é o controle, todo texto da interface que mostra
// uma tecla — "[F] ENTRAR", <kbd>Q</kbd>, chips "M1 FUZIL", barra de dicas "ENTER / ESC"
// — passa a mostrar o botão equivalente (Xbox ou PlayStation). Ao voltar para teclado/
// mouse, os textos originais são restaurados. Funciona por MutationObserver, então cobre
// qualquer HUD/menu atual ou futuro sem alterar cada tela.

import { glyphFor } from '../../controls/player/gamepad/GamepadBindings.js';

/** Tecla (como aparece na interface) → botão do controle, em jogo. */
export const GAMEPLAY_KEY_TO_PAD = Object.freeze({
  F: 'RB', Q: 'X', E: 'B', R: 'DOWN', G: 'UP', H: 'UP', TAB: 'Y',
  M: 'MENU', ESC: 'VIEW', ESPAÇO: 'A', ESPACO: 'A', ESP: 'A', SPACE: 'A',
  SHIFT: 'L3', CTRL: 'R3', C: 'R3', Z: 'LB', P: 'LB', '1': 'LEFT', '2': 'RIGHT',
  M1: 'RT', M2: 'LT', LMB: 'RT', RMB: 'LT', 'BOTÃO ESQ.': 'RT', 'BOTÃO DIR.': 'LT', ENTER: 'A'
});

/** Tecla → botão dentro de menus (barra de dicas, abas da loja e das configurações). */
export const MENU_KEY_TO_PAD = Object.freeze({
  ENTER: 'A', ESC: 'B', BACKSPACE: 'B', ESPAÇO: 'A', SPACE: 'A', Q: 'LB', E: 'RB', TAB: 'Y',
  '↑/↓': 'UP/DOWN', '←/→': 'LEFT/RIGHT', '↑↓': 'UP/DOWN', '←→': 'LEFT/RIGHT'
});

const MENU_ELEMENT_SELECTOR = '.keyhint-kbd, .tab-key-badge';
const KEY_ELEMENT_SELECTOR = 'kbd, .ability-chip > b, .tab-key-badge, .qe-key-tag';
const BRACKET_RE = /\[([^\]\n]{1,12})\]/g;

function normalizeToken(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s*\/\s*/g, '/');
}

/** Converte um token de tecla ("F", "1 / 2", "ESC") no rótulo do controle, ou null. */
export function translateKeyToken(raw, family = 'xbox', menu = false) {
  const token = normalizeToken(raw);
  if (!token) return null;
  const table = menu ? MENU_KEY_TO_PAD : GAMEPLAY_KEY_TO_PAD;
  const direct = table[token];
  if (direct) return direct.split('/').map((n) => glyphFor(n, family)).join('/');
  if (token.includes('/')) {
    const parts = token.split('/').map((p) => table[p]);
    if (parts.every(Boolean)) return parts.map((n) => glyphFor(n, family)).join('/');
  }
  return null;
}

/** Substitui todos os "[TECLA]" de um texto. Retorna o texto original se nada mudou. */
export function translateBracketText(text, family = 'xbox') {
  if (!text || text.indexOf('[') === -1) return text;
  return text.replace(BRACKET_RE, (whole, inner) => {
    const g = translateKeyToken(inner, family, false);
    return g ? `[${g}]` : whole;
  });
}

class PromptGlyphTranslator {
  constructor() {
    this.active = false;
    this.family = 'xbox';
    this.originals = new Map(); // nó (Text ou Element) -> { original, translated }
    this.observer = null;
    this._busy = false;
    this._kbmBound = false;
  }

  _bindKeyboardMouseFallback() {
    if (this._kbmBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    this._kbmBound = true;
    // Eventos reais (isTrusted) de teclado/mouse devolvem os prompts de teclado.
    const back = (e) => { if (e && e.isTrusted) this.setActive(false); };
    window.addEventListener('keydown', back, true);
    window.addEventListener('mousedown', back, true);
  }

  setActive(on, family = this.family) {
    const changedFamily = family !== this.family;
    this.family = family;
    if (on === this.active && !changedFamily) return;
    this.active = on;
    if (typeof document === 'undefined' || !document.body) return;
    if (on) {
      this._bindKeyboardMouseFallback();
      if (changedFamily) this._restoreAll();
      this._scan(document.body);
      this._observe();
    } else {
      this.observer?.disconnect?.();
      this._restoreAll();
    }
  }

  _observe() {
    if (typeof MutationObserver !== 'function' || !document.body) return;
    if (!this.observer) {
      this.observer = new MutationObserver((muts) => {
        if (!this.active || this._busy) return;
        for (const m of muts) {
          if (m.type === 'characterData') this._translateTextNode(m.target);
          else for (const n of m.addedNodes) this._scan(n);
          if (m.type === 'childList' && m.target?.nodeType === 1) this._translateKeyElement(m.target);
        }
      });
    }
    this.observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  _scan(root) {
    if (!root) return;
    this._busy = true;
    try {
      if (root.nodeType === 3) { this._translateTextNode(root); return; }
      if (root.nodeType !== 1) return;
      if (root.matches?.(KEY_ELEMENT_SELECTOR)) this._translateKeyElement(root);
      for (const el of root.querySelectorAll?.(KEY_ELEMENT_SELECTOR) || []) this._translateKeyElement(el);
      const walker = document.createTreeWalker?.(root, 4 /* SHOW_TEXT */);
      if (walker) for (let n = walker.nextNode(); n; n = walker.nextNode()) this._translateTextNode(n);
    } finally {
      this._busy = false;
    }
  }

  /** HUDs que recriam innerHTML deixam nós órfãos: limpa o registro para não vazar memória. */
  _remember(node, rec) {
    this.originals.set(node, rec);
    if (this.originals.size > 1500) {
      for (const n of this.originals.keys()) if (n.isConnected === false) this.originals.delete(n);
    }
  }

  _translateTextNode(node) {
    const text = node?.data;
    if (!text || text.indexOf('[') === -1) return;
    const rec = this.originals.get(node);
    if (rec && rec.translated === text) return;
    const out = translateBracketText(text, this.family);
    if (out === text) return;
    this._remember(node, { original: text, translated: out });
    const prevBusy = this._busy;
    this._busy = true;
    node.data = out;
    this._busy = prevBusy;
  }

  _translateKeyElement(el) {
    if (!el || el.children?.length) return;
    const text = el.textContent;
    const rec = this.originals.get(el);
    if (rec && rec.translated === text) return;
    const isMenu = Boolean(el.matches?.(MENU_ELEMENT_SELECTOR));
    const g = translateKeyToken(text, this.family, isMenu);
    if (!g || g === text) return;
    this._remember(el, { original: text, translated: g });
    const prevBusy = this._busy;
    this._busy = true;
    el.textContent = g;
    el.classList?.add('is-pad-glyph');
    this._busy = prevBusy;
  }

  _restoreAll() {
    this._busy = true;
    for (const [node, rec] of this.originals) {
      if (node.nodeType === 3) { if (node.data === rec.translated) node.data = rec.original; }
      else if (node.textContent === rec.translated) { node.textContent = rec.original; node.classList?.remove('is-pad-glyph'); }
    }
    this.originals.clear();
    this._busy = false;
  }
}

const translator = new PromptGlyphTranslator();

/** Liga/desliga a transcrição de prompts para o controle (chamado pelo runtime do gamepad). */
export function setGamepadPromptMode(on, family = 'xbox') {
  translator.setActive(Boolean(on), family);
}

export function isGamepadPromptModeActive() {
  return translator.active;
}
