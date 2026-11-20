/**
 * Pintores Canvas 2D de rostos dos heróis elementais/simbiontes (`turbo`, `voltaico`, `vortex`).
 * Auxiliar interno de `ProceduralFaceTextures.js`.
 */
export function paintElementalHeroFace(ctx, preset, cx) {
  if (preset === 'turbo') {
    // =========================================================================
    // CRÂNIO 360° DO MOTOQUEIRO FANTASMA CYBER-PLASMA (512x256, centro cx=256)
    // Caveira sinistra em Osso Fantasma (#e2e8f0), rachaduras de plasma ciano, órbitas profundas ardendo e dentes metálicos agressivos!
    // =========================================================================
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 512, 256);

    // Sombreamento anatômico 360° nas têmporas, nuca e cavidades laterais do crânio
    const templeLeft = ctx.createLinearGradient(0, 0, cx - 70, 0);
    templeLeft.addColorStop(0, '#334155');
    templeLeft.addColorStop(0.65, '#94a3b8');
    templeLeft.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = templeLeft;
    ctx.fillRect(0, 0, cx - 60, 256);

    const templeRight = ctx.createLinearGradient(512, 0, cx + 70, 0);
    templeRight.addColorStop(0, '#334155');
    templeRight.addColorStop(0.65, '#94a3b8');
    templeRight.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = templeRight;
    ctx.fillRect(cx + 60, 0, 512 - (cx + 60), 256);

    // Rachaduras Cranianas Incandescentes em Plasma Ciano/Azul-Elétrico
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, 12);
    ctx.lineTo(cx - 18, 48);
    ctx.lineTo(cx + 8, 76);
    ctx.moveTo(cx - 88, 34);
    ctx.lineTo(cx - 64, 72);
    ctx.lineTo(cx - 112, 118);
    ctx.moveTo(cx + 88, 34);
    ctx.lineTo(cx + 64, 72);
    ctx.lineTo(cx + 112, 118);
    ctx.stroke();

    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cavidades laterais abaixo das maçãs do rosto (efeito caveira funda)
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(cx - 118, 134);
    ctx.lineTo(cx - 68, 152);
    ctx.lineTo(cx - 64, 236);
    ctx.lineTo(cx - 126, 236);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 118, 134);
    ctx.lineTo(cx + 68, 152);
    ctx.lineTo(cx + 64, 236);
    ctx.lineTo(cx + 126, 236);
    ctx.closePath();
    ctx.fill();

    // Órbitas Oculares Negras Profundas e Angulares + Rastro de Fogo Ciano saindo dos olhos
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(cx - 86, 68);
    ctx.lineTo(cx - 14, 88);
    ctx.lineTo(cx - 22, 128);
    ctx.lineTo(cx - 82, 118);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 86, 68);
    ctx.lineTo(cx + 14, 88);
    ctx.lineTo(cx + 22, 128);
    ctx.lineTo(cx + 82, 118);
    ctx.closePath();
    ctx.fill();

    // Chamas de Fogo Ciano/Azul-Elétrico ardendo dentro das órbitas oculares
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(cx - 78, 76);
    ctx.lineTo(cx - 98, 52);
    ctx.lineTo(cx - 46, 82);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 78, 76);
    ctx.lineTo(cx + 98, 52);
    ctx.lineTo(cx + 46, 82);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#00f5d4';
    ctx.beginPath();
    ctx.moveTo(cx - 72, 84);
    ctx.lineTo(cx - 22, 94);
    ctx.lineTo(cx - 28, 118);
    ctx.lineTo(cx - 68, 112);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 72, 84);
    ctx.lineTo(cx + 22, 94);
    ctx.lineTo(cx + 28, 118);
    ctx.lineTo(cx + 68, 112);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 56, 94, 24, 12);
    ctx.fillRect(cx + 32, 94, 24, 12);

    // Cavidade Nasal Triangular Dupla Profunda de Caveira
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(cx, 104);
    ctx.lineTo(cx - 20, 146);
    ctx.lineTo(cx - 3, 142);
    ctx.lineTo(cx, 128);
    ctx.lineTo(cx + 3, 142);
    ctx.lineTo(cx + 20, 146);
    ctx.closePath();
    ctx.fill();

    // Maxilar Rasgado com Plasma Ciano Incandescente e Dentes de Caveira Afiados
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(cx - 62, 154, 124, 58);
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 62, 154, 124, 58);

    for (let tx = cx - 54; tx <= cx + 42; tx += 19) {
      // Dente superior e inferior de osso/cromo com fenda de fogo ciano no meio
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(tx, 156);
      ctx.lineTo(tx + 14, 156);
      ctx.lineTo(tx + 11, 181);
      ctx.lineTo(tx + 3, 181);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(tx + 3, 185);
      ctx.lineTo(tx + 11, 185);
      ctx.lineTo(tx + 14, 210);
      ctx.lineTo(tx, 210);
      ctx.closePath();
      ctx.fill();
    }
    return true;
  }

  if (preset === 'voltaico') {
    // =========================================================================
    // ROSTO DEUS DO TROVÃO CYBER-ELÉTRICO DO VOLTAICO (512x256, cx=256)
    // Estilo Thor / Raiden: Olhos Fulminantes de Relâmpago + Raios Ramificados + Queixeira Angular Titânio/Cobalto em V (ZERO bico amarelo!)
    // =========================================================================
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 256);

    // Diadema Superior de Titânio Prateado e Azul-Cobalto com Friso Condutor
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 512, 56);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(cx - 120, 44);
    ctx.lineTo(cx, 66);
    ctx.lineTo(cx + 120, 44);
    ctx.lineTo(cx + 120, 54);
    ctx.lineTo(cx, 76);
    ctx.lineTo(cx - 120, 54);
    ctx.closePath();
    ctx.fill();

    // Raios Ramificados Ciano/Brancos serpenteando a partir dos olhos pelas têmporas e bochechas
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 68, 92);
    ctx.lineTo(cx - 102, 74);
    ctx.lineTo(cx - 126, 90);
    ctx.moveTo(cx - 72, 106);
    ctx.lineTo(cx - 106, 126);
    ctx.lineTo(cx - 92, 152);
    ctx.moveTo(cx + 68, 92);
    ctx.lineTo(cx + 102, 74);
    ctx.lineTo(cx + 126, 90);
    ctx.moveTo(cx + 72, 106);
    ctx.lineTo(cx + 106, 126);
    ctx.lineTo(cx + 92, 152);
    ctx.stroke();

    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Sobrancelhas Elétricas Franzidas em formato de Raio
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(cx - 84, 74);
    ctx.lineTo(cx - 48, 80);
    ctx.lineTo(cx - 14, 94);
    ctx.lineTo(cx - 18, 101);
    ctx.lineTo(cx - 82, 84);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 84, 74);
    ctx.lineTo(cx + 48, 80);
    ctx.lineTo(cx + 14, 94);
    ctx.lineTo(cx + 18, 101);
    ctx.lineTo(cx + 82, 84);
    ctx.closePath();
    ctx.fill();

    // Olhos Fulminantes de Relâmpago Branco-Ciano Puro (Halo #38bdf8 + Núcleo #ffffff)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(cx - 80, 86);
    ctx.lineTo(cx - 16, 98);
    ctx.lineTo(cx - 24, 122);
    ctx.lineTo(cx - 74, 114);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 80, 86);
    ctx.lineTo(cx + 16, 98);
    ctx.lineTo(cx + 24, 122);
    ctx.lineTo(cx + 74, 114);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 72, 91);
    ctx.lineTo(cx - 22, 100);
    ctx.lineTo(cx - 28, 116);
    ctx.lineTo(cx - 68, 110);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 72, 91);
    ctx.lineTo(cx + 22, 100);
    ctx.lineTo(cx + 28, 116);
    ctx.lineTo(cx + 68, 110);
    ctx.closePath();
    ctx.fill();

    // Máscara / Queixeira Angular de Titânio Prateado e Azul-Cobalto em formato de V (Estilo Raiden / Cyber-Thor)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(cx - 88, 138);
    ctx.lineTo(cx, 158);
    ctx.lineTo(cx + 88, 138);
    ctx.lineTo(cx + 72, 212);
    ctx.lineTo(cx, 234);
    ctx.lineTo(cx - 72, 212);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Fendas Diagonais em V brilhando em Ciano Elétrico na máscara
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    for (const dy of [162, 180, 198]) {
      ctx.beginPath();
      ctx.moveTo(cx - 58, dy - 12);
      ctx.lineTo(cx - 14, dy + 4);
      ctx.moveTo(cx + 58, dy - 12);
      ctx.lineTo(cx + 14, dy + 4);
      ctx.stroke();
    }
    return true;
  }

  if (preset === 'vortex') {
    // =========================================================================
    // ROSTO COLOSSO SIMBIONTE DO VÓRTEX — ESTILO VENOM / KNULL (512x256, cx=256)
    // =========================================================================
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, 512, 256);

    // Veias Orgânicas de Biomassa Roxo-Abissal Escuro e Grafite Líquido espalhadas pelo crânio
    ctx.strokeStyle = '#581c87';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(cx + s * 135, 18);
      ctx.lineTo(cx + s * 92, 54);
      ctx.lineTo(cx + s * 116, 108);
      ctx.lineTo(cx + s * 88, 162);
      ctx.moveTo(cx + s * 64, 24);
      ctx.lineTo(cx + s * 36, 62);
    }
    ctx.stroke();

    // OLHOS BRANCOS GIGANTES, CURVOS E COM BORDAS SERRILHADAS/RASGADAS (Estilo Clássico do Venom!)
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + s * 12, 106);
      ctx.lineTo(cx + s * 34, 82);
      ctx.lineTo(cx + s * 46, 88);
      ctx.lineTo(cx + s * 68, 56);
      ctx.lineTo(cx + s * 78, 64);
      ctx.lineTo(cx + s * 106, 22);
      // Borda externa serrilhada orgânica subindo pelas têmporas
      ctx.lineTo(cx + s * 112, 48);
      ctx.lineTo(cx + s * 98, 66);
      ctx.lineTo(cx + s * 104, 84);
      ctx.lineTo(cx + s * 82, 104);
      ctx.lineTo(cx + s * 54, 118);
      ctx.lineTo(cx + s * 12, 116);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Bocarra Monstruosa Rasgada de Orelha a Orelha (Garganta Abissal Escura + Gengiva Simbionte)
    ctx.fillStyle = '#1e0536';
    ctx.strokeStyle = '#7e22ce';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 106, 134);
    ctx.quadraticCurveTo(cx, 114, cx + 106, 134);
    ctx.quadraticCurveTo(cx + 88, 232, cx, 242);
    ctx.quadraticCurveTo(cx - 88, 232, cx - 106, 134);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fileiras de Presas Longas, Irregulares e Afiadas como Agulhas (Venom Fangs)
    ctx.fillStyle = '#f8fafc';
    const upperFangs = [-86, -68, -50, -32, -16, 0, 16, 32, 50, 68, 86];
    for (let i = 0; i < upperFangs.length; i++) {
      const fx = cx + upperFangs[i];
      const fangLen = (i % 2 === 0 ? 42 : 30) - Math.abs(upperFangs[i]) * 0.12;
      ctx.beginPath();
      ctx.moveTo(fx - 6.5, 130);
      ctx.lineTo(fx + 6.5, 130);
      ctx.lineTo(fx, 130 + fangLen);
      ctx.closePath();
      ctx.fill();

      // Presas inferiores apontando para cima
      ctx.beginPath();
      ctx.moveTo(fx - 5.5, 228);
      ctx.lineTo(fx + 5.5, 228);
      ctx.lineTo(fx, 228 - fangLen * 0.85);
      ctx.closePath();
      ctx.fill();
    }
    return true;
  }

  return false;
}
