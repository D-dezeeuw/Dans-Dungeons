// src/ai/dialogue.js — settlement-mode AI: intent classifier + NPC dialogue.
//
// Both use the tiny tier (cheap, every-turn). classifySettlement maps town
// input to a structured action; npcReply produces one in-character line and may
// flag that the NPC let a secret slip (only the host decides whether it was
// earned — see settlement.canRevealSecret).

import { chatCompletion } from './client.js';
import { SETTLEMENT_CLASSIFIER_SCHEMA, DIALOGUE_SCHEMA } from './schemas.js';
import { t, locale } from '../i18n/i18n.js';

// ─── Settlement intent classifier ────────────────────────────────────────────

export async function classifySettlement(playerInput, context) {
  const system = t('ai.settlementClassifierPrompt', { context: JSON.stringify(context, null, 2) });
  return chatCompletion({
    tier: 'tiny',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: playerInput },
    ],
    schema: SETTLEMENT_CLASSIFIER_SCHEMA,
  });
}

// ─── NPC dialogue ─────────────────────────────────────────────────────────────
//
// `npc` carries personality / secret / questHook / factionId. `mayRevealSecret`
// is the host's gate (enough probing + not already revealed); when false the
// model is told to keep the secret. `history` is the recent exchange list.

export async function npcReply(npc, playerLine, history, opts = {}) {
  const lang = locale() === 'nl' ? 'Dutch' : 'English';
  const transcript = (history ?? [])
    .map(e => `${e.role === 'player' ? 'Player' : npc.name}: ${e.text}`)
    .join('\n');

  const system = t('ai.npcDialoguePrompt', {
    name:        npc.name,
    role:        npc.role,
    attitude:    npc.attitude ?? 'neutral',
    personality: npc.personality || '—',
    secret:      npc.secret || '—',
    questHook:   npc.questHook || '—',
    faction:     npc.factionId || '—',
    mayReveal:   opts.mayRevealSecret ? 'YES' : 'NO',
    reputation:  Number.isFinite(opts.reputation) ? String(opts.reputation) : 'neutral',
    language:    lang,
    transcript:  transcript || '(no prior conversation)',
  });

  return chatCompletion({
    tier: 'tiny',
    max_tokens: 400,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: playerLine },
    ],
    schema: DIALOGUE_SCHEMA,
  });
}
