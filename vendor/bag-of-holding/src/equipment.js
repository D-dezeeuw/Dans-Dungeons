// Equipment depth (SRD 5.2 § Equipment): encumbrance, armor
// don/doff time, tool proficiency. Pure helpers the host calls
// alongside Character.deriveSheet.

const ENCUMBRANCE_MULT = Object.freeze({
  none: 1,
  encumbered: 5,
  heavilyEncumbered: 10
});

// Encumbrance variant per SRD § Lifting and Carrying. Capacity is
// 15 lb per point of Strength; heavily-encumbered at 10× STR. The
// host passes the actor's STR score and the carried weight.
export function encumbranceLevel({ strength, carriedWeight }) {
  if (!Number.isFinite(strength) || strength < 0) {
    throw new Error('encumbranceLevel: strength must be a non-negative number');
  }
  if (!Number.isFinite(carriedWeight) || carriedWeight < 0) {
    throw new Error('encumbranceLevel: carriedWeight must be a non-negative number');
  }
  if (carriedWeight > strength * ENCUMBRANCE_MULT.heavilyEncumbered) {
    return 'heavily-encumbered';
  }
  if (carriedWeight > strength * ENCUMBRANCE_MULT.encumbered) {
    return 'encumbered';
  }
  return 'none';
}

// Speed penalty for the encumbrance variant per SRD: encumbered
// reduces speed by 10 ft, heavily-encumbered reduces by 20 ft.
export function encumbranceSpeedPenalty(level) {
  if (level === 'encumbered') return 10;
  if (level === 'heavily-encumbered') return 20;
  return 0;
}

// Heavy armor without meeting strRequired reduces speed by 10 ft per
// SRD § Armor. Returns the penalty (0 or 10).
export function armorStrengthPenalty(armor, strength) {
  if (!armor || !armor.strRequired) return 0;
  return strength < armor.strRequired ? 10 : 0;
}

// Total carried weight given an inventory and the items registry.
// Items without a `weight` field count as 0 (consumables, focuses).
export function carriedWeight(itemIds, items) {
  if (!Array.isArray(itemIds)) return 0;
  let total = 0;
  for (const id of itemIds) {
    const item = items[id];
    if (item && Number.isFinite(item.weight)) total += item.weight;
  }
  return total;
}

// Donning / doffing time in minutes for the equipped armor. Returns
// null for an unknown or shieldless slot.
export function donTime(armorId, items) {
  const armor = items[armorId];
  return armor && Number.isFinite(armor.donTime) ? armor.donTime : null;
}

export function doffTime(armorId, items) {
  const armor = items[armorId];
  return armor && Number.isFinite(armor.doffTime) ? armor.doffTime : null;
}

// Tool proficiency: a simple ability check with the actor's tool
// proficiency adding the engine's proficiency bonus when the
// `record.proficiencies.tools` list includes the tool id.
import { abilityCheck } from './checks.js';

export function toolCheck({ actor, toolId, abilityScore, dc, proficiencyBonus = 2 }, rng = Math.random) {
  if (!toolId) throw new Error('toolCheck: toolId is required');
  const tools = actor?.proficiencies?.tools ?? actor?.tools ?? [];
  const proficient = tools.includes(toolId);
  return abilityCheck({
    abilityScore: abilityScore ?? 10,
    proficient,
    proficiencyBonus,
    dc
  }, rng);
}

// Default adventuring-gear registry. Pure data: id, name, weight (lb).
// Hosts can extend through `extraItems` on createEngine.
export const ADVENTURING_GEAR = Object.freeze({
  'backpack':        Object.freeze({ id: 'backpack',        name: 'Backpack',         type: 'gear', weight: 5 }),
  'bedroll':         Object.freeze({ id: 'bedroll',         name: 'Bedroll',          type: 'gear', weight: 7 }),
  'rope-hempen-50':  Object.freeze({ id: 'rope-hempen-50',  name: 'Rope, Hempen (50 ft)', type: 'gear', weight: 10 }),
  'torch':           Object.freeze({ id: 'torch',           name: 'Torch',            type: 'gear', weight: 1 }),
  'rations-1-day':   Object.freeze({ id: 'rations-1-day',   name: 'Rations (1 day)',  type: 'gear', weight: 2 }),
  'waterskin':       Object.freeze({ id: 'waterskin',       name: 'Waterskin',        type: 'gear', weight: 5 }),
  'lantern-hooded':  Object.freeze({ id: 'lantern-hooded',  name: 'Hooded Lantern',   type: 'gear', weight: 2 }),
  'oil-flask':       Object.freeze({ id: 'oil-flask',       name: 'Oil (flask)',      type: 'gear', weight: 1 }),
  'crowbar':         Object.freeze({ id: 'crowbar',         name: 'Crowbar',          type: 'gear', weight: 5 }),
  'grappling-hook':  Object.freeze({ id: 'grappling-hook',  name: 'Grappling Hook',   type: 'gear', weight: 4 })
});

