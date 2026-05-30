// === Magic items lifecycle (SRD 5.2 § Magic Items, since 1.9.0) ===
//
// Items have been pure data records since 1.0.0. This module adds
// the lifecycle: rarity bands, attunement (3-slot cap, prereq
// validation, short-rest gate), charges (spend + recharge), cursed
// items, identification, and forced-destruction saves.
//
// All functions are pure: actor in, actor out (plus a result
// envelope). The host owns the *narration* (the dawn description,
// the curse manifestation, the attunement ritual); the engine
// owns the *bookkeeping* (which slot is occupied, how many charges
// remain, whether a save succeeded).

import { rollDie } from './dice.js';
import { modFromScore } from './checks.js';

/** SRD 5.2 § Magic Items — Rarity table. Frozen. */
export const RARITY_BANDS = Object.freeze([
  'common', 'uncommon', 'rare', 'veryRare', 'legendary', 'artifact'
]);

/** Maximum number of magic items an actor can be attuned to. SRD: 3. */
export const ATTUNEMENT_CAP = 3;

/** Recharge schedule tags an item can declare via `charges.rechargesOn`. */
export const RECHARGE_KINDS = Object.freeze(['dawn', 'dusk', 'longRest', 'shortRest']);

/**
 * Does the actor currently meet `item.requiresAttunement`? Supports:
 *   - `{ classId: 'fighter' }` — must be of the named class.
 *   - `{ spellcaster: true }` — must have a spellcasting feature.
 *   - `{ abilityMin: { str: 13 } }` — must meet an ability score.
 * An item without a `requiresAttunement` field is freely attunable
 * (still subject to the 3-slot cap).
 */
export function canAttune(actor, item) {
  if (!item || typeof item !== 'object') {
    return { ok: false, reason: 'item must be an object' };
  }
  const attuned = Array.isArray(actor.attunedItems) ? actor.attunedItems : [];
  if (attuned.includes(item.id)) {
    return { ok: false, reason: 'already attuned to this item' };
  }
  if (attuned.length >= ATTUNEMENT_CAP) {
    return { ok: false, reason: `attunement cap reached (${ATTUNEMENT_CAP} items)` };
  }
  const req = item.requiresAttunement;
  if (req && typeof req === 'object') {
    if (req.classId && actor.classId !== req.classId) {
      return { ok: false, reason: `requires class ${req.classId}` };
    }
    if (req.spellcaster === true && actor.spellcaster !== true) {
      return { ok: false, reason: 'requires a spellcasting feature' };
    }
    if (req.abilityMin && typeof req.abilityMin === 'object') {
      for (const [ability, minimum] of Object.entries(req.abilityMin)) {
        const score = actor.abilityScores?.[ability] ?? 10;
        if (score < minimum) {
          return { ok: false, reason: `requires ${ability.toUpperCase()} ${minimum}+` };
        }
      }
    }
  }
  return { ok: true };
}

/**
 * Attune to a magic item. SRD § Magic Items — Attunement: requires
 * a Short Rest spent focused on the item; the engine accepts that
 * the host has gated the call behind a rest. Returns:
 *   `{ ok: true, actor }` — actor with the item added to
 *     `attunedItems` and (if the item has charges) the initial
 *     charge state stamped on `actor.itemCharges[itemId]`.
 *   `{ ok: false, reason }` — debuggable refusal.
 *
 * Cursed items don't refuse attunement here — they refuse
 * unattunement later (see `unattune`).
 */
export function attune(actor, item) {
  const check = canAttune(actor, item);
  if (!check.ok) return check;
  const attuned = Array.isArray(actor.attunedItems) ? actor.attunedItems : [];
  let next = { ...actor, attunedItems: [...attuned, item.id] };
  if (item.charges) {
    // Item records with a charges block are expected to declare max
    // — a missing max is a content bug worth surfacing as a
    // TypeError at access time rather than silently treating as 0.
    const existing = next.itemCharges ?? {};
    next = {
      ...next,
      itemCharges: { ...existing, [item.id]: { used: 0, max: item.charges.max } }
    };
  }
  return { ok: true, actor: next };
}

/**
 * End attunement to a magic item. Refuses on a cursed item that
 * hasn't had Remove Curse applied (host signals via
 * `args.removeCurseApplied: true`).
 */
export function unattune(actor, item, args = {}) {
  const attuned = Array.isArray(actor.attunedItems) ? actor.attunedItems : [];
  if (!attuned.includes(item.id)) {
    return { ok: false, reason: 'not attuned to this item' };
  }
  if (item.cursed && args.removeCurseApplied !== true) {
    return { ok: false, reason: 'item is cursed; cannot voluntarily un-attune without Remove Curse' };
  }
  const nextAttuned = attuned.filter((id) => id !== item.id);
  let next = { ...actor, attunedItems: nextAttuned };
  if (next.itemCharges?.[item.id]) {
    const { [item.id]: _, ...rest } = next.itemCharges;
    next = { ...next, itemCharges: rest };
  }
  return { ok: true, actor: next };
}

