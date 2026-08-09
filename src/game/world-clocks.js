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
import { recordMechanical, recordCanon, entitiesUnder, currentPlaceId, encounterKey } from './ledger.js';
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

  // `world.encountered` keys are underscore-encoded (encounterKey); clock
  // owners are dotted entity ids. The raw lookup never matched, so the extra
  // pressure on seen-but-ignored threats never applied to anything.
  const seen = appState.world?.encountered ?? {};
  const pressure = {};
  for (const c of list) if (c.owner && seen[encounterKey(c.owner)]) pressure[c.id] = 2;

  const { clocks: next, fired } = tickAll(list, { pressure });
  setValue('world.clocks', next);

  for (const c of fired) {
    // A fired clock is world news: it lands in the ledger at regional scope, so
    // digests go stale and the next region summary has to account for it.
    const owner = c.owner ?? `${currentPlaceId()}.event.${c.id}`;
    recordMechanical(owner, 'escalated', true, {
      scope: 'regional',
      because: c.label,
    });
    // Escalation has TEETH now, not just a boolean: the threat's severity is
    // canon the scope assembler serves back, and the place it haunts takes a
    // reputation hit the narrator and dialogue context can see.
    recordCanon(owner, 'severity', 'escalated', {
      scope: 'regional',
      because: t('rumour.escalatedBecause', { subject: c.label }),
    });
    const place = owner.includes('.') ? owner.split('.').slice(0, -2).join('.') : null;
    if (place) {
      recordCanon(place, 'reputation', 'troubled', {
        scope: 'regional',
        because: t('rumour.placeTroubled', { subject: c.label }),
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

// The minted threats haunting this place that are still alive and bound to a
// real stat block — i.e. the ones the resolver can actually run a fight with.
// This is the read half of "findable, fightable": before it existed, a minted
// ghoul lived in the ledger and nowhere the combat system could reach.
export function activeThreatsAt(placeId = currentPlaceId()) {
  return Object.entries(entitiesUnder(placeId))
    .filter(([, rec]) => rec.state === 'active-threat' && rec.alive !== false && rec.creatureId)
    .map(([id, rec]) => ({ id, name: rec.name ?? id, creatureId: rec.creatureId }));
}

// The player dealt with it: the kill is ground truth, the clock stops, and the
// resolution is a `because`-rich entry the journal and epilogue can cite.
export function resolveThreat(id, { name = null } = {}) {
  recordMechanical(id, 'alive', false, {
    scope: 'regional',
    because: t('rumour.threatResolved', { name: name ?? id }),
  });
  recordMechanical(id, 'state', 'resolved', { scope: 'regional' });
  const remaining = clocks().filter(c => c.owner !== id);
  if (remaining.length !== clocks().length) setValue('world.clocks', remaining);
  tick();
}
