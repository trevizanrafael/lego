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
    // Sobrancelhas franzidas de ação
    ctx.strokeStyle = '#171717';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(cx - 56, cy - 38);
    ctx.lineTo(cx - 16, cy - 28);
    ctx.moveTo(cx + 56, cy - 38);
    ctx.lineTo(cx + 16, cy - 28);
    ctx.stroke();

    // Óculos Táticos Escuros estilo BOPE
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;

    // Lente esquerda
    ctx.beginPath();
    ctx.roundRect(cx - 60, cy - 25, 48, 28, 6);
    ctx.fill();
    ctx.stroke();

    // Lente direita
    ctx.beginPath();
    ctx.roundRect(cx + 12, cy - 25, 48, 28, 6);
    ctx.fill();
    ctx.stroke();

    // Ponte do óculos e hastes
    ctx.fillStyle = '#171717';
    ctx.fillRect(cx - 12, cy - 18, 24, 6);
    ctx.fillRect(cx - 88, cy - 16, 28, 5);
    ctx.fillRect(cx + 60, cy - 16, 28, 5);

    // Reflexo branco diagonal nas lentes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 48, cy - 18);
    ctx.lineTo(cx - 32, cy - 4);
    ctx.moveTo(cx + 24, cy - 18);
    ctx.lineTo(cx + 40, cy - 4);
    ctx.stroke();

    // Sorriso confiante / cicatriz no queixo
    ctx.strokeStyle = '#171717';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy + 16, 26, 0.15 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();

    // Dentes brancos no sorriso lateral
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy + 18, 22, 0.2 * Math.PI, 0.75 * Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (preset === 'solaris') {
    // Olhos brilhantes solares e expressão heroica
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.arc(cx - 32, cy - 10, 12, 0, Math.PI * 2);
    ctx.arc(cx + 32, cy - 10, 12, 0, Math.PI * 2);
    ctx.fill();

    // Brilho dourado/branco nos olhos
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx - 35, cy - 14, 5, 0, Math.PI * 2);
    ctx.arc(cx + 29, cy - 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Sobrancelhas vermelhas/escuras
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy - 32);
    ctx.lineTo(cx - 16, cy - 24);
    ctx.moveTo(cx + 50, cy - 32);
    ctx.lineTo(cx + 16, cy - 24);
    ctx.stroke();

    // Sorriso clássico de herói LEGO
    ctx.strokeStyle = '#171717';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy + 14, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (preset === 'tita') {
    // Base metálica azul-escura/titânio do capacete Mecha-Policial (Big-Fig)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 30, 208, 196);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 34, 200, 188);

    // Visor Tático Ciano-Neon em V (Mecha HUD)
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(42, 74);
    ctx.lineTo(128, 94);
    ctx.lineTo(214, 74);
    ctx.lineTo(204, 118);
    ctx.lineTo(128, 134);
    ctx.lineTo(52, 118);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(64, 86, 48, 12);
    ctx.fillRect(144, 86, 48, 12);

    // Respirador blindado com grelha dourada/prateada no queixo
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(68, 152, 120, 48);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.strokeRect(68, 152, 120, 48);
    ctx.fillStyle = '#facc15';
    for (let gx = 84; gx <= 168; gx += 20) {
      ctx.fillRect(gx, 160, 8, 32);
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
    // Ninja Cyber-Escarlate: máscara shinobi preta fosca + bandana escarlate + olhos vermelhos neon
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(34, 72, 188, 54);

    // Bandana escarlate na testa com placa metálica shinobi
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(16, 34, 224, 34);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(88, 40, 80, 22);
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.strokeRect(88, 40, 80, 22);

    // Olhos Cyber-Ninja Vermelho-Escarlate Brilhantes
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(54, 92);
    ctx.lineTo(108, 102);
    ctx.lineTo(98, 118);
    ctx.lineTo(48, 108);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(202, 92);
    ctx.lineTo(148, 102);
    ctx.lineTo(158, 118);
    ctx.lineTo(208, 108);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fecaca';
    ctx.fillRect(68, 98, 22, 8);
    ctx.fillRect(166, 98, 22, 8);

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, 142);
    ctx.lineTo(128, 198);
    ctx.lineTo(192, 142);
    ctx.stroke();
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
    // Armadura Rubra & Dourada Solaris
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 256, 256);

    // Linhas de energia douradas
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(30, 20);
    ctx.lineTo(95, 115);
    ctx.lineTo(60, 220);
    ctx.moveTo(226, 20);
    ctx.lineTo(161, 115);
    ctx.lineTo(196, 220);
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
    // Peitoral Blindado Mecha-Policial (Titã Blindado Big-Fig)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    // Placa peitoral hidráulica pesada
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(18, 16, 220, 182, 14);
    ctx.fill();
    ctx.stroke();

    // Listras de alerta diagonal no peito (estilo mecha tático)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(28, 30, 52, 16);
    ctx.fillRect(176, 30, 52, 16);

    // Reator de Energia Ciano no centro do peito
    const coreGrad = ctx.createRadialGradient(128, 102, 6, 128, 102, 46);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, '#00f0ff');
    coreGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(128, 102, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Pistões abdominais prateados e cinto blindado
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(46, 152, 36, 40);
    ctx.fillRect(174, 152, 36, 40);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(10, 206, 236, 40);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(98, 214, 60, 24);
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

