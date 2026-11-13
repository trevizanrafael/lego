import * as THREE from 'three';
import { getLegoMaterial, getSharedNpcFaceMaterial, SHARED_STUD_GEO } from '../../materials/LegoMaterials.js';

// ============================================================================
// PRESOS DO JOGADOR NA ILHA DA PRISÃO
// Bandidos derrotados nos grandes eventos aparecem em fila no Pátio de Banho de
// Sol (quadra de futsal), de uniforme laranja com a bandana/cor da facção.
// ============================================================================

const YARD = { x0: 1212, z0: 1344, cols: 10, spacingX: 4.6, spacingZ: 5.2, y: 0.42 };
export const PRISON_ROSTER_MAX_VISIBLE = 40;

const FACTION_BAND = { cv: 0xdc2626, pcc: 0x1d4ed8, ares: 0xd946ef };

let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const head = new THREE.CylinderGeometry(0.27, 0.27, 0.5, 16);
  head.rotateY(Math.PI);
  SHARED = {
    torso: new THREE.BoxGeometry(0.86, 0.76, 0.44),
    leg: new THREE.BoxGeometry(0.34, 0.66, 0.4),
    arm: new THREE.CylinderGeometry(0.11, 0.11, 0.6, 8),
    head,
    band: new THREE.CylinderGeometry(0.285, 0.285, 0.12, 16),
    orange: getLegoMaterial(0xf97316),
    skin: getLegoMaterial(0xfacc15),
    face: getSharedNpcFaceMaterial('civ_panic')
  };
  return SHARED;
}

function buildPrisoner(faction) {
  const s = shared();
  const g = new THREE.Group();
  g.userData.skipStaticMerge = true;
  const torso = new THREE.Mesh(s.torso, s.orange);
  torso.position.y = 1.16;
  const legL = new THREE.Mesh(s.leg, s.orange);
  legL.position.set(-0.2, 0.36, 0);
  const legR = new THREE.Mesh(s.leg, s.orange);
  legR.position.set(0.2, 0.36, 0);
  const armL = new THREE.Mesh(s.arm, s.orange);
  armL.position.set(-0.55, 1.18, 0.08);
  armL.rotation.x = -0.4;
  const armR = new THREE.Mesh(s.arm, s.orange);
  armR.position.set(0.55, 1.18, 0.08);
  armR.rotation.x = -0.4;
  const head = new THREE.Mesh(s.head, s.face);
  head.position.y = 1.84;
  const band = new THREE.Mesh(s.band, getLegoMaterial(FACTION_BAND[faction] || 0x111827));
  band.position.y = 2.02;
  const stud = new THREE.Mesh(SHARED_STUD_GEO, s.skin);
  stud.position.y = 2.09;
  g.add(torso, legL, legR, armL, armR, head, band, stud);
  return g;
}

export class PrisonRoster {
  constructor(scene) {
    this.scene = scene;
    this.counts = { cv: 0, pcc: 0, ares: 0 };
    this.meshes = [];
    this._clock = 0;
  }

  get total() {
    return this.counts.cv + this.counts.pcc + this.counts.ares;
  }

  addPrisoners(faction, count = 1) {
    if (!(faction in this.counts) || count <= 0) return;
    for (let i = 0; i < count; i++) {
      this.counts[faction]++;
      this._placeOne(faction);
    }
  }

  _placeOne(faction) {
    if (!this.scene || this.meshes.length >= PRISON_ROSTER_MAX_VISIBLE) return;
    const idx = this.meshes.length;
    const col = idx % YARD.cols;
    const row = Math.floor(idx / YARD.cols);
    const m = buildPrisoner(faction);
    m.position.set(YARD.x0 + col * YARD.spacingX, YARD.y, YARD.z0 + row * YARD.spacingZ);
    m.rotation.y = Math.PI; // virados para o lado do portão
    this.scene.add(m);
    this.meshes.push(m);
  }

  exportState() {
    return { ...this.counts };
  }

  importState(state) {
    if (!state || typeof state !== 'object') return;
    for (const m of this.meshes) m.parent?.remove(m);
    this.meshes = [];
    this.counts = { cv: 0, pcc: 0, ares: 0 };
    for (const f of ['cv', 'pcc', 'ares']) {
      const n = Math.max(0, Math.min(999, Number(state[f]) || 0));
      this.addPrisoners(f, n);
    }
  }
}
