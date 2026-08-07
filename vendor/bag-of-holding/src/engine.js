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
import * as HazardsBase from './hazards.js';
import * as EquipmentBase from './equipment.js';
import * as TravelBase from './travel.js';
import * as MountedCombatBase from './mounted-combat.js';
import { oracle as soloOracle, ODDS_BANDS, OUTCOMES } from './solo/oracle.js';
import { create as createSession, restore as restoreSession } from './solo/session.js';
import { share as shareReplay, verify as verifyReplay } from './solo/replay-share.js';
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

// Defaults for the senses + light-levels registries. Plugins append
// through opts.extraSenses / opts.extraLightLevels (since 1.24.0).
const DEFAULT_SENSES = Object.freeze(['darkvision', 'blindsight', 'truesight']);
const DEFAULT_LIGHT_LEVELS = Object.freeze(['bright', 'dim', 'darkness']);

/**
 * Cheap deterministic fingerprint of the resolved rules object.
 * Not a security hash; a stable hex digest over JSON-canonical
 * key order, used so a replay can fail loudly when the playback
 * engine has different rule knobs than the recording engine.
 */
function computeRulesFingerprint(rules) {
  const keys = Object.keys(rules).sort();
  const canonical = keys.map((k) => `${k}=${JSON.stringify(rules[k])}`).join('|');
  // 32-bit FNV-1a, hex-encoded.
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Graft `extraMechanics` and `extraResources` onto existing class
 * defs (since 1.24.0). Each is a `Record<classId, Record<key, value>>`.
 * Last-write-wins on key collision, matching the rest of the plugin
 * merge convention. Unknown classIds throw with a pointer to the
 * offending entry rather than silently dropping the contribution.
 */
function mergeClassExtensions(classes, extraMechanics = {}, extraResources = {}) {
  for (const classId of Object.keys(extraMechanics)) {
    if (!classes[classId]) {
      throw new Error(`Plugin contribution extraMechanics: unknown classId '${classId}'`);
    }
    const handlers = extraMechanics[classId];
    for (const [mechId, handler] of Object.entries(handlers)) {
      if (typeof handler !== 'function') {
        throw new Error(`Plugin contribution extraMechanics.${classId}.${mechId} must be a function`);
      }
    }
  }
  for (const classId of Object.keys(extraResources)) {
    if (!classes[classId]) {
      throw new Error(`Plugin contribution extraResources: unknown classId '${classId}'`);
    }
    const resources = extraResources[classId];
    for (const [resId, spec] of Object.entries(resources)) {
      if (!spec || typeof spec !== 'object' || !('refreshes' in spec)) {
        throw new Error(`Plugin contribution extraResources.${classId}.${resId} must declare 'refreshes'`);
      }
    }
  }
  if (Object.keys(extraMechanics).length === 0 && Object.keys(extraResources).length === 0) {
    return classes;
  }
  const out = { ...classes };
  for (const [classId, handlers] of Object.entries(extraMechanics)) {
    const base = out[classId];
    out[classId] = { ...base, mechanics: { ...(base.mechanics ?? {}), ...handlers } };
  }
  for (const [classId, resources] of Object.entries(extraResources)) {
    const base = out[classId];
    out[classId] = { ...base, resources: { ...(base.resources ?? {}), ...resources } };
  }
  return out;
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
    // Condition-record readers: restored after the 2.1.0 merge dropped them.
    conditionName: ConditionsBase.conditionName,
    conditionsRequiringSave: ConditionsBase.conditionsRequiringSave,
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
  const baseClasses = mergeRegistry('classes',     Classes,            opts.extraClasses);
  const backgrounds = mergeRegistry('backgrounds', defaultBackgrounds, opts.extraBackgrounds);
  const feats       = mergeRegistry('feats',       defaultFeats,       opts.extraFeats);
  const spells      = mergeRegistry('spells',      defaultSpells,      opts.extraSpells);
  const items       = mergeRegistry('items',       defaultItems,       opts.extraItems);
  const monsters    = mergeRegistry('monsters',    defaultMonsters,    opts.extraMonsters);

  // Phase A.2 plugin contributions: extraMechanics and extraResources
  // graft onto an existing class without forking its record. Last-write
  // -wins on id collision per the same plugin merge convention.
  const classes = mergeClassExtensions(baseClasses, opts.extraMechanics, opts.extraResources);

  // Extra senses and light levels live as small registries the host
  // can iterate when surfacing affordances. The default sets remain
  // the SRD canon; plugins extend without losing the defaults.
  const senses = Object.freeze([...DEFAULT_SENSES, ...(opts.extraSenses ?? [])]);
  const lightLevels = Object.freeze([...DEFAULT_LIGHT_LEVELS, ...(opts.extraLightLevels ?? [])]);

  const ConditionsBoundBase = buildConditions(opts.extraConditions);

  // === Phase B rule modifications ===
  const rules = buildRules(opts.rules);

  // === Phase C behavioural hooks ===
  const baseHooks = buildHookRegistry(opts.hooks);
  // When opts.logHooks is set, wrap `fire` so every hook event lands
  // in the rollLog. Counts (handler count per event) stay zero for
  // disabled events, so the wrapper short-circuits when nobody is
  // listening to avoid dead log entries.
  const hooks = opts.logHooks
    ? {
        ...baseHooks,
        fire: (event, payload) => {
          const merged = baseHooks.fire(event, payload);
          if (baseHooks.count(event) > 0) {
            record('hookFired', { event, handlerCount: baseHooks.count(event) });
          }
          return merged;
        }
      }
    : baseHooks;

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

  // Rules fingerprint (since 1.25.0): a stable hash of the resolved
  // rule-knob bundle plus key engine identifiers, so a replay across
  // mismatched rule packs diverges at the header entry instead of
  // silently at the first crit / damage-floor-affected roll.
  const rulesFingerprint = computeRulesFingerprint(rules);

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
    // Passive checks don't roll dice; no logging needed. Pass-through.
    passiveCheck: Checks.passiveCheck,
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

  // Adapter that lets sub-systems (Hazards) reuse the bound
  // savingThrow so their save rolls flow into the same rollLog. The
  // sub-system passes only the structured save args (abilityScore,
  // dc, ...) plus its own rng; the wrapper drops the rng argument
  // because the engine binding always uses the engine's seeded rng.
  const hazardSaver = (args) => ChecksBound.savingThrow(args, 'hazard');

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
    beginAttackAction: EncounterBase.beginAttackAction,
    utilize: EncounterBase.utilize,
    bonusAction: EncounterBase.bonusAction,
    reveal: EncounterBase.reveal,
    clearReady: EncounterBase.clearReady,

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
      // Snapshot the pre-roll death-save tracker so the log entry
      // is fully reconstructable without external state (since 1.25.0).
      const prev = actor.deathSaves ?? {};
      const previousSuccesses = prev.successes ?? 0;
      const previousFailures = prev.failures ?? 0;
      const result = CombatBase.deathSave(actor, rng, rules);
      if (result.d20 !== 0) {
        record('deathSave', {
          d20: result.d20,
          outcome: result.outcome,
          previousSuccesses,
          previousFailures
        }, context);
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
    // SRD 5.2 § Damage and Healing (Stabilizing): rolls the 1d4-hour
    // timer for stable-creature regen through the engine rng so the
    // tick is replay-deterministic.
    rollStableRegenHours: () => CombatBase.rollStableRegenHours(rng),

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
      const wasUnconscious = ConditionsBase.has(actor, 'unconscious');
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
    longRest: (actor, opts) => {
      const next = RestBase.longRest(actor, rules, opts);
      // Phase D (since 1.6.0). onLongRest fires after all rest
      // recovery is applied so plugins observing it can inspect the
      // restored state; the `previous` field surfaces the actor as
      // it stood when the rest began. On an interrupted rest the
      // hook still fires so plugins can react, but the actor is
      // unchanged per SRD 5.2 § Long Rest.
      hooks.fire('onLongRest', { actor: next, previous: actor, interrupted: opts?.interrupted === true });
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
      // Subclass mechanics override class-level handlers when the
      // actor has a subclassId that matches a registered subclass.
      const subclassDef = actor.subclassId ? classDef.subclasses?.[actor.subclassId] : null;
      const subclassHandlers = subclassDef?.mechanics ?? {};
      const handlers = classDef.mechanics ?? {};
      const handler = subclassHandlers[id] ?? handlers[id];
      if (!handler) {
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
        modFromScore: Checks.modFromScore,
        saver: hazardSaver
      };
      const result = handler(actor, args ?? {}, ctx);
      // Log a mechanicApplied entry so the audit trail captures the
      // resource transition + result kind, not just the dice inside.
      // The 'ok' field is the SRD convention: handlers that succeed
      // return `{ ok: true, ... }`; some always succeed and omit it.
      const ok = result && typeof result === 'object' && 'ok' in result ? result.ok : true;
      record('mechanicApplied', {
        classId: classDef.id,
        subclassId: subclassDef?.id ?? null,
        mechanic: id,
        ok
      }, context);
      return result;
    }
  };

  const engineInstance = {
    // Data registries — plain objects, mutate at your own risk.
    species, classes, backgrounds, feats, spells, items, monsters,
    // Plugin-extensible vocabularies (since 1.24.0). Each is a
    // frozen, deduplicated list combining the SRD defaults with any
    // `opts.extraSenses` / `opts.extraLightLevels` contributions.
    senses, lightLevels,
    // Stable hex digest over the resolved rule knobs (since 1.25.0).
    // Replay verifier compares this against the recorded fingerprint
    // and surfaces a mismatched-pack divergence at the header entry.
    rulesFingerprint,
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
        },
        // Spell scroll casting (since 1.29.0; SRD § Magic Items —
        // Spell Scroll). Rolls the higher-level check through the
        // engine rng; scroll consumption is the host's job.
        castFromScroll: (actor, spell, args) => {
          const cancel = fireOnCast(actor, spell, args);
          if (cancel) return cancel;
          return Spellcasting.castFromScroll(actor, spell, args, rng);
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
      MINUTES_PER_DAY: SceneClock.MINUTES_PER_DAY,
      MINUTES_PER_EXPLORATION_TURN: SceneClock.MINUTES_PER_EXPLORATION_TURN,
      advanceTurn: SceneClock.advanceTurn,
      isDaytime: SceneClock.isDaytime,
      timeOfDayLabel: SceneClock.timeOfDayLabel
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
    // Hazards & environment (since 1.18.0; closes the 1.15.0
    // milestone). Saves route through the engine's rng so a seeded
    // session reproduces every disease, poison, and exposure roll.
    Hazards: Object.freeze({
      DISEASES: HazardsBase.DISEASES,
      POISONS: HazardsBase.POISONS,
      POISON_VECTORS: HazardsBase.POISON_VECTORS,
      UNDERWATER_OK_MELEE: HazardsBase.UNDERWATER_OK_MELEE,
      UNDERWATER_OK_RANGED: HazardsBase.UNDERWATER_OK_RANGED,
      UNDERWATER_RESISTED_DAMAGE: HazardsBase.UNDERWATER_RESISTED_DAMAGE,
      exposure: (args) => HazardsBase.exposure(args, rng, hazardSaver),
      tickPoison: HazardsBase.tickPoison,
      tickSuffocation: HazardsBase.tickSuffocation,
      holdBreathRounds: HazardsBase.holdBreathRounds,
      starvationTick: (actor, opts) => HazardsBase.starvationTick(actor, opts, rng, hazardSaver),
      extremeTemperatureTick: (actor, opts) => HazardsBase.extremeTemperatureTick(actor, opts, rng, hazardSaver),
      classifyUnderwaterAttack: HazardsBase.classifyUnderwaterAttack
    }),
    // Equipment depth (since 1.19.0; closes 1.17.0 milestone).
    // Encumbrance + armor mechanics + tool proficiency.
    Equipment: Object.freeze({
      ENCUMBRANCE_MULT: EquipmentBase.ENCUMBRANCE_MULT,
      ADVENTURING_GEAR: EquipmentBase.ADVENTURING_GEAR,
      TOOLS: EquipmentBase.TOOLS,
      LIFESTYLES: EquipmentBase.LIFESTYLES,
      SERVICES: EquipmentBase.SERVICES,
      MOUNTS: EquipmentBase.MOUNTS,
      VEHICLES: EquipmentBase.VEHICLES,
      TRADE_GOODS: EquipmentBase.TRADE_GOODS,
      TREASURE_HOARDS: EquipmentBase.TREASURE_HOARDS,
      INDIVIDUAL_TREASURE: EquipmentBase.INDIVIDUAL_TREASURE,
      encumbranceLevel: EquipmentBase.encumbranceLevel,
      encumbranceSpeedPenalty: EquipmentBase.encumbranceSpeedPenalty,
      armorStrengthPenalty: EquipmentBase.armorStrengthPenalty,
      carriedWeight: (itemIds) => EquipmentBase.carriedWeight(itemIds, items),
      donTime: (armorId) => EquipmentBase.donTime(armorId, items),
      doffTime: (armorId) => EquipmentBase.doffTime(armorId, items),
      toolCheck: (args) => EquipmentBase.toolCheck(args, rng)
    }),
    // Travel & exploration (since 1.20.0; closes 1.18.0 milestone).
    Travel: Object.freeze({
      TRAVEL_PACES: TravelBase.TRAVEL_PACES,
      milesTravelled: TravelBase.milesTravelled,
      forcedMarchCheck: (actor, opts) => TravelBase.forcedMarchCheck(actor, opts, rng, hazardSaver),
      checkRestInterruption: (opts) => TravelBase.checkRestInterruption(opts, rng),
      forageCheck: (args) => TravelBase.forageCheck(args, rng),
      navigateCheck: (args) => TravelBase.navigateCheck(args, rng)
    }),
    // Mounted Combat (since 1.30.0; SRD 5.2 § Combat — Mount).
    // Pure helpers, no logging needed.
    MountedCombat: Object.freeze({
      mount: MountedCombatBase.mount,
      dismount: MountedCombatBase.dismount,
      isMountedOn: MountedCombatBase.isMountedOn,
      legalMountActions: MountedCombatBase.legalMountActions,
      CONTROLLED_MOUNT_ACTIONS: MountedCombatBase.CONTROLLED_MOUNT_ACTIONS
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
    hooks,
    // Solo-play oracle (since 2.0.0). Engine-bound surface; pass
    // `{ rng: Dice.seededRng(seed) }` for replay-deterministic oracle
    // answers. The oracle deliberately does NOT share the engine's
    // dice rng — oracle pulls would silently perturb the dice
    // stream and break replay of the rolls in `engine.rollLog`.
    Solo: Object.freeze({
      oracle: (opts = {}) => soloOracle(opts),
      ODDS_BANDS,
      OUTCOMES
    })
  };

  // Session.create + Replay.share need a back-reference to the
  // engine they were built from. Stamp them on after the engine
  // object is constructed so the closure captures the final shape.
  engineInstance.Session = Object.freeze({
    create: (opts) => createSession({ engine: engineInstance, ...(opts ?? {}) }),
    restore: (payload) => restoreSession(payload, engineInstance)
  });
  engineInstance.Replay = Object.freeze({
    share: shareReplay,
    verify: (payload) => verifyReplay(payload, engineInstance)
  });
  return engineInstance;
}

export { HOOK_EVENTS };