// Tool ids matching the SRD § Tool list. Hosts use these strings on
// record.proficiencies.tools.
export const TOOLS = Object.freeze({
  'alchemists-supplies': 'Alchemist\'s Supplies',
  'brewers-supplies':    'Brewer\'s Supplies',
  'carpenters-tools':    'Carpenter\'s Tools',
  'cartographers-tools': 'Cartographer\'s Tools',
  'cooks-utensils':      'Cook\'s Utensils',
  'disguise-kit':        'Disguise Kit',
  'forgery-kit':         'Forgery Kit',
  'herbalism-kit':       'Herbalism Kit',
  'masons-tools':        'Mason\'s Tools',
  'navigators-tools':    'Navigator\'s Tools',
  'painters-supplies':   'Painter\'s Supplies',
  'poisoners-kit':       'Poisoner\'s Kit',
  'smiths-tools':        'Smith\'s Tools',
  'thieves-tools':       'Thieves\' Tools',
  'tinkers-tools':       'Tinker\'s Tools',
  'weavers-tools':       'Weaver\'s Tools'
});

// Lifestyle expenses per SRD § Lifestyle Expenses (gp/day).
export const LIFESTYLES = Object.freeze({
  squalid:       0,
  poor:          0.2,
  modest:        1,
  comfortable:   2,
  wealthy:       4,
  aristocratic: 10
});

// Mounts and Other Animals per SRD 5.2 § Equipment. Cost in gp;
// speed in ft; carryingCapacity in lb. Each is a single-line record;
// hosts that want to wire a mount as an encounter actor build a
// monster record alongside (see src/srd/monsters.js).
export const MOUNTS = Object.freeze({
  'camel':         Object.freeze({ name: 'Camel',         cost: 50, speed: 50, carryingCapacity: 480 }),
  'donkey':        Object.freeze({ name: 'Donkey',        cost: 8,  speed: 40, carryingCapacity: 420 }),
  'draft-horse':   Object.freeze({ name: 'Draft Horse',   cost: 50, speed: 40, carryingCapacity: 540 }),
  'elephant':      Object.freeze({ name: 'Elephant',      cost: 200, speed: 40, carryingCapacity: 1320 }),
  'mastiff':       Object.freeze({ name: 'Mastiff',       cost: 25, speed: 40, carryingCapacity: 195 }),
  'mule':          Object.freeze({ name: 'Mule',          cost: 8,  speed: 40, carryingCapacity: 420 }),
  'pony':          Object.freeze({ name: 'Pony',          cost: 30, speed: 40, carryingCapacity: 225 }),
  'riding-horse':  Object.freeze({ name: 'Riding Horse',  cost: 75, speed: 60, carryingCapacity: 480 }),
  'warhorse':      Object.freeze({ name: 'Warhorse',      cost: 400, speed: 60, carryingCapacity: 540 })
});

