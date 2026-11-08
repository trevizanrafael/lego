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
    // Rosto Justiceiro Urbano: pintura de guerra tática nos olhos + bandana de caveira prateada na boca
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(26, 66, 204, 52);

    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(56, 70);
    ctx.lineTo(108, 86);
    ctx.moveTo(200, 70);
    ctx.lineTo(148, 86);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(66, 86, 36, 18);
    ctx.fillRect(154, 86, 36, 18);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(78, 89, 12, 12);
    ctx.fillRect(166, 89, 12, 12);

    // Máscara/Bandana preta inferior com dentes de Caveira Prateada
    ctx.fillStyle = '#111827';
    ctx.fillRect(22, 128, 212, 110);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(22, 128);
    ctx.lineTo(234, 128);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    for (let tx = 70; tx <= 174; tx += 24) {
      ctx.fillRect(tx, 146, 16, 44);
    }
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(66, 166, 124, 6);
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
    // Colete Pesado do Vingador de Chumbo (Preto/Grafite + Caveira Prateada + Bandoleira de Cartuchos)
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#1f2937';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(22, 18, 212, 184, 12);
    ctx.fill();
    ctx.stroke();

    // Grande Crânio Justiceiro Prateado no Peito
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(128, 92, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(98, 122, 60, 44);

    // Olhos angulares escuros do crânio
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.moveTo(96, 82);
    ctx.lineTo(122, 92);
    ctx.lineTo(118, 108);
    ctx.lineTo(92, 100);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(160, 82);
    ctx.lineTo(134, 92);
    ctx.lineTo(138, 108);
    ctx.lineTo(164, 100);
    ctx.closePath();
    ctx.fill();

    // Dentes longos prateados/pretos
    for (let gx = 108; gx <= 148; gx += 13) {
      ctx.fillRect(gx, 130, 5, 34);
    }

    // Bandoleira diagonal de cartuchos vermelhos/dourados de Escopeta
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(28, 24);
    ctx.lineTo(228, 198);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const bx = 46 + i * 30;
      const by = 40 + i * 26;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(bx - 6, by - 10, 12, 16);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bx - 6, by + 6, 12, 6);
    }

    // Cinto de munição pesado
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(10, 208, 236, 38);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(104, 214, 48, 26);
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

