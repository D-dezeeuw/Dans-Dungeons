// === Encounter system ===
//
// Today the engine resolves *one attack*. To run a full encounter
// the host has to compose the missing pieces by hand: who goes
// next, who has an action left, who used their reaction, did a
// move provoke an OA. This module bundles all of that into a small,
// pure state machine — input goes in, new state comes out, no
// mutation, no I/O. Same host/engine boundary as the rest of the
// kernel.
//
// Why a new module rather than extending `combat.js`: `combat.js`
// is the *math* of one resolution (attack rolls, damage rolls,
// mastery riders). The encounter system is *bookkeeping* — turn
// order, action budgets, reaction state. Separating them keeps the
// pure-math file pure and lets a host that just wants the math
// (a dice bot, an SRD reference app) skip the encounter cost.

import { rollDie } from './dice.js';
import { modFromScore } from './checks.js';
import { attackRoll } from './combat.js';
import { DEFAULT_RULES } from './rules.js';

// === Action economy ===
//
// SRD 5.2 standard per-turn budgets: 1 action, 1 bonus action,
// 1 reaction (which actually carries between turns and resets at
// the start of your next turn), plus movement up to your speed.

const DEFAULT_ACTION_BUDGET = Object.freeze({
  action: 1,
  bonus: 1,
  reaction: 1,
  movement: null   // overridden per-actor from speed
});

/** Cost vocabulary the engine accepts. Mirrors the moveset chip
 *  costs so the same string moves end-to-end without re-mapping. */
export const ACTION_COSTS = Object.freeze(['action', 'bonus', 'reaction', 'movement', 'free']);

/**
 * Compute a fresh action-budget snapshot for an actor. Movement is
 * the actor's `speed` (the host's responsibility to pass; usually
 * comes from the derived sheet's `speed.walk`). The other budgets
 * are constants — the standard SRD economy.
 */
export function freshBudget(speed) {
  return { ...DEFAULT_ACTION_BUDGET, movement: speed };
}

// === Initiative & turn order ===

/**
 * Roll initiative for every participant and return a sorted turn
 * order. Each participant carries `{ id, dexterity, speed }` at
 * minimum (the host can attach any extra metadata; the encounter
 * tracker preserves it).
 *
 * Ties break on raw d20, then on `dexterity` (5e tiebreaker), then
 * on `id` for full determinism — so seeded replay produces a stable
 * order even when initiatives tie. RNG cascades from the caller so
 * the whole encounter stays reproducible.
 */
export function rollOrder(participants, rng = Math.random, onInitiativeRoll) {
  const rolled = participants.map((p) => {
    const d20 = rollDie(20, rng);
    const initiative = d20 + modFromScore(p.dexterity);
    // Optional per-roll callback — engine wrapper passes one that
    // appends a `rollInitiative` entry to the engine's roll log so
    // the encounter's dice draws are replay-verifiable.
    if (onInitiativeRoll) onInitiativeRoll({ id: p.id, dexterity: p.dexterity, value: initiative });
    return { ...p, initiative, initiativeD20: d20 };
  });
  rolled.sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    if (b.initiativeD20 !== a.initiativeD20) return b.initiativeD20 - a.initiativeD20;
    if (b.dexterity !== a.dexterity) return b.dexterity - a.dexterity;
    return String(a.id).localeCompare(String(b.id));
  });
  return rolled;
}

/**
 * Build an encounter. Returns the initial state: turn order,
 * round 1, the first actor as current, and a fresh action budget
 * keyed by actor id.
 *
 * The host calls this once at the start of combat; every
 * subsequent step is `step…` functions below, which return the
 * new state object. Pure throughout.
 */
export function startEncounter(participants, rng = Math.random, onInitiativeRoll) {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('startEncounter requires at least one participant');
  }
  for (const p of participants) {
    if (p === null || typeof p !== 'object') {
      throw new Error('Each participant must be an object');
    }
    if (typeof p.id !== 'string' || p.id.length === 0) {
      throw new Error('Each participant must have a non-empty string id');
    }
    if (!Number.isInteger(p.dexterity)) {
      throw new Error(`Participant ${p.id}: dexterity must be an integer`);
    }
    if (!Number.isInteger(p.speed) || p.speed < 0) {
      throw new Error(`Participant ${p.id}: speed must be a non-negative integer`);
    }
  }
  const order = rollOrder(participants, rng, onInitiativeRoll);
  const budgets = {};
  for (const p of order) budgets[p.id] = freshBudget(p.speed);
  return {
    order,
    turnIndex: 0,
    round: 1,
    budgets,
    log: []   // append-only encounter event log; the engine's
              //   rollLog still captures dice; this captures
              //   bookkeeping transitions (turn ends, reactions used).
  };
}

