import { getOp09CatalogEntry, drawOp09Portrait2D } from '../../entities/CustomHeroSystem.js';

/**
 * Metadados oficiais dos Operadores Jogáveis para a Roda Tática [TAB] e Ficha Individual [H].
 * As fichas detalhadas de poderes (`specialty`, `passive`, `controls`) são hidratadas por
 * `HeroDossierModalController.js` mantendo a mesma instância exportada de `HERO_CATALOG`.
 */
function _enrichOp09CatalogEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const rawName = String(entry.name || 'CIDADÃO COMUM')
    .split('//')[0]
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const isCitizen = rawName === 'CIDADÃO COMUM' || String(entry.role || '').includes('CIVIL DA METRÓPOLE');
  entry.cleanName = rawName || 'CIDADÃO COMUM';
  entry.cleanRole = isCitizen
    ? { 'pt-BR': 'CIVIL DA METRÓPOLE', 'en-US': 'METROPOLIS CITIZEN' }
    : { 'pt-BR': 'OPERADOR PERSONALIZADO', 'en-US': 'CUSTOM OPERATOR' };
  return entry;
}

export const HERO_CATALOG = [
  {
    key: 'caveira',
    opCode: 'OP-01',
    shortName: 'CAVEIRA',
    name: 'COMANDANTE CAVEIRA',
    cleanName: 'COMANDANTE CAVEIRA',
    role: 'OPERAÇÕES ESPECIAIS // BOPE',
    cleanRole: { 'pt-BR': 'OPERAÇÕES ESPECIAIS BOPE', 'en-US': 'BOPE SPECIAL OPS' },
    accent: '#d99b16',
    icon: 'shield',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'solaris',
    opCode: 'OP-02',
    shortName: 'SOLARIS',
    name: 'SOLARIS (REI DO SOL)',
    cleanName: 'SOLARIS',
    role: 'SOBERANO TERMONUCLEAR // VOO DE COMETA HIPERSÔNICO',
    cleanRole: { 'pt-BR': 'REI DO SOL', 'en-US': 'SUN KING' },
    accent: '#f97316',
    icon: 'star',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'tita',
    opCode: 'OP-03',
    shortName: 'TITÃ BLINDADO',
    name: 'TITÃ BLINDADO (PMESP)',
    cleanName: 'TITÃ BLINDADO',
    role: 'PM ROBÔ MUTANTE GIGANTE // CHOQUE PESADO PMESP',
    cleanRole: { 'pt-BR': 'COLOSSO CIBORGUE', 'en-US': 'CYBORG COLOSSUS' },
    accent: '#ef4444',
    icon: 'shield',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'vingador',
    opCode: 'OP-04',
    shortName: 'VINGADOR',
    name: 'VINGADOR DE CHUMBO',
    cleanName: 'VINGADOR DE CHUMBO',
    role: 'VIGILANTE IMPLACÁVEL (O JUSTICEIRO) // ARSENAL DE DEMOLIÇÃO',
    cleanRole: { 'pt-BR': 'ARSENAL PESADO', 'en-US': 'HEAVY ARSENAL' },
    accent: '#f8fafc',
    icon: 'crosshair',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'sombra',
    opCode: 'OP-05',
    shortName: 'SOMBRA',
    name: 'SOMBRA ESCARLATE',
    cleanName: 'SOMBRA ESCARLATE',
    role: 'CYBER-SHINOBI MÍSTICO // ASSASSINO DA LUA DE SANGUE',
    cleanRole: { 'pt-BR': 'SHINOBI DE GANCHO', 'en-US': 'GRAPPLE SHINOBI' },
    accent: '#ef4444',
    icon: 'bolt',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'turbo',
    opCode: 'OP-06',
    shortName: 'TURBO FANTASMA',
    name: 'TURBO FANTASMA',
    cleanName: 'TURBO FANTASMA',
    role: 'MOTOCICLISTA FANTASMA // PLASMA CIANO & MURALHA DE LUZ',
    cleanRole: { 'pt-BR': 'PILOTO DE PLASMA', 'en-US': 'PLASMA RIDER' },
    accent: '#22d3ee',
    icon: 'bolt',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'voltaico',
    opCode: 'OP-07',
    shortName: 'VOLTAICO',
    name: 'VOLTAICO (TEMPESTADE)',
    cleanName: 'VOLTAICO',
    role: 'SENHOR DA TEMPESTADE // ALTA TENSÃO & BOBINAS TESLA',
    cleanRole: { 'pt-BR': 'SENHOR DA TEMPESTADE', 'en-US': 'STORM LORD' },
    accent: '#38bdf8',
    icon: 'bolt',
    specialty: '',
    passive: '',
    controls: []
  },
  {
    key: 'vortex',
    opCode: 'OP-08',
    shortName: 'VÓRTEX',
    name: 'VÓRTEX (SIMBIONTE)',
    cleanName: 'VÓRTEX',
    role: 'COLOSSO SIMBIONTE ABISSAL // METAMORFO BIG-FIG',
    cleanRole: { 'pt-BR': 'COLOSSO SIMBIONTE', 'en-US': 'SYMBIOTE COLOSSUS' },
    accent: '#a855f7',
    icon: 'shield',
    specialty: '',
    passive: '',
    controls: []
  },
  _enrichOp09CatalogEntry(getOp09CatalogEntry())
];

