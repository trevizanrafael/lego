import * as THREE from 'three';
import { configureCrispCanvasTexture, markAsSharedAsset } from './PaletteAndPbrCache.js';

/**
 * Gerador procedural Canvas 2D de estampas frontais de torsos, uniformes táticos, armaduras e trajes.
 * Submódulo extraído de `LegoMaterials.js` sem alteração visual ou lógica.
 */
const HERO_TORSO_TEX_CACHE = new Map();

export function createMinifigTorsoTexture(preset = 'caveira') {
  const cacheKey = typeof preset === 'string' ? preset : null;
  if (cacheKey && HERO_TORSO_TEX_CACHE.has(cacheKey)) {
    return HERO_TORSO_TEX_CACHE.get(cacheKey);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (preset === 'caveira') {
    // Farda Preta Tática BOPE com Colete e Símbolo da Caveira
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, 256, 256);

    // Placa do colete balístico
    ctx.fillStyle = '#262626';
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(28, 20, 200, 185, 16);
    ctx.fill();
    ctx.stroke();

    // Cinto tático com fivela dourada
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(10, 210, 236, 36);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(108, 214, 40, 28);
    ctx.fillStyle = '#171717';
    ctx.fillRect(116, 220, 24, 16);

    // Emblema da Caveira com Facas Cruzadas no centro do peito
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(85, 145);
    ctx.lineTo(171, 65);
    ctx.moveTo(171, 145);
    ctx.lineTo(85, 65);
    ctx.stroke();

    // Crânio branco estilizado LEGO
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(128, 96, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(112, 114, 32, 20);

    // Olhos da caveira
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.arc(117, 96, 7, 0, Math.PI * 2);
    ctx.arc(139, 96, 7, 0, Math.PI * 2);
    ctx.fill();

    // Bolsos táticos laterais
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(42, 150, 42, 42);
    ctx.fillRect(172, 150, 42, 42);
  } else if (preset === 'solaris') {
    // Armadura Carmesim Imperial & Ouro Real do Solaris (Rei do Sol)
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, 256, 256);

    // Linhas de energia douradas reais
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(26, 18);
    ctx.lineTo(95, 115);
    ctx.lineTo(58, 224);
    ctx.moveTo(230, 18);
    ctx.lineTo(161, 115);
    ctx.lineTo(198, 224);
    ctx.stroke();

    // Núcleo Solar no peito
    const grad = ctx.createRadialGradient(128, 105, 6, 128, 105, 45);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#fef08a');
    grad.addColorStop(1, '#f97316');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 105, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Cinto dourado
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(10, 212, 236, 32);
  } else if (preset === 'tita') {
    // Peitoral Blindado PMESP (Polícia Militar de SP — Cinza-Bandeirante, Branco e Vermelho)
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 256);

    // Placa peitoral superior Branca Policial + Faixas Diagonais Vermelhas PMESP
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(16, 14, 224, 184, 14);
    ctx.fill();
    ctx.stroke();

    // Chevrons / Faixas Vermelhas Institucionais da PMESP
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(20, 24);
    ctx.lineTo(108, 72);
    ctx.lineTo(108, 102);
    ctx.lineTo(20, 54);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(236, 24);
    ctx.lineTo(148, 72);
    ctx.lineTo(148, 102);
    ctx.lineTo(236, 54);
    ctx.closePath();
    ctx.fill();

    // Reator de Bio-Energia Mutante Vermelho-Rubro no centro do peito
    const coreGrad = ctx.createRadialGradient(128, 104, 6, 128, 104, 46);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.45, '#fca5a5');
    coreGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(128, 104, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Pistões abdominais cinza-chumbo e cinto tático preto/vermelho
    ctx.fillStyle = '#475569';
    ctx.fillRect(36, 152, 46, 40);
    ctx.fillRect(174, 152, 46, 40);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(10, 204, 236, 42);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(96, 212, 64, 26);
  } else if (preset === 'vingador') {
    // Colete Tático Kevlar Preto Fosco (#0c0e13) com a Icônica Caveira Branca Gigante do Justiceiro (The Punisher)
    ctx.fillStyle = '#0c0e13';
    ctx.fillRect(0, 0, 256, 256);

    // Textura de trama de Kevlar balístico e placas peitorais
    ctx.fillStyle = '#141821';
    ctx.strokeStyle = '#262b38';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(16, 12, 224, 192, 10);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    for (let ky = 20; ky < 200; ky += 12) {
      ctx.beginPath();
      ctx.moveTo(20, ky);
      ctx.lineTo(236, ky);
      ctx.stroke();
    }

    // ICÔNICA CAVEIRA BRANCA GIGANTE DO JUSTICEIRO (Ocupando todo o peito até o abdômen)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    // Topo e têmporas largas do crânio
    ctx.moveTo(128, 22);
    ctx.bezierCurveTo(188, 22, 206, 62, 196, 104);
    // Maçãs do rosto salientes e angulares
    ctx.lineTo(176, 124);
    ctx.lineTo(164, 134);
    // Maxilar descendo em dentes longos até o abdômen
    ctx.lineTo(162, 198);
    ctx.lineTo(94, 198);
    ctx.lineTo(92, 134);
    ctx.lineTo(80, 124);
    ctx.lineTo(60, 104);
    ctx.bezierCurveTo(50, 62, 68, 22, 128, 22);
    ctx.closePath();
    ctx.fill();

    // Órbitas Oculares Furiosas e Angulares da Caveira do Justiceiro
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(72, 72);
    ctx.lineTo(118, 86);
    ctx.lineTo(112, 112);
    ctx.lineTo(68, 98);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(184, 72);
    ctx.lineTo(138, 86);
    ctx.lineTo(144, 112);
    ctx.lineTo(188, 98);
    ctx.closePath();
    ctx.fill();

    // Cavidade nasal triangular invertida
    ctx.beginPath();
    ctx.moveTo(128, 98);
    ctx.lineTo(115, 126);
    ctx.lineTo(141, 126);
    ctx.closePath();
    ctx.fill();

    // Dentes Compridos Icônicos do Justiceiro (4 fendas profundas verticais)
    ctx.fillStyle = '#090a0d';
    for (const gx of [106, 120, 134, 148]) {
      ctx.fillRect(gx - 2, 136, 5, 64);
    }

    // Rachaduras de batalha no crânio pintado
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(96, 32);
    ctx.lineTo(106, 56);
    ctx.lineTo(98, 74);
    ctx.moveTo(166, 44);
    ctx.lineTo(154, 68);
    ctx.stroke();

    // Cinto Tático Branco/Prata Clássico do Justiceiro na cintura
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(8, 206, 240, 42);
    ctx.fillStyle = '#e2e8f0';
    for (const px of [18, 58, 166, 206]) {
      ctx.fillRect(px, 212, 32, 28);
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(104, 210, 48, 32);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(114, 218, 28, 16);
  } else if (preset === 'sombra') {
    // Traje Cyber-Shinobi do Sombra Escarlate (Preto Fosco + Armadura Escarlate Cruzada)
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 256, 256);

    // Placas peitorais angulares pretas/grafite
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(26, 20, 204, 182, 10);
    ctx.fill();
    ctx.stroke();

    // Faixas Shinobi Escarlates Cruzadas em V no peito
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.lineTo(128, 156);
    ctx.lineTo(224, 24);
    ctx.stroke();

    // Insígnia Cyber-Escarlate Brilhante no centro
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(128, 54);
    ctx.lineTo(156, 96);
    ctx.lineTo(128, 138);
    ctx.lineTo(100, 96);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.arc(128, 96, 10, 0, Math.PI * 2);
    ctx.fill();

    // Faixa abdominal vermelha e cinto com Shurikens prateadas
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(16, 198, 224, 44);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(52, 210, 24, 20);
    ctx.fillRect(116, 208, 24, 24);
    ctx.fillRect(180, 210, 24, 20);
  } else if (preset === 'turbo') {
    // Jaqueta de Couro Preta de Motoqueiro Fantasma com Correntes e Reator Ciano Neon
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 256, 256);

    // Lapelas de couro com rebites cromados e zíperes diagonais
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(22, 14);
    ctx.lineTo(112, 118);
    ctx.lineTo(38, 198);
    ctx.lineTo(16, 198);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(234, 14);
    ctx.lineTo(144, 118);
    ctx.lineTo(218, 198);
    ctx.lineTo(240, 198);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Emblema Central de Caveira / Turbina de Plasma Ciano Neon
    const turboGrad = ctx.createRadialGradient(128, 102, 6, 128, 102, 52);
    turboGrad.addColorStop(0, '#ffffff');
    turboGrad.addColorStop(0.45, '#22d3ee');
    turboGrad.addColorStop(1, '#0891b2');
    ctx.fillStyle = turboGrad;
    ctx.beginPath();
    ctx.arc(128, 102, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Cinto de elos de corrente cromados e fivela ciano
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 202, 232, 42);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(102, 208, 52, 30);
  } else if (preset === 'voltaico') {
    // Armadura Condutora de Tempestade (Azul-Cobalto + Bobina Tesla Central + Circuitos Dourados)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#1d4ed8';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(18, 14, 220, 184, 12);
    ctx.fill();
    ctx.stroke();

    // Linhas de Raio Douradas convergindo para a Bobina Tesla Central
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(28, 28);
    ctx.lineTo(92, 96);
    ctx.moveTo(228, 28);
    ctx.lineTo(164, 96);
    ctx.moveTo(36, 184);
    ctx.lineTo(92, 122);
    ctx.moveTo(220, 184);
    ctx.lineTo(164, 122);
    ctx.stroke();

    // Bobina Tesla / Núcleo de Trovão Ciano-Branco no Peito
    const teslaGrad = ctx.createRadialGradient(128, 106, 6, 128, 106, 48);
    teslaGrad.addColorStop(0, '#ffffff');
    teslaGrad.addColorStop(0.5, '#38bdf8');
    teslaGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = teslaGrad;
    ctx.beginPath();
    ctx.arc(128, 106, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Cinto Condutor Dourado e Azul
    ctx.fillStyle = '#facc15';
    ctx.fillRect(14, 206, 228, 38);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(100, 212, 56, 26);
  } else if (preset === 'vortex') {
    // Peitoral Simbionte Musculoso (Preto Líquido + Emblema Clássico da Aranha Simbionte Branca do Venom!)
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, 256, 256);

    // Sombreamento anatômico dos Peitorais e Abdômen Simbionte + Veias Roxo-Abissal Escuro
    ctx.strokeStyle = '#3b0764';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(18, 16, 102, 84, 14);
    ctx.roundRect(136, 16, 102, 84, 14);
    ctx.roundRect(42, 110, 78, 38, 8);
    ctx.roundRect(136, 110, 78, 38, 8);
    ctx.roundRect(48, 156, 72, 38, 8);
    ctx.roundRect(136, 156, 72, 38, 8);
    ctx.stroke();

    // EMBLEMA CLÁSSICO DA ARANHA/DRAGÃO SIMBIONTE DO VENOM EM BRANCO PURO (#ffffff)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';

    // Cabeça pontiaguda + Tórax esguio + Abdômen afiado como lâmina descendo até o umbigo
    ctx.beginPath();
    ctx.moveTo(128, 18);
    ctx.lineTo(142, 46);
    ctx.lineTo(135, 68);
    ctx.lineTo(152, 102);
    ctx.lineTo(128, 212);
    ctx.lineTo(104, 102);
    ctx.lineTo(121, 68);
    ctx.lineTo(114, 46);
    ctx.closePath();
    ctx.fill();

    // 8 Pernas Angulares Quebradas em Ziguezague da Aranha do Venom (4 de cada lado abraçando o peito e costelas!)
    ctx.lineWidth = 8.5;
    const spiderLegs = [
      // Perna 1 (Superior — sobe para as clavículas/ombros)
      [[120, 56], [76, 26], [22, 10]],
      // Perna 2 (Peitoral Superior — abre e quebra para cima/fora)
      [[114, 78], [64, 58], [12, 48]],
      // Perna 3 (Peitoral Inferior — abre e quebra agressivamente para baixo)
      [[112, 104], [58, 106], [14, 138]],
      // Perna 4 (Abdominal — desce rasgando pelas costelas)
      [[116, 132], [68, 154], [24, 204]]
    ];
    for (const legPts of spiderLegs) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        const [p0, p1, p2] = legPts;
        ctx.moveTo(128 + s * (p0[0] - 128), p0[1]);
        ctx.lineTo(128 + s * (p1[0] - 128), p1[1]);
        ctx.lineTo(128 + s * (p2[0] - 128), p2[1]);
        ctx.stroke();
      }
    }
  } else {
    // Jaqueta azul urbana clássica LEGO
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 256, 256);

    // Camiseta branca por baixo e zíper
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(92, 0);
    ctx.lineTo(164, 0);
    ctx.lineTo(148, 220);
    ctx.lineTo(108, 220);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(118, 40, 20, 160);
  }

  const tex = configureCrispCanvasTexture(new THREE.CanvasTexture(canvas), 8);
  if (cacheKey) {
    markAsSharedAsset(tex);
    HERO_TORSO_TEX_CACHE.set(cacheKey, tex);
  }
  return tex;
}
