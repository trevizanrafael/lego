/**
 * Pintores Canvas 2D de rostos dos heróis centrais (`caveira`, `solaris`, `tita`).
 * Auxiliar interno de `ProceduralFaceTextures.js`.
 */
export function paintCoreHeroFace(ctx, preset, cx, cy) {
  if (preset === 'caveira') {
    // 1. Pintura de Guerra Tática (Camuflagem Facial Preta/Grafite nas maçãs do rosto)
    ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - 88, cy + 2);
    ctx.lineTo(cx - 24, cy + 14);
    ctx.lineTo(cx - 30, cy + 28);
    ctx.lineTo(cx - 92, cy + 16);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 88, cy + 2);
    ctx.lineTo(cx + 24, cy + 14);
    ctx.lineTo(cx + 30, cy + 28);
    ctx.lineTo(cx + 92, cy + 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.72)';
    ctx.fillRect(cx - 84, cy + 31, 46, 8);
    ctx.fillRect(cx + 38, cy + 31, 46, 8);

    // 2. Cicatriz Vertical Profunda de Combate atravessando o olho/sobrancelha esquerda
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 46, cy - 62);
    ctx.lineTo(cx - 38, cy + 38);
    ctx.stroke();

    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2.5;
    for (let sy = cy - 52; sy <= cy + 28; sy += 16) {
      ctx.beginPath();
      ctx.moveTo(cx - 49, sy);
      ctx.lineTo(cx - 35, sy + 3);
      ctx.stroke();
    }

    // 3. Barba Cerrada / Cavanhaque Pesado de Veterano Casca-Grossa no Maxilar
    ctx.fillStyle = 'rgba(23, 23, 23, 0.62)';
    ctx.beginPath();
    ctx.moveTo(cx - 76, cy + 18);
    ctx.lineTo(cx - 56, cy + 74);
    ctx.lineTo(cx + 56, cy + 74);
    ctx.lineTo(cx + 76, cy + 18);
    ctx.lineTo(cx + 52, cy + 36);
    ctx.lineTo(cx - 52, cy + 36);
    ctx.closePath();
    ctx.fill();

    // Bigode/Cavanhaque denso ao redor da boca trincada
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(cx - 46, cy + 16, 92, 46, 8);
    ctx.fill();

    // 4. Óculos Táticos Balísticos Militares Angulares (Wrap-Around) com Reflexo Fogo/Ouro
    const lensGrad = ctx.createLinearGradient(cx - 70, cy - 32, cx + 70, cy + 8);
    lensGrad.addColorStop(0, '#090a0d');
    lensGrad.addColorStop(0.35, '#991b1b');
    lensGrad.addColorStop(0.55, '#f59e0b');
    lensGrad.addColorStop(0.75, '#1e293b');
    lensGrad.addColorStop(1, '#090a0d');

    ctx.fillStyle = '#090a0d';
    ctx.fillRect(cx - 105, cy - 22, 210, 10);

    // Lente Esquerda Angular
    ctx.fillStyle = lensGrad;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy - 28);
    ctx.lineTo(cx - 10, cy - 22);
    ctx.lineTo(cx - 14, cy + 4);
    ctx.lineTo(cx - 56, cy + 8);
    ctx.lineTo(cx - 76, cy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lente Direita Angular
    ctx.beginPath();
    ctx.moveTo(cx + 72, cy - 28);
    ctx.lineTo(cx + 10, cy - 22);
    ctx.lineTo(cx + 14, cy + 4);
    ctx.lineTo(cx + 56, cy + 8);
    ctx.lineTo(cx + 76, cy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ponte metálica central do óculos balístico
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx - 12, cy - 22, 24, 8);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 6, cy - 20, 12, 4);

    // Reflexo agressivo dourado/branco nas lentes
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy - 20);
    ctx.lineTo(cx - 42, cy - 2);
    ctx.moveTo(cx + 26, cy - 20);
    ctx.lineTo(cx + 44, cy - 2);
    ctx.stroke();

    // 5. Sobrancelhas Grossas, Baixas e Franzidas em V (Fúria Fria)
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 12;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(cx - 74, cy - 42);
    ctx.lineTo(cx - 10, cy - 25);
    ctx.moveTo(cx + 74, cy - 42);
    ctx.lineTo(cx + 10, cy - 25);
    ctx.stroke();

    // 6. Boca Trincada / Dentes Cerrados de Veterano Casca-Grossa (Zero Sorriso Feliz!)
    ctx.fillStyle = '#090a0d';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy + 36);
    ctx.lineTo(cx - 22, cy + 26);
    ctx.lineTo(cx + 22, cy + 26);
    ctx.lineTo(cx + 34, cy + 38);
    ctx.lineTo(cx + 24, cy + 44);
    ctx.lineTo(cx - 24, cy + 44);
    ctx.closePath();
    ctx.fill();

    // Dentes trincados em fúria
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 24, cy + 29, 48, 11);
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy + 34.5);
    ctx.lineTo(cx + 25, cy + 34.5);
    for (let tx = cx - 16; tx <= cx + 16; tx += 8) {
      ctx.moveTo(tx, cy + 28);
      ctx.lineTo(tx, cy + 41);
    }
    ctx.stroke();

    // Haste 2D complementar do microfone tático na bochecha esquerda
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 110, cy + 24);
    ctx.lineTo(cx - 48, cy + 38);
    ctx.stroke();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(cx - 46, cy + 38, 4, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }

  if (preset === 'solaris') {
    // 1. Marcas Imperiais de Energia Solar nas faces (Runas do Rei do Sol)
    ctx.strokeStyle = 'rgba(234, 88, 12, 0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 86, cy + 8);
    ctx.lineTo(cx - 36, cy + 20);
    ctx.lineTo(cx - 48, cy + 42);
    ctx.moveTo(cx + 86, cy + 8);
    ctx.lineTo(cx + 36, cy + 20);
    ctx.lineTo(cx + 48, cy + 42);
    ctx.stroke();

    // 2. Rastro de Chamas Solares subindo dos Olhos de Plasma até as têmporas
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy - 12);
    ctx.lineTo(cx - 96, cy - 38);
    ctx.lineTo(cx - 52, cy - 28);
    ctx.lineTo(cx - 12, cy - 8);
    ctx.lineTo(cx - 48, cy + 8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 72, cy - 12);
    ctx.lineTo(cx + 96, cy - 38);
    ctx.lineTo(cx + 52, cy - 28);
    ctx.lineTo(cx + 12, cy - 8);
    ctx.lineTo(cx + 48, cy + 8);
    ctx.closePath();
    ctx.fill();

    // 3. Olhos de Plasma Branco-Dourado Flamejantes (Deus/Rei do Sol — Zero olhinho preto!)
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 64, cy - 16);
    ctx.lineTo(cx - 14, cy - 8);
    ctx.lineTo(cx - 22, cy + 6);
    ctx.lineTo(cx - 58, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 64, cy - 16);
    ctx.lineTo(cx + 14, cy - 8);
    ctx.lineTo(cx + 22, cy + 6);
    ctx.lineTo(cx + 58, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Núcleo branco incandescente dentro dos olhos solares
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 50, cy - 11, 24, 9);
    ctx.fillRect(cx + 26, cy - 11, 24, 9);

    // 4. Sobrancelhas Reais Carmesim/Ouro Franzidas em V (Autoridade Soberana)
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 11;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy - 36);
    ctx.lineTo(cx - 10, cy - 20);
    ctx.moveTo(cx + 72, cy - 36);
    ctx.lineTo(cx + 10, cy - 20);
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 38);
    ctx.lineTo(cx - 12, cy - 22);
    ctx.moveTo(cx + 70, cy - 38);
    ctx.lineTo(cx + 12, cy - 22);
    ctx.stroke();

    // 5. Expressão Fechada e Imponente de Rei do Sol (Sem sorrisinho feliz!)
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 34);
    ctx.lineTo(cx - 14, cy + 26);
    ctx.lineTo(cx + 14, cy + 26);
    ctx.lineTo(cx + 28, cy + 34);
    ctx.stroke();

    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 44);
    ctx.lineTo(cx + 14, cy + 44);
    ctx.stroke();
    return true;
  }

  if (preset === 'tita') {
    // =========================================================================
    // ROSTO DE CIBORGUE MUTANTE GIGANTE DA PM DE SÃO PAULO (PMESP — 512x256, cx=256)
    // =========================================================================
    // 1. Preenchimento 100% da cabeça cilíndrica (0..512) em Aço Cinza-Bandeirante PMESP
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 256);

    // Faixa superior Branca Policial e faixa lateral Vermelha PMESP
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 46);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 42, 512, 12);

    // Placa Facial Blindada Central (centrada em cx = 256, cy = 128!)
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 118, 48, 236, 188);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 6;
    ctx.strokeRect(cx - 114, 52, 228, 180);

    // Veias/Cabos de Bio-Energia Mutante Vermelha nas têmporas do ciborgue
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 112, cy - 18);
    ctx.lineTo(cx - 78, cy - 6);
    ctx.lineTo(cx - 92, cy + 22);
    ctx.moveTo(cx + 112, cy - 18);
    ctx.lineTo(cx + 78, cy - 6);
    ctx.lineTo(cx + 92, cy + 22);
    ctx.stroke();

    // 2. Visor Tático Vermelho-Laser Emissivo em V Franzido (Olhar de Juggernaut Implacável)
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(cx - 92, cy - 42);
    ctx.lineTo(cx, cy - 18);
    ctx.lineTo(cx + 92, cy - 42);
    ctx.lineTo(cx + 80, cy + 8);
    ctx.lineTo(cx, cy + 22);
    ctx.lineTo(cx - 80, cy + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(cx - 84, cy - 35);
    ctx.lineTo(cx, cy - 12);
    ctx.lineTo(cx + 84, cy - 35);
    ctx.lineTo(cx + 72, cy + 2);
    ctx.lineTo(cx, cy + 15);
    ctx.lineTo(cx - 72, cy + 2);
    ctx.closePath();
    ctx.fill();

    // Núcleos óticos branco-rubros incandescentes dentro do visor
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(cx - 64, cy - 24, 42, 11);
    ctx.fillRect(cx + 22, cy - 24, 42, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 52, cy - 22, 22, 7);
    ctx.fillRect(cx + 30, cy - 22, 22, 7);

    // 3. Queixeira / Mandíbula Mecânica Pesada com Grade de Respirador Industrial Vermelho-Fogo
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(cx - 76, cy + 28, 152, 66);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 6;
    ctx.strokeRect(cx - 76, cy + 28, 152, 66);

    // Dentes/Grades metálicas + Brilho de Fornalha Mutante Vermelha por trás da grade
    for (let gx = cx - 58; gx <= cx + 46; gx += 20) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(gx, cy + 36, 12, 48);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(gx + 3, cy + 42, 6, 36);
    }

    // Rebites de aço nas laterais da mandíbula
    ctx.fillStyle = '#e2e8f0';
    for (const [rx, ry] of [[cx - 96, cy + 38], [cx + 96, cy + 38], [cx - 96, cy + 78], [cx + 96, cy + 78]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  }

  return false;
}
