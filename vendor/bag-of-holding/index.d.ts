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
 * Full condition record shape (since v1.6.1). Hosts can apply a plain
 * string for simple boolean conditions, or a record to attach save
 * metadata. The engine normalises string `apply` calls to `{ name }`
 * internally; `actor.conditions` always contains records at runtime.
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
    /** Racial cantrip as DATA (since 2.13.0): a spell id the host
     *  grants at creation. The engine validates the reference, the
     *  host owns the grant. */
    cantripId?: string;
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
  /** Feat prerequisite (since 2.13.0): same `abilityMin` shape items
   *  use, plus `spellcaster` and the epic boons' `levelMin: 19`. */
  prerequisite?: { abilityMin?: Partial<Record<Ability, number>>; spellcaster?: boolean; levelMin?: number };
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
  // Descriptive fields the data records carry (typed since 2.10.0; the
  // SRD records have shipped them since 1.8).
  damageType?: string;
  concentration?: boolean;
  ritual?: boolean;
  bonusAction?: boolean;
  range?: string;
  duration?: string;
  area?: string;
  components?: { v?: boolean; s?: boolean; m?: boolean | { cost?: number } };
  /** True when a successful save halves the damage instead of negating it. */
  halfOnSave?: boolean;
  /** Per-slot upcast delta; consumed by `Spellcasting.castSpell` (the 1.8
   *  contract; Grimoire I is the first shipped data to carry one). */
  upcast?: (castLevel: number) => Record<string, unknown>;
  /** Which classes have this spell on their list — pack data (since
   *  2.10.0). SRD spells answer this via `classesFor` instead. */
  classes?: string[];
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
  // Encumbrance weight in pounds (gear and most physical items).
  weight?: number;
  // === Magic-item lifecycle fields (since 1.9.0; first declared 2.6.0 —
  // src/magic-items.js and srd/items.js used them undeclared).
  // NB: the band is `veryRare` — RARITY_BANDS in src/magic-items.js is
  // the source of truth (this union said 'very-rare' until 2.12.0).
  rarity?: 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary' | 'artifact' | string;
  /** True when attunement is required at all (the 3-slot cap applies). */
  attunement?: boolean;
  /** Attunement prerequisites checked by `MagicItems.canAttune`. */
  requiresAttunement?: { classId?: string; spellcaster?: boolean; abilityMin?: Partial<Record<Ability, number>> };
  /** Charge pool spec: `spendCharge` draws it down, `rechargeItem` recovers
   *  (a string is an `XdY+Z` die spec; a number is a flat recovery). */
  charges?: { max: number; recovers?: string | number; rechargesOn?: 'dawn' | 'dusk' | 'longRest' | 'shortRest' };
  /** Cursed items refuse voluntary un-attunement without Remove Curse. */
  cursed?: boolean | { effect?: string };
  /** Forced-destruction resilience consumed by `itemSavingThrow`. */
  savingThrow?: { bonus?: number };
  /** Sentient-item ego as pack DATA (since 2.12.0): the host drives the
   *  conflict as an ordinary Charisma contest against `conflictDc`; the
   *  engine deliberately has no sentience mechanic. */
  sentient?: { intelligence?: number; wisdom?: number; charisma?: number; purpose?: string; conflictDc?: number };
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
  // === 1.10 stat-block depth (first declared 2.6.0 — the consumers in
  // src/monsters.js read these; the Quiet Stair pack is the first
  // authored data to carry them).
  /** Sense ranges in feet, keyed by sense name (darkvision, blindsight, tremorsense…). */
  senses?: Record<string, number>;
  /** Trained saving-throw bonuses; `Monsters.saveBonus` falls back to the bare mod. */
  saves?: Partial<Record<Ability, number>>;
  /** Multiattack routine; each entry's `attackRef` indexes into `attacks`. */
  multiattack?: { attacks: Array<{ name: string; attackRef: number | string }> };
  flySpeed?: number;
  damageImmunities?: string[];
  damageResistances?: string[];
  damageVulnerabilities?: string[];
  conditionImmunities?: string[];
  languages?: string[];
  // === Boss-tier 1.10 blocks (first authored data: Bestiary II, 2.8.0).
  /** Legendary Action pool + options; consumed by `Monsters.useLegendaryAction`. */
  legendaryActions?: { uses?: number; options: Array<{ id: string; name: string; cost?: number; attackRef?: number | string }> };
  /** Legendary Resistance pool; consumed by `Monsters.useLegendaryResistance`. */
  legendaryResistance?: { uses?: number };
  /** Lair actions fire at initiative 20 while `inLair`; see `Monsters.fireLairAction`. */
  lairActions?: { triggersOnInitiative?: number; options: Array<{ id: string; name: string }> };
  /** Innate spell lists (SRD spell ids); consumed by `Monsters.castInnate`. */
  innateSpellcasting?: { atWill?: string[]; '3day'?: string[]; '1day'?: string[] };
  /** Mythic second-phase pool (since 2.9.0): sealed until the host fires
   *  its trigger; see `Monsters.activateMythic` / `useMythicAction`. */
  mythicActions?: { trigger?: string; uses?: number; options: Array<{ id: string; name: string; cost?: number; attackRef?: number | string }> };
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
  /** Apply a condition. Pass a plain string for a simple boolean condition
   *  (idempotent, set semantics) or a `ConditionRecord` to attach save
   *  metadata for save-at-turn-end/start enforcement (append semantics,
   *  allows multiple sources). */
  apply(actor: Actor, condition: ConditionName | ConditionRecord): Actor;
  /** Remove all entries with the given condition name. */
  remove(actor: Actor, condition: ConditionName | ConditionRecord): Actor;
  /** Extract the condition name from a string or record entry. */
  conditionName(entry: ConditionName | ConditionRecord): ConditionName;
  /** Return entries that carry save metadata matching `timing`. Used
   *  internally by `turnEnd` / `turnStart`; also useful for host UI. */
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
  /** HP recovered on a Long Rest (since 2.15.0). `'none'` = Slow
   *  Natural Healing: no free hp, heal by spending Hit Dice. */
  longRestHpRecovery?: 'full' | 'none';
  /** Healer's Kit Dependency (since 2.15.0): Hit Dice require
   *  `actor.healersKitTended` first. Default `false`. */
  hitDiceRequireHealersKit?: boolean;
  /** Rest pacing (since 2.15.0). `'gritty'` = 8-hour short rest,
   *  week-long long rest. Consumed by `Rest.restDurations`. */
  restDurationScale?: 'standard' | 'gritty';
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
  /** Long-rest HP recovery (since 2.15.0): 'none' = Slow Natural
   *  Healing — no free hp, heal by spending Hit Dice. */
  longRestHpRecovery: 'full' | 'none';
  /** Healer's Kit Dependency variant (since 2.15.0): Hit Dice need
   *  `actor.healersKitTended` first. */
  hitDiceRequireHealersKit: boolean;
  /** Rest pacing (since 2.15.0): 'gritty' = 8-hour short / week-long
   *  long. Consumed by `Rest.restDurations`. */
  restDurationScale: 'standard' | 'gritty';
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
  /** Phase A.2 class grafts (typed since 3.1.0; shipped since 1.3.0):
   *  per-class mechanic handlers merged onto existing class defs. */
  extraMechanics?: Record<string, Record<string, (actor: Actor, args?: Record<string, unknown>) => unknown>>;
  /** Phase A.2 class resource pools; each spec declares `refreshes`. */
  extraResources?: Record<string, Record<string, { max: number | ((level: number, actor?: Actor) => number); refreshes: string }>>;
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
  // Setting-pack slots (since 3.0.0). Empty registries by default — the
  // kernel ships no world of its own; setting packs fill them.
  extraRegions?: Record<string, Region>;
  extraNpcs?: Record<string, SettingNpc>;
  extraStoryHooks?: Record<string, StoryHook>;
  extraAdventures?: Record<string, AdventurePack>;
  /** Locale packs (since 3.4.0): lang → key → translated string.
   *  Bound as `engine.Strings`. */
  extraLocales?: Record<string, Record<string, string>>;
}

