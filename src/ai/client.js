// src/ai/client.js — raw HTTP transport for the OpenRouter chat completions API.
//
// Handles: request building, 400-retry-with-medium fallback, SSE streaming,
// JSON repair pass, and key validation. No prompt logic lives here.

import { appState, addValue } from '../core/state.js';
import { DEFAULT_MODELS } from './tiers.js';
import { NarrationExtractor } from './stream.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

export function modelFor(tier, ai) {
  return ai.models?.[tier] ?? DEFAULT_MODELS[tier] ?? DEFAULT_MODELS.medium;
}

export function headers(key, origin) {
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

async function _callOnce({ tier = 'medium', messages, schema, max_tokens }) {
  const ai    = appState.ai || {};
  const base  = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = modelFor(tier, ai);

  const body = {
    model,
    messages,
    temperature: tier === 'tiny' ? 0.1 : 0.85,
    max_tokens:  max_tokens ?? (tier === 'tiny' ? 250 : 700),
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
export async function _call(opts) {
  try {
    return await _callOnce(opts);
  } catch (err) {
    if (err.message.startsWith('AI 400:') && opts.tier !== 'medium') {
      return await _callOnce({ ...opts, tier: 'medium' });
    }
    throw err;
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

export async function _callStream(opts, onChunk) {
  try {
    return await _callStreamOnce(opts, onChunk);
  } catch (err) {
    if (err.message.startsWith('AI 400:') && opts.tier !== 'medium') {
      return await _callStreamOnce({ ...opts, tier: 'medium' }, onChunk);
    }
    throw err;
  }
}

// ─── JSON repair helper ───────────────────────────────────────────────────────
//
// One retry pass: appends the malformed response and a correction prompt,
// then calls the model again and hard-parses the result.

export async function repairJson(raw, baseOpts, messages) {
  const repairMessages = [
    ...messages,
    { role: 'assistant', content: raw },
    { role: 'user', content: 'Your response was not valid JSON. Retry and return only a JSON object matching the schema.' },
  ];
  const retry = await _call({ ...baseOpts, messages: repairMessages });
  return JSON.parse(retry);
}

// ─── chatCompletion — non-streaming with optional JSON parse ──────────────────

export async function chatCompletion(opts) {
  const content = await _call(opts);
  if (!opts.schema) return content;

  try {
    return JSON.parse(content);
  } catch {
    return repairJson(content, opts, opts.messages);
  }
}
