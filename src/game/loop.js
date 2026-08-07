// src/game/loop.js
//
// The turn engine. This is the ONLY thing that:
//   - calls the AI (via ai/classify.js, ai/narrate.js)
//   - writes to Spektrum (via resolver.js → state.js)
//
// The UI reads appState and renders; it never drives AI calls directly.
// flow.js calls checkApiKey() and generateTurnImage() here so those modules
// never import AI layers directly either.

import { appState, addValue, tick, commit } from '../core/state.js';
import { classify, checkBeatFulfilled }       from '../ai/classify.js';
import { narrate, generateSceneImage }       from '../ai/narrate.js';
import { checkKey }                          from '../ai/client.js';
import { resolveRules, goblinRetaliates, commitAll, appendTranscript,
         isPcDown, resolveDownTurn, commitDownTurn } from './resolver.js';
import { beginRoller, commitRoller }          from './rng.js';
import { buildStoryContext, setStoryFlag, activeBeat, completeBeatNow } from './story.js';
import { beginTurn, finalizeTurn }          from './undo.js';
import { recordMechanical, currentPlaceId, currentRoomId, entitiesUnder,
         detailsAt, recentEvents }           from './ledger.js';
import { extractCanon }                      from '../ai/canon.js';
import { memoryContext, maybeRefreshDigest } from './chapters.js';
import { commitCanon }                       from './canon-commit.js';
import { awardXp, xpForKill, announcementFor } from './progression.js';
import { statBlockFor }                      from './bestiary.js';
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

  // The generated world's tone travels with the scene so the narrator stops
  // hardcoding one voice regardless of what the blueprint rolled.
  const tone = appState.world?.tone;
  if (tone) scene.tone = tone;

  // Ledger memory (Epic E2): what this place has accumulated, and what the world
  // has been doing lately. This is what stops the GM contradicting itself — the
  // mould it described thirty turns ago comes back with the room.
  const details = detailsAt(currentRoomId());
  if (details.length) scene.knownDetails = details.map(d => `${d.name}: ${d.note}`);

  const events = recentEvents({ limit: 5, minScope: 'local' });
  if (events.length) scene.recentEvents = events.map(e => e.because);

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

  // Epoch-seeded dice for every roll this turn (one stream → reproducible +
  // auditable; src/game/rng.js). commitRoller below advances the stored cursor.
  const roller = beginRoller();

  // 1. Classify intent (AI).
  const classified = await classify(playerInput, scene);

  // 2. Resolve PC action (pure JS — reads pre-commit appState, no mutations).
  const resolved = resolveRules(classified, roller);

  // Capture a slain enemy BEFORE commit (so we can raise story flags after) —
  // the npc object still carries isBoss / creatureId here.
  const killedNpc = (resolved.intent === 'attack' && resolved.targetDead)
    ? appState.world?.npcs?.[resolved.targetId] : null;

  // 3. Compute goblin retaliation BEFORE committing PC's attack.
  //    A killed goblin must not retaliate.
  const goblinTurnTriggered = ['attack', 'skill', 'wait', 'look', 'talk', 'move', 'take',
                               'unlock', 'rest', 'use', 'flee'].includes(resolved.intent);
  const goblinSurvived      = resolved.intent !== 'attack' || !resolved.targetDead;
  // Getting away means getting away: a successful flight is not punished by the
  // enemy it just escaped. This is the same class of contradiction as a stealth
  // success narrated alongside the hit it was supposed to prevent.
  const escaped             = resolved.intent === 'flee' && resolved.success === true;
  const goblinResult        = (goblinTurnTriggered && goblinSurvived && !escaped)
    ? goblinRetaliates(roller)
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
    memoryContext(),          // chapter digests + rolling summary (Epic E4)
  );

  // 5. Commit the turn's mechanics, then tick so they're live in appState —
  //    the story-flag writes below spread the whole `world`, so they must build
  //    on the already-merged mechanics (not clobber them).
  commitAll(resolved, goblinResult);
  appendTranscript(playerInput, narratorResp.narration);
  addValue('session.turnCount', 1);
  commitRoller(roller);   // advance the seeded stream's cursor + append the roll log (recorded state)
  tick();

  // 6. Narrative engine (Phase 4): raise flags for this turn's events and let the
  //    red thread advance if the narration fulfilled the current beat. These are
  //    recorded writes, run BEFORE finalizeTurn so they fall INSIDE this turn's
  //    undo boundary — otherwise the last turn's flags land after the boundary
  //    and a reload's spine (and an undo/redo to this turn) would miss them.
  //    (Each self-ticks; maybeAdvanceBeat is best-effort.)
  if (killedNpc) {
    setStoryFlag('enemy-slain');
    if (killedNpc.isBoss) setStoryFlag(`boss-${killedNpc.creatureId ?? 'boss'}-slain`);
  }

  // 6b. Record this turn's mechanical changes in the world ledger, then extract
  //     the durable claims the narration just made. Together these are what
  //     makes the world remember: the dice write ground truth, the GM writes
  //     colour, and colour may never overwrite truth.
  recordTurnMechanics(resolved, goblinResult, killedNpc);

  // Experience for the kill. The engine has shipped the XP tables all along;
  // nothing ever called them, so every campaign ran at level 1 forever.
  let progression = null;
  if (killedNpc) {
    let block = null;
    try { block = statBlockFor(killedNpc.creatureId); } catch { block = { cr: 0 }; }
    progression = awardXp(xpForKill(killedNpc.creatureId, block),
      t('progress.killReason', { name: killedNpc.name }));
  }
  await absorbNarration(narratorResp.narration);
  await maybeRefreshDigest();   // rolling chapter memory (Epic E4)

  await maybeAdvanceBeat(narratorResp.narration);

  // 7. Turn fully committed (mechanics + flags) — register the undo boundary (a
  //    throw above never reaches here) and autosave once.
  finalizeTurn(turnMark);
  commit();

  return {
    ...narratorResp,
    progression: progression ? announcementFor(progression) : null,
    _debug: { classified, resolved, goblinResult, progression },
  };
}

