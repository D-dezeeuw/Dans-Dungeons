// Brassgear — the second setting pack (3.1.0): magitech-noir, THE MAGIC
// IS DYING. Mounts through the same 3.0.0 setting slots Sundermark
// established, plus the Phase A.2 class-graft surface for the Tinker
// (the artificer-equivalent — a graft, not a new top-level class):
//
//   const engine = createEngine({
//     extraRegions: BRASSGEAR.regions,
//     extraNpcs: BRASSGEAR.npcs,
//     extraStoryHooks: BRASSGEAR.hooks,
//     extraAdventures: BRASSGEAR.adventures,
//     extraSpecies: BRASSGEAR.species,
//     extraBackgrounds: BRASSGEAR.backgrounds,
//     extraFeats: BRASSGEAR.feats,
//     extraMechanics: BRASSGEAR.tinker.mechanics,
//     extraResources: BRASSGEAR.tinker.resources,
//   });
//
// Talents (the inherited-talent system, Brassgear's dragonmark
// equivalent) are pack data like factions and cities — the host stamps
// `talentId` on an actor and reads the grants.

import {
  BRASSGEAR_REGIONS, BRASSGEAR_CITIES, BRASSGEAR_TALENTS, BRASSGEAR_TINKER,
  BRASSGEAR_SPECIES, BRASSGEAR_BACKGROUNDS, BRASSGEAR_FEATS,
} from './pack.js';
import {
  BRASSGEAR_HOOKS, BRASSGEAR_FACTIONS, BRASSGEAR_NPCS,
  THE_GREENMIST_HEIST, BRASSGEAR_ADVENTURES,
} from './story.js';

export {
  BRASSGEAR_REGIONS, BRASSGEAR_CITIES, BRASSGEAR_TALENTS, BRASSGEAR_TINKER,
  BRASSGEAR_SPECIES, BRASSGEAR_BACKGROUNDS, BRASSGEAR_FEATS,
  BRASSGEAR_HOOKS, BRASSGEAR_FACTIONS, BRASSGEAR_NPCS,
  THE_GREENMIST_HEIST, BRASSGEAR_ADVENTURES,
};

export const BRASSGEAR = Object.freeze({
  id: 'brassgear',
  name: 'Brassgear',
  pitch: 'Magitech-noir where the magic is dying: bankrupt talent-houses, decaying constructs, black-market schematics.',
  regions: BRASSGEAR_REGIONS,
  cities: BRASSGEAR_CITIES,
  factions: BRASSGEAR_FACTIONS,
  hooks: BRASSGEAR_HOOKS,
  npcs: BRASSGEAR_NPCS,
  talents: BRASSGEAR_TALENTS,
  tinker: BRASSGEAR_TINKER,
  species: BRASSGEAR_SPECIES,
  backgrounds: BRASSGEAR_BACKGROUNDS,
  feats: BRASSGEAR_FEATS,
  adventures: BRASSGEAR_ADVENTURES,
});

export default BRASSGEAR;
