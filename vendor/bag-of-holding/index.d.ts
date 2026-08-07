// Type definitions for bag-of-holding.
//
// Hand-maintained alongside the JS surface. When you add or change
// a public export in `index.js`, `src/engine.js`, or any of the
// rules modules, update this file in the same commit — the
// typecheck script (`npm run typecheck`) is the drift guard.

// ============================================================
// Core scalars and record shapes
// ============================================================

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/**
 * SRD 5.2 boolean condition names. Plugins may extend this set via
 * `createEngine({ extraConditions })`; once added they are first-
 * class strings in the engine's condition vocabulary.
 */
export type ConditionName =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled'
  | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified'
  | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
  | string;

/**
 * Full condition record shape (since v1.6.1, restored in 2.2.1). Hosts can
 * apply a plain string for simple boolean conditions, or a record to attach
 * save metadata. Entries are stored as given — `actor.conditions` may hold
 * either shape, and every reader here accepts both. Use `conditionName` rather
 * than reading `.name` when iterating.
 */
export interface ConditionRecord {
  name: ConditionName;
  /** Arbitrary source tag (actor id, spell id, etc.) for bookkeeping. */
  source?: unknown;
  /** Save DC the affected creature rolls against to end the condition. */
  dc?: number;
  /** Ability used for the save (`'con'`, `'wis'`, etc.). */
  saveAbility?: Ability;
  /** When to auto-roll the save: at the end or start of the affected
   *  creature's turn. Omit if the condition has no recurring save. */
  endsOn?: 'turnEnd' | 'turnStart';
}

/** One entry in the `conditionSaves` array returned by `turnEnd` / `turnStart`. */
export interface ConditionSaveResult {
  entry: ConditionRecord;
  saveResult: ReturnType<ChecksNamespace['savingThrow']>;
}

/** The eight SRD 5.2 weapon mastery property names. */
export type MasteryName =
  | 'cleave' | 'graze' | 'nick' | 'push'
  | 'sap' | 'slow' | 'topple' | 'vex'
  | string;

export interface Species {
  id: string;
  name: string;
  size: Size;
  speed: number;
  /** Free-form display labels for a species card. */
  traits?: string[];
  /** Structured, engine-readable mechanics for the species. Optional
   *  on homebrew records; the engine treats a missing block as
   *  "no mechanical traits to surface". */
  effects?: {
    darkvisionFt?: number;
    blindsightFt?: number;
    truesightFt?: number;
    damageResistances?: readonly string[];
    /** Alternate movement modes granted by the species (e.g. Aarakocra
     *  fly 30, Triton swim 30). Merges into the derived sheet's
     *  `speed` block. */
    extraSpeeds?: Readonly<{ fly?: number; swim?: number; climb?: number; burrow?: number }>;
    /** Open-ended flag map. Engine ships keys like `feyAncestry`,
     *  `lucky`, `brave`, `stonecunning`, `trance`; plugins can add
     *  their own. */
    flags?: Readonly<Record<string, boolean>>;
  };
}

/** Spellcasting progression tier. `full` = Wizard/Cleric/Druid/Bard/
 *  Sorcerer; `half` = Paladin/Ranger; `warlock` = Pact Magic (short-
 *  rest refresh); `none` = non-caster classes. */
export type CasterProgression = 'full' | 'half' | 'warlock' | 'none';

export interface ClassDef {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility?: Ability;
  savingThrowProficiencies?: Ability[];
  weaponMasterySlots?: number;
  /** Map of `level → extra attacks per Attack action`. Fighter 5 →
   *  `{ 5: 1 }` (Extra Attack adds one). Read by
   *  `Combat.attacksPerAction`. */
  extraAttacks?: Record<number, number>;
  spellcasting?: {
    ability: Ability;
    cantripsKnown?: Record<number, number>;
    /** Slot progression family. Defaults missing for non-casters. */
    progression?: CasterProgression;
    /** `'prepared'` for prep classes (Cleric/Druid/Paladin/Ranger/
     *  Wizard); `'known'` for known-list classes (Bard/Sorcerer/
     *  Warlock). */
    preparation?: 'prepared' | 'known';
  };
  features?: Record<number, string[]>;
  /** Class resource specs (since 1.3.0). Keys are resource ids
   *  (`secondWind`, `rage`, `bardicInspiration`, …); each entry
   *  declares the max (number or function-of-level) and refresh
   *  contract. */
  resources?: Record<string, { max: number | ((level: number) => number); refreshes: RefreshKind }>;
  /** Class mechanic handlers (since 1.3.0). Keys are the same as
   *  `resources` plus any non-resource per-turn mechanics. Each
   *  handler is invoked through `engine.Mechanics.apply(actor, id,
   *  args, context)`. */
  mechanics?: Record<string, ClassMechanicHandler>;
}

/** Refresh contract for a class resource. Long Rest is a superset
 *  of Short Rest per SRD 5.2 § Long Rest. */
export type RefreshKind = 'short' | 'long' | 'day';

/** A resource counter on an actor. */
export interface Resource {
  used: number;
  max: number;
  refreshes: RefreshKind;
}

export interface ClassMechanicContext {
  rng: RNG;
  rollDie: (sides: number, rng?: RNG) => number;
  modFromScore: (score: number) => number;
}

export type ClassMechanicHandler = (
  actor: Actor,
  args: Record<string, unknown>,
  ctx: ClassMechanicContext
) => unknown;

export interface OriginFeatRef {
  id: string;
  variant?: string;
}

export interface Background {
  id: string;
  name: string;
  abilityScores: Ability[];
  skillProficiencies: string[];
  toolProficiency?: string;
  originFeat: OriginFeatRef;
}

export interface Feat {
  id: string;
  name: string;
  category: 'origin' | 'general' | 'fighting-style' | 'epic-boon' | string;
  variants?: string[];
  grants?: Record<string, unknown>;
  repeatable?: boolean;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  // Engine-side helpers — optional, mechanics-specific.
  damage?: string;
  healing?: string;
  save?: Ability;
  reaction?: boolean;
  acBonus?: number;
  autohit?: boolean;
  projectiles?: number;
  sets?: Record<string, string>;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | string;
  // Weapon-only fields.
  damage?: string;
  damageType?: string;
  properties?: string[];
  mastery?: MasteryName;
  // Armor-only fields.
  ac?: number;
  acBonus?: number;
  addsDex?: boolean;
  maxDex?: number;
  /** Armor weight class (since v1.17.0). */
  armorCategory?: 'light' | 'medium' | 'heavy';
  /** True when the armor imposes Stealth disadvantage per the SRD
   *  Armor table (since v1.17.0). Omitted (falsy) when no penalty. */
  stealthDisadvantage?: boolean;
  /** Minimum STR score required to wear at full speed (since v1.17.0).
   *  Heavy armor only. Below this threshold, speed is reduced by 10
   *  ft. Omitted when there is no requirement. */
  strRequirement?: number;
  /** Minutes to don this armor (since v1.17.0). Omitted for shields
   *  (which use an action). */
  donMinutes?: number;
  /** Minutes to doff this armor (since v1.17.0). Omitted for shields. */
  doffMinutes?: number;
  // Consumable-only fields.
  heals?: string;
}

