import { soundFX } from '../audio/SoundFX.js';
import { getSvgIcon } from './TacticalIcons.js';

/**
 * Catálogo Oficial dos 5 Operadores Jogáveis para a Roda Tática [TAB] e Ficha Individual [H]
 */
export const HERO_CATALOG = [
  {
    key: 'caveira',
    opCode: 'OP-01',
    shortName: 'CAVEIRA',
    name: 'COMANDANTE CAVEIRA',
    role: 'OPERAÇÕES ESPECIAIS // BOPE',
    accent: '#facc15',
    icon: 'shield',
    specialty: 'Combate Tático Urbano, Explosivos de Impulso & Patrulha Blindada',
    passive: 'Rolamento Tático evasivo com invulnerabilidade curta e Rocket Jump com granadas.',
    controls: [
      { key: 'MOUSE 1', title: 'FUZIL DE ASSALTO TÁTICO', desc: 'Disparo automático de alta precisão e cadência constante.' },
      { key: 'MOUSE 2', title: 'GRANADA / ROCKET JUMP', desc: 'Arremessa granada explosiva que impulsiona o herói no ar.' },
      { key: 'Q / CTRL', title: 'ROLAMENTO TÁTICO BOPE', desc: 'Esquiva rápida para frente com reposicionamento imediato.' },
      { key: 'V', title: 'CORONHADA TÁTICA', desc: 'Golpe físico de curta distância para quebrar objetos.' },
      { key: 'ESPAÇO', title: 'SALTO DE OPERADOR', desc: 'Salto tático para transpor barricadas, muros e veículos.' },
      { key: 'SHIFT', title: 'CORRIDA TÁTICA', desc: 'Velocidade de deslocamento acelerada em patrulha urbana.' }
    ]
  },
  {
    key: 'solaris',
    opCode: 'OP-02',
    shortName: 'SOLARIS',
    name: 'SOLARIS',
    role: 'SENTINELA TERMONUCLEAR // VOO SUPERSÔNICO',
    accent: '#f97316',
    icon: 'star',
    specialty: 'Domínio Aéreo Supersônico & Fusão de Estruturas de Ouro LEGO',
    passive: 'Voo livre tridimensional (2x Espaço) e modo Cometa Supersônico (Shift no ar).',
    controls: [
      { key: '2x ESPAÇO', title: 'VOO & LEVITAÇÃO SOLAR', desc: 'Ativa voo livre. Segure ESPAÇO para subir no ar.' },
      { key: 'CTRL / C', title: 'MERGULHO / DESCIDA AÉREA', desc: 'Reduz altitude rapidamente durante a levitação solar.' },
      { key: 'SHIFT (AR)', title: 'VOO DE COMETA SUPERSÔNICO', desc: 'Propulsão extrema com rastro de plasma pelos prédios.' },
      { key: 'MOUSE 1', title: 'BOLAS DE FOGO', desc: 'Dispara projéteis ígneos explosivos em sequência.' },
      { key: 'MOUSE 2', title: 'RAIO SOLAR CONTÍNUO', desc: 'Feixe térmico concentrado que derrete objetos de OURO LEGO.' },
      { key: 'Q / F', title: 'EXPLOSÃO SUPERNOVA', desc: 'Detona uma onda de choque solar em 360° ao redor do herói.' }
    ]
  },
  {
    key: 'tita',
    opCode: 'OP-03',
    shortName: 'TITÃ BLINDADO',
    name: 'TITÃ BLINDADO',
    role: 'UNIDADE MECHA PESADA // BIG-FIG COLOSSAL',
    accent: '#00f0ff',
    icon: 'shield',
    specialty: 'Demolição de Paredes Rachadas, Arremesso de Veículos & Impacto Sísmico',
    passive: 'Chassi Big-Fig blindado com Super-Pulo a jato que racha o asfalto ao pousar.',
    controls: [
      { key: 'MOUSE 1', title: 'METRALHADORA ROTATIVA', desc: 'Rajada pesada contínua de 4 canos com munição ciano.' },
      { key: 'MOUSE 2 / F', title: 'AGARRAR & ARREMESSAR CARRO', desc: 'Levanta carros acima da cabeça e os arremessa como bombas.' },
      { key: 'V', title: 'SOCO FOGUETE DEMOLIDOR', desc: 'Avança a jato destruindo PAREDES RACHADAS LEGO.' },
      { key: 'Q', title: 'TERREMOTO DE ESCUDO', desc: 'Impacto sísmico no solo que destrói estruturas e paredes.' },
      { key: 'ESPAÇO', title: 'SUPER-PULO PESADO', desc: 'Salto propulsado de grande altitude com impacto no pouso.' },
      { key: 'SHIFT', title: 'MARCHA BLINDADA', desc: 'Avanço pesado de alta tração do chassi Mecha Big-Fig.' }
    ]
  },
  {
    key: 'vingador',
    opCode: 'OP-04',
    shortName: 'VINGADOR',
    name: 'VINGADOR DE CHUMBO',
    role: 'JUSTICEIRO URBANO // ARSENAL PESADO TRIPLO',
    accent: '#cbd5e1',
    icon: 'crosshair',
    specialty: 'Demolição de Objetos de LEGO Prateado Brilhante & Poder de Fogo Bruto',
    passive: 'Carrega 3 armas pesadas intercambiáveis em tempo real (SMGs Duplas, Escopeta e RPG).',
    controls: [
      { key: 'R / MOUSE 2', title: 'ALTERNAR ARMA (3 ARMAS)', desc: 'Troca entre Duas SMGs, Escopeta de Impacto e Bazuca RPG.' },
      { key: 'MOUSE 1 (1)', title: 'DUAS SUBMETRALHADORAS', desc: 'Cadência dupla insana com recuo alternado nos braços.' },
      { key: 'MOUSE 1 (2)', title: 'ESCOPETA DE IMPACTO', desc: 'Disparo em cone de 7 balotes incendiários de alto dano.' },
      { key: 'MOUSE 1 (3)', title: 'BAZUCA RPG ANTI-PRATA', desc: 'Dispara foguete pesado que destrói OBJETOS PRATEADOS.' },
      { key: 'Q', title: 'GRANADA DE FRAGMENTAÇÃO', desc: 'Lança granada explosiva tática à distância.' },
      { key: 'V', title: 'GOLPE DE CORONHA PESADA', desc: 'Ataque físico corpo a corpo para quebrar obstáculos.' }
    ]
  },
  {
    key: 'sombra',
    opCode: 'OP-05',
    shortName: 'SOMBRA',
    name: 'SOMBRA ESCARLATE',
    role: 'CYBER-SHINOBI // GANCHO MAGNÉTICO & FURTIVIDADE',
    accent: '#ef4444',
    icon: 'bolt',
    specialty: 'Travessia Vertical com Gancho Magnético, Infiltração Furtiva & Katanas',
    passive: 'Agilidade acrobática aumentada e camuflagem óptica para atravessar lasers.',
    controls: [
      { key: 'MOUSE 2 / F', title: 'GANCHO MAGNÉTICO AÉREO', desc: 'Dispara cabo laser nos prédios e puxa o herói voando pelo ar.' },
      { key: 'ESPAÇO (AR)', title: 'IMPULSO ACROBÁTICO', desc: 'Solta o cabo do gancho no ar com salto mortal elevado.' },
      { key: 'MOUSE 1 / V', title: 'CORTE DUPLO DE KATANAS', desc: 'Golpeia com as duas lâminas lançando onda de energia escarlate.' },
      { key: 'Q', title: 'BOMBA DE FUMAÇA FURTIVA', desc: 'Cria cortina de fumaça e fica invisível por 6.5 segundos.' },
      { key: 'G', title: 'PUXÃO MAGNÉTICO', desc: 'Atrai todos os Studs em 28m e atinge o alvo na mira.' },
      { key: 'SHIFT', title: 'PASSO FANTASMA SHINOBI', desc: 'Corrida ninja silenciosa de alta velocidade.' }
    ]
  }
];

