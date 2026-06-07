// src/game/flow.js — game lifecycle FSM.
//
// Owns: new game, resume, play loop, end states, key setup, scene images.
// All AI calls go through loop.js (checkApiKey, generateTurnImage, processTurn).

import { appState, setValue, tick, saveToStorage, clearSave, restoreState, commit } from '../core/state.js';
import { generateDungeon, createDungeonEntry, buildEnemy } from './world.js';
import { buildWorldBlueprint } from './worldseed.js';
import { OVERWORLD_ENEMY_IDS } from './creatures.js';
import { createCharacter } from './character.js';
import { processTurn, checkApiKey, generateTurnImage, buildScene } from './loop.js';
import { clearTurnMarks } from './undo.js';
import {
  goldOf, resolvePurchase, addToInventory, resolveRest, DEFAULT_REST_COST,
  questId, makeQuest, addQuest, canRevealSecret, pushDialogue, slug,
  setQuestStatus, activeQuests,
  adjustPrice, isHostile, standing,
  beginTravel, stepTravel, isTravelDone, pickEncounter,
} from 'bag-of-holding-client';
import { setStoryFlag, awardReputation, reputationStanding, progress as storyProgressNow } from './story.js';
import * as UI from '../ui/console.js';
import { t, tRaw } from '../i18n/i18n.js';
import { getSkills } from '../ui/chips.js';
import { modelsForTier, _cfg } from '../ai/tiers.js';
import { redirectToOpenRouter } from '../ai/auth.js';

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
  } else if (tier === 'deluxe') {
    setValue('settings.sceneImage', true);
    setValue('settings.tts', true);
    setValue('settings.stt', true);
  }
  commit();
}

async function setupKey() {
  UI.clear();
  UI.appendEntry('gm',     t('setup.gameName'));
  UI.appendEntry('system', '');

  // Three-option connect flow.
  const choice = await UI.pickFrom(
    t('setup.connectQuestion'),
    ['oauth', 'paste', 'try'],
    x => x === 'oauth' ? t('setup.connectOAuth')
       : x === 'paste' ? t('setup.connectPaste')
       : t('setup.connectTry'),
    0,
  );

  if (choice === 'oauth') {
    // Redirect to OpenRouter — page navigates away, returns with ?code=.
    UI.appendEntry('system', t('setup.connectingOAuth'));
    redirectToOpenRouter();
    // Flow resumes on reload (main.js handles ?code=).
    return;
  }

  if (choice === 'paste') {
    // Manual key paste (existing flow).
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.needKey'));
    UI.appendEntry('system', t('setup.signUp'));
    UI.appendEntry('system', '');
    const key = await UI.prompt(t('setup.pasteKey'));
    setValue('ai.key', key.trim());

    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.defaultUrl', { url: DEFAULT_BASE_URL }));
    const customUrl = await UI.prompt(t('setup.customUrl'));
    if (customUrl.trim()) setValue('ai.baseUrl', customUrl.trim());
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.keySaved'));
  }

  if (choice === 'try') {
    // Shared embedded key — rate-limited.
    setValue('ai.key', _cfg());
    UI.appendEntry('system', '');
  }

  // Tier choice (for paste + try paths; OAuth returns later).
  if (choice !== 'oauth') {
    const tierChoice = await UI.pickFrom(
      t('tier.upgradeQuestion'),
      ['free', 'deluxe'],
      x => x === 'deluxe' ? t('tier.upgradeYes') : t('tier.upgradeNo'),
      0,
    );
    applyTier(tierChoice);
    if (tierChoice === 'deluxe') UI.appendEntry('system', t('tier.upgraded'));
  }
}

// Upgrade to deluxe from settings — prompts for key.
export async function upgradeToDeluxe() {
  const key = await UI.prompt(t('setup.pasteKey'));
  if (!key.trim()) return;
  setValue('ai.key', key.trim());
  const valid = await checkApiKey();
  if (valid) {
    applyTier('deluxe');
    UI.appendEntry('system', t('tier.upgraded'));
  } else {
    UI.appendEntry('error', t('tier.downgraded'));
    setValue('ai.key', _cfg());
    applyTier('free');
  }
}

async function reAuthKey() {
  // Try to re-auth; on failure fall back to free key.
  setValue('ai.key', '');
  tick();
  UI.appendEntry('system', '');
  UI.appendEntry('error', t('setup.keyRejected'));
  const key = await UI.prompt(t('setup.pasteValid'));
  if (key.trim()) {
    setValue('ai.key', key.trim());
    commit();
    UI.appendEntry('system', t('setup.keyUpdated'));
  } else {
    setValue('ai.key', _cfg());
    applyTier('free');
  }
}

export async function ensureKey() {
  // No key at all — first visit. Run setup.
  if (!appState.ai?.key) { await setupKey(); tick(); return; }

  // Returning player with deluxe key — validate it.
  if ((appState.ai?.tier ?? 'free') === 'deluxe') {
    const valid = await checkApiKey();
    if (!valid) {
      UI.appendEntry('error', t('tier.downgraded'));
      setValue('ai.key', _cfg());
      applyTier('free');
    }
  }
  // Free tier with embedded key — always valid, no check needed.
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
  if (cmd === 'map')   { renderRegionMap(); return; }
  if (cmd === 'story') { renderStoryView(); return; }
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

  clearTurnMarks();   // a fresh game must not be undoable into the prior game's history
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
  const seed = Math.floor(Math.random() * 2147483647);
  const blueprint = buildWorldBlueprint(seed);
  const world = generateDungeon(seed, blueprint);
  setValue('world', world);
  setValue('session.phase', 'play');
  commit();

  // Show the dungeon theme in transcript for flavor.
  UI.appendEntry('system', `Theme: ${blueprint.dungeonTheme}. Tone: ${blueprint.tone}.`);
  UI.appendEntry('system', '');

  await beginAdventure();
}

