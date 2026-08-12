// src/game/views.js — the read-only screens: /story, the region map, quests, inventory.
//
// Extracted from flow.js as part of taking it apart. These share a shape nothing
// else in flow.js has: they read state, print to the transcript, and return. No
// AI call, no dice, no await on the player. That makes them the safest thing to
// lift out and the easiest to reason about once lifted — a bug in here can
// misinform a player but cannot corrupt a campaign.
//
// `resolveDungeonQuests` is the one exception and travels with them anyway: it
// writes quest status, but it is quest bookkeeping and belongs beside the log
// that displays it rather than beside the dungeon that triggers it.

import { appState, setValue, tick, saveToStorage } from '../core/state.js';
import * as UI from '../ui/console.js';
import { t, tRaw, locale } from '../i18n/i18n.js';
import { progress as storyProgress, actNumber, gmDirective } from './acts-runtime.js';
import { reputationStanding, awardReputation, setStoryFlag } from './story.js';
import { mapView, provinceOf } from './atlas.js';
import { rumours } from './world-clocks.js';
import { allEntities, hasEncountered } from './ledger.js';
import { memoryContext } from './chapters.js';
import { buildLexiconIndex, lookupLexicon, renderLexiconEntry,
         renderLexiconCandidates, lexiconTopics, matchLexiconQuestion } from './lexicon.js';
import { xpProgress, awardMilestone, announcementFor } from './progression.js';
import { goldOf } from 'bag-of-holding-client';
import { setQuestStatus, activeQuests } from 'bag-of-holding-client';


// A 10-cell reputation bar from -100 (empty) to +100 (full).
export function repBar(rep) {
  const filled = Math.max(0, Math.min(10, Math.round((rep + 100) / 20)));
  return '█'.repeat(filled) + '·'.repeat(10 - filled);
}

export function renderStoryView() {
  UI.appendEntry('system', t('story.header'));

  const p = storyProgress(); // { act, acts, beatsDone, beats, complete, currentTitle }
  if (p.beats) {
    UI.appendEntry('system', t('story.actLine', { act: Math.min(p.act, p.acts), title: p.currentTitle ?? '—' }));
    UI.appendEntry('system', t('story.progress', { done: p.beatsDone, total: p.beats }));
    UI.appendEntry('system', p.complete ? t('story.complete') : t('story.nextHint'));
  } else {
    UI.appendEntry('system', t('story.noThread'));
  }

  const repMap = appState.world?.factionReputation ?? {};
  const facEntries = Object.entries(repMap);
  if (facEntries.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.factionsHeader'));
    for (const [id, rep] of facEntries) {
      const name = appState.world?.factions?.[id]?.name ?? id;
      const stand = reputationStanding(rep);
      UI.appendEntry('system', t('story.factionLine', { name, bar: repBar(rep), rep, standing: t(`story.standing.${stand}`) }));
    }
  }

  const aq = activeQuests(appState.world?.quests ?? {});
  if (aq.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.questsHeader'));
    for (const q of aq) {
      UI.appendEntry('system', t('settlement.questLine', { desc: q.description, status: t('settlement.status.active'), npc: q.npcName }));
    }
  }

  // Live flags land on the acts thread; redThread is the pre-acts legacy shape
  // kept only as a migration source.
  const flags = Object.keys(appState.world?.thread?.flags ?? appState.world?.redThread?.flags ?? {})
    .filter(f => !f.startsWith('beat-done-'));
  if (flags.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.flagsHeader'));
    UI.appendEntry('system', '  ' + flags.slice(-8).join('  ·  '));
  }
  UI.appendEntry('system', '');
}

// ─── Region map (Phase 3.6) ───────────────────────────────────────────────────

