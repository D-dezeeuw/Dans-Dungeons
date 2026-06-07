import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// src/ai/client.js is an esbuild-aliased adapter (bare 'bag-of-holding-client'
// import) so it can't be imported under node --test. The fix's logic lives in a
// dependency-free helper that can: it maps the app's snake_case max_tokens to
// the library's camelCase maxTokens so per-call caps (e.g. the journal export's
// 4000) actually reach the request body instead of collapsing to the tier
// default. These cases lock that translation.
import { normalizeLlmOpts } from '../src/ai/normopts.js';

describe('normalizeLlmOpts — max_tokens → maxTokens', () => {
  it('translates the journal 4000 override', () => {
    assert.deepEqual(
      normalizeLlmOpts({ tier: 'medium', schema: {}, max_tokens: 4000 }),
      { tier: 'medium', schema: {}, maxTokens: 4000 },
    );
  });

  it('drops the snake_case key so it cannot leak unmapped to the request', () => {
    const r = normalizeLlmOpts({ max_tokens: 220 });
    assert.equal('max_tokens' in r, false);
    assert.equal(r.maxTokens, 220);
  });

  it('leaves opts without max_tokens untouched (same reference)', () => {
    const o = { tier: 'tiny', messages: [{ role: 'user', content: 'hi' }] };
    assert.equal(normalizeLlmOpts(o), o);
  });

  it('prefers an explicit camelCase maxTokens when both are present', () => {
    assert.deepEqual(normalizeLlmOpts({ max_tokens: 100, maxTokens: 4000 }), { maxTokens: 4000 });
  });

  it('handles missing / null opts', () => {
    assert.deepEqual(normalizeLlmOpts(), {});
    assert.equal(normalizeLlmOpts(null), null);
  });
});
