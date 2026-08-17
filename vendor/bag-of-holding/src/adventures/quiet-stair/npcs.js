// The Quiet Stair — the named cast (3 NPCs with motives and voice tags).
//
// The NPC shape is adventure-scoped, on purpose: src/beats/casting.js
// states the boundary — "bag-of-holding owns the dramatic shape; the app
// owns the cast" — so there is no kernel NPC registry and no extraNpcs
// plugin door. A pack-local record plus run.js's entityProviderFrom is
// enough to drive Beats.castArchetypes, and richer NPC shapes stay where
// they already live (the client's worldgen, the MCP's world pack).
//
//   { id, name, archetypeRole (∈ Beats.ARCHETYPE_ROLES),
//     voice: 1–3 performable tags, wants: concrete desires,
//     statBlockId: ref into the merged monster registry, or null }

export const QUIET_STAIR_NPCS = Object.freeze({
  'warden-hesk': {
    id: 'warden-hesk', name: 'Warden Hesk',
    archetypeRole: 'authority',
    voice: ['clipped', 'weary'],
    wants: ['the undercroft closed for good', 'no more missing lamplighters'],
    statBlockId: null
  },
  'sexton-brann': {
    id: 'sexton-brann', name: 'Brann of the Bell',
    archetypeRole: 'informant',
    voice: ['whispering', 'apologetic'],
    wants: ['the tolling to stop', 'absolution for sealing the stair'],
    statBlockId: null
  },
  'vel-the-still': {
    id: 'vel-the-still', name: 'Vel the Still',
    archetypeRole: 'antagonist',
    voice: ['toneless', 'speaks in borrowed phrases'],
    wants: ['perfect silence', 'a voice of its own'],
    // The antagonist IS the climax monster — one entity, two surfaces:
    // castArchetypes serves the person, the encounter serves the fight.
    statBlockId: 'still-abbot'
  }
});

export default QUIET_STAIR_NPCS;
