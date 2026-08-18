// === Variant rules: combat (2.14.0) ===
//
// Six opt-in table variants the roadmap promised: flanking, called
// shots, lingering injuries, severity-table massive damage, cleave-
// through, and fumble effects. None of them change baseline math —
// every function here is a pure helper the HOST invokes when its table
// has opted in, feeding the result back through the existing surfaces
// (attackRoll's advantage flag, Conditions.apply, applyDamage). The
// engine keeps no positional model (see movement.js) — flanking takes
// host-supplied grid coordinates.
//
// The rng-consuming helpers accept an injected `rng` and are also
// exposed engine-bound (engine.VariantCombat) so their rolls land in
// the roll log for replay verification, same contract as MagicItems.

// ── Flanking (grid variant) ─────────────────────────────────────────────
//
// SRD-style optional rule: melee attackers on directly opposite sides
// (or corners) of a creature flank it, granting advantage. Pure
// geometry over `{ x, y }` grid squares: attacker and ally must both be
// adjacent to the target, and the target's square must be the midpoint
// of theirs.

export function isFlanking({ attacker, ally, target }) {
  if (!attacker || !ally || !target) return false;
  const adjacent = (a, b) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
  if (!adjacent(attacker, target) || !adjacent(ally, target)) return false;
  return attacker.x + ally.x === 2 * target.x
    && attacker.y + ally.y === 2 * target.y;
}

// ── Called shots ────────────────────────────────────────────────────────
//
// Aiming at a location trades accuracy for a rider. The table is data;
// `calledShot` resolves the penalty and hands the host the rider to
// apply on a hit (conditions map to the SRD condition ids the engine
// already knows).

export const CALLED_SHOT_LOCATIONS = Object.freeze({
  arm: Object.freeze({
    id: 'arm', name: 'Arm', attackPenalty: -2,
    onHit: Object.freeze({ effect: 'drop-held-item' }),
  }),
  leg: Object.freeze({
    id: 'leg', name: 'Leg', attackPenalty: -2,
    onHit: Object.freeze({ effect: 'speed-halved-until-end-of-next-turn' }),
  }),
  hand: Object.freeze({
    id: 'hand', name: 'Hand', attackPenalty: -4,
    onHit: Object.freeze({ effect: 'disadvantage-on-attacks-until-end-of-next-turn' }),
  }),
  head: Object.freeze({
    id: 'head', name: 'Head', attackPenalty: -5,
    onHit: Object.freeze({ effect: 'dazed-no-reactions-until-start-of-next-turn' }),
  }),
  eye: Object.freeze({
    id: 'eye', name: 'Eye', attackPenalty: -6,
    onHit: Object.freeze({ conditionId: 'blinded', duration: '1 round' }),
  }),
});

export function calledShot(location) {
  const entry = CALLED_SHOT_LOCATIONS[location];
  if (!entry) {
    return { ok: false, reason: `unknown called-shot location: ${location}` };
  }
  return { ok: true, attackPenalty: entry.attackPenalty, onHit: entry.onHit };
}

// ── Lingering injuries ──────────────────────────────────────────────────
//
// Rolled when the host's table says an injury lands — the classic
// triggers are taking a critical hit, dropping to 0 HP, or failing a
// massive-damage save. d20 table, weighted toward the recoverable end.

export const LINGERING_INJURIES = Object.freeze([
  Object.freeze({ range: [1, 1], id: 'lose-an-eye', name: 'Lose an Eye', effect: 'disadvantage on sight-based Perception; blinded if it happens twice', healedBy: 'regenerate-class-magic' }),
  Object.freeze({ range: [2, 3], id: 'broken-limb', name: 'Broken Limb', effect: 'the limb is unusable until healed', healedBy: 'magical-healing-or-30-days' }),
  Object.freeze({ range: [4, 7], id: 'deep-wound', name: 'Deep Wound', effect: 'DC 10 CON save after each fight or gain a level of exhaustion', healedBy: 'magical-healing-or-10-days' }),
  Object.freeze({ range: [8, 10], id: 'festering-scar', name: 'Festering Scar', effect: 'hp maximum reduced by 1d4 until healed', healedBy: 'magical-healing' }),
  Object.freeze({ range: [11, 13], id: 'horrible-scar', name: 'Horrible Scar', effect: 'disadvantage on Persuasion, advantage on Intimidation', healedBy: 'regenerate-class-magic' }),
  Object.freeze({ range: [14, 16], id: 'limp', name: 'Limp', effect: 'walking speed -5 ft', healedBy: 'magical-healing-or-30-days' }),
  Object.freeze({ range: [17, 20], id: 'minor-scar', name: 'Minor Scar', effect: 'no mechanical effect — but the story remembers', healedBy: 'time' }),
]);