export function renderRegionMap() {
  const regions = Object.values(appState.world?.regions ?? {});
  if (!regions.length) { UI.appendEntry('system', t('map.empty')); return; }
  const curRegionId = appState.world?.location?.regionId;
  const curSettlementId = appState.world?.location?.settlementId;
  UI.appendEntry('system', t('map.header'));

  // The layers above the region (doc 17): continents with their outlines and
  // faction homelands, provinces beneath them — the durable surface for the
  // global outline, which otherwise only flashed by in worldgen progress.
  const geo = appState.world?.geography;
  const continents = Object.values(geo?.nodes ?? {}).filter(n => n.kind === 'continent');
  if (continents.length) {
    const curProvince = provinceOf(curRegionId);
    for (const c of continents) {
      const homelands = (c.factionHomelands ?? [])
        .filter(h => h.presence === 'homeland')
        .map(h => appState.world?.factions?.[h.factionId]?.name ?? h.factionId);
      const held = homelands.length ? t('map.heldBy', { names: homelands.join(', ') }) : '';
      UI.appendEntry('system', t('map.continentLine', { name: c.name, held }));
      if (c.digest) UI.appendEntry('system', t('map.continentDigest', { digest: c.digest }));
      for (const p of Object.values(geo.nodes).filter(n => n.kind === 'province' && n.parent === c.id)) {
        const marks = [p.port ? t('map.portMark') : '', p.id === curProvince?.id ? t('map.youAreHere') : '']
          .filter(Boolean).join(' ');
        UI.appendEntry('system', t('map.provinceLine', { name: p.name, climate: p.climate ?? '?', marks }));
      }
    }
    UI.appendEntry('system', '');
  }

  for (const r of regions) {
    const here = r.id === curRegionId ? t('map.youAreHere') : '';
    UI.appendEntry('system', t('map.regionLine', { name: r.name, climate: r.climate ?? '?', here }));
    for (const sid of (r.settlements ?? [])) {
      const s = appState.world.settlements?.[sid];
      if (s) UI.appendEntry('system', t('map.settlementLine', { name: s.name, here: sid === curSettlementId ? t('map.youAreHere') : '' }));
    }
    if (r.adjacentRegions?.length) {
      UI.appendEntry('system', t('map.connectsLine', { names: r.adjacentRegions.join(', ') }));
    }
  }

  // Places the map knows about but the player has never walked to. These are
  // real destinations with their own seeds, not scenery — going there hydrates
  // exactly the place that was always promised.
  const rumoured = mapView().rumoured;
  if (rumoured.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('map.rumouredHeader'));
    for (const n of rumoured) {
      UI.appendEntry('system', t('map.rumouredLine', { name: n.name, hook: n.hook ?? '' }));
    }
  }
  UI.appendEntry('system', '');
}

// ─── The lexicon (doc 19, Part II) ───────────────────────────────────────────
//
// The binding half of src/game/lexicon.js: it gathers what live state knows
// and hands the pure module its `{ t, tRaw, locale }`. Everything here is a
// FREE action — it prints and returns, exactly like the other views. No
// classifier call, no undo mark, no turn count, no save write. That guarantee
// is structural, not a promise: these run before processTurn ever sees the
// input, the same way `/`-commands do.

const I18N = { t, tRaw, locale };

function lexiconSources() {
  return {
    world:           appState.world ?? {},
    inventory:       appState.party?.inventory ?? [],
    entities:        allEntities(),
    hasEncountered,
    encounteredKeys: Object.keys(appState.world?.encountered ?? {}),
    knownMap:        mapView(),
    memory:          memoryContext(),
    story:           storyProgress(),
    rumours:         rumours({ limit: 4 }),
    standingOf:      (id) => t(`story.standing.${reputationStanding(id)}`),
  };
}

// Print one entry. With `settings.lexiconParaphrase` on and a pack voice to
// speak in, a KNOWN entry is restyled first — computed, then printed once, so
// the player never sees the note replaced by prose. Heard-of and refusals are
// never restyled: hearsay keeps its honest prefix, and a refusal is a contract.
async function printEntry(entry) {
  const lines = renderLexiconEntry(entry, I18N);
  if (appState.settings?.lexiconParaphrase && entry?.cls === 'known') {
    try {
      const { paraphraseLexicon } = await import('../ai/lexicon-voice.js');
      const said = await paraphraseLexicon(lines);
      if (said) {
        UI.appendEntry('system', lines[0]);     // the header stays factual
        UI.appendEntry('system', said);
        UI.appendEntry('system', '');
        return;
      }
    } catch { /* the deterministic lines below are the fallback */ }
  }
  for (const line of lines) UI.appendEntry('system', line);
  UI.appendEntry('system', '');
}

