/**
 * Conjunto Oficial de Icones Vetoriais (SVG Inline para DOM/HTML e Vetores Puros para Canvas 2D)
 * Estetica Tatica Urbana Angular (IDV LEGO: Cidade de Deus) — ZERO Emojis Unicode.
 */

export function getSvgIcon(iconKey, color = 'currentColor', size = 16) {
  const s = Number(size) || 16;
  const baseOpen = `<svg class="tactical-svg-icon" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="2.1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">`;
  const close = `</svg>`;

  switch (iconKey) {
    case 'bank':
      // Cofre / Cifrao Blindado (Super Banco Central)
      return `${baseOpen}
        <polygon points="12,2 21,6 21,18 12,22 3,18 3,6" fill="rgba(250,204,21,0.14)"/>
        <path d="M15 8.5H10.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9"/>
        <line x1="12" y1="6" x2="12" y2="18"/>
      ${close}`;

    case 'tower':
      // Torre dos Herois (Arranha-ceu + Estrela no Topo)
      return `${baseOpen}
        <polygon points="12,2 14.5,6.5 12,5.5 9.5,6.5" fill="${color}"/>
        <rect x="7" y="7" width="10" height="15" fill="rgba(56,189,248,0.14)"/>
        <line x1="10" y1="11" x2="14" y2="11"/>
        <line x1="10" y1="15" x2="14" y2="15"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
      ${close}`;

    case 'park':
      // Parque Central (Arvore Geometrica em Camadas)
      return `${baseOpen}
        <polygon points="12,2 19,10 15,10 20,17 4,17 9,10 5,10" fill="rgba(74,222,128,0.16)"/>
        <line x1="12" y1="17" x2="12" y2="22"/>
        <line x1="8" y1="22" x2="16" y2="22"/>
      ${close}`;

    case 'suburb':
      // Suburbio Norte / Posto (Casa + Bomba de Combustivel)
      return `${baseOpen}
        <polygon points="3,11 11,4 19,11" fill="rgba(251,146,60,0.16)"/>
        <polyline points="5,10 5,20 17,20 17,10"/>
        <rect x="9" y="14" width="4" height="6"/>
        <path d="M17 12h3v6h-3"/>
      ${close}`;

    case 'beach':
      // Praia & Orla Sul (Sol + Roda-Gigante / Onda)
      return `${baseOpen}
        <circle cx="12" cy="10" r="5" fill="rgba(253,224,71,0.16)"/>
        <line x1="12" y1="2" x2="12" y2="4"/>
        <line x1="4" y1="10" x2="6" y2="10"/>
        <line x1="18" y1="10" x2="20" y2="10"/>
        <path d="M2 18c2.5-2 5.5-2 8 0s5.5 2 8 0 4-2 4-2"/>
        <path d="M2 21.5c2.5-2 5.5-2 8 0s5.5 2 8 0"/>
      ${close}`;

    case 'cdd':
      // Cidade de Deus / CV (Coroa / Fortaleza no Morro)
      return `${baseOpen}
        <polygon points="3,18 5,7 9.5,12 12,5 14.5,12 19,7 21,18" fill="rgba(220,38,38,0.22)"/>
        <line x1="3" y1="21" x2="21" y2="21"/>
      ${close}`;

    case 'pcc':
      // Distrito Industrial / Bunker PCC (Engrenagem Blindada / Hexagono Tatico)
      return `${baseOpen}
        <polygon points="12,2 20,6.5 20,17.5 12,22 4,17.5 4,6.5" fill="rgba(59,130,246,0.18)"/>
        <polygon points="12,7 16.5,9.5 16.5,14.5 12,17 7.5,14.5 7.5,9.5"/>
        <circle cx="12" cy="12" r="1.6" fill="${color}"/>
      ${close}`;

    case 'port':
      // Porto Leste (Ancora Naval Pesada)
      return `${baseOpen}
        <circle cx="12" cy="5" r="2.2"/>
        <line x1="12" y1="7.2" x2="12" y2="21"/>
        <line x1="7" y1="11" x2="17" y2="11"/>
        <path d="M4 15c0 4 3.6 6.5 8 6.5s8-2.5 8-6.5"/>
      ${close}`;

    case 'airport':
      // Aeroporto & Base Militar Oeste (Jato Supersonico)
      return `${baseOpen}
        <polygon points="12,2 14,9 21,13 21,15.5 14,13.5 13.5,18.5 16.5,20.5 16.5,22 12,20.8 7.5,22 7.5,20.5 10.5,18.5 10,13.5 3,15.5 3,13 10,9" fill="rgba(148,163,184,0.18)"/>
      ${close}`;

    case 'prison':
      // Ilha da Prisao (Escudo de Seguranca Maxima + Grades)
      return `${baseOpen}
        <polygon points="12,2 20,5.5 20,13 12,22 4,13 4,5.5" fill="rgba(248,113,113,0.16)"/>
        <line x1="9" y1="6.5" x2="9" y2="17.5"/>
        <line x1="12" y1="5" x2="12" y2="19.5"/>
        <line x1="15" y1="6.5" x2="15" y2="17.5"/>
        <line x1="6.5" y1="11.5" x2="17.5" y2="11.5"/>
      ${close}`;

    case 'sky':
      // Aeroporta-Avioes no Ceu (Asas + Rotor Duplo)
      return `${baseOpen}
        <polygon points="2,11 12,6 22,11 18,16 6,16" fill="rgba(96,165,250,0.18)"/>
        <circle cx="7.5" cy="11.5" r="2"/>
        <circle cx="16.5" cy="11.5" r="2"/>
        <line x1="9" y1="19" x2="15" y2="19"/>
      ${close}`;

    case 'waypoint':
    case 'pin':
    default:
      // Mira / Pin Tatico de Localizacao
      return `${baseOpen}
        <polygon points="12,2 19,9 12,22 5,9" fill="rgba(250,204,21,0.16)"/>
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