/** The actor whose turn it is. `null` if the encounter has ended. */
export function currentActor(state) {
  return state.order[state.turnIndex] ?? null;
}

/**
 * Spend a budget slot on the current actor. Returns
 * `{ allowed: true, state }` on success or
 * `{ allowed: false, reason }` on refusal — explicit refusal so
 * the host's UI can show "no actions left" rather than crash.
 *
 * Movement costs an integer number of feet; the other slots cost 1.
 * `'free'` is always allowed and doesn't change the budget — included
 * so callers can pipe every chip through the same gate.
 */
export function spend(state, actorId, cost, amount = 1) {
  if (!ACTION_COSTS.includes(cost)) {
    return { allowed: false, reason: `unknown cost: ${cost}` };
  }
  if (cost === 'free') return { allowed: true, state };
  const budget = state.budgets[actorId];
  if (!budget) return { allowed: false, reason: `unknown actor: ${actorId}` };
  const current = budget[cost];
  if (current === null) return { allowed: false, reason: `no ${cost} budget` };
  if (current < amount) return { allowed: false, reason: `insufficient ${cost} (have ${current}, need ${amount})` };
  const next = {
    ...state,
    budgets: { ...state.budgets, [actorId]: { ...budget, [cost]: current - amount } }
  };
  return { allowed: true, state: next };
}

/**
 * End the current actor's turn. Advances to the next non-removed
 * actor (skipping any removed via `removeParticipant`) and refreshes
 * their budget. Loops the round counter when the order wraps.
 *
 * Returns `{ state, finished }` so the host can branch on encounter
 * end (finished happens when only one side has live participants;
 * we don't decide that here — the host owns "is the fight over").
 * The `finished` flag flips to true when zero participants remain
 * (every other call has at least one).
 */
export function endTurn(state) {
  if (state.order.length === 0) return { state, finished: true };
  let next = (state.turnIndex + 1) % state.order.length;
  let round = state.round;
  if (next === 0) round += 1;
  const nextActor = state.order[next];
  const refreshedBudgets = {
    ...state.budgets,
    [nextActor.id]: freshBudget(nextActor.speed)
  };
  return {
    state: {
      ...state,
      turnIndex: next,
      round,
      budgets: refreshedBudgets,
      log: [...state.log, { kind: 'turn-end', round: state.round, actorId: state.order[state.turnIndex]?.id }]
    },
    finished: false
  };
}

/**
 * Remove a participant from the order (death, fled, withdrew).
 * Returns the new state. If the current actor is the one removed,
 * the turn index slides to the next valid actor; if no actors
 * remain, `currentActor` returns `null` and `endTurn` reports
 * `finished: true`.
 */
export function removeParticipant(state, actorId) {
  const idx = state.order.findIndex((p) => p.id === actorId);
  if (idx === -1) return state;
  const newOrder = state.order.filter((p) => p.id !== actorId);
  const newBudgets = { ...state.budgets };
  delete newBudgets[actorId];
  let newIndex = state.turnIndex;
  if (idx < state.turnIndex) newIndex -= 1;
  if (newIndex >= newOrder.length) newIndex = 0;
  return {
    ...state,
    order: newOrder,
    turnIndex: newIndex,
    budgets: newBudgets,
    log: [...state.log, { kind: 'remove', actorId }]
  };
}

// === Multi-attack (Extra Attack) ===

/**
 * Compute how many attacks an actor gets on its action. Reads the
 * class definition's `extraAttacks` table — Fighter gets 1 extra at
 * L5 (so 2 attacks per action), Ranger / Paladin / Barbarian get
 * the same, Monk's Martial Arts is modelled via bonus-action
 * attacks separately.
 *
 * Defaults to 1 for any class that doesn't define `extraAttacks`.
 */
export function attacksPerAction(classDef, level) {
  if (!classDef || typeof classDef !== 'object') return 1;
  const table = classDef.extraAttacks;
  if (!table) return 1;
  let best = 0;
  for (const [lvl, extra] of Object.entries(table)) {
    if (level >= Number(lvl) && extra > best) best = extra;
  }
  return 1 + best;
}

