// src/ai/classify.js — intent classifier: maps free-text player input to a
// structured action object using the tiny model and a fixed JSON schema.

import { chatCompletion } from './client.js';
import { CLASSIFIER_SCHEMA } from './schemas.js';
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
