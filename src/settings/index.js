// src/settings/index.js — the setting pack, bound to the running game.
//
// packs.js is the registry and the rules; this is the half that knows which
// pack a campaign is playing and installs it. Two things live here and nowhere
// else:
//
//   activePack()       — the pack this world was generated with. The id rides
//                        in `world.settingId`, so save export/import, slots and
//                        time-travel branches carry it for free.
//   applyPackOverlay() — installs the pack's content in front of the locale
//                        bundles. This is NOT free with the id: the overlay is
//                        i18n module state, so every path that re-enters a
//                        running game has to re-apply it (boot, save import,
//                        slot load, time-travel restore, locale switch). Miss
//                        one and the campaign silently reverts to base content
//                        halfway through — the failure mode is "some strings
//                        themed, some not", which reads as a content bug.

import { appState } from '../core/state.js';
import { setContentOverlay, locale } from '../i18n/i18n.js';
import { resolvePack, packCard, DEFAULT_PACK_ID } from './packs.js';

export {
  SETTING_PACKS, DEFAULT_PACK_ID, packIds, resolvePack, isKnownPack,
  packCard, packTagline, pickPack, lintPack,
} from './packs.js';

// The pack the current world was generated with. Falls back to classic, which
// inherits everything — a save naming a pack that no longer ships keeps
// working in the base game's clothes.
export function activePack() {
  return resolvePack(appState.world?.settingId ?? DEFAULT_PACK_ID);
}

export function activePackId() {
  return activePack().id;
}

// Install a pack's content overlay. Call with no argument to re-apply whatever
// the current world says — that is the form every re-entry point wants.
export function applyPackOverlay(pack = activePack()) {
  setContentOverlay(pack?.i18n ?? null);
  return pack;
}

// The pack's card in the player's language, for the wizard and the sidebar.
export function activePackCard() {
  return packCard(activePack(), locale());
}

// Does the active pack author this content itself, in any locale? Used where a
// caller has to know whether the pack OWNS a table rather than just read it
// through the overlay — the vault's treasure precedence is the case that
// matters (see src/game/world.js).
export function packAuthors(path) {
  const tree = activePack().i18n;
  if (!tree) return false;
  return Object.values(tree).some((byLocale) => {
    const val = path.split('.').reduce((o, k) => (o == null ? o : o[k]), byLocale);
    return Array.isArray(val) ? val.length > 0 : val != null;
  });
}

// The active pack as the library's `setting` object — one mapping, used by
// every library entry point that decides a world's vocabulary. The game's live
// genesis calls the pieces individually (the skeleton takes syllables + hooks,
// the blueprint takes tables); anything that bakes a PRE-generated world
// passes this whole object to bakeCartridge, which records the id so a catalog
// can say which world is which. Without one mapping the two paths drift, and a
// mounted cartridge disagrees with the live game about its own genre.
export function settingSlice(pack = activePack()) {
  if (!pack || pack.id === DEFAULT_PACK_ID) return null;   // classic = library defaults
  return {
    id:        pack.id,
    tables:    pack.tables    ?? null,
    syllables: pack.syllables ?? null,
    hooks:     pack.stubHooks ?? null,
  };
}

// Class and species labels, skinned. The mechanics never move: `classId` stays
// 'wizard' in the record, the sheet derives from the same SRD data, and only
// the word on the button changes. A netrunner is a wizard's numbers wearing
// different clothes.
export function skinLabel(kind, id, fallback = null) {
  const pack = activePack();
  const table = kind === 'species' ? pack.speciesSkins : pack.classSkins;
  const entry = table?.[id];
  const label = typeof entry === 'string' ? entry : (entry?.[locale()] ?? entry?.en);
  return label ?? fallback ?? id;
}
