// src/ai/classify.js — intent classifier: maps free-text player input to a
// structured action object using the tiny model and a fixed JSON schema.

import { chatCompletion } from './client.js';
import { CLASSIFIER_SCHEMA } from './schemas.js';

export async function classify(playerInput, sceneContext) {
  const system = `You are a D&D action classifier. Classify the player's intent from their free-text input.

Current scene (use this to identify valid targets):
${JSON.stringify(sceneContext, null, 2)}

Output a single JSON object. Be generous in interpretation ("hit the goblin" → attack, "sneak past" → skill stealth).
- "go north" / "head through the doorway" → move (set direction to north/south/east/west)
- "take the key" / "grab the brass key"  → take (set target_id to the item's id from scene loot)
- "unlock the door" / "use the key"       → unlock
- direction: the cardinal direction for move, null otherwise
- target_id: NPC id for attack, item id for take, null otherwise
For skill checks suggest a dc between 10 and 20.`;

  return chatCompletion({
    tier: 'tiny',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: playerInput },
    ],
    schema: CLASSIFIER_SCHEMA,
  });
}
