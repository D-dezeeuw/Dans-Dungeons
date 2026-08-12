// src/i18n/resolve.js — key resolution, pure.
//
// Split out of i18n.js for the same reason scope-budget.js was split out of
// scope.js: i18n.js reads localStorage at import time, so anything living
// inside it can only ever be mirror-tested. The lookup ORDER is the part that
// has to be provable — setting packs (doc 19) re-point roughly two hundred
// existing `t()` / `tRaw()` call sites by inserting two roots in front of the
// base bundles, and a wrong order there is the kind of bug that shows up as
// "some strings themed, some not" three packs later.
//
// Resolution walks an ordered list of roots and takes the first root that has
// the key. Per KEY, not per root — that is what makes a pack overlay sparse:
// a pack overriding `world.rooms.entrance` and nothing else leaves every other
// room type resolving to the base bundle.

// Walk a dotted path. Returns undefined for a missing path, and (unless
// `allowNonString`) for a value that is not a string — a table where a string
// was expected must fall through to the next root rather than being served.
export function getPath(root, key, { allowNonString = false } = {}) {
  const parts = String(key ?? '').split('.');
  let cur = root;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  if (cur == null) return undefined;
  if (allowNonString) return cur;
  return typeof cur === 'string' ? cur : undefined;
}

// The roots, in priority order:
//
//   1. the pack overlay in the player's language
//   2. the pack overlay in English — a pack translated later still themes a
//      Dutch game rather than splitting it half-fantasy, half-cyberpunk
//   3. the base bundle in the player's language
//   4. the base bundle in English
//
// Duplicates are dropped, so an English player gets two roots, not four.
export function orderedRoots({ overlay = null, bundles = {}, locale = 'en', fallback = 'en' } = {}) {
  const out = [];
  const push = (r) => { if (r && !out.includes(r)) out.push(r); };
  if (overlay) { push(overlay[locale]); push(overlay[fallback]); }
  push(bundles[locale]);
  push(bundles[fallback]);
  return out;
}

export function resolveKey(roots, key, opts = {}) {
  for (const root of roots ?? []) {
    const val = getPath(root, key, opts);
    if (val !== undefined) return val;
  }
  return undefined;
}

// "Hello {{name}}" + { name: 'Dan' } → "Hello Dan".
export function interpolate(str, params) {
  if (!params) return str;
  let out = str;
  for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}
