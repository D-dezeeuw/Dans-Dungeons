# 03 — Game loop & sessions

> **Status:** rough sketch.

## Chapter = D&D session

A *chapter* models a typical tabletop session: it opens with a short
"previously on…" recap, has a soft goal (visit the temple, escort the
merchant, clear the crypt), and ends at a natural cliffhanger or rest point.
Chapter boundaries are the **autosave checkpoints** the player will rewind to
when things go sideways.

A *campaign* is a sequence of chapters bound to one world and one party. The
red thread provides the high-level arc; chapters are how the GM paces it.

## The turn loop

A "turn" is one player input → one GM response. Internally:

```text
1. Player submits free-text input.
2. classifier agent  → intent type (talk / move / attack / skill /
                       inventory / meta) + structured args
3. game/dnd          → if intent needs rules: roll, check, apply effects
                       (deterministic, no AI)
4. narrator agent    → narrate the outcome, advance NPCs, reveal/hide info
5. loop              → commit resolved delta to Spektrum; append to transcript
6. (maybe) trigger   → chapter end? autosave + "end of chapter" beat
```

Steps 2 and 4 are AI calls; step 3 is pure JS. Splitting classification from
narration means the rules engine sees a *structured* action, which keeps the
GM from "narrating away" a failed roll.

## Resource and rule trust

When the AI narrates an outcome, it gets the **resolved facts** (you hit for
7, the orc is at 3 HP) — not free reign to invent damage. The narrator's job
is *style*, not arithmetic. This is what stops the classic "AI cheats" bug.

## GM override / meta channel

A slash-prefixed channel lets the player nudge the AI without breaking the
fiction. These are not in-character actions; they're conversations with the
system.

| Command | Purpose |
| --- | --- |
| `/note <text>` | Add a hidden note the GM should remember |
| `/seed <id>` | Plant a hook for the GM to weave in later |
| `/retcon <text>` | Explicitly revise an established fact (logged, not silent) |
| `/redo` | Undo the last turn (uses Spektrum history) |
| `/save` | Force an immediate export |
| `/show secrets` | Dev-only: reveal hidden state (gated behind a setting) |

These commands are first-class actions: they get their own action types in
Spektrum and appear in the transcript with distinct styling.

## Autosave & rewind

- **Per turn**: state is written to localStorage after every commit (cheap,
  Spektrum already has the delta).
- **Per chapter**: a snapshot is appended to the save's chapter history so the
  player can rewind to any chapter start.
- **Manual**: `/save` triggers `.dnd.json` export.

Rewinding more than one turn always lands on a chapter boundary — we don't
ship granular history scrubbing in v1, because mid-chapter rewinds are
expensive to re-narrate coherently.

## Pacing & interruption

The narrator may stream tokens; the player can hit `Esc` to interrupt long
narrations and respond before the GM finishes monologuing. Whatever was
already streamed becomes canon — we don't pretend it didn't happen.

If the player goes idle mid-chapter and returns later, the loop offers a
short "where you left off" reminder before accepting input.

## When does a chapter end?

Heuristics (the loop decides, narrator may suggest):

- A long rest is taken.
- A red-thread beat completes.
- The player explicitly types `/end-chapter`.
- A natural cliffhanger is detected by the narrator (rare; explicit is safer).
- Turn count exceeds a soft cap (default ~40) without a closure beat — the
  loop forces a rest scene.

## Failure handling

- AI call fails (network, schema, repair): show the error, keep the player's
  input editable, offer "retry" / "cancel".
- Player input is ambiguous: classifier returns `needs_clarification` and the
  GM asks a single clarifying question before resolving.
- Player tries an obviously impossible action: classifier marks it `infeasible`
  and the GM narrates the failure without spending a roll.

## Open

- Should we let the player roll their own dice physically and enter the
  result? (Toggle, default = auto-roll.)
- How to render simultaneous combat with NPC allies — separate turn cards or
  a single narrated block?
