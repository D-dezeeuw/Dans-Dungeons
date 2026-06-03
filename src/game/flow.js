// src/game/flow.js — game lifecycle FSM.
//
// Owns: new game, resume, play loop, end states, key setup, scene images.
// All AI calls go through loop.js (checkApiKey, generateTurnImage, processTurn).

import { appState, setValue, tick, saveToStorage, clearSave, restoreState } from '../core/state.js';
import { generateWorld, generateDungeon, createDungeonEntry } from './world.js';
import { createCharacter } from './character.js';
import { processTurn, checkApiKey, generateTurnImage, buildScene } from './loop.js';
import * as UI from '../ui/console.js';
import { t } from '../i18n/i18n.js';
import { getSkills } from '../ui/chips.js';
import { modelsForTier } from '../ai/tiers.js';

// TTS helpers — imported lazily so the audio module is a no-op when TTS is off.
function _speak(text) {
  if (!appState.settings?.tts || !appState.ai?.key || !text?.trim()) return;
  import('../ai/tts.js').then(({ speakText }) => speakText(text)).catch(() => {});
}
async function _speakAsync(text) {
  if (!appState.settings?.tts || !appState.ai?.key || !text?.trim()) return;
  try { const { speakText } = await import('../ai/tts.js'); await speakText(text); } catch {}
}
function _cancelSpeech() {
  import('../ai/tts.js').then(({ cancelSpeech }) => cancelSpeech()).catch(() => {});
}

// ─── Journal log ──────────────────────────────────────────────────────────────
const journalLog = [];
export function getJournalLog() { return journalLog; }

// ─── Sketch view state ────────────────────────────────────────────────────────
export function applySketchView(view) {
  setValue('settings.sketchView', view);
  UI.setSketchOpacity(view === 'minimized' ? 'off' : view === 'maximized' ? 'hi' : 'normal');
  if (view !== 'minimized') UI.restoreSceneImage();
}

// ─── Scene image helpers ──────────────────────────────────────────────────────
function buildImagePrompt(narration) {
  const roomId = appState.world?.currentRoom;
  const room   = appState.world?.rooms?.[roomId];
  const npcs   = Object.values(appState.world?.npcs ?? {})
    .filter(n => n.roomId === roomId && n.alive)
    .map(n => n.name);
  const base = narration || room?.description || 'A dark dungeon corridor';
  return npcs.length ? `${base} ${npcs.join(', ')} present.` : base;
}

function requestSceneImage(narration, journalEntry = null) {
  if ((appState.settings?.sketchView ?? 'windowed') === 'minimized') return Promise.resolve(null);
  UI.showSceneImageLoading();
  return generateTurnImage(buildImagePrompt(narration))
    .then(src => {
      src ? UI.setSceneImage(src) : UI.hideSceneImage();
      if (src && journalEntry) journalEntry.imageSrc = src;
      return src;
    })
    .catch(() => { UI.hideSceneImage(); return null; });
}

// ─── Key / tier setup ────────────────────────────────────────────────────────
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

function applyTier(tier) {
  setValue('ai.tier', tier);
  setValue('ai.models', modelsForTier(tier));
  if (tier === 'free') {
    setValue('settings.sceneImage', false);
    setValue('settings.tts', false);
    setValue('settings.stt', false);
  }
  tick();
  saveToStorage();
}

export async function setupKey() {
  UI.clear();
  UI.appendEntry('gm',     t('setup.gameName'));
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('setup.needKey'));
  UI.appendEntry('system', t('setup.signUp'));
  UI.appendEntry('system', t('tier.keyFreeHint'));
  UI.appendEntry('system', '');

  const key = await UI.prompt(t('setup.pasteKey'));
  setValue('ai.key', key.trim());

  UI.appendEntry('system', '');
  UI.appendEntry('system', t('setup.defaultUrl', { url: DEFAULT_BASE_URL }));
  const customUrl = await UI.prompt(t('setup.customUrl'));
  if (customUrl.trim()) setValue('ai.baseUrl', customUrl.trim());
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('setup.keySaved'));

  // Tier choice
  UI.appendEntry('system', '');
  const tierChoice = await UI.pickFrom(
    t('tier.upgradeQuestion'),
    ['deluxe', 'free'],
    x => x === 'deluxe' ? t('tier.upgradeYes') : t('tier.upgradeNo'),
    1,
  );
  applyTier(tierChoice);
  UI.appendEntry('system', tierChoice === 'deluxe' ? t('tier.upgraded') : '');
}

