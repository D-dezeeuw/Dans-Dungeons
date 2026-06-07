// src/game/loop.js
//
// The turn engine. This is the ONLY thing that:
//   - calls the AI (via ai/classify.js, ai/narrate.js)
//   - writes to Spektrum (via resolver.js → state.js)
//
// The UI reads appState and renders; it never drives AI calls directly.
// flow.js calls checkApiKey() and generateTurnImage() here so those modules
// never import AI layers directly either.

import { appState, addValue, saveToStorage, tick, commit } from '../core/state.js';
import { classify, checkBeatFulfilled }       from '../ai/classify.js';
import { narrate, generateSceneImage }       from '../ai/narrate.js';
import { checkKey }                          from '../ai/client.js';
import { resolveRules, goblinRetaliates, commitAll, appendTranscript,
         isPcDown, resolveDownTurn, commitDownTurn } from './resolver.js';
import { buildStoryContext, setStoryFlag, activeBeat, completeBeatNow } from './story.js';
import { beginTurn, finalizeTurn }          from './undo.js';
import { t }                                 from '../i18n/i18n.js';

// ─── Scene context (pure snapshot for AI) ────────────────────────────────────

export function buildScene() {
  const { record, sheet } = appState.party?.pc ?? {};
  const roomId = appState.world?.currentRoom;
  const room   = appState.world?.rooms?.[roomId];
  const npcs   = Object.values(appState.world?.npcs ?? {}).filter(n => n.roomId === roomId);

  const scene = {
    room: room ? {
      name:        room.name,
      description: room.description,
      exits:       (room.exits ?? []).map(e => ({ direction: e.dir, locked: e.locked ?? false })),
      loot:        (room.loot  ?? []).filter(i => !i.taken).map(i => ({ id: i.id, name: i.name, description: i.description })),
    } : null,
    pc: record ? {
      name:       record.name,
      classId:    record.classId,
      hpCurrent:  record.hpCurrent,
      hpMax:      sheet?.hp.max,
      ac:         sheet?.ac.value,
      conditions: record.conditions,
      inventory:  (appState.party?.inventory ?? []).map(i => ({ id: i.id, name: i.name })),
    } : null,
    npcs: npcs.map(n => ({
      id:       n.id,
      name:     n.name,
      hp:       n.hp,
      maxHp:    n.maxHp,
      attitude: n.attitude,
      alive:    n.alive,
    })),
  };

  // Leaf-to-root digest path for world context (if campaign mode)
  const loc = appState.world?.location;
  if (loc && appState.world?.digest) {
    const digestPath = [];
    if (loc.dungeonId) {
      const d = appState.world.dungeons?.[loc.dungeonId];
      if (d?.digest) digestPath.push(d.digest);
    }
    if (loc.settlementId) {
      const s = appState.world.settlements?.[loc.settlementId];
      if (s?.digest) digestPath.push(s.digest);
    }
    if (loc.regionId) {
      const r = appState.world.regions?.[loc.regionId];
      if (r?.digest) digestPath.push(r.digest);
    }
    if (appState.world.digest) digestPath.push(appState.world.digest);
    if (digestPath.length) scene.worldContext = digestPath.join(' | ');
  }

  // Phase 4: story context — current beat directive (GM-only), faction tensions,
  // active quests, recent flags — so the narrator weaves the red thread in.
  const story = buildStoryContext();
  if (story) scene.story = story;

  return scene;
}

// ─── Lifecycle AI helpers (called by flow.js — never by UI) ──────────────────

export async function checkApiKey()              { return checkKey(); }
export async function generateTurnImage(prompt)  { return generateSceneImage(prompt); }

// ─── Main turn ────────────────────────────────────────────────────────────────

