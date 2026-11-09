import * as THREE from 'three';

/**
 * Paleta oficial inspirada nas cores clássicas de peças LEGO (ABS Brilhante)
 */
export const LEGO_COLORS = {
  yellow: 0xfacc15,       // Bright Yellow (Cabeça clássica / Táxi / Detalhes)
  red: 0xdc2626,          // Bright Red (Carros / Hidrantes / Solaris)
  crimson: 0x991b1b,      // Dark Red
  blue: 0x2563eb,         // Bright Blue (Polícia / Prédios)
  navy: 0x1e3a8a,         // Earth Blue / Dark Blue
  black: 0x171717,        // Black (BOPE / Pneus / Asfalto escuro)
  charcoal: 0x262626,     // Dark Grey Tático
  darkGrey: 0x4b5563,     // Dark Stone Grey (Calçadas / Estruturas)
  lightGrey: 0x9ca3af,    // Medium Stone Grey (Concreto / Bordas)
  white: 0xf8fafc,        // White (Faixas / Viaturas / Prédios)
  green: 0x16a34a,        // Bright Green (Árvores / Parque)
  darkGreen: 0x15803d,    // Dark Green
  sandGreen: 0x6ee7b7,    // Sand Green
  orange: 0xf97316,       // Bright Orange (Luzes / Fogo)
  tan: 0xfde68a,          // Brick Yellow / Tan (Prédios clássicos)
  brown: 0x78350f,        // Reddish Brown (Troncos / Bancos / Caixas)
  nougat: 0xd97706,       // Warm Tan / Tijolo
  cyan: 0x06b6d4,         // Neon Cyan (Turbo / Vidros)
  purple: 0x9333ea,       // A.R.E.S. Purple
  gold: 0xf59e0b,         // Warm Gold
  silver: 0xcbd5e1,       // Metallic Silver
  asphalt: 0x181c24,      // Asfalto Urbano Escuro
  sidewalk: 0x64748b,     // Calçada LEGO
  concrete: 0x475569,     // Concreto Urbano
  darkBlue: 0x1e3a8a      // Azul Corporativo Escuro
};

const materialCache = new Map();

/**
 * Retorna um MeshPhysicalMaterial com acabamento de plástico ABS LEGO brilhante
 */
export function getLegoMaterial(colorHex, options = {}) {
  const { map, ...restOptions } = options;
  const key = `${colorHex}_${map ? map.uuid : 'nomap'}_${JSON.stringify(restOptions)}`;
  if (materialCache.has(key)) {
    return materialCache.get(key);
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: options.roughness ?? 0.25,
    metalness: options.metalness ?? 0.02,
    clearcoat: options.clearcoat ?? 0.4,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.15,
    reflectivity: 0.7,
    ...(options.transparent ? { transparent: true, opacity: options.opacity ?? 0.65 } : {}),
    ...(options.emissive ? { emissive: options.emissive, emissiveIntensity: options.emissiveIntensity ?? 1.0 } : {}),
    ...(options.map ? { map: options.map } : {})
  });

  materialCache.set(key, mat);
  return mat;
}

// Geometria compartilhada otimizada (8 lados) para os pinos cilíndricos de LEGO (Studs)
export const SHARED_STUD_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.11, 8);
SHARED_STUD_GEO.translate(0, 0.055, 0);

/**
 * Cria um bloco LEGO (Brick/Plate) com pinos (studs) no topo usando InstancedMesh quando há muitos pinos
 */
export function createLegoBrick(width, height, depth, colorHex, options = {}) {
  const group = new THREE.Group();
  const mat = getLegoMaterial(colorHex, options);

  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const bodyMesh = new THREE.Mesh(bodyGeo, mat);
  bodyMesh.castShadow = options.castShadow ?? true;
  bodyMesh.receiveShadow = options.receiveShadow ?? true;
  group.add(bodyMesh);

  if (options.studs !== false) {
    const step = options.studStep ?? 0.6;
    const cols = Math.max(1, Math.floor(width / step));
    const rows = Math.max(1, Math.floor(depth / step));
    const count = cols * rows;

    const instancedStuds = new THREE.InstancedMesh(SHARED_STUD_GEO, mat, count);
    // Pinos minúsculos (0.11m) não precisam projetar sombra no ShadowMap 1024x1024 (economiza centenas de Draw Calls de sombra!)
    instancedStuds.castShadow = false;
    instancedStuds.receiveShadow = options.receiveShadow ?? true;

    const dummy = new THREE.Object3D();
    const startX = -((cols - 1) * step) / 2;
    const startZ = -((rows - 1) * step) / 2;
    let idx = 0;

    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        dummy.position.set(startX + ix * step, height / 2, startZ + iz * step);
        dummy.updateMatrix();
        instancedStuds.setMatrixAt(idx++, dummy.matrix);
      }
    }
    instancedStuds.instanceMatrix.needsUpdate = true;
    group.add(instancedStuds);
  }

  return group;
}

