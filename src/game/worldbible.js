// src/game/worldbible.js — standalone worldgen pipeline + EPUB formatter.
//
// Runs the full generation pipeline (world → factions → beats → region →
// settlement → dungeon) and formats the result into EPUB chapters.
// Also stores the raw world JSON for export/import.

import { generateWorldSeed, generateFactions, generateBeats, generateRegion, generateSettlement } from './worldgen.js';
import { createDungeonEntry } from './world.js';

// ─── Fallback digest ─────────────────────────────────────────────────────────
// If the AI omits a digest field, derive one from available data.

function ensureDigest(obj, fallback) {
  if (obj && !obj.digest) obj.digest = fallback;
  return obj;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function generateWorldBible(onProgress) {
  onProgress('worldgenStep1');
  const seed = await generateWorldSeed();
  if (!seed) throw new Error('World seed generation failed — no response from AI.');
  ensureDigest(seed, `${seed.name ?? 'World'} — ${seed.tone ?? 'fantasy'}. ${seed.redThread?.premise ?? ''}`);

  onProgress('worldgenStep2');
  let factions = [];
  try {
    const result = await generateFactions(seed.digest);
    factions = result?.factions ?? [];
  } catch (e) {
    console.warn('Faction generation failed, continuing without:', e.message);
  }

  onProgress('worldgenStep3');
  let beats = [];
  try {
    const result = await generateBeats(seed.digest);
    beats = result?.beats ?? [];
  } catch (e) {
    console.warn('Beat generation failed, continuing without:', e.message);
  }

  onProgress('worldgenStep4');
  const region = await generateRegion(seed.digest);
  if (!region) throw new Error('Region generation failed — no response from AI.');
  ensureDigest(region, `${region.name ?? 'Region'} — ${region.climate ?? ''}. ${region.settlementName ?? ''}.`);

  onProgress('worldgenStep5');
  const settlement = await generateSettlement(region.digest, region.id);
  if (!settlement) throw new Error('Settlement generation failed — no response from AI.');
  ensureDigest(settlement, `${settlement.name ?? 'Settlement'} — ${(settlement.npcs ?? []).map(n => n.name).join(', ')}.`);

  onProgress('worldgenStep6');
  const dungeonExit = (settlement.exits ?? []).find(e => e.targetType === 'dungeon');
  const dungeon = createDungeonEntry({
    id:       dungeonExit?.targetId ?? `dungeon-${Date.now()}`,
    name:     dungeonExit?.targetName ?? region.dungeonName ?? 'The Dungeon',
    regionId: region.id,
  });

  const world = { seed, factions, beats, region, settlement, dungeon };
  const chapters = formatChapters(world);

  return { world, chapters };
}

// ─── Chapter formatter ───────────────────────────────────────────────────────
// Converts structured worldgen data into readable prose chapters for the EPUB.

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

  // Appendix: Raw JSON
  const worldJson = JSON.stringify({
    seed, factions, beats, region,
    settlement: { ...settlement, npcs: (settlement.npcs ?? []).map(({ inventory, ...npc }) => ({ ...npc, hasInventory: !!inventory?.length })) },
    dungeon: { id: dungeon.id, name: dungeon.name, theme: dungeon.theme, seed: dungeon.seed, roomCount: rooms.length, enemyCount: enemies.length },
  }, null, 2);
  ch.push({
    heading: 'Appendix: World Data',
    text: worldJson,
  });

  return ch;
}
