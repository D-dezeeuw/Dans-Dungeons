// src/ai/summarize.js — rolling chapter summaries for play (Epic E4).
//
// The journal export already had exactly this machinery — it wove narrations
// into prose — but it only ever ran at export time, so the summaries never came
// back into the game. That was the highest-leverage thing left unbuilt: the
// summarizer existed, cached and tested, and the Game Master still could not
// remember past three transcript entries.
//
// Runs on the tiny tier: this is compression, not composition, and it happens
// every few turns for the length of a campaign.

import { chatCompletion } from './client.js';
import { t, locale } from '../i18n/i18n.js';

// Rewrite the running summary of the current chapter. `previous` is the last
// digest (so the model extends rather than restarts), `transcript` the recent
// turns, `events` the ledger's one-line causes. Returns null on failure —
// callers keep the previous digest rather than losing memory.
export async function summarizeChapter({ previous = null, transcript = [], events = [] } = {}) {
  const text = transcript.map(e => `${e.role}: ${e.text}`).join('\n').slice(0, 6000);
  if (!text.trim()) return null;
  try {
    const out = await chatCompletion({
      tier: 'tiny',
      maxTokens: 400,
      temperature: 0.3,
      messages: [
        { role: 'system', content: t('ai.summarizePrompt', {
            language: locale() === 'nl' ? 'Dutch' : 'English',
            previous: previous ?? '(none — this is the start of the chapter)',
            events:   events.length ? events.join('; ') : '(none recorded)',
          }) },
        { role: 'user', content: text },
      ],
    });
    return (typeof out === 'string' && out.trim()) ? out.trim() : null;
  } catch {
    return null;
  }
}

// Name a chapter from its digest — one short evocative title, used at the
// boundary ceremony. Falls back to null so a numbered title is used instead.
export async function titleChapter(digest) {
  if (!digest?.trim()) return null;
  try {
    const out = await chatCompletion({
      tier: 'tiny',
      maxTokens: 40,
      temperature: 0.8,
      messages: [
        { role: 'system', content: t('ai.chapterTitlePrompt', {
            language: locale() === 'nl' ? 'Dutch' : 'English',
          }) },
        { role: 'user', content: digest },
      ],
    });
    const title = String(out ?? '').replace(/^["'\s]+|["'\s.]+$/g, '').slice(0, 60);
    return title || null;
  } catch {
    return null;
  }
}
