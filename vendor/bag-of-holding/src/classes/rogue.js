export default {
  id: 'rogue',
  name: 'Rogue',
  hitDie: 8,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['dex', 'int'],
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
    10: ['Ability Score Improvement']
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
    }
  }
};
