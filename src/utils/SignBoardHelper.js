import * as THREE from 'three';

const SIGN_REDRAW_REGISTRY = [];
let fontReadyListenerBound = false;

function ensureFontReadyRedrawListener() {
  if (fontReadyListenerBound) return;
  fontReadyListenerBound = true;

  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(() => {
      for (let i = 0; i < SIGN_REDRAW_REGISTRY.length; i++) {
        try {
          SIGN_REDRAW_REGISTRY[i]();
        } catch (_) {
          // ignora placas descartadas
        }
      }
    });
  }
}

/**
 * Mede a largura real do texto no Canvas 2D (com fallback seguro para ambiente headless de testes Node)
 */
export function measureCanvasTextWidth(ctx, text, fontSize) {
  const str = String(text ?? '');
  if (!str) return 0;
  if (ctx && typeof ctx.measureText === 'function') {
    const m = ctx.measureText(str);
    if (m && typeof m.width === 'number' && m.width > 0) {
      return m.width;
    }
  }
  return str.length * fontSize * 0.62;
}

/**
 * Ajusta matematicamente o tamanho da fonte em loop até caber em `maxWidth` (padrão: 82% da largura do canvas,
 * garantindo no mínimo 9% de margem livre à esquerda e 9% à direita — ZERO letra cortada!) e desenha centralizado.
 */
export function fitAndDrawText(
  ctx,
  text,
  centerX,
  centerY,
  maxWidth,
  initialFontSize,
  opts = {}
) {
  const str = String(text ?? '').trim();
  if (!str || !ctx) return initialFontSize;

  const minFontSize = opts.minFontSize ?? 12;
  const fontWeight = opts.fontWeight ?? '900';
  const fontFamily = opts.fontFamily ?? '"Chakra Petch", Arial, sans-serif';
  const fillStyle = opts.color ?? '#ffffff';

  let fontSize = Math.max(minFontSize, Math.round(initialFontSize));
  while (fontSize > minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const w = measureCanvasTextWidth(ctx, str, fontSize);
    if (w <= maxWidth) break;
    fontSize -= 2;
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, centerX, centerY);
  return fontSize;
}

/**
 * Cria uma CanvasTexture proporcional à geometria 3D real da placa (`aspect = boardWidth / boardHeight`)
 * e a registra para re-renderização automática após `document.fonts.ready`.
 */
export function createCustomCanvasSignTexture(boardWidth, boardHeight, drawFn, opts = {}) {
  ensureFontReadyRedrawListener();

  const canvasH = opts.canvasHeight ?? 256;
  const aspect = Math.max(0.35, Math.abs(boardWidth) / Math.max(0.25, Math.abs(boardHeight)));
  const minW = aspect < 1.0 ? 256 : (opts.minCanvasW ?? 512);
  const canvasW = THREE.MathUtils.clamp(Math.round(canvasH * aspect), minW, 2048);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const render = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawFn(ctx, canvasW, canvasH);
    tex.needsUpdate = true;
  };

  render();
  SIGN_REDRAW_REGISTRY.push(render);
  return tex;
}

/**
 * Cria uma Placa 3D Universal sem distorção de aspecto, com margem lateral garantida de >= 9% de cada lado
 * e array de 6 materiais (textura aplicada APENAS nas faces frontais/traseiras, cor sólida nas 4 bordas!).
 */
export function createSignBoardMesh(opts = {}) {
  const boardWidth = Math.max(0.4, Number(opts.width ?? 8.0));
  const boardHeight = Math.max(0.3, Number(opts.height ?? 1.8));
  const thickness = Math.max(0.08, Number(opts.depth ?? 0.45));

  const title = String(opts.title ?? '').trim();
  const subText = String(opts.subText ?? '').trim();
  const bgColor = opts.bgColor ?? '#090a0d';
  const borderColor = opts.borderColor ?? '#facc15';
  const textColor = opts.textColor ?? '#ffffff';
  const subColor = opts.subColor ?? '#facc15';
  const topStripeColor = opts.topStripeColor ?? null;
  const bottomStripeColor = opts.bottomStripeColor ?? null;
  const edgeHex = opts.edgeHex ?? new THREE.Color(bgColor).getHex();
  const doubleSided = opts.doubleSided !== false;

  const tex = createCustomCanvasSignTexture(
    boardWidth,
    boardHeight,
    (ctx, W, H) => {
      // Fundo sólido
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // Faixas decorativas opcionais (Metrô / Rodovia)
      if (topStripeColor) {
        const stripeH = Math.round(H * 0.11);
        ctx.fillStyle = topStripeColor;
        ctx.fillRect(0, 0, W, stripeH);
      }
      if (bottomStripeColor) {
        const stripeH = Math.round(H * 0.09);
        ctx.fillStyle = bottomStripeColor;
        ctx.fillRect(0, H - stripeH, W, stripeH);
      }

      // Moldura interna nítida respeitando a proporção
      if (borderColor) {
        const bw = Math.max(6, Math.round(H * 0.045));
        const pad = Math.round(bw * 0.9);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = bw;
        ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      }

      // Largura máxima obrigatória <= 82% de W (9% de folga à esquerda + 9% à direita!)
      const maxTextW = W * 0.82;

      if (subText) {
        fitAndDrawText(ctx, title, W * 0.5, H * 0.41, maxTextW, Math.round(H * 0.31), {
          color: textColor,
          fontWeight: '900',
          fontFamily: opts.titleFont ?? '"Chakra Petch", Arial, sans-serif'
        });
        fitAndDrawText(ctx, subText, W * 0.5, H * 0.73, maxTextW, Math.round(H * 0.175), {
          color: subColor,
          fontWeight: '800',
          fontFamily: opts.subFont ?? '"JetBrains Mono", "Chakra Petch", monospace'
        });
      } else {
        fitAndDrawText(ctx, title, W * 0.5, H * 0.52, maxTextW, Math.round(H * 0.42), {
          color: textColor,
          fontWeight: '900',
          fontFamily: opts.titleFont ?? '"Chakra Petch", Arial, sans-serif'
        });
      }
    },
    { canvasHeight: opts.canvasHeight ?? 256 }
  );

  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: edgeHex,
    roughness: 0.38,
    metalness: 0.18
  });

  // Ordem oficial do BoxGeometry(width, height, depth): [+X, -X, +Y, -Y, +Z (frente), -Z (trás)]
  const materials = [
    edgeMat,
    edgeMat,
    edgeMat,
    edgeMat,
    faceMat,
    doubleSided ? faceMat : edgeMat
  ];

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(boardWidth, boardHeight, thickness),
    materials
  );

  if (opts.position) {
    mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
  } else if (typeof opts.x === 'number') {
    mesh.position.set(opts.x, opts.y ?? 0, opts.z ?? 0);
  }
  if (typeof opts.rotY === 'number') {
    mesh.rotation.y = opts.rotY;
  }

  return mesh;
}