/** A setting region (since 3.0.0). `id` + `name` are the registry
 *  contract; everything else is pack vocabulary. */
export interface Region {
  id: string;
  name: string;
  biome?: string;
  summary?: string;
  cities?: readonly string[];
  dangers?: readonly string[];
}

/** A setting NPC (since 3.0.0): the AdventureNpc shape plus the
 *  setting's binding fields. The 2.6.0 "no kernel NPC registry"
 *  decision is revised here — the registry holds the cast; the Beats
 *  casting boundary itself stands. */
export interface SettingNpc extends AdventureNpc {
  factionId?: string;
  cityId?: string | null;
}

/** A story hook (since 3.0.0): a place, a faction pressure, a payout,
 *  and optionally the adventure it opens. */
export interface StoryHook {
  id: string;
  title: string;
  cityId?: string;
  factionId?: string;
  pitch?: string;
  reward?: string;
  adventureId?: string;
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
    /** Present on a healer's-kit refusal (since 2.15.0). */
    reason?: string;
  };
  /** Rest durations in hours under this engine's rules (since
   *  2.15.0): standard 1/8, gritty 8/168. The engine keeps no
   *  clock — this is the query the host schedules by. */
  restDurations(): { shortRestHours: number; longRestHours: number };
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

/** A grid square in host-supplied coordinates (the engine keeps no
 *  positional model — see movement.js). */
