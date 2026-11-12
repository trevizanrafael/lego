// Interação física do jogador com os vagões (piso/teto como apoio e colisão com paredes/portas).
// Funções puras que recebem a lista de trens do `MetroSystemRuntime`.

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

export function findSupportingCarAt(trains, x, z, currentY) {
  let best = null;
  for (const train of trains) {
    for (const car of train.cars) {
      if (Math.abs(x - car.pos.x) > 10.5 || Math.abs(z - car.pos.z) > 10.5) continue;
      const { lx, lz } = worldToCarLocal(car, x, z);
      if (Math.abs(lx) > car.halfW + 0.22 || Math.abs(lz) > car.halfL + 0.22) continue;

      const roofY = car.pos.y + car.roofOffsetY + (lz / car.halfL) * Math.sin(-car.rotX) * car.halfL;
      const floorY = car.pos.y + car.floorOffsetY + (lz / car.halfL) * Math.sin(-car.rotX) * car.halfL;

      if (currentY >= roofY - 1.15 && currentY <= roofY + 3.0) {
        if (!best || roofY > best.supportY) {
          best = { car, supportY: roofY, zone: 'roof' };
        }
      } else if (
        Math.abs(lx) <= car.halfW - 0.04 &&
        Math.abs(lz) <= car.halfL - 0.08 &&
        currentY >= floorY - 0.9 &&
        currentY < roofY - 1.15
      ) {
        if (!best || floorY > best.supportY) {
          best = { car, supportY: floorY, zone: 'interior' };
        }
      }
    }
  }
  return best;
}

export function resolveHorizontalCarCollision(trains, pos, playerRadius = 0.45) {
  for (const train of trains) {
    for (const car of train.cars) {
      if (Math.abs(pos.x - car.pos.x) > 11.0 || Math.abs(pos.z - car.pos.z) > 11.0) continue;
      const bottomY = car.pos.y + 0.2;
      const topY = car.pos.y + car.roofOffsetY - 0.25;
      if (pos.y >= topY || pos.y + 1.8 <= bottomY) continue;

      let { lx, lz } = worldToCarLocal(car, pos.x, pos.z);
      const prevLocal = worldToCarLocal(car, pos.x - car.deltaPos.x, pos.z - car.deltaPos.z);
      const wasInside =
        Math.abs(prevLocal.lx) < car.halfW - 0.08 && Math.abs(prevLocal.lz) < car.halfL - 0.08;

      // Vãos largos de 2.80m em lz = ±2.85m!
      const inDoorwayZ = Math.abs(lz - 2.85) < 1.32 || Math.abs(lz + 2.85) < 1.32;
      const leftOpen = car.leftOpenRatio > 0.55 && inDoorwayZ;
      const rightOpen = car.rightOpenRatio > 0.55 && inDoorwayZ;

      if (wasInside) {
        const maxInZ = car.halfL - playerRadius * 0.65;
        if (Math.abs(lz) > maxInZ) lz = Math.sign(lz) * maxInZ;

        const maxInX = car.halfW - playerRadius * 0.65;
        if (lx > maxInX && !leftOpen) lx = maxInX;
        if (lx < -maxInX && !rightOpen) lx = -maxInX;

        const w = carLocalToWorld(car, lx, lz);
        pos.x = w.wx;
        pos.z = w.wz;
      } else {
        const extX = car.halfW + playerRadius;
        const extZ = car.halfL + playerRadius;
        if (Math.abs(lx) < extX && Math.abs(lz) < extZ) {
          if ((lx > 0 && leftOpen) || (lx < 0 && rightOpen)) {
            continue;
          }
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
  }
}
