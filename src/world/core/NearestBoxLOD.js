import * as THREE from 'three';

const _camPos = new THREE.Vector3();

/**
 * LOD que mede a distância da câmera até o PONTO MAIS PRÓXIMO da caixa do nível 0,
 * e não até o centro do objeto (comportamento do `THREE.LOD`).
 *
 * Etapa 2.1: os lotes estáticos têm chunks de 740–2150 m, mas trocavam de nível a
 * 210/535/740 m do CENTRO. Quem estava colado num prédio na borda do chunk via a versão
 * grosseira (sem janelas/colunas, preta ou branca lisa). Medindo até a caixa, tudo que
 * está perto do jogador fica no detalhe máximo e só chunks realmente distantes simplificam.
 */
export class NearestBoxLOD extends THREE.LOD {
  constructor() {
    super();
    this.isNearestBoxLOD = true;
    this.worldBox = new THREE.Box3();
    this._boxReady = false;
  }

  /** Recalcula a caixa a partir do nível 0 (chamar depois de posicionar/adicionar à cena). */
  refreshWorldBox() {
    const level0 = this.levels[0]?.object;
    this.updateMatrixWorld(true);
    this.worldBox.makeEmpty();
    if (level0) {
      const prev = level0.visible;
      level0.visible = true;
      this.worldBox.setFromObject(level0, false);
      level0.visible = prev;
    }
    this._boxReady = !this.worldBox.isEmpty();
    return this.worldBox;
  }

  /** Distância da câmera (posição de mundo) até a caixa do nível 0. */
  distanceToCamera(camera) {
    if (!this._boxReady) this.refreshWorldBox();
    _camPos.setFromMatrixPosition(camera.matrixWorld);
    return this._boxReady ? this.worldBox.distanceToPoint(_camPos) / (camera.zoom || 1) : 0;
  }

  update(camera) {
    const levels = this.levels;
    if (levels.length <= 1) return;
    const distance = this.distanceToCamera(camera);
    levels[0].object.visible = true;
    let i;
    const l = levels.length;
    for (i = 1; i < l; i++) {
      let levelDistance = levels[i].distance;
      if (levels[i].object.visible) levelDistance -= levelDistance * levels[i].hysteresis;
      if (distance >= levelDistance) {
        levels[i - 1].object.visible = false;
        levels[i].object.visible = true;
      } else {
        break;
      }
    }
    this._currentLevel = i - 1;
    for (; i < l; i++) levels[i].object.visible = false;
  }
}
