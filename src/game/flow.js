// src/game/flow.js — game lifecycle FSM.
//
// Owns: new game, resume, play loop, end states, key setup, scene images.
// All AI calls go through loop.js (checkApiKey, generateTurnImage, processTurn).

import { appState, setValue, tick, saveToStorage, clearSave, restoreState, commit } from '../core/state.js';
import { generateDungeon, createDungeonEntry, buildEnemy } from './world.js';
import { buildWorldBlueprint } from './worldseed.js';
import { OVERWORLD_ENEMY_IDS } from './creatures.js';
import { createCharacter } from './character.js';
import { processTurn, generateTurnImage, buildScene, drainActClose } from './loop.js';
// Key acquisition, tier application and model healing live in their own module:
// they all run before the first turn or between campaigns, touch only
// appState.ai / settings, and share nothing with the play loop.
import { ensureKey, upgradeToDeluxe, requireDeluxe, applyTier, useDemoKey, setupKey }
  from './session-setup.js';
import { describeAiError } from '../ai/errors.js';
// The read-only screens (/story, the map, quests, inventory) live in views.js:
// they read state and print, and share nothing with the loop that mutates it.
import { renderStoryView, renderRegionMap, showQuests, showInventory,
         resolveDungeonQuests, renderLexiconAnswer, renderLexiconTopics,
         tryLexicon } from './views.js';
import { clearTurnMarks, setScrubHandler } from './undo.js';
import { enterEncounterState, exitEncounterState } from './encounter-state.js';
import { cutChapter, shouldCutChapter, recap, chapterIndex } from './chapters.js';
import { awardMilestone, announcementFor, xpProgress, awardXp, xpForKill } from './progression.js';
import { storyStalled, gmDirective, raiseFlag, progress as storyProgress, actNumber } from './acts-runtime.js';
import { armThreatClocks, rumours, activeThreatsAt, resolveThreat } from './world-clocks.js';
import { statBlockFor } from './bestiary.js';
import { initAtlas, initialAtlas, stubToward, hydrateRegion, mapView,
         applyContinentOutlines, applyProvinceOutline, provinceOf,
         seaLaneFrom, addRegionUnderProvince, landedRegionOf } from './atlas.js';
import { seedCombat }     from './rng.js';
import {
  goldOf, resolvePurchase, addToInventory, resolveRest, DEFAULT_REST_COST,
  questId, makeQuest, addQuest, canRevealSecret, pushDialogue, slug,
  setQuestStatus, activeQuests,
  adjustPrice, isHostile, standing,
  beginTravel, stepTravel, isTravelDone, pickEncounter,
} from 'bag-of-holding-client';
import { setStoryFlag, awardReputation, reputationStanding, requeueActClose } from './story.js';
import { recordCanon, markEncountered, currentPlaceId } from './ledger.js';
import { activePack, applyPackOverlay, packIds, packCard, packTagline, pickPack, resolvePack } from '../settings/index.js';
import * as UI from '../ui/console.js';
import { t, tRaw, locale } from '../i18n/i18n.js';
import { getSkills } from '../ui/chips.js';

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

// Record a scene's opening 'gm' narration into appState.transcript so a
// time-travel scrub (rebuildTranscript renders only from appState.transcript)
// and a reload keep the starting text — the UI.appendEntry calls that show the
// opening are DOM-only. Committed so it persists immediately, even before the
// first action of the scene.
function recordOpening(text) {
  if (!text) return;
  const turn = appState.session?.turnCount ?? 0;
  // Narrow per-index append — the whole-array rewrite this replaced recorded a
  // full transcript copy into Spektrum history at every scene opening, the
  // exact growth pattern the S4 fix removed from the turn path.
  const i = (appState.transcript ?? []).length;
  setValue(`transcript.${i}`, { role: 'gm', text, turn });
  commit();
}

// Per-turn scene image cache (data-URIs), keyed by turn number — out of Spektrum
// history, so a time-travel scrub restores the right background imperatively
// without recording anything. (Keyed by turn count; two branches that share a
// turn number share a slot — acceptable for a decorative background.)
const sketchByTurn = new Map();

// On a live undo/redo/branch scrub, follow the timeline: trim the journal to the
// live turn (drop undone turns from the EPUB/sketch exports) and restore the
// scene image for that turn (or blank it). Registered with the time-travel layer
// (NOT called on boot reconstruction, which would blank the reload-restored
// image). Cross-branch image identity is approximate; narration is always
// recovered exactly from appState.transcript.
setScrubHandler((turn) => {
  const kept = journalLog.filter(e => (e.turn ?? 0) <= turn);
  journalLog.length = 0;
  journalLog.push(...kept);

  const view = appState.settings?.sketchView ?? 'windowed';
  if (view === 'minimized') return;                 // respect a minimized sketch
  const src = sketchByTurn.get(turn);
  if (src) { UI.setSketchOpacity(view); UI.setSceneImage(src); }   // ensure visible, then set
  else     { UI.hideSceneImage(); }                 // no image for this turn → blank the stale one
});

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

// ─── Image rationing ─────────────────────────────────────────────────────────
//
// A sketch used to be generated EVERY turn, at roughly 47x the cost of the text
// it illustrated — three turns of swinging at the same goblin in the same room
// bought three near-identical drawings of that room. A sketch now costs
// something only when the picture would actually change: a new room, a new
// chapter, or the player asking for one. Nothing about the display changes;
// the last image simply stays up until there is a reason for a new one.

let _lastSketchRoom = null;

// Should this turn pay for a sketch? `force` is the "sketch this" chip.
function sketchIsDue({ force = false } = {}) {
  if (!appState.settings?.sceneImage) return false;
  if ((appState.settings?.sketchView ?? 'windowed') === 'minimized') return false;
  if (force) return true;
  const here = `${appState.world?.location?.regionId ?? ''}/${appState.world?.currentRoom ?? ''}`;
  return here !== _lastSketchRoom;
}

// Called on every accepted sketch so the next turn in the same room is free.
function markSketched() {
  _lastSketchRoom = `${appState.world?.location?.regionId ?? ''}/${appState.world?.currentRoom ?? ''}`;
}

