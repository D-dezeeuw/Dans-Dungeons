// src/ai/validate.js — trust, but check (Epic E11.S2).
//
// Every gameplay call sends a JSON schema and every response was then used as
// given. Structured-output support is a provider feature, not a guarantee: a
// fallback model may not honour it, a repair pass returns whatever the model
// wrote, and `additionalProperties: false` is enforced by the provider that
// happens to be serving the request — or isn't.
//
// So a classifier could return `intent: 'yeet'` and reach the resolver, or a
// DC of 45 and turn a locked door into an impossible one. Nothing checked. This
// module is the check: it normalises a response into something the rules layer
// can consume, or says it could not.
//
// Pure and dependency-free on purpose — it is imported by the AI layer and
// tested directly under `node --test`.

import { CLASSIFIER_SCHEMA } from './schemas.js';

export const INTENTS = CLASSIFIER_SCHEMA.properties.intent.enum;

// SRD 5.2 difficulty ladder. The classifier prompt now quotes this, and the
// clamp below enforces it whatever the model says: DC 5 is "very easy" and
// DC 25 is "nearly impossible", so anything outside the band is a hallucination
// rather than a hard check. Unclamped, a stray 45 makes success impossible for
// a level-20 character and the player just sees the GM being arbitrary.
export const DC_MIN = 5;
export const DC_MAX = 25;
export const DC_DEFAULT = 12;

export function clampDc(dc) {
  // Deliberately not `Number(dc)`: that coerces null, '' and [] to 0, which
  // would then clamp UP to DC_MIN and hand the resolver a check the model never
  // asked for. "No DC" has to survive as null so the resolver applies its own
  // default.
  const n = typeof dc === 'number' ? dc
          : (typeof dc === 'string' && dc.trim() ? Number(dc) : NaN);
  if (!Number.isFinite(n)) return null;
  return Math.min(DC_MAX, Math.max(DC_MIN, Math.round(n)));
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Normalise a classifier response. Returns a well-formed intent object, always:
 * an unusable response becomes `impossible`, which the resolver already handles
 * as "describe the failure and change nothing" — the safe direction to fail,
 * because it never invents a state change.
 *
 * `fellBack` marks a response that could not be understood, so callers can log
 * it: a rising rate is a prompt or model problem, not a player problem.
 */
export function validateClassified(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...blank(), intent: 'impossible', reason: 'The Game Master did not answer.', fellBack: true };
  }

  const intent = INTENTS.includes(raw.intent) ? raw.intent : null;
  if (!intent) {
    return { ...blank(), intent: 'impossible', reason: str(raw.reason) ?? 'Unrecognised action.', fellBack: true };
  }

  return {
    intent,
    target_id: str(raw.target_id),
    direction: normalizeDirection(raw.direction),
    skill:     str(raw.skill),
    dc:        clampDc(raw.dc),
    reason:    str(raw.reason) ?? '',
    fellBack:  false,
  };
}

const DIRECTIONS = ['north', 'south', 'east', 'west'];

function normalizeDirection(dir) {
  const d = str(dir)?.toLowerCase();
  return d && DIRECTIONS.includes(d) ? d : null;
}

function blank() {
  return { target_id: null, direction: null, skill: null, dc: null, reason: '', fellBack: false };
}

/**
 * Narration is the one field the player actually reads, so a response missing
 * it is worse than useless — the turn commits and the screen stays blank.
 * Returns null when there is nothing renderable, letting the caller run its
 * existing "GM unavailable" path instead of committing silence.
 */
export function validateNarration(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const narration = str(raw.narration);
  if (!narration) return null;
  return { ...raw, narration };
}