// Upgrade to deluxe from settings — prompts for key if needed.
export async function upgradeToDeluxe() {
  if (!appState.ai?.key) {
    const key = await UI.prompt(t('setup.pasteKey'));
    if (!key.trim()) return;
    setValue('ai.key', key.trim());
  }
  const valid = await checkApiKey();
  if (valid) {
    applyTier('deluxe');
    UI.appendEntry('system', t('tier.upgraded'));
  } else {
    UI.appendEntry('error', t('tier.downgraded'));
    applyTier('free');
  }
}

async function reAuthKey() {
  setValue('ai.key', '');
  tick();
  UI.appendEntry('system', '');
  UI.appendEntry('error', t('setup.keyRejected'));
  const key = await UI.prompt(t('setup.pasteValid'));
  if (key.trim()) {
    setValue('ai.key', key.trim());
    tick();
    saveToStorage();
    UI.appendEntry('system', t('setup.keyUpdated'));
  }
}

export async function ensureKey() {
  if (!appState.ai?.key) { await setupKey(); tick(); return; }
  // Returning player — validate key, restore tier.
  const valid = await checkApiKey();
  if (!valid) {
    setValue('ai.key', '');
    applyTier('free');
    UI.appendEntry('error', t('tier.downgraded'));
    await setupKey();
    tick();
  }
}

// Helper: check if current tier allows a feature, show gate message if not.
export function requireDeluxe(featureKey) {
  if ((appState.ai?.tier ?? 'free') === 'deluxe') return true;
  UI.appendEntry('system', t('tier.featureGated', { feature: t(`tier.${featureKey}`) }));
  return false;
}

// ─── Meta commands ────────────────────────────────────────────────────────────
async function handleMeta(raw) {
  const cmd = raw.slice(1).toLowerCase().trim();
  if (cmd === 'restart') { clearSave(); location.reload(); return; }
  if (cmd === 'save') { saveToStorage(); UI.appendEntry('system', t('meta.saved')); return; }
  if (cmd === 'status') {
    const pc = appState.party?.pc;
    if (pc) UI.appendEntry('system', t('meta.status', { name: pc.record.name, hp: pc.record.hpCurrent, max: pc.sheet.hp.max, ac: pc.sheet.ac.value }));
    return;
  }
  if (cmd === 'settings') { UI.appendEntry('system', t('setup.reRunSetup')); await setupKey(); return; }
  if (cmd === 'help') { UI.appendEntry('system', t('meta.helpList')); return; }
  UI.appendEntry('system', t('meta.unknownCmd', { cmd: raw }));
}

// ─── Start a new adventure ────────────────────────────────────────────────────

export async function startNewGame() {
  const isDeluxe = (appState.ai?.tier ?? 'free') === 'deluxe';

  // Game mode choice — only Deluxe gets campaign option.
  let mode = 'quickdungeon';
  if (isDeluxe) {
    mode = await UI.pickFrom(
      t('newgame.modeQuestion'),
      ['campaign', 'quickdungeon'],
      x => x === 'campaign' ? t('newgame.modeCampaign') : t('newgame.modeQuickDungeon'),
      1,
    );
  }

  setValue('party',  { pc: null, inventory: [] });
  setValue('flags',       {});
  setValue('transcript',  []);
  setValue('session.turnCount', 0);
  setValue('session.phase', 'char-create');

  const result = await createCharacter(UI);
  if (!result) { UI.appendEntry('error', t('setup.createCancelled')); return; }
  setValue('party.pc', result);

  // Deluxe: ask about paid features. Free: skip.
  if (isDeluxe) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('newgame.sketchHint'));
    const sketchChoice = await UI.pickFrom(t('newgame.sketchQuestion'), ['yes', 'no'], x => x === 'yes' ? t('newgame.sketchYes') : t('newgame.sketchNo'), 1);
    setValue('settings.sceneImage', sketchChoice === 'yes');

    const ttsChoice = await UI.pickFrom(t('newgame.ttsQuestion'), ['yes', 'no'], x => x === 'yes' ? t('newgame.ttsYes') : t('newgame.ttsNo'), 1);
    setValue('settings.tts', ttsChoice === 'yes');
  } else {
    setValue('settings.sceneImage', false);
    setValue('settings.tts', false);
    setValue('settings.stt', false);
  }

  if (mode === 'campaign') {
    await startCampaign();
  } else {
    await startQuickDungeon();
  }
}