// ─── Campaign flow (worldgen → settlement → dungeon) ─────────────────────────

async function startCampaign() {
  UI.appendEntry('system', '');

  const progress = (key, detail) => {
    if (key === 'detail') UI.appendEntry('system', `  → ${detail}`);
    else UI.appendEntry('system', t(`ai.${key}`));
  };

  // Build the pre-seeded blueprint FIRST so every AI generator receives the same
  // creative constraints (tone, climate, threat, factions, dungeon theme). Without
  // this the campaign got generic, unconstrained AI output — see worldbible.js,
  // which already does this correctly.
  const blueprintSeed = Math.floor(Math.random() * 2147483647);
  const blueprint = buildWorldBlueprint(blueprintSeed);
  progress('detail', `Blueprint: ${blueprint.tone} ${blueprint.worldArchetype}, ${blueprint.threatType}, ${blueprint.climate}.`);

  let seed, factions, beats, region, settlement;

  try {
    // One shared pipeline (library runPipeline) — world → {factions ‖ beats} →
    // region → settlement, with digest threading, retries, and critical-abort.
    const { runWorldgenPipeline } = await import('./worldgen.js');
    const stepKey = { world: 'worldgenStep1', factions: 'worldgenStep2', beats: 'worldgenStep3', region: 'worldgenStep4', settlement: 'worldgenStep5' };
    const out = await runWorldgenPipeline(blueprint, {
      onProgress: (kind, info) => { if (kind === 'step' && stepKey[info.layer]) progress(stepKey[info.layer]); },
    });

    seed       = out.world;       // critical — runPipeline threw if it failed
    factions   = out.factions?.factions ?? [];
    beats      = out.beats?.beats ?? [];
    region     = out.region;      // critical
    settlement = out.settlement;  // critical
    progress('detail', `World: "${seed.name}" (${seed.tone}). Region: "${region.name}". Settlement: "${settlement.name}".`);
  } catch (e) {
    UI.appendEntry('error', `World generation failed: ${e.message}. Falling back to Quick Dungeon.`);
    await startQuickDungeon();
    return;
  }

  // Store world state
  const worldState = {
    ...appState.world,
    blueprint,
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
  commit();

  await enterSettlement(settlement.id);
}

// ─── Settlement scene ────────────────────────────────────────────────────────

// Settlement driver: render a town, run its loop, and — when the player travels
// or fast-travels — transition to the returned settlement WITHOUT nesting a new
// loop (each settlementLoop returns the next settlement id, or null to stop).
async function enterSettlement(settlementId, skipFirstRender = false) {
  let currentId = settlementId;
  let first = true;
  while (currentId && appState.session.phase === 'play') {
    const settlement = appState.world?.settlements?.[currentId];
    if (!settlement) { await startQuickDungeon(); return; }
    // Resume keeps its own banner/transcript on screen — skip the first render.
    if (!(first && skipFirstRender)) renderSettlement(settlement, currentId);
    first = false;
    currentId = await settlementLoop(currentId);
  }
}

// Render the town banner, NPCs, exits, and gold; set the location pointer.
function renderSettlement(settlement, settlementId) {
  clearTurnMarks();   // entering town — dungeon turn marks must not be undoable from a settlement
  setValue('world', { ...appState.world, location: { ...appState.world.location, type: 'settlement', settlementId, dungeonId: null } });
  tick();
  // Phase 4.3: arriving in a region raises a visited flag (a beat prerequisite).
  if (settlement.regionId) setStoryFlag(`visited-${settlement.regionId}`);

  UI.clear();
  UI.appendEntry('system', t('settlement.banner', { name: settlement.name }));
  UI.appendEntry('system', '');
  UI.appendEntry('gm', settlement.description ?? t('settlement.youAreIn', { name: settlement.name }));
  UI.appendEntry('system', '');

  if (settlement.npcs?.length) {
    UI.appendEntry('system', t('settlement.npcList'));
    for (const npc of settlement.npcs) {
      UI.appendEntry('system', `  ${npc.name} — ${npc.role}${npc.personality ? ` (${npc.personality})` : ''}`);
    }
    UI.appendEntry('system', '');
  }

  if (settlement.exits?.length) {
    UI.appendEntry('system', t('settlement.exitList'));
    for (const exit of settlement.exits) {
      UI.appendEntry('system', `  ${exit.direction}: ${exit.targetName} (${exit.targetType})`);
    }
    UI.appendEntry('system', '');
  }

  UI.appendEntry('system', t('settlement.goldLine', { gold: goldOf(appState.party?.pc?.record) }));
  UI.appendEntry('system', '');

  _speak(settlement.description ?? settlement.name);
}

// Action chips for the town menu.
function settlementChips(settlement) {
  const chips = [];
  for (const npc of (settlement.npcs ?? [])) {
    chips.push({ label: t('settlement.talkTo', { name: npc.name }), value: t('settlement.talkCmd', { name: npc.name }) });
  }
  if ((settlement.npcs ?? []).some(n => n.inventory?.length)) {
    chips.push({ label: t('settlement.shop'), value: t('settlement.shopCmd') });
  }
  chips.push({ label: t('settlement.rest'),          value: t('settlement.restCmd') });
  chips.push({ label: t('settlement.questsChip'),    value: t('settlement.questsCmd') });
  chips.push({ label: t('settlement.inventoryChip'), value: t('settlement.inventoryCmd') });
  chips.push({ label: t('settlement.mapChip'),       value: '/map' });
  chips.push({ label: t('settlement.storyChip'),     value: '/story' });
  for (const exit of (settlement.exits ?? [])) {
    chips.push({ label: t('settlement.travelTo', { name: exit.targetName }), value: t('settlement.travelCmd', { name: exit.targetName }) });
  }
  // Fast travel to other settlements already discovered (Phase 3.8).
  for (const [sid, s] of Object.entries(appState.world?.settlements ?? {})) {
    if (sid !== settlement.id) {
      chips.push({ label: t('settlement.fastTravelTo', { name: s.name }), value: `fasttravel:${sid}` });
    }
  }
  return chips;
}

// Run one town's interaction loop. Returns the id of the settlement to travel
// to next (handled by the enterSettlement driver), or null when the loop ends
// (game over). Travel/fast-travel produce a transition rather than nesting.
async function settlementLoop(settlementId) {
  if (!appState.world?.settlements?.[settlementId]) return null;

  while (true) {
    if (appState.session.phase !== 'play') return null;
    const settlement = appState.world.settlements[settlementId];

    UI.showActionChips(settlementChips(settlement));

    const raw = await UI.prompt('');
    if (!raw.trim()) continue;
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }

    // Fast travel to an already-discovered settlement (chip value).
    const ft = raw.match(/^fasttravel:(.+)$/);
    if (ft) { UI.clearChips(); return await fastTravelTo(ft[1]); }

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();

    const action = await classifySettlementInput(raw, settlement);
    const next = await handleSettlementAction(action, settlementId);
    if (next) return next; // travel transition — driver re-renders the new town
  }
}