// === Opportunity attacks ===

/**
 * An opportunity attack triggers when an actor leaves another's
 * reach without disengaging. The engine doesn't track positions —
 * the host does — so this function takes the explicit assertion
 * "actor X is leaving Y's reach" and returns whether Y can react
 * (has the reaction budget) plus the attack resolution if so.
 *
 * Reaction-spent state has to be threaded back into the encounter
 * state by the host (because the reactor isn't the current actor,
 * we can't infer "spend it from the current turn"). Returns the
 * new encounter state alongside the attack outcome.
 *
 * `disengaged` short-circuits to `{ triggered: false }` — Disengage
 * action means the move doesn't provoke. Same for `cancelled` if
 * the host detects the reactor is incapacitated.
 */
export function opportunityAttack(state, { reactorId, attackerArgs, disengaged = false, rng = Math.random, rules = DEFAULT_RULES }) {
  if (disengaged) return { triggered: false, reason: 'disengaged', state };
  const reactor = state.order.find((p) => p.id === reactorId);
  if (!reactor) return { triggered: false, reason: 'reactor not in encounter', state };
  const spent = spend(state, reactorId, 'reaction');
  if (!spent.allowed) return { triggered: false, reason: spent.reason, state };
  const result = attackRoll(attackerArgs, rng, rules);
  const nextState = {
    ...spent.state,
    log: [...spent.state.log, { kind: 'opportunity-attack', reactorId, hit: result.hit }]
  };
  return { triggered: true, attack: result, state: nextState };
}

// === Cover & range modifiers ===
//
// Cover and range modify the attack equation rather than the d20.
// We surface them as a small `withCover` helper that adjusts AC
// before the attack roll. The pattern mirrors the SRD: cover adds
// to the target's effective AC; long range imposes disadvantage,
// which the host handles via `Dice.rollDisadvantage`.

/**
 * SRD 5.2 cover bonuses. Half cover: +2 AC. Three-quarters: +5 AC.
 * Full cover: can't be targeted (return `null` AC to signal "no
 * target"). Tower-shield mechanics aren't in SRD 5.2, so they're
 * out of scope here.
 */
export const COVER_BONUSES = Object.freeze({
  none: 0,
  half: 2,
  'three-quarters': 5,
  full: null
});

/**
 * Compute effective AC given base AC and a cover descriptor. Returns
 * `null` when cover is `full` — the host should never call
 * `attackRoll` in that case; we return null rather than throwing so
 * the host can decide the UX ("not a legal target" vs error).
 */
export function effectiveAc(baseAc, cover = 'none') {
  if (!Object.prototype.hasOwnProperty.call(COVER_BONUSES, cover)) {
    throw new Error(`Unknown cover: ${cover}. Known: ${Object.keys(COVER_BONUSES).join(', ')}`);
  }
  const bonus = COVER_BONUSES[cover];
  if (bonus === null) return null;
  return baseAc + bonus;
}

/**
 * Classify a ranged attack's range band. Returns one of:
 *   - `'in-range-normal'` — within normal range, no modifier
 *   - `'in-range-long'`   — within long range, attack at disadvantage
 *   - `'out-of-range'`    — past long range, attack auto-misses
 *
 * Hosts call this with `{ distance, normalRange, longRange }`
 * (longRange defaults to 4× normal for thrown weapons,
 * but SRD weapons declare their own table; we trust the weapon
 * record).
 */
export function rangeBand({ distance, normalRange, longRange }) {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error('distance must be a non-negative number');
  }
  if (distance <= normalRange) return 'in-range-normal';
  if (distance <= longRange) return 'in-range-long';
  return 'out-of-range';
}

// === Combat action verbs (since 1.7.0) ===
//
// Each verb consumes the appropriate action-budget slot via `spend`
// and returns `{ allowed, state, actor }` (or `{ allowed: false,
// reason }` on refusal). Some verbs also return a `result` payload
// the host applies (the target of Help, the readied trigger).
//
// State flags placed on the actor by these verbs:
//   - `dodging: true` — Attacks against this actor have
//     disadvantage; the actor has advantage on DEX saves. Cleared
//     at the start of the actor's next turn (host owns the clear).
//   - `disengaged: true` — Movement does not provoke OAs this turn;
//     read by `opportunityAttack`. Cleared at turn end.
//   - `hidden: true` — Set when a Hide check succeeds; host owns
//     the reveal logic. Cleared on attack / forced reveal.
//   - `helping: { targetId, until }` — The actor is granting
//     advantage to `targetId`'s next check / attack (within 5 ft).
//   - `readied: { trigger, action }` — The actor is holding an
//     action that will fire when the trigger predicate matches.
//
// The flags live on the actor record (host-owned); the encounter
// state stays focused on order + budgets.

