import * as THREE from 'three';

function smoothstep01(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function cosineStep01(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return 0.5 * (1 - Math.cos(Math.PI * c));
}

/**
 * Máscara suave de proteção de pisos internos/sensíveis que devem permanecer em Y = 0.0m:
 * Retorna 0.0 dentro do retângulo interno e sobe suavemente até 1.0 na margem externa `margin`.
 */
export function rectFlatKeepoutFactor(x, z, minX, maxX, minZ, maxZ, margin = 24) {
  const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
  const dist = Math.hypot(dx, dz);
  if (dist <= 0.001) return 0;
  if (dist >= margin) return 1;
  return cosineStep01(dist / margin);
}

export { smoothstep01, cosineStep01 };

// ============================================================================
// 1. FUNÇÕES MATEMÁTICAS DE RELEVO URBANO VISÍVEL NAS RUAS E AVENIDAS (6° A 11°!)
// ============================================================================

/**
 * 1.1 Subúrbio Norte em Ladeiras Marcantes & Mirante Costeiro (`Z = -520..-1320`, `X = -658..+538`):
 * - Sobe logo nas primeiras 2 quadras (`Z = -520 -> -780`) para **`+12.0m`** (ladeira nítida ao dirigir!),
 *   e continua subindo até **`+22.0m`** no Mirante Costeiro Norte (`Z = -1240..-1320`)!
 */
export function getNorthSuburbPlateauY(x, z) {
  if (z >= -520 || z < -1324 || x <= -658 || x >= 540.5) return 0;

  let baseH = 0;
  if (z >= -780) {
    // Primeiras 2 quadras (-520 -> -780): sobe firme para +12.0m!
    const tEarly = cosineStep01((-520 - z) / 260.0);
    baseH = 12.0 * tEarly;
  } else {
    // De -780 (+12.0m) até -1245 (+22.0m no Mirante Costeiro Norte!)
    const tLate = cosineStep01((-780 - z) / (-780 - -1245));
    baseH = 12.0 + 10.0 * tLate;
  }

  let wx = 1.0;
  if (x < -636) {
    wx = smoothstep01((x - -658) / 22.0);
  } else if (x > 514) {
    wx = 1.0 - smoothstep01((x - 514) / 26.0);
  }

  const wave = 1.0 + 0.05 * Math.cos((x / 260) * Math.PI);
  return Math.min(22.4, baseH * wx * wave);
}

/**
 * 1.2 Alto do Centro — Distrito Noroeste & Nordeste (`Z = -515..-232`):
 * - Ladeiras marcantes subindo a **`+12.5m..+15.0m`** nas avenidas Norte-Sul (`X = -384, -252, +252, +384`),
 *   fazendo os carros subirem e descerem morros urbanos reais estilo São Francisco / Rio!
 */
export function getNorthwestDowntownHillY(x, z) {
  if (z < -535 || z > -228) return 0;

  let h = 0;

  // A) Colina Urbana Noroeste (Avenidas X = -384 e X = -252, Z = -495..-235 -> Pico +15.0m!)
  if (x >= -512 && x <= -88) {
    const dNW1 = Math.hypot((x - -324) / 228, (z - -386) / 132);
    if (dNW1 < 1) {
      h = Math.max(h, cosineStep01(1 - dNW1) * 15.0);
    }
    const dNW2 = Math.hypot((x - -248) / 155, (z - -312) / 80);
    if (dNW2 < 1) {
      h = Math.max(h, cosineStep01(1 - dNW2) * 13.4);
    }
  }

  // B) Colina Urbana Nordeste (Avenidas X = +252 e X = +384, Z = -495..-235 -> Pico +14.8m!)
  if (x >= 112 && x <= 515) {
    const dNE1 = Math.hypot((x - 324) / 228, (z - -382) / 130);
    if (dNE1 < 1) {
      h = Math.max(h, cosineStep01(1 - dNE1) * 14.8);
    }
    const dNE2 = Math.hypot((x - 256) / 152, (z - -308) / 78);
    if (dNE2 < 1) {
      h = Math.max(h, cosineStep01(1 - dNE2) * 13.2);
    }
  }

  return h;
}

/**
 * 1.2B Colina da Bela Vista / Centro Leste (`X = +130..+495, Z = -220..+120` -> **`+9.5m`**):
 * - Faz as avenidas `Z = -117` e `Z = 0` do lado Leste subirem e descerem visivelmente!
 */
export function getEastDowntownBelaVistaHillY(x, z) {
  if (x <= 125 || x >= 502 || z <= -225 || z >= 125) return 0;

  const dx = (x - 318) / 182.0;
  const dz = (z - -52) / 162.0;
  const d = Math.hypot(dx, dz);
  if (d >= 1.0) return 0;

  // Transição suave antes da Estação Elevada 05 (X = 509, Z = -180) e das Pontes Leste (X >= 526)
  let edgeTaper = 1.0;
  if (x > 462) {
    edgeTaper = 1.0 - smoothstep01((x - 462) / 40.0);
  }
  return cosineStep01(1.0 - d) * 9.6 * edgeTaper;
}

/**
 * 1.3 Crista Panorâmica Sul rumo à Praia (`Z = +406..+722`, `X = -645..+520` -> **`+10.5m`**):
 * - Sobe de `Z = +406` até **`+10.5m`** em `Z ≈ +535` e desce revelando o mar e o Mega Píer até `Z = +710`!
 */
export function getSouthCoastalRidgeY(x, z) {
  if (z <= 406 || z >= 724 || x <= -645 || x >= 522) return 0;

  let profZ = 0;
  if (z <= 535) {
    profZ = cosineStep01((z - 406) / (535 - 406));
  } else if (z <= 710) {
    profZ = THREE.MathUtils.lerp(0.04, 1.0, cosineStep01((710 - z) / (710 - 535)));
  } else {
    profZ = 0.04 * (1.0 - smoothstep01((z - 710) / 14.0));
  }

  let envX = 1.0;
  if (x < -580) envX = smoothstep01((x - -645) / 65);
  else if (x > 465) envX = 1.0 - smoothstep01((x - 465) / 57);

  const gentleWave = 1.0 + 0.05 * Math.sin((x + 180) * 0.008);
  return 10.5 * profZ * envX * gentleWave;
}

/**
 * 1.4 Colinas Verdes em Terraços Orgânicos & Mirante do Parque Central (`X = -486..-68, Z = 158..378`):
 * - Mirante Circular em `Y = +14.0m` (`X = -215, Z = 296`) e Colina Oeste em `Y = +11.4m` (`X = -408, Z = 268`).
 */
export function getCentralParkWestHillsY(x, z) {
  if (x < -486 || x > -68 || z < 158 || z > 378) return 0;

  let h = 0;

  const dx2 = (x - -215) / 62.0;
  const dz2 = (z - 296) / 52.0;
  const d2 = Math.hypot(dx2, dz2);
  if (d2 < 1.0) {
    const flatR = 0.25;
    if (d2 <= flatR) {
      h = Math.max(h, 14.0);
    } else {
      const u = 1.0 - (d2 - flatR) / (1.0 - flatR);
      const smoothH = cosineStep01(u) * 14.0;
      const terraceWave = Math.sin(u * Math.PI * 6.0) * 0.22 * (1 - u * 0.3);
      h = Math.max(h, Math.max(0, smoothH + terraceWave));
    }
  }

  const dx1 = (x - -408) / 54.0;
  const dz1 = (z - 268) / 44.0;
  const d1 = Math.hypot(dx1, dz1);
  if (d1 < 1.0) {
    const flatR1 = 0.22;
    if (d1 <= flatR1) {
      h = Math.max(h, 11.4);
    } else {
      const u1 = 1.0 - (d1 - flatR1) / (1.0 - flatR1);
      h = Math.max(h, cosineStep01(u1) * 11.4);
    }
  }

  if (x >= -408 && x <= -215) {
    const tBridge = (x - -408) / (-215 - -408);
    const bridgeZ = THREE.MathUtils.lerp(268, 296, tBridge);
    const distZ = Math.abs(z - bridgeZ);
    if (distZ < 12.0) {
      const latW = cosineStep01(1.0 - distZ / 12.0);
      const saddleProfile =
        THREE.MathUtils.lerp(11.1, 13.8, smoothstep01(tBridge)) - Math.sin(Math.PI * tBridge) * 2.8;
      h = Math.max(h, saddleProfile * latW);
    }
  }

  if (x >= -205 && x <= -112 && Math.abs(z - 296) < 10.5) {
    const tRamp = smoothstep01((-114 - x) / (-114 - -200));
    const latW = Math.abs(z - 296) <= 5.0 ? 1.0 : cosineStep01(1.0 - (Math.abs(z - 296) - 5.0) / 5.5);
    h = Math.max(h, 14.0 * tRamp * latW);
  }

  if (z >= 230 && z <= 284 && Math.abs(x - -215) < 9.5) {
    const tStair = smoothstep01((z - 232) / (282 - 232));
    const latW = Math.abs(x - -215) <= 4.8 ? 1.0 : cosineStep01(1.0 - (Math.abs(x - -215) - 4.8) / 4.7);
    h = Math.max(h, 14.0 * tStair * latW);
  }

  for (const [gx, gz] of [
    [-355, 212],
    [-355, 324],
    [-135, 212]
  ]) {
    const dg = Math.hypot(x - gx, z - gz);
    if (dg < 19.0) {
      h *= smoothstep01((dg - 12.0) / 7.0);
    }
  }

  return h;
}

/**
 * 1.5 Elevação Industrial Leste (`X = 640..1380, Z = -670..-60` até **`+7.5m`**)
 */
export function getEastIndustrialElevationY(x, z) {
  if (x <= 625 || x >= 1420 || z <= -710 || z >= -45) return 0;

  const envX =
    x < 720
      ? cosineStep01((x - 625) / 95)
      : x > 1280
        ? cosineStep01((1420 - x) / 140)
        : 1.0;
  const envZ =
    z < -580
      ? cosineStep01((z - -710) / 130)
      : z > -165
        ? cosineStep01((-45 - z) / 120)
        : 1.0;

  const ridge = 6.2 + 1.3 * Math.sin((x - 700) * 0.006) * Math.cos((z + 380) * 0.008);
  return Math.min(7.5, Math.max(0, ridge * envX * envZ));
}

/**
 * 1.6 Elevação Costeira & Dunas do Pontal Oeste da Praia (`X = -1350..-760, Z = 780..1010` até **`+8.5m`**)
 */
export function getSouthwestBeachReliefY(x, z) {
  if (x < -1352 || x > -758 || z < 780 || z > 1012) return 0;

  const envX =
    x < -1310
      ? smoothstep01((x - -1352) / 42.0)
      : x > -800
        ? smoothstep01((-758 - x) / 42.0)
        : 1.0;
  const envZ =
    z < 812
      ? smoothstep01((z - 780) / 32.0)
      : z > 980
        ? smoothstep01((1012 - z) / 32.0)
        : 1.0;
  const env = envX * envZ;
  if (env <= 0.001) return 0;

  const duneWave =
    3.1 +
    1.45 * Math.sin((x + 1120) * 0.017) * Math.cos((z - 890) * 0.024) +
    0.95 * Math.cos((x + 920) * 0.029 + (z - 850) * 0.019);

  const rock1 = Math.exp(-(Math.pow((x - -965) / 68, 2) + Math.pow((z - 928) / 44, 2))) * 4.4;
  const rock2 = Math.exp(-(Math.pow((x - -1215) / 74, 2) + Math.pow((z - 898) / 46, 2))) * 3.9;

  return Math.min(8.5, Math.max(0, (duneWave + rock1 + rock2) * env));
}

/**
 * Combina toda a topografia urbana da metrópole preservando estritamente os pisos internos abertos em `Y = 0m`!
 */
export function getUrbanCityReliefY(x, z) {
  // Pista e Terminal do Aeroporto Oeste permanecem 100% nivelados
  if (x <= -1025 && z <= 760) return 0;

  let h = Math.max(
    getNorthSuburbPlateauY(x, z),
    getNorthwestDowntownHillY(x, z),
    getEastDowntownBelaVistaHillY(x, z),
    getSouthCoastalRidgeY(x, z),
    getCentralParkWestHillsY(x, z),
    getEastIndustrialElevationY(x, z),
    getSouthwestBeachReliefY(x, z)
  );
  if (h <= 0.001) return 0;

  // Máscaras enxutas preservando apenas Super Banco + Escadas/Portais do Metrô, Torre dos Heróis, LEGO Customs e Lago!
  h *= rectFlatKeepoutFactor(x, z, -96, 96, -212, 26, 22);
  h *= rectFlatKeepoutFactor(x, z, -372, -264, -234, -126, 22);
  h *= rectFlatKeepoutFactor(x, z, 20, 100, -486, -410, 22);
  h *= rectFlatKeepoutFactor(x, z, -44, 344, 180, 354, 22);

  return h > 0.005 ? h : 0;
}
