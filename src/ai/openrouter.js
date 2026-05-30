// src/ai/openrouter.js
//
// Thin fetch wrapper around the OpenRouter chat completions endpoint.
// Structured outputs (JSON schema mode) are requested when `schema` is passed.
// One repair retry on schema parse failure.

import { appState, addValue } from '../core/state.js';

// ─── Shared schemas ───────────────────────────────────────────────────────────

export const CLASSIFIER_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['attack', 'skill', 'talk', 'move', 'take', 'unlock', 'look', 'inventory', 'wait', 'impossible', 'meta'],
    },
    target_id:  { type: ['string', 'null'] },
    direction:  { type: ['string', 'null'] },
    skill:      { type: ['string', 'null'] },
    dc:         { type: ['number', 'null'] },
    reason:     { type: 'string' },
  },
  required: ['intent', 'target_id', 'direction', 'skill', 'dc', 'reason'],
  additionalProperties: false,
};

export const NARRATOR_SCHEMA = {
  type: 'object',
  properties: {
    narration:     { type: 'string' },
    combat_ended:  { type: 'boolean' },
    outcome:       { type: 'string', enum: ['continue', 'victory', 'defeat', 'flee'] },
  },
  required: ['narration', 'combat_ended', 'outcome'],
  additionalProperties: false,
};

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function _call({ tier = 'medium', messages, schema }) {
  const ai    = appState.ai || {};
  const base  = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const key   = ai.key || '';
  const model = ai.models?.[tier] ?? (tier === 'tiny' ? 'openai/gpt-4o-mini' : 'anthropic/claude-sonnet-4-5');

  const body = {
    model,
    messages,
    temperature: tier === 'tiny' ? 0.1 : 0.85,
    max_tokens:  tier === 'tiny' ? 250 : 700,
  };

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'output', strict: true, schema },
    };
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer':  location.origin,
      'X-Title':       "Dan's Dungeons",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.usage?.total_tokens) {
    addValue('ai.totalTokens', data.usage.total_tokens);
  }

  return data.choices[0].message.content;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function chatCompletion(opts) {
  const content = await _call(opts);
  if (!opts.schema) return content;

  try {
    return JSON.parse(content);
  } catch {
    // One repair pass: re-send with the parse error
    const repairMessages = [
      ...opts.messages,
      { role: 'assistant', content },
      { role: 'user', content: `Your response was not valid JSON. Retry and return only a JSON object matching the schema.` },
    ];
    const retry = await _call({ ...opts, messages: repairMessages });
    return JSON.parse(retry);
  }
}

// ─── Classifier ───────────────────────────────────────────────────────────────

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

// ─── Narrator ────────────────────────────────────────────────────────────────

export async function narrate(resolvedFacts, sceneContext, recentTranscript) {
  const system = `You are the Game Master narrating a D&D 5e dungeon encounter.

Setting: gritty low fantasy, second person ("you strike", "you dodge").

Rules:
- Do NOT invent dice results — use only the resolved facts in the data
- 2–4 sentences; vivid but concise
- If a hit: describe the impact and the enemy's reaction
- If a miss: describe the near-miss
- If the enemy retaliated: weave it into the same narration
- End on tension or consequence
- If intent is 'move': describe entering the new room (use newRoom.description); introduce any enemies using their intro text; mention visible items
- If intent is 'take': describe picking up the item
- If intent is 'unlock': describe unlocking the door with a satisfying click
- CRITICAL — if intent is 'impossible': the action simply cannot happen. Do NOT describe it succeeding or partially succeeding. Describe only the failure and its reason. No enemy dies, no item is taken, nothing changes.

Recent transcript (last 3 turns, for continuity):
${recentTranscript.slice(-3).map(e => `${e.role}: ${e.text}`).join('\n')}

Current scene:
${JSON.stringify(sceneContext, null, 2)}

Resolved mechanics:
${JSON.stringify(resolvedFacts, null, 2)}`;

  return chatCompletion({
    tier: 'medium',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: 'Narrate the outcome of this turn.' },
    ],
    schema: NARRATOR_SCHEMA,
  });
}
