// Adventure run state — ~100 lines of glue, deliberately not a runtime.
//
// The Beats thread remains the sole progression authority: scenes are
// presentation + content bindings keyed off the flags the host raises.
// A run is plain data ({ thread, flags, sceneId }), so it serializes
// inside a host's own save payload for free and round-trips through
// JSON.parse(JSON.stringify(run)) without ceremony.
//
// Everything here is pure: (adventure, run) in, new run out.

import { createThread, advance, currentBeat } from '../beats/thread.js';

/** Start a run: thread at beat one, no flags, standing at the start scene. */
export function createRun(adventure) {
  return {
    adventureId: adventure.id,
    thread: createThread(adventure.beats),
    flags: {},
    sceneId: adventure.start
  };
}

/**
 * Raise a story flag and let the thread advance as far as the new state
 * carries it. Advancing loops because one flag can complete a beat whose
 * successor is ALSO already complete (a host that resolved two objectives
 * before checking in) — stopping after one step would strand the thread a
 * beat behind the story. `chooseSuccessor` passes through to the Beats
 * runtime for branch points.
 */
export function setFlag(run, flag, { chooseSuccessor } = {}) {
  if (!flag || run.flags[flag]) return run;
  const flags = { ...run.flags, [flag]: true };
  let thread = run.thread;
  for (;;) {
    const r = advance(thread, { flags }, { chooseSuccessor });
    thread = r.thread;
    if (!r.advanced) break;
  }
  return { ...run, flags, thread };
}

/** The scene the party is standing in. */
export function currentScene(adventure, run) {
  return adventure.scenes.find((s) => s.id === run.sceneId) ?? null;
}

/** The run's active beat (the thread's, sub-threads included). */
export function activeBeat(run) {
  return currentBeat(run.thread);
}

/** Exits usable NOW: gated exits stay hidden until their flag is up. */
export function availableExits(adventure, run) {
  const scene = currentScene(adventure, run);
  return (scene?.exits ?? []).filter((e) => !e.requiresFlag || run.flags[e.requiresFlag] === true);
}

/**
 * Walk through an exit. Refuses (returns the same run + reason) rather
 * than throwing — a host wires this straight to a button.
 */
export function goTo(adventure, run, sceneId) {
  const open = availableExits(adventure, run).some((e) => e.to === sceneId);
  if (!open) return { run, moved: false, reason: `no open exit to '${sceneId}'` };
  return { run: { ...run, sceneId }, moved: true };
}

/**
 * Expand a scene's encounter composition into participants the Session
 * layer can adopt directly (`Session.create({ encounter: { participants } })`
 * / `session.startEncounter`): id'd per copy, statted from the registry,
 * flagged as foes. `monsters` is the MERGED registry — an engine built
 * with the pack's extraMonsters.
 */
export function encounterParticipants(scene, monsters) {
  const out = [];
  for (const { id, count = 1 } of scene?.encounter?.monsters ?? []) {
    const block = monsters[id];
    if (!block) throw new Error(`encounterParticipants: '${id}' is not in the monster registry`);
    for (let n = 1; n <= count; n++) {
      out.push({
        id: `${id}-${n}`,
        name: count > 1 ? `${block.name} ${n}` : block.name,
        hp: block.hp,
        hpMax: block.hp,
        ac: block.ac,
        dexterity: block.abilityScores?.dex ?? 10,
        speed: block.speed ?? 30,
        side: 'foe',
        statBlockId: id
      });
    }
  }
  return out;
}

/**
 * An entityProvider over the pack's npcs, for `Beats.castArchetypes`:
 * fills each archetype slot with the first npc whose `archetypeRole`
 * matches. Returns undefined on a miss so casting reports the structured
 * `missing` instead of a half-cast.
 */
export function entityProviderFrom(npcs) {
  const list = Object.values(npcs ?? {});
  return (slot) => list.find((n) => n.archetypeRole === slot.role);
}
