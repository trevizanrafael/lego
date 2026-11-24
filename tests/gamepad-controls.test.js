import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  PAD, ON_FOOT_BINDINGS, GROUND_VEHICLE_BINDINGS, AIR_VEHICLE_BINDINGS, MENU_BINDINGS,
  applyRadialDeadzone, detectGamepadFamily, glyphFor, resolveBindingsForContext, buildGamepadHelpRows
} = await import('../src/controls/player/gamepad/GamepadBindings.js');
const { GamepadInputRuntime } = await import('../src/controls/player/gamepad/GamepadInputRuntime.js');
const { pickAimAssistTarget, yawTowards, wrapAngle, applyGamepadAimAssist } = await import('../src/controls/player/gamepad/GamepadAimAssist.js');

function makePad() {
  return {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
    connected: true,
    timestamp: 1,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
  };
}

function press(pad, name, on = true) {
  pad.buttons[PAD[name]] = { pressed: on, value: on ? 1 : 0 };
  pad.timestamp += 1;
}

function makeRig({ hud = {}, controller = null } = {}) {
  const pad = makePad();
  const events = [];
  const pointer = [];
  const ctl = controller || {
    keys: { forward: false, backward: false, left: false, right: false },
    yaw: 0,
    pitch: 0.3,
    position: { x: 0, y: 0, z: 0 },
    _handlePointerButtonDown: (b) => pointer.push(['down', b]),
    _handlePointerButtonUp: (b) => pointer.push(['up', b])
  };
  const rt = new GamepadInputRuntime(ctl, { settings: {}, ...hud }, {
    getGamepads: () => [pad],
    emitKey: (code, isDown) => events.push([code, isDown]),
    cursor: null
  });
  return { pad, events, pointer, ctl, rt };
}

describe('Gamepad — mapeamento escolhido pelo usuário', () => {
  it('a pé: LB corre, A pula, Y abre a Grade, X = Q, B = E', () => {
    assert.equal(ON_FOOT_BINDINGS.LB, 'ShiftLeft');
    assert.equal(ON_FOOT_BINDINGS.A, 'Space');
    assert.equal(ON_FOOT_BINDINGS.Y, 'Tab');
    assert.equal(ON_FOOT_BINDINGS.X, 'KeyQ');
    assert.equal(ON_FOOT_BINDINGS.B, 'KeyE');
    assert.equal(ON_FOOT_BINDINGS.RT, 'mouse:0');
    assert.equal(ON_FOOT_BINDINGS.LT, 'mouse:2');
  });

  it('veículos: gatilhos aceleram/freiam e aeronaves sobem/descem em A/B', () => {
    assert.equal(GROUND_VEHICLE_BINDINGS.RT, 'KeyW');
    assert.equal(GROUND_VEHICLE_BINDINGS.LT, 'KeyS');
    assert.equal(GROUND_VEHICLE_BINDINGS.A, 'ShiftLeft', 'A segurado = drift no carro');
    assert.equal(GROUND_VEHICLE_BINDINGS.LB, 'ShiftLeft', 'LB também faz drift');
    assert.equal(AIR_VEHICLE_BINDINGS.A, 'Space');
    assert.equal(AIR_VEHICLE_BINDINGS.B, 'KeyC');
    assert.equal(resolveBindingsForContext('menu'), MENU_BINDINGS);
  });

  it('zona morta radial zera o centro e reescala sem pulo', () => {
    assert.deepEqual(applyRadialDeadzone(0.1, 0.1), { x: 0, y: 0, mag: 0 });
    const full = applyRadialDeadzone(1, 0);
    assert.ok(Math.abs(full.mag - 1) < 1e-9);
    const justOut = applyRadialDeadzone(0.19, 0);
    assert.ok(justOut.mag > 0 && justOut.mag < 0.02);
  });

  it('detecta PlayStation pelo id e troca os ícones', () => {
    assert.equal(detectGamepadFamily('DualSense Wireless Controller (Vendor: 054c)'), 'playstation');
    assert.equal(detectGamepadFamily('Xbox 360 Controller'), 'xbox');
    assert.equal(glyphFor('A', 'playstation'), '✕');
    assert.equal(glyphFor('LB', 'playstation'), 'L1');
    assert.ok(buildGamepadHelpRows('xbox').length >= 10);
  });
});