/** SRD 5.2 monster stat block. Carries the fields a host needs to
 *  wire a creature into the encounter system: AC, HP, abilities,
 *  speed, attacks, CR. Plugins extend the registry via
 *  `createEngine({ extraMonsters })`. */
export interface Monster {
  id: string;
  name: string;
  cr: number;
  ac: number;
  hp: number;
  size: Size;
  speed: number;
  abilityScores: Record<Ability, number>;
  attacks?: Array<{ name: string; attackBonus: number; damage: string; damageType?: string }>;
  traits?: string[];
  skills?: Record<string, number>;
}

// ============================================================
// Dice
// ============================================================

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceRoll {
  spec: string;
  rolls: number[];
  modifier: number;
  total: number;
}

/**
 * A pseudo-random number generator. Signature matches `Math.random`
 * (zero-arg function returning a float in [0, 1)). Pass
 * `Dice.seededRng(seed)` for deterministic replay.
 */
export type RNG = () => number;

export interface DiceNamespace {
  parse(spec: string): DiceSpec;
  /** Module-level: optional `rng` for determinism.
   *  Engine-bound: optional `context` second arg for trace-back. */
  rollDie(sides: number, rngOrContext?: RNG | unknown): number;
  roll(spec: string, rngOrContext?: RNG | unknown): DiceRoll;
  rollAdvantage(spec: string, rngOrContext?: RNG | unknown): DiceRoll;
  rollDisadvantage(spec: string, rngOrContext?: RNG | unknown): DiceRoll;
  /** Exploding-dice roll: every die that hits max rolls again.
   *  Used by `rules.explodingDamageDice`; also callable directly. */
  rollExplosive(spec: string, rng?: RNG): DiceRoll;
  seededRng(seed: number): RNG;
}

/**
 * The shape of one entry in `engine.rollLog`. Every entry has an
 * `index` (monotonic across the session) and an `op` discriminator;
 * additional fields depend on the operation. Optional `context`
 * carries whatever the caller passed for trace-back.
 */
export type RollEntry =
  | { index: number; op: 'rollDie';          sides: number; value: number;                                                                        context?: unknown }
  | { index: number; op: 'roll';             spec: string;  rolls: number[]; modifier: number; total: number;                                     context?: unknown }
  | { index: number; op: 'rollAdvantage';    spec: string;  rolls: number[]; modifier: number; total: number;                                     context?: unknown }
  | { index: number; op: 'rollDisadvantage'; spec: string;  rolls: number[]; modifier: number; total: number;                                     context?: unknown }
  | { index: number; op: 'rollInitiative';   dexterity: number; value: number;                                                                    context?: unknown }
  | { index: number; op: 'attackRoll';       d20: number; attackBonus: number; total: number; ac: number; hit: boolean; critical: boolean; fumble: boolean; context?: unknown }
  | { index: number; op: 'damageRoll';       damageDice: string; baseRolls: number[]; critRolls: number[]; damageMod: number; total: number;     context?: unknown }
  | { index: number; op: 'abilityCheck';     abilityScore: number; proficient: boolean; proficiencyBonus: number; d20: number; mod: number; total: number; dc: number; success: boolean; context?: unknown }
  | { index: number; op: 'savingThrow';      abilityScore: number; proficient: boolean; proficiencyBonus: number; d20: number; mod: number; total: number; dc: number; success: boolean; context?: unknown }
  | { index: number; op: 'deathSave';        d20: number; outcome: DeathSaveOutcome;                                                                 context?: unknown };

export interface VerifyLogArgs {
  seed: number;
  log: RollEntry[];
  /** Optional rules object. Must match the rules under which the
   *  log was originally produced — verifying with the wrong rules
   *  diverges at the first crit/damage-floor-affected roll. */
  rules?: EngineRules;
}

export type VerifyLogResult =
  | { ok: true }
  | { ok: false; divergedAt: number; expected: unknown; actual: unknown; reason?: string };

/** Replay a roll log forward from `seed` and verify each operation
 *  reproduces the logged outcome. See `src/replay.js` for the full
 *  contract. */
export function verifyLog(args: VerifyLogArgs): VerifyLogResult;

// ============================================================
// Checks
// ============================================================

export interface AbilityCheckArgs {
  abilityScore: number;
  proficient?: boolean;
  proficiencyBonus?: number;
  dc: number;
}

export interface AbilityCheckResult {
  d20: number;
  mod: number;
  total: number;
  dc: number;
  success: boolean;
}

/** Args for a tool proficiency check (since v1.17.0). */
export interface ToolCheckArgs extends AbilityCheckArgs {
  /** Tool id used for logging and auto-proficiency lookup. */
  toolId?: string;
  /** Actor object — when provided alongside `toolId`, the engine-bound
   *  version resolves proficiency from `actor.tools` automatically. */
  actor?: Actor;
}

/** Result of a tool check — same shape as `AbilityCheckResult` plus
 *  the `toolId` echo when one was supplied. */
export interface ToolCheckResult extends AbilityCheckResult {
  toolId?: string;
}

export interface ChecksNamespace {
  modFromScore(score: number): number;
  clampDC(dc: number): number;
  /** Engine-bound version optionally takes a `context` second arg
   *  that's attached to the corresponding `RollEntry`. Module-level
   *  version takes an optional `rng` instead. */
  abilityCheck(args: AbilityCheckArgs, context?: unknown): AbilityCheckResult;
  savingThrow(args: AbilityCheckArgs, context?: unknown): AbilityCheckResult;
  /** Roll a tool proficiency check (since v1.17.0). Mechanically
   *  identical to an ability check; named separately for log clarity.
   *  The engine-bound version auto-resolves proficiency from
   *  `actor.tools` when `actor` and `toolId` are both provided. */
  toolCheck(args: ToolCheckArgs, context?: unknown): ToolCheckResult;
}

// ============================================================
// Combat (engine-bound)
// ============================================================

export interface AttackRollArgs {
  attackBonus: number;
  ac: number;
  /** Attacker actor — optional. If passed along with `target`, the
   *  engine derives advantage/disadvantage from active conditions. */
  attacker?: Actor;
  /** Target actor — optional. See `attacker` for the condition-
   *  aware advantage/disadvantage path. */
  target?: Actor;
  /** Distance attacker → target in feet. Matters only for the
   *  `prone` target rule (within 5 ft → advantage; further →
   *  disadvantage). */
  attackerDistanceFt?: number;
}

export interface AttackRollResult {
  d20: number;
  attackBonus: number;
  total: number;
  ac: number;
  hit: boolean;
  critical: boolean;
  fumble: boolean;
  /** Advantage / disadvantage / normal stance taken by the roll.
   *  Surfaced so a host's UI can label the roll without re-deriving
   *  the conditions. */
  stance: 'normal' | 'advantage' | 'disadvantage';
}

export interface DamageRollArgs {
  damageDice: string;
  damageMod?: number;
  critical?: boolean;
  /** Optional damage type tag (since 1.4.0). Surfaces on the result
   *  for consumption by `Combat.applyDamage`'s modifier pipeline. */
  damageType?: string;
}

