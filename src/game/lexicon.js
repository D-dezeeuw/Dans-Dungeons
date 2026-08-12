// src/game/lexicon.js — the player's dictionary (doc 19, Part II).
//
// The Game Master knows the world; the player met it yesterday. The narrator
// is correctly fed continent and province digests, so it says "the Emberfen
// accord" and "Saltmarch" as established fact — and the player has seen each
// name once, in a sentence that scrolled away. Asking "what is Saltmarch?"
// used to cost a whole turn (classify → resolve as noEffect → narrate), which
// spends money to answer from memory the game already holds STRUCTURED, and
// tempts the narrator to embellish — the exact failure the ledger exists to
// prevent.
//
// So: a free action. This module turns what the game already stores as
// player-known into a lookup table, and answers from it. Three classes,
// and the class decides the answer shape:
//
//   known    — the player encountered it. Serve the stored fields.
//   heardOf  — rumoured node, or a threat named in talk. Serve it, LABELLED.
//   (absent) — everything else. If it is not in the index it is not answered,
//              which is how hidden things stay hidden: an unrevealed secret
//              and an unidentified staff property are not "filtered late",
//              they never enter the index at all. This module never reads
//              `npc.secret`, and a test asserts that.
//
// PURE on purpose — no Spektrum, no i18n import, no bag-of-holding-client.
// Those three are exactly what makes a module untestable under `node --test`
// (state.js imports the `spektrum` alias, i18n reads localStorage, and the
// library is a bare specifier the runner cannot resolve), and the alternative
// to injection is mirror-testing a copy of the logic, which tests nothing.
// `src/game/views.js` is the binding layer that gathers `sources` from live
// state and passes `{ t, tRaw, locale }` — the same shape preClassify takes.

const BODY_MAX = 320;         // chars of body text served for one entry
const MAX_CANDIDATES = 4;     // ambiguity list cap
const MIN_ALIAS_WORD = 4;     // "the Saltmarch Reach" → alias "saltmarch", not "the"

// ─── Text helpers ─────────────────────────────────────────────────────────────

