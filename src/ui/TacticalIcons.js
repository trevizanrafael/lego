/**
 * Conjunto Oficial de Icones Vetoriais (SVG Inline para DOM/HTML e Vetores Puros para Canvas 2D)
 * + Remapeadores de Paleta Gotham Noir / Batcomputador Sonar com cache O(1) para 60 FPS.
 * Estetica Tatica Urbana Angular — ZERO Emojis Unicode.
 */

const _blockNoirCache = new Map();
const _buildingNoirCache = new Map();
const _buildingStrokeCache = new Map();
const _biomeTintCache = new Map();
const _borderNoirCache = new Map();

function parseColorToRgb(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return {
      r: (input >> 16) & 255,
      g: (input >> 8) & 255,
      b: input & 255
    };
  }
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
    }
    return null;
  }

  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Math.min(255, Number(rgbMatch[1]) || 0),
      g: Math.min(255, Number(rgbMatch[2]) || 0),
      b: Math.min(255, Number(rgbMatch[3]) || 0)
    };
  }
  return null;
}

function hashStringFast(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Converte cores originais de quarteiroes/praias/parques/morros em tons urbanos noturnos Gotham Noir.
 */
export function remapBlockColorToGothamNoir(hexColor, blockType = '') {
  const key = `${hexColor || ''}|${blockType || ''}`;
  const cached = _blockNoirCache.get(key);
  if (cached !== undefined) return cached;

  let result = '#0d121b';
  const bt = String(blockType || '').toLowerCase();

  if (bt && /sand|beach|praia|orla|dune/.test(bt)) {
    result = '#161513';
  } else if (bt && /park|grass|green|forest|parque|grama|jardim/.test(bt)) {
    result = '#0b1613';
  } else if (bt && /favela|cdd|morro|slum|hill|dirt|terra|barro/.test(bt)) {
    result = '#161012';
  } else if (bt && /ind|port|porto|concrete|patio|yard|airport|apron|military/.test(bt)) {
    result = '#0f141e';
  } else {
    const rgb = parseColorToRgb(hexColor);
    if (rgb) {
      const { r, g, b } = rgb;
      const isYellowOrSand =
        r >= 145 && g >= 100 && r - b >= 38 && g - b >= 24 && g >= r * 0.55 && r >= g * 0.9;
      if (isYellowOrSand) {
        result = '#161513';
      } else if (g > r + 12 && g > b + 10) {
        result = '#0b1613';
      } else if (r > g + 18 && r > b + 12) {
        result = '#161012';
      } else {
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        result = lum >= 56 || (b > r + 18 && lum >= 42) ? '#0f141e' : '#0d121b';
      }
    }
  }

  if (_blockNoirCache.size > 2048) _blockNoirCache.clear();
  _blockNoirCache.set(key, result);
  return result;
}

/**
 * Converte qualquer cor plastica de teto de predio em pegadas sombrias de aco/ardosia (#182030 a #253146)
 * ou tom nobre escuro destacado (#241d16) quando isLandmark === true.
 */
export function remapBuildingColorToGothamNoir(hexColor, isLandmark = false) {
  const lmFlag = isLandmark ? 1 : 0;
  const key = `${hexColor || ''}|${lmFlag}`;
  const cached = _buildingNoirCache.get(key);
  if (cached !== undefined) return cached;

  let result;
  if (lmFlag) {
    result = '#241d16';
  } else {
    const rawStr = String(hexColor || '#334155');
    const rgb = parseColorToRgb(rawStr);
    const hashRatio = (hashStringFast(rawStr) % 100) / 99;
    const lumRatio = rgb ? (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255 : 0.4;
    const t = Math.min(1, Math.max(0, lumRatio * 0.55 + hashRatio * 0.45));

    const r = Math.round(24 + t * (37 - 24));
    const g = Math.round(32 + t * (49 - 32));
    const b = Math.round(48 + t * (70 - 48));
    result = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  if (_buildingNoirCache.size > 2048) _buildingNoirCache.clear();
  _buildingNoirCache.set(key, result);
  return result;
}

/**
 * Retorna a cor de contorno arquitetonico para predios no sonar (#334155 padrao, bronze #c28e2b ou carmesim #b91c1c em landmarks).
 */
export function getGothamBuildingStrokeColor(hexColor, isLandmark = false) {
  if (!isLandmark) return '#334155';
  const key = String(hexColor || '');
  const cached = _buildingStrokeCache.get(key);
  if (cached !== undefined) return cached;

  const rgb = parseColorToRgb(key);
  const isCrimson =
    rgb && rgb.r >= 140 && rgb.g < rgb.r * 0.55 && rgb.r - rgb.g >= 65 && rgb.r > rgb.b + 35;
  const stroke = isCrimson ? '#b91c1c' : '#c28e2b';
  if (_buildingStrokeCache.size > 512) _buildingStrokeCache.clear();
  _buildingStrokeCache.set(key, stroke);
  return stroke;
}

/**
 * Remapeia tints vivos de REGION_BIOME_MAP para tons noturnos dessaturados de Gotham.
 */
export function remapBiomeTintToGothamNoir(hexColor) {
  const key = String(hexColor || '');
  const cached = _biomeTintCache.get(key);
  if (cached !== undefined) return cached;

  let result = '#111a28';
  const rgb = parseColorToRgb(key);
  if (rgb) {
    const { r, g, b } = rgb;
    if (r >= 150 && g >= 110 && r - b >= 38 && g >= r * 0.55) {
      result = '#1c1a16';
    } else if (g > r + 14 && g > b + 10) {
      result = '#0d201a';
    } else if (r > g + 22 && r > b + 16) {
      result = '#221318';
    } else {
      result = '#121d2d';
    }
  }

  _biomeTintCache.set(key, result);
  return result;
}

/**
 * Remapeia linhas de fronteira regional para aco, bronze ou carmesim sombrio.
 */
export function remapRegionBorderToGothamNoir(hexColor) {
  const key = String(hexColor || '');
  const cached = _borderNoirCache.get(key);
  if (cached !== undefined) return cached;

  let result = '#475569';
  const rgb = parseColorToRgb(key);
  if (rgb) {
    const { r, g, b } = rgb;
    if (r >= 140 && g < r * 0.55 && r - g >= 65 && r > b + 35) {
      result = '#991b1b';
    } else if (r >= 165 && g >= 105 && b <= 115) {
      result = '#a17422';
    } else {
      result = '#475569';
    }
  }

  _borderNoirCache.set(key, result);
  return result;
}

/**
 * Classifica o tipo tatico de uma via (runway, bridge, main, local) para pintura no radar/mapa.
 */
export function classifyGothamRoadKind(rd) {
  if (!rd) return 'local';
  const rType = String(rd.type || rd.kind || rd.tag || '').toLowerCase();
  const minDim = Math.min(rd.w || 0, rd.d || 0);
  const maxDim = Math.max(rd.w || 0, rd.d || 0);

  if (
    rd.isRunway ||
    /runway|pista|tarmac/.test(rType) ||
    ((rd.x || 0) < -950 && minDim >= 34 && maxDim >= 220)
  ) {
    return 'runway';
  }
  if (
    rd.isBridge ||
    /bridge|ponte|viaduct|viaduto/.test(rType) ||
    ((rd.x || 0) > 650 && (rd.z || 0) > 650 && maxDim >= 110 && minDim <= 36)
  ) {
    return 'bridge';
  }
  if (rd.isMain || minDim >= 18) {
    return 'main';
  }
  return 'local';
}

export function getSvgIcon(iconKey, color = 'currentColor', size = 16) {
  const s = Number(size) || 16;
  const baseOpen = `<svg class="tactical-svg-icon" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="2.1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">`;
  const close = `</svg>`;

  switch (iconKey) {
    case 'bank':
      // Cofre / Cifrao Blindado (Super Banco Central)
      return `${baseOpen}
        <polygon points="12,2 21,6 21,18 12,22 3,18 3,6" fill="rgba(194,142,43,0.16)"/>
        <path d="M15 8.5H10.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9"/>
        <line x1="12" y1="6" x2="12" y2="18"/>
      ${close}`;

    case 'tower':
      // Torre dos Herois (Arranha-ceu + Estrela no Topo)
      return `${baseOpen}
        <polygon points="12,2 14.5,6.5 12,5.5 9.5,6.5" fill="${color}"/>
        <rect x="7" y="7" width="10" height="15" fill="rgba(30,41,59,0.42)"/>
        <line x1="10" y1="11" x2="14" y2="11"/>
        <line x1="10" y1="15" x2="14" y2="15"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
      ${close}`;

    case 'park':
      // Parque Central (Arvore Geometrica em Camadas)
      return `${baseOpen}
        <polygon points="12,2 19,10 15,10 20,17 4,17 9,10 5,10" fill="rgba(15,41,34,0.45)"/>
        <line x1="12" y1="17" x2="12" y2="22"/>
        <line x1="8" y1="22" x2="16" y2="22"/>
      ${close}`;

    case 'suburb':
      // Suburbio Norte / Posto (Casa + Bomba de Combustivel)
      return `${baseOpen}
        <polygon points="3,11 11,4 19,11" fill="rgba(51,43,36,0.42)"/>
        <polyline points="5,10 5,20 17,20 17,10"/>
        <rect x="9" y="14" width="4" height="6"/>
        <path d="M17 12h3v6h-3"/>
      ${close}`;

    case 'beach':
      // Orla Sul (Roda-Gigante / Onda Noturna)
      return `${baseOpen}
        <circle cx="12" cy="10" r="5" fill="rgba(30,41,59,0.38)"/>
        <line x1="12" y1="2" x2="12" y2="4"/>
        <line x1="4" y1="10" x2="6" y2="10"/>
        <line x1="18" y1="10" x2="20" y2="10"/>
        <path d="M2 18c2.5-2 5.5-2 8 0s5.5 2 8 0 4-2 4-2"/>
        <path d="M2 21.5c2.5-2 5.5-2 8 0s5.5 2 8 0"/>
      ${close}`;

    case 'cv':
    case 'cdd':
      // Cidade de Deus / CV (Coroa / Fortaleza no Morro)
      return `${baseOpen}
        <polygon points="3,18 5,7 9.5,12 12,5 14.5,12 19,7 21,18" fill="rgba(153,27,27,0.28)"/>
        <line x1="3" y1="21" x2="21" y2="21"/>
      ${close}`;

    case 'ares':
      // Syndicato A.R.E.S. (Escudo Cyber + Visor em V)
      return `${baseOpen}
        <polygon points="12,2 21,6 19,17 12,22 5,17 3,6" fill="rgba(88,28,135,0.30)"/>
        <polyline points="6.5,9.5 12,13.5 17.5,9.5"/>
        <line x1="9" y1="16.5" x2="15" y2="16.5"/>
      ${close}`;

    case 'pcc':
      // Distrito Industrial / Bunker PCC (Engrenagem Blindada / Hexagono Tatico)
      return `${baseOpen}
        <polygon points="12,2 20,6.5 20,17.5 12,22 4,17.5 4,6.5" fill="rgba(23,43,77,0.38)"/>
        <polygon points="12,7 16.5,9.5 16.5,14.5 12,17 7.5,14.5 7.5,9.5"/>
        <circle cx="12" cy="12" r="1.6" fill="${color}"/>
      ${close}`;

    case 'port':
      // Porto Leste (Ancora Naval Pesada)
      return `${baseOpen}
        <circle cx="12" cy="5" r="2.2" fill="rgba(30,41,59,0.36)"/>
        <line x1="12" y1="7.2" x2="12" y2="21"/>
        <line x1="7" y1="11" x2="17" y2="11"/>
        <path d="M4 15c0 4 3.6 6.5 8 6.5s8-2.5 8-6.5"/>
      ${close}`;

    case 'airport':
      // Aeroporto & Base Militar Oeste (Jato Supersonico)
      return `${baseOpen}
        <polygon points="12,2 14,9 21,13 21,15.5 14,13.5 13.5,18.5 16.5,20.5 16.5,22 12,20.8 7.5,22 7.5,20.5 10.5,18.5 10,13.5 3,15.5 3,13 10,9" fill="rgba(30,41,59,0.42)"/>
      ${close}`;

    case 'prison':
      // Ilha da Prisao (Escudo de Seguranca Maxima + Grades)
      return `${baseOpen}
        <polygon points="12,2 20,5.5 20,13 12,22 4,13 4,5.5" fill="rgba(127,29,29,0.28)"/>
        <line x1="9" y1="6.5" x2="9" y2="17.5"/>
        <line x1="12" y1="5" x2="12" y2="19.5"/>
        <line x1="15" y1="6.5" x2="15" y2="17.5"/>
        <line x1="6.5" y1="11.5" x2="17.5" y2="11.5"/>
      ${close}`;

    case 'sky':
      // Aeroporta-Avioes no Ceu (Asas + Rotor Duplo)
      return `${baseOpen}
        <polygon points="2,11 12,6 22,11 18,16 6,16" fill="rgba(23,43,77,0.36)"/>
        <circle cx="7.5" cy="11.5" r="2"/>
        <circle cx="16.5" cy="11.5" r="2"/>
        <line x1="9" y1="19" x2="15" y2="19"/>
      ${close}`;

    case 'metro':
      // Trem de Metro LEGO / Trilhos (Subsolo + Linha Elevada)
      return `${baseOpen}
        <rect x="5" y="3" width="14" height="14" fill="rgba(15,45,62,0.42)"/>
        <line x1="5" y1="11" x2="19" y2="11"/>
        <circle cx="8.5" cy="14" r="1.2" fill="${color}"/>
        <circle cx="15.5" cy="14" r="1.2" fill="${color}"/>
        <line x1="8" y1="17" x2="5" y2="21"/>
        <line x1="16" y1="17" x2="19" y2="21"/>
      ${close}`;

    case 'customs':
    case 'wrench':
      // Chave Inglesa + Engrenagem Bronze (Oficina LEGO Customs)
      return `${baseOpen}
        <polygon points="12,2 15,4 19,4 20,8 22,11 20,14 19,18 15,18 12,20 9,18 5,18 4,14 2,11 4,8 5,4 9,4" fill="rgba(194,142,43,0.16)"/>
        <path d="M14.5 7.5a3.5 3.5 0 0 0-4.6 4.6L6 16l2 2 3.9-3.9a3.5 3.5 0 0 0 4.6-4.6l-2 2-1.8-1.8 1.8-2.2z" fill="${color}"/>
      ${close}`;

    case 'emergency':
      // Alerta Tatico Triangular
      return `${baseOpen}
        <polygon points="12,3 21,20 3,20" fill="rgba(153,27,27,0.28)"/>
        <line x1="12" y1="9" x2="12" y2="14.5"/>
        <circle cx="12" cy="17.2" r="0.9" fill="${color}"/>
      ${close}`;

    case 'waypoint':
    case 'pin':
    default:
      // Mira / Pin Tatico de Localizacao
      return `${baseOpen}
        <polygon points="12,2 19,9 12,22 5,9" fill="rgba(30,41,59,0.40)"/>
        <circle cx="12" cy="9.5" r="2.5" fill="${color}"/>
      ${close}`;
  }
}

/**
 * Desenha um icone vetorial puro diretamente no Canvas 2D (Mapa [M] e Minimapa)
 * dentro de um marcador circular/octogonal centrado em (cx, cy).
 */
export function drawCanvasVectorIcon(ctx, iconKey, cx, cy, radius = 8, color = '#facc15') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, radius * 0.2);
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  const r = radius * 0.62;

  switch (iconKey) {
    case 'bank': {
      // Cifrao / Barra de Ouro
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.55);
      ctx.lineTo(-r * 0.45, -r * 0.55);
      ctx.lineTo(-r * 0.45, 0);
      ctx.lineTo(r * 0.45, 0);
      ctx.lineTo(r * 0.45, r * 0.55);
      ctx.lineTo(-r * 0.55, r * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(0, r * 0.9);
      ctx.stroke();
      break;
    }

    case 'tower': {
      // Silhueta da Torre dos Herois + Estrela
      ctx.strokeRect(-r * 0.45, -r * 0.35, r * 0.9, r * 1.2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(r * 0.35, -r * 0.35);
      ctx.lineTo(-r * 0.35, -r * 0.35);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'park': {
      // Arvore Geometrica
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 0.78, r * 0.35);
      ctx.lineTo(-r * 0.78, r * 0.35);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, r * 0.35);
      ctx.lineTo(0, r * 0.9);
      ctx.stroke();
      break;
    }

    case 'suburb': {
      // Casa / Suburbio
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.05);
      ctx.lineTo(0, -r * 0.85);
      ctx.lineTo(r * 0.8, -r * 0.05);
      ctx.stroke();
      ctx.strokeRect(-r * 0.52, -r * 0.05, r * 1.04, r * 0.85);
      break;
    }

    case 'beach': {
      // Sol + Onda Costeira
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, r * 0.62);
      ctx.lineTo(-r * 0.3, r * 0.35);
      ctx.lineTo(r * 0.3, r * 0.68);
      ctx.lineTo(r * 0.85, r * 0.38);
      ctx.stroke();
      break;
    }

    case 'cv':
    case 'cdd': {
      // Coroa de 3 Pontas (Cidade de Deus / CV)
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, r * 0.55);
      ctx.lineTo(-r * 0.65, -r * 0.55);
      ctx.lineTo(-r * 0.15, r * 0.05);
      ctx.lineTo(0, -r * 0.75);
      ctx.lineTo(r * 0.15, r * 0.05);
      ctx.lineTo(r * 0.65, -r * 0.55);
      ctx.lineTo(r * 0.8, r * 0.55);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'ares': {
      // Escudo Cyber Angular + Visor em V (Syndicato A.R.E.S.)
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.88);
      ctx.lineTo(r * 0.78, -r * 0.48);
      ctx.lineTo(r * 0.62, r * 0.42);
      ctx.lineTo(0, r * 0.88);
      ctx.lineTo(-r * 0.62, r * 0.42);
      ctx.lineTo(-r * 0.78, -r * 0.48);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, -r * 0.16);
      ctx.lineTo(0, r * 0.22);
      ctx.lineTo(r * 0.48, -r * 0.16);
      ctx.stroke();
      break;
    }

    case 'pcc': {
      // Hexagono Blindado com Nucleo (Bunker PCC)
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        const px = Math.cos(a) * r * 0.82;
        const py = Math.sin(a) * r * 0.82;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'port': {
      // Ancora Naval (Porto Leste)
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.75);
      ctx.lineTo(0, r * 0.75);
      ctx.moveTo(-r * 0.5, -r * 0.25);
      ctx.lineTo(r * 0.5, -r * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.15, r * 0.65, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }

    case 'airport': {
      // Silhueta de Jato (Aeroporto Oeste)
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 0.22, -r * 0.15);
      ctx.lineTo(r * 0.88, r * 0.25);
      ctx.lineTo(r * 0.2, r * 0.25);
      ctx.lineTo(r * 0.35, r * 0.82);
      ctx.lineTo(0, r * 0.62);
      ctx.lineTo(-r * 0.35, r * 0.82);
      ctx.lineTo(-r * 0.2, r * 0.25);
      ctx.lineTo(-r * 0.88, r * 0.25);
      ctx.lineTo(-r * 0.22, -r * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'prison': {
      // Escudo / Grade (Ilha da Prisao)
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.88);
      ctx.lineTo(r * 0.72, -r * 0.45);
      ctx.lineTo(r * 0.72, r * 0.18);
      ctx.lineTo(0, r * 0.88);
      ctx.lineTo(-r * 0.72, r * 0.18);
      ctx.lineTo(-r * 0.72, -r * 0.45);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(0, r * 0.55);
      ctx.moveTo(-r * 0.45, -r * 0.05);
      ctx.lineTo(r * 0.45, -r * 0.05);
      ctx.stroke();
      break;
    }

    case 'sky': {
      // Asa / Helice (Aeroporta-Avioes)
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(0, -r * 0.55);
      ctx.lineTo(r * 0.9, 0);
      ctx.lineTo(r * 0.5, r * 0.55);
      ctx.lineTo(-r * 0.5, r * 0.55);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.35, 0.05, r * 0.18, 0, Math.PI * 2);
      ctx.arc(r * 0.35, 0.05, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'metro': {
      // Vagao Frontal de Metro LEGO + Trilhos
      ctx.strokeRect(-r * 0.62, -r * 0.78, r * 1.24, r * 1.18);
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.08);
      ctx.lineTo(r * 0.62, -r * 0.08);
      ctx.moveTo(-r * 0.38, r * 0.42);
      ctx.lineTo(-r * 0.68, r * 0.88);
      ctx.moveTo(r * 0.38, r * 0.42);
      ctx.lineTo(r * 0.68, r * 0.88);
      ctx.stroke();
      break;
    }

    case 'customs':
    case 'wrench': {
      // Engrenagem Octogonal + Chave Inglesa Diagonal Dourada (LEGO Customs)
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rad = i % 2 === 0 ? r * 0.92 : r * 0.68;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.55);
      ctx.lineTo(r * 0.35, -r * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.42, -r * 0.42, r * 0.24, 0.2 * Math.PI, 1.55 * Math.PI);
      ctx.stroke();
      break;
    }

    case 'emergency': {
      // Alerta Tatico Triangular (!)
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.82, r * 0.72);
      ctx.lineTo(-r * 0.82, r * 0.72);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'waypoint':
    default: {
      // Reticula de Mira Tatica (Waypoint)
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(0, -r * 0.35);
      ctx.moveTo(0, r * 0.35);
      ctx.lineTo(0, r * 0.95);
      ctx.moveTo(-r * 0.95, 0);
      ctx.lineTo(-r * 0.35, 0);
      ctx.moveTo(r * 0.35, 0);
      ctx.lineTo(r * 0.95, 0);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

