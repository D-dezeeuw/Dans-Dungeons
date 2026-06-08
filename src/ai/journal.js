// src/ai/journal.js — LLM-enhanced journal: weaves turn narrations into a
// coherent D&D tale. Caches processed chapters in localStorage so turns
// that have already been transformed aren't re-processed on subsequent exports.

import { chatCompletion } from './client.js';
import { JOURNAL_SCHEMA } from './schemas.js';
import { t } from '../i18n/i18n.js';

const CACHE_KEY = 'dg-journal-cache';

// ─── Cache helpers ───────────────────────────────────────────────────────────

function _loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
  } catch { return {}; }
}

function _saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

// Build a stable fingerprint for a set of narrations so we can detect new turns.
function _fingerprint(narrations) {
  return narrations.map(n => n.slice(0, 60)).join('|');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateJournalStory(entries, pcName, pcClass) {
  const narrations = entries.map(e => e.narration).filter(Boolean);
  if (!narrations.length) return null;

  const fp    = _fingerprint(narrations);
  const cache = _loadCache();

  // Full cache hit — all turns already processed.
  if (cache.fingerprint === fp && cache.story) {
    return cache.story;
  }

  // Partial cache — some turns already processed.
  // Find how many leading narrations match the cached version.
  let cachedChapters = [];
  let newNarrations  = narrations;

  if (cache.processedCount && cache.story?.chapters) {
    const prevFp = _fingerprint(narrations.slice(0, cache.processedCount));
    if (cache.partialFingerprint === prevFp) {
      cachedChapters = cache.story.chapters;
      newNarrations  = narrations.slice(cache.processedCount);
    }
  }

  // If no new narrations to process, return cached story.
  if (!newNarrations.length && cachedChapters.length) {
    return cache.story;
  }

  // Build the prompt — include cached summary context if partial.
  const contextHint = cachedChapters.length
    ? `\n\nPreviously written chapters (continue from here, do not repeat):\n${cachedChapters.map(c => `[${c.heading}] ${c.text.slice(0, 100)}…`).join('\n')}`
    : '';

  const system = t('ai.journalPrompt', {
    name:       pcName,
    class:      pcClass,
    narrations: JSON.stringify(newNarrations),
    context:    contextHint,
  });

  const result = await chatCompletion({
    tier: 'medium',
    maxTokens: 4000,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: t('ai.journalUserMsg') },
    ],
    schema: JOURNAL_SCHEMA,
  });

  if (!result?.chapters?.length) return null;

  // Merge cached + new chapters.
  const story = {
    title:    result.title ?? cache.story?.title ?? `The Tale of ${pcName}`,
    chapters: [...cachedChapters, ...result.chapters],
  };

  // Save to cache.
  _saveCache({
    fingerprint:        _fingerprint(narrations),
    partialFingerprint: _fingerprint(narrations),
    processedCount:     narrations.length,
    story,
  });

  return story;
}