// The "sketch this" action: draw the current scene on demand, regardless of
// whether the room changed.
export function sketchThisScene() {
  const last = journalLog[journalLog.length - 1] ?? null;
  return requestSceneImage(last?.narration ?? null, last, { force: true });
}

function requestSceneImage(narration, journalEntry = null, { force = false } = {}) {
  if (!sketchIsDue({ force })) return Promise.resolve(null);
  markSketched();
  UI.showSceneImageLoading();
  return generateTurnImage(buildImagePrompt(narration))
    .then(src => {
      src ? UI.setSceneImage(src) : UI.hideSceneImage();
      if (src && journalEntry) {
        journalEntry.imageSrc = src;
        sketchByTurn.set(journalEntry.turn ?? 0, src);   // cache for time-travel restore
      }
      return src;
    })
    .catch(() => { UI.hideSceneImage(); return null; });
}

// ─── Meta commands ────────────────────────────────────────────────────────────
async function handleMeta(raw) {
  const cmd = raw.slice(1).toLowerCase().trim();
  if (cmd === 'restart') { clearSave(); location.reload(); return; }
  if (cmd === 'save') {
    // Report what actually happened — this used to claim success unconditionally,
    // including when the write had failed on a full quota.
    if (saveToStorage()) UI.appendEntry('system', t('meta.saved'));
    else                 UI.appendEntry('error',  t('meta.saveFailed'));
    return;
  }
  if (cmd === 'status') {
    const pc = appState.party?.pc;
    if (pc) UI.appendEntry('system', t('meta.status', { name: pc.record.name, hp: pc.record.hpCurrent, max: pc.sheet.hp.max, ac: pc.sheet.ac.value }));
    return;
  }
  if (cmd === 'settings') { UI.appendEntry('system', t('setup.reRunSetup')); await setupKey(); return; }
  if (cmd === 'map')   { renderRegionMap(); return; }
  if (cmd === 'story') { renderStoryView(); return; }
  // The dictionary. Free, like every other meta command: the Game Master knows
  // the world and the player met it yesterday, and asking which is which should
  // not cost a turn (doc 19, Part II).
  if (cmd === 'what' || cmd.startsWith('what ')) {
    const q = cmd.replace(/^what\s*/, '').trim();
    if (q) await renderLexiconAnswer(q); else renderLexiconTopics();
    return;
  }
  // Whether dictionary answers are restyled in the setting's voice. A text
  // game's settings surface is its meta commands; this one is off by default,
  // costs a tiny call per lookup, and does nothing at all under a pack with no
  // voice (classic), where there is no register to speak in.
  if (cmd === 'dictionary') {
    const next = !(appState.settings?.lexiconParaphrase ?? false);
    setValue('settings.lexiconParaphrase', next);
    tick();
    saveToStorage();
    UI.appendEntry('system', `${t('sidebar.lexiconVoiceLabel')}: ${next ? t('common.yes') : t('common.no')}`);
    if (next) UI.appendEntry('system', t('sidebar.lexiconVoiceHint'));
    return;
  }
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

  // The setting, chosen before anything else — including the character, whose
  // class labels the pack skins. 'surprise' defers to the campaign seed, which
  // draws the THEME first and then rolls every content choice inside it: a
  // world cannot be cyberpunk with a mushroom farm if the mushroom farm was
  // never in the deck being drawn from (doc 19 §3).
  const settingChoice = await UI.pickFrom(
    t('newgame.settingQuestion'),
    ['surprise', ...packIds()],
    (id) => id === 'surprise' ? t('newgame.settingSurprise') : packTagline(resolvePack(id), locale()),
    0,
  );

  clearTurnMarks();   // a fresh game must not be undoable into the prior game's history
  setValue('party',  { pc: null, inventory: [] });
  setValue('flags',       {});
  setValue('transcript',  []);
  setValue('session.turnCount', 0);
  setValue('session.phase', 'char-create');

  // The seed both the pack draw and the world roll come from. Minted here so
  // the pack is known before character creation and before any generator runs.
  const worldSeed = Math.floor(Math.random() * 2147483647);
  const settingId = settingChoice === 'surprise' ? pickPack(worldSeed) : settingChoice;
  setValue('world.settingId', settingId);
  const pack = applyPackOverlay(resolvePack(settingId));
  tick();
  UI.appendEntry('system', t('newgame.settingChosen', { name: packCard(pack, locale()).name }));
  UI.appendEntry('system', packCard(pack, locale()).blurb);
  UI.appendEntry('system', '');

  const { magic, ...pc } = (await createCharacter(UI)) ?? {};
  if (!pc.record) { UI.appendEntry('error', t('setup.createCancelled')); return; }
  setValue('party.pc', pc);
  // Slots live beside the sheet, not inside it: the sheet is derived and
  // re-derived on every level-up, and spent slots are the one thing that must
  // survive that — a wizard who levels mid-dungeon should not get them back.
  if (magic) setValue('party.magic', magic);

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
    await startCampaign(worldSeed, pack);
  } else {
    await startQuickDungeon(worldSeed, pack);
  }
}

// ─── Quick Dungeon (legacy flow) ─────────────────────────────────────────────

async function startQuickDungeon(seed = Math.floor(Math.random() * 2147483647), pack = activePack()) {
  const blueprint = buildWorldBlueprint(seed, pack);
  const world = generateDungeon(seed, blueprint, { partyLevel: appState.party?.pc?.record?.level ?? 1 });
  // settingId rides in `world`, so it survives export/import, slots and every
  // time-travel branch — and a whole-world write must not drop it.
  setValue('world', { ...world, settingId: pack?.id ?? appState.world?.settingId ?? null });
  setValue('session.phase', 'play');
  seedCombat(seed);   // epoch-seeded combat dice — replayable + auditable (rng.js)
  commit();

  // Show the dungeon theme in transcript for flavor.
  UI.appendEntry('system', t('newgame.themeLine', { theme: blueprint.dungeonTheme, tone: blueprint.tone }));
  UI.appendEntry('system', '');

  await beginAdventure();
}