// ─── Quick Dungeon (legacy flow) ─────────────────────────────────────────────

async function startQuickDungeon() {
  const world = generateWorld();
  setValue('world', world);
  setValue('session.phase', 'play');
  tick();
  saveToStorage();
  await beginAdventure();
}

// ─── Campaign flow (worldgen → settlement → dungeon) ─────────────────────────

async function startCampaign() {
  UI.appendEntry('system', '');

  const progress = (key, detail) => {
    if (key === 'detail') UI.appendEntry('system', `  → ${detail}`);
    else UI.appendEntry('system', t(`ai.${key}`));
  };

  let seed, factions, beats, region, settlement;

  try {
    const { generateWorldSeed, generateFactions, generateBeats, generateRegion, generateSettlement } = await import('./worldgen.js');

    progress('worldgenStep1');
    seed = await generateWorldSeed();
    if (!seed) throw new Error('World seed failed');
    if (!seed.digest) seed.digest = `${seed.name} — ${seed.tone}. ${seed.redThread?.premise ?? ''}`;
    progress('detail', `World: "${seed.name}" (${seed.tone}).`);

    progress('worldgenStep2');
    try { factions = (await generateFactions(seed.digest))?.factions ?? []; } catch { factions = []; }
    progress('detail', factions.length ? `Factions: ${factions.length}.` : 'Factions: skipped.');

    progress('worldgenStep3');
    try { beats = (await generateBeats(seed.digest))?.beats ?? []; } catch { beats = []; }
    progress('detail', beats.length ? `Red thread: ${beats.length} beats.` : 'Red thread: skipped.');

    progress('worldgenStep4');
    region = await generateRegion(seed.digest);
    if (!region) throw new Error('Region failed');
    if (!region.digest) region.digest = `${region.name} — ${region.climate}.`;
    progress('detail', `Region: "${region.name}".`);

    progress('worldgenStep5');
    settlement = await generateSettlement(region.digest, region.id);
    if (!settlement) throw new Error('Settlement failed');
    if (!settlement.digest) settlement.digest = `${settlement.name} — ${(settlement.npcs ?? []).map(n => n.name).join(', ')}.`;
    progress('detail', `Settlement: "${settlement.name}".`);

  } catch (e) {
    UI.appendEntry('error', `World generation failed: ${e.message}. Falling back to Quick Dungeon.`);
    await startQuickDungeon();
    return;
  }

  // Store world state
  const worldState = {
    ...appState.world,
    seed:   seed.name,
    name:   seed.name,
    tone:   seed.tone,
    lore:   { creation: seed.creation, gods: seed.gods, redThread: seed.redThread },
    digest: seed.digest,
    factions: Object.fromEntries((factions ?? []).map(f => [f.id, f])),
    redThread: { beats: beats ?? [], currentIndex: 0, flags: {} },
    regions: { [region.id]: { ...region, settlements: [settlement.id], dungeons: [], adjacentRegions: region.adjacentHints ?? [] } },
    settlements: { [settlement.id]: { ...settlement, regionId: region.id } },
    dungeons: {},
    location: { type: 'settlement', regionId: region.id, settlementId: settlement.id, dungeonId: null },
  };
  setValue('world', worldState);

  setValue('session.phase', 'play');
  tick();
  saveToStorage();

  await enterSettlement(settlement.id);
}

// ─── Settlement scene ────────────────────────────────────────────────────────

