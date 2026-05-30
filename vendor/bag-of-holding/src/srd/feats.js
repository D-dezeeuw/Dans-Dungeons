// SRD 5.2 Origin Feats — the three referenced by the four shipped
// backgrounds. General / Fighting Style / Epic Boon feats are out of
// scope for v0; see docs/spec.md.

export default {
  'magic-initiate': {
    id: 'magic-initiate',
    name: 'Magic Initiate',
    category: 'origin',
    // The feat picks a spell list. `variant` is set on selection.
    variants: ['cleric', 'druid', 'wizard'],
    grants: {
      cantripsKnown: 2,
      level1Spell: 1,           // free cast once per Long Rest
      spellcastingAbility: 'choose:int|wis|cha'
    },
    repeatable: true            // different list each time
  },
  'alert': {
    id: 'alert',
    name: 'Alert',
    category: 'origin',
    grants: {
      initiativeProficiency: true,
      initiativeSwap: true      // swap with a willing ally after rolling
    }
  },
  'savage-attacker': {
    id: 'savage-attacker',
    name: 'Savage Attacker',
    category: 'origin',
    grants: {
      // Once per turn on a weapon hit, roll damage dice twice and keep
      // either roll. The loop reads this flag and rolls accordingly.
      rerollWeaponDamageOncePerTurn: true
    }
  }
};