// ─── World ledger (Epic E2) ──────────────────────────────────────────────────

// Write the turn's mechanical outcomes as ledger patches. These are ground
// truth: a later canon claim cannot contradict them.
function recordTurnMechanics(resolved, goblinResult, killedNpc) {
  const place = currentPlaceId();
  const room  = currentRoomId();

  if (killedNpc) {
    recordMechanical(`${place}.npc.${slugId(killedNpc.id)}`, 'alive', false, {
      scope:   killedNpc.isBoss ? 'regional' : 'local',
      because: `${killedNpc.name} was slain by the party`,
    });
  }
  if (resolved?.intent === 'take' && resolved.item?.name) {
    recordMechanical(`${room}.item.${slugId(resolved.item.id ?? resolved.item.name)}`, 'taken', true, {
      because: `the party took the ${resolved.item.name}`,
    });
  }
  if (resolved?.intent === 'unlock' && resolved.unlocked) {
    recordMechanical(room, 'gateUnlocked', true, { because: 'a locked way was opened' });
  }
  if (goblinResult?.hit) {
    const pc = appState.party?.pc?.record;
    if (pc) recordMechanical(`${place}.pc`, 'hpCurrent', goblinResult.pcNewHp, { because: 'wounded in combat' });
  }
}

// Ask the tiny tier what the narration asserted, then commit what survives
// validation. Best-effort by design: a failed extraction costs the world one
// turn of memory, never the turn itself.
async function absorbNarration(narration) {
  try {
    const place = currentPlaceId();
    const known = knownSceneIds(place);
    if (!known.length) return;
    const proposed = await extractCanon(narration, { knownIds: known, placeId: place });
    if (!proposed.facts.length && !proposed.mint.length) return;
    const res = commitCanon(proposed, { knownIds: known });
    if (res.minted.length) tick();
  } catch { /* memory is best-effort; never fail a committed turn */ }
}

// The entity ids the extractor is allowed to attach facts to: this room, this
// place, the NPCs present, and anything the ledger already knows here.
function knownSceneIds(place) {
  const room = currentRoomId();
  const ids  = new Set([place, room, `${place}.pc`]);
  for (const npc of Object.values(appState.world?.npcs ?? {})) {
    if (npc?.id) ids.add(`${place}.npc.${slugId(npc.id)}`);
  }
  for (const id of Object.keys(entitiesUnder(room))) ids.add(id);
  return [...ids];
}

const slugId = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

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
  const roller = beginRoller();
  const down  = resolveDownTurn(roller);
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
  commitRoller(roller);   // advance the seeded stream + append the death-save / strike rolls
  commit();

  return { narration, _debug: { down } };
}
