import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Minifigure } from './entities/Minifigure.js';
import { TestBlockWorld } from './world/TestBlockWorld.js';
import { DestructibleManager } from './world/DestructibleManager.js';
import { ThirdPersonController } from './controls/ThirdPersonController.js';
import { LegoHud } from './ui/LegoHud.js';

class LegoCityGame {
  constructor() {
    this.container = document.getElementById('game-container');

    this._initRendererAndScene();
    this._initEntities();
    this._bindResize();

    this.lastTime = performance.now();

    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initRendererAndScene() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
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
      0.25,
      2400
    );
  }

  _initEntities() {
    // 1. HUD Tática Limpa (Retrato + 4 Corações + Contador de Studs + Velocímetro Veicular + Minimapa)
    this.hud = new LegoHud();

    // 2. Gerenciador de Destruição Física de Peças LEGO e Moedinhas (Studs)
    this.destructibles = new DestructibleManager(this.scene, this.hud);

    // 3. Constrói a Grande Ilha Metropolitana (10 Regiões + Interior do Super Banco Central)
    this.world = new TestBlockWorld(this.scene, this.destructibles);

    // 4. Cria a Minifigura LEGO 3D Articulada
    this.playerMinifig = new Minifigure('caveira');
    this.scene.add(this.playerMinifig.root);

    // 5. Controlador em 3ª pessoa com suporte a Soco, Tiro, Granada Jump, Voo e Mapa Completo [M]
    this.controller = new ThirdPersonController(
      this.camera,
      this.renderer.domElement,
      this.playerMinifig,
      this.world,
      this.destructibles,
      this.hud
    );
    this.hud._lastController = this.controller;

    this.controller.onToggleFullMap = () => {
      this.hud.toggleFullMap(this.world, this.controller);
    };

    const minimapEl = document.getElementById('minimap-container');
    if (minimapEl) {
      minimapEl.addEventListener('click', () => {
        this.hud.toggleFullMap(this.world, this.controller);
      });
    }
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
    const baseDt = Math.min(rawDt, 0.05);

    // Câmera Lenta Estilo GTA V (18% da velocidade normal) enquanto a Roda de Personagens [TAB] está aberta!
    const timeScale = this.hud.isHeroWheelOpen ? 0.18 : 1.0;
    const dt = baseDt * timeScale;

    this.controller.update(dt);
    const pos = this.controller.position;
    this.destructibles.update(dt, pos);
    this.hud.update(baseDt);
    this.world.update(dt, pos, this.controller);

    const currentRegion = this.world.getRegionAt(pos.x, pos.y, pos.z);
    const speed = this.controller.getHorizontalSpeed();
    this.hud.updateMinimap(pos, this.controller.facingAngle, this.controller.yaw, currentRegion, this.world, speed, baseDt);
    if (this.hud.isFullMapOpen) {
      this.hud.renderFullMap(this.world, pos, this.controller.facingAngle, this.controller);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new LegoCityGame();
});
