// src/ai/narrate.js — narrator and scene-image AI calls.
//
// narrate() streams the GM narration for a resolved turn.
// generateSceneImage() produces a journal-sketch data URI (decorative, silent on failure).

import { _callStream, repairJson, chatCompletion, aiConfig } from './client.js';
import { generateImage } from 'bag-of-holding-client';
import { NARRATOR_SCHEMA } from './schemas.js';
import { salvageJson } from './parse.js';
import { validateNarration } from './validate.js';
import { t, locale } from '../i18n/i18n.js';
import { voiceBlock, imageStyle } from '../settings/voice.js';
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
        { role: 'system', content: t('ai.travelPrompt', { language: lang, context: JSON.stringify(context), voice: voiceBlock('narrator') }) },
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
    // How this world talks. Empty for the classic pack, so the prompt reads
    // exactly as it always has; a pack fills it with register, address terms
    // ('choom', 'matey') and the words that belong to a different world.
    voice:      voiceBlock('narrator'),
  });

  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: t('ai.narrateTurnPrompt') },
  ];

  // Schema-bound streaming: the narrator answering in prose or inside a markdown
  // fence used to cost a second, paid repair call on top of the one the player
  // already watched arrive.
  const raw = await _callStream({ tier: 'medium', messages, schema: NARRATOR_SCHEMA }, onChunk);

  try {
    return narration(JSON.parse(raw));
  } catch { /* fall through to local salvage */ }

  // Salvage locally before paying anyone. Almost every "unparseable" narration
  // is valid JSON wearing a markdown fence or trailing prose — and the player
  // has ALREADY watched the streamed text, so a repair call that comes back
  // with different words shows them one story and commits another.
  const salvaged = salvageJson(raw);
  if (salvaged) return narration(salvaged);

  return narration(await repairJson(raw, { tier: 'medium', schema: NARRATOR_SCHEMA }, messages));
}

// A missing `narration` used to render the literal string "undefined" into the
// transcript, and from there into the save, the journal and the world bible.
function narration(out) {
  return validateNarration(out, { fallback: t('loop.narrationMissing') });
}

// ─── Scene image generation ───────────────────────────────────────────────────
//
// Calls the image model with a journal-sketch style prompt.
// Returns a data-URI string (ready for background-image), or null on failure.
// Never throws — image generation is decorative; errors are silent.

export async function generateSceneImage(sceneDescription) {
  // The style is the setting's, not the engine's: this used to be a literal
  // 'medieval fantasy scene', so a cyberpunk campaign sketched castles. The
  // classic pack carries the original string verbatim.
  const prompt = `${imageStyle()} Scene: ${sceneDescription}`;

  // The library owns the transport + the multi-shape provider response parsing;
  // it resolves the image-tier model from config and returns null on any failure.
  return generateImage(aiConfig('image'), { prompt });
}

// Re-exported so callers that reached for it through narrate.js still can.
export { salvageJson };
