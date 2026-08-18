// Grimoire II — 30 invented spells, 6th through 9th, so tier-3/4
// spellcasters have a real list. The roadmap's promised shapes: city-sized
// AoEs, plane-shifting alternatives, complex multi-target control. Same
// rules as every content pack (docs/legal.md; swept by tests/legal.test.js):
// every name invented, no Product Identity, and the pack MOUNTS via
// `createEngine({ extraSpells: GRIMOIRE_II })` — the SRD registry stays
// SRD-only. Composable with Grimoire I: spread both into one map.
//
// Same record contract as Grimoire I (1.8's, in full): components / ritual
// flags everywhere, `halfOnSave` on save-for-half AoEs, `area` in the
// shape-size vocabulary, `classes` as host data, and `upcast(castLevel)`
// deltas where a higher slot buys more.

export const GRIMOIRE_II = Object.freeze({
  // ── Level 6 (9) ───────────────────────────────────────────────────────
  'sixfold-lash': {
    id: 'sixfold-lash', name: 'Sixfold Lash', level: 6, school: 'evocation',
    classes: ['sorcerer', 'warlock', 'wizard'],
    damage: '3d8', damageType: 'force', projectiles: 6, range: '120 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ projectiles: castLevel }),
  },
  'drowning-choir': {
    id: 'drowning-choir', name: 'Drowning Choir', level: 6, school: 'enchantment',
    classes: ['bard', 'warlock'],
    save: 'wis', concentration: true, area: 'sphere-30', range: '90 ft',
    components: { v: true }, duration: '1 minute',
  },
  'ossuary-bloom': {
    id: 'ossuary-bloom', name: 'Ossuary Bloom', level: 6, school: 'necromancy',
    classes: ['cleric', 'warlock', 'wizard'],
    damage: '8d6', damageType: 'necrotic', save: 'con', halfOnSave: true,
    area: 'sphere-30', range: '150 ft',
    components: { v: true, s: true, m: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${2 + castLevel}d6` }),
  },
  'glacier-verdict': {
    id: 'glacier-verdict', name: 'Glacier Verdict', level: 6, school: 'evocation',
    classes: ['druid', 'sorcerer', 'wizard'],
    damage: '9d8', damageType: 'cold', save: 'con', halfOnSave: true,
    area: 'line-90', range: 'self',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${3 + castLevel}d8` }),
  },
  'ward-of-the-hearth': {
    id: 'ward-of-the-hearth', name: 'Ward of the Hearth', level: 6, school: 'abjuration',
    classes: ['cleric', 'druid'],
    ritual: true, area: 'sphere-60', range: 'touch',
    components: { v: true, s: true, m: { cost: 250 } }, duration: '24 hours',
  },
  'stone-curtain-eternal': {
    id: 'stone-curtain-eternal', name: 'Stone Curtain Eternal', level: 6,
    school: 'conjuration',
    classes: ['druid', 'wizard'],
    range: '120 ft', components: { v: true, s: true, m: true },
    duration: 'until dispelled',
  },
  'thief-of-hours': {
    id: 'thief-of-hours', name: 'Thief of Hours', level: 6, school: 'transmutation',
    classes: ['sorcerer', 'wizard'],
    save: 'con', concentration: true, range: '60 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'eyes-of-the-argent-court': {
    id: 'eyes-of-the-argent-court', name: 'Eyes of the Argent Court', level: 6,
    school: 'divination',
    classes: ['bard', 'cleric', 'warlock', 'wizard'],
    ritual: true, concentration: true, range: 'self',
    components: { v: true, s: true, m: true }, duration: '10 minutes',
  },
  'chain-of-the-unbroken-line': {
    id: 'chain-of-the-unbroken-line', name: 'Chain of the Unbroken Line', level: 6,
    school: 'abjuration',
    classes: ['cleric', 'paladin'],
    reaction: true, range: '60 ft',
    components: { v: true }, duration: '1 round',
  },

  // ── Level 7 (8) ───────────────────────────────────────────────────────
  'harrowing-of-the-square': {
    id: 'harrowing-of-the-square', name: 'Harrowing of the Square', level: 7,
    school: 'evocation',
    classes: ['sorcerer', 'wizard'],
    damage: '10d6', damageType: 'thunder', save: 'con', halfOnSave: true,
    area: 'cylinder-50', range: '300 ft',
    components: { v: true, s: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${3 + castLevel}d6` }),
  },
  'doorway-of-ash': {
    id: 'doorway-of-ash', name: 'Doorway of Ash', level: 7, school: 'conjuration',
    classes: ['sorcerer', 'warlock', 'wizard'],
    range: '10 ft', components: { v: true, s: true, m: { cost: 500 } },
    duration: '1 round',
  },
  'sevenfold-mirror': {
    id: 'sevenfold-mirror', name: 'Sevenfold Mirror', level: 7, school: 'abjuration',
    classes: ['bard', 'wizard'],
    reaction: true, range: 'self',
    components: { s: true }, duration: '1 round',
  },
  'regiment-of-one': {
    id: 'regiment-of-one', name: 'Regiment of One', level: 7, school: 'illusion',
    classes: ['bard', 'sorcerer', 'wizard'],
    concentration: true, range: 'self',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'famine-wind': {
    id: 'famine-wind', name: 'Famine Wind', level: 7, school: 'necromancy',
    classes: ['druid', 'warlock'],
    damage: '7d8', damageType: 'necrotic', save: 'con', halfOnSave: true,
    concentration: true, area: 'cube-60', range: '300 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'court-of-silent-verdicts': {
    id: 'court-of-silent-verdicts', name: 'Court of Silent Verdicts', level: 7,
    school: 'enchantment',
    classes: ['bard', 'cleric'],
    save: 'cha', concentration: true, range: '60 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'grasp-of-the-buried-king': {
    id: 'grasp-of-the-buried-king', name: 'Grasp of the Buried King', level: 7,
    school: 'transmutation',
    classes: ['druid', 'wizard'],
    save: 'str', concentration: true, area: 'sphere-20', range: '120 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'lantern-across-the-veil': {
    id: 'lantern-across-the-veil', name: 'Lantern Across the Veil', level: 7,
    school: 'conjuration',
    classes: ['cleric', 'warlock', 'wizard'],
    ritual: true, range: '30 ft',
    components: { v: true, s: true, m: { cost: 1000 } }, duration: 'instantaneous',
  },

  // ── Level 8 (7) ───────────────────────────────────────────────────────
  'city-of-glass-rain': {
    id: 'city-of-glass-rain', name: 'City of Glass Rain', level: 8, school: 'evocation',
    classes: ['sorcerer', 'wizard'],
    damage: '10d10', damageType: 'slashing', save: 'dex', halfOnSave: true,
    area: 'cylinder-100', range: '500 ft',
    components: { v: true, s: true, m: true }, duration: 'instantaneous',
    upcast: (castLevel) => ({ damage: `${2 + castLevel}d10` }),
  },
  'hush-upon-the-kingdom': {
    id: 'hush-upon-the-kingdom', name: 'Hush upon the Kingdom', level: 8,
    school: 'illusion',
    classes: ['bard', 'warlock', 'wizard'],
    concentration: true, area: 'sphere-120', range: '300 ft',
    components: { s: true, m: true }, duration: '10 minutes',
  },
  'winter-without-end': {
    id: 'winter-without-end', name: 'Winter Without End', level: 8, school: 'transmutation',
    classes: ['druid'],
    concentration: true, area: 'sphere-300', range: 'self',
    components: { v: true, s: true, m: true }, duration: '1 hour',
  },
  'yoke-of-many-minds': {
    id: 'yoke-of-many-minds', name: 'Yoke of Many Minds', level: 8, school: 'enchantment',
    classes: ['bard', 'sorcerer', 'warlock'],
    save: 'wis', concentration: true, range: '60 ft',
    components: { v: true, s: true }, duration: '1 minute',
  },
  'unwritten-hour': {
    id: 'unwritten-hour', name: 'Unwritten Hour', level: 8, school: 'divination',
    classes: ['cleric', 'wizard'],
    ritual: true, range: 'self',
    components: { v: true, s: true, m: { cost: 1000 } }, duration: 'instantaneous',
  },
  'gravity-inverted': {
    id: 'gravity-inverted', name: 'Gravity Inverted', level: 8, school: 'transmutation',
    classes: ['sorcerer', 'wizard'],
    save: 'dex', concentration: true, area: 'cylinder-50', range: '120 ft',
    components: { v: true, s: true, m: true }, duration: '1 minute',
  },
  'pale-processional': {
    id: 'pale-processional', name: 'Pale Processional', level: 8, school: 'necromancy',
    classes: ['cleric', 'warlock', 'wizard'],
    save: 'wis', damage: '8d8', damageType: 'necrotic', halfOnSave: true,
    concentration: true, range: '90 ft',
    components: { v: true, s: true, m: { cost: 500 } }, duration: '1 minute',
  },

  // ── Level 9 (6) ───────────────────────────────────────────────────────
  'last-dawn': {
    id: 'last-dawn', name: 'Last Dawn', level: 9, school: 'evocation',
    classes: ['cleric', 'druid'],
    damage: '12d10', damageType: 'radiant', save: 'con', halfOnSave: true,
    area: 'cylinder-300', range: '1 mile',
    components: { v: true, s: true }, duration: 'instantaneous',
  },
  'exodus-gate': {
    id: 'exodus-gate', name: 'Exodus Gate', level: 9, school: 'conjuration',
    classes: ['cleric', 'sorcerer', 'wizard'],
    range: '60 ft', components: { v: true, s: true, m: { cost: 5000 } },
    duration: '1 minute',
  },
  'crown-of-the-empty-throne': {
    id: 'crown-of-the-empty-throne', name: 'Crown of the Empty Throne', level: 9,
    school: 'enchantment',
    classes: ['bard', 'warlock'],
    save: 'wis', concentration: true, area: 'sphere-60', range: '60 ft',
    components: { v: true, s: true }, duration: '1 hour',
  },
  'unmaking-word': {
    id: 'unmaking-word', name: 'Unmaking Word', level: 9, school: 'abjuration',
    classes: ['sorcerer', 'wizard'],
    range: '120 ft', components: { v: true }, duration: 'instantaneous',
  },
  'seed-of-a-greener-age': {
    id: 'seed-of-a-greener-age', name: 'Seed of a Greener Age', level: 9,
    school: 'transmutation',
    classes: ['druid'],
    ritual: true, area: 'sphere-300', range: 'touch',
    components: { v: true, s: true, m: { cost: 5000 } }, duration: 'until dispelled',
  },
  'death-postponed': {
    id: 'death-postponed', name: 'Death Postponed', level: 9, school: 'necromancy',
    classes: ['cleric'],
    reaction: true, range: '60 ft',
    components: { v: true }, duration: '1 round',
  },
});
