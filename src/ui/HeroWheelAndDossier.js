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
    name: 'SOLARIS (REI DO SOL)',
    role: 'SOBERANO TERMONUCLEAR // VOO DE COMETA HIPERSÔNICO',
    accent: '#f97316',
    icon: 'star',
    specialty: 'Domínio Aéreo Hipersônico, Feixe Solar Imperial & Supernova Carregável (52m)',
    passive: 'Coroa e Manto Real de Fogo Vivo 3D. Voo livre (Espaço no ar / F) e Modo Cometa (Shift).',
    controls: [
      { key: 'ESPAÇO / F', title: 'VOO SOLAR & SUBIDA CONTÍNUA', desc: 'Ativa voo no ar (ou 2x Espaço). Segure ESPAÇO para subir.' },
      { key: 'CTRL / C', title: 'MERGULHO & POUSO AÉREO', desc: 'Desce rápido no ar; pouse no chão segurando CTRL para sair do voo.' },
      { key: 'SHIFT (AR)', title: 'COMETA HIPERSÔNICO (85M/S)', desc: 'Jato solar extremo pelo mapa (ESPAÇO sobe / CTRL mergulha).' },
      { key: 'MOUSE 1', title: 'ESFERAS DE PLASMA SOLAR', desc: 'Dispara projéteis ígneos explosivos em sequência.' },
      { key: 'MOUSE 2', title: 'FEIXE SOLAR IMPERIAL', desc: 'Raio termonuclear com vórtice de magma que derrete OURO LEGO.' },
      { key: 'Q (SEGURAR)', title: 'SUPERNOVA CARREGÁVEL (ATÉ 52M)', desc: 'Toque rápido (12m) ou segure [Q] para carregar erupção colossal!' }
    ]
  },
  {
    key: 'tita',
    opCode: 'OP-03',
    shortName: 'TITÃ BLINDADO',
    name: 'TITÃ BLINDADO (PMESP)',
    role: 'PM ROBÔ MUTANTE GIGANTE // CHOQUE PESADO PMESP',
    accent: '#ef4444',
    icon: 'shield',
    specialty: 'Minigun Vulcan 6 Canos, Dash Sem Cooldown, Super-Pulo Carregável & Pisada Sísmica',
    passive: 'Colosso Ciborgue da PMESP (Vermelho, Cinza-Bandeirante e Branco) que destrói Paredes Rachadas.',
    controls: [
      { key: 'MOUSE 1', title: 'MINIGUN VULCAN 6 CANOS', desc: 'Rajada insana (28 tiros/s) de canos rotativos que tritura carros.' },
      { key: 'MOUSE 2 / V', title: 'DASH DEMOLIDOR (SEM COOLDOWN)', desc: 'Investida a jato contínua que atropela carros e Paredes Rachadas.' },
      { key: 'ESPAÇO (SEGURAR)', title: 'SUPER-PULO CARREGÁVEL', desc: 'Toque rápido (pulo normal) ou segure até 100% para saltar prédios!' },
      { key: 'Q', title: 'PISADA SÍSMICA NO ASFALTO', desc: 'Esmaga o chão levantando placas de rocha e jogando carros pro alto!' },
      { key: 'G / F', title: 'AGARRAR & ARREMESSAR CARRO', desc: 'Levanta veículos acima da cabeça e os arremessa como bombas.' },
      { key: 'SHIFT', title: 'MARCHA HIDRÁULICA PESADA', desc: 'Avanço blindado de alta tração do chassi Robô-Mutante.' }
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
    role: 'CYBER-SHINOBI MÍSTICO // ASSASSINO DA LUA DE SANGUE',
    accent: '#ef4444',
    icon: 'bolt',
    specialty: 'Gancho Magnético 360° (Ar e Chão), Katanas da Lua de Sangue & Rolamento Invisível',
    passive: 'O personagem mais veloz a pé (32m/s na corrida e 38m/s invisível) com postura acrobática Shinobi.',
    controls: [
      { key: 'MOUSE 2 / F', title: 'GANCHO MAGNÉTICO 360° (ZIP & DIVE)', desc: 'Lança Kunai para qualquer direção (inclusive mergulho relâmpago para o chão!) com impulso fluido.' },
      { key: 'ESPAÇO (AR)', title: 'ESTILINGUE ACROBÁTICO', desc: 'Solta o gancho transferindo toda a velocidade para um voo livre em arco pelos prédios.' },
      { key: 'MOUSE 1 / V', title: 'COMBO LUA DE SANGUE (3 CORTES)', desc: 'Dispara ondas crescentes espirituais gigantes (Diagonal Direita, Esquerda e Corte Cruzado em X).' },
      { key: 'Q', title: 'ROLAMENTO SOMBRIO + INVISIBILIDADE', desc: 'Dá um dash acrobático estourando cortina de fumaça negra/escarlate e fica invisível por 7s.' },
      { key: 'G', title: 'PUXÃO MAGNÉTICO ESPIRITUAL', desc: 'Atrai todos os Studs em 28m e atinge o alvo na mira.' },
      { key: 'SHIFT', title: 'CORRIDA SHINOBI (PASSO FANTASMA)', desc: 'Corrida inclinada para frente em velocidade extrema com as duas Katanas voltadas para trás.' }
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
    presetKey === 'tita' ? 'rgba(239, 68, 68, 0.28)' :
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
  ctx.fillStyle = presetKey === 'tita' ? '#dc2626' : presetKey === 'sombra' ? '#090a0d' : '#eab308';
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(76 * 0.37, 9, 76 * 0.26, 9, 2);
  ctx.fill();
  ctx.stroke();

  // Cabeça cilíndrica LEGO
  ctx.fillStyle = presetKey === 'tita' ? '#334155' : presetKey === 'sombra' ? '#18181b' : '#facc15';
  ctx.beginPath();
  ctx.roundRect(76 * 0.22, 17, 76 * 0.56, 38, 6);
  ctx.fill();
  ctx.stroke();

  // Ombros / Torso superior
  ctx.fillStyle =
    presetKey === 'solaris' ? '#7f1d1d' :
    presetKey === 'tita' ? '#f8fafc' :
    presetKey === 'sombra' ? '#991b1b' : '#171717';
  ctx.beginPath();
  ctx.roundRect(76 * 0.14, 54, 76 * 0.72, 24, 4);
  ctx.fill();
  ctx.stroke();

  if (presetKey === 'caveira') {
    // Boina Preta Oficial do BOPE inclinada + Insígnia Faca na Caveira Dourada
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.ellipse(76 * 0.46, 16, 24, 7.5, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(76 * 0.58, 15.5, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Abafadores Laterais 2D (Headset ComTac BOPE)
    ctx.fillStyle = '#111827';
    ctx.fillRect(76 * 0.16, 26, 5, 16);
    ctx.fillRect(76 * 0.78, 26, 5, 16);

    // Cicatriz de combate no olho esquerdo + Pintura de Guerra nas bochechas
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(76 * 0.34, 21);
    ctx.lineTo(76 * 0.36, 44);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(76 * 0.25, 36, 9, 3);
    ctx.fillRect(76 * 0.63, 36, 9, 3);

    // Óculos Táticos Balísticos Angulares com reflexo Fogo/Ouro
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(76 * 0.24, 26);
    ctx.lineTo(76 * 0.47, 28);
    ctx.lineTo(76 * 0.45, 35);
    ctx.lineTo(76 * 0.26, 34);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(76 * 0.76, 26);
    ctx.lineTo(76 * 0.53, 28);
    ctx.lineTo(76 * 0.55, 35);
    ctx.lineTo(76 * 0.74, 34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(76 * 0.28, 28, 8, 3);
    ctx.fillRect(76 * 0.58, 28, 8, 3);

    // Sobrancelhas grossas franzidas em V (Cara de Mau)
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(76 * 0.24, 23);
    ctx.lineTo(76 * 0.47, 27);
    ctx.moveTo(76 * 0.76, 23);
    ctx.lineTo(76 * 0.53, 27);
    ctx.stroke();

    // Barba Cerrada / Cavanhaque + Dentes Trincados (Sem sorriso feliz!)
    ctx.fillStyle = '#111827';
    ctx.fillRect(76 * 0.31, 39, 76 * 0.38, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(76 * 0.36, 42, 76 * 0.28, 4.5);
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(76 * 0.36, 42, 76 * 0.28, 4.5);

    // Emblema da Caveira do BOPE + Placa do Colete no peito
    ctx.fillStyle = '#facc15';
    ctx.fillRect(76 * 0.25, 56, 76 * 0.5, 2.5);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(76 * 0.5, 65, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetKey === 'solaris') {
    // Crina de Fogo Vivo 2D + Coroa Imperial de 5 Pontas do Rei do Sol
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(76 * 0.22, 18);
    ctx.lineTo(76 * 0.28, 5);
    ctx.lineTo(76 * 0.38, 13);
    ctx.lineTo(76 * 0.5, 2);
    ctx.lineTo(76 * 0.62, 13);
    ctx.lineTo(76 * 0.72, 5);
    ctx.lineTo(76 * 0.78, 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(76 * 0.2, 22);
    ctx.lineTo(76 * 0.24, 11);
    ctx.lineTo(76 * 0.35, 18);
    ctx.lineTo(76 * 0.5, 8);
    ctx.lineTo(76 * 0.65, 18);
    ctx.lineTo(76 * 0.76, 11);
    ctx.lineTo(76 * 0.8, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Olhos de Plasma Branco-Dourado Flamejantes + Sobrancelhas Franzidas
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(76 * 0.25, 29, 14, 7);
    ctx.fillRect(76 * 0.56, 29, 14, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(76 * 0.28, 30.5, 9, 4);
    ctx.fillRect(76 * 0.59, 30.5, 9, 4);

    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(76 * 0.25, 26);
    ctx.lineTo(76 * 0.46, 29);
    ctx.moveTo(76 * 0.75, 26);
    ctx.lineTo(76 * 0.54, 29);
    ctx.stroke();

    // Expressão fechada e soberana de Rei do Sol + Reator Solar no peito
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(76 * 0.36, 44);
    ctx.lineTo(76 * 0.5, 41);
    ctx.lineTo(76 * 0.64, 44);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(76 * 0.22, 55, 76 * 0.56, 3);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(76 * 0.5, 65, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetKey === 'tita') {
    // Domo Branco/Cinza PMESP + Giroflex Vermelho + Visor Vermelho-Laser em V + Queixeira Industrial
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(76 * 0.22, 16, 76 * 0.56, 9);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(76 * 0.22, 23, 76 * 0.56, 3.5);
    ctx.fillRect(76 * 0.26, 10, 8, 5);
    ctx.fillRect(76 * 0.62, 10, 8, 5);

    // Visor Tático Vermelho-Laser em V
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(76 * 0.25, 28);
    ctx.lineTo(76 * 0.5, 31);
    ctx.lineTo(76 * 0.75, 28);
    ctx.lineTo(76 * 0.72, 36);
    ctx.lineTo(76 * 0.5, 39);
    ctx.lineTo(76 * 0.28, 36);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(76 * 0.3, 30, 10, 3);
    ctx.fillRect(76 * 0.56, 30, 10, 3);

    // Respirador / Mandíbula de Aço com grelha vermelha
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(76 * 0.29, 41, 76 * 0.42, 11);
    ctx.fillStyle = '#dc2626';
    for (let gx = 76 * 0.33; gx <= 76 * 0.65; gx += 6.5) {
      ctx.fillRect(gx, 43, 3.5, 7);
    }

    // Faixas Vermelhas da PMESP e Reator Rubro no Peitoral Branco
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(76 * 0.16, 56, 14, 5);
    ctx.fillRect(76 * 0.66, 56, 14, 5);
    ctx.beginPath();
    ctx.arc(76 * 0.5, 65, 5.5, 0, Math.PI * 2);
    ctx.fill();
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
    // Capuz Shinobi com Chifres Oni Escarlates + Bandana com Placa Metálica + Olhos Carmesins + Máscara Oni
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(76 * 0.2, 13, 76 * 0.6, 8);

    // Chifres curtos Oni em vermelho-escarlate na testa
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(76 * 0.31, 16);
    ctx.lineTo(76 * 0.27, 7);
    ctx.lineTo(76 * 0.37, 15);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(76 * 0.69, 16);
    ctx.lineTo(76 * 0.73, 7);
    ctx.lineTo(76 * 0.63, 15);
    ctx.closePath();
    ctx.fill();

    // Bandana escarlate (Hachigane) + Placa metálica escura com símbolo vermelho
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(76 * 0.21, 17, 76 * 0.58, 7.5);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(76 * 0.37, 17.5, 76 * 0.26, 6.5);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(76 * 0.37, 17.5, 76 * 0.26, 6.5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(76 * 0.44, 19.8, 76 * 0.12, 2);

    // Olhos Cyber-Shinobi Vermelho-Carmesim Brilhantes inclinados em V
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(76 * 0.26, 27);
    ctx.lineTo(76 * 0.46, 30);
    ctx.lineTo(76 * 0.44, 35);
    ctx.lineTo(76 * 0.28, 33);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(76 * 0.74, 27);
    ctx.lineTo(76 * 0.54, 30);
    ctx.lineTo(76 * 0.56, 35);
    ctx.lineTo(76 * 0.72, 33);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(76 * 0.32, 29.5, 6, 2.5);
    ctx.fillRect(76 * 0.58, 29.5, 6, 2.5);

    // Meia-Máscara Oni / Menpo Preta com borda vermelha e presas prateadas
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(76 * 0.23, 37, 76 * 0.54, 17);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(76 * 0.25, 38, 76 * 0.5, 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(76 * 0.33, 40, 3.5, 8);
    ctx.fillRect(76 * 0.61, 40, 3.5, 8);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(76 * 0.43, 41, 2.5, 8);
    ctx.fillRect(76 * 0.52, 41, 2.5, 8);

    // Cachecol Ninja Escarlate no pescoço + Amuleto Espiritual no peito
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(76 * 0.18, 53, 76 * 0.64, 5.5);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(76 * 0.5, 65, 4.5, 0, Math.PI * 2);
    ctx.fill();
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

