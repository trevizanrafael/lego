// Placas, catracas, máquinas de bilhete e totens [E] das estações.
import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick } from '../../materials/LegoMaterials.js';
import { createSignBoardMesh, createCustomCanvasSignTexture, fitAndDrawText } from '../../utils/SignBoardHelper.js';
import { METRO_STATIONS } from './MetroRouteData.js';

export function addMetroSignBoard(world, x, y, z, w, h, title, subText = '', rotY = 0, bg = '#0f172a', doubleSided = false) {
  const mesh = createSignBoardMesh({
    x,
    y,
    z,
    width: w,
    height: h,
    depth: 0.34,
    rotY,
    title,
    subText,
    bgColor: bg,
    borderColor: '#38bdf8',
    topStripeColor: '#0284c7',
    bottomStripeColor: '#facc15',
    textColor: '#ffffff',
    subColor: '#38bdf8',
    doubleSided
  });
  world.scene.add(mesh);
}

// ============================================================================
// 4. CATRACAS E MÁQUINAS DE BILHETES QUEBRÁVEIS (DROPAM STUDS LEGO!) + TOTEM [E]
// ============================================================================
export function spawnBreakableMetroTurnstile(world, x, yBase, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.rotation.y = rotY;

  const post = createLegoBrick(0.55, 1.15, 1.35, LEGO_COLORS.silver, { metalness: 0.6, roughness: 0.2 });
  post.position.y = 0.58;
  const reader = createLegoBrick(0.58, 0.18, 0.45, 0x0284c7, { studs: false });
  reader.position.set(0, 1.2, 0.35);
  const arm = createLegoBrick(0.95, 0.14, 0.14, LEGO_COLORS.yellow, { studs: false });
  arm.position.set(0.52, 0.85, 0.15);

  group.add(post, reader, arm);
  group.userData.metroProp = 'turnstile';
  world.scene.add(group);

  const col = world.addCollider(x, z, 1.2, 1.2, yBase + 1.25, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: group,
      type: 'crate',
      hp: 16,
      radius: 0.9,
      height: 1.25,
      colliders: [col],
      debrisColors: [LEGO_COLORS.silver, 0x0284c7, LEGO_COLORS.yellow],
      studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
      groundY: yBase
    });
  }
}

export function spawnBreakableTicketMachine(world, x, yBase, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.rotation.y = rotY;

  const body = createLegoBrick(1.45, 2.25, 0.88, 0x0284c7, { studStep: 0.6 });
  body.position.y = 1.12;
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.72, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  screen.position.set(0, 1.48, 0.46);
  const header = createLegoBrick(1.52, 0.28, 0.94, LEGO_COLORS.yellow);
  header.position.y = 2.38;

  group.add(body, screen, header);
  group.userData.metroProp = 'ticket_machine';
  world.scene.add(group);

  const col = world.addCollider(x, z, 1.45, 0.92, yBase + 2.5, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: group,
      type: 'newsstand',
      hp: 22,
      radius: 1.15,
      height: 2.4,
      colliders: [col],
      debrisColors: [0x0284c7, LEGO_COLORS.yellow, LEGO_COLORS.silver],
      studDrops: { silver: 5, gold: 5, blue: 2, purple: 0 },
      groundY: yBase
    });
  }
}

export function buildInteractiveMetroMapTotem(world, stationIndex) {
  const st = METRO_STATIONS[stationIndex];
  const nextSt = METRO_STATIONS[(stationIndex + 1) % METRO_STATIONS.length];

  // Posiciona os totens bem recuados da beira do trilho!
  let tx = st.platformSpawn.x;
  const ty = st.platformSpawn.y;
  let tz = st.platformSpawn.z;
  if (st.number === 1) {
    tx = 10.5;
    tz = -93.8;
  } else if (st.number === 2) {
    tx = -69.5;
    tz = 26.5;
  } else {
    const outerSide = st.number === 5 ? -1 : 1;
    tx = st.platformSpawn.x + outerSide * 4.2;
    tz = st.platformSpawn.z - 16.0;
  }

  const totemGroup = new THREE.Group();
  totemGroup.position.set(tx, ty, tz);

  const base = createLegoBrick(1.75, 0.36, 1.15, LEGO_COLORS.charcoal);
  base.position.y = 0.18;
  const frame = createLegoBrick(1.62, 2.65, 0.44, 0x0f172a, { studs: false });
  frame.position.y = 1.62;
  const crown = createLegoBrick(1.8, 0.34, 0.58, LEGO_COLORS.yellow);
  crown.position.y = 3.05;

  const screenW = 1.42;
  const screenH = 2.24;
  const mapTex = createCustomCanvasSignTexture(
    screenW,
    screenH,
    (ctx, W, H) => {
      ctx.fillStyle = '#090a0d';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, W - 16, H - 16);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(12, 12, W - 24, Math.round(H * 0.14));

      const maxTextW = W * 0.82;
      fitAndDrawText(ctx, 'MAPA DO METRÔ', W * 0.5, H * 0.085, maxTextW, 30, {
        color: '#ffffff'
      });

      const cx = W * 0.5;
      const cy = H * 0.47;
      const r = Math.min(W, H) * 0.25;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r;
        ctx.fillStyle = i === stationIndex ? '#facc15' : '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, i === stationIndex ? 12 : 8, 0, Math.PI * 2);
        ctx.fill();
      }

      fitAndDrawText(ctx, '[E] PRÓX. ESTAÇÃO', W * 0.5, H * 0.82, maxTextW, 24, {
        color: '#facc15'
      });
      fitAndDrawText(ctx, nextSt.shortName, W * 0.5, H * 0.91, maxTextW, 20, {
        color: '#e2e8f0',
        fontFamily: '"JetBrains Mono", monospace'
      });
    },
    { canvasHeight: 420 }
  );

  const mapMat = new THREE.MeshBasicMaterial({ map: mapTex });
  const screenF = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), mapMat);
  screenF.position.set(0, 1.65, 0.24);
  const screenB = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), mapMat);
  screenB.rotation.y = Math.PI;
  screenB.position.set(0, 1.65, -0.24);

  totemGroup.add(base, frame, crown, screenF, screenB);
  world.scene.add(totemGroup);
  world.addCollider(tx, tz, 1.65, 1.05, ty + 3.1, ty);

  return {
    id: `totem_${st.id}`,
    stationIndex,
    stationName: st.name,
    nextStationIndex: (stationIndex + 1) % METRO_STATIONS.length,
    nextStationName: nextSt.name,
    nextSpawn: { ...nextSt.platformSpawn },
    position: new THREE.Vector3(tx, ty, tz)
  };
}