// ─── Campaign flow (worldgen → settlement → dungeon) ─────────────────────────

async function startCampaign(worldSeed = null, pack = activePack()) {
  UI.appendEntry('system', '');

  const progress = (key, detail) => {
    if (key === 'detail') UI.appendEntry('system', `  → ${detail}`);
    else UI.appendEntry('system', t(`ai.${key}`));
  };

  // Build the pre-seeded blueprint FIRST so every AI generator receives the same
  // creative constraints (tone, climate, threat, factions, dungeon theme). Without
  // this the campaign got generic, unconstrained AI output — see worldbible.js,
  // which already does this correctly.
  const blueprintSeed = worldSeed ?? Math.floor(Math.random() * 2147483647);
  const blueprint = buildWorldBlueprint(blueprintSeed, pack);
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
    settingId: pack?.id ?? appState.world?.settingId ?? null,
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
    // Seed the map: the layered skeleton (continents, provinces, ports, sea
    // lanes — doc 17), the starting region under its first province, and
    // three neighbour stubs. Costs nothing until visited. Seeded from the
    // NUMERIC blueprint seed — world.seed holds the world's NAME, and the
    // old read degenerated every skeleton to seed 0.
    geography: initialAtlas(region.id, region.name, blueprintSeed, { syllables: pack?.syllables ?? null }),
  };

  // The global outline (doc 17, detail 0 → 1 for every continent, one call):
  // ~50 words each of what the continent is ABOUT, plus faction homelands.
  // Best-effort — a failed outline leaves named stubs, never an error.
  try {
    progress('worldgenStepContinents');
    const { generateContinentOutlines } = await import('./worldgen.js');
    const continentNodes = Object.values(worldState.geography.nodes).filter(n => n.kind === 'continent');
    const outlined = await generateContinentOutlines(seed.digest, continentNodes, factions, blueprint);
    if (outlined?.continents?.length) {
      worldState.geography = applyContinentOutlines(worldState.geography, outlined.continents);
      progress('detail', outlined.continents.map(c => c.name).join(' · '));
    }
  } catch (e) {
    console.warn('Continent outlines failed (stubs stand):', e.message);
  }

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
    if (!(first && skipFirstRender)) await renderSettlement(settlement, currentId);
    first = false;
    currentId = await settlementLoop(currentId);
  }
}

