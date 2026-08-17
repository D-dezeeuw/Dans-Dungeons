// Grimoire I — 50 invented spells, cantrips through 5th, covering the
// tactical roles the SRD selection left thin: more reaction-cast options,
// save-for-half AoE shapes the shipped list never used (cylinders and
// lines), more concentration buffs, and single-target debuffs beyond the
// hold-* pair. Same rules as every content pack (docs/legal.md; swept by
// tests/legal.test.js): every name invented, no Product Identity, and the
// pack MOUNTS via `createEngine({ extraSpells: GRIMOIRE_I })` — the SRD
// registry stays SRD-only.
//
// Record contract is 1.8's, exercised in full for the first time:
// components / ritual flags everywhere, and `upcast(castLevel)` deltas —
// the field `castSpell` has consumed since 1.8 while no shipped record
// carried one. `halfOnSave: true` marks save-for-half AoEs and `area`
// uses the shape-size vocabulary the SRD records established
// (`cone-15`, `sphere-20`) extended with `cylinder-*` and `line-*`.
//
// `classes` is pack data for hosts building spell lists: the SRD class
// lists in src/srd/spell-lists.js are deliberately SRD-scoped, and
// castSpell's class-list gate passes unlisted (homebrew) spells through —
// so these arrays are the host's source of truth for who learns what.

