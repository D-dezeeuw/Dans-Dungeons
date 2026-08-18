// The Hollow Vale — the third setting pack (3.2.0): gothic horror,
// THE DARKLORDS ARE PEOPLE THE PCS KNEW. Mounts through the 3.0.0
// setting slots; the gothic mechanics ride EXISTING engine surfaces —
// the dread track is a VariantEncounter custom track, light-as-resource
// is the pure `burnLight` helper, dream sequences are ordinary beats
// flagged `dream: true`:
//
//   const engine = createEngine({
//     extraRegions: HOLLOW_VALE.regions,
//     extraNpcs: HOLLOW_VALE.npcs,
//     extraStoryHooks: HOLLOW_VALE.hooks,
//     extraAdventures: HOLLOW_VALE.adventures,
//   });
//   let pc = VariantEncounter.adjustTrack(pc, 'dread', 2, HOLLOW_VALE_DREAD.band).actor;

import {
  HOLLOW_VALE_REGIONS, HOLLOW_VALE_CITIES, HOLLOW_VALE_NPCS,
  HOLLOW_VALE_FACTIONS, HOLLOW_VALE_DREAD, burnLight,
} from './pack.js';
import {
  HOLLOW_VALE_HOOKS, BRAMBLEFELL, HOLLOW_VALE_ADVENTURES,
} from './story.js';

export {
  HOLLOW_VALE_REGIONS, HOLLOW_VALE_CITIES, HOLLOW_VALE_NPCS,
  HOLLOW_VALE_FACTIONS, HOLLOW_VALE_DREAD, burnLight,
  HOLLOW_VALE_HOOKS, BRAMBLEFELL, HOLLOW_VALE_ADVENTURES,
};

export const HOLLOW_VALE = Object.freeze({
  id: 'hollow-vale',
  name: 'The Hollow Vale',
  pitch: 'Gothic horror in one small valley: the Darklords are people the PCs knew, and every domain is a moral arc with a door out.',
  regions: HOLLOW_VALE_REGIONS,
  cities: HOLLOW_VALE_CITIES,
  factions: HOLLOW_VALE_FACTIONS,
  hooks: HOLLOW_VALE_HOOKS,
  npcs: HOLLOW_VALE_NPCS,
  dread: HOLLOW_VALE_DREAD,
  adventures: HOLLOW_VALE_ADVENTURES,
});

export default HOLLOW_VALE;
