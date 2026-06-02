// src/i18n/i18n.js — zero-dep locale system.
//
// t(key)            → translated string
// t(key, {n: 'X'})  → interpolated: "Hello {{n}}" → "Hello X"
// locale()          → current locale code ('en' | 'nl')
// setLocale(code)   → switch + persist to localStorage
// tArr(key)         → returns array from locale bundle (for flavour tables)
// tObj(key)         → returns raw object/array from locale bundle

import en from './en.json';
import nl from './nl.json';

const BUNDLES = { en, nl };
const STORAGE_KEY = 'dg-locale';
const DEFAULT_LOCALE = 'en';

let _locale = localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;

export function locale() { return _locale; }

export function setLocale(code) {
  if (!BUNDLES[code]) return;
  _locale = code;
  localStorage.setItem(STORAGE_KEY, code);
}

export function t(key, params) {
  const bundle = BUNDLES[_locale] ?? BUNDLES.en;
  let val = _get(bundle, key) ?? _get(BUNDLES.en, key) ?? key;
  if (typeof val !== 'string') return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replaceAll(`{{${k}}}`, v);
    }
  }
  return val;
}

// Returns a raw value (array or object) from the locale bundle.
export function tRaw(key) {
  const bundle = BUNDLES[_locale] ?? BUNDLES.en;
  return _get(bundle, key, true) ?? _get(BUNDLES.en, key, true);
}

function _get(obj, path, allowNonString = false) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  if (allowNonString) return cur;
  return typeof cur === 'string' ? cur : undefined;
}