export interface DamageRollResult {
  damageDice: string;
  baseRolls: number[];
  critRolls: number[];
  damageMod: number;
  total: number;
  damageType?: string;
}

export interface InitiativeArgs {
  dexterity: number;
}

/**
 * A mastery rider — what the loop should additionally do after the
 * core attack resolves. `kind: 'none'` means the property didn't
 * fire this attack (e.g. graze on a hit, vex on a miss).
 */
export type MasteryRider =
  | { kind: 'none' }
  | { kind: 'cleave'; range: number }
  | { kind: 'graze'; damage: number }
  | { kind: 'nick'; extraAttack: true }
  | { kind: 'push'; distance: number; sizeCap: Size }
  | { kind: 'sap'; disadvantage: true }
  | { kind: 'slow'; speedReduction: number }
  | { kind: 'topple'; saveDC: number; ability: Ability; onFail: ConditionName }
  | { kind: 'vex'; advantage: true }
  | { kind: string; [extra: string]: unknown };  // plugin-defined

/**
 * Plugin handler signature. Pure — same inputs, same output —
 * because the engine commits to replay-determinism.
 */
export type MasteryHandler = (
  weapon: Item,
  target: unknown,
  attackResult: AttackRollResult,
  attacker?: { proficiencyBonus?: number } & Record<string, unknown>
) => MasteryRider;

/** A participant in an encounter: at minimum an `id`, `dexterity`,
 *  and `speed`. Hosts can attach any extra fields (hp, faction, etc.);
 *  the encounter tracker preserves them. */
export interface Participant {
  id: string;
  dexterity: number;
  speed: number;
  [extra: string]: unknown;
}

/** Per-actor budget for one turn. `null` means "no budget" — used
 *  for movement on a flying creature standing still, etc. */
export interface ActionBudget {
  action: number;
  bonus: number;
  reaction: number;
  movement: number | null;
}

/** Encounter state. Pure — every mutation returns a new state. */
export interface EncounterState {
  order: (Participant & { initiative: number; initiativeD20: number })[];
  turnIndex: number;
  round: number;
  budgets: Record<string, ActionBudget>;
  log: Array<{ kind: string; [extra: string]: unknown }>;
}

export type CoverName = 'none' | 'half' | 'three-quarters' | 'full';

export interface CombatNamespace {
  /** `context` (engine-bound only) attaches to the corresponding
   *  `RollEntry` for trace-back. */
  rollInitiative(args: InitiativeArgs, context?: unknown): number;
  attackRoll(args: AttackRollArgs, context?: unknown): AttackRollResult & { cancelled?: true };
  damageRoll(args: DamageRollArgs, context?: unknown): DamageRollResult;
  readonly MASTERY_PROPERTIES: readonly MasteryName[];
  applyMastery(
    weapon: Item,
    target: unknown,
    attackResult: AttackRollResult,
    attacker?: { proficiencyBonus?: number } & Record<string, unknown>
  ): MasteryRider;

  // === Encounter system (since 0.4.0) ===
  /** Start an encounter: rolls initiative for every participant and
   *  builds a fresh action-budget table. */
  startEncounter(participants: Participant[]): EncounterState;
  /** Sort participants by initiative without building full state.
   *  Useful for previewing the turn order before committing. */
  rollOrder(participants: Participant[]): EncounterState['order'];
  currentActor(state: EncounterState): Participant | null;
  /** Advance to the next actor and refresh their budget. Returns
   *  `finished: true` only when the encounter has zero participants. */
  endTurn(state: EncounterState): { state: EncounterState; finished: boolean };
  /** Remove a participant (death, fled, withdrew). */
  removeParticipant(state: EncounterState, actorId: string): EncounterState;
  /** Spend a budget slot. `amount` defaults to 1; movement spends feet. */
  spend(
    state: EncounterState,
    actorId: string,
    cost: 'action' | 'bonus' | 'reaction' | 'movement' | 'free' | string,
    amount?: number
  ): { allowed: true; state: EncounterState } | { allowed: false; reason: string };
  /** Fresh budget object for an actor with the given speed. */
  freshBudget(speed: number): ActionBudget;
  /** Number of attacks per Attack action for a class at a level. */
  attacksPerAction(classDef: ClassDef | null | undefined, level: number): number;
  /** Resolve an opportunity attack. Returns the new encounter state
   *  alongside the attack outcome, or `triggered: false` with a reason. */
  opportunityAttack(
    state: EncounterState,
    args: {
      reactorId: string;
      attackerArgs: AttackRollArgs;
      disengaged?: boolean;
      context?: unknown;
    }
  ):
    | { triggered: true; attack: AttackRollResult; state: EncounterState }
    | { triggered: false; reason: string; state: EncounterState };
  /** Effective AC after cover. `null` when cover is `full`. */
  effectiveAc(baseAc: number, cover?: CoverName | string): number | null;
  /** Classify ranged distance against normal/long range. */
  rangeBand(args: { distance: number; normalRange: number; longRange: number }):
    'in-range-normal' | 'in-range-long' | 'out-of-range';
  readonly ACTION_COSTS: readonly string[];
  readonly COVER_BONUSES: Readonly<Record<CoverName, number | null>>;

  // === Death saves (since 1.1.0) ===
  /** Fresh, zeroed death-save tracker. SRD 5.2 § Damage and
   *  Healing — Death Saving Throws. */
  freshDeathSaves(): DeathSaveTracker;
  /** Drop an actor to 0 HP: applies Unconscious, initialises the
   *  death-save tracker. Fires `onConditionApplied`. */
  dropToZero(actor: Actor): Actor;
  /** Roll one death save. Returns the new actor (with the tracker
   *  advanced) and the outcome. Logs the d20 face to `rollLog` and
   *  fires `onDeath` on the third failure. */
  deathSave(actor: Actor, context?: unknown): DeathSaveResult;
  /** Apply damage to an actor already at 0 HP. Counts as one failed
   *  save (two on a critical hit, or instant death if `damageTaken
   *  >= hpMax`). Fires `onDeath` on the killing blow. */
  applyDamageWhileDown(
    actor: Actor,
    damageTaken: number,
    args?: { critical?: boolean; hpMax?: number }
  ): { outcome: DeathSaveOutcome; actor: Actor };
  /** Stabilise the actor (Medicine check, spare-the-dying). Stays
   *  at 0 HP and Unconscious; tracker resets and is flagged stable. */
  stabilize(actor: Actor): Actor;
  /** Revive the actor to a positive HP. Clears the tracker and
   *  removes Unconscious. Throws if `hp < 1`. */
  reviveTo(actor: Actor, hp: number): Actor;

