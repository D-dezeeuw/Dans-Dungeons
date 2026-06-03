// src/game/worldgen.js — AI-driven world generation pipeline.
//
// Each generator receives its parent's digest + the world blueprint.
// The blueprint provides pre-seeded archetype choices that constrain the AI.

import { chatCompletion } from '../ai/client.js';
import { WORLD_SEED_SCHEMA, REGION_SCHEMA, SETTLEMENT_SCHEMA, FACTIONS_SCHEMA, RED_THREAD_SCHEMA } from '../ai/schemas.js';
import { t } from '../i18n/i18n.js';

// ─── Blueprint context builder ───────────────────────────────────────────────
// Formats blueprint choices into a string the AI can use as constraints.

function blueprintContext(bp) {
  if (!bp) return '';
  const parts = [];
  if (bp.tone)           parts.push(`Tone: ${bp.tone}`);
  if (bp.worldArchetype) parts.push(`World archetype: ${bp.worldArchetype}`);
  if (bp.threatType)     parts.push(`Primary threat: ${bp.threatType}`);
  if (bp.climate)        parts.push(`Climate: ${bp.climate}`);
  if (bp.dungeonTheme)   parts.push(`Dungeon theme: ${bp.dungeonTheme}`);
  if (bp.godDomains?.length) {
    const doms = bp.godDomains.map(g => `${g.domain} (e.g. ${g.exemplars[0]})`).join(', ');
    parts.push(`God domains to draw from: ${doms}`);
  }
  if (bp.factionSlots?.length) {
    const facs = bp.factionSlots.map(f => `${f.type} — ${f.desc}`).join('; ');
    parts.push(`Faction archetypes: ${facs}`);
  }
  if (bp.beatArc?.length) {
    parts.push(`Story arc beats: ${bp.beatArc.join(' → ')}`);
  }
  if (bp.settlementType) parts.push(`Settlement type: ${bp.settlementType}`);
  if (bp.buildingTypes?.length) parts.push(`Key buildings: ${bp.buildingTypes.join(', ')}`);
  if (bp.locationTypes?.length) parts.push(`Nearby landmarks: ${bp.locationTypes.join(', ')}`);
  return parts.join('\n');
}

// ─── World seed (L00) ────────────────────────────────────────────────────────

export async function generateWorldSeed(blueprint) {
  const constraints = blueprint ? `\n\nUse these creative constraints:\n${blueprintContext(blueprint)}` : '';
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
  const arcHint = blueprint?.beatArc?.length
    ? `\n\nUse this story arc structure: ${blueprint.beatArc.join(' → ')}. Each beat maps to one step in this arc.`
    : '';
  const factionHint = blueprint?.factionSlots?.length
    ? `\nTie beats to these faction types: ${blueprint.factionSlots.map(f => f.type).join(', ')}.`
    : '';
  return chatCompletion({
    tier: 'medium',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: t('ai.beatsPrompt', { parentDigest: worldDigest }) + arcHint + factionHint },
      { role: 'user',   content: t('ai.beatsUserMsg') },
    ],
    schema: RED_THREAD_SCHEMA,
  });
}

// ─── Factions ────────────────────────────────────────────────────────────────

export async function generateFactions(worldDigest, blueprint) {
  const slotHint = blueprint?.factionSlots?.length
    ? `\n\nCreate exactly ${blueprint.factionSlots.length} factions using these archetypes:\n${blueprint.factionSlots.map((f, i) => `${i + 1}. A "${f.type}" faction (${f.desc})`).join('\n')}\n\nEach faction MUST reference the world's red thread and primary threat.`
    : '';
  return chatCompletion({
    tier: 'medium',
    max_tokens: 1200,
    messages: [
      { role: 'system', content: t('ai.factionsPrompt', { parentDigest: worldDigest }) + slotHint },
      { role: 'user',   content: t('ai.factionsUserMsg') },
    ],
    schema: FACTIONS_SCHEMA,
  });
}

// ─── Region (L02) ────────────────────────────────────────────────────────────

export async function generateRegion(parentDigest, blueprint) {
  const climateHint = blueprint?.climate
    ? `\n\nThe region's climate is: ${blueprint.climate}. Reflect this in the description, settlement architecture, and hazards.`
    : '';
  const themeHint = blueprint?.dungeonTheme
    ? `\nThe nearby dungeon should be themed as: ${blueprint.dungeonTheme}.`
    : '';
  const locationHint = blueprint?.locationTypes?.length
    ? `\nNearby landmarks include: ${blueprint.locationTypes.join(', ')}.`
    : '';
  return chatCompletion({
    tier: 'medium',
    max_tokens: 800,
    messages: [
      { role: 'system', content: t('ai.regionPrompt', { parentDigest }) + climateHint + themeHint + locationHint },
      { role: 'user',   content: t('ai.regionUserMsg') },
    ],
    schema: REGION_SCHEMA,
  });
}

// ─── Settlement (L03) ────────────────────────────────────────────────────────

export async function generateSettlement(parentDigest, regionId, blueprint) {
  const typeHint = blueprint?.settlementType
    ? `\n\nThis settlement is a: ${blueprint.settlementType}. Reflect this in the description and NPC roles.`
    : '';
  const buildingHint = blueprint?.buildingTypes?.length
    ? `\nKey buildings in this settlement: ${blueprint.buildingTypes.join(', ')}. NPCs should relate to these.`
    : '';
  const factionHint = blueprint?.factionSlots?.length
    ? `\nAt least one NPC should be affiliated with one of these factions: ${blueprint.factionSlots.map(f => f.type).join(', ')}.`
    : '';
  const raw = await chatCompletion({
    tier: 'medium',
    max_tokens: 3000,
    messages: [
      { role: 'system', content: t('ai.settlementPrompt', { parentDigest, regionId }) + typeHint + buildingHint + factionHint },
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
