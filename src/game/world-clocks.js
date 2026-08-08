// src/game/world-clocks.js — the world moves while you are elsewhere (E6.S3/E9.S3).
//
// A threat the Game Master invented and the player walked away from used to
// simply stop existing. Clocks give ignoring something a cost: the privy ghoul
// of the FarStay Inn gets worse, the innkeeper starts mentioning it, and the
// region digest eventually has to account for it.
//
// Clocks tick at chapter boundaries, not per turn: the world's movement should
// arrive as news between scenes rather than interrupting one, and it keeps the
// simulation free.

import { appState, setValue, tick } from '../core/state.js';
import { tickAll, pressingClocks, makeClock } from 'bag-of-holding-client';
import { recordMechanical, entitiesUnder, currentPlaceId } from './ledger.js';
import { t } from '../i18n/i18n.js';

export function clocks() { return appState.world?.clocks ?? []; }

export function addClock(spec) {
  const list = clocks();
  if (list.some(c => c.id === spec.id)) return false;
  setValue(`world.clocks.${list.length}`, makeClock(spec));
  return true;
}

// Advance every clock one segment. Threats the player has seen but left alone
// get extra pressure — walking away is itself the thing that makes them grow.
export function tickWorldClocks() {
  const list = clocks();
  if (!list.length) return [];

  const seen = appState.world?.encountered ?? {};
  const pressure = {};
  for (const c of list) if (c.owner && seen[c.owner]) pressure[c.id] = 2;

  const { clocks: next, fired } = tickAll(list, { pressure });
  setValue('world.clocks', next);

  for (const c of fired) {
    // A fired clock is world news: it lands in the ledger at regional scope, so
    // digests go stale and the next region summary has to account for it.
    //
    // A clock may carry its own consequences (`onFill`) — a faction project
    // finishing changes something specific and says where. Without them we fall
    // back to recording that the clock's own subject escalated.
    const patches = c.onFill?.length ? c.onFill : [{
      target: c.owner ?? `${currentPlaceId()}.event.${c.id}`,
      path:   'escalated',
      to:     true,
      scope:  'regional',
      because: c.label,
    }];
    for (const p of patches) {
      recordMechanical(p.target, p.path, p.to, {
        scope:   p.scope   ?? 'regional',
        because: p.because ?? c.label,
      });
    }
  }
  tick();
  return fired;
}

// What a tavern would be talking about: pressing clocks as rumour lines. This
// is how an ignored threat finds its way back to the player.
export function rumours({ limit = 2 } = {}) {
  return pressingClocks(clocks(), { limit })
    .map(c => t(`rumour.${c.mood}`, { subject: c.label }));
}

// ─── Faction projects ────────────────────────────────────────────────────────

// Every faction is working on something. Without this, `addClock` had exactly
// one caller — invented local threats — so "the world moved while you were in a
// dungeon" only ever meant a ghoul got worse. Factions had reputations and
// tensions and no agency at all.
//
// Deterministic: derived from the generated faction data, no LLM call, same
// world → same projects. Segments are chapter-scale (6–8) so a project is a
// slow pressure the player can see coming and interfere with, not an ambush.
const PROJECTS = [
  { kind: 'expand',      segments: 8 },
  { kind: 'consolidate', segments: 6 },
  { kind: 'strike',      segments: 6 },   // only when the faction has an enemy
];

export function seedFactionClocks(regionId) {
  const factions = Object.values(appState.world?.factions ?? {});
  if (!factions.length) return 0;

  const region = `region.${slug(regionId ?? appState.world?.location?.regionId ?? 'wilds')}`;
  let added = 0;

  for (const f of factions) {
    const enemy = (f.enemies ?? []).find(Boolean) ?? null;
    for (const { kind, segments } of PROJECTS) {
      if (kind === 'strike' && !enemy) continue;
      const label = t(`clock.faction.${kind}`, { faction: f.name ?? f.id, enemy: enemy ?? '' });
      const ok = addClock({
        id:    `clock.faction.${slug(f.id ?? f.name)}.${kind}`,
        label,
        // The consequence lands on the REGION, so a finished project makes the
        // region digest stale and the next summary has to account for it.
        onFill: [{ target: region, path: `factionProject.${slug(f.id ?? f.name)}.${kind}`, to: 'done',
                   scope: 'regional', because: label }],
        segments,
      });
      if (ok) added++;
    }
  }
  return added;
}

const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

// Give every active threat in this place a clock, so a minted danger starts
// counting down the moment it exists.
export function armThreatClocks() {
  for (const [id, rec] of Object.entries(entitiesUnder(currentPlaceId()))) {
    if (rec.state !== 'active-threat' || !rec.clock) continue;
    addClock({
      id:       `clock.${id}`,
      label:    rec.name ? t('rumour.threatLabel', { name: rec.name }) : id,
      owner:    id,
      segments: rec.clock.segments ?? 4,
      filled:   rec.clock.filled ?? 0,
    });
  }
}