// Fast travel skips the journey (no encounters). Returns the destination id for
// the driver to transition to, or null if it doesn't exist.
async function fastTravelTo(settlementId) {
  const dest = appState.world?.settlements?.[settlementId];
  if (!dest) return null;
  UI.appendEntry('system', t('travel.fastTravel', { name: dest.name }));
  UI.appendEntry('system', '');
  return settlementId;
}

// ─── Story progress view (Phase 4.9) ─────────────────────────────────────────

// A 10-cell reputation bar from -100 (empty) to +100 (full).
function repBar(rep) {
  const filled = Math.max(0, Math.min(10, Math.round((rep + 100) / 20)));
  return '█'.repeat(filled) + '·'.repeat(10 - filled);
}

function renderStoryView() {
  UI.appendEntry('system', t('story.header'));

  const p = storyProgressNow(); // { done, total, current }
  if (p.total) {
    UI.appendEntry('system', t('story.progress', { done: p.done, total: p.total }));
    UI.appendEntry('system', p.current ? t('story.nextHint') : t('story.complete'));
  } else {
    UI.appendEntry('system', t('story.noThread'));
  }

  const repMap = appState.world?.factionReputation ?? {};
  const facEntries = Object.entries(repMap);
  if (facEntries.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.factionsHeader'));
    for (const [id, rep] of facEntries) {
      const name = appState.world?.factions?.[id]?.name ?? id;
      const stand = standing(rep);
      UI.appendEntry('system', t('story.factionLine', { name, bar: repBar(rep), rep, standing: t(`story.standing.${stand}`) }));
    }
  }

  const aq = activeQuests(appState.world?.quests ?? {});
  if (aq.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.questsHeader'));
    for (const q of aq) {
      UI.appendEntry('system', t('settlement.questLine', { desc: q.description, status: t('settlement.status.active'), npc: q.npcName }));
    }
  }

  const flags = Object.keys(appState.world?.redThread?.flags ?? {}).filter(f => !f.startsWith('beat-done-'));
  if (flags.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.flagsHeader'));
    UI.appendEntry('system', '  ' + flags.slice(-8).join('  ·  '));
  }
  UI.appendEntry('system', '');
}

// ─── Region map (Phase 3.6) ───────────────────────────────────────────────────

function renderRegionMap() {
  const regions = Object.values(appState.world?.regions ?? {});
  if (!regions.length) { UI.appendEntry('system', t('map.empty')); return; }
  const curRegionId = appState.world?.location?.regionId;
  const curSettlementId = appState.world?.location?.settlementId;
  UI.appendEntry('system', t('map.header'));
  for (const r of regions) {
    const here = r.id === curRegionId ? t('map.youAreHere') : '';
    UI.appendEntry('system', t('map.regionLine', { name: r.name, climate: r.climate ?? '?', here }));
    for (const sid of (r.settlements ?? [])) {
      const s = appState.world.settlements?.[sid];
      if (s) UI.appendEntry('system', t('map.settlementLine', { name: s.name, here: sid === curSettlementId ? t('map.youAreHere') : '' }));
    }
    if (r.adjacentRegions?.length) {
      UI.appendEntry('system', t('map.connectsLine', { names: r.adjacentRegions.join(', ') }));
    }
  }
  UI.appendEntry('system', '');
}

// Compact world snapshot for the settlement classifier.
function settlementContext(settlement) {
  return {
    settlement: settlement.name,
    npcs:    (settlement.npcs ?? []).map(n => ({ name: n.name, role: n.role, sells: !!n.inventory?.length })),
    exits:   (settlement.exits ?? []).map(e => ({ to: e.targetName, type: e.targetType })),
    gold:    goldOf(appState.party?.pc?.record),
  };
}

// Classify town input with the tiny-tier LLM, normalising to a concrete action.
// Falls back to keyword matching when the AI is unavailable.
async function classifySettlementInput(raw, settlement) {
  try {
    const { classifySettlement } = await import('../ai/dialogue.js');
    const r = await classifySettlement(raw, settlementContext(settlement));
    return normalizeSettlementAction(r, settlement);
  } catch {
    return fallbackSettlementAction(raw, settlement);
  }
}

function findNpc(settlement, target) {
  const npcs = settlement.npcs ?? [];
  if (!target) return npcs[0] ?? null;
  const tl = String(target).toLowerCase();
  return npcs.find(n => n.id === target)
      ?? npcs.find(n => n.name.toLowerCase().includes(tl) || tl.includes(n.name.toLowerCase()))
      ?? npcs.find(n => n.role.toLowerCase() === tl)
      ?? npcs[0] ?? null;
}