async function enterSettlement(settlementId) {
  const settlement = appState.world?.settlements?.[settlementId];
  if (!settlement) { await startQuickDungeon(); return; }

  setValue('world', { ...appState.world, location: { ...appState.world.location, type: 'settlement', settlementId, dungeonId: null } });

  UI.clear();
  UI.appendEntry('system', t('settlement.banner', { name: settlement.name }));
  UI.appendEntry('system', '');
  UI.appendEntry('gm', settlement.description ?? t('settlement.youAreIn', { name: settlement.name }));
  UI.appendEntry('system', '');

  // Show NPCs
  if (settlement.npcs?.length) {
    UI.appendEntry('system', t('settlement.npcList'));
    for (const npc of settlement.npcs) {
      UI.appendEntry('system', `  ${npc.name} — ${npc.role}${npc.personality ? ` (${npc.personality})` : ''}`);
    }
    UI.appendEntry('system', '');
  }

  // Show exits
  if (settlement.exits?.length) {
    UI.appendEntry('system', t('settlement.exitList'));
    for (const exit of settlement.exits) {
      UI.appendEntry('system', `  ${exit.direction}: ${exit.targetName} (${exit.targetType})`);
    }
    UI.appendEntry('system', '');
  }

  _speak(settlement.description ?? settlement.name);
  await settlementLoop(settlementId);
}

async function settlementLoop(settlementId) {
  const settlement = appState.world?.settlements?.[settlementId];
  if (!settlement) return;

  while (true) {
    if (appState.session.phase !== 'play') break;

    // Show settlement chips
    const chips = [];
    for (const npc of (settlement.npcs ?? [])) {
      chips.push({ label: t('settlement.talkTo', { name: npc.name }), value: t('settlement.talkCmd', { name: npc.name }) });
    }
    for (const exit of (settlement.exits ?? [])) {
      chips.push({ label: t('settlement.travelTo', { name: exit.targetName }), value: t('settlement.travelCmd', { name: exit.targetName }) });
    }
    UI.showActionChips(chips);

    const raw = await UI.prompt('');
    if (!raw.trim()) continue;
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();

    // Resolve settlement action
    const action = resolveSettlementInput(raw, settlement);

    if (action.type === 'talk') {
      UI.appendEntry('gm', `${action.npc.name}: "${action.npc.greeting}"`);
      if (action.npc.personality) UI.appendEntry('system', `(${action.npc.personality})`);
      if (action.npc.questHook) {
        UI.appendEntry('system', '');
        UI.appendEntry('gm', t('settlement.questReceived', { hook: action.npc.questHook }));
      }
      if (action.npc.secret) {
        // Narrator might weave secrets in later — for now show as a hint
        UI.appendEntry('system', `You sense ${action.npc.name} is hiding something…`);
      }
      _speak(action.npc.greeting);
      continue;
    }

    if (action.type === 'travel') {
      UI.appendEntry('system', t('settlement.travelDungeon', { name: action.exit.targetName }));
      UI.appendEntry('system', '');

      if (action.exit.targetType === 'dungeon') {
        await enterDungeon(action.exit, settlementId);
        // After dungeon, return to settlement
        UI.appendEntry('system', '');
        UI.appendEntry('system', t('settlement.returnSettlement', { name: settlement.name }));
        UI.appendEntry('system', '');
        continue;
      }
      // Road/wilderness — future: lazy expand new region
      UI.appendEntry('gm', 'The road stretches ahead, but your business here is not yet done.');
      continue;
    }

    // Fallback: unrecognized input — just echo it
    UI.appendEntry('system', 'You look around the settlement, unsure what to do.');
  }
}

function resolveSettlementInput(raw, settlement) {
  const lower = raw.toLowerCase();

  // Check for NPC talk
  for (const npc of (settlement.npcs ?? [])) {
    if (lower.includes(npc.name.toLowerCase()) || lower.includes(npc.role.toLowerCase())) {
      return { type: 'talk', npc };
    }
  }
  if (lower.includes('talk') || lower.includes('praat') || lower.includes('spreek')) {
    const npc = settlement.npcs?.[0];
    if (npc) return { type: 'talk', npc };
  }

  // Check for travel
  for (const exit of (settlement.exits ?? [])) {
    if (lower.includes(exit.targetName.toLowerCase()) || lower.includes(exit.direction.toLowerCase())) {
      return { type: 'travel', exit };
    }
  }
  if (lower.includes('travel') || lower.includes('reis') || lower.includes('go') || lower.includes('ga')) {
    const exit = settlement.exits?.[0];
    if (exit) return { type: 'travel', exit };
  }

  return { type: 'unknown' };
}

