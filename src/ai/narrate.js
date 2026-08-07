// src/ai/narrate.js — narrator and scene-image AI calls.
//
// narrate() streams the GM narration for a resolved turn.
// generateSceneImage() produces a journal-sketch data URI (decorative, silent on failure).

import { _callStream, repairJson, chatCompletion, aiConfig } from './client.js';
import { generateImage } from 'bag-of-holding-client';
import { NARRATOR_SCHEMA } from './schemas.js';
import { validateNarration } from './validate.js';
import { t, locale } from '../i18n/i18n.js';
import { transcriptWindow } from '../game/chapters.js';

// ─── Travel narration (Phase 3) ───────────────────────────────────────────────
//
// One short prose paragraph for an overworld travel beat (departure, a segment,
// an arrival). Plain text (no schema). Returns null on failure so flow.js can
// fall back to a templated line.

export async function narrateTravel(context) {
  try {
    const lang = locale() === 'nl' ? 'Dutch' : 'English';
    return await chatCompletion({
      tier: 'medium',
      maxTokens: 220,
      messages: [
        { role: 'system', content: t('ai.travelPrompt', { language: lang, context: JSON.stringify(context) }) },
        { role: 'user',   content: t('ai.travelUserMsg') },
      ],
    });
  } catch {
    return null;
  }
}

// ─── Narrator ────────────────────────────────────────────────────────────────
//
// Streams the response. onChunk(text) receives each narration token as it
// arrives so the UI can display it progressively. Returns the full parsed
// JSON object once the stream is complete.

export async function narrate(resolvedFacts, sceneContext, recentTranscript, onChunk, memory = null, gmOnly = null) {
  // The window used to be 3 entries — 1.5 turns — while the prompt claimed "the
  // last 3 turns". Everything older now arrives as chapter digests (memory),
  // so this slice only has to cover the immediate exchange.
  const transcriptText = transcriptWindow(recentTranscript).map(e => `${e.role}: ${e.text}`).join('\n');

  const system = t('ai.narratorPrompt', {
    // Stable, oldest-first: frozen chapter digests sit at the front of the
    // prompt where a provider's prefix cache can serve them cheaply.
    memory:     memory ? JSON.stringify(memory) : '(no earlier chapters)',
    transcript: transcriptText,
    scene:      JSON.stringify(sceneContext),
    resolved:   JSON.stringify(resolvedFacts),
    // The generated world's own tone, instead of a hardcoded "gritty low
    // fantasy" that contradicted whatever the blueprint had rolled.
    tone:       sceneContext?.tone ?? t('ai.defaultTone'),
    // GM-private: the beat directive and unrevealed secrets. Injected here, in
    // the system prompt, and nowhere the player or the save can see.
    gm:         gmOnly ? JSON.stringify(gmOnly) : '(nothing private this turn)',
  });

  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: t('ai.narrateTurnPrompt') },
  ];

  const raw = await _callStream({ tier: 'medium', messages }, onChunk);

  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* fall through to repair */ }

  // Narration is the only field the player actually reads, so a response that
  // parses but carries none is worse than one that fails to parse: the turn
  // commits and the screen stays blank. Validate, and let the repair pass have
  // a second go before giving up.
  let out = validateNarration(parsed);
  if (out) return out;

  out = validateNarration(await repairJson(raw, { tier: 'medium', schema: NARRATOR_SCHEMA }, messages));
  // Null tells flow.js to run its "GM unavailable" path rather than committing
  // silence as though it were a turn.
  return out;
}

// ─── Scene image generation ───────────────────────────────────────────────────
//
// Calls the image model with a journal-sketch style prompt.
// Returns a data-URI string (ready for background-image), or null on failure.
// Never throws — image generation is decorative; errors are silent.

export async function generateSceneImage(sceneDescription) {
  const prompt =
    'Old hand-drawn journal sketch of a medieval fantasy scene. ' +
    'Black ink lines on sepia parchment paper. Rough, scratchy linework. ' +
    'No colour — only shades of sepia and black ink. Like an adventurer\'s field journal. ' +
    'No text, no labels, no writing of any kind. No borders, no frames, no decorative edges. ' +
    'Scene: ' + sceneDescription;

  // The library owns the transport + the multi-shape provider response parsing;
  // it resolves the image-tier model from config and returns null on any failure.
  return generateImage(aiConfig(), { prompt });
}
