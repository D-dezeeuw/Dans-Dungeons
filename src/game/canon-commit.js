// src/game/canon-commit.js — validate and commit what the GM just invented.
//
// The extractor (src/ai/canon.js) proposes; this module disposes. Everything
// arriving here is model output, so it is treated as a request, not a fact:
//
//   • facts may only attach to entity ids that were in the scene packet
//   • mints are deduped by name within their parent, so re-telling a rumour
//     does not create a second ghoul
//   • a minted creature is bound to a real stat block, so "a ghoul haunts the
//     privy" becomes something the rules engine can actually run a fight with
//   • a minted threat gets a clock, so ignoring it has consequences (E9.S3)
//
// The ledger's precedence gate does the last check: nothing here can overwrite
// what the dice decided.

import { recordCanon, recordMechanical, entitiesUnder, currentPlaceId, currentRoomId } from './ledger.js';
import { makeId, slugSegment } from 'bag-of-holding-client';
import { statBlockFor, KNOWN_CREATURE_IDS } from './bestiary.js';
import { appState, setValue } from '../core/state.js';
import { buildEnemy } from './world.js';

// How many segments a threat clock has before it escalates on its own.
const THREAT_CLOCK_SEGMENTS = 4;

// Commit a validated extraction. Returns a summary the caller can log or
// surface: { applied, rejected, minted: [{id, kind, name}] }.
export function commitCanon({ facts = [], mint = [] }, { knownIds = [] } = {}) {
  const known = new Set(knownIds);
  const out = { applied: 0, rejected: 0, minted: [] };

  for (const f of facts) {
    if (!known.has(f.target)) { out.rejected++; continue; }   // invented an address
    const ok = recordCanon(f.target, f.path, f.value, {
      scope:   f.scope === 'regional' ? 'regional' : 'local',
      because: f.because,
    });
    ok ? out.applied++ : out.rejected++;
  }

  for (const m of mint) {
    const created = mintEntity(m);
    if (created) out.minted.push(created);
    else out.rejected++;
  }
  return out;
}

// Create one proposed entity, or return null if it is a duplicate or unusable.
function mintEntity(proposal) {
  const kind = proposal?.kind;
  const name = String(proposal?.name ?? '').trim();
  if (!name || !['npc', 'creature', 'detail', 'site'].includes(kind)) return null;

  // Details belong to the room; everything else to the place (they outlive the
  // room the player happened to be standing in when they were mentioned).
  const parent = kind === 'detail' ? currentRoomId() : currentPlaceId();
  const id = makeId(parent, kind, name);

  // Dedup: same id already known, or a same-kind sibling with the same name.
  const siblings = entitiesUnder(parent);
  if (siblings[id]) return null;

  recordCanon(id, 'name', name, { because: `the Game Master introduced ${name}` });
  if (proposal.note) recordCanon(id, 'description', proposal.note, { because: 'first described' });

  // A creature the GM conjured becomes a real, fightable thing: bind a stat
  // block so the deterministic layer can run the encounter it implied.
  if (kind === 'creature') {
    const creatureId = resolveCreature(proposal.creature, name);
    if (creatureId) {
      recordMechanical(id, 'creatureId', creatureId, { because: 'bound to a stat block' });
      recordMechanical(id, 'alive', true);
      recordCanon(id, 'attitude', proposal.threat ? 'hostile' : 'wary');
      // Inside a dungeon, "fightable" means NOW: the resolver only fights
      // world.npcs, so a minted creature that never spawned there was
      // fightable in the ledger and nowhere else. Settlement/road mints stay
      // ledger-side and are reached through the confront path instead.
      if (appState.world?.location?.type === 'dungeon' && proposal.threat) {
        const roomId = currentRoomId();
        const npcId  = `minted-${slugSegment(name)}`;
        if (roomId && !appState.world?.npcs?.[npcId]) {
          const enemy = buildEnemy(creatureId, { npcId, roomId });
          setValue(`world.npcs.${npcId}`, { ...enemy, name, mintedId: id });
        }
      }
    }
  }

  // A threat that is ignored should get worse, not quietly vanish.
  if (proposal.threat) {
    recordCanon(id, 'state', 'active-threat', {
      scope:   'regional',
      because: `${name} is a growing danger`,
    });
    recordMechanical(id, 'clock', { segments: THREAT_CLOCK_SEGMENTS, filled: 0 }, {
      scope: 'regional', because: 'threat clock started',
    });
  }

  return { id, kind, name, threat: !!proposal.threat };
}

// Map the extractor's free-text creature guess onto a real bestiary id.
// Exact id first, then a loose name match, then null (the entity still exists
// as narrative colour — it just cannot be fought until something binds it).
function resolveCreature(guess, name) {
  const want = slugSegment(guess || name);
  if (KNOWN_CREATURE_IDS.includes(want)) return want;
  const loose = KNOWN_CREATURE_IDS.find(id => want.includes(id) || id.includes(want));
  if (loose) return loose;
  try { return statBlockFor(want) ? want : null; } catch { return null; }
}
