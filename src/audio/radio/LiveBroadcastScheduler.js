/**
 * Relógio Global Determinístico de Transmissão Ao Vivo estilo GTA 6 (`LiveBroadcastScheduler`).
 *
 * Todas as rádios avançam simultaneamente no tempo real:
 * - Você NÃO pula músicas manualmente; você sintoniza estações.
 * - Cada estação embaralha suas faixas de forma determinística por ciclo (`seed = hash(stationId, cycleIndex)`),
 *   garantindo ordem aleatória contínua sem repetir a última música do ciclo anterior na virada.
 * - Se você sair de uma rádio em 0:45, passar 40s ouvindo outra e voltar, ela estará em 1:25 (ou na próxima faixa).
 */

function hashString32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDeterministicStationOrder(stationId, trackIds, cycleIndex) {
  if (!Array.isArray(trackIds) || trackIds.length <= 1) {
    return Array.isArray(trackIds) ? [...trackIds] : [];
  }

  const shuffleForCycle = (cIdx) => {
    const arr = [...trackIds];
    const rand = mulberry32(hashString32(`${stationId}::cycle::${cIdx}`));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  };

  const currentOrder = shuffleForCycle(cycleIndex);
  if (trackIds.length >= 2 && cycleIndex > 0) {
    const prevOrder = shuffleForCycle(cycleIndex - 1);
    const prevLast = prevOrder[prevOrder.length - 1];
    if (currentOrder[0] === prevLast) {
      const swapIdx = 1 + (hashString32(`${stationId}::anti_repeat::${cycleIndex}`) % (currentOrder.length - 1));
      const tmp = currentOrder[0];
      currentOrder[0] = currentOrder[swapIdx];
      currentOrder[swapIdx] = tmp;
    }
  }
  return currentOrder;
}

export class LiveBroadcastClock {
  constructor() {
    this._manualOffsetSec = 0;
  }

  getNowSec() {
    return Date.now() / 1000 + this._manualOffsetSec;
  }

  advanceClockForTest(seconds) {
    this._manualOffsetSec += Number(seconds) || 0;
  }

  resetOffset() {
    this._manualOffsetSec = 0;
  }

  /**
   * Calcula exatamente qual música e em qual segundo (`offsetSec`) uma estação está transmitindo AGORA.
   */
  sampleStationNow(station, tracksMap, customNowSec = null) {
    if (!station || !Array.isArray(station.trackIds) || station.trackIds.length === 0) {
      return null;
    }

    const validIds = station.trackIds.filter((id) => tracksMap.has(id));
    if (validIds.length === 0) return null;

    let cycleDurationSec = 0;
    for (const id of validIds) {
      const tr = tracksMap.get(id);
      cycleDurationSec += Math.max(8, Number(tr?.durationSec) || 120);
    }
    if (cycleDurationSec <= 0) return null;

    const nowSec = Math.max(0, customNowSec !== null ? customNowSec : this.getNowSec());
    const cycleIndex = Math.floor(nowSec / cycleDurationSec);
    const posInCycle = nowSec - cycleIndex * cycleDurationSec;

    const orderedIds = getDeterministicStationOrder(station.id, validIds, cycleIndex);
    let accum = 0;
    for (let i = 0; i < orderedIds.length; i++) {
      const tr = tracksMap.get(orderedIds[i]);
      const dur = Math.max(8, Number(tr?.durationSec) || 120);
      if (posInCycle < accum + dur || i === orderedIds.length - 1) {
        const offsetSec = Math.max(0, Math.min(dur - 0.05, posInCycle - accum));
        const nextId =
          i + 1 < orderedIds.length
            ? orderedIds[i + 1]
            : getDeterministicStationOrder(station.id, validIds, cycleIndex + 1)[0];
        return {
          stationId: station.id,
          track: tr,
          trackId: tr.id,
          offsetSec,
          durationSec: dur,
          ratio: dur > 0 ? offsetSec / dur : 0,
          remainingSec: Math.max(0, dur - offsetSec),
          nextTrack: tracksMap.get(nextId) || null,
          cycleIndex
        };
      }
      accum += dur;
    }
    return null;
  }
}
