// src/game/loop.js
//
// The turn engine. This is the ONLY thing that:
//   - calls the AI (via ai/classify.js, ai/narrate.js)
//   - writes to Spektrum (via resolver.js → state.js)
//
// The UI reads appState and renders; it never drives AI calls directly.
// flow.js calls checkApiKey() and generateTurnImage() here so those modules
// never import AI layers directly either.

import { appState, addValue, setValue, tick, commit } from '../core/state.js';
import { classify, checkBeatFulfilled }       from '../ai/classify.js';
import { narrate, generateSceneImage }       from '../ai/narrate.js';
import { checkKey }                          from '../ai/client.js';
import { resolveRules, goblinRetaliates, commitAll, appendTranscript,
         isPcDown, resolveDownTurn, commitDownTurn } from './resolver.js';
import { beginRoller, commitRoller }          from './rng.js';
import { buildStoryContext, setStoryFlag, activeBeat, completeBeatNow, takePendingActClose, requeueActClose } from './story.js';
import { beginTurn, finalizeTurn }          from './undo.js';
import { recordMechanical, currentPlaceId, currentRoomId, entitiesUnder,
         recentEvents, encounterKey } from './ledger.js';
import { assembleScope }                     from './scope.js';
import { extractCanon }                      from '../ai/canon.js';
import { memoryContext, maybeRefreshDigest } from './chapters.js';
import { commitCanon }                       from './canon-commit.js';
import { resolveThreat }                     from './world-clocks.js';
import { nextActContext, adoptAct, beatSatisfiedByFlags, TARGET_ACTS } from './acts-runtime.js';
import { generateAct }                       from '../ai/acts.js';
import { awardXp, xpForKill, announcementFor } from './progression.js';
import { statBlockFor }                      from './bestiary.js';
import { castableSpells, slotSummary }       from './spells.js';
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

  // A caster's live spell list, so the classifier names ids that exist and the
  // narrator knows a Fire Bolt is a Fire Bolt. Absent entirely for non-casters,
  // which keeps a fighter's prompt exactly as small as it was.
  const magic = appState.party?.magic;
  if (record && magic) {
    const list = castableSpells(record, sheet, magic);
    if (list.length) {
      scene.spells = list.map(s => ({
        id: s.id, name: s.name, level: s.level, castable: s.castable,
        ...(s.damage ? { damage: s.damage } : {}),
        ...(s.healing ? { healing: s.healing } : {}),
      }));
      scene.spellSlots = slotSummary(magic.slots);
    }
  }

  // The scope packet (Epic E5.S1) is assembled once and CONSUMED — its world
  // and region slices are the budget-clamped digests, its details/recently are
  // the ledger memory, its nearby/known are the sense and knowledge tiers.
  // buildScene used to rebuild its own unclamped digest chain beside the
  // packet, so the token budget applied to an object that never reached the
  // prompt: budget theater, measured against nothing.
  const packet = assembleScope();
  const digestPath = [];
  const loc = appState.world?.location;
  if (loc?.dungeonId) {
    const d = appState.world.dungeons?.[loc.dungeonId];
    if (d?.digest) digestPath.push(d.digest);
  }
  if (loc?.settlementId) {
    const s = appState.world.settlements?.[loc.settlementId];
    if (s?.digest) digestPath.push(s.digest);
  }
  if (packet.region?.digest) digestPath.push(packet.region.digest);
  if (packet.world?.digest)  digestPath.push(packet.world.digest);
  if (digestPath.length) scene.worldContext = digestPath.join(' | ');

  // Phase 4: story context — current beat directive (GM-only), faction tensions,
  // active quests, recent flags — so the narrator weaves the red thread in.
  const story = buildStoryContext();
  if (story) scene.story = story;

  // The generated world's tone travels with the scene so the narrator stops
  // hardcoding one voice regardless of what the blueprint rolled.
  const tone = packet.world?.tone ?? appState.world?.tone;
  if (tone) scene.tone = tone;

  // Ledger memory (Epic E2): what this place has accumulated, and what the world
  // has been doing lately. This is what stops the GM contradicting itself — the
  // mould it described thirty turns ago comes back with the room.
  if (packet.here?.details?.length) scene.knownDetails = packet.here.details;
  if (packet.recently?.length)     scene.recentEvents = packet.recently;

  if (packet.nearby?.length) scene.nearby = packet.nearby;
  if (packet.known?.length)  scene.known  = packet.known;

  return scene;
}

