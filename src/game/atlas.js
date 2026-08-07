// src/game/atlas.js — the world map, bound to Spektrum (Epic E6.S1 wiring).
//
// Overworld travel used to mint a brand-new region on every departure, from a
// fresh `Math.random()` seed: leaving town twice in the same direction produced
// two different places, and walking back the way you came arrived somewhere
// that had never existed before. The player was always at the centre of a star.
//
// The graph fixes that with stubs. Every region pre-mints its neighbours as
// {id, name, hook, seed} the moment it is generated — no LLM call, no content,
// just a promise the world keeps. Arriving hydrates the stub FROM ITS OWN SEED,
// so the place beyond the northern road was always going to be that place.

import {
  emptyGeography, addNode, connect, neighbours, expandFrom, markVisited,
  knownMap, routeBetween, mintSeed,
} from 'bag-of-holding-client';
import { appState, setValue, tick } from '../core/state.js';

export function geography() { return appState.world?.geography ?? emptyGeography(); }

function save(geo) { setValue('world.geography', geo); tick(); return geo; }

// Build the starting map: this region, plus neighbours minted as stubs. Pure —
// returns the graph for the caller to include in its own world write (campaign
// setup writes `world` wholesale, and a separate setValue would be clobbered).
export function initialAtlas(regionId, regionName, seed) {
  let geo = addNode(emptyGeography(), {
    id: regionId, name: regionName, kind: 'region',
    seed: (seed ?? mintSeed()) >>> 0, stub: false,
  });
  return expandFrom(geo, regionId, { count: 3, nameFor: neighbourName, hookFor: neighbourHook });
}

// Same, but writes it — for campaigns already in progress when the map arrived.
export function initAtlas(regionId, regionName, seed) {
  if (appState.world?.geography?.nodes?.[regionId]) return geography();
  return save(initialAtlas(regionId, regionName, seed));
}

// Stub names and hooks are deterministic from the seed, so the same world always
// promises the same places. They are placeholders until the region is generated,
// at which point the real name replaces them.
function neighbourName(seed, direction) {
  const words = ['Reach', 'March', 'Hollow', 'Fen', 'Downs', 'Barrows', 'Waste', 'Shore', 'Vale', 'Wold'];
  const qual  = ['Salt', 'Ash', 'Iron', 'Grey', 'Thorn', 'Ember', 'Mire', 'Bone', 'Storm', 'Elder'];
  return `${qual[seed % qual.length]}${words[(seed >> 5) % words.length].toLowerCase()}`;
}
function neighbourHook(seed, direction) {
  const hooks = ['smoke on the horizon', 'a road nobody maintains', 'bells heard at odd hours',
                 'a border nobody polices', 'water that tastes of iron', 'birds that will not settle'];
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

// Places the player has been, and places they have only heard of — what /map shows.
export function mapView() { return knownMap(geography()); }

export function travelDays(fromId, toId) {
  return routeBetween(geography(), fromId, toId)?.days ?? null;
}