// `/what` with no term: what a confused player could ask about right now.
export function renderLexiconTopics() {
  const sources = lexiconSources();
  const topics  = lexiconTopics(buildLexiconIndex(sources, I18N), sources);
  if (!topics.length) { UI.appendEntry('system', t('lexicon.noTopics')); return; }
  UI.appendEntry('system', t('lexicon.topicsHeader'));
  for (const e of topics) {
    UI.appendEntry('system', t('lexicon.topicLine', { name: e.name, kind: t(`lexicon.kind.${e.kind}`) }));
  }
  UI.appendEntry('system', '');
}

// `/what <term>` — an explicit command deserves an explicit answer, so a miss
// says so rather than falling through to the turn engine.
export async function renderLexiconAnswer(query) {
  const res = lookupLexicon(query, buildLexiconIndex(lexiconSources(), I18N), I18N);
  if (res.hit)        { await printEntry(res.hit); return true; }
  if (res.candidates) { for (const l of renderLexiconCandidates(res.candidates, I18N)) UI.appendEntry('system', l); return true; }
  UI.appendEntry('system', t('lexicon.unknown'));
  return false;
}

// A typed question ("what is Saltmarch?"). Returns true when it was answered
// for free. A MISS returns false on purpose: the index only holds what the
// player already knows, and "what is that sound?" is a real question for the
// Game Master, who answers it diegetically and charges a turn — as today.
export async function tryLexicon(raw) {
  const query = matchLexiconQuestion(raw, I18N);
  if (!query) return false;
  const res = lookupLexicon(query, buildLexiconIndex(lexiconSources(), I18N), I18N);
  if (res.hit) {
    UI.appendEntry('player', `> ${raw}`);
    await printEntry(res.hit);
    return true;
  }
  if (res.candidates) {
    UI.appendEntry('player', `> ${raw}`);
    for (const l of renderLexiconCandidates(res.candidates, I18N)) UI.appendEntry('system', l);
    return true;
  }
  return false;
}

// Phase 4.3/4.7: clearing a dungeon completes the player's active quests, raises
// quest-done flags (beat prerequisites), and rewards the quest-givers' factions.
export function resolveDungeonQuests() {
  const quests = appState.world?.quests ?? {};
  const active = activeQuests(quests);
  if (!active.length) return;
  let map = quests;
  for (const q of active) map = setQuestStatus(map, q.id, 'completed');
  setValue('world', { ...appState.world, quests: map });
  tick();
  for (const q of active) {
    setStoryFlag(`quest-${q.id}-done`);
    if (q.factionId) awardReputation(q.factionId, 15);
    UI.appendEntry('system', t('settlement.questCompleted', { desc: q.description }));
    for (const line of announcementFor(awardMilestone('quest-completed', t('progress.questReason')))) {
      UI.appendEntry('system', line);
    }
  }
  saveToStorage();
}

export function showQuests() {
  const quests = Object.values(appState.world?.quests ?? {});
  if (!quests.length) { UI.appendEntry('system', t('settlement.questsEmpty')); return; }
  UI.appendEntry('system', t('settlement.questsHeader'));
  for (const q of quests) {
    UI.appendEntry('system', t('settlement.questLine', { desc: q.description, status: t(`settlement.status.${q.status}`), npc: q.npcName }));
  }
}

export function showInventory() {
  const pc = appState.party?.pc;
  const items = appState.party?.inventory ?? [];
  UI.appendEntry('system', t('settlement.goldLine', { gold: goldOf(pc?.record) }));
  if (!items.length) { UI.appendEntry('system', t('settlement.inventoryEmpty')); return; }
  UI.appendEntry('system', t('settlement.inventoryHeader'));
  for (const it of items) {
    const qty = (it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : '';
    UI.appendEntry('system', t('settlement.invLine', { name: it.name, qty }));
  }
}
