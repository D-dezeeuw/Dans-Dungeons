// src/game/worldgen.js — AI-driven world generation pipeline.
//
// Each generator receives its parent's digest + the world blueprint.
// The blueprint provides pre-seeded archetype choices that constrain the AI.

import { chatCompletion } from '../ai/client.js';
import { WORLD_SEED_SCHEMA, REGION_SCHEMA, SETTLEMENT_SCHEMA, FACTIONS_SCHEMA, RED_THREAD_SCHEMA } from '../ai/schemas.js';
import { t } from '../i18n/i18n.js';
import {
  worldSeedConstraints, beatsHints, factionsHints, regionHints, settlementHints, runPipeline,
} from 'bag-of-holding-client';

// ─── World seed (L00) ────────────────────────────────────────────────────────

export async function generateWorldSeed(blueprint) {
  const constraints = worldSeedConstraints(blueprint);
  return chatCompletion({
    tier: 'medium',
    max_tokens: 1000,
    messages: [
      { role: 'system', content: t('ai.worldSeedPrompt') + constraints },
      { role: 'user',   content: t('ai.worldSeedUserMsg') },
    ],
    schema: WORLD_SEED_SCHEMA,
  });
}

// ─── Red thread / beats ──────────────────────────────────────────────────────

export async function generateBeats(worldDigest, blueprint) {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: t('ai.beatsPrompt', { parentDigest: worldDigest }) + beatsHints(blueprint) },
      { role: 'user',   content: t('ai.beatsUserMsg') },
    ],
    schema: RED_THREAD_SCHEMA,
  });
}

// ─── Factions ────────────────────────────────────────────────────────────────

export async function generateFactions(worldDigest, blueprint) {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 1200,
    messages: [
      { role: 'system', content: t('ai.factionsPrompt', { parentDigest: worldDigest }) + factionsHints(blueprint) },
      { role: 'user',   content: t('ai.factionsUserMsg') },
    ],
    schema: FACTIONS_SCHEMA,
  });
}

// ─── Region (L02) ────────────────────────────────────────────────────────────

export async function generateRegion(parentDigest, blueprint) {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 800,
    messages: [
      { role: 'system', content: t('ai.regionPrompt', { parentDigest }) + regionHints(blueprint) },
      { role: 'user',   content: t('ai.regionUserMsg') },
    ],
    schema: REGION_SCHEMA,
  });
}

// ─── Settlement (L03) ────────────────────────────────────────────────────────

export async function generateSettlement(parentDigest, regionId, blueprint) {
  const raw = await chatCompletion({
    tier: 'medium',
    max_tokens: 3000,
    messages: [
      { role: 'system', content: t('ai.settlementPrompt', { parentDigest, regionId }) + settlementHints(blueprint) },
      { role: 'user',   content: t('ai.settlementUserMsg') },
    ],
    schema: SETTLEMENT_SCHEMA,
  });
  if (!raw) return null;
  // Normalize NPCs — fill missing optional fields.
  if (Array.isArray(raw.npcs)) {
    for (const npc of raw.npcs) {
      npc.personality   ??= '';
      npc.secret        ??= null;
      npc.factionId     ??= null;
      npc.relationships ??= [];
      npc.inventory     ??= null;
      npc.questHook     ??= null;
    }
  }
  raw.regionId ??= regionId;
  return raw;
}

// ─── Full pipeline (shared by campaign start + world-bible export) ─────────────
//
// One declaration of the world → {factions ‖ beats} → region → settlement DAG,
// run through the library's runPipeline (digest threading, parallel group,
// per-layer retry, continue-on-fail, critical-abort). Replaces the two
// previously-divergent hand-rolled pipelines. Returns
// { world, factions, beats, region, settlement } (each a result or null).

const WORLDGEN_LAYERS = [
  { name: 'world', critical: true, retries: 1,
    generate: (_pd, bp) => generateWorldSeed(bp),
    digestOf: (s) => `${s.name} — ${s.tone}. ${s.redThread?.premise ?? ''}` },
  { name: 'factions', group: 1, dependsOn: ['world'],
    generate: async (pd, bp) => { const r = await generateFactions(pd.world, bp); return r?.factions?.length ? r : null; } },
  { name: 'beats', group: 1, dependsOn: ['world'],
    generate: async (pd, bp) => { const r = await generateBeats(pd.world, bp); return r?.beats?.length ? r : null; } },
  { name: 'region', critical: true, dependsOn: ['world'], retries: 1,
    generate: (pd, bp) => generateRegion(pd.world, bp),
    digestOf: (r) => `${r.name} — ${r.climate}.` },
  { name: 'settlement', critical: true, dependsOn: ['region'], retries: 1,
    generate: (pd, bp, ctx) => generateSettlement(pd.region, ctx.results.region?.id, bp),
    digestOf: (s) => `${s.name} — ${(s.npcs ?? []).map(n => n.name).join(', ')}.` },
];

// `critical` overrides which layers abort the pipeline on failure: campaign play
// needs world+region+settlement (default); the world-bible export only needs the
// world seed and renders whatever else succeeds.
export function runWorldgenPipeline(blueprint, { onProgress = () => {}, critical } = {}) {
  const layers = critical
    ? WORLDGEN_LAYERS.map(l => ({ ...l, critical: critical.includes(l.name) }))
    : WORLDGEN_LAYERS;
  return runPipeline(layers, { blueprint, onProgress });
}