describe('Gamepad — runtime', () => {
  it('converte botões em teclas com borda de descida e subida', () => {
    const { pad, events, rt } = makeRig();
    press(pad, 'A'); rt.poll(1 / 60);
    press(pad, 'A', false); rt.poll(1 / 60);
    assert.deepEqual(events, [['Space', true], ['Space', false]]);
  });

  it('RT/LT viram cliques do mouse (tiro e mira)', () => {
    const { pad, pointer, rt } = makeRig();
    press(pad, 'RT'); rt.poll(1 / 60);
    press(pad, 'RT', false); rt.poll(1 / 60);
    assert.deepEqual(pointer, [['down', 0], ['up', 0]]);
  });

  it('analógico esquerdo gera movimento analógico 360° e o direito gira a câmera', () => {
    const { pad, ctl, rt } = makeRig();
    pad.axes = [0.7, -0.7, 1, 0];
    rt.poll(0.1);
    assert.ok(ctl.analogMove && ctl.analogMove.y > 0 && ctl.analogMove.x > 0);
    assert.equal(ctl.keys.forward, true);
    assert.ok(ctl.yaw < 0, 'direita no analógico gira a câmera para a direita');
    pad.axes = [0, 0, 0, 0];
    rt.poll(0.1);
    assert.equal(ctl.analogMove, null);
    assert.equal(ctl.keys.forward, false);
  });

  it('no carro o analógico esterça e RT acelera', () => {
    const { pad, events, ctl, rt } = makeRig();
    ctl.currentVehicle = { mesh: { userData: { vehicleSpec: {} } } };
    rt.poll(1 / 60); // entra no contexto de veículo
    pad.axes = [-1, 0, 0, 0];
    press(pad, 'RT');
    rt.poll(1 / 60);
    assert.ok(ctl.analogSteer > 0.9, 'esquerda = esterço positivo');
    assert.deepEqual(events.at(-1), ['KeyW', true]);
  });

  it('menus: direcional navega, A confirma, B volta e o botão que abriu o menu não dispara de novo', () => {
    const hud = { isPauseMenuOpen: false };
    const { pad, events, rt } = makeRig({ hud });
    press(pad, 'MENU'); rt.poll(1 / 60);
    assert.deepEqual(events.at(-1), ['Escape', true]);
    rt.hud.isPauseMenuOpen = true;
    const before = events.length;
    rt.poll(1 / 60);
    assert.ok(events.slice(before).every(([c, d]) => !(c === 'Escape' && d)), 'MENU segurado não fecha a pausa');
    press(pad, 'MENU', false); rt.poll(1 / 60);
    press(pad, 'DOWN'); rt.poll(1 / 60);
    assert.deepEqual(events.slice(-2), [['ArrowDown', true], ['ArrowDown', false]]);
    press(pad, 'DOWN', false); press(pad, 'A'); rt.poll(1 / 60);
    assert.deepEqual(events.slice(-2), [['Enter', true], ['Enter', false]]);
  });

  it('VIEW: toque abre o mapa, segurar abre a rádio', () => {
    const { pad, events, rt } = makeRig();
    press(pad, 'VIEW'); rt.poll(0.05);
    press(pad, 'VIEW', false); rt.poll(0.05);
    assert.deepEqual(events.slice(-2), [['KeyM', true], ['KeyM', false]]);
    press(pad, 'VIEW'); rt.poll(0.2); rt.poll(0.2);
    assert.deepEqual(events.at(-1), ['KeyZ', true]);
  });
});

describe('Gamepad — mira assistida', () => {
  const enemy = (x, z, extra = {}) => ({ isCombatNpc: true, isAlliedToPlayer: false, destroyed: false, mesh: { position: { x, z } }, ...extra });

  it('mira no inimigo hostil dentro do cone e ignora aliados', () => {
    const list = [enemy(3, -20), enemy(0.5, -20, { isAlliedToPlayer: true }), enemy(40, 0)];
    const hit = pickAimAssistTarget(list, 0, 0, 0);
    assert.equal(hit.obj, list[0]);
  });

  it('puxa o yaw na direção do alvo sem ultrapassar', () => {
    const target = enemy(3, -20);
    const ctl = { yaw: 0, position: { x: 0, z: 0 }, destructibles: { getObjectsNear: () => [target] } };
    const goal = yawTowards(0, 0, 3, -20);
    applyGamepadAimAssist(ctl, 1 / 60);
    assert.ok(Math.abs(wrapAngle(goal - ctl.yaw)) < Math.abs(goal));
    assert.ok(Math.sign(ctl.yaw) === Math.sign(goal));
  });
});
