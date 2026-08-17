// === Localization layer (4.2.0) ===
//
// `Strings.t(key, lang)` — the shim the roadmap promised for
// non-English condition labels, class names, and action verbs. The
// kernel stays English by default: `DEFAULT_STRINGS` is the complete
// English table (generated from the same registries the engine ships,
// so a new condition or class shows up as a MISSING KEY in tests
// rather than silently untranslated), and locale packs are plugins —
// `createEngine({ extraLocales: { nl: {...} } })` or module-level
// `makeStrings({ nl })`.
//
// Lookup is three-step: requested locale → English → the key itself.
// A partial locale is legal and expected (translate what your table
// needs); `missingIn(lang)` reports the gap so a locale pack can CI
// its own completeness.

// The keyspace: `<domain>.<id>`. Domains are the player-facing
// vocabularies — conditions, classes, species, abilities, actions,
// rarities, rests. Data names (spells, items, monsters) are NOT here:
// content packs own their names; this table owns the RULES vocabulary.
export const DEFAULT_STRINGS = Object.freeze({
  // Conditions (SRD 5.2 § Conditions).
  'condition.blinded': 'Blinded',
  'condition.charmed': 'Charmed',
  'condition.deafened': 'Deafened',
  'condition.frightened': 'Frightened',
  'condition.grappled': 'Grappled',
  'condition.incapacitated': 'Incapacitated',
  'condition.invisible': 'Invisible',
  'condition.paralyzed': 'Paralyzed',
  'condition.petrified': 'Petrified',
  'condition.poisoned': 'Poisoned',
  'condition.prone': 'Prone',
  'condition.restrained': 'Restrained',
  'condition.stunned': 'Stunned',
  'condition.unconscious': 'Unconscious',
  'condition.exhaustion': 'Exhaustion',
  // Classes.
  'class.barbarian': 'Barbarian',
  'class.bard': 'Bard',
  'class.cleric': 'Cleric',
  'class.druid': 'Druid',
  'class.fighter': 'Fighter',
  'class.monk': 'Monk',
  'class.paladin': 'Paladin',
  'class.ranger': 'Ranger',
  'class.rogue': 'Rogue',
  'class.sorcerer': 'Sorcerer',
  'class.warlock': 'Warlock',
  'class.wizard': 'Wizard',
  // Species.
  'species.human': 'Human',
  'species.elf': 'Elf',
  'species.dwarf': 'Dwarf',
  'species.halfling': 'Halfling',
  'species.dragonborn': 'Dragonborn',
  'species.gnome': 'Gnome',
  'species.goliath': 'Goliath',
  'species.orc': 'Orc',
  'species.tiefling': 'Tiefling',
  // Abilities.
  'ability.str': 'Strength',
  'ability.dex': 'Dexterity',
  'ability.con': 'Constitution',
  'ability.int': 'Intelligence',
  'ability.wis': 'Wisdom',
  'ability.cha': 'Charisma',
  // Action verbs (SRD § Actions in Combat).
  'action.attack': 'Attack',
  'action.cast': 'Cast a Spell',
  'action.dash': 'Dash',
  'action.disengage': 'Disengage',
  'action.dodge': 'Dodge',
  'action.help': 'Help',
  'action.hide': 'Hide',
  'action.ready': 'Ready',
  'action.search': 'Search',
  'action.shove': 'Shove',
  'action.grapple': 'Grapple',
  'action.influence': 'Influence',
  // Rarity bands (MagicItems.RARITY_BANDS).
  'rarity.common': 'Common',
  'rarity.uncommon': 'Uncommon',
  'rarity.rare': 'Rare',
  'rarity.veryRare': 'Very Rare',
  'rarity.legendary': 'Legendary',
  'rarity.artifact': 'Artifact',
  // Rests.
  'rest.short': 'Short Rest',
  'rest.long': 'Long Rest',
});

/**
 * Build a Strings surface over locale tables. Pure and cheap — the
 * engine binds one per instance (`createEngine({ extraLocales })`);
 * module callers make their own.
 *
 *   const S = makeStrings({ nl: { 'condition.blinded': 'Verblind' } });
 *   S.t('condition.blinded', 'nl')  // 'Verblind'
 *   S.t('condition.prone', 'nl')    // 'Prone' (English fallback)
 *   S.t('made.up', 'nl')            // 'made.up' (key fallback — visible, greppable)
 */
export function makeStrings(locales = {}) {
  for (const [lang, table] of Object.entries(locales)) {
    if (table === null || typeof table !== 'object' || Array.isArray(table)) {
      throw new Error(`locale '${lang}' must be a map of key → string`);
    }
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== 'string') {
        throw new Error(`locale '${lang}' key '${key}' must map to a string`);
      }
    }
  }
  const frozen = Object.freeze(
    Object.fromEntries(Object.entries(locales).map(([l, t]) => [l, Object.freeze({ ...t })])));

  return Object.freeze({
    /** Translate a key. Falls back locale → English → the key itself. */
    t(key, lang) {
      if (lang && frozen[lang]?.[key] !== undefined) return frozen[lang][key];
      return DEFAULT_STRINGS[key] ?? key;
    },
    /** The registered locale codes (English is implicit). */
    locales() {
      return Object.keys(frozen);
    },
    /** Keys the locale has not translated — a locale pack's own CI gate. */
    missingIn(lang) {
      const table = frozen[lang] ?? {};
      return Object.keys(DEFAULT_STRINGS).filter((key) => table[key] === undefined);
    },
  });
}
