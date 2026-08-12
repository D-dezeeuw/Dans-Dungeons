// src/ai/lexicon-voice.js — the dictionary, said in the world's voice (doc 19 §14).
//
// The lexicon's answers are assembled from stored fields, so they read like
// what they are: a note. In a pack with a strong voice that is a seam the
// player can feel — the Game Master says "choom" and the dictionary says
// "harbourmaster in Fennwick."
//
// This restyles a hit. It is OFF by default and it is the only model call the
// whole lexicon can make, which is the point: the free action stays free
// unless the player asks for prose and pays a tiny-tier call for it.
//
// The hard rule is that it may not ADD. The lexicon's whole guarantee is that
// it never tells the player something the game does not already know, and a
// paraphrase that invents a detail breaks that guarantee more quietly than any
// other failure here — it would read exactly like a real answer. So: schema-
// bound, one retry, a short deadline, and any failure at all falls back to the
// deterministic text that was already computed.

import { chatCompletion } from './client.js';
import { LEXICON_PARAPHRASE_SCHEMA } from './schemas.js';
import { t, locale } from '../i18n/i18n.js';
import { voiceBlock } from '../settings/voice.js';

const DEADLINE_MS = 8000;

// Returns the restyled text, or null — never throws. `lines` is the rendered
// deterministic entry; the caller prints whichever it ends up with, once.
export async function paraphraseLexicon(lines) {
  const note = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).join('\n');
  if (!note.trim()) return null;

  const voice = voiceBlock('narrator');
  if (!voice) return null;   // no pack voice to speak in — nothing to gain

  try {
    const out = await chatCompletion({
      tier: 'tiny',
      maxTokens: 200,
      timeoutMs: DEADLINE_MS,
      messages: [
        { role: 'system', content: t('ai.lexiconPrompt', { voice, language: locale() === 'nl' ? 'Dutch' : 'English' }) },
        { role: 'user',   content: note },
      ],
      schema: LEXICON_PARAPHRASE_SCHEMA,
    });
    const answer = out?.answer?.trim();
    return answer ? answer : null;
  } catch {
    return null;
  }
}
