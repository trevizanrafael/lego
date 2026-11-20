import * as THREE from 'three';

// ============================================================================
// 1. CATÁLOGO E ANIMAÇÃO PROCEDURAL DOS 4 EMOTES / DANÇAS DO JOGADOR [TECLA B]
// ============================================================================
export const HERO_EMOTES = [
  {
    id: 'passinho',
    name: 'PASSINHO DO BAILE',
    label: '🕺 PASSINHO DO BAILE'
  },
  {
    id: 'breakdance',
    name: 'MORTAL / BREAKDANCE LEGO',
    label: '🤸 MORTAL / BREAKDANCE LEGO'
  },
  {
    id: 'hero_pose',
    name: 'POSE SUPREMA DE HERÓI',
    label: '💪 POSE SUPREMA DE HERÓI'
  },
  {
    id: 'air_guitar',
    name: 'AIR GUITAR / COMEMORAÇÃO LEGO',
    label: '🎸 AIR GUITAR / COMEMORAÇÃO LEGO'
  }
];

const HERO_AURA_COLORS = {
  caveira: 0xfacc15,
  solaris: 0xf97316,
  tita: 0xef4444,
  vingador: 0xcbd5e1,
  sombra: 0xff1e42,
  turbo: 0x00f0ff,
  voltaico: 0x38bdf8,
  vortex: 0xa855f7,
  op09: 0x00f0ff
};

function ensureMinifigEmoteAura(minifig) {
  if (minifig._emoteAuraGroup) return minifig._emoteAuraGroup;

  const auraGroup = new THREE.Group();
  auraGroup.visible = false;

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide
  });
  const ringGeo = new THREE.RingGeometry(0.68, 1.05, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.06;
  auraGroup.add(ringMesh);

  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), ringMat);
    auraGroup.add(sp);
    sparks.push(sp);
  }

  minifig.root.add(auraGroup);
  minifig._emoteAuraGroup = auraGroup;
  minifig._emoteAuraMat = ringMat;
  minifig._emoteAuraRing = ringMesh;
  minifig._emoteAuraSparks = sparks;
  return auraGroup;
}

/**
 * Aplica a coreografia 3D em tempo real dos 4 Emotes [B] em qualquer Minifigura ou Big-Fig (Titã / Vórtex Monstro / OP-09)!
 */