export interface GridPos { x: number; y: number }

/** Variant combat rules (since 2.14.0): six opt-in table variants.
 *  Pure helpers — the host feeds results back through the existing
 *  surfaces (attackRoll's advantage flag, Conditions.apply,
 *  applyDamage). On the engine-bound version the roll helpers ride
 *  the engine rng (recorded as rngDraws for replay). */
export interface VariantCombatNamespace {
  isFlanking(args: { attacker: GridPos; ally: GridPos; target: GridPos }): boolean;
  CALLED_SHOT_LOCATIONS: Readonly<Record<string, { id: string; name: string; attackPenalty: number; onHit: Readonly<Record<string, unknown>> }>>;
  calledShot(location: string):
    | { ok: true; attackPenalty: number; onHit: Readonly<Record<string, unknown>> }
    | { ok: false; reason: string };
  LINGERING_INJURIES: ReadonlyArray<{ range: readonly number[]; id: string; name: string; effect: string; healedBy: string }>;
  rollLingeringInjury(rng?: () => number): { d20: number; injury: { id: string; name: string; effect: string } };
  SYSTEM_SHOCK: ReadonlyArray<{ range: readonly number[]; id: string; effect: string }>;
  massiveDamageCheck(args: { amount: number; hpMax: number }, rng?: () => number):
    | { triggered: false }
    | { triggered: true; saveDC: number; saveAbility: Ability; onFail: { d10: number; shock: { id: string; effect: string } } };
  cleaveCarryover(args: { damage: number; targetHp: number }): { killed: boolean; carryover: number };
  FUMBLE_EFFECTS: ReadonlyArray<{ range: readonly number[]; id: string; effect: string }>;
  rollFumbleEffect(rng?: () => number): { d6: number; fumble: { id: string; effect: string } };
}

/** Variant rest + downtime (since 2.15.0): the opt-in sanity track
 *  (an actor with `sanity: 3..18` faces d20 + mod checks and loss;
 *  0 breaks the mind — a state, not a death) and the exhaustion-on-
 *  failure stake. Actors without a sanity field are untouched. */
export interface VariantRestNamespace {
  sanityCheck(actor: Actor, args?: { dc?: number; advantage?: boolean; disadvantage?: boolean }, rng?: () => number):
    | { ok: true; d20: number; mod: number; total: number; dc: number; success: boolean; stance: string }
    | { ok: false; reason: string };
  applySanityLoss(actor: Actor, amount: number):
    | { ok: true; actor: Actor; lost: number }
    | { ok: false; reason: string };
  restoreSanity(actor: Actor, amount: number):
    | { ok: true; actor: Actor; restored: number }
    | { ok: false; reason: string };
  exhaustionOnFailure(actor: Actor, checkResult: { success?: boolean }, levels?: number): { applied: boolean; actor: Actor };
}

/** Variant encounter + skills (since 2.16.0): side/group initiative
 *  (strict orders, ties rerolled), honor/piety/renown scalar tracks
 *  with rank ladders, background-as-proficiency (the verdict feeds
 *  Checks.abilityCheck's existing `proficient` flag), and the six
 *  broad skill groups that partition the 18 SRD skills. */
export interface VariantEncounterNamespace {
  sideInitiative(sideIds: string[], rng?: () => number):
    | { ok: true; order: Array<{ side: string; d20: number }> }
    | { ok: false; reason: string };
  groupInitiative(groups: Array<{ id: string; dexterity?: number }>, rng?: () => number):
    | { ok: true; order: Array<{ group: string; initiative: number; d20: number; mod: number }> }
    | { ok: false; reason: string };
  TRACK_PRESETS: Readonly<Record<string, { min: number; max: number; start: number }>>;
  adjustTrack(actor: Actor, trackId: string, delta: number, band?: { min: number; max: number; start?: number }):
    { actor: Actor; value: number; changed: number };
  trackValue(actor: Actor, trackId: string, band?: { start?: number }): number;
  rankFor(value: number, ranks: ReadonlyArray<{ at: number; name: string }>): { at: number; name: string } | null;
  RENOWN_RANKS: ReadonlyArray<{ at: number; name: string }>;
  backgroundApplies(background: Background | undefined, skillId: string): boolean;
  SKILL_GROUPS: Readonly<Record<string, readonly string[]>>;
  groupFor(skillId: string): string | null;
}

