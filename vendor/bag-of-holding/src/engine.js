// === createEngine: per-instance scope for content registries ===
//
// The engine is what a host application — Dungeons-and-Dans, a
// homebrew theme, a tutorial sandbox — instantiates to get a bound
// set of rules namespaces plus the data registries (species,
// classes, items, etc.) it should look up against.
//
// Why instance-scoped instead of module-globals: a single page may
// run several distinct rule sets at once (the main campaign + a
// "what if my character had been a pirate" preview), and plugin
// authors need a place to land contributions that doesn't mutate
// global state and bleed into every other consumer. The default
// singleton (exported from index.js) is just a `createEngine()`
// with no opts — convenient for the common single-engine case.
//
// Phase A scope: **content extension only**. Plugins can contribute
// species, classes, backgrounds, feats, spells, items, conditions,
// and weapon mastery handlers. Rule modifications (custom crit
// thresholds, exploding dice, alternative XP curves) and behavioural
// hooks (`beforeAttack`, `afterDamage`) are deferred to Phases B/C —
// see docs/spec.md § Plugins.
//
// 0.1.0 also adds **forensically inspectable randomness**: pass
// `rng: Dice.seededRng(seed)` for deterministic play, read
// `engine.rollLog` for the full audit trail, tag rolls with
// `context` for trace-back, and call `engine.verifyLog(log)` to
// replay-verify a session.

import * as Dice from './dice.js';
import * as Checks from './checks.js';
import * as CombatBase from './combat.js';
import * as ConditionsBase from './conditions.js';
import * as XPBase from './xp.js';
import * as Movesets from './movesets.js';
import * as Beats from './beats/index.js';
import * as Classes from './classes/index.js';
import * as Character from './character.js';
import * as EncounterBase from './encounter.js';
import * as Spellcasting from './spellcasting.js';
import * as RestBase from './rest.js';
import * as MechanicsBase from './mechanics.js';
import * as SceneClock from './scene-clock.js';
import * as MagicItemsBase from './magic-items.js';
import * as MonstersBase from './monsters.js';
import * as MovementBase from './movement.js';
import * as MulticlassBase from './multiclass.js';
import * as InspirationBase from './inspiration.js';
import * as EncounterDesignBase from './encounter-design.js';
import { verifyLog } from './replay.js';
import { buildRules } from './rules.js';
import { buildHookRegistry, HOOK_EVENTS } from './hooks.js';

import defaultSpecies     from './srd/species.js';
import defaultBackgrounds from './srd/backgrounds.js';
import defaultFeats       from './srd/feats.js';
import defaultSpells      from './srd/spells.js';
import defaultItems       from './srd/items.js';
import defaultMonsters    from './srd/monsters.js';

const REGISTRY_VALIDATORS = {
  species:     { required: ['id', 'name', 'size', 'speed'], arrayFields: ['traits'] },
  classes:     { required: ['id', 'name', 'hitDie'] },
  backgrounds: { required: ['id', 'name', 'abilityScores', 'skillProficiencies', 'originFeat'] },
  feats:       { required: ['id', 'name', 'category'] },
  spells:      { required: ['id', 'name', 'level', 'school'] },
  items:       { required: ['id', 'name', 'type'] },
  monsters:    { required: ['id', 'name', 'ac', 'hp', 'abilityScores'], arrayFields: ['attacks', 'traits'] }
};

/**
 * Validate a single record against its registry's contract. Throws
 * with a clear pointer (registry + offending id + missing field) so
 * a plugin author sees exactly what's wrong rather than discovering
 * the gap at first use.
 *
 * Why per-registry-shape validation instead of a general schema lib:
 * we ship zero runtime deps, the rules are stable enough that hand-
 * rolled checks are cheap, and a 20-line validator is friendlier to
 * read than a Zod schema in this codebase.
 */
function validateRecord(registry, id, record) {
  const rules = REGISTRY_VALIDATORS[registry];
  if (record === null || typeof record !== 'object') {
    throw new Error(`Plugin contribution ${registry}.${id} must be an object`);
  }
  for (const field of rules.required) {
    if (record[field] === undefined) {
      throw new Error(`Plugin contribution ${registry}.${id} missing required field: ${field}`);
    }
  }
  for (const field of rules.arrayFields ?? []) {
    if (record[field] !== undefined && !Array.isArray(record[field])) {
      throw new Error(`Plugin contribution ${registry}.${id}.${field} must be an array`);
    }
  }
}

/**
 * Merge defaults with plugin contributions, validating each new
 * record on the way in. Last-write-wins on id collision: a plugin
 * that re-declares `species.elf` replaces the SRD entry, which is
 * how "rebalanced" or "themed" packs work (a grimdark theme might
 * ship harsher versions of the base species).
 */
