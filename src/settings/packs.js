// src/settings/packs.js — the setting-pack registry and its rules (doc 19).
//
// A theme — dark ages, high elvish, a rain-soaked vertical city — is DATA, not
// a fork. The engine's rules, the LOD tree, the turn loop and the ledger do not
// know what genre they are running; genre lives in four kinds of content that
// all already had injection seams: archetype tables (the blueprint's `tables`),
// dungeon overlays (`generateDungeon`'s `overlays`), locale content (`tRaw`),
// and prompt text (i18n templates). A pack bundles replacements for those,
// plus a voice block — how people in this world talk, which is what makes the
// difference between "friend", "matey" and "choom".
//
// Nothing here touches Spektrum or i18n: this module is the registry and the
// rules, and `src/settings/index.js` is the half that binds a chosen pack to
// the running game. That split is what lets `node --test` lint every shipped
// pack — a pack whose enemy pool names a creature with no stat block would
// otherwise crash a dungeon four hours into a campaign.

import { PACK as classic }  from './pack-classic.js';
import { PACK as darkAges } from './pack-dark-ages.js';
import { estimateTokens }   from '../game/scope-budget.js';

export const DEFAULT_PACK_ID = 'classic';

export const SETTING_PACKS = Object.freeze({
  classic,
  'dark-ages': darkAges,
});

// Sorted, so registry insertion order can never silently reshuffle which pack
// a given seed draws.
export function packIds() { return Object.keys(SETTING_PACKS).sort(); }

// Never throws: a save naming a pack that no longer exists degrades to classic
// rather than refusing to load. The caller reports the substitution.
export function resolvePack(id) {
  return SETTING_PACKS[id] ?? SETTING_PACKS[DEFAULT_PACK_ID];
}

export function isKnownPack(id) { return Object.prototype.hasOwnProperty.call(SETTING_PACKS, id); }

// The pack's card in the player's language, falling back to English.
export function packCard(pack, locale = 'en') {
  const card = pack?.card ?? {};
  return card[locale] ?? card.en ?? { name: pack?.id ?? '', blurb: '' };
}

// ─── Seeded selection: theme first, contents second ──────────────────────────
//
// The campaign seed picks the PACK before anything else is rolled, and the
// blueprint then rolls inside that pack's tables. That ordering is the whole
// point — a world cannot be "cyberpunk with a mushroom farm" if the mushroom
// farm was never in the deck being drawn from.
//
// A one-shot integer mix rather than the library's rng: this module stays free
// of the `bag-of-holding-client` bare specifier (which only esbuild resolves)
// so the lint below can run under the node test runner. A single draw does not
// need a stream, only determinism.
export function pickPack(seed, ids = packIds()) {
  const list = [...ids].sort();
  if (!list.length) return DEFAULT_PACK_ID;
  let h = ((Math.abs(Math.trunc(Number(seed) || 0)) ^ 0x5e771e5) >>> 0);
  h ^= h << 13; h >>>= 0;
  h ^= h >>> 17;
  h ^= h << 5;  h >>>= 0;
  return list[h % list.length];
}

// A pack states only what it replaces; the library merges the rest over its
// own defaults (bag-of-holding-client 0.12.0 `mergeTables`, applied inside
// buildBlueprint and deriveBlueprint). Nothing to do here — recorded because
// the obvious instinct is to merge on this side, which would mean two merge
// rules that can disagree about what "override" means.

// ─── The lint ────────────────────────────────────────────────────────────────
//
// Returns a list of problems, empty when the pack is sound. Shipped rather
// than test-only so someone authoring a pack can run it: the failures it
// catches (an enemy id with no stat block, a theme with no room dressing) are
// all "fine until hour four", and the whole promise of packs-as-data is that
// content cannot break logic.

export const VOICE_TOKEN_BUDGET = 120;   // a per-turn tax; keep it small
const VOICE_EXAMPLE_MAX = 3;
const VOICE_EXAMPLE_CHARS = 120;

