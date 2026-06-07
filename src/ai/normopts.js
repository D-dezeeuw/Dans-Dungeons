// src/ai/normopts.js — translate the app's historical snake_case per-call LLM
// override to the camelCase key the bag-of-holding-client API expects.
//
// CLAUDE.md documents `max_tokens` as the per-call cap (journal export uses
// 4000), and src/ai/* call sites pass it that way. The client library, however,
// destructures camelCase `maxTokens`; an unmapped `max_tokens` is silently
// ignored and the tier default applies instead (e.g. 4000 → 700, truncating the
// multi-chapter journal/EPUB into invalid JSON). The adapter (src/ai/client.js)
// runs every outbound opts object through this so the override actually lands in
// the request body. Kept dependency-free so it is unit-testable on its own.

export function normalizeLlmOpts(opts = {}) {
  if (opts == null || opts.max_tokens == null) return opts;
  const { max_tokens, ...rest } = opts;
  // An explicit camelCase `maxTokens` (should one ever be passed) wins.
  return { ...rest, maxTokens: rest.maxTokens ?? max_tokens };
}
