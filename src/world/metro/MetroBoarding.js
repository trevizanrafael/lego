// Interação do jogador com os vagões do Metrô LEGO.
// Funções puras que recebem a lista de trens do `MetroSystemRuntime`.
//
// Regras (Etapa 1 do remodel):
//   - O vagão é um bloco SÓLIDO por fora: ninguém anda dentro dele.
//   - Embarque SENTADO: com o trem parado e as portas abertas, [E] perto da porta senta o herói.
//     A posição do herói passa a ser calculada a partir do vagão (sem física) até o desembarque.
//   - Desembarque só com o trem parado numa estação: o herói sai pela porta aberta, na plataforma.
//   - O TETO continua andável, mas só quando o trem está bem acima do chão local do jogador
//     (evita "grudar" quem está na rua quando o trem passa nas rampas dos portais).
import * as THREE from 'three';

// Vãos de porta ao longo do vagão (lz) e bancos encostados nas janelas (lz dos 3 pilares de parede).
export const METRO_DOOR_LZ = [-2.85, 2.85];
export const METRO_DOOR_HALF_WIDTH = 1.32;
export const METRO_SEAT_LZ = [-5.525, 0.0, 5.525];
const SEAT_LX = 1.82;            // Centro do banco (encostado na janela)
const SEAT_HEIGHT = 0.3;         // Altura do herói sentado acima do piso do vagão
const BOARD_REACH = 3.2;         // Distância máxima da parede do vagão para embarcar
const DOOR_OPEN_MIN = 0.55;      // Abertura mínima da porta para embarcar/desembarcar
const ROOF_MIN_ABOVE_GROUND = 1.6; // Teto só vira apoio se estiver pelo menos isso acima do chão local
const CAMERA_WALL_MARGIN = 0.45;

export function worldToCarLocal(car, wx, wz) {
  const dx = wx - car.pos.x;
  const dz = wz - car.pos.z;
  const cos = Math.cos(-car.rotY);
  const sin = Math.sin(-car.rotY);
  return {
    lx: dx * cos + dz * sin,
    lz: -dx * sin + dz * cos
  };
}

export function carLocalToWorld(car, lx, lz) {
  const cos = Math.cos(car.rotY);
  const sin = Math.sin(car.rotY);
  return {
    wx: car.pos.x + lx * cos + lz * sin,
    wz: car.pos.z - lx * sin + lz * cos
  };
}

/** Lado da porta em coordenada local do vagão: 'left' = +lx, 'right' = -lx. */
function sideSign(doorSide) {
  return doorSide === 'right' ? -1 : 1;
}

function isSideOpen(car, sign) {
  return (sign > 0 ? car.leftOpenRatio : car.rightOpenRatio) >= DOOR_OPEN_MIN;
}

function slopeOffsetY(car, lz) {
  return lz * Math.sin(-car.rotX);
}

/**
 * Teto do vagão como apoio para o jogador.
 * `groundY` (opcional) é o chão local já calculado: se o teto não estiver bem acima dele, o vagão é ignorado.
 */
export function findSupportingCarAt(trains, x, z, currentY, groundY = -Infinity) {
  let best = null;
  for (const train of trains) {
    for (const car of train.cars) {
      if (Math.abs(x - car.pos.x) > 10.5 || Math.abs(z - car.pos.z) > 10.5) continue;
      const { lx, lz } = worldToCarLocal(car, x, z);
      if (Math.abs(lx) > car.halfW + 0.15 || Math.abs(lz) > car.halfL + 0.15) continue;

      const roofY = car.pos.y + car.roofOffsetY + slopeOffsetY(car, lz);
      if (roofY < groundY + ROOF_MIN_ABOVE_GROUND) continue;
      if (currentY >= roofY - 0.9 && currentY <= roofY + 2.5) {
        if (!best || roofY > best.supportY) {
          best = { car, train, supportY: roofY, zone: 'roof' };
        }
      }
    }
  }
  return best;
}

/** Empurra o jogador para fora do volume do vagão (bloco sólido, portas abertas ou não). */
export function resolveHorizontalCarCollision(trains, pos, playerRadius = 0.45) {
  for (const train of trains) {
    for (const car of train.cars) {
      if (Math.abs(pos.x - car.pos.x) > 11.0 || Math.abs(pos.z - car.pos.z) > 11.0) continue;
      let { lx, lz } = worldToCarLocal(car, pos.x, pos.z);
      const bottomY = car.pos.y + 0.2 + slopeOffsetY(car, lz);
      const topY = car.pos.y + car.roofOffsetY - 0.25 + slopeOffsetY(car, lz);
      if (pos.y >= topY || pos.y + 1.8 <= bottomY) continue;

      const extX = car.halfW + playerRadius;
      const extZ = car.halfL + playerRadius;
      if (Math.abs(lx) >= extX || Math.abs(lz) >= extZ) continue;

      const penX = extX - Math.abs(lx);
      const penZ = extZ - Math.abs(lz);
      if (penX < penZ) {
        lx = (lx >= 0 ? 1 : -1) * extX;
      } else {
        lz = (lz >= 0 ? 1 : -1) * extZ;
      }
      const w = carLocalToWorld(car, lx, lz);
      pos.x = w.wx;
      pos.z = w.wz;
    }
  }
}

