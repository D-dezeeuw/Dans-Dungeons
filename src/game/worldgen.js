// src/game/worldgen.js — AI-driven world generation pipeline.
//
// Each generator receives its parent's digest + the world blueprint.
// The blueprint provides pre-seeded archetype choices that constrain the AI.

import { chatCompletion } from '../ai/client.js';
import { WORLD_SEED_SCHEMA, REGION_SCHEMA, SETTLEMENT_SCHEMA, FACTIONS_SCHEMA, RED_THREAD_SCHEMA } from '../ai/schemas.js';
import { t } from '../i18n/i18n.js';
import { worldSeedConstraints, beatsHints, factionsHints, regionHints, settlementHints } from './blueprint-context.js';

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
