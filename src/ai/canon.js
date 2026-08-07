// src/ai/canon.js — turn narration into world facts.
//
// This closes the loop that made the Game Master forget. It used to say "mould
// stains the curtains" and that sentence lived in the transcript until it
// scrolled out of a three-entry window; the next visit to the same hall
// described something else entirely.
//
// Now a tiny-tier pass reads what was just narrated and returns:
//   • facts — durable claims about entities the scene already knows
//   • mint  — things the GM invented that deserve to exist (a named NPC, a
//             creature, a noticeable detail, a place)
//
// The host validates everything: unknown targets are dropped, mints are
// deduped against what already exists, and the ledger's precedence gate
// refuses any claim that contradicts the dice. Inventing within those rules is
// the point — that is where the world's texture comes from.

import { chatCompletion } from './client.js';
import { CANON_SCHEMA } from './schemas.js';
import { t, locale } from '../i18n/i18n.js';

// `knownIds` is the small set of entity ids present in this scene; the model
// may only attach facts to those. Returns { facts: [], mint: [] } on any
// failure — extraction is best-effort and never blocks or fails a turn.
export async function extractCanon(narration, { knownIds = [], placeId = '' } = {}) {
  if (!narration || !narration.trim() || !knownIds.length) return { facts: [], mint: [] };
  try {
    const res = await chatCompletion({
      tier: 'tiny',
      maxTokens: 400,
      messages: [
        { role: 'system', content: t('ai.canonPrompt', {
            ids:      knownIds.join('\n'),
            place:    placeId,
            language: locale() === 'nl' ? 'Dutch' : 'English',
          }) },
        { role: 'user', content: narration },
      ],
      schema: CANON_SCHEMA,
    });
    return {
      facts: Array.isArray(res?.facts) ? res.facts : [],
      mint:  Array.isArray(res?.mint)  ? res.mint  : [],
    };
  } catch {
    return { facts: [], mint: [] };
  }
}