function findExit(settlement, target) {
  const exits = settlement.exits ?? [];
  if (!target) return exits[0] ?? null;
  const tl = String(target).toLowerCase();
  return exits.find(e => e.targetId === target)
      ?? exits.find(e => e.targetName.toLowerCase().includes(tl) || tl.includes(e.targetName.toLowerCase()))
      ?? exits.find(e => e.direction.toLowerCase() === tl)
      ?? exits[0] ?? null;
}

function normalizeSettlementAction(r, settlement) {
  const intent = r?.intent ?? 'look';
  if (intent === 'talk')   return { type: 'talk',   npc:  findNpc(settlement, r?.target) };
  if (intent === 'travel') return { type: 'travel', exit: findExit(settlement, r?.target) };
  if (intent === 'buy')    return { type: 'buy' };
  if (intent === 'rest')   return { type: 'rest' };
  if (intent === 'quest')  return { type: 'quest' };
  if (intent === 'inventory') return { type: 'inventory' };
  return { type: 'look' };
}

// Keyword fallback (offline / AI failure). Mirrors the old resolver plus the
// new verbs so the town stays playable without an LLM.
function fallbackSettlementAction(raw, settlement) {
  const lower = raw.toLowerCase();
  if (/(inventor|pack|carry|bezit|rugzak)/.test(lower)) return { type: 'inventory' };
  if (/(quest|task|opdracht|missie)/.test(lower))       return { type: 'quest' };
  if (/(rest|sleep|inn|rust|slaap|herberg)/.test(lower)) return { type: 'rest' };
  if (/(buy|shop|trade|purchase|koop|winkel|handel)/.test(lower)) return { type: 'buy' };
  for (const npc of (settlement.npcs ?? [])) {
    if (lower.includes(npc.name.toLowerCase()) || lower.includes(npc.role.toLowerCase())) return { type: 'talk', npc };
  }
  if (/(talk|speak|praat|spreek)/.test(lower)) return { type: 'talk', npc: settlement.npcs?.[0] ?? null };
  for (const exit of (settlement.exits ?? [])) {
    if (lower.includes(exit.targetName.toLowerCase()) || lower.includes(exit.direction.toLowerCase())) return { type: 'travel', exit };
  }
  if (/(travel|go|leave|reis|ga|vertrek)/.test(lower)) return { type: 'travel', exit: settlement.exits?.[0] ?? null };
  return { type: 'look' };
}

// Returns a settlement id to transition to (travel), or undefined to stay.
async function handleSettlementAction(action, settlementId) {
  const settlement = appState.world.settlements[settlementId];
  switch (action.type) {
    case 'talk':
      if (action.npc) await converseWithNpc(settlementId, action.npc.id);
      else UI.appendEntry('system', t('settlement.noOneHere'));
      return;
    case 'buy':       await openShop(settlementId); return;
    case 'rest':      await doRest(settlementId); return;
    case 'quest':     showQuests(); return;
    case 'inventory': showInventory(); return;
    case 'travel':
      if (!action.exit) { UI.appendEntry('system', t('settlement.noPath')); return; }
      return await doTravel(action.exit, settlementId);
    default:
      UI.appendEntry('gm', t('settlement.lookResult', { name: settlement.name }));
  }
}

// ─── NPC conversation (Phase 2) ───────────────────────────────────────────────

// Persist an updated NPC object back into world.settlements[id].npcs.
function commitNpc(settlementId, npc) {
  const settlement = appState.world.settlements[settlementId];
  const npcs = (settlement.npcs ?? []).map(n => n.id === npc.id ? npc : n);
  const settlements = { ...appState.world.settlements, [settlementId]: { ...settlement, npcs } };
  setValue('world', { ...appState.world, settlements });
}

async function converseWithNpc(settlementId, npcId) {
  let npc = (appState.world.settlements[settlementId].npcs ?? []).find(n => n.id === npcId);
  if (!npc) return;

  // First contact — greeting + optional quest offer.
  if (!npc.dialogueHistory?.length) {
    UI.appendEntry('gm', `${npc.name}: "${npc.greeting}"`);
    _speak(npc.greeting);
    if (npc.questHook && !appState.world.quests?.[questId(npc)]) {
      UI.appendEntry('system', t('settlement.questOffer', { name: npc.name, hook: npc.questHook }));
      const accept = await UI.pickFrom(t('settlement.questAcceptQ'), ['yes', 'no'], x => x === 'yes' ? t('common.yes') : t('common.no'), 0);
      if (accept === 'yes') {
        setValue('world', { ...appState.world, quests: addQuest(appState.world.quests, makeQuest(npc)) });
        tick();          // commit + persist now — the player may leave before any exchange
        // Phase 4.7: taking a faction's task earns a little goodwill.
        if (npc.factionId) awardReputation(npc.factionId, 5);
        saveToStorage();
        UI.appendEntry('system', t('settlement.questAccepted', { hook: npc.questHook }));
      } else {
        UI.appendEntry('system', t('settlement.questDeclined'));
      }
    }
  }

  // Conversation loop — one exchange at a time, memory persisted per NPC.
  while (true) {
    UI.showActionChips([{ label: t('settlement.leaveChip', { name: npc.name }), value: t('settlement.leaveCmd') }]);
    const line = await UI.prompt('');
    if (!line.trim()) break;
    if (/^\s*(leave|bye|goodbye|stop|done|weg|dag|stoppen)\b/i.test(line) || line === t('settlement.leaveCmd')) break;

    UI.appendEntry('player', `> ${line}`);
    UI.clearChips();
    UI.setThinking(true);

    let resp;
    try {
      const { npcReply } = await import('../ai/dialogue.js');
      const stand = npc.factionId ? reputationStanding(npc.factionId) : 'neutral';
      resp = await npcReply(npc, line, npc.dialogueHistory ?? [], { mayRevealSecret: canRevealSecret(npc), reputation: stand });
    } catch {
      resp = { reply: t('settlement.npcSilent', { name: npc.name }), revealsSecret: false };
    }
    UI.setThinking(false);

    UI.appendEntry('gm', `${npc.name}: "${resp.reply}"`);
    _speak(resp.reply);

    const revealed = !!resp.revealsSecret && canRevealSecret(npc);
    let history = pushDialogue(npc.dialogueHistory, 'player', line);
    history = pushDialogue(history, 'npc', resp.reply);
    npc = { ...npc, dialogueHistory: history, secretRevealed: npc.secretRevealed || revealed };
    commitNpc(settlementId, npc);
    tick();          // merge before the next setValue('world') / read, else deltas clobber

    if (revealed) {
      UI.appendEntry('system', t('settlement.secretRevealed', { name: npc.name, secret: npc.secret }));
      setStoryFlag(`secret-${slug(npc.id ?? npc.name)}-revealed`);
      tick();
    }
    saveToStorage();
  }
}