export function syncOp09CatalogSlot() {
  HERO_CATALOG[8] = _enrichOp09CatalogEntry(getOp09CatalogEntry());
  return HERO_CATALOG[8];
}

export function getHeroInfo(heroKey) {
  syncOp09CatalogSlot();
  return HERO_CATALOG.find((h) => h.key === heroKey) || HERO_CATALOG[0];
}

export function getCleanHeroDisplayInfo(heroKey, lang = 'pt-BR') {
  const info = getHeroInfo(heroKey);
  const locale = lang === 'en-US' ? 'en-US' : 'pt-BR';
  const isDefaultCitizen = info.key === 'op09' && info.cleanName === 'CIDADÃO COMUM';
  const name = isDefaultCitizen && locale === 'en-US' ? 'CITIZEN' : (info.cleanName || info.shortName || info.name);
  const roleMap = info.cleanRole;
  const role =
    roleMap && typeof roleMap === 'object'
      ? roleMap[locale] || roleMap['pt-BR'] || ''
      : String(roleMap || info.role || '').split('//')[0].trim();
  return {
    key: info.key,
    opCode: info.opCode,
    name,
    role,
    accent: info.accent
  };
}

const PORTRAIT_THEMES = {
  caveira: {
    rim: 'rgba(217, 155, 22, 0.58)',
    diag: 'rgba(217, 155, 22, 0.13)',
    aura: 'rgba(217, 155, 22, 0.16)',
    head: '#b58863',
    headShade: '#8c6240',
    torso: '#0b0f17'
  },
  solaris: {
    rim: 'rgba(249, 115, 22, 0.65)',
    diag: 'rgba(234, 88, 12, 0.16)',
    aura: 'rgba(234, 88, 12, 0.22)',
    head: '#9a4818',
    headShade: '#692c0c',
    torso: '#450a0a'
  },
  tita: {
    rim: 'rgba(239, 68, 68, 0.62)',
    diag: 'rgba(220, 38, 38, 0.15)',
    aura: 'rgba(220, 38, 38, 0.18)',
    head: '#273244',
    headShade: '#171f2c',
    torso: '#1e293b'
  },
  vingador: {
    rim: 'rgba(226, 232, 240, 0.54)',
    diag: 'rgba(148, 163, 184, 0.13)',
    aura: 'rgba(148, 163, 184, 0.15)',
    head: '#bfa084',
    headShade: '#8f735b',
    torso: '#090c12'
  },
  sombra: {
    rim: 'rgba(239, 68, 68, 0.64)',
    diag: 'rgba(185, 28, 28, 0.16)',
    aura: 'rgba(185, 28, 28, 0.2)',
    head: '#07090e',
    headShade: '#030407',
    torso: '#13070b'
  },
  turbo: {
    rim: 'rgba(34, 211, 238, 0.68)',
    diag: 'rgba(6, 182, 212, 0.16)',
    aura: 'rgba(6, 182, 212, 0.22)',
    head: '#cbd5e1',
    headShade: '#94a3b8',
    torso: '#090d14'
  },
  voltaico: {
    rim: 'rgba(56, 189, 248, 0.66)',
    diag: 'rgba(56, 189, 248, 0.16)',
    aura: 'rgba(14, 165, 233, 0.2)',
    head: '#1e293b',
    headShade: '#0f172a',
    torso: '#0f172a'
  },
  vortex: {
    rim: 'rgba(168, 85, 247, 0.64)',
    diag: 'rgba(147, 51, 234, 0.16)',
    aura: 'rgba(126, 34, 206, 0.22)',
    head: '#05060a',
    headShade: '#020305',
    torso: '#05060a'
  }
};

function traceChamferedBox(ctx, x, y, w, h, cut) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

const PORTRAIT_TILE_PX = 92;
const _portraitTileCache = new Map();

function _getCachedPortraitTile(presetKey) {
  if (!presetKey || presetKey === 'op09') return null;
  const existing = _portraitTileCache.get(presetKey);
  if (existing) return existing;

  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const tileCanvas = document.createElement('canvas');
  if (typeof HTMLCanvasElement !== 'undefined' && !(tileCanvas instanceof HTMLCanvasElement)) {
    return null;
  }
  if (typeof HTMLCanvasElement === 'undefined' && typeof OffscreenCanvas === 'undefined') {
    return null;
  }
  tileCanvas.width = PORTRAIT_TILE_PX;
  tileCanvas.height = PORTRAIT_TILE_PX;
  const tileCtx = tileCanvas?.getContext?.('2d');
  if (!tileCtx) return null;

  _renderHeroLegoPortraitDirect(tileCtx, PORTRAIT_TILE_PX, PORTRAIT_TILE_PX, presetKey);
  _portraitTileCache.set(presetKey, tileCanvas);
  return tileCanvas;
}

/**
 * Desenha o retrato 2D Gotham Noir (studless, chiaroscuro e rim-light) de qualquer operador
 */
