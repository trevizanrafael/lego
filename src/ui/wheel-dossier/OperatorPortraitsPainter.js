/**
 * Pintor 2D Vetorial Gotham Noir para os 6 Operadores de Facção (CV, PCC, A.R.E.S.)
 * e os 3 Chefões Secretos (`boss_cv`, `boss_pcc`, `boss_ares`), compatível tanto com
 * ícones quadrados compactos (`48×48` / `58×58`) quanto cards verticais (`420×520`).
 */
export const OPERATOR_PORTRAIT_KEYS = Object.freeze([
  'cv_marretao', 'cv_fogueteira', 'pcc_contador',
  'pcc_muralha', 'ares_bastiao', 'ares_agulha',
  'boss_cv', 'boss_pcc', 'boss_ares'
]);

const OPERATOR_PORTRAIT_SET = new Set(OPERATOR_PORTRAIT_KEYS);

export function isOperatorPortraitKey(presetKey) {
  return OPERATOR_PORTRAIT_SET.has(presetKey);
}

const OPERATOR_THEMES = {
  cv_marretao: { rim: 'rgba(220, 38, 38, 0.68)', diag: 'rgba(220, 38, 38, 0.16)', aura: 'rgba(185, 28, 28, 0.22)', head: '#8c6239', headShade: '#5f3f22', torso: '#14171c' },
  cv_fogueteira: { rim: 'rgba(239, 68, 68, 0.66)', diag: 'rgba(185, 28, 28, 0.15)', aura: 'rgba(220, 38, 38, 0.2)', head: '#9c6b43', headShade: '#6e4728', torso: '#18181b' },
  pcc_contador: { rim: 'rgba(56, 189, 248, 0.62)', diag: 'rgba(30, 58, 138, 0.2)', aura: 'rgba(29, 78, 216, 0.22)', head: '#090a0d', headShade: '#040507', torso: '#0b101b' },
  pcc_muralha: { rim: 'rgba(59, 130, 246, 0.66)', diag: 'rgba(29, 78, 216, 0.18)', aura: 'rgba(30, 64, 175, 0.24)', head: '#07090e', headShade: '#030407', torso: '#07090e' },
  ares_bastiao: { rim: 'rgba(168, 85, 247, 0.7)', diag: 'rgba(147, 51, 234, 0.18)', aura: 'rgba(126, 34, 206, 0.24)', head: '#475569', headShade: '#334155', torso: '#0d0a18' },
  ares_agulha: { rim: 'rgba(192, 132, 252, 0.7)', diag: 'rgba(168, 85, 247, 0.17)', aura: 'rgba(147, 51, 234, 0.22)', head: '#1e2436', headShade: '#0f1320', torso: '#090b14' },
  boss_cv: { rim: 'rgba(239, 68, 68, 0.76)', diag: 'rgba(217, 155, 22, 0.18)', aura: 'rgba(185, 28, 28, 0.28)', head: '#855834', headShade: '#59371d', torso: '#1c080a' },
  boss_pcc: { rim: 'rgba(56, 189, 248, 0.74)', diag: 'rgba(56, 189, 248, 0.18)', aura: 'rgba(29, 78, 216, 0.28)', head: '#1f2937', headShade: '#111827', torso: '#090e1a' },
  boss_ares: { rim: 'rgba(192, 132, 252, 0.78)', diag: 'rgba(168, 85, 247, 0.2)', aura: 'rgba(126, 34, 206, 0.3)', head: '#334155', headShade: '#1e293b', torso: '#110b1f' }
};

