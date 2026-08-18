// === The plugin manifest format (5.0.0 row) ===
//
// `bag-of-holding.json` — the file a third-party content pack publishes
// beside its code so loaders, catalogs and CI can reason about it
// WITHOUT executing it. The manifest declares identity, the kernel API
// range the pack was built against, and which plugin tables it
// contributes; `validateManifest` is the gate, and `manifestMatches`
// answers "can this kernel mount that pack?".
//
// The schema itself is versioned (`manifestVersion`) so the format can
// grow without stranding published packs — same discipline as the
// client's cartridge envelope.

export const MANIFEST_VERSION = 1;

/** The plugin tables a manifest may declare, mapped to the engine
 *  option each mounts through. The vocabulary is the 3.3.0 setting
 *  contract's slotted set plus the Phase A/B/C surfaces. */
export const MANIFEST_TABLES = Object.freeze({
  species: 'extraSpecies',
  classes: 'extraClasses',
  backgrounds: 'extraBackgrounds',
  feats: 'extraFeats',
  spells: 'extraSpells',
  items: 'extraItems',
  monsters: 'extraMonsters',
  conditions: 'extraConditions',
  mastery: 'extraMastery',
  mechanics: 'extraMechanics',
  resources: 'extraResources',
  regions: 'extraRegions',
  npcs: 'extraNpcs',
  storyHooks: 'extraStoryHooks',
  adventures: 'extraAdventures',
  locales: 'extraLocales',
  rules: 'rules',
  hooks: 'hooks',
});

// Semver triple: 1.2.3 (no prerelease/build — packs pin releases).
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
// Kernel range: ^X.Y.Z, >=X.Y.Z, >=X.Y.Z <A.B.C, or exact X.Y.Z.
const RANGE = /^(\^|>=)?\d+\.\d+\.\d+( <\d+\.\d+\.\d+)?$/;

const parse = (v) => {
  const m = SEMVER.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Validate a manifest object (already parsed from bag-of-holding.json).
 * Returns `{ valid, errors }` — never throws, same reporting contract
 * as Settings.validate. Checks:
 *   - manifestVersion is a known schema version.
 *   - name is npm-shaped, version is a semver triple.
 *   - kernel is a supported range expression.
 *   - contributes names only known tables, each with a positive count.
 *   - entry (optional) is a relative module path.
 */
export function validateManifest(manifest) {
  const errors = [];
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['a manifest must be an object'] };
  }
  if (manifest.manifestVersion !== MANIFEST_VERSION) {
    errors.push(`manifestVersion must be ${MANIFEST_VERSION} (got ${manifest.manifestVersion})`);
  }
  if (typeof manifest.name !== 'string' || !/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(manifest.name)) {
    errors.push('name must be an npm-shaped package name');
  }
  if (typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)) {
    errors.push('version must be a semver triple (e.g. 1.2.0)');
  }
  if (typeof manifest.kernel !== 'string' || !RANGE.test(manifest.kernel)) {
    errors.push("kernel must be a range: '^X.Y.Z', '>=X.Y.Z', '>=X.Y.Z <A.B.C' or exact 'X.Y.Z'");
  }
  if (manifest.contributes === undefined || manifest.contributes === null
    || typeof manifest.contributes !== 'object' || Array.isArray(manifest.contributes)
    || Object.keys(manifest.contributes ?? {}).length === 0) {
    errors.push('contributes must declare at least one table');
  } else {
    for (const [table, count] of Object.entries(manifest.contributes)) {
      if (!(table in MANIFEST_TABLES)) {
        errors.push(`contributes.${table}: unknown table (known: ${Object.keys(MANIFEST_TABLES).join(', ')})`);
      } else if (!Number.isInteger(count) || count < 1) {
        errors.push(`contributes.${table}: count must be a positive integer`);
      }
    }
  }
  if (manifest.entry !== undefined) {
    if (typeof manifest.entry !== 'string' || !manifest.entry.startsWith('./')) {
      errors.push("entry must be a relative module path (./…)");
    }
  }
  if (manifest.description !== undefined && typeof manifest.description !== 'string') {
    errors.push('description must be a string');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Does a kernel version satisfy a manifest's declared range?
 *   - `^X.Y.Z`         — same major, >= X.Y.Z.
 *   - `>=X.Y.Z`        — at least.
 *   - `>=X.Y.Z <A.B.C` — half-open window.
 *   - `X.Y.Z`          — exactly.
 */
export function kernelSatisfies(kernelVersion, range) {
  const kernel = parse(kernelVersion);
  if (!kernel || typeof range !== 'string' || !RANGE.test(range)) return false;
  if (range.startsWith('^')) {
    const min = parse(range.slice(1));
    return kernel[0] === min[0] && cmp(kernel, min) >= 0;
  }
  if (range.startsWith('>=')) {
    const [lo, hi] = range.slice(2).split(' <');
    const min = parse(lo);
    if (cmp(kernel, min) < 0) return false;
    if (hi) return cmp(kernel, parse(hi)) < 0;
    return true;
  }
  return cmp(kernel, parse(range)) === 0;
}

/**
 * The loader-side verdict: is `manifest` valid AND mountable on this
 * kernel? Returns `{ ok, reasons }` — the catalog row's red/green.
 */
export function manifestMatches(manifest, kernelVersion) {
  const verdict = validateManifest(manifest);
  if (!verdict.valid) return { ok: false, reasons: verdict.errors };
  if (!kernelSatisfies(kernelVersion, manifest.kernel)) {
    return {
      ok: false,
      reasons: [`kernel ${kernelVersion} does not satisfy the pack's declared range '${manifest.kernel}'`],
    };
  }
  return { ok: true, reasons: [] };
}
