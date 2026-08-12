// src/game/atlas.js — the world map, bound to Spektrum (E6.S1 + doc 17 Phase B).
//
// Overworld travel used to mint a brand-new region on every departure — the
// player was always at the centre of a star. Stubs fixed that: every region
// pre-mints its neighbours as {id, name, hook, seed} promises. Doc 17 raises
// the same trick above the region: the world now has a SKELETON — continents
// and provinces minted deterministically from the world seed at genesis,
// stubs all the way down — and detail hydrates lazily as the player
// approaches (0 stub → 1 outlined → 2 detailed). The library owns the pure
// machinery; this module binds it to Spektrum and the game's id space.

import {
  emptyGeography, addNode, connect, neighbours, expandFrom, markVisited,
  knownMap, routeBetween, mintSeed, mintWorldSkeleton, adoptFlatWorld,
  ancestorsOf, childrenOf, promoteNode,
} from 'bag-of-holding-client';
import { appState, setValue, tick } from '../core/state.js';
import { activePack } from '../settings/index.js';

export function geography() { return appState.world?.geography ?? emptyGeography(); }

function save(geo) { setValue('world.geography', geo); tick(); return geo; }

// Build the starting map: the layered skeleton (continents, provinces, ports,
// sea lanes), the starting region filed under the first province, and three
// neighbour stubs. Pure — returns the graph for the caller to include in its
// own world write (campaign setup writes `world` wholesale).
export function initialAtlas(regionId, regionName, seed, { syllables = null, hooks = null } = {}) {
  const worldSeed = (Number(seed) || mintSeed()) >>> 0;
  // A setting is largely its proper nouns: the pack's syllable banks name the
  // continents and provinces, so a cyberpunk world does not open on Veldrath.
  // Its hooks are the other half — they are what the map says about a district
  // nobody has walked, and the library's talk of sailors and caravans belongs
  // to one genre only.
  const { geo: skeleton, provinces } = mintWorldSkeleton(worldSeed, { syllables, hooks });
  let geo = addNode(skeleton, {
    id: regionId, name: regionName, kind: 'region',
    seed: worldSeed, stub: false, detail: 2, parent: provinces[0] ?? null,
  });
  return expandFrom(geo, regionId, { count: 3, nameFor: neighbourName, hookFor: neighbourHook });
}

// Same, but writes it — for campaigns already in progress when the map (or a
// layer of it) arrived. Two migrations live here: a save with no geography at
// all gets the full layered build; a save with a flat (pre-layer) graph is
// adopted under a synthetic province without regenerating anything.
export function initAtlas(regionId, regionName, seed) {
  const existing = appState.world?.geography;
  if (existing?.nodes && Object.keys(existing.nodes).length) {
    const adopted = adoptFlatWorld(existing, (Number(seed) || 1) >>> 0);
    if (adopted !== existing) return save(adopted);
    return existing;
  }
  return save(initialAtlas(regionId, regionName, seed));
}

// Stub names and hooks are deterministic from the seed, so the same world always
// promises the same places. They are placeholders until the region is generated,
// at which point the real name replaces them.
//
// The word banks come from the setting pack when it has one. The layers ABOVE
// the region were skinned first (the library's skeleton takes the pack's
// syllables), which left the frontier as the one layer still minting Saltfen
// and Elderdowns into a world of ferry gates — and the frontier is the layer a
// player reads most, because it is what the map calls the places they have not
// been yet.
const DEFAULT_REGION_A = ['Salt', 'Ash', 'Iron', 'Grey', 'Thorn', 'Ember', 'Mire', 'Bone', 'Storm', 'Elder'];
const DEFAULT_REGION_B = ['Reach', 'March', 'Hollow', 'Fen', 'Downs', 'Barrows', 'Waste', 'Shore', 'Vale', 'Wold'];
const DEFAULT_HOOKS = ['smoke on the horizon', 'a road nobody maintains', 'bells heard at odd hours',
                       'a border nobody polices', 'water that tastes of iron', 'birds that will not settle'];

function neighbourName(seed, direction) {
  const syl  = activePack().syllables;
  const qual = syl?.provincePrefixes ?? DEFAULT_REGION_A;
  const word = syl?.provinceSuffixes ?? DEFAULT_REGION_B;
  return `${qual[seed % qual.length]}${word[(seed >> 5) % word.length].toLowerCase()}`;
}
function neighbourHook(seed, direction) {
  const hooks = activePack().frontierHooks ?? DEFAULT_HOOKS;
  return hooks[seed % hooks.length];
}