export function getHeroInfo(heroKey) {
  return HERO_CATALOG.find((h) => h.key === heroKey) || HERO_CATALOG[0];
}

/**
 * Desenha o retrato 2D LEGO de qualquer herói em um contexto 2D de Canvas
 */
export function drawHeroLegoPortrait(ctx, w, h, presetKey) {
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#0d1017';
  ctx.fillRect(0, 0, w, h);

  const bgStroke =
    presetKey === 'solaris' ? 'rgba(245, 158, 11, 0.25)' :
    presetKey === 'tita' ? 'rgba(0, 240, 255, 0.25)' :
    presetKey === 'sombra' ? 'rgba(239, 68, 68, 0.25)' :
    presetKey === 'vingador' ? 'rgba(203, 213, 225, 0.22)' :
    'rgba(250, 204, 21, 0.18)';
  ctx.strokeStyle = bgStroke;
  ctx.lineWidth = Math.max(3, w * 0.075);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  ctx.lineTo(w * 0.75, 0);
  ctx.moveTo(w * 0.25, h);
  ctx.lineTo(w, h * 0.25);
  ctx.stroke();

  const scale = w / 76;
  ctx.save();
  ctx.scale(scale, scale);

  // Pino superior LEGO (Stud)
  ctx.fillStyle = presetKey === 'tita' ? '#1e3a8a' : presetKey === 'sombra' ? '#090a0d' : '#eab308';
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(76 * 0.37, 9, 76 * 0.26, 9, 2);
  ctx.fill();
  ctx.stroke();

  // Cabeça cilíndrica LEGO
  ctx.fillStyle = presetKey === 'tita' ? '#0f172a' : presetKey === 'sombra' ? '#18181b' : '#facc15';
  ctx.beginPath();
  ctx.roundRect(76 * 0.22, 17, 76 * 0.56, 38, 6);
  ctx.fill();
  ctx.stroke();

  // Ombros / Torso superior
  ctx.fillStyle =
    presetKey === 'solaris' ? '#dc2626' :
    presetKey === 'tita' ? '#1e3a8a' :
    presetKey === 'sombra' ? '#991b1b' : '#171717';
  ctx.beginPath();
  ctx.roundRect(76 * 0.14, 54, 76 * 0.72, 24, 4);
  ctx.fill();
  ctx.stroke();

  if (presetKey === 'caveira') {
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.ellipse(76 * 0.48, 17, 22, 7, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#090a0d';
    ctx.fillRect(76 * 0.26, 27, 15, 9);
    ctx.fillRect(76 * 0.53, 27, 15, 9);
    ctx.fillRect(76 * 0.41, 29, 12, 3);

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(76 * 0.5, 43, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (presetKey === 'solaris') {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(76 * 0.21, 16, 76 * 0.58, 7);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(76 * 0.38, 33, 4, 0, Math.PI * 2);
    ctx.arc(76 * 0.62, 33, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(76 * 0.5, 42, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (presetKey === 'tita') {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(76 * 0.42, 11, 76 * 0.16, 9);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(76 * 0.27, 26, 76 * 0.46, 10);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(76 * 0.32, 41, 76 * 0.36, 7);
  } else if (presetKey === 'vingador') {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(76 * 0.21, 16, 76 * 0.58, 6);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(76 * 0.27, 26, 12, 8);
    ctx.fillRect(76 * 0.55, 26, 12, 8);
    ctx.fillStyle = '#111827';
    ctx.fillRect(76 * 0.22, 37, 76 * 0.56, 17);
    ctx.fillStyle = '#e2e8f0';
    for (let gx = 76 * 0.3; gx <= 76 * 0.66; gx += 7) {
      ctx.fillRect(gx, 40, 4, 11);
    }
  } else if (presetKey === 'sombra') {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(76 * 0.21, 16, 76 * 0.58, 7);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(76 * 0.28, 28, 12, 6);
    ctx.fillRect(76 * 0.54, 28, 12, 6);
  }

  ctx.restore();
}

/**
 * Renderiza a Ficha Tática Individual [H] do personagem atual
 */
export function renderHeroDossierModal(hud, heroKey) {
  const modalEl = document.getElementById('hero-dossier-modal');
  if (!modalEl) return;

  const info = getHeroInfo(heroKey);

  const codeEl = document.getElementById('dossier-op-code');
  const nameEl = document.getElementById('dossier-hero-name');
  const roleEl = document.getElementById('dossier-hero-role');
  const specEl = document.getElementById('dossier-hero-specialty');
  const passiveEl = document.getElementById('dossier-hero-passive');
  const controlsGridEl = document.getElementById('dossier-controls-grid');
  const tabsEl = document.getElementById('dossier-hero-tabs');
  const portraitCanvas = document.getElementById('dossier-portrait-canvas');

  if (codeEl) {
    codeEl.textContent = `${info.opCode} // FICHA TÁTICA DO OPERADOR`;
    codeEl.style.color = info.accent;
  }
  if (nameEl) {
    nameEl.textContent = info.name;
    nameEl.style.color = info.accent;
  }
  if (roleEl) {
    roleEl.textContent = info.role;
  }
  if (specEl) {
    specEl.textContent = info.specialty;
  }
  if (passiveEl) {
    passiveEl.textContent = info.passive;
  }
  if (portraitCanvas) {
    const ctx = portraitCanvas.getContext('2d');
    drawHeroLegoPortrait(ctx, portraitCanvas.width, portraitCanvas.height, info.key);
  }

  if (tabsEl) {
    tabsEl.innerHTML = HERO_CATALOG.map((h) => {
      const isActive = h.key === info.key;
      return `
        <button class="dossier-tab-btn ${isActive ? 'active' : ''}" data-hero="${h.key}" style="${isActive ? `border-color:${h.accent}; color:${h.accent};` : ''}">
          <span class="dossier-tab-op">${h.opCode}</span>
          <span>${h.shortName}</span>
        </button>
      `;
    }).join('');

    tabsEl.querySelectorAll('.dossier-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetKey = btn.dataset.hero;
        if (hud._lastController && targetKey) {
          hud._lastController.switchToHero(targetKey);
        }
        renderHeroDossierModal(hud, targetKey);
        soundFX.playHeroSwap();
      });
    });
  }

  if (controlsGridEl) {
    controlsGridEl.innerHTML = info.controls
      .map(
        (c) => `
        <div class="dossier-control-card" style="border-left-color: ${info.accent}">
          <div class="dossier-ctrl-top">
            <kbd class="dossier-kbd" style="background: ${info.accent}">${c.key}</kbd>
            <span class="dossier-ctrl-title">${c.title}</span>
          </div>
          <div class="dossier-ctrl-desc">${c.desc}</div>
        </div>
      `
      )
      .join('');
  }
}

/**
 * Renderiza a Roda Radial Estilo GTA V [TAB] com 5 Setores Chanfrados + Centro de Telemetria
 */
export function renderHeroWheelCanvas(canvas, selectedHeroKey, activeHeroKey) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.clearRect(0, 0, w, h);

  const count = HERO_CATALOG.length;
  const stepAngle = (Math.PI * 2) / count;
  const startOffset = -Math.PI / 2; // Setor 0 (Caveira) exatamente no Topo (W)!
  const gap = 0.045;

  const outerR = 212;
  const innerR = 92;

  // Anel técnico externo pontilhado
  ctx.save();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 12, 0, Math.PI * 2);
  ctx.stroke();
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

    // Fatia da Roda
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, segOuterR, a0, a1, false);
    ctx.arc(cx, cy, segInnerR, a1, a0, true);
    ctx.closePath();

    ctx.fillStyle = isSelected
      ? 'rgba(18, 23, 34, 0.96)'
      : 'rgba(9, 10, 13, 0.86)';
    ctx.fill();

    ctx.lineWidth = isSelected ? 3.5 : 2.0;
    ctx.strokeStyle = isSelected
      ? hero.accent
      : isCurrent
        ? 'rgba(250, 204, 21, 0.55)'
        : 'rgba(148, 163, 184, 0.28)';
    ctx.stroke();

    // Faixa externa luminosa na fatia selecionada
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(cx, cy, segOuterR - 3, a0 + 0.02, a1 - 0.02, false);
      ctx.lineWidth = 5;
      ctx.strokeStyle = hero.accent;
      ctx.stroke();
    }

    // Posição do ícone/retrato dentro da fatia
    const midR = (segOuterR + segInnerR) * 0.5;
    const ix = cx + Math.cos(midA) * midR;
    const iy = cy + Math.sin(midA) * midR;

    // Mini moldura chanfrada da cabeça LEGO dentro da fatia
    const boxSize = isSelected ? 46 : 40;
    ctx.save();
    ctx.translate(ix - boxSize * 0.5, iy - boxSize * 0.68);
    drawHeroLegoPortrait(ctx, boxSize, boxSize, hero.key);
    ctx.strokeStyle = isSelected ? hero.accent : '#262b38';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, boxSize, boxSize);
    ctx.restore();

    // Código OP + Nome Curto da fatia
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isSelected ? hero.accent : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(hero.opCode, ix, iy + boxSize * 0.32 + 5);

    ctx.font = isSelected
      ? '700 15px "Chakra Petch", sans-serif'
      : '700 13px "Chakra Petch", sans-serif';
    ctx.fillStyle = isSelected ? '#f8fafc' : '#cbd5e1';
    ctx.fillText(hero.shortName, ix, iy + boxSize * 0.32 + 20);

    ctx.restore();
  }

  // Hub Central Octogonal/Circular com dados do Herói Selecionado
  const selHero = getHeroInfo(selectedHeroKey);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 10, 0, Math.PI * 2);
  ctx.fillStyle = '#090a0d';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = selHero.accent;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.fillStyle = selHero.accent;
  ctx.fillText(selHero.opCode, cx, cy - 28);

  ctx.font = '700 22px "Teko", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(selHero.shortName, cx, cy - 4);

  ctx.font = '700 9.5px "Chakra Petch", sans-serif';
  ctx.fillStyle = '#94a3b8';
  const shortRole = selHero.role.split('//')[0].trim();
  ctx.fillText(shortRole, cx, cy + 14);

  ctx.font = '800 9px "JetBrains Mono", monospace';
  ctx.fillStyle = '#facc15';
  ctx.fillText('[WASD] GIRAR • [TAB] CONFIRMAR', cx, cy + 34);
  ctx.restore();
}

