// src/game/character.js
//
// Text-based character creation wizard.
// Returns { record, sheet } or null if the player cancelled.

import { SRD, Character, createEngine } from './rules.js';

// ─── Starter options ──────────────────────────────────────────────────────────

// Four starter classes for Phase 3 (expand in Phase 7)
const STARTER_CLASSES = ['fighter', 'rogue', 'cleric', 'wizard'];

// Default equipment per class (armorId, shieldId, weaponIds)
const CLASS_EQUIPMENT = {
  fighter: { armorId: 'chain-mail',   shieldId: 'shield', weaponIds: ['longsword'] },
  rogue:   { armorId: 'leather-armor',                    weaponIds: ['shortsword', 'dagger'] },
  cleric:  { armorId: 'chain-mail',   shieldId: 'shield', weaponIds: ['mace'] },
  wizard:  {                                               weaponIds: ['quarterstaff'] },
};

// Standard array: str, dex, con, int, wis, cha
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// ─── Wizard ───────────────────────────────────────────────────────────────────

export async function createCharacter(ui) {
  ui.clear();
  ui.appendEntry('system', '═══════════════════════════');
  ui.appendEntry('system', '    CHARACTER CREATION');
  ui.appendEntry('system', '═══════════════════════════');
  ui.appendEntry('system', '');

  // Name
  const name = await ui.prompt('What is your adventurer\'s name?');
  if (!name.trim()) return null;

  // Class
  const classId = await ui.pickFrom('Choose your class:', STARTER_CLASSES, (c) =>
    c.charAt(0).toUpperCase() + c.slice(1)
  );

  // Species (all SRD species)
  const speciesIds = Object.keys(SRD.species);
  const speciesId = await ui.pickFrom('Choose your species:', speciesIds, (s) =>
    SRD.species[s]?.name ?? (s.charAt(0).toUpperCase() + s.slice(1))
  );

  // Background (all SRD backgrounds — only 4 in this version)
  const bgIds = Object.keys(SRD.backgrounds);
  const bgId = await ui.pickFrom('Choose your background:', bgIds, (b) =>
    SRD.backgrounds[b]?.name ?? (b.charAt(0).toUpperCase() + b.slice(1))
  );

  ui.appendEntry('system', '');
  ui.appendEntry('system', `Forging ${name.trim()}'s fate…`);

  // Build the host-owned record
  const record = {
    id:          `pc-${Date.now()}`,
    name:        name.trim(),
    classId,
    speciesId,
    backgroundId: bgId,
    level:       1,
    abilityScores: {
      str: STANDARD_ARRAY[0],
      dex: STANDARD_ARRAY[1],
      con: STANDARD_ARRAY[2],
      int: STANDARD_ARRAY[3],
      wis: STANDARD_ARRAY[4],
      cha: STANDARD_ARRAY[5],
    },
    equipment:   CLASS_EQUIPMENT[classId] ?? { weaponIds: [] },
    conditions:  [],
    exhaustion:  0,
    xp:          0,
    notes:       '',
    // Runtime HP tracking (not in DerivedSheet — host owns current HP)
    hpCurrent:   null,  // filled below after derivation
  };

  // Derive the sheet
  const engine = createEngine();
  const sheet  = engine.deriveSheet(record);

  // Initialise current HP to max
  record.hpCurrent = sheet.hp.max;

  return { record, sheet };
}