export function applyEmoteAnimationToMinifigure(minifig, dt) {
  if (!minifig || !minifig.activeEmote) {
    if (minifig?._emoteAuraGroup) {
      minifig._emoteAuraGroup.visible = false;
    }
    return false;
  }

  minifig.emoteTimer = (minifig.emoteTimer || 0) + dt;
  const t = minifig.emoteTimer;
  const id = minifig.activeEmote;
  const auraGroup = ensureMinifigEmoteAura(minifig);

  const heroColor =
    minifig.currentHeroKey === 'op09' && minifig.preset?.torsoColor
      ? minifig.preset.torsoColor
      : (HERO_AURA_COLORS[minifig.currentHeroKey] ?? 0xfacc15);
  minifig._emoteAuraMat.color.setHex(heroColor);

  // Reseta base limpa dos pivôs antes de aplicar a pose do emote
  const headObj = minifig.headGroup || minifig.headPivot;
  minifig.visualRoot.position.set(0, 0, 0);
  minifig.visualRoot.rotation.set(0, 0, 0);
  minifig.upperBodyGroup.position.set(0, minifig._baseUpperY ?? 0.86, 0);
  minifig.upperBodyGroup.rotation.set(0, 0, 0);
  if (headObj) headObj.rotation.set(0, 0, 0);
  minifig.leftArmPivot.rotation.set(0, 0, 0);
  minifig.rightArmPivot.rotation.set(0, 0, 0);
  minifig.leftLegPivot.rotation.set(0, 0, 0);
  minifig.rightLegPivot.rotation.set(0, 0, 0);

  if (id === 'passinho') {
    // 1. PASSINHO DO BAILE: Jogo veloz de pernas alternadas + ginga de ombros + giro 360° a cada compasso!
    const beat = t * 11.5;
    const barPhase = (t % 2.4) / 2.4;
    const spin = barPhase > 0.72 ? ((barPhase - 0.72) / 0.28) * Math.PI * 2 : 0;

    minifig.visualRoot.position.y = Math.abs(Math.sin(beat)) * 0.16;
    minifig.visualRoot.rotation.y = spin;
    minifig.leftLegPivot.rotation.x = Math.sin(beat) * 0.72;
    minifig.rightLegPivot.rotation.x = -Math.sin(beat) * 0.72;
    minifig.leftLegPivot.rotation.z = Math.cos(beat * 0.5) * 0.16;
    minifig.rightLegPivot.rotation.z = Math.cos(beat * 0.5) * 0.16;

    minifig.upperBodyGroup.rotation.y = Math.sin(beat * 0.5) * 0.35;
    minifig.upperBodyGroup.rotation.z = Math.cos(beat) * 0.12;
    minifig.leftArmPivot.rotation.x = -1.15 + Math.sin(beat) * 0.55;
    minifig.rightArmPivot.rotation.x = -1.15 - Math.sin(beat) * 0.55;
    minifig.leftArmPivot.rotation.z = 0.35;
    minifig.rightArmPivot.rotation.z = -0.35;
    if (headObj) headObj.rotation.y = -Math.sin(beat * 0.5) * 0.28;
    auraGroup.visible = false;
  } else if (id === 'breakdance') {
    // 2. MORTAL / BREAKDANCE LEGO: Salto mortal acrobático seguido de moinho giratório e pose de aterrissagem!
    const cycle = t % 1.85;
    if (cycle < 0.75) {
      const u = cycle / 0.75;
      minifig.visualRoot.position.y = Math.sin(u * Math.PI) * 1.35;
      minifig.visualRoot.rotation.x = -u * Math.PI * 2;
      minifig.leftArmPivot.rotation.x = -2.4;
      minifig.rightArmPivot.rotation.x = -2.4;
      minifig.leftLegPivot.rotation.x = 0.55;
      minifig.rightLegPivot.rotation.x = -0.55;
    } else if (cycle < 1.35) {
      const u = (cycle - 0.75) / 0.6;
      minifig.visualRoot.position.y = 0.15;
      minifig.visualRoot.rotation.y = u * Math.PI * 4;
      minifig.upperBodyGroup.rotation.x = 0.65;
      minifig.leftArmPivot.rotation.z = 1.25;
      minifig.rightArmPivot.rotation.z = -1.25;
      minifig.leftLegPivot.rotation.z = 0.52;
      minifig.rightLegPivot.rotation.z = -0.52;
    } else {
      // Pose heroica cravada no chão
      minifig.visualRoot.position.y = -0.14;
      minifig.upperBodyGroup.rotation.x = 0.32;
      minifig.leftLegPivot.rotation.x = -0.85;
      minifig.rightLegPivot.rotation.x = 0.55;
      minifig.rightArmPivot.rotation.x = 0.35;
      minifig.leftArmPivot.rotation.x = -2.35;
      minifig.leftArmPivot.rotation.z = 0.35;
    }
    auraGroup.visible = false;
  } else if (id === 'hero_pose') {
    // 3. POSE SUPREMA DE HERÓI: Peito estufado, braços flexionados/cruzados e Aura 3D da cor do personagem!
    const pulse = Math.sin(t * 5.0);
    minifig.visualRoot.position.y = 0.05 + Math.abs(pulse) * 0.05;
    minifig.upperBodyGroup.rotation.x = -0.16;
    if (headObj) {
      headObj.rotation.x = -0.08 + pulse * 0.05;
      headObj.rotation.y = Math.sin(t * 2.2) * 0.22;
    }

    minifig.leftArmPivot.rotation.x = -1.48;
    minifig.rightArmPivot.rotation.x = -1.48;
    minifig.leftArmPivot.rotation.y = -0.62;
    minifig.rightArmPivot.rotation.y = 0.62;
    minifig.leftArmPivot.rotation.z = 0.25 + pulse * 0.06;
    minifig.rightArmPivot.rotation.z = -0.25 - pulse * 0.06;

    auraGroup.visible = true;
    const rScale = 1.0 + Math.sin(t * 7.0) * 0.18;
    minifig._emoteAuraRing.scale.set(rScale, rScale, 1);
    minifig._emoteAuraSparks.forEach((sp, idx) => {
      const ang = t * 3.5 + (idx / 6) * Math.PI * 2;
      const yUp = ((t * 1.8 + idx * 0.35) % 1.0) * 2.1;
      sp.position.set(Math.cos(ang) * 0.85, 0.2 + yUp, Math.sin(ang) * 0.85);
      sp.rotation.set(t * 5, t * 4, 0);
    });
  } else {
    // 4. AIR GUITAR / COMEMORAÇÃO LEGO: Pulinhos clássicos de vitória + palhetada rápida de guitarra invisível!
    const hop = Math.abs(Math.sin(t * 9.5));
    const strum = Math.sin(t * 24.0);
    minifig.visualRoot.position.y = hop * 0.36;
    minifig.upperBodyGroup.rotation.x = -0.18 + Math.sin(t * 9.5) * 0.14;
    minifig.upperBodyGroup.rotation.y = -0.35;
    if (headObj) headObj.rotation.x = Math.sin(t * 19.0) * 0.26;

    // Braço esquerdo segurando o braço da guitarra imaginária, braço direito palhetando!
    minifig.leftArmPivot.rotation.x = -1.35;
    minifig.leftArmPivot.rotation.z = 0.65;
    minifig.rightArmPivot.rotation.x = -1.05 + strum * 0.38;
    minifig.rightArmPivot.rotation.z = -0.28;

    minifig.leftLegPivot.rotation.x = -hop * 0.45;
    minifig.rightLegPivot.rotation.x = hop * 0.35;
    auraGroup.visible = false;
  }

  return true;
}

