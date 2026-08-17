// Adventure pack validation — the smoke-test half of the milestone.
//
// An adventure pack is plain JSON-serializable data: metadata + a beats[]
// array the Beats runtime drives + scenes[] that bind presentation and
// content (encounters, treasure, cast, exits) to the flags those beats
// raise. The pack deliberately adds NO second story engine — the Beats
// thread stays the sole progression authority; scenes hang off it.
//
// validateAdventure cross-checks every reference in the pack against the
// registries it will actually be mounted with, and returns the repo's
// established `{ valid, errors[] }` error-list shape — every problem at
// once, not fix-one-rerun.

import { validateBeat, ARCHETYPE_ROLES } from '../beats/schema.js';
import { classifyEncounter } from '../encounter-design.js';

const DIFFICULTIES = ['trivial', 'low', 'moderate', 'high', 'deadly'];

/**
 * Validate one adventure pack against the monster and item registries it
 * will be mounted with (pass the MERGED registries — an engine constructed
 * with the pack's own extraMonsters/extraItems).
 *
 * @param pack       the adventure pack
 * @param registries { monsters, items } — id → record maps
 * @returns { valid, errors[] }
 */
export function validateAdventure(pack, { monsters = {}, items = {} } = {}) {
  const errors = [];
  if (pack === null || typeof pack !== 'object') {
    return { valid: false, errors: ['adventure must be an object'] };
  }
  for (const field of ['id', 'title', 'start']) {
    if (typeof pack[field] !== 'string' || !pack[field]) errors.push(`missing required field: ${field}`);
  }
  if (!Array.isArray(pack.beats) || !pack.beats.length) errors.push('an adventure carries a non-empty beats[]');
  if (!Array.isArray(pack.scenes) || !pack.scenes.length) errors.push('an adventure carries a non-empty scenes[]');
  if (!Array.isArray(pack.partyProfile?.levels) || !pack.partyProfile.levels.length) {
    errors.push('partyProfile.levels is required — encounter difficulty is a claim about a specific party');
  }
  if (errors.length) return { valid: false, errors };

  const npcs = pack.npcs ?? {};
  const beatIds = new Set();
  const allFlags = new Set();
  for (const beat of pack.beats) {
    const v = validateBeat(beat);
    if (!v.valid) errors.push(`beat ${beat?.id ?? '<no id>'}: ${v.errors.join(', ')}`);
    if (beatIds.has(beat.id)) errors.push(`duplicate beat id: ${beat.id}`);
    beatIds.add(beat.id);
    for (const f of beat.setRequiredFlags ?? []) allFlags.add(f);
  }
  for (const beat of pack.beats) {
    for (const s of beat.successors ?? []) {
      if (!beatIds.has(s)) errors.push(`beat ${beat.id}: successor '${s}' is not a beat in this pack`);
    }
    for (const slot of beat.requiredArchetypes ?? []) {
      if (!ARCHETYPE_ROLES.includes(slot.role)) {
        errors.push(`beat ${beat.id}: unknown archetype role '${slot.role}'`);
      } else if (!Object.values(npcs).some((n) => n.archetypeRole === slot.role)) {
        // A slot no pack npc can fill would strand the beat at cast time
        // — at the table, mid-session, which is the worst possible moment
        // to learn it.
        errors.push(`beat ${beat.id}: no pack npc can cast '${slot.role}'`);
      }
    }
  }

  const sceneIds = new Set();
  for (const scene of pack.scenes) {
    if (typeof scene.id !== 'string' || !scene.id) { errors.push('a scene is missing its id'); continue; }
    if (sceneIds.has(scene.id)) errors.push(`duplicate scene id: ${scene.id}`);
    sceneIds.add(scene.id);
  }
  if (!sceneIds.has(pack.start)) errors.push(`start '${pack.start}' is not a scene in this pack`);

  for (const scene of pack.scenes) {
    if (scene.beatId != null && !beatIds.has(scene.beatId)) {
      errors.push(`scene ${scene.id}: beatId '${scene.beatId}' is not a beat in this pack`);
    }
    for (const npcId of scene.cast ?? []) {
      if (!npcs[npcId]) errors.push(`scene ${scene.id}: cast '${npcId}' is not a pack npc`);
    }
    for (const exit of scene.exits ?? []) {
      if (!sceneIds.has(exit.to)) errors.push(`scene ${scene.id}: exit to '${exit.to}' is not a scene in this pack`);
      if (exit.requiresFlag && !allFlags.has(exit.requiresFlag)) {
        // A gate no beat ever opens is a soft-locked door — invisible in
        // authoring, fatal in play.
        errors.push(`scene ${scene.id}: exit requires flag '${exit.requiresFlag}', which no beat sets`);
      }
    }
    for (const entry of scene.treasure ?? []) {
      if (typeof entry === 'string' && !items[entry]) {
        errors.push(`scene ${scene.id}: treasure '${entry}' is not in the item registry`);
      }
    }
    if (scene.encounter) {
      const crs = [];
      for (const m of scene.encounter.monsters ?? []) {
        const block = monsters[m.id];
        if (!block) { errors.push(`scene ${scene.id}: encounter monster '${m.id}' is not in the registry`); continue; }
        for (let i = 0; i < (m.count ?? 1); i++) crs.push(block.cr);
      }
      const intended = scene.encounter.intendedDifficulty;
      if (intended !== undefined) {
        if (!DIFFICULTIES.includes(intended)) {
          errors.push(`scene ${scene.id}: unknown intendedDifficulty '${intended}'`);
        } else if (crs.length) {
          // The declared difficulty is a CLAIM; re-derive it. A drifted
          // composition fails validation instead of surprising a table.
          const { band, xp } = classifyEncounter({ monsterCRs: crs, partyLevels: pack.partyProfile.levels });
          if (band !== intended) {
            errors.push(`scene ${scene.id}: intendedDifficulty '${intended}' but the composition classifies '${band}' (${xp} XP)`);
          }
        }
      }
    }
  }

  for (const npc of Object.values(npcs)) {
    if (npc.statBlockId != null && !monsters[npc.statBlockId]) {
      errors.push(`npc ${npc.id}: statBlockId '${npc.statBlockId}' is not in the monster registry`);
    }
    if (npc.archetypeRole != null && !ARCHETYPE_ROLES.includes(npc.archetypeRole)) {
      errors.push(`npc ${npc.id}: unknown archetypeRole '${npc.archetypeRole}'`);
    }
  }

  // Every scene reachable from start — an unreachable scene is dead
  // content, which usually means a mis-typed exit id somewhere.
  const reachable = new Set([pack.start]);
  const queue = [pack.start];
  const byId = new Map(pack.scenes.map((s) => [s.id, s]));
  while (queue.length) {
    const scene = byId.get(queue.pop());
    for (const exit of scene?.exits ?? []) {
      if (!reachable.has(exit.to)) { reachable.add(exit.to); queue.push(exit.to); }
    }
  }
  for (const id of sceneIds) {
    if (!reachable.has(id)) errors.push(`scene ${id} is unreachable from '${pack.start}'`);
  }

  return { valid: errors.length === 0, errors };
}
