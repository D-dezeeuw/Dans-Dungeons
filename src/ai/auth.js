// src/ai/auth.js — OpenRouter OAuth PKCE flow.
//
// No backend needed, no app registration. OpenRouter supports client-side
// OAuth for SPAs. The user clicks "Connect", signs up on OpenRouter, and
// is redirected back with a code that we exchange for an API key.

const CALLBACK_URL = `${location.origin}${location.pathname}`;

export function redirectToOpenRouter() {
  const url = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(CALLBACK_URL)}`;
  location.href = url;
}

export async function exchangeCodeForKey(code) {
  const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Key exchange failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.key;
}
