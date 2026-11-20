/**
 * SUPER BANCO CENTRAL — TORRE ABERTA DE 4 ANDARES (`SuperBankBuilder.js`)
 * =============================================================================
 * Fachada fina de orquestração do Super Banco Central (X: -74..+74, Z: -229..-136),
 * único edifício com 4 pavimentos abertos sem loading, rampas dirigíveis e elevador [E].
 *
 * Submódulos (`src/world/regions/downtown/`):
 *   - `SuperBankExteriorAndLobby.js` — `BANK_SPEC`, batcher PBR, fachada clássica
 *     monumental, portas duplas, saguão térreo de mármore, pilastras destrutíveis e balcões.
 *   - `SuperBankUpperFloorsAndVault.js` — Lajes, rampas, elevador [E], 2º/3º/4º andares,
 *     sistema de segurança, Porta Circular Gigante do Cofre com ouro/studs e terraço.
 */

import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import {
  BANK_SPEC, createBankBatcher, buildExteriorShell, buildGroundLobby
} from './downtown/SuperBankExteriorAndLobby.js';
import {
  buildFloorsRampsAndElevator, buildOfficeFloor, buildSecurityFloor,
  buildVaultFloor, buildRooftop, buildRampGates, createBankElevator
} from './downtown/SuperBankUpperFloorsAndVault.js';

export { BANK_SPEC };

export function buildSuperBancoCentral(world) {
  const S = BANK_SPEC;
  const B = createBankBatcher();

  world._addCityBlockSidewalk(S.x, (S.frontZ + S.backZ) / 2 + 1, 152, 100, LEGO_COLORS.sidewalk);

  buildExteriorShell(world, B);
  buildFloorsRampsAndElevator(world, B);
  buildGroundLobby(world, B);
  buildOfficeFloor(world, B);
  buildSecurityFloor(world, B);
  const vault = buildVaultFloor(world, B);
  buildRooftop(world, B);

  B.flush(world.scene);

  const gates = buildRampGates(world);
  const elevator = createBankElevator(world);

  world.mapBuildings.push({
    x: S.x,
    z: (S.frontZ + S.backZ) / 2,
    w: S.maxX - S.minX,
    d: S.frontZ - S.backZ,
    height: S.wallTopY + 6,
    styleKey: 'black_granite_gold',
    color: '#facc15',
    label: 'BANCO CENTRAL'
  });

  world.bankElevator = elevator;
  world.superBankData = {
    x: S.x,
    z: (S.frontZ + S.backZ) / 2,
    width: S.maxX - S.minX,
    depth: S.frontZ - S.backZ,
    floorsCount: 4,
    floors: [...S.floors],
    interiorHeight: S.roofY - S.floors[0],
    roofTopY: S.roofY,
    frontColumnsCount: 8,
    goldenStatuesCount: 2,
    hasSkylight: true,
    hasRooftopHelipad: true,
    rampsCount: S.ramps.length,
    hasElevator: true,
    vaultFloor: 3,
    vaultDoor: vault.vaultDoor,
    goldPile: { x: S.goldPile.x, y: S.floors[3], z: S.goldPile.z },
    gates,
    setGateOpen(idx, open) {
      const g = gates[idx];
      if (!g) return;
      g.open = open;
      g.collider.disabled = open;
    },
    setAllGates(open) {
      gates.forEach((_, i) => this.setGateOpen(i, open));
    },
    isInside(x, y, z) {
      return x > S.innerMinX && x < S.innerMaxX && z < S.innerFrontZ && z > S.innerBackZ && y < S.roofY - 0.5;
    },
    floorAt(y) {
      let idx = 0;
      for (let i = 0; i < S.floors.length; i++) if (y >= S.floors[i] - 1.5) idx = i;
      return idx;
    },
    update(dt) {
      for (const g of gates) {
        const target = g.open ? g.floorY - 4.2 : g.floorY + 2.2;
        g.mesh.position.y += (target - g.mesh.position.y) * Math.min(1, dt * 4);
        g.mesh.visible = g.mesh.position.y > g.floorY - 4.0;
      }
      elevator.update(dt);
    }
  };
}