// Render the town banner, NPCs, exits, and gold; set the location pointer.
async function renderSettlement(settlement, settlementId) {
  clearTurnMarks();   // entering town — dungeon turn marks must not be undoable from a settlement
  setValue('world', { ...appState.world, location: { ...appState.world.location, type: 'settlement', settlementId, dungeonId: null } });
  tick();
  // Phase 4.3: arriving in a region raises a visited flag (a beat prerequisite).
  if (settlement.regionId) setStoryFlag(`visited-${settlement.regionId}`);
  // The act generator's completesOn vocabulary includes these two arrival
  // flags — and nothing ever raised them, so an arrival beat could never
  // flag-complete and always fell back to the paid LLM judge (or stalled).
  setStoryFlag('settlement-reached');
  if (settlement.regionId) setStoryFlag('region-reached');
  // Crossing into a different region ends the chapter — one of the designed
  // boundary triggers that previously had no call site.
  const lastRegion = appState.session?.lastRegionId ?? null;
  if (settlement.regionId && settlement.regionId !== lastRegion) {
    setValue('session.lastRegionId', settlement.regionId);
    tick();
    if (lastRegion !== null) await markChapterBoundary('region-changed');
  }

  UI.clear();
  UI.appendEntry('system', t('settlement.banner', { name: settlement.name }));
  UI.appendEntry('system', '');
  const settlementIntro = settlement.description ?? t('settlement.youAreIn', { name: settlement.name });
  UI.appendEntry('gm', settlementIntro);
  // A journey's arrival note survives the scene change: towns own the screen
  // (UI.clear above), which wiped the crossing prose the moment the player
  // landed — the test run watched the sea vanish. The note re-anchors it.
  if (_arrivalNote) {
    UI.appendEntry('gm', _arrivalNote);
    _arrivalNote = null;
  }
  recordOpening(settlementIntro);   // persist the opening narration (survives undo/redo + reload)
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

  // Places already visited — naming one travels straight back there.
  const known = Object.entries(appState.world?.settlements ?? {})
    .filter(([sid, s]) => sid !== settlement.id && s?.name);
  if (known.length) {
    UI.appendEntry('system', t('settlement.knownList'));
    for (const [, s] of known) UI.appendEntry('system', `  ${s.name}`);
    UI.appendEntry('system', '');
  }

  // Anything the Game Master invented here that counts as a threat starts its
  // clock now, and whatever the region is already worried about is talked about.
  armThreatClocks();
  const talk = rumours({ limit: 2 });
  if (talk.length) {
    UI.appendEntry('system', t('settlement.rumourHeader'));
    for (const line of talk) UI.appendEntry('gm', `  ${line}`);
    UI.appendEntry('system', '');
  }

  UI.appendEntry('system', t('settlement.goldLine', { gold: goldOf(appState.party?.pc?.record) }));
  UI.appendEntry('system', '');

  // A drifting player gets found by the story rather than losing it.
  await nudgeIfStalled();

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
  // Minted threats haunting this place are confrontable, not just rumours —
  // the back half of "the GM's inventions become real" (E9.S3).
  for (const threat of activeThreatsAt()) {
    chips.push({ label: t('settlement.confrontChip', { name: threat.name }), value: t('settlement.confrontCmd', { name: threat.name }) });
  }
  // A port province with a sea lane can sail (doc 17): the crossing to
  // another continent, resolved deterministically like fasttravel.
  const homeProvince = provinceOf();
  if (homeProvince?.port) {
    const lane = seaLaneFrom(homeProvince.id);
    if (lane) chips.push({ label: t('settlement.sailChip', { name: lane.to.name }), value: 'sail' });
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

    // Towns never run processTurn, so an act that closed on a settlement flag
    // (settlement-reached, region-reached, a visited-* beat) used to queue a
    // close that nothing drained while the player stayed in town — and the
    // queue is module-local, so a reload lost it and stranded the thread
    // actless. Drained here, at the top of every town beat, with the same
    // ceremony the play loops hold.
    const actClose = await drainActClose();
    if (actClose) {
      for (const line of (actClose.epilogueLines ?? [])) UI.appendEntry('system', line);
      await markChapterBoundary('act-completed');
    }

    const settlement = appState.world.settlements[settlementId];

    UI.showActionChips(settlementChips(settlement));

    const raw = await UI.prompt('');
    if (!raw.trim()) continue;
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }
    // A question the player already knows the answer to is answered from
    // stored knowledge, for free (doc 19). A miss returns false and falls
    // through to a normal turn — the Game Master owns what the index cannot.
    if (await tryLexicon(raw)) continue;

    // Fast travel to an already-discovered settlement (chip value).
    const ft = raw.match(/^fasttravel:(.+)$/);
    if (ft) { UI.clearChips(); return await fastTravelTo(ft[1]); }

    // Set sail (chip value / typed) — the sea crossing to another continent.
    if (/^(sail|set sail|zeil|uitvaren)\b/i.test(raw.trim())) {
      UI.appendEntry('player', `> ${raw}`);
      UI.clearChips();
      const next = await sailAcross(settlementId);
      if (next) return next;
      continue;
    }

    // Confront chip / typed command — resolved deterministically, before the
    // classifier. The chip's value is plain text; routing it through the LLM
    // turned "Confront the ghoul" into a look (audit F4).
    const cf = raw.match(/^(?:confront|bestrijd)\s+(.+)$/i);
    if (cf) {
      const threats = activeThreatsAt();
      const tl = cf[1].toLowerCase();
      const threat = threats.find(th => th.name.toLowerCase().includes(tl) || tl.includes(th.name.toLowerCase())) ?? threats[0] ?? null;
      if (threat) {
        UI.appendEntry('player', `> ${raw}`);
        UI.clearChips();
        const next = await handleSettlementAction({ type: 'confront', threat }, settlementId);
        if (next) return next;
        continue;
      }
    }

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

// A discovered settlement the player names directly ("go back to Saltmarch").
// Fast travel previously existed ONLY as a chip value, so with chips missing it
// was unreachable by any means; matching here gives it a real free-text path.
function findKnownSettlement(currentId, target) {
  if (!target) return null;
  const tl = String(target).toLowerCase();
  for (const [sid, s] of Object.entries(appState.world?.settlements ?? {})) {
    if (sid === currentId || !s?.name) continue;
    const name = s.name.toLowerCase();
    if (sid === target || name === tl || name.includes(tl) || tl.includes(name)) return sid;
  }
  return null;
}

function normalizeSettlementAction(r, settlement) {
  const intent = r?.intent ?? 'look';
  if (intent === 'talk')   return { type: 'talk',   npc:  findNpc(settlement, r?.target) };
  if (intent === 'travel') {
    // Prefer a real exit; otherwise fast-travel to a settlement already visited.
    const exits = settlement.exits ?? [];
    const tl    = String(r?.target ?? '').toLowerCase();
    const named = tl && exits.some(e =>
      e.targetId === r?.target || e.targetName.toLowerCase().includes(tl) || tl.includes(e.targetName.toLowerCase()));
    if (!named) {
      const sid = findKnownSettlement(settlement.id, r?.target);
      if (sid) return { type: 'fasttravel', settlementId: sid };
    }
    return { type: 'travel', exit: findExit(settlement, r?.target) };
  }
  if (intent === 'buy')    return { type: 'buy' };
  if (intent === 'rest')   return { type: 'rest' };
  if (intent === 'quest')  return { type: 'quest' };
  if (intent === 'inventory') return { type: 'inventory' };
  if (intent === 'confront') {
    // Match the named threat, else the first active one — same policy as the
    // offline fallback. The intent existed in the chips and the fallback but
    // not in the classifier's schema, so when the AI WORKED the confront path
    // was unreachable: the model had no way to say it (audit F4).
    const threats = activeThreatsAt();
    const tl = String(r?.target ?? '').toLowerCase();
    const named = threats.find(th => tl && th.name.toLowerCase().includes(tl));
    const threat = named ?? threats[0] ?? null;
    if (threat) return { type: 'confront', threat };
    return { type: 'look' };
  }
  return { type: 'look' };
}

// Keyword fallback (offline / AI failure). Mirrors the old resolver plus the
// new verbs so the town stays playable without an LLM.
function fallbackSettlementAction(raw, settlement) {
  const lower = raw.toLowerCase();
  // Confronting a minted threat by name or by verb. Checked before NPC talk so
  // "fight the privy ghoul" doesn't route to a conversation with the innkeeper.
  const threats = activeThreatsAt();
  const named = threats.find(th => lower.includes(th.name.toLowerCase()));
  if (named) return { type: 'confront', threat: named };
  if (/(confront|hunt|slay|fight|bestrijd|jaag|versla)/.test(lower) && threats.length) {
    return { type: 'confront', threat: threats[0] };
  }
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
  const knownId = findKnownSettlement(settlement.id, lower);
  if (knownId) return { type: 'fasttravel', settlementId: knownId };
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
    case 'confront':  await confrontThreat(action.threat, settlementId); return;
    case 'travel':
      if (!action.exit) { UI.appendEntry('system', t('settlement.noPath')); return; }
      return await doTravel(action.exit, settlementId);
    case 'fasttravel':
      return await fastTravelTo(action.settlementId);
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
    // A null RETURN (validation failure after a rate-limit fallback walk) is
    // not a throw — it slipped past the catch and read `.reply` off null,
    // crashing the conversation with a raw Fatal. Found by the live red-line
    // run; the mock always answers, only real model chaos exposes this seam.
    resp ??= { reply: t('settlement.npcSilent', { name: npc.name }), revealsSecret: false };
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
      // What the player has been told is now part of the world, not just a line
      // that scrolls away: recording it as canon puts it in the ledger, which is
      // where the scope packet's `known` tier and the lexicon both read from —
      // and it means undo rewinds the KNOWLEDGE along with the reveal.
      const npcEntity = `${currentPlaceId()}.npc.${slug(npc.id ?? npc.name)}`;
      markEncountered(npcEntity);
      recordCanon(npcEntity, 'name', npc.name, { because: t('settlement.secretBecause', { name: npc.name }) });
      recordCanon(npcEntity, 'note', npc.secret, { because: t('settlement.secretBecause', { name: npc.name }) });
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
    // Print the wares as transcript text as well as chips. The banner ends in a
    // colon and used to be followed by nothing at all whenever chips were not
    // rendered — a shop the player could neither see nor use.
    wares.forEach((w, i) => {
      UI.appendEntry('system', `  ${i + 1}. ${w.item.name} — ${w.item.price} ${t('settlement.goldWord')} (${w.npc})`);
    });
    UI.appendEntry('system', '');
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
    else {
      // Accept the printed list number ("3", "buy 3") as well as the item name.
      const byIndex = pick.trim().match(/^(?:buy\s+|koop\s+)?(\d+)$/i);
      chosen = byIndex
        ? wares[Number(byIndex[1]) - 1]
        : wares.find(w => pick.toLowerCase().includes(w.item.name.toLowerCase()));
    }

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
    clearTurnMarks();   // back in town — drop dungeon marks so the undo button hides on return
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

// ─── Confronting a minted threat — the FarStay ghoul's fight (E9.S3) ─────────
//
// The extraction pipeline minted the threat with a real stat block; this is
// where it finally becomes fightable. Reuses the road-encounter machinery, so
// a mid-fight reload resumes exactly like any other encounter. Victory writes
// the resolution the plan promised: the kill as ground truth, XP through the
// engine, and a citable because-line for the journal and epilogue.
async function confrontThreat(threat, settlementId) {
  if (!threat?.creatureId) { UI.appendEntry('system', t('settlement.noThreatHere')); return; }
  UI.appendEntry('gm', t('settlement.confrontIntro', { name: threat.name }));
  const outcome = await runEncounter(threat.creatureId);
  if (outcome === 'defeat') { await doDefeat(); return; }
  if (outcome === 'win') {
    resolveThreat(threat.id, { name: threat.name });
    let block = null;
    try { block = statBlockFor(threat.creatureId); } catch { block = { cr: 0 }; }
    const gained = awardXp(xpForKill(threat.creatureId, block), t('progress.killReason', { name: threat.name }));
    UI.appendEntry('system', t('settlement.threatResolved', { name: threat.name }));
    for (const line of announcementFor(gained)) UI.appendEntry('system', line);
  }
  commit();
}

// ─── Travel combat encounter — reuses the dungeon turn loop ───────────────────

async function runEncounter(enemyId) {
  if (!enemyId) return 'flee';
  // Snapshot the active dungeon-combat fields so travel doesn't corrupt them.
  // The snapshot is PERSISTED (world.encounterReturn), not just held in a local:
  // every encounter turn autosaves, so a reload mid-fight used to resume into a
  // world whose real rooms/npcs existed only in a dead closure.
  const enemy = buildEnemy(enemyId, { npcId: 'enc-1', roomId: 'encounter' });
  // currentRoom === exitRoomId so that a reload mid-encounter resolves through
  // playLoop's vault-guarded victory gate (fight the enemy, then win) instead
  // of soft-locking in an exit-less room.
  setValue('world', enterEncounterState(appState.world, {
    room: { id: 'encounter', name: t('travel.encounterRoom'), description: enemy.intro, exits: [], loot: [] },
    npcs: { 'enc-1': enemy },
  }));
  tick();

  UI.appendEntry('gm', enemy.intro);
  _speak(enemy.intro);

  return await runEncounterLoop();
}

// Re-enter an encounter that was interrupted by a reload. The enemy, the PC and
// the return snapshot all live in the save, so the fight simply continues.
export async function resumeEncounter() {
  const enemy = appState.world?.npcs?.['enc-1'];
  if (!enemy) {                       // nothing to fight — just put the world back
    restoreFromEncounter();
    return 'flee';
  }
  UI.appendEntry('system', t('travel.encounterResume'));
  UI.appendEntry('gm', enemy.intro ?? '');
  return await runEncounterLoop();
}

// Restore the pre-encounter world fields from the persisted snapshot.
function restoreFromEncounter() {
  if (!appState.world?.encounterReturn) return;
  setValue('world', exitEncounterState(appState.world));
  commit();
}

async function runEncounterLoop() {
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
    // A question the player already knows the answer to is answered from
    // stored knowledge, for free (doc 19). A miss returns false and falls
    // through to a normal turn — the Game Master owns what the index cannot.
    if (await tryLexicon(raw)) continue;
    if (/^\s*(flee|run|escape|vlucht|ren)\b/i.test(raw) || raw === t('travel.fleeCmd')) {
      UI.appendEntry('player', `> ${raw}`);
      outcome = 'flee';
      break;
    }

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true, 'reading');
    // The turn moves through stages; the indicator follows it so a long wait
    // reads as progress rather than as a hung app.
    const stageTimer = setTimeout(() => UI.setThinkingStage('rolling'), 900);

    let streamEl = null;
    const onChunk = (text) => {
      if (!streamEl) { clearTimeout(stageTimer); UI.setThinking(false); streamEl = UI.beginStreamEntry('gm'); }
      UI.appendStreamChunk(streamEl, text);
    };

    let result = null;
    try {
      result = await processTurn(raw, onChunk);
    } catch (e) {
      clearTimeout(stageTimer);
      UI.setThinking(false); streamEl?.remove();
      UI.appendEntry('error', t('loop.error', { msg: e.message }));
      continue;
    }
    clearTimeout(stageTimer);
    tick();
    UI.setThinking(false);
    if (!streamEl && result?.narration) UI.appendEntry('gm', result.narration);
    for (const line of (result?.progression ?? [])) UI.appendEntry('system', line);
    // The campaign's ending, when the finale act just closed — rendered from
    // the ledger, shown once, persisted so a reload doesn't replay it.
    for (const line of (result?.epilogueLines ?? [])) UI.appendEntry('system', line);
    UI.appendEntry('system', '');
    // Chapter boundaries used to gate exclusively on dungeon-clear victories:
    // a wandering campaign never cut a chapter, so clocks never ticked and the
    // ledger never compacted. An act transition cuts one, and the 40-turn
    // backstop is finally EVALUATED every turn instead of never.
    if (result?.actClosed) await markChapterBoundary('act-completed');
    else await markChapterBoundary('backstop');
    _speak(result?.narration);
    UI.updateDebugPanel(result?._debug);
  }

  UI.clearChips();
  restoreFromEncounter();

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
      // The WHOLE item passes through: dropping to {id,name,description} here
      // stripped heals/gold/value/consumable, so a travel-found healing potion
      // could never actually heal.
      const { desc, ...fields } = item;
      const entry = { ...fields, id: slug(item.name), name: item.name, description: desc ?? item.description ?? '', quantity: 1 };
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
      // Live flags land on the acts thread; the pre-acts redThread shape kept
      // this counter stuck at clue-1 forever.
      const flags = appState.world?.thread?.flags ?? appState.world?.redThread?.flags ?? {};
      const n = Object.keys(flags).filter(f => f.startsWith('clue-')).length + 1;
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
  // The neighbour was already minted as a stub when this region was generated,
  // carrying its own seed. Hydrating from that seed is what makes the world a
  // graph rather than a star: the place beyond this road was always going to be
  // this place, and walking back returns to somewhere that still exists.
  const stub = stubToward(appState.world?.location?.regionId, exit.targetName);
  // A stub that was already hydrated IS a place — re-travelling this road must
  // return to it, not run AI generation over it again (which overwrote the
  // region and minted a duplicate settlement: everything persists, except it
  // didn't, on exactly this path).
  if (stub?.id && appState.world?.regions?.[stub.id]) {
    const existing = appState.world.regions[stub.id];
    const settlementId = existing.settlements?.[0] ?? null;
    if (settlementId && appState.world?.settlements?.[settlementId]) {
      setValue('world', { ...appState.world,
        location: { ...appState.world.location, regionId: stub.id } });
      commit();
      return { regionId: stub.id, settlementId };
    }
  }
  const seed = stub?.seed ?? Math.floor(Math.random() * 2147483647);
  const fresh = buildWorldBlueprint(seed);
  // Keep world identity; vary climate/settlement/dungeon/buildings/landmarks.
  const bp = { ...fresh, tone: base.tone, worldArchetype: base.worldArchetype, threatType: base.threatType,
               beatArc: base.beatArc, factionSlots: base.factionSlots, godDomains: base.godDomains };

  try {
    const { generateRegion, generateSettlement } = await import('./worldgen.js');
    const parentDigest = appState.world?.digest ?? appState.world?.name ?? 'the known world';
    const region = await generateRegion(parentDigest, bp);
    if (!region) return null;
    region.id = stub?.id ?? region.id ?? `region-${seed}`;
    // Record the real name on the map and push the frontier one hop further out.
    hydrateRegion(region.id, region.name);
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

// ─── The sea crossing (doc 17: continent travel) ─────────────────────────────

// One line that outlives the arrival's screen clear — set by the crossing,
// printed by renderSettlement right after the town intro.
let _arrivalNote = null;

// Sail from the current (port) province to the far side of its sea lane.
// Three lazy loads happen exactly when the crossing needs them: the far
// province outlines (detail 0 → 1) as the ship approaches, the landfall
// region + settlement generate (detail 2) on arrival, and a second sailing
// lands where the first one did — the far shore persists like everywhere
// else. Returns the settlement id to transition to, or null to stay.
async function sailAcross(fromSettlementId) {
  const home = provinceOf();
  const lane = home?.port ? seaLaneFrom(home.id) : null;
  if (!lane) { UI.appendEntry('system', t('sail.noLane')); return null; }

  const far = lane.to;
  UI.appendEntry('system', '');
  UI.appendEntry('gm', t('sail.depart', { name: far.name, days: lane.days }));

  // Already landed there once? The far shore is a place, not a generator.
  const landed = landedRegionOf(far.id);
  if (landed) {
    const sid = appState.world?.regions?.[landed.id]?.settlements?.[0];
    if (sid && appState.world?.settlements?.[sid]) {
      setValue('world', { ...appState.world,
        location: { ...appState.world.location, regionId: landed.id } });
      commit();
      _arrivalNote = t('sail.arrivalNote', { name: landed.name, days: lane.days });
      UI.appendEntry('gm', t('sail.arriveKnown', { name: landed.name }));
      return sid;
    }
  }

  if ((appState.ai?.tier ?? 'free') !== 'deluxe' || !appState.world?.blueprint) {
    UI.appendEntry('gm', t('sail.noPassage'));
    return null;
  }

  try {
    const { generateProvinceOutline, generateRegion, generateSettlement } = await import('./worldgen.js');

    // Approach: outline the far province if it is still a stub (0 → 1).
    let province = far;
    if ((far.detail ?? 0) < 1) {
      const parentDigest = appState.world?.digest ?? appState.world?.name ?? 'the known world';
      const outline = await generateProvinceOutline(parentDigest, far, appState.world.blueprint).catch(() => null);
      if (outline) {
        const geo = applyProvinceOutline(far.id, outline);
        province = geo.nodes[far.id] ?? far;
        UI.appendEntry('gm', t('sail.sight', { name: province.name, digest: province.digest ?? province.hook ?? '' }));
      }
    } else if (far.digest) {
      UI.appendEntry('gm', t('sail.sight', { name: far.name, digest: far.digest }));
    }

    // Landfall: a fresh region + settlement under the far province, generated
    // from the province's own seed with the province's climate — the layer
    // owns what varies (doc 17), so the far continent stops inheriting the
    // home blueprint's climate and domains wholesale.
    const seed = (province.seed ?? Math.floor(Math.random() * 2147483647)) >>> 0;
    const fresh = buildWorldBlueprint(seed);
    const base = appState.world.blueprint;
    const bp = { ...fresh, tone: base.tone, worldArchetype: base.worldArchetype, threatType: base.threatType,
                 beatArc: base.beatArc, factionSlots: base.factionSlots,
                 climate: province.climate ?? fresh.climate };

    const parentDigest = province.digest ?? appState.world?.digest ?? 'a far shore';
    const region = await generateRegion(parentDigest, bp);
    if (!region) { UI.appendEntry('gm', t('sail.noPassage')); return null; }
    region.id = `${far.id}.landing`;
    if (!region.digest) region.digest = `${region.name} — ${region.climate}.`;

    const settlement = await generateSettlement(region.digest, region.id, bp);
    if (!settlement) { UI.appendEntry('gm', t('sail.noPassage')); return null; }
    settlement.id ??= `settlement-${seed}`;
    if (!settlement.digest) settlement.digest = `${settlement.name} — ${(settlement.npcs ?? []).map(n => n.name).join(', ')}.`;

    addRegionUnderProvince({
      regionId: region.id, regionName: region.name, provinceId: far.id,
      seed, fromRegionId: appState.world.location.regionId, days: lane.days,
    });

    const regions = { ...appState.world.regions,
      [region.id]: { ...region, settlements: [settlement.id], dungeons: [], adjacentRegions: region.adjacentHints ?? [], blueprint: bp } };
    const settlements = { ...appState.world.settlements, [settlement.id]: { ...settlement, regionId: region.id } };
    setValue('world', { ...appState.world, regions, settlements,
      location: { ...appState.world.location, regionId: region.id } });
    commit();

    _arrivalNote = t('sail.arrivalNote', { name: region.name, days: lane.days });
    UI.appendEntry('gm', t('sail.arrive', { name: region.name, settlement: settlement.name }));
    return settlement.id;
  } catch (e) {
    console.warn('Sea crossing failed:', e.message);
    UI.appendEntry('gm', t('sail.noPassage'));
    return null;
  }
}

// ─── Enter dungeon from settlement ───────────────────────────────────────────

async function enterDungeon(exit, settlementId) {
  clearTurnMarks();   // fresh dungeon context — never inherit a prior dungeon/town's undo marks
  const dungeonId = exit.targetId ?? `dungeon-${Date.now()}`;

  // Generate if not already in world state — held in a LOCAL: reading the
  // entry back through appState got the pre-tick value (undefined), so the
  // first entry into any freshly generated campaign dungeon was fatal, and
  // the second whole-world write below (built from the same stale appState)
  // silently dropped the dungeons map the first write had added. Caught by
  // the campaign e2e's first-ever played dungeon — the seam the audit named.
  let dungeon = appState.world?.dungeons?.[dungeonId];
  if (!dungeon) {
    dungeon = createDungeonEntry({
      id:        dungeonId,
      name:      exit.targetName,
      regionId:  appState.world?.location?.regionId ?? null,
      blueprint: appState.world?.blueprint ?? null,
      // The vault boss is raised for the party's level, so a late-campaign
      // dungeon is not guarded by something a level-8 party walks over — and
      // the dungeon itself grows with the act, so the finale is a real descent.
      partyLevel: appState.party?.pc?.record?.level ?? 1,
      act:        actNumber(),
    });
  }

  seedCombat(dungeon.seed);   // epoch-seeded combat dice for this dungeon (rng.js)

  // One write carries everything: the stored entry AND the flat fields the
  // resolver reads (legacy compat).
  setValue('world', {
    ...appState.world,
    dungeons:    { ...(appState.world?.dungeons ?? {}), [dungeonId]: dungeon },
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
  recordOpening(room.description);   // persist the opening narration (survives undo/redo + reload)
  UI.appendEntry('system', '');
  const exits = room.exits.map(e => t(`directions.${e.dir}`)).join(', ');
  UI.appendEntry('system', t('adventure.exits', { dirs: exits }));
  UI.appendEntry('system', '');
  UI.appendEntry('system', describePC(pc));
  UI.appendEntry('system', '');

  const openingEntry = { turn: 0, narration: room.description, imageSrc: null };
  journalLog.push(openingEntry);
  requestSceneImage(room.description, openingEntry, { force: true });   // the opening scene always gets one
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
    // A question the player already knows the answer to is answered from
    // stored knowledge, for free (doc 19). A miss returns false and falls
    // through to a normal turn — the Game Master owns what the index cannot.
    if (await tryLexicon(raw)) continue;

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true);
    // The staged indicator the encounter loop got in the E10 pass — this loop
    // received only the cleanup line, and `stageTimer` here was an unbound
    // identifier: every successful dungeon turn ended in a ReferenceError and
    // the session died. The timer must exist in THIS scope.
    const stageTimer = setTimeout(() => UI.setThinkingStage('rolling'), 900);
    if (appState.settings?.roleplayMode) UI.showRoleplayOverlay(true);

    let streamEl = null;
    function onChunk(text) {
      if (!streamEl) { clearTimeout(stageTimer); UI.setThinking(false); streamEl = UI.beginStreamEntry('gm'); }
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
        // Retry what waiting can fix, and only that. The old `AI 4xx` match
        // had the polarity half-inverted: it burned ~7s of backoff on 402/403/
        // 404/413 (which waiting can never fix) and never auto-retried 5xx or
        // network drops (which errors.js itself marks retryable).
        if (!describeAiError(e).retryable || attempt === RETRY_DELAYS.length) break;
      }
    }

    if (caughtErr) {
      clearTimeout(stageTimer);
      UI.setThinking(false);
      if (appState.settings?.roleplayMode) UI.showRoleplayOverlay(false);
      streamEl?.remove(); streamEl = null;
      UI.appendEntry('system', '');
      // Name the cause and the player's next move. Every failure used to
      // collapse into "the Game Master was not available", which is a guess:
      // waiting fixes a 429 and can never fix a 402.
      const { key, retryable, status } = describeAiError(caughtErr);
      UI.appendEntry('error', t(key, { status: status ?? '', detail: caughtErr.message }));
      if (retryable) {
        UI.appendEntry('system', t('error.retryHint'));
        pendingRetry = raw;
      }
      continue;
    }

    clearTimeout(stageTimer);
    tick();
    UI.setThinking(false);
    if (!streamEl && result?.narration) UI.appendEntry('gm', result.narration);
    for (const line of (result?.progression ?? [])) UI.appendEntry('system', line);
    // The campaign's ending, when the finale act just closed — rendered from
    // the ledger, shown once, persisted so a reload doesn't replay it.
    for (const line of (result?.epilogueLines ?? [])) UI.appendEntry('system', line);
    UI.appendEntry('system', '');
    // Chapter boundaries used to gate exclusively on dungeon-clear victories:
    // a wandering campaign never cut a chapter, so clocks never ticked and the
    // ledger never compacted. An act transition cuts one, and the 40-turn
    // backstop is finally EVALUATED every turn instead of never.
    if (result?.actClosed) await markChapterBoundary('act-completed');
    else await markChapterBoundary('backstop');

    const journalEntry = { turn: appState.session?.turnCount ?? 0, narration: result?.narration ?? '', imageSrc: null };
    journalLog.push(journalEntry);
    requestSceneImage(result?.narration, journalEntry);

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

// Close the chapter at a real story boundary, with a ceremony line. Cheap AAA
// texture, and the anchor the recap and the journal both hang off.
// The world reaches for a player who has drifted: when the red thread has not
// moved for a long time, the current beat's business finds them instead of the
// campaign quietly freezing (which judge-only progression used to allow).
async function nudgeIfStalled() {
  if (!storyStalled({ patience: 60 })) return;
  const d = gmDirective();
  if (!d?.purpose) return;
  UI.appendEntry('system', '');
  UI.appendEntry('gm', t('story.stallNudge'));
  raiseFlag('story-nudged');
}

async function markChapterBoundary(reason) {
  if (!shouldCutChapter(reason)) return;
  const n = chapterIndex();
  const closed = await cutChapter(reason);
  if (!closed) return;
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('chapter.banner', { n, title: closed.title }));
  UI.appendEntry('system', '');
}

async function doVictory() {
  const room     = appState.world?.rooms?.[appState.world?.exitRoomId];
  const treasure = (room?.loot ?? []).find(i => i.type === 'treasure');
  const victoryText = t('victory.text', { treasure: treasure?.name ?? 'the treasure' });
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('victory.banner'));
  UI.appendEntry('gm', victoryText);
  UI.appendEntry('system', '');
  _speak(victoryText);
  for (const line of announcementFor(awardMilestone('dungeon-cleared',
        t('progress.dungeonReason', { name: room?.name ?? t('victory.banner') })))) {
    UI.appendEntry('system', line);
  }
  await markChapterBoundary('dungeon-cleared');

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
  // Name the creature that actually killed you, and the room it happened in.
  // A death should belong to the campaign it happened in, not to a goblin from
  // a data block nothing has read since the game was a prototype.
  const killer = appState.session?.slainBy;
  const place  = appState.world?.rooms?.[appState.world?.currentRoom]?.name;
  const defeatText = killer
    ? t(place ? 'defeat.textByIn' : 'defeat.textBy', { killer, place })
    : t('defeat.text');
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('defeat.banner'));
  UI.appendEntry('gm', defeatText);
  UI.appendEntry('system', '');
  UI.appendEntry('system', t('defeat.hint'));
  _speak(defeatText);
  await awaitRestart();
}

