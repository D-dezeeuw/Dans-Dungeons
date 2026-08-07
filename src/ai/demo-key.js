// src/ai/demo-key.js — the optional shared "try it without a key" credential.
//
// This used to be an XOR-obfuscated byte array in tiers.js. Obfuscation stops
// nobody with a JS console: the key shipped in a public bundle in a public repo
// was effectively published, and every free-tier player's prose transited the
// owner's OpenRouter account against a per-ACCOUNT free-model cap shared by the
// entire player base.
//
// So the credential is no longer in the source at all. build.js injects
// DEMO_KEY from the DD_DEMO_KEY environment variable at bundle time; with the
// variable unset (the default, and what CI publishes) this is null and the game
// is honestly BYOK-only — the "try it" option simply isn't offered.
//
// If a shared demo tier comes back, put it behind a proxy that holds the key
// server-side and rate-limits per IP, then point DD_DEMO_BASE_URL at it. A
// browser bundle can never keep a secret.

/* global DEMO_KEY, DEMO_BASE_URL */

// esbuild replaces these identifiers via `define`; the typeof guard keeps the
// module importable under `node --test`, where no define pass has run.
export function demoKey() {
  return typeof DEMO_KEY === 'string' && DEMO_KEY ? DEMO_KEY : null;
}

// Optional proxy base URL for the demo tier (falls back to the normal default).
export function demoBaseUrl() {
  return typeof DEMO_BASE_URL === 'string' && DEMO_BASE_URL ? DEMO_BASE_URL : null;
}

// Is a no-key demo path available in this build?
export function hasDemoTier() {
  return demoKey() !== null;
}
