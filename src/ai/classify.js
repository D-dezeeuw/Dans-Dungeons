// src/ai/classify.js — intent classifier: maps free-text player input to a
// structured action object using the tiny model and a fixed JSON schema.

import { chatCompletion } from './client.js';
import { CLASSIFIER_SCHEMA, BEAT_CHECK_SCHEMA } from './schemas.js';
import { t } from '../i18n/i18n.js';

export async function classify(playerInput, sceneContext) {
  // Chips and the compass submit strings this app itself wrote — asking a model
  // to work out that "I go north" means `{intent:'move', direction:'north'}`
  // buys nothing and costs a round trip on the majority of turns. Recognise our
  // own commands locally and skip straight to the resolver.
  const local = localClassify(playerInput, sceneContext);
  if (local) return local;

  const system = t('ai.classifierPrompt', {
    // Minified: pretty-printing this scene cost ~12% of the input tokens on the
    // one call that runs every single turn.
    scene: JSON.stringify(sceneContext),
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

// ─── Local fast path ─────────────────────────────────────────────────────────

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '');

const intent = (over) => ({
  intent: 'wait', target_id: null, direction: null, skill: null, dc: null,
  reason: 'chip input — classified locally', ...over,
});

// Returns a classifier-shaped object when the input is verbatim one of our own
// chip commands, or null to fall through to the model. Deliberately strict:
// anything the player actually typed themselves should still be classified,
// because free text is where the interesting ambiguity lives.
export function localClassify(playerInput, scene = {}) {
  const input = norm(playerInput);
  if (!input) return null;

  for (const dir of ['north', 'south', 'east', 'west']) {
    if (input === norm(t('chips.goDir', { dir: t(`directions.${dir}`) }))) {
      return intent({ intent: 'move', direction: dir });
    }
  }

  if (input === norm(t('chips.unlockCmd'))) return intent({ intent: 'unlock' });
  if (input === norm(t('chips.lookCmd')))   return intent({ intent: 'look' });
  if (input === norm(t('chips.talkCmd')))   return intent({ intent: 'talk' });
  if (input === norm(t('chips.waitCmd')))   return intent({ intent: 'wait' });

  // Attack only when there is exactly one thing to attack. With two goblins in
  // the room "I attack" is genuinely ambiguous and the model should pick.
  if (input === norm(t('chips.attackCmd'))) {
    const targets = (scene.npcs ?? []).filter(n => n.alive !== false);
    if (targets.length === 1) return intent({ intent: 'attack', target_id: targets[0].id });
    return null;
  }

  // "I take the brass key" — match against the loot actually in the room, so a
  // renamed or absent item falls through rather than resolving to nothing.
  for (const item of scene.room?.loot ?? []) {
    if (input === norm(t('chips.takeCmd', { name: item.name }))) {
      return intent({ intent: 'take', target_id: item.id });
    }
  }

  return null;
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
