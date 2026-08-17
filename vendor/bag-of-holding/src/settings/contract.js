// === The setting plugin contract (3.3.0) ===
//
// Sundermark, Brassgear and the Hollow Vale each shipped the same shape
// ad-hoc; this module formalises it so third-party settings validate
// against a contract instead of imitating examples, and so two settings
// can be active simultaneously for crossover play.
//
// A setting pack is a frozen bundle: `{ id, name, pitch }` plus any of
// the CONTENT TABLES below. Tables split into two kinds:
//   - slotted:  mounted through createEngine's plugin slots
//               (regions, npcs, hooks→extraStoryHooks, adventures,
//               species, backgrounds, feats, items, monsters, spells)
//   - pack-data: consumed by hosts directly, never mounted
//               (cities, factions, and any setting-specific extras —
//               talents, dread, tinker...)
//
// `validate` checks record identity and the referential edges the three
// shipped packs taught us matter. `compose` merges N validated packs
// into ONE createEngine options object, refusing cross-pack id
// collisions — a collision would silently last-write-win inside
// mergeRegistry, which is right for deliberate overrides and wrong for
// two settings that never heard of each other.

const SLOTTED = Object.freeze({
  regions: 'extraRegions',
  npcs: 'extraNpcs',
  hooks: 'extraStoryHooks',
  adventures: 'extraAdventures',
  species: 'extraSpecies',
  backgrounds: 'extraBackgrounds',
  feats: 'extraFeats',
  items: 'extraItems',
  monsters: 'extraMonsters',
  spells: 'extraSpells',
});

/** Table → the field each record must carry beyond `id`. */
const IDENTITY = Object.freeze({
  regions: 'name', npcs: 'name', hooks: 'title', adventures: 'title',
  species: 'name', backgrounds: 'name', feats: 'name',
  items: 'name', monsters: 'name', spells: 'name',
  cities: 'name', factions: 'name',
});

/**
 * Validate a setting pack against the contract. Returns
 * `{ valid, errors: string[] }` — never throws, so a catalog UI can
 * render the report. Checks:
 *   - identity: id/name/pitch on the pack; id + name/title on records;
 *     record key === record id.
 *   - referential edges: region.cities → cities (when both tables are
 *     present), city.regionId → regions, city.hooks → hooks pointing
 *     back, hook.factionId → factions, hook.adventureId → adventures,
 *     npc.factionId → factions, faction.seat → cities, faction.enemies
 *     → factions.
 */
export function validateSettingPack(pack) {
  const errors = [];
  if (pack === null || typeof pack !== 'object') {
    return { valid: false, errors: ['a setting pack must be an object'] };
  }
  for (const field of ['id', 'name', 'pitch']) {
    if (typeof pack[field] !== 'string' || !pack[field]) {
      errors.push(`missing required field: ${field}`);
    }
  }
  for (const [table, label] of Object.entries(IDENTITY)) {
    const records = pack[table];
    if (records === undefined) continue;
    if (records === null || typeof records !== 'object' || Array.isArray(records)) {
      errors.push(`${table} must be a map of id → record`);
      continue;
    }
    for (const [key, record] of Object.entries(records)) {
      if (!record || typeof record !== 'object') {
        errors.push(`${table}.${key} must be an object`); continue;
      }
      if (record.id !== key) errors.push(`${table}.${key}: record id '${record.id}' does not match its key`);
      if (typeof record[label] !== 'string' || !record[label]) {
        errors.push(`${table}.${key}: missing ${label}`);
      }
    }
  }

  const has = (table, id) => Boolean(pack[table]?.[id]);
  for (const region of Object.values(pack.regions ?? {})) {
    for (const cityId of region.cities ?? []) {
      if (pack.cities && !has('cities', cityId)) {
        errors.push(`regions.${region.id}: city '${cityId}' is not in the pack`);
      }
    }
  }
  for (const city of Object.values(pack.cities ?? {})) {
    if (pack.regions && !has('regions', city.regionId)) {
      errors.push(`cities.${city.id}: regionId '${city.regionId}' is not in the pack`);
    }
    for (const hookId of city.hooks ?? []) {
      if (pack.hooks) {
        if (!has('hooks', hookId)) {
          errors.push(`cities.${city.id}: hook '${hookId}' is not in the pack`);
        } else if (pack.hooks[hookId].cityId !== city.id) {
          errors.push(`cities.${city.id}: hook '${hookId}' points at '${pack.hooks[hookId].cityId}'`);
        }
      }
    }
  }
  for (const hook of Object.values(pack.hooks ?? {})) {
    if (hook.factionId && pack.factions && !has('factions', hook.factionId)) {
      errors.push(`hooks.${hook.id}: factionId '${hook.factionId}' is not in the pack`);
    }
    if (hook.adventureId && pack.adventures && !has('adventures', hook.adventureId)) {
      errors.push(`hooks.${hook.id}: adventureId '${hook.adventureId}' is not in the pack`);
    }
  }
  for (const npc of Object.values(pack.npcs ?? {})) {
    if (npc.factionId && pack.factions && !has('factions', npc.factionId)) {
      errors.push(`npcs.${npc.id}: factionId '${npc.factionId}' is not in the pack`);
    }
  }
  for (const faction of Object.values(pack.factions ?? {})) {
    if (faction.seat && pack.cities && !has('cities', faction.seat)) {
      errors.push(`factions.${faction.id}: seat '${faction.seat}' is not in the pack`);
    }
    for (const enemy of faction.enemies ?? []) {
      if (pack.factions && !has('factions', enemy)) {
        errors.push(`factions.${faction.id}: enemy '${enemy}' is not in the pack`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Register a setting pack: validate, throw on the first report if
 * invalid (with every error in the message), and hand the pack back.
 * The gate a loader calls before offering a pack to a table.
 */
export function registerSetting(pack) {
  const verdict = validateSettingPack(pack);
  if (!verdict.valid) {
    throw new Error(`setting pack ${pack?.id ?? '<no id>'} failed validation:\n  ${verdict.errors.join('\n  ')}`);
  }
  return pack;
}

/**
 * Compose N validated setting packs into ONE createEngine options
 * object — crossover play. Slotted tables merge under their engine
 * option; a cross-pack id collision throws (inside one engine, two
 * settings' ids share a namespace, and silent last-write-wins is for
 * deliberate overrides, not accidents). Pack-data tables (cities,
 * factions, …) are NOT merged — read them off each pack.
 *
 *   const engine = createEngine(composeSettings(SUNDERMARK, HOLLOW_VALE));
 */
export function composeSettings(...packs) {
  const opts = {};
  const owners = {};
  for (const pack of packs) {
    registerSetting(pack);
    for (const [table, slot] of Object.entries(SLOTTED)) {
      const records = pack[table];
      if (!records) continue;
      opts[slot] = opts[slot] ?? {};
      owners[slot] = owners[slot] ?? {};
      for (const [id, record] of Object.entries(records)) {
        if (owners[slot][id] && owners[slot][id] !== pack.id) {
          throw new Error(
            `composeSettings: ${table} id '${id}' appears in both '${owners[slot][id]}' and '${pack.id}'`);
        }
        owners[slot][id] = pack.id;
        opts[slot][id] = record;
      }
    }
  }
  return opts;
}
