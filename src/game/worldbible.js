// src/game/worldbible.js — standalone worldgen pipeline + EPUB formatter.
//
// Runs the full generation pipeline (world → factions → beats → region →
// settlement → dungeon) and formats the result into EPUB chapters.
// Also stores the raw world JSON for export/import.

import { generateWorldSeed, generateFactions, generateBeats, generateRegion, generateSettlement } from './worldgen.js';
import { createDungeonEntry } from './world.js';
import { chatCompletion } from '../ai/client.js';
import { t, locale } from '../i18n/i18n.js';
import { JOURNAL_SCHEMA } from '../ai/schemas.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDigest(obj, fallback) {
  if (obj && !obj.digest) obj.digest = fallback;
  return obj;
}

async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`${label} failed, retrying in 2s:`, e.message);
    await new Promise(r => setTimeout(r, 2000));
    return await fn();
  }
}

function truncate(s, n = 200) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function generateWorldBible(onProgress) {
  // Step 1: World seed (critical — retry once)
  onProgress('worldgenStep1');
  const seed = await withRetry(() => generateWorldSeed(), 'World seed');
  if (!seed) throw new Error('World seed generation failed — no response from AI.');
  ensureDigest(seed, `${seed.name ?? 'World'} — ${seed.tone ?? 'fantasy'}. ${seed.redThread?.premise ?? ''}`);

  const gods = (seed.gods ?? []).map(g => g.name).join(', ');
  onProgress('detail', `World: "${seed.name}" (${seed.tone}). Gods: ${gods || 'none'}.`);

  // Step 2: Factions (optional — no retry, fail-and-continue)
  onProgress('worldgenStep2');
  let factions = [];
  try {
    const result = await generateFactions(seed.digest);
    factions = result?.factions ?? [];
  } catch (e) {
    console.warn('Faction generation failed, continuing without:', e.message);
  }
  if (factions.length) {
    onProgress('detail', `Factions: ${factions.length} created — ${factions.map(f => f.name).join(', ')}.`);
  } else {
    onProgress('detail', 'Factions: skipped (generation failed).');
  }

  // Step 3: Beats / red thread (optional — no retry, fail-and-continue)
  onProgress('worldgenStep3');
  let beats = [];
  try {
    const result = await generateBeats(seed.digest);
    beats = result?.beats ?? [];
  } catch (e) {
    console.warn('Beat generation failed, continuing without:', e.message);
  }
  if (beats.length) {
    onProgress('detail', `Red thread: ${beats.length} beats. "${truncate(beats[0]?.dramaticPurpose, 120)}"`);
  } else {
    onProgress('detail', 'Red thread: skipped (generation failed).');
  }

  // Step 4: Region (critical — retry once)
  onProgress('worldgenStep4');
  const region = await withRetry(() => generateRegion(seed.digest), 'Region');
  if (!region) throw new Error('Region generation failed — no response from AI.');
  ensureDigest(region, `${region.name ?? 'Region'} — ${region.climate ?? ''}. ${region.settlementName ?? ''}.`);

  onProgress('detail', `Region: "${region.name}" (${region.climate}). Settlement: ${region.settlementName}. Dungeon: ${region.dungeonName}.`);

  // Step 5: Settlement (critical — retry once)
  onProgress('worldgenStep5');
  const settlement = await withRetry(() => generateSettlement(region.digest, region.id), 'Settlement');
  if (!settlement) throw new Error('Settlement generation failed — no response from AI.');
  ensureDigest(settlement, `${settlement.name ?? 'Settlement'} — ${(settlement.npcs ?? []).map(n => n.name).join(', ')}.`);

  const npcNames = (settlement.npcs ?? []).map(n => `${n.name} (${n.role})`).join(', ');
  const exitCount = (settlement.exits ?? []).length;
  onProgress('detail', `Settlement: "${settlement.name}". NPCs: ${npcNames}. ${exitCount} exits.`);

  // Step 6: Dungeon (procedural — instant, no retry needed)
  onProgress('worldgenStep6');
  const dungeonExit = (settlement.exits ?? []).find(e => e.targetType === 'dungeon');
  const dungeon = createDungeonEntry({
    id:       dungeonExit?.targetId ?? `dungeon-${Date.now()}`,
    name:     dungeonExit?.targetName ?? region.dungeonName ?? 'The Dungeon',
    regionId: region.id,
  });

  const roomCount = Object.keys(dungeon.rooms ?? {}).length;
  const enemyCount = Object.keys(dungeon.npcs ?? {}).length;
  onProgress('detail', `Dungeon: "${dungeon.name}" (${dungeon.theme}). ${roomCount} rooms, ${enemyCount} enemies.`);

  const world = { seed, factions, beats, region, settlement, dungeon };
  const rawChapters = formatChapters(world);

  // Step 7: LLM prose polish — rewrite raw chapters into D&D sourcebook prose.
  onProgress('detail', 'Polishing chapters into prose…');
  let chapters;
  try {
    chapters = await polishChapters(rawChapters);
    onProgress('detail', `Polished ${chapters.length} chapters.`);
  } catch (e) {
    console.warn('Polish pass failed, using raw chapters:', e.message);
    chapters = rawChapters;
  }

  // Add colophon (metadata page — not LLM-generated)
  chapters.push({
    heading: 'Colophon',
    text: [
      'Generation Metadata',
      '',
      `World: ${seed.name}`,
      `Tone: ${seed.tone}`,
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      '',
      'Layers generated:',
      `  World seed — ${seed.name} (${(seed.gods ?? []).length} gods)`,
      `  Factions — ${factions.length} created`,
      `  Red thread — ${beats.length} story beats`,
      `  Region — ${region.name} (${region.climate})`,
      `  Settlement — ${settlement.name} (${(settlement.npcs ?? []).length} NPCs)`,
      `  Dungeon — ${dungeon.name} (${roomCount} rooms, ${enemyCount} enemies)`,
    ].join('\n'),
  });

  return { world, chapters };
}