  // === Damage pipeline (since 1.4.0) ===
  /** Apply SRD damage modifiers (Immunity → Resistance →
   *  Vulnerability) to a raw amount. Pure; returns the post-modifier
   *  integer. */
  applyDamageModifiers(actor: Actor, args: { amount: number; type?: string }): number;
  /** Grant Temporary HP per SRD § Temporary HP — non-stacking; the
   *  new amount only takes effect when strictly larger than the
   *  current value. */
  grantTempHp(actor: Actor, amount: number): Actor;
  /** Canonical damage application: combines modifier pipeline, temp-
   *  HP absorption, HP subtraction, drop-to-zero, massive-damage
   *  instant death, and damage-while-down dispatch. Fires the
   *  appropriate hooks (onConditionApplied for downed,
   *  onDeath for instant death / cumulative-failure dead). */
  applyDamage(actor: Actor, args: {
    amount?: number;
    type?: string;
    critical?: boolean;
    source?: unknown;
  }): DamageResult;
  /** Generic healing per SRD § Healing. Caps at hpMax; removes
   *  Unconscious + clears the death-save tracker if HP rises above
   *  0. Does NOT restore Temporary HP. */
  heal(actor: Actor, amount: number): { healed: number; hpBefore: number; hpAfter: number; actor: Actor };

  // === Turn lifecycle + timers (since 1.6.0) ===
  /** Add a round-scoped timer (spell duration, buff, debuff). */
  addTimer(actor: Actor, timer: ActorTimer): Actor;
  /** Decrement every timer; return new actor + expired list. */
  tickTimers(actor: Actor): { actor: Actor; expired: ActorTimer[] };
  /** Turn-start signal. Fires `onTurnStart`. Auto-rolls saves for any
   *  conditions with `endsOn: 'turnStart'` and removes cleared ones. */
  turnStart(actor: Actor, context?: unknown): { actor: Actor; conditionSaves: ConditionSaveResult[] };
  /** Turn-end lifecycle. Ticks timers, auto-rolls saves for conditions
   *  with `endsOn: 'turnEnd'`, fires `onTurnEnd`, returns the new actor. */
  turnEnd(actor: Actor, context?: unknown): { actor: Actor; expired: ActorTimer[]; conditionSaves: ConditionSaveResult[] };
}

export interface ActorTimer {
  id: string;
  kind?: string;
  remainingRounds: number;
  source?: unknown;
}

/** Scene clock (since 1.6.0). Pure functions; the host owns the
 *  scene state and threads it through. */
export interface SceneClockNamespace {
  readonly DEFAULT_DAWN_MINUTE: number;
  readonly DEFAULT_DUSK_MINUTE: number;
  readonly MINUTES_PER_DAY: number;
  freshScene(args?: { startMinute?: number; dawnMinute?: number; duskMinute?: number }): Scene;
  advanceTime(scene: Scene, delta: { rounds?: number; minutes?: number; hours?: number; days?: number }):
    { scene: Scene; events: ('dawn' | 'dusk')[] };
  formatTimeOfDay(minutes?: number): string;
}

export interface Scene {
  minutes: number;
  dawnMinute?: number;
  duskMinute?: number;
}

export type DamageOutcome = 'damaged' | 'downed' | 'dead' | 'absorbed' | 'immune';

export interface DamageResult {
  amount: number;
  finalAmount: number;
  tempHpAbsorbed: number;
  hpBefore: number;
  hpAfter: number;
  outcome: DamageOutcome;
  actor: Actor;
  source?: unknown;
}

/** Tracker stored on the actor while at 0 HP. */
export interface DeathSaveTracker {
  successes: number;
  failures: number;
  stable: boolean;
  dead: boolean;
}

export type DeathSaveOutcome =
  | 'success' | 'failure' | 'stable' | 'dead' | 'revived' | 'noop';

export interface DeathSaveResult {
  d20: number;
  outcome: DeathSaveOutcome;
  actor: Actor;
}

// ============================================================
// Conditions (engine-bound)
// ============================================================

export interface Actor {
  id?: string;
  /** Active conditions. Entries are `ConditionRecord` objects at runtime;
   *  legacy string values are tolerated on read for backward compatibility. */
  conditions?: (ConditionRecord | ConditionName)[];
  exhaustion?: number;
  /** Class-feature resource counters (since 1.3.0). Keyed by
   *  resource id (`secondWind`, `rage`, …). */
  resources?: Record<string, Resource>;
  /** Damage type tags consumed by `Combat.applyDamageModifiers`
   *  (since 1.4.0). */
  damageImmunities?: string[];
  damageResistances?: string[];
  damageVulnerabilities?: string[];
  /** Temporary HP (since 1.4.0). Non-stacking; replaced when a new
   *  higher amount is granted. Absorbs damage before `hp`. */
  tempHp?: number;
  [extra: string]: unknown;
}

export interface ExhaustionNamespace {
  level(actor: Actor): number;
  gain(actor: Actor, amount?: number): Actor;
  reduce(actor: Actor, amount?: number): Actor;
  set(actor: Actor, level: number): Actor;
  modifierToD20Tests(actor: Actor): number;
  speedPenalty(actor: Actor): number;
  isDead(actor: Actor): boolean;
}

/** Mechanical-effect flags a condition imposes on the math.
 *  Boolean flags OR together when multiple conditions are active. */
export interface ConditionEffect {
  attackerDisadvantage?: boolean;
  ownAttackDisadvantage?: boolean;
  ownAttackAdvantage?: boolean;
  ownCheckDisadvantage?: boolean;
  targetAdvantage?: boolean;
  targetDisadvantage?: boolean;
  autoFailStrDexSaves?: boolean;
  saveDexDisadvantage?: boolean;
  incapacitates?: boolean;
  speedZero?: boolean;
  critIfAttackerWithin5?: boolean;
  cantSpeak?: boolean;
  cantSee?: boolean;
  cantHear?: boolean;
  proneOnTarget?: boolean;
  socialDisadvantageVsCharmer?: boolean;
  resistance?: 'all' | string;
  [extra: string]: unknown;
}

export interface ConditionsNamespace {
  readonly CONDITIONS: readonly ConditionName[];
  readonly EXHAUSTION_MAX: number;
  has(actor: Actor, condition: ConditionName): boolean;
  /** Apply a condition. Pass a plain string for a simple boolean condition,
   *  or a `ConditionRecord` to attach save metadata. Deduped by name:
   *  re-applying with metadata upgrades the existing entry rather than
   *  duplicating it. */
  apply(actor: Actor, condition: ConditionName | ConditionRecord): Actor;
  /** Remove all entries with the given condition name. */
  remove(actor: Actor, condition: ConditionName | ConditionRecord): Actor;
  /** Extract the condition name from a string or record entry. */
  conditionName(entry: ConditionName | ConditionRecord): ConditionName;
  /** Entries carrying BOTH `saveAbility` and `dc` whose `endsOn` matches
   *  `timing` — the conditions a host can roll a save against at that moment.
   *  The engine does not auto-roll these; `turnEnd` / `turnStart` tick timers
   *  and fire hooks, and the host decides whether to save. */
  conditionsRequiringSave(actor: Actor, timing: 'turnEnd' | 'turnStart'): ConditionRecord[];
  effectsFor(actor: Actor): Record<string, boolean | string>;
  attackStance(args: { attacker?: Actor; target?: Actor; attackerDistanceFt?: number }): 'normal' | 'advantage' | 'disadvantage';
  isImmuneTo(actor: Actor, condition: ConditionName): boolean;
  exhaustion: ExhaustionNamespace;
}

// ============================================================
// XP
// ============================================================

export interface PC {
  xp: number;
  level: number;
  [extra: string]: unknown;
}

