import { soundFX } from '../../audio/SoundFX.js';
import {
  HERO_CATALOG,
  getHeroInfo,
  drawHeroLegoPortrait
} from './HeroWheelCanvasRenderer.js';

/**
 * Fichas Táticas de Poderes, Especialidades, Passivas e Mapeamento de Teclas do Dossiê [H]
 */
export const HERO_POWER_SHEETS = {
  caveira: {
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
  solaris: {
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
  tita: {
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
  vingador: {
    specialty: 'Castigadoras .50 Explosivas, Doze de 18 Bagos (Force-Jump), Bazuca (Rocket Jump) & Furor',
    passive: 'Carrega todo o arsenal visível nas costas e usa o recuo da Doze e a explosão da Bazuca para voar pelos prédios.',
    controls: [
      { key: 'R / MOUSE 2', title: 'ALTERNAR ARSENAL (3 ARMAS)', desc: 'Troca entre Castigadoras .50, Escopeta Juiz Final e Bazuca Aniquiladora.' },
      { key: 'MOUSE 1 (1)', title: 'CASTIGADORAS GÊMEAS (.50)', desc: 'Duas Desert Eagles/SMGs .50 cromadas com tiros micro-explosivos e recuo alternado.' },
      { key: 'MOUSE 1 (2)', title: 'DOZE "JUIZ FINAL" (18 BAGOS)', desc: 'Tempestade de 18 bagos incendiários + Recoil Force-Jump quando dispara no ar/para baixo!' },
      { key: 'MOUSE 1 (3)', title: 'BAZUCA + ROCKET JUMP (4X)', desc: 'Destrói LEGO Prateado e catapulta o Vingador pelos ares ao atirar nos pés/paredes!' },
      { key: 'Q', title: 'INVESTIDA + FUROR DO JUSTICEIRO', desc: 'Super-Dash propulsado a 50m/s na direção da mira + 4s de Velocidade 32m/s e +60% Cadência!' },
      { key: 'SHIFT', title: 'CORRIDA TÁTICA IMPLACÁVEL', desc: 'Avanço rápido a 26m/s (32m/s em Furor) com sobretudo de couro preto esvoaçante.' }
    ]
  },
  sombra: {
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
  },
  turbo: {
    specialty: 'Invocação Instantânea de Moto Energética Ciano, Muralha de Luz & Correntes de Plasma',
    passive: 'Deixa Muralha de Luz Ciano sólida atrás da moto ou na Arrancada [Q] que capota e explode veículos!',
    controls: [
      { key: 'MOUSE 2 / G', title: 'INVOCAR MOTO FANTASMA CIANO', desc: 'Materializa e monta instantaneamente na Moto Energética em movimento!' },
      { key: 'MOUSE 1 / V', title: 'AÇOITE DE CORRENTES DE PLASMA', desc: 'Chicoteia correntes giratórias incandescentes que destroem tudo em arco.' },
      { key: 'Q', title: 'ARRANCADA + MURALHA DE LUZ', desc: 'Dispara a 44m/s (ou Nitro na Moto) deixando rastro sólido de luz que explode carros!' },
      { key: 'E', title: 'DESMONTAR / MONTAR VEÍCULO', desc: 'Sai ou entra em qualquer veículo da cidade.' },
      { key: 'ESPAÇO', title: 'SALTO ACROBÁTICO DE PILOTO', desc: 'Salto ágil com impulso de chamas ciano.' },
      { key: 'SHIFT', title: 'CORRIDA DE ALTA OCTANAGEM', desc: 'Deslocamento veloz a 28m/s (ou Drift na Moto).' }
    ]
  },
  voltaico: {
    specialty: 'Corrente de Raios (Chain Lightning), Teleporte em Postes/Antenas & Super Pulso EMP',
    passive: 'Sobrecarga automática de Geradores Elétricos e levitação eletromagnética no ar.',
    controls: [
      { key: 'MOUSE 1', title: 'CORRENTE DE RAIOS (CHAIN)', desc: 'Dispara raio elétrico que salta automaticamente entre até 6 alvos e carrega geradores!' },
      { key: 'MOUSE 2 / F', title: 'TELEPORTE DE RELÂMPAGO', desc: 'Teleporta instantaneamente na velocidade da luz para o poste, prédio ou ponto mirado!' },
      { key: 'Q', title: 'SUPER PULSO EMP & TROVÕES', desc: 'Domo eletromagnético de 28m + chuva de raios do céu que explode veículos ao redor!' },
      { key: 'ESPAÇO (AR)', title: 'PLANAGEM ELETROMAGNÉTICA', desc: 'Segure ESPAÇO no ar para planar envolto em arcos voltaicos.' },
      { key: 'V / G', title: 'DESCARGA DE BOBINA TESLA', desc: 'Choque elétrico concentrado de curta distância.' },
      { key: 'SHIFT', title: 'CORRIDA RELÂMPAGO', desc: 'Avanço elétrico de alta velocidade (27m/s) soltando faíscas.' }
    ]
  },
  vortex: {
    specialty: 'Metamorfose Real-Time (Ágil <-> Big-Fig Monstruoso), Tentáculos & Laço Abissal',
    passive: 'Alterna com [F] entre forma Ágil veloz e Colosso Big-Fig Monstruoso que racha o chão e quebra Paredes Rachadas.',
    controls: [
      { key: 'F / R', title: 'METAMORFOSE BIG-FIG EM TEMPO REAL', desc: 'Alterna instantaneamente entre Forma Simbionte Ágil e Colosso Big-Fig Monstruoso!' },
      { key: 'MOUSE 1 / V', title: 'DEVASTAÇÃO DE TENTÁCULOS', desc: 'Chicoteia os 4 tentáculos simbiontes em área estraçalhando carros e Paredes Rachadas.' },
      { key: 'MOUSE 2 / G', title: 'LAÇO ABISSAL (DERRUBA HELICÓPTEROS)', desc: 'Lança tentáculo gigante que puxa helicópteros/carros pro chão ou lança o Vórtex até o alvo!' },
      { key: 'Q', title: 'ERUPÇÃO ABISSAL DE ESPINHOS (24M)', desc: 'Faz brotar dezenas de tentáculos e espinhos negros/roxos do chão em 360°!' },
      { key: 'ESPAÇO', title: 'SALTO PREDATÓRIO SIMBIONTE', desc: 'Super-salto elástico que treme e racha o asfalto ao pousar na forma Monstruosa.' },
      { key: 'SHIFT', title: 'INVESTIDA SIMBIONTE', desc: 'Corrida predatória feroz com tentáculos ondulando nas costas.' }
    ]
  }
};

/**
 * Hidrata in-place as fichas de poderes em `HERO_CATALOG` preservando as referências originais.
 */
export function hydrateHeroCatalogPowerSheets(catalog = HERO_CATALOG) {
  for (const entry of catalog) {
    if (!entry || entry.key === 'op09') continue;
    const sheet = HERO_POWER_SHEETS[entry.key];
    if (sheet) {
      entry.specialty = sheet.specialty;
      entry.passive = sheet.passive;
      entry.controls = sheet.controls;
    }
  }
  return catalog;
}

hydrateHeroCatalogPowerSheets(HERO_CATALOG);

/**
 * Renderiza a Ficha Tática Individual [H] do personagem atual e gerencia seleção/troca de operador
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
