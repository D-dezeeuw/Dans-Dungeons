// src/game/scope.js — the scope packet: what the GM sees, per turn (Epic E5.S1).
//
// docs/ideas/12-context-scoping.md designed this in May and none of it was
// built. The narrator received a scene snapshot, a digest chain, and three
// transcript entries; there was no notion of "nearby", no filtering by what the
// player actually knows, no token budget, and — worst — GM-private material
// (an NPC's secret, the current beat's directive) travelled in the same object
// the UI reads and the save writes to disk.
//
// The packet is assembled once per turn and reused across the turn's calls:
//
//   here      full detail of where the player is standing
//   nearby    sense-impressions of what is one step away
//   region    the region digest, refreshed when the ledger marks it stale
//   world     the campaign backbone
//   memory    chapter digests + rolling summary (chapters.js)
//   known     what THIS character has learned
//   gmOnly    secrets and directives — injected into the system prompt only
//
// Ordered stable-first so a provider's prefix cache can serve the unchanging
// head cheaply, and budgeted so context creep is caught in tests rather than
// on the bill.

import { appState } from '../core/state.js';
import { entitiesUnder, detailsAt, recentEvents, currentPlaceId, currentRoomId, hasEncountered } from './ledger.js';
import { memoryContext } from './chapters.js';
import { buildStoryContext } from './story.js';
import { activeSetups } from './acts-runtime.js';
import { BUDGET, estimateTokens, scopeCost } from './scope-budget.js';

export { BUDGET, estimateTokens, scopeCost };

export function assembleScope({ includeGmOnly = false } = {}) {
  const place = currentPlaceId();
  const room  = currentRoomId();

  const packet = {};

  // ── world / region: stable, cacheable head ────────────────────────────────
  const world = appState.world ?? {};
  if (world.digest) packet.world = { name: world.name, tone: world.tone, digest: clamp(world.digest, BUDGET.world) };

  const regionId = world.location?.regionId;
  const region   = regionId ? world.regions?.[regionId] : null;
  if (region?.digest) packet.region = { name: region.name, digest: clamp(region.digest, BUDGET.region) };

  // ── memory: chapter digests, then the live chapter ────────────────────────
  const memory = memoryContext();
  if (memory) packet.memory = memory;

  // ── here: everything about where the player stands ────────────────────────
  const roomRec = world.rooms?.[world.currentRoom];
  packet.here = {
    place: region?.name ?? world.name ?? null,
    room: roomRec ? {
      name:        roomRec.name,
      description: roomRec.description,
      exits: (roomRec.exits ?? []).map(e => ({ direction: e.dir, locked: !!e.locked })),
      items: (roomRec.loot ?? []).filter(i => !i.taken).map(i => i.name),
    } : null,
    npcs: Object.values(world.npcs ?? {})
      .filter(n => n.roomId === world.currentRoom && n.alive)
      .map(n => ({ name: n.name, attitude: n.attitude, hp: n.hp, maxHp: n.maxHp })),
    // Details this place has accumulated — the mould, the cracked bell.
    details: detailsAt(room).map(d => `${d.name}: ${d.note}`),
  };

  // ── nearby: sense impressions only ────────────────────────────────────────
  const nearby = (roomRec?.exits ?? []).map((e) => {
    const target = world.rooms?.[e.roomId];
    if (!target) return null;
    const occupied = Object.values(world.npcs ?? {}).some(n => n.roomId === e.roomId && n.alive);
    return {
      direction: e.dir,
      sense: e.locked ? 'a locked way' : (occupied ? 'movement, somewhere beyond' : firstClause(target.description)),
    };
  }).filter(Boolean);
  if (nearby.length) packet.nearby = nearby;

  // ── known: what THIS character has learned ────────────────────────────────
  const known = knownToPlayer(place);
  if (known.length) packet.known = known;

  const events = recentEvents({ limit: 5 });
  if (events.length) packet.recently = events.map(e => e.because);

  // ── gmOnly: never leaves the system prompt ────────────────────────────────
  // Secrets and the beat directive used to ride inside the same scene object
  // that the UI renders and the save serialises to disk.
  if (includeGmOnly) {
    const gm = {};
    const story = buildStoryContext();
    if (story?.directive) gm.directive = story.directive;
    if (story?.preferredLocation) gm.preferredLocation = story.preferredLocation;
    const secrets = Object.values(world.settlements?.[world.location?.settlementId]?.npcs ?? {})
      .filter(n => n?.secret && !n.secretRevealed)
      .map(n => ({ npc: n.name, secret: n.secret }));
    if (secrets.length) gm.secrets = secrets;
    // Clues waiting to be dropped. GM-private by nature: foreshadowing the
    // player is handed outright is not foreshadowing.
    const setups = activeSetups();
    if (setups.length) gm.setups = setups.slice(0, 4);
    if (Object.keys(gm).length) packet.gmOnly = gm;
  }

  return packet;
}

// Facts the player has actually encountered, as short lines. Filtering by
// encounter is what stops the GM referring to things the character has never
// seen — the information-asymmetry model doc 08 asked for, at v1 scale.
function knownToPlayer(place) {
  const out = [];
  for (const [id, rec] of Object.entries(entitiesUnder(place))) {
    if (!hasEncountered(id)) continue;
    const note = rec.note ?? rec.description ?? rec.condition ?? null;
    if (note) out.push(`${rec.name ?? id.split('.').pop()}: ${note}`);
    if (out.length >= 8) break;
  }
  return out;
}

const firstClause = (text) => String(text ?? '').split(/[.;]/)[0].slice(0, 90) || 'quiet';
const clamp = (text, budgetTokens) => String(text ?? '').slice(0, budgetTokens * 3);
