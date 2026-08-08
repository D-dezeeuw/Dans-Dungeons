// src/ai/auth.js — OpenRouter OAuth with real PKCE.
//
// No backend, no app registration: OpenRouter supports client-side OAuth for
// SPAs. The player clicks "Connect", authorises on OpenRouter, and is redirected
// back with a code we exchange for an API key.
//
// This file was named "PKCE" while sending no code challenge at all. Without
// one, a code intercepted on the way back — from browser history, a referrer
// header, a shared link, an extension reading the address bar — can be redeemed
// by whoever holds it, for an API key that bills the player. The verifier fixes
// that: the code is only redeemable by the tab that started the flow.
//
// `state` is the second half of the same idea, in the other direction: it stops
// a code the player never asked for from being planted in their address bar and
// silently exchanged.

const CALLBACK_URL   = `${location.origin}${location.pathname}`;
const VERIFIER_KEY   = 'dg-pkce-verifier';
const STATE_KEY      = 'dg-pkce-state';

// sessionStorage, not localStorage: the verifier is dead the moment the flow
// completes, and it should not outlive the tab that created it.
function stash(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* private mode — the flow degrades, see below */ }
}
function take(key) {
  try {
    const v = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return v;
  } catch { return null; }
}

function base64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength = 48) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function s256(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

// Begin the flow. Generates a verifier + state, stashes both for this tab, and
// sends only the derived challenge to the provider.
export async function redirectToOpenRouter() {
  const verifier = randomString();
  const state    = randomString(16);
  stash(VERIFIER_KEY, verifier);
  stash(STATE_KEY, state);

  const params = new URLSearchParams({
    callback_url:          CALLBACK_URL,
    code_challenge:        await s256(verifier),
    code_challenge_method: 'S256',
    state,
  });
  location.href = `https://openrouter.ai/auth?${params}`;
}

// True when this callback carries the state we sent. A missing stored state is
// treated as a mismatch: either the flow did not start in this tab, or storage
// refused it, and in both cases exchanging the code is not something the player
// asked for here.
export function stateMatches(returnedState) {
  const expected = take(STATE_KEY);
  return Boolean(expected) && expected === returnedState;
}

export async function exchangeCodeForKey(code) {
  const verifier = take(VERIFIER_KEY);
  const body = { code };
  // Send the verifier when we have one. A flow that started in another tab (or
  // in a browser that refused sessionStorage) still completes — OpenRouter
  // accepts a code issued without a challenge — but a flow that started HERE is
  // bound to this tab and cannot be redeemed by anyone else.
  if (verifier) {
    body.code_verifier = verifier;
    body.code_challenge_method = 'S256';
  }

  const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Key exchange failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.key;
}
