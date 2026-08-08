// src/core/tabs.js — one campaign, one tab.
//
// The save is a single localStorage key. Two tabs open on the game are two
// independent turn loops writing to it, and the last autosave wins: a player
// who opened a second tab to check something lost whatever the first tab had
// done since. Nothing warned them, and the damage was only visible on the next
// reload, by which point the history it overwrote was gone.
//
// This claims a lock for the tab that gets there first. The second tab is told
// it is a spectator and stops autosaving — it can still be read from, which is
// the thing people actually open a second tab for.
//
// Web Locks where available (Chrome, Edge, Safari 15.4+, Firefox 96+), a
// heartbeat in localStorage where it is not. Both degrade to "assume we are the
// only tab", because refusing to save is worse than a rare double-write.

const LOCK_NAME  = 'dans-dungeons-write';
const BEACON_KEY = 'dans-dungeons-tab';
const BEAT_MS    = 2000;
// Three missed beats. Two is within a long GC pause or a backgrounded tab's
// throttling; three means the tab is gone.
const STALE_MS   = BEAT_MS * 3;

let _isPrimary = true;
let _beat      = null;
const _listeners = new Set();

export function isPrimaryTab() { return _isPrimary; }

// Called with `false` the moment this tab loses (or never gets) the claim.
export function onPrimaryChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function setPrimary(v) {
  if (v === _isPrimary) return;
  _isPrimary = v;
  for (const fn of _listeners) { try { fn(v); } catch { /* a listener owns its errors */ } }
}

// A tab id that is unique per TAB, not per browser — two tabs must not agree.
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readBeacon() {
  try { return JSON.parse(localStorage.getItem(BEACON_KEY) ?? 'null'); } catch { return null; }
}

function writeBeacon() {
  try { localStorage.setItem(BEACON_KEY, JSON.stringify({ id: TAB_ID, at: Date.now() })); } catch { /* quota */ }
}

// The fallback claim: take the beacon if it is absent, ours, or stale.
function claimByBeacon() {
  const held = readBeacon();
  const fresh = held && Date.now() - (held.at ?? 0) < STALE_MS;
  if (fresh && held.id !== TAB_ID) return false;
  writeBeacon();
  return true;
}

// Start the claim. Idempotent; safe to call once at boot.
export function claimTab() {
  // Web Locks: the primary tab holds the lock for its whole lifetime, so a
  // second tab's request simply never resolves while the first is open, and
  // resolves the instant it closes — which is exactly the handover we want.
  if (navigator.locks?.request) {
    let settled = false;
    navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, () => {
      settled = true;
      setPrimary(true);
      // Held until the tab goes away. The promise never resolves on purpose.
      return new Promise(() => {});
    }).catch(() => { if (!settled) setPrimary(true); });

    // We do not know yet whether we won. Assume not, so a second tab cannot
    // autosave over the first in the moments before the lock is decided.
    navigator.locks.query?.().then((state) => {
      const held = (state?.held ?? []).some(l => l.name === LOCK_NAME);
      if (held && !settled) setPrimary(false);
    }).catch(() => { /* query is optional */ });
    return;
  }

  // No Web Locks: heartbeat.
  setPrimary(claimByBeacon());
  _beat = setInterval(() => {
    setPrimary(claimByBeacon());
  }, BEAT_MS);

  // Release promptly so a reload does not have to wait out STALE_MS.
  addEventListener('pagehide', releaseTab);
}

export function releaseTab() {
  if (_beat) { clearInterval(_beat); _beat = null; }
  try {
    const held = readBeacon();
    if (held?.id === TAB_ID) localStorage.removeItem(BEACON_KEY);
  } catch { /* nothing to do */ }
}