export async function processTurn(playerInput, onNarrationChunk) {
  // Capture the pre-turn undo mark WITHOUT side effects (no history write yet),
  // so a turn that throws mid-flight registers no dangling undo. It is finalized
  // only after a successful commit below. Covers the normal + downed branches.
  const turnMark = beginTurn();

  // If the PC is downed, this turn is a death save — resolved deterministically
  // (vendor death-save rules) with no AI call.
  if (isPcDown()) { const r = processDownTurn(playerInput); finalizeTurn(turnMark); return r; }

  // Snapshot scene BEFORE any mutations.
  const scene = buildScene();

  // 1. Classify intent (AI).
  const classified = await classify(playerInput, scene);

  // 2. Resolve PC action (pure JS — reads pre-commit appState, no mutations).
  const resolved = resolveRules(classified);

  // Capture a slain enemy BEFORE commit (so we can raise story flags after) —
  // the npc object still carries isBoss / creatureId here.
  const killedNpc = (resolved.intent === 'attack' && resolved.targetDead)
    ? appState.world?.npcs?.[resolved.targetId] : null;

  // 3. Compute goblin retaliation BEFORE committing PC's attack.
  //    A killed goblin must not retaliate.
  const goblinTurnTriggered = ['attack', 'skill', 'wait', 'look', 'talk', 'move', 'take', 'unlock'].includes(resolved.intent);
  const goblinSurvived      = resolved.intent !== 'attack' || !resolved.targetDead;
  const goblinResult        = (goblinTurnTriggered && goblinSurvived)
    ? goblinRetaliates()
    : null;

  // Outcome flags for narrator context and end-of-loop checks.
  const allEnemiesDead = resolved.targetDead === true &&
    Object.values(appState.world?.npcs ?? {}).filter(n => n.id !== resolved.targetId).every(n => !n.alive);
  const pcUnconscious  = goblinResult?.hit ? goblinResult.pcNewHp <= 0
                                           : (appState.party?.pc?.record?.hpCurrent ?? 1) <= 0;

  // 4. Narrate (AI, streaming).
  const narratorResp = await narrate(
    { playerAction: playerInput, pcAction: resolved, enemyRetaliation: goblinResult, allEnemiesDead, pcUnconscious },
    scene,
    appState.transcript ?? [],
    onNarrationChunk,
  );

  // 5. Commit everything to Spektrum.
  commitAll(resolved, goblinResult);
  appendTranscript(playerInput, narratorResp.narration);
  addValue('session.turnCount', 1);

  // Turn committed — now register the undo mark (a throw above never reaches here).
  finalizeTurn(turnMark);

  // 6. Autosave. tick() merges this turn's deltas into appState first, so the
  //    save reflects the turn just resolved (not the previous one).
  commit();

  // 7. Narrative engine (Phase 4): raise flags for this turn's events and let
  //    the red thread advance if the narration fulfilled the current beat. These
  //    run after the step-6 save (they depend on the resolved narration), so the
  //    second save persists any flag/beat change before the player can reload.
  let storyChanged = false;
  if (killedNpc) {
    setStoryFlag('enemy-slain');
    if (killedNpc.isBoss) setStoryFlag(`boss-${killedNpc.creatureId ?? 'boss'}-slain`);
    storyChanged = true;
  }
  if (await maybeAdvanceBeat(narratorResp.narration)) storyChanged = true;
  if (storyChanged) saveToStorage();

  return { ...narratorResp, _debug: { classified, resolved, goblinResult } };
}

// Phase 4.4: ask the tiny tier whether the latest narration fulfilled the
// current beat's dramatic purpose; advance the thread if so. Only campaigns
// carry beats, so quick dungeons short-circuit (activeBeat() === null).
async function maybeAdvanceBeat(narration) {
  const beat = activeBeat();
  if (!beat || !narration) return false;
  try {
    const res = await checkBeatFulfilled(beat.dramaticPurpose, narration);
    if (res?.fulfilled) return completeBeatNow(beat.id);
  } catch { /* narration check is best-effort */ }
  return false;
}

// ─── Down turn (deterministic, no AI) ────────────────────────────────────────

function processDownTurn(playerInput) {
  const down  = resolveDownTurn();
  const lines = [];

  if (down.strike) lines.push(t('deathsave.strike', { enemy: down.strike.by, damage: down.strike.damage }));

  if (down.dead) {
    lines.push(t('deathsave.dead'));
  } else if (down.revived) {
    // Natural 20 on the save vs. stabilising with the room clear.
    lines.push(down.save?.outcome === 'revived' ? t('deathsave.revived') : t('deathsave.stable'));
  } else if (down.save?.outcome === 'success') {
    lines.push(t('deathsave.success', { d20: down.save.d20, n: down.deathSaves.successes }));
  } else if (down.save?.outcome === 'failure') {
    lines.push(t('deathsave.failure', { d20: down.save.d20, n: down.deathSaves.failures }));
  }

  const narration = lines.join('\n\n');

  commitDownTurn(down);
  appendTranscript(playerInput, narration);
  addValue('session.turnCount', 1);
  commit();

  return { narration, _debug: { down } };
}