/**
 * Gera uma textura de rosto de Minifigura LEGO em alta definição (aplicada na frente do cilindro)
 */
export function createMinifigFaceTexture(preset = 'caveira') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fundo amarelo clássico LEGO (ou customizado)
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // O centro da face no CylinderGeometry (com rotação padrão) fica em X = 256
  const cx = 256;
  const cy = 128;

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
  } else if (preset === 'solaris') {
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
  } else if (preset === 'tita') {
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
  } else if (preset === 'vingador') {
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
  } else if (preset === 'sombra') {
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
  } else if (preset === 'turbo') {
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
  } else if (preset === 'voltaico') {
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
  } else if (preset === 'vortex') {
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
  } else {
    // Rosto clássico LEGO feliz/aventureiro
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.arc(cx - 30, cy - 10, 10, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy - 10, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 33, cy - 13, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 27, cy - 13, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#171717';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 12, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Gera estampa frontal do tronco trapezoidal da Minifigura LEGO
 */
export function createMinifigTorsoTexture(preset = 'caveira') {
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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cache compartilhado de Texturas e Materiais Faciais para 100% dos NPCs da Cidade Viva
 * (Pedestres Civis + pânico, Soldados CV de Juliet/Bandana, PCC de Balaclava, BOPE com pintura de guerra e A.R.E.S. Cyber)
 */
export const SHARED_NPC_FACE_TEXTURES = new Map();
const SHARED_NPC_FACE_MATERIALS = new Map();

export function createNpcFaceTexture(faceKey = 'civ_smile') {
  if (SHARED_NPC_FACE_TEXTURES.has(faceKey)) {
    return SHARED_NPC_FACE_TEXTURES.get(faceKey);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const cx = 128;

  if (faceKey === 'pcc_balaclava') {
    // Balaclava Preta Tática do PCC com costura azul-marinho e fenda dos olhos furiosos
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 256, 128);

    // Faixas táticas laterais azul-escuro/branco
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 14, 256, 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 24, 256, 2.5);

    // Abertura amarela LEGO da fenda dos olhos na balaclava
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(cx - 46, 38, 92, 28, 8);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Sobrancelhas furiosas e olhos ferozes
    for (const s of [-1, 1]) {
      const ex = cx + s * 22;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 53, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, 51, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(ex - s * 13, 47);
      ctx.lineTo(ex + s * 11, 41);
      ctx.stroke();
    }

    // Costura respiratória inferior da balaclava
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let x = cx - 24; x <= cx + 24; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 78);
      ctx.lineTo(x, 96);
      ctx.stroke();
    }
  } else if (faceKey === 'ares_cyber') {
    // Capacete Cyber-Militar A.R.E.S. com Visor Neon Roxo/Magenta em V
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 58, 22, 116, 86);

    // Visor Neon Magenta/Roxo em V
    ctx.fillStyle = '#d946ef';
    ctx.beginPath();
    ctx.moveTo(cx - 48, 36);
    ctx.lineTo(cx, 48);
    ctx.lineTo(cx + 48, 36);
    ctx.lineTo(cx + 42, 58);
    ctx.lineTo(cx, 66);
    ctx.lineTo(cx - 42, 58);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.moveTo(cx - 36, 42);
    ctx.lineTo(cx, 51);
    ctx.lineTo(cx + 36, 42);
    ctx.lineTo(cx + 32, 49);
    ctx.lineTo(cx, 57);
    ctx.lineTo(cx - 32, 49);
    ctx.closePath();
    ctx.fill();

    // Grade vocal cyber
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    for (let x = cx - 24; x <= cx + 24; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 76);
      ctx.lineTo(x, 98);
      ctx.stroke();
    }
  } else if (faceKey === 'cv_juliet') {
    // Soldado do CV: Rosto Amarelo LEGO mal-encarado com Bandana Vermelha e Óculos Juliet Espelhado Rubi/Fogo
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    // Faixa da Bandana Vermelha na testa
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 8, 256, 22);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 27, 256, 3);

    // Armação X-Metal Prata Escura da Juliet + Ponte nasal
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 56, 46);
    ctx.lineTo(cx + 56, 46);
    ctx.stroke();

    // Lentes Ovais Espelhadas Rubi/Fogo (Juliet)
    for (const s of [-1, 1]) {
      const lx = cx + s * 25;
      const grad = ctx.createLinearGradient(lx - 18, 36, lx + 18, 60);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(0.55, '#f97316');
      grad.addColorStop(1, '#facc15');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(lx, 48, 21, 12, s * -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#090a0d';
      ctx.stroke();

      // Reflexo branco diagonal na lente espelhada
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx - 10, 42);
      ctx.lineTo(lx + 4, 52);
      ctx.stroke();
    }

    // Boca mal-encarada de dentes cerrados + cicatriz e cavanhaque
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 24, 74, 48, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 22, 82);
    ctx.lineTo(cx + 22, 82);
    for (let x = cx - 12; x <= cx + 12; x += 12) {
      ctx.moveTo(x, 74);
      ctx.lineTo(x, 90);
    }
    ctx.stroke();
  } else if (faceKey === 'bope_tactical') {
    // Policial do BOPE: Pintura de guerra camuflada nas bochechas + expressão feroz de operações especiais
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    // Listras de pintura de guerra preta/cinza nas bochechas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    for (const s of [-1, 1]) {
      ctx.fillRect(cx + s * 28 - 12, 62, 24, 6);
      ctx.fillRect(cx + s * 28 - 10, 72, 20, 5);
    }

    // Olhos focados + sobrancelhas táticas grossas
    for (const s of [-1, 1]) {
      const ex = cx + s * 22;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, 46, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ex - s * 14, 40);
      ctx.lineTo(ex + s * 12, 34);
      ctx.stroke();
    }

    // Boca firme tática + tira de jugular do capacete/boina
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 18, 82);
    ctx.lineTo(cx, 78);
    ctx.lineTo(cx + 18, 82);
    ctx.stroke();
  } else if (faceKey === 'civ_panic') {
    // Pedestre Civil em PÂNICO: Olhos arregalados e boca aberta em "O" gritando!
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    for (const s of [-1, 1]) {
      const ex = cx + s * 22;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, 48, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Sobrancelhas arqueadas de susto
      ctx.beginPath();
      ctx.moveTo(ex - s * 12, 30);
      ctx.lineTo(ex + s * 12, 37);
      ctx.stroke();
    }

    // Boca aberta gritando em "O"
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(cx, 82, 14, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 9, 67, 18, 5);
  } else if (faceKey === 'civ_shades') {
    // Pedestre Civil com Óculos de Sol Estiloso e Sorriso Confiante
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#090a0d';
    ctx.fillRect(cx - 50, 38, 100, 5);
    for (const s of [-1, 1]) {
      const lx = cx + s * 23;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(lx - 18, 38, 36, 20, 5);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx - 10, 42);
      ctx.lineTo(lx + 4, 54);
      ctx.stroke();
    }

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, 72, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (faceKey === 'civ_cool') {
    // Pedestre Civil Descolado com Sobrancelha Arqueada e Sorriso de Canto
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    for (const s of [-1, 1]) {
      const ex = cx + s * 21;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, 46, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ex - 11, s < 0 ? 36 : 33);
      ctx.lineTo(ex + 11, s < 0 ? 34 : 38);
      ctx.stroke();
    }

    // Sorriso confiante com dentes brancos
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(cx + 2, 72, 19, 0.08 * Math.PI, 0.88 * Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // civ_smile: Rosto LEGO Clássico Sorridente
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);

    for (const s of [-1, 1]) {
      const ex = cx + s * 21;
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(ex, 48, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2.2, 45.8, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.arc(ex, 44, 12, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    }

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, 70, 21, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  SHARED_NPC_FACE_TEXTURES.set(faceKey, tex);
  return tex;
}

export function getSharedNpcFaceMaterial(faceKey = 'civ_smile') {
  if (SHARED_NPC_FACE_MATERIALS.has(faceKey)) {
    return SHARED_NPC_FACE_MATERIALS.get(faceKey);
  }
  const tex = createNpcFaceTexture(faceKey);
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.2,
    clearcoat: 0.45
  });
  SHARED_NPC_FACE_MATERIALS.set(faceKey, mat);
  return mat;
}


