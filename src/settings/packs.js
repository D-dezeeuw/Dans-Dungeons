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

import { PACK as classic }    from './pack-classic.js';
import { PACK as darkAges }   from './pack-dark-ages.js';
import { PACK as neonStacks } from './pack-neon-stacks.js';
import { estimateTokens }     from '../game/scope-budget.js';

export const DEFAULT_PACK_ID = 'classic';

export const SETTING_PACKS = Object.freeze({
  classic,
  'dark-ages': darkAges,
  'neon-stacks': neonStacks,
});

// Sorted, so reordering the registry cannot change which pack a seed draws.
// (ADDING one does change it — the draw is modulo the roster size — but
// nothing observes that: `world.settingId` is written once at genesis and
// travels with the save, so a campaign keeps the pack it was born under.)
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

// `Name — first clause of the blurb`, for the wizard's numbered list.
//
// The list showed names alone, which was fine at three packs and is a guessing
// game at nine: "The Deep Holds" and "The Walled Quarter" tell a first-time
// player nothing about which world they are picking. The full blurb prints
// after the choice; this is the scannable half.
export function packTagline(pack, locale = 'en', max = 56) {
  const { name, blurb } = packCard(pack, locale);
  const first = String(blurb ?? '').split(/(?<=\.)\s/)[0].trim().replace(/\.$/, '');
  if (!first) return name;
  const short = first.length <= max
    ? first
    : `${first.slice(0, max).replace(/[\s,;:—-]+\S*$/, '')}…`;
  return `${name} — ${short}`;
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

export function lintPack(pack, { knownCreatureIds = null, baseKeys = null, climateBands = null,
                                 reachableCreatureIds = null } = {}) {
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
  const claimedBy = new Map();
  for (const [theme, entry] of Object.entries(overlays)) {
    if (!entry?.atmosphere) say(`overlay '${theme}' has no atmosphere line`);
    const enemies = entry?.enemies ?? [];
    if (enemies.length < 3) say(`overlay '${theme}' needs at least three enemies (entrance → vault)`);
    if (knownCreatureIds) {
      for (const id of enemies) {
        if (!knownCreatureIds.has(id)) say(`overlay '${theme}' names unknown creature '${id}'`);
      }
    }
    // A display name is keyed by creature id GLOBALLY, so one stat block
    // cannot be a rack warden in one theme and a sump rat in another — the
    // second theme silently shows the first theme's name.
    for (const id of enemies) {
      if (claimedBy.has(id) && claimedBy.get(id) !== theme) {
        say(`creature '${id}' is in both '${claimedBy.get(id)}' and '${theme}' — one id, one name`);
      } else {
        claimedBy.set(id, theme);
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
      // A climate entry for a theme the pack does not roll is a no-op that
      // reads as coverage — usually a theme that was renamed on one side only.
      if (themes && !themes.includes(theme)) say(`themeClimates names '${theme}', which is not in dungeonThemes`);
    }
    // A band no theme claims still gets provinces; the library falls back to
    // the whole theme list for it, so the pack's careful climate work simply
    // stops applying there. Worth saying out loud rather than discovering it
    // in the one province that came out wrong.
    if (themes) {
      const claimed = new Set(Object.values(pack.themeClimates).flat());
      for (const band of climateBands) {
        if (!claimed.has(band)) say(`no theme claims the '${band}' band — provinces there fall back to every theme`);
      }
    }
  }
  if (pack.bandSettlements && climateBands) {
    for (const band of Object.keys(pack.bandSettlements)) {
      if (!climateBands.includes(band)) say(`bandSettlements names unknown climate band '${band}'`);
    }
  }

  // A pack that renames creatures has to rename ALL the ones the game can
  // reach, not only the ones its own themes name. Travel encounters and the
  // no-overlay fallback draw from fixed pools, so a pack whose skeletons are
  // derelict chassis still meets a "Wolf" on the road unless it says otherwise.
  const skinned = pack.i18n?.en?.world?.enemyNames ?? null;
  if (skinned && reachableCreatureIds) {
    const named = new Set([...Object.keys(skinned), ...Object.values(overlays).flatMap(o => o?.enemies ?? [])]);
    for (const id of reachableCreatureIds) {
      if (!named.has(id)) say(`renames creatures but leaves '${id}' unskinned — it can still appear in travel or a themeless dungeon`);
      else if (!skinned[id]) say(`creature '${id}' can appear but has no display name in this pack`);
    }
  }

  // Naming banks come as a complete set or not at all — half a set produces
  // names that are half the pack's culture and half the library's. The floors
  // match doc 19 §2 rather than the token minimum they used to: the skeleton
  // deals five prefixes and five suffixes per continent, so four-entry banks
  // are legal and threadbare — sixteen possible province names for a whole
  // landmass.
  const BANK_FLOOR = { continentPrefixes: 8, continentSuffixes: 8, provincePrefixes: 10, provinceSuffixes: 10 };
  if (pack.syllables) {
    for (const [k, floor] of Object.entries(BANK_FLOOR)) {
      if (!Array.isArray(pack.syllables[k]) || pack.syllables[k].length < floor) {
        say(`syllables.${k} needs at least ${floor} entries`);
      }
    }
  }

  // A house style is substituted into three different frames — "the entrance
  // hall of a {{style}}", "The foyer of this {{style}} greets you", "the
  // threshold of the {{style}}" — so it has to read as a bare noun phrase in
  // all three. The base's own six are 2–3 word phrases, which hides the
  // constraint completely; the natural instinct when writing evocative content
  // is a clause, and "a garden that outlived its gardeners" renders as "the
  // entrance hall of a a garden that outlived its gardeners".
  for (const style of pack.i18n?.en?.world?.houseStyles ?? []) {
    const s = String(style).trim();
    if (/^(a|an|the)\s/i.test(s))     say(`houseStyle '${s}' starts with an article — the frames supply their own`);
    if (/\b(that|which|who|where)\b/i.test(s)) say(`houseStyle '${s}' is a clause; the frames need a bare noun phrase`);
    if (s.split(/\s+/).length > 5)    say(`houseStyle '${s}' is too long to sit inside "the entrance hall of a …"`);
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