// ─── Trade (Phase 2) ──────────────────────────────────────────────────────────

async function openShop(settlementId) {
  const settlement = appState.world.settlements[settlementId];
  const merchants = (settlement.npcs ?? []).filter(n => n.inventory?.length);
  if (!merchants.length) { UI.appendEntry('system', t('settlement.shopEmpty')); return; }

  while (true) {
    // Aggregate wares, applying each merchant's faction standing to prices.
    // Hostile-faction merchants refuse to trade with the player entirely.
    const wares = [];
    for (const m of (appState.world.settlements[settlementId].npcs ?? []).filter(n => n.inventory?.length)) {
      const stand = m.factionId ? reputationStanding(m.factionId) : 'neutral';
      if (isHostile(stand)) continue;
      for (const item of m.inventory) {
        wares.push({ npc: m.name, item: { ...item, price: adjustPrice(item.price, stand) } });
      }
    }
    if (!wares.length) { UI.appendEntry('system', t('settlement.shopRefused')); return; }
    UI.appendEntry('system', t('settlement.shopBanner', { gold: goldOf(appState.party?.pc?.record) }));
    const chips = wares.map((w, i) => ({
      label: t('settlement.buyChip', { name: w.item.name, price: w.item.price }),
      value: `buy:${i}`,
    }));
    chips.push({ label: t('settlement.leaveShop'), value: t('settlement.leaveShopCmd') });
    UI.showActionChips(chips);

    const pick = await UI.prompt('');
    UI.clearChips();
    if (!pick.trim()) break;
    const m = pick.match(/^buy:(\d+)$/);
    let chosen = null;
    if (m) chosen = wares[Number(m[1])];
    else if (/(leave|done|exit|weg|klaar)/i.test(pick) || pick === t('settlement.leaveShopCmd')) break;
    else chosen = wares.find(w => pick.toLowerCase().includes(w.item.name.toLowerCase()));

    if (!chosen) { UI.appendEntry('system', t('settlement.noSuchItem')); continue; }

    const res = resolvePurchase(appState.party?.pc?.record, chosen.item);
    if (!res.ok) {
      UI.appendEntry('system', t('settlement.cantAfford', { name: chosen.item.name, short: res.short }));
      continue;
    }
    // Commit: deduct gold, add to carried inventory. tick() merges the delta
    // into appState BEFORE the next loop reads gold and before saveToStorage()
    // (which serialises appState, not the pending delta).
    const record = { ...appState.party.pc.record, gold: res.gold };
    setValue('party', {
      ...appState.party,
      pc:        { ...appState.party.pc, record },
      inventory: addToInventory(appState.party?.inventory, res.item),
    });
    commit();
    UI.appendEntry('gm', t('settlement.bought', { name: chosen.item.name, price: res.price, gold: res.gold }));
  }
}

// ─── Rest (Phase 2) ───────────────────────────────────────────────────────────

async function doRest(settlementId) {
  const settlement = appState.world.settlements[settlementId];
  const pc = appState.party?.pc;
  if (!pc) return;

  // Inn price comes from an innkeeper's inventory if present, else a default;
  // no innkeeper at all → free rest.
  const innkeeper = (settlement.npcs ?? []).find(n => n.role === 'innkeeper');
  const innItem   = innkeeper?.inventory?.find(i => /(room|bed|night|inn|kamer|bed)/i.test(i.name));
  const cost      = innkeeper ? (innItem?.price ?? DEFAULT_REST_COST) : 0;

  const res = resolveRest(pc.record, pc.sheet.hp.max, cost);
  if (!res.ok) { UI.appendEntry('system', t('settlement.cantAffordRest', { short: res.short })); return; }

  const record = { ...pc.record, gold: res.gold, hpCurrent: res.hpCurrent, conditions: [], deathSaves: undefined };
  setValue('party', { ...appState.party, pc: { ...pc, record } });
  tick();          // merge the delta into appState before saveToStorage()
  saveToStorage();
  UI.appendEntry('gm', cost > 0
    ? t('settlement.restDone', { gold: res.gold })
    : t('settlement.restFree'));
  _speak(cost > 0 ? t('settlement.restDone', { gold: res.gold }) : t('settlement.restFree'));
}

// ─── Quest log + inventory (Phase 2) ─────────────────────────────────────────

// Phase 4.3/4.7: clearing a dungeon completes the player's active quests, raises
// quest-done flags (beat prerequisites), and rewards the quest-givers' factions.
function resolveDungeonQuests() {
  const quests = appState.world?.quests ?? {};
  const active = activeQuests(quests);
  if (!active.length) return;
  let map = quests;
  for (const q of active) map = setQuestStatus(map, q.id, 'completed');
  setValue('world', { ...appState.world, quests: map });
  tick();
  for (const q of active) {
    setStoryFlag(`quest-${q.id}-done`);
    if (q.factionId) awardReputation(q.factionId, 15);
    UI.appendEntry('system', t('settlement.questCompleted', { desc: q.description }));
  }
  saveToStorage();
}