// Same folding preClassify applies to player input, so a chip string and a
// typed string reach the same place. Kept local rather than imported: this
// module is a leaf, and the two normalizers answer to different call sites.
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[.!?,;:'"’`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Possessives survive normalize as a stray token ("saltmarch's" → "saltmarch s").
const dePossess = (s) => s.replace(/\s+s$/, '');

const stripArticles = (s, articles) => {
  let out = s;
  for (const a of articles ?? []) {
    const lead = `${a} `;
    if (out.startsWith(lead)) { out = out.slice(lead.length); break; }
  }
  return out;
};

// Clamp at a sentence boundary when there is one in range, so an entry ends on
// a full stop rather than mid-word.
export function clampBody(text, max = BODY_MAX) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop > max * 0.5) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trim()}…`;
};

const deSlug = (s) => String(s ?? '').split('.').pop().replace(/[-_]+/g, ' ').trim();
const nonEmpty = (x) => typeof x === 'string' && x.trim().length > 0;

// Join a few distinct notes into one body without repeating text one of them
// already contains.
function joinNotes(parts, limit = 2) {
  const out = [];
  for (const p of parts) {
    if (!nonEmpty(p)) continue;
    const clean = p.trim();
    if (out.some(o => o.toLowerCase().includes(clean.toLowerCase()))) continue;
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out.join(' — ');
}

// ─── Index building ───────────────────────────────────────────────────────────
//
// `sources` is everything the binding layer gathered from live state:
//
//   world              appState.world (regions, settlements, factions, quests,
//                      npcs, geography, location, currentRoom, lore)
//   inventory          appState.party.inventory
//   entities           { [entityId]: foldedRecord } — the ledger, folded
//   hasEncountered(id) the encounter gate (world.encountered)
//   encounteredKeys    the raw encounter keys, for suffix matching on npc ids
//   knownMap           { visited: [node], rumoured: [node] } — atlas mapView()
//   memory             chapters.memoryContext() or null
//   story              acts-runtime progress() or null
//   rumours            string[] — what a tavern is talking about right now
//   standingOf(id)     faction standing label, or null
//
// Every field is optional; a missing source contributes nothing.

export function buildLexiconIndex(sources = {}, i18n = {}) {
  const t = typeof i18n.t === 'function' ? i18n.t : ((k) => k);
  const tRaw = typeof i18n.tRaw === 'function' ? i18n.tRaw : (() => null);
  const articles = tRaw('lexicon.articles') ?? [];
  const world = sources.world ?? {};
  const entries = [];

  const add = (e) => { if (e && nonEmpty(e.name) && nonEmpty(e.body)) entries.push(e); };
  const rumourLines = (sources.rumours ?? []).filter(nonEmpty);

  // ── Places: the geography tree ─────────────────────────────────────────────
  // Visited nodes are known; rumoured nodes are heard-of and stay labelled as
  // such even when they carry an outline digest — an outline reached the
  // player as sailors' tales, not as something they walked.
  const geoNodes = world.geography?.nodes ?? {};
  const lineage = (node) => {
    const names = [];
    let cur = node, guard = 0;
    while (cur?.parent && guard++ < 8) {
      cur = geoNodes[cur.parent];
      if (cur?.name) names.push(cur.name);
    }
    return names;
  };
  for (const node of sources.knownMap?.visited ?? []) {
    const chain = lineage(node);
    add({
      key: `geo:${node.id}`, kind: node.kind ?? 'place', name: node.name,
      body: joinNotes([node.digest, node.hook]),
      lineage: chain, cls: 'known',
    });
  }
  for (const node of sources.knownMap?.rumoured ?? []) {
    add({
      key: `geo:${node.id}`, kind: node.kind ?? 'place', name: node.name,
      body: joinNotes([node.hook, node.digest]),
      lineage: lineage(node), cls: 'heardOf',
    });
  }

  // ── Places: generated regions and settlements ──────────────────────────────
  // Both maps only ever hold places the player has actually reached, so they
  // are known by construction. They carry more than the graph node does.
  for (const r of Object.values(world.regions ?? {})) {
    add({
      key: `region:${r.id}`, kind: 'region', name: r.name,
      body: joinNotes([r.digest, r.description, r.rumor]),
      climate: r.climate ?? null, cls: 'known',
    });
  }
  for (const s of Object.values(world.settlements ?? {})) {
    add({
      key: `settlement:${s.id}`, kind: 'settlement', name: s.name,
      body: joinNotes([s.description, s.digest, s.type]), cls: 'known',
    });
  }

  // ── People the player has actually spoken to ───────────────────────────────
  // The gate is a conversation on record. `secret` and `personality` are never
  // read here: a revealed secret reaches the player through the ledger (the
  // reveal records canon), which is also what makes undo rewind the knowledge.
  const quests = Object.values(world.quests ?? {});
  for (const s of Object.values(world.settlements ?? {})) {
    for (const npc of Object.values(s.npcs ?? {})) {
      if (!npc?.name || !(npc.dialogueHistory?.length)) continue;
      const faction = npc.factionId ? (world.factions?.[npc.factionId]?.name ?? npc.factionId) : null;
      const quest = quests.find(q => q.npcName === npc.name);
      add({
        key: `npc:${s.id}:${npc.id ?? npc.name}`, kind: 'npc', name: npc.name,
        body: joinNotes([
          npc.role ? t('lexicon.npcRole', { role: npc.role, place: s.name }) : null,
          faction ? t('lexicon.npcFaction', { faction }) : null,
          quest ? npc.questHook : null,
        ], 3),
        cls: 'known',
      });
    }
  }

  // ── Creatures met in a dungeon ─────────────────────────────────────────────
  // Encounter keys are dotted ids with the dots replaced; match on the tail so
  // this stays independent of which place the id was minted under.
  const encKeys = sources.encounteredKeys ?? [];
  const metNpc = (id) => {
    const tail = `_npc_${String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return encKeys.some(k => String(k).endsWith(tail));
  };
  for (const npc of Object.values(world.npcs ?? {})) {
    if (!npc?.name) continue;
    const present = npc.roomId && npc.roomId === world.currentRoom;
    if (!present && npc.alive !== false && !metNpc(npc.id)) continue;
    add({
      key: `creature:${npc.id}`, kind: 'creature', name: npc.name,
      body: joinNotes([
        npc.alive === false ? t('lexicon.creatureDead') : t('lexicon.creatureAlive'),
        npc.intro,
      ]),
      cls: 'known',
    });
  }

  // ── The ledger: everything the world has accumulated ───────────────────────
  // Encounter-gated, exactly like the narrator's `known` tier (scope.js). This
  // is where minted details, threats and canon facts come from — including a
  // secret the player has been told, which arrives as an ordinary note.
  const hasEnc = typeof sources.hasEncountered === 'function' ? sources.hasEncountered : (() => false);
  for (const [id, rec] of Object.entries(sources.entities ?? {})) {
    const name = rec?.name ?? deSlug(id);
    const body = joinNotes([rec?.description, rec?.note, rec?.condition, rec?.state]);
    if (!nonEmpty(name) || !nonEmpty(body)) continue;
    if (hasEnc(id)) {
      add({ key: `entity:${id}`, kind: kindOfEntityId(id), name, body, cls: 'known' });
      continue;
    }
    // Not encountered — but if the tavern is talking about it by name, the
    // player has heard of it, and the rumour itself is the honest answer.
    const heard = rumourLines.find(line => line.toLowerCase().includes(String(name).toLowerCase()));
    if (heard && String(name).length >= MIN_ALIAS_WORD) {
      add({ key: `entity:${id}`, kind: 'rumour', name, body: heard, cls: 'heardOf' });
    }
  }

  // ── Factions ───────────────────────────────────────────────────────────────
  const repMap = world.factionReputation ?? {};
  const homelandIds = new Set();
  for (const node of sources.knownMap?.visited ?? []) {
    for (const h of node.factionHomelands ?? []) if (h?.factionId) homelandIds.add(h.factionId);
  }
  for (const [id, f] of Object.entries(world.factions ?? {})) {
    if (!f?.name) continue;
    const known = repMap[id] !== undefined || homelandIds.has(id) || quests.some(q => q.factionId === id);
    const standing = typeof sources.standingOf === 'function' ? sources.standingOf(id) : null;
    const desc = joinNotes([f.description, f.desc, f.goal, f.archetype, f.type]);
    if (known) {
      add({
        key: `faction:${id}`, kind: 'faction', name: f.name,
        body: joinNotes([desc, standing ? t('lexicon.factionStanding', { standing }) : null], 2),
        cls: 'known',
      });
      continue;
    }
    const heard = rumourLines.find(line => line.toLowerCase().includes(f.name.toLowerCase()));
    if (heard) add({ key: `faction:${id}`, kind: 'faction', name: f.name, body: heard, cls: 'heardOf' });
  }

  // ── What the player is carrying ────────────────────────────────────────────
  // The description is served; anything the item is hiding is not. An item may
  // ask, via `hintHidden`, for the player to be TOLD there is more — that is a
  // deliberate authored hint, never an inference from the hidden data.
  for (const item of sources.inventory ?? []) {
    if (!item?.name) continue;
    add({
      key: `item:${item.id ?? item.name}`, kind: 'item', name: item.name,
      body: joinNotes([item.description, item.note]) || t('lexicon.itemPlain'),
      hiddenMore: item.hintHidden === true,
      cls: 'known',
    });
  }

  // ── Quests ─────────────────────────────────────────────────────────────────
  for (const q of quests) {
    if (!nonEmpty(q?.description)) continue;
    add({
      key: `quest:${q.id}`, kind: 'quest', name: q.description,
      body: joinNotes([
        q.npcName ? t('lexicon.questGiver', { npc: q.npcName }) : null,
        q.status ? t(`settlement.status.${q.status}`) : null,
      ], 2),
      cls: 'known',
    });
  }

  // ── The story so far ───────────────────────────────────────────────────────
  // Act title and progress only. The directive is GM-private and lives in
  // gmOnly; it does not travel through here, ever.
  if (sources.story?.currentTitle) {
    add({
      key: 'story:act', kind: 'story', name: sources.story.currentTitle,
      body: t('lexicon.actBody', {
        act: Math.min(sources.story.act ?? 1, sources.story.acts ?? 1),
        acts: sources.story.acts ?? 1,
        done: sources.story.beatsDone ?? 0,
        total: sources.story.beats ?? 0,
      }),
      cls: 'known',
    });
  }

  // ── The player's own past ──────────────────────────────────────────────────
  for (const line of sources.memory?.chapters ?? []) {
    const idx = String(line).indexOf(':');
    if (idx <= 0) continue;
    add({
      key: `chapter:${line.slice(0, idx)}`, kind: 'chapter',
      name: line.slice(0, idx).trim(), body: line.slice(idx + 1).trim(), cls: 'known',
    });
  }

  // ── Lore (forward-compatible; the lore tree is not shipped yet) ────────────
  // Only entries the world has actually surfaced to the player are eligible.
  for (const era of world.lore?.eras ?? []) {
    if (era?.surfaced !== true || !era?.name) continue;
    add({ key: `era:${era.id ?? era.name}`, kind: 'era', name: era.name, body: joinNotes([era.digest, era.summary]), cls: 'known' });
  }
  for (const legend of world.lore?.legends ?? []) {
    if (legend?.surfaced !== true || !legend?.title) continue;
    add({ key: `legend:${legend.id ?? legend.title}`, kind: 'legend', name: legend.title, body: joinNotes([legend.digest, legend.summary]), cls: 'known' });
  }

  return finalize(entries, articles);
}