// ─── LLM prose polish ────────────────────────────────────────────────────────
// Rewrites raw chapters into polished D&D sourcebook prose via a single LLM call.

async function polishChapters(rawChapters) {
  // Exclude the appendix (last chapter if it's raw JSON) from polishing.
  const toPolish = rawChapters.filter(ch => ch.heading !== 'Appendix: World Data');

  const rawText = toPolish.map(ch => `=== ${ch.heading} ===\n${ch.text}`).join('\n\n');

  const result = await chatCompletion({
    tier: 'medium',
    max_tokens: 6000,
    messages: [
      { role: 'system', content: t('ai.polishPrompt', { language: locale() === 'nl' ? 'Dutch' : 'English' }) },
      { role: 'user',   content: rawText },
    ],
    schema: JOURNAL_SCHEMA,   // reuses { title, chapters: [{ heading, text }] }
  });

  if (result?.chapters?.length) {
    return result.chapters;
  }
  return toPolish; // fallback to raw if LLM fails
}

// ─── Chapter formatter ───────────────────────────────────────────────────────

function formatChapters({ seed, factions, beats, region, settlement, dungeon }) {
  const ch = [];

  // Chapter 1: The World
  const gods = (seed.gods ?? []).map(g => `${g.name} (${g.domain})`).join(', ');
  ch.push({
    heading: `The World of ${seed.name}`,
    text: [
      `Tone: ${seed.tone}.`,
      '',
      seed.creation,
      '',
      gods ? `The gods: ${gods}.` : '',
      '',
      `The central conflict: ${seed.redThread?.premise ?? 'Unknown.'}`,
      `The starting hook: ${seed.redThread?.hook ?? 'Unknown.'}`,
    ].filter(Boolean).join('\n'),
  });

  // Chapter 2: Factions
  if (factions?.length) {
    const factionText = factions.map(f => [
      `${f.name}`,
      f.description,
      `Values: ${f.values}.`,
      f.allies?.length ? `Allies: ${f.allies.join(', ')}.` : '',
      f.enemies?.length ? `Enemies: ${f.enemies.join(', ')}.` : '',
    ].filter(Boolean).join('\n')).join('\n\n');

    ch.push({ heading: 'Factions', text: factionText });
  }

  // Chapter 3: The Red Thread
  if (beats?.length) {
    const beatText = beats.map((b, i) => [
      `Beat ${i + 1}: ${b.id}`,
      b.dramaticPurpose,
      `Estimated playtime: ${b.targetPlaytimeMinutes} minutes.`,
      b.prerequisites?.length ? `Requires: ${b.prerequisites.join(', ')}.` : 'No prerequisites.',
      `Sets flags: ${(b.setRequiredFlags ?? []).join(', ')}.`,
      b.requiredArchetypes?.length
        ? `NPCs needed: ${b.requiredArchetypes.map(a => `${a.role} (${a.notes})`).join(', ')}.`
        : '',
    ].filter(Boolean).join('\n')).join('\n\n');

    ch.push({ heading: 'The Red Thread', text: beatText });
  }

  // Chapter 4: Region
  ch.push({
    heading: region.name ?? 'The Region',
    text: [
      `Climate: ${region.climate ?? 'unknown'}.`,
      '',
      region.description ?? '',
      '',
      region.settlementName ? `Settlement: ${region.settlementName}.` : '',
      region.dungeonName ? `Dungeon: ${region.dungeonName}.` : '',
      '',
      region.rumor ? `Rumor: "${region.rumor}"` : '',
      '',
      region.adjacentHints?.length
        ? `What lies beyond: ${region.adjacentHints.join('. ')}.`
        : '',
    ].filter(Boolean).join('\n'),
  });

  // Chapter 5: Settlement
  const npcText = (settlement.npcs ?? []).map(npc => {
    const lines = [
      `${npc.name} — ${npc.role} (${npc.attitude})`,
      `"${npc.greeting}"`,
    ];
    if (npc.personality) lines.push(`Personality: ${npc.personality}.`);
    if (npc.secret) lines.push(`Secret: ${npc.secret}.`);
    if (npc.questHook) lines.push(`Quest: ${npc.questHook}`);
    if (npc.relationships?.length) {
      lines.push(`Relationships: ${npc.relationships.map(r => `${r.type} of ${r.targetId}`).join(', ')}.`);
    }
    if (npc.inventory?.length) {
      lines.push(`Sells: ${npc.inventory.map(i => `${i.name} (${i.price} gp)`).join(', ')}.`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const exitText = (settlement.exits ?? []).map(e =>
    `${e.direction}: ${e.targetName} (${e.targetType})${e.targetId ? ` [${e.targetId}]` : ''}`
  ).join('\n');

  ch.push({
    heading: settlement.name ?? 'The Settlement',
    text: [
      settlement.description ?? '',
      '',
      npcText,
      '',
      'Exits:',
      exitText,
    ].filter(Boolean).join('\n'),
  });

  // Chapter 6: Dungeon
  const rooms = Object.values(dungeon.rooms ?? {});
  const enemies = Object.values(dungeon.npcs ?? {});

  const roomText = rooms.map(r => {
    const exits = (r.exits ?? []).map(e => {
      let desc = `${e.dir} → ${e.roomId}`;
      if (e.locked) desc += ' [LOCKED]';
      return desc;
    }).join(', ');
    const loot = (r.loot ?? []).filter(l => !l.taken).map(l => l.name).join(', ');
    return [
      `${r.name} (${r.id})`,
      r.description,
      `Exits: ${exits}.`,
      loot ? `Loot: ${loot}.` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const enemyText = enemies.map(e =>
    `${e.name} — HP ${e.hp}/${e.maxHp}, AC ${e.ac}, +${e.toHit} to hit, ${e.damageDie}+${e.damageBonus} ${e.damageType} (in ${e.roomId})`
  ).join('\n');

  ch.push({
    heading: dungeon.name ?? 'The Dungeon',
    text: [
      `Theme: ${dungeon.theme ?? 'unknown'}. ${rooms.length} rooms.`,
      `Start: ${dungeon.currentRoom}. Exit: ${dungeon.exitRoomId}.`,
      '',
      roomText,
      '',
      enemies.length ? `Enemies:\n${enemyText}` : 'No enemies.',
    ].join('\n'),
  });

  return ch;
}