// GM-private material — the beat directive and any unrevealed NPC secrets.
// Kept OUT of buildScene so it never reaches the UI, the save, or an export;
// only the narrator's system prompt sees it.
export function buildGmContext() {
  return assembleScope({ includeGmOnly: true }).gmOnly ?? null;
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
  const killedNpc = (['attack', 'cast'].includes(resolved.intent) && resolved.targetDead)
    ? appState.world?.npcs?.[resolved.targetId] : null;

  // 3. Compute goblin retaliation BEFORE committing PC's attack.
  //    A killed goblin must not retaliate.
  const goblinTurnTriggered = ['attack', 'cast', 'skill', 'wait', 'look', 'talk', 'move', 'take',
                               'unlock', 'rest', 'use', 'flee'].includes(resolved.intent);
  const goblinSurvived      = !['attack', 'cast'].includes(resolved.intent) || !resolved.targetDead;
  // Getting away means getting away: a successful flight is not punished by the
  // enemy it just escaped — and neither is a successful STEALTH check, which is
  // the exact contradiction the audit named twice: success narrated while the
  // goblin's hit landed in the same paragraph. The resolver decides; the
  // narrator only describes.
  const escaped             = resolved.intent === 'flee' && resolved.success === true;
  const hidden              = resolved.intent === 'skill'
    && resolved.skill === 'stealth'
    && resolved.success === true;
  const goblinResult        = (goblinTurnTriggered && goblinSurvived && !escaped && !hidden)
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
    buildGmContext(),         // secrets + directive, system prompt only (E5.S1)
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
    // Both the specific and the generic flag: a beat can name the creature it
    // is about, and an act generator that only knows "a boss dies" can still
    // write a beat that ends when one does.
    if (killedNpc.isBoss) {
      setStoryFlag('boss-slain');
      setStoryFlag(`boss-${killedNpc.creatureId ?? 'boss'}-slain`);
    }
  }
  // The other mechanical facts an act can turn on. These are what make
  // flag-primary beat completion possible: the dice write them, so a beat about
  // them never needs a model to confirm what already happened.
  if (resolved.intent === 'take' && resolved.itemType === 'treasure') setStoryFlag('treasure-taken');
  if (resolved.intent === 'unlock' && resolved.unlocked)                setStoryFlag('gate-unlocked');
  if (resolved.intent === 'move' && resolved.newRoomId)                 setStoryFlag(`room-${resolved.newRoomId}-entered`);

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
  // Canon extraction and the beat check both read this turn's narration and
  // write disjoint state (the ledger vs the red thread), so running them in
  // series only ever cost the player latency — two tiny-tier round trips back
  // to back at the end of every turn. Started together, awaited before the
  // undo boundary so their writes still land INSIDE this turn.
  const canonPass = absorbNarration(narratorResp.narration);
  const beatPass  = maybeAdvanceBeat(narratorResp.narration);

  await canonPass;
  await maybeRefreshDigest();   // rolling chapter memory (Epic E4)
  await beatPass;

  // An act can also close on the FLAG path (setStoryFlag → the act's last
  // beat completes on a mechanical flag — the designed common case). That
  // closure is queued synchronously and drained here, at the turn's async
  // seam; before this drain existed, the next act was simply never generated
  // and the campaign's story stopped without a word.
  if (takePendingActClose()) { await settleActClose(); _actJustClosed = true; }

  // 7. Turn fully committed (mechanics + flags) — register the undo boundary (a
  //    throw above never reaches here) and autosave once.
  finalizeTurn(turnMark);
  commit();

  return {
    ...narratorResp,
    progression: progression ? announcementFor(progression) : null,
    epilogueLines: takeEpilogue(),
    // flow.js cuts a chapter (with its banner ceremony) on an act transition —
    // the loop cannot import flow, so the fact travels in the result.
    actClosed: takeActClosed(),
    _debug: { classified, resolved, goblinResult, progression },
  };
}

