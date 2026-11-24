// Cursor virtual do controle para telas feitas para mouse (Oficinas, Hangar,
// Laboratório OP-09, Mapa Tático e Rádio TikTok). Analógico move, A clica, B fecha.

const CURSOR_SPEED = 1100; // px/s com o analógico no talo

export class GamepadVirtualCursor {
  constructor() {
    this.x = typeof window !== 'undefined' ? (window.innerWidth || 1280) / 2 : 640;
    this.y = typeof window !== 'undefined' ? (window.innerHeight || 720) / 2 : 360;
    this.visible = false;
    this.el = null;
    this._pressTarget = null;
  }

  _ensureEl() {
    if (this.el || typeof document === 'undefined' || typeof document.createElement !== 'function') return this.el;
    const el = document.createElement('div');
    el.id = 'gamepad-virtual-cursor';
    el.className = 'gamepad-virtual-cursor';
    document.body?.appendChild?.(el);
    this.el = el;
    return el;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    const el = this._ensureEl();
    el?.classList?.add('visible');
    this._sync();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el?.classList?.remove('visible');
    this._pressTarget = null;
  }

  move(dx, dy, dt) {
    const w = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight || 720 : 720;
    this.x = Math.max(0, Math.min(w - 1, this.x + dx * CURSOR_SPEED * dt));
    this.y = Math.max(0, Math.min(h - 1, this.y + dy * CURSOR_SPEED * dt));
    this._sync();
    const target = this._targetAt();
    if (target && target !== this._hoverTarget) {
      this._hoverTarget = target;
      this._dispatchMouse(target, 'mouseover');
    }
    // mousemove sempre: hover do mapa tático/oficinas e arrasto com A segurado.
    if (this._pressTarget || target) this._dispatchMouse(this._pressTarget || target, 'mousemove');
  }

  _sync() {
    if (this.el?.style) this.el.style.transform = `translate(${Math.round(this.x)}px, ${Math.round(this.y)}px)`;
  }

  _targetAt() {
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null;
    if (this.el?.style) this.el.style.display = 'none';
    const target = document.elementFromPoint(this.x, this.y);
    if (this.el?.style) this.el.style.display = '';
    return target;
  }

  _dispatchMouse(target, type) {
    if (!target?.dispatchEvent || typeof MouseEvent !== 'function') return;
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: this.x, clientY: this.y, button: 0, buttons: type === 'mouseup' ? 0 : 1 }));
  }

  press() {
    const target = this._targetAt();
    if (!target) return;
    this._pressTarget = target;
    if (typeof PointerEvent === 'function') target.dispatchEvent?.(new PointerEvent('pointerdown', { bubbles: true, clientX: this.x, clientY: this.y, button: 0, buttons: 1 }));
    this._dispatchMouse(target, 'mousedown');
  }

  release() {
    const target = this._targetAt() || this._pressTarget;
    if (!target) return;
    if (typeof PointerEvent === 'function') target.dispatchEvent?.(new PointerEvent('pointerup', { bubbles: true, clientX: this.x, clientY: this.y, button: 0 }));
    this._dispatchMouse(target, 'mouseup');
    if (target === this._pressTarget || this._pressTarget?.contains?.(target)) {
      if (typeof target.click === 'function') target.click();
      else this._dispatchMouse(target, 'click');
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') target.focus?.();
    }
    this._pressTarget = null;
  }
}
