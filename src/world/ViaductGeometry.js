// Geometria CONTÍNUA de viadutos (pista sem emendas) e perfil vertical "de projeto".
//
// Antes, cada viaduto era montado com caixas de 6m inclinadas uma a uma: onde a inclinação mudava
// apareciam degraus e frestas na pista ("cortes"). Aqui cada elemento (laje, viga, asfalto, faixas,
// muretas) é uma única fita extrudada ao longo do perfil, com vértices compartilhados entre trechos.
import * as THREE from 'three';

/**
 * Fita extrudada com seção retangular ao longo de uma via reta alinhada a X ou Z.
 * @param samples  [{ c, y }] ordenados por `c` (coordenada ao longo da via) — `y` = topo de referência da pista
 * @param axis     'z_const' (via ao longo de X, em z = fixedCoord) | 'x_const' (via ao longo de Z, em x = fixedCoord)
 * @param fixedCoord coordenada fixa da via
 * @param cross0, cross1 deslocamento lateral (a partir do eixo) das duas faces da fita
 * @param topOffset  topo da fita relativo a `y`
 * @param thickness  espessura vertical da fita
 * @param faces    quais faces gerar: { top, bottom, sides }
 * @returns BufferGeometry indexada (position + normal)
 */
export function buildProfileRibbon(samples, axis, fixedCoord, cross0, cross1, topOffset, thickness, faces = {}) {
  const { top = true, bottom = true, sides = true } = faces;
  const n = samples.length;
  if (n < 2) return null;
  const toWorld = (c, cross, y) =>
    axis === 'z_const' ? new THREE.Vector3(c, y, fixedCoord + cross) : new THREE.Vector3(fixedCoord + cross, y, c);
  const crossDir = axis === 'z_const' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);

  const positions = [];
  const indices = [];
  // Cada face é uma faixa de quads; a ordem dos vértices é escolhida para a normal apontar para fora.
  const addStrip = (left, right, outward) => {
    const base = positions.length / 3;
    for (let i = 0; i < n; i++) {
      positions.push(left[i].x, left[i].y, left[i].z, right[i].x, right[i].y, right[i].z);
    }
    const e1 = new THREE.Vector3().subVectors(right[0], left[0]);
    const e2 = new THREE.Vector3().subVectors(left[1], left[0]);
    const flip = new THREE.Vector3().crossVectors(e1, e2).dot(outward) < 0;
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (!flip) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  };

  const topL = [];
  const topR = [];
  const botL = [];
  const botR = [];
  for (const s of samples) {
    const yt = s.y + topOffset;
    const yb = yt - thickness;
    topL.push(toWorld(s.c, cross0, yt));
    topR.push(toWorld(s.c, cross1, yt));
    botL.push(toWorld(s.c, cross0, yb));
    botR.push(toWorld(s.c, cross1, yb));
  }
  const sign = cross1 >= cross0 ? 1 : -1;
  if (top) addStrip(topL, topR, new THREE.Vector3(0, 1, 0));
  if (bottom) addStrip(botL, botR, new THREE.Vector3(0, -1, 0));
  if (sides) {
    addStrip(topL, botL, crossDir.clone().multiplyScalar(-sign));
    addStrip(topR, botR, crossDir.clone().multiplyScalar(sign));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Amostras do perfil entre c0 e c1 (inclusive), a cada `step` metros. */
export function sampleProfile(getY, c0, c1, step = 2) {
  const out = [];
  const n = Math.max(1, Math.ceil((c1 - c0) / step));
  for (let i = 0; i <= n; i++) {
    const c = c0 + ((c1 - c0) * i) / n;
    const y = getY(c);
    if (y !== null && y !== undefined) out.push({ c, y });
  }
  return out;
}

/**
 * Perfil "de projeto" do trecho elevado: em vez de copiar cada ondulação do relevo, usa rampas retas
 * de inclinação constante (no máximo `maxGrade`) e concordâncias suaves, sempre acima da altura exigida.
 * @param getRequiredY(c) altura mínima do topo da pista em `c`
 * @returns função c -> y (definida em [c0, c1])
 */
export function buildGradedProfile(getRequiredY, c0, c1, { step = 2, maxGrade = 0.03, smoothHalf = 16 } = {}) {
  const n = Math.max(1, Math.ceil((c1 - c0) / step));
  const cs = [];
  const req = [];
  for (let i = 0; i <= n; i++) {
    const c = c0 + ((c1 - c0) * i) / n;
    cs.push(c);
    req.push(getRequiredY(c));
  }
  const ds = (c1 - c0) / n;
  // 1) Envelope com inclinação limitada (só sobe pontos: vales viram rampas retas)
  const env = req.slice();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i <= n; i++) env[i] = Math.max(env[i], env[i - 1] - maxGrade * ds);
    for (let i = n - 1; i >= 0; i--) env[i] = Math.max(env[i], env[i + 1] - maxGrade * ds);
  }
  // 2) Concordâncias suaves (média móvel) + folga para nunca ficar abaixo do exigido
  const k = Math.max(1, Math.round(smoothHalf / ds));
  const smooth = env.map((_, i) => {
    let acc = 0;
    let cnt = 0;
    for (let j = i - k; j <= i + k; j++) {
      const jj = Math.min(n, Math.max(0, j));
      acc += env[jj];
      cnt++;
    }
    return acc / cnt;
  });
  let lift = 0;
  for (let i = 0; i <= n; i++) lift = Math.max(lift, req[i] - smooth[i]);
  const y = smooth.map((v) => v + lift);

  return (c) => {
    if (c <= c0) return y[0];
    if (c >= c1) return y[n];
    const f = (c - c0) / ds;
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    return y[i] + (y[i + 1] - y[i]) * t;
  };
}