// An entity id is a dotted address; the segment before the last name says what
// kind of thing it is.
function kindOfEntityId(id) {
  const s = String(id);
  if (s.includes('.npc.'))        return 'npc';
  if (s.includes('.creature.'))   return 'creature';
  if (s.includes('.detail.'))     return 'detail';
  if (s.includes('.site.'))       return 'place';
  if (s.includes('.room.'))       return 'place';
  if (s.includes('.settlement.')) return 'settlement';
  if (s.includes('.dungeon.'))    return 'place';
  if (s.startsWith('region.'))    return 'region';
  return 'thing';
}

// Merge same-named entries, build aliases, and put known before heard-of so a
// place the player has walked wins over the rumour of it.
function finalize(entries, articles) {
  const byName = new Map();
  for (const e of entries) {
    const key = dePossess(normalize(e.name));
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev) { byName.set(key, { ...e }); continue; }
    // Known outranks heard-of; otherwise first writer keeps the shape and the
    // newcomer can only contribute text the reader does not already have.
    const win = (prev.cls === 'known' || e.cls !== 'known') ? prev : { ...e, body: prev.body };
    win.body = joinNotes([win.body, prev.body, e.body], 2);
    win.hiddenMore = win.hiddenMore || prev.hiddenMore || e.hiddenMore;
    win.lineage = win.lineage ?? prev.lineage ?? e.lineage;
    win.climate = win.climate ?? prev.climate ?? e.climate;
    byName.set(key, win);
  }

  const out = [];
  for (const [key, e] of byName) {
    const bare = stripArticles(key, articles);
    const aliases = new Set([key]);
    if (bare && bare !== key) aliases.add(bare);
    for (const word of bare.split(' ')) {
      if (word.length >= MIN_ALIAS_WORD) aliases.add(word);
    }
    out.push({ ...e, key: e.key, match: key, aliases: [...aliases], body: clampBody(e.body) });
  }
  return out;
}