// ─── Enter dungeon from settlement ───────────────────────────────────────────

async function enterDungeon(exit, settlementId) {
  const dungeonId = exit.targetId ?? `dungeon-${Date.now()}`;

  // Generate dungeon if not already in world state
  if (!appState.world?.dungeons?.[dungeonId]) {
    const dungeon = createDungeonEntry({
      id:       dungeonId,
      name:     exit.targetName,
      regionId: appState.world?.location?.regionId ?? null,
    });
    const dungeons = { ...(appState.world?.dungeons ?? {}), [dungeonId]: dungeon };
    setValue('world', { ...appState.world, dungeons });
  }

  const dungeon = appState.world.dungeons[dungeonId];

  // Set flat world fields for the resolver (legacy compat)
  setValue('world', {
    ...appState.world,
    currentRoom: dungeon.currentRoom,
    exitRoomId:  dungeon.exitRoomId,
    rooms:       dungeon.rooms,
    npcs:        dungeon.npcs,
    location: { ...appState.world.location, type: 'dungeon', dungeonId },
  });

  tick();
  saveToStorage();

  await beginAdventure();
}

// ─── Character flavour description ───────────────────────────────────────────

function describePC(pc) {
  const name    = pc.record.name;
  const classId = pc.record.classId;
  const hp      = pc.record.hpCurrent ?? pc.sheet.hp.max;
  const maxHp   = pc.sheet.hp.max;
  const ac      = pc.sheet.ac.value;
  const level   = pc.record.level ?? 1;

  const ratio = hp / maxHp;
  const health = ratio >= 0.9 ? t('describe.healthy')
    : ratio >= 0.5 ? t('describe.bruised')
    : ratio >= 0.25 ? t('describe.wounded')
    : t('describe.barelyStanding');

  const exp = level <= 1 ? t('describe.amateur')
    : level <= 4 ? t('describe.fledgling')
    : level <= 8 ? t('describe.seasoned')
    : level <= 14 ? t('describe.veteran')
    : t('describe.legendary');

  const armor = ac >= 20 ? t('describe.armorImpenetrable')
    : ac >= 17 ? t('describe.armorTough')
    : ac >= 14 ? t('describe.armorDecent')
    : ac >= 11 ? t('describe.armorLight')
    : t('describe.armorNone');

  return t('describe.template', { name, health, exp, class: classId, armor });
}

// ─── Intro scene (dungeon entry) ─────────────────────────────────────────────

export async function beginAdventure() {
  const room = appState.world.rooms[appState.world.currentRoom];
  const pc   = appState.party.pc;

  UI.clear();
  UI.appendEntry('system', t('adventure.banner'));
  UI.appendEntry('system', '');
  UI.appendEntry('gm', room.description);
  UI.appendEntry('system', '');
  const exits = room.exits.map(e => t(`directions.${e.dir}`)).join(', ');
  UI.appendEntry('system', t('adventure.exits', { dirs: exits }));
  UI.appendEntry('system', '');
  UI.appendEntry('system', describePC(pc));
  UI.appendEntry('system', '');

  const openingEntry = { turn: 0, narration: room.description, imageSrc: null };
  journalLog.push(openingEntry);
  if (appState.settings?.sceneImage) requestSceneImage(room.description, openingEntry);
  if (appState.settings?.actionBar)  UI.updateActionBar(room.exits ?? [], pc.record, pc.sheet, {});
  _speak(room.description);

  await playLoop();
}

// ─── Autoplay helpers ─────────────────────────────────────────────────────────