function mergeRegistry(registry, defaults, extras = {}) {
  for (const [id, record] of Object.entries(extras)) {
    validateRecord(registry, id, record);
  }
  return { ...defaults, ...extras };
}

/**
 * Build a per-engine `XP` namespace whose progression tables can be
 * overridden via `rules.xpThresholds` / `rules.proficiencyByLevel`
 * (Phase B). When the rule values are `null`, the SRD 5.2 defaults
 * from `xp.js` apply — same behaviour as not overriding at all,
 * just expressed through a single path.
 */
function buildXP(rules, hooks) {
  const thresholds = rules.xpThresholds ?? XPBase.THRESHOLDS;
  const proficiency = rules.proficiencyByLevel ?? XPBase.PROFICIENCY_BY_LEVEL;
  return {
    THRESHOLDS: thresholds,
    PROFICIENCY_BY_LEVEL: proficiency,
    levelForXP: (xp) => XPBase.levelForXP(xp, thresholds),
    nextLevelThreshold: (xp) => XPBase.nextLevelThreshold(xp, thresholds),
    awardMilestone: ({ pc, beat }) => {
      const result = XPBase.awardMilestone({ pc, beat }, thresholds);
      if (hooks && result.willLevelUp) {
        const newLevel = XPBase.levelForXP(result.newTotal, thresholds);
        hooks.fire('onLevelUp', {
          pc,
          fromLevel: pc.level,
          toLevel: newLevel,
          xpDelta: result.xpDelta,
          newTotal: result.newTotal
        });
      }
      return result;
    }
  };
}

/**
 * Build a per-engine `Conditions` namespace whose `apply` is bound
 * to this engine's combined condition list. The boolean condition
 * vocabulary expands deterministically: SRD 5.2 conditions come
 * first, then plugin contributions appended in registration order,
 * with duplicates collapsed.
 *
 * Exhaustion stays as it is — a numeric scalar, not part of the
 * boolean list. Plugins that want to extend Exhaustion semantics
 * (gritty resting, faster death) can do so by combining rule mods
 * (Phase B) with their own host-side state machine.
 */
function buildConditions(extraConditions = []) {
  if (!Array.isArray(extraConditions)) {
    throw new Error('extraConditions must be an array of strings');
  }
  for (const c of extraConditions) {
    if (typeof c !== 'string' || c.length === 0) {
      throw new Error(`extraConditions entries must be non-empty strings (got ${JSON.stringify(c)})`);
    }
  }
  const combined = Object.freeze([...new Set([...ConditionsBase.CONDITIONS, ...extraConditions])]);
  return {
    CONDITIONS: combined,
    EXHAUSTION_MAX: ConditionsBase.EXHAUSTION_MAX,
    has: ConditionsBase.has,
    isImmuneTo: ConditionsBase.isImmuneTo,
    apply: (actor, condition) => ConditionsBase.apply(actor, condition, combined),
    remove: ConditionsBase.remove,
    effectsFor: ConditionsBase.effectsFor,
    attackStance: ConditionsBase.attackStance,
    exhaustion: ConditionsBase.exhaustion
  };
}

/**
 * Create a new engine instance. With no options, you get the SRD 5.2
 * defaults — the same set the module-level default singleton uses.
 * With plugin contributions in `opts`, those are validated and
 * merged on top of the defaults.
 *
 * The returned engine is the canonical surface plugin and host code
 * should use: read data registries directly (`engine.species`),
 * call math through the namespaces (`engine.Combat.applyMastery`),
 * and trust that any binding to per-engine state has already been
 * done for you.
 *
 * **0.1.0 — determinism options:**
 *   - `rng`: a `() => [0, 1)` function (default: `Math.random`).
 *     Pass `Dice.seededRng(seed)` for replay-deterministic play.
 *     Threaded to every rolling function the engine owns.
 *   - `onRoll`: called with each `RollEntry` immediately after it's
 *     appended to `engine.rollLog`. Useful for telemetry, live
 *     debug overlays, or piping rolls into Spektrum history.
 *   - `rollLogCap`: drop-oldest size cap on the in-memory log
 *     (default: `Infinity`). The roll counter on each entry is
 *     monotonic across the session, so dropped-then-kept entries
 *     don't shift indexes.
 *
 * **0.2.0 — rule modifications (plugin Phase B):**
 *   - `rules`: small named-knob object tuning combat/XP math.
 *     Validated at construction; defaults preserve SRD 5.2 exactly.
 *     See `src/rules.js § DEFAULT_RULES` for the full knob list.
 *     The merged frozen object is exposed as `engine.rules` for
 *     introspection (handy when a host wants to render "this pack
 *     uses Pathfinder crits" in the UI).
 *
 * @param {object} [opts]
 * @param {object} [opts.extraSpecies]      Map of id → species record.
 * @param {object} [opts.extraClasses]      Map of id → class record.
 * @param {object} [opts.extraBackgrounds]  Map of id → background record.
 * @param {object} [opts.extraFeats]        Map of id → feat record.
 * @param {object} [opts.extraSpells]       Map of id → spell record.
 * @param {object} [opts.extraItems]        Map of id → item record.
 * @param {string[]} [opts.extraConditions] Names of new boolean conditions.
 * @param {object} [opts.extraMastery]      Map of name → MasteryHandler.
 * @param {() => number} [opts.rng]         Custom RNG; default `Math.random`.
 * @param {(entry: object) => void} [opts.onRoll]  Per-roll callback.
 * @param {number} [opts.rollLogCap]        Max log entries (default ∞).
 * @param {object} [opts.rules]             Phase B rule overrides; see DEFAULT_RULES.
 */