export function rollLingeringInjury(rng = Math.random) {
  const d20 = 1 + Math.floor(rng() * 20);
  const entry = LINGERING_INJURIES.find((e) => d20 >= e.range[0] && d20 <= e.range[1]);
  return { d20, injury: entry };
}

// ── Massive damage (severity table) ─────────────────────────────────────
//
// Variant: damage >= half hp max in one blow forces a DC 15 CON save;
// failure rolls on the system-shock table. The check itself returns
// the verdict and (on a triggering hit) the severity roll — the host
// still applies the damage through applyDamage as normal.

export const SYSTEM_SHOCK = Object.freeze([
  Object.freeze({ range: [1, 1], id: 'cardiac-shock', effect: 'drop to 0 hp' }),
  Object.freeze({ range: [2, 3], id: 'crumpled', effect: 'drop to 1 hp if not already lower' }),
  Object.freeze({ range: [4, 5], id: 'stunned-shock', effect: 'stunned until the end of your next turn' }),
  Object.freeze({ range: [6, 7], id: 'reeling', effect: 'no actions or reactions until the end of your next turn' }),
  Object.freeze({ range: [8, 10], id: 'winded', effect: 'disadvantage on everything until the end of your next turn' }),
]);

export function massiveDamageCheck({ amount, hpMax }, rng = Math.random) {
  const triggered = amount >= Math.ceil(hpMax / 2);
  if (!triggered) return { triggered: false };
  const d10 = 1 + Math.floor(rng() * 10);
  const shock = SYSTEM_SHOCK.find((e) => d10 >= e.range[0] && d10 <= e.range[1]);
  return { triggered: true, saveDC: 15, saveAbility: 'con', onFail: { d10, shock } };
}

// ── Cleave-through ──────────────────────────────────────────────────────
//
// Variant: when a melee blow drops a creature, leftover damage carries
// into another creature within reach (host decides which). Pure
// arithmetic; the host feeds `carryover` into the next applyDamage.

export function cleaveCarryover({ damage, targetHp }) {
  if (damage < targetHp) return { killed: false, carryover: 0 };
  return { killed: true, carryover: damage - targetHp };
}

// ── Fumble effects ──────────────────────────────────────────────────────
//
// The `fumbleOn` rules knob (Phase B) already decides WHICH faces
// fumble; this table decides what a fumble MEANS at tables that want
// more than a miss. d6, none of it lethal — fumbles that maim get old
// fast.

export const FUMBLE_EFFECTS = Object.freeze([
  Object.freeze({ range: [1, 2], id: 'off-balance', effect: 'disadvantage on your next attack this turn' }),
  Object.freeze({ range: [3, 4], id: 'drop-weapon', effect: 'your weapon lands in an adjacent square' }),
  Object.freeze({ range: [5, 5], id: 'overextended', effect: 'the nearest enemy may use its reaction to move 10 ft' }),
  Object.freeze({ range: [6, 6], id: 'wide-open', effect: 'the next attack against you before your next turn has advantage' }),
]);

export function rollFumbleEffect(rng = Math.random) {
  const d6 = 1 + Math.floor(rng() * 6);
  const entry = FUMBLE_EFFECTS.find((e) => d6 >= e.range[0] && d6 <= e.range[1]);
  return { d6, fumble: entry };
}
