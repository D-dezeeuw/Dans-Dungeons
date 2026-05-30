// The engine never knows about specific entities — the app supplies
// a callback that picks a live entity to fill each archetype slot.
// This is the boundary in action: bag-of-holding owns the dramatic
// shape ("this beat needs an authority figure"); the app owns the
// cast ("Queen Eliana is the authority figure here").

/**
 * Iterate the beat's archetype slots and ask the provider to fill
 * each one. Returns a structured `{ cast, missing, error }` rather
 * than throwing on a miss because the loop wants to render a UI
 * affordance ("can't start this beat — need an antagonist") rather
 * than crash on it.
 *
 * The provider not being a function throws because that's a wiring
 * bug at the app boundary — silent fallback would mask "I forgot
 * to pass entityProvider" until the first beat that needs casting.
 *
 * On the first unfilled slot we return early with `cast: null` so
 * the caller doesn't get a half-cast object that looks usable; the
 * `missing` field carries the slot the provider failed on so the
 * UI can highlight exactly what's needed.
 */
export function castArchetypes(beat, { entityProvider }) {
  if (typeof entityProvider !== 'function') {
    throw new Error('entityProvider callback is required for beat casting');
  }
  const cast = {};
  for (const slot of beat.requiredArchetypes ?? []) {
    const entity = entityProvider(slot);
    if (!entity) {
      return { cast: null, missing: slot, error: `No entity for archetype: ${slot.role}` };
    }
    cast[slot.role] = entity;
  }
  return { cast, missing: null, error: null };
}