/** Common helper: spend a budget slot and pass the new state through. */
function spendAndReturn(state, actorId, cost, amount, fields) {
  const r = spend(state, actorId, cost, amount);
  if (!r.allowed) return r;
  return { allowed: true, state: r.state, ...fields };
}

/**
 * SRD § Combat — Dash: spend an action; the actor's movement
 * budget gains an extra `speed` (its base speed). Returns the new
 * state with the inflated movement budget — no actor delta needed
 * because the budget already lives in `state`.
 */
export function dash(state, actorId) {
  const r = spend(state, actorId, 'action');
  if (!r.allowed) return r;
  const participant = state.order.find((p) => p.id === actorId);
  const extra = participant?.speed ?? 0;
  const budget = r.state.budgets[actorId];
  const newBudgets = {
    ...r.state.budgets,
    [actorId]: { ...budget, movement: (budget.movement ?? 0) + extra }
  };
  return {
    allowed: true,
    state: {
      ...r.state,
      budgets: newBudgets,
      log: [...r.state.log, { kind: 'dash', actorId, extra }]
    }
  };
}

/**
 * SRD § Combat — Disengage: spend an action; the actor's movement
 * doesn't provoke opportunity attacks for the rest of the turn.
 * Sets `actor.disengaged: true`; `opportunityAttack` already
 * short-circuits on this flag.
 */
export function disengage(state, actor) {
  return spendAndReturn(state, actor.id, 'action', 1, {
    actor: { ...actor, disengaged: true }
  });
}

/**
 * SRD § Combat — Dodge: spend an action; attacks against the actor
 * have disadvantage and the actor has advantage on Dexterity saves
 * until the start of its next turn. Sets `actor.dodging: true`;
 * `attackStance` reads it for incoming attacks.
 */
export function dodge(state, actor) {
  return spendAndReturn(state, actor.id, 'action', 1, {
    actor: { ...actor, dodging: true }
  });
}

/**
 * SRD § Combat — Help: spend an action; an ally within 5 ft gains
 * advantage on its next ability check or attack roll (the latter
 * within 5 ft of the target). Stores the binding on the actor
 * record as `actor.helping = { targetId }`; the host applies the
 * advantage on the target's next roll and clears the flag.
 */
export function help(state, actor, args = {}) {
  const targetId = args.targetId;
  if (typeof targetId !== 'string' || targetId.length === 0) {
    return { allowed: false, reason: 'args.targetId required' };
  }
  return spendAndReturn(state, actor.id, 'action', 1, {
    actor: { ...actor, helping: { targetId } }
  });
}

/**
 * SRD § Combat — Hide: spend an action; the host rolls Stealth
 * against the relevant Passive Perceptions. Sets
 * `actor.hidden: true` on success; the host is responsible for
 * running the check and applying the flag conditionally. This
 * helper just consumes the action and reports that a Stealth check
 * is owed.
 */
export function hide(state, actor) {
  return spendAndReturn(state, actor.id, 'action', 1, {
    actor,    // unchanged — host applies `hidden: true` on a successful check
    result: { needsStealthCheck: true }
  });
}

/**
 * SRD § Combat — Ready: spend an action AND a reaction now; the
 * reaction fires later when the trigger matches. Stores
 * `actor.readied: { trigger, action }`; host listens for the
 * trigger and resolves the action.
 */
export function ready(state, actor, args = {}) {
  const { trigger, action } = args;
  if (typeof trigger !== 'string' || trigger.length === 0) {
    return { allowed: false, reason: 'args.trigger required' };
  }
  if (typeof action !== 'string' || action.length === 0) {
    return { allowed: false, reason: 'args.action required' };
  }
  const a = spend(state, actor.id, 'action');
  if (!a.allowed) return a;
  const b = spend(a.state, actor.id, 'reaction');
  if (!b.allowed) return b;
  return {
    allowed: true,
    state: b.state,
    actor: { ...actor, readied: { trigger, action } }
  };
}

