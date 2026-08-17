// src/ai/errors.js — turn an AI transport failure into something a player can act on.
//
// Every non-401 failure used to collapse into one line: "The Game Master was not
// available. Try again when you are ready." That is a guess dressed as an
// explanation. A 402 means the player is out of credit and retrying will never
// work; a 429 means waiting is exactly right; a 403 means the model refused the
// content, and the player should rephrase. Telling them "try again" for all
// three wastes their time on the two where it cannot help.
//
// Pure and locale-driven: a status goes in, an { key, retryable } comes out and
// the caller resolves the string. No DOM, no state — testable directly.

// Parse the transport's error text. The library throws ApiError with a numeric
// `status`; older paths stringify it as "AI <status>: <body>", so both shapes
// are read rather than trusting one.
export function statusOf(err) {
  if (err == null) return null;
  if (typeof err.status === 'number') return err.status;
  const m = /^AI (\d{3})\b/.exec(String(err.message ?? err));
  return m ? Number(m[1]) : null;
}

// A request that never left the browser: no status, and a message that reads
// like a network or abort failure rather than a bug in our own code.
function isTransportFailure(err) {
  const msg = String(err?.message ?? err ?? '');
  return /abort|timed? ?out|network|failed to fetch|load failed|connection/i.test(msg);
}

// A hosted table's relay refuses with the same statuses a provider uses, but
// two of them mean something different and the difference is the whole point of
// telling the player anything: 402 is "your table's allowance for today is
// spent, and it refills" — not "top up your wallet", which the player cannot do
// because it is not their wallet. The relay names itself in the body (`type`),
// which the library carries through as `err.body`.
function relayType(err) {
  const body = String(err?.body ?? '');
  const m = /"type"\s*:\s*"([a-z_]+)"/.exec(body);
  return m ? m[1] : null;
}

// { key, retryable, status } for a failed AI call.
//   key       — i18n key under `error.*` naming cause AND next step
//   retryable — whether trying the same turn again could plausibly work
export function describeAiError(err) {
  const status = statusOf(err);
  const relay = relayType(err);

  // The table's token budget, not the player's credit. Retrying tomorrow works,
  // which makes this the one "not retryable now" that carries a promise.
  if (status === 402 && relay === 'budget_exhausted') {
    return { key: 'error.tableBudget', retryable: false, status };
  }
  // The deployment stopped relaying inference (or never did). Nothing the player
  // types fixes it; a provider key would.
  if (status === 503 && relay === 'relay_unconfigured') {
    return { key: 'error.tableNoAi', retryable: false, status };
  }

  switch (status) {
    // The key is wrong, expired, or revoked. Retrying is pointless until it changes.
    case 401: return { key: 'error.auth',        retryable: false, status };
    // Out of credit. Only the player's wallet fixes this.
    case 402: return { key: 'error.credit',      retryable: false, status };
    // The provider refused: moderation, a region block, or a model the key may
    // not use. Rephrasing or switching models is the move, not waiting.
    case 403: return { key: 'error.refused',     retryable: false, status };
    // A model id the provider no longer serves. The boot-time heal covers the
    // configured defaults; a custom id in settings is the player's to fix.
    case 404: return { key: 'error.noModel',     retryable: false, status };
    // Too much context. Shortening this turn's input genuinely helps.
    case 413: return { key: 'error.tooLong',     retryable: false, status };
    // Rate limited. Waiting is the correct and sufficient action.
    case 429: return { key: 'error.rateLimited', retryable: true,  status };
    default: break;
  }

  if (status != null && status >= 500) return { key: 'error.provider', retryable: true, status };
  if (status === 400)                  return { key: 'error.badRequest', retryable: false, status };
  if (isTransportFailure(err))         return { key: 'error.network',  retryable: true,  status: null };
  return { key: 'error.unknown', retryable: true, status };
}
