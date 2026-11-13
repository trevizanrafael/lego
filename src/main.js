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
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.world = null;
    this.destructibles = null;
    this.playerMinifig = null;
    this.controller = null;
    this._engineReady = false;

    // 1. Inicializa primeiro a HUD e a Tela Inicial 2D (Zero consumo de WebGL/VRAM no Menu!)
    this._initHudBindings();
    this._bindResizeAndLifecycle();

    this.lastTime = performance.now();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initHudBindings() {
    this.hud = new LegoHud();
    this.hud.onSelectFaction = (factionKey, conqueredTerritories = null) => {
      if (this.world?.livingCity) {
        this.world.livingCity.setPlayerFaction(factionKey, this.controller, conqueredTerritories);
      }
    };
    this.hud.onResetTerritories = () => {
      if (this.world?.livingCity) {
        this.world.livingCity.resetTerritories();
      }
    };
    this.hud.getConqueredTerritories = () => {
      return this.world?.livingCity?.factionWar?.getConqueredTerritoryIds?.() || [];
    };
    this.hud.getTerritoryMeta = () => {
      return this.world?.livingCity?.factionWar?.getTerritoryMeta?.() || {};
    };
    this.hud.onApplyTerritoryMeta = (meta) => {
      this.world?.livingCity?.factionWar?.applyTerritoryMeta?.(meta);
    };
    this.hud.onChangeTimeMode = (mode) => {
      if (this.world?.atmosphere) {
        this.world.atmosphere.setTimeMode(mode);
      }
    };
    this.hud.onWarmupStep = (stage, stepIdx) => {
      return this._executeWarmupStep(stage, stepIdx);
    };

    const minimapEl = document.getElementById('minimap-container');
    if (minimapEl) {
      minimapEl.addEventListener('click', () => {
        if (this.world && this.controller) {
          this.hud.toggleFullMap(this.world, this.controller);
        }
      });
    }
  }

  /**
   * Cria o WebGLRenderer priorizando sempre a GPU de Hardware (Early-Z 100% ativo sem logarithmicDepthBuffer!):
   * Só cai para fallback sem restrição de performance se a GPU principal falhar de fato.
   */
  _createResilientWebGLRenderer() {
    const attempts = [
      () =>
        new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: true
        }),
      () =>
        new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        }),
      () =>
        new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false
        }),
      () => {
        const canvas = document.createElement('canvas');
        const ctxOpts = {
          antialias: false,
          stencil: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        };
        const gl =
          canvas.getContext('webgl2', ctxOpts) ||
          canvas.getContext('webgl', ctxOpts) ||
          canvas.getContext('experimental-webgl', ctxOpts);
        if (!gl) {
          throw new Error('GL_CONTEXT_UNAVAILABLE');
        }
        return new THREE.WebGLRenderer({
          canvas,
          context: gl,
          antialias: false,
          failIfMajorPerformanceCaveat: false
        });
      }
    ];

    let lastError = null;
    for (const createFn of attempts) {
      try {
        return createFn();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Error creating WebGL context.');
  }

  _ensure3DEngineInitialized() {
    if (this._engineReady && this.renderer && this.world && this.controller) {
      return true;
    }

    try {
      this.renderer = this._createResilientWebGLRenderer();
    } catch (err) {
      console.error('[WebGL Init Failed]', err);
      this._showWebGLRecoveryModal(err);
      return false;
    }

    this._hideWebGLRecoveryModal();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[WebGL] Contexto gráfico perdido temporariamente pelo driver.');
    });

    this.scene = new THREE.Scene();

    // Gera iluminação ambiente PBR e libera imediatamente os FBOs temporários da VRAM!
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
      this.scene.environmentIntensity = 0.55;
      roomEnv.dispose();
      pmremGenerator.dispose();
    } catch (envErr) {
      console.warn('[PMREM Fallback]', envErr);
    }

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.35,
      2600
    );

    // Instancia Destruição Física, Cidade 3D Completa, Minifigura e Controlador 3ª Pessoa
    this.destructibles = new DestructibleManager(this.scene, this.hud);
    this.world = new TestBlockWorld(this.scene, this.destructibles);

    this.playerMinifig = new Minifigure('caveira');
    this.scene.add(this.playerMinifig.root);

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

    this._engineReady = true;
    return true;
  }

  _showWebGLRecoveryModal(err) {
    let modal = document.getElementById('webgl-recovery-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'webgl-recovery-modal';
      modal.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:99999',
        'background:rgba(9,10,13,0.92)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:24px'
      ].join(';');
      modal.innerHTML = `
        <div style="max-width:640px;width:100%;background:#090a0d;border:2px solid #ef4444;box-shadow:8px 8px 0 #000;padding:28px;clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px);color:#f8fafc;font-family:'Chakra Petch',sans-serif;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#ef4444;letter-spacing:1.5px;margin-bottom:6px;">
            ALERTA DE DRIVER / PROCESSO GPU DO NAVEGADOR DESATIVADO
          </div>
          <div style="font-family:'Teko',sans-serif;font-size:36px;line-height:1.05;color:#facc15;margin-bottom:14px;">
            ACELERAÇÃO WEBGL BLOQUEADA PELO NAVEGADOR (GL_RENDERER = DISABLED)
          </div>
          <p style="font-size:14px;line-height:1.55;color:#cbd5e1;margin:0 0 14px 0;">
            O seu navegador desativou temporariamente o processo 3D da placa de vídeo (erro <b>BindToCurrentSequence failed</b> do Chromium). Isso acontece quando muitas abas 3D recarregam ou após suspensão do driver de vídeo.
          </p>
          <div style="background:#11131a;border-left:4px solid #facc15;padding:12px 14px;margin-bottom:18px;font-size:13.5px;line-height:1.6;color:#f8fafc;">
            <div><b>COMO RESOLVER EM 3 SEGUNDOS:</b></div>
            <div>1. Digite <b style="color:#facc15;font-family:'JetBrains Mono',monospace;">chrome://restart</b> (ou <b style="color:#38bdf8;font-family:'JetBrains Mono',monospace;">edge://restart</b>) na barra de endereços e aperte <b>Enter</b> — suas abas reabrem na hora com a GPU destravada!</div>
            <div>2. Se persistir, abra <b style="color:#facc15;font-family:'JetBrains Mono',monospace;">chrome://settings/system</b> e ative <b>"Usar aceleração gráfica quando disponível"</b>.</div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="btn-copy-chrome-restart" class="tactical-btn" style="border-color:#facc15;color:#facc15;">
              COPIAR chrome://restart
            </button>
            <button id="btn-close-webgl-modal" class="tactical-btn">
              VOLTAR AO MENU
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btn-copy-chrome-restart')?.addEventListener('click', (ev) => {
        navigator.clipboard?.writeText('chrome://restart');
        ev.currentTarget.textContent = 'COPIADO! COLE NA BARRA DE ENDEREÇO';
      });
      document.getElementById('btn-close-webgl-modal')?.addEventListener('click', () => {
        this._hideWebGLRecoveryModal();
      });
    }
    modal.style.display = 'flex';
  }

  _hideWebGLRecoveryModal() {
    const modal = document.getElementById('webgl-recovery-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  _bindResizeAndLifecycle() {
    window.addEventListener('resize', () => {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Libera explicitamente o contexto WebGL ao recarregar/fechar a aba para nunca esgotar o processo GPU do Chrome!
    window.addEventListener('pagehide', () => {
      if (this.renderer) {
        try {
          this.renderer.dispose();
        } catch (_) {
          // ignora no unload
        }
      }
    });
  }

  _executeWarmupStep(stage, stepIdx = 0) {
    if (stage === 'init_engine') {
      return this._ensure3DEngineInitialized();
    }
    if (!this._engineReady && !this._ensure3DEngineInitialized()) {
      return false;
    }
    if (!this.scene || !this.camera || !this.renderer || !this.controller) return false;

    if (stage === 'matrices') {
      this.controller.update(0.001);
      this.scene.updateMatrixWorld(true);
    } else if (stage === 'simulate_entities') {
      const lc = this.world?.livingCity;
      if (lc) {
        for (const ped of lc.pedestrians || []) {
          const r = ped.visual?.root || ped.root;
          if (r) r.visible = true;
        }
      }
      for (let i = 0; i < 3; i++) {
        this.world.update(0.016, this.controller.position, this.controller);
        this.destructibles.update(0.016, this.controller.position);
      }
      this.scene.updateMatrixWorld(true);
    } else if (stage === 'compile_shaders') {
      this.renderer.compile(this.scene, this.camera);
    } else if (stage === 'render_360') {
      const p = this.controller.position;
      const ang = (stepIdx / 8) * Math.PI * 2;
      this.camera.position.set(p.x, p.y + 8, p.z);
      this.camera.lookAt(p.x + Math.sin(ang) * 90, p.y + 4, p.z + Math.cos(ang) * 90);
      this.camera.updateMatrixWorld(true);
      this.renderer.render(this.scene, this.camera);
    } else if (stage === 'finish') {
      this.controller.update(0.001);
      const pos = this.controller.position;
      const currentRegion = this.world.getRegionAt(pos.x, pos.y, pos.z);
      this.hud.updateMinimap(pos, this.controller.facingAngle, this.controller.yaw, currentRegion, this.world, 0, 0.016);
      this.renderer.render(this.scene, this.camera);
      this.lastTime = performance.now();
    }
    return true;
  }

  _animate(now) {
    requestAnimationFrame(this._animate);

    const rawDt = (now - this.lastTime) * 0.001;
    this.lastTime = now;
    const baseDt = Math.min(rawDt, 0.05);

    // Na Tela Inicial ou na Tela de Loading, NÃO roda nem renderiza o mundo 3D em tempo real
    if (this.hud.isTitleScreenActive || this.hud.isLoadingActive || !this._engineReady) {
      this.hud.update(baseDt);
      return;
    }

    const isPausedInGame = this.hud.isPauseMenuOpen && !this.hud.isTitleScreenActive;
    const timeScale = isPausedInGame ? 0.0 : this.hud.isHeroWheelOpen ? 0.18 : 1.0;
    const dt = baseDt * timeScale;

    if (dt > 0) {
      this.controller.update(dt);
      const pos = this.controller.position;
      const camFwd = {
        x: -Math.sin(this.controller.yaw || 0),
        z: -Math.cos(this.controller.yaw || 0)
      };
      this.destructibles.update(dt, pos, camFwd);
      this.world.update(dt, pos, this.controller);
    }
    this.hud.update(baseDt);

    const pos = this.controller.position;
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
  window.__legoGame = new LegoCityGame(); // handle de depuração (console)
});