let _actJustClosed = false;
function takeActClosed() {
  const closed = _actJustClosed;
  _actJustClosed = false;
  return closed;
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
    // A MINTED creature (the GM invented it, the extractor made it real) has
    // its own ledger identity and possibly a threat clock — killing it must
    // resolve THAT entity, or the rumours keep circulating about a dead thing.
    if (killedNpc.mintedId) resolveThreat(killedNpc.mintedId, { name: killedNpc.name });
  }
  // The resolver returns itemId/itemName; this read `resolved.item`, which the
  // take branch has never set — so no pickup has ever reached the ledger.
  if (resolved?.intent === 'take' && resolved.itemName) {
    recordMechanical(`${room}.item.${slugId(resolved.itemId ?? resolved.itemName)}`, 'taken', true, {
      scope:   resolved.itemType === 'treasure' ? 'regional' : 'local',
      because: `the party took the ${resolved.itemName}`,
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
    markEncountered(known);
    const proposed = await extractCanon(narration, { knownIds: known, placeId: place });
    if (!proposed.facts.length && !proposed.mint.length) return;
    const res = commitCanon(proposed, { knownIds: known });
    if (res.minted.length) tick();
  } catch { /* memory is best-effort; never fail a committed turn */ }
}

// The entity ids the extractor is allowed to attach facts to: this room, this
// place, the NPCs present, and anything the ledger already knows here.
// Record that the player has now seen these entities. The scope assembler's
// `known` tier filters on this, which is what stops the GM referring to things
// this character has never encountered.
function markEncountered(ids) {
  const seen = appState.world?.encountered ?? {};
  for (const id of ids) {
    const key = encounterKey(id);
    if (!seen[key]) setValue(`world.encountered.${key}`, true);
  }
}

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
    // Flags first. A beat whose mechanical conditions are met is over — the
    // dice said so — and confirming it with a paid call would be both an
    // expense and a way for the campaign to stall on a judge that says no.
    const byFlags = beatSatisfiedByFlags();
    if (byFlags) {
      const { completed, actClosed } = completeBeatNow(byFlags);
      if (actClosed) { await settleActClose(); _actJustClosed = true; }
      return completed;
    }

    const res = await checkBeatFulfilled(beat.dramaticPurpose, narration);
    if (!res?.fulfilled) return false;
    const { completed, actClosed } = completeBeatNow(beat.id);
    // An act closing is the campaign's biggest structural moment: the next act
    // is written from what actually happened, so the story bends toward the
    // campaign the player is really having.
    if (actClosed) { await settleActClose(); _actJustClosed = true; }
    return completed;
  } catch { /* narration check is best-effort */ }
  return false;
}

// Generate and adopt the next act — or, when the finale act just closed, end
// the campaign properly. Completing the last act used to return null into
// silence: no epilogue, no completion state, play drifting on actless — the
// old "completing the last beat changes a progress line" defect, one level up.
export async function onActClosed() {
  const ctx = nextActContext();
  if (ctx.actNumber > TARGET_ACTS) return finishCampaign();
  const generated = await generateAct(ctx);
  if (!generated) return null;
  return adoptAct(generated);
}

// One drained close, made durable: `actIndex` advanced when the beat
// completed, so a failed generation here used to strand the thread actless
// forever (audit F3). A null result re-queues the close and the next turn —
// or the next settlement action — retries.
async function settleActClose() {
  const result = await onActClosed();
  if (result === null && !appState.session?.campaignComplete) requeueActClose();
  return result;
}

// The settlement loop's seam. Towns never run processTurn, so a close raised
// by a settlement flag (settlement-reached, region-reached, visited-*) was
// queued and never drained while the player stayed in town — and lost on
// reload. Returns what the flow layer needs to hold the ceremony:
// { closed, epilogueLines } or null when nothing was pending.
export async function drainActClose() {
  if (!takePendingActClose()) return null;
  const result = await settleActClose();
  if (result === null) return null;   // generation failed — re-queued, retry later
  return { closed: true, epilogueLines: takeEpilogue() };
}

// The campaign's ending, rendered from the ledger — the world's own record of
// what the player did, not a model's guess at it. Runs once; the flag is
// persisted so a reload does not replay the ceremony.
let _epilogueLines = null;
function takeEpilogue() {
  const lines = _epilogueLines;
  _epilogueLines = null;
  return lines;
}

function finishCampaign() {
  if (appState.session?.campaignComplete) return null;
  setValue('session.campaignComplete', true);
  const deeds = recentEvents({ limit: 6, minScope: 'regional' }).map(e => e.because).filter(Boolean);
  const name = appState.party?.pc?.record?.name ?? t('story.epilogueUnknownHero');
  const world = appState.world?.name ?? '';
  _epilogueLines = [
    t('story.epilogueHeader'),
    t('story.epilogueOpening', { name, world }),
    ...deeds.map(d => t('story.epilogueDeed', { deed: d })),
    t('story.epilogueClosing'),
  ];
  tick();
  return { complete: true };
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
