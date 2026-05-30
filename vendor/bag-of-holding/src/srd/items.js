// SRD 5.2 items — weapons (with mastery assignments), armor, shields,
// and a representative consumable set. Mastery effects are resolved
// through Combat.applyMastery.
//
// Weapon mastery assignments per the SRD Weapons table:
//   longsword/scimitar/battleaxe   → sap
//   shortbow/light-crossbow/rapier → vex
//   dagger/sickle                  → nick
//   quarterstaff/warhammer/maul    → topple
//   greataxe/halberd/glaive        → cleave
//   javelin/handaxe/pike           → slow
//   mace/morningstar/flail         → sap
//   greatsword                     → graze
//   spear/trident                  → push
//   light-hammer                   → nick

export default {
  // Simple melee weapons
  'club':           { id: 'club',           name: 'Club',            type: 'weapon', damage: '1d4', damageType: 'bludgeoning', properties: ['light'],                  mastery: 'slow' },
  'dagger':         { id: 'dagger',         name: 'Dagger',          type: 'weapon', damage: '1d4', damageType: 'piercing',    properties: ['finesse', 'light', 'thrown'], mastery: 'nick' },
  'handaxe':        { id: 'handaxe',        name: 'Handaxe',         type: 'weapon', damage: '1d6', damageType: 'slashing',    properties: ['light', 'thrown'],        mastery: 'vex' },
  'javelin':        { id: 'javelin',        name: 'Javelin',         type: 'weapon', damage: '1d6', damageType: 'piercing',    properties: ['thrown'],                 mastery: 'slow' },
  'light-hammer':   { id: 'light-hammer',   name: 'Light Hammer',    type: 'weapon', damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown'],        mastery: 'nick' },
  'mace':           { id: 'mace',           name: 'Mace',            type: 'weapon', damage: '1d6', damageType: 'bludgeoning', properties: [],                         mastery: 'sap' },
  'quarterstaff':   { id: 'quarterstaff',   name: 'Quarterstaff',    type: 'weapon', damage: '1d6', damageType: 'bludgeoning', properties: ['versatile'],              mastery: 'topple' },
  'sickle':         { id: 'sickle',         name: 'Sickle',          type: 'weapon', damage: '1d4', damageType: 'slashing',    properties: ['finesse', 'light'],       mastery: 'nick' },
  'spear':          { id: 'spear',          name: 'Spear',           type: 'weapon', damage: '1d6', damageType: 'piercing',    properties: ['thrown', 'versatile'],    mastery: 'push' },

  // Simple ranged
  'shortbow':       { id: 'shortbow',       name: 'Shortbow',        type: 'weapon', damage: '1d6', damageType: 'piercing',    properties: ['ranged', 'two-handed'],   mastery: 'vex' },
  'crossbow-light': { id: 'crossbow-light', name: 'Light Crossbow',  type: 'weapon', damage: '1d8', damageType: 'piercing',    properties: ['ranged', 'two-handed'],   mastery: 'slow' },

  // Martial melee
  'battleaxe':      { id: 'battleaxe',      name: 'Battleaxe',       type: 'weapon', damage: '1d8',  damageType: 'slashing',    properties: ['versatile'],             mastery: 'topple' },
  'flail':          { id: 'flail',          name: 'Flail',           type: 'weapon', damage: '1d8',  damageType: 'bludgeoning', properties: [],                        mastery: 'sap' },
  'glaive':         { id: 'glaive',         name: 'Glaive',          type: 'weapon', damage: '1d10', damageType: 'slashing',    properties: ['heavy', 'reach', 'two-handed'], mastery: 'graze' },
  'greataxe':       { id: 'greataxe',       name: 'Greataxe',        type: 'weapon', damage: '1d12', damageType: 'slashing',    properties: ['heavy', 'two-handed'],   mastery: 'cleave' },
  'greatsword':     { id: 'greatsword',     name: 'Greatsword',      type: 'weapon', damage: '2d6',  damageType: 'slashing',    properties: ['heavy', 'two-handed'],   mastery: 'graze' },
  'halberd':        { id: 'halberd',        name: 'Halberd',         type: 'weapon', damage: '1d10', damageType: 'slashing',    properties: ['heavy', 'reach', 'two-handed'], mastery: 'cleave' },
  'longsword':      { id: 'longsword',      name: 'Longsword',       type: 'weapon', damage: '1d8',  damageType: 'slashing',    properties: ['versatile'],             mastery: 'sap' },
  'maul':           { id: 'maul',           name: 'Maul',            type: 'weapon', damage: '2d6',  damageType: 'bludgeoning', properties: ['heavy', 'two-handed'],   mastery: 'topple' },
  'morningstar':    { id: 'morningstar',    name: 'Morningstar',     type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: [],                        mastery: 'sap' },
  'pike':           { id: 'pike',           name: 'Pike',            type: 'weapon', damage: '1d10', damageType: 'piercing',    properties: ['heavy', 'reach', 'two-handed'], mastery: 'push' },
  'rapier':         { id: 'rapier',         name: 'Rapier',          type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: ['finesse'],               mastery: 'vex' },
  'scimitar':       { id: 'scimitar',       name: 'Scimitar',        type: 'weapon', damage: '1d6',  damageType: 'slashing',    properties: ['finesse', 'light'],      mastery: 'sap' },
  'shortsword':     { id: 'shortsword',     name: 'Shortsword',      type: 'weapon', damage: '1d6',  damageType: 'piercing',    properties: ['finesse', 'light'],      mastery: 'vex' },
  'trident':        { id: 'trident',        name: 'Trident',         type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: ['thrown', 'versatile'],   mastery: 'topple' },
  'warhammer':      { id: 'warhammer',      name: 'Warhammer',       type: 'weapon', damage: '1d8',  damageType: 'bludgeoning', properties: ['versatile'],             mastery: 'push' },

  // Martial ranged
  'longbow':        { id: 'longbow',        name: 'Longbow',         type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: ['heavy', 'ranged', 'two-handed'], mastery: 'slow' },
  'crossbow-heavy': { id: 'crossbow-heavy', name: 'Heavy Crossbow',  type: 'weapon', damage: '1d10', damageType: 'piercing',    properties: ['heavy', 'ranged', 'two-handed'], mastery: 'push' },

  // Armor
  'padded':           { id: 'padded',           name: 'Padded Armor',     type: 'armor', ac: 11, addsDex: true },
  'leather-armor':    { id: 'leather-armor',    name: 'Leather Armor',    type: 'armor', ac: 11, addsDex: true },
  'studded-leather':  { id: 'studded-leather',  name: 'Studded Leather',  type: 'armor', ac: 12, addsDex: true },
  'hide':             { id: 'hide',             name: 'Hide',             type: 'armor', ac: 12, addsDex: true, maxDex: 2 },
  'chain-shirt':      { id: 'chain-shirt',      name: 'Chain Shirt',      type: 'armor', ac: 13, addsDex: true, maxDex: 2 },
  'scale-mail':       { id: 'scale-mail',       name: 'Scale Mail',       type: 'armor', ac: 14, addsDex: true, maxDex: 2 },
  'breastplate':      { id: 'breastplate',      name: 'Breastplate',      type: 'armor', ac: 14, addsDex: true, maxDex: 2 },
  'half-plate':       { id: 'half-plate',       name: 'Half Plate',       type: 'armor', ac: 15, addsDex: true, maxDex: 2 },
  'ring-mail':        { id: 'ring-mail',        name: 'Ring Mail',        type: 'armor', ac: 14, addsDex: false },
  'chain-mail':       { id: 'chain-mail',       name: 'Chain Mail',       type: 'armor', ac: 16, addsDex: false },
  'splint':           { id: 'splint',           name: 'Splint',           type: 'armor', ac: 17, addsDex: false },
  'plate':            { id: 'plate',            name: 'Plate Armor',      type: 'armor', ac: 18, addsDex: false },
  'shield':           { id: 'shield',           name: 'Shield',           type: 'armor', acBonus: 2 },

  // Consumables
  'potion-healing':         { id: 'potion-healing',         name: 'Potion of Healing',         type: 'consumable', heals: '2d4+2' },
  'potion-greater-healing': { id: 'potion-greater-healing', name: 'Potion of Greater Healing', type: 'consumable', heals: '4d4+4' },
  'potion-superior-healing':{ id: 'potion-superior-healing',name: 'Potion of Superior Healing',type: 'consumable', heals: '8d4+8' }
};
