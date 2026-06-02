// src/ai/autoplay.js — LLM-driven autopilot: picks the next player action.
//
// Called once per turn when autoplay is enabled. Uses the tiny tier for
// fast, cheap action selection from the available chip vocabulary.

import { chatCompletion } from './client.js';
import { AUTOPLAY_SCHEMA } from './schemas.js';
import { t } from '../i18n/i18n.js';

export async function generateAutoAction(scene, availableActions, transcript) {
  const system = t('ai.autoplayPrompt', {
    scene:      JSON.stringify(scene, null, 2),
    actions:    JSON.stringify(availableActions),
    transcript: JSON.stringify(transcript.slice(-6)),
  });

  const result = await chatCompletion({
    tier: 'tiny',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: t('ai.autoplayUserMsg') },
    ],
    schema: AUTOPLAY_SCHEMA,
  });

  return result?.action ?? null;
}
