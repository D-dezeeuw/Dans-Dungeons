// src/game/undo.js — single-step "undo last turn" via Spektrum time-travel.
//
// A turn is bracketed by a mark: beginTurn() captures the pre-turn history index
// + the current play-context signature WITHOUT writing anything; finalizeTurn()
// registers it only AFTER the turn has fully committed (so a turn that throws
// mid-flight — e.g. an AI error — never leaves a dangling undo affordance).
// undoLastTurn() replays history to the last mark, reverting all appState the
// turn touched: room, NPCs, HP, transcript data, skill cooldowns, turn count.
//
// Spektrum's replay() re-fires every reactive binding against the rebuilt
// state, so the header stats (:innerHTML), action-bar word clouds (data-each),
// data-if visibility and the {{turn}} counter all refresh on their own. Only
// the two imperative surfaces — the transcript DOM and the compass — are
// redrawn here. The scene sketch lives in localStorage (not appState/history),
// so it is intentionally left untouched.
//
// CONTEXT SCOPING — undo must never replay across a world swap. The game
// rewrites appState.world wholesale on dungeon/settlement transitions and around
// transient overworld encounters; replaying a stale dungeon mark from a town
// would wipe accumulated progress and persist a desynced world. Two safeguards:
//   1. No marks are taken inside encounters (the world is swapped out there).
//   2. Each mark carries a context signature (location type + dungeon/settlement
//      id); undo refuses and drops the stale marks if the signature no longer
//      matches. enterDungeon()/renderSettlement() also clear marks on entry so
//      the button hides promptly. Marks are in-memory only, so a reload starts
//      clean and an undo can never cross a game boundary into stale history.

import { appState, setValue, replay, checkpoint, spektrumHistory, saveToStorage } from '../core/state.js';
import { rebuildTranscript } from '../ui/transcript.js';
import { updateActionBar }   from '../ui/actionbar.js';

// Pending marks for the current play context: { index, sig }. Top = most recent.
const _marks = [];

// Signature of the current undoable play context. Room moves within one dungeon
// keep this stable (only location, not currentRoom, is included), so undo works
// across a move; any world swap (dungeon↔settlement, into/out of an encounter)
// changes it.
function contextSig() {
  const loc = appState.world?.location ?? {};
  return `${loc.type ?? ''}|${loc.dungeonId ?? ''}|${loc.settlementId ?? ''}`;
}

// Capture the pre-turn state pointer without side effects. Returns a pending
// mark, or null when undo doesn't apply to this turn (transient encounters).
export function beginTurn() {
  if (appState.world?.location?.type === 'encounter') return null;
  return { index: spektrumHistory.length, sig: contextSig() };
}

// Register the mark — call ONLY after the turn has committed. A no-op for the
// null mark from beginTurn(), so encounter turns and pre-commit throws register
// nothing.
export function finalizeTurn(mark) {
  if (!mark) return;
  _marks.push(mark);
  checkpoint('turn');
  setValue('ui.canUndo', true);
}

// Roll back the most recent marked turn. Returns false when nothing is undoable.
// Refuses to run mid-turn (the command input is disabled while a turn is being
// processed — replaying then would race the in-flight commit) and refuses (then
// drops the now-stale marks) if the play context changed since the mark.
export function undoLastTurn() {
  if (!_marks.length) return false;
  if (document.getElementById('cmd')?.disabled) return false;
  if (_marks[_marks.length - 1].sig !== contextSig()) { clearTurnMarks(); return false; }
  const mark = _marks.pop();
  replay(mark.index);                        // reactive bindings re-fire automatically
  rebuildTranscript();                       // transcript DOM is imperative — redraw it
  redrawCompass();                           // compass is imperative — redraw for the reverted room
  setValue('ui.canUndo', _marks.length > 0);
  saveToStorage();
  return true;
}

// Forget every mark (new game, or a play-context transition). Hides the button.
export function clearTurnMarks() {
  _marks.length = 0;
  setValue('ui.canUndo', false);
}

function redrawCompass() {
  if (!appState.settings?.actionBar) return;
  const roomId = appState.world?.currentRoom;
  const exits  = appState.world?.rooms?.[roomId]?.exits ?? [];
  updateActionBar(exits);
}

// Wire the input-row undo button. Called once during boot (like initMicButton).
export function initUndoButton() {
  const btn = document.getElementById('undo-btn');
  if (btn) btn.addEventListener('click', () => undoLastTurn());
}
