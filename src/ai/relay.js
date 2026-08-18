// src/ai/relay.js — connecting to a hosted table instead of paying per turn.
//
// The game has always been BYOK: the player brings an OpenRouter key and every
// turn bills their account. That is the only shape a page with no backend can
// offer on its own, and it is why the wizard's first question is about a key.
//
// A hosted bag-of-holding-mcp deployment offers the other shape. Its tenant
// token — the one an operator mints per table, that already carries the
// campaign's memory, its worlds and its image tier — can also pay for prose,
// because the deployment holds a provider key and relays completions under a
// per-tenant budget. From this app's side that is a base URL and a credential,
// exactly like a provider: `tenantConfig()` builds the config and every
// existing call path works unchanged.
//
// So the wizard can now take either string. Which one the player pasted is not
// a question they should have to answer — the two are told apart by shape and,
// failing that, by asking the provider and then the deployment.

// Deliberately imports nothing. Every decision here is a pure function of a
// pasted string or a probe result, which is what lets `node --test` cover them:
// the client library is reachable in the bundle through an esbuild alias, not
// from a bare `node` process, so a module that imports it cannot be unit
// tested. The one function that needs the network (`connectTenant`) therefore
// lives in ./client.js, beside the other provider I/O.

/* global TENANT_URL */

/**
 * The deployment this build offers by default, injected at bundle time from
 * DD_TENANT_URL (see build.js). Null in a stock build, in which case a player
 * with a tenant token is asked for their operator's URL — the token is useless
 * without knowing where it is a tenant OF.
 *
 * Unlike DEMO_KEY this is not a credential and hiding it would buy nothing: a
 * relay URL with no token in it opens nothing (every unknown token is a 404).
 */
export function defaultTenantUrl() {
  return typeof TENANT_URL === 'string' && TENANT_URL ? TENANT_URL : null;
}

/**
 * A minted tenant token is 32 random bytes as hex — see the admin panel's
 * `mintToken`. An OpenRouter key is `sk-or-v1-…`. Neither test is a security
 * check (both credentials are verified against the thing they authenticate);
 * they only decide which check to run FIRST, so the common case costs one
 * round trip instead of two.
 */
export function looksLikeTenantToken(value) {
  return /^[0-9a-f]{64}$/i.test(String(value ?? '').trim());
}

export function looksLikeProviderKey(value) {
  return /^sk-/i.test(String(value ?? '').trim());
}

/**
 * The app's pricing tier for a relay tier.
 *
 * The relay speaks free/patron/studio (what the operator's registry priced);
 * this app speaks free/deluxe (what its own feature gates read). Anything the
 * operator paid for above `free` unlocks the deluxe features the relay can
 * actually serve — which is images, not speech: both model tables leave the
 * tts/stt slots null, because the default provider hosts no speech models.
 * Turning on a Text-to-Speech switch that every call would 404 on is worse
 * than leaving it off.
 */
export function pricingTierFor(relayTier) {
  return relayTier === 'patron' || relayTier === 'studio' ? 'deluxe' : 'free';
}

/** Does this relay tier get scene images? Speech is never relayed — see above. */
export function relayServesImages(relayTier) {
  return pricingTierFor(relayTier) === 'deluxe';
}

/**
 * Turn a relay probe into the verdict this app acts on.
 *
 *   { ok: true, tier, models, budget }
 *   { ok: false, reason: 'rejected'|'unreachable'|'not-a-relay'|'relay-off' }
 *
 * `relay-off` is the distinction worth making by hand. The probe reports such a
 * deployment as a success — correctly, the token IS valid and the campaign side
 * of it will work — but there is no inference behind it, so the honest next step
 * is "paste a provider key as well", not "your token is wrong". Every other
 * reason comes straight from the probe.
 *
 * An absent tier reads as `free`: the stingy direction is the safe one when the
 * deployment did not say.
 */
export function interpretProbe(probe) {
  // `=== true`, not truthiness: anything else came from a shape this app does
  // not understand, and reading "not obviously a no" as a yes is how a broken
  // probe turns into a table that cannot play.
  if (probe?.ok !== true) return { ok: false, reason: probe?.reason ?? 'rejected' };
  if (!probe.models) return { ok: false, reason: 'relay-off' };
  return {
    ok: true,
    tier: typeof probe.tier === 'string' ? probe.tier : 'free',
    models: probe.models,
    budget: probe.budget ?? null,
  };
}
