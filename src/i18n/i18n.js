// src/i18n/i18n.js — zero-dep locale system.
//
// t(key)            → translated string
// t(key, {n: 'X'})  → interpolated: "Hello {{n}}" → "Hello X"
// locale()          → current locale code ('en' | 'nl')
// setLocale(code)   → switch + persist to localStorage
// tRaw(key)         → returns the raw value (array/object) from the bundle
//
// A setting pack (doc 19) can put its own content in front of the bundles via
// setContentOverlay(): the pack's tree is consulted first, per key, so a pack
// that renames the world's rooms and creatures does not have to restate every
// string it leaves alone — and no call site changes. The resolution order
// itself lives in resolve.js, pure and tested.

import en from './en.json';
import nl from './nl.json';
import { orderedRoots, resolveKey, interpolate } from './resolve.js';

const BUNDLES = { en, nl };
const STORAGE_KEY = 'dg-locale';
const DEFAULT_LOCALE = 'en';

let _locale = localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
let _overlay = null;   // { en: {...}, nl: {...} } — a pack's sparse content tree

export function locale() { return _locale; }

export function setLocale(code) {
  if (!BUNDLES[code]) return;
  _locale = code;
  localStorage.setItem(STORAGE_KEY, code);
}

// Install (or clear, with null) a setting pack's content. Module state, not
// Spektrum state: it is a property of which pack is mounted, and every path
// that re-enters a running game re-applies it (see src/settings/index.js).
export function setContentOverlay(byLocale) { _overlay = byLocale ?? null; }
export function clearContentOverlay()       { _overlay = null; }
export function contentOverlay()            { return _overlay; }

const roots = () => orderedRoots({ overlay: _overlay, bundles: BUNDLES, locale: _locale, fallback: DEFAULT_LOCALE });

export function t(key, params) {
  const val = resolveKey(roots(), key);
  if (val === undefined) return key;
  return interpolate(val, params);
}

// Returns a raw value (array or object) from the active content.
export function tRaw(key) {
  return resolveKey(roots(), key, { allowNonString: true });
}