function fillBox(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function fillRound(ctx, color, x, y, w, h, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function fillDisc(ctx, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function fillPoly(ctx, color, pts) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

const PORTRAIT_TILE_PX = 92;
const _operatorTileCache = new Map();

function _getCachedOperatorTile(presetKey) {
  const existing = _operatorTileCache.get(presetKey);
  if (existing) return existing;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const tileCanvas = document.createElement('canvas');
  if (typeof HTMLCanvasElement !== 'undefined' && !(tileCanvas instanceof HTMLCanvasElement)) return null;
  if (typeof HTMLCanvasElement === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  tileCanvas.width = PORTRAIT_TILE_PX;
  tileCanvas.height = PORTRAIT_TILE_PX;
  const tileCtx = tileCanvas?.getContext?.('2d');
  if (!tileCtx) return null;
  _renderOperatorPortraitDirect(tileCtx, PORTRAIT_TILE_PX, PORTRAIT_TILE_PX, presetKey);
  _operatorTileCache.set(presetKey, tileCanvas);
  return tileCanvas;
}

export function drawOperatorNoirPortrait(ctx, w, h, presetKey) {
  if (!ctx) return;
  const isSmallSquare = w <= 110 && h <= 110 && Math.abs(w - h) <= 4;
  if (isSmallSquare && typeof ctx.drawImage === 'function') {
    const cached = _getCachedOperatorTile(presetKey);
    if (cached) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cached, 0, 0, w, h);
      return;
    }
  }
  _renderOperatorPortraitDirect(ctx, w, h, presetKey);
}

function _renderOperatorPortraitDirect(ctx, w, h, presetKey) {
  const theme = OPERATOR_THEMES[presetKey] || OPERATOR_THEMES.cv_marretao;
  const isTallCard = h > w * 1.08;
  ctx.clearRect(0, 0, w, h);

  if (typeof ctx.createLinearGradient === 'function') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#04060a');
    bgGrad.addColorStop(0.58, '#080c15');
    bgGrad.addColorStop(1, '#0b101b');
    ctx.fillStyle = bgGrad;
  } else {
    ctx.fillStyle = '#060911';
  }
  ctx.fillRect(0, 0, w, h);

  const side = Math.min(w, h);
  const offsetX = (w - side) * 0.5;
  const offsetY = (h - side) * 0.44;
  const scale = side / 76;

  if (typeof ctx.createRadialGradient === 'function') {
    const auraGrad = ctx.createRadialGradient(w * 0.5, h * 0.46, side * 0.04, w * 0.5, h * 0.46, Math.max(w, h) * 0.58);
    auraGrad.addColorStop(0, theme.aura);
    auraGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.strokeStyle = theme.diag;
  ctx.lineWidth = Math.max(1, side * 0.022);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.68);
  ctx.lineTo(h * 0.68, 0);
  ctx.moveTo(w * 0.18, h);
  ctx.lineTo(w, h - w * 0.82);
  ctx.moveTo(w * 0.56, h);
  ctx.lineTo(w, h - w * 0.44);
  ctx.stroke();

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Silhueta dorsal projetada atrás dos ombros (RPG / antena + morteiros / drone / canhões)
  if (presetKey === 'cv_marretao') {
    fillPoly(ctx, '#36422e', [[52, 48], [64, 12], [69, 15], [58, 52]]);
    fillPoly(ctx, '#991b1b', [[62, 14], [69, 4], [71, 16]]);
  } else if (presetKey === 'cv_fogueteira') {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(20, 52);
    ctx.lineTo(15, 6);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      fillBox(ctx, '#27272a', 55 + i * 4.5, 28 + i * 2, 3.4, 24);
      fillBox(ctx, i === 1 ? '#ea580c' : '#dc2626', 55 + i * 4.5, 24 + i * 2, 3.4, 4.5);
    }
  } else if (presetKey === 'ares_bastiao') {
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(58, 44, 7.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (presetKey === 'boss_ares') {
    fillBox(ctx, '#475569', 10, 38, 7, 18);
    fillBox(ctx, '#475569', 59, 38, 7, 18);
    fillDisc(ctx, '#c084fc', 13.5, 38, 3.4);
    fillDisc(ctx, '#c084fc', 62.5, 38, 3.4);
  }

  // Ombros / Torso Angular Studless + Pescoço + Cabeça Esculpida Studless
  ctx.fillStyle = theme.torso;
  ctx.strokeStyle = '#04060a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(8, 76);
  ctx.lineTo(10, 56);
  ctx.lineTo(23, 51);
  ctx.lineTo(53, 51);
  ctx.lineTo(66, 56);
  ctx.lineTo(68, 76);
  if (!isTallCard) ctx.closePath();
  ctx.fill();
  ctx.stroke();

  fillBox(ctx, '#04060a', 27, 48, 22, 6);
  fillRound(ctx, theme.head, 17, 14, 42, 38, 8);
  ctx.strokeStyle = '#04060a';
  ctx.lineWidth = 2.3;
  ctx.stroke();
  fillRound(ctx, theme.headShade, 42, 15, 16, 36, 6);

  // Detalhamento Individual por Operador & Chefão
  if (presetKey === 'cv_marretao') {
    fillRound(ctx, '#090a0d', 16, 10, 44, 11, 5);
    fillBox(ctx, '#090a0d', 56, 15, 11, 4.5);
    fillBox(ctx, '#dc2626', 16, 18.5, 44, 6.5);
    fillDisc(ctx, '#dc2626', 14.5, 22, 3.8);
    fillBox(ctx, '#334155', 12, 26, 5, 15);
    fillBox(ctx, '#334155', 59, 26, 5, 15);
    fillBox(ctx, '#05070b', 21, 28, 12, 4.5);
    fillBox(ctx, '#05070b', 43, 28, 12, 4.5);
    fillBox(ctx, '#f8fafc', 24, 29, 6, 2.4);
    fillBox(ctx, '#f8fafc', 46, 29, 6, 2.4);
    fillRound(ctx, 'rgba(9, 10, 13, 0.72)', 20, 39, 36, 12.5, 4);
    fillBox(ctx, '#e2e8f0', 29, 43, 18, 2.6);
    fillBox(ctx, '#334155', 21, 55, 34, 19);
    for (let b = 0; b < 6; b++) {
      ctx.save();
      ctx.translate(22 + b * 6, 54 + b * 3.4);
      ctx.rotate(-0.55);
      fillBox(ctx, '#d99b16', -2, -4, 3.6, 8.5);
      ctx.restore();
    }
  } else if (presetKey === 'cv_fogueteira') {
    fillRound(ctx, '#18181b', 17, 11, 42, 9, 5);
    fillBox(ctx, '#b91c1c', 15.5, 17, 45, 6);
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(14, 22);
    ctx.quadraticCurveTo(38, 27, 62, 22);
    ctx.lineTo(59, 18.5);
    ctx.lineTo(17, 18.5);
    ctx.closePath();
    ctx.fill();
    fillBox(ctx, '#18181b', 12.5, 26, 4.8, 14);
    fillBox(ctx, '#18181b', 58.7, 26, 4.8, 14);
    fillBox(ctx, '#090a0d', 19.5, 26.5, 16.5, 8.5);
    fillBox(ctx, '#090a0d', 40, 26.5, 16.5, 8.5);
    fillBox(ctx, '#ef4444', 21.5, 28, 7.5, 2);
    fillBox(ctx, '#ef4444', 42, 28, 7.5, 2);
    fillBox(ctx, '#3f1d14', 31, 41.5, 14, 2.2);
    fillBox(ctx, '#b91c1c', 18, 52, 6, 23);
    fillBox(ctx, '#b91c1c', 52, 52, 6, 23);
    fillBox(ctx, '#e2e8f0', 32, 58, 12, 12);
    fillBox(ctx, '#dc2626', 36.5, 59.5, 3, 9);
    fillBox(ctx, '#dc2626', 33.5, 62.5, 9, 3);
  } else if (presetKey === 'pcc_contador') {
    fillBox(ctx, '#1e3a8a', 17, 21, 42, 2.5);
    fillBox(ctx, '#1e293b', 12, 25, 5.2, 16);
    fillBox(ctx, '#1e293b', 58.8, 25, 5.2, 16);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.4;
    fillBox(ctx, '#1d4ed8', 19.5, 26, 16.5, 8.5);
    ctx.strokeRect(19.5, 26, 16.5, 8.5);
    fillBox(ctx, '#1d4ed8', 40, 26, 16.5, 8.5);
    ctx.strokeRect(40, 26, 16.5, 8.5);
    fillBox(ctx, '#7dd3fc', 21.5, 27.5, 7, 2.2);
    fillBox(ctx, '#7dd3fc', 42, 27.5, 7, 2.2);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(14, 38);
    ctx.lineTo(31, 43);
    ctx.stroke();
    fillBox(ctx, '#1e3a8a', 20, 53.5, 36, 3);
    fillBox(ctx, '#475569', 24, 58.5, 10, 14);
    fillBox(ctx, '#475569', 37, 58.5, 10, 14);
    fillBox(ctx, '#ef4444', 28, 60, 2.5, 2.5);
    fillBox(ctx, '#ef4444', 41, 60, 2.5, 2.5);
  } else if (presetKey === 'pcc_muralha') {
    fillRound(ctx, '#0f172a', 14, 10, 48, 16, 6);
    fillBox(ctx, '#334155', 15, 22, 46, 4.2);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    fillBox(ctx, '#0b1938', 16.5, 26, 43, 14.5);
    ctx.strokeRect(16.5, 26, 43, 14.5);
    fillBox(ctx, '#38bdf8', 21, 29.5, 34, 3);
    ctx.strokeStyle = '#334155';
    fillBox(ctx, '#111827', 18, 44, 40, 11);
    ctx.strokeRect(18, 44, 40, 11);
    fillBox(ctx, '#1d4ed8', 11, 55, 13, 4);
    fillBox(ctx, '#1d4ed8', 52, 55, 13, 4);
    for (let s = 0; s < 5; s++) fillBox(ctx, '#dc2626', 25 + s * 5.6, 58 + s * 2.2, 3.6, 8);
  } else if (presetKey === 'ares_bastiao') {
    fillBox(ctx, '#64748b', 25, 10, 26, 6);
    fillPoly(ctx, '#090712', [[18, 25], [38, 31], [58, 25], [56, 36], [38, 41], [20, 36]]);
    fillPoly(ctx, '#a855f7', [[20, 27.5], [38, 33.5], [56, 27.5], [54.5, 33], [38, 38.5], [21.5, 33]]);
    fillBox(ctx, '#f3e8ff', 23, 29.5, 9, 2);
    fillBox(ctx, '#f3e8ff', 44, 29.5, 9, 2);
    fillBox(ctx, '#090712', 26, 42, 24, 9);
    fillBox(ctx, '#64748b', 9, 53, 12, 20);
    fillBox(ctx, '#64748b', 55, 53, 12, 20);
    fillBox(ctx, '#a855f7', 35, 56, 6, 17);
  } else if (presetKey === 'ares_agulha') {
    fillPoly(ctx, '#090b14', [[14, 24], [20, 9], [38, 7], [56, 9], [62, 24]]);
    fillBox(ctx, '#05060b', 18.5, 25.5, 39, 10.5);
    for (const [lx, lr] of [[25.5, 3.6], [38, 4.8], [50.5, 3.6]]) {
      fillDisc(ctx, '#c084fc', lx, 30.8, lr);
      fillDisc(ctx, '#faf5ff', lx - 0.8, 30, lr * 0.42);
    }
    fillBox(ctx, '#090b14', 22, 38.5, 32, 13);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(22, 38.5, 32, 13);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(27, 54);
    ctx.lineTo(32, 74);
    ctx.moveTo(49, 54);
    ctx.lineTo(44, 74);
    ctx.stroke();
  } else if (presetKey === 'boss_cv') {
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(36, 14, 25, 8, -0.14, 0, Math.PI * 2);
    ctx.fill();
    fillBox(ctx, '#d99b16', 18, 18.5, 38, 2.8);
    fillBox(ctx, '#05070b', 20, 26, 16, 8);
    fillBox(ctx, '#05070b', 40, 26, 16, 8);
    fillBox(ctx, '#d99b16', 22, 27.5, 7, 2);
    fillBox(ctx, '#d99b16', 42, 27.5, 7, 2);
    fillRound(ctx, '#140c08', 21, 38.5, 34, 13, 4);
    ctx.strokeStyle = '#d99b16';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(38, 54, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(38, 58, 15, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (presetKey === 'boss_pcc') {
    fillBox(ctx, '#38bdf8', 35, 7, 6, 10);
    fillBox(ctx, '#090d16', 18, 25.5, 40, 11);
    fillBox(ctx, '#38bdf8', 20, 28, 36, 6);
    fillBox(ctx, '#e0f2fe', 24, 29.5, 28, 2.4);
    fillBox(ctx, '#1f2937', 16, 54, 44, 20);
    fillBox(ctx, '#38bdf8', 24, 61, 28, 4.5);
  } else if (presetKey === 'boss_ares') {
    fillPoly(ctx, '#a855f7', [[18, 17], [11, 4], [24, 14]]);
    fillPoly(ctx, '#a855f7', [[58, 17], [65, 4], [52, 14]]);
    fillBox(ctx, '#070510', 18, 25, 40, 11);
    fillBox(ctx, '#c084fc', 19.5, 27.5, 37, 6);
    fillBox(ctx, '#faf5ff', 25, 29, 26, 2.5);
    fillDisc(ctx, '#a855f7', 38, 64, 6.5);
    fillDisc(ctx, '#faf5ff', 38, 64, 3.2);
  }

  ctx.strokeStyle = theme.rim;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(22, 15);
  ctx.lineTo(17.5, 19.5);
  ctx.lineTo(17.5, 46);
  ctx.moveTo(22, 51.5);
  ctx.lineTo(10.5, 56.5);
  ctx.lineTo(9, 73);
  ctx.stroke();
  ctx.restore();

  // Extensão da silhueta inferior do colete tático para cards verticais (ex.: 420×520)
  if (isTallCard) {
    const joinY = offsetY + side;
    const extH = h - joinY;
    const leftTopX = offsetX + 8 * scale;
    const rightTopX = offsetX + 68 * scale;
    const flare = extH * 0.1;
    const leftBotX = leftTopX - flare;
    const rightBotX = rightTopX + flare;
    const centerX = offsetX + 38 * scale;

    fillPoly(ctx, theme.torso, [[leftTopX, joinY - 1.5], [rightTopX, joinY - 1.5], [rightBotX, h + 2], [leftBotX, h + 2]]);
    ctx.strokeStyle = '#04060a';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(leftTopX, joinY - 1);
    ctx.lineTo(leftBotX, h + 2);
    ctx.moveTo(rightTopX, joinY - 1);
    ctx.lineTo(rightBotX, h + 2);
    ctx.stroke();

    ctx.strokeStyle = theme.diag;
    ctx.lineWidth = Math.max(1.2, 1.3 * scale);
    ctx.beginPath();
    ctx.moveTo(offsetX + 19 * scale, joinY);
    ctx.lineTo(offsetX + 22 * scale, h);
    ctx.moveTo(offsetX + 57 * scale, joinY);
    ctx.lineTo(offsetX + 54 * scale, h);
    ctx.moveTo(offsetX + 24 * scale, joinY + extH * 0.28);
    ctx.lineTo(centerX, joinY + extH * 0.52);
    ctx.lineTo(offsetX + 52 * scale, joinY + extH * 0.28);
    ctx.stroke();

    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 1.7 * scale;
    ctx.beginPath();
    ctx.moveTo(offsetX + 9 * scale, offsetY + 73 * scale);
    ctx.lineTo(leftBotX + 1.4 * scale, h);
    ctx.stroke();
  }

  if (typeof ctx.createLinearGradient === 'function') {
    const chiaro = ctx.createLinearGradient(0, 0, w, 0);
    chiaro.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
    chiaro.addColorStop(0.45, 'rgba(4, 6, 10, 0)');
    chiaro.addColorStop(1, 'rgba(2, 4, 9, 0.58)');
    ctx.fillStyle = chiaro;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createLinearGradient(0, h * 0.58, 0, h);
    vignette.addColorStop(0, 'rgba(3, 5, 9, 0)');
    vignette.addColorStop(1, 'rgba(2, 4, 8, 0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);
  }
}
