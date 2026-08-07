// === Replay.share (since 2.0.0) ===
//
// Pin a solo session into a portable JSON object the host can ship
// to a teammate, attach to a bug report, or feed into a CI replay
// rig. The shape is intentionally tiny and stable — just the
// inputs needed to reproduce a session deterministically:
//
//   seed, rulesFingerprint, partyRecords, rollLog, (optional) log
//
// Anything else is derivable. The session's volatile state
// (current HP, slot counters, condition lists) is NOT in the share
// payload — those are reconstructable by replaying the rollLog
// against the same engine. A separate `Session.serialize` covers
// the "load my save and keep playing" path.
//
// `verifyLog` (already shipped) is the proof-of-reproducibility
// step; `share` is the wrapper that makes the payload portable.

const SHARE_VERSION = 'bag-of-holding/replay@1';

/**
 * Build a portable replay payload from a session.
 *
 * @param {object} session       A session created via Session.create.
 * @param {object} [opts]
 * @param {boolean} [opts.includeLog]   When true, the session's
 *   high-level event log rides alongside the dice. Default false:
 *   the dice log is enough to verify reproducibility, and skipping
 *   the narrative log keeps the payload small.
 */
export function share(session, { includeLog = false } = {}) {
  if (!session || !session.engine) {
    throw new Error('Replay.share: argument must be a Session created via Session.create');
  }
  const payload = {
    version: SHARE_VERSION,
    seed: session.seed,
    rulesFingerprint: session.engine.rulesFingerprint,
    partyRecords: session.party(),
    rollLog: [...session.engine.rollLog]
  };
  if (includeLog) payload.log = [...session.log];
  return payload;
}

/**
 * Verify a shared payload reproduces. Delegates to the engine's
 * `verifyLog`; surfaced here so consumers can do the obvious thing
 * — `Replay.verify(payload, engine)` — without reaching into the
 * shape.
 *
 * Up-front fingerprint check: if the payload was produced under a
 * different rule pack, the dice stream will diverge sometime
 * after the first knob-affected roll (crit range, damage floor,
 * exploding dice). Surfacing that at the boundary is friendlier
 * than letting `verifyLog` report a mid-stream divergence with no
 * hint that the *engine* was wrong, not the log.
 */
export function verify(payload, engine) {
  if (!payload || payload.version !== SHARE_VERSION) {
    throw new Error(`Replay.verify: unknown payload version '${payload?.version}'`);
  }
  if (typeof payload.seed !== 'number') {
    throw new Error('Replay.verify: payload.seed must be a number for verification');
  }
  if (payload.rulesFingerprint && engine.rulesFingerprint !== payload.rulesFingerprint) {
    return {
      ok: false,
      divergedAt: -1,
      expected: payload.rulesFingerprint,
      actual: engine.rulesFingerprint,
      reason: 'rulesFingerprint mismatch'
    };
  }
  return engine.verifyLog({ seed: payload.seed, log: payload.rollLog, rules: engine.rules });
}
