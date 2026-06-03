// src/game/worldgen.js — AI-driven world generation pipeline.
//
// Each generator receives only its parent's digest (cascading digests).
// World → Region → Settlement → Dungeon (procedural).
//
// Returns structured data matching the schemas in ai/schemas.js.

import { chatCompletion } from '../ai/client.js';
import { WORLD_SEED_SCHEMA, REGION_SCHEMA, SETTLEMENT_SCHEMA, FACTIONS_SCHEMA, RED_THREAD_SCHEMA } from '../ai/schemas.js';
import { t } from '../i18n/i18n.js';

// ─── World seed (L00) ────────────────────────────────────────────────────────
// No parent digest — this is the root.

export async function generateWorldSeed() {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 1000,
    messages: [
      { role: 'system', content: t('ai.worldSeedPrompt') },
      { role: 'user',   content: t('ai.worldSeedUserMsg') },
    ],
    schema: WORLD_SEED_SCHEMA,
  });
}

// ─── Red thread / beats ──────────────────────────────────────────────────────
// Receives world.digest. Generates 3-5 story beats that drive the campaign.

export async function generateBeats(worldDigest) {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: t('ai.beatsPrompt', { parentDigest: worldDigest }) },
      { role: 'user',   content: t('ai.beatsUserMsg') },
    ],
    schema: RED_THREAD_SCHEMA,
  });
}

// ─── Factions ────────────────────────────────────────────────────────────────
// Receives world.digest only. Generates 2-3 factions that shape the world's politics.

export async function generateFactions(worldDigest) {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 1200,
    messages: [
      { role: 'system', content: t('ai.factionsPrompt', { parentDigest: worldDigest }) },
      { role: 'user',   content: t('ai.factionsUserMsg') },
    ],
    schema: FACTIONS_SCHEMA,
  });
}

// ─── Region (L02) ────────────────────────────────────────────────────────────
// Receives world.digest only (~150 tok).

export async function generateRegion(parentDigest) {
  return chatCompletion({
    tier: 'medium',
    max_tokens: 800,
    messages: [
      { role: 'system', content: t('ai.regionPrompt', { parentDigest }) },
      { role: 'user',   content: t('ai.regionUserMsg') },
    ],
    schema: REGION_SCHEMA,
  });
}

// ─── Settlement (L03) ────────────────────────────────────────────────────────
// Receives region.digest only (~200 tok).

export async function generateSettlement(parentDigest, regionId) {
  const raw = await chatCompletion({
    tier: 'medium',
    max_tokens: 3000,
    messages: [
      { role: 'system', content: t('ai.settlementPrompt', { parentDigest, regionId }) },
      { role: 'user',   content: t('ai.settlementUserMsg') },
    ],
    schema: SETTLEMENT_SCHEMA,
  });
  if (!raw) return null;
  // Normalize NPCs — fill missing optional fields so downstream code doesn't crash.
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