// The stub lying in a given direction from the player's region, if any.
export function stubToward(fromRegionId, targetName) {
  const list = neighbours(geography(), fromRegionId);
  const tl = String(targetName ?? '').toLowerCase();
  return list.find(n => n.name?.toLowerCase() === tl)
      ?? list.find(n => tl && (n.name?.toLowerCase().includes(tl) || tl.includes(n.name?.toLowerCase())))
      ?? list.find(n => n.stub)
      ?? null;
}

// A region has been generated: give it its real name, mark it visited, and mint
// ITS neighbours so the frontier keeps moving outward.
export function hydrateRegion(stubId, realName) {
  let geo = geography();
  const node = geo.nodes[stubId];
  if (!node) return geo;
  geo = { ...geo, nodes: { ...geo.nodes, [stubId]: { ...node, name: realName ?? node.name } } };
  geo = markVisited(geo, stubId);
  geo = expandFrom(geo, stubId, { count: 2, nameFor: neighbourName, hookFor: neighbourHook });
  return save(geo);
}

// ─── The layers above the region (doc 17) ────────────────────────────────────

// Where the player stands, one and two layers up.
export function provinceOf(regionId = appState.world?.location?.regionId) {
  return ancestorsOf(geography(), regionId).find(n => n.kind === 'province') ?? null;
}
export function continentOf(regionId = appState.world?.location?.regionId) {
  return ancestorsOf(geography(), regionId).find(n => n.kind === 'continent') ?? null;
}

// Apply the genesis continent outlines (pure — genesis builds the graph before
// the world write). Outlines match nodes by id; a missing or failed outline
// leaves the stub standing, which is a name and a hook — never an error.
export function applyContinentOutlines(geo, outlines = []) {
  let out = geo;
  for (const o of outlines) {
    if (!o?.id || !out.nodes[o.id]) continue;
    out = promoteNode(out, o.id, { detail: 1, name: o.name, digest: o.digest });
    if (o.factionHomelands?.length) {
      out = { ...out, nodes: { ...out.nodes, [o.id]: { ...out.nodes[o.id], factionHomelands: o.factionHomelands } } };
    }
  }
  return out;
}

// Lazily outline a province on approach (0 → 1). Live write.
export function applyProvinceOutline(provinceId, outline) {
  if (!outline) return geography();
  let geo = promoteNode(geography(), provinceId, {
    detail: 1, name: outline.name, digest: outline.digest,
  });
  const extras = {};
  if (outline.conflicts?.length) extras.conflicts = outline.conflicts;
  if (outline.landmarks?.length) extras.landmarks = outline.landmarks;
  if (outline.dominantFactionId !== undefined) extras.dominantFactionId = outline.dominantFactionId;
  if (outline.factionStance) extras.factionStance = outline.factionStance;
  if (Object.keys(extras).length) {
    geo = { ...geo, nodes: { ...geo.nodes, [provinceId]: { ...geo.nodes[provinceId], ...extras } } };
  }
  return save(geo);
}

// The sea lane out of a province, if it is a port: { to, days } where `to` is
// the far port province node. Sea lanes are minted by the skeleton at genesis.
export function seaLaneFrom(provinceId) {
  const geo = geography();
  const edge = geo.edges.find(e => e.kind === 'sea' && (e.from === provinceId || e.to === provinceId));
  if (!edge) return null;
  const otherId = edge.from === provinceId ? edge.to : edge.from;
  const to = geo.nodes[otherId];
  return to ? { to, days: edge.days ?? 5 } : null;
}

// A landing: file a freshly generated region under a province across the sea
// and wire the crossing into the graph, so the route exists both ways and the
// far continent's frontier starts growing from the landfall.
export function addRegionUnderProvince({ regionId, regionName, provinceId, seed, fromRegionId, days = 5 }) {
  let geo = addNode(geography(), {
    id: regionId, name: regionName, kind: 'region',
    seed: (Number(seed) || mintSeed()) >>> 0, stub: false, detail: 2, parent: provinceId,
  });
  if (fromRegionId) geo = connect(geo, fromRegionId, regionId, { direction: 'east', days, kind: 'sea' });
  geo = markVisited(geo, regionId);
  geo = expandFrom(geo, regionId, { count: 2, nameFor: neighbourName, hookFor: neighbourHook });
  return save(geo);
}

// A region of this province that already has generated content, if any — a
// second sailing lands where the first one did.
export function landedRegionOf(provinceId) {
  return childrenOf(geography(), provinceId)
    .find(r => r.kind === 'region' && appState.world?.regions?.[r.id]) ?? null;
}

// Places the player has been, and places they have only heard of — what /map shows.
export function mapView() { return knownMap(geography()); }

export function travelDays(fromId, toId) {
  return routeBetween(geography(), fromId, toId)?.days ?? null;
}