export function lintPack(pack, { knownCreatureIds = null, baseKeys = null, climateBands = null } = {}) {
  const problems = [];
  const say = (msg) => problems.push(`${pack?.id ?? '(unnamed)'}: ${msg}`);

  if (!pack || typeof pack !== 'object') return ['pack is not an object'];
  if (!pack.id || !/^[a-z0-9-]+$/.test(pack.id)) say('id must be lowercase-kebab');
  if (!Number.isInteger(pack.packVersion)) say('packVersion must be an integer');
  if (!pack.card?.en?.name || !pack.card?.en?.blurb) say('needs an English card (name + blurb)');

  // Nothing executable, and nothing that belongs to the rules.
  for (const [key, val] of Object.entries(pack)) {
    if (typeof val === 'function') say(`field '${key}' is a function; packs are data`);
  }
  for (const forbidden of ['statBlocks', 'monsters', 'schemas', 'models', 'rules']) {
    if (pack[forbidden] !== undefined) say(`must not carry '${forbidden}' — packs re-skin, they do not re-rule`);
  }

  // Creature pools name existing stat blocks. A pack renames a skeleton; it
  // never invents one.
  const overlays = pack.overlays ?? {};
  for (const [theme, entry] of Object.entries(overlays)) {
    if (!entry?.atmosphere) say(`overlay '${theme}' has no atmosphere line`);
    const enemies = entry?.enemies ?? [];
    if (enemies.length < 3) say(`overlay '${theme}' needs at least three enemies (entrance → vault)`);
    if (knownCreatureIds) {
      for (const id of enemies) {
        if (!knownCreatureIds.has(id)) say(`overlay '${theme}' names unknown creature '${id}'`);
      }
    }
  }

  // Every theme the blueprint can roll must be dressable and placeable.
  const themes = pack.tables?.dungeonThemes ?? null;
  if (themes) {
    const dressing = pack.i18n?.en?.world?.dressing ?? {};
    for (const theme of themes) {
      if (!overlays[theme])        say(`theme '${theme}' has no overlay (enemy pool)`);
      if (!pack.themeClimates?.[theme]) say(`theme '${theme}' has no climate bands`);
      if (!dressing[theme]?.length)  say(`theme '${theme}' has no room dressing`);
    }
  }
  if (pack.themeClimates && climateBands) {
    for (const [theme, bands] of Object.entries(pack.themeClimates)) {
      for (const band of bands ?? []) {
        if (!climateBands.includes(band)) say(`theme '${theme}' names unknown climate band '${band}'`);
      }
    }
  }

  // Naming banks come as a complete set or not at all — half a set produces
  // names that are half the pack's culture and half the library's.
  if (pack.syllables) {
    for (const k of ['continentPrefixes', 'continentSuffixes', 'provincePrefixes', 'provinceSuffixes']) {
      if (!Array.isArray(pack.syllables[k]) || pack.syllables[k].length < 4) {
        say(`syllables.${k} needs at least four entries`);
      }
    }
  }

  // The voice block rides in every narrator and dialogue prompt of the
  // campaign, so its size is a recurring bill, not a one-off.
  const v = pack.voice;
  if (v) {
    if (!v.address?.length) say('voice needs at least one address term');
    for (const audience of ['narrator', 'npc']) {
      const lines = v.examples?.[audience] ?? [];
      if (lines.length > VOICE_EXAMPLE_MAX) say(`voice.examples.${audience} has more than ${VOICE_EXAMPLE_MAX} lines`);
      for (const line of lines) {
        if (String(line).length > VOICE_EXAMPLE_CHARS) say(`voice.examples.${audience} line exceeds ${VOICE_EXAMPLE_CHARS} chars`);
      }
    }
    const cost = estimateTokens(renderVoiceFields(v));
    if (cost > VOICE_TOKEN_BUDGET) say(`voice block costs ~${cost} tokens, over the ${VOICE_TOKEN_BUDGET} budget`);
  }

  // Overlay keys must name real content. A typo'd key is not an override, it
  // is a silent no-op — the pack looks applied and the string never changes.
  if (baseKeys && pack.i18n) {
    for (const [loc, tree] of Object.entries(pack.i18n)) {
      for (const key of flattenKeys(tree)) {
        if (!baseKeys.has(key) && !isExtensibleKey(key)) {
          say(`i18n.${loc} key '${key}' does not exist in the base bundle`);
        }
      }
    }
    // A pack may translate later, but it may not translate what it never wrote.
    const enKeys = new Set(flattenKeys(pack.i18n.en ?? {}));
    for (const [loc, tree] of Object.entries(pack.i18n)) {
      if (loc === 'en') continue;
      for (const key of flattenKeys(tree)) {
        if (!enKeys.has(key)) say(`i18n.${loc} key '${key}' has no English original in this pack`);
      }
    }
  }

  return problems;
}

// Tables a pack is allowed to ADD ids to (rather than only override), because
// their keys are content ids the pack itself mints.
const EXTENSIBLE = [
  /^world\.dressing\./, /^world\.enemyNames\./, /^world\.enemyIntros\./,
  /^lexicon\.kind\./,
];
const isExtensibleKey = (key) => EXTENSIBLE.some(re => re.test(key));

export function flattenKeys(tree, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(tree ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flattenKeys(v, key));
    else out.push(key);
  }
  return out;
}

// The fields the prompt block is built from — kept here so the lint measures
// the same text src/settings/voice.js renders.
export function renderVoiceFields(voice) {
  if (!voice) return '';
  return [
    voice.register, (voice.address ?? []).join(', '), (voice.honorifics ?? []).join('; '),
    (voice.exclamations ?? []).join('; '), (voice.forbid ?? []).join(', '),
    ...(voice.examples?.narrator ?? []), ...(voice.examples?.npc ?? []),
  ].filter(Boolean).join('\n');
}