// ─── Lookup ───────────────────────────────────────────────────────────────────
//
// Returns { hit } | { candidates } | { miss: true }. Ambiguity is resolved by
// asking, not by guessing: two places sharing the word "Salt" is exactly the
// case where picking one silently is worse than a one-line question.

export function lookupLexicon(query, index = [], i18n = {}) {
  const tRaw = typeof i18n.tRaw === 'function' ? i18n.tRaw : (() => null);
  const articles = tRaw('lexicon.articles') ?? [];
  const q = stripArticles(dePossess(normalize(query)), articles);
  if (!q) return { miss: true };

  const exact = index.filter(e => e.match === q || stripArticles(e.match, articles) === q);
  if (exact.length) return { hit: best(exact) };

  const aliased = index.filter(e => e.aliases.includes(q));
  if (aliased.length === 1) return { hit: aliased[0] };
  if (aliased.length > 1)   return { candidates: rank(aliased) };

  const words = q.split(' ').filter(w => w.length >= MIN_ALIAS_WORD);
  const partial = index.filter(e =>
    e.match.includes(q) || q.includes(e.match) || words.some(w => e.aliases.includes(w)));
  if (partial.length === 1) return { hit: partial[0] };
  if (partial.length > 1)   return { candidates: rank(partial) };

  return { miss: true };
}