export function drawHeroLegoPortrait(ctx, w, h, presetKey) {
  const isSmallSquare = w <= 110 && h <= 110 && Math.abs(w - h) <= 4;

  if (presetKey === 'op09') {
    if (isSmallSquare) {
      drawOp09Portrait2D(ctx, w, h);
      return;
    }

    const side = Math.min(w, h);
    const offsetX = (w - side) * 0.5;
    const offsetY = (h - side) * 0.45;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, w, h);

    if (typeof ctx.createLinearGradient === 'function') {
      const outerGrad = ctx.createLinearGradient(0, 0, 0, h);
      outerGrad.addColorStop(0, '#04060a');
      outerGrad.addColorStop(0.5, '#060911');
      outerGrad.addColorStop(1, '#020408');
      ctx.fillStyle = outerGrad;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(side, 0);
    ctx.lineTo(side, side);
    ctx.lineTo(0, side);
    ctx.closePath();
    ctx.clip?.();
    drawOp09Portrait2D(ctx, side, side);
    ctx.restore();

    if (typeof ctx.createLinearGradient === 'function' && h > w * 1.08) {
      const blendStart = Math.max(0, offsetY + side - side * 0.14);
      const bottomBlend = ctx.createLinearGradient(0, blendStart, 0, h);
      bottomBlend.addColorStop(0, 'rgba(2, 4, 8, 0)');
      bottomBlend.addColorStop(1, 'rgba(2, 4, 8, 0.92)');
      ctx.fillStyle = bottomBlend;
      ctx.fillRect(0, blendStart, w, h - blendStart);
    }
    return;
  }

  if (isSmallSquare && typeof ctx?.drawImage === 'function') {
    const cachedTile = _getCachedPortraitTile(presetKey);
    if (cachedTile) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cachedTile, 0, 0, w, h);
      return;
    }
  }

  _renderHeroLegoPortraitDirect(ctx, w, h, presetKey);
}