// Tack, Harness, and Drawn Vehicles per SRD 5.2 § Equipment.
// Vehicles list cost + speed where applicable; tack is mundane gear.
export const VEHICLES = Object.freeze({
  'barding':       Object.freeze({ name: 'Barding',       cost: 'armor x4', weight: 'armor x2', notes: 'Armor for a mount; multiplies base armor cost/weight.' }),
  'bit-bridle':    Object.freeze({ name: 'Bit and Bridle', cost: 2, weight: 1 }),
  'saddle-exotic': Object.freeze({ name: 'Exotic Saddle', cost: 60, weight: 40 }),
  'saddle-military': Object.freeze({ name: 'Military Saddle', cost: 20, weight: 30 }),
  'saddle-pack':   Object.freeze({ name: 'Pack Saddle',   cost: 5,  weight: 15 }),
  'saddle-riding': Object.freeze({ name: 'Riding Saddle', cost: 10, weight: 25 }),
  'saddlebags':    Object.freeze({ name: 'Saddlebags',    cost: 4,  weight: 8 }),
  'stabling-per-day': Object.freeze({ name: 'Stabling (per day)', cost: 0.5 }),
  'carriage':      Object.freeze({ name: 'Carriage',      cost: 100, weight: 600 }),
  'cart':          Object.freeze({ name: 'Cart',          cost: 15, weight: 200 }),
  'chariot':       Object.freeze({ name: 'Chariot',       cost: 250, weight: 100 }),
  'sled':          Object.freeze({ name: 'Sled',          cost: 20, weight: 300 }),
  'wagon':         Object.freeze({ name: 'Wagon',         cost: 35, weight: 400 }),
  'galley':        Object.freeze({ name: 'Galley',        cost: 30000, speed: 4,  notes: 'Waterborne; speed in mph.' }),
  'keelboat':      Object.freeze({ name: 'Keelboat',      cost: 3000,  speed: 1,  notes: 'Waterborne; speed in mph.' }),
  'longship':      Object.freeze({ name: 'Longship',      cost: 10000, speed: 3,  notes: 'Waterborne; speed in mph.' }),
  'rowboat':       Object.freeze({ name: 'Rowboat',       cost: 50,    speed: 1.5, notes: 'Waterborne; speed in mph.' }),
  'sailing-ship':  Object.freeze({ name: 'Sailing Ship',  cost: 10000, speed: 2,  notes: 'Waterborne; speed in mph.' }),
  'warship':       Object.freeze({ name: 'Warship',       cost: 25000, speed: 2.5, notes: 'Waterborne; speed in mph.' })
});

// Trade Goods per SRD 5.2 § Equipment — Trade Goods.
// Standardised prices for commodities (cost in gp per unit).
export const TRADE_GOODS = Object.freeze({
  'wheat-1lb':         Object.freeze({ name: 'Wheat',         unit: '1 lb', cost: 0.01 }),
  'flour-1lb':         Object.freeze({ name: 'Flour',         unit: '1 lb', cost: 0.02 }),
  'chicken':           Object.freeze({ name: 'Chicken',       unit: '1 head', cost: 0.02 }),
  'salt-1lb':          Object.freeze({ name: 'Salt',          unit: '1 lb', cost: 0.05 }),
  'iron-1lb':          Object.freeze({ name: 'Iron',          unit: '1 lb', cost: 0.1 }),
  'canvas-1sq-yd':     Object.freeze({ name: 'Canvas',        unit: '1 sq yd', cost: 0.1 }),
  'copper-1lb':        Object.freeze({ name: 'Copper',        unit: '1 lb', cost: 0.5 }),
  'cotton-cloth-1sq-yd':Object.freeze({ name: 'Cotton Cloth',  unit: '1 sq yd', cost: 0.5 }),
  'ginger-1lb':        Object.freeze({ name: 'Ginger',        unit: '1 lb', cost: 1 }),
  'goat':              Object.freeze({ name: 'Goat',          unit: '1 head', cost: 1 }),
  'cinnamon-1lb':      Object.freeze({ name: 'Cinnamon',      unit: '1 lb', cost: 2 }),
  'pepper-1lb':        Object.freeze({ name: 'Pepper',        unit: '1 lb', cost: 2 }),
  'sheep':             Object.freeze({ name: 'Sheep',         unit: '1 head', cost: 2 }),
  'silver-1lb':        Object.freeze({ name: 'Silver',        unit: '1 lb', cost: 5 }),
  'linen-1sq-yd':      Object.freeze({ name: 'Linen',         unit: '1 sq yd', cost: 5 }),
  'pig':               Object.freeze({ name: 'Pig',           unit: '1 head', cost: 3 }),
  'cloves-1lb':        Object.freeze({ name: 'Cloves',        unit: '1 lb', cost: 15 }),
  'silk-1sq-yd':       Object.freeze({ name: 'Silk',          unit: '1 sq yd', cost: 10 }),
  'cow':               Object.freeze({ name: 'Cow',           unit: '1 head', cost: 10 }),
  'saffron-1lb':       Object.freeze({ name: 'Saffron',       unit: '1 lb', cost: 15 }),
  'ox':                Object.freeze({ name: 'Ox',            unit: '1 head', cost: 15 }),
  'gold-1lb':          Object.freeze({ name: 'Gold',          unit: '1 lb', cost: 50 }),
  'platinum-1lb':      Object.freeze({ name: 'Platinum',      unit: '1 lb', cost: 500 })
});

