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
//
// Armor fields (since v1.17.0):
//   armorCategory    — 'light' | 'medium' | 'heavy'.
//   stealthDisadvantage — true when the armor imposes Stealth
//                      disadvantage per SRD Armor table. Omitted
//                      (i.e. falsy) when the armor has no penalty.
//   strRequirement   — minimum STR score required; speed –10 ft when
//                      unmet. Heavy armor only (chain mail, splint,
//                      plate). Omitted when there is no requirement.
//   donMinutes       — minutes to don (light: 1, medium: 5, heavy: 10).
//   doffMinutes      — minutes to doff (light: 1, medium: 1, heavy: 5).
//   Shields use an action to don/doff and carry no donMinutes /
//   doffMinutes field.

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

  // Armor. category = light / medium / heavy / shield; donTime + doffTime
  // in minutes; strRequired + stealthDisadvantage per SRD 5.2 Armor table.
  'padded':           { id: 'padded',           name: 'Padded Armor',     type: 'armor', category: 'light',  ac: 11, addsDex: true,  weight: 8,  donTime: 1, doffTime: 1, stealthDisadvantage: true },
  'leather-armor':    { id: 'leather-armor',    name: 'Leather Armor',    type: 'armor', category: 'light',  ac: 11, addsDex: true,  weight: 10, donTime: 1, doffTime: 1 },
  'studded-leather':  { id: 'studded-leather',  name: 'Studded Leather',  type: 'armor', category: 'light',  ac: 12, addsDex: true,  weight: 13, donTime: 1, doffTime: 1 },
  'hide':             { id: 'hide',             name: 'Hide',             type: 'armor', category: 'medium', ac: 12, addsDex: true,  maxDex: 2, weight: 12, donTime: 1, doffTime: 1 },
  'chain-shirt':      { id: 'chain-shirt',      name: 'Chain Shirt',      type: 'armor', category: 'medium', ac: 13, addsDex: true,  maxDex: 2, weight: 20, donTime: 1, doffTime: 1 },
  'scale-mail':       { id: 'scale-mail',       name: 'Scale Mail',       type: 'armor', category: 'medium', ac: 14, addsDex: true,  maxDex: 2, weight: 45, donTime: 5, doffTime: 1, stealthDisadvantage: true },
  'breastplate':      { id: 'breastplate',      name: 'Breastplate',      type: 'armor', category: 'medium', ac: 14, addsDex: true,  maxDex: 2, weight: 20, donTime: 5, doffTime: 1 },
  'half-plate':       { id: 'half-plate',       name: 'Half Plate',       type: 'armor', category: 'medium', ac: 15, addsDex: true,  maxDex: 2, weight: 40, donTime: 5, doffTime: 1, stealthDisadvantage: true },
  'ring-mail':        { id: 'ring-mail',        name: 'Ring Mail',        type: 'armor', category: 'heavy',  ac: 14, addsDex: false, weight: 40, donTime: 5, doffTime: 5, stealthDisadvantage: true },
  'chain-mail':       { id: 'chain-mail',       name: 'Chain Mail',       type: 'armor', category: 'heavy',  ac: 16, addsDex: false, weight: 55, donTime: 5, doffTime: 5, stealthDisadvantage: true, strRequired: 13 },
  'splint':           { id: 'splint',           name: 'Splint',           type: 'armor', category: 'heavy',  ac: 17, addsDex: false, weight: 60, donTime: 10, doffTime: 5, stealthDisadvantage: true, strRequired: 15 },
  'plate':            { id: 'plate',            name: 'Plate Armor',      type: 'armor', category: 'heavy',  ac: 18, addsDex: false, weight: 65, donTime: 10, doffTime: 5, stealthDisadvantage: true, strRequired: 15 },
  'shield':           { id: 'shield',           name: 'Shield',           type: 'armor', category: 'shield', acBonus: 2, weight: 6, donTime: 0, doffTime: 0 },

  // Consumables
  'potion-healing':         { id: 'potion-healing',         name: 'Potion of Healing',         type: 'consumable', heals: '2d4+2' },
  'potion-greater-healing': { id: 'potion-greater-healing', name: 'Potion of Greater Healing', type: 'consumable', heals: '4d4+4' },
  'potion-superior-healing':{ id: 'potion-superior-healing',name: 'Potion of Superior Healing',type: 'consumable', heals: '8d4+8' },

  // Mundane adventuring gear. These are intentionally in the items
  // registry so encumbrance + inventory tooling can resolve them.
  'arrows-20':           { id: 'arrows-20',           name: 'Arrows (20)',              type: 'gear', weight: 1 },
  'crossbow-bolts-20':   { id: 'crossbow-bolts-20',   name: 'Crossbow Bolts (20)',      type: 'gear', weight: 1.5 },
  'sling-bullets-20':    { id: 'sling-bullets-20',    name: 'Sling Bullets (20)',       type: 'gear', weight: 1.5 },
  'bedroll-srd':         { id: 'bedroll-srd',         name: 'Bedroll',                  type: 'gear', weight: 7 },
  'blanket':             { id: 'blanket',             name: 'Blanket',                  type: 'gear', weight: 3 },
  'rope-hempen-50-srd':  { id: 'rope-hempen-50-srd',  name: 'Hempen Rope (50 ft)',      type: 'gear', weight: 10 },
  'tinderbox':           { id: 'tinderbox',           name: 'Tinderbox',                type: 'gear', weight: 1 },
  'candle':              { id: 'candle',              name: 'Candle',                   type: 'gear', weight: 0 },
  'chain-10':            { id: 'chain-10',            name: 'Chain (10 ft)',            type: 'gear', weight: 10 },
  'climbers-kit':        { id: 'climbers-kit',        name: "Climber's Kit",            type: 'gear', weight: 12 },
  'healers-kit':         { id: 'healers-kit',         name: "Healer's Kit",             type: 'gear', weight: 3 },
  'holy-symbol':         { id: 'holy-symbol',         name: 'Holy Symbol',              type: 'gear', weight: 1 },
  'spellbook':           { id: 'spellbook',           name: 'Spellbook',                type: 'gear', weight: 3 },
  'component-pouch':     { id: 'component-pouch',     name: 'Component Pouch',          type: 'gear', weight: 2 },
  'arcane-focus-orb':    { id: 'arcane-focus-orb',    name: 'Arcane Focus (Orb)',       type: 'gear', weight: 3 },

  // Wondrous magic items. Charge specs use the `recovers` field that
  // magic-items.rechargeItem reads; `rechargesOn` tags the trigger.
  'bag-of-holding':            { id: 'bag-of-holding',            name: 'Bag of Holding',            type: 'wondrous', rarity: 'uncommon', weight: 15 },
  'cloak-of-elvenkind':        { id: 'cloak-of-elvenkind',        name: 'Cloak of Elvenkind',        type: 'wondrous', rarity: 'uncommon', attunement: true },
  'cloak-of-protection':       { id: 'cloak-of-protection',       name: 'Cloak of Protection',       type: 'wondrous', rarity: 'uncommon', attunement: true },
  'ring-of-protection':        { id: 'ring-of-protection',        name: 'Ring of Protection',        type: 'wondrous', rarity: 'rare',     attunement: true },
  'ring-of-fire-resistance':   { id: 'ring-of-fire-resistance',   name: 'Ring of Fire Resistance',   type: 'wondrous', rarity: 'rare',     attunement: true },
  'boots-of-elvenkind':        { id: 'boots-of-elvenkind',        name: 'Boots of Elvenkind',        type: 'wondrous', rarity: 'uncommon', attunement: true },
  'boots-of-speed':            { id: 'boots-of-speed',            name: 'Boots of Speed',            type: 'wondrous', rarity: 'rare',     attunement: true },
  'boots-of-striding-and-springing': { id: 'boots-of-striding-and-springing', name: 'Boots of Striding and Springing', type: 'wondrous', rarity: 'uncommon', attunement: true },
  'bracers-of-defense':        { id: 'bracers-of-defense',        name: 'Bracers of Defense',        type: 'wondrous', rarity: 'rare',     attunement: true },
  'gloves-of-thievery':        { id: 'gloves-of-thievery',        name: 'Gloves of Thievery',        type: 'wondrous', rarity: 'uncommon' },
  'eyes-of-the-eagle':         { id: 'eyes-of-the-eagle',         name: 'Eyes of the Eagle',         type: 'wondrous', rarity: 'uncommon', attunement: true },
  'hat-of-disguise':           { id: 'hat-of-disguise',           name: 'Hat of Disguise',           type: 'wondrous', rarity: 'uncommon', attunement: true },
  'headband-of-intellect':     { id: 'headband-of-intellect',     name: 'Headband of Intellect',     type: 'wondrous', rarity: 'uncommon', attunement: true },
  'amulet-of-health':          { id: 'amulet-of-health',          name: 'Amulet of Health',          type: 'wondrous', rarity: 'rare',     attunement: true },
  'broom-of-flying':           { id: 'broom-of-flying',           name: 'Broom of Flying',           type: 'wondrous', rarity: 'uncommon', weight: 3 },
  'gauntlets-of-ogre-power':   { id: 'gauntlets-of-ogre-power',   name: 'Gauntlets of Ogre Power',   type: 'wondrous', rarity: 'uncommon', attunement: true },
  'pearl-of-power':            { id: 'pearl-of-power',            name: 'Pearl of Power',            type: 'wondrous', rarity: 'uncommon', attunement: true, charges: { max: 1, recovers: 1, rechargesOn: 'dawn' } },

  // Magic weapons. `+1` weapons carry the same combat shape as
  // their mundane base; the host applies the +1 to attack/damage.
  'longsword-plus-1':          { id: 'longsword-plus-1',          name: 'Longsword +1',              type: 'weapon', damage: '1d8', damageType: 'slashing', properties: ['versatile', 'magic'], mastery: 'sap', rarity: 'uncommon' },
  'longbow-plus-1':            { id: 'longbow-plus-1',            name: 'Longbow +1',                type: 'weapon', damage: '1d8', damageType: 'piercing', properties: ['heavy', 'ranged', 'two-handed', 'magic'], mastery: 'slow', rarity: 'uncommon' },
  'dagger-plus-1':             { id: 'dagger-plus-1',             name: 'Dagger +1',                 type: 'weapon', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light', 'thrown', 'magic'], mastery: 'nick', rarity: 'uncommon' },
  'flame-tongue':              { id: 'flame-tongue',              name: 'Flame Tongue',              type: 'weapon', damage: '1d8', damageType: 'slashing', properties: ['versatile', 'magic'], mastery: 'sap', rarity: 'rare', attunement: true },
  'vorpal-sword':              { id: 'vorpal-sword',              name: 'Vorpal Sword',              type: 'weapon', damage: '1d8', damageType: 'slashing', properties: ['versatile', 'magic'], mastery: 'sap', rarity: 'legendary', attunement: true },
  'sun-blade':                 { id: 'sun-blade',                 name: 'Sun Blade',                 type: 'weapon', damage: '1d8', damageType: 'radiant',  properties: ['finesse', 'versatile', 'magic'], mastery: 'sap', rarity: 'rare', attunement: true },
  'dragon-slayer-longsword':   { id: 'dragon-slayer-longsword',   name: 'Dragon Slayer (Longsword)', type: 'weapon', damage: '1d8', damageType: 'slashing', properties: ['versatile', 'magic'], mastery: 'sap', rarity: 'rare' },
  'frost-brand':               { id: 'frost-brand',               name: 'Frost Brand',               type: 'weapon', damage: '1d8', damageType: 'slashing', properties: ['versatile', 'magic'], mastery: 'sap', rarity: 'very-rare', attunement: true },

  // Magic armor + shields.
  'plate-plus-1':              { id: 'plate-plus-1',              name: 'Plate Armor +1',            type: 'armor', category: 'heavy',  ac: 19, addsDex: false, weight: 65, donTime: 10, doffTime: 5, stealthDisadvantage: true, strRequired: 15, rarity: 'rare' },
  'shield-plus-1':             { id: 'shield-plus-1',             name: 'Shield +1',                 type: 'armor', category: 'shield', acBonus: 3, weight: 6, donTime: 0, doffTime: 0, rarity: 'uncommon' },
  'dwarven-plate':             { id: 'dwarven-plate',             name: 'Dwarven Plate',             type: 'armor', category: 'heavy',  ac: 20, addsDex: false, weight: 65, donTime: 10, doffTime: 5, stealthDisadvantage: true, strRequired: 15, rarity: 'very-rare' },
  'elven-chain':               { id: 'elven-chain',               name: 'Elven Chain',               type: 'armor', category: 'medium', ac: 14, addsDex: true, maxDex: 2, weight: 20, donTime: 1, doffTime: 1, rarity: 'rare' },

  // Consumable magic items.
  'potion-fire-resistance':    { id: 'potion-fire-resistance',    name: 'Potion of Fire Resistance', type: 'consumable', rarity: 'uncommon' },
  'potion-flying':             { id: 'potion-flying',             name: 'Potion of Flying',          type: 'consumable', rarity: 'very-rare' },
  'potion-invisibility':       { id: 'potion-invisibility',       name: 'Potion of Invisibility',    type: 'consumable', rarity: 'very-rare' },
  'potion-heroism':            { id: 'potion-heroism',            name: 'Potion of Heroism',         type: 'consumable', rarity: 'rare' },
  'oil-of-sharpness':          { id: 'oil-of-sharpness',          name: 'Oil of Sharpness',          type: 'consumable', rarity: 'very-rare' },
  'spell-scroll-fireball':     { id: 'spell-scroll-fireball',     name: 'Spell Scroll (Fireball)',   type: 'consumable', rarity: 'rare' },

  // Wands / staves / rods. Per SRD: a wand with charges typically
  // recovers `1d6+1` at dawn and risks destruction if expended.
  'wand-of-magic-missiles':    { id: 'wand-of-magic-missiles',    name: 'Wand of Magic Missiles',    type: 'wand', rarity: 'uncommon', attunement: false, charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' } },
  'wand-of-fireballs':         { id: 'wand-of-fireballs',         name: 'Wand of Fireballs',         type: 'wand', rarity: 'rare',     attunement: true,  charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' } },
  'wand-of-lightning-bolts':   { id: 'wand-of-lightning-bolts',   name: 'Wand of Lightning Bolts',   type: 'wand', rarity: 'rare',     attunement: true,  charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' } },
  'wand-of-paralysis':         { id: 'wand-of-paralysis',         name: 'Wand of Paralysis',         type: 'wand', rarity: 'rare',     attunement: true,  charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' } },
  'wand-of-fear':              { id: 'wand-of-fear',              name: 'Wand of Fear',              type: 'wand', rarity: 'rare',     attunement: true,  charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' } },
  'staff-of-fire':             { id: 'staff-of-fire',             name: 'Staff of Fire',             type: 'staff', rarity: 'very-rare', attunement: true, charges: { max: 10, recovers: '1d6+4', rechargesOn: 'dawn' } },
  'staff-of-the-magi':         { id: 'staff-of-the-magi',         name: 'Staff of the Magi',         type: 'staff', rarity: 'legendary', attunement: true, charges: { max: 50, recovers: '4d6+2', rechargesOn: 'dawn' } },
  'rod-of-lordly-might':       { id: 'rod-of-lordly-might',       name: 'Rod of Lordly Might',       type: 'rod', rarity: 'legendary', attunement: true }
};
