// src/ai/classify.js — intent classifier: maps free-text player input to a
// structured action object using the tiny model and a fixed JSON schema.

import { chatCompletion } from './client.js';
import { CLASSIFIER_SCHEMA, BEAT_CHECK_SCHEMA } from './schemas.js';
import { preClassify } from '../game/preclassify.js';
import { clampDc, DC_MIN, DC_MAX } from './parse.js';
import { t, locale } from '../i18n/i18n.js';

export async function classify(playerInput, sceneContext) {
  // A compass press, a room chip, a bare "north" — the UI already knew the
  // structured action when it drew the button. Recognising it here removes an
  // LLM round trip from roughly a third of all turns.
  const pre = preClassify(playerInput, sceneContext, { t, locale });
  if (pre) return pre;

  const system = t('ai.classifierPrompt', {
    scene: JSON.stringify(sceneContext, null, 2),
  });

  const out = await chatCompletion({
    tier: 'tiny',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: playerInput },
    ],
    schema: CLASSIFIER_SCHEMA,
  });

  return { ...out, dc: clampDc(out?.dc), spellId: out?.spell_id ?? null };
}

// Phase 4.4: does the latest GM narration fulfil the current beat's dramatic
// purpose? Strict by design — only true when the scene clearly resolves it.
export async function checkBeatFulfilled(beatPurpose, narration) {
  return chatCompletion({
    tier: 'tiny',
    maxTokens: 120,
    messages: [
      { role: 'system', content: t('ai.beatCheckPrompt', { purpose: beatPurpose }) },
      { role: 'user',   content: narration },
    ],
    schema: BEAT_CHECK_SCHEMA,
  });
}

// Historical surface: the DC band lived here before parse.js existed.
export { clampDc, DC_MIN, DC_MAX };
