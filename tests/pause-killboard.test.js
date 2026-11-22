import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { classifyKillCategory } = await import('../src/ui/hud/HitmarkerHud.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { loadAllSaveSlots, writeSaveSlot, deleteSaveSlot } = await import('../src/ui/FactionIconsAndSaveSystem.js');

describe('Wave 2 — Session Kill Scoreboard in Pause Menu Operator Card (#pause-hero-killboard)', () => {
  it('1. classifyKillCategory & triggerPlayerKillFeedback classificam corretamente police (incluindo guard e heli), civilian, cv, pcc e ares', () => {
    assert.equal(classifyKillCategory('police'), 'police');
    assert.equal(classifyKillCategory('civilian'), 'civilian');
    assert.equal(classifyKillCategory('cv'), 'cv');
    assert.equal(classifyKillCategory('pcc'), 'pcc');
    assert.equal(classifyKillCategory('ares'), 'ares');
    assert.equal(classifyKillCategory({ faction: 'guard' }), 'police', 'Segurança/guarda do Super Banco conta como policial');
    assert.equal(classifyKillCategory({ npcRef: { faction: 'cv' } }), 'cv');
    assert.equal(classifyKillCategory({ npcRef: { faction: 'pcc' } }), 'pcc');
    assert.equal(classifyKillCategory({ faction: 'ares' }), 'ares');
    assert.equal(classifyKillCategory({ isPoliceUnit: true }), 'police');
    assert.equal(classifyKillCategory({ kind: 'police' }), 'police');
    assert.equal(classifyKillCategory({ type: 'police_helicopter' }), 'police');
    assert.equal(classifyKillCategory({ isCivilianPedestrian: true }), 'civilian');
    assert.equal(classifyKillCategory({ type: 'pedestrian_civilian' }), 'civilian');
    assert.equal(classifyKillCategory(null), 'civilian');

    const hud = new LegoHud();
    hud.isTitleScreenActive = false;
    hud.isLoadingActive = false;
    hud.resetSessionKills();

    assert.deepEqual(hud.getSessionKills(), {
      total: 0,
      police: 0,
      civilian: 0,
      cv: 0,
      pcc: 0,
      ares: 0
    });

    hud.triggerPlayerKillFeedback({ isPoliceUnit: true });
    hud.triggerPlayerKillFeedback({ faction: 'guard' });
    hud.triggerPlayerKillFeedback({ isCivilianPedestrian: true });
    hud.triggerPlayerKillFeedback({ faction: 'cv' });
    hud.triggerPlayerKillFeedback({ npcRef: { faction: 'pcc' } });
    hud.triggerPlayerKillFeedback({ faction: 'ares' });

    const kills = hud.getSessionKills();
    assert.equal(kills.police, 2);
    assert.equal(kills.civilian, 1);
    assert.equal(kills.cv, 1);
    assert.equal(kills.pcc, 1);
    assert.equal(kills.ares, 1);
    assert.equal(kills.total, 6);
    assert.equal(hud._playerKillCount, 6);
  });

  it('2. Multi-kill de explosão veicular incrementa cada categoria no placar mas dispara flash de tela e hitmarker estritamente 1 única vez', () => {
    const hud = new LegoHud();
    hud.isTitleScreenActive = false;
    hud.isLoadingActive = false;
    hud.settings.killEffect = true;
    hud.resetSessionKills();

    let flashCalls = 0;
    hud.onTriggerKillFlash = () => {
      flashCalls += 1;
    };

    let hitmarkerCalls = 0;
    const origTriggerHitmarker = hud.triggerHitmarker.bind(hud);
    hud.triggerHitmarker = (isKill, opts) => {
      hitmarkerCalls += 1;
      return origTriggerHitmarker(isKill, opts);
    };

    hud.triggerPlayerKillFeedback(null, {
      categories: ['police', 'police', 'police', 'police']
    });

    const afterPoliceVan = hud.getSessionKills();
    assert.equal(afterPoliceVan.police, 4, 'Explosão com 4 policiais deve somar +4 em POL');
    assert.equal(afterPoliceVan.total, 4, 'Total deve subir para 4');
    assert.equal(flashCalls, 1, 'onTriggerKillFlash deve ser chamado estritamente 1 vez na explosão multi-kill');
    assert.equal(hitmarkerCalls, 1, 'triggerHitmarker deve ser chamado estritamente 1 vez na explosão multi-kill');

    hud.triggerPlayerKillFeedback(null, {
      categories: ['cv', 'pcc', 'civilian']
    });
    const mixed = hud.getSessionKills();
    assert.equal(mixed.police, 4);
    assert.equal(mixed.cv, 1);
    assert.equal(mixed.pcc, 1);
    assert.equal(mixed.civilian, 1);
    assert.equal(mixed.ares, 0);
    assert.equal(mixed.total, 7);
    assert.equal(flashCalls, 2);
  });

  it('3. Menu de Pausa exibe #pause-hero-killboard acima de .pause-hero-nameplate em pt-BR e en-US, sem qualquer kill-feed flutuante na HUD de gameplay', () => {
    const hud = new LegoHud();
    hud.isTitleScreenActive = false;
    hud.isLoadingActive = false;
    hud.settings.language = 'pt-BR';
    hud.resetSessionKills({ police: 5, civilian: 2, cv: 3, pcc: 0, ares: 4 });

    hud.setPauseMenuOpen(true);

    const cardEl = globalThis.document.getElementById('pause-hero-card');
    const inner = cardEl.children.find((ch) => ch?.classList?.contains?.('pause-hero-card-inner'));
    assert.ok(inner, '.pause-hero-card-inner deve existir dentro de #pause-hero-card');

    const kbIdx = inner.children.findIndex((ch) => ch?.id === 'pause-hero-killboard');
    const plateIdx = inner.children.findIndex((ch) => ch?.classList?.contains?.('pause-hero-nameplate'));
    assert.ok(kbIdx >= 0, '#pause-hero-killboard deve estar montado dentro de .pause-hero-card-inner');
    assert.ok(plateIdx > kbIdx, '#pause-hero-killboard deve ficar posicionado imediatamente acima de .pause-hero-nameplate');

    assert.equal(globalThis.document.getElementById('pkb-title')?.textContent, 'BAIXAS');
    assert.equal(globalThis.document.getElementById('pkb-total-val')?.textContent, '14');
    assert.equal(globalThis.document.getElementById('pkb-val-police')?.textContent, '5');
    assert.equal(globalThis.document.getElementById('pkb-val-civilian')?.textContent, '2');
    assert.equal(globalThis.document.getElementById('pkb-val-cv')?.textContent, '3');
    assert.equal(globalThis.document.getElementById('pkb-val-pcc')?.textContent, '0');
    assert.equal(globalThis.document.getElementById('pkb-val-ares')?.textContent, '4');

    const pccCell = hud._pkbRefs?.cells?.pcc?.cellEl;
    const polCell = hud._pkbRefs?.cells?.police?.cellEl;
    assert.equal(pccCell?.dataset?.zero, 'true', 'Categoria zerada recebe data-zero="true"');
    assert.equal(polCell?.dataset?.zero, 'false', 'Categoria > 0 recebe data-zero="false"');

    // Troca de idioma para EN-US atualiza título para KILLS mantendo contadores intactos
    hud._toggleLanguage();
    assert.equal(globalThis.document.getElementById('pkb-title')?.textContent, 'KILLS');
    assert.equal(globalThis.document.getElementById('pkb-total-val')?.textContent, '14');
    hud._toggleLanguage();
    assert.equal(globalThis.document.getElementById('pkb-title')?.textContent, 'BAIXAS');

    // Zero elementos de kill-feed flutuante perto da mira (#crosshair / #hud-hitmarker)
    const hitmarkerText = String(hud.hitmarkerEl?.textContent || '').trim();
    assert.equal(hitmarkerText, '', 'Hitmarker central não deve exibir texto flutuante de +1 kill');
    for (const ch of globalThis.document.body.children || []) {
      assert.equal(
        Boolean(ch?.classList?.contains?.('kill-feed') || ch?.id?.includes?.('kill-feed')),
        false,
        'Nenhum elemento de kill-feed flutuante deve existir na tela de jogo'
      );
    }

    // Validação estrita de IDV no CSS (zero #facc15 e zero border-radius: 999px)
    const pauseCss = fs.readFileSync(new URL('../styles/menus/pause-menu.css', import.meta.url), 'utf8');
    assert.equal(/#facc15/i.test(pauseCss), false, 'pause-menu.css não pode conter #facc15');
    assert.equal(/border-radius\s*:/i.test(pauseCss), false, 'pause-menu.css deve permanecer 100% angular sem border-radius');

    hud.setPauseMenuOpen(false);
  });

  it('4. Persistência em slots de save (saveCurrentProgress / startLoadingSequence) e reset ao iniciar novo jogo', () => {
    deleteSaveSlot(0);
    deleteSaveSlot(1);

    const hud = new LegoHud();
    hud.isTitleScreenActive = false;
    hud.isLoadingActive = false;
    hud.activeSaveSlot = 1;
    hud.playerFaction = 'pcc';
    hud.totalStuds = 42_500;
    hud.resetSessionKills();

    hud.triggerPlayerKillFeedback('police');
    hud.triggerPlayerKillFeedback('police');
    hud.triggerPlayerKillFeedback('cv');
    hud.triggerPlayerKillFeedback('ares');

    hud.saveCurrentProgress();

    const savedSlot1 = loadAllSaveSlots()[1];
    assert.ok(savedSlot1?.sessionKills, 'saveCurrentProgress deve persistir sessionKills no slot ativo');
    assert.deepEqual(savedSlot1.sessionKills, {
      total: 4,
      police: 2,
      civilian: 0,
      cv: 1,
      pcc: 0,
      ares: 1
    });

    // Zera em memória e recarrega o slot 1 via startLoadingSequence(savedSlot1, false)
    hud.resetSessionKills();
    assert.equal(hud.getSessionKills().total, 0);

    hud.onWarmupStep = () => false; // Encerra warmup assíncrono imediatamente no ambiente headless
    hud.startLoadingSequence(savedSlot1, false);
    assert.deepEqual(hud.getSessionKills(), {
      total: 4,
      police: 2,
      civilian: 0,
      cv: 1,
      pcc: 0,
      ares: 1
    });

    // Iniciar um Novo Jogo (isNewOrSwitch = true) deve zerar sessionKills!
    const freshSlot0 = writeSaveSlot(0, {
      faction: 'cv',
      studs: 0,
      sessionKills: { total: 0, police: 0, civilian: 0, cv: 0, pcc: 0, ares: 0 }
    });
    hud.startLoadingSequence(freshSlot0, true);
    assert.deepEqual(hud.getSessionKills(), {
      total: 0,
      police: 0,
      civilian: 0,
      cv: 0,
      pcc: 0,
      ares: 0
    });
  });
});