// Treasure Hoard tables per SRD 5.2 § Treasure. Bucketed by CR band
// (Challenge 0-4 / 5-10 / 11-16 / 17+). Each entry lists the rolled
// coin dice and indicative magic-item table tier. The exact d100
// breakdowns for art objects, gems, and per-item Tables A-I are
// abbreviated here; hosts that want full SRD precision wire their
// own d100 rolls against the canonical tables.
export const TREASURE_HOARDS = Object.freeze({
  'cr-0-4': Object.freeze({
    band: '0-4',
    coins: Object.freeze({ cp: '6d6 * 100', sp: '3d6 * 100', gp: '2d6 * 10' }),
    gemsOrArt: Object.freeze({ rollDc: 'd100', typical: '2d6 gems @ 10 gp each OR 2d4 art objects @ 25 gp each' }),
    magicItemTable: 'A or B'
  }),
  'cr-5-10': Object.freeze({
    band: '5-10',
    coins: Object.freeze({ cp: '2d6 * 100', sp: '2d6 * 1000', gp: '6d6 * 100', pp: '3d6 * 10' }),
    gemsOrArt: Object.freeze({ rollDc: 'd100', typical: '3d6 gems @ 100 gp each OR 3d6 art objects @ 250 gp each' }),
    magicItemTable: 'C / D / E (uncommon to rare)'
  }),
  'cr-11-16': Object.freeze({
    band: '11-16',
    coins: Object.freeze({ gp: '4d6 * 1000', pp: '5d6 * 100' }),
    gemsOrArt: Object.freeze({ rollDc: 'd100', typical: '3d6 gems @ 500 gp each OR 2d4 art objects @ 750 gp each' }),
    magicItemTable: 'F / G (rare to very rare)'
  }),
  'cr-17-plus': Object.freeze({
    band: '17+',
    coins: Object.freeze({ gp: '12d6 * 1000', pp: '8d6 * 1000' }),
    gemsOrArt: Object.freeze({ rollDc: 'd100', typical: '1d8 gems @ 5000 gp each OR 1d10 art objects @ 7500 gp each' }),
    magicItemTable: 'H / I (very rare to legendary)'
  })
});

// Individual Treasure tables per SRD 5.2 § Treasure (carried coin
// on a single creature; one row per CR band).
export const INDIVIDUAL_TREASURE = Object.freeze({
  'cr-0-4':     Object.freeze({ coins: Object.freeze({ cp: '5d6', sp: '4d6', gp: '3d6' }) }),
  'cr-5-10':    Object.freeze({ coins: Object.freeze({ cp: '4d6*10', sp: '6d6*10', gp: '6d6*10', pp: '3d6' }) }),
  'cr-11-16':   Object.freeze({ coins: Object.freeze({ gp: '4d6*100', pp: '2d6*10' }) }),
  'cr-17-plus': Object.freeze({ coins: Object.freeze({ gp: '12d6*100', pp: '8d6*10' }) })
});

// Services per SRD § Services (gp).
export const SERVICES = Object.freeze({
  'coach-cab':         Object.freeze({ name: 'Coach Cab (between towns)', cost: 0.03 }),
  'hireling-skilled':  Object.freeze({ name: 'Hireling, skilled (per day)', cost: 2 }),
  'hireling-untrained':Object.freeze({ name: 'Hireling, untrained (per day)', cost: 0.2 }),
  'messenger':         Object.freeze({ name: 'Messenger (per mile)', cost: 0.02 }),
  'roadside-tax':      Object.freeze({ name: 'Roadside Tax', cost: 0.01 }),
  'ship-passage':      Object.freeze({ name: 'Ship\'s Passage (per mile)', cost: 0.1 })
});

export const Equipment = Object.freeze({
  ENCUMBRANCE_MULT,
  ADVENTURING_GEAR,
  TOOLS,
  LIFESTYLES,
  SERVICES,
  MOUNTS,
  VEHICLES,
  TRADE_GOODS,
  TREASURE_HOARDS,
  INDIVIDUAL_TREASURE,
  encumbranceLevel,
  encumbranceSpeedPenalty,
  armorStrengthPenalty,
  carriedWeight,
  donTime,
  doffTime,
  toolCheck
});

export default Equipment;