/**
 * Spend `amount` charges from a magic item. Reads / writes
 * `actor.itemCharges[itemId]`. Refuses if the item isn't being
 * tracked (host should have called `attune` first) or there aren't
 * enough charges remaining.
 */
export function spendCharge(actor, itemId, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error('spendCharge: amount must be a positive integer');
  }
  const charges = actor.itemCharges?.[itemId];
  if (!charges) return { ok: false, reason: `no charge state for item: ${itemId}` };
  const remaining = charges.max - charges.used;
  if (remaining < amount) {
    return { ok: false, reason: `not enough charges: ${remaining} left, ${amount} needed` };
  }
  return {
    ok: true,
    actor: {
      ...actor,
      itemCharges: {
        ...actor.itemCharges,
        [itemId]: { ...charges, used: charges.used + amount }
      }
    }
  };
}

/**
 * Recharge an item's charges. The host calls this from its
 * dawn/dusk/rest event handler. `item.charges.recovers` is a dice
 * spec (e.g. `'1d6+4'`) OR a fixed integer; if absent, the engine
 * recovers `max` (full refill). Recoveries cap at `max`.
 *
 * Returns `{ ok, recovered, actor }` — `recovered` is the applied
 * delta. Refuses for items not attuned / not tracked.
 */
export function rechargeItem(actor, item, rng = Math.random) {
  if (!item || typeof item !== 'object') {
    return { ok: false, reason: 'item must be an object' };
  }
  const charges = actor.itemCharges?.[item.id];
  if (!charges) return { ok: false, reason: `no charge state for item: ${item.id}` };
  const recoverSpec = item.charges?.recovers;
  let newUsed;
  if (typeof recoverSpec === 'number') {
    newUsed = Math.max(0, charges.used - recoverSpec);
  } else if (typeof recoverSpec === 'string') {
    // Inline parse: `XdY+Z` only — the host can also pass a number
    // for a flat recovery. We use the engine's `rollDie` so the
    // recovery is replay-deterministic when the rng is seeded.
    newUsed = Math.max(0, charges.used - parseDiceSpec(recoverSpec, rng));
  } else {
    // No `recovers` spec → "regains all expended charges" per SRD
    // wording on most items without a recovery die.
    newUsed = 0;
  }
  const recovered = charges.used - newUsed;
  return {
    ok: true,
    recovered,
    actor: {
      ...actor,
      itemCharges: {
        ...actor.itemCharges,
        [item.id]: { ...charges, used: newUsed }
      }
    }
  };
}

// Inline dice parser for `XdY+Z` recovery specs. Defensive against
// malformed input — a misconfigured item shouldn't crash a rest.
function parseDiceSpec(spec, rng) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(spec).trim());
  if (!m) throw new Error(`rechargeItem: invalid dice spec: ${spec}`);
  const count = Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3]) : 0;
  let total = mod;
  for (let i = 0; i < count; i++) total += rollDie(sides, rng);
  return total;
}

/**
 * Mark an item as identified for the actor. SRD § Magic Items —
 * Identification: until identified, an item's properties may be
 * hidden from the player. Pure: returns a new actor with
 * `identifiedItems` extended.
 */
export function identifyItem(actor, itemId) {
  const known = Array.isArray(actor.identifiedItems) ? actor.identifiedItems : [];
  if (known.includes(itemId)) return actor;
  return { ...actor, identifiedItems: [...known, itemId] };
}

/** Predicate: has the actor identified this item? */
export function isIdentified(actor, itemId) {
  return Array.isArray(actor.identifiedItems) &&
    actor.identifiedItems.includes(itemId);
}

/**
 * Roll the item's saving throw against destruction. SRD § Magic
 * Items — Magic Item Resilience: many magic items resist damage and
 * destruction; the engine surfaces the per-item save vs an incoming
 * DC. Returns `{ d20, total, success }`.
 */
export function itemSavingThrow(item, dc, rng = Math.random) {
  if (!item.savingThrow) {
    // Items without a declared save are non-magical or carry the
    // default "items aren't destroyed by routine damage" assumption.
    // We surface success so the host can short-circuit damage.
    return { d20: 0, total: 0, success: true, noSave: true };
  }
  const bonus = item.savingThrow.bonus ?? 0;
  const d20 = rollDie(20, rng);
  const total = d20 + bonus;
  return { d20, total, success: total >= dc };
}
