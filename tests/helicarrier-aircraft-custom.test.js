import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { setupTestEnvironment, resetTestListeners } from './setup-env.js';
import { TestBlockWorld } from '../src/world/TestBlockWorld.js';
import { DestructibleManager } from '../src/world/DestructibleManager.js';
import { Minifigure } from '../src/entities/Minifigure.js';
import { ThirdPersonController } from '../src/controls/ThirdPersonController.js';
import { LegoHud } from '../src/ui/LegoHud.js';
import { writeSaveSlot, loadAllSaveSlots } from '../src/ui/FactionIconsAndSaveSystem.js';
import {
  createDefaultAircraftConfig,
  createDefaultAircraftSaveData,
  setActiveAircraftSaveData,
  getActiveAircraftSaveData,
  computeCustomAircraftStats,
  applyAircraftCustomization,
  applySavedAircraftConfigsToCarrier,
  spawnCustomizedCarrierAircraft
} from '../src/world/AircraftCustomGarage.js';

setupTestEnvironment();

test('Helicarrier remodel possui LOD em 3 níveis, InstancedMesh, luzes noturnas e hangar preservando colisor principal', () => {
  const scene = new THREE.Scene();
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);

  assert.ok(world.helicarrierGroup, 'helicarrierGroup deve existir no mundo');
  assert.ok(world.helicarrierLOD instanceof THREE.LOD, 'helicarrierLOD deve ser THREE.LOD');
  assert.equal(world.helicarrierLOD.levels.length, 3, 'Helicarrier deve ter 3 níveis de LOD');
  assert.ok(world.helicarrierHangarData?.padPos, 'Hangar padPos deve estar registrado');
  assert.ok(world.helicarrierHangarData?.consolePos, 'Hangar consolePos deve estar registrado');
  assert.ok(world.helicarrierHangarData?.launchPos, 'Hangar launchPos deve estar registrado');

  const deckCol = world.colliders.find(
    (c) => Math.abs(c.maxY - 410.4) < 0.1 && c.minY === 384
  );
  assert.ok(deckCol, 'Colisor principal do convés em Y=410.4..384 deve estar preservado');

  let instancedCount = 0;
  world.helicarrierGroup.traverse((n) => {
    if (n.isInstancedMesh) instancedCount++;
  });
  assert.ok(instancedCount >= 4, `Deve haver >= 4 InstancedMeshes no porta-aviões, achou ${instancedCount}`);

  assert.ok(world.helicarrierNightFX.bridgeWindowMats.length >= 1, 'Bridge window materials registrados');
  assert.ok(world.helicarrierNightFX.beaconMeshes.length >= 4, 'Beacons de navegação registrados');

  // Testa iluminação noturna atualizando sem erro
  world.atmosphere.timeMode = 'manual';
  world.atmosphere.timeHours = 23.0;
  world.atmosphere.update(0.016, new THREE.Vector3(0, 411, 0));
  assert.ok(
    world.helicarrierNightFX.bridgeWindowMats[0].emissiveIntensity > 0.7,
    'Janelas da ilha devem iluminar à noite'
  );
});