function _collectChipValues(room, pc) {
  const values = [];
  for (const e of (room?.exits ?? [])) {
    values.push(t('chips.goDir', { dir: t(`directions.${e.dir}`) }));
  }
  for (const i of (room?.loot ?? []).filter(i => !i.taken)) {
    values.push(t('chips.takeCmd', { name: i.name }));
  }
  if ((room?.exits ?? []).some(e => e.locked)) {
    values.push(t('chips.unlockCmd'));
  }
  values.push(t('chips.attackCmd'));
  values.push(t('chips.lookCmd'));
  values.push(t('chips.talkCmd'));
  values.push(t('chips.waitCmd'));
  for (const atk of (pc?.sheet?.attacks ?? [])) {
    values.push(t('chips.attackWith', { name: atk.name }));
  }
  const cooldowns = appState.session?.skillCooldowns ?? {};
  for (const skill of getSkills()) {
    if ((cooldowns[skill.id] ?? 0) <= 0) {
      values.push(t('chips.useSkill', { name: skill.label }));
    }
  }
  return values;
}

// ─── Main play loop (dungeon) ─────────────────────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000];

export async function playLoop() {
  let pendingRetry = null;

  while (true) {
    if (appState.session.phase !== 'play') break;

    const inExitRoom = appState.world?.currentRoom === appState.world?.exitRoomId;
    if (inExitRoom) {
      // Campaign mode: return to settlement. Quick dungeon: victory screen.
      if (appState.world?.location?.type === 'dungeon' && appState.world?.location?.settlementId) {
        // Mark dungeon complete
        const did = appState.world.location.dungeonId;
        if (did && appState.world.dungeons?.[did]) {
          const dungeons = { ...appState.world.dungeons, [did]: { ...appState.world.dungeons[did], completed: true } };
          setValue('world', { ...appState.world, dungeons });
        }
        await doVictory();
        return; // return to settlementLoop caller
      }
      await doVictory();
      break;
    }

    const pcHp = appState.party?.pc?.record?.hpCurrent ?? 1;
    if (pcHp <= 0) { await doDefeat(); break; }

    _cancelSpeech();

    const room = appState.world?.rooms?.[appState.world?.currentRoom];
    const autoplay = appState.settings?.autoplay;

    if (!autoplay) {
      UI.showRoomChips(room?.exits ?? [], room?.loot ?? []);
      UI.showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
      UI.showSkillChips(appState.session?.skillCooldowns ?? {});
      if (appState.settings?.actionBar) {
        UI.updateActionBar(room?.exits ?? [], appState.party?.pc?.record, appState.party?.pc?.sheet, appState.session?.skillCooldowns ?? {});
      }
      if (pendingRetry) {
        UI.insertActionChip('Retry', pendingRetry);
        pendingRetry = null;
      }
    }

    let raw;

    if (autoplay) {
      UI.setInputEnabled(false);
      UI.setThinking(true);
      try {
        const { generateAutoAction } = await import('../ai/autoplay.js');
        const scene   = buildScene();
        const actions = _collectChipValues(room, appState.party?.pc);
        raw = await generateAutoAction(scene, actions, appState.transcript ?? []);
      } catch (e) {
        console.warn('Autoplay error:', e.message);
        raw = null;
      }
      UI.setThinking(false);
      if (!raw?.trim()) { raw = await UI.prompt(''); }
    } else {
      raw = await UI.prompt('');
    }

    if (!raw?.trim()) continue;
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true);
    if (appState.settings?.roleplayMode) UI.showRoleplayOverlay(true);

    let streamEl = null;
    function onChunk(text) {
      if (!streamEl) { UI.setThinking(false); streamEl = UI.beginStreamEntry('gm'); }
      UI.appendStreamChunk(streamEl, text);
    }

    let result    = null;
    let caughtErr = null;
    let reauthed  = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        streamEl?.remove(); streamEl = null;
        UI.setThinking(false);
        UI.appendEntry('system', t('loop.retrying', { n: attempt, total: RETRY_DELAYS.length }));
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        UI.setThinking(true);
      }
      try {
        result = await processTurn(raw, onChunk);
        caughtErr = null;
        break;
      } catch (e) {
        caughtErr = e;
        if (/^AI 401:/.test(e.message) && !reauthed) {
          reauthed = true; streamEl?.remove(); streamEl = null; UI.setThinking(false);
          if (appState.settings?.roleplayMode) UI.showRoleplayOverlay(false);
          await reAuthKey();
          UI.setThinking(true);
          if (appState.settings?.roleplayMode) UI.showRoleplayOverlay(true);
          attempt--; caughtErr = null; continue;
        }
        if (!/^AI 4\d\d:/.test(e.message) || attempt === RETRY_DELAYS.length) break;
      }
    }

    if (caughtErr) {
      UI.setThinking(false);
      if (appState.settings?.roleplayMode) UI.showRoleplayOverlay(false);
      streamEl?.remove(); streamEl = null;
      UI.appendEntry('system', '');
      if (/^AI 401:/.test(caughtErr.message)) {
        UI.appendEntry('error', t('loop.authFail'));
      } else if (/^AI 4\d\d:/.test(caughtErr.message)) {
        UI.appendEntry('gm', t('loop.gmUnavailable'));
        pendingRetry = raw;
      } else {
        UI.appendEntry('error', t('loop.error', { msg: caughtErr.message }));
        UI.appendEntry('system', t('loop.turnFail'));
      }
      continue;
    }

    tick();
    UI.setThinking(false);
    if (!streamEl && result?.narration) UI.appendEntry('gm', result.narration);
    UI.appendEntry('system', '');

    const journalEntry = { turn: appState.session?.turnCount ?? 0, narration: result?.narration ?? '', imageSrc: null };
    journalLog.push(journalEntry);
    if (appState.settings?.sceneImage) requestSceneImage(result?.narration, journalEntry);

    if (appState.settings?.roleplayMode) {
      UI.showRoleplayOverlay(false);
      _speakAsync(result?.narration);
    } else {
      _speak(result?.narration);
    }

    UI.updateDebugPanel(result?._debug);
  }
}

