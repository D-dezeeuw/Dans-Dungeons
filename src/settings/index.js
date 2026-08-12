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
import { setContentOverlay } from '../i18n/i18n.js';
import { resolvePack, packCard, packIds, isKnownPack, DEFAULT_PACK_ID } from './packs.js';
import { locale } from '../i18n/i18n.js';

export {
  SETTING_PACKS, DEFAULT_PACK_ID, packIds, resolvePack, isKnownPack,
  packCard, pickPack, mergeTables, lintPack,
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
