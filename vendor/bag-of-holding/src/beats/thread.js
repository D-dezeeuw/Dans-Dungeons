import { validateBeat } from './schema.js';

/**
 * Validate every beat up front so a thread is either fully sound or
 * rejected — half-validated threads would silently fail later in
 * the run, far from the offending beat. The `<no id>` fallback in
 * the error message means an unidentifiable bad beat still produces
 * a usable diagnostic instead of `Invalid beat undefined:`.
 *
 * Since 0.8.0 the thread carries an index (id → position) for
 * O(1) successor lookups, plus an optional sub-thread stack so
 * a parent thread can spawn nested threads (side quests,
 * flashbacks) and walk back into itself when they complete.
 */
export function createThread(beats) {
  for (const beat of beats) {
    const { valid, errors } = validateBeat(beat);
    if (!valid) throw new Error(`Invalid beat ${beat?.id ?? '<no id>'}: ${errors.join(', ')}`);
  }
  const byId = {};
  for (let i = 0; i < beats.length; i++) byId[beats[i].id] = i;
  return { beats, currentIndex: 0, byId, stack: [] };
}

/**
 * The active beat. If a sub-thread is on the stack, the active beat
 * is the sub-thread's current beat — the parent thread waits.
 * Returns `null` past the end of every active thread.
 */
export function currentBeat(thread) {
  if (thread.stack && thread.stack.length > 0) {
    const top = thread.stack[thread.stack.length - 1];
    return currentBeat(top);
  }
  return thread.beats[thread.currentIndex] ?? null;
}

/**
 * Beat is ready when every prerequisite flag is set. We chain
 * through `state?.flags?.[flag]` so a half-built save (or a
 * test fixture) that omits the flags object still evaluates
 * cleanly to "not ready" instead of crashing.
 */
export function isReady(beat, state) {
  if (!beat) return false;
  return (beat.prerequisites ?? []).every(flag => state?.flags?.[flag] === true);
}

/**
 * A beat is complete when every flag it promises to set is in
 * state.
 */
export function isComplete(beat, state) {
  if (!beat) return false;
  return (beat.setRequiredFlags ?? []).every(flag => state?.flags?.[flag] === true);
}

/**
 * Step forward iff the current beat reports complete. Returns
 * `{ thread, advanced, reason?, finished? }`.
 *
 * **Branching (since 0.8.0):** when the current beat has a non-empty
 * `successors[]`, the runtime asks the optional `chooseSuccessor`
 * picker to select one. The picker receives the candidate successor
 * IDs (filtered by their own prerequisites against `state.flags`)
 * plus the current state, and returns one id. If `chooseSuccessor`
 * isn't passed, the first ready successor is taken — deterministic
 * default so authoring tools can preview a branch without wiring AI.
 *
 * **Linear fallback:** when the current beat has no `successors[]`,
 * the runtime advances to the next index in the array, preserving
 * 0.0.0 behaviour for old beat decks.
 */
export function advance(thread, state, { chooseSuccessor } = {}) {
  // Sub-thread takes precedence: if one is active, advance it and
  // pop when it finishes.
  if (thread.stack && thread.stack.length > 0) {
    const top = thread.stack[thread.stack.length - 1];
    const r = advance(top, state, { chooseSuccessor });
    const newStack = [...thread.stack];
    newStack[newStack.length - 1] = r.thread;
    let outThread = { ...thread, stack: newStack };
    if (r.finished) {
      // Pop the finished sub-thread.
      outThread = { ...outThread, stack: outThread.stack.slice(0, -1) };
    }
    return { thread: outThread, advanced: r.advanced, finished: false, reason: r.reason };
  }

  const beat = thread.beats[thread.currentIndex] ?? null;
  if (!beat) return { thread, advanced: false, reason: 'no current beat' };
  if (!isComplete(beat, state)) return { thread, advanced: false, reason: 'current beat not complete' };

  // Branching: if successors[] is non-empty, pick one by id.
  if (Array.isArray(beat.successors) && beat.successors.length > 0) {
    const candidates = beat.successors.filter((id) => {
      const idx = thread.byId[id];
      if (idx === undefined) return false;
      const candidate = thread.beats[idx];
      return isReady(candidate, state);
    });
    if (candidates.length === 0) {
      return { thread, advanced: false, reason: 'no ready successor' };
    }
    const pickedId = chooseSuccessor
      ? chooseSuccessor({ candidates, state, currentBeat: beat })
      : candidates[0];
    const nextIndex = thread.byId[pickedId];
    if (nextIndex === undefined) {
      return { thread, advanced: false, reason: `chooseSuccessor returned unknown id: ${pickedId}` };
    }
    return {
      thread: { ...thread, currentIndex: nextIndex },
      advanced: true,
      finished: false
    };
  }

  // Linear fallback.
  const nextIndex = thread.currentIndex + 1;
  const finished = nextIndex >= thread.beats.length;
  return {
    thread: { ...thread, currentIndex: nextIndex },
    advanced: true,
    finished
  };
}

/**
 * Push a sub-thread onto the parent's stack. Returns the new parent
 * thread. The sub-thread runs to completion, then auto-pops — the
 * loop calls `advance(parent, state)` and gets transparent dispatch
 * via the stack lookup in `currentBeat` and `advance`.
 */
export function pushSubThread(thread, beats) {
  const sub = createThread(beats);
  return { ...thread, stack: [...thread.stack, sub] };
}

/** Read-only depth of the sub-thread stack. 0 = no nested threads. */
export function subThreadDepth(thread) {
  return thread.stack.length;
}
