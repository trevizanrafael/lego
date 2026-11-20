/**
 * Pintores Canvas 2D de rostos dos heróis vigilantes/furtivos (`vingador`, `sombra`).
 * Auxiliar interno de `ProceduralFaceTextures.js`.
 */
export function paintVigilanteHeroFace(ctx, preset, cx) {
  if (preset === 'vingador') {
    // =========================================================================
    // ROSTO "O JUSTICEIRO / FRANK CASTLE" (512x256, centro cx=256, cy=128)
    // =========================================================================
    // 1. Pele LEGO amarela clássica (#f6c92d) em 100% da cabeça com sombreamento pesado de veterano
    ctx.fillStyle = '#f6c92d';
    ctx.fillRect(0, 0, 512, 256);

    // Sombreamento de olheiras profundas e pintura de guerra fosca ao redor dos olhos (centrado em cx = 256)
    const eyeShadowGrad = ctx.createLinearGradient(cx - 115, 62, cx + 115, 134);
    eyeShadowGrad.addColorStop(0, 'rgba(9, 10, 13, 0.25)');
    eyeShadowGrad.addColorStop(0.2, 'rgba(9, 10, 13, 0.82)');
    eyeShadowGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.88)');
    eyeShadowGrad.addColorStop(0.8, 'rgba(9, 10, 13, 0.82)');
    eyeShadowGrad.addColorStop(1, 'rgba(9, 10, 13, 0.25)');
    ctx.fillStyle = eyeShadowGrad;
    ctx.fillRect(cx - 115, 64, 230, 62);

    // Faixa tática preta na testa (Headband do Frank Castle envolvendo 0..512)
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 16, 512, 34);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 22, 512, 8);

    // 2. Barba Cerrada Escura (Stubble acinzentado pesado na mandíbula e queixo, centrado em cx = 256)
    ctx.fillStyle = 'rgba(17, 24, 39, 0.56)';
    ctx.beginPath();
    ctx.moveTo(cx - 102, 128);
    ctx.lineTo(cx - 76, 152);
    ctx.lineTo(cx + 76, 152);
    ctx.lineTo(cx + 102, 128);
    ctx.lineTo(cx + 92, 238);
    ctx.lineTo(cx - 92, 238);
    ctx.closePath();
    ctx.fill();

    // Pontilhado de barba por fazer (stubble) e vincos de veterano
    ctx.fillStyle = 'rgba(9, 10, 13, 0.45)';
    for (let sx = cx - 80; sx <= cx + 80; sx += 10) {
      for (let sy = 142; sy <= 226; sy += 10) {
        if ((sx + sy) % 20 === 0) {
          ctx.fillRect(sx, sy, 3, 3);
        }
      }
    }

    // 3. Cicatrizes de Batalha no Nariz e Sobrancelha Direita
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Cicatriz vertical cortando a sobrancelha e olho direito
    ctx.moveTo(cx + 48, 52);
    ctx.lineTo(cx + 38, 132);
    // Cicatriz diagonal na ponte do nariz
    ctx.moveTo(cx - 18, 118);
    ctx.lineTo(cx + 22, 134);
    ctx.stroke();

    // 4. Sobrancelhas Grossas Arqueadas em Fúria (Preto Asfalto)
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 12;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(cx - 86, 68);
    ctx.lineTo(cx - 18, 86);
    ctx.moveTo(cx + 86, 68);
    ctx.lineTo(cx + 18, 86);
    ctx.stroke();

    // 5. Olhos Furiosos Estreitos com Brilho Branco Intimidador (Estilo Justiceiro)
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(cx - 78, 84, 54, 24);
    ctx.fillRect(cx + 24, 84, 54, 24);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 74, 88);
    ctx.lineTo(cx - 26, 94);
    ctx.lineTo(cx - 30, 105);
    ctx.lineTo(cx - 70, 102);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 74, 88);
    ctx.lineTo(cx + 26, 94);
    ctx.lineTo(cx + 30, 105);
    ctx.lineTo(cx + 70, 102);
    ctx.closePath();
    ctx.fill();

    // Íris escura feroz + reflexo frio
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 52, 91, 10, 11);
    ctx.fillRect(cx + 42, 91, 10, 11);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 55, 92, 4, 4);
    ctx.fillRect(cx + 39, 92, 4, 4);

    // 6. Expressão Brutal de Dentes Cerrados em Rosnado (Grimace) centralizada em cx = 256
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.roundRect(cx - 56, 156, 112, 38, 6);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 50, 161, 100, 28);

    // Divisórias dos dentes cerrados
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 50, 175);
    ctx.lineTo(cx + 50, 175);
    for (let tx = cx - 34; tx <= cx + 34; tx += 17) {
      ctx.moveTo(tx, 161);
      ctx.lineTo(tx, 189);
    }
    ctx.stroke();

    // Covinha / queixo quadrado marcado de Frank Castle
    ctx.strokeStyle = 'rgba(9, 10, 13, 0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, 212, 12, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    return true;
  }

  if (preset === 'sombra') {
    // =========================================================================
    // ROSTO CYBER-SHINOBI MÍSTICO DO SOMBRA ESCARLATE (512x256, centro cx=256)
    // =========================================================================
    // 1. Preenchimento 100% da cabeça cilíndrica (0..512) em Preto Obsidiana
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 512, 256);

    // Abertura dos olhos em grafite escuro sombreado (centrada em cx = 256)
    ctx.fillStyle = '#18181b';
    ctx.fillRect(cx - 112, 66, 224, 62);

    // 2. Bandana Preta/Escarlate na Testa (Hachigane) envolvendo toda a cabeça
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 18, 512, 46);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 24, 512, 34);

    // Placa Metálica Escura (Hachigane) centralizada em cx = 256 com Símbolo Místico Escarlate
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 56, 22, 112, 38);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 56, 22, 112, 38);

    // Rebites prateados nas pontas da placa shinobi
    ctx.fillStyle = '#e2e8f0';
    for (const rx of [cx - 46, cx + 46]) {
      ctx.beginPath();
      ctx.arc(rx, 31, 3.5, 0, Math.PI * 2);
      ctx.arc(rx, 51, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Símbolo Místico da Lua de Sangue gravado no centro da placa da testa
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, 41, 11, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.moveTo(cx - 16, 41);
    ctx.lineTo(cx + 16, 41);
    ctx.stroke();

    // 3. Rastro de Energia Espiritual Escarlate nos cantos externos dos olhos
    ctx.fillStyle = 'rgba(220, 38, 38, 0.75)';
    ctx.beginPath();
    ctx.moveTo(cx - 72, 92);
    ctx.lineTo(cx - 108, 72);
    ctx.lineTo(cx - 94, 112);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 72, 92);
    ctx.lineTo(cx + 108, 72);
    ctx.lineTo(cx + 94, 112);
    ctx.closePath();
    ctx.fill();

    // 4. Olhos Angulares Ferozes em Vermelho-Carmesim Brilhante (centrados em cx = 256)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(cx - 78, 86);
    ctx.lineTo(cx - 16, 98);
    ctx.lineTo(cx - 24, 116);
    ctx.lineTo(cx - 72, 108);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 78, 86);
    ctx.lineTo(cx + 16, 98);
    ctx.lineTo(cx + 24, 116);
    ctx.lineTo(cx + 72, 108);
    ctx.closePath();
    ctx.fill();

    // Núcleos incandescentes branco-rosados nos olhos
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(cx - 58, 94, 28, 10);
    ctx.fillRect(cx + 30, 94, 28, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 48, 96, 14, 6);
    ctx.fillRect(cx + 34, 96, 14, 6);

    // 5. Máscara Facial Ninja / Menpo (Meia-Máscara Oni Preta e Grafite com Presas/Entalhes)
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(cx - 114, 128);
    ctx.lineTo(cx, 116);
    ctx.lineTo(cx + 114, 128);
    ctx.lineTo(cx + 104, 244);
    ctx.lineTo(cx - 104, 244);
    ctx.closePath();
    ctx.fill();

    // Borda superior chanfrada em Vermelho-Sangue da Máscara Oni
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 112, 130);
    ctx.lineTo(cx, 118);
    ctx.lineTo(cx + 112, 130);
    ctx.stroke();

    // Respirador / Entalhes de Presas Oni em Prata e Vermelho-Escarlate na máscara
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 68, 144, 136, 68);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 68, 144, 136, 68);

    // Presas laterais brancas/prateadas de demônio Oni
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(cx - 56, 146);
    ctx.lineTo(cx - 38, 146);
    ctx.lineTo(cx - 47, 186);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 56, 146);
    ctx.lineTo(cx + 38, 146);
    ctx.lineTo(cx + 47, 186);
    ctx.closePath();
    ctx.fill();

    // Fendas verticais escarlates no bocal da máscara
    ctx.fillStyle = '#ef4444';
    for (let gx = cx - 24; gx <= cx + 24; gx += 16) {
      ctx.fillRect(gx - 3, 154, 6, 46);
    }
    return true;
  }

  return false;
}