export interface XPNamespace {
  readonly THRESHOLDS: Readonly<Record<number, number>>;
  readonly PROFICIENCY_BY_LEVEL: Readonly<Record<number, number>>;
  levelForXP(xp: number): number;
  nextLevelThreshold(xp: number): number | null;
  awardMilestone(args: { pc: PC; beat?: { targetPlaytimeMinutes?: number } }): {
    xpDelta: number;
    newTotal: number;
    willLevelUp: boolean;
  };
}

// ============================================================
// Movesets
// ============================================================

export type ActionCost = 'free' | 'action' | 'bonus' | 'reaction';

export interface ActionChip {
  id: string;
  label: string;
  cost: ActionCost | string;
}

export interface SceneState {
  mode?: 'combat' | 'exploration' | 'audience' | string;
  [extra: string]: unknown;
}

export interface MovesetsNamespace {
  legal(args: { pc: PC; scene?: SceneState }): ActionChip[];
}

// ============================================================
// Beats
// ============================================================

export interface ArchetypeSlot {
  role: string;
  weight?: number;
}

export interface Beat {
  id: string;
  dramaticPurpose: string;
  targetPlaytimeMinutes: number;
  prerequisites?: string[];
  setRequiredFlags?: string[];
  preferredLocation?: string | null;
  fallbackLocations?: string[];
  requiredArchetypes?: ArchetypeSlot[];
  boundEntities?: Record<string, unknown>;
  successors?: string[];
}

export interface Thread {
  beats: Beat[];
  currentIndex: number;
  /** Map of beat id → index, populated by `createThread` for O(1)
   *  successor lookups. */
  byId: Record<string, number>;
  /** Sub-thread stack. Empty = no nested thread; non-empty = the
   *  topmost entry is the currently-active sub-thread. */
  stack: Thread[];
}

/** Successor-picker callback for branching threads. Called with the
 *  candidate successor ids (filtered by their prerequisites against
 *  `state.flags`) plus the current state. Must return one of the
 *  candidate ids; returning anything else causes `advance` to
 *  refuse with a clear reason. */
export type SuccessorChooser = (args: {
  candidates: string[];
  state: { flags?: Record<string, boolean> };
  currentBeat: Beat;
}) => string;

export interface AdvanceResult {
  thread: Thread;
  advanced: boolean;
  finished?: boolean;
  reason?: string;
}

export interface BeatValidation {
  valid: boolean;
  errors: string[];
}

export interface BeatsNamespace {
  readonly ARCHETYPE_ROLES: readonly string[];
  validateBeat(beat: unknown): BeatValidation;
  makeEmptyBeat(id: string): Beat;
  createThread(beats: Beat[]): Thread;
  currentBeat(thread: Thread): Beat | null;
  isReady(beat: Beat | null, state: { flags?: Record<string, boolean> }): boolean;
  isComplete(beat: Beat | null, state: { flags?: Record<string, boolean> }): boolean;
  advance(
    thread: Thread,
    state: { flags?: Record<string, boolean> },
    opts?: { chooseSuccessor?: SuccessorChooser }
  ): AdvanceResult;
  /** Push a nested sub-thread (side quest, flashback). The runtime
   *  walks the sub-thread to completion, auto-pops, then returns to
   *  the parent's current beat. */
  pushSubThread(thread: Thread, beats: Beat[]): Thread;
  /** Read-only depth of the sub-thread stack (0 = none active). */
  subThreadDepth(thread: Thread): number;
  castArchetypes(
    beat: Beat,
    opts: { entityProvider: (slot: ArchetypeSlot) => unknown }
  ): { cast: Record<string, unknown> | null; missing: ArchetypeSlot | null; error: string | null };
}

// ============================================================
// Character sheet (derivation)
// ============================================================

/**
 * SRD 5.2 skill identifiers. Hosts use these strings in
 * `proficiencies.skills` / `background.skillProficiencies`. Each one
 * is governed by exactly one ability score (see SKILL_ABILITY in
 * `src/character.js`).
 */
export type SkillId =
  | 'acrobatics' | 'animal-handling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight-of-hand'
  | 'stealth' | 'survival'
  | string;

/**
 * The persistent character record. The host owns this — saves it to
 * `.dnd.json`, mutates it on level-up / equip / condition events,
 * and asks the engine to derive a sheet from it. See
 * docs/character-sheet.md for the field-by-field contract.
 */
export interface CharacterRecord {
  id: string;
  name: string;
  speciesId: string;
  backgroundId: string;
  classId: string;
  subclassId?: string;
  level: number;
  abilityScores: Record<Ability, number>;
  /** Player's distribution of the background's three ability bumps.
   *  Defaults to +1 to each listed ability (the always-valid even
   *  split per SRD 5.2). */
  abilityScoreBumps?: Partial<Record<Ability, number>>;
  /** Per-level HP rolls, in roll order (index 0 = L1). Missing
   *  entries are averaged from the class hit die. */
  hpRolled?: number[];
  equipment: {
    armorId?: string;
    shieldId?: string;
    weaponIds: string[];
    otherItemIds?: string[];
  };
  proficiencies?: {
    skills?: SkillId[];
    tools?: string[];
    languages?: string[];
    saves?: Ability[];
    expertise?: SkillId[];
  };
  feats?: OriginFeatRef[];
  conditions?: (ConditionRecord | ConditionName)[];
  exhaustion?: number;
  spells?: {
    known?: string[];
    prepared?: string[];
    slots?: Array<{ level: number; used: number; max: number }>;
  };
  xp?: number;
  notes?: string;
}

/** One attack line in a derived sheet — one entry per equipped
 *  weapon. The host renders these as the "attacks" row of the sheet. */
export interface DerivedAttack {
  weaponId: string;
  name: string;
  attackBonus: number;
  damageDice: string;
  damageMod: number;
  damageType?: string;
  masteryProperty?: MasteryName;
  properties?: string[];
}

/** One save line. `proficient` is true when the class grants the
 *  ability (or `record.proficiencies.saves` adds it). */
export interface DerivedSave {
  mod: number;
  proficient: boolean;
}

/** One skill line. `expertise` doubles the proficiency portion
 *  (Rogue's Expertise, Bard's Expertise, etc.). */
export interface DerivedSkill {
  ability: Ability;
  mod: number;
  proficient: boolean;
  expertise: boolean;
  /** Present and `true` only on the `stealth` skill when the equipped
   *  armor imposes Stealth disadvantage per SRD (since v1.17.0). */
  disadvantage?: boolean;
}

/**
 * The frozen output of `deriveSheet`. Every numeric field that would
 * appear on a paper sheet is precomputed; AC and HP additionally
 * carry breakdowns so the UI can render "13 + 2 (shield)" without
 * re-deriving.
 */
