// Mapeamento oficial do controle (Gamepad API, layout "standard") — Fase 1 do
// PLANO_CONTROLE_REGIOES_CONTINENTE.md. Módulo puro (sem DOM) para ser testável em Node.

/** Índices dos botões no layout `standard` da Gamepad API (Xbox / PlayStation / genéricos). */
export const PAD = Object.freeze({
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  VIEW: 8, MENU: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15
});

export const PAD_NAMES = Object.freeze(Object.keys(PAD));

/** Rótulos exibidos na HUD conforme a família do controle detectado. */
export const PAD_GLYPHS = Object.freeze({
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'VIEW', MENU: 'MENU', L3: 'L3', R3: 'R3', UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' },
  playstation: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'SHARE', MENU: 'OPTIONS', L3: 'L3', R3: 'R3', UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' }
});

export const STICK_DEADZONE = 0.18;
export const TRIGGER_THRESHOLD = 0.22;
export const DIGITAL_STICK_THRESHOLD = 0.5;
/** Segurar VIEW por mais que isso abre a Roda de Rádio; toque curto abre o mapa. */
export const VIEW_HOLD_SECONDS = 0.35;
/** Repetição de navegação de menu ao segurar o direcional/analógico. */
export const MENU_REPEAT_DELAY = 0.38;
export const MENU_REPEAT_RATE = 0.11;

/**
 * A pé (heróis e operadores). Esquema escolhido pelo usuário:
 * LB corre, A pula, Y abre a Grade (Tab), X = habilidade Q, B = habilidade E.
 * Valores = `KeyboardEvent.code` equivalente; `mouse:0`/`mouse:2` = cliques.
 */
export const ON_FOOT_BINDINGS = Object.freeze({
  A: 'Space',
  B: 'KeyE',
  X: 'KeyQ',
  Y: 'Tab',
  LB: 'ShiftLeft',
  RB: 'KeyF',
  LT: 'mouse:2',
  RT: 'mouse:0',
  L3: 'KeyH',
  R3: 'KeyC',
  UP: 'KeyG',
  DOWN: 'KeyR',
  LEFT: 'Digit1',
  RIGHT: 'Digit2',
  MENU: 'Escape'
});

/**
 * Carros, motos e barcos: gatilhos aceleram/freiam como no GTA.
 * Drift (freio de mão): segurar A ou LB curvando em velocidade (= Shift no teclado).
 */
export const GROUND_VEHICLE_BINDINGS = Object.freeze({
  A: 'ShiftLeft',
  B: 'mouse:0',
  X: 'KeyQ',
  Y: 'Tab',
  LB: 'ShiftLeft',
  RB: 'KeyF',
  LT: 'KeyS',
  RT: 'KeyW',
  R3: 'KeyX',
  L3: 'KeyH',
  UP: 'KeyG',
  DOWN: 'KeyR',
  MENU: 'Escape'
});

/** Helicópteros e aviões: A sobe, B desce, gatilhos controlam a potência, R3 dispara. */
export const AIR_VEHICLE_BINDINGS = Object.freeze({
  ...GROUND_VEHICLE_BINDINGS,
  A: 'Space',
  B: 'KeyC',
  R3: 'mouse:0'
});

/** Menus (título, pausa, loja, grade, mapa, dossiê, diálogos). */
export const MENU_BINDINGS = Object.freeze({
  A: 'Enter',
  B: 'Escape',
  MENU: 'Escape',
  Y: 'Tab',
  LB: 'KeyQ',
  RB: 'KeyE',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight'
});

/** Botões que repetem quando segurados num menu. */
export const MENU_REPEATING = Object.freeze(new Set(['UP', 'DOWN', 'LEFT', 'RIGHT']));

/** Contextos aéreos: categorias de veículo que voam. */
const AIR_CATEGORIES = new Set(['helicopter', 'plane', 'jet', 'aircraft']);

export function resolveBindingsForContext(context) {
  if (context === 'menu') return MENU_BINDINGS;
  if (context === 'air') return AIR_VEHICLE_BINDINGS;
  if (context === 'vehicle') return GROUND_VEHICLE_BINDINGS;
  return ON_FOOT_BINDINGS;
}

export function isAirVehicleCategory(category) {
  return AIR_CATEGORIES.has(String(category || '').toLowerCase());
}

/**
 * Zona morta radial com reescala: abaixo de `deadzone` vira zero, acima disso
 * o curso restante é remapeado para 0..1 (sem "pulo" na borda da zona morta).
 */
export function applyRadialDeadzone(x, y, deadzone = STICK_DEADZONE) {
  const rawX = Number.isFinite(x) ? x : 0;
  const rawY = Number.isFinite(y) ? y : 0;
  const mag = Math.hypot(rawX, rawY);
  if (mag <= deadzone) return { x: 0, y: 0, mag: 0 };
  const clamped = Math.min(1, mag);
  const scaled = (clamped - deadzone) / (1 - deadzone);
  const k = scaled / mag;
  return { x: rawX * k, y: rawY * k, mag: scaled };
}

/** Curva de resposta da câmera: precisão perto do centro, velocidade na borda. */
export function applyLookCurve(v, exponent = 1.6) {
  return Math.sign(v) * Math.pow(Math.abs(v), exponent);
}

/** Detecta a família do controle pelo `gamepad.id` para escolher os ícones. */
export function detectGamepadFamily(id = '') {
  const s = String(id).toLowerCase();
  if (/(054c|playstation|dualshock|dualsense|wireless controller|ps4|ps5)/.test(s)) return 'playstation';
  return 'xbox';
}

export function glyphFor(buttonName, family = 'xbox') {
  return (PAD_GLYPHS[family] || PAD_GLYPHS.xbox)[buttonName] || buttonName;
}

/** Lê um botão como pressionado (botões digitais e gatilhos analógicos). */
export function readButtonPressed(button, name) {
  if (!button) return false;
  if (name === 'LT' || name === 'RT') return Number(button.value || 0) > TRIGGER_THRESHOLD || Boolean(button.pressed && button.value === undefined);
  return Boolean(button.pressed) || Number(button.value || 0) > 0.5;
}

/** Linhas exibidas na tela de Configurações > Controles (rótulo da ação, botão). */
export function buildGamepadHelpRows(family = 'xbox') {
  const g = (n) => glyphFor(n, family);
  return [
    [`🎮 ${g('LB')}`, 'Correr (controle)'],
    [`🎮 ${g('A')}`, 'Pular / Subir no voo'],
    [`🎮 ${g('X')} / ${g('B')}`, 'Habilidade Q / Habilidade E'],
    [`🎮 ${g('Y')}`, 'Grade de Personagens'],
    [`🎮 ${g('RB')}`, 'Entrar/Sair de veículo, interagir'],
    [`🎮 ${g('RT')} / ${g('LT')}`, 'Atirar / Mirar (a pé) • Acelerar / Frear (veículo)'],
    [`🎮 ${g('A')} / ${g('LB')}`, 'Drift / freio de mão (segurar curvando no carro)'],
    [`🎮 ${g('DOWN')} / ${g('UP')}`, 'Recarregar / Poder extra'],
    [`🎮 ${g('LEFT')} / ${g('RIGHT')}`, 'Operador 1 / Operador 2'],
    [`🎮 ${g('R3')}`, 'Agachar / Rolamento / Descer no voo'],
    [`🎮 ${g('VIEW')}`, 'Toque: Mapa • Segurar: Roda de Rádio'],
    [`🎮 ${g('MENU')}`, 'Pausa']
  ];
}
