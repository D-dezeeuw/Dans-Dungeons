// tests/tenant-connect.test.js — the second way to pay for a turn.
//
// The wizard used to have one question with one right answer: an OpenRouter
// key. A player handed a tenant key by whoever hosts their table was asked for
// a credential they had no reason to own, and the one they DID own failed with
// an auth error, because it authenticates to a deployment rather than to a
// provider. These cases pin the parts of the fix that are pure: telling the two
// strings apart, what a tier buys, what each refusal means, and the two error
// statuses that mean something different on a hosted table than on a key.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  looksLikeTenantToken, looksLikeProviderKey, pricingTierFor, relayServesImages,
  interpretProbe, defaultTenantUrl,
} from '../src/ai/relay.js';
import { describeAiError } from '../src/ai/errors.js';
import { ApiError, emptyRelayBudget } from '../vendor/bag-of-holding-client/index.js';

const TOKEN = 'a3f2'.repeat(16);                 // 64 hex chars, as minted
const KEY = 'sk-or-v1-0123456789abcdef';

describe('telling the two credentials apart', () => {
  it('recognises a minted tenant token', () => {
    assert.equal(looksLikeTenantToken(TOKEN), true);
    assert.equal(looksLikeTenantToken(` ${TOKEN.toUpperCase()} `), true, 'case and padding are the player\'s, not ours');
  });

  it('does not mistake a provider key for one', () => {
    assert.equal(looksLikeTenantToken(KEY), false);
    assert.equal(looksLikeProviderKey(KEY), true);
    assert.equal(looksLikeProviderKey(TOKEN), false);
  });

  it('is unbothered by junk', () => {
    for (const junk of ['', '   ', null, undefined, 'hunter2', 'a'.repeat(63), 'z'.repeat(64)]) {
      assert.equal(looksLikeTenantToken(junk), false);
      assert.equal(looksLikeProviderKey(junk), false);
    }
  });

  // The shape test only chooses which check runs first. It must never be the
  // thing that decides a credential is valid — that is the deployment's job.
  it('a stock build offers no default deployment', () => {
    assert.equal(defaultTenantUrl(), null);
  });
});

describe('what a relay tier buys', () => {
  it('anything the operator paid for above free unlocks the deluxe features', () => {
    assert.equal(pricingTierFor('free'), 'free');
    assert.equal(pricingTierFor('patron'), 'deluxe');
    assert.equal(pricingTierFor('studio'), 'deluxe');
  });

  it('an unknown tier is never an upgrade', () => {
    for (const tier of [null, undefined, 'legendary', 'STUDIO']) {
      assert.equal(pricingTierFor(tier), 'free');
    }
  });

  it('images follow the tier; speech never does', () => {
    // Both model tables leave tts/stt null — the provider hosts no speech
    // models — so a relayed table must not offer switches that always 404.
    assert.equal(relayServesImages('studio'), true);
    assert.equal(relayServesImages('free'), false);
  });
});

describe('reading a probe', () => {
  it('adopts the tier and the models a live relay reports', () => {
    const budget = emptyRelayBudget({ tier: 'patron' });
    const live = interpretProbe({
      ok: true, tier: 'patron', models: { tiny: 'a/b', medium: 'c/d' }, budget,
    });
    assert.equal(live.ok, true);
    assert.equal(live.tier, 'patron');
    assert.deepEqual(live.models, { tiny: 'a/b', medium: 'c/d' });
    assert.equal(live.budget, budget);
  });

  it('separates "token is fine, this table sells no AI" from "wrong token"', () => {
    // A deployment with no provider key answers the probe successfully — the
    // token IS valid and the campaign side works — but there is no inference
    // behind it. The next step is a provider key, not a new token, and a player
    // cannot make that distinction from "that did not work".
    assert.deepEqual(interpretProbe({ ok: true, tier: 'free', models: null, budget: null }),
      { ok: false, reason: 'relay-off' });
    assert.deepEqual(interpretProbe({ ok: false, reason: 'rejected' }),
      { ok: false, reason: 'rejected' });
  });

  it('passes the probe\'s own reasons through', () => {
    for (const reason of ['unreachable', 'not-a-relay', 'rejected']) {
      assert.deepEqual(interpretProbe({ ok: false, reason }), { ok: false, reason });
    }
  });

  it('treats anything it cannot read as a refusal, not a connection', () => {
    for (const junk of [null, undefined, {}, { ok: 'yes' }]) {
      assert.deepEqual(interpretProbe(junk), { ok: false, reason: 'rejected' });
    }
  });

  it('a relay that names no tier is treated as free', () => {
    assert.equal(interpretProbe({ ok: true, models: { medium: 'a/b' } }).tier, 'free');
    assert.equal(interpretProbe({ ok: true, tier: 7, models: { medium: 'a/b' } }).tier, 'free');
  });
});

describe('a hosted table\'s refusals read differently', () => {
  it('402 from a relay is the table\'s allowance, not the player\'s wallet', () => {
    // "Top up your credit at openrouter.ai" is useless advice when it is not
    // your account — and this one refills on its own, which is the part worth
    // saying.
    const relay = new ApiError(402, JSON.stringify({
      error: { message: 'spent', type: 'budget_exhausted', resets_in_seconds: 3600 },
    }));
    assert.deepEqual(describeAiError(relay), { key: 'error.tableBudget', retryable: false, status: 402 });
  });

  it('402 from a provider is still the player\'s wallet', () => {
    assert.equal(describeAiError(new ApiError(402, 'insufficient credits')).key, 'error.credit');
  });

  it('503 from a relay with no provider key tells the player to bring a key', () => {
    const off = new ApiError(503, JSON.stringify({ error: { message: 'no', type: 'relay_unconfigured' } }));
    assert.deepEqual(describeAiError(off), { key: 'error.tableNoAi', retryable: false, status: 503 });
  });

  it('an ordinary 503 stays a retryable provider fault', () => {
    const fault = describeAiError(new ApiError(503, 'upstream overloaded'));
    assert.equal(fault.key, 'error.provider');
    assert.equal(fault.retryable, true);
  });

  it('a 400 model refusal is not confused with a budget refusal', () => {
    const refused = new ApiError(400, JSON.stringify({ error: { message: 'nope', type: 'model_not_allowed' } }));
    assert.equal(describeAiError(refused).key, 'error.badRequest');
  });
});
