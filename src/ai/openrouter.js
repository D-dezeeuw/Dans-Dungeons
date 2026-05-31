// src/ai/openrouter.js
//
// Thin fetch wrapper around the OpenRouter chat completions endpoint.
// Structured outputs (JSON schema mode) are used for the classifier.
// The narrator uses streaming SSE — tokens arrive progressively.
// Any 400 response automatically retries with the medium-tier model.

import { appState, addValue } from '../core/state.js';
import { DEFAULT_MODELS } from './tiers.js';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modelFor(tier, ai) {
  return ai.models?.[tier] ?? DEFAULT_MODELS[tier] ?? DEFAULT_MODELS.medium;
}

function headers(key, origin) {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${key}`,
    'HTTP-Referer':  origin,
    'X-Title':       "Dan's Dungeons",
  };
}

// ─── Key validation ───────────────────────────────────────────────────────────
//
// Hits GET /auth/key (OpenRouter-specific endpoint).
// Returns false ONLY on 401 — any other outcome (404, network error, custom
// base URL) is treated as "assume valid" so non-OpenRouter setups aren't blocked.

export async function checkKey() {
  const ai   = appState.ai || {};
  if (!ai.key) return false;
  const base = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/auth/key`, {
      headers: { 'Authorization': `Bearer ${ai.key}` },
    });
    return res.status !== 401;
  } catch {
    return true; // network error or non-OpenRouter endpoint — don't block
  }
}

// ─── Non-streaming fetch ──────────────────────────────────────────────────────

async function _callOnce({ tier = 'medium', messages, schema }) {
  const ai    = appState.ai || {};
  const base  = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = modelFor(tier, ai);

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
    headers: headers(ai.key || '', location.origin),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.usage?.total_tokens) addValue('ai.totalTokens', data.usage.total_tokens);
  return data.choices[0].message.content;
}

// On 400 (content filter, unsupported feature, etc.) retry with the medium tier.
async function _call(opts) {
  try {
    return await _callOnce(opts);
  } catch (err) {
    if (err.message.startsWith('AI 400:') && opts.tier !== 'medium') {
      return await _callOnce({ ...opts, tier: 'medium' });
    }
    throw err;
  }
}

// ─── Narration extractor (streaming JSON → plain text) ────────────────────────
//
// DeepSeek streams the narrator response as a JSON object. This class watches
// the incoming token stream and emits only the text inside `"narration":"..."`.

class NarrationExtractor {
  constructor() {
    this._buf    = '';
    this._active = false;  // entered the narration value
    this._done   = false;  // closing quote seen
  }

  feed(raw) {
    if (this._done) return '';
    this._buf += raw;

    if (!this._active) {
      const marker = '"narration":"';
      const idx = this._buf.indexOf(marker);
      if (idx === -1) {
        // Keep enough tail to detect a marker that spans two chunks.
        if (this._buf.length > marker.length) {
          this._buf = this._buf.slice(-(marker.length - 1));
        }
        return '';
      }
      this._active = true;
      this._buf = this._buf.slice(idx + marker.length);
    }

    // Decode content until an unescaped closing quote.
    let out = '';
    let i   = 0;
    while (i < this._buf.length) {
      const ch = this._buf[i];
      if (ch === '\\') {
        if (i + 1 >= this._buf.length) break; // incomplete escape — wait
        const esc = this._buf[i + 1];
        out += esc === '"' ? '"' : esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '' : esc;
        i += 2;
      } else if (ch === '"') {
        this._done = true;
        i++;
        break;
      } else {
        out += ch;
        i++;
      }
    }
    this._buf = this._buf.slice(i);
    return out;
  }
}

// ─── Streaming fetch ──────────────────────────────────────────────────────────
//
// Sends stream:true, parses the SSE response line by line.
// Calls onChunk(text) with each narration token as it arrives.
// Returns the complete raw content for JSON parsing after the stream ends.

