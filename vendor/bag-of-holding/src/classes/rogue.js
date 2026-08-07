export default {
  id: 'rogue',
  name: 'Rogue',
  hitDie: 8,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['dex', 'int'],
  subclasses: {
    thief: {
      id: 'thief',
      name: 'Thief',
      features: {
        3: ['Fast Hands', 'Second-Story Work'],
        9: ['Supreme Sneak'],
        13: ['Use Magic Device'],
        17: ['Thief\'s Reflexes']
      },
      mechanics: {
        // Fast Hands: bonus action to use thieves' tools, sleight of
        // hand, or use an object. Returns the dispatched action.
        fastHands: (actor, args) => {
          const action = args?.action ?? 'use-object';
          return { ok: true, bonusActionUsed: action, actor };
        }
      }
    }
  },
  // Sneak Attack scales: 1d6 at L1, +1d6 every 2 levels (rounded).
  sneakAttackDice: { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5 },
  features: {
    1: ['Expertise', 'Sneak Attack', "Thieves' Cant"],
    2: ['Cunning Action'],
    3: ['Roguish Archetype'],
    4: ['Ability Score Improvement'],
    5: ['Uncanny Dodge'],
    6: ['Expertise (2 more skills)'],
    7: ['Evasion', 'Reliable Talent'],
    8: ['Ability Score Improvement'],
    9: ['Subclass Feature'],
    10: ['Ability Score Improvement'],
    11: ['Reliable Talent'],
    12: ['Ability Score Improvement'],
    13: ['Subclass Feature'],
    14: ['Devious Strikes'],
    15: ['Slippery Mind'],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: ['Elusive'],
    19: ['Epic Boon'],
    20: ['Stroke of Luck']
  },
  mechanics: {
    /**
     * SRD 5.2 § Rogue § Sneak Attack. Once per turn, when the
     * Rogue hits a creature with a Finesse or Ranged weapon and
     * either (a) has Advantage on the attack roll, or (b) has an
     * ally of the target within 5 ft, they may add extra dice of
     * the same damage type as the weapon: `⌈level / 2⌉ d6`.
     *
     * Inputs (via `args`):
     *   - `attackHadAdvantage` — boolean from the attack result
     *   - `allyAdjacent` — boolean, host-derived from positioning
     *   - `weaponFinesse` — boolean, from the weapon record
     *   - `weaponRanged` — boolean, from the weapon record
     *
     * Returns either:
     *   `{ triggers: true, damageDice, damageType, actor }` — the
     *     damage rider for the host to roll alongside the weapon's
     *     base damage; the new actor carries `sneakAttackUsedThisTurn:
     *     true` so a second attack in the same turn no-ops.
     *   `{ triggers: false, reason }` — debuggable string for the UI.
     *
     * The "once per turn" gate uses a boolean flag rather than a
     * resource counter because it resets on turn end (encounter
     * loop concern), not on a rest.
     */
    sneakAttack: (actor, args = {}) => {
      const level = actor.level ?? 1;
      const diceCount = Math.ceil(level / 2);
      if (actor.sneakAttackUsedThisTurn) {
        return { triggers: false, reason: 'already used this turn' };
      }
      const weaponEligible = args.weaponFinesse === true || args.weaponRanged === true;
      if (!weaponEligible) {
        return { triggers: false, reason: 'weapon must be Finesse or Ranged' };
      }
      const positionEligible = args.attackHadAdvantage === true || args.allyAdjacent === true;
      if (!positionEligible) {
        return { triggers: false, reason: 'requires Advantage or an adjacent ally' };
      }
      return {
        triggers: true,
        damageDice: `${diceCount}d6`,
        damageType: args.damageType ?? 'precision',
        actor: { ...actor, sneakAttackUsedThisTurn: true }
      };
    },
    /**
     * Clear the once-per-turn Sneak Attack flag. The host calls
     * this on `endTurn` so the next turn re-enables Sneak Attack.
     * Kept as a class mechanic (rather than a top-level helper) so
     * the contract surface stays uniform — every per-turn class
     * feature in future sub-releases will follow the same pattern.
     */
    endTurn: (actor) => {
      if (!actor.sneakAttackUsedThisTurn) return { actor };
      const { sneakAttackUsedThisTurn: _, ...rest } = actor;
      return { actor: rest };
    },
    /**
     * SRD 5.2 § Rogue § Reliable Talent (L11): on any proficient
     * ability check, treat a d20 roll of 9 or lower as a 10.
     * `args.d20` is the raw die face the host rolled; the helper
     * returns `{ d20, adjusted }` so the host can re-add the mod
     * and compare to the DC.
     */
    reliableTalent: (_actor, args) => {
      const raw = args?.d20 ?? 1;
      const adjusted = raw < 10 ? 10 : raw;
      return { d20: raw, adjusted };
    }
  }
};