/**
 * Procura um vagão parado, com portas abertas do lado do jogador, ao alcance do [E].
 * Retorna o estado de viagem `{ type: 'metro', train, car, seatLz, seatSide }` ou null.
 */
export function findBoardableCar(trains, pos) {
  let best = null;
  let bestDist = Infinity;
  for (const train of trains) {
    if (train.state !== 'STOPPED') continue;
    for (const car of train.cars) {
      if (Math.abs(pos.x - car.pos.x) > 12 || Math.abs(pos.z - car.pos.z) > 12) continue;
      const { lx, lz } = worldToCarLocal(car, pos.x, pos.z);
      const sign = lx >= 0 ? 1 : -1;
      if (!isSideOpen(car, sign)) continue;
      const wallDist = Math.abs(lx) - car.halfW;
      if (wallDist < -0.3 || wallDist > BOARD_REACH) continue;
      if (Math.abs(lz) > car.halfL + 0.5) continue;
      const floorY = car.pos.y + car.floorOffsetY + slopeOffsetY(car, lz);
      if (Math.abs(pos.y - floorY) > 1.6) continue;

      const doorDist = Math.min(...METRO_DOOR_LZ.map((d) => Math.abs(lz - d)));
      const score = doorDist + Math.max(0, wallDist);
      if (score < bestDist) {
        bestDist = score;
        let seatLz = METRO_SEAT_LZ[0];
        for (const s of METRO_SEAT_LZ) {
          if (Math.abs(s - lz) < Math.abs(seatLz - lz)) seatLz = s;
        }
        best = { type: 'metro', train, car, seatLz, seatSide: sign };
      }
    }
  }
  return best;
}

const _seatPos = new THREE.Vector3();

/**
 * Posição/rotação do herói sentado no banco do vagão (mesmo formato de `getRideSeatTransform`
 * das atrações), mais `clampCamera(vec3)` que mantém a câmera dentro do vagão
 * (evita a câmera atravessar paredes do túnel).
 */
export function getMetroSeatTransform(ride) {
  if (!ride?.car) return null;
  const car = ride.car;
  const lx = ride.seatSide * SEAT_LX;
  const lz = ride.seatLz;
  const w = carLocalToWorld(car, lx, lz);
  const y = car.pos.y + car.floorOffsetY + SEAT_HEIGHT + slopeOffsetY(car, lz);
  _seatPos.set(w.wx, y, w.wz);
  // Sentado de frente para o corredor (olhando para o lado oposto do banco).
  const yaw = car.rotY - ride.seatSide * Math.PI * 0.5;

  return {
    pos: _seatPos.clone(),
    quat: null,
    yaw,
    camDist: 4.2,
    camHeight: 2.0,
    clampCamera(cam) {
      let { lx: cx, lz: cz } = worldToCarLocal(car, cam.x, cam.z);
      const maxX = car.halfW - CAMERA_WALL_MARGIN;
      const maxZ = car.halfL - CAMERA_WALL_MARGIN;
      cx = THREE.MathUtils.clamp(cx, -maxX, maxX);
      cz = THREE.MathUtils.clamp(cz, -maxZ, maxZ);
      const cw = carLocalToWorld(car, cx, cz);
      const floorY = car.pos.y + car.floorOffsetY + slopeOffsetY(car, cz);
      const roofY = car.pos.y + car.roofOffsetY + slopeOffsetY(car, cz);
      cam.x = cw.wx;
      cam.z = cw.wz;
      cam.y = THREE.MathUtils.clamp(cam.y, floorY + 0.6, roofY - 0.9);
      return cam;
    }
  };
}

/**
 * Ponto de desembarque na plataforma (pela porta aberta mais próxima do banco),
 * ou null se o trem não estiver parado numa estação com as portas abertas.
 */
export function getMetroDisembarkPoint(ride) {
  const train = ride?.train;
  const car = ride?.car;
  if (!train || !car || train.state !== 'STOPPED' || !train.currentStation) return null;
  const sign = sideSign(train.currentStation.doorSide);
  if (!isSideOpen(car, sign)) return null;

  let doorLz = METRO_DOOR_LZ[0];
  for (const d of METRO_DOOR_LZ) {
    if (Math.abs(d - ride.seatLz) < Math.abs(doorLz - ride.seatLz)) doorLz = d;
  }
  const w = carLocalToWorld(car, sign * (car.halfW + 1.4), doorLz);
  return {
    pos: new THREE.Vector3(w.wx, train.currentStation.platformSpawn.y, w.wz),
    yaw: car.rotY + sign * Math.PI * 0.5,
    stationName: train.currentStation.name
  };
}