// ─── End states ───────────────────────────────────────────────────────────────

async function doVictory() {
  const room     = appState.world?.rooms?.[appState.world?.exitRoomId];
  const treasure = (room?.loot ?? []).find(i => i.type === 'treasure');
  const victoryText = t('victory.text', { treasure: treasure?.name ?? 'the treasure' });
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('victory.banner'));
  UI.appendEntry('gm', victoryText);
  UI.appendEntry('system', '');
  _speak(victoryText);

  // Campaign mode: return to settlement (don't set game-over)
  if (appState.world?.location?.settlementId) {
    saveToStorage();
    return;
  }

  // Quick dungeon: game over
  setValue('session.phase', 'game-over');
  UI.appendEntry('system', t('victory.hint'));
  await awaitRestart();
}

async function doDefeat() {
  setValue('session.phase', 'game-over');
  const defeatText = t('defeat.text');
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('defeat.banner'));
  UI.appendEntry('gm', defeatText);
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('defeat.hint'));
  _speak(defeatText);
  await awaitRestart();
}

async function awaitRestart() {
  UI.showActionChips([{ label: t('loop.restart'), value: '/restart' }]);
  while (true) {
    const input = await UI.prompt('');
    if (input.toLowerCase().startsWith('/restart')) {
      clearSave();
      location.reload();
      return;
    }
  }
}

// ─── Resume a saved game ──────────────────────────────────────────────────────

export async function resumeGame() {
  UI.appendEntry('system', t('adventure.resumeBanner'));
  UI.appendEntry('system', '');

  const entries = (appState.transcript ?? []).slice(-6);
  for (const e of entries) {
    if (e.role === 'player') UI.appendEntry('player', `> ${e.text}`);
    else                     UI.appendEntry(e.role, e.text);
  }

  UI.appendEntry('system', '');
  UI.appendEntry('system', t('adventure.resumeStats', {
    hp:   appState.party?.pc?.record?.hpCurrent,
    max:  appState.party?.pc?.sheet?.hp?.max,
    turn: appState.session?.turnCount,
  }));
  UI.appendEntry('system', '');

  // Resume into the right context
  const locType = appState.world?.location?.type;
  if (locType === 'settlement' && appState.world?.location?.settlementId) {
    await settlementLoop(appState.world.location.settlementId);
  } else {
    await playLoop();
  }
}
