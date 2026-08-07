// src/game/worldbible.js — standalone worldgen pipeline + EPUB formatter.
//
// Runs the full generation pipeline (world → factions → beats → region →
// settlement → dungeon) and formats the result into EPUB chapters.
// Also stores the raw world JSON for export/import.

import { appState } from '../core/state.js';
import { recentEvents } from './ledger.js';
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

// Is there a campaign worth documenting? A world seed plus at least one turn
// played — anything less and there is nothing to write about that generating a
// fresh world would not say better.
export function hasLiveCampaign() {
  return Boolean(appState.world?.digest) && (appState.session?.turnCount ?? 0) > 0;
}

// The world bible for the campaign the player is ACTUALLY in.
//
// The export used to generate an entirely new world every time — a handsome
// book about a place the player had never been, produced at the cost of a full
// worldgen pipeline, while the campaign they had spent hours in went
// undocumented. When a campaign is live, this documents that instead: its seed,
// its factions, the acts as they actually played, the regions visited, and the
// ledger entities the world accumulated along the way.
export function campaignWorld() {
  const w = appState.world ?? {};
  return {
    blueprint:  w.blueprint ?? null,
    seed: {
      name:      w.name ?? 'The World',
      tone:      w.tone ?? null,
      creation:  w.creation ?? '',
      gods:      w.gods ?? [],
      redThread: w.redThread ?? null,
      digest:    w.digest ?? '',
    },
    factions:   Object.values(w.factions ?? {}),
    beats:      w.redThread?.beats ?? [],
    acts:       w.acts?.acts ?? [],
    regions:    Object.values(w.regions ?? {}),
    settlements: Object.values(w.settlements ?? {}),
    dungeons:   Object.values(w.dungeons ?? {}),
    // What the world remembered: folded ledger entities with a name, deduped.
    chronicle:  chronicleEntries(),
    turns:      appState.session?.turnCount ?? 0,
    live:       true,
  };
}

// The ledger's durable claims, as "this is what happened here" lines. Mechanical
// truth first — those are the things the dice decided, and they cannot be
// contradicted by anything the narrator later said.
function chronicleEntries(limit = 60) {
  const events = recentEvents({ limit, minScope: 'local' });
  return events.map(e => e.because).filter(Boolean);
}

export async function generateWorldBible(onProgress, { fromCampaign = hasLiveCampaign() } = {}) {
  // A live campaign is documented, not replaced.
  if (fromCampaign) {
    const world = campaignWorld();
    onProgress('detail', `Documenting the campaign in progress: "${world.seed.name}" after ${world.turns} turns.`);
    const rawChapters = formatChapters(world);
    let chapters;
    try {
      chapters = await polishChapters(rawChapters);
      onProgress('detail', `Polished ${chapters.length} chapters.`);
    } catch (e) {
      console.warn('Polish pass failed, using raw chapters:', e.message);
      chapters = rawChapters;
    }
    chapters.push(colophon(world));
    return { world, chapters };
  }

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

  chapters.push(colophon(world));
  return { world, chapters };
}

// The metadata page — never LLM-generated, so it is the one part of the book
// that is guaranteed to describe what actually exists.
function colophon(world) {
  const { seed, factions = [], beats = [], acts = [], region, regions, settlement, settlements, dungeon, dungeons } = world;
  const regionList     = regions ?? (region ? [region] : []);
  const settlementList = settlements ?? (settlement ? [settlement] : []);
  const dungeonList    = dungeons ?? (dungeon ? [dungeon] : []);
  const npcCount = settlementList.reduce((n, s) => n + (s?.npcs?.length ?? 0), 0);
  const roomCount = dungeonList.reduce((n, d) => n + Object.keys(d?.rooms ?? {}).length, 0);

  return {
    heading: 'Colophon',
    text: [
      world.live ? 'Campaign Record' : 'Generation Metadata',
      '',
      `World: ${seed?.name ?? 'unknown'}`,
      `Tone: ${seed?.tone ?? 'unknown'}`,
      world.live ? `Turns played: ${world.turns}` : '',
      `Written: ${new Date().toISOString().slice(0, 10)}`,
      '',
      world.live ? 'What this book documents:' : 'Layers generated:',
      `  World — ${seed?.name ?? 'unknown'} (${(seed?.gods ?? []).length} gods)`,
      `  Factions — ${factions.length}`,
      acts.length ? `  Acts — ${acts.length}` : `  Red thread — ${beats.length} story beats`,
      regionList.length     ? `  Regions — ${regionList.map(r => r?.name).filter(Boolean).join(', ')}` : '  Regions — none',
      settlementList.length ? `  Settlements — ${settlementList.length} (${npcCount} NPCs)`            : '  Settlements — none',
      dungeonList.length    ? `  Dungeons — ${dungeonList.length} (${roomCount} rooms)`                : '  Dungeons — none',
      world.chronicle?.length ? `  Chronicle — ${world.chronicle.length} recorded events` : '',
    ].filter(Boolean).join('\n'),
  };
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

function formatChapters(world) {
  const { seed, factions, beats, acts = [], chronicle = [] } = world;
  // A generated world has one of each; a live campaign has as many as the
  // player has been to. Normalising here is what lets both share every
  // chapter below.
  const regions     = world.regions     ?? (world.region     ? [world.region]     : []);
  const settlements = world.settlements ?? (world.settlement ? [world.settlement] : []);
  const dungeons    = world.dungeons    ?? (world.dungeon    ? [world.dungeon]    : []);
  const region     = regions[0]     ?? null;
  const settlement = settlements[0] ?? null;
  const dungeon    = dungeons[0]    ?? null;
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

  // Chapter 4: Regions — one chapter each, so a campaign that crossed four of
  // them gets four, instead of a book about wherever it started.
  for (const region of regions) {
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

  // Chapter 5: Settlements — one each, for the same reason as the regions.
  for (const settlement of settlements) {
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
  } // end settlement loop

  // Chapter 6: Dungeons
  for (const dungeon of dungeons) {
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

  // Chapter 7: the acts, as they actually played. A generated world has beats
  // it might follow; a played campaign has acts it did, with the beats it
  // closed and the ones it never reached. The second is the more interesting
  // book, and it only exists after someone has played.
  if (acts.length) {
    const actText = acts.map((act, i) => {
      const done = (act.beats ?? []).filter(b => act.flags?.[`beat-done-${b.id}`]);
      const open = (act.beats ?? []).filter(b => !act.flags?.[`beat-done-${b.id}`]);
      return [
        `Act ${i + 1}: ${act.title ?? act.id}`,
        act.premise ?? '',
        done.length ? `Resolved: ${done.map(b => b.dramaticPurpose).join(' · ')}` : '',
        open.length ? `Left open: ${open.map(b => b.dramaticPurpose).join(' · ')}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');
    ch.push({ heading: 'The Acts', text: actText });
  }

  // Chapter 8: the chronicle — what the ledger recorded, in the order it
  // happened. This is the part no generated world can have: it is the record
  // of a campaign, not a description of a place.
  if (chronicle.length) {
    ch.push({
      heading: 'Chronicle',
      text: chronicle.map(line => `· ${line}`).join('\n'),
    });
  }

  return ch;
}
