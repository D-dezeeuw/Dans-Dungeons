// Sundermark — the first complete setting pack (3.0.0).
//
// High fantasy at continental scope; the twist is that THE GODS HAVE
// DIED, and every faction is an answer to what you do with what they
// left. The pack is a bundle of plain frozen tables mounted through the
// engine's plugin slots — the four new 3.0.0 slots (extraRegions,
// extraNpcs, extraStoryHooks, extraAdventures) plus the ones that have
// existed since Phase A (extraSpecies, extraBackgrounds, extraFeats):
//
//   const engine = createEngine({
//     extraRegions: SUNDERMARK.regions,
//     extraNpcs: SUNDERMARK.npcs,
//     extraStoryHooks: SUNDERMARK.hooks,
//     extraAdventures: SUNDERMARK.adventures,
//     extraSpecies: SUNDERMARK.species,
//     extraBackgrounds: SUNDERMARK.backgrounds,
//     extraFeats: SUNDERMARK.feats,
//   });
//
// Factions and cities are pack data without an engine slot — hosts and
// the worldgen client consume them directly (`SUNDERMARK.factions`,
// `SUNDERMARK.cities`), same boundary the client's power layer uses.

import {
  SUNDERMARK_REGIONS, SUNDERMARK_CITIES, SUNDERMARK_FACTIONS, SUNDERMARK_HOOKS,
} from './world.js';
import {
  SUNDERMARK_NPCS, SUNDERMARK_SPECIES, SUNDERMARK_BACKGROUNDS, SUNDERMARK_FEATS,
} from './cast.js';
import {
  THE_SINGING_TOWER, HALBERDS_EDGE, SUNDERMARK_ADVENTURES,
} from './adventures.js';

export {
  SUNDERMARK_REGIONS, SUNDERMARK_CITIES, SUNDERMARK_FACTIONS, SUNDERMARK_HOOKS,
  SUNDERMARK_NPCS, SUNDERMARK_SPECIES, SUNDERMARK_BACKGROUNDS, SUNDERMARK_FEATS,
  THE_SINGING_TOWER, HALBERDS_EDGE, SUNDERMARK_ADVENTURES,
};

export const SUNDERMARK = Object.freeze({
  id: 'sundermark',
  name: 'Sundermark',
  pitch: 'High fantasy where the gods have died: relic-drawing clerics, oaths sworn to memories, divination as séance.',
  regions: SUNDERMARK_REGIONS,
  cities: SUNDERMARK_CITIES,
  factions: SUNDERMARK_FACTIONS,
  hooks: SUNDERMARK_HOOKS,
  npcs: SUNDERMARK_NPCS,
  species: SUNDERMARK_SPECIES,
  backgrounds: SUNDERMARK_BACKGROUNDS,
  feats: SUNDERMARK_FEATS,
  adventures: SUNDERMARK_ADVENTURES,
});

export default SUNDERMARK;
