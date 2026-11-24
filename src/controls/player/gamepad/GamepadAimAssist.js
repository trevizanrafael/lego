// Mira assistida leve (estilo GTA) — só no controle, só a pé, só segurando LT.
// Gira o yaw da câmera suavemente em direção ao inimigo hostil mais alinhado com a mira.

export const AIM_ASSIST_RANGE = 70;
export const AIM_ASSIST_CONE = 0.17; // ~10° para cada lado
export const AIM_ASSIST_SNAP_CONE = 0.26; // ~15° no instante em que aperta LT
export const AIM_ASSIST_PULL = 3.2; // rad/s de convergência proporcional
export const AIM_ASSIST_SNAP = 0.55; // fração do erro corrigida no "snap" inicial

const _near = [];

export function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/** Yaw da câmera que aponta do jogador para o alvo (câmera olha para (-sin yaw, -cos yaw)). */
export function yawTowards(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

export function isAimAssistTarget(obj) {
  return Boolean(obj && !obj.destroyed && obj.isCombatNpc && !obj.isAlliedToPlayer && obj.mesh?.position);
}

/** Escolhe o alvo com menor desvio angular dentro do cone (desempate pela distância). */
export function pickAimAssistTarget(candidates, px, pz, yaw, cone = AIM_ASSIST_CONE, range = AIM_ASSIST_RANGE) {
  let best = null;
  let bestScore = Infinity;
  for (const obj of candidates) {
    if (!isAimAssistTarget(obj)) continue;
    const tx = obj.mesh.position.x;
    const tz = obj.mesh.position.z;
    const dist = Math.hypot(tx - px, tz - pz);
    if (dist < 1.2 || dist > range) continue;
    const delta = wrapAngle(yawTowards(px, pz, tx, tz) - yaw);
    if (Math.abs(delta) > cone) continue;
    const score = Math.abs(delta) + dist * 0.002;
    if (score < bestScore) { bestScore = score; best = { obj, delta, dist }; }
  }
  return best;
}

export function applyGamepadAimAssist(controller, dt, { justPressed = false } = {}) {
  if (!controller || controller.currentVehicle || controller.activeRide) return null;
  const query = controller.destructibles?.getObjectsNear;
  if (typeof query !== 'function') return null;
  const p = controller.position;
  const list = query.call(controller.destructibles, p.x, p.z, AIM_ASSIST_RANGE, _near);
  const hit = pickAimAssistTarget(list, p.x, p.z, controller.yaw, justPressed ? AIM_ASSIST_SNAP_CONE : AIM_ASSIST_CONE);
  if (!hit) return null;
  const step = justPressed ? hit.delta * AIM_ASSIST_SNAP : hit.delta * Math.min(1, AIM_ASSIST_PULL * dt);
  controller.yaw += step;
  return hit;
}