async function awaitRestart() {
  clearTurnMarks();   // end state reached — undo must not resurrect a slain boss / discard the run
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

  // Heal a stranded act close: the close queue is module-local, so a close
  // taken to a reload (raised in a settlement, where no turn loop drained it)
  // died with the tab and left the thread actless — actIndex past the last
  // act with no next act ever generated and no epilogue. The state itself is
  // the evidence; re-queue and the next drain point regenerates.
  const thread = appState.world?.thread;
  if (thread?.acts?.length && thread.actIndex >= thread.acts.length
      && !appState.session?.campaignComplete) {
    requeueActClose();
  }

  // "Previously on…" — built from stored chapter digests, no AI call.
  const previously = recap();
  if (previously) {
    UI.appendEntry('system', t('chapter.recapHeader'));
    UI.appendEntry('gm', previously);
    UI.appendEntry('system', '');
  }

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

  // A campaign saved before the atlas existed has no geography graph: give it
  // one now, seeded from the current region, so its road exits resolve to
  // pre-minted stubs instead of falling back to fresh random worlds (the star
  // topology creeping back for exactly the saves the graph was built to fix).
  const regionId = appState.world?.location?.regionId;
  if (regionId && !appState.world?.geography?.nodes?.[regionId]) {
    const region = appState.world?.regions?.[regionId];
    initAtlas(regionId, region?.name ?? regionId, appState.world?.seed ?? 1);
  }

  // Resume into the right context.
  const locType = appState.world?.location?.type;

  // A save written mid-journey-encounter used to fall through to playLoop, whose
  // victory path returns to no caller — leaving no active prompt on this and
  // every later reload. Finish the fight, then hand back to the town loop (the
  // journey itself is not resumable, so the traveller returns where they set out).
  if (locType === 'encounter') {
    const outcome = await resumeEncounter();
    if (outcome === 'defeat') { await doDefeat(); return; }
    const back = appState.world?.location?.settlementId;
    if (back && appState.world?.settlements?.[back]) { await enterSettlement(back, true); return; }
    await playLoop();
    return;
  }

  if (locType === 'settlement' && appState.world?.location?.settlementId) {
    await enterSettlement(appState.world.location.settlementId, true);
  } else {
    await playLoop();
  }
}

// Re-exported so main.js and the UI keep importing them from flow.js.
export { ensureKey, upgradeToDeluxe, requireDeluxe };
