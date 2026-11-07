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
  silver: 0xcbd5e1        // Metallic Silver
};

const materialCache = new Map();

/**
 * Retorna um MeshPhysicalMaterial com acabamento de plástico ABS LEGO brilhante
 */
export function getLegoMaterial(colorHex, options = {}) {
  const key = `${colorHex}_${JSON.stringify(options)}`;
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

// Geometria compartilhada para os pinos cilíndricos de LEGO (Studs)
export const SHARED_STUD_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.11, 16);
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
    instancedStuds.castShadow = options.castShadow ?? true;
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

