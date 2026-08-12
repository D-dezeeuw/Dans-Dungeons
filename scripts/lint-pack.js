#!/usr/bin/env node
// scripts/lint-pack.js — check a setting pack before it is registered.
//
//   node scripts/lint-pack.js src/settings/pack-neon-stacks.js
//   node scripts/lint-pack.js                      # every registered pack
//
// The rules live in src/settings/packs.js so the test suite and this script
// cannot disagree. What it catches is the class of failure a data file makes
// easy and review makes hard: an enemy id with no stat block, a dungeon theme
// with no dressing or no climate, an i18n key whose typo turns an override into
// a silent no-op, a voice block that would tax every turn of an 80-hour
// campaign. All of them look fine at genesis and bite hours later.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { lintPack, flattenKeys, SETTING_PACKS } from '../src/settings/packs.js';
import { CUSTOM_MONSTERS, OVERWORLD_ENEMY_IDS, DEFAULT_ENEMY_IDS } from '../src/game/creatures.js';
import { CLIMATE_BANDS } from '../vendor/bag-of-holding-client/index.js';
import { SRD } from '../vendor/bag-of-holding/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Every base string a pack could inherit, as { key, text } — the forbid rule
// checks a pack's banned words against the content it does NOT override.
function baseTextOf(bundle) {
  const out = [];
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node ?? {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') out.push({ key, text: v });
      else if (Array.isArray(v)) out.push({ key, text: v.filter(x => typeof x === 'string').join(' ') });
      else if (v && typeof v === 'object') walk(v, key);
    }
  };
  walk(bundle, '');
  // Model prompts are instructions, not player-facing prose; a forbid word
  // appearing inside one is the pack doing its job.
  return out.filter(e => !e.key.startsWith('ai.'));
}

const baseBundle = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf8'));
const baseKeys = new Set(flattenKeys(baseBundle));
const baseText = baseTextOf(baseBundle);
const knownCreatureIds = new Set(Object.keys({ ...SRD.monsters, ...CUSTOM_MONSTERS }));
const reachableCreatureIds = [...new Set([...OVERWORLD_ENEMY_IDS, ...DEFAULT_ENEMY_IDS])];
const opts = { knownCreatureIds, baseKeys, baseText, climateBands: CLIMATE_BANDS, reachableCreatureIds };

const targets = [];
const arg = process.argv[2];
if (arg) {
  const mod = await import(pathToFileURL(path.resolve(ROOT, arg)).href);
  const pack = mod.PACK ?? mod.default;
  if (!pack) {
    console.error(`${arg}: no PACK export`);
    process.exit(2);
  }
  targets.push([arg, pack]);
} else {
  for (const [id, pack] of Object.entries(SETTING_PACKS)) targets.push([id, pack]);
}

let failed = 0;
for (const [label, pack] of targets) {
  const problems = lintPack(pack, opts);
  if (problems.length) {
    failed++;
    console.error(`✗ ${label}`);
    for (const p of problems) console.error(`    ${p}`);
  } else {
    const themes = Object.keys(pack.tables?.dungeonThemes ? pack.overlays ?? {} : {}).length;
    console.log(`✓ ${label}${themes ? ` (${themes} themes)` : ''}`);
  }
}
process.exit(failed ? 1 : 0);
