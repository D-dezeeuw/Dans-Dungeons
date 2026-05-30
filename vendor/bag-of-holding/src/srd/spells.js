// SRD 5.2 spells — a representative selection covering cantrips
// through L5 plus the canonical reaction-cast and concentration
// spells the host loop expects to find. Not every SRD spell ships
// here; plugins extend via `createEngine({ extraSpells })`.

export default {
  // Cantrips
  'fire-bolt':       { id: 'fire-bolt',       name: 'Fire Bolt',       level: 0, school: 'evocation',  damage: '1d10' },
  'sacred-flame':    { id: 'sacred-flame',    name: 'Sacred Flame',    level: 0, school: 'evocation',  damage: '1d8',  save: 'dex' },
  'eldritch-blast':  { id: 'eldritch-blast',  name: 'Eldritch Blast',  level: 0, school: 'evocation',  damage: '1d10' },
  'ray-of-frost':    { id: 'ray-of-frost',    name: 'Ray of Frost',    level: 0, school: 'evocation',  damage: '1d8' },
  'light':           { id: 'light',           name: 'Light',           level: 0, school: 'evocation' },
  'guidance':        { id: 'guidance',        name: 'Guidance',        level: 0, school: 'divination' },
  'mage-hand':       { id: 'mage-hand',       name: 'Mage Hand',       level: 0, school: 'conjuration' },
  'prestidigitation':{ id: 'prestidigitation',name: 'Prestidigitation',level: 0, school: 'transmutation' },

  // L1
  'cure-wounds':   { id: 'cure-wounds',   name: 'Cure Wounds',   level: 1, school: 'evocation',  healing: '1d8+mod' },
  'magic-missile': { id: 'magic-missile', name: 'Magic Missile', level: 1, school: 'evocation',  damage: '1d4+1', autohit: true, projectiles: 3 },
  'shield':        { id: 'shield',        name: 'Shield',        level: 1, school: 'abjuration', reaction: true, acBonus: 5 },
  'mage-armor':    { id: 'mage-armor',    name: 'Mage Armor',    level: 1, school: 'abjuration', sets: { ac: '13+dex' } },
  'bless':         { id: 'bless',         name: 'Bless',         level: 1, school: 'enchantment', concentration: true },
  'healing-word':  { id: 'healing-word',  name: 'Healing Word',  level: 1, school: 'evocation',  healing: '1d4+mod', bonusAction: true },
  'sleep':         { id: 'sleep',         name: 'Sleep',         level: 1, school: 'enchantment' },
  'thunderwave':   { id: 'thunderwave',   name: 'Thunderwave',   level: 1, school: 'evocation',  damage: '2d8', save: 'con' },
  'detect-magic':  { id: 'detect-magic',  name: 'Detect Magic',  level: 1, school: 'divination', concentration: true },

  // L2
  'misty-step':    { id: 'misty-step',    name: 'Misty Step',    level: 2, school: 'conjuration', bonusAction: true },
  'invisibility':  { id: 'invisibility',  name: 'Invisibility',  level: 2, school: 'illusion',    concentration: true },
  'hold-person':   { id: 'hold-person',   name: 'Hold Person',   level: 2, school: 'enchantment', concentration: true, save: 'wis' },
  'scorching-ray': { id: 'scorching-ray', name: 'Scorching Ray', level: 2, school: 'evocation',   damage: '2d6', projectiles: 3 },
  'spiritual-weapon': { id: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, school: 'evocation', bonusAction: true, damage: '1d8+mod' },

  // L3
  'fireball':      { id: 'fireball',      name: 'Fireball',      level: 3, school: 'evocation',  damage: '8d6', save: 'dex' },
  'counterspell':  { id: 'counterspell',  name: 'Counterspell',  level: 3, school: 'abjuration', reaction: true },
  'haste':         { id: 'haste',         name: 'Haste',         level: 3, school: 'transmutation', concentration: true },
  'fly':           { id: 'fly',           name: 'Fly',           level: 3, school: 'transmutation', concentration: true },
  'lightning-bolt':{ id: 'lightning-bolt',name: 'Lightning Bolt',level: 3, school: 'evocation',  damage: '8d6', save: 'dex' },

  // L4
  'banishment':    { id: 'banishment',    name: 'Banishment',    level: 4, school: 'abjuration', concentration: true, save: 'cha' },
  'polymorph':     { id: 'polymorph',     name: 'Polymorph',     level: 4, school: 'transmutation', concentration: true, save: 'wis' },
  'fire-shield':   { id: 'fire-shield',   name: 'Fire Shield',   level: 4, school: 'evocation' },

  // L5
  'cone-of-cold':  { id: 'cone-of-cold',  name: 'Cone of Cold',  level: 5, school: 'evocation',  damage: '8d8', save: 'con' },
  'hold-monster':  { id: 'hold-monster',  name: 'Hold Monster',  level: 5, school: 'enchantment', concentration: true, save: 'wis' },
  'wall-of-stone': { id: 'wall-of-stone', name: 'Wall of Stone', level: 5, school: 'evocation',   concentration: true }
};