test('Personalizador de Aeronaves customiza, gira preview orbital, salva configuração e aplica na decolagem', () => {
  resetTestListeners();
  setActiveAircraftSaveData(createDefaultAircraftSaveData());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.6, 0.5, 3000);
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);
  const hud = new LegoHud();
  const fig = new Minifigure('caveira');
  scene.add(fig.root);

  const canvas = document.getElementById('test-air-canvas');
  const ctrl = new ThirdPersonController(camera, canvas, fig, world, dest, hud);

  // Posiciona jogador próximo ao console do hangar no porta-aviões
  const cPos = world.helicarrierHangarData.consolePos;
  ctrl.position.set(cPos.x - 4, 410.5, cPos.z);

  const hangarHit = ctrl._findNearbyHelicarrierHangar();
  assert.ok(hangarHit, 'Deve detectar hangar do porta-aviões a curta distância');

  const opened = ctrl.toggleVehicleInteraction();
  assert.equal(opened, true, '[E] próximo ao console do hangar deve abrir o estúdio');
  assert.equal(hud.isAircraftStudioOpen, true, 'aircraftStudio deve estar aberto');

  // Altera aeronave e opções
  hud.aircraftStudio.selectAircraftType('jato_vip');
  hud.aircraftStudio.draftConfig.primaryColor = 'crimson_red';
  hud.aircraftStudio.draftConfig.pattern = 'shark_teeth';
  hud.aircraftStudio.draftConfig.insignia = 'bope_skull';
  hud.aircraftStudio.draftConfig.tailNumber = '99';
  hud.aircraftStudio.draftConfig.weaponMod = 'twin_laser';
  hud.aircraftStudio.draftConfig.wingMod = 'awacs_radome';
  hud.aircraftStudio.draftConfig.thrusterMod = 'nuclear_purple';
  hud.aircraftStudio.rebuildPreviewMesh();

  // Câmera orbital + spin automático
  const yawBefore = hud.aircraftStudio.targetYaw;
  hud.aircraftStudio.handleMouseDown({ target: canvas, clientX: 200, clientY: 200 });
  hud.aircraftStudio.handleMouseMove({ clientX: 260, clientY: 220 });
  hud.aircraftStudio.handleMouseUp();
  assert.notEqual(hud.aircraftStudio.targetYaw, yawBefore, 'Arraste orbital deve girar câmera');

  const spinBefore = hud.aircraftStudio._spinAngle;
  hud.aircraftStudio.updateStudioCamera(0.25, camera);
  assert.ok(hud.aircraftStudio._spinAngle > spinBefore, 'Preview 3D deve girar automaticamente');

  // Salva & Decola
  hud.aircraftStudio.saveAndLaunch();
  assert.equal(hud.isAircraftStudioOpen, false, 'Estúdio deve fechar após Salvar & Decolar');
  assert.ok(ctrl.currentVehicle, 'Jogador deve estar embarcado na aeronave customizada pronta para decolar');
  assert.equal(ctrl.currentVehicle.mesh.userData.carType, 'jato_vip');
  assert.equal(
    ctrl.currentVehicle.mesh.userData.aircraftCustomConfig.pattern,
    'shark_teeth',
    'Configuração salva deve estar aplicada na aeronave de decolagem'
  );
  assert.equal(
    ctrl.currentVehicle.mesh.userData.vehicleSpec.weapon,
    'plasma_laser',
    'Mod de canhões laser deve atualizar o armamento efetivo da aeronave'
  );
  assert.ok(
    ctrl.currentVehicle.mesh.getObjectByName('lego_aircraft_mod_group'),
    'Grupo 3D de decalques/peças customizadas deve estar anexado na aeronave'
  );

  // Verifica persistência no Save Slot e aplicação em aeronave estacionada no porta-aviões
  const customFighter = {
    ...createDefaultAircraftConfig('jato_caca'),
    primaryColor: 'alert_yellow',
    weaponMod: 'heavy_bombs',
    tailNumber: '77'
  };
  const nextSave = createDefaultAircraftSaveData();
  nextSave.configsByType.jato_caca = customFighter;
  setActiveAircraftSaveData(nextSave);
  writeSaveSlot(0, { faction: 'cv', aircraftCustom: nextSave });
  const reloaded = loadAllSaveSlots()[0];
  assert.equal(reloaded.aircraftCustom.configsByType.jato_caca.tailNumber, '77');

  const applied = applySavedAircraftConfigsToCarrier(world);
  assert.ok(applied >= 3, `Aeronaves no convés devem receber a configuração salva (${applied})`);
  const parkedJet = dest.objects.find(
    (o) =>
      o.type === 'car' &&
      o.mesh?.userData?.carType === 'jato_caca' &&
      o.mesh?.userData?.isHelicarrierParked
  );
  assert.equal(parkedJet.mesh.userData.aircraftCustomConfig.tailNumber, '77');

  const boostedSpec = computeCustomAircraftStats('jato_caca', customFighter);
  assert.ok(boostedSpec.hp > 880, 'Blindagem deve refletir mod pesado');

  const dummyObj = { mesh: parkedJet.mesh, colliders: [] };
  applyAircraftCustomization(dummyObj, customFighter);
  assert.equal(parkedJet.mesh.userData.aircraftCustomConfig.primaryColor, 'alert_yellow');
  assert.ok(spawnCustomizedCarrierAircraft(world, customFighter), 'Spawn na catapulta deve funcionar');

  // Terminal rápido ao lado do Spawn + Holoprojeção + Atalho [K] + applyToWorldOnly + prompt embarcado no Hangar
  assert.ok(world.helicarrierHangarData?.quickConsolePos, 'quickConsolePos perto do spawn deve existir');
  assert.ok(world.helicarrierShowcaseHolo, 'Holograma giratório de destaque do Hangar deve existir');
  assert.equal(world.helicarrierShowcaseHolo.visible, true);

  ctrl.exitVehicle();
  const qPos = world.helicarrierHangarData.quickConsolePos;
  ctrl.position.set(qPos.x + 2, 410.5, qPos.z);
  assert.ok(ctrl._findNearbyHelicarrierHangar(), 'Deve detectar o Hangar também no terminal rápido do convés');

  // Atalho [K] no convés abre o estúdio diretamente
  hud.isTitleScreenActive = false;
  window.dispatchEvent({ type: 'keydown', code: 'KeyK', repeat: false, target: canvas, preventDefault() {} });
  window.dispatchEvent({ type: 'keyup', code: 'KeyK', target: canvas, preventDefault() {} });
  assert.equal(hud.isAircraftStudioOpen, true, '[K] no convés do Porta-Aviões deve abrir o Personalizador');
  assert.equal(world.helicarrierShowcaseHolo.visible, false, 'Holograma deve ocultar enquanto estúdio está aberto');

  hud.aircraftStudio.draftConfig.tailNumber = '55';
  hud.aircraftStudio.applyToWorldOnly();
  assert.equal(hud.isAircraftStudioOpen, true, 'APLICAR mantém o estúdio aberto após atualizar o convés');
  assert.equal(getActiveAircraftSaveData().configsByType[hud.aircraftStudio.draftConfig.aircraftType].tailNumber, '55');
  hud.aircraftStudio.close(false);
  assert.equal(world.helicarrierShowcaseHolo.visible, true, 'Holograma volta ao fechar o estúdio');

  // Prompt deve continuar visível mesmo embarcado numa aeronave sobre o pad do Hangar!
  const launchedAir = spawnCustomizedCarrierAircraft(world, customFighter);
  ctrl.enterVehicle(launchedAir);
  const padPos = world.helicarrierHangarData.padPos;
  ctrl.position.set(padPos.x, padPos.y + 0.5, padPos.z);
  ctrl._updateVehiclePrompt();
  assert.equal(ctrl.vehiclePromptEl.classList.contains('hidden'), false, 'Prompt do Hangar fica visível embarcado');

  // No chão (y=0), [K] alterna a Rádio sem abrir estúdio aéreo
  ctrl.exitVehicle();
  ctrl.position.set(0, 1, 0);
  const playBefore = hud.tiktokRadio?.isPlaying;
  window.dispatchEvent({ type: 'keydown', code: 'KeyK', repeat: false, target: canvas, preventDefault() {} });
  window.dispatchEvent({ type: 'keyup', code: 'KeyK', target: canvas, preventDefault() {} });
  assert.equal(hud.isAircraftStudioOpen, false, '[K] no solo não deve abrir estúdio do porta-aviões');
  assert.notEqual(hud.tiktokRadio?.isPlaying, playBefore, '[K] no solo deve continuar alternando a Rádio');
});