export interface DerivedSheet {
  meta: {
    /** Versioned source tag so a serialised sheet declares its origin.
     *  Bumped when the schema breaks compatibility. */
    source: 'bag-of-holding/character@1';
    speciesId: string;
    classId: string;
    subclassId?: string;
    level: number;
  };
  abilityScores: {
    final: Record<Ability, number>;
    mod: Record<Ability, number>;
  };
  proficiencyBonus: number;
  hp: { max: number };
  ac: {
    value: number;
    breakdown: { armor: number; shield: number; dex: number; misc: number };
  };
  initiative: number;
  /** Walk speed and any species-granted alternate modes. The keys are
   *  open-ended so homebrew species can introduce burrow / fly / climb
   *  / swim without a schema bump. */
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  /** Range in feet for each vision type from the species effects map.
   *  `0` means the sense isn't granted; the host stamps the same shape
   *  onto any actor for `Movement.visionMode` to read. */
  senses: { darkvision: number; blindsight: number; truesight: number };
  /** Damage resistances granted by species (Dwarven poison, Tiefling
   *  fire). Host-readable list the damage pipeline (`Combat.applyDamage`)
   *  picks up directly off an actor. */
  damageResistances: string[];
  /** Flat boolean flags for trait-driven hook handlers. Empty for a
   *  species with no flag-bearing traits. */
  traitFlags: Record<string, boolean>;
  saves: Record<Ability, DerivedSave>;
  skills: Record<SkillId, DerivedSkill>;
  attacks: DerivedAttack[];
  /** `null` for non-casters so the UI can discriminate without a
   *  `hasOwnProperty` check. */
  spellcasting: null | {
    ability: Ability;
    attackBonus: number;
    saveDC: number;
  };
  passives: { perception: number; insight: number; investigation: number };
  carryingCapacity: { capacity: number; push: number; lift: number };
  activeEffects: {
    conditions: (ConditionRecord | ConditionName)[];
    exhaustion: number;
  };
}

/**
 * The subset of an engine that `deriveSheet` consults — content
 * registries plus the resolved XP table for proficiency-by-level
 * lookups. Passing this view (rather than the whole engine) keeps
 * the module-level `Character.deriveSheet` testable without
 * constructing a full engine and avoids the circular dependency
 * `engine → character → engine` would otherwise create.
 */
export interface CharacterRegistries {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  items: Record<string, Item>;
  XP: XPNamespace;
}

export interface CharacterNamespace {
  deriveSheet(record: CharacterRecord, registries: CharacterRegistries): DerivedSheet;
  /** The 18 SRD 5.2 skills with their governing abilities. Exported
   *  so hosts can render skill UIs without duplicating the table. */
  readonly SKILL_ABILITY: Readonly<Record<SkillId, Ability>>;
  /** Encumbrance level per SRD 5.2 variant rule (since v1.17.0).
   *  @param str        The character's STR score (final, after bumps).
   *  @param weightLbs  Total carried weight in pounds. */
  encumbranceLevel(str: number, weightLbs: number): 'none' | 'encumbered' | 'heavily-encumbered';
}

// ============================================================
// Engine factory
// ============================================================

/**
 * Plugin Phase B knobs. Every field is optional; defaults preserve
 * SRD 5.2 behaviour exactly. The merged frozen result lives on
 * `engine.rules`.
 */
export interface EngineRules {
  /** d20 faces that count as critical hits. Default `[20]`.
   *  Pathfinder-style: `[19, 20]`. Champion's Improved Critical
   *  (Fighter L3 subclass feature): `[19, 20]` for that engine. */
  critOn?: number[];
  /** d20 faces that count as fumbles. Default `[1]`. */
  fumbleOn?: number[];
  /** Minimum damage on a successful hit. Default `1`. Set to `0`
   *  in packs where negative modifiers can fully cancel a hit. */
  damageFloor?: number;
  /** When true, every damage die that rolls max triggers another
   *  roll of the same die. Default `false`. */
  explodingDamageDice?: boolean;
  /** Override map of `level → XP threshold`. `null` (or omitted)
   *  uses the SRD 5.2 table. */
  xpThresholds?: Record<number, number> | null;
  /** Override map of `level → proficiency bonus`. `null` (or
   *  omitted) uses the SRD 5.2 table. */
  proficiencyByLevel?: Record<number, number> | null;
  /** DC of a death saving throw. SRD 5.2 default `10`. Heroic packs
   *  lower it; gritty packs raise it. */
  deathSaveDC?: number;
  /** Successes / failures required to stabilise or die. SRD 5.2
   *  default `3`. */
  deathSaveSuccessesRequired?: number;
  /** Hit Dice recovered on a Long Rest. `'half'` matches SRD 5.2 §
   *  Long Rest (default); `'all'` for heroic packs; `'none'` for
   *  gritty packs (DMG Slow Natural Healing). */
  longRestHitDiceRecovery?: 'half' | 'all' | 'none';
}

/** Resolved (frozen, defaults-merged) rules surface exposed on an
 *  engine instance. Same shape as `EngineRules` but every field is
 *  guaranteed present. */
export interface ResolvedRules {
  critOn: readonly number[];
  fumbleOn: readonly number[];
  damageFloor: number;
  explodingDamageDice: boolean;
  xpThresholds: Readonly<Record<number, number>> | null;
  proficiencyByLevel: Readonly<Record<number, number>> | null;
  deathSaveDC: number;
  deathSaveSuccessesRequired: number;
  longRestHitDiceRecovery: 'half' | 'all' | 'none';
}

/**
 * Plugin Phase C hook events. The five-name set is closed; plugins
 * register handlers under these keys via `createEngine({ hooks })`.
 */
export type HookEvent =
  | 'beforeAttack'
  | 'afterDamage'
  | 'onLevelUp'
  | 'onConditionApplied'
  | 'onDeath'
  | 'onTurnStart'
  | 'onTurnEnd'
  | 'onLongRest'
  | 'onShortRest'
  | 'onCast'
  | 'onDamageApplied'
  | 'onHpChanged';

/** Frozen canonical list of hook event names. */
export const HOOK_EVENTS: readonly HookEvent[];

/**
 * Hook handler signature. Handlers receive a payload (the args being
 * resolved, plus any merged deltas from earlier handlers) and return
 * either `undefined` (no change) or a partial delta object that's
 * `Object.assign`-merged into the payload before the next handler.
 *
 * Setting `cancelled: true` short-circuits the remaining handlers and
 * surfaces on the final payload — for `beforeAttack` this means the
 * attack resolves as a miss without rolling.
 */
export type HookHandler = (payload: Record<string, unknown>) =>
  Record<string, unknown> | void;

/** Registry exposed on `engine.hooks`. Read-only — handler
 *  registration happens via `createEngine({ hooks })`. */
