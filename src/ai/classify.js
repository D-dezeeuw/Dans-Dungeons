// src/ai/classify.js — intent classifier: maps free-text player input to a
// structured action object using the tiny model and a fixed JSON schema.

import { chatCompletion } from './client.js';
import { CLASSIFIER_SCHEMA, BEAT_CHECK_SCHEMA } from './schemas.js';
import { t } from '../i18n/i18n.js';

export async function classify(playerInput, sceneContext) {
  const system = t('ai.classifierPrompt', {
    scene: JSON.stringify(sceneContext, null, 2),
  });

  return chatCompletion({
    tier: 'tiny',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: playerInput },
    ],
    schema: CLASSIFIER_SCHEMA,
  });
}

// Phase 4.4: does the latest GM narration fulfil the current beat's dramatic
// purpose? Strict by design — only true when the scene clearly resolves it.
export async function checkBeatFulfilled(beatPurpose, narration) {
  return chatCompletion({
    tier: 'tiny',
    max_tokens: 120,
    messages: [
      { role: 'system', content: t('ai.beatCheckPrompt', { purpose: beatPurpose }) },
      { role: 'user',   content: narration },
    ],
    schema: BEAT_CHECK_SCHEMA,
  });
}
