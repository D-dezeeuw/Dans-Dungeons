// src/game/progression.js — experience and levelling (Epic E8).
//
// The engine has shipped the whole XP system since early on: thresholds,
// proficiency by level, CR-to-XP, milestone awards. The game never called any
// of it. record.xp was initialised to 0 and record.level to 1, and a grep for
// award sites found none — so an "80-hour campaign" ran at level 1 forever,
// with describePC branching on levels ('legendary') that were unreachable.
//
// Awards come from the same events the ledger already records, so progression
// and memory agree about what happened.

import { XP, EncounterDesign } from './rules.js';
import { appState, setValue } from '../core/state.js';
import { reconcilePc } from './character.js';
import { recordMechanical, currentPlaceId } from './ledger.js';
import { t } from '../i18n/i18n.js';

// Non-combat awards, in the spirit of the DMG's milestone guidance: a share of
// the XP a level-appropriate fight would give, so exploring and finishing
// quests keep pace with killing things.
const MILESTONE_XP = {
  'dungeon-cleared': 300,
  'quest-completed': 200,
  'beat-completed':  400,
  'secret-found':     75,
};

export function currentXp()    { return appState.party?.pc?.record?.xp ?? 0; }
export function currentLevel() { return appState.party?.pc?.record?.level ?? 1; }

// XP for defeating one creature, from its challenge rating.
export function xpForKill(creatureId, statBlock) {
  const cr = statBlock?.cr ?? 0;
  try { return EncounterDesign.xpForCR(cr) ?? 0; } catch { return 0; }
}

// Award XP and return { xp, level, leveledUp, from, to }. The caller decides how
// to announce it; this only moves the numbers and re-derives the sheet.
export function awardXp(amount, reason) {
  const gain = Math.max(0, Math.round(amount || 0));
  if (!gain) return null;

  const record = appState.party?.pc?.record;
  if (!record) return null;

  const before = record.level ?? 1;
  const xp     = (record.xp ?? 0) + gain;
  const after  = XP.levelForXP(xp);

  setValue('party.pc.record.xp', xp);

  if (after > before) {
    setValue('party.pc.record.level', after);
    // Re-derive rather than patch: hit points, proficiency, and every
    // level-dependent feature come from the engine, never from local arithmetic.
    const pc = { ...appState.party.pc, record: { ...record, xp, level: after } };
    setValue('party.pc', reconcilePc(pc));
    // Heal the difference so a level-up is felt, not just recorded.
    const max = appState.party?.pc?.sheet?.hp?.max;
    if (max) setValue('party.pc.record.hpCurrent', max);

    recordMechanical(`${currentPlaceId()}.pc`, 'level', after, {
      scope: 'regional', because: `reached level ${after} — ${reason}`,
    });
  }

  return { xp, level: after, leveledUp: after > before, from: before, to: after, gain, reason };
}

// Milestone award by name; unknown names are ignored rather than guessed at.
export function awardMilestone(kind, reason) {
  const amount = MILESTONE_XP[kind];
  return amount ? awardXp(amount, reason ?? kind) : null;
}

// Progress toward the next level, for the status line.
export function xpProgress() {
  const xp    = currentXp();
  const next  = XP.nextLevelThreshold(xp);
  return { xp, level: currentLevel(), next, remaining: next == null ? null : Math.max(0, next - xp) };
}

// The lines to show the player after an award. Kept here so the flow layer
// stays a caller rather than owning the wording.
export function announcementFor(result) {
  if (!result) return [];
  const lines = [t('progress.xpGained', { xp: result.gain, reason: result.reason })];
  if (result.leveledUp) {
    lines.push(t('progress.levelUp', { level: result.to }));
    const sheet = appState.party?.pc?.sheet;
    if (sheet?.hp?.max) lines.push(t('progress.levelUpStats', { hp: sheet.hp.max, prof: sheet.proficiencyBonus }));
  }
  return lines;
}
