// src/ai/classify.js — intent classifier: maps free-text player input to a
// structured action object using the tiny model and a fixed JSON schema.

import { chatCompletion } from './client.js';
import { CLASSIFIER_SCHEMA, BEAT_CHECK_SCHEMA } from './schemas.js';
import { preClassify } from '../game/preclassify.js';
import { clampDc, DC_MIN, DC_MAX } from './parse.js';
import { validateClassification, validateBeatCheck } from './validate.js';
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

  // `strict` json_schema is a request, not a guarantee — and a call that walks
  // the tier's fallback chain can land on a model that honours it loosely. An
  // intent outside the enum reaches no resolver branch and lands on the
  // narrator to improvise, which is the drift the rules layer exists to stop.
  return validateClassification(out, {
    intents: CLASSIFIER_SCHEMA.properties.intent.enum,
    clampDc,
  });
}

// Phase 4.4: does the latest GM narration fulfil the current beat's dramatic
// purpose? Strict by design — only true when the scene clearly resolves it.
export async function checkBeatFulfilled(beatPurpose, narration) {
  const out = await chatCompletion({
    tier: 'tiny',
    maxTokens: 120,
    messages: [
      { role: 'system', content: t('ai.beatCheckPrompt', { purpose: beatPurpose }) },
      { role: 'user',   content: narration },
    ],
    schema: BEAT_CHECK_SCHEMA,
  });
  // `fulfilled` arriving as the string "false" used to advance the story.
  return validateBeatCheck(out);
}

// Historical surface: the DC band lived here before parse.js existed.
export { clampDc, DC_MIN, DC_MAX };