// ============================================================================
// 2. ANIMAÇÕES PROCEDURAIS DE DANÇA DOS NPCs E DO DJ (ZERO GC)
// ============================================================================
export function animateBaileDjRig(djRig, t) {
  if (!djRig) return;
  djRig.head.rotation.x = Math.sin(t * 13.6) * 0.25;
  djRig.head.rotation.y = Math.sin(t * 3.4) * 0.35;
  // Mão direita fazendo scratch no disco, mão esquerda levantando a galera!
  djRig.rightArm.rotation.x = -1.25 + Math.sin(t * 22.0) * 0.28;
  djRig.leftArm.rotation.x = -2.45 + Math.sin(t * 13.6) * 0.45;
}

export function computeBaileNpcDancePose(style, beat, halfBeat, dblBeat, hypeMult, out) {
  let hop = Math.abs(beat) * 0.22 * hypeMult;
  let sideStep = 0;
  let leanX = 0.05;
  let twistZ = beat * 0.08;
  let legPitchL = 0;
  let legPitchR = 0;
  let armPitchL = -1.6;
  let armPitchR = -1.6;
  let armRollL = 0.22;
  let armRollR = -0.22;

  if (style === 0) {
    hop = Math.abs(dblBeat) * 0.24 * hypeMult;
    sideStep = halfBeat * 0.26;
    legPitchL = Math.max(-0.65, Math.min(0.65, beat * 0.58));
    legPitchR = -legPitchL;
    armPitchL = -1.35 + beat * 0.55;
    armPitchR = -1.35 - beat * 0.55;
    leanX = 0.12;
  } else if (style === 1) {
    hop = Math.pow(Math.max(0, beat), 2) * 0.34 * hypeMult;
    armPitchL = -2.45 + dblBeat * 0.38;
    armPitchR = -2.45 + dblBeat * 0.38;
    armRollL = 0.32;
    armRollR = -0.32;
    legPitchL = Math.abs(beat) * 0.22;
    legPitchR = Math.abs(beat) * 0.22;
  } else if (style === 2) {
    sideStep = halfBeat * 0.42;
    hop = Math.abs(beat) * 0.16 * hypeMult;
    legPitchL = halfBeat * 0.36;
    legPitchR = -halfBeat * 0.36;
    armPitchL = -2.1 + beat * 0.35;
    armPitchR = -0.55 - beat * 0.25;
    twistZ = halfBeat * 0.14;
  } else if (style === 3) {
    hop = Math.abs(dblBeat) * 0.22 * hypeMult;
    leanX = 0.16;
    armPitchL = -2.05 + Math.abs(dblBeat) * 0.32;
    armPitchR = -2.05 + Math.abs(dblBeat) * 0.32;
    armRollL = -0.25 + Math.abs(dblBeat) * 0.24;
    armRollR = 0.25 - Math.abs(dblBeat) * 0.24;
  } else {
    hop = Math.abs(halfBeat) * 0.08 * hypeMult;
    armPitchL = -0.4 + halfBeat * 0.28;
    armPitchR = -0.9 - beat * 0.22;
    legPitchL = halfBeat * 0.14;
    legPitchR = -halfBeat * 0.14;
    twistZ = halfBeat * 0.06;
  }

  out.hop = hop;
  out.sideStep = sideStep;
  out.leanX = leanX;
  out.twistZ = twistZ;
  out.legPitchL = legPitchL;
  out.legPitchR = legPitchR;
  out.armPitchL = armPitchL;
  out.armPitchR = armPitchR;
  out.armRollL = armRollL;
  out.armRollR = armRollR;
  return out;
}
