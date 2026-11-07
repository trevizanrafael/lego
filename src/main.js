import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Minifigure } from './entities/Minifigure.js';
import { TestBlockWorld } from './world/TestBlockWorld.js';
import { ThirdPersonController } from './controls/ThirdPersonController.js';

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

    // Environment Map procedural para dar reflexo realista de plástico ABS brilhante nas peças LEGO
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
    // 1. Constrói o quarteirão inicial de teste (asfalto, calçadas com studs, prédios e carros LEGO)
    this.world = new TestBlockWorld(this.scene);

    // 2. Cria a Minifigura LEGO 3D Articulada
    this.playerMinifig = new Minifigure('caveira');
    this.scene.add(this.playerMinifig.root);

    // 3. Controlador em 3ª pessoa (Mouse 360° + WASD + Shift + Espaço)
    this.controller = new ThirdPersonController(
      this.camera,
      this.renderer.domElement,
      this.playerMinifig,
      this.world
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
    const dt = Math.min(rawDt, 0.05); // Evita saltos grandes ao trocar de aba

    this.controller.update(dt);
    this.world.update(dt);
    this.renderer.render(this.scene, this.camera);

    // Atualiza contador de FPS e estado da animação na barra superior
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