function showQuests() {
  const quests = Object.values(appState.world?.quests ?? {});
  if (!quests.length) { UI.appendEntry('system', t('settlement.questsEmpty')); return; }
  UI.appendEntry('system', t('settlement.questsHeader'));
  for (const q of quests) {
    UI.appendEntry('system', t('settlement.questLine', { desc: q.description, status: t(`settlement.status.${q.status}`), npc: q.npcName }));
  }
}

function showInventory() {
  const pc = appState.party?.pc;
  const items = appState.party?.inventory ?? [];
  UI.appendEntry('system', t('settlement.goldLine', { gold: goldOf(pc?.record) }));
  if (!items.length) { UI.appendEntry('system', t('settlement.inventoryEmpty')); return; }
  UI.appendEntry('system', t('settlement.inventoryHeader'));
  for (const it of items) {
    const qty = (it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : '';
    UI.appendEntry('system', t('settlement.invLine', { name: it.name, qty }));
  }
}

// ─── Travel from settlement (dungeon now; overworld in Phase 3) ───────────────

async function doTravel(exit, settlementId) {
  const settlement = appState.world.settlements[settlementId];
  UI.appendEntry('system', t('settlement.travelDungeon', { name: exit.targetName }));
  UI.appendEntry('system', '');

  if (exit.targetType === 'dungeon') {
    await enterDungeon(exit, settlementId);
    // Back in town — restore the location pointer so a save/resume routes to the
    // settlement loop, not the (now-cleared) dungeon (enterDungeon set it to
    // 'dungeon').
    setValue('world', { ...appState.world, location: { ...appState.world.location, type: 'settlement', dungeonId: null } });
    commit();
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('settlement.returnSettlement', { name: settlement.name }));
    UI.appendEntry('system', '');
    return; // stay in this settlement; the driver re-renders it
  }
  // Road / wilderness — overworld travel sequence (Phase 3) → arrival id.
  return await doOverworldTravel(exit, settlementId);
}

// ─── Overworld travel (Phase 3) ───────────────────────────────────────────────

// Climate-flavoured wilderness encounter pool: the base wilderness creatures
// plus the lower-CR creatures of the world's dungeon theme, for variety.
function overworldEncounterPool() {
  const pool = [...OVERWORLD_ENEMY_IDS];
  return pool;
}

// A short journey toward a road/wilderness exit. Narrates each beat, rolls
// encounters (handed to the shared combat loop) and discoveries, then arrives
// at a lazily-generated neighbouring settlement.
async function doOverworldTravel(exit, fromSettlementId, opts = {}) {
  const rng = Math.random;
  let travel = beginTravel(exit.targetName, rng);
  const climate = appState.world?.regions?.[appState.world?.location?.regionId]?.climate
               ?? appState.world?.blueprint?.climate ?? 'wilderness';

  while (!isTravelDone(travel)) {
    const res = stepTravel(travel, rng, { safe: !!opts.safe });
    travel = res.travel;
    const ev = res.event;

    if (ev.type === 'depart') {
      await narrateTravelBeat('depart', { destination: exit.targetName, climate });
    } else if (ev.type === 'uneventful') {
      await narrateTravelBeat('segment', { destination: exit.targetName, climate });
    } else if (ev.type === 'arrive') {
      await narrateTravelBeat('arrive', { destination: exit.targetName, climate });
    } else if (ev.type === 'encounter') {
      const id = pickEncounter(overworldEncounterPool(), rng);
      const outcome = await runEncounter(id);
      if (outcome === 'defeat') { await doDefeat(); return null; }
    } else if (ev.type === 'discovery') {
      await applyDiscovery(ev.discovery, climate);
    }
    if (appState.party?.pc?.record?.deathSaves?.dead) { await doDefeat(); return null; }
  }

  // Arrived — return the destination settlement id to the settlement driver,
  // which transitions without nesting a new loop.
  return await arriveAtDestination(exit, fromSettlementId);
}

// Narrate a travel beat with the medium-tier LLM, falling back to a templated
// locale line if the AI is unavailable.
async function narrateTravelBeat(kind, ctx) {
  let text = null;
  if ((appState.ai?.tier ?? 'free') === 'deluxe') {
    try {
      const { narrateTravel } = await import('../ai/narrate.js');
      text = await narrateTravel({ beat: kind, ...ctx });
    } catch { text = null; }
  }
  if (!text || !text.trim()) text = t(`travel.${kind}`, ctx);
  UI.appendEntry('gm', text);
  UI.appendEntry('system', '');
  _speak(text);
}

// ─── Travel combat encounter — reuses the dungeon turn loop ───────────────────

