// src/game/worldbible.js — standalone worldgen pipeline + EPUB formatter.
//
// Runs the full generation pipeline (world → factions → beats → region →
// settlement → dungeon) and formats the result into EPUB chapters.
// Also stores the raw world JSON for export/import.

import { runWorldgenPipeline } from './worldgen.js';
import { createDungeonEntry } from './world.js';
import { buildWorldBlueprint } from './worldseed.js';
import { chatCompletion } from '../ai/client.js';
import { t, locale } from '../i18n/i18n.js';
import { JOURNAL_SCHEMA } from '../ai/schemas.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s, n = 200) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function generateWorldBible(onProgress) {
  // Step 0: Build blueprint from seeded RNG (instant, deterministic).
  const blueprintSeed = Math.floor(Math.random() * 2147483647);
  const blueprint = buildWorldBlueprint(blueprintSeed);
  onProgress('detail', `Blueprint: ${blueprint.tone} ${blueprint.worldArchetype}, ${blueprint.threatType}, ${blueprint.climate}.`);

  // Steps 1-5: the shared worldgen pipeline. Only the world seed is critical
  // here (the bible renders whatever else succeeds); each layer retries once.
  const stepKey = { world: 'worldgenStep1', factions: 'worldgenStep2', beats: 'worldgenStep3', region: 'worldgenStep4', settlement: 'worldgenStep5' };
  const out = await runWorldgenPipeline(blueprint, {
    critical: ['world'],
    onProgress: (kind, info) => { if (kind === 'step' && stepKey[info.layer]) onProgress(stepKey[info.layer]); },
  });

  const seed = out.world;
  if (!seed) throw new Error('World seed generation failed — no response from AI.');
  const factions = out.factions?.factions ?? [];
  const beats    = out.beats?.beats ?? [];
  const region   = out.region ?? null;
  const settlement = out.settlement ?? null;

  const gods = (seed.gods ?? []).map(g => g.name).join(', ');
  onProgress('detail', `World: "${seed.name}" (${seed.tone}). Gods: ${gods || 'none'}.`);
  onProgress('detail', factions.length ? `Factions: ${factions.length} — ${factions.map(f => f.name).join(', ')}.` : 'Factions: skipped.');
  onProgress('detail', beats.length ? `Red thread: ${beats.length} beats. "${truncate(beats[0]?.dramaticPurpose, 120)}"` : 'Red thread: skipped.');
  onProgress('detail', region ? `Region: "${region.name}" (${region.climate}).` : 'Region: skipped (generation failed).');
  onProgress('detail', settlement ? `Settlement: "${settlement.name}". ${(settlement.npcs ?? []).length} NPCs.` : 'Settlement: skipped (generation failed).');

  // Step 6: Dungeon (procedural — instant)
  onProgress('worldgenStep6');
  let dungeon = null;
  try {
    const dungeonExit = (settlement?.exits ?? []).find(e => e.targetType === 'dungeon');
    dungeon = createDungeonEntry({
      id:        dungeonExit?.targetId ?? `dungeon-${Date.now()}`,
      name:      dungeonExit?.targetName ?? region?.dungeonName ?? 'The Dungeon',
      regionId:  region?.id ?? null,
      blueprint,
    });
    const roomCount = Object.keys(dungeon.rooms ?? {}).length;
    const enemyCount = Object.keys(dungeon.npcs ?? {}).length;
    onProgress('detail', `Dungeon: "${dungeon.name}" (${dungeon.theme}). ${roomCount} rooms, ${enemyCount} enemies.`);
  } catch (e) {
    console.warn('Dungeon generation failed:', e.message);
    onProgress('detail', 'Dungeon: skipped (generation failed).');
  }

  const world = { blueprint, seed, factions, beats, region, settlement, dungeon };
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
      region ? `  Region — ${region.name} (${region.climate})` : '  Region — skipped',
      settlement ? `  Settlement — ${settlement.name} (${(settlement.npcs ?? []).length} NPCs)` : '  Settlement — skipped',
      dungeon ? `  Dungeon — ${dungeon.name} (${Object.keys(dungeon.rooms ?? {}).length} rooms, ${Object.keys(dungeon.npcs ?? {}).length} enemies)` : '  Dungeon — skipped',
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
    maxTokens: 6000,
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
  if (region) {
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
  }

  // Chapter 5: Settlement
  if (settlement) {
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
  } // end settlement guard

  // Chapter 6: Dungeon
  if (dungeon) {
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
  }

  return ch;
}