export interface HookRegistry {
  readonly EVENTS: readonly HookEvent[];
  count(event: HookEvent): number;
  fire(event: HookEvent, payload: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Map of `event → handler` (or `event → handler[]` for multiple
 * handlers). Handlers fire in registration order; later handlers
 * see the merged payload from earlier ones.
 */
export type HooksOption = Partial<Record<HookEvent, HookHandler | HookHandler[]>>;

export interface EngineOptions {
  extraSpecies?: Record<string, Species>;
  extraClasses?: Record<string, ClassDef>;
  extraBackgrounds?: Record<string, Background>;
  extraFeats?: Record<string, Feat>;
  extraSpells?: Record<string, Spell>;
  extraItems?: Record<string, Item>;
  extraMonsters?: Record<string, Monster>;
  extraConditions?: string[];
  extraMastery?: Record<string, MasteryHandler>;
  /** Custom RNG. Default `Math.random`. Pass `Dice.seededRng(seed)`
   *  for replay-deterministic play. */
  rng?: RNG;
  /** Called with every roll entry immediately after it lands on
   *  `engine.rollLog`. Use for telemetry, live debug overlays, or
   *  piping rolls into Spektrum history. */
  onRoll?: (entry: RollEntry) => void;
  /** Drop-oldest cap on `engine.rollLog`. Default `Infinity`. The
   *  per-entry `index` is monotonic across the full session, so
   *  dropped-then-kept entries don't shift logical positions. */
  rollLogCap?: number;
  /** Plugin Phase B rule modifications. See `EngineRules`. */
  rules?: EngineRules;
  /** Plugin Phase C behavioural hooks. See `HooksOption`. */
  hooks?: HooksOption;
}

/** One slot record on an actor's character sheet. `source: 'pact'`
 *  marks Warlock pact slots (short-rest refresh). */
export interface SpellSlot {
  level: number;
  used: number;
  max: number;
  source?: 'pact' | string;
}

/** Active concentration: one spell at a time per caster. */
export interface ConcentrationState {
  spellId: string;
  level: number;
}

export interface SpellcastingNamespace {
  fullCasterSlots(casterLevel: number, spellLevel: number): number;
  halfCasterSlots(casterLevel: number, spellLevel: number): number;
  warlockPactSlots(casterLevel: number): { count: number; level: number };
  freshSlots(progression: CasterProgression, casterLevel: number): SpellSlot[];
  consumeSlot(slots: SpellSlot[], level: number):
    | { ok: true; slots: SpellSlot[]; levelCast: number }
    | { ok: false; reason: string };
  refundSlot(slots: SpellSlot[], level: number): SpellSlot[];
  longRest(slots: SpellSlot[]): SpellSlot[];
  shortRest(slots: SpellSlot[]): SpellSlot[];
  startConcentration(
    actor: Actor,
    spell: ConcentrationState
  ): { actor: Actor; dropped: ConcentrationState | null };
  concentrationSaveDC(damageTaken: number): number;
  endConcentration(actor: Actor): Actor;
  cantripTier(casterLevel: number): 1 | 2 | 3 | 4;
  scaledDamageSpec(baseSpec: string, casterLevel: number): string;
  preparedSpellCount(args: {
    casterLevel: number;
    abilityMod: number;
    progression?: CasterProgression;
  }): number;
  validatePreparation(args: {
    known: string[];
    prepared: string[];
    casterLevel: number;
    abilityMod: number;
    progression: CasterProgression;
  }): { valid: true } | { valid: false; reason: string };
}

/** Rest namespace (since 1.2.0). SRD 5.2 § Short Rest / § Long Rest.
 *  `spendHitDie` is engine-bound (its die roll flows into rollLog
 *  for replay-determinism); `longRest` and `shortRest` are
 *  deterministic. */
export interface RestNamespace {
  /** Roll one Hit Die + the actor's Constitution modifier (min 1)
   *  and apply it as healing, capped at `hpMax`. Decrements
   *  `hitDiceUsed`. */
  spendHitDie(actor: Actor, context?: unknown): {
    die?: number;
    conMod?: number;
    healed: number;
    hpAfter: number;
    actor: Actor;
  };
  /** Apply one Long Rest: HP to max, half Hit Dice back (per the
   *  `longRestHitDiceRecovery` rule), death-save tracker cleared,
   *  Exhaustion -1, spell slots refilled, class resources reset. */
  longRest(actor: Actor): Actor;
  /** Apply one Short Rest: warlock pact slots refill, short-tagged
   *  class resources refill. Hit Dice spending is host-driven and
   *  uses `spendHitDie` separately. */
  shortRest(actor: Actor): Actor;
}

/** Mechanics namespace (since 1.3.0). Resource bookkeeping and
 *  per-class feature dispatch. SRD 5.2 § Classes. */
export interface MechanicsNamespace {
  readonly REFRESH_KINDS: readonly RefreshKind[];
  /** Build a single resource counter at full capacity. */
  freshResource(spec: { max: number; refreshes: RefreshKind }): Resource;
  /** Build the full resource map for an actor of `classDef` at
   *  `level`. Returns `{}` for classes without a resources table. */
  freshResources(classDef: ClassDef | null | undefined, level: number): Record<string, Resource>;
  /** Spend `amount` from `actor.resources[id]`. */
  spendResource(actor: Actor, id: string, amount?: number):
    | { ok: true; actor: Actor }
    | { ok: false; reason: string };
  /** Refresh every counter matching `kind`. Long Rest refreshes
   *  both short- and long-tagged resources; `'all'` also resets
   *  day-tagged. */
  refreshResources(actor: Actor, kind: 'short' | 'long' | 'all'): Actor;
  /** Dispatch a class mechanic by id. Looks up the actor's class
   *  from the engine's registry. */
  apply(actor: Actor, id: string, args?: Record<string, unknown>, context?: unknown): unknown;
}

// ============================================================
// Solo mode (since 2.0.0)
// ============================================================

/** The six oracle outcome labels. */
export type OracleOutcome =
  | 'exceptional-no' | 'no' | 'no-but'
  | 'yes-but' | 'yes' | 'exceptional-yes';

/** Built-in odds bands. Numbers in [0, 100] are also accepted as
 *  raw probabilities for one-off questions. */
export type OracleOdds =
  | 'certain' | 'near-certain' | 'very-likely' | 'likely'
  | 'fifty-fifty' | 'unlikely' | 'very-unlikely'
  | 'near-impossible' | 'impossible'
  | number;

export interface OracleAnswer {
  question: string;
  odds: OracleOdds;
  threshold: number;
  d100: number;
  outcome: OracleOutcome;
}

export interface OracleEntry {
  id: string;
  text: string;
  weight?: number;
  [extra: string]: unknown;
}

export interface Oracle {
  ask(question: string, odds?: OracleOdds): OracleAnswer;
  twist(): { id: string; text: string };
  complication(): { id: string; text: string };
  pick<T extends { weight?: number }>(table: T[]): T;
  readonly ODDS_BANDS: readonly string[];
  readonly OUTCOMES: readonly OracleOutcome[];
}

export interface SoloNamespace {
  /** Build a solo-play oracle. Without opts, binds to the engine's
   *  rng (so oracle answers replay deterministically alongside dice). */
  oracle(opts?: {
    rng?: RNG;
    twists?: OracleEntry[];
    complications?: OracleEntry[];
  }): Oracle;
  readonly ODDS_BANDS: readonly string[];
  readonly OUTCOMES: readonly OracleOutcome[];
}

export interface SessionParticipant extends Participant {
  hp?: number;
  hpMax?: number;
  ac?: number;
  name?: string;
  conditions?: ConditionName[];
}

export interface SessionCreateOptions {
  engine?: Engine;
  party: CharacterRecord[];
  encounter?: { participants: SessionParticipant[] } | EncounterState;
  scene?: Scene;
  seed?: number;
  log?: SessionLogEntry[];
  oracle?: Oracle;
}

export interface SessionLogEntry {
  seq: number;
  kind: string;
  [extra: string]: unknown;
}

/**
 * Volatile per-actor state captured by `Session.snapshot()` and
 * `Session.serialize()`. Open-ended on purpose — homebrew packs
 * stamp their own fields onto actors (e.g. Bardic Inspiration die
 * size, Wild Shape form id) and the snapshot round-trips them
 * verbatim. The listed fields are the SRD-canonical core that the
 * shipped engine writes to.
 */
export interface SessionPartySnapshot {
  id: string;
  hp: number;
  hpMax: number;
  tempHp: number;
  ac: number;
  conditions: ConditionName[];
  hitDiceUsed: number;
  hitDiceTotal: number;
  exhaustion?: number;
  resources?: Record<string, Resource>;
  spellSlots?: SpellSlot[];
  deathSaves?: DeathSaveTracker;
  timers?: ActorTimer[];
  concentration?: ConcentrationState | null;
  [extra: string]: unknown;
}

export interface SessionSnapshot {
  party: SessionPartySnapshot[];
  scene: Scene;
  encounter: EncounterState | null;
  log: SessionLogEntry[];
}

export interface SerialisedSession {
  version: 'bag-of-holding/session@1';
  seed: number | null;
  rulesFingerprint: string;
  partyRecords: CharacterRecord[];
  partyState: SessionPartySnapshot[];
  scene: Scene;
  encounter: EncounterState | null;
  log: SessionLogEntry[];
}

export interface SessionAttackArgs {
  attackerId: string;
  targetId?: string;
  attackBonus: number;
  damageDice?: string;
  damageMod?: number;
  damageType?: string;
  ac?: number;
}

export interface Session {
  readonly engine: Engine;
  readonly seed: number | null;
  readonly oracle: Oracle | null;
  readonly scene: Scene;
  readonly encounter: EncounterState | null;
  readonly log: SessionLogEntry[];
  party(): CharacterRecord[];
  actor(id: string): Actor;
  currentActor(): Actor | null;
  startEncounter(participants: SessionParticipant[]): EncounterState;
  endTurn(): { finished: boolean };
  endEncounter(): void;
  shortRest(): void;
  longRest(): void;
  advanceTime(delta: { rounds?: number; minutes?: number; hours?: number; days?: number }):
    { scene: Scene; events: ('dawn' | 'dusk')[] };
  attack(args: SessionAttackArgs): { attack: AttackRollResult; damage: DamageResult | null };
  applyDamage(targetId: string, args: { amount: number; type?: string; critical?: boolean; source?: unknown }): DamageResult;
  heal(targetId: string, amount: number): { healed: number; hpBefore: number; hpAfter: number; actor: Actor };
  applyCondition(targetId: string, condition: ConditionName): Actor;
  removeCondition(targetId: string, condition: ConditionName): Actor;
  record(kind: string, payload?: Record<string, unknown>): SessionLogEntry;
  snapshot(): SessionSnapshot;
  serialize(): SerialisedSession;
}

export interface SessionNamespace {
  create(opts: SessionCreateOptions): Session;
  restore(payload: SerialisedSession, engine?: Engine): Session;
}

export interface SharedReplay {
  version: 'bag-of-holding/replay@1';
  seed: number | null;
  rulesFingerprint: string;
  partyRecords: CharacterRecord[];
  rollLog: RollEntry[];
  log?: SessionLogEntry[];
}

export interface ReplayNamespace {
  share(session: Session, opts?: { includeLog?: boolean }): SharedReplay;
  verify(payload: SharedReplay, engine?: Engine): VerifyLogResult;
}

/** Four pre-built L3 characters baked in for the solo CLI / browser
 *  sandbox. Fighter (dwarf), Rogue (halfling), Cleric (human),
 *  Wizard (elf). Shape matches `CharacterRecord`. */
export const STARTER_PARTY: readonly CharacterRecord[];

export interface Engine {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
  monsters: Record<string, Monster>;
  Dice: DiceNamespace;
  Checks: ChecksNamespace;
  Combat: CombatNamespace;
  Conditions: ConditionsNamespace;
  XP: XPNamespace;
  Movesets: MovesetsNamespace;
  Beats: BeatsNamespace;
  Spellcasting: SpellcastingNamespace;
  Rest: RestNamespace;
  Mechanics: MechanicsNamespace;
  SceneClock: SceneClockNamespace;
  /** Compute a frozen derived sheet from a host-owned character
   *  record. Pure — call as often as state changes. See
   *  docs/character-sheet.md. */
  deriveSheet(record: CharacterRecord): DerivedSheet;
  /** Append-only log of every roll the engine has produced this
   *  session. Plain JSON — serialise it, attach it to bug reports,
   *  feed it to `verifyLog` to confirm reproducibility. */
  rollLog: RollEntry[];
  /** Replay-verify a roll log. Equivalent to the module-level
   *  `verifyLog` export; lives on the engine for ergonomics. */
  verifyLog(args: VerifyLogArgs): VerifyLogResult;
  /** Frozen, defaults-merged rules object for this engine. Exposed
   *  so hosts can introspect "which pack is loaded?" (UI badge,
   *  debug overlay, telemetry). */
  rules: ResolvedRules;
  /** Hook registry. Read-only; register handlers at engine
   *  construction via `createEngine({ hooks })`. */
  hooks: HookRegistry;
  /** Solo-play oracle factory (since 2.0.0). Bound to the engine
   *  rng so oracle answers are part of the seeded replay stream. */
  Solo: SoloNamespace;
  /** Session orchestrator (since 2.0.0). The `engine` arg defaults
   *  to this engine on the bound version. */
  Session: SessionNamespace;
  /** Replay-sharing helpers (since 2.0.0). `verify` defaults to
   *  this engine on the bound version. */
  Replay: ReplayNamespace;
}

export function createEngine(opts?: EngineOptions): Engine;

// ============================================================
// Default singleton + spread named exports
// ============================================================

declare const defaultEngine: Engine;
export default defaultEngine;

export const Dice: DiceNamespace;
export const Checks: ChecksNamespace;
export const Combat: CombatNamespace;
export const Conditions: ConditionsNamespace;
export const XP: XPNamespace;
export const Movesets: MovesetsNamespace;
export const Beats: BeatsNamespace;
export const Spellcasting: SpellcastingNamespace;
export const Rest: RestNamespace;
export const Mechanics: MechanicsNamespace;
export const SceneClock: SceneClockNamespace;
export const Character: CharacterNamespace;
export const Solo: SoloNamespace;
export const Session: SessionNamespace;
export const Replay: ReplayNamespace;

export const species: Record<string, Species>;
export const classes: Record<string, ClassDef>;
export const backgrounds: Record<string, Background>;
export const feats: Record<string, Feat>;
export const spells: Record<string, Spell>;
export const items: Record<string, Item>;
export const monsters: Record<string, Monster>;

/** Grouped data registries — convenience alias matching the
 *  pre-Phase-A namespace shape. */
export const SRD: {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
  monsters: Record<string, Monster>;
};

/** Legacy alias for the class-definition map. Same content as
 *  `classes`, kept for back-compat with pre-Phase-A consumers. */
export const Classes: Record<string, ClassDef>;
