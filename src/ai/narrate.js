// src/ai/narrate.js — narrator and scene-image AI calls.
//
// narrate() streams the GM narration for a resolved turn.
// generateSceneImage() produces a journal-sketch data URI (decorative, silent on failure).

import { appState, addValue } from '../core/state.js';
import { _call, _callStream, repairJson, modelFor, headers, chatCompletion } from './client.js';
import { NARRATOR_SCHEMA } from './schemas.js';
import { t, locale } from '../i18n/i18n.js';

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
      max_tokens: 220,
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

export async function narrate(resolvedFacts, sceneContext, recentTranscript, onChunk) {
  const transcriptText = recentTranscript.slice(-3).map(e => `${e.role}: ${e.text}`).join('\n');

  const system = t('ai.narratorPrompt', {
    transcript: transcriptText,
    scene:      JSON.stringify(sceneContext, null, 2),
    resolved:   JSON.stringify(resolvedFacts, null, 2),
  });

  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: t('ai.narrateTurnPrompt') },
  ];

  const raw = await _callStream({ tier: 'medium', messages }, onChunk);

  try {
    return JSON.parse(raw);
  } catch {
    return repairJson(raw, { tier: 'medium', schema: NARRATOR_SCHEMA }, messages);
  }
}

// ─── Scene image generation ───────────────────────────────────────────────────
//
// Calls the image model with a journal-sketch style prompt.
// Returns a data-URI string (ready for background-image), or null on failure.
// Never throws — image generation is decorative; errors are silent.

export async function generateSceneImage(sceneDescription) {
  const ai   = appState.ai || {};
  const base = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = modelFor('image', ai);
  if (!model) return null; // no image model available (free tier)

  const prompt =
    'Old hand-drawn journal sketch of a medieval fantasy scene. ' +
    'Black ink lines on sepia parchment paper. Rough, scratchy linework. ' +
    'No colour — only shades of sepia and black ink. Like an adventurer\'s field journal. ' +
    'No text, no labels, no writing of any kind. No borders, no frames, no decorative edges. ' +
    'Scene: ' + sceneDescription;

  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: headers(ai.key || '', location.origin),
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let data;
  try { data = await res.json(); } catch { return null; }

  if (data.usage?.total_tokens) addValue('ai.totalTokens', data.usage.total_tokens);

  const msg     = data.choices?.[0]?.message ?? {};
  const content = msg.content;

  // Gemini via OpenRouter: image lands in message.images[], not message.content
  if (Array.isArray(msg.images)) {
    for (const part of msg.images) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url;
    }
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url;
      if (part.type === 'image' && part.data) return `data:image/png;base64,${part.data}`;
      if (part.inline_data?.data) {
        const mime = part.inline_data.mime_type || 'image/png';
        return `data:${mime};base64,${part.inline_data.data}`;
      }
    }
  }

  if (typeof content === 'string') {
    const m = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*/);
    if (m) return m[0];
  }

  return null;
}