async function runEncounter(enemyId) {
  if (!enemyId) return 'flee';
  // Snapshot the active dungeon-combat fields so travel doesn't corrupt them.
  const snap = {
    currentRoom: appState.world.currentRoom,
    exitRoomId:  appState.world.exitRoomId,
    rooms:       appState.world.rooms,
    npcs:        appState.world.npcs,
    location:    appState.world.location,
  };

  const enemy = buildEnemy(enemyId, { npcId: 'enc-1', roomId: 'encounter' });
  setValue('world', {
    ...appState.world,
    currentRoom: 'encounter',
    // currentRoom === exitRoomId so that a reload mid-encounter resolves through
    // playLoop's vault-guarded victory gate (fight the enemy, then win) instead
    // of soft-locking in an exit-less room.
    exitRoomId:  'encounter',
    rooms:       { encounter: { id: 'encounter', name: t('travel.encounterRoom'), description: enemy.intro, exits: [], loot: [] } },
    npcs:        { 'enc-1': enemy },
    location:    { ...appState.world.location, type: 'encounter' },
  });
  tick();

  UI.appendEntry('gm', enemy.intro);
  _speak(enemy.intro);

  let outcome = 'win';
  while (true) {
    if (!appState.world.npcs['enc-1']?.alive) { outcome = 'win'; break; }
    if (appState.party?.pc?.record?.deathSaves?.dead) { outcome = 'defeat'; break; }

    UI.showRoomChips([], []);
    UI.showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
    UI.showSkillChips(appState.session?.skillCooldowns ?? {});
    UI.insertActionChip(t('travel.fleeChip'), t('travel.fleeCmd'));

    const raw = await UI.prompt('');
    if (!raw.trim()) continue;
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }
    if (/^\s*(flee|run|escape|vlucht|ren)\b/i.test(raw) || raw === t('travel.fleeCmd')) {
      UI.appendEntry('player', `> ${raw}`);
      outcome = 'flee';
      break;
    }

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true);

    let streamEl = null;
    const onChunk = (text) => { if (!streamEl) { UI.setThinking(false); streamEl = UI.beginStreamEntry('gm'); } UI.appendStreamChunk(streamEl, text); };

    let result = null;
    try {
      result = await processTurn(raw, onChunk);
    } catch (e) {
      UI.setThinking(false); streamEl?.remove();
      UI.appendEntry('error', t('loop.error', { msg: e.message }));
      continue;
    }
    tick();
    UI.setThinking(false);
    if (!streamEl && result?.narration) UI.appendEntry('gm', result.narration);
    UI.appendEntry('system', '');
    _speak(result?.narration);
    UI.updateDebugPanel(result?._debug);
  }

  UI.clearChips();
  // Restore the pre-encounter world fields.
  setValue('world', { ...appState.world, ...snap });
  commit();

  if (outcome === 'win')      UI.appendEntry('system', t('travel.encounterWin'));
  else if (outcome === 'flee') UI.appendEntry('gm', t('travel.encounterFlee'));
  return outcome;
}

// ─── Travel discoveries (Phase 3) ─────────────────────────────────────────────

async function applyDiscovery(discovery, climate) {
  const pc = appState.party?.pc;
  switch (discovery) {
    case 'loot': {
      const pool = tRaw('world.loot') ?? [];
      const item = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { name: 'trinket', desc: '' };
      const entry = { id: slug(item.name), name: item.name, description: item.desc ?? '', quantity: 1 };
      setValue('party', { ...appState.party, inventory: addToInventory(appState.party?.inventory, entry) });
      commit();
      UI.appendEntry('gm', t('travel.discoveryLoot', { name: item.name }));
      break;
    }
    case 'shrine': {
      if (pc) {
        const record = { ...pc.record, hpCurrent: pc.sheet.hp.max, conditions: [], deathSaves: undefined };
        setValue('party', { ...appState.party, pc: { ...pc, record } });
        commit();
      }
      UI.appendEntry('gm', t('travel.discoveryShrine'));
      break;
    }
    case 'clue': {
      const n = Object.keys(appState.world?.redThread?.flags ?? {}).filter(f => f.startsWith('clue-')).length + 1;
      setStoryFlag(`clue-${n}`);
      UI.appendEntry('gm', t('travel.discoveryClue'));
      break;
    }
    case 'wanderer':
    default: {
      const gift = 3 + Math.floor(Math.random() * 6);
      if (pc) {
        const record = { ...pc.record, gold: goldOf(pc.record) + gift };
        setValue('party', { ...appState.party, pc: { ...pc, record } });
        commit();
      }
      UI.appendEntry('gm', t('travel.discoveryWanderer', { gold: gift }));
      break;
    }
  }
  UI.appendEntry('system', '');
}

// ─── Arrival: lazy region + settlement generation (Phase 3) ───────────────────

// Returns the settlement id the player arrives at (the driver transitions to it).
async function arriveAtDestination(exit, fromSettlementId) {
  // If this exit points at an already-known settlement, just go there.
  if (exit.targetId && appState.world?.settlements?.[exit.targetId]) return exit.targetId;

  // Campaign + Deluxe: generate a neighbouring region + settlement on the fly,
  // keeping the world's identity (tone/threat/factions) but varying the locale.
  if ((appState.ai?.tier ?? 'free') === 'deluxe' && appState.world?.blueprint) {
    UI.appendEntry('system', t('travel.discovering', { name: exit.targetName }));
    const built = await generateNeighbourRegion(exit);
    if (built) return built.settlementId;
  }

  // Fallback — no lazy gen available: return to the origin settlement.
  UI.appendEntry('gm', t('travel.deadEnd', { name: exit.targetName }));
  return fromSettlementId;
}