/**
 * SRD § Combat — Search / Study / Influence: spend an action; host
 * runs the ability check. We bundle the three into one helper
 * because they all share the same engine surface (consume action,
 * host owns the check) — the `kind` arg disambiguates for the log.
 */
export function ability(state, actor, args = {}) {
  const kind = args.kind;
  if (!['search', 'study', 'influence'].includes(kind)) {
    return { allowed: false, reason: 'args.kind must be search / study / influence' };
  }
  const r = spend(state, actor.id, 'action');
  if (!r.allowed) return r;
  return {
    allowed: true,
    state: {
      ...r.state,
      log: [...r.state.log, { kind, actorId: actor.id }]
    },
    actor,
    result: { needsCheck: true, kind }
  };
}

/**
 * SRD § Combat — Grapple. Spend an Attack action against a target
 * no more than one size larger. The target makes a STR or DEX
 * save against `DC = 8 + attacker's STR mod + proficiency bonus`.
 * On fail, the target gets the grappled condition.
 *
 * Returns `{ allowed, state, actor, result }` where `result`
 * carries the DC + the save instruction the host runs against the
 * target. The host applies the `grappled` condition if the save
 * fails.
 */
export function grapple(state, actor, args = {}) {
  const proficiencyBonus = actor.proficiencyBonus ?? 2;
  const strMod = modFromScore(actor.abilityScores?.str ?? 10);
  const dc = 8 + strMod + proficiencyBonus;
  const r = spend(state, actor.id, 'action');
  if (!r.allowed) return r;
  return {
    allowed: true,
    state: r.state,
    actor,
    result: {
      save: { dc, abilities: ['str', 'dex'] },
      onFail: { condition: 'grappled' },
      targetId: args.targetId
    }
  };
}

/**
 * SRD § Combat — Shove. Same DC structure as Grapple; on fail, the
 * attacker chooses to knock the target prone OR push them 5 ft
 * straight away. `args.choice` declares which.
 */
export function shove(state, actor, args = {}) {
  const choice = args.choice ?? 'prone';
  if (!['prone', 'push'].includes(choice)) {
    return { allowed: false, reason: "args.choice must be 'prone' or 'push'" };
  }
  const proficiencyBonus = actor.proficiencyBonus ?? 2;
  const strMod = modFromScore(actor.abilityScores?.str ?? 10);
  const dc = 8 + strMod + proficiencyBonus;
  const r = spend(state, actor.id, 'action');
  if (!r.allowed) return r;
  const onFail = choice === 'prone'
    ? { condition: 'prone' }
    : { pushFt: 5 };
  return {
    allowed: true,
    state: r.state,
    actor,
    result: {
      save: { dc, abilities: ['str', 'dex'] },
      onFail,
      choice,
      targetId: args.targetId
    }
  };
}

/**
 * SRD § Equipment — Two-Weapon Fighting + § Combat — Bonus Action.
 * Make a Light melee weapon attack as a Bonus Action with a
 * different weapon than the one used for the Attack action. No
 * ability modifier on damage unless the modifier is negative.
 *
 * The engine spends the bonus action and reports the attack
 * configuration to use; the host calls `Combat.attackRoll` with
 * the relevant attack bonus / damage spec, then suppresses the
 * positive ability mod on damage per the rule.
 *
 * `args.weapon` and any attack-bonus / damage args are passed
 * through transparently — this verb is the budget gate, not the
 * resolution.
 */
export function offHandAttack(state, actor, args = {}) {
  if (!args.weapon) return { allowed: false, reason: 'args.weapon required' };
  return spendAndReturn(state, actor.id, 'bonus', 1, {
    actor,
    result: { suppressPositiveAbilityMod: true, weapon: args.weapon }
  });
}

/**
 * Improvised weapon attack helper (pure). Per SRD § Equipment —
 * Improvised Weapons, an attack with an object not designed as a
 * weapon deals `1d4` damage (the GM may set a different die for
 * close-analogue objects). Proficiency is suppressed unless the
 * object resembles a weapon the actor is proficient with.
 *
 * Returns the attack-args shape the host feeds to `attackRoll` /
 * `damageRoll` — the caller does the budget spend themselves
 * (improvised attacks aren't a distinct action; they're an Attack
 * action with a weird weapon).
 */
export function improvisedAttack({ damageDie = 'd4', damageType = 'bludgeoning', proficient = false } = {}) {
  return {
    damageDice: `1${damageDie}`,
    damageType,
    proficient
  };
}
