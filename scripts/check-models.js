// scripts/check-models.js — verify every configured model id still exists.
//
// Model ids rot. The free narrator slot and all four fallback entries were
// delisted by the provider at some point after they were written, so the
// default configuration could not complete a turn — and nothing in the repo
// noticed. Runtime healing (healModels) covers players; this covers the repo,
// so the defaults get fixed instead of silently relying on the heal.
//
// Usage: node scripts/check-models.js   (exit 1 if any configured id is gone)

import { FREE_MODELS, PAID_MODELS, FREE_FALLBACKS } from '../vendor/bag-of-holding-client/index.js';

const BASE = process.env.DD_BASE_URL ?? 'https://openrouter.ai/api/v1';

const res = await fetch(`${BASE}/models`, { headers: { Accept: 'application/json' } });
if (!res.ok) {
  console.error(`Could not fetch the model catalog (${res.status}). Skipping — not treating as a failure.`);
  process.exit(0);
}
const live = new Set(((await res.json())?.data ?? []).map(m => m.id));
console.log(`Catalog: ${live.size} models\n`);

const configured = [
  ...Object.entries(FREE_MODELS).map(([tier, id]) => [`FREE_MODELS.${tier}`, id]),
  ...Object.entries(PAID_MODELS).map(([tier, id]) => [`PAID_MODELS.${tier}`, id]),
  ...Object.entries(FREE_FALLBACKS).flatMap(([tier, ids]) =>
    ids.map((id, i) => [`FREE_FALLBACKS.${tier}[${i}]`, id])),
];

const dead = [];
for (const [where, id] of configured) {
  if (id === null) { console.log(`  –  ${where}: (unconfigured)`); continue; }
  const ok = live.has(id);
  console.log(`  ${ok ? '✓' : '✗'}  ${where}: ${id}`);
  if (!ok) dead.push([where, id]);
}

if (dead.length) {
  console.error(`\n${dead.length} configured model id(s) no longer exist:`);
  for (const [where, id] of dead) console.error(`  ${where} = ${id}`);
  console.error('\nUpdate the tables in bag-of-holding-client/src/llm/tiers.js and re-sync vendor/.');
  process.exit(1);
}
console.log('\nAll configured model ids are live.');