async function _callStreamOnce({ tier = 'medium', messages }, onChunk) {
  const ai    = appState.ai || {};
  const base  = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = modelFor(tier, ai);

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: headers(ai.key || '', location.origin),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.85,
      max_tokens:  700,
      stream:      true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  }

  const reader    = res.body.getReader();
  const decoder   = new TextDecoder();
  const extractor = new NarrationExtractor();
  let full    = '';
  let partial = '';  // incomplete SSE line carried across reads

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = partial + decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    partial = lines.pop(); // last element may be a partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') break outer;
      try {
        const evt   = JSON.parse(data);
        const delta = evt.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          if (onChunk) {
            const narChunk = extractor.feed(delta);
            if (narChunk) onChunk(narChunk);
          }
        }
        if (evt.usage?.total_tokens) addValue('ai.totalTokens', evt.usage.total_tokens);
      } catch { /* malformed SSE line — skip */ }
    }
  }

  return full;
}

async function _callStream(opts, onChunk) {
  try {
    return await _callStreamOnce(opts, onChunk);
  } catch (err) {
    if (err.message.startsWith('AI 400:') && opts.tier !== 'medium') {
      return await _callStreamOnce({ ...opts, tier: 'medium' }, onChunk);
    }
    throw err;
  }
}

// ─── Scene image generation ───────────────────────────────────────────────────
//
// Calls the Gemini image model with a journal-sketch style prompt.
// Returns a data-URI string (ready for <img src>), or null on failure.
// Never throws — image generation is decorative; errors are silent.

export async function generateSceneImage(sceneDescription) {
  const ai   = appState.ai || {};
  const base = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = modelFor('image', ai);

  const prompt =
    'Old hand-drawn journal sketch of a medieval fantasy scene. ' +
    'Black ink lines on sepia parchment paper. Rough, scratchy linework. ' +
    'No colour — only shades of sepia and black ink. Like an adventurer\'s field journal. ' +
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
  } catch (e) {
    console.warn('[scene-image] fetch failed', e);
    return null;
  }

  if (!res.ok) {
    console.warn('[scene-image] API error', res.status);
    return null;
  }

  let data;
  try { data = await res.json(); } catch { return null; }

  // Usage tracking (image tokens are counted alongside text tokens).
  if (data.usage?.total_tokens) addValue('ai.totalTokens', data.usage.total_tokens);

  // Extract image data URI from various possible response shapes.
  const content = data.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    for (const part of content) {
      // OpenAI-compatible image_url part
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url;
      // Gemini inline_data part (via OpenRouter shim)
      if (part.type === 'image' && part.data) return `data:image/png;base64,${part.data}`;
      if (part.inline_data?.data) {
        const mime = part.inline_data.mime_type || 'image/png';
        return `data:${mime};base64,${part.inline_data.data}`;
      }
    }
  }

  // Fallback: scan a string response for an embedded data URI.
  if (typeof content === 'string') {
    const m = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*/);
    if (m) return m[0];
  }

  console.warn('[scene-image] no image data found in response', data);
  return null;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function chatCompletion(opts) {
  const content = await _call(opts);
  if (!opts.schema) return content;

  try {
    return JSON.parse(content);
  } catch {
    // One repair pass: re-send with the parse error.
    const repairMessages = [
      ...opts.messages,
      { role: 'assistant', content },
      { role: 'user', content: 'Your response was not valid JSON. Retry and return only a JSON object matching the schema.' },
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
//
// Streams the response. onChunk(text) receives each narration token as it
// arrives so the UI can display it progressively. Returns the full parsed
// JSON object once the stream is complete.

export async function narrate(resolvedFacts, sceneContext, recentTranscript, onChunk) {
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
${JSON.stringify(resolvedFacts, null, 2)}

Output ONLY a JSON object — no markdown, no extra text:
{"narration":"...","combat_ended":true/false,"outcome":"continue"|"victory"|"defeat"|"flee"}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: 'Narrate the outcome of this turn.' },
  ];

  const raw = await _callStream({ tier: 'medium', messages }, onChunk);

  try {
    return JSON.parse(raw);
  } catch {
    // Repair pass (non-streaming) if JSON is malformed.
    const repairMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: 'Your response was not valid JSON. Retry and return only a JSON object matching the schema.' },
    ];
    const retry = await _call({ tier: 'medium', messages: repairMessages, schema: NARRATOR_SCHEMA });
    return JSON.parse(retry);
  }
}
