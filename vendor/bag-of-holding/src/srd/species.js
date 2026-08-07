// SRD 5.2 species: size, speed, signature traits, and structured
// effects. Ability score increases come from backgrounds (see
// backgrounds.js), not species, per the 5.2 character-creation rules.
//
// Each species carries two parallel views of its traits:
//
//   - `traits: string[]`  display labels (UI-only, free-form).
//   - `effects: { ... }`  structured, engine-readable mechanics.
//
// The split keeps the human-readable list intact for hosts that
// render a species card, while giving the engine a stable shape to
// derive senses, resistances, extra speeds, and flag-driven hooks.
// Both views are optional on homebrew species: a plugin author can
// supply just `traits` and the engine will treat the effects as
// empty.

const E = (e) => Object.freeze(e);

export default {
  human: {
    id: 'human', name: 'Human', size: 'medium', speed: 30,
    traits: ['Resourceful', 'Skillful', 'Versatile'],
    effects: E({ darkvisionFt: 0, flags: E({ resourceful: true, skillful: true, versatile: true }) })
  },
  elf: {
    id: 'elf', name: 'Elf', size: 'medium', speed: 30,
    traits: ['Darkvision 60ft', 'Fey Ancestry', 'Keen Senses', 'Trance'],
    effects: E({
      darkvisionFt: 60,
      flags: E({ feyAncestry: true, keenSenses: true, trance: true })
    })
  },
  dwarf: {
    id: 'dwarf', name: 'Dwarf', size: 'medium', speed: 30,
    traits: ['Darkvision 120ft', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
    effects: E({
      darkvisionFt: 120,
      damageResistances: Object.freeze(['poison']),
      flags: E({ dwarvenResilience: true, dwarvenToughness: true, stonecunning: true })
    })
  },
  halfling: {
    id: 'halfling', name: 'Halfling', size: 'small', speed: 30,
    traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
    effects: E({
      darkvisionFt: 0,
      flags: E({ brave: true, halflingNimbleness: true, lucky: true, naturallyStealthy: true })
    })
  },
  dragonborn: {
    id: 'dragonborn', name: 'Dragonborn', size: 'medium', speed: 30,
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Draconic Flight (L5)'],
    effects: E({
      darkvisionFt: 60,
      flags: E({ draconicAncestry: true, breathWeapon: true, draconicFlight: true })
    })
  },
  gnome: {
    id: 'gnome', name: 'Gnome', size: 'small', speed: 30,
    traits: ['Darkvision 60ft', 'Gnomish Cunning'],
    effects: E({ darkvisionFt: 60, flags: E({ gnomishCunning: true }) })
  },
  goliath: {
    id: 'goliath', name: 'Goliath', size: 'medium', speed: 35,
    traits: ['Giant Ancestry', 'Powerful Build', 'Large Form (L5)'],
    effects: E({
      darkvisionFt: 0,
      flags: E({ giantAncestry: true, powerfulBuild: true, largeForm: true })
    })
  },
  orc: {
    id: 'orc', name: 'Orc', size: 'medium', speed: 30,
    traits: ['Adrenaline Rush', 'Darkvision 120ft', 'Powerful Build', 'Relentless Endurance'],
    effects: E({
      darkvisionFt: 120,
      flags: E({ adrenalineRush: true, powerfulBuild: true, relentlessEndurance: true })
    })
  },
  tiefling: {
    id: 'tiefling', name: 'Tiefling', size: 'medium', speed: 30,
    traits: ['Darkvision 60ft', 'Fiendish Legacy', 'Otherworldly Presence'],
    effects: E({
      darkvisionFt: 60,
      damageResistances: Object.freeze(['fire']),
      flags: E({ fiendishLegacy: true, otherworldlyPresence: true })
    })
  }
};