function _renderHeroLegoPortraitDirect(ctx, w, h, presetKey) {
  const theme = PORTRAIT_THEMES[presetKey] || PORTRAIT_THEMES.caveira;
  const isTallCard = h > w * 1.08;
  ctx.clearRect(0, 0, w, h);

  // 1. Fundo Gotham Noir Cinematográfico (#04060a -> #080c15 -> #0b101b)
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
    const auraGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.46,
      side * 0.04,
      w * 0.5,
      h * 0.46,
      Math.max(w, h) * 0.58
    );
    auraGrad.addColorStop(0, theme.aura);
    auraGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Linhas táticas diagonais discretas em 45° atravessando todo o quadro w × h
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

  // Aura traseira específica antes da cabeça (Solaris / Turbo / Voltaico)
  if (presetKey === 'solaris') {
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(13, 24);
    ctx.lineTo(18, 4);
    ctx.lineTo(29, 13);
    ctx.lineTo(38, 1);
    ctx.lineTo(47, 13);
    ctx.lineTo(58, 4);
    ctx.lineTo(63, 24);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(17, 22);
    ctx.lineTo(22, 7);
    ctx.lineTo(31, 15);
    ctx.lineTo(38, 4);
    ctx.lineTo(45, 15);
    ctx.lineTo(54, 7);
    ctx.lineTo(59, 22);
    ctx.closePath();
    ctx.fill();
  } else if (presetKey === 'turbo') {
    ctx.fillStyle = '#082f49';
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.lineTo(16, 4);
    ctx.lineTo(27, 14);
    ctx.lineTo(38, 1);
    ctx.lineTo(49, 14);
    ctx.lineTo(60, 4);
    ctx.lineTo(66, 26);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(14, 24);
    ctx.lineTo(20, 7);
    ctx.lineTo(30, 15);
    ctx.lineTo(38, 3);
    ctx.lineTo(46, 15);
    ctx.lineTo(56, 7);
    ctx.lineTo(62, 24);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(19, 22);
    ctx.lineTo(25, 10);
    ctx.lineTo(33, 16);
    ctx.lineTo(38, 6);
    ctx.lineTo(43, 16);
    ctx.lineTo(51, 10);
    ctx.lineTo(57, 22);
    ctx.closePath();
    ctx.fill();
  } else if (presetKey === 'voltaico') {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(16, 19);
    ctx.lineTo(22, 5);
    ctx.lineTo(31, 14);
    ctx.lineTo(38, 2);
    ctx.lineTo(45, 14);
    ctx.lineTo(54, 5);
    ctx.lineTo(60, 19);
    ctx.closePath();
    ctx.fill();
  }

  // 2. Ombros / Torso Blindado Angular (Studless)
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
  ctx.closePath();
  ctx.fill();
  if (isTallCard) {
    ctx.beginPath();
    ctx.moveTo(8, 76);
    ctx.lineTo(10, 56);
    ctx.lineTo(23, 51);
    ctx.lineTo(53, 51);
    ctx.lineTo(66, 56);
    ctx.lineTo(68, 76);
    ctx.stroke();
  } else {
    ctx.stroke();
  }

  // Pescoço sombreado
  ctx.fillStyle = '#04060a';
  ctx.fillRect(27, 48, 22, 6);

  // 3. Cabeça Esculpida Studless (ZERO pino superior LEGO!)
  ctx.fillStyle = theme.head;
  ctx.strokeStyle = '#04060a';
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.roundRect(17, 14, 42, 38, 8);
  ctx.fill();
  ctx.stroke();

  // Relevo lateral da mandíbula/têmpora antes dos detalhes faciais
  ctx.fillStyle = theme.headShade;
  ctx.beginPath();
  ctx.roundRect(42, 15, 16, 36, 6);
  ctx.fill();

  // 4. Detalhamento Noir Individual por Operador
  if (presetKey === 'caveira') {
    // Sombra pesada projetada sob a boina preta do BOPE
    ctx.fillStyle = 'rgba(4, 6, 10, 0.74)';
    ctx.fillRect(18, 16, 40, 11);

    // Headset Tático ComTac BOPE
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(12, 25, 5.5, 16);
    ctx.fillRect(58.5, 25, 5.5, 16);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(12, 25, 5.5, 16);
    ctx.strokeRect(58.5, 25, 5.5, 16);

    // Boina Preta Oficial do BOPE inclinada + Insígnia Faca na Caveira em Bronze/Osso
    ctx.fillStyle = '#06080d';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(36, 14.5, 24.5, 7.8, -0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d99b16';
    ctx.beginPath();
    ctx.arc(46, 14, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(45, 11.2, 1.8, 5.6);

    // Cicatriz carmesim + Pintura de guerra escura nas maçãs do rosto
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(25.5, 20);
    ctx.lineTo(27.5, 43);
    ctx.stroke();

    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(19, 35.5, 9.5, 2.8);
    ctx.fillRect(47.5, 35.5, 9.5, 2.8);
    ctx.fillRect(20, 39, 7, 2);
    ctx.fillRect(49, 39, 7, 2);

    // Óculos Balísticos Escuros com Reflexo Âmbar-Fogo
    ctx.fillStyle = '#04060a';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(18.5, 25.5);
    ctx.lineTo(36, 27.5);
    ctx.lineTo(34.5, 34.5);
    ctx.lineTo(20, 33.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(57.5, 25.5);
    ctx.lineTo(40, 27.5);
    ctx.lineTo(41.5, 34.5);
    ctx.lineTo(56, 33.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d97706';
    ctx.fillRect(21.5, 27.5, 8.5, 2.6);
    ctx.fillRect(44.5, 27.5, 8.5, 2.6);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(22.5, 28, 4, 1.4);
    ctx.fillRect(45.5, 28, 4, 1.4);

    // Sobrancelhas cerradas
    ctx.strokeStyle = '#05070b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18.5, 23);
    ctx.lineTo(36, 26.8);
    ctx.moveTo(57.5, 23);
    ctx.lineTo(40, 26.8);
    ctx.stroke();

    // Barba cerrada pesada + Expressão severa trincada
    ctx.fillStyle = '#0f141e';
    ctx.beginPath();
    ctx.roundRect(22, 39.5, 32, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(29, 43, 18, 2.6);
    ctx.strokeStyle = '#05070b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(29, 43, 18, 2.6);

    // Colete Tático BOPE com Filete Bronze e Caveira Pálida
    ctx.fillStyle = '#d99b16';
    ctx.fillRect(21, 54, 34, 2.2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 56, 6, 18);
    ctx.fillRect(54, 56, 6, 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(38, 64.5, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05070b';
    ctx.fillRect(35.8, 63.5, 1.6, 1.6);
    ctx.fillRect(38.6, 63.5, 1.6, 1.6);
  } else if (presetKey === 'solaris') {
    // Coroa Metálica de Bronze/Ouro-Velho (#d99b16)
    ctx.fillStyle = '#d99b16';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(15, 22);
    ctx.lineTo(18, 11);
    ctx.lineTo(27, 17.5);
    ctx.lineTo(38, 7.5);
    ctx.lineTo(49, 17.5);
    ctx.lineTo(58, 11);
    ctx.lineTo(61, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.moveTo(38, 11);
    ctx.lineTo(40.5, 16);
    ctx.lineTo(38, 19.5);
    ctx.lineTo(35.5, 16);
    ctx.closePath();
    ctx.fill();

    // Sombra profunda nas órbitas + Olhos de Plasma Branco-Laranja
    ctx.fillStyle = 'rgba(43, 12, 4, 0.72)';
    ctx.fillRect(19, 25, 38, 11);

    ctx.fillStyle = '#ea580c';
    ctx.fillRect(20.5, 28, 13, 6.2);
    ctx.fillRect(42.5, 28, 13, 6.2);
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(23, 29.5, 8.5, 3.2);
    ctx.fillRect(44.5, 29.5, 8.5, 3.2);

    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(19.5, 25.5);
    ctx.lineTo(35, 28.5);
    ctx.moveTo(56.5, 25.5);
    ctx.lineTo(41, 28.5);
    ctx.stroke();

    // Semblante soberano austero
    ctx.strokeStyle = '#3b0d06';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(28, 43.5);
    ctx.lineTo(38, 41);
    ctx.lineTo(48, 43.5);
    ctx.stroke();

    // Armadura Termonuclear Bronze/Carmesim Escuro + Núcleo Solar
    ctx.fillStyle = '#d99b16';
    ctx.fillRect(19, 53.5, 38, 2.5);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(38, 64.5, 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffedd5';
    ctx.beginPath();
    ctx.arc(38, 64.5, 3.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetKey === 'tita') {
    // Domo Blindado Gunmetal PMESP + Giroflex Rubro Escuro
    ctx.fillStyle = '#334155';
    ctx.fillRect(17, 14, 42, 9);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(17, 21.5, 42, 3.2);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(21, 10.5, 8, 4);
    ctx.fillRect(47, 10.5, 8, 4);

    // Visor Laser Rubro em V
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(19, 26.5, 38, 12);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(19.5, 27.5);
    ctx.lineTo(38, 30.5);
    ctx.lineTo(56.5, 27.5);
    ctx.lineTo(54, 35.5);
    ctx.lineTo(38, 38.5);
    ctx.lineTo(22, 35.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fecaca';
    ctx.fillRect(23, 29.8, 9.5, 2.4);
    ctx.fillRect(43.5, 29.8, 9.5, 2.4);

    // Queixeira Industrial de Aço + Grelha Rubra
    ctx.fillStyle = '#090d14';
    ctx.fillRect(22, 40.5, 32, 10.5);
    ctx.fillStyle = '#b91c1c';
    for (let gx = 25; gx <= 49; gx += 6) {
      ctx.fillRect(gx, 42.5, 3.2, 6.5);
    }

    // Placas de Choque Cinza-Aço + Reator Rubro
    ctx.fillStyle = '#475569';
    ctx.fillRect(14, 55, 13, 18);
    ctx.fillRect(49, 55, 13, 18);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(13, 55, 14, 4);
    ctx.fillRect(49, 55, 14, 4);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(38, 64.5, 5.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetKey === 'vingador') {
    // Cabelo Militar Negro Penteado para Trás + Bandana Tática Escura
    ctx.fillStyle = '#06080d';
    ctx.beginPath();
    ctx.moveTo(16, 19);
    ctx.lineTo(17.5, 9.5);
    ctx.lineTo(27, 7);
    ctx.lineTo(38, 6);
    ctx.lineTo(49, 7);
    ctx.lineTo(58.5, 9.5);
    ctx.lineTo(60, 19);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.fillRect(16.5, 16.5, 43, 5.5);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(16.5, 16.5, 43, 5.5);

    // Sombra densa nos olhos estilo Frank Castle / Gotham + Cicatriz
    ctx.fillStyle = 'rgba(4, 6, 10, 0.86)';
    ctx.fillRect(18.5, 22.5, 39, 11.5);
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(47, 21.5);
    ctx.lineTo(44, 38.5);
    ctx.stroke();

    ctx.strokeStyle = '#04060a';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(20, 24);
    ctx.lineTo(35, 27.5);
    ctx.moveTo(56, 24);
    ctx.lineTo(41, 27.5);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(22.5, 27.8, 9.5, 3.2);
    ctx.fillRect(44, 27.8, 9.5, 3.2);

    // Barba por fazer pesada (stubble) + Maxilar cerrado de vigilante noturno
    ctx.fillStyle = 'rgba(11, 15, 23, 0.72)';
    ctx.beginPath();
    ctx.roundRect(18.5, 36.5, 39, 15, 5);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(28, 42, 20, 3.2);
    ctx.strokeStyle = '#05070b';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(28, 42, 20, 3.2);

    // Gola Alta do Sobretudo Noir + Grande Caveira Pálida no Peito
    ctx.fillStyle = '#04060a';
    ctx.fillRect(11, 48, 10, 14);
    ctx.fillRect(55, 48, 10, 14);

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(38, 61.5, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(32.2, 65.5, 11.6, 8.5);
    ctx.fillStyle = '#05070b';
    ctx.fillRect(33.5, 59.8, 3.4, 2.8);
    ctx.fillRect(39.2, 59.8, 3.4, 2.8);
    ctx.fillRect(34.5, 67.5, 1.6, 5.8);
    ctx.fillRect(37.2, 67.5, 1.6, 5.8);
    ctx.fillRect(40, 67.5, 1.6, 5.8);
  } else if (presetKey === 'sombra') {
    // Capuz Obsidiana + Chifres Oni Carmesim
    ctx.fillStyle = '#05070b';
    ctx.beginPath();
    ctx.roundRect(15, 11, 46, 13, 5);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(23.5, 15.5);
    ctx.lineTo(20, 6);
    ctx.lineTo(28.5, 14.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(52.5, 15.5);
    ctx.lineTo(56, 6);
    ctx.lineTo(47.5, 14.5);
    ctx.closePath();
    ctx.fill();

    // Bandana Hachigane Carmesim Escura + Placa Oni Gunmetal
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(16, 17, 44, 7);
    ctx.fillStyle = '#111827';
    ctx.fillRect(28, 17.5, 20, 6);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(28, 17.5, 20, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(33.5, 19.8, 9, 1.8);

    // Olhos Cyber-Shinobi Carmesim
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(20, 27);
    ctx.lineTo(35, 30);
    ctx.lineTo(33.5, 34.5);
    ctx.lineTo(21.5, 32.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(56, 27);
    ctx.lineTo(41, 30);
    ctx.lineTo(42.5, 34.5);
    ctx.lineTo(54.5, 32.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(24.5, 29.5, 5.5, 2);
    ctx.fillRect(45.5, 29.5, 5.5, 2);

    // Máscara Oni Obsidiana + Presas de Aço Frio
    ctx.fillStyle = '#04060a';
    ctx.fillRect(17.5, 36.5, 41, 15.5);
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(19, 37.5, 38, 13);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(25, 39.5, 3.2, 7.5);
    ctx.fillRect(47.8, 39.5, 3.2, 7.5);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(33, 40.5, 2.2, 7);
    ctx.fillRect(40.8, 40.5, 2.2, 7);

    // Cachecol Ninja Sangue-Escuro + Núcleo Espiritual
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(15, 51, 46, 5.5);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(38, 64.5, 4.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetKey === 'turbo') {
    // Crânio Osso Sombreado (#cbd5e1 + cavidades temporais #94a3b8)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(18, 33, 6, 12);
    ctx.fillRect(52, 33, 6, 12);

    // Órbitas Negras Abissais + Chamas Ciano-Abissais
    ctx.fillStyle = '#030508';
    ctx.beginPath();
    ctx.moveTo(19.5, 23.5);
    ctx.lineTo(34.5, 27.5);
    ctx.lineTo(33, 34.5);
    ctx.lineTo(20.5, 32.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(56.5, 23.5);
    ctx.lineTo(41.5, 27.5);
    ctx.lineTo(43, 34.5);
    ctx.lineTo(55.5, 32.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(22.5, 27.5, 7.5, 4.2);
    ctx.fillRect(46, 27.5, 7.5, 4.2);
    ctx.fillStyle = '#ecfeff';
    ctx.fillRect(24.5, 28.5, 3.8, 2.2);
    ctx.fillRect(47.8, 28.5, 3.8, 2.2);

    // Cavidade Nasal + Dentes do Crânio
    ctx.fillStyle = '#030508';
    ctx.beginPath();
    ctx.moveTo(38, 32.5);
    ctx.lineTo(34, 38.5);
    ctx.lineTo(42, 38.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(22, 40.5, 32, 9);
    ctx.fillStyle = '#cbd5e1';
    for (let tx = 24; tx <= 49; tx += 5.2) {
      ctx.fillRect(tx, 41.5, 3.2, 6.8);
    }

    // Jaqueta de Couro com Costelas Metálicas + Reator Ciano
    ctx.fillStyle = '#64748b';
    ctx.fillRect(19, 56, 9, 2.4);
    ctx.fillRect(48, 56, 9, 2.4);
    ctx.fillRect(21, 61, 8, 2.2);
    ctx.fillRect(47, 61, 8, 2.2);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(38, 64.5, 5.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetKey === 'voltaico') {
    // Elmo de Titânio (#1e293b) + Diadema Angular Aço + Asas de Raio Bronze/Ciano
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(14, 16.5);
    ctx.lineTo(38, 22.5);
    ctx.lineTo(62, 16.5);
    ctx.lineTo(62, 21);
    ctx.lineTo(38, 26.5);
    ctx.lineTo(14, 21);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#d99b16';
    ctx.beginPath();
    ctx.moveTo(15, 21);
    ctx.lineTo(4, 11);
    ctx.lineTo(11, 27.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(61, 21);
    ctx.lineTo(72, 11);
    ctx.lineTo(65, 27.5);
    ctx.closePath();
    ctx.fill();

    // Olhos Fulminantes (#38bdf8)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(19, 26.5);
    ctx.lineTo(34.5, 29.5);
    ctx.lineTo(33, 35);
    ctx.lineTo(20.5, 33.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(57, 26.5);
    ctx.lineTo(41.5, 29.5);
    ctx.lineTo(43, 35);
    ctx.lineTo(55.5, 33.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(22, 28.8, 9, 3.4);
    ctx.fillRect(45, 28.8, 9, 3.4);

    // Queixeira Angular de Titânio + Bobina Tesla no Peito
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, 38.5);
    ctx.lineTo(38, 43);
    ctx.lineTo(58, 38.5);
    ctx.lineTo(53.5, 50.5);
    ctx.lineTo(38, 54);
    ctx.lineTo(22.5, 50.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(24, 43.5);
    ctx.lineTo(34.5, 47.5);
    ctx.moveTo(52, 43.5);
    ctx.lineTo(41.5, 47.5);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(38, 64.5, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (presetKey === 'vortex') {
    // Veias Simbiontes Abissais sutis + Olhos Brancos Rasgados
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(22, 16);
    ctx.lineTo(28, 22);
    ctx.moveTo(54, 16);
    ctx.lineTo(48, 22);
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(35, 30.5);
    ctx.lineTo(26.5, 24.5);
    ctx.lineTo(18, 17.5);
    ctx.lineTo(16.5, 26.5);
    ctx.lineTo(24, 32.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(41, 30.5);
    ctx.lineTo(49.5, 24.5);
    ctx.lineTo(58, 17.5);
    ctx.lineTo(59.5, 26.5);
    ctx.lineTo(52, 32.5);
    ctx.closePath();
    ctx.fill();

    // Bocarra Abissal Rasgada com Presas + Língua Serpenteante
    ctx.fillStyle = '#140326';
    ctx.beginPath();
    ctx.moveTo(19, 35.5);
    ctx.quadraticCurveTo(38, 32.5, 57, 35.5);
    ctx.quadraticCurveTo(51, 50.5, 38, 51.5);
    ctx.quadraticCurveTo(25, 50.5, 19, 35.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    for (let fx = 22; fx <= 54; fx += 5.4) {
      ctx.beginPath();
      ctx.moveTo(fx - 1.8, 35);
      ctx.lineTo(fx + 1.8, 35);
      ctx.lineTo(fx, 41.2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(fx - 1.6, 49.5);
      ctx.lineTo(fx + 1.6, 49.5);
      ctx.lineTo(fx, 44.2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = '#be185d';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(38, 43.5);
    ctx.bezierCurveTo(40, 52.5, 51, 50.5, 54, 42.5);
    ctx.stroke();

    // Aranha Simbionte Branca no Peito
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(38, 55.5);
    ctx.lineTo(42.5, 63.5);
    ctx.lineTo(38, 73.5);
    ctx.lineTo(33.5, 63.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(38, 60.5);
      ctx.lineTo(38 + s * 18, 56.5);
      ctx.moveTo(38, 64.5);
      ctx.lineTo(38 + s * 19.5, 65.5);
      ctx.moveTo(38, 68.5);
      ctx.lineTo(38 + s * 16.5, 74.5);
      ctx.stroke();
    }
  }

  // 5. Rim-Light Angular no Contorno Esquerdo (Luz Recortada Noir)
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

  // 5b. Extensão da silhueta inferior do torso/capa para cards verticais (ex.: 420×520)
  if (isTallCard) {
    const joinY = offsetY + side;
    const extH = h - joinY;
    const leftTopX = offsetX + 8 * scale;
    const rightTopX = offsetX + 68 * scale;
    const flare = extH * 0.1;
    const leftBotX = leftTopX - flare;
    const rightBotX = rightTopX + flare;
    const centerX = offsetX + 38 * scale;

    ctx.fillStyle = theme.torso || '#090d16';
    ctx.beginPath();
    ctx.moveTo(leftTopX, joinY - 1.5);
    ctx.lineTo(rightTopX, joinY - 1.5);
    ctx.lineTo(rightBotX, h + 2);
    ctx.lineTo(leftBotX, h + 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#04060a';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(leftTopX, joinY - 1);
    ctx.lineTo(leftBotX, h + 2);
    ctx.moveTo(rightTopX, joinY - 1);
    ctx.lineTo(rightBotX, h + 2);
    ctx.stroke();

    ctx.strokeStyle = theme.diag;
    ctx.lineWidth = Math.max(1.2, 1.2 * scale);
    ctx.beginPath();
    ctx.moveTo(offsetX + 18 * scale, joinY);
    ctx.lineTo(offsetX + 22 * scale, h);
    ctx.moveTo(offsetX + 58 * scale, joinY);
    ctx.lineTo(offsetX + 54 * scale, h);
    ctx.moveTo(offsetX + 24 * scale, joinY + extH * 0.26);
    ctx.lineTo(centerX, joinY + extH * 0.5);
    ctx.lineTo(offsetX + 52 * scale, joinY + extH * 0.26);
    ctx.stroke();

    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 1.7 * scale;
    ctx.beginPath();
    ctx.moveTo(offsetX + 9 * scale, offsetY + 73 * scale);
    ctx.lineTo(leftBotX + 1.4 * scale, h);
    ctx.stroke();
  }

  // 6. Sombreamento Chiaroscuro Lateral + Vinheta Escura na Base
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

/**
 * Renderiza o Seletor Radial Tático estilo Arkham / Batcomputador [TAB]
 */
export function renderHeroWheelCanvas(canvas, selectedHeroKey, activeHeroKey) {
  if (!canvas) return;
  syncOp09CatalogSlot();
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.clearRect(0, 0, w, h);

  const count = HERO_CATALOG.length;
  const stepAngle = (Math.PI * 2) / count;
  const startOffset = -Math.PI / 2; // Setor 0 (Caveira) exatamente no Topo (W)
  const gap = 0.042;

  const outerR = 212;
  const innerR = 92;

  // Anel técnico externo em aço gunmetal com marcações angulares
  ctx.save();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash?.([10, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash?.([]);

  const tickCount = count * 4;
  for (let t = 0; t < tickCount; t++) {
    const ta = startOffset + (t * Math.PI * 2) / tickCount;
    const isMajor = t % 4 === 0;
    const r0 = outerR + (isMajor ? 8 : 10);
    const r1 = outerR + (isMajor ? 17 : 14);
    ctx.strokeStyle = isMajor ? 'rgba(148, 163, 184, 0.42)' : 'rgba(100, 116, 139, 0.24)';
    ctx.lineWidth = isMajor ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0);
    ctx.lineTo(cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < count; i++) {
    const hero = HERO_CATALOG[i];
    const isSelected = hero.key === selectedHeroKey;
    const isCurrent = hero.key === activeHeroKey;

    const a0 = startOffset + i * stepAngle - stepAngle * 0.5 + gap;
    const a1 = startOffset + (i + 1) * stepAngle - stepAngle * 0.5 - gap;
    const midA = (a0 + a1) * 0.5;

    const segOuterR = isSelected ? outerR + 8 : outerR;
    const segInnerR = isSelected ? innerR - 4 : innerR;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, segOuterR, a0, a1, false);
    ctx.arc(cx, cy, segInnerR, a1, a0, true);
    ctx.closePath();

    if (isSelected && typeof ctx.createRadialGradient === 'function') {
      const segGrad = ctx.createRadialGradient(cx, cy, segInnerR, cx, cy, segOuterR);
      segGrad.addColorStop(0, '#111826');
      segGrad.addColorStop(1, '#1a2436');
      ctx.fillStyle = segGrad;
    } else {
      ctx.fillStyle = isSelected
        ? '#161f30'
        : isCurrent
          ? 'rgba(9, 13, 22, 0.94)'
          : 'rgba(5, 7, 12, 0.92)';
    }
    ctx.fill();

    ctx.lineWidth = isSelected ? 2.6 : isCurrent ? 2.0 : 1.5;
    ctx.strokeStyle = isSelected
      ? hero.accent
      : isCurrent
        ? '#c28e2b'
        : 'rgba(51, 65, 85, 0.65)';
    ctx.stroke();

    // Arco externo luminoso no setor selecionado
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = hero.accent;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, segOuterR - 2.5, a0 + 0.016, a1 - 0.016, false);
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = hero.accent;
      ctx.stroke();
      ctx.restore();
    } else if (isCurrent) {
      ctx.beginPath();
      ctx.arc(cx, cy, segOuterR - 2.5, a0 + 0.04, a1 - 0.04, false);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#c28e2b';
      ctx.stroke();
    }

    // Posição do retrato e telemetria da fatia
    const midR = (segOuterR + segInnerR) * 0.5;
    const ix = cx + Math.cos(midA) * midR;
    const iy = cy + Math.sin(midA) * midR;

    // Moldura chanfrada octogonal/angular ao redor do retrato (Zero quadrado de plástico!)
    const boxSize = isSelected ? 46 : 40;
    const cut = isSelected ? 7 : 6;
    const bx = ix - boxSize * 0.5;
    const by = iy - boxSize * 0.68;

    ctx.save();
    ctx.translate(bx, by);
    ctx.save();
    traceChamferedBox(ctx, 0, 0, boxSize, boxSize, cut);
    ctx.clip?.();
    drawHeroLegoPortrait(ctx, boxSize, boxSize, hero.key);
    ctx.restore();

    traceChamferedBox(ctx, 0, 0, boxSize, boxSize, cut);
    ctx.strokeStyle = isSelected ? hero.accent : isCurrent ? '#c28e2b' : '#263244';
    ctx.lineWidth = isSelected ? 2.2 : 1.5;
    ctx.stroke();

    if (isSelected) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, cut + 5);
      ctx.lineTo(0, cut);
      ctx.lineTo(cut, 0);
      ctx.lineTo(cut + 5, 0);
      ctx.moveTo(boxSize, boxSize - cut - 5);
      ctx.lineTo(boxSize, boxSize - cut);
      ctx.lineTo(boxSize - cut, boxSize);
      ctx.lineTo(boxSize - cut - 5, boxSize);
      ctx.stroke();
    }
    ctx.restore();

    // Código OP + Nome Curto nítidos
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isSelected ? hero.accent : isCurrent ? '#d99b16' : '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(hero.opCode, ix, iy + boxSize * 0.32 + 5);

    ctx.font = isSelected
      ? '700 14.5px "Chakra Petch", sans-serif'
      : '700 12.5px "Chakra Petch", sans-serif';
    ctx.fillStyle = isSelected ? '#f8fafc' : '#cbd5e1';
    ctx.fillText(hero.shortName, ix, iy + boxSize * 0.32 + 19.5);

    ctx.restore();
  }

  // Hub Central em Obsidiana (#04060a) com Anel Duplo (#1e293b + selHero.accent)
  const selHero = getHeroInfo(selectedHeroKey);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 8, 0, Math.PI * 2);
  ctx.fillStyle = '#04060a';
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 14, 0, Math.PI * 2);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = selHero.accent;
  ctx.stroke();

  // Retículos cardeais no anel do hub
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.4;
  for (const ca of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ca) * (innerR - 17), cy + Math.sin(ca) * (innerR - 17));
    ctx.lineTo(cx + Math.cos(ca) * (innerR - 9), cy + Math.sin(ca) * (innerR - 9));
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.font = '800 10.5px "JetBrains Mono", monospace';
  ctx.fillStyle = selHero.accent;
  ctx.fillText(selHero.opCode, cx, cy - 27);

  ctx.font = '700 22px "Teko", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(selHero.shortName, cx, cy - 4);

  ctx.font = '700 9.5px "Chakra Petch", sans-serif';
  ctx.fillStyle = '#94a3b8';
  const shortRole = selHero.role.split('//')[0].trim();
  ctx.fillText(shortRole, cx, cy + 13);

  ctx.font = '800 8.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#d99b16';
  ctx.fillText('[WASD] GIRAR • [TAB] CONFIRMAR', cx, cy + 32);
  ctx.restore();
}
