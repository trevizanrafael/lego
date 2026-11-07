import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Minifigure } from './entities/Minifigure.js';
import { TestBlockWorld } from './world/TestBlockWorld.js';
import { DestructibleManager } from './world/DestructibleManager.js';
import { ThirdPersonController } from './controls/ThirdPersonController.js';
import { LegoHud } from './ui/LegoHud.js';

const STATE_LABELS = {
  IDLE: 'PARADO (RESPIRANDO)',
  WALK: 'ANDANDO',
  RUN: 'CORRENDO',
  JUMP: 'NO AR (PULANDO)',
  FALL: 'NO AR (CAINDO)'
};

class LegoCityGame {
  constructor() {
    this.container = document.getElementById('game-container');
    this.fpsEl = document.getElementById('fps-counter');
    this.stateEl = document.getElementById('anim-state');

    this._initRendererAndScene();
    this._initEntities();
    this._bindResize();

    this.lastTime = performance.now();
    this.fpsFrames = 0;
    this.fpsTimer = 0;
    this.lastDisplayedState = '';

    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initRendererAndScene() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      450
    );
  }

  _initEntities() {
    // 1. HUD Clássica Estilo LEGO (Retrato + 4 Corações + Contador de Studs + Barra True Hero)
    this.hud = new LegoHud(35000);

    // 2. Gerenciador de Destruição Física de Peças LEGO e Moedinhas (Studs)
    this.destructibles = new DestructibleManager(this.scene, this.hud);

    // 3. Constrói o quarteirão de teste registrando objetos quebráveis (Carros, Hidrantes, Postes, Bancas, Cercas e Caixas)
    this.world = new TestBlockWorld(this.scene, this.destructibles);

    // 4. Cria a Minifigura LEGO 3D Articulada
    this.playerMinifig = new Minifigure('caveira');
    this.scene.add(this.playerMinifig.root);

    // 5. Controlador em 3ª pessoa com suporte a Soco (Clique Esq / E) e Tiro (Clique Dir / F)
    this.controller = new ThirdPersonController(
      this.camera,
      this.renderer.domElement,
      this.playerMinifig,
      this.world,
      this.destructibles,
      this.hud
    );
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _animate(now) {
    requestAnimationFrame(this._animate);

    const rawDt = (now - this.lastTime) * 0.001;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.controller.update(dt);
    this.destructibles.update(dt, this.controller.position);
    this.hud.update(dt);
    this.world.update(dt);
    this.renderer.render(this.scene, this.camera);

    this.fpsFrames++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.4) {
      const fps = Math.round(this.fpsFrames / this.fpsTimer);
      if (this.fpsEl) this.fpsEl.textContent = `${fps} FPS`;
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    if (this.stateEl && this.playerMinifig.state !== this.lastDisplayedState) {
      this.lastDisplayedState = this.playerMinifig.state;
      this.stateEl.textContent = `ESTADO: ${STATE_LABELS[this.lastDisplayedState] || this.lastDisplayedState}`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new LegoCityGame();
});