const best = (list) => rank(list)[0];

// Known before heard-of, then the longer name (more specific), then stable.
function rank(list) {
  return [...list]
    .sort((a, b) => {
      if (a.cls !== b.cls) return a.cls === 'known' ? -1 : 1;
      if (a.match.length !== b.match.length) return b.match.length - a.match.length;
      return a.match < b.match ? -1 : 1;
    })
    .slice(0, MAX_CANDIDATES);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

export function renderLexiconEntry(entry, i18n = {}) {
  const t = typeof i18n.t === 'function' ? i18n.t : ((k) => k);
  if (!entry) return [t('lexicon.unknown')];
  const kind = t(`lexicon.kind.${entry.kind}`);
  const lines = [t('lexicon.entryHeader', { name: entry.name, kind })];

  const body = entry.cls === 'heardOf'
    ? `${t('lexicon.heardOfPrefix')}${entry.body}`
    : entry.body;
  lines.push(body);

  if (entry.lineage?.length) lines.push(t('lexicon.lineage', { chain: entry.lineage.join(' · ') }));
  if (entry.climate)         lines.push(t('lexicon.climate', { climate: entry.climate }));
  if (entry.hiddenMore)      lines.push(t('lexicon.hiddenMore'));
  return lines;
}

export function renderLexiconCandidates(candidates, i18n = {}) {
  const t = typeof i18n.t === 'function' ? i18n.t : ((k) => k);
  return [t('lexicon.ambiguous', { names: candidates.map(c => c.name).join(' · ') })];
}

// ─── Topics ───────────────────────────────────────────────────────────────────
//
// What a confused player most likely just read: where they are standing, who
// is in front of them, what they agreed to do.

export function lexiconTopics(index = [], sources = {}, limit = 8) {
  const world = sources.world ?? {};
  const focus = new Set();
  const push = (name) => { if (nonEmpty(name)) focus.add(dePossess(normalize(name))); };

  const loc = world.location ?? {};
  push(world.regions?.[loc.regionId]?.name);
  push(world.settlements?.[loc.settlementId]?.name);
  const geoNodes = world.geography?.nodes ?? {};
  let cur = geoNodes[loc.regionId], guard = 0;
  while (cur?.parent && guard++ < 8) { cur = geoNodes[cur.parent]; push(cur?.name); }
  for (const npc of Object.values(world.npcs ?? {})) {
    if (npc?.alive !== false && npc?.roomId === world.currentRoom) push(npc.name);
  }
  for (const s of Object.values(world.settlements ?? {})) {
    for (const npc of Object.values(s.npcs ?? {})) if (npc?.dialogueHistory?.length) push(npc.name);
  }

  const known = index.filter(e => e.cls === 'known');
  const inFocus = known.filter(e => focus.has(e.match));
  const quests  = known.filter(e => e.kind === 'quest' && !inFocus.includes(e));
  const rest    = known.filter(e => !inFocus.includes(e) && !quests.includes(e));
  return [...inFocus, ...quests, ...rest].slice(0, limit);
}

// ─── Question detection ───────────────────────────────────────────────────────
//
// The free action has to be reachable by typing the question a confused player
// actually types, not only by remembering a slash command. The patterns are
// locale content (`lexicon.patterns`), anchored at the start and requiring a
// remainder, so "what a day" is prose and "what is a day" is a lookup.

export function matchLexiconQuestion(raw, i18n = {}) {
  const tRaw = typeof i18n.tRaw === 'function' ? i18n.tRaw : (() => null);
  const patterns = tRaw('lexicon.patterns') ?? [];
  // Curly quotes are what a phone keyboard produces; the pattern table is
  // written with straight ones.
  const text = String(raw ?? '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[?!.]+\s*$/, '').trim();
  if (!text) return null;
  for (const p of patterns) {
    const pat = String(p).toLowerCase().trim();
    if (!pat) continue;
    if (!text.startsWith(`${pat} `)) continue;
    const rest = text.slice(pat.length).trim();
    if (rest) return rest;
  }
  return null;
}

export const LEXICON_BODY_MAX = BODY_MAX;