export function createEngine(opts = {}) {
  const species     = mergeRegistry('species',     defaultSpecies,     opts.extraSpecies);
  const classes     = mergeRegistry('classes',     Classes,            opts.extraClasses);
  const backgrounds = mergeRegistry('backgrounds', defaultBackgrounds, opts.extraBackgrounds);
  const feats       = mergeRegistry('feats',       defaultFeats,       opts.extraFeats);
  const spells      = mergeRegistry('spells',      defaultSpells,      opts.extraSpells);
  const items       = mergeRegistry('items',       defaultItems,       opts.extraItems);
  const monsters    = mergeRegistry('monsters',    defaultMonsters,    opts.extraMonsters);

  const ConditionsBoundBase = buildConditions(opts.extraConditions);

  // === Phase B rule modifications ===
  const rules = buildRules(opts.rules);

  // === Phase C behavioural hooks ===
  const hooks = buildHookRegistry(opts.hooks);

  // Conditions namespace bound to fire hooks on apply/exhaustion-death.
  // We wrap the base bound namespace rather than re-implementing it
  // so the boolean-condition vocabulary stays the single source of
  // truth.
  const ConditionsBound = {
    ...ConditionsBoundBase,
    apply: (actor, condition) => {
      let next = ConditionsBoundBase.apply(actor, condition);
      // Immunity short-circuits to the same actor reference; skip
      // the hook fire and downstream concentration drop in that case.
      if (next === actor) return next;
      // SRD § Spells — Concentration (since 1.5.0): incapacitating
      // conditions break concentration. The condition-effects map
      // tags `incapacitates: true` on stunned / paralyzed /
      // petrified / unconscious / incapacitated. The exhaustion
      // pathway fires `onDeath` separately when level 6 is reached;
      // here we close the second drop pathway.
      const effect = ConditionsBase.CONDITION_EFFECTS[condition];
      if (effect?.incapacitates && next.concentration) {
        next = Spellcasting.endConcentration(next);
      }
      hooks.fire('onConditionApplied', { actor: next, condition, previous: actor });
      return next;
    },
    exhaustion: {
      ...ConditionsBoundBase.exhaustion,
      gain: (actor, amount) => {
        const next = ConditionsBoundBase.exhaustion.gain(actor, amount);
        if (ConditionsBoundBase.exhaustion.isDead(next) && !ConditionsBoundBase.exhaustion.isDead(actor)) {
          hooks.fire('onDeath', { actor: next, cause: 'exhaustion', previous: actor });
        }
        return next;
      },
      set: (actor, level) => {
        const next = ConditionsBoundBase.exhaustion.set(actor, level);
        if (ConditionsBoundBase.exhaustion.isDead(next) && !ConditionsBoundBase.exhaustion.isDead(actor)) {
          hooks.fire('onDeath', { actor: next, cause: 'exhaustion', previous: actor });
        }
        return next;
      }
    }
  };

  // === Engine-bound XP namespace (respects rule overrides) ===
  const XPBound = buildXP(rules, hooks);

  // === Determinism plumbing ===
  const rng = opts.rng ?? Math.random;
  const rollLogCap = opts.rollLogCap ?? Infinity;
  const rollLog = [];
  let rollCount = 0;

  const record = (op, payload, context) => {
    const entry = { index: rollCount++, op, ...payload };
    if (context !== undefined) entry.context = context;
    rollLog.push(entry);
    if (opts.onRoll) opts.onRoll(entry);
    if (rollLog.length > rollLogCap) {
      rollLog.splice(0, rollLog.length - rollLogCap);
    }
    return entry;
  };

  // === Per-engine namespaces ===
  // Dice — logged wrappers + the seedable RNG helper. Pure math
  // (`parse`) passes through unchanged because it does no rolling.
  const DiceBound = {
    parse: Dice.parse,
    seededRng: Dice.seededRng,
    rollDie: (sides, context) => {
      const value = Dice.rollDie(sides, rng);
      record('rollDie', { sides, value }, context);
      return value;
    },
    roll: (spec, context) => {
      const result = Dice.roll(spec, rng);
      record('roll', { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
      return result;
    },
    rollAdvantage: (spec, context) => {
      const result = Dice.rollAdvantage(spec, rng);
      record('rollAdvantage', { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
      return result;
    },
    rollDisadvantage: (spec, context) => {
      const result = Dice.rollDisadvantage(spec, rng);
      record('rollDisadvantage', { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
      return result;
    }
  };

  // Checks — only `abilityCheck` and `savingThrow` are stochastic;
  // `modFromScore` and `clampDC` are pure helpers.
  const ChecksBound = {
    modFromScore: Checks.modFromScore,
    clampDC: Checks.clampDC,
    abilityCheck: (args, context) => {
      const result = Checks.abilityCheck(args, rng);
      record('abilityCheck', {
        abilityScore: args.abilityScore,
        proficient: args.proficient ?? false,
        proficiencyBonus: args.proficiencyBonus ?? 2,
        ...result
      }, context);
      return result;
    },
    savingThrow: (args, context) => {
      // SRD § Conditions (since 1.5.0): paralyzed / stunned /
      // petrified / unconscious force auto-fail on STR and DEX
      // saves. The engine binding sets `autoFailed` when the
      // caller supplies an actor + ability, so module-level
      // callers using just abilityScore stay unaffected.
      let augmented = args;
      if (args.actor && args.ability &&
          (args.ability === 'str' || args.ability === 'dex')) {
        const effects = ConditionsBase.effectsFor(args.actor);
        if (effects.autoFailStrDexSaves) {
          augmented = { ...args, autoFailed: true };
        }
      }
      const result = Checks.savingThrow(augmented, rng);
      record('savingThrow', {
        abilityScore: args.abilityScore,
        proficient: args.proficient ?? false,
        proficiencyBonus: args.proficiencyBonus ?? 2,
        ...result
      }, context);
      return result;
    }
  };

  // Combat — bind both the mastery handler table (plugin contracts)
  // AND the rolling wrappers (logging contracts). `applyMastery`
  // doesn't roll dice; it's pure dispatch over the result of a
  // separate `attackRoll`, so no log entry is needed.
  if (opts.extraMastery) {
    for (const [name, handler] of Object.entries(opts.extraMastery)) {
      if (typeof handler !== 'function') {
        throw new Error(`extraMastery.${name} must be a function`);
      }
    }
  }
  const masteryHandlers = Object.freeze({
    ...CombatBase.DEFAULT_MASTERY_HANDLERS,
    ...(opts.extraMastery ?? {})
  });
  const masteryProperties = Object.freeze(Object.keys(masteryHandlers));
  const CombatBound = {
    rollInitiative: (args, context) => {
      const value = CombatBase.rollInitiative(args, rng);
      record('rollInitiative', { dexterity: args.dexterity, value }, context);
      return value;
    },
    attackRoll: (args, context) => {
      // beforeAttack runs first so a hook can short-circuit (Shield
      // spell raising AC, blur granting disadvantage, etc.). The
      // hook receives the args and returns a delta — the most
      // common deltas are `{ ac: newAc }` and `{ cancelled: true }`.
      // `pre` is a fresh object seeded from args, so attackBonus/ac
      // are always defined on it; hooks can replace either via a
      // delta. No `??` fallback needed.
      const pre = hooks.fire('beforeAttack', { ...args, context });
      if (pre.cancelled === true) {
        const cancelled = { d20: 0, attackBonus: args.attackBonus, total: 0, ac: pre.ac, hit: false, critical: false, fumble: false, stance: 'normal', cancelled: true };
        record('attackRoll', cancelled, context);
        return cancelled;
      }
      // Forward attacker/target/distance so condition-aware
      // advantage/disadvantage flows through. CombatBase.attackRoll
      // computes the stance and rolls the right number of d20s.
      const result = CombatBase.attackRoll({
        attackBonus: pre.attackBonus,
        ac: pre.ac,
        attacker: pre.attacker,
        target: pre.target,
        attackerDistanceFt: pre.attackerDistanceFt
      }, rng, rules);
      record('attackRoll', result, context);
      return result;
    },
    damageRoll: (args, context) => {
      const result = CombatBase.damageRoll(args, rng, rules);
      // afterDamage fires once damage is known. Handlers can adjust
      // `total` (resistances, vulnerabilities, Heavy Armor Master)
      // by returning `{ total: newTotal }`. `merged.total` is always
      // present because it starts as `result.total`.
      const merged = hooks.fire('afterDamage', { ...result, context });
      const final = { ...result, total: merged.total };
      record('damageRoll', final, context);
      return final;
    },
    MASTERY_PROPERTIES: masteryProperties,
    applyMastery: (weapon, target, attackResult, attacker) =>
      CombatBase.applyMastery(weapon, target, attackResult, attacker, masteryHandlers),
    // === Encounter system (since 0.4.0) ===
    //
    // Bound here rather than as a separate top-level namespace so
    // the encounter functions share the engine's rng and rules
    // without the caller threading them per call.
    // Every initiative draw is logged so the encounter's stochastic
    // surface flows into the same rollLog the rest of the engine
    // populates — replay verification then covers an entire combat
    // session end-to-end.
    startEncounter: (participants) => EncounterBase.startEncounter(
      participants, rng,
      ({ dexterity, value }) => record('rollInitiative', { dexterity, value })
    ),
    rollOrder: (participants) => EncounterBase.rollOrder(
      participants, rng,
      ({ dexterity, value }) => record('rollInitiative', { dexterity, value })
    ),
    currentActor: EncounterBase.currentActor,
    endTurn: EncounterBase.endTurn,
    removeParticipant: EncounterBase.removeParticipant,
    spend: EncounterBase.spend,
    freshBudget: EncounterBase.freshBudget,
    attacksPerAction: EncounterBase.attacksPerAction,
    opportunityAttack: (state, args) => {
      const result = EncounterBase.opportunityAttack(state, { ...args, rng, rules });
      if (result.triggered) {
        record('attackRoll', result.attack, args.context);
      }
      return result;
    },
    effectiveAc: EncounterBase.effectiveAc,
    rangeBand: EncounterBase.rangeBand,
    ACTION_COSTS: EncounterBase.ACTION_COSTS,
    COVER_BONUSES: EncounterBase.COVER_BONUSES,

    // === Action verbs (since 1.7.0) ===
    dash: EncounterBase.dash,
    disengage: EncounterBase.disengage,
    dodge: EncounterBase.dodge,
    help: EncounterBase.help,
    hide: EncounterBase.hide,
    ready: EncounterBase.ready,
    ability: EncounterBase.ability,
    grapple: EncounterBase.grapple,
    shove: EncounterBase.shove,
    offHandAttack: EncounterBase.offHandAttack,
    improvisedAttack: EncounterBase.improvisedAttack,

    // === Death saves (since 1.1.0) ===
    //
    // Bound so the d20 from each save flows into the same rollLog as
    // attack rolls and so `onDeath` fires consistently. Exhaustion
    // already fires `onDeath` via the Conditions binding; these are
    // the second and third pathways (failed death save, damage at 0).
    //
    // `dropToZero` delegates the Unconscious add to `ConditionsBound`
    // (declared below in the same closure) so the existing
    // `onConditionApplied` hook fires through one code path.
    freshDeathSaves: CombatBase.freshDeathSaves,
    dropToZero: (actor) => {
      const withUnconscious = ConditionsBound.apply(actor, 'unconscious');
      return { ...withUnconscious, hp: 0, deathSaves: CombatBase.freshDeathSaves() };
    },
    deathSave: (actor, context) => {
      const result = CombatBase.deathSave(actor, rng, rules);
      if (result.d20 !== 0) {
        record('deathSave', { d20: result.d20, outcome: result.outcome }, context);
      }
      if (result.outcome === 'dead') {
        hooks.fire('onDeath', { actor: result.actor, cause: 'deathSave', previous: actor });
      }
      return result;
    },
    applyDamageWhileDown: (actor, damageTaken, args) => {
      const result = CombatBase.applyDamageWhileDown(actor, damageTaken, args ?? {}, rules);
      if (result.outcome === 'dead' && (actor.deathSaves?.dead ?? false) === false) {
        hooks.fire('onDeath', { actor: result.actor, cause: 'damageWhileDown', previous: actor });
      }
      return result;
    },
    stabilize: CombatBase.stabilize,
    reviveTo: CombatBase.reviveTo,

    // === Damage pipeline (since 1.4.0) ===
    //
    // Pure modifiers and tempHp helpers pass through unchanged.
    // `applyDamage` and `heal` are bound so the outcomes that
    // *create* an Unconscious actor (or kill one outright) fire the
    // appropriate hooks — same contract as the existing death-save
    // bindings. Specifically:
    //   - 'downed' outcomes route through `dropToZero` internally,
    //     which calls `ConditionsBound.apply('unconscious')`; the
    //     `onConditionApplied` hook fires through that path.
    //   - 'dead' outcomes (instant-death or damage-while-down)
    //     synthesise an onDeath fire via the existing `applyDamage
    //     WhileDown` binding's cause-tracking; for the massive-
    //     damage instant-death path we fire it here explicitly.
    applyDamageModifiers: CombatBase.applyDamageModifiers,
    grantTempHp: CombatBase.grantTempHp,
    applyDamage: (actor, args) => {
      const wasDead = actor.deathSaves?.dead ?? false;
      const wasUnconscious = (actor.conditions ?? []).includes('unconscious');
      const result = CombatBase.applyDamage(actor, args);
      if (result.outcome === 'dead' && !wasDead) {
        hooks.fire('onDeath', { actor: result.actor, cause: 'damage', previous: actor });
      }
      if (result.outcome === 'downed' && !wasUnconscious) {
        hooks.fire('onConditionApplied', {
          actor: result.actor, condition: 'unconscious', previous: actor
        });
      }
      // Phase D (since 1.6.0). `onDamageApplied` fires for every
      // applyDamage outcome (including 'immune' and 'absorbed') so
      // plugins can react regardless of whether HP actually moved.
      // `onHpChanged` fires only when hp differs — that's the
      // narrower "the bar actually moved" signal.
      hooks.fire('onDamageApplied', {
        actor: result.actor, previous: actor,
        amount: result.amount, finalAmount: result.finalAmount,
        outcome: result.outcome, type: args?.type
      });
      if (result.hpAfter !== result.hpBefore) {
        hooks.fire('onHpChanged', {
          actor: result.actor, previous: actor,
          hpBefore: result.hpBefore, hpAfter: result.hpAfter,
          cause: 'damage'
        });
      }
      return result;
    },
    heal: (actor, amount) => {
      const result = CombatBase.heal(actor, amount);
      if (result.hpAfter !== result.hpBefore) {
        hooks.fire('onHpChanged', {
          actor: result.actor, previous: actor,
          hpBefore: result.hpBefore, hpAfter: result.hpAfter,
          cause: 'heal'
        });
      }
      return result;
    },

    // === Turn lifecycle (since 1.6.0) ===
    //
    // `turnStart` and `turnEnd` are *signal* helpers — they tick the
    // actor's timers (turnEnd) and fire the matching hook with the
    // resulting state. The host calls them at the natural moments
    // in its turn loop; the engine's job is to provide the
    // canonical dispatch point so plugins always see the same
    // ordering.
    addTimer: CombatBase.addTimer,
    tickTimers: CombatBase.tickTimers,
    turnStart: (actor, context) => {
      hooks.fire('onTurnStart', { actor, context });
      return { actor };
    },
    turnEnd: (actor, context) => {
      const result = CombatBase.turnEnd(actor);
      hooks.fire('onTurnEnd', {
        actor: result.actor, previous: actor,
        expired: result.expired, context
      });
      return result;
    }
  };

  // Engine view passed to character derivation. Built once here so
  // every `deriveSheet` call sees the same plugin-merged registries
  // without re-allocating; the view is structural, so consumers can
  // also use the engine directly (it satisfies the same shape).
  const characterRegistries = {
    species, classes, backgrounds, feats, items, XP: XPBound
  };

  // === Rest mechanics (since 1.2.0) ===
  //
  // Bound so the Hit Die roll on a Short Rest flows into rollLog
  // (same replay-determinism contract as every other stochastic
  // surface). `longRest` is deterministic — no log entry needed.
  const RestBound = {
    spendHitDie: (actor, context) => {
      const result = RestBase.spendHitDie(actor, rng);
      // Log the raw die face so `verifyLog` can replay-validate. The
      // `healed` field on the returned result is a derivation (die +
      // CON mod, capped at hpMax) — re-deriving from a logged die
      // face and the same actor reproduces it.
      if (result.die !== undefined) {
        record('rollDie', { sides: actor.hitDie, value: result.die }, context);
      }
      return result;
    },
    longRest: (actor) => {
      const next = RestBase.longRest(actor, rules);
      // Phase D (since 1.6.0). onLongRest fires after all rest
      // recovery is applied so plugins observing it can inspect the
      // restored state; the `previous` field surfaces the actor as
      // it stood when the rest began.
      hooks.fire('onLongRest', { actor: next, previous: actor });
      return next;
    },
    shortRest: (actor) => {
      const next = RestBase.shortRest(actor);
      hooks.fire('onShortRest', { actor: next, previous: actor });
      return next;
    }
  };

  // === Class mechanics (since 1.3.0) ===
  //
  // Looks the class up from the engine's `classes` registry so the
  // host doesn't have to thread it explicitly. Falls back to a
  // module-level dispatch when the actor carries `classId` and the
  // class is registered. Plugin-contributed classes (via
  // `extraClasses`) are looked up the same way.
  //
  // Any feature handler that rolls dice should call ctx.rollDie with
  // ctx.rng (the engine's rng) — this is what the handler defaults
  // wire in. The bound dispatcher logs rolls via `record('rollDie',
  // ...)` by intercepting `ctx.rollDie`.
  const MechanicsBound = {
    freshResource: MechanicsBase.freshResource,
    freshResources: MechanicsBase.freshResources,
    spendResource: MechanicsBase.spendResource,
    refreshResources: MechanicsBase.refreshResources,
    REFRESH_KINDS: MechanicsBase.REFRESH_KINDS,
    /**
     * Dispatch a class mechanic for an actor whose `classId` is
     * registered. Returns whatever the handler returns. Throws on
     * unknown classes or unknown mechanics so a typo at the host
     * surfaces immediately rather than silently no-op'ing.
     */
    apply: (actor, id, args, context) => {
      const classDef = classes[actor.classId];
      if (!classDef) throw new Error(`Unknown class for mechanic dispatch: ${actor.classId}`);
      const handlers = classDef.mechanics;
      if (!handlers || !handlers[id]) {
        throw new Error(`Unknown class mechanic: ${classDef.id}.${id}`);
      }
      // Intercept rollDie so the engine's audit trail captures any
      // dice rolled inside the handler.
      const ctx = {
        rng,
        rollDie: (sides) => {
          const value = Dice.rollDie(sides, rng);
          record('rollDie', { sides, value }, context);
          return value;
        },
        modFromScore: Checks.modFromScore
      };
      return handlers[id](actor, args ?? {}, ctx);
    }
  };

  return {
    // Data registries — plain objects, mutate at your own risk.
    species, classes, backgrounds, feats, spells, items, monsters,
    // Math + helpers (bound to this engine's data + rng + rules).
    Dice: DiceBound,
    Checks: ChecksBound,
    Combat: CombatBound,
    Conditions: ConditionsBound,
    XP: XPBound,
    Movesets, Beats,
    // Spellcasting: mostly pure module; engine wraps `castSpell` to
    // fire the `onCast` hook (Phase D, since 1.6.0). The hook can
    // short-circuit a cast via `cancelled: true` — that's the
    // Counterspell intercept point.
    Spellcasting: (() => {
      // Single onCast wrapper shared by both cast entry points; the
      // cancel branch is one occurrence rather than two so the
      // coverage tool doesn't double-count the same logic.
      const fireOnCast = (actor, spell, args) => {
        const pre = hooks.fire('onCast', { actor, spell, args });
        if (pre.cancelled === true) {
          return { ok: false, reason: pre.reason ?? 'cast cancelled by reaction', cancelled: true };
        }
        return null;
      };
      return {
        ...Spellcasting,
        castSpell: (actor, spell, args) => {
          const cancel = fireOnCast(actor, spell, args);
          if (cancel) return cancel;
          return Spellcasting.castSpell(actor, spell, args);
        },
        castAsRitual: (actor, spell, args) => {
          const cancel = fireOnCast(actor, spell, { ...(args ?? {}), ritual: true });
          if (cancel) return cancel;
          return Spellcasting.castAsRitual(actor, spell, args);
        }
      };
    })(),
    // Rest mechanics (since 1.2.0). `spendHitDie` is engine-bound
    // so its die roll flows into rollLog; `longRest` runs against
    // the engine's resolved rules so the recovery-mode knob applies.
    Rest: RestBound,
    // Scene clock (since 1.6.0). Pure surface — the engine doesn't
    // hold scene state; the host owns the clock and passes it in
    // and out via `advanceTime(scene, delta)`.
    SceneClock: Object.freeze({
      freshScene: SceneClock.freshScene,
      advanceTime: SceneClock.advanceTime,
      formatTimeOfDay: SceneClock.formatTimeOfDay,
      DEFAULT_DAWN_MINUTE: SceneClock.DEFAULT_DAWN_MINUTE,
      DEFAULT_DUSK_MINUTE: SceneClock.DEFAULT_DUSK_MINUTE,
      MINUTES_PER_DAY: SceneClock.MINUTES_PER_DAY
    }),
    // Magic items lifecycle (since 1.9.0). rechargeItem accepts the
    // engine's rng via the binding so dice-based recoveries (e.g.
    // 1d6+4 at dawn) flow into the same replay-deterministic chain.
    EncounterDesign: Object.freeze({
      xpForCR: EncounterDesignBase.xpForCR,
      ENCOUNTER_BUDGETS: EncounterDesignBase.ENCOUNTER_BUDGETS,
      budgetFor: EncounterDesignBase.budgetFor,
      classifyEncounter: EncounterDesignBase.classifyEncounter
    }),
    Inspiration: Object.freeze({
      hasInspiration: InspirationBase.hasInspiration,
      grant: InspirationBase.grantInspiration,
      spend: InspirationBase.spendInspiration,
      applyHalflingLucky: (originalD20) => InspirationBase.applyHalflingLucky(originalD20, rng),
      rerollFailedSave: (args) => InspirationBase.rerollFailedSave(args, rng),
      groupCheck: InspirationBase.groupCheck,
      workingTogether: InspirationBase.workingTogether
    }),
    Multiclass: Object.freeze({
      MULTICLASS_PREREQS: MulticlassBase.MULTICLASS_PREREQS,
      CASTER_WEIGHT: MulticlassBase.CASTER_WEIGHT,
      totalLevel: MulticlassBase.totalLevel,
      casterLevel: MulticlassBase.casterLevel,
      canMulticlassInto: MulticlassBase.canMulticlassInto,
      languages: MulticlassBase.languages,
      knowsLanguage: MulticlassBase.knowsLanguage,
      tools: MulticlassBase.tools,
      isProficientWithTool: MulticlassBase.isProficientWithTool
    }),
    Movement: Object.freeze({
      MOVEMENT_MODES: MovementBase.MOVEMENT_MODES,
      LIGHT_LEVELS: MovementBase.LIGHT_LEVELS,
      speedFor: MovementBase.speedFor,
      movementCost: MovementBase.movementCost,
      fall: (distanceFt) => MovementBase.fall(distanceFt, rng),
      longJump: MovementBase.longJump,
      highJump: MovementBase.highJump,
      effectiveLight: MovementBase.effectiveLight,
      obscuredState: MovementBase.obscuredState,
      hasLineOfSight: MovementBase.hasLineOfSight,
      hasLineOfEffect: MovementBase.hasLineOfEffect
    }),
    Monsters: Object.freeze({
      multiattackSequence: MonstersBase.multiattackSequence,
      freshLegendaryState: MonstersBase.freshLegendaryState,
      useLegendaryAction: MonstersBase.useLegendaryAction,
      refreshLegendaryActions: MonstersBase.refreshLegendaryActions,
      freshLegendaryResistance: MonstersBase.freshLegendaryResistance,
      useLegendaryResistance: MonstersBase.useLegendaryResistance,
      lairActionAvailable: MonstersBase.lairActionAvailable,
      fireLairAction: MonstersBase.fireLairAction,
      freshInnateState: MonstersBase.freshInnateState,
      castInnate: MonstersBase.castInnate,
      refreshInnateSpells: MonstersBase.refreshInnateSpells,
      senses: MonstersBase.senses,
      saveBonus: MonstersBase.saveBonus
    }),
    MagicItems: Object.freeze({
      RARITY_BANDS: MagicItemsBase.RARITY_BANDS,
      ATTUNEMENT_CAP: MagicItemsBase.ATTUNEMENT_CAP,
      RECHARGE_KINDS: MagicItemsBase.RECHARGE_KINDS,
      canAttune: MagicItemsBase.canAttune,
      attune: MagicItemsBase.attune,
      unattune: MagicItemsBase.unattune,
      spendCharge: MagicItemsBase.spendCharge,
      rechargeItem: (actor, item) => MagicItemsBase.rechargeItem(actor, item, rng),
      identifyItem: MagicItemsBase.identifyItem,
      isIdentified: MagicItemsBase.isIdentified,
      itemSavingThrow: (item, dc) => MagicItemsBase.itemSavingThrow(item, dc, rng)
    }),
    // Class mechanics (since 1.3.0). Foundation for resource-bearing
    // class features (Second Wind, Action Surge, Sneak Attack, etc.)
    // Per-class handlers live on the class def under `mechanics`.
    Mechanics: MechanicsBound,
    // Character derivation — turns a host-owned record into a
    // frozen sheet. See docs/character-sheet.md.
    deriveSheet: (record) => Character.deriveSheet(record, characterRegistries),
    // Audit / replay surface.
    rollLog,
    verifyLog,
    // Frozen merged rules — exposed for introspection ("which
    // pack is loaded?" UI, debug overlay, telemetry).
    rules,
    // Phase C: read-only hook registry. Hosts can inspect counts
    // and fire ad-hoc events (e.g. `onDeath` from non-exhaustion
    // causes the host detects, like dropping below 0 hp).
    hooks
  };
}

export { HOOK_EVENTS };
