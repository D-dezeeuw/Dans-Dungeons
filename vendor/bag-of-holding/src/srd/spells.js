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
  'wall-of-stone': { id: 'wall-of-stone', name: 'Wall of Stone', level: 5, school: 'evocation',   concentration: true },

  // === Additional SRD 5.2 spells ===

  // Cantrips (added)
  'acid-splash':     { id: 'acid-splash',     name: 'Acid Splash',     level: 0, school: 'conjuration',  damage: '1d6', damageType: 'acid', save: 'dex', range: '60 ft', components: 'V, S' },
  'poison-spray':    { id: 'poison-spray',    name: 'Poison Spray',    level: 0, school: 'necromancy',   damage: '1d12', damageType: 'poison', save: 'con', range: '10 ft', components: 'V, S' },
  'shocking-grasp':  { id: 'shocking-grasp',  name: 'Shocking Grasp',  level: 0, school: 'evocation',    damage: '1d8', damageType: 'lightning', range: 'touch', components: 'V, S' },
  'toll-the-dead':   { id: 'toll-the-dead',   name: 'Toll the Dead',   level: 0, school: 'necromancy',   damage: '1d8', damageType: 'necrotic', save: 'wis', range: '60 ft', components: 'V, S' },
  'vicious-mockery': { id: 'vicious-mockery', name: 'Vicious Mockery', level: 0, school: 'enchantment',  damage: '1d6', damageType: 'psychic', save: 'wis', range: '60 ft', components: 'V' },
  'mending':         { id: 'mending',         name: 'Mending',         level: 0, school: 'transmutation', range: 'touch', components: 'V, S, M', duration: 'instantaneous' },
  'message':         { id: 'message',         name: 'Message',         level: 0, school: 'transmutation', range: '120 ft', components: 'V, S, M', duration: '1 round' },
  'minor-illusion':  { id: 'minor-illusion',  name: 'Minor Illusion',  level: 0, school: 'illusion',     range: '30 ft', components: 'S, M', duration: '1 minute' },
  'druidcraft':      { id: 'druidcraft',      name: 'Druidcraft',      level: 0, school: 'transmutation', range: '30 ft', components: 'V, S', duration: 'instantaneous' },
  'dancing-lights':  { id: 'dancing-lights',  name: 'Dancing Lights',  level: 0, school: 'illusion',     concentration: true, duration: '1 minute', range: '120 ft', components: 'V, S, M' },

  // L1 (added)
  'burning-hands': { id: 'burning-hands', name: 'Burning Hands', level: 1, school: 'evocation',    damage: '3d6', damageType: 'fire', save: 'dex', area: 'cone-15', range: 'self', components: 'V, S' },
  'charm-person':  { id: 'charm-person',  name: 'Charm Person',  level: 1, school: 'enchantment',  save: 'wis', range: '30 ft', components: 'V, S', duration: '1 hour' },
  'feather-fall':  { id: 'feather-fall',  name: 'Feather Fall',  level: 1, school: 'transmutation', reaction: true, range: '60 ft', components: 'V, M', duration: '1 minute' },
  'fog-cloud':     { id: 'fog-cloud',     name: 'Fog Cloud',     level: 1, school: 'conjuration',  concentration: true, area: 'sphere-20', range: '120 ft', components: 'V, S', duration: '1 hour' },
  'identify':      { id: 'identify',      name: 'Identify',      level: 1, school: 'divination',   ritual: true, range: 'touch', components: 'V, S, M', duration: 'instantaneous' },
  'bane':          { id: 'bane',          name: 'Bane',          level: 1, school: 'enchantment',  concentration: true, save: 'cha', range: '30 ft', components: 'V, S, M', duration: '1 minute' },
  'faerie-fire':   { id: 'faerie-fire',   name: 'Faerie Fire',   level: 1, school: 'evocation',    concentration: true, save: 'dex', area: 'cube-20', range: '60 ft', components: 'V', duration: '1 minute' },
  'protection-from-evil-and-good': { id: 'protection-from-evil-and-good', name: 'Protection from Evil and Good', level: 1, school: 'abjuration', concentration: true, range: 'touch', components: 'V, S, M', duration: '10 minutes' },
  'guiding-bolt':  { id: 'guiding-bolt',  name: 'Guiding Bolt',  level: 1, school: 'evocation',    damage: '4d6', damageType: 'radiant', range: '120 ft', components: 'V, S', duration: '1 round' },
  'hunters-mark':  { id: 'hunters-mark',  name: "Hunter's Mark", level: 1, school: 'divination',   concentration: true, bonusAction: true, range: '90 ft', components: 'V', duration: '1 hour' },

  // L2 (added)
  'aid':                { id: 'aid',                name: 'Aid',                level: 2, school: 'abjuration',  range: '30 ft', components: 'V, S, M', duration: '8 hours' },
  'blur':               { id: 'blur',               name: 'Blur',               level: 2, school: 'illusion',    concentration: true, range: 'self', components: 'V', duration: '1 minute' },
  'darkness':           { id: 'darkness',           name: 'Darkness',           level: 2, school: 'evocation',   concentration: true, area: 'sphere-15', range: '60 ft', components: 'V, M', duration: '10 minutes' },
  'detect-thoughts':    { id: 'detect-thoughts',    name: 'Detect Thoughts',    level: 2, school: 'divination',  concentration: true, save: 'wis', range: 'self', components: 'V, S, M', duration: '1 minute' },
  'lesser-restoration': { id: 'lesser-restoration', name: 'Lesser Restoration', level: 2, school: 'abjuration',  range: 'touch', components: 'V, S', duration: 'instantaneous' },
  'see-invisibility':   { id: 'see-invisibility',   name: 'See Invisibility',   level: 2, school: 'divination',  range: 'self', components: 'V, S, M', duration: '1 hour' },
  'web':                { id: 'web',                name: 'Web',                level: 2, school: 'conjuration', concentration: true, save: 'dex', area: 'cube-20', range: '60 ft', components: 'V, S, M', duration: '1 hour' },
  'mirror-image':       { id: 'mirror-image',       name: 'Mirror Image',       level: 2, school: 'illusion',    range: 'self', components: 'V, S', duration: '1 minute' },
  'shatter':            { id: 'shatter',            name: 'Shatter',            level: 2, school: 'evocation',   damage: '3d8', damageType: 'thunder', save: 'con', area: 'sphere-10', range: '60 ft', components: 'V, S, M' },

  // L3 (added)
  'dispel-magic':     { id: 'dispel-magic',     name: 'Dispel Magic',     level: 3, school: 'abjuration',  range: '120 ft', components: 'V, S', duration: 'instantaneous' },
  'slow':             { id: 'slow',             name: 'Slow',             level: 3, school: 'transmutation', concentration: true, save: 'wis', area: 'cube-40', range: '120 ft', components: 'V, S, M', duration: '1 minute' },
  'spirit-guardians': { id: 'spirit-guardians', name: 'Spirit Guardians', level: 3, school: 'conjuration', concentration: true, damage: '3d8', damageType: 'radiant', save: 'wis', area: 'sphere-15', range: 'self', components: 'V, S, M', duration: '10 minutes' },
  'tongues':          { id: 'tongues',          name: 'Tongues',          level: 3, school: 'divination',  range: 'touch', components: 'V, M', duration: '1 hour' },
  'water-breathing':  { id: 'water-breathing',  name: 'Water Breathing',  level: 3, school: 'transmutation', ritual: true, range: '30 ft', components: 'V, S, M', duration: '24 hours' },
  'revivify':         { id: 'revivify',         name: 'Revivify',         level: 3, school: 'necromancy',  range: 'touch', components: 'V, S, M', duration: 'instantaneous' },
  'hypnotic-pattern': { id: 'hypnotic-pattern', name: 'Hypnotic Pattern', level: 3, school: 'illusion',    concentration: true, save: 'wis', area: 'cube-30', range: '120 ft', components: 'S, M', duration: '1 minute' },

  // L4 (added)
  'dimension-door':      { id: 'dimension-door',      name: 'Dimension Door',      level: 4, school: 'conjuration', range: '500 ft', components: 'V', duration: 'instantaneous' },
  'greater-invisibility':{ id: 'greater-invisibility',name: 'Greater Invisibility',level: 4, school: 'illusion',    concentration: true, range: 'touch', components: 'V, S', duration: '1 minute' },
  'ice-storm':           { id: 'ice-storm',           name: 'Ice Storm',           level: 4, school: 'evocation',   damage: '2d8', damageType: 'bludgeoning', save: 'dex', area: 'cylinder-20', range: '300 ft', components: 'V, S, M' },
  'stoneskin':           { id: 'stoneskin',           name: 'Stoneskin',           level: 4, school: 'transmutation', concentration: true, range: 'touch', components: 'V, S, M', duration: '1 hour' },
  'wall-of-fire':        { id: 'wall-of-fire',        name: 'Wall of Fire',        level: 4, school: 'evocation',   concentration: true, damage: '5d8', damageType: 'fire', save: 'dex', range: '120 ft', components: 'V, S, M', duration: '1 minute' },
  'confusion':           { id: 'confusion',           name: 'Confusion',           level: 4, school: 'enchantment', concentration: true, save: 'wis', area: 'sphere-10', range: '90 ft', components: 'V, S, M', duration: '1 minute' },

  // L5 (added)
  'mass-cure-wounds': { id: 'mass-cure-wounds', name: 'Mass Cure Wounds', level: 5, school: 'evocation', healing: '3d8+mod', range: '60 ft', components: 'V, S', duration: 'instantaneous' },
  'raise-dead':       { id: 'raise-dead',       name: 'Raise Dead',       level: 5, school: 'necromancy', range: 'touch', components: 'V, S, M', duration: 'instantaneous' },
  'telekinesis':      { id: 'telekinesis',      name: 'Telekinesis',      level: 5, school: 'transmutation', concentration: true, range: '60 ft', components: 'V, S', duration: '10 minutes' },
  'flame-strike':     { id: 'flame-strike',     name: 'Flame Strike',     level: 5, school: 'evocation', damage: '4d6', damageType: 'fire', save: 'dex', area: 'cylinder-10', range: '60 ft', components: 'V, S, M' },
  'scrying':          { id: 'scrying',          name: 'Scrying',          level: 5, school: 'divination', concentration: true, save: 'wis', range: 'self', components: 'V, S, M', duration: '10 minutes' },

  // L6
  'chain-lightning': { id: 'chain-lightning', name: 'Chain Lightning', level: 6, school: 'evocation',  damage: '10d8', damageType: 'lightning', save: 'dex', range: '150 ft', components: 'V, S, M' },
  'disintegrate':    { id: 'disintegrate',    name: 'Disintegrate',    level: 6, school: 'transmutation', damage: '10d6+40', damageType: 'force', save: 'dex', range: '60 ft', components: 'V, S, M' },
  'heal':            { id: 'heal',            name: 'Heal',            level: 6, school: 'abjuration', healing: '70', range: '60 ft', components: 'V, S', duration: 'instantaneous' },
  'mass-suggestion': { id: 'mass-suggestion', name: 'Mass Suggestion', level: 6, school: 'enchantment', save: 'wis', range: '60 ft', components: 'V, M', duration: '24 hours' },
  'sunbeam':         { id: 'sunbeam',         name: 'Sunbeam',         level: 6, school: 'evocation',  concentration: true, damage: '6d8', damageType: 'radiant', save: 'con', area: 'line-60', range: 'self', components: 'V, S, M', duration: '1 minute' },
  'true-seeing':     { id: 'true-seeing',     name: 'True Seeing',     level: 6, school: 'divination', range: 'touch', components: 'V, S, M', duration: '1 hour' },

  // L7
  'finger-of-death':  { id: 'finger-of-death',  name: 'Finger of Death',  level: 7, school: 'necromancy', damage: '7d8+30', damageType: 'necrotic', save: 'con', range: '60 ft', components: 'V, S' },
  'plane-shift':      { id: 'plane-shift',      name: 'Plane Shift',      level: 7, school: 'conjuration', save: 'cha', range: 'touch', components: 'V, S, M', duration: 'instantaneous' },
  'resurrection':     { id: 'resurrection',     name: 'Resurrection',     level: 7, school: 'necromancy', range: 'touch', components: 'V, S, M', duration: 'instantaneous' },
  'reverse-gravity':  { id: 'reverse-gravity',  name: 'Reverse Gravity',  level: 7, school: 'transmutation', concentration: true, save: 'dex', area: 'cylinder-50', range: '100 ft', components: 'V, S, M', duration: '1 minute' },
  'teleport':         { id: 'teleport',         name: 'Teleport',         level: 7, school: 'conjuration',  range: '10 ft', components: 'V', duration: 'instantaneous' },
  'fire-storm':       { id: 'fire-storm',       name: 'Fire Storm',       level: 7, school: 'evocation',    damage: '7d10', damageType: 'fire', save: 'dex', range: '150 ft', components: 'V, S' },

  // L8
  'antimagic-field':  { id: 'antimagic-field',  name: 'Antimagic Field',  level: 8, school: 'abjuration',  concentration: true, area: 'sphere-10', range: 'self', components: 'V, S, M', duration: '1 hour' },
  'earthquake':       { id: 'earthquake',       name: 'Earthquake',       level: 8, school: 'transmutation', concentration: true, save: 'dex', area: 'sphere-100', range: '500 ft', components: 'V, S, M', duration: '1 minute' },
  'mind-blank':       { id: 'mind-blank',       name: 'Mind Blank',       level: 8, school: 'abjuration',  range: 'touch', components: 'V, S', duration: '24 hours' },
  'power-word-stun':  { id: 'power-word-stun',  name: 'Power Word Stun',  level: 8, school: 'enchantment', range: '60 ft', components: 'V', duration: 'instantaneous' },
  'sunburst':         { id: 'sunburst',         name: 'Sunburst',         level: 8, school: 'evocation',   damage: '12d6', damageType: 'radiant', save: 'con', area: 'sphere-60', range: '150 ft', components: 'V, S, M' },

  // L9
  'foresight':        { id: 'foresight',        name: 'Foresight',        level: 9, school: 'divination',  range: 'touch', components: 'V, S, M', duration: '8 hours' },
  'meteor-swarm':     { id: 'meteor-swarm',     name: 'Meteor Swarm',     level: 9, school: 'evocation',   damage: '40d6', damageType: 'fire', save: 'dex', area: 'sphere-40', range: '1 mile', components: 'V, S' },
  'power-word-kill':  { id: 'power-word-kill',  name: 'Power Word Kill',  level: 9, school: 'enchantment', range: '60 ft', components: 'V', duration: 'instantaneous' },
  'time-stop':        { id: 'time-stop',        name: 'Time Stop',        level: 9, school: 'transmutation', range: 'self', components: 'V', duration: 'instantaneous' },
  'true-polymorph':   { id: 'true-polymorph',   name: 'True Polymorph',   level: 9, school: 'transmutation', concentration: true, save: 'wis', range: '30 ft', components: 'V, S, M', duration: '1 hour' },
  'wish':             { id: 'wish',             name: 'Wish',             level: 9, school: 'conjuration',  range: 'self', components: 'V', duration: 'instantaneous' },
  'gate':             { id: 'gate',             name: 'Gate',             level: 9, school: 'conjuration',  concentration: true, range: '60 ft', components: 'V, S, M', duration: '1 minute' }
};