export const GRIMOIRE_I = Object.freeze({
  // ── Cantrips (10) ─────────────────────────────────────────────────────
  'ember-lash': {
    id: 'ember-lash', name: 'Ember Lash', level: 0, school: 'evocation',
    classes: ['sorcerer', 'wizard'],
    damage: '1d10', damageType: 'fire', range: '30 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
  },
  'gravemote': {
    id: 'gravemote', name: 'Gravemote', level: 0, school: 'necromancy',
    classes: ['cleric', 'warlock', 'wizard'],
    damage: '1d8', damageType: 'necrotic', save: 'con', range: '60 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
  },
  'guttering-ward': {
    id: 'guttering-ward', name: 'Guttering Ward', level: 0, school: 'abjuration',
    classes: ['sorcerer', 'wizard'],
    reaction: true, acBonus: 1, range: 'self',
    components: { s: true }, duration: '1 round',
  },
  'saltwhisper': {
    id: 'saltwhisper', name: 'Saltwhisper', level: 0, school: 'divination',
    classes: ['bard', 'druid'],
    range: '30 ft', components: { v: true }, duration: '1 round',
  },
  'cold-snap': {
    id: 'cold-snap', name: 'Cold Snap', level: 0, school: 'evocation',
    classes: ['druid', 'sorcerer', 'wizard'],
    damage: '1d6', damageType: 'cold', save: 'con', range: '60 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
  },
  'mirror-mote': {
    id: 'mirror-mote', name: 'Mirror Mote', level: 0, school: 'illusion',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
    range: '30 ft', components: { s: true, m: true }, duration: '1 minute',
  },
  'thorn-dart': {
    id: 'thorn-dart', name: 'Thorn Dart', level: 0, school: 'conjuration',
    classes: ['druid'],
    damage: '1d8', damageType: 'piercing', range: '60 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
  },
  'dirge-note': {
    id: 'dirge-note', name: 'Dirge Note', level: 0, school: 'enchantment',
    classes: ['bard', 'warlock'],
    damage: '1d6', damageType: 'psychic', save: 'wis', range: '60 ft',
    components: { v: true }, duration: 'instantaneous',
  },
  'lodestone-grip': {
    id: 'lodestone-grip', name: 'Lodestone Grip', level: 0, school: 'transmutation',
    classes: ['sorcerer', 'wizard'],
    damage: '1d8', damageType: 'force', save: 'str', range: '30 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
  },
  'rushlight': {
    id: 'rushlight', name: 'Rushlight', level: 0, school: 'transmutation',
    classes: ['bard', 'cleric', 'druid'],
    range: 'touch', components: { v: true, m: true }, duration: '1 hour',
  },

  // ── Level 1 (10) ──────────────────────────────────────────────────────
  'wardens-rebuke': {
    id: 'wardens-rebuke', name: "Warden's Rebuke", level: 1, school: 'abjuration',
    classes: ['cleric', 'paladin'],
    reaction: true, damage: '2d8', damageType: 'radiant', range: '30 ft',
    components: { v: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${1 + castLevel}d8` }),
  },
  'biting-gale': {
    id: 'biting-gale', name: 'Biting Gale', level: 1, school: 'evocation',
    classes: ['druid', 'sorcerer', 'wizard'],
    damage: '2d6', damageType: 'cold', save: 'con', halfOnSave: true,
    area: 'line-30', range: 'self',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${1 + castLevel}d6` }),
  },
  'tanglefoot-surge': {
    id: 'tanglefoot-surge', name: 'Tanglefoot Surge', level: 1, school: 'conjuration',
    classes: ['druid', 'ranger'],
    save: 'dex', concentration: true, area: 'cube-15', range: '60 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'lantern-of-the-deep': {
    id: 'lantern-of-the-deep', name: 'Lantern of the Deep', level: 1, school: 'evocation',
    classes: ['cleric', 'druid', 'wizard'],
    range: 'touch', components: { v: true, m: true }, duration: '1 hour',
  },
  'quickstep': {
    id: 'quickstep', name: 'Quickstep', level: 1, school: 'transmutation',
    classes: ['bard', 'ranger', 'sorcerer'],
    bonusAction: true, range: 'self',
    components: { v: true }, duration: '1 round',
  },
  'false-face': {
    id: 'false-face', name: 'False Face', level: 1, school: 'illusion',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
    ritual: true, range: 'self',
    components: { v: true, s: true }, duration: '1 hour',
  },
  'bloodhound-mark': {
    id: 'bloodhound-mark', name: 'Bloodhound Mark', level: 1, school: 'divination',
    classes: ['ranger', 'warlock'],
    bonusAction: true, concentration: true, range: '90 ft',
    components: { v: true }, duration: '1 hour',
  },
  'mercy-of-the-road': {
    id: 'mercy-of-the-road', name: 'Mercy of the Road', level: 1, school: 'evocation',
    classes: ['bard', 'cleric', 'druid', 'paladin'],
    healing: '1d6+mod', range: 'touch',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ healing: `${castLevel}d6+mod` }),
  },
  'leaden-burden': {
    id: 'leaden-burden', name: 'Leaden Burden', level: 1, school: 'transmutation',
    classes: ['sorcerer', 'warlock', 'wizard'],
    save: 'str', concentration: true, range: '60 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'spite-hex': {
    id: 'spite-hex', name: 'Spite Hex', level: 1, school: 'enchantment',
    classes: ['bard', 'warlock'],
    save: 'cha', concentration: true, range: '60 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },

  // ── Level 2 (8) ───────────────────────────────────────────────────────
  'threshold-slip': {
    id: 'threshold-slip', name: 'Threshold Slip', level: 2, school: 'conjuration',
    classes: ['sorcerer', 'warlock', 'wizard'],
    bonusAction: true, range: 'self',
    components: { s: true }, duration: 'instantaneous',
  },
  'chorus-of-vigor': {
    id: 'chorus-of-vigor', name: 'Chorus of Vigor', level: 2, school: 'abjuration',
    classes: ['bard', 'cleric'],
    concentration: true, area: 'sphere-15', range: 'self',
    components: { v: true }, duration: '1 minute',
  },
  'howling-column': {
    id: 'howling-column', name: 'Howling Column', level: 2, school: 'evocation',
    classes: ['druid', 'sorcerer', 'wizard'],
    damage: '3d8', damageType: 'thunder', save: 'con', halfOnSave: true,
    area: 'cylinder-10', range: '60 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${1 + castLevel}d8` }),
  },
  'witchlight-chains': {
    id: 'witchlight-chains', name: 'Witchlight Chains', level: 2, school: 'evocation',
    classes: ['cleric', 'warlock'],
    damage: '2d6', damageType: 'radiant', save: 'dex', concentration: true,
    range: '60 ft', components: { v: true, s: true }, duration: '1 minute',
  },
  'second-sight': {
    id: 'second-sight', name: 'Second Sight', level: 2, school: 'divination',
    classes: ['bard', 'cleric', 'druid', 'wizard'],
    ritual: true, range: 'self',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'grave-hush': {
    id: 'grave-hush', name: 'Grave Hush', level: 2, school: 'necromancy',
    classes: ['cleric', 'warlock', 'wizard'],
    save: 'con', concentration: true, range: '60 ft',
    components: { s: true, m: true }, duration: '1 minute',
  },
  'rot-swarm': {
    id: 'rot-swarm', name: 'Rot Swarm', level: 2, school: 'necromancy',
    classes: ['druid', 'warlock'],
    damage: '2d6', damageType: 'necrotic', save: 'con', halfOnSave: true,
    concentration: true, area: 'cube-10', range: '90 ft',
    components: { v: true, s: true }, duration: '1 minute',
    upcast: (castLevel) => ({ damage: `${castLevel}d6` }),
  },
  'stone-lattice': {
    id: 'stone-lattice', name: 'Stone Lattice', level: 2, school: 'conjuration',
    classes: ['druid', 'wizard'],
    concentration: true, range: '60 ft',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },

  // ── Level 3 (8) ───────────────────────────────────────────────────────
  'skyfall-lance': {
    id: 'skyfall-lance', name: 'Skyfall Lance', level: 3, school: 'evocation',
    classes: ['cleric', 'druid'],
    damage: '5d8', damageType: 'radiant', save: 'dex', halfOnSave: true,
    area: 'cylinder-20', range: '120 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${2 + castLevel}d8` }),
  },
  'tidal-scythe': {
    id: 'tidal-scythe', name: 'Tidal Scythe', level: 3, school: 'evocation',
    classes: ['druid', 'sorcerer', 'wizard'],
    damage: '4d10', damageType: 'cold', save: 'str', halfOnSave: true,
    area: 'line-60', range: 'self',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${1 + castLevel}d10` }),
  },
  'iron-oath': {
    id: 'iron-oath', name: 'Iron Oath', level: 3, school: 'abjuration',
    classes: ['cleric', 'paladin'],
    acBonus: 2, concentration: true, range: 'touch',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'mirrored-legion': {
    id: 'mirrored-legion', name: 'Mirrored Legion', level: 3, school: 'illusion',
    classes: ['bard', 'sorcerer', 'wizard'],
    concentration: true, range: 'self',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'hollow-voice': {
    id: 'hollow-voice', name: 'Hollow Voice', level: 3, school: 'enchantment',
    classes: ['bard', 'warlock'],
    save: 'wis', concentration: true, range: '60 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'sudden-rampart': {
    id: 'sudden-rampart', name: 'Sudden Rampart', level: 3, school: 'conjuration',
    classes: ['druid', 'sorcerer', 'wizard'],
    reaction: true, range: '60 ft',
    components: { v: true, s: true, m: true }, duration: '1 round',
  },
  'carrion-call': {
    id: 'carrion-call', name: 'Carrion Call', level: 3, school: 'necromancy',
    classes: ['warlock', 'wizard'],
    ritual: true, concentration: true, range: '30 ft',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'threshold-march': {
    id: 'threshold-march', name: 'Threshold March', level: 3, school: 'conjuration',
    classes: ['cleric', 'wizard'],
    range: '10 ft', components: { v: true, s: true, m: true },
    duration: 'instantaneous',
  },

  // ── Level 4 (7) ───────────────────────────────────────────────────────
  'splintering-orbit': {
    id: 'splintering-orbit', name: 'Splintering Orbit', level: 4, school: 'evocation',
    classes: ['sorcerer', 'wizard'],
    damage: '2d8', damageType: 'force', projectiles: 4, range: '120 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ projectiles: castLevel }),
  },
  'gravebind': {
    id: 'gravebind', name: 'Gravebind', level: 4, school: 'necromancy',
    classes: ['cleric', 'warlock'],
    save: 'cha', concentration: true, range: '60 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'verdant-cage': {
    id: 'verdant-cage', name: 'Verdant Cage', level: 4, school: 'conjuration',
    classes: ['druid', 'ranger'],
    save: 'str', concentration: true, range: '90 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'stormcrown': {
    id: 'stormcrown', name: 'Stormcrown', level: 4, school: 'evocation',
    classes: ['druid', 'sorcerer'],
    concentration: true, range: 'self',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'mind-fortress': {
    id: 'mind-fortress', name: 'Mind Fortress', level: 4, school: 'abjuration',
    classes: ['bard', 'cleric', 'wizard'],
    ritual: true, range: 'touch',
    components: { v: true, s: true, m: true }, duration: '8 hours',
  },
  'ashen-rain': {
    id: 'ashen-rain', name: 'Ashen Rain', level: 4, school: 'evocation',
    classes: ['sorcerer', 'wizard'],
    damage: '6d6', damageType: 'fire', save: 'dex', halfOnSave: true,
    concentration: true, area: 'cylinder-20', range: '150 ft',
    components: { v: true, s: true }, duration: '1 minute',
    upcast: (castLevel) => ({ damage: `${2 + castLevel}d6` }),
  },
  'unmaking-glyph': {
    id: 'unmaking-glyph', name: 'Unmaking Glyph', level: 4, school: 'abjuration',
    classes: ['cleric', 'wizard'],
    save: 'int', damage: '5d8', damageType: 'force', range: 'touch',
    components: { v: true, s: true, m: true }, duration: '24 hours',
  },

  // ── Level 5 (7) ───────────────────────────────────────────────────────
  'cataract-of-stars': {
    id: 'cataract-of-stars', name: 'Cataract of Stars', level: 5, school: 'evocation',
    classes: ['druid', 'sorcerer', 'wizard'],
    damage: '8d8', damageType: 'radiant', save: 'dex', halfOnSave: true,
    area: 'cylinder-10', range: '120 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${3 + castLevel}d8` }),
  },
  'leech-crown': {
    id: 'leech-crown', name: 'Leech Crown', level: 5, school: 'necromancy',
    classes: ['warlock', 'wizard'],
    damage: '6d8', damageType: 'necrotic', save: 'con', healing: '3d8',
    range: '60 ft', components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${1 + castLevel}d8` }),
  },
  'sovereign-command': {
    id: 'sovereign-command', name: 'Sovereign Command', level: 5, school: 'enchantment',
    classes: ['bard', 'warlock'],
    save: 'wis', concentration: true, range: '60 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'wall-of-grief': {
    id: 'wall-of-grief', name: 'Wall of Grief', level: 5, school: 'illusion',
    classes: ['bard', 'warlock', 'wizard'],
    save: 'wis', damage: '4d10', damageType: 'psychic', halfOnSave: true,
    concentration: true, range: '90 ft',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'borrowed-time': {
    id: 'borrowed-time', name: 'Borrowed Time', level: 5, school: 'transmutation',
    classes: ['sorcerer', 'wizard'],
    bonusAction: true, concentration: true, range: '30 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'beacon-unfailing': {
    id: 'beacon-unfailing', name: 'Beacon Unfailing', level: 5, school: 'abjuration',
    classes: ['cleric', 'paladin'],
    concentration: true, area: 'sphere-30', range: 'self',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'passage-of-the-unseen-road': {
    id: 'passage-of-the-unseen-road', name: 'Passage of the Unseen Road', level: 5,
    school: 'conjuration',
    classes: ['druid', 'wizard'],
    ritual: true, range: 'touch',
    components: { v: true, s: true, m: true }, duration: '8 hours',
  },
});