export interface Engine {
  /** Variant combat rules (since 2.14.0). */
  VariantCombat: VariantCombatNamespace;
  /** Variant rest + downtime (since 2.15.0). */
  VariantRest: VariantRestNamespace;
  /** Variant encounter + skills (since 2.16.0). */
  VariantEncounter: VariantEncounterNamespace;
  // Setting-pack registries (since 3.0.0) — empty unless a setting pack
  // fills them via the extra* options.
  regions: Record<string, Region>;
  npcs: Record<string, SettingNpc>;
  storyHooks: Record<string, StoryHook>;
  adventures: Record<string, AdventurePack>;
  /** Localization shim (since 3.4.0), bound over `extraLocales`. */
  Strings: StringsNamespace;
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
export const VariantCombat: VariantCombatNamespace;
export const VariantRest: VariantRestNamespace;
export const VariantEncounter: VariantEncounterNamespace;

export const species: Record<string, Species>;
export const regions: Record<string, Region>;
export const npcs: Record<string, SettingNpc>;
export const storyHooks: Record<string, StoryHook>;
export const adventures: Record<string, AdventurePack>;
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

// ============================================================
// Adventures — pack format + The Quiet Stair (since 2.6.0)
// ============================================================

/** A pack-scoped NPC: enough to cast Beats archetype slots and put a
 *  voice at the table. Deliberately NOT a kernel registry — the app
 *  owns the cast (see src/beats/casting.js). */
export interface AdventureNpc {
  id: string;
  name: string;
  archetypeRole: string;
  voice: string[];
  wants: string[];
  statBlockId?: string | null;
}

export interface AdventureScene {
  id: string;
  title: string;
  beatId?: string | null;
  readAloud?: string;
  cast?: string[];
  objectives?: Array<{ flag: string; description: string }>;
  encounter?: {
    monsters: Array<{ id: string; count?: number }>;
    intendedDifficulty?: 'trivial' | 'low' | 'moderate' | 'high' | 'deadly';
  };
  treasure?: Array<string | { coins: Record<string, number> }>;
  exits?: Array<{ to: string; label?: string; requiresFlag?: string }>;
}

/** An adventure pack: metadata + beats the Beats runtime drives +
 *  scenes bound to the flags those beats raise. Plain JSON data. */
export interface AdventurePack {
  id: string;
  title: string;
  estimatedMinutes?: number;
  partyProfile: { size: number; levels: number[] };
  start: string;
  beats: Beat[];
  scenes: AdventureScene[];
  npcs: Readonly<Record<string, AdventureNpc>>;
}

/** Run state: the Beats thread + flags + where the party stands.
 *  Plain data; JSON round-trips. */
export interface AdventureRun {
  adventureId: string;
  thread: Thread;
  flags: Record<string, boolean>;
  sceneId: string;
}

export interface AdventuresNamespace {
  /** Cross-check every reference in a pack against the registries it
   *  will be mounted with. `{ valid, errors[] }` — all problems at once. */
  validateAdventure(pack: AdventurePack, registries: {
    monsters?: Record<string, Monster>; items?: Record<string, Item>;
  }): { valid: boolean; errors: string[] };
  createRun(adventure: AdventurePack): AdventureRun;
  /** Raise a flag; the thread advances as far as the new state carries it. */
  setFlag(run: AdventureRun, flag: string, opts?: {
    chooseSuccessor?: (args: {
      candidates: string[]; state: { flags: Record<string, boolean> }; currentBeat: Beat;
    }) => string;
  }): AdventureRun;
  currentScene(adventure: AdventurePack, run: AdventureRun): AdventureScene | null;
  activeBeat(run: AdventureRun): Beat | null;
  availableExits(adventure: AdventurePack, run: AdventureRun): NonNullable<AdventureScene['exits']>;
  goTo(adventure: AdventurePack, run: AdventureRun, sceneId: string):
    { run: AdventureRun; moved: boolean; reason?: string };
  /** Expand a scene's encounter into Session-adoptable participants. */
  encounterParticipants(scene: AdventureScene, monsters: Record<string, Monster>):
    Array<{ id: string; name: string; hp: number; hpMax: number; ac: number; dexterity: number; speed: number; side: 'foe'; statBlockId: string }>;
  /** An entityProvider over pack npcs, for Beats.castArchetypes. */
  entityProviderFrom(npcs: Readonly<Record<string, AdventureNpc>>):
    (slot: { role: string }) => AdventureNpc | undefined;
  QUIET_STAIR: AdventurePack;
  QUIET_STAIR_MONSTERS: Readonly<Record<string, Monster>>;
  QUIET_STAIR_ITEMS: Readonly<Record<string, Item>>;
  QUIET_STAIR_NPCS: Readonly<Record<string, AdventureNpc>>;
}

/** The adventure surface: pack format + run glue + shipped packs. Pure
 *  (not engine-bound), like STARTER_PARTY and elevate. */
export const Adventures: AdventuresNamespace;

/** The Quiet Stair — the starter adventure shipped inside the package. */
export const QUIET_STAIR: AdventurePack;
/** The starter adventure's invented bestiary (15 creatures, CR 0–4).
 *  Mount via `createEngine({ extraMonsters: QUIET_STAIR_MONSTERS })` —
 *  never merged into the SRD registry by default. */
export const QUIET_STAIR_MONSTERS: Readonly<Record<string, Monster>>;
/** The starter adventure's item batch (8 items — charged, cursed,
 *  consumable, attunement prereqs, forced-destruction save, mundane
 *  plot keys). Mount via `createEngine({ extraItems: QUIET_STAIR_ITEMS })`. */
export const QUIET_STAIR_ITEMS: Readonly<Record<string, Item>>;
/** The starter adventure's named cast (3 NPCs with voice + wants). */
export const QUIET_STAIR_NPCS: Readonly<Record<string, AdventureNpc>>;

// ============================================================
// Bestiary I (since 2.7.0)
// ============================================================

/** 50 invented creatures, CR 0–5, across the common ecology niches
 *  (warbands, beasts, undead, fey, elementals, oozes, constructs,
 *  plants, fiends, low dragons). Mount via
 *  `createEngine({ extraMonsters: BESTIARY_I })`. */
export const BESTIARY_I: Readonly<Record<string, Monster>>;
/** 30 boss-tier opponents, CR 6–15, with Legendary Actions, Lair
 *  Actions and Innate Spellcasting — the first authored data those
 *  1.10 systems run against. Mount via
 *  `createEngine({ extraMonsters: BESTIARY_II })`. */
export const BESTIARY_II: Readonly<Record<string, Monster>>;
/** 10 capstone monsters, CR 16–20, for tier-4 play: Legendary
 *  Resistance pools, Mythic Actions (second-phase pools, sealed until
 *  triggered), Innate Spellcasting at levels 6+. Mount via
 *  `createEngine({ extraMonsters: BESTIARY_III })`. */
export const BESTIARY_III: Readonly<Record<string, Monster>>;

/** 50 invented spells, cantrips through 5th: reaction casts,
 *  cylinder/line save-for-half AoEs, concentration buffs, single-target
 *  debuffs, ritual flags and `upcast()` deltas. Mount via
 *  `createEngine({ extraSpells: GRIMOIRE_I })`. */
export const GRIMOIRE_I: Readonly<Record<string, Spell>>;

/** 30 invented spells, 6th through 9th: city-sized AoEs, plane-shifting
 *  alternatives, complex multi-target control. Mount via
 *  `createEngine({ extraSpells: GRIMOIRE_II })`; composable with
 *  Grimoire I by spreading both into one map. */
export const GRIMOIRE_II: Readonly<Record<string, Spell>>;

/** 40 invented magic items across all six rarity bands: charges on all
 *  four recharge schedules, all three attunement-prereq kinds, cursed
 *  items, item saving throws, sentient blocks as host data. Mount via
 *  `createEngine({ extraItems: TREASURY })`. */
export const TREASURY: Readonly<Record<string, Item>>;

/** 5 invented species, each exercising a sheet-derived trait mechanic
 *  (deep darkvision, resistance, swim/climb/fly, racial cantrip).
 *  Mount via `createEngine({ extraSpecies: ORIGIN_SPECIES })`. */
export const ORIGIN_SPECIES: Readonly<Record<string, Species>>;
/** 8 invented backgrounds in the SRD 5.2 shape; their Origin Feats
 *  live in ORIGIN_FEATS. Mount via `extraBackgrounds`. */
export const ORIGIN_BACKGROUNDS: Readonly<Record<string, Background>>;
/** 12 invented feats: 6 origin, 4 general, 2 epic boons. Mount via
 *  `createEngine({ extraFeats: ORIGIN_FEATS })`. */
export const ORIGIN_FEATS: Readonly<Record<string, Feat>>;

// ============================================================
// Sundermark (3.0.0) — the first complete setting pack
// ============================================================

/** A Sundermark city: mapped, ruled, and hung with hooks. */
export interface SundermarkCity {
  id: string; name: string; regionId: string;
  size: string; ruler: string | null; hooks: readonly string[];
}
/** A Sundermark faction: its stance is its answer to the setting's
 *  question — what do you do with a dead god? */
export interface SundermarkFaction {
  id: string; name: string; stance: string; seat: string | null;
  wants: string; enemies: readonly string[];
}

/** The bundled pack: mount `regions`/`npcs`/`hooks`/`adventures`
 *  through the 3.0.0 setting slots and `species`/`backgrounds`/`feats`
 *  through the Phase-A slots. Factions and cities are pack data
 *  hosts consume directly. */
export const SUNDERMARK: Readonly<{
  id: string; name: string; pitch: string;
  regions: Readonly<Record<string, Region>>;
  cities: Readonly<Record<string, SundermarkCity>>;
  factions: Readonly<Record<string, SundermarkFaction>>;
  hooks: Readonly<Record<string, StoryHook>>;
  npcs: Readonly<Record<string, SettingNpc>>;
  species: Readonly<Record<string, Species>>;
  backgrounds: Readonly<Record<string, Background>>;
  feats: Readonly<Record<string, Feat>>;
  adventures: Readonly<Record<string, AdventurePack>>;
}>;
export const SUNDERMARK_REGIONS: Readonly<Record<string, Region>>;
export const SUNDERMARK_CITIES: Readonly<Record<string, SundermarkCity>>;
export const SUNDERMARK_FACTIONS: Readonly<Record<string, SundermarkFaction>>;
export const SUNDERMARK_HOOKS: Readonly<Record<string, StoryHook>>;
export const SUNDERMARK_NPCS: Readonly<Record<string, SettingNpc>>;
export const SUNDERMARK_SPECIES: Readonly<Record<string, Species>>;
export const SUNDERMARK_BACKGROUNDS: Readonly<Record<string, Background>>;
export const SUNDERMARK_FEATS: Readonly<Record<string, Feat>>;
export const SUNDERMARK_ADVENTURES: Readonly<Record<string, AdventurePack>>;
/** The Singing Tower — starter adventure (~75 min, 4 × L3). */
export const THE_SINGING_TOWER: AdventurePack;
/** Halberd's Edge — starter adventure (~75 min, 4 × L3). */
export const HALBERDS_EDGE: AdventurePack;

// ============================================================
// Brassgear (3.1.0) — the second setting pack
// ============================================================

/** An inherited talent — Brassgear's dragonmark equivalent. The host
 *  stamps `talentId` on an actor and reads the grants. */
export interface BrassgearTalent {
  id: string; name: string; house: string; industry: string;
  grants: Readonly<Record<string, unknown>>;
}

/** The Tinker: an artificer-equivalent shipped as a Phase A.2 class
 *  graft (extraMechanics + extraResources onto the wizard chassis),
 *  deliberately NOT a new top-level class. */
export interface BrassgearTinker {
  classId: string;
  mechanics: Readonly<Record<string, Readonly<Record<string, (actor: Actor, args?: Record<string, unknown>) => unknown>>>>;
  resources: Readonly<Record<string, Readonly<Record<string, { max: number; refreshes: string }>>>>;
}

export const BRASSGEAR: Readonly<{
  id: string; name: string; pitch: string;
  regions: Readonly<Record<string, Region>>;
  cities: Readonly<Record<string, SundermarkCity>>;
  factions: Readonly<Record<string, SundermarkFaction>>;
  hooks: Readonly<Record<string, StoryHook>>;
  npcs: Readonly<Record<string, SettingNpc>>;
  talents: Readonly<Record<string, BrassgearTalent>>;
  tinker: BrassgearTinker;
  species: Readonly<Record<string, Species>>;
  backgrounds: Readonly<Record<string, Background>>;
  feats: Readonly<Record<string, Feat>>;
  adventures: Readonly<Record<string, AdventurePack>>;
}>;
export const BRASSGEAR_REGIONS: Readonly<Record<string, Region>>;
export const BRASSGEAR_CITIES: Readonly<Record<string, SundermarkCity>>;
export const BRASSGEAR_FACTIONS: Readonly<Record<string, SundermarkFaction>>;
export const BRASSGEAR_HOOKS: Readonly<Record<string, StoryHook>>;
export const BRASSGEAR_NPCS: Readonly<Record<string, SettingNpc>>;
export const BRASSGEAR_TALENTS: Readonly<Record<string, BrassgearTalent>>;
export const BRASSGEAR_TINKER: BrassgearTinker;
export const BRASSGEAR_SPECIES: Readonly<Record<string, Species>>;
export const BRASSGEAR_BACKGROUNDS: Readonly<Record<string, Background>>;
export const BRASSGEAR_FEATS: Readonly<Record<string, Feat>>;
export const BRASSGEAR_ADVENTURES: Readonly<Record<string, AdventurePack>>;
/** The Greenmist Heist — starter adventure (~75 min, 4 × L3). */
export const THE_GREENMIST_HEIST: AdventurePack;

// ============================================================
// The Hollow Vale (3.2.0) — the third setting pack
// ============================================================

/** A Darklord: a SettingNpc whose moral arc turns on two extra
 *  fields — the tragedy that made them, and the door out. */
export interface Darklord extends SettingNpc {
  tragedy: string;
  redemption: string;
}

/** The dread track: a VariantEncounter custom-track band plus rank
 *  thresholds and the table of what moves it. */
export interface DreadTrack {
  band: { min: number; max: number; start: number };
  thresholds: ReadonlyArray<{ at: number; name: string; effect: string }>;
  gains: Readonly<Record<string, number>>;
}

export const HOLLOW_VALE: Readonly<{
  id: string; name: string; pitch: string;
  regions: Readonly<Record<string, Region>>;
  cities: Readonly<Record<string, SundermarkCity>>;
  factions: Readonly<Record<string, SundermarkFaction>>;
  hooks: Readonly<Record<string, StoryHook>>;
  npcs: Readonly<Record<string, Darklord>>;
  dread: DreadTrack;
  adventures: Readonly<Record<string, AdventurePack>>;
}>;
export const HOLLOW_VALE_REGIONS: Readonly<Record<string, Region>>;
export const HOLLOW_VALE_CITIES: Readonly<Record<string, SundermarkCity>>;
export const HOLLOW_VALE_FACTIONS: Readonly<Record<string, SundermarkFaction>>;
export const HOLLOW_VALE_HOOKS: Readonly<Record<string, StoryHook>>;
export const HOLLOW_VALE_NPCS: Readonly<Record<string, Darklord>>;
export const HOLLOW_VALE_DREAD: DreadTrack;
export const HOLLOW_VALE_ADVENTURES: Readonly<Record<string, AdventurePack>>;
/** Bramblefell — starter adventure (~90 min, 4 × L3), with a
 *  dream-sequence beat staged by the ordinary Beats runtime. */
export const BRAMBLEFELL: AdventurePack;

// ============================================================
// The setting plugin contract (3.3.0)
// ============================================================

/** A setting pack under the 3.3.0 contract: identity plus any of the
 *  content tables. Slotted tables mount through createEngine's plugin
 *  options; pack-data tables (cities, factions, …) are read directly. */
export interface SettingPack {
  id: string;
  name: string;
  pitch: string;
  regions?: Readonly<Record<string, Region>>;
  npcs?: Readonly<Record<string, SettingNpc>>;
  hooks?: Readonly<Record<string, StoryHook>>;
  adventures?: Readonly<Record<string, AdventurePack>>;
  species?: Readonly<Record<string, Species>>;
  backgrounds?: Readonly<Record<string, Background>>;
  feats?: Readonly<Record<string, Feat>>;
  items?: Readonly<Record<string, Item>>;
  monsters?: Readonly<Record<string, Monster>>;
  spells?: Readonly<Record<string, Spell>>;
  cities?: Readonly<Record<string, SundermarkCity>>;
  factions?: Readonly<Record<string, SundermarkFaction>>;
  [extra: string]: unknown;
}

/** The setting plugin contract: validate reports, register gates
 *  (throws the full report on an invalid pack), compose merges N
 *  validated packs into ONE createEngine options object for crossover
 *  play — cross-pack id collisions throw instead of last-write-winning. */
export const Settings: Readonly<{
  validate(pack: SettingPack | unknown): { valid: boolean; errors: string[] };
  register<T extends SettingPack>(pack: T): T;
  compose(...packs: SettingPack[]): EngineOptions;
}>;

// ============================================================
// Localization (3.4.0)
// ============================================================

/** The localization shim: three-step lookup (locale → English → the
 *  key itself, so an unknown key stays visible and greppable). */
export interface StringsNamespace {
  t(key: string, lang?: string): string;
  locales(): string[];
  /** Untranslated keys for a locale — a locale pack's own CI gate. */
  missingIn(lang: string): string[];
}
/** The complete English table over the rules vocabulary (conditions,
 *  classes, species, abilities, action verbs, rarities, rests).
 *  Asserted complete against the live registries in CI. */
export const DEFAULT_STRINGS: Readonly<Record<string, string>>;
/** Build a Strings surface over locale tables; throws on malformed
 *  tables with a pointer at the offending key. */
export function makeStrings(locales?: Record<string, Record<string, string>>): StringsNamespace;
/** Module-level English-only shim for engine-less callers. Engines
 *  bind their own via `createEngine({ extraLocales })`. */
export const Strings: StringsNamespace;

// ============================================================
// Reference cards (3.5.0)
// ============================================================

/** Printable reference material as pure data — one shape across all
 *  card kinds, so a host writes one layout pass. */
export interface Card {
  kind: 'spell' | 'item' | 'monster' | 'class' | 'cheat-sheet' | string;
  id: string;
  title: string;
  sections: ReadonlyArray<{ heading?: string; lines: readonly string[] }>;
}

/** Card generators over registry records. Every generator is total
 *  over its registry (asserted in CI); refusals throw with pointers. */
export const Cards: Readonly<{
  spellCard(spell: Spell): Card;
  itemCard(item: Item): Card;
  monsterCard(monster: Monster): Card;
  classCard(classDef: ClassDef): Card;
  /** The one-page combat cheat-sheet, generated from the engine so
   *  the numbers on the page are the numbers in play. */
  combatCheatSheet(engine: Engine): Card;
}>;

// ============================================================
// The plugin manifest format (3.6.0)
// ============================================================

/** `bag-of-holding.json` — what a third-party pack publishes so
 *  loaders and catalogs can reason about it without executing it. */
export interface PluginManifest {
  manifestVersion: number;
  name: string;
  version: string;
  /** Kernel range: `^X.Y.Z`, `>=X.Y.Z`, `>=X.Y.Z <A.B.C`, or exact. */
  kernel: string;
  /** Table → contributed record count. Keys from `Manifest.TABLES`. */
  contributes: Record<string, number>;
  entry?: string;
  description?: string;
}

export const Manifest: Readonly<{
  VERSION: number;
  /** Declarable tables mapped to the engine option each mounts through. */
  TABLES: Readonly<Record<string, string>>;
  validate(manifest: PluginManifest | unknown): { valid: boolean; errors: string[] };
  satisfies(kernelVersion: string, range: string): boolean;
  /** The loader's red/green: valid AND mountable on this kernel. */
  matches(manifest: PluginManifest | unknown, kernelVersion: string): { ok: boolean; reasons: string[] };
}>;

// ============================================================
// Conversion tools (3.7.0)
// ============================================================

/** Importers over third-party SRD-style JSON (snake_case fields,
 *  textual CRs, prose dice). Guesses are REPORTED in the result —
 *  an import is a claim about someone else's data. */
export const Convert: Readonly<{
  /** '1/4' → 0.25; numbers pass through; garbage → null. */
  normalizeCr(cr: string | number | unknown): number | null;
  monsterFromJson(json: unknown): { record: Monster | null; warnings: string[] };
  spellFromJson(json: unknown): { record: Spell | null; warnings: string[] };
  /** The migration seam across kernel majors. Ledger empty by design
   *  as of 3.x (no breaking record change has shipped); a future
   *  breaking change lands its migration here. */
  migrateCharacter(record: unknown): { record: CharacterRecord | null; changes: string[]; errors: string[] };
  /** Re-validate a serialized Session snapshot; unknown fields are
   *  reported and preserved, never dropped. */
  sessionFromJson(json: unknown): { snapshot: Record<string, unknown> | null; warnings: string[] };
}>;
/** Light as a resource: burn lantern-hours; running dry returns
 *  `inTheDark: true` plus the dread gain the table applies. */
export function burnLight(actor: Actor, hours?: number): {
  actor: Actor; remaining: number; inTheDark: boolean; dreadGain?: number;
};