async function generateNeighbourRegion(exit) {
  const base = appState.world.blueprint;
  const seed = Math.floor(Math.random() * 2147483647);
  const fresh = buildWorldBlueprint(seed);
  // Keep world identity; vary climate/settlement/dungeon/buildings/landmarks.
  const bp = { ...fresh, tone: base.tone, worldArchetype: base.worldArchetype, threatType: base.threatType,
               beatArc: base.beatArc, factionSlots: base.factionSlots, godDomains: base.godDomains };

  try {
    const { generateRegion, generateSettlement } = await import('./worldgen.js');
    const parentDigest = appState.world?.digest ?? appState.world?.name ?? 'the known world';
    const region = await generateRegion(parentDigest, bp);
    if (!region) return null;
    region.id ??= `region-${seed}`;
    if (!region.digest) region.digest = `${region.name} — ${region.climate}.`;

    const settlement = await generateSettlement(region.digest, region.id, bp);
    if (!settlement) return null;
    settlement.id ??= `settlement-${seed}`;
    if (!settlement.digest) settlement.digest = `${settlement.name} — ${(settlement.npcs ?? []).map(n => n.name).join(', ')}.`;

    const fromRegionId = appState.world.location.regionId;
    const regions = {
      ...appState.world.regions,
      [region.id]: { ...region, settlements: [settlement.id], dungeons: [], adjacentRegions: region.adjacentHints ?? [], blueprint: bp },
    };
    // Link the origin region to the new one for the map.
    if (regions[fromRegionId]) {
      const adj = new Set([...(regions[fromRegionId].adjacentRegions ?? []), region.name]);
      regions[fromRegionId] = { ...regions[fromRegionId], adjacentRegions: [...adj] };
    }
    const settlements = { ...appState.world.settlements, [settlement.id]: { ...settlement, regionId: region.id } };
    setValue('world', { ...appState.world, regions, settlements,
      location: { ...appState.world.location, regionId: region.id } });
    commit();
    return { regionId: region.id, settlementId: settlement.id };
  } catch (e) {
    console.warn('Neighbour region generation failed:', e.message);
    return null;
  }
}

// ─── Enter dungeon from settlement ───────────────────────────────────────────

async function enterDungeon(exit, settlementId) {
  clearTurnMarks();   // fresh dungeon context — never inherit a prior dungeon/town's undo marks
  const dungeonId = exit.targetId ?? `dungeon-${Date.now()}`;

  // Generate dungeon if not already in world state
  if (!appState.world?.dungeons?.[dungeonId]) {
    const dungeon = createDungeonEntry({
      id:        dungeonId,
      name:      exit.targetName,
      regionId:  appState.world?.location?.regionId ?? null,
      blueprint: appState.world?.blueprint ?? null,
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

  commit();

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

async function beginAdventure() {
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
  if (appState.settings?.actionBar)  UI.updateActionBar(room.exits ?? []);
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

async function playLoop() {
  let pendingRetry = null;
  const visitedRooms = new Set();

  while (true) {
    // Track the current room as visited.
    const currentRoomId = appState.world?.currentRoom;
    if (currentRoomId) visitedRooms.add(currentRoomId);
    if (appState.session.phase !== 'play') break;

    const inExitRoom = appState.world?.currentRoom === appState.world?.exitRoomId;
    // The vault holds a boss — victory only triggers once it (and any other
    // hostile in the vault) is dead, so the player can't walk past the fight.
    const vaultGuarded = inExitRoom && Object.values(appState.world?.npcs ?? {})
      .some(n => n.roomId === appState.world?.exitRoomId && n.alive && n.attitude === 'hostile');
    if (inExitRoom && !vaultGuarded) {
      // Campaign mode: return to settlement. Quick dungeon: victory screen.
      if (appState.world?.location?.type === 'dungeon' && appState.world?.location?.settlementId) {
        // Mark dungeon complete
        const did = appState.world.location.dungeonId;
        if (did && appState.world.dungeons?.[did]) {
          const dungeons = { ...appState.world.dungeons, [did]: { ...appState.world.dungeons[did], completed: true } };
          setValue('world', { ...appState.world, dungeons });
          tick();
        }
        if (did) setStoryFlag(`dungeon-${did}-complete`);
        resolveDungeonQuests();   // Phase 4.3/4.7: complete quests + reward factions
        await doVictory();
        return; // return to settlementLoop caller
      }
      await doVictory();
      break;
    }

    // Defeat only once the PC has actually died (three failed death saves).
    // At 0 HP but not dead, the PC is downed and the turn resolves as a death
    // save (loop.js → processDownTurn).
    if (appState.party?.pc?.record?.deathSaves?.dead) { await doDefeat(); break; }

    _cancelSpeech();

    const room = appState.world?.rooms?.[appState.world?.currentRoom];
    const autoplay = appState.settings?.autoplay;

    if (!autoplay) {
      UI.showRoomChips(room?.exits ?? [], room?.loot ?? []);
      UI.showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
      UI.showSkillChips(appState.session?.skillCooldowns ?? {});
      if (appState.settings?.actionBar) {
        UI.updateActionBar(room?.exits ?? []);
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

        // Build structured navigation hint with one-hop lookahead.
        const allRooms = appState.world?.rooms ?? {};
        const navLines = [`Current room: ${room?.name ?? currentRoomId}`];

        let hasUnvisited = false;
        for (const exit of (room?.exits ?? [])) {
          const targetRoom = allRooms[exit.roomId];
          const visited = visitedRooms.has(exit.roomId);
          const lock = exit.locked ? ' [LOCKED]' : '';

          if (!visited) {
            navLines.push(`  ${exit.dir} → ${targetRoom?.name ?? exit.roomId} — UNVISITED${lock} ← GO HERE`);
            hasUnvisited = true;
          } else {
            // Check if this visited room connects to any unvisited rooms (lookahead).
            const leadsToNew = (targetRoom?.exits ?? []).some(e => !visitedRooms.has(e.roomId) && e.roomId !== currentRoomId);
            if (leadsToNew) {
              navLines.push(`  ${exit.dir} → ${targetRoom?.name ?? exit.roomId} — visited, but LEADS TO UNVISITED ROOMS ← backtrack through here`);
            } else {
              navLines.push(`  ${exit.dir} → ${targetRoom?.name ?? exit.roomId} — visited, dead end`);
            }
          }
        }

        if (!hasUnvisited) navLines.push('All adjacent rooms visited — backtrack to reach new areas.');
        const navigationHint = 'NAVIGATION:\n' + navLines.join('\n');

        raw = await generateAutoAction(scene, actions, appState.transcript ?? [], navigationHint);
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
    await enterSettlement(appState.world.location.settlementId, true);
  } else {
    await playLoop();
  }
}
