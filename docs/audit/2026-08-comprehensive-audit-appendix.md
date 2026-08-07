# Comprehensive Audit — Appendix: full findings, evidence, and recommendations

> Companion to [`2026-08-comprehensive-audit.md`](2026-08-comprehensive-audit.md)
> (read that first — it is the synthesis; this file is the complete evidence base).
> Fourteen sections: one per audit agent (13 dimensions + the completeness critic).
> Each section carries the auditor's executive summary, verified strengths, all
> findings sorted by severity with `file:line` evidence (independent verification
> verdicts inlined where a claim was adversarially re-checked), prioritized
> recommendations with illustrative code snippets, and collected metrics.
> Severity: **critical** = breaks play / data loss / blocks the 80h goal ·
> **high** = significant player-facing or architectural problem · **medium** = real
> but bounded · **low** = polish. Priority: P0 fix now → P3 someday.
> Nothing here modifies code; snippets are recommendations only.

---

## 1. Game Logic — turn engine, resolver, flow, worldgen wiring

> Auditor: `game-logic` · strengths 6 · findings 19 · recommendations 14

The micro-architecture of the turn engine is genuinely better than the owner's "inconsistent mess" self-assessment suggests. The classify→resolve→narrate→commit pipeline in loop.js is properly atomic: the scene is snapshotted before mutation, all dice and state deltas are computed pure, and nothing is committed until narration succeeds — a failed AI call discards the whole turn, the undo mark is finalized only post-commit (loop.js:95-99,164), and the seeded RNG cursor lives inside Spektrum state so undo/redo replays exact dice (rng.js). Input concurrency is handled correctly (single pending prompt promise, input disabled during a turn, undo refuses while input is disabled). D&D math is almost entirely delegated to bag-of-holding (attack/damage/checks/death-saves including auto-crit-while-down and massive-damage rules), so resolver.js duplicates very little. The dungeon generator (in bag-of-holding-client, content-injected from world.js) guarantees solvable lock-and-key layouts and depth-scales enemy CR.

The macro picture is where the 80-hour goal falls apart. First, the deterministic action space is a thin crust: only 5 of the classifier's 14 intents (attack, skill, move, take, unlock) resolve to mechanics; rest/talk/look/travel/buy/inventory/wait in a dungeon return a bare {intent} and the narrator improvises unverified fiction — the exact "always falls back on deterministic systems" promise is not kept, and skill checks themselves have no mechanical consequence beyond a cooldown. Second, nothing persists or progresses: XP is never awarded and level is frozen at 1 forever, purchased items are inert, casters have no spells, dungeon interiors are never written back to world.dungeons (re-entering a cleared dungeon resurrects everything), and campaign death calls clearSave(), wiping an LLM-generated world. Third, I found one save-bricking defect: a save written mid-travel-encounter (autosaved every turn) resumes into a dead-end where playLoop's victory path returns to no caller, leaving the game with no active prompt on every subsequent reload.

Structurally, flow.js is a 1,539-line god module (39% of src/game) mixing lifecycle FSM, settlement shops, NPC dialogue, travel, encounters, and end states, with whole-world setValue spreads that contradict the narrow-path discipline documented in resolver.js/story.js. And although npm test reports 267 green tests, the core turn modules (loop.js, resolver.js, flow.js, world.js) have zero direct coverage — several test files explicitly test hand-copied reimplementations because the real modules are welded to the Spektrum singleton and i18n/localStorage at import time. Transcript and rollLog are re-written as full arrays every turn, so recorded history grows O(n²) in bytes and the persisted undo epoch silently drops after ~60-70 turns (MAX_TT_ENTRIES 500) — fine for the current 30-minute dungeon crawl, not for 80 hours in a 5MB localStorage budget.

### 1.1 What is genuinely good

- **Atomic turn pipeline with correct failure semantics** — processTurn snapshots the scene pre-mutation, resolves pure, and commits nothing until narrate() returns; a throw anywhere before commitAll discards the turn cleanly, and the undo mark is registered only after full commit ('a throw above never reaches here'). Retry re-runs from the same RNG cursor so dice remain a deterministic function of the choice sequence. No double-commit or partial-commit path exists in the happy pipeline. — evidence: `Dans-Dungeons/src/game/loop.js:91-168`, `Dans-Dungeons/src/game/loop.js:95-99`, `Dans-Dungeons/src/game/undo.js:96-123`
- **Seeded, auditable, replayable combat RNG** — session.rng {seed, cursor} and session.rollLog live inside Spektrum state, so undo restores exact RNG position; commitRoller advances the cursor by exactly the draws consumed; verifyLog replays the whole epoch from seed ('the dice were honest' button in main.js). This is a genuinely strong foundation for deterministic open play. — evidence: `Dans-Dungeons/src/game/rng.js:28-121`, `Dans-Dungeons/src/main.js:74-80`
- **Real delegation to the rules engine, minimal duplication** — resolver.js rolls everything through engine.Combat/Checks (attackRoll, damageRoll, abilityCheck, deathSave, applyDamageWhileDown, reviveTo, freshDeathSaves); the engine supplies SRD-correct auto-crit-on-downed (2 failures), massive-damage instant death, nat-20 revive, and DC clamping. character.js re-derives the sheet from the record on every load ('never trust the persisted sheet'). — evidence: `Dans-Dungeons/src/game/resolver.js:178-224`, `bag-of-holding/src/combat.js:306-395`, `bag-of-holding/src/checks.js:28-50`, `Dans-Dungeons/src/main.js:157-160`
- **Solvable dungeon generation with content/algorithm separation** — The client-lib generator guarantees the gate key is always reachable before the gate (branch pre-gate, else forced onto the pre-gate spine), scales enemy CR by depth, and places the boss in the vault; world.js injects only i18n descriptors and bestiary stat blocks. 24 themed overlays x 66 SRD + 20 custom monsters give decent variety per dungeon. — evidence: `bag-of-holding-client/src/dungeon/generate.js:199-243`, `Dans-Dungeons/src/game/world.js:27-57`, `Dans-Dungeons/src/game/bestiary.js:20`
- **Input concurrency and undo guards are correct** — prompt() holds a single pending resolve; _submit disables the input before resolving, so rapid re-entry during processTurn is impossible; chips fire only into a pending prompt; undo/redo/jump refuse while the input is disabled and refuse across context-signature changes, so a scrub can never race an in-flight commit or replay across a world swap. — evidence: `Dans-Dungeons/src/ui/input.js:68-127`, `Dans-Dungeons/src/game/undo.js:129-158`
- **Deterministic fallbacks where they were actually built** — Settlement classification has a bilingual keyword fallback so towns stay playable offline; travel narration falls back to templated locale lines; the down-turn (death saves) is fully deterministic with zero AI calls; victory/defeat are derived from state, never from the narrator's opinion. — evidence: `Dans-Dungeons/src/game/flow.js:643-658`, `Dans-Dungeons/src/game/flow.js:948-960`, `Dans-Dungeons/src/game/loop.js:185-212`

### 1.2 Findings

#### 1.2.1 [CRITICAL · defect] Save written mid-travel-encounter resumes into a dead end (soft-bricked save)

runEncounter swaps world.currentRoom/rooms/npcs/location for a transient 'encounter' room, keeping the real fields only in an in-memory snapshot (flow.js:967-987); processTurn commits (autosaves) every encounter turn (loop.js:165), persisting location.type='encounter'. On reload, resumeGame routes anything non-settlement into playLoop (flow.js:1533-1538). The player wins the fight, playLoop's victory gate fires (currentRoom===exitRoomId==='encounter'), the campaign branch requires location.type==='dungeon' so it falls through to doVictory(); doVictory sees location.settlementId, saves, and returns WITHOUT setting game-over (flow.js:1476-1479), playLoop breaks, resumeGame returns, boot ends — no loop is running and the input was left disabled by the last _submit. Every subsequent reload replays the same dead end (the enemy is already dead, so victory fires immediately). The in-memory snapshot is gone, so the swapped-out world fields are never restored either.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:964-1042`, `Dans-Dungeons/src/game/flow.js:975-987`, `Dans-Dungeons/src/game/flow.js:1287-1308`, `Dans-Dungeons/src/game/flow.js:1465-1485`, `Dans-Dungeons/src/game/flow.js:1532-1538`, `Dans-Dungeons/src/game/loop.js:165`
- **Impact:** Closing the tab during any overworld encounter (routine in long sessions) leaves a save that can never be played again without manually clearing localStorage or importing a file — data loss from the player's perspective.
- **Independent verification: CONFIRMED** — I traced the full path and every load-bearing detail is accurate. (1) runEncounter keeps the real world fields only in a local `snap` variable and swaps in currentRoom=exitRoomId='encounter', location.type='encounter' while retaining settlementId (flow.js:967-987; enterSettlement sets settlementId at flow.js:417). (2) Encounter turns call processTurn (flow.js:1020) which ends with commit() (loop.js:165) = tick+saveToStorage (state.js:203), persisting the encounter world after the first combat turn. (3) On reload, boot (main.js:217) → resumeGame routes locType 'encounter' (non-settlement) into playLoop (flow.js:1533-1537) — the dev comment at flow.js:979-981 shows this was intended, but the aftermath was never wired. (4) After the enemy dies (buildEnemy sets attitude 'hostile'/alive, world.js:60-74, so vaultGuarded holds until then), the campaign branch requires location.type==='dungeon' (flow.js:1294), falls to doVictory()+break (flow.js:1307-1308); doVictory sees location.settlementId, saves, returns without setting game-over (flow.js:1476-1479); playLoop breaks, resumeGame returns, boot ends — no loop running, input left disabled by the last _submit (input.js:81; only prompt() re-enables, input.js:125). (5) Every later reload replays the dead end immediately (enemy dead → gate fires before any prompt). I also verified the escape hatches the claim implies are absent, truly are: /restart is only reachable inside a loop's prompt consumer (flow.js:1383/1004→250; typing into the inert input just clears it, input.js:78-83), and the undo/timeline system cannot rescue the save — beginTurn takes no marks inside encounters (undo.js:97), undo refuses while cmd is disabled or on context-signature mismatch (undo.js:131-132), and importTimeTravel's matchesSaved guard discards stale pre-encounter history on reload (undo.js:414-417, 433-438). Dying in the reloaded encounter leads to doDefeat→/restart→clearSave (flow.js:1505), destroying the save outright.

#### 1.2.2 [CRITICAL · gap] No progression: XP never awarded, level frozen at 1

record.xp is initialised to 0 (character.js:106) and record.level to 1 (character.js:94); a grep across src/ shows no code ever adds XP or increments level — the vendor XP module is re-exported (rules.js:14) but has zero call sites. describePC branches on levels up to 'legendary' (flow.js:1202-1206) that are unreachable. Kills, dungeon clears and quests award gold/reputation only.

- **Evidence:** `Dans-Dungeons/src/game/character.js:94-106`, `Dans-Dungeons/src/game/rules.js:14`, `Dans-Dungeons/src/game/flow.js:1202-1206`
- **Impact:** An 80-hour campaign with a permanently level-1 character and no mechanical growth loop is unplayable as designed; the entire engine-side XP/level system is dead weight.

#### 1.2.3 [HIGH · defect] Dungeon interior state is never written back — re-entry resets everything

enterDungeon copies the stored entry's rooms/npcs into the flat world fields (flow.js:1172-1179), and commitAll writes combat/loot deltas only to world.npcs/world.rooms (resolver.js:252-281). Nothing ever syncs those flat fields back into world.dungeons[id] — the only write-back is completed:true on victory (flow.js:1296-1300). Travelling to the same dungeon exit again reuses the stored entry with all enemies alive, all loot untaken, and currentRoom reset. Additionally, when a settlement exit's targetId is null (allowed by SETTLEMENT_SCHEMA: type ['string','null'], bag-of-holding-client/src/worldgen/schemas.js:180), enterDungeon mints dungeonId = `dungeon-${Date.now()}` (flow.js:1154), so the 'same' named dungeon generates fresh on every visit and dead entries accumulate in world.dungeons forever.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1152-1184`, `Dans-Dungeons/src/game/resolver.js:252-281`, `Dans-Dungeons/src/game/flow.js:1294-1301`, `bag-of-holding-client/src/worldgen/schemas.js:177-183`
- **Impact:** The world is not coherent: cleared dungeons respawn (infinite treasure farming, boss resurrection), directly contradicting the persistent-open-world goal.

#### 1.2.4 [HIGH · gap] 9 of 14 classifier intents fall through to nothing — narrator improvises unverified fiction

CLASSIFIER_SCHEMA enumerates 14 intents (schemas.js:13) but resolveRules handles only attack/skill/move/take/unlock; everything else returns bare `{ intent }` (resolver.js:126-127). For 'rest' in a dungeon the narrator receives resolved: {intent:'rest'} with no facts and will happily narrate a restorative nap while HP is unchanged; 'talk' has no dungeon dialogue mechanic; there is no 'use item' / 'equip' / 'drop' intent at all, so purchased potions and picked-up loot are permanently inert. The narrator prompt constrains dice and the 'impossible' intent but says nothing about these bare intents (en.json narratorPrompt).

- **Evidence:** `Dans-Dungeons/src/ai/schemas.js:8-23`, `Dans-Dungeons/src/game/resolver.js:126-127`, `Dans-Dungeons/src/game/flow.js:800-808`
- **Impact:** Narrative and mechanical state diverge exactly where the owner's stated principle ('truly open play that always falls back on deterministic systems') requires them not to; players learn that half their verbs are placebo.

#### 1.2.5 [HIGH · defect] Campaign death wipes the entire save (clearSave on the only exit path)

doDefeat sets phase game-over and awaitRestart's only exit is '/restart' → clearSave(); location.reload() (flow.js:1487-1510). In campaign mode this deletes a world built from ~5 medium-tier LLM calls (world seed, factions, beats, region, settlement) plus all quests, reputation, discovered regions and dialogue memory. There is no corpse-run, no wake-in-town, no 'load last save' (the autosave IS the save being cleared).

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1487-1510`, `Dans-Dungeons/src/game/flow.js:333-394`
- **Impact:** One bad death-save streak erases dozens of hours and real API spend; for an 80h campaign this is an unacceptable loss model (and doubly harsh given healing barely exists in dungeons).

#### 1.2.6 [HIGH · risk] O(n^2) recorded-state growth: transcript and rollLog rewritten as full arrays every turn

appendTranscript does setValue('transcript', [...(appState.transcript ?? []), ...2 entries]) (resolver.js:299-306) and commitRoller does setValue('session.rollLog', [...prev, ...roller.log]) (rng.js:120), so every Spektrum history entry (and every persisted time-travel spine entry, and every branch copy) contains a complete copy of the ever-growing array. undo.js's own labelFork confirms entries carry the full array (undo.js:219-227). The persisted epoch is capped at MAX_TT_ENTRIES=500 (~60-70 turns at ~7-9 entries/turn), after which saves silently drop undo history (undo.js:82,373-375); the base save itself grows linearly toward the ~5MB localStorage quota, and saveEnvelope failure is only a console.warn (state.js:169-173).

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:299-306`, `Dans-Dungeons/src/game/rng.js:116-121`, `Dans-Dungeons/src/game/undo.js:73-82`, `Dans-Dungeons/src/game/undo.js:368-375`, `Dans-Dungeons/src/core/state.js:169-173`
- **Impact:** Memory and save-blob size grow quadratically with turns inside an epoch and linearly forever across the game; at 80h scale the undo feature silently dies first, then saves start failing with only a console warning — invisible data loss.

#### 1.2.7 [HIGH · debt] Core turn modules have zero direct test coverage; existing tests verify hand-copied reimplementations

No test imports src/game/loop.js, resolver.js, flow.js, world.js, rng.js or story.js. tests/worldgen/resolver-settlement.test.js says 'without importing the actual module (which depends on Spektrum). We test the resolution logic in isolation' and then re-implements the resolver inside the test file; tests/worldgen/dungeon.test.js says 'Can't import world.js directly (needs localStorage + i18n)' and asserts against a hand-written literal; tests/seeded-rolls.test.js imports the vendor engine, not src/game/rng.js. The cause is architectural: every game module imports the live Spektrum singleton (resolver.js:7, loop.js:11, flow.js:6) and reads appState globally instead of receiving state.

- **Evidence:** `Dans-Dungeons/tests/worldgen/resolver-settlement.test.js:4-6`, `Dans-Dungeons/tests/worldgen/dungeon.test.js:4-5`, `Dans-Dungeons/tests/seeded-rolls.test.js:13`, `Dans-Dungeons/src/game/resolver.js:7`
- **Impact:** The 267 green tests validate copies that can silently drift from the real code; the actual turn pipeline — the highest-risk logic in the game — can regress with the suite fully green.

#### 1.2.8 [MEDIUM · gap] Attack always uses sheet.attacks[0]; the UI offers weapon choices the resolver cannot honor

resolveRules picks `sheet.attacks?.[0]` unconditionally (resolver.js:29) and CLASSIFIER_SCHEMA has no weapon field, yet _collectChipValues pushes an 'attack with {name}' chip per attack (flow.js:1261-1263) — a rogue with shortsword+dagger clicking 'Attack with dagger' still swings the shortsword. The classifier likewise cannot express which of several targets ('attack the skeleton, not the goblin' relies on the tiny model emitting the right npc id; there is no name-based fallback lookup — a name instead of id yields 'No valid target', resolver.js:25-27).

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:25-35`, `Dans-Dungeons/src/game/flow.js:1261-1263`, `Dans-Dungeons/src/ai/schemas.js:8-23`
- **Impact:** Player choices visibly offered by the UI are silently ignored; mis-ID'd targets from the tiny model turn valid attacks into 'impossible' turns that still trigger enemy retaliation.

#### 1.2.9 [MEDIUM · gap] Skill checks have no mechanical consequence

A resolved 'skill' intent returns roll facts (resolver.js:64-80) and commitAll's only skill effect is setting a 3-turn cooldown (resolver.js:242); success/failure changes nothing — no stealth avoiding retaliation (goblinRetaliates fires on 'skill' turns regardless, loop.js:121), no perception revealing loot, no persuasion changing attitude. The DC itself comes from the tiny-tier classifier ('suggest a dc between 10 and 20'), only sanity-bounded by the engine's clampDC.

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:64-80`, `Dans-Dungeons/src/game/resolver.js:237-243`, `Dans-Dungeons/src/game/loop.js:121-125`, `bag-of-holding/src/checks.js:28-30`
- **Impact:** Half the action bar (skill chips) is cosmetic dice theater; open play cannot route through skills because they cannot cause outcomes.

#### 1.2.10 [MEDIUM · gap] Casters have no spells and the fixed standard array is misassigned per class

STANDARD_ARRAY is applied in fixed order str15/dex14/con13/int12/wis10/cha8 for every class (character.js:52,95-102) — a wizard gets STR 15, INT 12; a cleric WIS 10. The engine ships spellcasting.js and SRD.spells but nothing in the game uses them; CLASS_EQUIPMENT gives the wizard only a quarterstaff (character.js:48). Cleric/wizard are strictly worse fighters. Species/backgrounds are enumerated from real SRD data (good), but there is no ability-score choice, no validation beyond pickFrom, and the wizard defaults advertised in the module map ('expand in Phase 7') are still four classes.

- **Evidence:** `Dans-Dungeons/src/game/character.js:41-52`, `Dans-Dungeons/src/game/character.js:88-111`, `bag-of-holding/src/spellcasting.js:1`
- **Impact:** SRD fidelity is shallow where it is most visible: class identity. Two of four starter classes lack their defining mechanic, undermining the AAA-D&D framing.

#### 1.2.11 [MEDIUM · inconsistency] Clearing any dungeon completes ALL active quests, whatever they were about

resolveDungeonQuests marks every active quest completed and rewards each quest-giver's faction +15 on any dungeon victory (flow.js:841-855, called from the playLoop victory path at flow.js:1303). Quests carry no target: makeQuest links only npc/faction. Accepting three unrelated tasks in town and clearing one random cave completes all three.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:841-855`, `Dans-Dungeons/src/game/flow.js:1303`
- **Impact:** Quests cannot function as an open-world structure; the red-thread beat system built on quest-done flags advances on false premises.

#### 1.2.12 [MEDIUM · defect] Retry policy is inverted: transient 5xx/network errors never retried, deterministic 4xx retried three times

The playLoop retry loop breaks immediately unless the error message matches /^AI 4\d\d:/ (flow.js:1422: 'if (!/^AI 4\d\d:/.test(e.message) || attempt === RETRY_DELAYS.length) break;'). So a 502/503 or a network hiccup — the classic retryable cases — fails the turn instantly, while a 400 Bad Request (deterministic) burns all three backoff retries. Only 4xx failures get the 'Retry' chip (pendingRetry, flow.js:1433-1435).

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1400-1424`, `Dans-Dungeons/src/game/flow.js:1426-1440`
- **Impact:** Exactly the errors most likely during long sessions (provider blips) cost the player their typed action with no automatic recovery.

#### 1.2.13 [MEDIUM · gap] No way to leave a dungeon; combat model cannot scale past one static enemy

playLoop's only exits are victory, death, or phase change (flow.js:1281-1314) — there is no retreat/exit-dungeon action ('travel' in a dungeon is a bare intent). goblinRetaliates lets exactly one hostile act (hostiles[0], resolver.js:138) with no initiative, NPCs never move between rooms, and the engine's condition-based advantage/disadvantage machinery is bypassed because the resolver passes only {attackBonus, ac} (resolver.js:37,142 vs bag-of-holding/src/combat.js:32-46 which accepts attacker/target for stance).

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1277-1314`, `Dans-Dungeons/src/game/resolver.js:132-142`, `bag-of-holding/src/combat.js:32-46`
- **Impact:** Dungeons are one-way corridors of 1v1 turret fights; encounter variety needed for tens of hours (packs, tactics, conditions, fleeing) has no mechanical substrate yet, even though the engine supports much of it.

#### 1.2.14 [MEDIUM · inconsistency] Town play bypasses the transcript, turn counter, and journal

Settlement interactions (dialogue, shops, rest, quests) write to the DOM via UI.appendEntry only — appState.transcript gains nothing except recordOpening's banner (flow.js:50-55,423-450, converseWithNpc 690-752). journalLog is only pushed in beginAdventure and playLoop (flow.js:1235-1236,1448-1449), so the EPUB journal of a campaign contains dungeon turns only; resumeGame's 'last 6 transcript entries' replay (flow.js:1518-1522) shows stale dungeon lines after a long town session; session.turnCount does not advance in town.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:690-752`, `Dans-Dungeons/src/game/flow.js:1235-1236`, `Dans-Dungeons/src/game/flow.js:1448-1449`, `Dans-Dungeons/src/game/flow.js:1514-1522`
- **Impact:** Half the campaign (the settlement half) is invisible to resume, export, undo and the story systems — the two halves of the game do not share one record of what happened.

#### 1.2.15 [MEDIUM · debt] flow.js is a 1,539-line god module that violates its own state-write discipline

flow.js holds the lifecycle FSM, key/tier setup, meta commands, settlement rendering + loop + chips, NPC dialogue, shop, rest, quests, region map, story view, overworld travel, encounters, discoveries, lazy region gen, dungeon entry, autoplay nav hints, the play loop, end states and resume — 39% of src/game LoC. It routinely rewrites the whole world object (`setValue('world', { ...appState.world, ... })` at flow.js:417, 687, 702, 847, 890, 976, 1036, 1140, 1165, 1172) while resolver.js:245-249 and story.js:8-13 document narrow sub-path writes as the required pattern for keeping history entries small.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1-27`, `Dans-Dungeons/src/game/flow.js:417`, `Dans-Dungeons/src/game/flow.js:687`, `Dans-Dungeons/src/game/resolver.js:245-249`
- **Impact:** Every town action records a full-world copy into Spektrum history (memory bloat, and giant fork tails if a mark were active); the module is effectively unreviewable and untestable as a unit, and is where most of the audit's defects live.

#### 1.2.16 [MEDIUM · gap] One dungeonTheme per world: every campaign dungeon shares the same 5 enemies

The world blueprint carries a single dungeonTheme; enterDungeon passes appState.world.blueprint into createDungeonEntry (flow.js:1158-1163), so every dungeon in a campaign resolves the same overlay pool (generate.js:134,220). The overworldEncounterPool comment claims climate/theme mixing ('plus the lower-CR creatures of the world's dungeon theme') but the code returns the static base pool unchanged (flow.js:906-909). Separately, createDungeonEntry's fallback DUNGEON_THEMES list ('undead','goblin',...) does not match any DUNGEON_OVERLAYS key ('undead crypt','goblin warren',...) so the fallback theme is description-only vocabulary drift (world.js:79-92).

- **Evidence:** `Dans-Dungeons/src/game/flow.js:906-909`, `Dans-Dungeons/src/game/flow.js:1156-1163`, `Dans-Dungeons/src/game/world.js:79-92`, `bag-of-holding-client/src/dungeon/generate.js:134`
- **Impact:** Content monotony compounds over a long campaign: same five monsters, same atmosphere line in every dungeon, undermining the 24-overlay variety that already exists in the library.

#### 1.2.17 [LOW · defect] 'take' with multiple items and no target reports 'Nothing to take here'

resolver.js:111 resolves an untargeted take only when exactly one loot item remains (`loot.length === 1 ? loot[0] : null`); with two items present, a vague 'grab the loot' returns impossible with reason 'Nothing to take here.' — factually wrong and passed to the narrator as truth.

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:108-114`
- **Impact:** The GM tells the player there is nothing to take while the room listing shows items — small but immersion-breaking contradiction.

#### 1.2.18 [LOW · debt] Narrator schema demands fields nobody reads; dead state fields

NARRATOR_SCHEMA requires combat_ended and outcome ('continue'|'victory'|'defeat'|'flee') (schemas.js:96-105) but no game code consumes either — only narratorResp.narration is used (loop.js:134-145); grep finds zero readers. session.chapterId is initialised to 'ch-1' (state.js:42) and never read or written again; top-level `flags` likewise. The resolver's returned profBonus for skill checks ignores expertise doubling that the actual roll used (resolver.js:71-79), so the debug panel can display a bonus that disagrees with the total.

- **Evidence:** `Dans-Dungeons/src/ai/schemas.js:96-105`, `Dans-Dungeons/src/game/loop.js:134-145`, `Dans-Dungeons/src/core/state.js:42`, `Dans-Dungeons/src/game/resolver.js:71-79`
- **Impact:** Wasted output tokens every turn, an implied narrator authority that does not exist, and misleading vestigial fields for future maintainers.

#### 1.2.19 [LOW · risk] Per-turn cost/latency stacks a hidden third AI call in campaigns

A campaign dungeon turn is: classify (tiny) → narrate (medium, streamed) → checkBeatFulfilled (tiny, awaited before the turn finalizes, loop.js:160-181) → optional image. The beat check blocks finalizeTurn/commit and the next prompt even though narration already rendered. Autoplay adds a fourth call per turn. Nothing batches or skips the beat check when the narration obviously cannot fulfil the beat.

- **Evidence:** `Dans-Dungeons/src/game/loop.js:160-181`, `Dans-Dungeons/src/game/flow.js:1336-1377`
- **Impact:** At 80h scale (thousands of turns) this is 50% more tiny-tier calls than necessary and a per-turn latency tail; bounded today but the pattern (every subsystem adds its own awaited per-turn call) will not scale.

### 1.3 Recommendations

#### 1.3.1 [P0 · effort S] Make encounters resume-safe (fix the bricked-save path)

This is the one reproducible way a player loses a campaign through no fault of their own. Two small changes close it: never persist location.type='encounter' (restore the snapshot fields before commit inside processTurn's save, or store snap in state), and make resumeGame detect a leftover encounter and route back to the settlement. A regression test via a stubbed save blob should pin it.

```js
// flow.js resumeGame():
const loc = appState.world?.location;
if (loc?.type === 'encounter' && loc.settlementId) {
  // abandon the transient combat shell; the real world lives in dungeons/settlements
  setValue('world', { ...appState.world, currentRoom: null, rooms: {}, npcs: {},
    location: { ...loc, type: 'settlement' } });
  commit();
  await enterSettlement(loc.settlementId);
  return;
}
```

#### 1.3.2 [P0 · effort S] Persist dungeon interiors: write flat world state back into world.dungeons on every dungeon commit or on exit

Without write-back the open world resets behind the player. Cheapest fix: in doTravel after enterDungeon returns (and in the victory path), copy the flat fields back into the entry; also derive stable dungeon ids from the exit name when targetId is null so revisits hit the same entry.

```js
// flow.js, after playLoop returns from a dungeon:
const did = appState.world.location.dungeonId;
if (did && appState.world.dungeons?.[did]) {
  const d = appState.world.dungeons[did];
  setValue('world.dungeons.' + did, { ...d,
    currentRoom: appState.world.currentRoom,
    rooms: appState.world.rooms, npcs: appState.world.npcs });
}
// enterDungeon id: exit.targetId ?? `dungeon-${slug(exit.targetName)}`
```

#### 1.3.3 [P0 · effort M] Wire the engine's XP module into kills and dungeon clears, with level-up re-derivation

Progression is the single biggest missing pillar for 80h. The engine already has xp.js and character.js re-derivation (reconcilePc) — award XP by CR on targetDead in commitAll, check threshold, bump record.level, re-derive the sheet, and announce it. Everything needed already exists in the two sibling repos.

```js
// resolver.js commitAll, in the attack branch when resolved.targetDead:
const xpGain = XP.xpForCr(npc.cr ?? 0);
const rec = { ...appState.party.pc.record, xp: (appState.party.pc.record.xp ?? 0) + xpGain };
if (XP.levelForXp(rec.xp) > rec.level) { rec.level = XP.levelForXp(rec.xp); }
setValue('party.pc', { record: rec, sheet: engine.deriveSheet(rec) });
```

#### 1.3.4 [P1 · effort M] Close the intent gap: every classifier intent either resolves deterministically or is explicitly declared 'no mechanical effect' to the narrator

This is the honesty contract at the heart of the owner's design goal. Minimum: add a 'use' intent (potions/items), make dungeon 'rest' resolve to an explicit refusal or a wandering-monster-risk rest, and for all remaining bare intents inject resolved: { intent, mechanicalEffect: 'none' } plus a narrator rule forbidding state-changing fiction (no found items, no healing, no opened passages).

```js
// loop.js before narrate():
const UNRESOLVED = ['look','talk','wait','inventory','travel','rest','buy'];
if (UNRESOLVED.includes(resolved.intent)) resolved.mechanicalEffect = 'none';
// narratorPrompt addition:
// - If resolved.mechanicalEffect is 'none': nothing in the world changes.
//   Describe atmosphere/observation only. No new items, healing, or passages.
```

#### 1.3.5 [P1 · effort M] Replace campaign permadeath-wipe with a death consequence that preserves the world

clearSave() on defeat destroys LLM-generated content the player paid for. In campaign mode, defeat should return the PC to the last settlement at 1 HP with a cost (gold loss, reputation hit, a 'defeated-by' story flag the red thread can use). Keep full permadeath as a Quick Dungeon rule or an opt-in.

```js
async function doCampaignDefeat() {
  const sid = appState.world.location.settlementId;
  const pc = appState.party.pc;
  const record = { ...pc.record, hpCurrent: 1, conditions: [], deathSaves: undefined,
    gold: Math.floor(goldOf(pc.record) / 2) };
  setValue('party', { ...appState.party, pc: { ...pc, record } });
  setStoryFlag('pc-defeated');
  commit();
  return sid; // settlement driver re-enters town
}
```

#### 1.3.6 [P1 · effort L] Refactor state access so the real resolver/loop are testable, then delete the reimplementation tests

The mandate-critical modules are untested because they import the Spektrum singleton. resolveRules and goblinRetaliates are already pure over appState reads — pass a state snapshot parameter (defaulting to appState) and the node test runner can drive the real code; the copied test logic in resolver-settlement.test.js and dungeon.test.js then becomes real coverage instead of drift risk.

```js
// resolver.js
export function resolveRules(classified, roller = plainRoller(), state = appState) {
  const { record, sheet } = state.party?.pc ?? {};
  const world = state.world; // all reads via `state`, never the import
  ...
}
```

#### 1.3.7 [P1 · effort S] Honor weapon choice and add name-based target fallback

Small classifier+resolver change with outsized fairness payoff: add weapon_id to CLASSIFIER_SCHEMA, resolve by sheet.attacks.find(a => a.name matches), and fall back to case-insensitive NPC-name matching before declaring 'No valid target'.

```js
const weapon = sheet.attacks?.find(a => a.name === classified.weapon_id)
  ?? sheet.attacks?.[0] ?? UNARMED;
const target = world.npcs?.[targetId]
  ?? Object.values(world.npcs ?? {}).find(n =>
       n.roomId === world.currentRoom && n.alive &&
       n.name.toLowerCase().includes(String(targetId ?? '').toLowerCase()));
```

#### 1.3.8 [P1 · effort M] Make transcript and rollLog append-only in history (kill the O(n^2) growth)

Both arrays are rewritten wholesale each turn, so each history/spine entry embeds the entire array. Spektrum has addValue — record only the delta (or store transcript entries under keyed sub-paths like transcript.e0042) so history entries stay O(1). This is prerequisite plumbing for any 80h session and directly extends how many turns fit under MAX_TT_ENTRIES and the localStorage quota. Pair it with a user-visible warning when saveEnvelope fails instead of console.warn.

```js
// instead of setValue('transcript', [...old, a, b]):
addValue('transcript', { role: 'player', text, turn });
addValue('transcript', { role: 'gm', text: gmText, turn });
// state.js saveToStorage(): surface failure
if (!saveEnvelope(...)) UI.appendEntry('error', t('save.failedQuota'));
```

#### 1.3.9 [P2 · effort S] Fix the retry predicate: retry 5xx/network with backoff, fail 400 fast, keep 401 reauth and 429 backoff

The current regex retries only 4xx and gives up instantly on the transient class. One-line predicate change plus keeping pendingRetry for all failures preserves the player's typed action.

```js
const transient = /^AI (5\d\d|429)|NetworkError|Failed to fetch/i.test(e.message);
if (!transient || attempt === RETRY_DELAYS.length) break;
```

#### 1.3.10 [P2 · effort M] Give skill checks consequences via a small deterministic effect table

Ground the skill system: stealth success suppresses this turn's retaliation, perception reveals a hidden loot entry or annotates exits, athletics forces a locked door with damage risk. Each is a pure addition to commitAll keyed on resolved.skill + success — no AI involvement, fully testable.

```js
// loop.js: const goblinResult = (goblinTurnTriggered && goblinSurvived
//   && !(resolved.intent==='skill' && resolved.skill==='stealth' && resolved.success))
//   ? goblinRetaliates(roller) : null;
```

#### 1.3.11 [P2 · effort M] Record settlement events into the shared transcript/journal

Route town dialogue, purchases and quest events through appendTranscript (or a settlement-role variant) so resume, EPUB export, and the story systems see one continuous record of the campaign — a precondition for the context-scoping/memory work in docs/ideas/12.

#### 1.3.12 [P2 · effort L] Split flow.js into lifecycle.js, settlement.js, travel.js, encounter.js and end-states, enforcing narrow world writes

The god module is where every defect in this audit lives; splitting it along the seams that already exist (each section is banner-commented) plus replacing whole-world setValue spreads with sub-path writes brings town play under the same history-size discipline as dungeon play.

#### 1.3.13 [P3 · effort S] Trim the narrator schema and let the beat check run non-blocking

Drop combat_ended/outcome (unread) to save tokens and remove implied authority; run maybeAdvanceBeat fire-and-forget after commit (its writes already self-tick, and undo-boundary placement can be preserved by committing the flag in the next turn's pre-phase) or skip it when no beat prerequisite could match.

#### 1.3.14 [P3 · effort S] Vary dungeon themes per dungeon within one world

Derive a per-dungeon theme from the region/exit (e.g. hash of dungeon id over the overlay keys, biased by blueprint.dungeonTheme) instead of reusing the single world theme, and implement (or delete) the promised climate mixing in overworldEncounterPool.

```js
const themes = Object.keys(DUNGEON_OVERLAYS);
const theme = blueprint?.dungeonTheme && rng() < 0.5
  ? blueprint.dungeonTheme
  : themes[Math.floor(rng() * themes.length)];
```

### 1.4 Metrics collected

- **srcGameLoc:** 3906
- **flowJsLoc:** 1539
- **flowJsShareOfGameLoc:** 39%
- **mainJsLoc:** 224
- **resolverJsLoc:** 306
- **loopJsLoc:** 212
- **testsPassing:** 267
- **testSuites:** 57
- **testFilesImportingCoreTurnModules:** 0
- **testFilesTestingReimplementations:** ["tests/worldgen/resolver-settlement.test.js", "tests/worldgen/dungeon.test.js", "tests/timetravel.test.js (vendor engine, not src/game/undo.js)"]
- **buildResult:** node build.js succeeds after npm install (esbuild dev dep absent in fresh checkout); bundle 373.3KB, sw cache key stamped
- **classifierIntents:** 14
- **deterministicallyResolvedIntents:** 5
- **llmCallsPerDungeonTurn:** 2 (classify tiny + narrate medium) + 1 beat-check tiny in campaigns + 1 image optional + 1 autoplay tiny when enabled
- **historyEntriesPerTurnApprox:** 7-9 (cooldowns, world/party writes, transcript full-array, turnCount, rng cursor, rollLog full-array, checkpoint)
- **maxPersistedTimeTravelEntries:** 500
- **turnsPerPersistableEpochApprox:** 60-70
- **bestiarySize:** 66 SRD + 20 custom monsters
- **dungeonOverlayThemes:** 24
- **roomsPerDungeon:** 6-10 (spine 4-6 + branches 2-4)
- **starterClasses:** 4
- **xpAwardCallSites:** 0
- **levelUpCallSites:** 0
- **narratorSchemaUnreadFields:** ["combat_ended", "outcome"]


---

## 2. AI Runtime — prompts, schemas, streaming, classifier, narrator

> Auditor: `ai-runtime` · strengths 8 · findings 18 · recommendations 13

The AI runtime is architecturally much better than "an inconsistent mess": a thin app adapter (src/ai/client.js, 44 LoC) over a clean, config-injected, typed-error client library; deterministic rules always resolve before the narrator speaks; the engine never trusts the LLM for victory/defeat; NPC secret-reveal is host-gated, not model-decided; turn commits are atomic (nothing is written until narration succeeds). Prompts are lean (all under ~400 tokens), imperative, and fully mirrored in Dutch. All 267 app tests and 92 library tests pass.

However, the runtime is broken in production terms right now: I verified the configured model IDs against OpenRouter's live /models endpoint (400 models) and the default free-tier medium model 'openai/gpt-oss-120b:free' does not exist (only 'openai/gpt-oss-120b' paid and 'openai/gpt-oss-20b:free' exist). Medium is the tier used by the narrator, journal, travel narration, and all five worldgen layers — so every free-tier player (the default "try it" onboarding path with the embedded key) gets "GM unavailable" on every single turn. Worse, all four models in the 429 fallback chain are also dead IDs, and the fallback walker throws on the first non-429 error, converting a transient rate limit into a hard failure. Because applyTier() snapshots the model map into persisted save state, fixing tiers.js alone will not heal existing saves.

For the 80-hour open-world goal, the deeper issue is memory: the narrator receives exactly 3 transcript entries (1.5 turns — while its own prompt claims "last 3 turns"), a digest chain, and a story context; nothing from docs/ideas/12-context-scoping.md (scope packets, PC memory cards, RAG recall) exists yet, and nothing the narrator invents is ever remembered. The hallucination guards are half-built: the prompt forbids inventing dice results but never forbids inventing exits/items/NPCs, and for eight of the fourteen classifier intents the resolver returns a bare {intent} with no facts and the prompt gives no instructions — so "rest" narrates recovery while HP stays unchanged, and a successful stealth check is narrated as success while the goblin's retaliation lands in the same paragraph. JSON robustness is a reasonable two-stage design (parse → one repair call), but the streaming narrator call has no schema enforcement at temperature 0.85, common markdown-fenced output triggers a full paid re-generation instead of a local fence-strip, and the repaired narration can differ from the text the player just watched stream.

### 2.1 What is genuinely good

- **Deterministic authority over LLM output — the engine never trusts the narrator's game-state claims** — Victory requires reaching the exit room with no living hostile in it (vault gate), defeat requires three failed death saves, encounter outcomes check npc.alive directly. The NARRATOR_SCHEMA's combat_ended/outcome fields are ignored by the engine, so a hallucinating narrator cannot end the game. The 'impossible' intent path explicitly instructs the model to narrate only failure ('No enemy dies, no item is taken, nothing changes'). — evidence: `Dans-Dungeons/src/game/flow.js:1287-1292`, `Dans-Dungeons/src/game/flow.js:992-995`, `Dans-Dungeons/src/i18n/en.json:490`, `Dans-Dungeons/src/game/loop.js:112`
- **Atomic turn commits — an AI failure never corrupts state** — processTurn snapshots the scene, classifies, resolves, and narrates before any Spektrum write; commitAll/appendTranscript/finalizeTurn run only after narrate() returns, so a thrown classify/narrate leaves no dangling undo mark and no partial state. The flow layer retries 4xx with backoff and cleanly removes the partial stream element. — evidence: `Dans-Dungeons/src/game/loop.js:91-167`, `Dans-Dungeons/src/game/flow.js:1400-1439`
- **Host-gated NPC secrets — a genuinely good trust boundary** — npcReply passes mayRevealSecret computed by the host (canRevealSecret: enough player exchanges, not already revealed); the prompt tells the model to deflect when NO. The model can only claim revealsSecret, and flow.js re-checks the gate before honoring it (revealed = resp.revealsSecret && canRevealSecret(npc)). Dialogue memory is capped via pushDialogue slice. — evidence: `Dans-Dungeons/src/ai/dialogue.js:32-61`, `Dans-Dungeons/src/game/flow.js:729-741`, `bag-of-holding-client/src/settlement/economy.js:108-118`
- **Clean, testable client library layering** — transport.js (typed ApiError, header/base-url seam), tiers.js (pure model resolution + per-tier sampling: tiny cold 0.1/250, medium warm 0.85/700), client.js (schema-bound completion, one-shot JSON repair, streaming), stream.js (JsonFieldStreamer with \u-escape handling across chunk boundaries, covered by 5 unit tests). 92 library tests + 267 app tests pass. The app adapter re-derives config per call so mid-game tier/key changes propagate. — evidence: `bag-of-holding-client/src/llm/transport.js:12-19`, `bag-of-holding-client/src/llm/tiers.js:40-45`, `bag-of-holding-client/tests/llm.test.js:47-69`, `Dans-Dungeons/src/ai/client.js:20-36`
- **Worldgen pipeline orchestration is solid** — runPipeline threads parent digests to children, runs factions+beats in parallel, retries per layer, continues past non-critical failures, aborts on critical ones, and emits structured progress. Worldgen prompts are specific about required fields (the factions prompt even preempts the observed omit-a-field failure mode: 'IMPORTANT: Do not omit any field'), and generateSettlement normalizes missing optional NPC fields after parse. — evidence: `bag-of-holding-client/src/worldgen/pipeline.js:59-95`, `Dans-Dungeons/src/game/worldgen.js:106-130`, `Dans-Dungeons/src/i18n/en.json (ai.factionsPrompt)`, `Dans-Dungeons/src/game/worldgen.js:83-95`
- **Autoplay prompt design is genuinely clever** — The host computes a structured navigation hint with one-hop lookahead (UNVISITED / LEADS TO UNVISITED ROOMS / dead end markers) so the tiny model does not need spatial reasoning; a numbered decision priority plus 'ONLY pick from the available actions list' bounds the output, and any off-list answer degrades gracefully because the returned string goes through the normal classifier anyway. On failure it falls back to manual input. — evidence: `Dans-Dungeons/src/game/flow.js:1344-1377`, `Dans-Dungeons/src/i18n/en.json:492`, `Dans-Dungeons/src/ai/autoplay.js:10-28`
- **Complete, careful Dutch localization of prompts** — All 30 ai.* prompt keys exist in both en.json and nl.json. The NL classifier correctly instructs Dutch input → English enum output ('noorden=north... set direction to north/south/east/west in ENGLISH'), the NL narrator demands Dutch prose, and STT passes language: locale(). Flee/leave commands accept Dutch keywords (vlucht|ren, weg|dag|stoppen). — evidence: `Dans-Dungeons/src/i18n/nl.json:489`, `Dans-Dungeons/src/i18n/nl.json:490`, `Dans-Dungeons/src/game/flow.js:1005`, `Dans-Dungeons/src/ai/stt.js:64-68`
- **Story directive injection is good GM prompting** — The active beat's dramaticPurpose is injected as a GM-only objective ('treat it as YOUR private objective — steer the scene toward it subtly. NEVER state it outright'), and beat completion is judged by a separate strict tiny-tier check ('Be strict — when in doubt, false') rather than by the narrator grading itself. — evidence: `Dans-Dungeons/src/i18n/en.json:490`, `Dans-Dungeons/src/i18n/en.json:484`, `Dans-Dungeons/src/game/story.js:66-89`, `Dans-Dungeons/src/game/loop.js:173-181`

### 2.2 Findings

#### 2.2.1 [CRITICAL · defect] Default free-tier medium model ID does not exist on OpenRouter — narrator/journal/worldgen dead for free-tier players

FREE_MODELS.medium = 'openai/gpt-oss-120b:free' (and DEFAULT_MODELS = {...FREE_MODELS}). I fetched OpenRouter's live /models list (400 models): 'openai/gpt-oss-120b:free' is absent — only paid 'openai/gpt-oss-120b' and 'openai/gpt-oss-20b:free' exist. Every tier:'medium' call (narrate, narrateTravel, journal, all 5 worldgen layers) will get a 4xx; chatStream's only fallback is 400→medium, which is a no-op since the tier already is medium, so processTurn throws, flow retries 3 times, then prints 'GM unavailable'. Free is the default tier and the embedded-key 'try' onboarding path sets it. Compounding: applyTier() persists the model snapshot into save state (setValue('ai.models', modelsForTier(tier))), so existing saves keep the dead ID even after tiers.js is fixed.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:16-26`, `bag-of-holding-client/src/llm/client.js:108-114`, `Dans-Dungeons/src/game/flow.js:117-119`, `Dans-Dungeons/src/game/flow.js:172-176`
- **Impact:** Free-tier play (the default onboarding path) cannot complete a single turn; the game is effectively down for anyone not on deluxe.
- **Independent verification: CONFIRMED** — I independently re-verified every link in the chain. (1) Live OpenRouter /models fetch (400 models): 'openai/gpt-oss-120b:free' is ABSENT — only paid 'openai/gpt-oss-120b' and 'openai/gpt-oss-20b:free' exist — while the dead ID is hardcoded as the free/default medium model (Dans-Dungeons/src/ai/tiers.js:18, DEFAULT_MODELS spread at :26; duplicated at bag-of-holding-client/src/llm/tiers.js:11). (2) The client has no recovery path for a failing medium-tier call: call()'s 400 fallback is gated on opts.tier !== 'medium' (bag-of-holding-client/src/llm/client.js:52) and the FREE_FALLBACKS walk only fires on status 429 (client.js:55-64); chatStream's 400 branch is likewise gated on tier !== 'medium' (client.js:108-110) so it throws ApiError (client.js:113). Whether OpenRouter returns 400 or 404 for the dead ID, the error message 'AI 4xx: ...' (transport.js:14) hits flow.js's retry loop (RETRY_DELAYS=[1000,2000,4000] at flow.js:1275; retry-on-/^AI 4\d\d:/ at flow.js:1400-1424) and ends at t('loop.gmUnavailable') (flow.js:1434) — exactly as claimed. The tiny classifier model IS live, so every turn reaches narration and dies there. (3) Affected callers confirmed: narrate.js:21/53/58, journal.js:73, worldgen.js:18/32/46/60/74 (world/region/settlement layers are critical:true at worldgen.js:107/114/117, so campaign start aborts), worldbible.js:117. (4) Free is the default onboarding path: 'try' sets the embedded key (flow.js:172-176) and the tier picker defaults to 'free' (index 0, flow.js:180-186). (5) The persistence compounding is real: applyTier writes ai.models + commit() (flow.js:117-130), 'ai' is in PERSIST_KEYS (core/state.js:147), restoreState restores it (state.js:124-129), ensureKey never refreshes ai.models for free-tier players on boot (flow.js:237), and resolveModel prefers config.models[tier] over defaultModels (bag-of-holding-client/src/llm/tiers.js:35-37) — so existing saves keep the dead ID even after tiers.js is fixed; a save migration or tier re-apply on boot is needed. Two trivial nuances that do not weaken the verdict: journal export degrades to a non-LLM raw-HTML fallback rather than dying entirely (the LLM-woven journal is dead), and — extra corroboration beyond the claim — all four medium/large 429-fallback IDs and both tiny fallback IDs in FREE_FALLBACKS (tiers.js:46-50) are ALSO absent from the live model list, so even the rate-limit chain is rotten. One caveat: I could not probe the exact 4xx status with the embedded key (permission denied decoding it), but the code treats any non-401/non-429 4xx on the medium tier identically (rethrow → retries → GM unavailable), so the claim's mechanism holds for either 400 or 404. Critical severity is justified: the default free-tier onboarding path cannot complete a single turn or start a campaign.

#### 2.2.2 [CRITICAL · defect] Entire 429 fallback chain consists of dead model IDs, and the walker aborts on the resulting 400s

FREE_FALLBACKS lists 'qwen/qwen3-72b:free', 'meta-llama/llama-4-scout:free', 'deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-4-maverick:free' — all four absent from the live OpenRouter /models list (llama-4-scout/maverick exist only as paid; qwen3-72b and deepseek-chat-v3-0324 are gone entirely). In call(), a 429 walks the chain but any fallback error that is not another 429 is rethrown immediately ('if (!(fbErr instanceof ApiError && fbErr.status === 429)) throw fbErr'), so the invalid-model 4xx from the first dead fallback aborts the whole chain. The rate-limit resilience layer is thus worse than nothing: it converts transient 429s into hard failures. chatStream (the narrator) has no 429 fallback at all.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:46-50`, `bag-of-holding-client/src/llm/client.js:55-66`, `bag-of-holding-client/src/llm/client.js:93-114`
- **Impact:** On the shared embedded free key — precisely where 429s are most common — rate limits become unrecoverable turn failures instead of transparent model switches.
- **Independent verification: PARTIAL** — The core defect is real and I traced it end-to-end. (1) FREE_FALLBACKS (Dans-Dungeons/src/ai/tiers.js:46-50, injected via aiConfig() at Dans-Dungeons/src/ai/client.js:27; identical library default at bag-of-holding-client/src/llm/tiers.js:28-32) lists exactly the four claimed model IDs, and a live fetch of https://openrouter.ai/api/v1/models (400 models, today) shows all four :free IDs absent — the entire chain is dead. In fact no :free deepseek/qwen/meta-llama models exist at all right now, and even the default free medium model 'openai/gpt-oss-120b:free' (tiers.js:18) is absent from the live list (only gpt-oss-20b:free exists) — the free-model config has rotted beyond just the fallbacks. (2) The abort behavior is as claimed: bag-of-holding-client/src/llm/client.js:57-63 rethrows any non-429 fallback error immediately ('if (!(fbErr instanceof ApiError && fbErr.status === 429)) throw fbErr'), exiting call() without trying the second fallback; OpenRouter returns a non-429 4xx for a nonexistent model, and the 400→medium retry (client.js:52-54) applies only to the first attempt, not to fallback errors. (3) chatStream (client.js:93-114) indeed has no 429 handling, and the narrator uses it (Dans-Dungeons/src/ai/narrate.js:53 via _callStream). However, two details are wrong/overstated, hence PARTIAL rather than CONFIRMED — see corrected_detail.
  - *Corrected detail:* Two corrections. (a) 'deepseek/deepseek-chat-v3-0324' is NOT gone entirely — the paid variant is still on the live OpenRouter list; only its :free variant is gone. It is 'qwen/qwen3-72b' that is absent in both free and paid forms (llama-4-scout/maverick paid-only, as claimed). (b) The impact framing 'worse than nothing' / 'unrecoverable turn failures' is overstated. ApiError messages are 'AI <status>: ...' (bag-of-holding-client/src/llm/transport.js:14), and the play loop catches turn errors at Dans-Dungeons/src/game/flow.js:1408-1441: both a raw 429 and the fallback-induced dead-model 4xx match the same /^AI 4\d\d:/ branch, producing a 'GM unavailable' message and pendingRetry = raw (player input preserved, retryable next turn). So the dead chain makes the outcome equivalent to having no fallback at all — one wasted extra request and a misleading surfaced status — not strictly worse, and turns are recoverable by manual retry after the rate-limit window, not unrecoverable. The calibrated finding: the 429 resilience layer provides zero actual resilience on the default free tier (DEFAULT_MODELS = FREE_MODELS, tiers.js:26, shared embedded key) where 429s concentrate, so every rate-limit event becomes a visible failed turn requiring manual retry; severity high (player-facing, systematic, but no data loss and no crash) rather than critical.

#### 2.2.3 [CRITICAL · gap] No narrative memory beyond 1.5 turns — the context-scoping architecture for the 80h goal is entirely unimplemented

narrate() sends recentTranscript.slice(-3) — 3 entries = 1.5 player/GM turns — while the prompt text claims 'Recent transcript (last 3 turns, for continuity)'. Everything else the GM knows is the room snapshot, a pipe-joined digest chain, and the story context (beat directive, ≤4 faction standings, ≤3 quests, last 6 flags). Nothing the narrator invents (descriptions, NPC quirks, improvised details) is ever captured or replayed; there are no memory cards, no nearby-tier, no associative recall, no token budgets — the docs/ideas/12-context-scoping.md design ('smallest packet of facts that fully explains the current moment', PC memory, RAG over transcript) has no implementation. Over 50+ turns the GM will contradict its own earlier prose because it literally never sees it.

- **Evidence:** `Dans-Dungeons/src/ai/narrate.js:40`, `Dans-Dungeons/src/i18n/en.json:490`, `Dans-Dungeons/src/game/loop.js:24-82`, `Dans-Dungeons/src/game/story.js:66-89`, `Dans-Dungeons/docs/ideas/12-context-scoping.md:1-80`
- **Impact:** Long-session coherence — the core requirement of the 80-hour campaign — is structurally impossible with the current context assembly; this is the single biggest gap between vision and code.

#### 2.2.4 [HIGH · defect] Narrator improvises state changes for eight intents the resolver does not mechanize

CLASSIFIER_SCHEMA's enum has 14 intents but resolveRules() implements only attack/skill/move/take/unlock; talk/look/inventory/wait/travel/rest/buy/meta fall through to 'return { intent }' with no facts. The narrator prompt has per-intent rules only for move/take/unlock/impossible — nothing for the fall-through intents. So 'I rest and bandage my wounds' → intent 'rest' → resolved={intent:'rest'} → the medium model narrates recovery while hpCurrent is untouched; 'buy' narrates a purchase with no gold or inventory change; dungeon 'talk' invents NPC dialogue with no dialogue state. The narration and the deterministic state silently diverge, and the next turn's scene contradicts what the player just read.

- **Evidence:** `Dans-Dungeons/src/ai/schemas.js:8-23`, `Dans-Dungeons/src/game/resolver.js:127`, `Dans-Dungeons/src/i18n/en.json:490`, `Dans-Dungeons/src/game/loop.js:133-139`
- **Impact:** Players are told things happened that did not; trust in the GM erodes and 'truly open play that always falls back on deterministic systems' fails for the most common conversational actions.

#### 2.2.5 [HIGH · defect] Narrator prompt has no anti-invention guard for exits, items, NPCs, or rooms

The only hallucination rules are 'Do NOT invent dice results' and the 'impossible' clause. Nothing forbids mentioning an exit that is not in scene.room.exits, an item not in loot, or an NPC not in scene.npcs — the exact failure the context-scoping doc calls out ('invents a tavern that contradicts the one already in the city'). The scene also gives the narrator exits as bare directions ({direction, locked}) with no destination names, so any door description is necessarily invented and will conflict with the generated room the player then enters.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:490`, `Dans-Dungeons/src/game/loop.js:30-36`, `Dans-Dungeons/docs/ideas/12-context-scoping.md:10-14`
- **Impact:** Systematic contradictions between narration and the deterministic world graph, compounding turn over turn.

#### 2.2.6 [HIGH · defect] Skill-check success is narrated while its retaliation consequence contradicts it in the same turn

A resolved skill success carries no mechanical effect except a cooldown (commitAll only sets cooldowns[resolved.skill]=3), yet goblinTurnTriggered includes 'skill', so a successful Stealth check still triggers goblinRetaliates(). The narrator receives {pcAction:{intent:'skill',skill:'stealth',success:true}, enemyRetaliation:{hit:true,damage:5}} and must weave 'you slip past unseen' together with 'the goblin clubs you' — irreconcilable facts handed to the model in one prompt.

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:64-79`, `Dans-Dungeons/src/game/resolver.js:242`, `Dans-Dungeons/src/game/loop.js:121-125`
- **Impact:** The most immersion-breaking class of contradiction (player succeeds and is punished anyway), guaranteed by construction rather than by model error.

#### 2.2.7 [MEDIUM · defect] Streamed narration and committed narration can differ; markdown-fenced JSON forces a full paid re-generation

narrate() streams raw content, then JSON.parse(raw); on failure repairJson() makes a second medium-tier call whose narration replaces what the player just watched stream (transcript, TTS, and journal use the repaired text). There is no local salvage first — a response wrapped in ```json fences (an extremely common model behavior, made likelier because chatStream sends no response_format and medium runs at temperature 0.85) fails parse and triggers the re-call even though the streamed extractor already displayed the correct narration.

- **Evidence:** `Dans-Dungeons/src/ai/narrate.js:53-59`, `bag-of-holding-client/src/llm/client.js:70-77`, `bag-of-holding-client/src/llm/client.js:100-106`, `bag-of-holding-client/src/llm/tiers.js:40-44`
- **Impact:** Double latency/cost on a common failure mode, plus a visible glitch where the story text changes after it finished streaming.

#### 2.2.8 [MEDIUM · defect] JsonFieldStreamer marker breaks on pretty-printed JSON — streaming silently dies

The extractor matches the literal marker `"narration":"` (constructor builds `"${field}":"`). A model emitting `"narration": "` (space after colon — standard pretty-print) never activates the extractor: onChunk never fires, the UI shows the thinking indicator for the whole generation, and flow.js falls back to appending the full text at the end. No test covers whitespace after the colon (tests use compact JSON only).

- **Evidence:** `bag-of-holding-client/src/llm/stream.js:13`, `bag-of-holding-client/src/llm/stream.js:24-33`, `bag-of-holding-client/tests/llm.test.js:52-68`, `Dans-Dungeons/src/game/flow.js:1445`
- **Impact:** Streaming UX — a headline feature — degrades to nothing depending on which model/provider formats the JSON, and nobody gets an error to debug.

#### 2.2.9 [MEDIUM · risk] Worldgen NPC/SETTLEMENT schemas violate strict structured-output rules they are sent under

client.js sends response_format {type:'json_schema', strict:true}. The OpenAI structured-outputs spec (which OpenRouter forwards to strict-enforcing providers) requires every property to appear in `required`. NPC_SCHEMA requires only 5 of its 11 properties (questHook, personality, secret, factionId, relationships, inventory optional); SETTLEMENT_SCHEMA omits regionId and digest from required. Strict-enforcing providers reject such schemas with 400; the client's 400 handler retries once at medium and then throws — and the app-side normalization (npc.personality ??= '' etc.) shows these fields do get omitted in practice.

- **Evidence:** `bag-of-holding-client/src/llm/client.js:29-31`, `bag-of-holding-client/src/worldgen/schemas.js:84-101`, `bag-of-holding-client/src/worldgen/schemas.js:164-190`, `Dans-Dungeons/src/game/worldgen.js:83-95`
- **Impact:** Campaign creation (a critical pipeline layer) can fail outright depending on provider routing, or silently lose fields on lenient providers.

#### 2.2.10 [MEDIUM · gap] Journal export is single-shot over all narrations — cannot survive a long campaign

generateJournalStory JSON.stringifies every new narration into one prompt with a 4000-token output cap. The localStorage cache only helps across repeated exports; the first export of a 300-turn campaign sends hundreds of narrations in one request (input overflow on smaller free models, output truncation → JSON parse failure → repair call that truncates identically). Cross-export continuity is only 100-char stubs of prior chapter texts.

- **Evidence:** `Dans-Dungeons/src/ai/journal.js:61-80`, `Dans-Dungeons/src/ai/journal.js:62`, `Dans-Dungeons/src/ai/journal.js:74`
- **Impact:** The EPUB journal — a distinctive feature — will fail exactly when it matters most, at the end of a long campaign.

#### 2.2.11 [MEDIUM · defect] Classifier sets skill DCs with no rubric and the resolver accepts them unclamped

The only guidance is 'For skill checks suggest a dc between 10 and 20' with no examples of what merits 10 vs 20; the schema type is bare number (no minimum/maximum), and resolveRules uses `const checkDC = dc ?? 12` with no clamp — a tiny-tier model returning dc 30 or 3 is applied verbatim to the d20 check.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:489`, `Dans-Dungeons/src/ai/schemas.js:18`, `Dans-Dungeons/src/game/resolver.js:68`
- **Impact:** Difficulty is arbitrary and exploitable ('easily sneak past' phrasing yields lower DCs); deterministic-rules authority is quietly delegated to the cheapest model.

#### 2.2.12 [MEDIUM · inconsistency] Model documentation, code, and audio helpers disagree about which TTS/STT models are in play

CLAUDE.md's tier table says tts=gemini-3.1-flash-tts, stt=nvidia/parakeet-tdt; code says PAID tts='openai/gpt-4o-mini-tts-2025-12-15', stt='openai/gpt-4o-mini-transcribe'. audio.js's TTS_FALLBACKS[0] duplicates the primary model (wasting a retry slot), and PCM_MODELS contains only 'google/gemini-3.1-flash-tts-preview' — a model nothing configures — so the PCM path is dead code for current config. None of the four TTS model IDs nor the STT ID appear in OpenRouter's live /models list (audio models may be listed elsewhere, but this cannot be confirmed from the list and there is no runtime validation).

- **Evidence:** `Dans-Dungeons/CLAUDE.md (AI model tiers table)`, `bag-of-holding-client/src/llm/tiers.js:18-25`, `bag-of-holding-client/src/llm/audio.js:13-22`, `Dans-Dungeons/src/ai/tiers.js:29-36`
- **Impact:** Voice features are unverifiable and likely broken or partially dead; docs mislead the next developer (and the next Claude session).

#### 2.2.13 [MEDIUM · defect] Cost meter never accrues chat/image spend; streamed token accounting depends on unrequested usage chunks

onCost is invoked only by synthesizeSpeech's flat per-character estimate (audio.js:86); chat and image calls report only onTokens, so ai.totalCostUsd and the persistent spend meter's USD figure stay at ~0 for the calls that dominate spend. chatStream also does not send stream_options:{include_usage:true}, so whether accountTokens ever sees usage on streamed calls depends on provider behavior.

- **Evidence:** `bag-of-holding-client/src/llm/audio.js:86`, `Dans-Dungeons/src/ai/client.js:30-33`, `bag-of-holding-client/src/llm/client.js:100-106`, `bag-of-holding-client/src/llm/client.js:143`
- **Impact:** The BYOK cost meter — the trust feature for players spending their own money — materially understates real spend.

#### 2.2.14 [MEDIUM · risk] Embedded shared OpenRouter key is only XOR-obfuscated in the shipped bundle

tiers.js ships _a (73 XOR-encoded char codes) with the literal key string _b='DansDungeons2026' and an exported one-line decoder _cfg(); flow.js calls _cfg() to set ai.key for the free tier. Anyone reading the public GitHub Pages bundle can recover the shared key in seconds and drain its quota, rate-limiting every free-tier player. (I did not decode it; the mechanism and comment 'embedded free-tier API key' make the intent explicit.)

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:7-11`, `Dans-Dungeons/src/game/flow.js:174`, `Dans-Dungeons/src/game/flow.js:219`
- **Impact:** One abuser breaks free-tier onboarding for everyone; the free tier's availability is hostage to obscurity.

#### 2.2.15 [LOW · debt] Model tables duplicated across app and library; unused 'large' tier; stale module map

FREE_MODELS/PAID_MODELS/FREE_FALLBACKS exist verbatim in both Dans-Dungeons/src/ai/tiers.js and bag-of-holding-client/src/llm/tiers.js (already the app passes its own copy as defaultModels, so the lib copy is shadowed but must be kept in sync). No call site uses tier:'large'. CLAUDE.md's module map still lists src/ai/stream.js, which moved to the library, and omits auth.js/dialogue.js/spend.js.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:16-50`, `bag-of-holding-client/src/llm/tiers.js:9-32`, `Dans-Dungeons/CLAUDE.md (module map)`
- **Impact:** Two places to update on every model rotation — exactly how the dead-ID rot happened.

#### 2.2.16 [LOW · inconsistency] Two competing i18n prompting strategies

travelPrompt, npcDialoguePrompt, and polishPrompt keep one canonical body and inject {{language}}; classifierPrompt, narratorPrompt, autoplayPrompt, journalPrompt and all six worldgen prompts are fully duplicated and hand-translated per locale (currently well-synced, ~1.4KB each). Any prompt improvement must now be made twice, and nothing tests en/nl key or {{param}} parity.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:485-494`, `Dans-Dungeons/src/i18n/nl.json:485-494`, `Dans-Dungeons/src/ai/narrate.js:19`
- **Impact:** Prompt iteration speed halves and silent en/nl behavioral divergence is one edit away.

#### 2.2.17 [LOW · defect] t() interpolation and missing-key behavior can silently corrupt prompts

t() returns the key itself when a lookup fails (a typo'd 'ai.naratorPrompt' would ship the literal string 'ai.naratorPrompt' as the system prompt with no error), and interpolation uses String.replaceAll with a string replacement, which processes $-patterns ($&, $', $`) in the value — a scene/narration containing $' would inject the template's tail into the prompt.

- **Evidence:** `Dans-Dungeons/src/i18n/i18n.js:27-37`
- **Impact:** Rare but fully silent prompt corruption; no test would catch it.

#### 2.2.18 [LOW · debt] Pretty-printed JSON in every per-turn prompt wastes tokens

classify() and narrate() embed JSON.stringify(scene, null, 2) (and resolved facts, also indented); autoplay pretty-prints the scene too. On calls made 2-3 times per turn, indentation adds roughly 20-30% context tokens for zero model benefit.

- **Evidence:** `Dans-Dungeons/src/ai/classify.js:9-11`, `Dans-Dungeons/src/ai/narrate.js:42-46`, `Dans-Dungeons/src/ai/autoplay.js:11-16`
- **Impact:** Measurable cost/latency overhead on the highest-frequency calls, borne by players' own keys.

### 2.3 Recommendations

#### 2.3.1 [P0 · effort S] Replace dead model IDs and stop persisting the model map in saves

Verified against the live OpenRouter list: FREE medium must move off 'openai/gpt-oss-120b:free'; live free candidates include 'nvidia/nemotron-3-super-120b-a12b:free' (already your large slot), 'openai/gpt-oss-20b:free', and 'google/gemma-4-31b-it:free'. All four FREE_FALLBACKS entries are dead and need live replacements. Because applyTier() snapshots ai.models into persisted state, also re-derive models from ai.tier at boot (or version the map) so existing saves heal.

```js
// tiers.js
const FREE_MODELS = {
  tiny:   'google/gemma-4-26b-a4b-it:free',
  medium: 'nvidia/nemotron-3-super-120b-a12b:free',
  ...
};
export const FREE_FALLBACKS = {
  tiny:   ['google/gemma-4-31b-it:free', 'openai/gpt-oss-20b:free'],
  medium: ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
};
// boot (main.js): models are derived, never trusted from the save
setValue('ai.models', modelsForTier(appState.ai?.tier ?? 'free'));
```

#### 2.3.2 [P0 · effort S] Harden the fallback walker and validate models at startup

A dead fallback ID currently aborts the whole chain because only 429 continues it. Continue on any ApiError; additionally, fetch GET /models once at boot (public, keyless) and drop configured IDs that are not listed, warning in the debug panel — this turns silent model rot into a visible, self-healing event.

```js
for (const model of fallbacks) {
  try { return await callOnce(config, { ...opts, model }); }
  catch (fbErr) { if (!(fbErr instanceof ApiError)) throw fbErr; /* else try next */ }
}
```

#### 2.3.3 [P1 · effort S] Add local JSON salvage before the repair re-call, and keep the streamed text authoritative

Markdown fences and stray prose around the JSON are the dominant malformed-output mode; stripping them locally is free, avoids a second medium call, and prevents the player-visible glitch where the committed narration differs from what streamed.

```js
function salvageJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
// narrate.js
try { return JSON.parse(raw); }
catch { return salvageJson(raw) ?? repairJson(raw, { tier:'medium', schema: NARRATOR_SCHEMA }, messages); }
```

#### 2.3.4 [P1 · effort S] Make JsonFieldStreamer whitespace-tolerant

One regex change restores streaming for pretty-printing models; add a test with '"narration": "' to lock it in.

```js
// stream.js — search with a regex instead of indexOf on a literal marker
this._markerRe = new RegExp('"' + field + '"\\s*:\\s*"');
const m = this._markerRe.exec(this._buf);
if (m) { this._active = true; this._buf = this._buf.slice(m.index + m[0].length); }
```

#### 2.3.5 [P1 · effort M] Widen and deepen narrator context: more transcript + a rolling GM memory summary + explicit anti-invention rules

This is the first concrete step toward the 12-context-scoping vision and directly attacks the 50-turn contradiction problem. 10 entries (~5 turns) plus a tiny-tier-maintained rolling summary of 'established facts' costs a few hundred tokens per turn; the anti-invention clause closes the biggest open hallucination door. Also fix the prompt's '3 turns' claim to match reality.

```js
// loop.js: every 8 turns, tiny-tier summarize (transcript slice) into session.gmMemory
// narrate.js
const transcriptText = recentTranscript.slice(-10).map(e => `${e.role}: ${e.text}`).join('\n');
// narratorPrompt additions:
// - NEVER mention exits, rooms, items or NPCs that are not listed in the scene data.
// - If the player asks about something not in the scene, narrate its absence.
// Established facts so far: {{memory}}
```

#### 2.3.6 [P1 · effort S] Close the intent gap: either mechanize or explicitly de-mechanize the fall-through intents

rest/buy/travel/talk in a dungeon must not be narrated as succeeding. Cheapest fix: add per-intent narrator rules ('rest: narrate a brief pause — it restores NOTHING'; 'buy: there is no one to trade with here') and remove settlement-only intents from the dungeon classifier enum; better: have the resolver return {intent:'impossible', reason} for buy/travel/rest in dungeon mode so the existing impossible-guard handles it.

```js
// resolver.js, before the bare fall-through
if (['rest','buy','travel'].includes(intent)) {
  return { intent: 'impossible', reason: t(`resolver.noHere.${intent}`) };
}
```

#### 2.3.7 [P1 · effort S] Clamp and rubricize classifier DCs

Keep difficulty authority in deterministic code: clamp in the resolver and give the classifier a 3-line rubric so tiny models anchor consistently.

```js
const checkDC = Math.min(25, Math.max(5, dc ?? 12));
// classifierPrompt: DC guide — trivial 8, easy 10, moderate 12-14, hard 16-18, near-impossible 20.
```

#### 2.3.8 [P2 · effort M] Stream with schema enforcement, fallbacks, and usage reporting

chatStream should send response_format json_schema (supported with streaming by most OpenRouter providers), reuse the 429 fallback chain, and request stream_options:{include_usage:true} so streamed narrator calls are as robust and as metered as non-streamed ones.

#### 2.3.9 [P2 · effort M] Batch the journal weaver

Chunk narrations into ~25-turn windows, one chatCompletion per window producing 1-3 chapters, threading a 100-word running synopsis between windows; cache per-window. This is the only way the EPUB feature survives an 80-hour campaign, and it removes the 4000-token cliff.

#### 2.3.10 [P2 · effort S] Make worldgen NPC/settlement schemas strict-compliant

Add every property to required (using ['string','null'] types for optionals, which strict mode supports) so strict-enforcing providers stop 400ing and lenient ones stop omitting fields — this also lets you delete the app-side ??= normalization.

```js
required: ['id','name','role','attitude','greeting','questHook','personality','secret','factionId','relationships','inventory']
```

#### 2.3.11 [P2 · effort M] Single-source the duplicated prompts and test locale parity

Move classifier/narrator/autoplay/journal/worldgen prompts to the canonical-EN + {{language}} pattern already used by travel/dialogue/polish (LLMs follow 'Respond entirely in Dutch' reliably at these sizes), or at minimum add a node --test that asserts en.json and nl.json have identical ai.* keys and identical {{param}} sets per key.

#### 2.3.12 [P3 · effort S] Consolidate tier tables into the library and fix stale docs

The app's tiers.js duplicates the lib's FREE/PAID/FALLBACK tables (the rot vector for the dead IDs); import them from bag-of-holding-client, drop the unused 'large' tier or route journal to it, and correct CLAUDE.md's model table and module map (stream.js is gone; auth/dialogue/spend exist).

#### 2.3.13 [P3 · effort S] Meter real chat cost

OpenRouter returns usage.cost when requested (usage: {include: true} in the request body); wire it to onCost so the spend meter reflects chat and image calls, not just the TTS character estimate.

### 2.4 Metrics collected

- **src_ai_loc:** 698
- **src_ai_files:** 12
- **client_lib_llm_loc:** client.js 162 + stream.js 71 + tiers.js 46 + transport.js 50 + image.js 68 + audio.js 109
- **app_tests_pass:** 267
- **client_lib_tests_pass:** 92
- **openrouter_models_listed:** 400
- **dead_default_model_ids:** 1 of 3 free chat slots (medium), 4 of 4 chat fallback IDs; TTS/STT IDs unverifiable via /models
- **verified_live_model_ids:** ["google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3-super-120b-a12b:free", "google/gemini-2.5-flash-lite", "deepseek/deepseek-v4-pro", "google/gemini-2.5-flash-image"]
- **verified_dead_model_ids:** ["openai/gpt-oss-120b:free", "qwen/qwen3-72b:free", "meta-llama/llama-4-scout:free", "deepseek/deepseek-chat-v3-0324:free", "meta-llama/llama-4-maverick:free"]
- **narrator_transcript_window_entries:** 3
- **narrator_transcript_window_turns:** 1.5
- **prompt_sizes_chars:** {"narratorPrompt": 1384, "classifierPrompt": 715, "autoplayPrompt": 1088, "journalPrompt": 993, "settlementPrompt": 1501, "npcDialoguePrompt": 794, "beatCheckPrompt": 378, "travelPrompt": 226}
- **sampling_defaults:** {"tiny": "temp 0.1 / 250 tok", "medium": "temp 0.85 / 700 tok"}
- **llm_calls_per_dungeon_turn:** 2-3 (classify tiny + narrate medium + beat-check tiny in campaigns), plus optional image/TTS
- **classifier_intents_total:** 14
- **classifier_intents_mechanized_by_resolver:** 5
- **ai_prompt_keys_en:** 30
- **ai_prompt_keys_nl:** 30
- **vendored_client_lib_in_sync_with_sibling:** True


---

## 3. Cost & Latency — token economics of an 80-hour campaign

> Auditor: `cost-latency` · strengths 7 · findings 15 · recommendations 10

The good news is decisive: at today's verified OpenRouter prices, the 80-hour campaign is trivially affordable on text. I measured the real assembled prompts (classifier ~3.3KB/~850 tokens, narrator ~5.0KB/~1,300 tokens, beat-check ~180 tokens) and priced them against the live OpenRouter catalog fetched 2026-08-07: a full campaign turn (classify on gemini-2.5-flash-lite + streamed narrate on deepseek-v4-pro + beat check) costs ~$0.0008. At 30 turns/hour that is ~$0.025/hour and ~$2 for an entire 80-hour campaign. Even under the context-scoping plan's own budgets (2k-token median packets, 5k set-pieces), the blended cost is ~$0.0014/turn ≈ $3.4/80h. The tier architecture — tiny classifier, medium streamed narrator, bounded maxTokens, hand-built minimal scene snapshot reused across the turn's calls — is genuinely the right cost design and it is already in place.

The bad news is threefold. First, the free tier is dead on arrival right now: the free medium model `openai/gpt-oss-120b:free` no longer exists in OpenRouter's catalog (I verified the full 400-model list, total_count=400, no pagination), all four FREE_FALLBACKS chat models are gone (and `qwen/qwen3-72b:free` appears to have never existed — Qwen3 has no 72B), and every configured TTS/STT model is missing (OpenRouter hosts no TTS/transcribe models at all, exactly as the project's own 05-ai-runtime.md warned). Every free-tier narration call will 400/404 with no recovery path, so the default tier cannot play a single turn. On top of that, the free tier runs on one shared embedded key, and OpenRouter enforces free-model caps per account, globally: 20 req/min and 50 req/day (1,000/day with $10 credits). At 2–3 LLM calls per turn, the entire worldwide free-player base shares ~16–25 turns per day. The free tier is a demo at best and can never be the 80h path; the code and docs don't acknowledge this.

Second, the cost-visibility story promised in docs/ideas/05-ai-runtime.md mostly doesn't exist. There is a real, undo-proof spend accumulator and a UI meter — a genuinely good skeleton — but OpenRouter now includes `usage.cost` (actual USD) in every response and the client reads only `total_tokens`, so the meter's dollar figure stays $0.0000 for all chat spend forever (onCost fires only from a hardcoded $15/M-char TTS guess, on a feature whose models don't exist). No per-call ledger, no per-turn/chapter rollups, no budget cap, no packet/prompt caching, no transcript compression. Third, the actual cost hazard is not tokens but images: a scene sketch is ~1,290 image-output tokens at $30/M ≈ $0.039/image, generated every turn when enabled — ~47× the text cost of the turn, ~$95 per 80h campaign, with no throttle beyond on/off. Latency is decent (first narration text ~1.2–2.5s after submit thanks to streaming) but every turn pays a ~1s classifier round-trip even for chip clicks that are already structured commands, and campaign turns append a blocking ~1s beat-check after narration completes.

### 3.1 What is genuinely good

- **Tiered model routing is the right cost architecture and is actually implemented** — The most important cost lever — smallest model per job — exists and is wired correctly: tiny tier for the per-turn classifier, autoplay, dialogue and beat check; medium for the narrator; per-tier sampling caps output spend (tiny: temp 0.1 / 250 max tokens; medium: 0.85 / 700). Per-call maxTokens overrides exist (journal 4000, beatCheck 120, travel 220, dialogue 400). — evidence: `Dans-Dungeons/src/ai/tiers.js:16-41`, `bag-of-holding-client/src/llm/tiers.js:40-45`, `Dans-Dungeons/src/ai/classify.js:14`, `Dans-Dungeons/src/ai/narrate.js:53`, `Dans-Dungeons/src/ai/classify.js:29-30`
- **Narrator streams with a JSON-field extractor — good perceived latency** — chatStream feeds SSE deltas through JsonFieldStreamer so the UI renders the narration field live while the JSON envelope completes; the thinking indicator clears on first chunk. This gives ~1.2-2.5s to first visible text instead of waiting 3-5s for the full completion, exactly what 05-ai-runtime.md prescribes. — evidence: `bag-of-holding-client/src/llm/client.js:93-148`, `bag-of-holding-client/src/llm/stream.js:11-70`, `Dans-Dungeons/src/game/flow.js:1390-1394`
- **Scene image and TTS are off the turn's critical path** — requestSceneImage is fire-and-forget (not awaited), silent on failure, and skipped entirely when the sketch view is minimized; _speak/_speakAsync are likewise not awaited in the play loop. The expensive decorative calls never block input. — evidence: `Dans-Dungeons/src/game/flow.js:99-112`, `Dans-Dungeons/src/game/flow.js:1450-1457`, `Dans-Dungeons/src/ai/narrate.js:66-79`
- **The scene context is a deliberate, minimal, reused snapshot — a working miniature of the context-scoping plan** — buildScene() hand-picks fields (room, exits, unclaimed loot, PC vitals, live NPCs), builds a leaf-to-root digest path for campaign worldContext, and attaches a story block that story.js explicitly caps ('Compact (< ~400 tokens)', slice(0,4)/slice(0,3)/slice(-6)). The same scene object is passed to both classifier and narrator — the '12-context-scoping.md' promise that the packet is built once per turn and reused is already honored. — evidence: `Dans-Dungeons/src/game/loop.js:24-82`, `Dans-Dungeons/src/game/story.js:62-89`, `Dans-Dungeons/src/game/loop.js:102-138`
- **An undo-proof cumulative spend accumulator with a UI meter exists and is tested** — spend.js keeps monotonic {tokens, costUsd} outside Spektrum history (survives undo/reload), main.js renders it as a live cost meter, and tests/spend.test.js covers it. The accounting plumbing (onTokens/onCost sinks injected via config) is cleanly designed — it just isn't fed real cost data yet (see findings). — evidence: `Dans-Dungeons/src/ai/spend.js:29-38`, `Dans-Dungeons/src/main.js:27-34`, `Dans-Dungeons/src/ai/client.js:31-34`, `Dans-Dungeons/tests/spend.test.js`
- **Journal export caches processed chapters incrementally** — generateJournalStory fingerprints narrations and re-processes only new turns, with the previous chapters passed as truncated context — repeated exports of a long campaign don't re-bill the whole transcript. — evidence: `Dans-Dungeons/src/ai/journal.js:34-70`
- **Sensible 400/429 fallback policy design in the client library** — The transport branches on a typed ApiError status: 400 retries once at medium tier (content-filter/unsupported-feature escape hatch), 429 walks a per-tier fallback model chain. The design is right; only the chain's current model IDs are dead (see findings). — evidence: `bag-of-holding-client/src/llm/client.js:48-67`, `bag-of-holding-client/src/llm/transport.js:12-19`

### 3.2 Findings

#### 3.2.1 [CRITICAL · defect] Free-tier narrator model no longer exists on OpenRouter — default tier cannot play a turn

FREE_MODELS.medium = 'openai/gpt-oss-120b:free' (tiers.js:18). I fetched the complete live OpenRouter catalog on 2026-08-07 (GET /api/v1/models: 400 models, total_count=400, links.next=null — not truncated): only 'openai/gpt-oss-20b:free' and the paid 'openai/gpt-oss-120b' exist; the :free 120b variant is gone. A request for a nonexistent model returns 400/404, and the client's 400-policy cannot recover on the medium tier itself ('if (err.status === 400 && opts.tier !== "medium")' — bag-of-holding-client/src/llm/client.js:52; same guard in chatStream at :109). The 429 fallback chain never triggers on 400. So on the free/default tier every narrate() throws, flow.js retries the whole turn 3 times against the same dead model (flow.js:1400-1424) and prints 'GM unavailable'. The tiny slot ('google/gemma-4-26b-a4b-it:free') and large slot ('nvidia/nemotron-3-super-120b-a12b:free') do still exist and support structured outputs.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:16-23`, `bag-of-holding-client/src/llm/client.js:52`, `bag-of-holding-client/src/llm/client.js:108-114`, `Dans-Dungeons/src/game/flow.js:1400-1424`
- **Impact:** The game's default configuration cannot narrate a single turn. Every new player who picks 'try' hits a hard failure loop. Blocks play outright until a live model ID ships.
- **Independent verification: CONFIRMED** — I independently traced every link in the claimed failure chain and re-fetched the live OpenRouter catalog myself; the defect is real as stated.

(1) Dead model ID in the default config: Dans-Dungeons/src/ai/tiers.js:18 sets FREE_MODELS.medium = 'openai/gpt-oss-120b:free' (duplicated in bag-of-holding-client/src/llm/tiers.js:11, which resolveModel falls back to). DEFAULT_MODELS = {...FREE_MODELS} (tiers.js:26), state init uses it (Dans-Dungeons/src/core/state.js:51), and the 'try' onboarding path sets the embedded key (flow.js:174) then applyTier('free') → setValue('ai.models', modelsForTier('free')) (flow.js:119, 'free' is the default choice at flow.js:180-186). No code anywhere checks model availability or overrides ai.models dynamically — I grepped the whole src tree.

(2) Live catalog, independently fetched 2026-08-07 (GET https://openrouter.ai/api/v1/models: 400 models, total_count=400, links.next=null — complete): 'openai/gpt-oss-120b:free' is ABSENT. Only 'openai/gpt-oss-20b:free', 'openai/gpt-oss-20b', paid 'openai/gpt-oss-120b', and 'openai/gpt-oss-safeguard-20b' exist in the gpt-oss family. The tiny ('google/gemma-4-26b-a4b-it:free') and large ('nvidia/nemotron-3-super-120b-a12b:free') slots DO exist and both list response_format + structured_outputs in supported_parameters — that side-claim also checks out.

(3) No client-side recovery: narrate() calls _callStream({tier:'medium'}) (Dans-Dungeons/src/ai/narrate.js:53 → src/ai/client.js:42 → bag-of-holding-client/src/llm/client.js chatStream). chatStream's only recovery is 'if (res.status === 400 && tier !== "medium") retry at medium' (client.js:109) — skipped because tier IS medium; any other !ok status throws ApiError (client.js:112-113). The non-stream call() has the same medium-tier guard (client.js:52) and its 429 fallback chain fires only on err.status === 429 (client.js:55). chatStream has NO 429 chain at all. Even the hypothetical 200-with-empty-stream path fails identically: JSON.parse('') → repairJson → call() → same dead model. Worse than claimed: I checked all four FREE_FALLBACKS medium/large models ('qwen/qwen3-72b:free', 'meta-llama/llama-4-scout:free', 'deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-4-maverick:free') against the live catalog — ALL FOUR are also gone, so even a genuine 429 on a live model would exhaust a chain of dead models.

(4) The turn loop dead-ends: RETRY_DELAYS = [1000, 2000, 4000] (flow.js:1275); the loop at flow.js:1400-1424 retries any error matching /^AI 4\d\d:/ (ApiError.message format is 'AI ${status}: ...', bag-of-holding-client/src/llm/transport.js:14) — 3 retries after the initial attempt, all against the identical dead model since nothing varies between attempts — then prints t('loop.gmUnavailable') (flow.js:1434). classify runs on the tiny tier first and succeeds (that model exists), so every turn burns a working classification call before dying at narration.

The one thing I could not personally observe is the exact status OpenRouter returns for a nonexistent model (the permission system blocked a live call with the app's embedded key), but the verdict is robust to that: 400, 404, or any 4xx all reach the same 'GM unavailable' dead end, and 429's fallback models are themselves delisted. Impact as claimed: the default free/'try' configuration cannot complete a single turn. narrateTravel() degrades to a templated line (narrate.js:28-30), but the core turn narration hard-fails. Severity critical is calibrated correctly.

#### 3.2.2 [CRITICAL · risk] Shared embedded free key + OpenRouter free-model caps make the free tier ~16-25 turns/day for ALL players combined — the 80h goal is impossible on it

flow.js:172-174 ('Shared embedded key — rate-limited.' → setValue('ai.key', _cfg())) gives every free player the same XOR-obfuscated key from tiers.js:9-11. OpenRouter's published limits for :free models (verified 2026-08-07): 20 requests/min and 50 requests/day per account (<$10 credits), 1,000/day with $10+ credits, 'enforced globally across accounts — multiple API keys won't circumvent them'. A turn costs 2-3 LLM calls (classify + narrate + beat check), so the ENTIRE player base shares ~16-25 turns/day (or ~330-500/day if the account holds credits). An 80h campaign needs ~5,000-7,000 requests. Anyone can also extract the key from the public bundle and burn the quota externally.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:172-176`, `Dans-Dungeons/src/ai/tiers.js:9-11`, `Dans-Dungeons/src/game/loop.js:109-160`
- **Impact:** Free tier is architecturally incapable of the 80-hour campaign and collapses the moment more than a couple of users try the demo on the same day; nothing in the UI or docs communicates this.

#### 3.2.3 [HIGH · defect] The entire FREE_FALLBACKS chain is dead model IDs — 429 recovery is a no-op that surfaces a confusing error

All four chat fallback IDs are absent from the live catalog: 'qwen/qwen3-72b:free' (Qwen3 has no 72B — this ID appears to be fictional, never a real OpenRouter model), 'meta-llama/llama-4-scout:free', 'deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-4-maverick:free' (all three exist only as paid IDs now). On a 429, call() walks the chain, each dead model returns 400/404, and the loop rethrows the first non-429 error immediately (client.js:61), so the player sees a model-not-found error instead of the actual rate-limit condition.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:46-50`, `bag-of-holding-client/src/llm/tiers.js:28-32`, `bag-of-holding-client/src/llm/client.js:55-64`
- **Impact:** The one mechanism designed to survive free-tier congestion (the most common free-tier failure) instead converts a retryable 429 into a hard, misleading failure.

#### 3.2.4 [HIGH · defect] TTS default + all 3 fallbacks and the STT default do not exist; OpenRouter hosts no speech models at all — deluxe TTS/STT is dead code that contradicts the project's own design doc

PAID_MODELS.tts = 'openai/gpt-4o-mini-tts-2025-12-15', stt = 'openai/gpt-4o-mini-transcribe' (tiers.js:34-35); TTS_FALLBACKS adds 'x-ai/grok-voice-tts-1.0', 'mistralai/voxtral-mini-tts-2603', 'google/gemini-3.1-flash-tts-preview' (audio.js:13-17). None of the five exist in the catalog; searching the full 400-model list for 'tts', 'transcribe', 'whisper', 'parakeet' yields zero hits (only chat-audio models 'openai/gpt-audio(-mini)'). docs/ideas/05-ai-runtime.md:24-29 itself states OpenRouter is chat-only and prescribes a separate TTS provider + key — the code ignores its own design and POSTs to OpenRouter /audio/speech anyway. CLAUDE.md's tier table lists yet another set (gemini-3.1-flash-tts, nvidia/parakeet-tdt) that matches neither code nor catalog.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:34-35`, `bag-of-holding-client/src/llm/audio.js:13-17`, `bag-of-holding-client/src/llm/audio.js:70-84`, `Dans-Dungeons/docs/ideas/05-ai-runtime.md:24-29`
- **Impact:** Deluxe players who enable TTS/STT (auto-enabled by applyTier('deluxe'), flow.js:124-127) get silent failures on every narration; the roleplay voice mode is non-functional; docs, code, and reality disagree three ways.

#### 3.2.5 [HIGH · defect] Cost meter USD is permanently $0.0000 for all chat spend — usage.cost is in every OpenRouter response but the client only reads total_tokens

accountTokens() reads only data?.usage?.total_tokens (client.js:13-16). Per OpenRouter's current usage-accounting docs (verified 2026-08-07), 'full usage details are now always included automatically in every response' including a 'cost' field (credits charged), delivered in the final SSE message for streams — the old usage:{include:true} opt-in is deprecated. The app's onCost sink (Dans-Dungeons/src/ai/client.js:33) is therefore only ever fired by the TTS char-count heuristic (audio.js:86, hardcoded costPerChar=0.000015) — on a feature whose models don't exist. main.js:30 renders '$' + costUsd.toFixed(4), so a player who has spent real money on deepseek/gemini sees '$0.0000 · 123,456 tok'.

- **Evidence:** `bag-of-holding-client/src/llm/client.js:13-16`, `Dans-Dungeons/src/ai/client.js:31-34`, `bag-of-holding-client/src/llm/audio.js:62`, `bag-of-holding-client/src/llm/audio.js:86`, `Dans-Dungeons/src/main.js:27-34`
- **Impact:** The one promised cost-transparency feature actively misleads: BYOK players believe play is free while their OpenRouter balance drains. Fix is ~3 lines (the cost data is already in every response).

#### 3.2.6 [HIGH · gap] None of the cost controls promised in 05-ai-runtime.md exist: no per-call ledger, no turn/chapter counters, no budget cap, no prompt/packet caching, no transcript compression

The doc commits to per-call records (model id, tier, prompt tokens, completion tokens, estimated USD, agent name), a live turn/chapter/campaign cost counter with tier breakdown, a budget cap that pauses generation, content-hash caching of packets/prompts, and transcript compression (05-ai-runtime.md:129-151). What exists is a single lifetime {tokens, costUsd} pair (spend.js:31) with no model/tier/agent attribution and no prompt/completion split — so even offline price estimation is impossible retroactively. No caching layer exists anywhere in the client (every turn re-sends the full prompt); no budget guard exists on the image or journal paths.

- **Evidence:** `Dans-Dungeons/docs/ideas/05-ai-runtime.md:129-151`, `Dans-Dungeons/src/ai/spend.js:29-34`, `bag-of-holding-client/src/llm/client.js:18-45`
- **Impact:** For an 80h/2400-turn campaign the owner cannot answer 'what does an hour of play cost, and which agent costs it' from telemetry — the exact question the roadmap needs answered before scaling context.

#### 3.2.7 [MEDIUM · risk] Scene images cost ~47x the text turn and are generated every turn with no throttle — the real 80h budget breaker

gemini-2.5-flash-image pricing (verified): image_output $30/M tokens; a standard image is ~1,290 tokens ≈ $0.0387/image. flow.js:1450 requests one per turn whenever settings.sceneImage is on (auto-enabled for deluxe, flow.js:125). Text turn ≈ $0.00083, so images are ~47x the rest of the turn combined: ~$1.16/hour at 30 turns/h, ~$95 per 80h campaign vs ~$2 for all text. The only controls are the on/off setting and the minimized-view skip (flow.js:100); there is no every-Nth-turn, on-room-change, or budget-aware policy. The newer gemini-3.1-flash-lite-image is the same $30/M; 3.1-flash-image is $60/M — no cheap escape via model choice.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:99-112`, `Dans-Dungeons/src/game/flow.js:1450`, `bag-of-holding-client/src/llm/image.js:47-66`
- **Impact:** With sketches on, an 80h campaign costs ~$65-125 in images alone — an order of magnitude over any reasonable per-campaign budget — while contributing nothing to the deterministic game.

#### 3.2.8 [MEDIUM · debt] Every turn pays an LLM classifier round-trip even for chip/compass clicks that are already structured commands

All input paths — free text, action chips, compass buttons, skill chips — funnel through UI.prompt → processTurn(raw) → classify() (loop.js:109). Chip-originated input is canonical text the app itself generated ('go north', 'Attack Snaggle'), yet it is round-tripped through gemini-2.5-flash-lite (~850 input tokens, ~0.5-1.2s latency, ~$0.00011). The CLASSIFIER_SCHEMA also requires a free-text 'reason' field on every response (schemas.js:21), buying debug prose at 4x output price on every turn.

- **Evidence:** `Dans-Dungeons/src/game/loop.js:109`, `Dans-Dungeons/src/ai/classify.js:8-21`, `Dans-Dungeons/src/ai/schemas.js:8-23`
- **Impact:** For chip-heavy players (most players, most turns) roughly a third of per-turn latency and ~13% of per-turn cost is spent re-deriving structure the app already had; on the rate-capped free tier it wastes a third of the daily request quota.

#### 3.2.9 [MEDIUM · defect] Beat check blocks the turn's critical path after narration completes (+0.5-1.2s input lockout every campaign turn)

processTurn awaits maybeAdvanceBeat(narratorResp.narration) (loop.js:160) — a tiny-tier call (classify.js:25-35) — before finalizeTurn/commit and before returning to flow.js, so the input prompt stays locked while a judgment that only affects FUTURE turns' context runs. The comment at loop.js:151-155 explains why (flags must land inside the turn's undo boundary), but that constraint could be met by deferring the check to the start of the next turn instead of the end of this one.

- **Evidence:** `Dans-Dungeons/src/game/loop.js:151-165`, `Dans-Dungeons/src/game/loop.js:173-181`, `Dans-Dungeons/src/ai/classify.js:25-35`
- **Impact:** Every campaign turn feels ~1s slower than it needs to; across 2400 turns that is ~40 minutes of accumulated dead waiting.

#### 3.2.10 [MEDIUM · defect] Streaming narrator sends no response_format schema — malformed JSON costs a full second medium-tier call and seconds of latency

narrate() streams via chatStream, whose request body contains model/messages/temperature/max_tokens/stream only — no response_format (client.js:100-106) — even though NARRATOR_SCHEMA exists and deepseek-v4-pro supports structured_outputs (verified in catalog supported_parameters). JSON discipline rests entirely on the prompt text; on parse failure narrate() falls back to repairJson (narrate.js:55-59), a second full non-streamed medium call with the whole prompt + bad output appended — roughly 2x narrator cost and +3-6s on affected turns.

- **Evidence:** `bag-of-holding-client/src/llm/client.js:93-107`, `Dans-Dungeons/src/ai/narrate.js:53-59`, `Dans-Dungeons/src/ai/schemas.js:96-105`
- **Impact:** An avoidable double-spend/latency-spike tail on the most expensive per-turn call, hit hardest exactly when the configured model is weakest (free tier).

#### 3.2.11 [MEDIUM · inconsistency] Narrator continuity window is 1.5 turns, not the ~10 turns the design docs assume

narrate() takes recentTranscript.slice(-3) (narrate.js:40), but appendTranscript writes TWO entries per turn (player + gm, resolver.js:299-305), so the narrator sees only: last GM narration + this turn's player line + one older entry. 05-ai-runtime.md:139 prescribes 'keep the last ~10 turns verbatim'; 12-context-scoping.md budgets ~600 tokens of transcript. Meanwhile autoplay gets 6 entries (autoplay.js:14) — the autopilot has deeper memory than the GM. Cost of fixing: each additional turn of context ≈ 110 tokens ≈ $0.00005 on deepseek-v4-pro.

- **Evidence:** `Dans-Dungeons/src/ai/narrate.js:40`, `Dans-Dungeons/src/game/resolver.js:299-305`, `Dans-Dungeons/src/ai/autoplay.js:14`, `Dans-Dungeons/docs/ideas/05-ai-runtime.md:138-140`
- **Impact:** The GM forgets anything said two turns ago — visible narrative amnesia (re-introducing enemies, contradicting last-turn details) that undermines the 'coherent campaign' goal, for a saving of five thousandths of a cent per turn.

#### 3.2.12 [LOW · debt] Turn-level retry re-bills the classifier when only the narrator failed

flow.js retries the entire processTurn on any 4xx (flow.js:1400-1424, RETRY_DELAYS [1000,2000,4000] at :1275), so a narrator failure re-runs (and re-pays) the classifier up to 3 more times. processTurn is a monolith with no per-phase resume.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1275`, `Dans-Dungeons/src/game/flow.js:1400-1424`, `Dans-Dungeons/src/game/loop.js:91-168`
- **Impact:** During a narrator outage each player turn burns up to 4 classifier calls; on the 50-req/day free quota that matters more than the pennies.

#### 3.2.13 [LOW · debt] Pretty-printed JSON in prompts adds ~12% input tokens for zero model benefit

classify.js:10 and narrate.js:44-45 embed JSON.stringify(x, null, 2). Measured on a representative campaign scene: 2,634 chars pretty vs 2,066 minified — ~140 wasted tokens per embedding, paid twice per turn (classifier + narrator), plus dialogue.js:15 does the same.

- **Evidence:** `Dans-Dungeons/src/ai/classify.js:9-11`, `Dans-Dungeons/src/ai/narrate.js:42-46`, `Dans-Dungeons/src/ai/dialogue.js:15`
- **Impact:** ~280 tokens/turn ≈ 11% of turn input ≈ $0.20 per 80h campaign today — trivial now, but it scales linearly with the context-scoping packet and is a one-line fix.

#### 3.2.14 [LOW · inconsistency] Model tables duplicated between app and library, and CLAUDE.md's tier table matches neither

Dans-Dungeons/src/ai/tiers.js:16-50 and bag-of-holding-client/src/llm/tiers.js:9-32 carry identical FREE/PAID/FALLBACK tables (two places to update when IDs die — which they just did). CLAUDE.md's 'AI model tiers' table lists 'gemini-3.1-flash-tts' and 'nvidia/parakeet-tdt', matching neither file.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:16-50`, `bag-of-holding-client/src/llm/tiers.js:9-32`
- **Impact:** Model-rot fixes must be made twice or they silently diverge; docs already lie about the defaults.

#### 3.2.15 [LOW · gap] No prompt-prefix cache exploitation despite 12-120x cached-input discounts on the configured paid models

deepseek-v4-pro lists input_cache_read at $0.003625/M (1/120th of the $0.435/M prompt price); gemini-2.5-flash-lite lists $0.01/M reads (1/10th). Both providers cache automatically by prompt prefix, but the prompt layouts put volatile content early (classifierPrompt embeds the scene ~350 chars in; narratorPrompt puts the transcript before the static-ish rules tail), and the ~250-token static prefix is below Gemini's implicit-cache minimum. No layout decision anywhere considers cacheability.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json (ai.classifierPrompt, ai.narratorPrompt)`, `Dans-Dungeons/src/ai/narrate.js:42-51`
- **Impact:** Irrelevant at today's ~1.3k-token prompts, but when context scoping grows packets to 2-5k tokens the stable digest tree becomes the bulk of input; cache-hostile ordering forfeits a 50-80% input-cost reduction that is nearly free to claim now.

### 3.3 Recommendations

#### 3.3.1 [P0 · effort S] Replace all dead model IDs and add a boot-time model-availability check against /api/v1/models

Nine configured IDs (free medium, all 4 chat fallbacks, TTS default + 3 fallbacks, STT default) are absent from the live catalog; the free tier cannot play at all. The models endpoint is public, free, and returns pricing + supported_parameters — validate configured IDs at boot, substitute live alternatives (e.g. medium: 'openai/gpt-oss-20b:free' or 'nvidia/nemotron-3-super-120b-a12b:free' for free; fallbacks from the current 14 :free models), and surface 'model X unavailable, using Y' instead of failing turns. Model rot WILL recur — this must be systematic, not a one-time ID swap.

```js
// boot: const live = new Set((await fetch(base+'/models').then(r=>r.json())).data.map(m=>m.id));
for (const [tier, id] of Object.entries(models)) {
  if (id && !live.has(id)) models[tier] = pickFallback(tier, live); // first live entry of a candidate list
}
```

#### 3.3.2 [P0 · effort S] Feed usage.cost into onCost so the meter shows real dollars

OpenRouter now includes usage (with a cost field) in every response, including the final SSE chunk. Three lines in accountTokens turn the permanently-$0.0000 meter into accurate real-money accounting for every chat call — the highest value-per-line fix in the codebase, and a prerequisite for any budget cap.

```js
function accountTokens(config, data) {
  const u = data?.usage;
  if (!u) return;
  if (u.total_tokens) config.onTokens?.(u.total_tokens);
  if (u.cost)         config.onCost?.(u.cost);   // real credits charged, incl. streaming final chunk
}
```

#### 3.3.3 [P1 · effort S] Ration scene images: generate on room change (or every Nth turn) with a manual 'sketch this' chip

Images are ~$0.039 each and dominate everything: per-turn generation is ~$95/80h vs ~$2 for all text. One image per room entry (~every 5-8 turns) preserves nearly all the atmosphere at ~$12-19/80h and fits any sane budget; a player-triggered sketch chip covers set-piece moments. This single policy change decides whether the 80h campaign costs $5 or $100.

```js
// in flow.js turn epilogue:
const roomChanged = result?._debug?.resolved?.intent === 'move';
if (appState.settings.sceneImage && (roomChanged || turnCount % 8 === 0)) requestSceneImage(...);
```

#### 3.3.4 [P1 · effort M] Bypass the LLM classifier for chip/compass-originated input

Chips emit canonical strings the app authored; parsing them deterministically (id match or regex) removes ~850 input tokens, ~$0.00011 and 0.5-1.2s from most turns, and cuts free-tier request burn by up to a third. Keep classify() only for free text — this is also the 'truly open play falls back on deterministic systems' principle applied to input.

```js
// UI.prompt resolves {text, chip} instead of a bare string; in processTurn:
const classified = input.chip ? intentFromChip(input.chip)            // pure lookup
                              : await classify(input.text, scene);   // LLM only for free text
```

#### 3.3.5 [P1 · effort S] Move the beat check off the turn's critical path

checkBeatFulfilled only affects future turns' story context; awaiting it after the narration stream adds ~1s of input lockout per campaign turn (~40 min over 2400 turns). Run it during the player's reading time and settle it at the start of the next turn (before buildScene), keeping the flag write inside the NEXT turn's undo boundary — or explicitly accept the one-turn flag delay.

```js
// loop.js: don't await — stash the promise
pendingBeatCheck = maybeAdvanceBeat(narratorResp.narration);
// next processTurn, before buildScene():
if (pendingBeatCheck) { await pendingBeatCheck; pendingBeatCheck = null; }
```

#### 3.3.6 [P1 · effort S] Pass NARRATOR_SCHEMA as response_format in the streaming call

deepseek-v4-pro (and the surviving free models except gemma-4-31b) advertise structured_outputs; OpenRouter supports response_format with stream:true. This nearly eliminates repairJson double-spends (2x narrator cost, +3-6s) on the most expensive per-turn call. JsonFieldStreamer already handles the enveloped stream.

```js
// chatStream body, mirroring callOnce:
if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'output', strict: true, schema } };
```

#### 3.3.7 [P2 · effort M] Build the per-call spend ledger + budget cap promised in 05-ai-runtime.md

Record {agent, tier, model, promptTokens, completionTokens, usd, ms} per call (the data is now in every response), keep a bounded ring buffer with per-turn/per-hour rollups, and gate calls behind a session budget with pause-and-confirm. This is the instrument needed to validate every context-scoping decision against real numbers — the doc's 'Phase 3 benchmarking' cannot happen without it.

```js
onUsage: ({agent, tier, model, u, ms}) => ledger.push({t: Date.now(), agent, tier, model,
  pt: u.prompt_tokens, ct: u.completion_tokens, usd: u.cost, ms});
// budget gate before each call: if (spentThisSession + est > cap) await confirmContinue();
```

#### 3.3.8 [P2 · effort S] Widen the narrator transcript window to 8-10 entries (4-5 turns)

slice(-3) entries = 1.5 turns of memory is the source of visible GM amnesia, and the fix costs ~$0.0004/turn (~$1/80h). Align with the docs' ~600-token window; longer term add the rolling chapter summary from 05-ai-runtime.md:139.

```js
const transcriptText = recentTranscript.slice(-10).map(e => `${e.role}: ${e.text}`).join('\n');
```

#### 3.3.9 [P2 · effort M] Make prompts cache-friendly before the scope packet grows: stable-prefix ordering + minified JSON

deepseek-v4-pro cached input is $0.003625/M — 1/120th of fresh input. Order prompts static-rules → world/region digests (stable across turns in a location) → transcript → scene → resolved, and use JSON.stringify(x) (no pretty-print, ~12% input saving today). At the context-scoping target of 2-5k input tokens/turn, prefix cache hits on the digest tree cut narrator input cost by 50-80% for near-zero effort — but only if volatile content stays at the tail.

```js
messages: [
  { role: 'system', content: STATIC_RULES },            // identical every turn → cached
  { role: 'system', content: digestBlock },              // stable per location/chapter
  { role: 'user',   content: transcript + scene + resolved } // volatile tail
]
```

#### 3.3.10 [P3 · effort S] Relabel the free tier honestly and surface remaining quota

With 50 shared requests/day the 'free tier' is a ~20-turn/day global demo. Call it 'Demo', show remaining daily requests (OpenRouter returns rate-limit state on /auth/key and 429 bodies), and steer players toward BYOK — where, at ~$0.025/hour measured, honesty is also the best marketing for the paid path.

### 3.4 Metrics collected

- **pricing_verified:** OpenRouter GET /api/v1/models fetched 2026-08-07; 400 models, total_count=400, links.next=null (complete catalog)
- **prompt_template_chars:** {"classifierPrompt": 715, "narratorPrompt": 1384, "autoplayPrompt": 1088, "beatCheckPrompt": 378, "journalPrompt": 993, "npcDialoguePrompt": 794, "settlementClassifierPrompt": 723}
- **assembled_prompt_measured:** {"scene_json_chars_pretty": 2634, "scene_json_chars_minified": 2066, "classifier_system_chars": 3340, "narrator_system_chars": 4987, "autoplay_system_chars": 4505}
- **per_turn_tokens_campaign_est:** {"classifier_in": 850, "classifier_out": 60, "narrator_in": 1300, "narrator_out": 140, "beatcheck_in": 180, "beatcheck_out": 40, "turn_total_in": 2280, "turn_total_out": 240, "estimator": "chars/4 (JSON-heavy text; true tokenization ~3.3-3.6 chars/tok, so treat as -0/+20%)", "autoplay_extra_in": 1130, "autoplay_extra_out": 20}
- **verified_model_pricing_usd_per_M:** {"google/gemini-2.5-flash-lite": {"in": 0.1, "out": 0.4, "cache_read": 0.01}, "deepseek/deepseek-v4-pro": {"in": 0.435, "out": 0.87, "cache_read": 0.003625, "ctx": 1048576}, "google/gemini-2.5-flash-image": {"in": 0.3, "image_output_per_M_tok": 30, "per_image_1290tok": 0.0387}, "openai/gpt-oss-120b_paid": {"in": 0.037, "out": 0.17}}
- **dead_model_ids:** ["openai/gpt-oss-120b:free (free medium/narrator)", "qwen/qwen3-72b:free (likely never existed)", "meta-llama/llama-4-scout:free", "deepseek/deepseek-chat-v3-0324:free", "meta-llama/llama-4-maverick:free", "openai/gpt-4o-mini-tts-2025-12-15", "x-ai/grok-voice-tts-1.0", "mistralai/voxtral-mini-tts-2603", "google/gemini-3.1-flash-tts-preview", "openai/gpt-4o-mini-transcribe"]
- **alive_model_ids:** ["google/gemma-4-26b-a4b-it:free (structured outputs OK)", "nvidia/nemotron-3-super-120b-a12b:free (structured outputs OK)", "google/gemini-2.5-flash-lite", "deepseek/deepseek-v4-pro", "google/gemini-2.5-flash-image"]
- **cost_per_call_usd_paid_tier:** {"classify": 0.000109, "beat_check": 3.4e-05, "autoplay": 0.000121, "narrate": 0.000687, "scene_image": 0.0387, "worldgen_campaign_start_5calls": 0.0046, "tts_per_turn_if_it_worked_350chars": 0.00525}
- **cost_per_turn_usd:** {"text_only_campaign": 0.00083, "with_image": 0.0395, "image_to_text_ratio": 47}
- **cost_per_hour_usd:** {"20_turns": {"text": 0.017, "with_images": 0.79}, "30_turns": {"text": 0.025, "with_images": 1.19}, "40_turns": {"text": 0.033, "with_images": 1.58}}
- **cost_80h_campaign_usd:** {"text_only": {"1600_turns": 1.33, "2400_turns": 1.99, "3200_turns": 2.66}, "images_every_turn": {"1600_turns": 63.25, "2400_turns": 94.87, "3200_turns": 126.5}, "images_per_room_change_every_6_turns_2400": 15.5, "tts_2400_turns_heuristic": 12.6}
- **context_scoping_projection_usd:** {"median_turn_2k_in_300_out": 0.001274, "setpiece_turn_5k_in_600_out": 0.00284, "blended_90_10_per_turn": 0.001431, "campaign_80h_2400_turns": 3.43}
- **budget_target:** {"proposed_per_hour_usd": 0.25, "proposed_per_80h_campaign_usd": 20, "rationale": "AAA title = ~$70/80h = $0.87/h; LLM spend at <=30% of that reads as game-priced, not subscription-priced. Text is 10x under target even with scoping; images must be rationed to ~1 per room change to fit.", "text_headroom_vs_target": "~6-10x under", "images_every_turn_vs_target": "~5x OVER"}
- **latency_budget_seconds_paid_tier:** {"classify": "0.5-1.2", "resolve_pure_js": "<0.001", "narrator_ttft_after_classify": "0.5-1.5", "first_visible_text_after_submit": "1.2-2.5", "narration_stream_140tok": "1.5-3.5", "beat_check_blocking_tail": "0.5-1.2", "total_turn_wall_time": "3.5-7", "sequential_chain": "classify -> resolve -> narrate -> beatCheck all sequential; image + TTS correctly off critical path; beatCheck and chip-classify are the removable ~2s"}
- **free_tier_limits_verified:** {"requests_per_min": 20, "requests_per_day_under_10_credits": 50, "requests_per_day_with_10_credits": 1000, "calls_per_turn": "2-3", "turns_per_day_shared_across_all_free_players": "16-25", "requests_needed_80h_campaign": "5000-7000"}
- **accounting_coverage:** {"chat_tokens": "counted (usage in every response incl. final SSE chunk)", "chat_usd": "NOT counted - usage.cost ignored, meter shows $0.0000", "image_tokens": "counted via generateImage onTokens", "image_usd": "not counted", "tts_usd": "heuristic $15/M chars, models dead", "per_call_attribution": "none (single lifetime {tokens, costUsd})"}
- **ai_runtime_loc:** {"Dans-Dungeons/src/ai": 698, "bag-of-holding-client/src/llm": 500}
- **worldgen_pipeline:** {"calls": 5, "tier": "medium", "maxTokens_caps": [1000, 2000, 1200, 800, 3000], "est_cost_usd": 0.005}
- **assumptions:** ["turns/hour: 20-40 (tables use 30 as midpoint = 2400 turns/80h)", "campaign-mode turn = classify + narrate + beatCheck; autoplay off; settlement/travel turns are cheaper (tiny-only or 220-tok medium)", "token estimate chars/4 on measured assembled prompts; representative scene: 2-NPC combat room, 3 exits, 2 loot, 4-digest worldContext, full story block", "narration output ~140 tok (2-4 sentence target + JSON envelope), caps: tiny 250 / medium 700", "image = 1290 output tokens (standard Gemini image tokenization)"]


---

## 4. State & Persistence — Spektrum, saves, the 80h storage wall

> Auditor: `state-persistence` · strengths 7 · findings 14 · recommendations 10

The state layer is far better engineered than the owner's "inconsistent mess" framing suggests — at small scale. Every write in src/ goes through Spektrum's setValue/addValue (a grep for direct appState mutation/push/splice finds zero hits), saves use a versioned envelope with an ordered migration runner from bag-of-holding-client (vendored copy verified byte-identical to the sibling repo, node-tested), derived character sheets are re-derived on load rather than trusted, and the time-travel system (undo/redo/branching/persisted epochs/seeded dice) is a genuinely sophisticated, well-documented, and mostly sound piece of design with real tests pinning the engine contract. The AI-spend meter deliberately living outside replayable history is exactly the right call and is documented as such.

The problem is that the persistence architecture is quantitatively incompatible with the 80-hour goal, and the failure mode is silent data loss. The save format embeds the full transcript O(epoch-turns) times: appendTranscript records the entire transcript array as one history entry every turn, the persisted _timeTravel blob's spine carries one such full-array copy per turn plus a full deep-cloned state root, and MAX_TT_ENTRIES caps entry count (500), not bytes. My simulation (with the repo's own generator: quick-dungeon world = 4.4KB, ~700 bytes of transcript per turn) puts the localStorage save at ~4.5MB by turn 200 and ~9MB by turn 400 — i.e. the ~5MB quota dies somewhere around 5–10 hours of play, roughly 10% of the target. When that happens, saveEnvelope swallows the QuotaExceededError and saveToStorage only console.warns: the player keeps playing with zero persistence and loses everything since the last successful write on reload. docs/ideas/06-persistence.md correctly calls the IndexedDB split "essential, not optional... We design for it from day one" — but there is not a single indexedDB reference in src/, no navigator.storage.estimate monitoring, and no beforeunload flush.

There are also real correctness defects: exportSave writes the player's OpenRouter API key into the shareable .dnd.json (doc 06 explicitly positions the export as a share format); importing a save mid-session never reroutes the flow FSM, so a settlement save imported inside a dungeon playLoop leaves the game driving the wrong loop; the reconcilePc "never trust the persisted sheet" invariant is silently defeated whenever a time-travel blob loads (the spine replay restores the stale sheet after reconciliation); and roughly a dozen main.js handlers call saveToStorage() immediately after setValue() without a tick, persisting the pre-write state. Versioning-wise, the envelope mechanism is good but the discipline is not exercised: SAVE_VERSION=2 with only an identity migration, while real shape changes (campaign world fields, session.rng, quests, factionReputation) shipped un-versioned, surviving only via pervasive optional chaining — a 2-month-old save loads by luck, not by contract, and a future-version save passes through with no guard despite the doc demanding a blocked import.

Verdict: the discipline and the time-travel design are strengths worth keeping; the storage tier, the save-size profile of history entries, and the quota failure UX must be rebuilt before any 80-hour campaign is viable. These are known, documented risks (16-time-travel-branching.md §7 even names the mitigation options) — the debt is honest, but it is now the critical path.

### 4.1 What is genuinely good

- **Strict single-writer discipline — no direct state mutation anywhere** — A regex sweep for `appState.x = `, `.push(`, `.splice(` on appState paths across src/ returns zero matches; all mutation flows through setValue/addValue → Spektrum's recorded delta. UI derivations use computed() (registered once at boot in registerReactiveSidebar), which writes outside history so bindings never bloat the mutation log. This is the foundation that makes replay-based undo sound. — evidence: `Dans-Dungeons/src/ui/reactive.js:11-131`, `Dans-Dungeons/src/game/resolver.js:235-306`, `Dans-Dungeons/src/core/state.js:20-26`
- **Versioned save envelope with migration runner, properly extracted and tested** — bag-of-holding-client's envelope.js wraps saves as {v, data}, runs ordered v→v+1 migrations, treats legacy bare snapshots as v0, never throws on write (returns false), and takes an injected storage adapter so it's node-testable. The vendored copy in Dans-Dungeons is byte-identical to the sibling repo (diff confirms), and persistence.test.js passes in the client suite (92/92). File saves and localStorage saves share one shape, so they are interchangeable. — evidence: `bag-of-holding-client/src/persistence/envelope.js:26-66`, `Dans-Dungeons/src/core/state.js:137-194`
- **Time-travel architecture is sophisticated and mostly sound** — Epoch scoping via context signatures prevents replay across world swaps; branches are stored root-relative (explicitly fixing a real index-invalidation bug found in Phase 3); branch swaps land at the divergence point so the tree is navigable in both directions; importTimeTravel is failsafed (try/catch + invariant guard matchesSaved) so a corrupt blob can never block loading — worst case is 'no history', verified by the fallback re-restore in main.js. The engine contract is pinned by tests against the vendored Spektrum. — evidence: `Dans-Dungeons/src/game/undo.js:88-123`, `Dans-Dungeons/src/game/undo.js:190-209`, `Dans-Dungeons/src/game/undo.js:394-427`, `Dans-Dungeons/src/main.js:204-213`, `Dans-Dungeons/tests/timetravel.test.js:19-76`, `Dans-Dungeons/docs/ideas/16-time-travel-branching.md:146-163`
- **Seeded, auditable dice as recorded state** — session.rng {seed, cursor} lives in appState, so a scrub restores the exact RNG position: re-issuing the same action reproduces the roll, a different action diverges — dice are a deterministic function of the choice sequence. The rollLog is verifyLog-replayable from the seed (window.verifyRolls console audit + sidebar button). This is exactly the deterministic-fallback substrate the 80h open-play goal needs. — evidence: `Dans-Dungeons/src/game/rng.js:1-132`, `Dans-Dungeons/src/main.js:74-80`
- **Defensive load path: sheets re-derived, plain load never blocked** — On every load/import the derived sheet is rebuilt from the character record via reconcilePc ('never trust the persisted sheet, which may have been produced by an older rules engine') — genuine forward-compat thinking. The time-travel reconstruction is strictly additive: any failure falls back to the plain restored save. — evidence: `Dans-Dungeons/src/main.js:156-160`, `Dans-Dungeons/src/ui/exports.js:98-104`
- **Deliberate, documented out-of-history side effects** — src/ai/spend.js keeps real cumulative AI spend in a module variable + localStorage precisely so undo cannot rewind money actually spent, with the per-timeline figure kept separately in appState.ai for debugging. The decision table in doc 16 §9 shows each out-of-history surface (scene image, spend, transcript) was reasoned about, not forgotten. — evidence: `Dans-Dungeons/src/ai/spend.js:1-34`, `Dans-Dungeons/docs/ideas/16-time-travel-branching.md:247-254`
- **Awareness of history-entry size, partially acted on** — resolver.js's commitAll targets 'the smallest sub-path that actually changes, NOT the whole world/party object' with an explicit rationale comment, and story.js was refactored (commit 114bdef) to narrow sub-path writes for the same reason. The commit() helper (makeCommit) closes the tick-then-save footgun at the API level. — evidence: `Dans-Dungeons/src/game/resolver.js:245-250`, `Dans-Dungeons/src/game/story.js:9-13`, `Dans-Dungeons/src/core/state.js:200-203`

### 4.2 Findings

#### 4.2.1 [CRITICAL · defect] Save size grows O(turns × epoch-turns); localStorage quota exhausted around turn 200-400 (~5-10 hours), 10% of the 80h target

appendTranscript records the FULL transcript array as one history entry each turn (`setValue('transcript', [...(appState.transcript ?? []), {player}, {gm}])`). The persisted _timeTravel blob (state.js buildSaveSnapshot → undo.js buildTimeTravelBlob) stores the epoch spine — so one full-transcript copy per turn of the epoch — plus `root`, a deep-cloned copy of the ENTIRE persisted state. MAX_TT_ENTRIES=500 caps entry COUNT, not bytes (a 60-turn epoch is ~400-500 entries and passes the cap while carrying megabytes). Measured with the repo's own generator: quick-dungeon world JSON = 4,437 bytes, per-turn transcript ≈ 700 bytes; simulated save = state + root + 25-turn spine ≈ 4.5MB at turn 200, 9.1MB at turn 400. session.rollLog is likewise rewritten wholesale per combat turn (rng.js:120), adding another O(epoch²) term. The 13 whole-world setValue('world', …) sites in flow.js put multi-KB world copies into the spine as well.

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:299-306`, `Dans-Dungeons/src/game/undo.js:368-384`, `Dans-Dungeons/src/game/undo.js:82`, `Dans-Dungeons/src/core/state.js:162-173`, `Dans-Dungeons/src/game/rng.js:116-121`, `Dans-Dungeons/src/game/flow.js:976-987`
- **Impact:** A campaign hits the ~5MB origin quota within a single evening of play; every autosave after that fails. The 80-hour goal is architecturally unreachable with this save shape.
- **Independent verification: PARTIAL** — The core mechanism is real and I confirmed it by code trace plus independent simulation, but two supporting details are wrong and the impact statement ("every autosave after that fails", "architecturally unreachable") overstates a self-healing failure mode. CONFIRMED parts: (1) appendTranscript rewrites the FULL transcript array as one history entry per turn (Dans-Dungeons/src/game/resolver.js:301-305), and the persisted spine is a raw slice of those entries (Dans-Dungeons/src/game/undo.js:371), so spine bytes grow O(epoch-turns × total-turns); (2) the blob also embeds `root`, a deep clone of the entire persisted state including the full transcript and world (Dans-Dungeons/src/game/undo.js:100, src/core/state.js:158-160); (3) MAX_TT_ENTRIES=500 caps entry count, not bytes (undo.js:82, 373-375) — my simulation of the exact envelope shape shows a 175-entry, 25-turn spine passing the cap at 3.7MB (turn 200), 5.7MB (turn 300), 7.6MB (turn 400), and a 50-turn epoch at turn 200 hitting 6.8MB; (4) commitRoller rewrites session.rollLog wholesale per combat turn (Dans-Dungeons/src/game/rng.js:120) — O(epoch²), though bounded per dungeon since seedCombat resets it on entry (src/game/flow.js:1169, rng.js:29-31); (5) quota failure is swallowed silently — saveEnvelope catches the throw and returns false (bag-of-holding-client/src/persistence/envelope.js:60-65) and saveToStorage only console.warns (src/core/state.js:169-173), with no fallback retry without _timeTravel; autosave runs every turn (src/game/loop.js:164-165). Quota headroom is further shared with sketch-last-image (base64 image, src/ui/sketch.js:13) and dg-journal-cache (src/ai/journal.js:20). REFUTED parts: (a) the failure is NOT permanent — clearTurnMarks resets the epoch on dungeon entry, return to town, and game end (flow.js:280, 416, 891, 1153, 1500), after which buildTimeTravelBlob returns null (_stops.length < 2, undo.js:369) and the save shrinks to the O(turns) baseline (~0.3MB at turn 400), so autosaves recover between dungeons; an epoch exceeding 500 entries (~60-80 turns at ~6-8 recorded entries/turn) is likewise simply not persisted (undo.js:373-375). The real defect is a recurring SILENT per-dungeon window in mid/late campaign where every per-turn autosave fails with only a console.warn — closing the tab then loses the whole dungeon run — not a permanently bricked save. (b) The "13 whole-world setValue('world',…) sites in flow.js land in the spine" sub-claim is wrong: all 14 such sites execute outside persisted epochs — worldgen/boot (flow.js:319, 388, 1140, 1165, 1172, 1299), settlement context where no marks exist because only processTurn creates them and settlements are menu-driven (417, 687, 702, 847, 890), travel encounters where beginTurn returns null (undo.js:97; flow.js:976, 1036), and post-victory resolveDungeonQuests (847) lands after the head stop, outside the spine slice. Per-turn story writes were deliberately narrowed to sub-paths with a comment stating exactly this rationale (src/game/story.js:9-13, 29, 43). Severity calibration: high (recurring silent data-loss windows that worsen with campaign length, plus multi-MB JSON.stringify per turn), not critical-as-stated. Separately noteworthy: even without time-travel, the never-trimmed transcript (reset only at new game, flow.js:283) puts the plain save at ~3.5MB by ~4800 turns, so the O(turns) baseline alone also nears quota at the 80h horizon.
  - *Corrected detail:* The quadratic save-shape mechanism is real: each turn's spine entry carries the full transcript (resolver.js:301-305, undo.js:371), the root duplicates the entire persisted state (undo.js:100), MAX_TT_ENTRIES caps entries not bytes (undo.js:373), rollLog is rewritten wholesale per combat turn (rng.js:120), and quota failures are silently swallowed (envelope.js:60-65, state.js:169-173). Verified sizes: ~3.7MB at turn 200 / ~7.6MB at turn 400 with 25-turn epochs; ~6.8MB at turn 200 with a 50-turn epoch — all under the 500-entry cap. BUT the failure self-heals: clearTurnMarks on dungeon entry/exit/game-end (flow.js:280, 416, 891, 1153, 1500) and the >500-entry omission (undo.js:373-375) shrink the save back to an O(turns) baseline (~0.3MB at turn 400), so autosaves recover between dungeons. The actual defect is a recurring, silent, per-dungeon autosave-failure window in mid/late campaign (data loss = the current dungeon run if the tab closes), not permanently failing saves. Also, the 13-14 whole-world setValue('world',…) sites in flow.js do NOT land in any persisted spine — they all run outside epochs (settlements/travel/worldgen/post-victory; encounters excluded via undo.js:97), and per-turn story writes are already narrowed sub-path writes (story.js:9-13). Severity: high (with a genuine long-horizon O(turns) transcript concern for the 80h goal), not critical-as-stated.

#### 4.2.2 [CRITICAL · defect] Quota failure is silent — play continues with zero persistence, then total loss on reload

saveEnvelope catches the storage write exception and returns false ('Never throws'); saveToStorage's only response is `console.warn('[state] localStorage save failed')`. There is no player-facing warning, no autosave-stopped state, no export prompt, no navigator.storage.estimate monitoring. docs/ideas/06-persistence.md:90-95 explicitly specifies the opposite: 'If a write fails for QuotaExceededError: stop autosave, surface a blocking modal, suggest export. Never lose in-memory state silently.' The other quota catch sites (journal cache, sketch image, spend, world bible) are the same silent `catch { /* quota */ }` pattern.

- **Evidence:** `Dans-Dungeons/src/core/state.js:169-173`, `bag-of-holding-client/src/persistence/envelope.js:58-66`, `Dans-Dungeons/docs/ideas/06-persistence.md:90-95`, `Dans-Dungeons/src/ai/journal.js:20`, `Dans-Dungeons/src/ui/sketch.js:13`
- **Impact:** Once quota is hit (see previous finding), hours of play evaporate on the next reload with no warning whatsoever — the worst possible data-loss UX, on a guaranteed-to-occur path.
- **Independent verification: CONFIRMED** — Traced the full path and the defect is real as stated. bag-of-holding-client/src/persistence/envelope.js:58-66 wraps storage.setItem in try/catch and returns false ("Never throws"). Dans-Dungeons/src/core/state.js:169-173 responds to false with only console.warn('[state] localStorage save failed') and itself returns undefined, so none of the ~40 saveToStorage()/commit() call sites (loop.js:165,209; flow.js; main.js; undo.js:169,263) can even detect failure — autosave keeps firing and silently failing forever. navigator.storage.estimate and QuotaExceededError appear ONLY in docs/ideas/06-persistence.md (lines 90-91), nowhere in src/; there is no modal, toast, autosave-stopped state, export prompt, or beforeunload flush. The doc spec at docs/ideas/06-persistence.md:88-95 indeed specifies the exact opposite ("stop autosave, surface a blocking modal, suggest export. Never lose in-memory state silently"). All other cited catch sites verified as the same silent pattern: src/ai/journal.js:20, src/ui/sketch.js:13, src/ai/spend.js:24, src/ui/exports.js:293-295. Aggravator the auditor missed: src/game/flow.js:251 — the explicit /save command prints t('meta.saved') ("saved" success message) unconditionally after saveToStorage(), so on quota exhaustion the player is actively told the save succeeded when it failed. Two minor calibration notes that do not change the verdict: (1) "total loss on reload" is more precisely "loss of everything since the last successful write" — loadFromStorage (state.js:175-180) still loads the stale pre-quota save, which on a long session still means hours of play lost; (2) 06-persistence.md is marked "Status: rough sketch", so it is an idea doc rather than a committed spec, but it does explicitly specify the opposite behavior, and the same doc concedes quota exhaustion is expected ("A 100-hour world plus its transcript will absolutely exceed localStorage's ~5MB quota", lines 18-20), supporting the "guaranteed-to-occur path" impact framing.

#### 4.2.3 [HIGH · defect] Player's OpenRouter API key is written into the shareable .dnd.json save export

PERSIST_KEYS includes 'ai' (state.js:147), and appState.ai.key holds the player's pasted key, OAuth-exchanged key, or the embedded shared free-tier key. serializeSave() → exportSave() therefore embeds the live credential in the downloaded save file. doc 06:66-69 positions this exact file as the share format ('another player can import the file and play the same world'). Import symmetrically overwrites the importing player's key with whatever is in the file.

- **Evidence:** `Dans-Dungeons/src/core/state.js:147`, `Dans-Dungeons/src/core/state.js:185-187`, `Dans-Dungeons/src/ui/exports.js:72-77`, `Dans-Dungeons/docs/ideas/06-persistence.md:66-69`
- **Impact:** Sharing a save leaks a paid API credential (financial exposure on the player's OpenRouter account); the embedded free-tier key also leaks to anyone the file reaches.

#### 4.2.4 [HIGH · gap] IndexedDB tier promised as 'essential, not optional' is entirely absent

doc 06's storage-tier table assigns full world layers, archived transcript, chapter snapshots, and caches to IndexedDB, stating 'A 100-hour world plus its transcript will absolutely exceed localStorage's ~5MB quota, so the split is essential, not optional. We design for it from day one.' grep for indexedDB/navigator.storage across src/ returns zero matches. Instead, six localStorage keys (dans-dungeons, dg-journal-cache, dg-world-bible, sketch-last-image — a data-URI image potentially approaching 1MB per write — dans-dungeons-spend, dg-locale) all contend for the same single origin quota.

- **Evidence:** `Dans-Dungeons/docs/ideas/06-persistence.md:5-20`, `Dans-Dungeons/src/ui/sketch.js:13`, `Dans-Dungeons/src/ui/exports.js:294`, `Dans-Dungeons/src/ai/journal.js:9-20`
- **Impact:** No storage headroom exists for the 80h goal even after the save-shape fix; the doc's own architecture was never started.

#### 4.2.5 [HIGH · risk] Unbounded in-memory Spektrum history + full-state snapshots every ~3 turns

createSpektrum({ snapshotEvery: 25 }) sets no historyLimit (doc 16 §10 says avoid it because replay below the window is undefined). history entries include a full transcript copy per turn and full world copies at each flow.js whole-world write, and every 25 entries Spektrum deepClones the ENTIRE merged state into `snapshots` (vendor/spektrum.js record()). clearTurnMarks resets the undo stops but never truncates Spektrum's history or snapshots, so within one browser session both grow monotonically across epochs for the whole sitting.

- **Evidence:** `Dans-Dungeons/src/core/state.js:18`, `Dans-Dungeons/vendor/spektrum.js:385-392`, `Dans-Dungeons/src/game/undo.js:174-182`, `Dans-Dungeons/docs/ideas/16-time-travel-branching.md:256-264`
- **Impact:** A long sitting accumulates hundreds of MB of JS heap (each snapshot ≈ full state, taken every ~3 turns); tab slowdown/crash risk well before an 80h campaign's session lengths.

#### 4.2.6 [HIGH · defect] Importing a save mid-session never reroutes the game flow FSM

handleImportFile restores the snapshot, reconciles the PC, rebuilds time-travel, and commits — but never calls resumeGame() or reloads. The currently-running async loop (playLoop for dungeons, settlementLoop/enterSettlement for towns, both awaiting UI.prompt) keeps executing its old control flow against the newly imported state. Importing a settlement save while inside a dungeon playLoop leaves the dungeon loop driving a world whose location.type is 'settlement' (wrong chips, wrong victory checks); the reverse strands the settlement loop on a dungeon world.

- **Evidence:** `Dans-Dungeons/src/ui/exports.js:83-113`, `Dans-Dungeons/src/game/flow.js:1277-1314`, `Dans-Dungeons/src/game/flow.js:1512-1539`
- **Impact:** The import feature — the doc's designated mechanism for backups and parallel campaigns — visibly breaks the game whenever the imported save's context differs from the live one, until the player happens to refresh.

#### 4.2.7 [MEDIUM · inconsistency] Save versioning mechanism exists but is not exercised; old saves survive by optional chaining, not migrations

SAVE_VERSION=2 with SAVE_MIGRATIONS = { 1: identity }. Meanwhile real shape changes shipped without bumps: campaign world fields (blueprint, regions, settlements, dungeons, redThread, quests, factionReputation), session.rng/rollLog, settings additions. restoreState does whole-subtree setValue per top-level key, so an old save's `world`/`session` replaces DEFAULTS wholesale and newer nested defaults are dropped — consumers survive only because nearly every read is `?.`/`?? {}`. There is also no forward-version guard: loadEnvelope's migration loop simply doesn't run for v > currentVersion and the newer data passes straight through, though doc 06:76-78 demands 'Missing migrator = blocked import with a clear error'. No appVersion/meta stamp is stored.

- **Evidence:** `Dans-Dungeons/src/core/state.js:144-153`, `Dans-Dungeons/src/core/state.js:124-129`, `bag-of-holding-client/src/persistence/envelope.js:43-46`, `Dans-Dungeons/docs/ideas/06-persistence.md:71-78`
- **Impact:** A 2-month-old save probably loads today, but each refactor is a coin flip; a save from a NEWER build loads silently into older code with undefined results. The migration path the envelope was built for is not being used.

#### 4.2.8 [MEDIUM · defect] reconcilePc invariant defeated whenever a time-travel blob loads

main.js:159 re-derives the sheet from the record ('never trust the persisted sheet'), but importTimeTravel (main.js:207) then restores tt.root and replays the spine — both containing the STALE persisted party.pc — and no reconcilePc runs afterwards. matchesSaved compares replayed-vs-saved (both stale), so the guard passes. Same ordering bug in exports.js:100-104.

- **Evidence:** `Dans-Dungeons/src/main.js:156-213`, `Dans-Dungeons/src/ui/exports.js:97-104`, `Dans-Dungeons/src/game/undo.js:394-438`
- **Impact:** After any rules-engine change, saves that carry undo history resurrect outdated derived stats (AC/HP max/attack bonuses) while saves without history load correctly — an inconsistency that will look like random rule bugs.

#### 4.2.9 [MEDIUM · defect] setValue(); saveToStorage() without tick persists the pre-write state in ~8 main.js handlers

setValue only writes Spektrum's delta; appState merges on the next tick (the rAF pump). pickPersisted reads appState directly, so the toggle handlers for actionBar, debugBar, sceneImage, tts, roleplayMode, autoplay, and the OAuth key path (setValue('ai.key', key); saveToStorage()) all serialize state that does not yet contain the write. The stored save is one write stale until the next successful save. state.js:200-203 built commit() exactly to close this footgun ('Replaces the repeated, easy-to-forget tick(); saveToStorage() pair') — main.js just doesn't use it.

- **Evidence:** `Dans-Dungeons/src/main.js:62-70`, `Dans-Dungeons/src/main.js:82-120`, `Dans-Dungeons/src/main.js:173-176`, `Dans-Dungeons/src/core/state.js:158-160`, `Dans-Dungeons/src/core/state.js:200-203`
- **Impact:** Bounded but real: toggle a setting (or complete OAuth) then close the tab, and the change is lost; a recurring class of 'my setting didn't stick' bugs.

#### 4.2.10 [MEDIUM · inconsistency] Whole-world writes contradict the narrow-write doctrine and break the DEFAULTS shape contract

state.js promises 'the shape is always predictable regardless of restore order', and resolver.js documents that every write must target 'the smallest sub-path that actually changes, NOT the whole world'. Yet flow.js contains 13 setValue('world', …) whole-object writes; startQuickDungeon's `setValue('world', world)` replaces the entire world with generator output ({currentRoom, exitRoomId, rooms, npcs} — verified in world.js) — silently deleting location, redThread, quests, factionReputation, regions, settlements, dungeons. Every consumer must defensive-read; each such write also lands a full world copy in history and the persisted spine.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:319`, `Dans-Dungeons/src/game/world.js:44-57`, `Dans-Dungeons/src/core/state.js:3-5`, `Dans-Dungeons/src/game/resolver.js:245-250`, `Dans-Dungeons/src/game/flow.js:417,687,847,890,976,1036,1140,1165,1172,1299`
- **Impact:** Shape drift forces `?.`-everywhere coding, inflates history/save size, and makes 'what is world right now' unanswerable without reading all 13 call sites — a direct contributor to the 'inconsistent mess' feeling.

#### 4.2.11 [MEDIUM · defect] Corrupt save = silent new game; no warning, no backup of the corrupt blob

loadEnvelope returns null for unparseable JSON; boot's `if (save)` falls through and (phase !== 'play') startNewGame() runs. The corrupt blob is left in place until the new game's first commit overwrites it. The player is never told a save existed and failed to load; nothing is copied aside for recovery. Doc 06 requires explicit errors on failed loads.

- **Evidence:** `bag-of-holding-client/src/persistence/envelope.js:26-33`, `Dans-Dungeons/src/main.js:153-160`, `Dans-Dungeons/src/main.js:217-218`, `Dans-Dungeons/docs/ideas/06-persistence.md:76-78`
- **Impact:** A single bad write (e.g. interrupted during quota pressure) converts silently into 'my whole campaign vanished' — and the evidence is destroyed by the next autosave.

#### 4.2.12 [LOW · debt] Journal cache: collision-prone fingerprint, unbounded growth, never invalidated on restart

The cache fingerprint is the first 60 chars of each narration joined ('_fingerprint'); two narrations sharing a 60-char prefix alias. The cached story grows with the whole game in one localStorage key. /restart calls clearSave() which removes only SAVE_KEY — dg-journal-cache (and dg-world-bible, sketch-last-image) persist into the next campaign until overwritten.

- **Evidence:** `Dans-Dungeons/src/ai/journal.js:24-26`, `Dans-Dungeons/src/ai/journal.js:91-96`, `Dans-Dungeons/src/core/state.js:196-198`, `Dans-Dungeons/src/game/flow.js:250`
- **Impact:** Occasional wrong/stale journal chapters and residual quota pressure from a previous campaign.

#### 4.2.13 [LOW · risk] Time-travel guards couple to DOM state and have one uncovered epoch edge

undo/redo/jump refuse mid-turn by checking `document.getElementById('cmd')?.disabled` — a UI-implementation detail, not a state flag. Separately, finalizeTurn's context-change branch (`_epochSig !== mark.sig`) restarts _stops WITHOUT recapturing _epochRootSnapshot (only beginTurn's `!_stops.length` path does), so if any future transition path forgets clearTurnMarks, a stale root could be persisted with a new epoch's spine; the matchesSaved heuristic (4 invariants) would probably — not certainly — catch the divergence on reload.

- **Evidence:** `Dans-Dungeons/src/game/undo.js:131`, `Dans-Dungeons/src/game/undo.js:96-123`, `Dans-Dungeons/src/game/undo.js:433-438`
- **Impact:** Fragile coupling and a latent corruption path guarded only by a heuristic; currently mitigated because all six transitions do call clearTurnMarks.

#### 4.2.14 [LOW · gap] No beforeunload flush; scene images and journalLog are session-only by design but silently lossy

Doc 06 specifies a best-effort beforeunload flush; none exists (grep hits only the doc). Loss is bounded — every turn ends in commit() — but an in-flight turn's classify/narrate spend is lost on close. The in-memory journalLog + sketchByTurn Map die on reload; createJournal rebuilds text from the transcript but all per-turn images are permanently lost to the EPUB export (only sketch-last-image survives).

- **Evidence:** `Dans-Dungeons/docs/ideas/06-persistence.md:87`, `Dans-Dungeons/src/game/flow.js:42-61`, `Dans-Dungeons/src/ui/exports.js:117-127`
- **Impact:** Reload-then-export produces a journal with no illustrations even though the player paid image-generation tokens for them.

### 4.3 Recommendations

#### 4.3.1 [P0 · effort M] Record transcript appends as narrow per-index writes, not whole-array rewrites

This is the single highest-leverage fix: it converts both in-memory history and the persisted time-travel spine from O(turns²) to O(turns). Spektrum's deepMerge explicitly supports sub-path array writes ('Sub-path edits on arrays produce sources like {items: {1: {…}}}; we merge into the existing array' — vendor/spektrum.js:90-93), so replay semantics are preserved. Apply the same to session.rollLog (append per index) and recordOpening in flow.js.

```js
// resolver.js appendTranscript — one O(1) entry per line instead of a full-array copy
export function appendTranscript(playerText, gmText) {
  const turn = appState.session?.turnCount ?? 0;
  const base = appState.transcript?.length ?? 0;
  setValue(`transcript.${base}`,     { role: 'player', text: playerText, turn });
  setValue(`transcript.${base + 1}`, { role: 'gm',     text: gmText,     turn });
}
// NOTE: audit labelFork/turnLabelBetween in undo.js — they currently sniff
// e.path === 'transcript' with an Array value; match path.startsWith('transcript.') instead.
```

#### 4.3.2 [P0 · effort S] Byte-budget the save and implement the doc-06 quota failure UX

saveToStorage must never fail silently. Measure the serialized size; over a soft budget, drop the _timeTravel blob first (already an accepted degradation — undo.js:373-376), and on an actual write failure surface a persistent in-game banner + export prompt and stop pretending to autosave. This is a small change that eliminates the catastrophic-loss path even before the storage tier is rebuilt.

```js
export function saveToStorage() {
  let snap = buildSaveSnapshot();
  let json = JSON.stringify(wrapEnvelope(snap, SAVE_VERSION));
  if (json.length > SOFT_BUDGET && snap._timeTravel) {          // ~2MB
    delete snap._timeTravel;                                    // degrade: lose undo, keep the game
    json = JSON.stringify(wrapEnvelope(snap, SAVE_VERSION));
  }
  try { localStorage.setItem(SAVE_KEY, json); onSaveOk(); }
  catch (e) { onSaveFailed(json.length); }                      // banner + 'Export now' chip, once
}
```

#### 4.3.3 [P0 · effort S] Strip the API key (and other credentials) from exported save files

The .dnd.json is designed to be shared; it must never carry ai.key. Keep the key in the localStorage save only. On import, ignore any key present in the file rather than overwriting the player's own.

```js
export function serializeSave() {
  const snap = buildSaveSnapshot();
  snap.ai = { ...snap.ai, key: '' };            // never export credentials
  return JSON.stringify(wrapEnvelope(snap, SAVE_VERSION), null, 2);
}
// and in handleImportFile, after parseSave:
if (snap.ai) snap.ai = { ...snap.ai, key: appState.ai?.key ?? '' };
```

#### 4.3.4 [P1 · effort XL] Build the IndexedDB tier the docs already designed (hot/cold split)

Even with narrow transcript writes, an 80h campaign's transcript (~3MB), accumulated dungeons/settlements, journal cache, and sketches cannot share one 5MB localStorage quota. Implement doc 06's split behind a thin storage adapter in bag-of-holding-client (the envelope already takes an injected storage — the seam exists): localStorage keeps session/party/flags/settings + last N transcript turns; IndexedDB stores archived transcript, world layers, chapter snapshots, per-turn sketch images (fixing the lost-illustrations gap too). Add navigator.storage.estimate() monitoring with the 80% warning.

#### 4.3.5 [P1 · effort S] Reload (or re-enter the FSM) after save import

handleImportFile commits the imported state to localStorage before returning, so a location.reload() lands in the normal boot→resumeGame path, which already routes by world.location.type. One line fixes the stale-loop defect; a later refinement can tear down and re-enter the flow without a reload.

```js
commit();
appendEntry('system', t('exports.imported', { file: file.name }));
location.reload();   // boot resumes into the imported context via resumeGame()
```

#### 4.3.6 [P1 · effort M] Re-run reconcilePc after a successful importTimeTravel, and truncate in-memory history at epoch boundaries

Two containment fixes for the time-travel layer: (1) after importTimeTravel returns true, the live pc is the replayed stale one — reconcile again (both main.js and exports.js call sites). (2) clearTurnMarks is the natural point to also compact Spektrum history/snapshots (the epoch that just ended can never be scrubbed again); expose a `truncateHistory()` on the vendored engine that snapshots current state as the new baseline and clears history/snapshots/forks, bounding session memory to one epoch.

```js
if (savedTimeTravel && appState.session?.phase === 'play') {
  if (!importTimeTravel(savedTimeTravel, save)) { restoreState(save); tick(); }
  if (appState.party?.pc) { setValue('party.pc', reconcilePc(appState.party.pc)); tick(); }
}
```

#### 4.3.7 [P2 · effort S] Use commit() everywhere main.js currently does setValue+saveToStorage

The helper exists precisely for this; eight handlers bypass it and persist stale state. Mechanical find/replace with a follow-up lint-style grep in CI (`setValue.*\n.*saveToStorage` in src/) to keep it fixed.

```js
actionBarToggle?.addEventListener('click', () => {
  setValue('settings.actionBar', !(appState.settings?.actionBar ?? true));
  commit();   // tick + save — not saveToStorage() alone
});
```

#### 4.3.8 [P2 · effort M] Make restoreState merge over DEFAULTS and add a forward-version guard + real migration discipline

Deep-merging a save's top-level slices over DEFAULTS keeps newer nested defaults alive under old saves, making shape evolution deliberate instead of accidental. Refuse (with a clear message) envelopes whose v exceeds currentVersion, per doc 06. From now on, any change to a PERSIST_KEYS shape bumps SAVE_VERSION with a real migration — the runner is already built and tested; it just needs to be used.

```js
export function restoreState(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === '_timeTravel') continue;
    const dft = DEFAULTS[key];
    setValue(key, isPlainObject(dft) && isPlainObject(value) ? deepMerge(structuredClone(dft), value) : value);
  }
}
// loadEnvelope caller: if (parsed?.v > SAVE_VERSION) return { error: 'newer-version' };
```

#### 4.3.9 [P2 · effort M] Eliminate the remaining whole-world writes in flow.js

Finish the narrowing that resolver.js/story.js started: world.location, world.settlements.<id>, world.dungeons.<id>, world.quests are all dot-safe sub-paths (ids are dot-free). startQuickDungeon should write world.currentRoom/exitRoomId/rooms/npcs individually (or merge over the existing world) instead of replacing the subtree and deleting campaign fields. This shrinks history entries ~1000x per write and restores the 'predictable shape' contract.

```js
// renderSettlement — instead of setValue('world', {...appState.world, location: {...}})
setValue('world.location', { ...appState.world.location, type: 'settlement', settlementId, dungeonId: null });
```

#### 4.3.10 [P3 · effort S] Preserve a corrupt save and tell the player; harden the journal cache

On loadEnvelope null with a non-null raw blob, copy it to `dans-dungeons.corrupt` and show a one-line notice with an export path — recovery stays possible and the failure is visible. For the journal cache: include narration length + turn in the fingerprint, and clear dg-journal-cache in clearSave() so a restart never inherits a previous campaign's chapters.

```js
export function loadFromStorage() {
  const raw = localStorage.getItem(SAVE_KEY);
  const data = loadEnvelope(raw, { migrations: SAVE_MIGRATIONS, currentVersion: SAVE_VERSION });
  if (raw != null && data == null) {
    try { localStorage.setItem(SAVE_KEY + '.corrupt', raw); } catch {}
    notifyCorruptSave();
  }
  return data;
}
```

### 4.4 Metrics collected

- **loc:** {"state.js": 203, "undo.js": 484, "flow.js": 1539, "exports.js": 317, "vendored_spektrum.js": 1381, "envelope.js": 73, "src_total_js": 6222}
- **tests:** {"dans_dungeons_pass": 267, "dans_dungeons_fail": 0, "client_lib_pass": 92, "client_lib_fail": 0, "timetravel_tests": "engine-contract level only (vendored Spektrum replay); no test covers undo.js epoch/branch/persist logic or state.js save/load"}
- **measured:** {"quick_dungeon_world_json_bytes": 4437, "rooms_per_dungeon": 8, "per_turn_transcript_bytes_600char_narration": 704, "simulated_save_at_200_turns_MB": 4.48, "simulated_save_at_400_turns_MB": 9.11, "simulated_save_at_800_turns_MB": 18.38, "assumptions": "25-turn epoch spine, ~400B non-transcript entries/turn, 60KB world+party baseline; spine transcript entries each carry the full game transcript (resolver.js:301)"}
- **estimates:** {"localStorage_quota_MB": 5, "estimated_turns_to_quota_failure": "200-350 (5-10 hours at ~40 turns/hour)", "eighty_hour_campaign_turns": "~3200 at 40 turns/hour", "history_entries_per_turn": "6-10 (commitAll + transcript + turnCount + rng cursor + rollLog + checkpoint + story flags)", "spektrum_snapshot_frequency": "full-state deepClone every 25 entries \u2248 every 2-4 turns", "MAX_TT_ENTRIES": 500, "MAX_BRANCHES": 50}
- **localStorage_keys:** ["dans-dungeons (save)", "dg-journal-cache", "dg-world-bible", "sketch-last-image (data-URI image)", "dans-dungeons-spend", "dg-locale", "dg-sidebar + per-section collapse keys"]
- **indexeddb_references_in_src:** 0
- **whole_world_setValue_sites_in_flow_js:** 13
- **vendored_client_vs_sibling:** envelope.js byte-identical (diff clean)


---

## 5. UI / UX — chrome, onboarding, service worker, accessibility

> Auditor: `ui-ux` · strengths 8 · findings 19 · recommendations 12

The UI layer is a competently engineered retro console aesthetic with real strengths: strict textContent discipline keeps LLM output out of innerHTML sinks, streaming narration via a JSON-field extractor gives token-by-token feedback, the boot path is carefully CLS-proofed (inlined critical CSS, sidebar pre-collapse, spektrum-ready gate), and the time-travel timeline panel is a genuinely differentiating feature. i18n coverage extends to error messages, and the retry ladder (backoff, model fallback chains, mid-loop re-auth on 401) is more robust than most hobby BYOK apps.

However, the single most important discoverability layer of the game is dead code and has been for the repo's entire history: the #action-chips / #character-chips / #skill-chips containers referenced by chips.js and input.js do not exist in index.html (verified across all git history), so every showActionChips/insertActionChip call silently no-ops. This kills the settlement menu, the shop (whose wares list exists ONLY as chips — the player sees "Wares for sale" and nothing else), the Retry chip promised after GM failures, the Flee chip in travel encounters, the NPC "leave" chip, and the Restart chip. The campaign layer (Phase 2/3 town play) was clearly written assuming these chips render. Combined with the type-a-number pickFrom flow, the game is effectively keyboard-only free-text, which is a severe mobile and non-technical-player barrier and directly contradicts the 80h open-world ambition.

Two more architectural problems undermine the chrome: the service worker's self-invalidation design defeats itself (the fetch handler lazily caches vendor/app.version, so after the first load the eager version check always compares a frozen cached value and never detects deploys — updates only arrive via the browser's native sw.js byte-diff path, one reload late), and the OAuth onboarding path — the recommended default — never asks the tier question or calls applyTier, so a player who just connected a paid personal key lands on free-tier models with images/TTS/STT locked, and the "Upgrade to Deluxe" button asks them to paste the key again (and, if clicked mid-game, orphans the play loop's pending prompt and soft-locks the run). Error surfacing is decent in shape (localized, retries visible) but misleading in content ("Missing Authentication header (401)" is hard-coded regardless of cause; a 402 from the shared-key-deluxe trap surfaces as "The GM was not available"). For the AAA goal, the gaps are: no clickable affordances, no wait-time feedback beyond a static "…", scroll hijacking during 5–30s streams, no turn cancel, no PWA manifest, iOS input auto-zoom, and 9–11px fixed-px typography.

### 5.1 What is genuinely good

- **XSS discipline on the LLM hot path is genuinely good** — All transcript rendering (appendEntry, appendStreamChunk) uses textContent, never innerHTML, so streamed narrator/classifier/NPC-dialogue output cannot inject markup. The two :innerHTML reactive bindings (PC/enemy header stats) are built exclusively from escHtml-escaped values with the trust contract documented in a comment. The debug panel escapes every LLM-derived row (classified.intent, reason, weapon names) via escHtml. The EPUB builder escapes XHTML including quotes. — evidence: `Dans-Dungeons/src/ui/transcript.js:17`, `Dans-Dungeons/src/ui/transcript.js:48`, `Dans-Dungeons/src/ui/reactive.js:31-52`, `Dans-Dungeons/src/ui/sidebar.js:136-139`, `Dans-Dungeons/vendor/bag-of-holding-client/src/output/epub.js:17-18`
- **Streaming narration with progressive display** — chatStream feeds a JsonFieldStreamer that extracts only the 'narration' field of the structured JSON as tokens arrive, handling escapes and chunk-boundary markers correctly, so the player sees GM prose appear live instead of waiting for the full JSON. The thinking indicator is swapped for the stream entry on first chunk. — evidence: `Dans-Dungeons/vendor/bag-of-holding-client/src/llm/stream.js:19-69`, `Dans-Dungeons/src/game/flow.js:1390-1394`
- **Robust turn-failure ladder** — playLoop retries 4xx errors 3 times with 1s/2s/4s backoff and a visible localized 'Retrying… (n/3)' line, intercepts 401 mid-loop for an in-transcript re-auth flow, and the client library walks free-model fallback chains on 429 and retries once at medium tier on 400. Errors are player-localized, not raw stack traces. — evidence: `Dans-Dungeons/src/game/flow.js:1275,1400-1441`, `Dans-Dungeons/vendor/bag-of-holding-client/src/llm/client.js:48-67`, `Dans-Dungeons/src/ai/tiers.js:46-50`
- **CLS-conscious, deliberate boot sequence** — build.js inlines critical.css into <head>, a tiny inline script pre-collapses the sidebar from localStorage before first paint, [data-cloak] hides unbound Spektrum elements, body opacity-gates until spektrum-ready, and a skeleton loading line covers the module-load window. Mobile-critical rules are duplicated into critical.css explicitly to prevent CLS. — evidence: `Dans-Dungeons/build.js:40-55`, `Dans-Dungeons/index.html:56-60,179-187`, `Dans-Dungeons/index.html:161-176`
- **Time-travel timeline panel is a differentiating feature** — The timeline popup shows the spine of committed turns plus abandoned branches with turn counts and relative timestamps, a divergence-cost hint ('a new action here starts a branch (uses AI)') appears when scrubbed back, and undo/redo buttons appear contextually. A seeded-roll 'Verify' audit in the sidebar lets the player confirm the dice were honest — rare trust-building UX. — evidence: `Dans-Dungeons/src/ui/timeline.js:39-97`, `Dans-Dungeons/src/main.js:74-80`, `Dans-Dungeons/index.html:258-261`
- **Accessibility groundwork exists** — 40 aria-* / role attributes in index.html: the transcript is role=log aria-live=polite, every icon button has an aria-label, toggle state is driven through :ariaPressed computed bindings, compass buttons carry per-direction labels including locked state, and mobile touch targets are bumped to 44px. — evidence: `Dans-Dungeons/index.html:211`, `Dans-Dungeons/src/ui/reactive.js:103-130`, `Dans-Dungeons/src/ui/chips.js:80`, `Dans-Dungeons/src/ui/style.css:156-159`
- **Journal/EPUB export has staged progress and graceful degradation** — createJournal shows step-by-step progress lines in the transcript, rebuilds the log from the transcript after a reload, falls back to a styled raw HTML journal when the LLM or EPUB build fails, and the raw fallback escapes narration text. The World Bible export mirrors the same progress pattern. — evidence: `Dans-Dungeons/src/ui/exports.js:117-172`, `Dans-Dungeons/src/ui/exports.js:198-237`, `Dans-Dungeons/src/ui/exports.js:241-317`
- **Mobile layout fundamentals are present** — Sidebar becomes an 85vw overlay with tap-outside backdrop and close button, the footer is fixed with a ResizeObserver keeping the transcript padded above it, the viewport meta does not disable zoom, and the action bar gets horizontal scroll with touch momentum. — evidence: `Dans-Dungeons/src/ui/style.css:81-173`, `Dans-Dungeons/src/ui/sidebar.js:56-66`

### 5.2 Findings

#### 5.2.1 [CRITICAL · defect] Chip containers never existed in the DOM — the entire click-to-play layer silently no-ops

chips.js and input.js resolve document.getElementById('action-chips'|'character-chips'|'skill-chips') and every renderer guards `if (!el) return;`. index.html contains none of these elements, and a scan of every commit of index.html in git history confirms they never existed. Consequences: (1) the shop is blind — openShop prints only the gold banner; the wares list exists ONLY as buy:N chips (flow.js:774-779), so the player cannot see what is for sale; (2) settlementChips (talk/shop/rest/quests/map/travel/fast-travel) never render; (3) insertActionChip('Retry', …) after 'The GM was not available' never appears (flow.js:1329); (4) the Flee chip in travel encounters and the NPC 'leave' chip never appear (flow.js:1000,716); (5) awaitRestart's Restart chip never appears — only the 'Type /restart' text saves it (flow.js:1501); (6) dungeon room chips (take item, unlock, look, talk) never render, leaving the action bar compass as the only clickable affordance.

- **Evidence:** `Dans-Dungeons/src/ui/chips.js:7-9`, `Dans-Dungeons/src/ui/chips.js:75-76`, `Dans-Dungeons/src/ui/input.js:18`, `Dans-Dungeons/src/game/flow.js:488,774-779,1000,1329,1501`, `Dans-Dungeons/src/ui/style.css:210-269`
- **Impact:** Core campaign interactions (shopping, settlement navigation, retry-after-failure, flee) are invisible or unusable without guessing free-text commands; mobile and non-technical players are locked out. Directly blocks the 80h-campaign goal's playability.
- **Independent verification: CONFIRMED** — The defect is real as stated; I traced every cited path. (A) Containers absent: I read all 363 lines of Dans-Dungeons/index.html — no element with id action-chips, character-chips, or skill-chips exists. A repo-wide grep shows those ids appear only as getElementById lookups (chips.js:7-9, input.js:18 — the latter is even dead code, never called), as CSS selectors (style.css:210,218,245), and in the built bundle; nothing in src/ ever creates them (the only createElement-with-id in the UI layer is the ab-tooltip div, actionbar.js:10-12; Spektrum only binds existing DOM via data-if/data-each, it does not inject these divs). (B) History: index.html has exactly 10 revisions across the repo's 83 commits; I diffed every one — zero mentions of 'chips' in any revision, and `git log --all -S 'action-chips'` over non-vendor paths shows the string only ever entering via src files. The containers never existed. (C) All renderers guard and silently return: chips.js:74-75 (showActionChips), 87-88, 121-122, 142-144, 151-155 (clearChips). (D) Each consequence verified: (1) Shop blind — flow.js:773 prints en.json:180 "Wares for sale (you have {{gold}} gold):" and the wares then exist ONLY as buy:N chips (flow.js:774-779) which never render; the colon-terminated banner promises a list that never appears; purchases are possible only by typing an unseen item name (substring match, flow.js:788). (2) settlementChips (flow.js:453-476, shown at 488) never render — and worse than claimed, fast travel is completely unreachable: its only trigger is the chip protocol value matched at flow.js:495 (^fasttravel:(.+)$), and neither normalizeSettlementAction (flow.js:630-639) nor fallbackSettlementAction (flow.js:643-658) has a fasttravel intent. (3) Retry chip — flow.js:1434-1435 sets pendingRetry on gmUnavailable, flow.js:1328-1330 insertActionChip no-ops. (4) Flee chip (flow.js:1000) and NPC leave chip (flow.js:716) no-op; typed synonyms exist (flow.js:1005, 719) but are never surfaced. (5) Restart chip (flow.js:1501) no-ops; only the "Type /restart" hints (en.json:238,243) save it — exactly as the claim said. (6) Room/character/skill chips (flow.js:1322-1324, 997-999) no-op; the action bar compass is the only clickable game affordance (actionbar.js:35-56 wires fireChip; the class/skill word clouds are tooltip-only spans with no click handlers, reactive.js:62-90, index.html:291,296). Autoplay is unaffected because _collectChipValues (flow.js:1342) reads state, not DOM — consistent with the claim. Calibration note (does not change the verdict): the impact clause "mobile and non-technical players are locked out" is mildly overstated — the game is free-text-first (LLM classifier + regex fallbacks; settlement NPCs and exits ARE printed as transcript text at flow.js:430-443), so typed play works throughout. But two features have no non-chip representation at all (shop wares list, fast travel), and four affordances (Retry, Flee, leave, Restart) are silently invisible, so the critical severity for the click-to-play layer and the shop is justified.

#### 5.2.2 [HIGH · defect] Service worker caches vendor/app.version, defeating the entire version-check/purge/reload design

The fetch handler is cache-first for every same-origin GET under /Dans-Dungeons and lazily cache.put()s anything it fetches (sw.js:43-53) — including vendor/app.version. The page's `fetch(..., { cache: 'no-store' })` (index.html:353) does not bypass the SW, and caches.match ignores request cache mode. So after the first load the VERSION_CHECK message always carries the frozen cached hash, which equals the SW's local VERSION, and the purge/unregister/reload path (sw.js:59-71) never fires for real deploys. Updates only propagate via the browser's native sw.js byte-diff update (delayed by GH Pages HTTP caching and navigation timing), landing one reload late — the opposite of the documented 'eagerly check on every page load' design.

- **Evidence:** `Dans-Dungeons/sw.js:43-53`, `Dans-Dungeons/sw.js:59-71`, `Dans-Dungeons/index.html:349-360`
- **Impact:** Players run stale bundles for hours/days after a deploy; the designed instant-update mechanism is dead code after the first page load.

#### 5.2.3 [HIGH · defect] OAuth connect path (the recommended default) never sets tier or models

setupKey explicitly skips the tier question for OAuth ('OAuth returns later', flow.js:179), but on the ?code= return main.js only exchanges the code and stores ai.key (main.js:169-184) — applyTier is never called, so ai.tier defaults to 'free' and ai.models stays unset (→ free models). A player who just created a paid personal key plays on free-tier models with images/TTS/STT gated behind 'Upgrade to Deluxe', which then prompts them to paste the key they already connected (flow.js:192-205).

- **Evidence:** `Dans-Dungeons/src/game/flow.js:147-153,179-188`, `Dans-Dungeons/src/main.js:164-188`, `Dans-Dungeons/src/game/flow.js:192-205`
- **Impact:** The best onboarding path delivers the worst experience: paying users get free models and a confusing re-paste upgrade flow.

#### 5.2.4 [HIGH · defect] UI.prompt() is single-slot and re-entrant callers orphan the game loop — sidebar 'Upgrade to Deluxe' mid-game soft-locks the run

prompt() overwrites the module-level _resolveInput without resolving the previous promise (input.js:123-127). playLoop/settlementLoop are always parked on a pending prompt; clicking the sidebar Upgrade tile calls upgradeToDeluxe → UI.prompt (flow.js:193), replacing the loop's resolver. When the upgrade prompt resolves, _resolveInput is null, the input was disabled by _submit, and the loop's original promise can never resolve — the game is dead until reload. The same hazard applies to any future prompt-from-outside-the-loop feature.

- **Evidence:** `Dans-Dungeons/src/ui/input.js:21,78-84,123-127`, `Dans-Dungeons/src/game/flow.js:192-205`
- **Impact:** One click on a visible settings control during play freezes the game (recoverable only via reload thanks to autosave).

#### 5.2.5 [HIGH · gap] Wait feedback for 5-30s LLM turns is a static '…' with no elapsed indicator, no stage info, and no cancel

setThinking appends a single static '…' entry (transcript.js:52-61) styled italic with no animation (style.css:50). During a turn there are up to three sequential AI calls (classify → narrate → beat-check, loop.js:109-160) plus image gen, but the player sees one unchanging glyph until narration streams. There is no AbortController surfaced anywhere — a hung request leaves the input disabled with placeholder '…' and no escape short of reload. Image generation has no loading indicator at all (sketch.js:6-8 is an intentional no-op).

- **Evidence:** `Dans-Dungeons/src/ui/transcript.js:52-61`, `Dans-Dungeons/src/ui/style.css:50`, `Dans-Dungeons/src/game/loop.js:109-160`, `Dans-Dungeons/src/ui/sketch.js:6-8`
- **Impact:** The single most-felt moment of the game (waiting on the GM) reads as frozen; commercial text-AI games animate, show stages, and allow cancel.

#### 5.2.6 [MEDIUM · defect] Transcript auto-scroll hijacks the viewport on every streamed token

appendStreamChunk calls el.scrollIntoView({behavior:'smooth'}) on every chunk (transcript.js:47-50), and appendEntry does the same for every line (transcript.js:19). There is no 'only stick to bottom if already at bottom' check, so a player who scrolls up to re-read during a 5-30s stream (or during autoplay) is yanked back down continuously.

- **Evidence:** `Dans-Dungeons/src/ui/transcript.js:14-21,47-50`
- **Impact:** Reading back history — the core activity of a text game — is impossible while the GM is talking; egregious in autoplay sessions.

#### 5.2.7 [MEDIUM · defect] Global Spacebar hijack breaks keyboard activation of every button

initMicButton adds a document-level keydown handler: any Space press when focus is not on #cmd calls e.preventDefault() and btn.click() to toggle recording (input.js:192-198). A keyboard user who Tabs to any button (export tiles, compass, toggles) and presses Space triggers the mic (or the Deluxe scold message on free tier) instead of activating the focused control.

- **Evidence:** `Dans-Dungeons/src/ui/input.js:192-198`
- **Impact:** Standard keyboard interaction is broken across the whole app whenever an API key is present; on free tier it also spams the gate message.

#### 5.2.8 [MEDIUM · defect] Misleading error messages: hard-coded 401 diagnosis and 402/4xx conflated into 'GM unavailable'

reAuthKey always prints 'API key rejected — Missing Authentication header (401)' (en.json setup.keyRejected) regardless of the actual body. The shared-key 'try' path lets the player pick Deluxe (flow.js:179-188), pairing paid models with the embedded $0 key; the resulting 402s match /^AI 4\d\d:/ and surface as 'The Game Master was not available. Try again when you are ready.' (flow.js:1433-1435) with a Retry chip that never renders (see chips finding). checkKey also returns true on any non-401 failure (vendor client.js:153-161), so this misconfiguration survives validation.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:207-222,1426-1440`, `Dans-Dungeons/src/i18n/en.json (setup.keyRejected, loop.gmUnavailable)`, `Dans-Dungeons/vendor/bag-of-holding-client/src/llm/client.js:153-161`
- **Impact:** Players cannot self-diagnose the most common failure modes (bad key vs rate limit vs no credit); the advertised recovery affordance (Retry) does not exist.

#### 5.2.9 [MEDIUM · gap] No PWA manifest, no theme-color, no apple-touch-icon — the 'PWA' is only a service worker

The repo root contains no manifest.webmanifest and index.html has no <link rel="manifest">, no theme-color meta, and no apple-touch-icon (verified by grep and directory listing). The app is not installable, gets no home-screen icon, and the browser chrome is unthemed. Additionally #cmd is 14px (style.css:363-372), which triggers iOS Safari's auto-zoom on focus, and setInputEnabled(true) force-focuses the input after every turn (input.js:93), popping the virtual keyboard whether the player wants it or not.

- **Evidence:** `Dans-Dungeons/index.html:1-20 (no manifest link)`, `Dans-Dungeons/src/ui/style.css:363-372`, `Dans-Dungeons/src/ui/input.js:88-97`
- **Impact:** Mobile play — essential for an 80h casual campaign — feels like a website, with viewport zoom jumps and keyboard churn.

#### 5.2.10 [MEDIUM · defect] Sketch-gallery export interpolates model-controlled image URLs unescaped into HTML attributes

exportAllSketches builds `<img src="${e.imageSrc}">` with no escaping (exports.js:51). imageSrc comes from the image model response, which the library may pass through as a raw image_url.url string, not just a data URI (vendor image.js:19-28). escHtml elsewhere also does not escape quotes (utils.js:3-5), so a hostile/compromised model returning a crafted URL (`x" onerror="...`) injects active markup into the downloaded HTML file the player then opens. _downloadRawJournal has the same raw `src="${entry.imageSrc}"` pattern (exports.js:202). exportScreenshot correctly guards with startsWith('data:image') (exports.js:26).

- **Evidence:** `Dans-Dungeons/src/ui/exports.js:49-53,201-203`, `Dans-Dungeons/vendor/bag-of-holding-client/src/llm/image.js:19-28`, `Dans-Dungeons/src/core/utils.js:3-5`
- **Impact:** An LLM-supplied string reaches an attribute sink in an exported file that runs with no CSP — a real, if narrow, XSS surface.

#### 5.2.11 [MEDIUM · defect] 'Last turn' debug bar can never become visible — data-if display:'' loses to the stylesheet's display:none

Spektrum's data-if sets el.style.display = '' when truthy (vendor/spektrum.js:758-764), which falls back to the stylesheet, and style.css keeps `#debug-bar { display: none; }` unless a `.visible` class is present (style.css:291-304) — but nothing adds that class any more (sidebar.js:68-73 explicitly removed the logic). The debug panel itself still shows (its default display is flex), so the toggle 'works' but the labelled header row is permanently hidden dead HTML/CSS.

- **Evidence:** `Dans-Dungeons/src/ui/style.css:291-304`, `Dans-Dungeons/src/ui/sidebar.js:68-73`, `Dans-Dungeons/vendor/spektrum.js:758-764`, `Dans-Dungeons/index.html:299-301`
- **Impact:** Cosmetic inconsistency plus a trap pattern: the same data-if-vs-stylesheet conflict will silently break any future element whose stylesheet default is display:none.

#### 5.2.12 [MEDIUM · risk] Zero UI/DOM tests — the dead-chips class of regression is structurally undetectable

npm test runs 267 passing tests, all on deterministic game logic (dice, checks, schema validation) per the stated policy. Nothing asserts that the DOM ids the UI modules depend on (action-chips, character-chips, skill-chips, cmd, transcript, timeline-panel…) exist in index.html, which is exactly how the critical chips defect shipped and survived every merge gate.

- **Evidence:** `Dans-Dungeons/tests/ (267 tests, none touch index.html or src/ui/)`, `Dans-Dungeons/CLAUDE.md (Tests section: 'Test deterministic logic only')`
- **Impact:** The merge gates ('npm test green') provide zero protection for the player-facing layer; UI regressions ship silently.

#### 5.2.13 [LOW · defect] English cooldown tooltip pluralizes in Dutch: '2 turnen'

reactive.js hardcodes the plural suffix as 'en' (`s: remaining > 1 ? 'en' : ''`, reactive.js:86) which is interpolated into en.json's 'Cooldown: {{n}} turn{{s}} remaining' producing 'turnen' instead of 'turns'. Correct only for the Dutch string 'beurt{{s}}'.

- **Evidence:** `Dans-Dungeons/src/ui/reactive.js:78-91`, `Dans-Dungeons/src/i18n/en.json (actionbar.cooldown)`
- **Impact:** Visible broken English in action-bar tooltips; symptom of interpolation-based pluralization that won't scale to more locales.

#### 5.2.14 [LOW · defect] ARIA misuse: aria-expanded on the <aside>, role=menu without menuitems, hover-only tooltips

makePanel sets aria-expanded on the sidebar panel itself (sidebar.js:16) instead of the controlling button; #timeline-panel declares role="menu" (index.html:317) but children are plain buttons with no menuitem roles or arrow-key navigation and no Escape-to-close; the action-bar tooltip system listens only to mouseover/mouseout (actionbar.js:14-28) so keyboard and touch users never see exit descriptions, lock hints, or skill descriptions; collapsed-sidebar buttons remain in the tab order because collapse is width:0, not visibility/inert (style.css:66-70).

- **Evidence:** `Dans-Dungeons/src/ui/sidebar.js:13-19`, `Dans-Dungeons/index.html:317`, `Dans-Dungeons/src/ui/actionbar.js:14-28`, `Dans-Dungeons/src/ui/style.css:66-70`
- **Impact:** Screen-reader and keyboard users get wrong expand/collapse semantics, invisible tooltips, and phantom tab stops.

#### 5.2.15 [LOW · defect] Contrast and typography floor: 2.1:1 'unavailable' skill words, 9-10px fixed-px fonts

.ab-word.ab-unavailable is #4a4a4a on #141414 (~2.08:1, style.css:898) — the comment says the fixed color helps 'contrast checkers reason about it' but it still fails WCAG for informational (non-disabled-control) text; .dbg-row.dim #5a5a5a is ~2.7:1 (style.css:349). Sidebar labels, tooltips, chip metadata, and zone labels are 9-11px in px units throughout, ignoring browser font-size preferences.

- **Evidence:** `Dans-Dungeons/src/ui/style.css:897-898,349,557-564,918-926`
- **Impact:** Cooldown-state skills are near-illegible; the whole chrome is hostile to low-vision players and 'AAA' polish expectations.

#### 5.2.16 [LOW · debt] 2.3 MB of unreferenced PNGs shipped in src/ui/

bg.png (64 KB), title-screen.png (62 KB) and thief.png (2.17 MB) sit in src/ui/ with zero references anywhere in src/ or index.html (grep-verified). They are served by GitHub Pages and inflate the repo, and thief.png alone dwarfs the 382 KB app bundle.

- **Evidence:** `Dans-Dungeons/src/ui/bg.png`, `Dans-Dungeons/src/ui/thief.png`, `Dans-Dungeons/src/ui/title-screen.png`
- **Impact:** Dead weight and confusion about what the visual direction actually is.

#### 5.2.17 [LOW · inconsistency] Feature-gate affordances shown to users who cannot use them, and comments that contradict the markup

mic, TTS, autoplay, and roleplay buttons are gated by data-if="ai.key" (index.html:198,213,318,319) so free-tier players (who always have the embedded key) see them, click, and receive a scold ('… is a Deluxe feature') — e.g. input.js:163-167. main.js:194 claims 'mic button shows via data-if="settings.stt"' which the HTML contradicts. The room-chip label ' [locked]' is hardcoded English while everything else is localized (chips.js:162).

- **Evidence:** `Dans-Dungeons/index.html:198,213,318-319`, `Dans-Dungeons/src/ui/input.js:163-167`, `Dans-Dungeons/src/main.js:194`, `Dans-Dungeons/src/ui/chips.js:162`
- **Impact:** Repeated scolding instead of upsell affordance; drift between docs/comments and reality erodes maintainability.

#### 5.2.18 [LOW · gap] SW registration hardcodes /Dans-Dungeons/, so the whole SW/update path is untestable in local dev

index.html registers '/Dans-Dungeons/sw.js' and fetches '/Dans-Dungeons/vendor/app.version' (index.html:351-353). `npm run serve` serves the repo root, so both 404 locally: the SW never installs and the version check no-ops in the only environment the developer actually exercises — which is plausibly why the app.version-caching bug went unnoticed.

- **Evidence:** `Dans-Dungeons/index.html:349-360`, `Dans-Dungeons/sw.js:8`
- **Impact:** The most failure-prone subsystem (caching/updates) has no dev feedback loop.

#### 5.2.19 [LOW · risk] CSP requires 'unsafe-eval' because Spektrum compiles expressions with new Function; precompile path unused

index.html's CSP includes script-src 'unsafe-eval' (index.html:7) solely because vendor/spektrum.js builds binding evaluators via `new Function('state','scope', 'with (state) …')` (spektrum.js:197). Spektrum's own comments (spektrum.js:150,210) describe a precompile() build-time option that is CSP-friendly, but build.js does not use it.

- **Evidence:** `Dans-Dungeons/index.html:7`, `Dans-Dungeons/vendor/spektrum.js:150,197,210`
- **Impact:** Weakens the otherwise tight CSP of an app that handles a payment-linked API key in localStorage.

### 5.3 Recommendations

#### 5.3.1 [P0 · effort S] Restore the chip containers and add a DOM-contract smoke test

One HTML insertion revives the settlement menu, shop wares list, Retry/Flee/Restart/leave chips, and dungeon room chips — the entire click layer the campaign code already targets. A trivial node test asserting the ids UI modules depend on exist in index.html makes this class of regression impossible to ship again.

```js
<!-- index.html, inside #footer above #input-row -->
<div id="chips-dock">
  <div id="action-chips"></div>
  <div id="character-chips"></div>
  <div id="skill-chips"></div>
</div>

// tests/ui/dom-contract.test.js
const html = fs.readFileSync('index.html', 'utf8');
for (const id of ['cmd','transcript','action-chips','character-chips','skill-chips','timeline-panel','debug-panel'])
  assert(html.includes(`id="${id}"`), `index.html missing #${id}`);
```

#### 5.3.2 [P0 · effort S] Exclude app.version from SW runtime caching

The self-invalidation design is sound but currently defeats itself; a two-line guard restores instant update detection. Also consider honoring request.cache === 'no-store' generally.

```js
// sw.js fetch handler, before caches.match
if (url.pathname.endsWith('/vendor/app.version') || e.request.cache === 'no-store') {
  return; // let it hit the network untouched
}
```

#### 5.3.3 [P0 · effort S] Finish the OAuth path: ask the tier question on ?code= return

OAuth is the default onboarding option; today it strands paying users on free models with an upgrade flow that demands re-pasting the key they just minted. After the key exchange succeeds, run the same tier pickFrom + applyTier used in setupKey (and make upgradeToDeluxe reuse the stored key instead of prompting).

```js
// main.js, after setValue('ai.key', key) in the urlCode branch
const { finishOAuthSetup } = await import('./game/flow.js');
await finishOAuthSetup();   // pickFrom(free/deluxe) → applyTier(choice), validates key
```

#### 5.3.4 [P1 · effort S] Make prompt() re-entrancy safe

A single mutable _resolveInput slot means any out-of-loop prompt orphans the game loop (Upgrade button soft-lock today, more tomorrow). Either queue prompts or resolve the displaced promise with a sentinel the loops ignore.

```js
export function prompt(message) {
  if (_resolveInput) { const prev = _resolveInput; _resolveInput = null; prev(Symbol.for('preempted')); }
  ...
}
// loops: const raw = await UI.prompt(''); if (typeof raw === 'symbol') continue;
```

#### 5.3.5 [P1 · effort M] Stick-to-bottom scrolling + animated, staged thinking indicator + turn cancel

These three changes transform the felt quality of the 5-30s wait, which is where the game lives. Only auto-scroll when the reader is already within ~40px of the bottom; animate the ellipsis and show the stage (classifying / narrating / sketching) with elapsed seconds; wire an AbortController through processTurn so Escape cancels a hung turn instead of forcing a reload.

```js
function nearBottom(el){ return el.scrollHeight - el.scrollTop - el.clientHeight < 40; }
export function appendStreamChunk(el, chunk){
  const t = transcriptEl(); const stick = nearBottom(t);
  el.textContent += chunk;
  if (stick) t.scrollTop = t.scrollHeight;   // instant, no smooth-per-token jank
}
/* CSS */
.entry-thinking::after{ content:''; animation: dots 1.2s steps(4,end) infinite; }
@keyframes dots{ 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%{content:'...'} }
```

#### 5.3.6 [P1 · effort S] Make pickFrom options clickable

With chips restored, route pickFrom's numbered options through showActionChips as well, so onboarding (connect choice, character creation, quest accepts) becomes tap-friendly — the largest single win for non-technical and mobile players, at near-zero cost since the plumbing (fireChip) exists.

```js
// input.js pickFrom, after rendering the numbered lines:
import('./chips.js').then(({ showActionChips, clearChips }) => {
  showActionChips(options.map((o,i) => ({ label: `${i+1}. ${labelFn(o)}`, value: String(i+1) })));
});
// clear them once a valid selection resolves
```

#### 5.3.7 [P1 · effort S] Add a web app manifest and fix the iOS input zoom

Installability + themed chrome is table stakes for an 80h mobile-friendly campaign. Set #cmd to 16px to stop iOS focus zoom, and only auto-focus the input on devices with a physical keyboard (matchMedia('(hover: hover)')).

```js
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0d0d0d">
/* style.css */ #cmd { font-size: 16px; }
// input.js setInputEnabled: if (on && matchMedia('(hover: hover)').matches) el.focus();
```

#### 5.3.8 [P2 · effort M] Scope the Spacebar mic shortcut and fix ARIA details

Only trigger recording when focus is on the document body/transcript, never on interactive elements; move aria-expanded onto #sidebar-toggle with aria-controls; drop role=menu from the timeline panel (or implement menuitem + arrow keys + Escape); show tooltips on focusin/focusout as well as hover; add inert (or visibility:hidden) to the collapsed sidebar.

```js
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ') return;
  const a = document.activeElement;
  if (a && (a.tagName === 'BUTTON' || a.tagName === 'INPUT' || a.tagName === 'A' || a.isContentEditable)) return;
  ...
});
```

#### 5.3.9 [P2 · effort S] Escape/validate imageSrc in HTML exports

Model output should never reach an attribute sink unescaped; a data-URI allowlist matches what the app can render anyway (CSP img-src already blocks remote URLs in-app, so exports should match).

```js
const safeSrc = (s) => (typeof s === 'string' && /^data:image\//.test(s)) ? s.replace(/"/g, '&quot;') : '';
`<img src="${safeSrc(e.imageSrc)}" alt="Scene sketch">`
// and extend escHtml with .replace(/"/g,'&quot;')
```

#### 5.3.10 [P2 · effort M] Honest, specific error surfacing

Branch player-facing messages on ApiError.status instead of regex on the message string: 401 → 'key rejected', 402 → 'this key has no credit for paid models — switch to Free in settings', 429 → 'rate-limited, retrying', anything else → generic. Remove the hard-coded 'Missing Authentication header' text, and block the Deluxe choice on the shared 'try' key path.

```js
catch (e) {
  const status = e.status ?? (e.message.match(/^AI (\d{3}):/)?.[1] | 0);
  if (status === 402) UI.appendEntry('error', t('loop.noCredit'));
  else if (status === 429) UI.appendEntry('system', t('loop.rateLimited'));
  ...
```

#### 5.3.11 [P3 · effort S] Fix the debug-bar visibility conflict and the 'turnen' plural

Give #debug-bar a default display:flex and let data-if own visibility (delete the .visible rule), establishing the convention that data-if-controlled elements must not have stylesheet display:none defaults. Replace the interpolated plural suffix with two locale keys (cooldownOne/cooldownMany).

#### 5.3.12 [P3 · effort M] Delete unreferenced PNGs; use Spektrum precompile to drop 'unsafe-eval'

Remove src/ui/{bg,thief,title-screen}.png (2.3 MB dead weight). Spektrum documents a build-time precompile() path that avoids new Function; wiring it into build.js lets the CSP drop 'unsafe-eval', meaningfully hardening an app that stores a billing-linked API key.

### 5.4 Metrics collected

- **ui_js_loc:** 1369
- **style_css_loc:** 992
- **critical_css_loc:** 164
- **index_html_loc:** 363
- **sw_js_loc:** 71
- **build_js_loc:** 61
- **bundle_bytes:** 382308
- **tests_total:** 267
- **tests_passing:** 267
- **ui_dom_tests:** 0
- **aria_role_attrs_in_index:** 40
- **dead_asset_bytes:** 2302411
- **i18n_en_json_loc:** 515
- **chip_render_callsites_dead:** 9
- **focus_css_rules:** 0
- **ab_unavailable_contrast_ratio:** 2.08:1
- **min_font_size_px:** 9


---

## 6. Lore & Narrative — world identity, content pools, story fuel

> Auditor: `lore-narrative` · strengths 7 · findings 16 · recommendations 12

The narrative stack is a competent dungeon-crawl demo wearing a campaign costume. At the micro level the writing is genuinely good: the ~40 authored room descriptions and 48 enemy intros in en.json are specific, sensory, and tonally disciplined ("a cloth doll with no face", "scratches on the bedpost count the days someone was trapped here"), and the LLM worldgen pipeline (seeded blueprint constraints → world seed → factions ∥ beats → region → settlement, with digest threading) is a sound architecture that already prevents the worst failure mode of generic unconstrained AI worlds. Faction reputation with real price/hostility consequences, NPC secrets with a host-controlled reveal gate, and the GM-private beat directive injected into the narrator are real narrative systems, not decoration.

But there is no setting. The only proper noun in the entire authored corpus is "Grizzik the Goblin" — and he lives in a dead, unreferenced data block whose only live remnant is a defeat line that mocks you in his voice no matter which of 48 creatures killed you. Campaign identity is generated per run and consists of a ~30-word digest, a 2-sentence creation myth, 2-3 gods, 2-3 factions, and 3-5 abstract story beats totalling 1.5–7.5 hours by the prompt's own targetPlaytimeMinutes — an order of magnitude short of 80 hours, with no acts layer, no beat→NPC/location binding (the engine's archetype-casting module is never called; preferredLocation is prompted to null), no expansion of the thread as regions are lazily generated, and no finale: completing the last beat changes only a progress line in the /story view. Meanwhile the engine repo already ships the missing machinery — branching threads, sub-threads, archetype casting, a solo oracle with twist/complication tables — all entirely unwired; the game uses a second, simpler, linear beat module in the client repo instead.

Tonal consistency is actively broken in three places: the blueprint can roll 5 tones (including tragic, whimsical) but the world-seed schema only admits 3; the narrator and journal prompts hardcode "gritty low fantasy" regardless of the generated tone; and settlement NPC dialogue receives no world digest, tone, or beat context at all, so the tavern roleplay is world-blind. EN/NL parity is superficially perfect (identical key sets) but materially lopsided: Dutch is missing 39 of 48 enemy intros (falling back to one generic line), shows English SRD creature names for ~28 creatures, mistranslates "the planes" as "de vlakten" (plains), and leaves untranslated words ("guttural") in prose. Replayability of the deterministic layer is thin: 4 loot items, 4+20 treasures/keys, one identical atmosphere sentence appended to every mid-room of a themed dungeon, and room descriptions sampled with replacement so a single dungeon can contain two textually identical rooms — and every theme, from flooded cavern to dragon hoard, is dressed in the same manor-flavoured rooms (nursery, wine cellar, foyer). The journal EPUB is a nice artifact pipeline (canvas cover, cached incremental chapters) but the "World Bible" export generates a brand-new random world rather than documenting the campaign you are playing.

### 6.1 What is genuinely good

- **Authored micro-prose is high quality and tonally consistent** — The en.json flavour corpus (8 room types × 5 descriptions, 48 enemy intros, keys/treasures/loot) is written in a disciplined, sensory, gritty-melancholy register with strong concrete details and no purple filler — e.g. the nursery's faceless doll, the monk's cell prayer scratched with fingernails, the wine-or-blood stain. The 24 dungeon-theme atmosphere lines and 20 domain-themed treasures/keys ('wrong key — it shouldn't fit any lock. It does anyway.') show real narrative-design craft. — evidence: `Dans-Dungeons/src/i18n/en.json:264-351`, `Dans-Dungeons/src/game/dungeon-overlays.js:13-38`, `Dans-Dungeons/src/game/worldseed.js:21-67`
- **Blueprint-constrained worldgen is the right replayability architecture** — buildBlueprint draws tone/archetype/threat/climate/factions/dungeon-theme/gods from curated tables with a seeded RNG (5 tones × 24 world archetypes × 24 threats × 20 climates × 24 dungeon themes ≈ 1.4M high-level combinations before faction/god picks), turning each AI generator's job from 'invent everything' into 'flesh out these constraints'. The digest-threading runPipeline (parallel groups, retries, critical-abort) is shared by campaign start and world-bible export — one implementation, no divergence. — evidence: `bag-of-holding-client/src/worldgen/blueprint.js:25-190`, `bag-of-holding-client/src/worldgen/pipeline.js:59-95`, `Dans-Dungeons/src/game/worldgen.js:106-130`
- **Real narrative systems, not decoration** — Faction reputation feeds merchant prices and trade refusal (priceModifier/isHostile wired in flow.js); NPC secrets are gated by a host-side mayReveal decision, and a revealed secret raises a story flag; the current beat's dramaticPurpose is injected as a GM-private directive the narrator is told to steer toward without stating; killing a boss and completing dungeons raise flags that beats can require. The beats evaluator and faction math are pure, zero-dep, and unit-testable. — evidence: `bag-of-holding-client/src/narrative/factions.js:54-73`, `Dans-Dungeons/src/game/story.js:66-89`, `Dans-Dungeons/src/ai/dialogue.js:32-50`, `Dans-Dungeons/src/game/loop.js:156-181`, `Dans-Dungeons/src/game/flow.js:744-747`
- **Full prompt-level localization — Dutch worlds, not just Dutch UI** — nl.json translates not only UI strings but the worldgen system prompts themselves ('Antwoord volledig in het Nederlands'), so a Dutch player gets a fully Dutch-generated world, narration, and journal. The bulk of the NL UI translation is idiomatic and careful (e.g. 'doorgewinterd' for seasoned, 'Grafgeest' for wight). — evidence: `Dans-Dungeons/src/i18n/nl.json:490-506`, `Dans-Dungeons/src/i18n/nl.json:210-225`
- **The engine already ships the 80-hour raw machinery (unwired)** — bag-of-holding has a branching beat thread with successors[] and a chooseSuccessor picker, nested sub-threads for side quests/flashbacks, archetype casting with a structured missing-slot result, and a seeded Mythic-style oracle with weighted twist/complication tables — exactly the foreshadowing/branching/casting machinery a long campaign needs, tested and documented. — evidence: `bag-of-holding/src/beats/thread.js:74-143`, `bag-of-holding/src/beats/casting.js:23-36`, `bag-of-holding/src/solo/oracle.js:35-64`
- **Artifact pipeline (journal + world bible EPUB) exists end-to-end** — Journal export weaves narrations into titled chapters via LLM with incremental localStorage caching, builds a zero-dep EPUB with a tone-paletted canvas cover, and falls back to a styled raw HTML journal on failure. The world-bible exporter runs the full pipeline, formats six chapters, and runs an LLM polish pass that strips technical IDs into sourcebook prose. — evidence: `Dans-Dungeons/src/ai/journal.js:30-99`, `Dans-Dungeons/src/game/worldbible.js:23-130`, `bag-of-holding-client/src/output/epub.js:33-60`
- **The context-scoping design doc is a credible plan for the 80h goal** — docs/ideas/12-context-scoping.md specifies concentric scope tiers, S/M/L entity cards, a digest tree with log-depth walks, inverted-index + local-WASM RAG recall, and a secrets filter — the correct architecture for streaming a large world into bounded LLM context. Nothing of it is implemented yet, but the thinking is sound and cost-aware. — evidence: `Dans-Dungeons/docs/ideas/12-context-scoping.md:22-52`, `Dans-Dungeons/docs/ideas/12-context-scoping.md:214-253`

### 6.2 Findings

#### 6.2.1 [CRITICAL · gap] Red thread content math is an order of magnitude short of 80 hours, with no growth path or payoff

A campaign's entire story is 3-5 LLM-generated beats ('create 3-5 story beats', targetPlaytimeMinutes 30-90 → 1.5–7.5h total), stored once at startCampaign and never extended. Lazily generated neighbour regions (generateNeighbourRegion) add settlements but zero new beats, quests-to-beats links, or acts. Beats are abstract sentences with preferredLocation prompted to 'null (will be assigned to regions later)' — later never happens. Completing the final beat triggers nothing: completeBeatNow only sets flags/currentIndex, and the sole consumer is the /story view printing 'Every thread of this tale has been woven.' There is no act structure, no epilogue, no finale scene, no new-thread spawn.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:498`, `Dans-Dungeons/src/game/flow.js:373-393`, `Dans-Dungeons/src/game/flow.js:1108-1148`, `Dans-Dungeons/src/game/story.js:39-46`, `Dans-Dungeons/src/game/flow.js:530-531`
- **Impact:** The stated 80-hour coherent-campaign goal is structurally impossible with the current story model; a player exhausts the generated arc in one or two evenings and is left with repeatable but story-less dungeon loops.

#### 6.2.2 [HIGH · gap] No lore bible / persistent canon anywhere — the world has no memory beyond digests

The only setting identity is per-run: seed.digest (~30 words), a 2-sentence creation myth, 2-3 gods, 2-3 factions. Nothing accumulates canon during play: narrations can introduce names and facts but no entity registry, fact list, or history records them (the 12-context-scoping doc's memory cards, inverted index, and RAG are all unimplemented — 'Status: rough sketch'). The narrator's continuity window is 3 transcript turns plus the digest path. The only authored named character in either repo is 'Grizzik the Goblin', inside a dead `world.enemies` array that no code reads (world.js reads only enemyNames/enemyIntros/enemyIntroGeneric).

- **Evidence:** `Dans-Dungeons/src/game/loop.js:57-74`, `Dans-Dungeons/src/ai/narrate.js:40`, `Dans-Dungeons/src/i18n/en.json:323-330`, `Dans-Dungeons/src/game/world.js:14-23`, `Dans-Dungeons/docs/ideas/12-context-scoping.md:3-4`
- **Impact:** Over long play the GM will contradict established facts (invented tavern names, NPC details, past events), destroying the coherence the 80h goal depends on; there is nothing to stream into scope-limited context because nothing is being recorded.

#### 6.2.3 [HIGH · inconsistency] Tone pipeline is self-contradictory: 5 blueprint tones, 3 schema tones, and a hardcoded 'gritty low fantasy' narrator

blueprint.js tones = ['grimdark','heroic','mysterious','tragic','whimsical'] and worldSeedConstraints injects e.g. 'Tone: whimsical' into the prompt, but WORLD_SEED_SCHEMA enum only allows ['grimdark','heroic','mysterious'], so tragic/whimsical worlds force the model to violate either the constraint or the schema. Then the turn narrator ignores tone entirely: 'Setting: gritty low fantasy' is hardcoded in narratorPrompt (en.json:490, nl.json:490), and journalPrompt hardcodes 'Keep the gritty low-fantasy tone' (en.json:494). The EPUB cover palette likewise only knows the 3 schema tones.

- **Evidence:** `bag-of-holding-client/src/worldgen/blueprint.js:26`, `bag-of-holding-client/src/worldgen/schemas.js:14`, `Dans-Dungeons/src/i18n/en.json:490`, `Dans-Dungeons/src/i18n/en.json:494`, `bag-of-holding-client/src/output/epub.js:33-37`
- **Impact:** A 'heroic' or 'whimsical' generated world is narrated grimly every turn and retold grimly in the journal — the flagship worldgen feature (tone) is cosmetic beyond the seed text, and 2 of 5 tones can't even round-trip the schema.

#### 6.2.4 [HIGH · gap] Settlement NPC dialogue is world-blind: no world digest, tone, beat directive, or relationships in the prompt

npcDialoguePrompt receives only name/role/attitude/personality/faction-id/reputation/questHook/secret/mayReveal/transcript (dialogue.js:39-51). It gets no world or region digest, no tone, no red-thread directive, and — although worldgen generates NPC relationships and the world-bible prints them — the relationships array is never passed to dialogue. buildStoryContext/worldContext exist but are only wired into the dungeon-turn narrator via buildScene.

- **Evidence:** `Dans-Dungeons/src/ai/dialogue.js:39-51`, `Dans-Dungeons/src/i18n/en.json:488`, `Dans-Dungeons/src/game/loop.js:56-80`, `bag-of-holding-client/src/worldgen/schemas.js:96`
- **Impact:** Town roleplay — the main vehicle for lore delivery in a campaign — cannot reference the world's central conflict, its gods, current story state, or even the NPC's own spouse standing next to them; the red thread goes silent whenever the player is in a settlement.

#### 6.2.5 [HIGH · risk] Beat advancement can stall forever: no casting, no location binding, judge-only progression

Beats advance only when checkBeatFulfilled (tiny-tier LLM, told 'Be strict — when in doubt, false') judges the latest single narration to CLEARLY accomplish the dramaticPurpose (loop.js:173-181, en.json:484). Beats declare requiredArchetypes ('authority','antagonist'…) but the engine's castArchetypes is never called anywhere in the game or client (grep: zero usages), and preferredLocation is always null — so a beat like 'confront the authority figure' may reference an NPC role that exists nowhere in the generated world. currentBeat falls back to the first incomplete beat indefinitely (narrative/beats.js:38-43); there is no turn-count escape hatch, no deterministic fulfillment trigger, and no way for the thread to route around an unfulfillable beat.

- **Evidence:** `Dans-Dungeons/src/game/loop.js:173-181`, `Dans-Dungeons/src/i18n/en.json:484`, `bag-of-holding-client/src/narrative/beats.js:38-43`, `bag-of-holding/src/beats/casting.js:23-36`
- **Impact:** Campaigns silently stall at an unfulfillable beat: the GM keeps 'subtly steering' toward a scene that can never occur, the /story progress freezes, and the player has no way to know why the thread stopped.

#### 6.2.6 [HIGH · defect] NL locale is missing 39 of 48 enemy intros and most creature names, plus concrete mistranslations

en.json world.enemyIntros has 48 entries; nl.json has 9 (verified by script) — Dutch players get the one generic line ('draait zich naar je toe, vijandig en klaar om te vechten') for wight, banshee, owlbear, vampire-spawn, young-drake, etc. nl enemyNames covers 20 creatures; the other ~28 fall back to English BESTIARY names mid-Dutch-sentence ('Bandit Captain', 'Gibbering Mouther'). Concrete errors: 'de vlakten' for the planes (planes→plains mistranslation, nl:376), 'botten sleutel' (ungrammatical, nl:335), untranslated 'guttural' in the zombie intro (nl:328), NL vault room 'Studeerkamer' colliding with the quarters room 'Studeerkamer' (nl:304 vs nl:316; EN distinguishes Study/Master Study), and nl factionsPrompt says allies are 'factie-ids' while its own IMPORTANT note demands NAMES (nl:500) — the EN version consistently says names.

- **Evidence:** `Dans-Dungeons/src/i18n/nl.json:349-351`, `Dans-Dungeons/src/i18n/nl.json:376`, `Dans-Dungeons/src/i18n/nl.json:328`, `Dans-Dungeons/src/i18n/nl.json:335`, `Dans-Dungeons/src/i18n/nl.json:304`, `Dans-Dungeons/src/i18n/nl.json:316`, `Dans-Dungeons/src/i18n/nl.json:500`
- **Impact:** Dutch play is a visibly second-class experience: repetitive combat intros, code-switched creature names, and a self-contradictory faction prompt that invites schema-repair churn.

#### 6.2.7 [MEDIUM · defect] Defeat text always blames Grizzik, whoever killed you

defeat.text is static — 'Grizzik's mocking cackle echoes through the stone…' (en.json:242, nl.json:242) — and flow.js:1489 renders it unconditionally on death. In campaign mode the killer is one of ~48 creatures across 24 themes; dying to a banshee in a dream prison still produces a goblin's cackle. Grizzik himself only exists in the dead world.enemies block.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:242`, `Dans-Dungeons/src/i18n/nl.json:242`, `Dans-Dungeons/src/game/flow.js:1489`
- **Impact:** Every campaign death ends on a lore contradiction — the single most dramatic moment in a run references a character who is not in the game.

#### 6.2.8 [MEDIUM · gap] Dungeon theme dressing is one repeated sentence over manor-flavoured rooms

generateDungeon appends the theme's single atmosphere sentence verbatim to every mid room ('themedDesc = `${baseDesc} ${atmosphere}`', generate.js:191), and the base descriptions always come from the manor/estate pools regardless of theme — a 'flooded cavern' or 'dragon hoard' still contains a Foyer with a cracked mirror, a Nursery, and a Wine Cellar of a '{{style}}' drawn from ['crumbling manor','abandoned estate',…]. Room descriptors are also sampled with replacement (rpick per room, generate.js:187), so one dungeon can contain two rooms with byte-identical name+description.

- **Evidence:** `bag-of-holding-client/src/dungeon/generate.js:186-191`, `Dans-Dungeons/src/i18n/en.json:264`, `Dans-Dungeons/src/game/world.js:27-42`
- **Impact:** Players read the same sentence 4-8 times per dungeon, themes feel like a palette swap on the wrong building, and duplicate rooms break immersion within a single session — variety collapses after ~2-3 dungeons.

#### 6.2.9 [MEDIUM · gap] Foreshadowing machinery is cosmetic: 'clue' discoveries have no content

The travel 'clue' discovery prints 'another thread of the story falls into place' and sets a bare counter flag `clue-N` (flow.js:1067-1071). Nothing ever reads clue flags except buildStoryContext, which passes the raw slug ('clue-2') to the narrator as recentEvents (story.js:78-87), and the /story view, which prints raw slugs to the player under 'Notable deeds' (flow.js:557-561). No clue text, no link to the red thread, no payoff.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1067-1071`, `Dans-Dungeons/src/game/story.js:78-87`, `Dans-Dungeons/src/game/flow.js:557-561`, `Dans-Dungeons/src/i18n/en.json:453`
- **Impact:** The game promises foreshadowing it cannot deliver; the narrator receives meaningless slugs and the player-facing story screen shows internal flag IDs ('secret-npc-torva-revealed') as prose.

#### 6.2.10 [MEDIUM · debt] Two divergent beat systems; the richer engine machinery (branching, sub-threads, casting, oracle) is 100% unused

bag-of-holding/src/beats (validateBeat, createThread, successors[] branching, pushSubThread, castArchetypes) and bag-of-holding/src/solo (oracle, twists, complications, starter party) have zero imports from Dans-Dungeons or bag-of-holding-client (verified by grep). The game instead uses the client's flat, linear narrative/beats.js with a different flag convention. The engine's schema comment even says successors is 'ignored by the v1 runtime' while thread.js implements it — three partially overlapping beat runtimes across two repos.

- **Evidence:** `bag-of-holding/src/beats/thread.js:74-127`, `bag-of-holding-client/src/narrative/beats.js:1-15`, `bag-of-holding/src/solo/oracle.js:130-177`
- **Impact:** The exact features the 80h goal needs (branching arcs, side-quest sub-threads, casting beats onto NPCs, deterministic GM oracle for open play) are already written, tested, and rotting unwired — while new work keeps landing on the weaker duplicate.

#### 6.2.11 [MEDIUM · defect] The 'World Bible' export documents a freshly generated random world, not the player's campaign

exportWorldBible → generateWorldBible builds a brand-new blueprint from Math.random (worldbible.js:25-26) and reruns the whole pipeline; appState.world (the campaign the player is actually in) is never passed to formatChapters. The chapter headings ('The World of…', 'Factions', 'The Red Thread') are also hardcoded English even for NL exports, relying on the polish LLM to translate them.

- **Evidence:** `Dans-Dungeons/src/game/worldbible.js:23-34`, `Dans-Dungeons/src/game/worldbible.js:137-179`, `Dans-Dungeons/src/ui/exports.js:241-249`
- **Impact:** The one feature positioned as 'your world's lore bible' produces an unrelated world each time — as a lore artifact of the campaign it is currently useless, and it spends real API credits doing so.

#### 6.2.12 [MEDIUM · risk] Journal continuity relies on 100-char chapter stubs, and images pair to chapters by index

Incremental journal export sends the LLM only '[heading] first-100-chars…' of each previously written chapter as continuity context (journal.js:61-63), so later batches routinely drift in tone, re-introduce the character, or re-title the tale (title falls back to cache only if the new call omits one, journal.js:86). Scene sketches are attached by chapter index — images[i] onto chapter i (exports.js:178-182) — but images are per-turn and chapters are per-scene, so sketches land on the wrong chapters as soon as chapter count ≠ image count.

- **Evidence:** `Dans-Dungeons/src/ai/journal.js:61-63`, `Dans-Dungeons/src/ai/journal.js:85-88`, `Dans-Dungeons/src/ui/exports.js:176-182`
- **Impact:** The flagship keepsake artifact degrades on exactly the long campaigns it is meant to celebrate: seams between export batches and mismatched illustrations.

#### 6.2.13 [MEDIUM · inconsistency] World text is baked in the generation locale; switching language mid-campaign yields a mixed-language world

Room names/descriptions are interpolated from locale pools at generation time and stored in world state (world.js:27-42, generate.js:186-196); NPC greetings/secrets/quests are LLM-generated in the locale active at startCampaign ('Respond entirely in English' / 'Antwoord volledig in het Nederlands'). setLocale later changes UI strings but all stored world prose remains in the old language, and the narrator will then narrate in the new language about rooms described in the old one.

- **Evidence:** `Dans-Dungeons/src/game/world.js:27-42`, `Dans-Dungeons/src/i18n/en.json:496`, `Dans-Dungeons/src/i18n/nl.json:496`
- **Impact:** A bilingual household (the NL feature's target audience) sees Dutch narration quoting English room descriptions or vice versa after a language switch.

#### 6.2.14 [LOW · risk] Blueprint god exemplars feed WotC product-identity deities into generation prompts

godDomains exemplars include Mystra, Kelemvor, The Raven Queen, Lolth, Lathander, Umberlee, etc. (blueprint.js:126-146) — Forgotten Realms/product-identity names that are not in the SRD. blueprintContext injects 'e.g. Kelemvor' into the world-seed prompt (blueprint.js:203), and models frequently echo exemplar names verbatim into generated worlds.

- **Evidence:** `bag-of-holding-client/src/worldgen/blueprint.js:126-146`, `bag-of-holding-client/src/worldgen/blueprint.js:202-204`
- **Impact:** Generated 'original' worlds can ship recognizable WotC IP names to players; also flattens originality (the prompt says 'avoid generic fantasy tropes' while handing the model famous ones).

#### 6.2.15 [LOW · inconsistency] Autoplay is a pathfinder, not the documented persona, and its rules self-contradict in combat

CLAUDE.md describes autoplay's system prompt as giving 'personality: curious, fights with flair, never backtracks', but the actual prompt is one persona clause ('bold, curious adventurer') followed by a mechanical priority list and navigation rules. Rule 'NEVER repeat the same action twice in a row' (en.json:492) directly conflicts with priority 1 (fight the enemy) — multi-round combat requires repeating 'I attack', so a rule-following model must dodge into skill actions mid-fight.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:492`, `Dans-Dungeons/CLAUDE.md (Autoplay section)`, `Dans-Dungeons/src/ai/autoplay.js:10-27`
- **Impact:** Autoplay demos read as robotic room-sweeping rather than a character playing, and can stall or flail during longer fights.

#### 6.2.16 [LOW · debt] Dead world.enemies block duplicates live intro data in both locales

en.json:323-330 / nl.json:323-330 world.enemies (Grizzik, Guard Skeleton, Feral Cultist, …) is read by no code — world.js reads only world.enemyNames / world.enemyIntros / world.enemyIntroGeneric (grep confirms zero consumers). Its intros drifted from the live enemyIntros copies (e.g. goblin line differs: 'This place belongs to Grizzik!' vs 'This place is mine, big-folk!').

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:323-330`, `Dans-Dungeons/src/game/world.js:14-23`
- **Impact:** ~60 lines of translated-twice content to maintain, and a trap for future editors who will fix the wrong copy.

### 6.3 Recommendations

#### 6.3.1 [P0 · effort XL] Add an acts layer above beats and generate the thread lazily per act

3-5 flat beats cannot span 80 hours; the fix is structural, not more beats at once. Generate Act I fully + a one-line promise for Acts II/III at campaign start; when an act's beats complete, generate the next act from the world digest + a summary of what actually happened (player choices, faction standings, flags). Wire the engine's existing successors[]/pushSubThread for faction side-arcs instead of the client's linear module — the code already exists and is tested.

```js
// campaign.redThread v2
{
  acts: [
    { id: 'act-1', theme: 'omen',       status: 'active',  beats: [/* 5-8 full beats */] },
    { id: 'act-2', theme: 'betrayal',   status: 'promised', promise: 'The cult's patron is revealed to sit on the town council.' },
    { id: 'act-3', theme: 'sacrifice',  status: 'promised', promise: 'Sealing the breach costs the player their strongest ally.' }
  ],
  // on act completion:
  // generateAct(worldDigest, actPromise, playHistorySummary, blueprint.beatArc[nextIdx]) -> beats[]
}
```

#### 6.3.2 [P0 · effort L] Introduce a persistent canon store (the live lore bible) and feed it to every prompt

This is the seed of the 12-context-scoping plan and the prerequisite for coherence at scale: a registry of every named entity with a one-line card and accumulated facts, appended by worldgen and by a cheap post-narration extraction pass, and rendered (S-size) into narrator, dialogue, and journal prompts. Without it the GM will contradict itself long before hour 10.

```js
// world.canon: { [entityId]: CanonCard }
{
  id: 'npc.torva', type: 'npc', name: 'Torva',
  card: 'Torva, gruff innkeeper of the Hollow Flagon; married to Bren; distrusts the Ash Circle.',
  facts: [
    { turn: 41, text: 'Admitted she saw cultists enter the crypt at midnight.' }
  ],
  firstSeen: { turn: 12, where: 'settlement.duskwell' }
}
// per turn: scene.canon = knownEntitiesIn(scope).map(c => c.card).slice(0, budget)
```

#### 6.3.3 [P1 · effort S] Thread tone end-to-end; align the tone enum

One-line fixes remove a systemic contradiction: pass blueprint tone into narrator/journal prompts instead of the hardcoded 'gritty low fantasy', and widen WORLD_SEED_SCHEMA's enum to the blueprint's 5 tones (plus epub TONE_PALETTE entries for tragic/whimsical).

```js
// en.json narratorPrompt
"Setting: {{tone}} fantasy, second person..."
// narrate.js
const tone = appState.world?.tone ?? 'gritty low';
t('ai.narratorPrompt', { tone, ... })
// schemas.js
tone: { enum: ['grimdark','heroic','mysterious','tragic','whimsical'] }
```

#### 6.3.4 [P1 · effort S] Give NPC dialogue the world: digest, tone, beat directive, relationships

Settlements are where lore is delivered; today the prompt has none. Add worldDigest + settlement digest + the current beat's dramaticPurpose (GM-private, same rule as the narrator) + the NPC's relationships resolved to names. This is a prompt-only change using data that already exists in state.

```js
// dialogue.js npcReply additions
world:     appState.world?.digest ?? '',
tone:      appState.world?.tone ?? '',
directive: activeBeat()?.dramaticPurpose ?? '—',
kin:       (npc.relationships ?? []).map(r => `${r.type} of ${nameOf(r.targetId)}`).join(', ') || '—'
```

#### 6.3.5 [P1 · effort M] Make beats castable and unstallable

Wire bag-of-holding's castArchetypes when a settlement/dungeon is generated: bind each active beat's requiredArchetypes to concrete NPC ids (create an NPC if no candidate exists — the informant/antagonist the beat needs). Add a stall escape: if a beat is untouched after N turns, escalate from 'steer subtly' to an explicit quest offer or oracle-driven twist, and allow skipping via successors.

```js
// on settlement gen / beat activation
const { cast, missing } = castArchetypes(beat, { entityProvider: slot =>
  findNpcByRole(slot.role) ?? spawnNpcForRole(slot, settlement) });
beat.boundEntities = cast;
// stall watchdog in loop.js
if (turnsOnBeat(beat) > 12) scene.story.directive = `URGENT: make '${beat.dramaticPurpose}' happen this scene via ${beat.boundEntities?.informant?.name ?? 'a new arrival'}.`
```

#### 6.3.6 [P1 · effort M] NL parity pass on creature content + fix the five concrete translation defects

Translate the 39 missing enemyIntros and ~28 missing enemyNames (a bounded, mechanical job — the EN lines are short), fix 'de vlakten'→'de sferen/gebieden' (planes), 'botten sleutel'→'benen sleutel', remove 'guttural', rename the NL vault 'Studeerkamer'→'Meesterkamer' to break the collision, and make nl factionsPrompt consistently demand NAMES like the EN version.

#### 6.3.7 [P2 · effort M] Theme-aware room dressing: per-theme descriptor pools and no-replacement sampling

Give each of the 24 overlays 3-5 atmosphere variants plus optional per-room-type override descriptors (a flooded cavern's 'storage' is a silt-choked cache, not a pantry), and sample room descriptors without replacement within a dungeon. This multiplies perceived variety with a few hundred lines of the same-quality prose the project already writes well.

```js
'flooded cavern': {
  atmosphere: ['Water drips from the ceiling…', 'Somewhere below, water moves against stone.', 'Your torchlight doubles in black pools.'],
  roomOverrides: { storage: [{ name: 'Silted Cache', desc: 'Crates fused into the muck…' }] }
}
// generate.js: const def = pickWithoutReplacement(pool, usedPerType[type], rng);
```

#### 6.3.8 [P2 · effort S] Parameterize the defeat line and retire Grizzik's ghost

Pass the killer's name into defeat.text ('{{enemy}}'s shadow falls over you…') and delete the dead world.enemies block from both locales (keeping Grizzik, if loved, as an authored recurring NPC in the canon store instead).

```js
"text": "The world dims. {{enemy}} stands over you as you collapse to the cold floor…"
// flow.js
const killer = lastAttacker()?.name ?? t('defeat.fallbackEnemy');
UI.appendEntry('gm', t('defeat.text', { enemy: killer }));
```

#### 6.3.9 [P2 · effort M] Generate real clue content at campaign start; show prose, not slugs

Have the beats layer also emit 6-10 foreshadow fragments (one per beat plus red herrings) with actual text tied to the premise; travel/dungeon 'clue' discoveries pop the next fragment, store its text in the flag payload, and both the narrator context and the /story 'Notable deeds' view render the prose instead of 'clue-2' / raw flag ids.

```js
// worldgen beats layer output
foreshadow: [ { id:'clue-ash-symbol', text:'A charred spiral — the Ash Circle's mark — scratched where only a kneeling man could see it.', beatId:'beat.02.discover-the-cult' } ]
// story flags become { [flag]: { at:turn, text } }
```

#### 6.3.10 [P2 · effort S] Point the World Bible at the actual campaign

Split generateWorldBible into generate (existing) and export-current: when a campaign exists, formatChapters(appState.world.{seed lore, factions, redThread, regions, settlements, dungeons}) → polish → EPUB, so the artifact documents the world the player owns — including play-state (beats done, reputations) as a 'The Story So Far' chapter. Also localize the hardcoded chapter headings.

```js
export async function exportCampaignBible() {
  const w = appState.world;
  const raw = formatChapters({ seed: { name: w.name, tone: w.tone, ...w.lore }, factions: Object.values(w.factions ?? {}), beats: w.redThread?.beats ?? [], region: primaryRegion(w), settlement: primarySettlement(w), dungeon: firstDungeon(w) });
  raw.push(storySoFarChapter(w));
  return buildEpub({ title: w.name, chapters: await polishChapters(raw), tone: w.tone, brand: "Dan's Dungeons" });
}
```

#### 6.3.11 [P3 · effort S] Replace WotC deity exemplars with original or public-domain names

Mystra/The Raven Queen/Lolth etc. are product identity, and exemplars leak verbatim into generated worlds. Swap for invented archetypal names or historical-pantheon ones (already the SRD-safe pattern), keeping the domain list unchanged.

#### 6.3.12 [P3 · effort S] Fix autoplay's combat contradiction and give it the promised voice

Scope the 'never repeat' rule to non-combat actions and add two lines of persona (how it fights, what it fears) so autoplay demos read as a character; update CLAUDE.md to match reality either way.

```js
- In combat, keep attacking until the enemy falls (repetition is expected).
- Outside combat, do not repeat the same non-attack action twice in a row.
```

### 6.4 Metrics collected

- **en_json_lines:** 515
- **nl_json_lines:** 515
- **en_string_count:** 575
- **enemy_intros_en:** 48
- **enemy_intros_nl:** 9
- **enemy_intros_missing_nl:** 39
- **enemy_names_en:** 3
- **enemy_names_nl:** 20
- **room_descriptions_per_locale:** 40
- **room_types:** 8
- **house_styles:** 6
- **dungeon_themes:** 24
- **atmosphere_lines_per_theme:** 1
- **generic_keys:** 4
- **domain_keys:** 20
- **generic_treasures:** 4
- **domain_treasures:** 20
- **loot_pool_items:** 4
- **travel_discovery_kinds:** 4
- **beats_per_campaign:** 3-5
- **beat_playtime_minutes:** 30-90
- **max_red_thread_hours:** 7.5
- **blueprint_tone_options:** 5
- **world_seed_schema_tone_options:** 3
- **blueprint_combinations_topline:** 5 tones × 24 archetypes × 24 threats × 20 climates × 24 dungeon themes ≈ 1.38M
- **settlement_npcs:** 3-4
- **factions_per_world:** 2-3
- **dungeon_rooms:** 6-10 (spine 4-6 + branches 2-4)
- **engine_beat_modules_unused_by_game:** ["bag-of-holding/src/beats/thread.js", "bag-of-holding/src/beats/casting.js", "bag-of-holding/src/solo/oracle.js"]
- **narrator_transcript_window_turns:** 3
- **duplicate_room_probability_note:** room descriptors sampled with replacement; 2 same-type rooms have a 20% chance of identical text


---

## 7. Rules Engine Core — bag-of-holding mechanics

> Auditor: `engine-core` · strengths 6 · findings 17 · recommendations 13

This is a genuinely strong rules kernel — far better than the owner's "inconsistent mess" self-assessment suggests for this layer. The determinism architecture is exemplary: every rolling function threads an injectable rng, the Mulberry32 seededRng has pinned seed→output regression tests, the engine factory records a rollLog, and replay.js verifyLog re-executes recorded logs against a seed — and the host (Dans-Dungeons/src/game/rng.js) actually wires seeded engines and verifyLog end-to-end. The suite is 1561 passing tests at 99.94% line coverage in 2.7s with zero runtime deps. Immutability discipline (actor-in/new-actor-out), the throw-on-programmer-error vs {ok:false}-on-gameplay-refusal split, and the damage pipeline (temp HP, resistance-then-vulnerability, massive damage, death-save state machine) are all correct against the SRD where I hand-checked the math.

The single biggest structural problem is edition incoherence. The repo claims "SRD 5.2" (2024 rules) everywhere, and much of it genuinely is 5.2 (weapon mastery, exhaustion −2/−5ft, species, backgrounds-grant-ASIs, armor table), but several load-bearing tables are actually SRD 5.1/2014: half-casters start slots at level 2 (5.2 paladins/rangers cast at level 1), preparedSpellCount uses the 2014 mod+level formula (2024 uses fixed per-level columns), the monster statblocks are 2014 numbers (goblin HP 7 vs 5.2's 10), Fighter Second Wind has 1 use (2024: 2), and Barbarian L20 rage is "unlimited" (2014). For an 80-hour campaign that leans on this engine as ground truth, the two editions' numbers will visibly contradict each other (a level-1 paladin who cannot cast, a "5.2" goblin with 2014 HP) and contradict the LLM narrator's training data on 2024 rules.

Beyond that there are a handful of concrete rules defects I verified by reading and executing code: castSpell silently consumes a higher slot via consumeSlot auto-upcast but reports castLevel at the requested level (I reproduced burning a 5th-level slot for a 3rd-level Fireball with extraDice 0 — silent resource loss); ability checks and saving throws have no advantage/disadvantage parameter at all, so the condition flags conditions.js itself declares (ownCheckDisadvantage, saveDexDisadvantage) are unenforceable and Magic Resistance is hacked in as a −5 DC; longJump uses STR modifier where the SRD uses STR score (and a test pins the wrong rule); all 71 newer SRD spell records carry components as strings ('V, S') that the castSpell component-gate cannot read; and three weapon mastery assignments contradict the 2024 table. The hazards module cites SRD sections for formulas that are actually homebrew approximations (starvation grace 1+CON vs the SRD's 3+CON, extreme temperature DC 5+(hours−1) vs the SRD's flat DC 10).

Fitness for the 80h goal: as a deterministic fallback layer the skeleton is excellent — slots, conditions, death saves, rests, resources, encumbrance thresholds, and replay are all real and tested. The gaps that will bite at scale are (a) the edition mixing above, (b) spell effects being almost entirely data-free (no upcast functions, no structured durations-in-rounds, multi-type damage collapsed to one type), meaning the LLM still adjudicates most of what a spell does, and (c) the declared-but-unconsumed flag pattern (species traits, condition check-disadvantage) where the engine looks like it enforces a rule but actually delegates it to host memory. None of this is critical; all of it is fixable with bounded effort.

### 7.1 What is genuinely good

- **End-to-end deterministic replay architecture, actually used by the host** — Every rolling function accepts an rng parameter (default Math.random only at the unbound module layer); seededRng is Mulberry32 with documented cross-platform stability and pinned seed→output tests; createEngine({rng, logRolls}) records every stochastic op into rollLog; replay.js verifyLog re-executes a recorded log from a seed and reports the first divergence, including stance-aware attack rolls and hook-cancelled entries. Dan's Dungeons wires seeded engines and verifyLog into session.rollLog, so the determinism contract is exercised in production, not just in tests. — evidence: `bag-of-holding/src/dice.js:123-132`, `bag-of-holding/src/replay.js:63-157`, `bag-of-holding/src/engine.js:391-408`, `Dans-Dungeons/src/game/rng.js:41-131`
- **Exceptional test coverage that is fast and dependency-free** — 1561 tests pass in ~2.7s under node --test with zero runtime dependencies. Coverage is 99.94% line / 99.53% branch / 99.59% functions across every core module; combat.js, conditions.js, dice.js, spellcasting.js, all 13 class defs, and all SRD data files sit at 100% line coverage. The only uncovered lines in the audited set are character.js:643-646 and checks.js:72-74. — evidence: `bag-of-holding/package.json:59 (test scripts)`, `coverage run output: all files 99.94% line`
- **Damage pipeline and death-save state machine are SRD-correct with edge cases handled** — applyDamage threads immunity → resistance (floor/2) → vulnerability (×2) in the RAW order, absorbs temp HP first (non-stacking grant per SRD via grantTempHp), implements massive-damage instant death as overkill ≥ hpMax, routes damage-at-0-HP through applyDamageWhileDown (crit = 2 failed saves), and dropToZero applies Unconscious with a fresh tracker. deathSave implements nat 1 = two failures, nat 20 = revive at 1 HP + remove Unconscious, DC and threshold configurable via rules. heal correctly refuses to restore temp HP and wakes an unconscious actor crossing 0→positive. — evidence: `bag-of-holding/src/combat.js:470-607`, `bag-of-holding/src/combat.js:306-356`, `bag-of-holding/src/combat.js:710-729`
- **Verified-correct SRD tables where it counts** — I hand-checked the full-caster slot table (all 20 rows match the PHB), the half-caster table rows, Warlock pact slots (count and slot level per level), XP thresholds and proficiency-by-level, cantrip scaling tiers (5/11/17), concentration save DC max(10, floor(dmg/2)), the 2024 armor table (AC, maxDex, STR requirements, stealth disadvantage, don/doff times), encumbrance variant thresholds (5×/10× STR), carrying capacity (15×STR, push/lift ×2, 5.2 size multipliers with Small=×1), mounts, and trade-goods prices. All correct. — evidence: `bag-of-holding/src/spellcasting.js:53-147`, `bag-of-holding/src/xp.js:5-22`, `bag-of-holding/src/srd/items.js:66-78`, `bag-of-holding/src/character.js:574-576`
- **Clean extensibility design: rules knobs, mastery handler table, closed-but-extensible condition vocabulary** — buildRules validates every knob with specific error messages and freezes the merged result; critOn/fumbleOn arrays support Champion-style expanded crits; mastery handlers dispatch by name from a table so plugins add properties without forking; Conditions.apply takes an allowedConditions list the engine factory extends with plugin conditions; conditionImmunities returns unchanged actor instead of throwing so UIs render 'immune' gracefully. — evidence: `bag-of-holding/src/rules.js:88-148`, `bag-of-holding/src/combat.js:143-235`, `bag-of-holding/src/conditions.js:246-269`
- **Consistent error-handling philosophy** — Programmer/content errors throw with pointed messages (unknown mastery, invalid dice spec, malformed timer, out-of-range caster level); expected gameplay refusals return { ok: false, reason } (no slot available, not enough rage uses, attunement cap). This split is applied consistently across mechanics.js, spellcasting.js, magic-items.js, and class mechanics, which makes the surface predictable for an LLM-driven host that must degrade gracefully. — evidence: `bag-of-holding/src/mechanics.js:115-132`, `bag-of-holding/src/spellcasting.js:193-207`, `bag-of-holding/src/magic-items.js:36-95`

### 7.2 Findings

#### 7.2.1 [HIGH · inconsistency] SRD 5.1 (2014) and SRD 5.2 (2024) rules are silently mixed under a uniform 'SRD 5.2' label

The package and nearly every doc comment claim SRD 5.2 (2024 rules), and much content is (weapon mastery, exhaustion −2/−5ft, species file, background-granted ASIs). But: (1) halfCasterSlots returns 0 below level 2 with the comment 'Per SRD 5.2 they cast starting at level 2' — in SRD 5.2/2024 Paladins and Rangers have 2 first-level slots at level 1; level 2 start is the 2014 rule (spellcasting.js:80-88). (2) preparedSpellCount uses 'ability mod + level' (spellcasting.js:323-334) — the 2014 formula; 2024/5.2 uses fixed per-level prepared columns. (3) CASTER_WEIGHT rounds half-casters down (multiclass.js:48-54); 2024 multiclassing rounds Paladin/Ranger up. (4) srd/monsters.js is labeled 'SRD 5.2 monster stat blocks' but the numbers are 2014: goblin HP 7 (5.2: 10), orc as a monster (removed in 5.2), zombie/wolf/ogre all 2014 values (srd/monsters.js:11-70). (5) Fighter Second Wind max 1 use (classes/fighter.js:72) — 2024 grants 2 uses at L1. (6) Barbarian L20 rage 'Unlimited'→999 (classes/barbarian.js:22-27) is the 2014 rule.

- **Evidence:** `bag-of-holding/src/spellcasting.js:80-88`, `bag-of-holding/src/spellcasting.js:323-334`, `bag-of-holding/src/multiclass.js:48-54`, `bag-of-holding/src/srd/monsters.js:12-19`, `bag-of-holding/src/classes/fighter.js:71-75`, `bag-of-holding/src/classes/barbarian.js:22-27`
- **Impact:** Over an 80h campaign the engine will contradict both itself and the LLM narrator (whose training data knows 2024 rules): a level-1 paladin who cannot cast, monsters with wrong-edition HP, wrong prepared-spell budgets. Every future content addition inherits the ambiguity of which edition to match.
- **Independent verification: CONFIRMED** — Traced every cited path; the defect is real as stated. (1) bag-of-holding/src/spellcasting.js:76-88 — halfCasterSlots hard-returns 0 for casterLevel < 2 ("if (casterLevel < 2) return 0;" at :87) under the comment "Per SRD 5.2 they cast starting at level 2"; SRD 5.2/2024 Paladin and Ranger have 2 first-level slots at class level 1 — level-2 start is the 2014 rule. paladin.js:37 and ranger.js:39 wire progression:'half' into this table, so a level-1 paladin in this engine genuinely cannot cast. (2) spellcasting.js:320-334 — preparedSpellCount = max(1, abilityMod + level, half-level for half-casters), attributed to "SRD 5.2"; that is the 2014 formula — 2024/5.2 uses fixed per-level prepared columns in each class table. (3) multiclass.js:40-54 documents Paladin/Ranger "count half (rounded down)" and casterLevel (:77-88) implements Math.floor over 0.5 weights; 2024 multiclassing rounds Paladin/Ranger half-levels UP. (Extra nuance the claim missed: the floor is applied to the aggregate sum, so Paladin 3 + Ranger 3 yields caster level 3 where 2014's per-class rounding gives 2 — the implementation matches neither edition exactly in multi-half-caster mixes.) (4) srd/monsters.js:1 labels the file "SRD 5.2 monster stat blocks" but the entries are verbatim 2014 Monster Manual: goblin AC 15/HP 7/Scimitar +4 1d6+2/Stealth +6 (:12-19; the 5.2 Goblin Warrior has HP 10), an orc entry (:20-26) that does not exist in the 2024 MM/SRD 5.2, wolf AC 13 (:37-44; 2024: AC 12), zombie HP 22 (:45-52; 2024: 15), ogre HP 59 (:63-69; 2024: 68). (5) classes/fighter.js:72 — secondWind { max: 1, refreshes: 'short' } with doc comment "One use per Short Rest" at :78-81 attributed to "SRD 5.2 § Fighter"; 2024 grants 2 uses at L1 (3 at L4, 4 at L10, regain one per short rest, all per long rest), and the features table (:45-65) omits those bumps too. (6) classes/barbarian.js:22-27 — RAGES_BY_LEVEL ends 20: 999 with the comment "L20 sits at 'Unlimited' in the PHB" — that is the 2014 PHB; the 2024 table caps at 6 rages at L20. The "uniform label" framing is also accurate: package.json describes the kernel as "D&D 5e (SRD 5.2)", the README carries an "SRD 5.2 (2025)" badge, and grep shows ~80 "SRD 5.2 §" doc-comment citations across src/, while the same files simultaneously ship genuine 2024 content (srd/species.js with ASIs moved to backgrounds per 5.2 at species.js:1-3 and backgrounds.js:1/12+, Weapon Mastery at fighter.js:19, exhaustion −2 d20/−5 ft per level at conditions.js:282-297, Divine Smite "now a spell" at paladin.js:19, Brutal Strike/Tactical Mind). So the mixing is silent and per-rule, exactly as claimed, and the claimed impact (engine contradicting a 2024-trained narrator on level-1 half-caster slots, monster HP, prepared-spell budgets) follows directly. Severity high/inconsistency is calibrated correctly: play still functions, but every rule sits under a wrong or unverifiable edition label and future content inherits the ambiguity.

#### 7.2.2 [HIGH · defect] castSpell silently burns a higher-level slot while casting at the lower level (auto-upcast mismatch)

consumeSlot auto-upcasts: if the requested level has no slots, it consumes the next-higher available slot and returns levelCast (spellcasting.js:193-207). But castSpell discards slotResult.levelCast and computes castLevel = args.slotLevel ?? spell.level (spellcasting.js:444-459). Verified by execution: an actor with 3rd/4th slots exhausted and one 5th slot free, casting Fireball at slotLevel 3, returns ok:true, castLevel:3, upcastEffect {extraDice:0} — and the 5th-level slot is consumed (used:1). Per the SRD, casting with a higher slot means the spell IS cast at that slot's level.

- **Evidence:** `bag-of-holding/src/spellcasting.js:193-207`, `bag-of-holding/src/spellcasting.js:444-459`
- **Impact:** A player's most precious resource (highest spell slot) is silently consumed with zero upcast benefit, with no signal to the host that it happened. In a long campaign this is repeated invisible resource theft that also breaks concentration bookkeeping (concentration records level = args.slotLevel, not the consumed level).

#### 7.2.3 [HIGH · gap] No advantage/disadvantage support on ability checks and saving throws; condition flags declared but unenforceable

abilityCheck and savingThrow accept only {abilityScore, proficient, proficiencyBonus, dc} (checks.js:44-104) — no advantage, disadvantage, or situational bonus parameter (passiveCheck has advantage/bonus; the rolled versions do not). Yet conditions.js declares ownCheckDisadvantage on frightened/poisoned (conditions.js:83-84,112-113) and saveDexDisadvantage on restrained (conditions.js:127), and exhaustion.modifierToD20Tests returns a −2/level penalty (conditions.js:350-352) — none of which any roll path can consume. spellcasting.js:710-713 admits it outright: magicResistanceDcFor models Magic Resistance 'as a -5 effective DC, since the engine's bound savingThrow doesn't yet take an advantage argument'. The engine-bound savingThrow only wires the auto-fail flags (engine.js:459-471).

- **Evidence:** `bag-of-holding/src/checks.js:44-104`, `bag-of-holding/src/conditions.js:83-84`, `bag-of-holding/src/conditions.js:127`, `bag-of-holding/src/conditions.js:350-352`, `bag-of-holding/src/spellcasting.js:705-713`
- **Impact:** Poisoned, frightened, restrained (DEX saves), exhaustion penalties, Bless/Bane-style bonuses, and Magic Resistance cannot be correctly resolved through the engine — the host or LLM must fake them (or forget them, which is what actually happens with LLM hosts). This is a core 5e mechanic missing from the deterministic layer the project wants to always fall back on.

#### 7.2.4 [MEDIUM · defect] Long jump uses STR modifier instead of STR score — and a test pins the wrong rule

longJump returns max(0, strMod) feet with a running start (movement.js:87-90). The SRD (both editions) says a long jump covers feet equal to your Strength SCORE (e.g. STR 16 → 16 ft). The shipped test asserts the buggy behavior: 'longJump: STR mod feet with running start — assert.equal(longJump({str:16}), 3)' (tests/movement.test.js:102-104). A STR 16 fighter can jump 3 feet.

- **Evidence:** `bag-of-holding/src/movement.js:87-90`, `bag-of-holding/tests/movement.test.js:102-113`
- **Impact:** Every jump adjudication is wrong by roughly 5×; the 100% coverage number conceals it because the test suite enshrines the incorrect rule. Also a caution flag for trusting coverage as a correctness proxy elsewhere.

#### 7.2.5 [MEDIUM · defect] All 71 newer SRD spell records use string components ('V, S') that the castSpell component gate cannot read

castSpell and hasComponents read spell.components.v / .s / .m.cost as object properties (spellcasting.js:402-410, 493-505). The srd/spells.js entries added later carry components as display strings: components: 'V, S' — 71 records (grep count). 'V, S'.v is undefined, so silenced/somaticBlocked/material gating silently no-ops for every one of these spells; the original ~35 spells carry no components field at all, with the same effect.

- **Evidence:** `bag-of-holding/src/spellcasting.js:400-410`, `bag-of-holding/src/spellcasting.js:493-505`, `bag-of-holding/src/srd/spells.js:55-64 (string components)`, `grep -c "components: '" src/srd/spells.js → 71`
- **Impact:** The Silence-a-caster / bound-hands tactical layer the engine advertises is dead on arrival with the shipped content: no shipped spell can ever be component-blocked. Data and mechanics evolved on divergent schemas with no cross-validation test.

#### 7.2.6 [MEDIUM · defect] Three weapon mastery assignments contradict the 2024 SRD table, and the file's own header contradicts its data

Per the 2024 weapon table: Spear→Sap (code: push, items.js spear entry), Glaive→Graze (code: cleave), Scimitar→Nick (code: sap). Additionally the file header comment disagrees with the data it precedes: it claims 'longsword/scimitar/battleaxe → sap' but the data gives battleaxe topple; claims 'javelin/handaxe/pike → slow' but data gives handaxe vex and pike push; claims 'spear/trident → push' but data gives trident topple; claims 'quarterstaff/warhammer/maul → topple' but data gives warhammer push. The data is mostly right and the comment mostly stale — evidence of unreviewed drift.

- **Evidence:** `bag-of-holding/src/srd/items.js:5-15 (header)`, `bag-of-holding/src/srd/items.js:40 (spear: push)`, `bag-of-holding/src/srd/items.js:48 (glaive: cleave)`, `bag-of-holding/src/srd/items.js:56 (scimitar: sap)`
- **Impact:** Mastery riders are a headline 5.2 feature of this engine; wrong assignments change combat behavior per attack (a spear that pushes instead of sapping). The stale header will mislead future content additions.

#### 7.2.7 [MEDIUM · defect] castFromScroll logic inverted for spells not on the caster's class list

SRD: a scroll spell not on your class's spell list is unintelligible — you cannot cast it. The code does the opposite: const onClassList = args.onClassList !== false; if (onClassList && spell.level > maxCastable) { …DC check… } — so passing onClassList: false SKIPS the ability check and proceeds to a successful cast (spellcasting.js:528-540). The higher-level DC check is also gated on being ON the list, whereas the SRD's DC 10+level check applies when the spell is on your list but above your castable level.

- **Evidence:** `bag-of-holding/src/spellcasting.js:522-558`
- **Impact:** Any host that faithfully reports onClassList:false gets the most permissive outcome instead of a refusal; scrolls become universal cast-anything items for non-casters.

#### 7.2.8 [MEDIUM · gap] Shipped weapons carry no weight (or cost/range) fields, so encumbrance is non-functional with the default registry

carriedWeight counts items without a weight field as 0 (equipment.js:47-55). In srd/items.js every armor entry has weight but no weapon entry does (e.g. greatsword, longbow — no weight key), and no weapon has cost or range either. Equipment.encumbranceLevel therefore only ever sees armor+gear weight.

- **Evidence:** `bag-of-holding/src/equipment.js:47-55`, `bag-of-holding/src/srd/items.js:32-64`
- **Impact:** The encumbrance system the engine exposes (and the sheet's carryingCapacity) cannot produce correct results from shipped data; a fully-armed character weighs the same as an unarmed one. Ranged distance rules are also unadjudicable without range data.

#### 7.2.9 [MEDIUM · inconsistency] Hazards module cites SRD sections for formulas that are homebrew approximations

starvationTick uses foodGrace = max(1, 1 + conMod) days (hazards.js:113) — the SRD (both editions) says 3 + CON mod days. extremeTemperatureTick uses an escalating DC 5 + (hoursExposed−1) (hazards.js:134) — the SRD uses a flat DC 10 per hour. Thirst uses DC 15 + 5/day escalation (hazards.js:119) — 2014 RAW is automatic exhaustion after the grace period, no save. holdBreathRounds floors at 1 round (hazards.js:102-104) vs the SRD's 30-second (5-round) minimum, and suffocation models only an outOfBreath flag with no drop-to-0-HP / exhaustion consequence (hazards.js:93-100). Each carries a comment citing 'per SRD §…'.

- **Evidence:** `bag-of-holding/src/hazards.js:109-127`, `bag-of-holding/src/hazards.js:129-139`, `bag-of-holding/src/hazards.js:93-104`
- **Impact:** Starvation triggers 2 days too early (harsher), temperature is far more lethal after a few hours (DC 14 at hour 10 vs RAW 10), and out-of-breath has no mechanical consequence. Mislabeled house rules erode trust in every other 'per SRD' claim in the codebase.

#### 7.2.10 [MEDIUM · defect] Multi-damage-type spells collapse to a single damage/damageType pair, losing or mistyping half the damage

The spell record schema has one damage + one damageType. Ice Storm is recorded as damage '2d8' bludgeoning (srd/spells.js ice-storm entry) — RAW is 2d8 bludgeoning + 4d6 cold, so 60% of the damage is simply missing. Flame Strike is '4d6' fire — RAW 4d6 fire + 4d6 radiant (half missing). Meteor Swarm is '40d6' fire — RAW 20d6 fire + 20d6 bludgeoning (total right, typing wrong, so fire resistance halves everything).

- **Evidence:** `bag-of-holding/src/srd/spells.js:102 (ice-storm 2d8)`, `bag-of-holding/src/srd/spells.js:110 (flame-strike 4d6)`, `bag-of-holding/src/srd/spells.js:141 (meteor-swarm 40d6 fire)`
- **Impact:** Wrong damage totals and wrong resistance/immunity interaction for exactly the marquee spells of tiers 2-4; the damage pipeline's careful type handling is fed mistyped inputs.

#### 7.2.11 [MEDIUM · debt] Duplicate public APIs with the same name and different signatures: encumbranceLevel ×2, toolCheck ×2

character.js exports encumbranceLevel(str, weightLbs) (positional, character.js:642-646) while equipment.js exports encumbranceLevel({strength, carriedWeight}) (object arg, equipment.js:14-28) — both reachable from index.js (Character.encumbranceLevel at index.js:54 and Equipment.encumbranceLevel). Likewise checks.js toolCheck({toolId, abilityScore, proficient…}) (checks.js:71-74) vs equipment.js toolCheck({actor, toolId, abilityScore, dc…}) which resolves proficiency from actor.proficiencies.tools (equipment.js:74-84). Same semantics, incompatible shapes.

- **Evidence:** `bag-of-holding/src/character.js:642-646`, `bag-of-holding/src/equipment.js:14-28`, `bag-of-holding/src/checks.js:71-74`, `bag-of-holding/src/equipment.js:74-84`, `bag-of-holding/index.js:51-54`
- **Impact:** Hosts (and LLM tool schemas over the engine, e.g. the MCP server) must guess which variant they hold; a swapped call silently mis-computes because both accept an object/number without validation of the other's shape.

#### 7.2.12 [MEDIUM · gap] deriveSheet does not support multiclass records although the multiclass module ships

validateRecord requires classId + level (character.js:109-115) and deriveMaxHp/deriveSaves/deriveSpellcasting read the single classDef; multiclass.js explicitly says 'deriveSheet continues to honour the legacy shape; consumers that want the multiclass features call totalLevel / casterLevel … directly' (multiclass.js:7-10). There is no multiclass slot assembly either — the host must know to call freshSlots('full', casterLevel(record)) itself; nothing composes Pact Magic alongside shared slots.

- **Evidence:** `bag-of-holding/src/character.js:105-155`, `bag-of-holding/src/multiclass.js:1-13`, `bag-of-holding/src/multiclass.js:77-88`
- **Impact:** For an 80h campaign where characters will realistically reach multiclass territory, the sheet — the thing every UI and prompt context reads — cannot represent them; the multiclass module is math without an integration point.

#### 7.2.13 [LOW · defect] Cube AoE treats origin as center with side-length half-width, doubling the SRD cube

targetsInArea cube branch: Math.abs(p.x - origin.x) <= size && Math.abs(p.y - origin.y) <= size (spellcasting.js:643) — a 2·size × 2·size square centered on origin. The SRD cube has side length `size` with the point of origin on a face. A size-20 cube covers 40×40 here.

- **Evidence:** `bag-of-holding/src/spellcasting.js:642-644`
- **Impact:** Cube spells (Thunderwave area, Hypnotic Pattern 30-ft cube) hit up to 4× the intended area.

#### 7.2.14 [LOW · defect] Crawling through difficult terrain costs ×4 instead of the SRD's additive ×3

movementCost multiplies: if (difficult) cost *= 2; if (crawling) cost *= 2 (movement.js:42-50). SRD costs are additive extra feet: base 1 + difficult 1 + crawling 1 = 3 ft per foot, not 4.

- **Evidence:** `bag-of-holding/src/movement.js:42-50`
- **Impact:** Prone characters in rubble move 25% slower than RAW; minor but a visible desync for rules-aware players.

#### 7.2.15 [LOW · defect] Graze mastery damage can go negative and is inflated by non-proficiency attack bonuses

graze computes damage = attackBonus − proficiencyBonus (combat.js:154-156) to recover the ability mod. A negative ability mod yields negative 'damage' with no floor at 0, and any magic-weapon or situational bonus folded into attackBonus inflates graze damage. The comment acknowledges the recovery is approximate but no clamp exists.

- **Evidence:** `bag-of-holding/src/combat.js:144-157`
- **Impact:** A STR 8 attacker with a greatsword grazes for −1 (healing if applied naively); a +2 weapon grazes for mod+2. Bounded, but the host applies this number directly.

#### 7.2.16 [LOW · risk] Dice spec parser accepts unbounded XdY — an LLM-supplied '9999999d9999999' allocates and rolls millions of dice

parse() validates the grammar but not magnitude (dice.js:20-24); roll() then does Array.from({length: count}) (dice.js:44-49). In this architecture, dice specs can originate from LLM output (classifier/narrator-shaped content); a hallucinated large spec stalls the browser main thread.

- **Evidence:** `bag-of-holding/src/dice.js:20-24`, `bag-of-holding/src/dice.js:44-49`
- **Impact:** Single-turn UI freeze / DoS vector in a browser host that pipes model output toward damage rolls. clampDC exists for exactly this class of problem, dice specs have no equivalent.

#### 7.2.17 [LOW · inconsistency] Small data and comment nits: non-SRD spell labeled SRD, lifestyle table conflation, contradictory recharge comment

(1) 'toll-the-dead' ships in srd/spells.js under an 'SRD 5.2 spells' header (srd/spells.js:58) but Toll the Dead is Xanathar's content, not in SRD 5.1 or 5.2 — a licensing/data-provenance slip. (2) LIFESTYLES has squalid: 0 and omits wretched (equipment.js:123-130); SRD: wretched free, squalid 1 sp. (3) magic-items parseDiceSpec's comment says 'Defensive against malformed input — a misconfigured item shouldn't crash a rest' and then throws on malformed input (magic-items.js:191-194).

- **Evidence:** `bag-of-holding/src/srd/spells.js:58`, `bag-of-holding/src/equipment.js:123-130`, `bag-of-holding/src/magic-items.js:191-201`
- **Impact:** Provenance slip has licensing implications if the package claims pure SRD; the others are polish.

### 7.3 Recommendations

#### 7.3.1 [P0 · effort S] Fix castSpell to honor (or refuse) consumeSlot's auto-upcast

Verified silent highest-slot burn with zero upcast benefit. Either propagate the actually-consumed level into castLevel/upcastEffect/concentration, or make auto-upcast opt-in and refuse when the requested level is empty. One-line core fix plus tests.

```js
const slotResult = consumeSlot(actor.spellSlots, slotLevel);
if (!slotResult.ok) return { ok: false, reason: slotResult.reason };
working = { ...working, spellSlots: slotResult.slots };
const effectiveLevel = slotResult.levelCast;   // NOT args.slotLevel
...
const castLevel = args.ritual === true ? spell.level : effectiveLevel;
```

#### 7.3.2 [P0 · effort L] Declare one rules edition and audit every table against it

The 5.1/5.2 mix is the deepest coherence problem: half-caster level-1 slots, prepared-spell formula, multiclass rounding, monster statblocks, Second Wind uses, L20 rage. Pick SRD 5.2 (the package's claim), fix the six confirmed divergences, and add a tests/edition-audit.test.js that pins each table to a cited 5.2 section so future drift fails CI. This also decides what the LLM prompts should assert.

#### 7.3.3 [P1 · effort M] Add advantage/disadvantage (and a flat bonus) to abilityCheck/savingThrow, and consume the condition flags in the engine bindings

Adv/dis on checks and saves is a core 5e mechanic the engine cannot express; conditions.js already declares the flags (ownCheckDisadvantage, saveDexDisadvantage) and exhaustion already computes a d20 penalty — only the roll API is missing. This unlocks removing the magicResistanceDcFor −5 hack and makes restrained/poisoned/frightened/Bless actually enforceable by the fallback layer.

```js
export function abilityCheck({ abilityScore, proficient = false, proficiencyBonus = 2, dc, advantage = false, disadvantage = false, bonus = 0 }, rng = Math.random) {
  const a = rollDie(20, rng);
  const d20 = (advantage && !disadvantage) ? Math.max(a, rollDie(20, rng))
            : (disadvantage && !advantage) ? Math.min(a, rollDie(20, rng)) : a;
  const mod = modFromScore(abilityScore) + (proficient ? proficiencyBonus : 0) + bonus;
  ...
}
```

#### 7.3.4 [P1 · effort M] Normalize spell components to the structured object and add a data↔mechanics contract test

71 records carry components the cast pipeline cannot read; the component-gating feature is dead with shipped content. Convert 'V, S, M' strings to { v: true, s: true, m: {...} } (a mechanical transform), and add a test iterating every SRD spell through hasComponents/castSpell so schema drift between src/srd/ data and mechanics can never recur silently.

```js
for (const spell of Object.values(SRD_SPELLS)) {
  assert.ok(spell.components === undefined || typeof spell.components === 'object',
    `${spell.id}: components must be structured, got ${typeof spell.components}`);
}
```

#### 7.3.5 [P1 · effort S] Fix longJump to use STR score, and correct the pinned test

Rule is wrong by ~5× and the test enshrines it. Also scan sibling tests for other pinned-wrong rules while in there (this audit found crawl-cost ×4 similarly pinned by design).

```js
export function longJump(actor, { runningStart = true } = {}) {
  const score = actor.abilityScores?.str ?? 10;   // SRD: feet equal to STR *score*
  return runningStart ? score : Math.floor(score / 2);
}
```

#### 7.3.6 [P1 · effort S] Correct the three mastery assignments (spear→sap, glaive→graze, scimitar→nick) and rewrite the stale items.js header from the data

Small data fix, per-attack behavioral correctness for a headline 5.2 feature; the contradictory header comment actively misleads future edits.

#### 7.3.7 [P2 · effort S] Invert castFromScroll's off-class-list behavior

SRD: not on your class list = unintelligible = no cast. Currently onClassList:false yields the most permissive path (no check, successful cast).

```js
if (!onClassList) return { ok: false, scrollConsumed: false, reason: 'spell is not on your class list — the scroll is unintelligible' };
```

#### 7.3.8 [P2 · effort M] Add weight/cost/range to weapon records and an end-to-end encumbrance test

Encumbrance and ranged-distance adjudication are unusable with shipped data; the test should derive a fully-equipped fighter and assert non-zero carriedWeight and the correct encumbrance tier.

#### 7.3.9 [P2 · effort S] Align hazards formulas with the SRD or relabel them as house rules

starvation grace 3+CON (not 1+CON), extreme temperature flat DC 10, suffocation consequence at 0 breath (0 HP per 2014 or exhaustion per 2024). Citing 'per SRD' over homebrew math undermines trust in the whole kernel's citations.

#### 7.3.10 [P2 · effort M] Support multi-part damage on spell records ([{dice, type}, ...]) and fix Ice Storm / Flame Strike / Meteor Swarm

The single damage/damageType pair cannot represent common tier-2+ spells; damage totals are currently wrong (Ice Storm missing 4d6 cold entirely) and typing errors corrupt the resistance pipeline.

```js
'ice-storm': { id: 'ice-storm', level: 4, save: 'dex',
  damageParts: [ { dice: '2d8', type: 'bludgeoning' }, { dice: '4d6', type: 'cold' } ] }
```

#### 7.3.11 [P2 · effort S] Clamp dice spec magnitude at the parser

LLM-originated specs reach roll(); an unbounded XdY is a one-turn browser freeze. Mirror the clampDC philosophy: bound at the engine boundary.

```js
const MAX_COUNT = 100, MAX_SIDES = 1000;
if (count > MAX_COUNT || sides > MAX_SIDES) throw new Error(`Dice spec too large: ${spec}`);
```

#### 7.3.12 [P3 · effort S] Deduplicate encumbranceLevel and toolCheck into single canonical exports

Two same-named functions with incompatible signatures in one public API surface is a standing foot-gun, especially for MCP tool schemas generated over the engine. Keep the object-arg forms, re-export from one module, deprecate the others.

#### 7.3.13 [P3 · effort L] Add a multiclass path into deriveSheet (or a deriveMulticlassSheet)

The multiclass math exists but has no integration point with the sheet every consumer reads; needed before any 80h campaign reaches level 5+ with dipped builds. Includes assembling shared slots from casterLevel plus separate pact slots.

### 7.4 Metrics collected

- **srcLinesOfCode:** 11238
- **testsPassing:** 1561
- **testsFailing:** 0
- **testDurationMs:** 2682
- **coverageLinePct:** 99.94
- **coverageBranchPct:** 99.53
- **coverageFuncsPct:** 99.59
- **runtimeDependencies:** 0
- **packageVersion:** 2.1.0
- **coreModulesAudited:** 16
- **classDefs:** 13
- **srdSpellRecords:** 110
- **srdSpellRecordsWithStringComponents:** 71
- **confirmedMasteryDataErrors:** 3
- **confirmedEditionMixInstances:** 6


---

## 8. Rules Engine Content — beats, bestiary, encounters, campaign systems

> Auditor: `engine-content` · strengths 7 · findings 14 · recommendations 11

bag-of-holding is a genuinely well-engineered rules kernel at the micro level: 1561 tests pass in under 3 seconds, the zero-dep/pure-function boundary contract is actually held (grep for fetch/DOM/localStorage over src/ returns nothing), the encounter-design math is numerically faithful to the 2024 DMG, and the hand-maintained index.d.ts tracks even the newest surfaces (Thread.stack, chooseSuccessor, Session). The engine factory (instance-scoped registries, validated plugin merges, rules fingerprint, hook registry) is the strongest architectural asset in the whole three-repo system.

However, the flagship promise of the package — forensic replay determinism — is broken on multiple core paths, and the test suite does not know it. verifyLog throws 'Cannot replay unknown roll op' on any log containing a death save or a class-mechanic application (both recorded since v1.25.0), and every Travel/Equipment/Movement/MagicItems roll plus surprised-initiative draws consume the shared seeded RNG without logging, silently desyncing replay. I confirmed all of these empirically, plus a save/load crash: Session.restore throws on any serialized session whose encounter has ended (adopted monsters persist in the snapshot but can never be re-adopted). These are exactly the primitives an 80-hour campaign's save/verify story would lean on.

For the campaign-systems mandate specifically, the pattern is 'machinery without content, and content without a consumer'. The monster-mechanics module (legendary actions, lair actions, innate spellcasting, multiattack) is complete and tested, but zero of the 66 SRD monsters carry any of those structured blocks — boss traits are unresolvable flavor strings, and CR stops at 15 with 44 of 66 entries at CR ≤ 5, so tier-3/4 play has nothing to fight. Symmetrically, the beat runtime shipped branching and sub-threads in 0.8.0, but the actual game's red thread runs on a second, semantically different beat evaluator reimplemented in bag-of-holding-client — the engine's branching work has no real consumer. The beat schema itself (263 LoC) is a sound v1 primitive but far short of an 80h campaign's needs: no failure states, no acts/arcs, no terminal marker in branch mode (a terminal branch beat falls through to whatever beat sits next in the array), boolean-only flags, no expiry/clock integration.

Doc/versioning discipline has visible cracks: spec.md documents hook payloads that don't match the code and still lists Travel/encumbrance as out-of-scope though both shipped; beat-schema.md and schema.js's own header still claim successors[] is ignored (stale since 0.8.0); package.json sits at 2.1.0 — minted by a merge-conflict-resolution commit — burning the roadmap slot that CLAUDE.md explicitly reserves for the Quiet Stair adventure; and the roadmap status line (2.0.1, 1536 tests, dated 2026-05-21) is stale. None of this is fatal, but it is the 'inconsistent mess' feeling the owner reports, and the replay/restore defects are real product risks for the 80h goal.

### 8.1 What is genuinely good

- **Encounter-design math is numerically faithful to the 2024 DMG** — ENCOUNTER_BUDGETS (per-character low/moderate/high XP for levels 1-20) matches the 2024 DMG XP Budget per Character table exactly, and xpForCR covers CR 0 (10 XP) through CR 30 with correct SRD values including all fractional CRs. Input validation throws with precise messages (unknown level, bad difficulty). This is the kind of deterministic fallback the 80h goal needs. — evidence: `bag-of-holding/src/encounter-design.js:47-70`, `bag-of-holding/src/encounter-design.js:14-36`, `bag-of-holding/src/encounter-design.js:77-91`
- **The boundary contract is genuinely enforced, not aspirational** — grep -rE "fetch(|XMLHttpRequest|document.|window.|localStorage" src/ returns zero hits; every stochastic function takes an injected rng; the oracle deliberately uses a separate rng stream with a documented rationale (oracle.js:110-123). The engine really is auditable, offline-testable, and AI-free as boundary.md promises. — evidence: `bag-of-holding/docs/boundary.md:9-31`, `bag-of-holding/src/solo/oracle.js:110-123`
- **Test and type discipline is real** — npm test: 1561 tests, 0 failures, ~2.8s, across 60 test files covering every namespace including per-class mechanics. index.d.ts (56KB, hand-maintained) types the newest surfaces correctly — Thread.stack, chooseSuccessor picker, Session/SerialisedSession/SharedReplay — and a typecheck smoke test gates the contract. — evidence: `bag-of-holding/index.d.ts:792-844`, `bag-of-holding/index.d.ts:1393-1435`, `bag-of-holding/docs/spec.md:336-338`
- **Engine factory architecture is the system's strongest asset** — createEngine gives instance-scoped registries with validated plugin merges (pointer-quality errors naming registry+id+field), a frozen merged rules object with an FNV-1a fingerprint for cross-pack replay guarding, and a small closed hook vocabulary with clear contracts (ordered, delta-merged, cancellable). Conditions/XP/Combat bindings consistently wrap the pure modules to fire hooks through one path. — evidence: `bag-of-holding/src/engine.js:88-117`, `bag-of-holding/src/engine.js:130-140`, `bag-of-holding/src/hooks.js:36-54`, `bag-of-holding/src/hooks.js:101-111`
- **Monster stat data that exists is accurate** — Spot-checked a dozen entries against the published MM values (ogre CR2/AC11/HP59, troll CR5/AC15/HP84, frost giant CR8/HP138, fire giant CR9/HP162, efreeti CR11/HP200, vampire CR13/AC16/HP144, purple worm CR15/HP247, mummy lord CR15/AC17/HP97) — all correct, with damage specs and immunity arrays wired to the 1.4/1.5 pipelines. — evidence: `bag-of-holding/src/srd/monsters.js:63-77`, `bag-of-holding/src/srd/monsters.js:637-662`, `bag-of-holding/src/srd/monsters.js:715-765`
- **Clean conceptual separation of save-vs-audit persistence** — Session.serialize (state, fingerprint-gated restore) and Replay.share (seed + rollLog, verify) are deliberately distinct affordances with the rationale documented in code; Replay.verify checks the rules fingerprint up front and returns a structured mismatch instead of a confusing mid-stream divergence. — evidence: `bag-of-holding/src/solo/session.js:331-352`, `bag-of-holding/src/solo/replay-share.js:59-76`
- **Host-friendly result shapes throughout the encounter verbs** — Every encounter verb returns { allowed: false, reason } refusals instead of throwing, and every monster-mechanics helper returns { ok: false, reason } — the structured-refusal style a UI (or an LLM host) can render directly. Immutable state transitions throughout encounter.js. — evidence: `bag-of-holding/src/encounter.js:187-202`, `bag-of-holding/src/monsters.js:52-75`

### 8.2 Findings

#### 8.2.1 [CRITICAL · defect] verifyLog throws on logs containing deathSave or mechanicApplied ops — the audit/replay path breaks on any real session

engine.js records op 'deathSave' (line 629) and op 'mechanicApplied' (line 835), and 'hookFired' when logHooks is on (line 337), but replay.js's switch only handles rollDie/roll/rollAdvantage/rollDisadvantage/rollInitiative/attackRoll/damageRoll/abilityCheck/savingThrow and its default case throws 'Cannot replay unknown roll op'. Empirically confirmed: a session with one death save → verifyLog throws 'Cannot replay unknown roll op: deathSave'; one Second Wind → throws on 'mechanicApplied'. Yet roadmap.md marks '1.23.0 Audit / replay surface completion ✅ shipped' and 2.0.0 claims 'Replay.verify(payload) proves the dice stream reproduces'. The audit-completion tests only assert the entries exist in the log; no test ever runs verifyLog over a log containing them.

- **Evidence:** `bag-of-holding/src/replay.js:152-153`, `bag-of-holding/src/engine.js:628-635`, `bag-of-holding/src/engine.js:834-840`, `bag-of-holding/docs/roadmap.md:1050-1070`, `bag-of-holding/tests/audit-completion.test.js:7-16`
- **Impact:** Replay.share/verify — the feature the whole determinism story rests on — throws an uncaught exception on any session where a character dropped to 0 HP or used any class feature. For the 80h goal, replay-based save verification and 'did the AI really roll that' auditing are unusable as shipped.
- **Independent verification: CONFIRMED** — Traced and empirically reproduced. verifyLog's switch (bag-of-holding/src/replay.js:69-151) handles only nine roll ops and its default case (replay.js:152-153) throws 'Cannot replay unknown roll op'. The engine records three ops that verifier cannot replay into the SAME rollLog via the shared record() helper (engine.js:402-411): 'deathSave' at engine.js:629 (whenever the save actually rolled a d20), 'mechanicApplied' at engine.js:835 (on EVERY Mechanics.apply call, dice or not), and 'hookFired' at engine.js:337 (when opts.logHooks is on). No filtering exists anywhere on the path: engine.verifyLog is the raw module function (engine.js:1055; rng.test.js:265-268 asserts identity), Replay.share copies the whole engine.rollLog (src/solo/replay-share.js:40), and Replay.verify passes payload.rollLog unfiltered to verifyLog (replay-share.js:75). Empirical repro on the repo as shipped: one death save -> verifyLog throws 'Cannot replay unknown roll op: deathSave'; one Second Wind -> log ['rollDie','mechanicApplied'] -> throws on mechanicApplied; logHooks attack -> throws on hookFired; end-to-end Session.create + Replay.share + Replay.verify with a death save in the log -> throws, while an attack-only control returns {ok:true}. Test gap confirmed: tests/audit-completion.test.js (the 1.23.0 feature's tests) only asserts the entries exist and never calls verifyLog; rng.test.js:307 ('covers every op type') exercises only the nine replayable ops; the full suite is green (1561 pass, 0 fail), so nothing catches this. Roadmap claims verified: docs/roadmap.md:1050 marks 1.23.0 'Audit / replay surface completion — shipped in v1.25.0' and roadmap.md:1173-1174 claims 'Replay.verify(payload) proves the dice stream reproduces'. Decisive corroboration the original auditor missed: the downstream game already discovered this exact defect and works around it — Dans-Dungeons/src/game/rng.js:77-80: "The engine's own rollLog isn't reused because it tags death saves with a `deathSave` op that verifyLog can't replay; encoding the save as its single `rollDie(20)` keeps the whole log verifiable." Two calibration notes that do not change the verdict: (1) a session with no 0-HP drops, no class-feature use, and logHooks off still verifies fine — the claim's own impact statement already scopes this correctly; (2) the throw-on-unknown-op default is documented intent for forwards-incompatible logs (replay.js:53-55), but 1.23.0 added first-party ops without extending the verifier, so the engine's own output now trips its own forwards-incompat guard. Fix shape: 'mechanicApplied' and 'hookFired' consume no RNG and can be skipped in the switch; 'deathSave' consumes one d20 and must be replayed (draw d20 via rollDie(20, rng) and compare to entry.d20, honoring the rules' crit/fumble outcome mapping) — exactly the shape of the Dans-Dungeons workaround.

#### 8.2.2 [HIGH · defect] Unlogged RNG draws (Travel, Equipment, Movement, MagicItems, surprised initiative) silently desync replay

The engine bindings for Travel.forageCheck/navigateCheck/checkRestInterruption (engine.js:972-974), Equipment.toolCheck (:965), Movement.fall (:1010), and MagicItems.rechargeItem/itemSavingThrow (:1041,:1044) pass the shared seeded rng but never call record(), so their draws advance the stream invisibly. Confirmed: rollDie → forageCheck → rollDie yields verifyLog {ok:false, divergedAt:1}. Separately, surprised participants roll two d20s in rollOrder (encounter.js:108-114) but the log entry is a single 'rollInitiative' that replay re-executes as one draw (replay.js:94-99) — confirmed divergence at index 1. This contradicts travel.js's own claim ('All save and ability rolls route through the engine rng so a seeded session reproduces travel days end to end', roadmap.md:961-963) and the engine comment that 'replay verification then covers an entire combat session end-to-end' (engine.js:560-561).

- **Evidence:** `bag-of-holding/src/engine.js:968-975`, `bag-of-holding/src/engine.js:1010`, `bag-of-holding/src/engine.js:1041-1044`, `bag-of-holding/src/encounter.js:106-114`, `bag-of-holding/src/replay.js:94-99`
- **Impact:** Any campaign session that forages, navigates, uses a tool, falls, recharges an item, or starts a fight with surprise produces a roll log that fails verification with a misleading mid-stream divergence — replay integrity is only true for a narrow combat-only subset of play.

#### 8.2.3 [HIGH · defect] Session.restore crashes on any save made after an encounter ended (or with non-party actors present)

adoptParticipant adds monsters to the actors map (session.js:127-144); endEncounter nulls encounterState but never removes them (:225-228); snapshot() serializes ALL actors into partyState (:322). On restore, actors are rebuilt from partyRecords only, monsters are re-adopted only from a live encounter.order (:399-406), and the partyState overlay calls session.actor(state.id) which throws for unknown ids (:177-181, :411-421). Confirmed: start encounter with 'goblin-1', endEncounter, serialize, restore → throws "Session: no actor with id 'goblin-1' in the party".

- **Evidence:** `bag-of-holding/src/solo/session.js:127-144`, `bag-of-holding/src/solo/session.js:225-228`, `bag-of-holding/src/solo/session.js:321-329`, `bag-of-holding/src/solo/session.js:411-421`, `bag-of-holding/src/solo/session.js:177-181`
- **Impact:** Save-and-reload — the exact path the solo sandbox autosaves through localStorage — throws after the first completed fight. Data-loss-shaped bug: the save exists but can never be loaded.

#### 8.2.4 [HIGH · gap] Bestiary has zero data for the monster-mechanics layer, and no monsters above CR 15

0 of 66 SRD monsters carry any structured multiattack/legendaryActions/lairActions/innateSpellcasting/legendaryResistance/saves block (verified programmatically). Boss abilities exist only as unresolvable flavor strings — mummy has traits: ['Dreadful Glare', 'Multiattack'] (srd/monsters.js:489), young red dragon has 'Fire Breath (Recharge 5–6)' (:84) with no damage/save/recharge spec. So Monsters.multiattackSequence, useLegendaryAction, fireLairAction, castInnate (all of src/monsters.js) have no shipped data consumer. CR distribution: 24 entries at CR ≤ 0.5, 44 at CR ≤ 5, thinning to 1-2 per CR above 8, nothing above 15 — vampire (CR 13) and mummy-lord (CR 15) lack the legendary/lair blocks the real creatures have.

- **Evidence:** `bag-of-holding/src/srd/monsters.js:78-85`, `bag-of-holding/src/srd/monsters.js:484-490`, `bag-of-holding/src/srd/monsters.js:753-765`, `bag-of-holding/src/monsters.js:27-32`
- **Impact:** An 80h campaign runs characters to L15-20, which needs CR 13-24+ opponents with legendary/lair action pressure. Today every fight above CR 5 is a bag of hit points with one attack line; the mechanics engine for boss fights is shelf-ware. Roadmap defers this to Bestiary II/III (2.3/2.4) with no dates.

#### 8.2.5 [HIGH · inconsistency] Two divergent beat runtimes: the game's actual red thread bypasses the engine's Beats entirely

bag-of-holding-client/src/narrative/beats.js reimplements the beat runtime with different semantics: flags live ON the thread ({beats, currentIndex, flags}), completion is a 'beat-done-<id>' flag convention, selection is first-eligible-incomplete (not index/successors walking), and there is no validation, no casting, no branching, no sub-threads. Dans-Dungeons/src/game/story.js imports currentBeat/completeBeat/setFlag/storyProgress from 'bag-of-holding-client' — not from the engine. Meanwhile the engine's thread.js shipped branching via chooseSuccessor and sub-thread stacks in 0.8.0 (thread.js:74-138) and exports them through index.js, unused by the actual game.

- **Evidence:** `bag-of-holding-client/src/narrative/beats.js:16-66`, `Dans-Dungeons/src/game/story.js:16-19`, `bag-of-holding/src/beats/thread.js:74-138`, `bag-of-holding/index.js:40`
- **Impact:** The 'red thread' — the centerpiece of the 80h vision — has two competing implementations with incompatible thread shapes and completion semantics. Features built in the engine (branching, side-quest sub-threads, archetype casting) cannot reach the game without a migration, and improvements land in whichever copy someone happens to touch. This is the single clearest source of the 'inconsistent mess' feeling.

#### 8.2.6 [HIGH · gap] Beat schema is not expressive enough for an 80h branching campaign

The whole runtime is 266 LoC. Missing for campaign scale: (a) failure states — isComplete only checks setRequiredFlags all-true (thread.js:53-56); there is no failFlags, no 'beat failed' outcome, no expiry, no scene-clock linkage; (b) acts/arcs — no grouping field, no act boundaries, no priority/weight for competing side quests; (c) terminal marker in branch mode — a terminal beat with successors: [] falls into the linear fallback and advances to currentIndex+1, i.e. whatever beat happens to sit next in the ARRAY, which in a branching deck can be a beat from a bypassed branch (thread.js:119-126); 'finished' is only reachable via array-end; (d) flags are global booleans — no counters, no values, no namespacing, so 'gathered 3 of 5 proofs' or faction-standing gates can't be expressed; (e) sub-threads carry no link to the spawning beat and no completion reward hook.

- **Evidence:** `bag-of-holding/src/beats/thread.js:53-56`, `bag-of-holding/src/beats/thread.js:119-126`, `bag-of-holding/src/beats/schema.js:67-80`
- **Impact:** The advertised 'red thread' schema can express a linear chain with simple flag gates; it cannot express the acts, failure branches, foreshadowing, timed pressure, or partial-progress side quests an 80h AAA campaign story needs. Content authored today will need schema migration later.

#### 8.2.7 [MEDIUM · defect] classifyEncounter's 'high' band is a single point; difficulty is systematically understated then overstated

encounter-design.js:107-112: xp < low → trivial; xp < moderate → 'low'; xp < high → 'moderate'; xp === high → 'high'; else 'deadly'. For a 4×L3 party (low 600 / moderate 900 / high 1600): a 1500 XP encounter (94% of the high budget) classifies 'moderate'; 1601 XP classifies 'deadly'; 'high' occurs only at exactly 1600. The DMG semantic is 'budget = max spend for that difficulty', so (moderate, high] should be 'high'.

- **Evidence:** `bag-of-holding/src/encounter-design.js:99-114`
- **Impact:** Any host using classifyEncounter to pace an 80h campaign's procedural encounters will systematically under-rate hard fights as 'moderate' and jump straight to 'deadly', making difficulty tuning erratic.

#### 8.2.8 [MEDIUM · debt] Version discipline broken: 2.1.0 slot burned by a merge commit; roadmap status stale; dual milestone/release numbering

CLAUDE.md: 'The reserved 2.x slots (2.1.0 = Quiet Stair...) are committed, do not collide.' package.json is at 2.1.0, set by merge commit c4654c7 ('Merge origin/main (2.0.9)... Bumps to 2.1.0') — no Quiet Stair adventure exists anywhere in the repo (grep hits only docs). roadmap.md's status line still says '2.0.1... 1536 tests' dated 2026-05-21 (actual: 2.1.0, 1561 tests), and a 'Where we are today (0.x pre-release)' section with '230 tests' survives further down (roadmap.md:49-61). The roadmap also uses dual numbering ('1.13.0 ✅ shipped in v1.17.0', '1.15.0 ✅ shipped in v1.18.0') that makes it genuinely hard to know what any version contains.

- **Evidence:** `bag-of-holding/CLAUDE.md (Versioning section)`, `bag-of-holding/package.json:3`, `bag-of-holding/docs/roadmap.md:8-23`, `bag-of-holding/docs/roadmap.md:49-61`, `bag-of-holding/docs/roadmap.md:837-877`
- **Impact:** The versioning scheme the project set for itself is already violated; the next 'Quiet Stair' release cannot use its reserved number, and consumers reading the roadmap cannot map versions to features.

#### 8.2.9 [MEDIUM · inconsistency] spec.md hook documentation contradicts the implementation on five events

spec.md:305-306 says onCast 'fires after Spellcasting.castSpell' with payload { caster, spell, levelCast, target }; engine.js:871-877 fires it BEFORE the cast (it is the cancellation intercept) with { actor, spell, args }. spec.md:299-301 says onTurnStart receives { actor, round, turn, context }; engine.js:724-727 passes only { actor, context }. spec.md:302-304 says onLongRest/onShortRest receive { actor, recovered }; engine.js:771-777 passes { actor, previous, interrupted }. onDamageApplied documented as { actor, amount, type, result } vs actual { actor, previous, amount, finalAmount, outcome, type } (engine.js:688-692); onHpChanged documented { actor, before, after } vs actual { actor, previous, hpBefore, hpAfter, cause } (engine.js:693-699).

- **Evidence:** `bag-of-holding/docs/spec.md:297-311`, `bag-of-holding/src/engine.js:724-735`, `bag-of-holding/src/engine.js:771-777`, `bag-of-holding/src/engine.js:688-699`, `bag-of-holding/src/engine.js:867-877`
- **Impact:** A plugin author following spec.md writes handlers against payload fields that don't exist (recovered, levelCast, round) and silently reads undefined — exactly the class of bug the 'fail loud' philosophy elsewhere tries to prevent.

#### 8.2.10 [MEDIUM · inconsistency] spec.md 'Out of scope' still lists shipped features; beat docs and code comments claim branching doesn't exist

spec.md:129-132 lists 'Encumbrance arithmetic' and 'Gameplay-toolbox content (Travel Pace ...) — narrator-side, not engine' as out of scope, while the engine ships Equipment.encumbranceLevel/encumbranceSpeedPenalty (engine.js:948-966) and a full Travel namespace (src/travel.js, engine.js:968-975). schema.js:1-5 still says 'successors[] is present in the schema but ignored by the v1 runtime' and beat-schema.md:96-107 says 'At v2 a pickNext function will...' — both stale since 0.8.0 shipped branching with a differently-named chooseSuccessor picker, plus byId/stack fields the doc's thread shape ({ beats, currentIndex }, beat-schema.md:66) omits.

- **Evidence:** `bag-of-holding/docs/spec.md:129-132`, `bag-of-holding/src/travel.js:1-15`, `bag-of-holding/src/beats/schema.js:1-5`, `bag-of-holding/docs/beat-schema.md:66`, `bag-of-holding/docs/beat-schema.md:96-107`
- **Impact:** Anyone (human or LLM agent) deciding where to build campaign features from the docs will conclude branching doesn't exist and travel belongs in the host — steering new work into the wrong repo and deepening the duplication already seen in bag-of-holding-client.

#### 8.2.11 [MEDIUM · gap] Movesets is demo-grade: ~2 chips per class, no cast/ranged/item affordances

movesets.js base combat actions are melee attack, disengage, dash only (movesets.js:62-66) — no ranged attack, no 'cast a spell' chip even for full casters (wizard's only chip is 'Arcane Recovery (during short rest)', :121), no use-item, and labels are hardcoded English in an i18n'd host. The CLASS_PROVIDERS table is static metadata not connected to the actual Mechanics/resource state (a Fighter with Second Wind spent still shows the chip).

- **Evidence:** `bag-of-holding/src/movesets.js:57-70`, `bag-of-holding/src/movesets.js:80-123`, `bag-of-holding/docs/spec.md:51-53`
- **Impact:** The 'legal action chips' surface the spec advertises as the deterministic fallback for open play cannot drive real combat UI for casters or resource-tracking, so hosts (and the LLM classifier) must reinvent legality logic.

#### 8.2.12 [LOW · defect] Scene clock loses sub-minute time: per-round advances floor to zero

advanceTime computes Math.floor((delta.rounds ?? 0) / 10) minutes per call (scene-clock.js:59). A host advancing the clock one round at a time (the natural per-turn call) adds 0 minutes forever — 100 calls of {rounds:1} yields 0 minutes instead of 10. There is no fractional-minute accumulator on the scene.

- **Evidence:** `bag-of-holding/src/scene-clock.js:55-60`
- **Impact:** In-fiction time freezes during combat for any host that ticks per round, so dawn/dusk-driven recharges and spell expiries drift over a long campaign.

#### 8.2.13 [LOW · defect] Replay.share ignores rollLogCap truncation

share() copies engine.rollLog verbatim (replay-share.js:40) with no check that entry index 0 is present. If the engine was created with a finite rollLogCap and entries were dropped from the head (engine.js:407-409), verify() replays the truncated log from the seed and reports a bogus divergence at index 0 with no hint why.

- **Evidence:** `bag-of-holding/src/solo/replay-share.js:35-44`, `bag-of-holding/src/engine.js:405-410`
- **Impact:** Long sessions with a log cap produce share payloads that always fail verification, discrediting the replay feature precisely when sessions are long (the 80h case).

#### 8.2.14 [LOW · debt] SRD monsters file: CR section headers contradict the data; snapshot log entries shallow-copied

Within srd/monsters.js the comment banners misfile entries: giant-spider (cr:1) and knight (cr:3) under '=== CR 2 ===' (lines 369-389), hyena (cr:0) under CR 1/2 (:201-208), mastiff (cr:0.125) under CR 1/4 (:169-176), wight (cr:3) under CR 4 (:519), mage (cr:6) under CR 5 (:586-594), vampire (cr:13) under 'CR 10-11' (:715). Separately, Session.snapshot copies log entries with { ...e } only (session.js:327), so nested payload objects stay shared with live state despite the 'share no references' doc claim (:315-320).

- **Evidence:** `bag-of-holding/src/srd/monsters.js:348-389`, `bag-of-holding/src/srd/monsters.js:201-208`, `bag-of-holding/src/solo/session.js:315-329`
- **Impact:** Minor: misleads maintainers scanning by tier, and a host mutating a snapshot's log payload corrupts live session history.

### 8.3 Recommendations

#### 8.3.1 [P0 · effort S] Make verifyLog total over the recorded op vocabulary

This is the highest-leverage fix: today one death save or one Second Wind makes every audit of the session throw. Bookkeeping ops (mechanicApplied, hookFired) consume no dice and should be skipped; deathSave consumes exactly one d20 and is fully reconstructable from the entry (deathSaveDC lives in rules). Add a regression test that runs verifyLog over a log produced by an integration-style session (attack + death save + mechanic + rest).

```js
// src/replay.js — inside the switch
case 'deathSave': {
  const d20 = rollDie(20, rng);
  if (d20 !== entry.d20) return { ok: false, divergedAt: i, expected: entry.d20, actual: d20 };
  break;
}
case 'mechanicApplied':
case 'hookFired':
  break; // bookkeeping entries: no dice consumed
```

#### 8.3.2 [P0 · effort M] Route every engine-rng draw through record() (Travel, Equipment, Movement, MagicItems, surprise)

Any unlogged draw from the shared seeded rng silently invalidates the whole log after it. Either log these ops (and add replay cases) or give these namespaces the oracle treatment — an explicitly separate rng stream with the same documented rationale as Solo.oracle. Surprised initiative additionally needs its two d20s represented (log initiativeD20s: [a,b] and replay both draws).

```js
// engine.js Travel binding — wrap like Checks:
forageCheck: (args, context) => {
  const result = TravelBase.forageCheck(args, rng);
  record('forageCheck', { terrain: args.terrain, d20: result.check.d20, success: result.check.success }, context);
  return result;
}
// encounter.js rollOrder — log both surprise dice:
if (onInitiativeRoll) onInitiativeRoll({ id: p.id, dexterity: p.dexterity, value: initiative, surprised: p.surprised === true, d20s: p.surprised ? [a, b] : [d20] });
```

#### 8.3.3 [P0 · effort S] Fix Session.restore to re-adopt serialized non-party actors

The save/load path crashes after any completed encounter — the solo sandbox autosaves through exactly this path. The partyState array already contains everything adoptParticipant needs; restore should adopt instead of throw.

```js
// src/solo/session.js restore(): before the overlay loop
for (const state of payload.partyState ?? []) {
  if (!session.hasActor(state.id)) session.adopt(structuredClone(state));
}
// expose hasActor/adopt from create(), or make actor(id) fall back to adoptParticipant for restore
```

#### 8.3.4 [P1 · effort L] Unify the two beat runtimes on one owner

The engine's Beats (branching, sub-threads, casting) and bag-of-holding-client's narrative/beats.js (flags-on-thread, done-flag convention — the one Dans-Dungeons actually plays) must converge before any 80h story content is authored, or the content will be written against the weaker, unvalidated copy. Pragmatic path: adopt the client's thread shape ({beats, currentIndex, flags}) and done-flag convention INTO bag-of-holding's Beats as the canonical runtime (it is save-friendly and already proven in the game), port branching/sub-threads onto it, then delete the client copy and re-export from the engine.

#### 8.3.5 [P1 · effort M] Extend the beat schema for campaign scale: terminal markers, failure states, arcs, valued flags

Four additive schema fields unblock 80h authoring without breaking existing decks: terminal:true (branch-mode end, closing the fall-through-to-array-order hole at thread.js:119-126), failFlags/onFail (a beat can fail and route to a recovery successor — campaigns need losable beats), actId/arcId grouping (context scoping per docs/ideas/12 needs to know which act to load), and numeric flag values (state.flags[k] as number with prerequisites like ['proofs>=3']). Each is validator-accepted now, runtime-consumed incrementally — the same successors[] strategy that worked before.

```js
// thread.js advance(), branch mode:
if (beat.terminal === true) return { thread, advanced: true, finished: true };
// isFailed(beat, state): any failFlags set → offer beat.onFail successors instead of beat.successors
```

#### 8.3.6 [P1 · effort L] Give the top of the bestiary its mechanics: structured blocks for CR 5+ and a CR 16-24 tier

Boss play is the payoff of an 80h campaign and currently nothing exercises the (complete, tested) legendary/lair/innate machinery. Two steps: (1) add multiattack/legendaryActions/legendaryResistance/lairActions/innateSpellcasting/saves blocks to the existing CR 5-15 entries (vampire, mummy-lord, dragons, giants — the real stat blocks have them); (2) pull Bestiary III (roadmap 2.4.0) forward with ~10 CR 16-24 capstones. Also convert trait strings like 'Fire Breath (Recharge 5–6)' into resolvable specs ({ recharge: [5,6], save: { ability: 'dex', dc: 17 }, damage: '16d6', type: 'fire' }) so the deterministic resolver — not the LLM — owns breath weapons.

#### 8.3.7 [P2 · effort S] Fix classifyEncounter band edges

Make the banding consistent with 'budget = maximum spend at that difficulty' so 'high' is a real interval and 'deadly' means over-budget, matching how hosts will pace procedural encounters.

```js
let band;
if (xp <= low * 0.5) band = 'trivial';
else if (xp <= low) band = 'low';
else if (xp <= moderate) band = 'moderate';
else if (xp <= high) band = 'high';
else band = 'deadly';
```

#### 8.3.8 [P2 · effort M] Doc-truth sweep: spec hook payloads, beat-schema branching, out-of-scope list, roadmap status

Five hook payload descriptions, the beat-schema 'v1 ignores successors' story (and schema.js's own header comment), the out-of-scope list contradicting shipped Travel/Equipment, the stale roadmap status line, and the monsters.js CR banners are all mechanical fixes. In a project where LLM agents do much of the work, stale docs actively generate wrong code — this sweep is cheaper than one bug it prevents.

#### 8.3.9 [P2 · effort S] Repair version discipline: re-slot Quiet Stair, single version axis in the roadmap

2.1.0 is published-in-repo without its reserved content; re-reserve Quiet Stair as 2.2.0 (shifting bestiary slots) or explicitly annotate the burn in roadmap + CLAUDE.md so agents stop treating 2.1.0 as available. Drop the dual 'milestone 1.15.0 shipped in v1.18.0' numbering going forward — one axis, the released version.

#### 8.3.10 [P3 · effort S] Accumulate fractional round-minutes on the scene clock

Store remainder rounds on the scene so per-round advancing accrues time instead of flooring to zero each call.

```js
const totalRounds = (scene.roundRemainder ?? 0) + (delta.rounds ?? 0);
const minutesFromRounds = Math.floor(totalRounds / 10);
const roundRemainder = totalRounds % 10;
// include roundRemainder on the returned scene
```

#### 8.3.11 [P3 · effort S] Guard Replay.share against capped logs; deep-clone session log snapshots

share() should throw (or set verifiable:false) when rollLog[0]?.index !== 0, and snapshot() should structuredClone log entries to honor its no-shared-references promise.

### 8.4 Metrics collected

- **tests_total:** 1561
- **tests_passing:** 1561
- **test_duration_ms:** 2791
- **test_files:** 60
- **package_version:** 2.1.0
- **roadmap_claimed_version:** 2.0.1
- **roadmap_claimed_tests:** 1536
- **src_total_loc:** 8466
- **beats_runtime_loc:** 266
- **engine_loc:** 1089
- **encounter_loc:** 708
- **replay_loc:** 157
- **session_loc:** 424
- **docs_total_lines:** 4960
- **monsters_total:** 66
- **monsters_by_cr:** 0:5, 1/8:6, 1/4:5, 1/2:8, 1:7, 2:5, 3:8, 4:2, 5:5, 6:3, 8:2, 9:2, 10:2, 11:2, 12:1, 13:1, 15:2
- **monsters_cr_max:** 15
- **monsters_at_or_below_cr5:** 44
- **monsters_with_structured_mechanics_blocks:** 0
- **verifylog_unhandled_ops:** ["deathSave", "mechanicApplied", "hookFired"]
- **unlogged_rng_surfaces:** ["Travel.forageCheck", "Travel.navigateCheck", "Travel.checkRestInterruption", "Equipment.toolCheck", "Movement.fall", "MagicItems.rechargeItem", "MagicItems.itemSavingThrow", "surprised initiative (2nd d20)"]
- **encounter_budget_table_vs_dmg2024:** exact match, levels 1-20, all three bands
- **xp_for_cr_table_vs_srd:** exact match, CR 0-30 incl. fractions
- **boundary_grep_hits:** 0


---

## 9. Client Toolkit — bag-of-holding-client

> Auditor: `client-toolkit` · strengths 8 · findings 16 · recommendations 13

bag-of-holding-client is the best-factored of the audited repos and the right home for host machinery. The boundary discipline is real, not aspirational: zero runtime dependencies, no DOM outside src/output/, no import of the rules engine anywhere (optional peerDependency only), every entry point config-injected, and 92 tests pass in ~0.5s. The README's ownership table ("owns / deliberately omits") matches what the code actually does, and Dan's Dungeons consumes it through genuinely thin adapters (src/ai/client.js ~40-line shim, world.js injects i18n + bestiary, state.js injects localStorage). The vendored copy at Dans-Dungeons/vendor/bag-of-holding-client is currently byte-identical to the library HEAD — no drift today — though nothing but discipline enforces that.

The problems are concentrated where the library meets the 80-hour goal. First, the dungeon generator's signature lock-and-key puzzle is broken in practice: adjacency is derived for ALL grid-adjacent room pairs, but only the single spine edge is locked, so in an empirical 5000-seed run the vault was reachable without the key 68.7% of the time (0 soft-locks, to its credit). Second, the LLM stack has no abort or timeout anywhere — a hung fetch freezes a turn forever, and chatStream silently drops the schema option and lacks the 429 fallback chain that call() has. Third, runPipeline — the machinery an 80h world's many-layer generation will lean on — has no resumability: a critical-layer failure throws away every completed (paid, BYOK) LLM result, and the game's only recovery is falling back to Quick Dungeon. Fourth, the persistence envelope will happily skip a missing migration step and silently load saves from a *newer* version — exactly the failure modes that corrupt an 80-hour save far from the cause.

There are also cross-module inconsistencies that show the layers were built at different times: the blueprint ships 5 tones but WORLD_SEED_SCHEMA's enum and the EPUB cover palette only know 3; BEAT_SCHEMA declares successors/targetPlaytimeMinutes/requiredArchetypes that no runtime code consumes (and the README claims completeBeat "unlocks successors", which it does not); the game still carries byte-identical duplicates of DUNGEON_OVERLAYS and the model-tier tables that will drift. None of this is architectural rot — the shapes are right, the seams are clean, and every defect below has a small, local fix. This library is an asset for the 80h goal; it needs hardening (abort, checkpointing, lock soundness, migration strictness) more than redesign.

### 9.1 What is genuinely good

- **Right architectural home with genuinely clean boundaries** — The library holds exactly the host machinery the rules kernel omits: LLM transport/client, worldgen orchestration, dungeon algorithm, travel FSM, persistence, narrative/settlement math. No module imports bag-of-holding (optional peerDependency only), no DOM outside src/output/ (documented browser-only), every function takes an explicit config/args object, zero runtime deps. The game consumes it through thin adapters that only inject app content: src/ai/client.js builds an LlmConfig from appState, world.js injects i18n descriptors + bestiary stat blocks, state.js injects localStorage. — evidence: `bag-of-holding-client/package.json:51-59`, `bag-of-holding-client/index.js:26-75`, `Dans-Dungeons/src/ai/client.js:1-35`, `Dans-Dungeons/src/game/world.js:47-57`, `Dans-Dungeons/src/core/state.js:8`
- **Deterministic seeded blueprint with injectable content tables** — buildBlueprint(seed) is fully deterministic (same seed → deepEqual blueprint, covered by tests), accepts custom tables and rng for re-skinning, and mulberry32 matches the engine's Dice.seededRng so game and library RNG interoperate. The *Hints formatters cleanly turn the blueprint into prompt constraints, and the game confirms pre-extraction seed compatibility. — evidence: `bag-of-holding-client/src/worldgen/blueprint.js:169-190`, `bag-of-holding-client/tests/worldgen.test.js:27-49`, `Dans-Dungeons/src/game/worldseed.js:12-17`
- **runPipeline is the right abstraction and killed real duplication** — Digest threading, parallel groups, per-layer retry, critical/non-critical failure semantics, structured progress events — and it is genuinely shared: startCampaign and generateWorldBible both run the single WORLDGEN_LAYERS declaration through it, replacing two previously-divergent hand-rolled pipelines (documented in docs/ideas/14-client.md execution log). — evidence: `bag-of-holding-client/src/worldgen/pipeline.js:59-95`, `Dans-Dungeons/src/game/worldgen.js:106-130`, `Dans-Dungeons/src/game/flow.js:352-366`
- **Dungeon generator guarantees the invariants it tests: bidirectional exits, key reachability, determinism** — In a 5000-seed empirical run, the key was reachable without unlocking anything in 5000/5000 dungeons (zero soft-locks), exits are always paired with correct opposite directions, exactly one key + one locked gate + vault treasure + CR-scaled vault boss per dungeon, and same seed → deepEqual dungeon. The statBlockFor/content injection keeps the algorithm engine-free and node-testable. — evidence: `bag-of-holding-client/src/dungeon/generate.js:117-256`, `bag-of-holding-client/tests/dungeon.test.js:46-91`
- **Persistence envelope handles legacy saves and is storage-agnostic** — Bare pre-versioning snapshots load as v0 and migrate forward — adding versioning never strands an existing save. The injected {getItem,setItem} adapter makes it Map-testable; saveEnvelope never throws on quota (returns false); pick whitelisting keeps transient state out of saves. The game wires it correctly with SAVE_VERSION=2 and interchangeable localStorage/file saves. — evidence: `bag-of-holding-client/src/persistence/envelope.js:26-66`, `bag-of-holding-client/tests/persistence.test.js:38-71`, `Dans-Dungeons/src/core/state.js:144-203`
- **Typed error taxonomy and correct low-level byte work** — ApiError carries status so retry/fallback branches on err.status instead of string-matching. JsonFieldStreamer decodes split \uXXXX escapes across chunk boundaries correctly (tested). The store-only ZIP writer produces correct local headers, central directory, and EOCD with proper offsets; crc32 and pcmToWav are pure and byte-verified in tests. — evidence: `bag-of-holding-client/src/llm/transport.js:12-19`, `bag-of-holding-client/tests/llm.test.js:59-65`, `bag-of-holding-client/src/output/zip.js:30-104`, `bag-of-holding-client/tests/media.test.js:32-40`
- **Vendored copy is currently in exact sync** — diff -rq of src/ and index.js between /home/user/bag-of-holding-client and Dans-Dungeons/vendor/bag-of-holding-client shows zero differences — the vendor copy matches library HEAD (commit 286d633) including the latest persistence/output/media commits. Sync discipline has held so far. — evidence: `bag-of-holding-client (git HEAD 286d633)`, `Dans-Dungeons/vendor/bag-of-holding-client/`
- **Excellent, honest documentation** — The README's package-family table defines each repo by what it refuses to do, the two hard fences (no credentials, no rules) are stated and upheld, and per-subsystem usage examples are accurate against the actual exports. docs/ideas/14-client.md records the extraction with LoC deltas and an explicit not-yet-done list. — evidence: `bag-of-holding-client/README.md:32-66`, `Dans-Dungeons/docs/ideas/14-client.md:11-52`

### 9.2 Findings

#### 9.2.1 [HIGH · defect] Lock-and-key puzzle is bypassable in ~69% of dungeons — the lock is not a cut edge

Adjacency is derived for ALL grid-adjacent room pairs ("for (let i...) for (let j = i + 1...) dirBetween... adjacency[i].push"), so when the spine random-walk folds back on itself or a branch lands next to a post-gate room, an unlocked shortcut around the locked gate appears. Only the single spine edge gateSpineIdx→gateSpineIdx+1 is locked, and only in that one direction (the reverse exit stays unlocked). Empirical 5000-seed run (BFS over unlocked exits from room-0): vault reachable WITHOUT the key in 3433/5000 = 68.7% of dungeons. Soft-locks: 0 (key always reachable, which is correct).

- **Evidence:** `bag-of-holding-client/src/dungeon/generate.js:156-161`, `bag-of-holding-client/src/dungeon/generate.js:199-203`, `bag-of-holding-client/tests/dungeon.test.js:61-66`
- **Impact:** The signature puzzle mechanic is cosmetic in over two-thirds of playthroughs — players wander past the locked door via a side room and the key becomes dead loot. The test suite asserts a lock exists but never that it gates anything, so this regression-proofs nothing.

#### 9.2.2 [HIGH · gap] No abort or timeout anywhere in the LLM stack

Neither transport.post, callOnce, call, chatCompletion, chatStream, generateImage, synthesizeSpeech, nor transcribeAudio accepts an AbortSignal or applies a timeout; every fetch is unbounded and the chatStream reader loop (`while (true) { await reader.read() }`) can only end when the server closes. The game exposes no cancel either (grep for AbortController in Dans-Dungeons/src/ai and src/game/loop.js: zero hits).

- **Evidence:** `bag-of-holding-client/src/llm/transport.js:38-49`, `bag-of-holding-client/src/llm/client.js:33-45`, `bag-of-holding-client/src/llm/client.js:116-147`
- **Impact:** One hung provider request freezes a turn indefinitely with no user-visible recovery — fatal for 80-hour BYOK sessions on real networks, and it blocks features like 'stop generating' or switching models mid-stream.

#### 9.2.3 [HIGH · gap] runPipeline has no resumability — a critical failure discards all completed (paid) results

runPipeline accumulates `results` locally and, when a critical layer fails, throws `new Error("Critical worldgen layer '...' failed")` — the results object is unreachable to the caller. There is no way to pass in already-completed layer results to skip them on a re-run. The game's only recovery is a full fallback: `catch (e) { ... Falling back to Quick Dungeon }`, abandoning the world/factions/beats/region completions the player already paid for. The worldgen DAG for the 80h goal (many regions × settlements × dungeons) multiplies this cost.

- **Evidence:** `bag-of-holding-client/src/worldgen/pipeline.js:80-83`, `bag-of-holding-client/src/worldgen/pipeline.js:59-95`, `Dans-Dungeons/src/game/flow.js:366-370`
- **Impact:** Mid-pipeline failure (rate limit, tab close, network blip) burns real BYOK money with nothing persisted and nothing resumable — an architectural blocker for scaling worldgen from 5 layers to the dozens an 80h open world needs.

#### 9.2.4 [MEDIUM · defect] JsonFieldStreamer breaks on whitespace after the colon — streaming silently dies

The extractor matches the exact compact marker `"narration":"` (constructor: this._marker = `\"${field}\":\"`). Verified empirically: feed('{"narration":"hello"}') → "hello", but feed('{"narration": "hello"}') (one space) → "" and pretty-printed JSON → "". Models frequently emit a space after the colon, especially without response_format enforcement — and the game's streaming narrator call passes no schema (chatStream drops it anyway), relying on prompt-only JSON compliance.

- **Evidence:** `bag-of-holding-client/src/llm/stream.js:13`, `bag-of-holding-client/src/llm/stream.js:23-33`, `Dans-Dungeons/src/ai/client.js:42`
- **Impact:** Depending on which model the player configures, streaming narration silently shows nothing until the full response lands — the flagship progressive-text UX degrades to a long blank wait with no error.

#### 9.2.5 [MEDIUM · inconsistency] Tone vocabulary disagrees across blueprint (5), world-seed schema (3), and EPUB palette (3)

DEFAULT_TABLES.tones = ['grimdark','heroic','mysterious','tragic','whimsical'] and beatArcs has arcs for all five; but WORLD_SEED_SCHEMA constrains tone to enum ['grimdark','heroic','mysterious'], and epub.js TONE_PALETTE only styles those same three. A 'tragic' or 'whimsical' blueprint (2 in 5 seeds) tells the model "Tone: tragic" in worldSeedConstraints while the strict schema forbids answering 'tragic' — the model must emit a contradicting label, and the journal cover falls back to the default palette.

- **Evidence:** `bag-of-holding-client/src/worldgen/blueprint.js:26`, `bag-of-holding-client/src/worldgen/schemas.js:14`, `bag-of-holding-client/src/output/epub.js:33-38`
- **Impact:** 40% of generated worlds carry a tone label that contradicts their creative constraints; downstream tone-keyed behavior (beat arcs vs. stored world.tone vs. EPUB cover) splits into two sources of truth.

#### 9.2.6 [MEDIUM · defect] chatStream is a second-class citizen: drops schema, no 429 fallback chain, unhelpful no-model failure

chatStream destructures only { tier, messages, maxTokens, temperature } — a `schema` passed in opts is silently discarded (no response_format is ever sent on streaming calls), and unlike call() there is no 429 fallback-model walk, only a 400→medium recursion. If resolveModel returns null, the body is sent with model:null producing an opaque provider 400 instead of callOnce's explicit "No model configured for tier" error.

- **Evidence:** `bag-of-holding-client/src/llm/client.js:93-114`, `bag-of-holding-client/src/llm/client.js:18-31`, `bag-of-holding-client/src/llm/client.js:55-63`
- **Impact:** Streaming narration — the highest-frequency call in play — is less schema-reliable and less rate-limit-resilient than one-shot calls; free-tier players hitting 429 mid-dungeon get a hard error on exactly the path that has fallbacks everywhere else.

#### 9.2.7 [MEDIUM · risk] Migration runner silently skips missing steps and silently accepts future-version saves

loadEnvelope's loop `for (let v = version; v < currentVersion; v++) { const migrate = migrations[v]; if (typeof migrate === 'function') data = migrate(data); }` treats an absent migration as a no-op with no warning; and when a save's v is GREATER than currentVersion (save file from a newer build imported into an older deploy — plausible with the SW cache-purge deploy model), the loop body never runs and incompatible newer-shape data is returned as-is with no signal.

- **Evidence:** `bag-of-holding-client/src/persistence/envelope.js:43-46`, `Dans-Dungeons/src/core/state.js:151-154`
- **Impact:** As SAVE_VERSION grows over an 80h campaign's lifetime, a forgotten migration entry or a version skew loads structurally-wrong state that corrupts far from the cause — the classic long-lived-save killer.

#### 9.2.8 [MEDIUM · gap] No backup/rotation or integrity check in the save layer

saveEnvelope is a single-key overwrite: `storage.setItem(key, JSON.stringify(...))`. There is no previous-good copy, no write-then-verify, no checksum, no save slots. The game compounds this: one localStorage key ('dans-dungeons'), quota failure only logged to console (`console.warn('[state] localStorage save failed')`).

- **Evidence:** `bag-of-holding-client/src/persistence/envelope.js:58-66`, `Dans-Dungeons/src/core/state.js:169-172`
- **Impact:** 80 hours of play behind one overwritable localStorage entry: a buggy snapshot, a quota failure mid-write, or browser storage eviction destroys the campaign with no fallback copy — data-loss adjacent for the core goal.

#### 9.2.9 [MEDIUM · gap] Dungeon generator does not scale: size, lock count, and difficulty are hardcoded

spineLen = rrandInt(4, 6), branchCount = rrandInt(2, 4), exactly one locked gate, enemyCount = rrandInt(1, min(3,...)) — none are parameters. There is no CR/XP budget input, no multi-key or multi-level support, no way to ask for a 20-room capstone dungeon versus a 6-room side cave. The 80h plan (docs/ideas/12-context-scoping.md's streamed world) implies many dungeons of varying scale from this one generator.

- **Evidence:** `bag-of-holding-client/src/dungeon/generate.js:139`, `bag-of-holding-client/src/dungeon/generate.js:143`, `bag-of-holding-client/src/dungeon/generate.js:199`, `bag-of-holding-client/src/dungeon/generate.js:236`
- **Impact:** Every dungeon in the 80h world will be the same 6-10 room shape with one lock — pacing and difficulty progression cannot be expressed, so the open world will feel procedurally flat.

#### 9.2.10 [MEDIUM · debt] Byte-identical duplicates persist in the game: DUNGEON_OVERLAYS and the model-tier tables

Dans-Dungeons/src/game/dungeon-overlays.js is a 24-theme copy verified deepEqual-identical to the library's DUNGEON_OVERLAYS, and world.js passes the GAME copy as `overlays:` — the library's export is dead weight for its only consumer. Likewise Dans-Dungeons/src/ai/tiers.js re-declares FREE_MODELS, PAID_MODELS and FREE_FALLBACKS with the same model ids as the library's tiers.js. No sync script or version pin exists for the vendored copy (only the esbuild alias in build.js:22); sync is manual discipline.

- **Evidence:** `Dans-Dungeons/src/game/dungeon-overlays.js:13`, `bag-of-holding-client/src/dungeon/generate.js:30-55`, `Dans-Dungeons/src/game/world.js:53`, `Dans-Dungeons/src/ai/tiers.js:16-50`, `bag-of-holding-client/src/llm/tiers.js:9-32`, `Dans-Dungeons/build.js:22`
- **Impact:** Two sources of truth for creature pools and model routing: the first balance patch or model deprecation applied to one copy silently forks behavior between library tests and shipped game.

#### 9.2.11 [MEDIUM · risk] strict:true json_schema with non-exhaustive `required` is invalid on strict-enforcing providers

client.js always sends response_format `{ json_schema: { strict: true, schema } }`, but NPC_SCHEMA marks only 5 of its 11 properties required (OpenAI-style strict mode mandates every property listed in `required`, using nullable types for optionality). Routed via OpenRouter to a strict-enforcing provider this 400s — and the 400→medium fallback cannot help because worldgen already runs at medium tier, so the layer fails outright. The game already null-normalizes the optional NPC fields after the fact, proving the schema could be made strict-compliant cheaply.

- **Evidence:** `bag-of-holding-client/src/llm/client.js:29-31`, `bag-of-holding-client/src/worldgen/schemas.js:84-101`, `Dans-Dungeons/src/game/worldgen.js:83-93`
- **Impact:** Model portability landmine: switching the medium tier to an OpenAI-family model (a one-line settings change for a BYOK player) breaks settlement generation entirely.

#### 9.2.12 [LOW · defect] call()'s 400→medium fallback is a no-op when a model override is set

callOnce resolves `const model = override ?? resolveModel(tier, ...)`; the 400 recovery re-calls with `{ ...opts, tier: 'medium' }` but opts.model (the override) survives the spread, so the identical model — the likely cause of the 400 — is retried verbatim.

- **Evidence:** `bag-of-holding-client/src/llm/client.js:19`, `bag-of-holding-client/src/llm/client.js:52-54`
- **Impact:** The advertised 400-recovery silently does nothing for override calls (including every 429-fallback retry, which sets opts.model).

#### 9.2.13 [LOW · inconsistency] README and schema promise beat `successors` that the runtime never uses

README says `completeBeat(thread, beat.id)  // raises its flags, unlocks successors`; completeBeat only sets the done flag + setRequiredFlags and bumps currentIndex — it never reads beat.successors. BEAT_SCHEMA also requires the model to generate `successors`, `targetPlaytimeMinutes`, and `requiredArchetypes`, none of which any code in narrative/beats.js or the game consumes.

- **Evidence:** `bag-of-holding-client/README.md:163`, `bag-of-holding-client/src/narrative/beats.js:54-63`, `bag-of-holding-client/src/worldgen/schemas.js:119-144`
- **Impact:** Doc/code mismatch misleads integrators; the model spends tokens generating three required fields that are dead on arrival.

#### 9.2.14 [LOW · gap] Travel FSM constants are not configurable per journey

TRAVEL_SEGMENTS_MIN/MAX (2-3), ENCOUNTER_CHANCE (0.4) and DISCOVERY_CHANCE (0.35) are module constants; beginTravel/stepTravel accept no overrides beyond { safe }. An 80h overworld needs distance-scaled segment counts and region-danger-scaled encounter rates.

- **Evidence:** `bag-of-holding-client/src/travel/fsm.js:8-13`, `bag-of-holding-client/src/travel/fsm.js:15-19`
- **Impact:** Every journey between any two points takes 2-3 identical segments with identical risk — distance and danger cannot be expressed, flattening the overworld.

#### 9.2.15 [LOW · gap] Zero test coverage for the network paths of client.js and audio.js

tests/llm.test.js covers transport helpers, tiers, and JsonFieldStreamer only. call()'s 400/429 fallback ladder, chatCompletion's repair pass, chatStream's SSE loop, synthesizeSpeech's fallback walk and transcribeAudio have no fetch-mocked tests at all — the most intricate control flow in the library is unverified (and the override-400 no-op above would have been caught).

- **Evidence:** `bag-of-holding-client/tests/llm.test.js:1-69`, `bag-of-holding-client/src/llm/client.js:48-67`
- **Impact:** Retry/fallback regressions ship silently; refactoring the client is high-risk despite the '92 tests green' signal.

#### 9.2.16 [LOW · debt] Minor polish: unused stream flag, EPUB 3 missing nav doc, runPipeline order footgun, vendored LICENSE absent

(a) transport.post accepts `{ stream = false }` and never uses it. (b) buildEpub declares version 3.0 but ships only an NCX, no EPUB3 nav document (property='nav') — epubcheck flags this. (c) runPipeline uses dependsOn only for digest lookup, not scheduling: a layer declared before its parent (or in the same group as it) silently receives undefined digests, which hosts interpolate into prompts as the string 'undefined' (README example does `${digests.world}`). (d) The vendored copy ships src+index.js without the MPL-2.0 LICENSE file.

- **Evidence:** `bag-of-holding-client/src/llm/transport.js:38`, `bag-of-holding-client/src/output/epub.js:186-188`, `bag-of-holding-client/src/worldgen/pipeline.js:67`, `bag-of-holding-client/README.md:120-121`, `Dans-Dungeons/vendor/bag-of-holding-client/`
- **Impact:** Small individually; the pipeline ordering footgun is the one most likely to bite when the worldgen DAG grows past five layers.

### 9.3 Recommendations

#### 9.3.1 [P0 · effort S] Make the locked gate an actual cut: lock every edge crossing the pre/post-gate partition, both directions

Fixes the 68.7% bypass rate with a ~15-line local change and no change to the output shape. Compute the pre-gate room set (spine rooms ≤ gateSpineIdx plus branches parented there), then lock all exits between the two sets and add the keyId to each. Also add a regression test asserting BFS-without-key cannot reach the vault.

```js
// after adjacency + gate choice, replace the single-exit lock:
const preGate = new Set(spineIds.slice(0, gateSpineIdx + 1));
for (const b of branchIds) if (preGate.has(branchParent[b])) preGate.add(b);
for (let i = 0; i < totalRooms; i++) {
  for (const ex of rooms[`room-${i}`].exits) {
    const j = Number(ex.roomId.slice(5));
    if (preGate.has(i) !== preGate.has(j)) { ex.locked = true; ex.keyId = 'found-key'; }
  }
}
```

#### 9.3.2 [P0 · effort M] Thread an AbortSignal + default timeout through transport, client, and stream

Every play-loop turn depends on an unbounded fetch. Accept opts.signal in post/callOnce/chatStream, pass it to fetch, and wrap in an AbortSignal.timeout default so a dead provider fails fast into the existing ApiError/fallback machinery instead of hanging the game.

```js
export async function post(config, path, body, { signal, timeoutMs = 60000 } = {}) {
  const s = signal ?? AbortSignal.timeout(timeoutMs);
  const res = await fetch(`${apiBase(config)}${path}`, { method: 'POST', headers: authHeaders(config), body: JSON.stringify(body), signal: s });
  ...
}
// chatStream: also reader.cancel() when s.aborted fires mid-stream
```

#### 9.3.3 [P1 · effort M] Add checkpoint/resume to runPipeline: initialResults in, partial results out

The 80h worldgen DAG will be long and expensive; a mid-run failure must not discard paid completions. Skip layers whose result is supplied, and attach the partial results to the critical-failure error so hosts can persist (via the existing envelope) and resume.

```js
export async function runPipeline(layers, { blueprint, ctx = {}, onProgress, defaultRetries = 0, initialResults = {} } = {}) {
  const results = { ...initialResults };
  ...
  for (const group of groupLayers(layers)) {
    const pending = group.layers.filter(l => results[l.name] == null);
    ...
    if (layer.critical) {
      const err = new Error(`Critical worldgen layer '${layer.name}' failed: ...`);
      err.partialResults = results;   // host saves + resumes with initialResults
      throw err;
    }
}
```

#### 9.3.4 [P1 · effort S] Make JsonFieldStreamer whitespace-tolerant

One space after the colon kills streaming today (verified). Match `"field"` then skip whitespace and the colon statefully instead of an exact compact marker; keeps the chunk-boundary carry logic intact.

```js
// in feed(), replace indexOf(this._marker) with a small regex scan:
const re = new RegExp(`"${this._field}"\\s*:\\s*"`);
const m = this._buf.match(re);
if (!m) { /* keep tail of field.length+4 chars */ return ''; }
this._active = true;
this._buf = this._buf.slice(m.index + m[0].length);
```

#### 9.3.5 [P1 · effort S] Unify the tone vocabulary and derive the schema enum from the tables

Either extend WORLD_SEED_SCHEMA's tone enum and the EPUB TONE_PALETTE to all five blueprint tones, or shrink DEFAULT_TABLES.tones to three — but derive one from the other so they cannot diverge again (e.g. WORLD_SEED_SCHEMA.properties.tone.enum = DEFAULT_TABLES.tones).

```js
import { DEFAULT_TABLES } from './blueprint.js';
tone: { type: 'string', enum: [...DEFAULT_TABLES.tones] },
// epub.js: add tragic/whimsical palettes (or map unknown tones onto the nearest of the three)
```

#### 9.3.6 [P1 · effort S] Harden loadEnvelope: refuse silent migration gaps and future-version saves

Both failure modes corrupt long-lived saves invisibly. Throwing (or invoking an onError callback) on a missing step or v > currentVersion turns a subtle corruption into an explicit, testable event the game can surface ('this save is from a newer version').

```js
if (version > currentVersion) {
  if (onFutureVersion) return onFutureVersion(parsed);
  return null; // never load newer-format data blindly
}
for (let v = version; v < currentVersion; v++) {
  const migrate = migrations[v];
  if (typeof migrate !== 'function') throw new Error(`missing migration v${v}->v${v + 1}`);
  data = migrate(data);
}
```

#### 9.3.7 [P2 · effort M] Bring chatStream to parity with call(): schema, 429 fallbacks, explicit no-model error

Streaming is the hottest path in play. response_format works with stream:true on OpenRouter; add it when opts.schema is set (also fixing the JsonFieldStreamer's input reliability at the source), reuse the tier fallback walk on 429, and throw the same 'No model configured' error callOnce does.

```js
if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'output', strict: true, schema } };
if (!res.ok) {
  if (res.status === 429) { for (const m of fallbacks[tier] ?? []) { try { return chatStreamOnce({ ...args, model: m }); } catch {} } }
  ...
}
```

#### 9.3.8 [P2 · effort M] Parameterize dungeon scale and add a difficulty budget hook

Unblocks varied dungeons for the open world without touching the output contract: accept { spine: [min,max], branches: [min,max], locks, enemyBudget } in opts with today's values as defaults, and let crOf feed a budget-based spawn count instead of the hardcoded 1-3.

```js
const { size = { spine: [4, 6], branches: [2, 4], locks: 1 } } = opts;
const spineLen = rrandInt(size.spine[0], size.spine[1], rng);
const branchCount = rrandInt(size.branches[0], size.branches[1], rng);
```

#### 9.3.9 [P2 · effort S] Delete the game-side duplicates and add a vendor-sync check

dungeon-overlays.js is deepEqual-identical to the library export and ai/tiers.js re-declares the model tables — both will drift. Re-export from 'bag-of-holding-client' instead, and add a tiny script (or test) in Dans-Dungeons that diffs vendor/bag-of-holding-client/src against ../bag-of-holding-client/src and fails the build on drift.

```js
// Dans-Dungeons/src/game/dungeon-overlays.js becomes:
export { DUNGEON_OVERLAYS } from 'bag-of-holding-client';
// package.json: "vendor:check": "diff -rq ../bag-of-holding-client/src vendor/bag-of-holding-client/src && diff -q ../bag-of-holding-client/index.js vendor/bag-of-holding-client/index.js"
```

#### 9.3.10 [P2 · effort S] Make NPC_SCHEMA (and friends) strict-mode compliant

List every property in required and use nullable types for optionality — the game already normalizes nulls post-generation, so this only moves the null-filling from JS onto the schema and removes the OpenAI-strict 400 landmine when players switch medium-tier models.

```js
required: ['id','name','role','attitude','greeting','questHook','personality','secret','factionId','relationships','inventory'],
// with questHook/secret/factionId/inventory already typed ['string'|'array','null']
```

#### 9.3.11 [P2 · effort M] Add fetch-mocked tests for the client's fallback ladder and stream loop

The 400/429 recovery logic and SSE parsing are the riskiest untested code in the library (the override-400 no-op proves it). Node 22's test runner + a stubbed globalThis.fetch covers call(), chatCompletion repair, and chatStream in ~100 lines and would also lock in abort behavior once added.

```js
globalThis.fetch = async (url, init) => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { total_tokens: 5 } }), { status: calls++ === 0 ? 429 : 200 });
```

#### 9.3.12 [P3 · effort S] Expose travel pacing options

Accept { segments: [min,max], encounterChance, discoveryChance } in beginTravel/stepTravel (defaults = today's constants) so region danger and distance can shape journeys in the open world.

```js
export function beginTravel(destination, rng = Math.random, { segments = [TRAVEL_SEGMENTS_MIN, TRAVEL_SEGMENTS_MAX] } = {}) { ... }
```

#### 9.3.13 [P3 · effort S] Add a rotating backup write to saveEnvelope

One extra setItem per save (key + '.bak' holding the previous good envelope) plus a loadEnvelope fallback gives 80h campaigns a second chance against quota failures and corrupt writes at near-zero cost.

```js
const prev = storage.getItem(key);
if (prev != null) { try { storage.setItem(key + '.bak', prev); } catch {} }
storage.setItem(key, JSON.stringify(wrapEnvelope(snap, version)));
```

### 9.4 Metrics collected

- **src_loc:** 2057
- **index_loc:** 75
- **tests_loc:** 884
- **test_count:** 92
- **test_suites:** 28
- **tests_passing:** 92
- **tests_failing:** 0
- **test_duration_ms:** 532
- **modules:** 20
- **dungeon_themes_in_overlays:** 24
- **lock_bypass_rate_5000_seeds:** 68.7% (3433/5000 dungeons: vault reachable without the key)
- **soft_lock_rate_5000_seeds:** 0% (key always reachable)
- **vendored_copy_drift:** 0 files differ (src/ and index.js identical to library HEAD 286d633)
- **duplicated_game_side:** DUNGEON_OVERLAYS (24 entries, deepEqual-identical) + FREE/PAID/FALLBACK model tables in Dans-Dungeons/src/ai/tiers.js
- **runtime_dependencies:** 0
- **library_git_commits:** 7
- **abort_signal_usages_in_llm_stack:** 0
- **fetch_mocked_tests_for_client_js:** 0


---

## 10. MCP Server — bag-of-holding-mcp

> Auditor: `mcp-server` · strengths 6 · findings 12 · recommendations 8

bag-of-holding-mcp is a small (~1,000 LoC src), genuinely well-crafted MCP wrapper around the bag-of-holding engine: 46 tools with consistent namespace_verb naming, LLM-aware descriptions, dual text+structuredContent responses, clean structured errors, a correct minimal session registry, 99 passing tests at 100/100/100 coverage, and exemplary comment discipline. I verified the full wire path with an in-memory MCP client (SDK 1.29.0): tools list, dispatch, validation errors, and error surfacing all behave correctly, and every wrapped engine call still works against engine 2.1.0.

The problem is that it is a frozen snapshot of the engine's 1.0.0-era surface. The repo has exactly 3 commits, all from 2026-05-19/20, while the engine shipped 1.1.0 through 2.1.0 afterward (death saves, damage pipeline, rest, spellcasting, magic items, 66-monster bestiary, encounter FSM, movement, hazards, travel, solo mode, session persistence). Roughly two-thirds of the engine's 24 namespaces are unreachable over MCP, and the gaps gut the repo's own headline use case: a Claude-Desktop DM using this server can roll an attack and damage, but cannot look up a goblin stat block (the srd registry enum omits 'monsters' — wire-verified as an MCP -32602 validation error), cannot apply damage or track death saves, cannot rest, and cannot cast a spell. Meanwhile the peer dependency still pins @zeeuw/bag-of-holding ^1.0.0 against an engine actually at 2.1.0, and the package is not published to npm at all (registry 404) despite README badges and global-install instructions.

Strategically, this repo currently serves neither of its plausible roles in the 80h vision. Dan's Dungeons never touches it (the game imports the engine directly via src/game/rules.js; the only cross-repo mention is one stack-diagram line in docs/ideas/14-client.md:251, and the context-scoping doc 12-context-scoping.md never mentions MCP). Its real potential is as dev tooling — letting Claude Code run rules-correct, replay-deterministic simulations, balance passes, and playtests of generated campaign content — and secondarily as the engine's ecosystem showcase. Both require it to track the engine. The fixes are cheap relative to the quality of the existing scaffolding: the descriptor pattern makes adding tool tranches mechanical, and the honest move is either a deliberate re-sync (peer dep, monsters, encounter/damage/rest tranche, a wire-level test) or an explicit "parked, engine-1.0-era" note in the README so it stops advertising capabilities it doesn't have.

### 10.1 What is genuinely good

- **Tool design fundamentals are genuinely good — an LLM would use most tools correctly first try** — Consistent namespace_verb naming (dice_roll, checks_ability_check, engine_verify_log), descriptions that state return shape, when to use, and cross-tool workflow ('Pass through to engine_verify_log to prove replay-determinism'; 'Always create a session before starting a campaign — the default singleton is unseeded and shared'). Every stateful tool takes an optional session param with correct guidance, and dice/check tools accept a free-form context tag that lands in the rollLog for later filtering. Wire-verified: 46 tools listed, dispatch works, invalid input returns a clean structured error ('Invalid dice spec: not-a-spec'), unknown session returns 'Unknown session: nope'. — evidence: `bag-of-holding-mcp/src/tools/dice.js:34`, `bag-of-holding-mcp/src/tools/dice.js:13-19`, `bag-of-holding-mcp/src/tools/engine.js:18`, `bag-of-holding-mcp/src/tools/engine.js:59`
- **Dual-channel result helper serves both AI and programmatic hosts** — toolResult ships every payload as both a text content block (universal MCP channel) and structuredContent (no re-parse for programmatic hosts); toolError preserves engine error messages verbatim instead of the SDK's generic 'Tool execution failed'. Both behaviors confirmed over a real in-memory transport with SDK 1.29.0 — structuredContent passes through fine without outputSchema. — evidence: `bag-of-holding-mcp/src/_result.js:20-25`, `bag-of-holding-mcp/src/_result.js:37-43`
- **Session registry is small, correct, and deliberately scoped** — Explicit unknown session ids throw (silent fallback would hide host bugs — their comment, and it's right); seed→engine binding happens atomically at create; duplicate ids rejected; rollLog returns a defensive copy so callers can't tamper with the audit trail; rollLogCap honored (test verifies oldest-entry eviction); the default singleton is protected from destroy. Game state deliberately stays in the host per the engine's boundary doc — the comment at the top of sessions.js states this and the README's 'Honest limits' section repeats it honestly. — evidence: `bag-of-holding-mcp/src/sessions.js:46-51`, `bag-of-holding-mcp/src/sessions.js:62-83`, `bag-of-holding-mcp/tests/sessions.test.js:33-43`, `bag-of-holding-mcp/tests/sessions.test.js:59-67`, `bag-of-holding-mcp/README.md:88-97`
- **Descriptor pattern makes the surface embeddable and trivially testable** — Each tools/*.js module returns plain-data [{name, description, input, handler}] arrays; createServer iterates and registers them, returns {server, sessions, tools}, and accepts an injected registry so embedders can share state across transports. This is why the test suite can exercise every handler without a transport, and why extending the surface is mechanical. — evidence: `bag-of-holding-mcp/src/server.js:43-64`, `bag-of-holding-mcp/index.js:18-19`, `bag-of-holding-mcp/tests/server.test.js:26-32`
- **Tests pass 99/99 with real 100% line/branch/function coverage; typecheck green** — Ran npm test (99 pass, 0 fail) and npm run test:coverage (100.00/100.00/100.00 on every src file and index.js) against the local engine at 2.1.0. Tests are behavior-focused, not vacuous: they assert rollLog side effects, context propagation, seed determinism across sessions, cap eviction, and an error path for every tool. — evidence: `bag-of-holding-mcp/tests/tools-dice.test.js:6-14`, `bag-of-holding-mcp/tests/sessions.test.js:21-31`
- **The wrapped 1.0-era subset survived two engine major versions without breakage** — I exercised every wrapped engine call directly against 2.1.0 (abilityCheck, savingThrow, attackRoll, damageRoll, rollInitiative, awardMilestone, nextLevelThreshold, verifyLog, Movesets.legal, applyMastery, deriveSheet, conditions/exhaustion): all work, and rollLog entry shape still matches the engine_get_roll_log description ({index, op, ...payload, context?}). The engine's additive discipline deserves some credit here, but the MCP picked stable primitives to wrap. — evidence: `bag-of-holding-mcp/src/tools/engine.js:49`, `bag-of-holding/src/checks.js:44-50`, `bag-of-holding/src/combat.js:32-56`

### 10.2 Findings

#### 10.2.1 [HIGH · defect] Peer dependency pins engine ^1.0.0 while the engine is at 2.1.0

package.json declares "peerDependencies": { "@zeeuw/bag-of-holding": "^1.0.0" } and only works locally because devDependencies uses "file:../bag-of-holding" (which is 2.1.0). The last commit in the repo is literally 'Bump @zeeuw/bag-of-holding peer dep to ^1.0.0' (2026-05-20) and nothing since. npm registry shows published engine versions [0.0.1, 0.2.0, 1.16.0, 2.1.0] — so a consumer installing this package (if it were published) would have the peer resolved to 1.16.0, an engine 15+ minor versions behind what the sibling repos run, or hit ERESOLVE when combining with engine 2.x.

- **Evidence:** `bag-of-holding-mcp/package.json:69-71 (peerDependencies ^1.0.0)`, `bag-of-holding-mcp/package.json:77 (devDependency file:../bag-of-holding)`, `bag-of-holding/package.json:3 (version 2.1.0)`
- **Impact:** Any out-of-repo consumer gets a silently stale or unresolvable engine pairing; the repo's own versioning contract is false. Blocks using the MCP as the engine's public face.

#### 10.2.2 [HIGH · gap] Two-thirds of the engine is unexposed; the advertised 'Claude as DM' use case cannot run an actual 5e fight

Engine 2.1.0 instances expose 24 namespaces; the MCP wraps parts of 8 (Dice, Checks, Combat, Conditions, XP, Movesets, Beats, deriveSheet). Entirely missing: Spellcasting (25 functions), Rest (shortRest/longRest/spendHitDie), Monsters (legendary actions, multiattack), Movement, MagicItems, Multiclass, Inspiration, EncounterDesign, Hazards, Equipment, Travel, MountedCombat, SceneClock, Mechanics, Solo (oracle), Session (create/restore — the persistence envelope), Replay beyond verifyLog. Combat alone has 49 members and the MCP exposes 5 — no startEncounter/rollOrder/endTurn, no applyDamage/applyDamageModifiers/grantTempHp/heal, no dropToZero/deathSave/stabilize, no opportunityAttack/grapple/shove/dash/dodge/hide. The srd_get/srd_list/srd_dump RegistryKind enum is ['species','classes','backgrounds','feats','spells','items'] — no 'monsters', so the engine's 66-monster bestiary is unreachable; wire-verified that srd_get {kind:'monsters'} returns MCP error -32602 invalid_enum_value.

- **Evidence:** `bag-of-holding-mcp/src/tools/srd.js:16 (RegistryKind enum lacks monsters)`, `bag-of-holding-mcp/src/tools/combat.js:17-95 (5 combat tools)`, `bag-of-holding/index.js:38-42 (24 namespaces + monsters registry exported)`
- **Impact:** An MCP host DM can roll attack and damage but cannot fetch a goblin stat block, apply the damage, track death saves, rest the party, or cast a spell. The README's core pitch ('rules-correct D&D without trusting the model to do the math') is only true for the opening minutes of a session. For the 80h goal, the repo cannot serve as a playtest/simulation harness in its current state.

#### 10.2.3 [HIGH · debt] Repo is frozen (3 commits, last 2026-05-20) while the engine kept moving — drifting into unmaintained territory

git log shows exactly three commits: 'Initial commit' (05-19), 'Initial MCP server: 46 tools' (05-20), 'Bump peer dep' (05-20). The engine's log continues through 2026-06-01 (v2.0.9→2.1.0 merges). Nothing in Dan's Dungeons imports or spawns this server; the only cross-repo reference is a one-line stack description in Dans-Dungeons/docs/ideas/14-client.md:251 ('bag-of-holding-mcp = those rules over MCP'), and docs/ideas/12-context-scoping.md (the 80h context-scoping plan) contains zero MCP mentions.

- **Evidence:** `bag-of-holding-mcp git log (523d0ad 2026-05-20, abc0a62 2026-05-20, 538362b 2026-05-19)`, `Dans-Dungeons/docs/ideas/14-client.md:251`
- **Impact:** The repo consumes maintenance surface area (a fourth sibling repo) while pulling no weight in the 80h plan. Unrefreshed, it will keep decaying as engine 2.2/2.3 (Bestiary I/II) land.

#### 10.2.4 [MEDIUM · inconsistency] README advertises an npm package that does not exist

README carries an npm version badge and instructs 'npm install -g @zeeuw/bag-of-holding-mcp' plus a Claude Desktop config pointing at the installed binary. npm view @zeeuw/bag-of-holding-mcp returns E404 Not Found — the package has never been published (the engine, by contrast, is published at 2.1.0).

- **Evidence:** `bag-of-holding-mcp/README.md:3 (npm badge)`, `bag-of-holding-mcp/README.md:23-25 (install -g instructions)`, `npm registry: 404 for @zeeuw/bag-of-holding-mcp`
- **Impact:** Anyone following the README's primary install path fails at step one. The documented Claude Desktop flow only works from a local clone, which the README never explains.

#### 10.2.5 [MEDIUM · defect] Three LLM-facing description/shape drifts in tool contracts

(1) xp_next_level_threshold description says 'Returns { threshold, level }' but the handler returns { threshold } only — wire-verified: {"threshold":900}. (2) checks_ability_check says 'Returns { roll, total, dc, success }' but the engine returns { d20, mod, total, dc, success } — there is no 'roll' key. (3) combat_attack_roll says 'Returns { roll, total, ac, hit, critical }' but the engine returns { d20, attackBonus, total, ac, hit, critical, fumble, stance }.

- **Evidence:** `bag-of-holding-mcp/src/tools/xp.js:31 (description) vs :39 (handler)`, `bag-of-holding-mcp/src/tools/checks.js:28 vs bag-of-holding/src/checks.js:49`, `bag-of-holding-mcp/src/tools/combat.js:36 vs bag-of-holding/src/combat.js:32-86`
- **Impact:** An agent keying on the promised 'roll' or 'level' fields gets undefined; the tool descriptions are the agent's only contract, so drift here directly causes wrong agent behavior. Also shows nothing tests description-vs-output fidelity.

#### 10.2.6 [MEDIUM · defect] engine_create_session advertises extraMastery plugins that cannot cross the JSON wire

The extras field description lists 'extraSpecies, extraClasses, extraConditions, extraMastery, etc.' but engine mastery plugins must be functions: createEngine({ extraMastery: { homebrew: {…} } }) throws 'extraMastery.homebrew must be a function' (verified). JSON tool arguments can never carry functions, so any agent following this description hits a guaranteed error. Same latent issue for hooks/onRoll mentioned in index.d.ts's CreateSessionOptions comment.

- **Evidence:** `bag-of-holding-mcp/src/tools/engine.js:23`, `bag-of-holding-mcp/index.d.ts:29-33`, `bag-of-holding/src/combat.js:114-117 (handlers looked up from table)`
- **Impact:** First-try failure for a documented capability; the description should scope extras to data-only plugin options.

#### 10.2.7 [MEDIUM · gap] Tests never exercise the MCP dispatch layer — 100% coverage is of handlers only

tests/_helpers.js runs tools via tool.handler(args) directly; no test connects the McpServer to a transport, so SDK registration (server.tool with a raw zod shape), input validation, and wire serialization are untested. My manual InMemoryTransport + Client test confirms it currently works on SDK 1.29.0, but an SDK major bump, a malformed zod shape, or a structuredContent contract change would pass the whole suite and fail at runtime in Claude Desktop.

- **Evidence:** `bag-of-holding-mcp/tests/_helpers.js:20-26`, `bag-of-holding-mcp/tests/server.test.js:5-24 (only asserts tool names)`, `bag-of-holding-mcp/src/server.js:60-62`
- **Impact:** The '100% coverage is the ongoing contract' claim (README.md:104) overstates the safety net; the layer most likely to break on dependency updates has zero automated coverage.

#### 10.2.8 [MEDIUM · risk] Default session: unbounded rollLog, undestroyable, no trim/reset tool

createSessions() eagerly builds the default engine with no rollLogCap ('no seed, no log cap'), destroy('default') throws by design, and no tool exists to clear or cap its log. Every unscoped dice/check/combat call appends to it forever. Being unseeded, its log can also never pass engine_verify_log.

- **Evidence:** `bag-of-holding-mcp/src/sessions.js:31-37`, `bag-of-holding-mcp/src/sessions.js:91-99`, `bag-of-holding-mcp/src/tools/engine.js:22 (rollLogCap 'default ∞')`
- **Impact:** Slow, unbounded memory growth in any long-lived process (the exact 'many concurrent games, one process' deployment the README advertises); agents that forget to create a session — the likeliest failure mode — feed the leak.

#### 10.2.9 [MEDIUM · gap] engine_verify_log forces the entire rollLog through model context; no server-side verify of a named session

The only verification path takes `log: z.array(z.record(z.unknown()))` as a tool argument — the agent must first engine_get_roll_log (pulling every entry into context) and then echo the whole thing back. For a long campaign this is thousands of entries and token-prohibitive. The registry already holds each session's engine and seed metadata (sessions.js metadata Map), so a server-side 'verify session X against its own recorded seed' needs no wire round trip — but no such tool exists, and session metadata isn't even consulted by verify.

- **Evidence:** `bag-of-holding-mcp/src/tools/engine.js:60-69`, `bag-of-holding-mcp/src/sessions.js:76-81 (seed stored in metadata, unused by verify)`
- **Impact:** The audit/replay feature — the repo's founding rationale — is unusable at exactly the campaign lengths (80h) where it matters.

#### 10.2.10 [LOW · inconsistency] The 'drift gate' typecheck only checks index.d.ts against itself

tsconfig.json includes only ['index.d.ts']; tsc --noEmit therefore validates the hand-written declarations in isolation and never compares them to src/sessions.js or src/server.js. The claim in index.d.ts ('the matching npm run typecheck is the drift gate') and README.md:105 ('drift gate for index.d.ts') is near-vacuous — SessionRegistry could diverge arbitrarily from the implementation and typecheck stays green.

- **Evidence:** `bag-of-holding-mcp/tsconfig.json:16-18`, `bag-of-holding-mcp/index.d.ts:4-6`, `bag-of-holding-mcp/README.md:105`
- **Impact:** False confidence; declaration drift will not be caught.

#### 10.2.11 [LOW · gap] No outputSchema, no tool annotations, and opaque record-blob inputs

Tools return structuredContent but declare no outputSchema (wire-verified: outputSchema undefined on dice_roll), so clients can't validate results and the MCP spec's pairing recommendation is unmet. No annotations (readOnlyHint on the many pure lookups like srd_get, checks_mod_from_score; idempotentHint on conditions_remove). Complex inputs (actor, pc, scene, beat, thread, weapon) are all z.record(z.unknown()) with required fields stated only in prose ('must include `mode`'), giving agents no structural guidance and no early validation.

- **Evidence:** `bag-of-holding-mcp/src/tools/movesets.js:21-23`, `bag-of-holding-mcp/src/tools/combat.js:70-75`, `wire test: dice_roll outputSchema undefined`
- **Impact:** Agents must guess record shapes from prose; hosts can't distinguish read-only from mutating tools for permissioning.

#### 10.2.12 [LOW · debt] SERVER_VERSION hardcoded; session id reuse after destroy

SERVER_VERSION '0.0.1' duplicates package.json version by hand (server.js:29). Auto-generated session ids are `session-${engines.size}-${Date.now()}`; after a destroy, size decrements, so an id can be re-minted for a different engine (same-ms create after destroy), silently associating a fresh rollLog with an id a host may have persisted logs under.

- **Evidence:** `bag-of-holding-mcp/src/server.js:28-29`, `bag-of-holding-mcp/src/sessions.js:63`
- **Impact:** Version skew on the wire after a bump; a subtle replay-audit hazard for hosts keying saved logs by session id.

### 10.3 Recommendations

#### 10.3.1 [P0 · effort S] Fix versioning honesty: bump peer dep to ^2.1.0 and correct the README install story

Cheapest, highest-leverage fix. The peer range is factually wrong against the only engine anyone runs (2.1.0), and the README documents an npm package that 404s. Either publish 0.1.0 with the corrected peer range, or replace the install section with the local-clone + absolute-path Claude Desktop config that actually works today, plus a status line stating which engine version the tool surface tracks.

```js
"peerDependencies": { "@zeeuw/bag-of-holding": "^2.1.0" }
// README: { "mcpServers": { "bag-of-holding": { "command": "node", "args": ["/abs/path/bag-of-holding-mcp/bin/cli.js"] } } }
```

#### 10.3.2 [P1 · effort S] Add 'monsters' to the SRD registry enum and fix the three description drifts

One-line enum change unlocks the 66-monster bestiary — the single most valuable missing lookup for any DM host — and the three description fixes (d20 not roll; attackRoll's full shape incl. fumble/stance; drop the phantom level field) repair the agent-facing contract. All four are pure-text/enum edits with zero engine risk.

```js
const RegistryKind = z.enum(['species','classes','backgrounds','feats','spells','items','monsters']);
// xp.js: description: 'Returns { threshold } — the XP value that triggers the next level-up (null at max level).'
// checks.js: 'Returns { d20, mod, total, dc, success }.'
// combat.js: 'Returns { d20, attackBonus, total, ac, hit, critical, fumble, stance }.'
```

#### 10.3.3 [P1 · effort M] Add engine_verify_session: server-side replay of a named session's own log

Makes the audit feature usable at campaign scale by removing the log round trip through model context. The registry already stores seed in metadata; expose a metadata accessor and verify in-process. Keep engine_verify_log for externally saved logs.

```js
{ name: 'engine_verify_session',
  description: 'Replay a seeded session\'s own rollLog server-side. Returns { ok } or { ok:false, divergedAt, expected, actual }. Fails for unseeded sessions.',
  input: { session: z.string() },
  handler: async ({ session }) => {
    const meta = sessions.meta(session); // new accessor over the metadata Map
    if (meta.seed == null) return toolError(new Error(`Session ${session} is unseeded; nothing to verify against`));
    return toolResult(verifyLog({ seed: meta.seed, log: sessions.rollLog(session) }));
  } }
```

#### 10.3.4 [P1 · effort S] Decide the repo's role in the 80h plan explicitly — dev-time simulation harness, or parked

Right now it is half-alive: unused by the game, absent from the context-scoping plan, decaying against the engine. Option A (recommended): position it as the Claude-Code playtest/balance harness for generated campaign content — deterministic seeds + rollLog verification is exactly what automated 80h-campaign QA needs — and fund the tranche-2 tools below. Option B: add a README status banner ('snapshot of engine 1.0.0 surface; not maintained') and stop paying attention. Both are honest; the current state is not.

#### 10.3.5 [P2 · effort L] Tranche 2 tools: combat encounter lifecycle, damage pipeline, death saves, rest, monster mechanics

This is the minimum set that makes 'run a real 5e fight over MCP' true: combat_start_encounter/roll_order/end_turn, combat_apply_damage (with modifiers + temp HP), combat_death_save/drop_to_zero/stabilize, rest_short/rest_long, monsters_multiattack/legendary. The descriptor pattern makes each a ~20-line addition with an existing test template. Spellcasting can follow as tranche 3.

```js
{ name: 'combat_apply_damage',
  description: 'Apply typed damage to an actor through the session\'s resistance/vulnerability/temp-HP pipeline. Returns the new actor record — host must store it.',
  input: { actor: z.record(z.unknown()), amount: z.number().int().nonnegative(), damageType: z.string().optional(), session: SessionField },
  handler: async ({ actor, amount, damageType, session }) => {
    try { return toolResult({ actor: sessions.get(session).Combat.applyDamage(actor, amount, damageType) }); }
    catch (err) { return toolError(err); } } }
```

#### 10.3.6 [P2 · effort M] Add a wire-level test using InMemoryTransport + Client

The suite's 100% coverage never touches SDK registration, zod validation, or serialization — the layer most exposed to dependency bumps. One test file covering listTools (count + a sampled schema), a happy-path callTool, an isError call, and an enum-violation call closes the gap for ~40 lines.

```js
const [ct, st] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 't', version: '0' });
await Promise.all([createServer().server.connect(st), client.connect(ct)]);
const { tools } = await client.listTools();
assert.equal(tools.length, 46);
const r = await client.callTool({ name: 'dice_roll', arguments: { spec: '2d6+3' } });
assert.equal(typeof r.structuredContent.total, 'number');
```

#### 10.3.7 [P2 · effort XL] Generate the tool manifest from the engine instead of hand-maintaining 46 descriptors

The root cause of every drift finding is hand-copied contracts. If the engine exported a machine-readable surface manifest (name, args, result shape per function — it already has 100% JSDoc discipline), the MCP could generate descriptors and a drift test (assert every manifest entry has a tool or an explicit exclusion like castArchetypes). This is the only structural fix that keeps the MCP honest through engine 2.2/2.3 (Bestiary I/II) without per-release manual sweeps.

#### 10.3.8 [P3 · effort S] Hygiene batch: read SERVER_VERSION from package.json, annotate read-only tools, cap or resettable default rollLog, scope the extras description to data-only plugins

Each is small: import pkg version with { with: { type: 'json' } }; add annotations ({ readOnlyHint: true }) to the ~20 pure lookup tools via registerTool; give the default engine a sane rollLogCap (e.g. 10000) or add engine_reset_default; reword extras to 'data-only plugin options (extraSpecies, extraClasses, extraConditions); function-valued plugins (extraMastery handlers, hooks) cannot cross the MCP wire — embed the engine directly for those'.

```js
import pkg from '../package.json' with { type: 'json' };
const server = new McpServer({ name: SERVER_NAME, version: pkg.version });
// sessions.js: const defaultEngine = createEngine({ rollLogCap: 10_000 });
```

### 10.4 Metrics collected

- **tools_total:** 46
- **tool_modules:** 10
- **tests_total:** 99
- **tests_passing:** 99
- **coverage_line_pct:** 100
- **coverage_branch_pct:** 100
- **coverage_funcs_pct:** 100
- **src_loc:** 1008
- **test_loc:** 820
- **repo_js_loc_total:** 1990
- **git_commits:** 3
- **last_commit_date:** 2026-05-20
- **engine_last_commit_date:** 2026-06-01
- **engine_version_local:** 2.1.0
- **peer_dep_declared:** ^1.0.0
- **mcp_published_on_npm:** False
- **engine_published_versions:** ["0.0.1", "0.2.0", "1.16.0", "2.1.0"]
- **mcp_sdk_installed:** 1.29.0
- **engine_namespaces_total:** 24
- **engine_namespaces_wrapped_partially:** 8
- **engine_combat_members:** 49
- **combat_members_exposed:** 5
- **engine_monsters_in_registry:** 66
- **monsters_reachable_via_mcp:** 0
- **engine_spells_in_registry:** 104
- **description_shape_drifts_confirmed:** 3
- **wire_dispatch_tested_in_ci:** False


---

## 11. Cross-Repo Integration — where the mess actually is

> Auditor: `integration-consistency` · strengths 6 · findings 12 · recommendations 10

The cross-repo architecture is better than the owner fears in one dimension and exactly the "inconsistent mess" he suspects in another. The bag-of-holding-client extraction is genuinely well executed: Dans-Dungeons' src/ai/client.js is a real 44-line adapter over the library, world.js/worldseed.js/story.js/state.js are thin content-injection wrappers, persistence goes through the library's versioned envelope, and the vendored copy at vendor/bag-of-holding-client/ is byte-identical to the sibling repo's HEAD (diff -rq shows only README/LICENSE/package.json missing). All four test suites are green (267 + 92 + 1561 + 99 = 2019 passing tests).

The mess is concentrated in the OTHER vendored dependency and in everything version- and doc-shaped. The game does not consume the bag-of-holding engine repo at all in any meaningful sense: vendor/bag-of-holding/ is a frozen v1.16.0 snapshot (46 of 47 files match engine commit eeebb63, whose package.json reads 1.16.0) with exactly one file — src/srd/monsters.js — hand-patched to the 2.x bestiary. The sibling engine repo is at 2.1.0 with 24 files differing and six whole modules (equipment, hazards, mounted-combat, travel, solo/, plus new exports like toolCheck, STARTER_PARTY, encumbranceLevel) that the game has never seen. There is no sync script, no vendor manifest, no version stamp — the chimera matches no released version of the engine, and a future naive re-vendor will silently change combat/character behavior under existing saves. Docs amplify the mess: Dans-Dungeons' CLAUDE.md module map lists two deleted files (src/ai/stream.js, src/ui/epub.js), omits thirteen real ones, and claims unpkg-pinned loading that does not exist anywhere (build.js aliases everything to vendor/); the engine's own 2.1.0 version collides with its roadmap's reserved "Quiet Stair" slot; and bag-of-holding-mcp's peerDependencies (^1.0.0) exclude the very engine version (2.1.0) it is developed and tested against.

Residual duplication is small but real and of the kind that silently diverges: the 24-theme DUNGEON_OVERLAYS table exists verbatim in both the game and the client library, the FREE/PAID model tables and fallback chains are copy-pasted rather than imported, ~1900 lines of game tests re-test client-library code that the client repo also tests (already drifted in content), and the engine's 1886-line examples/solo.html carries a third, hand-rolled OpenRouter GM loop that ignores the client library built for exactly that purpose. For the 80-hour goal, the single most important fix is making the engine dependency deliberate: one canonical rules version, stamped and sync-scripted, so "always falls back on deterministic systems" means one deterministic system, not three snapshots of it.

### 11.1 What is genuinely good

- **The client-library extraction is real, not aspirational** — Every subsystem CLAUDE.md claims moved to bag-of-holding-client actually did, and the app-side shims are genuinely thin: src/ai/client.js is 44 lines binding appState to the library's LlmConfig; world.js injects i18n content + bestiary stat blocks into libGenerateDungeon; state.js persists through wrapEnvelope/loadEnvelope/saveEnvelope/makeCommit; story.js wires the pure beat/faction engines to Spektrum; flow.js drives the travel FSM via beginTravel/stepTravel/isTravelDone/pickEncounter. No leftover copies of the LLM transport, stream parser, EPUB builder, or dungeon algorithm remain in the app (old src/ai/stream.js and src/ui/epub.js are deleted, not orphaned). — evidence: `Dans-Dungeons/src/ai/client.js:8-44`, `Dans-Dungeons/src/game/world.js:47-57`, `Dans-Dungeons/src/core/state.js:8,169-203`, `Dans-Dungeons/src/game/story.js:16-20`, `Dans-Dungeons/src/game/flow.js:19,916-922`, `Dans-Dungeons/src/ui/exports.js:11`
- **vendor/bag-of-holding-client is perfectly fresh** — diff -rq between the vendored copy and the sibling repo shows zero differing code files — only .gitignore/LICENSE/README.md/package.json are absent from the vendor dir. The one vendored dependency that has an active feature pipeline is being kept in sync (so far, by hand). — evidence: `Dans-Dungeons/vendor/bag-of-holding-client/`, `bag-of-holding-client/src/`
- **All four test suites pass, and the client library's surface is fully self-tested** — npm test: Dans-Dungeons 267 pass, bag-of-holding-client 92 pass, bag-of-holding 1561 pass, bag-of-holding-mcp 99 pass, zero failures. Spot-checking ~23 client exports (runTravel, ensureDigest, withRetry, JsonFieldStreamer, pcmToWav, crc32, ApiError plumbing, etc.) found every one exercised by the client repo's own tests — no dead library surface, just surface the game doesn't consume yet. — evidence: `bag-of-holding-client/tests/`, `bag-of-holding-client/index.js:27-75`
- **Bestiary layering across repos is disciplined** — The game's CUSTOM_MONSTERS (19 homebrew creatures) merge over the engine's 66 SRD monsters with exactly one intentional, documented override ('cultist' → 'Feral Cultist'); statBlockFor converts SRD damage specs with the engine's own Dice.parse instead of hand-maintaining breakdowns. The upstreaming even worked in one direction: the 2.x engine's monsters.js now contains the expanded bestiary the game needed. — evidence: `Dans-Dungeons/src/game/bestiary.js:13-53`, `Dans-Dungeons/src/game/creatures.js:15-97`, `bag-of-holding/src/srd/monsters.js:88`
- **The owner's own docs already diagnose part of the problem honestly** — docs/ideas/15-client-roadmap.md records an adversarial re-audit including the exact operational gotcha this audit confirms: 'the app consumes a hand-copied vendor/ copy (no sync script; tests import vendor/ by relative path)'. The self-awareness is there; the mechanism to fix it is not. — evidence: `Dans-Dungeons/docs/ideas/15-client-roadmap.md:39-42`
- **Engine/client boundary is clean in both directions** — bag-of-holding-client contains zero imports of bag-of-holding (grep confirms), matching its README claim; its mulberry32 deliberately reproduces the engine's Dice.seededRng so seeds are interchangeable, with the equivalence documented at both call sites. — evidence: `bag-of-holding-client/src/worldgen/rng.js:5-17`, `Dans-Dungeons/src/game/worldseed.js:12-14`

### 11.2 Findings

#### 11.2.1 [CRITICAL · inconsistency] Vendored engine is a version chimera: v1.16.0 core + one hand-patched 2.x file, 15+ versions behind the sibling repo

Git blob-hash matching proves vendor/bag-of-holding/ in Dans-Dungeons corresponds to engine commit eeebb63 ('Merge feat/1.16.0 — Encounter design tools', package.json 1.16.0): 46 of 47 vendored .js files match that tree exactly. The single mismatch, src/srd/monsters.js, is byte-identical to the CURRENT 2.1.0 engine's monsters.js (hand-copied to get the expanded bestiary the 24 dungeon themes need). Meanwhile the sibling repo is at 2.1.0: diff -rq shows 24 differing files (combat, character, checks, conditions, all 13 class files, spellcasting, srd/species, srd/items, srd/feats, srd/spells, engine, mechanics, movesets, rest, scene-clock, encounter) and six modules the vendored copy lacks entirely (equipment.js, hazards.js, mounted-combat.js, travel.js, solo/, plus index.js exports STARTER_PARTY, Hazards, Equipment, Travel, MountedCombat, Solo, Session, Replay, encumbranceLevel). The game therefore plays on rules no released engine version ever shipped.

- **Evidence:** `Dans-Dungeons/vendor/bag-of-holding/src/srd/monsters.js:88`, `bag-of-holding/index.js:32-54`, `Dans-Dungeons/vendor/bag-of-holding/index.js:33-51`, `bag-of-holding/src/checks.js:53-76`
- **Impact:** The '80h campaign that always falls back on deterministic systems' currently has no single deterministic system: the shipped rules diverge from the canonical engine (no condition records, no species-trait mechanics, no toolCheck, no travel/hazard/equipment rules). Any future re-vendor will silently change combat math, character derivation, and save reconciliation under existing saves — and nothing (no manifest, no version file, no test) will announce it.
- **Independent verification: PARTIAL** — The core finding is real and I reproduced its strongest evidence independently. Blob-hash matching (git hash-object on every vendored file vs git ls-tree -r eeebb63) confirms 46 of 47 .js files in Dans-Dungeons/vendor/bag-of-holding/ are byte-identical to engine commit eeebb63 ("Merge feat/1.16.0 — Encounter design tools", package.json 1.16.0). The sole mismatch, src/srd/monsters.js, is byte-identical (cmp) to the current 2.1.0 HEAD and is exactly the blob introduced in fc12a73 (v1.27.0), which expanded the bestiary from 9 to 66 monsters. The game demonstrably needs that newer file: Dans-Dungeons/src/game/dungeon-overlays.js:13-38 defines 24 theme pools referencing ids (specter, wight, hobgoblin, owlbear, banshee, vampire-spawn) that do not exist in the 1.16.0 registry, Dans-Dungeons/src/game/bestiary.js:3-4 documents the 66-creature expectation, and tests/worldgen/bestiary.test.js enforces id coverage. The vendored copy is what ships: build.js:19-23 aliases 'bag-of-holding' to ./vendor/bag-of-holding/index.js. Missing modules confirmed (no equipment.js, hazards.js, mounted-combat.js, travel.js, solo/), missing index.js exports confirmed (no Hazards/Equipment/Travel/MountedCombat/Solo/Session/Replay/STARTER_PARTY/encumbranceLevel; compare bag-of-holding/index.js:32-56 vs vendored index.js), toolCheck absent from vendored checks.js (present at bag-of-holding/src/checks.js:71), species-trait mechanics absent (bag-of-holding/src/srd/species.js:29-38, src/character.js:553-600). No manifest or version file exists in the vendor dir. "15+ versions behind" is conservative (15 minor 1.x releases plus 2.0.0-2.0.9 and 2.1.0, roughly 20 released versions). However, several stated details are wrong, so the verdict is PARTIAL rather than CONFIRMED — see corrections.
  - *Corrected detail:* Four corrections, none reducing severity (finding remains critical): (1) diff -rq shows 29 differing files, not 24, and 12 of 13 class files differ — classes/index.js is byte-identical — while srd/backgrounds.js also differs and was omitted from the auditor's list. (2) The impact item "no condition records" is wrong as a vendored-vs-canonical gap: the canonical 2.1.0 HEAD also lacks the v1.6.1 condition-record API — conditionName/conditionsRequiringSave exist at engine commit 7badf09 (src/conditions.js:328) but merge c4654c7 dropped them; HEAD's conditions.js differs from the vendored one by only a 9-line "unseen attackers" block. (That silent feature loss in the engine repo's own merge is a separate finding worth reporting.) (3) "Nothing will announce a re-vendor" is overstated: Dans-Dungeons' 267-test suite imports the vendored engine directly (tests/seeded-rolls.test.js:13 pins seeded-RNG draw counts and verifyLog roll-log shape; four worldgen tests import vendor/bag-of-holding), so an API- or RNG-sequence-breaking re-vendor would fail loudly. What is true: no manifest/version file records which engine version was vendored, and semantics-level math changes that keep APIs stable (unseen advantage/disadvantage, species senses/resistances, feat grants in derived sheets) would land silently under existing saves. (4) "Plays on rules no released engine version ever shipped" needs nuance: the executable rules code is pure released 1.16.0; only the SRD monster data registry is the newer v1.27.0 blob (unchanged through 2.1.0). The vendored tree as a whole matches no released version — the chimera is real — but it is code@1.16.0 + monster-data@1.27.0, not hybrid rule math. Provenance caveat: "hand-copied" cannot be proven from Dans-Dungeons git history (the repo's visible history begins at squashed commit d7d2656, 2026-06-05, which already contains the vendor tree in its current state), but the inference is well supported by the bestiary dependency chain above.

#### 11.2.2 [HIGH · debt] No vendor sync mechanism or provenance stamp for either vendored library

package.json scripts are only build/serve/test; there is no vendor:sync script, and vendor/bag-of-holding/ and vendor/bag-of-holding-client/ carry no package.json, VERSION, or manifest (diff -rq: 'Only in /home/user/bag-of-holding-client: package.json ... LICENSE'). The client roadmap doc explicitly names this: every move is 'author in the source repo *and* re-copy files + index.js into vendor/ ... or the deploy runs stale code'. The engine copy being stuck at 1.16.0 with one hand-patched file is this process failing in the wild. Tests deepen the coupling by importing vendored internals by relative path (e.g. '../../vendor/bag-of-holding-client/src/travel/fsm.js').

- **Evidence:** `Dans-Dungeons/package.json:8-12`, `Dans-Dungeons/docs/ideas/15-client-roadmap.md:39-42`, `Dans-Dungeons/tests/worldgen/travel.test.js:12`, `Dans-Dungeons/build.js:19-23`
- **Impact:** Vendor freshness depends entirely on a human remembering to cp -r after every library commit. The one dependency without an active pipeline (the engine) has already rotted; the client copy will follow the moment attention shifts. This is the root cause of the 'inconsistent mess' feeling.

#### 11.2.3 [MEDIUM · defect] bag-of-holding-mcp peerDependencies exclude the engine version it is built against

bag-of-holding-mcp/package.json declares "peerDependencies": { "@zeeuw/bag-of-holding": "^1.0.0" } while its devDependencies use "file:../bag-of-holding" — which is version 2.1.0. ^1.0.0 does not admit 2.x, so the 99-test green suite runs against a version the published peer range forbids.

- **Evidence:** `bag-of-holding-mcp/package.json (peerDependencies vs devDependencies)`, `bag-of-holding/package.json (version 2.1.0)`
- **Impact:** npm 7+ auto-installs peers: installing the published MCP server alongside engine 2.x fails with ERESOLVE (or forces --legacy-peer-deps). Anyone following the README's Claude Desktop setup with the current engine hits a broken install.

#### 11.2.4 [MEDIUM · inconsistency] DUNGEON_OVERLAYS: the 24-theme creature-pool table is duplicated verbatim in game and library

Dans-Dungeons/src/game/dungeon-overlays.js:13-38 and bag-of-holding-client/src/dungeon/generate.js:30-55 contain the same 24 themes with identical atmosphere strings and enemy pools (the library's copy is Object.freeze'd, the game's is not). The game passes its own copy into the generator (world.js:53 'overlays: DUNGEON_OVERLAYS') even though the library defaults to its identical internal table (generate.js:123 'overlays = DUNGEON_OVERLAYS').

- **Evidence:** `Dans-Dungeons/src/game/dungeon-overlays.js:13-38`, `bag-of-holding-client/src/dungeon/generate.js:30-55`, `Dans-Dungeons/src/game/world.js:53`
- **Impact:** Adding or rebalancing a theme in one repo but not the other silently forks dungeon content; the game's bestiary test validates only its own copy, so a library-side edit would ship unvalidated.

#### 11.2.5 [MEDIUM · inconsistency] Model tier tables and fallback chains copy-pasted instead of imported from the client library

FREE_MODELS, PAID_MODELS, and FREE_FALLBACKS in Dans-Dungeons/src/ai/tiers.js:16-50 are line-for-line duplicates of bag-of-holding-client/src/llm/tiers.js:9-32, which index.js explicitly exports for hosts to 'spread, override, or ignore'. The game imports none of them (grep: zero imports of FREE_MODELS/PAID_MODELS/resolveModel/sampling from the library in src/).

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:16-50`, `bag-of-holding-client/src/llm/tiers.js:9-32`, `bag-of-holding-client/index.js:28`
- **Impact:** A model deprecation or fallback-chain fix landed in the library (whose client.js defaults to its own FREE_FALLBACKS at llm/client.js) will not reach the game, and vice versa — the two 429-fallback chains can drift apart while appearing to be one system.

#### 11.2.6 [MEDIUM · inconsistency] Dans-Dungeons CLAUDE.md and README describe a codebase that no longer exists

The module map lists src/ai/stream.js and src/ui/epub.js — both deleted (moved into bag-of-holding-client) — and omits 13 real modules (ai/auth.js, ai/dialogue.js, ai/spend.js, game/bestiary.js, game/creatures.js, game/dungeon-overlays.js, game/rng.js, game/story.js, game/undo.js, game/worldbible.js, game/worldgen.js, game/worldseed.js, ui/timeline.js). It claims runtime libraries 'load from unpkg at pinned URLs' and README says 'Spektrum loaded from a pinned unpkg URL' — but index.html has no unpkg reference and build.js aliases all three bare specifiers to vendor/ files. rules.js's header still says 'import map → pinned unpkg URL (swap in index.html)'. The AI-tier table lists defaults (tiny=gemini-2.5-flash-lite, stt=nvidia/parakeet-tdt) that contradict the code (DEFAULT_MODELS = FREE_MODELS = gemma-4-26b:free...; PAID stt=openai/gpt-4o-mini-transcribe). It documents serialize() for export/save, but saves use pickPersisted and serialize is a dead re-export.

- **Evidence:** `Dans-Dungeons/CLAUDE.md (module map, 'Key constraints', tier table)`, `Dans-Dungeons/build.js:19-23`, `Dans-Dungeons/src/game/rules.js:6-7`, `Dans-Dungeons/src/ai/tiers.js:26-36`, `Dans-Dungeons/README.md:19`
- **Impact:** In an AI-driven workflow the CLAUDE.md IS the steering file: every future agent session starts from a wrong map (phantom files, phantom unpkg strategy, wrong model defaults), reproducing exactly the class of inconsistency this audit was asked to find.

#### 11.2.7 [MEDIUM · debt] Library behavior is tested twice — ~1900 lines of game tests re-test client code and have already drifted from the client's own suite

Dans-Dungeons/tests/worldgen/ (12 files, ~1925 lines) tests travel FSM, beats, factions, settlement economy, dungeon generation, blueprint, and schemas by importing '../../vendor/bag-of-holding-client/src/...' directly, while bag-of-holding-client/tests/ (10 files, ~884 lines) tests the same modules in the source repo. The pairs are not copies: the game's travel.test.js is 123 lines with its own inlined mulberry32; the client's is 53 lines importing mulberry32 from the library. Test STYLES also differ per repo: game and client use describe/it (57 and 28 suites), engine and MCP use flat test() ('suites 0').

- **Evidence:** `Dans-Dungeons/tests/worldgen/travel.test.js:12-25`, `bag-of-holding-client/tests/travel.test.js:6-8`, `Dans-Dungeons/tests/worldgen/ (12 files)`, `bag-of-holding-client/tests/ (10 files)`
- **Impact:** Two suites claiming to guard one behavior means neither is authoritative; a library change can pass its own tests and break the game's vendored expectations (or vice versa), and maintenance cost is paid twice.

#### 11.2.8 [MEDIUM · inconsistency] Engine version 2.1.0 collides with its own reserved 'Quiet Stair' slot, produced by merging a 1.16.0-era divergent branch

bag-of-holding/package.json is 2.1.0, but docs/roadmap.md:1254-1306 says '2.1.0 remains reserved for *The Quiet Stair*' (a starter adventure that does not exist in the repo), and the repo's CLAUDE.md orders 'do not collide with them'. Version archaeology: main was 2.0.9 (d1a8491); commit 7badf09 — whose own package.json reads 1.16.0 and whose message bundles 'v1.6.1 condition records + v1.13.0 species traits + v1.17.0 equipment depth' — was merged in c4654c7 to produce 2.1.0. This 1.16.0-era divergent line is the same lineage the game vendored, i.e. the engine repo itself ran two histories for a while.

- **Evidence:** `bag-of-holding/package.json (version 2.1.0)`, `bag-of-holding/docs/roadmap.md:1254-1306`, `git: d1a8491=2.0.9, 7badf09=1.16.0, c4654c7=2.1.0`
- **Impact:** Version numbers stop meaning anything across the ecosystem: the game cannot pin 'the engine as of Bestiary I' because 2.1.0 is simultaneously Quiet Stair (roadmap), a conflict-resolution merge (git), and the bestiary carrier (content). Downstream ranges (MCP ^1.0.0, client >=2.0.0) are being written against a moving target.

#### 11.2.9 [MEDIUM · debt] A third, hand-rolled GM/LLM implementation lives in the engine's examples/solo.html

bag-of-holding/examples/solo.html (1886 lines) contains its own OpenRouter transport (callOpenRouter, GM_ENDPOINT at line 1373-1398, its own key storage 'bag-of-holding/gm-openrouter-key@1', its own reasoning-model workarounds) and its own classify → narrate → format pipeline — the same concerns bag-of-holding-client/src/llm/ was created to own and Dans-Dungeons/src/game/loop.js implements for the game. Fixes such as 'suppress reasoning-model chain-of-thought' (engine commit 0a9dcea) landed only in this example, not in the shared client library.

- **Evidence:** `bag-of-holding/examples/solo.html:774-786,1373-1456`, `bag-of-holding-client/src/llm/client.js:1-60`, `Dans-Dungeons/src/game/loop.js`
- **Impact:** Three OpenRouter/GM-loop implementations to keep correct; provider workarounds discovered in one never reach the others. The solo example — the engine's public demo — showcases a pattern (hand-rolled fetch) the ecosystem's own client library deprecates.

#### 11.2.10 [LOW · gap] Dead export surface in the game's shim layer

Systematic export/import cross-reference over Dans-Dungeons/src finds: _call (src/ai/client.js:41) exported but never imported (the 'historical surface' kept a dead alias); rules.js re-exports Conditions, XP, and Monsters (src/game/rules.js:13,14,17) that no module consumes — notably XP, meaning no XP/leveling flows through the shim at all; state.js re-exports serialize and addSystem (src/core/state.js:26) that nothing uses (and CLAUDE.md still documents serialize() as the save path).

- **Evidence:** `Dans-Dungeons/src/ai/client.js:41`, `Dans-Dungeons/src/game/rules.js:9-21`, `Dans-Dungeons/src/core/state.js:26`
- **Impact:** Small noise, but the unused XP re-export is a signpost: the engine's XP/leveling system is imported-in-name-only, which matters for an 80h campaign that will need progression.

#### 11.2.11 [LOW · inconsistency] Four ways to name the same engine; licenses and tooling differ per repo

The engine is referenced as 'bag-of-holding' (esbuild alias, game src), '@zeeuw/bag-of-holding' (MCP imports), '../../vendor/bag-of-holding/index.js' (game tests), and 'file:../bag-of-holding' (MCP devDep) — with docs additionally describing an import-map/unpkg path that doesn't exist. Licenses: engine and client are MPL-2.0, MCP is MIT. Tooling: engine has tsconfig + index.d.ts + typecheck + CI (.github), MCP has tsconfig + index.d.ts, the client library — the game's most-loaded dependency — has no types, no typecheck, no CI, and no CLAUDE.md. Engine uses export-default-per-module style; client and game are named-exports-only.

- **Evidence:** `Dans-Dungeons/build.js:19-23`, `bag-of-holding-mcp/src/sessions.js:17`, `Dans-Dungeons/tests/worldgen/beats.test.js (vendor import)`, `bag-of-holding-client/ (no tsconfig, no .github)`, `bag-of-holding-mcp/package.json (MIT) vs bag-of-holding/package.json (MPL-2.0)`
- **Impact:** Each inconsistency is minor, but together they make cross-repo refactors error-prone (which specifier to update?) and leave the central library with the weakest quality gates of the four repos.

#### 11.2.12 [LOW · risk] Vendored sources ship without their MPL-2.0 LICENSE files; Spektrum copy has no provenance at all

vendor/bag-of-holding/ and vendor/bag-of-holding-client/ contain full MPL-2.0-licensed source trees but neither LICENSE file was copied (diff -rq: 'Only in /home/user/bag-of-holding-client: LICENSE'). vendor/spektrum.js (1381 lines) carries no version or origin marker, while docs reference 'unpkg.com/spektrum@1.0.0' — there is no way to verify the vendored copy against any release. Also, sw.js and vendor/app.version sit modified-but-uncommitted in the working tree (build stamp drift).

- **Evidence:** `Dans-Dungeons/vendor/spektrum.js:1-10`, `Dans-Dungeons/docs/ideas/09-hosting-build.md:47`, `git status: ' M sw.js', ' M vendor/app.version'`
- **Impact:** MPL-2.0 §3.1 requires making the license available with distributed source (the vendor dirs are publicly served from the Pages repo); the Spektrum copy cannot be audited for upstream fixes; uncommitted build stamps mean the deployed cache key may not match the committed bundle.

### 11.3 Recommendations

#### 11.3.1 [P0 · effort S] Add a vendor sync script + manifest, and make drift a test failure

Root-cause fix for the chimera problem. A single npm run vendor:sync that copies code files from ../bag-of-holding and ../bag-of-holding-client, includes LICENSE, and writes a VENDOR-MANIFEST.json ({name, version, commit, date} per package) turns hand-copying into a one-command operation; a tiny node --test check that diffs vendor/ against the manifest's recorded commit (when siblings are present) makes silent drift impossible. This also fixes the MPL LICENSE omission for free.

```js
// scripts/vendor-sync.mjs
import { execSync } from 'child_process';
import { cpSync, writeFileSync, readFileSync } from 'fs';
const pkgs = [['../bag-of-holding','vendor/bag-of-holding'],['../bag-of-holding-client','vendor/bag-of-holding-client']];
const manifest = {};
for (const [src, dst] of pkgs) {
  cpSync(`${src}/src`, `${dst}/src`, { recursive: true });
  cpSync(`${src}/index.js`, `${dst}/index.js`);
  cpSync(`${src}/LICENSE`, `${dst}/LICENSE`);
  const pkg = JSON.parse(readFileSync(`${src}/package.json`, 'utf8'));
  manifest[pkg.name] = { version: pkg.version, commit: execSync('git rev-parse --short HEAD', { cwd: src }).toString().trim(), synced: new Date().toISOString() };
}
writeFileSync('vendor/VENDOR-MANIFEST.json', JSON.stringify(manifest, null, 2));
```

#### 11.3.2 [P0 · effort M] Deliberately re-vendor the engine at 2.1.0 (or an explicitly chosen pin) and absorb the behavior delta now

The current vendored engine matches no released version. Sync it wholesale to 2.1.0 via the new script, run the full game suite plus a manual combat/char-create/save-load pass, and fix what the 1.17→2.1 changes break (condition records, species-trait mechanics, character derivation). Doing it now, on purpose, with 267 green tests as the baseline, is vastly cheaper than inheriting the delta accidentally mid-way through the 80h-campaign build — which will want the 2.x Travel, Equipment, Hazards, and Solo/Session modules anyway.

#### 11.3.3 [P1 · effort S] Fix bag-of-holding-mcp peerDependencies to match the engine it tests against

peer '^1.0.0' + devDep file:../bag-of-holding (2.1.0) means the published package peer-conflicts with the only engine version it is actually validated on. One-line change; also decide whether MIT-vs-MPL divergence for this repo is intentional.

```js
"peerDependencies": { "@zeeuw/bag-of-holding": "^2.0.0" }
```

#### 11.3.4 [P1 · effort S] Delete the app-side copies of DUNGEON_OVERLAYS and the model tables; import them from the client library

Both duplicates exist only because of the pre-extraction node-test constraint ('can't resolve the bare specifier'), which the vendored-relative-path import pattern already solves everywhere else. world.js can drop its overlays arg entirely (the library default is identical), and tiers.js should keep only DEFAULT_MODELS selection + the embedded key while importing FREE_MODELS/PAID_MODELS/FREE_FALLBACKS from 'bag-of-holding-client'. Kills the two highest-drift-risk duplications.

```js
// src/ai/tiers.js
import { FREE_MODELS, PAID_MODELS, FREE_FALLBACKS } from 'bag-of-holding-client';
export { FREE_FALLBACKS };
export const DEFAULT_MODELS = { ...FREE_MODELS };
export function modelsForTier(tier) { return tier === 'deluxe' ? { ...PAID_MODELS } : { ...FREE_MODELS }; }
```

#### 11.3.5 [P1 · effort S] Rewrite Dans-Dungeons CLAUDE.md (and README + rules.js header) to match reality

The steering file for every AI session lists deleted modules, omits 13 real ones, describes a nonexistent unpkg strategy, and shows wrong model defaults. Given the owner's agent-driven workflow, this stale map actively manufactures future inconsistency. Update the module map, replace the unpkg claims with 'vendored via esbuild alias + vendor:sync', correct the tier table, and delete the import-map comment in rules.js.

#### 11.3.6 [P1 · effort M] Make bag-of-holding-client the sole owner of library behavior tests; shrink the game's tests/worldgen to integration glue

~1900 lines in Dans-Dungeons/tests/worldgen re-test library internals the client repo also tests, and the pairs have already drifted. Move any game-only cases (bestiary integrity, i18n content injection, blueprint↔overlay contract) into a slim suite; port the richer assertions (e.g. the 123-line travel suite) upstream into the client repo where they run against source, not a copy. One authority per behavior.

#### 11.3.7 [P2 · effort M] Retire or port the engine's examples/solo.html LLM plumbing onto bag-of-holding-client

The 1886-line example carries the ecosystem's third OpenRouter implementation, including reasoning-model fixes the shared client library never received. Either port it to import the client library (making it the reference integration of engine + client together — genuinely useful for the 80h architecture) or stamp it as a frozen demo with a pointer to the client library so fixes stop landing there.

#### 11.3.8 [P2 · effort S] Prune dead shim exports; decide XP's fate explicitly

Remove _call (ai/client.js:41), serialize/addSystem re-exports (core/state.js:26), and the unused Conditions/Monsters re-exports in rules.js. Keep XP only if progression is being wired next (the 80h goal needs it); an unused XP re-export otherwise disguises the fact that leveling isn't implemented.

#### 11.3.9 [P2 · effort M] Bring the client repo up to the ecosystem's own quality bar

The library the game leans on hardest is the only repo with no typecheck, no CI, no types, and no CLAUDE.md. Add at minimum a GitHub Actions node --test workflow and a CLAUDE.md capturing the config-injection/zero-dep bar (already articulated in 15-client-roadmap.md) so agent sessions in that repo hold the line; index.d.ts can follow when the API stabilizes.

#### 11.3.10 [P3 · effort S] Reconcile engine version bookkeeping with the roadmap's reserved slots

2.1.0 shipped as a conflict-resolution merge while the roadmap still reserves 2.1.0 for The Quiet Stair and 2.2.0 for Bestiary I (content that partially shipped inside 2.1.0's monsters.js). Update roadmap.md to reflect what actually shipped in 2.1.0 and re-slot Quiet Stair/Bestiary, so downstream pins ('the game runs engine X') and the CLAUDE.md no-collision rule mean something again.

### 11.4 Metrics collected

- **tests_passing:** {"dans_dungeons": 267, "bag_of_holding_client": 92, "bag_of_holding": 1561, "bag_of_holding_mcp": 99, "total": 2019}
- **loc:** {"dans_dungeons_src_js": 6168, "bag_of_holding_client_src": 2132, "engine_examples_solo_html": 1886, "dans_dungeons_tests_worldgen": 1925, "client_tests": 884}
- **vendored_engine:** {"base_version": "1.16.0 (commit eeebb63)", "sibling_version": "2.1.0", "files_matching_1_16_0": "46/47", "hand_patched_files": 1, "files_differing_from_sibling": 24, "modules_missing_vs_sibling": 6}
- **vendored_client:** {"code_files_differing_from_sibling": 0, "meta_files_missing": 4}
- **duplications:** {"dungeon_overlays_themes_duplicated": 24, "model_table_lines_duplicated": 35, "duplicate_test_files_topics": 7}
- **mcp:** {"tools": 46, "peer_range": "^1.0.0", "actual_dev_engine": "2.1.0"}
- **dead_exports_in_game:** ["_call", "Conditions", "XP", "Monsters", "serialize", "addSystem"]
- **package_versions:** {"dansdungeons": "0.0.0", "bag-of-holding": "2.1.0", "bag-of-holding-client": "0.1.0", "bag-of-holding-mcp": "0.0.1"}
- **licenses:** {"bag-of-holding": "MPL-2.0", "bag-of-holding-client": "MPL-2.0", "bag-of-holding-mcp": "MIT", "dans_dungeons": "private/unspecified"}


---

## 12. Vision vs Reality — docs/ideas audit

> Auditor: `vision-docs` · strengths 6 · findings 17 · recommendations 10

The doc set describes two different products, and the repo contains a third. Docs 00–12 (May 2026) specify an ambitious open-world campaign game: scope packets with S/M/L entity cards, client-side RAG + inverted-index recall, a GM `secrets` slice, chapter/session structure with recaps, IndexedDB spillover, 7-slot model tiers, strict BYOK. Almost none of that exists in code: there is no scope assembler, no retrieval of any kind, no secrets slice, no chapters (session.chapterId is hardcoded 'ch-1'), no IndexedDB, no XP/leveling (every PC is pinned at level 1), and the narrator's memory horizon is the last 3 transcript entries plus a ~230-token digest chain. Meanwhile docs 14–16 (June 2026 onward) describe a different, humbler product — a dungeon+settlement crawler with a library extraction and time-travel branching — and THOSE docs match the code almost perfectly: bag-of-holding-client exists with 92 green tests, the app shrank to 6,222 LOC, worldgen pipelines collapsed to one runWorldgenPipeline, and all five time-travel phases shipped exactly as designed. The promise-vs-built matrix: BUILT = world layers (reduced, no continents), red-thread beats (linear/thin), cascading digests, settlements, travel FSM, lazy region expansion, save envelope v2, real-spend cost meter, time-travel (undo/redo/branch/persist/seeded audit), streaming, TTS/STT/image gen, EPUB journal. PARTIAL = model tiers (tiny/medium/large/image/tts/stt vs the promised tiny/small/medium/large/summarizer/embedder/tts; `large` configured but never called), secrets (per-NPC secret field only), Nerd mode (a last-turn debug bar), slash meta channel (different command set; no /note /seed /retcon). DOC-ONLY = scope packets, S/M/L cards, RAG/inverted index (despite doc 11 recording "ship at MVP" as a DECIDED item), sessions/chapters, IndexedDB, multi-slot saves, save compression/encryption, Esc stream-interrupt, trademark blocklist, safe player-facing terminology, GM mode B, XP/leveling. ABANDONED-in-practice = the BYOK-only pillar (an XOR-obfuscated shared API key ships in tiers.js powering an undocumented free/deluxe product pivot) and every non-goals list (voice input, image gen, and a service worker all shipped while the docs still forbid them).

The honest headline for the owner: the "inconsistent mess" feeling is doc drift, not code rot. The code itself is in decent shape (267 app + 92 lib + 1,561 engine tests, all green; vendor copy currently in sync; clean --no-ff branch discipline across all 83 Dans-Dungeons commits). What's inconsistent is that a contributor reading README.md learns the project is "Early ideation" with "No voice I/O" and Spektrum loaded from unpkg — all three false — and a contributor reading doc 02's status table learns lazy expansion and red-thread beats are "Planned" when both shipped months ago. Worse, the two concrete bugs the June audit documented (tone-enum mismatch C1, en/nl parity C2) are still live today, byte-for-byte: the 5-value TONES table vs 3-value schema enum was even copied into the extracted library, and nl.json is still missing exactly the 39 keys the audit counted. The bag-of-holding repo has its own discipline break: package.json says 2.1.0 — the slot CLAUDE.md explicitly reserves for The Quiet Stair adventure, which does not exist — reached via a feature commit built on a months-stale base whose message names three old version numbers and which set the version back to 1.16.0 before a merge conflict resolution jumped it to 2.1.0. Its roadmap simultaneously claims "2.0.1, 1536 tests" (status line) and "0.x pre-release, 230 tests, 4 classes" (Where-we-are table) while the actual repo has 1,561 tests and 12 classes.

Effort allocation is the strategic finding: roughly the last 45 of 83 commits are time-travel work (12 feat + 4 perf + 3 fix + merges/stamps), while the four systems that gate the 80-hour goal — context scoping (doc 12), sessions/recaps (doc 03), storage scale (doc 06), and progression — received zero commits and have zero code. Time-travel is genuinely excellent and doc 16 is a model of design-doc discipline, but it polishes a game whose playable arc is one dungeon + one settlement at level 1. The right next bets are doc 03 (cheap, immediately extends play), progression (the engine already ships all the XP/leveling math — the app just never calls it), and an incremental doc-12 v1 (structural walk + entity cards, deferring the WASM embedder); docs 00/05/07/09/10/11 should be revised to describe the actual product (free/deluxe tiers, esbuild build, service worker, shipped voice/image), doc 08's mode B and doc 04's blocklist should be explicitly cut or parked, and docs 14/15/16 need their execution-status headers refreshed (14 claims commit() and save versioning are "not yet done" — both shipped — while its flow.js split never happened and flow.js sits at 1,539 lines).

### 12.1 What is genuinely good

- **Doc 16 (time-travel) is design-doc discipline done right — and fully shipped** — The doc's five phases map one-to-one onto shipped code and git history: undo.js (484 LOC cursor/branch model), timeline.js, rng.js (seeded epoch dice with verifyLog-compatible rollLog), SAVE_VERSION bump 1→2 with migration, monotonic spend meter outside Spektrum history. Each phase landed as its own feature branch with tests, exactly per the documented workflow. This is the strongest evidence the doc-driven loop works when a doc is actually picked up. — evidence: `Dans-Dungeons/docs/ideas/16-time-travel-branching.md:170`, `Dans-Dungeons/src/game/undo.js:357`, `Dans-Dungeons/src/game/rng.js:1`, `Dans-Dungeons/src/ai/spend.js:1`, `Dans-Dungeons/src/core/state.js:145`
- **The three-repo family boundary is real, coherent, and enforced** — bag-of-holding's boundary.md grep (fetch/XHR/document/window over src/) returns zero hits; 1,561 engine tests pass; the client lib's README articulates kernel=truth / mcp=tool-access / client=host-machinery crisply, and its 'no credential ever ships' fence is honored — the embedded key stays app-side in tiers.js as docs 14/15 mandate. The doc 14/15 extraction actually happened: 92 lib tests green, app at 6,222 LOC, one runWorldgenPipeline shared by startCampaign and the world bible (worldgen.js:125), travel FSM and dungeon generator consumed from the lib. — evidence: `bag-of-holding/docs/boundary.md:57`, `bag-of-holding-client/README.md:38`, `Dans-Dungeons/src/game/worldgen.js:125`, `Dans-Dungeons/src/ai/tiers.js:9`
- **Cascading digests shipped as designed** — Doc 02's core token-efficiency idea is genuinely implemented: every worldgen prompt threads only {{parentDigest}} (en.json worldSeed/factions/region/settlement prompts), and buildScene assembles the leaf-to-root digest path (dungeon → settlement → region → world) for the narrator, matching implementation/world-gen.md G5's ~230-token budget. — evidence: `Dans-Dungeons/src/game/loop.js:56`, `Dans-Dungeons/src/i18n/en.json:502`, `Dans-Dungeons/docs/implementation/world-gen.md:141`
- **Dans-Dungeons git workflow discipline holds up perfectly in history** — All 83 commits follow the CLAUDE.md loop: feature/fix branch → --no-ff merge with descriptive message → deploy-version stamp → branch deleted (only main + the audit branch exist). 27 merge commits, no force-pushes, no direct-to-main features. The repo's process hygiene is better than its doc hygiene. — evidence: `Dans-Dungeons git log --oneline (83 commits, 27 merges)`, `Dans-Dungeons/CLAUDE.md`
- **Everything is green and the vendor copy is in sync** — npm test: 267 app tests, 92 client-lib tests, 1,561 engine tests — all pass; node build.js bundles clean. diff -rq between bag-of-holding-client/src and the vendored copy shows zero drift today (the doc-15 'hand-copied vendor' gotcha is a live risk but not a live defect). — evidence: `Dans-Dungeons npm test output (pass 267)`, `bag-of-holding-client npm test output (pass 92)`, `bag-of-holding npm test output (pass 1561)`
- **Docs 14 and 15 are honest, adversarially-verified audits** — Doc 15 records an adversarial re-audit that REFUTED parts of its own Tier-1 list (tierForCr/TIER_BANDS 'do NOT move — dead metadata'), corrected phantom functions (dataUriToBlob 'does not exist'), and flagged the vendor-sync gotcha. This is rare self-skepticism in project docs and the refuted items were verifiably not moved. — evidence: `Dans-Dungeons/docs/ideas/15-client-roadmap.md:16`, `Dans-Dungeons/docs/ideas/15-client-roadmap.md:22`

### 12.2 Findings

#### 12.2.1 [CRITICAL · gap] The entire 80h-scale memory/context architecture (doc 12) is doc-only; GM memory horizon is 3 transcript entries

Doc 12 specifies the scope assembler, S/M/L entity cards, packet caching, inverted-index recall, and client-side RAG — and doc 11 records inverted-index and semantic retrieval as DECIDED 'ship at MVP' ('Inverted-index retrieval: ship at MVP. Semantic retrieval: ship at MVP'). Zero code exists: no src/ai/context/, no embed/vector/inverted-index reference anywhere in src/, no transcript summarization. narrate.js sends only recentTranscript.slice(-3); buildScene adds a ~230-token digest chain. There are also no chapters (session.chapterId hardcoded 'ch-1'), so nothing ever compresses old play into recaps.

- **Evidence:** `Dans-Dungeons/docs/ideas/12-context-scoping.md:121`, `Dans-Dungeons/docs/ideas/11-open-questions.md:88`, `Dans-Dungeons/src/ai/narrate.js:40`, `Dans-Dungeons/src/core/state.js:42`, `grep -rni 'embed|vector|scopePacket' src/ → no matches`

#### 12.2.2 [CRITICAL · gap] No progression system: every character is permanently level 1 with 0 XP

character.js creates records with level: 1, xp: 0 and comments 'future level-ups'; no call to XP.awardMilestone or any level-up flow exists in the app. The engine ships complete XP/leveling math for 12 classes to L10 (bag-of-holding spec.md 'Milestone XP', 'All 12 SRD classes... L1 to L10'), so this is purely unwired. An 80-hour campaign with zero character growth is not a campaign; doc 10 Phase 7 promised L1→L5 and was never started.

- **Evidence:** `Dans-Dungeons/src/game/character.js:94`, `Dans-Dungeons/src/game/character.js:106`, `bag-of-holding/docs/spec.md:32`, `Dans-Dungeons/docs/ideas/10-roadmap.md:122`

#### 12.2.3 [HIGH · inconsistency] BYOK pillar contradicted by an embedded, XOR-obfuscated shared API key and an undocumented free/deluxe product pivot

Doc 05 opens 'The site never holds an API key of its own' and doc 00 lists BYOK as a product pillar. tiers.js ships _a (73-byte XOR array) + _b ('DansDungeons2026') + _cfg() decoding a shared free-tier key, injected at four flow.js sites; ai.tier is 'free' | 'deluxe'. No vision doc describes the free/deluxe model — only docs 14/15 mention the key exists, as a thing to keep out of the library. The obfuscation is trivially defeatable in a public GitHub Pages bundle (docs 15 admits this), so the shared key is extractable by anyone.

- **Evidence:** `Dans-Dungeons/docs/ideas/05-ai-runtime.md:7`, `Dans-Dungeons/src/ai/tiers.js:9`, `Dans-Dungeons/src/core/state.js:48`, `Dans-Dungeons/docs/ideas/15-client-roadmap.md:50`
- **Impact:** Contributors reading the AI-runtime doc get a false security/product model; the shared key can be scraped and drained; the actual monetization-shaped product (free vs deluxe tiers) exists nowhere in the design docs.

#### 12.2.4 [HIGH · defect] Both correctness bugs documented in doc 14 (2026-06-05) are still live two months later — one was copied into the extracted library

C1: blueprint.js tones = ['grimdark','heroic','mysterious','tragic','whimsical'] (5) while WORLD_SEED schema enum is ['grimdark','heroic','mysterious'] (3) — now both inside bag-of-holding-client, so the bug shipped to the reusable library. C2: en/nl parity — measured today: en 460 keys, nl 438, exactly 39 missing in nl and 17 only in nl, the same numbers doc 14 recorded; the prescribed tests/i18n/parity.test.js still does not exist.

- **Evidence:** `Dans-Dungeons/vendor/bag-of-holding-client/src/worldgen/blueprint.js:26`, `Dans-Dungeons/vendor/bag-of-holding-client/src/worldgen/schemas.js:14`, `Dans-Dungeons/docs/ideas/14-client.md:132`, `node key-count check: en 460 / nl 438 / 39 missing / 17 extra`
- **Impact:** 2 in 5 generated worlds inject 'Tone: tragic' or 'Tone: whimsical' into a prompt whose strict json_schema forbids that value — the model must contradict its instructions; Dutch players hit untranslated enemy-intro strings.

#### 12.2.5 [HIGH · inconsistency] bag-of-holding version discipline broke: 2.1.0 (reserved for The Quiet Stair) consumed by a merge-conflict resolution; roadmap self-contradicts

package.json is 2.1.0 while roadmap.md states '2.1.0 remains reserved for *The Quiet Stair*' and CLAUDE.md orders 'do not collide with' the reserved 2.x slots — no Quiet Stair adventure exists (examples/ has only solo.html). Trace: commit 7badf09 was built on a months-stale parent (71faf6e), its message names three historical versions ('v1.6.1 condition records + v1.13.0 species traits + v1.17.0 equipment depth'), and it set version to 1.16.0; merge c4654c7 resolved the conflict by writing 2.1.0. Separately, roadmap.md's status line says '2026-05-21: 2.0.1... 1536 tests' (actual: 1561 tests, version 2.1.0) while its 'Where we are today (0.x pre-release)' table still claims '230 tests... 4 classes' — contradicting the status line 40 lines above it and spec.md's 'All 12 SRD classes'. why.md's own status section says v1.16.0.

- **Evidence:** `bag-of-holding/package.json:3`, `bag-of-holding/docs/roadmap.md:1254`, `bag-of-holding/docs/roadmap.md:8`, `bag-of-holding/docs/roadmap.md:49`, `bag-of-holding/docs/why.md:137`, `git show 7badf09:package.json → 1.16.0; git show c4654c7:package.json → 2.1.0`
- **Impact:** The next release cannot follow the committed slot plan (Quiet Stair can no longer be 2.1.0); anyone reading the roadmap to learn engine state gets three mutually exclusive answers.

#### 12.2.6 [HIGH · inconsistency] README.md and docs 00/09/10/11 describe a product that no longer exists — non-goals lists contradict shipped features

README: 'Status: Early ideation', 'No voice I/O', 'No graphics — text-first', 'Zero shipped npm dependencies (Spektrum loaded from a pinned unpkg URL)'. Reality: a fully playable game with STT (stt.js, spacebar mic), TTS, roleplay mode, AI scene images (sketch.js), Spektrum vendored at vendor/spektrum.js and bundled by esbuild (build.js, devDependency esbuild ^0.28.0). Doc 09 mandates 'No build step — what's in the repo is what's served' and 'no service worker for now' — build.js and sw.js both exist. Doc 00 non-goals: 'Voice input', 'Image generation'; doc 10: 'What we're explicitly not doing in v1: Voice I/O'; doc 11 'saying later to: Image generation. Speech-to-text input.' All shipped, none of the lists updated.

- **Evidence:** `Dans-Dungeons/README.md:24`, `Dans-Dungeons/README.md:30`, `Dans-Dungeons/docs/ideas/00-overview.md:39`, `Dans-Dungeons/docs/ideas/09-hosting-build.md:113`, `Dans-Dungeons/docs/ideas/10-roadmap.md:160`, `Dans-Dungeons/vendor/spektrum.js`, `Dans-Dungeons/build.js`
- **Impact:** The repo's front door misinforms every new reader (including future AI agents) about status, architecture, and constraints; 'no build step' guidance would cause a contributor to skip the mandatory bundle rebuild.

#### 12.2.7 [HIGH · inconsistency] Doc 02 and implementation/world-gen.md status tables mark shipped systems as 'Planned' and claim 50 tests (actual: 267)

Doc 02's status table: 'Game flow integration — In progress', 'Settlement UI + chips — Planned', 'Narrator world context — Planned', 'Lazy expansion — Planned Phase B', 'Red thread + beats — Planned Phase C', 'Advanced settlements — Planned Phase D', 'Total tests: 50 passing'. All six shipped: settlement loop + chips (flow.js:398-500), digest path in buildScene (loop.js:56), lazy neighbour region+settlement generation (flow.js:1088-1124), beats runtime (story.js), shops/rest/quests/faction reputation (flow.js:664-672, story.js:49-60). npm test passes 267.

- **Evidence:** `Dans-Dungeons/docs/ideas/02-world-generation.md:127`, `Dans-Dungeons/docs/ideas/02-world-generation.md:148`, `Dans-Dungeons/src/game/flow.js:1088`, `Dans-Dungeons/src/game/story.js:1`, `Dans-Dungeons/docs/implementation/world-gen.md:186`
- **Impact:** A contributor planning work from these tables would re-implement systems that already exist — the most actively misleading drift in the doc set.

#### 12.2.8 [HIGH · risk] Recent effort concentrated entirely on time-travel polish while every 80h-gating system stayed at zero commits

Of the 83 total commits, the most recent ~45 are exclusively the time-travel series (T1.1–T3.5: 12 feat(time-travel), 4 perf, 3 fix, plus merges and version stamps). In the same window: no commits toward context scoping, sessions/chapters, transcript summarization, storage scale, or progression. The shipped game loop is one settlement + dungeons at level 1 — excellent time-travel on a 1–2 hour experience.

- **Evidence:** `Dans-Dungeons git log --oneline -45 (all time-travel)`, `commit-type distribution: 12 feat(time-travel) / 4 perf(time-travel) / 3 fix(time-travel) of 30 non-merge recent commits`
- **Impact:** Opportunity cost: the gap between vision docs and code widened for two months; the 80h goal got no closer while a v2-quality feature (doc 10 didn't even list time-travel) got five polish phases.

#### 12.2.9 [MEDIUM · inconsistency] Dans-Dungeons CLAUDE.md is stale: phantom test path, module map missing ~14 files, wrong tier table

CLAUDE.md says 'Run a single test file: node --test tests/dnd/dice.test.js' — tests/dnd/ does not exist (actual: tests/worldgen/ + 3 root test files); doc 14 flagged this exact staleness and only package.json got fixed. The module map omits story.js, undo.js, timeline.js, worldbible.js, dialogue.js, spend.js, auth.js, bestiary.js, creatures.js, rng.js, worldseed.js, worldgen.js, dungeon-overlays.js. The tier table lists tiny/medium/image/tts/stt with paid-model defaults — omitting the `large` tier and the entire free/deluxe duality that actually governs model selection (DEFAULT_MODELS are the :free set).

- **Evidence:** `Dans-Dungeons/CLAUDE.md (Commands section)`, `Dans-Dungeons tests/ listing (no dnd/)`, `Dans-Dungeons/src/game listing (15 files vs 7 in map)`, `Dans-Dungeons/src/ai/tiers.js:16`
- **Impact:** The file whose whole job is to orient AI contributors misdirects them on tests, modules, and model economics.

#### 12.2.10 [MEDIUM · inconsistency] Doc 14's execution-status header is now stale in BOTH directions

Doc 14 says 'Not yet done (follow-ups): ... the commit() state helper (S3), save versioning (S6), the i18n parity test (C2)...'. S3 and S6 have since shipped (state.js:203 exports commit = makeCommit(...); SAVE_VERSION = 2 with envelope + migrations via the client lib) — while C1/C2 remain genuinely open and the Part E flow.js split never happened (flow.js measured today: 1,539 LOC vs the 1,510 the doc audited; target was 'no game module over ~300 LOC'). Doc 14 also still lists 'app 233 tests + 32 library tests' (now 267 + 92).

- **Evidence:** `Dans-Dungeons/docs/ideas/14-client.md:46`, `Dans-Dungeons/src/core/state.js:203`, `Dans-Dungeons/src/core/state.js:145`, `wc -l src/game/flow.js → 1539`
- **Impact:** The one doc that tracks refactor debt can no longer be trusted as a worklist without re-verification.

#### 12.2.11 [MEDIUM · debt] Test debt called out in doc 14 C-TEST persists: two test files assert against re-declared copies and cannot detect source drift

tests/worldgen/schemas.test.js still opens with 'Inline the schemas since we can't import ESM with JSON imports in Node 24 test runner. These mirror src/ai/schemas.js exactly.' — the premise doc 14 proved false (schemas are pure JS and import fine). digest.test.js still tests helper functions re-implemented inside the test file ('same logic as will be in the game code'). Both green-light drift between test copies and production code.

- **Evidence:** `Dans-Dungeons/tests/worldgen/schemas.test.js:4`, `Dans-Dungeons/tests/worldgen/digest.test.js:10`, `Dans-Dungeons/docs/ideas/14-client.md (C-TEST section)`
- **Impact:** Schema or digest changes in src/ pass tests that verify nothing about src/.

#### 12.2.12 [MEDIUM · gap] Secrets model is one NPC field, not the doc-08 architecture; GM mode B untouched

Doc 08 specifies a top-level `secrets` Spektrum slice with read/write/reveal rules (reveal copies fact from secrets → world). DEFAULTS has no secrets key; what shipped is a per-NPC `secret` string in the settlement schema, fed to the dialogue model with a mayRevealSecret gate and a story flag on reveal (flow.js:741-747) — a reasonable seed, but there are no location traps, hidden doors, true-history vs rumor, or red-thread private hints, and no /show secrets dev command. GM mode B (player as GM) has zero code.

- **Evidence:** `Dans-Dungeons/docs/ideas/08-secrets-and-gm-modes.md:17`, `Dans-Dungeons/src/core/state.js:38`, `Dans-Dungeons/src/ai/dialogue.js:28`, `Dans-Dungeons/src/game/flow.js:746`
- **Impact:** Mystery/reveal play — the doc's stated reason the feature 'gets its own doc' — is limited to NPC gossip; the narrator has no modeled hidden world to ration.

#### 12.2.13 [MEDIUM · inconsistency] Doc 04's legal machinery (trademark blocklist, safe player-facing terminology) was never built, but the doc claims generators 'produce these terms directly'

No src/world/blocklist.js exists, no blocklist logic anywhere; grep for 'Defense Rating', 'Resistance Check', 'Chronicle' in en.json returns nothing — the UI and prompts use AC/saving-throw vocabulary and the package description says 'Text-based, AI-driven D&D type game'. Doc 04 asserts 'The world generator and prompt templates produce these terms directly; we don't translate at render time' — false. The doc also says the rename decision is 'resolved' while doc 11 says the name 'leans on the D&D phrasing; decide whether to rebrand... before any public release'.

- **Evidence:** `Dans-Dungeons/docs/ideas/04-dnd-mechanics.md:55`, `Dans-Dungeons/docs/ideas/04-dnd-mechanics.md:60`, `grep 'Defense Rating|blocklist' src/ → no matches`, `Dans-Dungeons/package.json:6`, `Dans-Dungeons/docs/ideas/11-open-questions.md:68`
- **Impact:** If the public-release ambition is real, the legal posture the docs claim exists doesn't; if it isn't, doc 04 is dead weight steering prompt work toward vocabulary nobody implemented.

#### 12.2.14 [MEDIUM · inconsistency] Model-tier vocabulary differs across three sources and the `large` tier remains configured-but-dead

Doc 05 defines tiny/small/medium/large/summarizer/embedder/tts (+ per-tier storage keys ai.model.*). Code implements tiny/medium/large/image/tts/stt under a free/deluxe split (tiers.js). CLAUDE.md documents a third set: tiny/medium/image/tts/stt with paid models presented as defaults. `small`, `summarizer`, `embedder` never existed; `large` is defined in FREE_MODELS/PAID_MODELS/FREE_FALLBACKS but no call site uses tier 'large' — exactly the dead-code state doc 14's C-DEAD table flagged, unchanged.

- **Evidence:** `Dans-Dungeons/docs/ideas/05-ai-runtime.md:38`, `Dans-Dungeons/src/ai/tiers.js:16`, `Dans-Dungeons/CLAUDE.md (AI model tiers table)`, `Dans-Dungeons/docs/ideas/14-client.md (C-DEAD: 'large AI tier... no call uses it')`
- **Impact:** Cost reasoning (doc 05's whole point) can't be done from the docs; the worldbible generator runs on 'medium' where the vision reserved 'large' for exactly that job.

#### 12.2.15 [MEDIUM · gap] Storage-scale plan (doc 06) entirely unbuilt: no IndexedDB, no quota monitoring, no multi-slot, no compression — decisions doc 11 marks 'decided: yes'

Doc 06: 'A 100-hour world plus its transcript will absolutely exceed localStorage's ~5MB quota, so the split is essential, not optional. We design for it from day one.' Zero IndexedDB references exist in src/ or the vendored lib; no navigator.storage.estimate; saves are one localStorage key. Doc 11's Persistence-decided list (multi-slot slot manager at MVP, CompressionStream on export, opt-in secrets encryption) — none built. The only quota handling is try/catch-and-skip around three localStorage writes.

- **Evidence:** `Dans-Dungeons/docs/ideas/06-persistence.md:20`, `Dans-Dungeons/docs/ideas/11-open-questions.md:125`, `grep -rn 'indexedDB' src/ vendor/ → no matches`, `Dans-Dungeons/src/ai/spend.js:24`
- **Impact:** Long campaigns will silently hit the localStorage ceiling — the time-travel blob is already capped at 500 entries per epoch as a workaround (undo.js) — and there is no migration path the docs promised.

#### 12.2.16 [LOW · inconsistency] 100-hour vs 80-hour target; docs/ideas numbering gap (no doc 13)

Every vision doc, the README ('~100-hour fantasy world'), bag-of-holding's why.md and roadmap.md vision statement say 100 hours; the owner's stated goal is 80. Also docs/ideas jumps 12 → 14 with no 13, which reads like a deleted doc to a newcomer.

- **Evidence:** `Dans-Dungeons/docs/ideas/00-overview.md:23`, `Dans-Dungeons/README.md:6`, `bag-of-holding/docs/why.md:208`, `docs/ideas listing: 00-12, 14, 15, 16`
- **Impact:** Trivial individually, but cost/scope math in docs 05/12 is calibrated to 1,500 turns/100h — worth re-basing once, when the docs get their triage pass.

#### 12.2.17 [LOW · risk] Vendor sync remains a manual two-step with no guard

Doc 15's operational gotcha stands: the app consumes a hand-copied vendor/bag-of-holding-client (no sync script, no CI check). Today diff -rq shows the copies identical, but nothing prevents the next lib change from deploying stale vendored code.

- **Evidence:** `Dans-Dungeons/docs/ideas/15-client-roadmap.md:39`, `diff -rq bag-of-holding-client/src vendor/bag-of-holding-client/src → clean today`
- **Impact:** A lib fix (e.g. the tone enum) can be authored upstream and silently not ship in the game.

### 12.3 Recommendations

#### 12.3.1 [P0 · effort S] One doc-triage pass: stamp every ideas doc with a real status and fix README + CLAUDE.md

Most of the 'inconsistent mess' is fixable in an afternoon of honest labeling. Give each of docs 00-12 a header: SUPERSEDED (00 non-goals, 05 tier table, 09 no-build/no-SW, 10 phases), SHIPPED (16, 14/15 with corrected follow-up lists), or ACTIVE PLAN (03, 06, 12). Rewrite README status/features (voice, images, vendored Spektrum, esbuild), fix CLAUDE.md's phantom tests/dnd path, module map, and tier table, and document the free/deluxe embedded-key model somewhere honest. This single pass eliminates the majority of findings above.

#### 12.3.2 [P0 · effort S] Fix the two known live bugs from doc 14 and add their guard tests

Both were diagnosed with exact fixes 2 months ago. Widen WORLD_SEED tone enum to all 5 values in bag-of-holding-client (source AND vendor copy) with a TONES ⊆ enum test; backfill the 39 missing nl keys and add tests/i18n/parity.test.js asserting equal flattened key sets. These are S-sized and currently degrade 40% of generated worlds and all Dutch play.

```js
// tests/i18n/parity.test.js
import en from '../../src/i18n/en.json' with { type: 'json' };
import nl from '../../src/i18n/nl.json' with { type: 'json' };
const flat = (o,p='') => Object.entries(o).flatMap(([k,v]) => v && typeof v==='object' && !Array.isArray(v) ? flat(v,p+k+'.') : [p+k]);
assert.deepEqual(flat(en).sort(), flat(nl).sort());
```

#### 12.3.3 [P1 · effort M] Wire progression: XP awards + level-up flow using the engine's existing math

The single cheapest step toward '80 hours': the engine already ships XP thresholds, milestone awards, deriveSheet, and 12 classes to L10 — the app just never calls them. Award XP on kills (resolver already knows targetDead), quest completion, and beat completion; re-derive the sheet on threshold cross. Without progression, no amount of world-gen makes long play meaningful.

#### 12.3.4 [P1 · effort M] Build doc 03's session layer next: chapter boundaries, 'previously on' recap, transcript summarization

This is the highest-leverage unbuilt vision doc. A chapter close (long rest / beat complete / soft turn cap) that summarizes the chapter via the medium tier and prepends the recap to future narrator context simultaneously: extends the GM's 3-entry memory horizon, bounds transcript growth (the doc-06 quota risk), gives autosave anchors, and creates the pacing container the red thread needs. It requires no new architecture — it composes buildScene + chatCompletion + the existing beats runtime.

#### 12.3.5 [P1 · effort L] Implement doc 12 incrementally as scope-assembler v1 — structural walk only, defer RAG/WASM embedder

Doc 12 is the right architecture but its MVP claim (ship inverted index + WASM RAG) is overscoped for one person. Steps 1-4 of its own assembler spec (Here/Nearby from the graph, path-to-root digests, PC-memory flags on known entities) are pure state lookups over data that already exists (world.regions/settlements/dungeons/npcs, digests). Grow buildScene into assembleScope(locationId, pc) with per-entity 'known' flags; add the inverted index later when transcripts are long enough to need it; revise the doc to mark the embedder as post-MVP.

#### 12.3.6 [P2 · effort S] Restore bag-of-holding version/roadmap coherence

Decide what 2.1.0 now means (either retroactively declare the current state 2.1.0 and move Quiet Stair to 2.8.0, or bump to 2.1.1 and re-reserve) and record it; refresh roadmap.md's status line (version, 1561 tests), delete or rewrite the contradictory '0.x pre-release' table, and update why.md's 'Where we are today'. Add a one-line release checklist item: 'status line matches package.json' so the drift can't recur silently.

#### 12.3.7 [P2 · effort S] Decide the fate of the cut-candidates explicitly: doc 08 mode B, doc 04 blocklist/terminology, doc 07 full Nerd mode

Given the 80h goal, GM-mode-B is a second product and should be moved to an icebox; doc 04's blocklist is either a 50-line filter worth building in a day (if public release is real) or a promise to delete; doc 07's seven-pane Nerd sidebar should be re-scoped to 'grow the existing debug bar' or marked aspirational. Explicit cuts shrink the standing vision debt that makes the project feel inconsistent.

#### 12.3.8 [P2 · effort M] Do the flow.js split (doc 14 Part E) before the next feature wave

flow.js is back up to 1,539 LOC with the settlement/encounter/play input loops still triplicated (S2). Every future system this audit recommends (sessions, progression, scope assembler) lands in flow.js first; splitting along the existing section banners now (setup/campaign/dungeon-loop/settlement-loop/overworld/meta/views) is mechanical and makes each subsequent feature smaller and testable.

#### 12.3.9 [P3 · effort S] Add a vendor-sync guard for bag-of-holding-client

One test or build.js step that hashes source vs vendored files (or a sync script the build refuses to run without) closes doc 15's standing 'deploy runs stale code' gotcha for near-zero cost.

```js
// build.js pre-step
import { execSync } from 'node:child_process';
const drift = execSync('diff -rq ../bag-of-holding-client/src vendor/bag-of-holding-client/src || true').toString();
if (drift.trim()) { console.error('vendor drift:\n' + drift); process.exit(1); }
```

#### 12.3.10 [P3 · effort S] Point the two known-drift tests at real source

schemas.test.js should import from src/ai/schemas.js (and the vendored worldgen schemas) instead of inline copies — doc 14 proved the 'can't import' premise false; digest.test.js should import the real digest helpers. Until then, both suites are green regardless of what src/ does.

### 12.4 Metrics collected

- **dans_dungeons_src_loc:** 6222
- **dans_dungeons_flow_js_loc:** 1539
- **dans_dungeons_tests_passing:** 267
- **dans_dungeons_total_commits:** 83
- **dans_dungeons_recent_time_travel_commits:** ~45 of last 45 (12 feat + 4 perf + 3 fix + merges/stamps)
- **client_lib_tests_passing:** 92
- **engine_tests_passing:** 1561
- **engine_version_package_json:** 2.1.0
- **engine_roadmap_claimed_version:** 2.0.1 (status line) / 0.x (Where-we-are table)
- **engine_roadmap_claimed_tests:** 1536 (status line) / 230 (0.x table)
- **i18n_en_keys:** 460
- **i18n_nl_keys:** 438
- **i18n_keys_missing_in_nl:** 39
- **i18n_keys_only_in_nl:** 17
- **narrator_transcript_window_entries:** 3
- **app_package_version:** 0.0.0
- **docs_ideas_files:** 16
- **docs_ideas_missing_number:** 13
- **vision_components_matrix:** {"world_layers_L00_L05": "BUILT (reduced: no continent layer)", "red_thread_beats": "BUILT (linear, 3-5 beats, flag-gated)", "cascading_digests": "BUILT", "scope_packets_SML_cards": "DOC-ONLY", "rag_inverted_index_embedder": "DOC-ONLY (despite 'ship at MVP' decision)", "gm_secrets_slice": "DOC-ONLY (per-NPC secret field = PARTIAL)", "gm_mode_b_player_as_gm": "DOC-ONLY", "sessions_chapters_recaps": "DOC-ONLY", "indexeddb_spillover": "DOC-ONLY", "multi_slot_saves_compression_encryption": "DOC-ONLY", "cost_meter": "BUILT (monotonic real spend; no per-tier breakdown or budget cap)", "model_tier_system": "PARTIAL (tiny/medium/large/image/tts/stt; large dead; small/summarizer/embedder absent)", "time_travel_branching": "BUILT (all 5 phases)", "settlements": "BUILT", "travel_fsm_overworld": "BUILT", "lazy_expansion": "BUILT (deluxe-gated neighbour regions)", "save_versioning_envelope": "BUILT (v2)", "xp_leveling": "DOC-ONLY (engine has it; app never calls it)", "voice_tts_stt": "BUILT (contradicting non-goals)", "image_generation": "BUILT (contradicting non-goals)", "esc_stream_interrupt": "DOC-ONLY", "meta_channel_note_seed_retcon": "DOC-ONLY (different command set shipped)", "trademark_blocklist_safe_terms": "ABANDONED", "nerd_mode": "PARTIAL (last-turn debug bar only)", "byok_only": "ABANDONED (embedded free-tier key + free/deluxe pivot)"}


---

## 13. The 80-Hour Architecture Gap

> Auditor: `scale-80h` · strengths 6 · findings 14 · recommendations 10

The codebase is a well-engineered ~2-4 hour game wearing the design documents of an 80-100 hour game. The turn skeleton is genuinely right: classify (tiny LLM) → resolveRules (pure, seeded dice) → narrate (medium LLM given resolved facts it may not contradict) → commit, with a tested worldgen pipeline (digest threading, retries, blueprint constraints), a sophisticated undo/branch/seeded-roll time-travel layer, and 1,920 passing tests across the three repos. What is missing is not polish but every load-bearing memory structure the 80h vision depends on. The narrator's total recall is the last 3 transcript turns (narrate.js slices `recentTranscript.slice(-3)`), plus a digest path, the current beat's one-line directive, ≤3 quests and the last 6 story flags. Nothing summarizes past play back into context — the GM cannot remember what an NPC said 10 turns ago. That is the first component to fail, and it fails within the first hour of play, not at hour 40.

Ranked by when each component fails on the road to 80h: (1) narrative memory — immediately (3-turn horizon); (2) content/arc — the generated red thread is 3-5 linear beats at 30-90 min each (~2-7h of authored arc), the PC never gains XP or levels, and every region generates exactly one 3-4-NPC settlement plus one 6-10-room dungeon, so play becomes structurally identical loops after the first arc; (3) world topology — overworld travel always mints a brand-new region (star topology, adjacency stored as display-name strings, road exits have null targetId), so an "open world" cannot even be represented; (4) storage — persistence is 100% localStorage despite docs/06 declaring the IndexedDB split "essential, not optional", the transcript is re-recorded wholesale every turn (O(n²) history growth), and quota failure is a silent console.warn — the practical wall is roughly 20-50h of play ending in silent autosave data loss; (5) context window — never; the actual per-turn packet is ~2-3k tokens, and the real problem is the opposite (too little context, not too much). Cost is likewise not the binding constraint: ~2,000 turns × ~2.5k tokens ≈ 5M tokens ≈ single-digit dollars on mid-tier models.

Pillar scorecard: layered worldgen PARTIAL (L00→L02→L03 pipeline solid; no geography graph, no L01, no digest refresh); scope packets MISSING (buildScene is a valid seed but has no nearby tier, no S/M/L cards, no budget, no secrets filter); digest hierarchy PARTIAL (one-shot creation-time digests, never refreshed, single size); associative recall/RAG MISSING entirely (no inverted index, no embeddings, no IDB anywhere); chapter/session structure MISSING (session.chapterId is a dead field; the journal EPUB summarizer is the exact machinery needed and is already built and cached — it just never feeds back into play); persistent NPCs/factions PARTIAL (settlement NPCs persist with capped dialogue memory, reputation affects prices/tone; no off-screen life, no clocks, no cross-location identity); red-thread progression PARTIAL/WEAK (linear flag model in the client library while bag-of-holding's richer thread.js with successors, sub-threads and archetype casting sits entirely unused — two competing beat runtimes across the repos); deterministic fallback PARTIAL (excellent in settlements/travel; absent on the dungeon hot path, where processTurn hard-awaits the LLM classifier).

The honest verdict: the 80h goal is not blocked by any single bug but by four missing subsystems in strict dependency order — persistence split, chapter/digest memory, geography graph, and beat-arc v2. All four have clean seams already present in the code (the epoch concept in undo.js, the journal summarizer, the runPipeline orchestrator, the unused engine beat runtime), which is why the "inconsistent mess" feeling is misdiagnosed: the mess is mostly unfinished convergence between three repos' overlapping abstractions, not bad architecture. If the full vision is too expensive, the hub-and-spoke pivot is the cheapest coherent target because the settlement loop already is a hub.

### 13.1 What is genuinely good

- **The AI/rules trust boundary is correctly built — the narrator cannot cheat** — processTurn resolves all mechanics in pure JS before the narrator runs, then hands the narrator resolved facts with an explicit 'Do NOT invent dice results' contract and an 'impossible intent must fail' rule. This is exactly the deterministic-authority architecture docs/03 calls for, and it already works. It is the right foundation for the 80h 'always falls back on deterministic systems' pillar. — evidence: `Dans-Dungeons/src/game/loop.js:109-144`, `Dans-Dungeons/src/game/resolver.js:235-297`, `Dans-Dungeons/src/i18n/en.json:490`
- **The worldgen pipeline is a real, tested layered-generation foundation** — runPipeline threads parent digests to children, runs same-group layers in parallel, retries per layer, distinguishes critical from optional layers, and is shared by campaign start and the world-bible export. Blueprint pre-seeding (buildWorldBlueprint) constrains every generator with the same tone/threat/climate/faction slots, which is the correct fix for generic AI output. 50+ worldgen tests pass. — evidence: `bag-of-holding-client/src/worldgen/pipeline.js:59-95`, `Dans-Dungeons/src/game/worldgen.js:106-130`, `Dans-Dungeons/src/game/flow.js:345-365`
- **Time-travel/undo is unusually rigorous engineering** — Epoch-scoped undo/redo/branching with root-relative branch storage, a persisted _timeTravel blob with a validated failsafe import, and a seeded-roll audit (session.rng {seed,cursor} recorded in state so scrubs restore exact dice position; verifyLog replay check). The epoch concept (clearTurnMarks at context swaps) is also a ready-made seam for chapter boundaries. — evidence: `Dans-Dungeons/docs/ideas/16-time-travel-branching.md:78-243`, `Dans-Dungeons/src/game/rng.js:1-132`, `Dans-Dungeons/src/game/loop.js:95-106`
- **Cost architecture is ahead of most projects at this stage** — Tiered models with 429 fallback chains, streaming with a JSON-field extractor, per-call token/cost sinks, and a monotonic out-of-history spend meter that survives undo (a subtle correctness point most would miss). Per-turn packets are small (~2-3k tokens), so the 80h cost math already works. — evidence: `bag-of-holding-client/src/llm/client.js:48-67`, `Dans-Dungeons/src/ai/spend.js:1-38`, `Dans-Dungeons/src/ai/client.js:20-35`
- **The journal summarizer is the narrative-memory backbone, already built** — journal.js already compresses all narrations into titled chapters via the medium tier, caches them fingerprinted in localStorage, and only processes new turns incrementally. This is 90% of the 'digest hierarchy over transcript' machinery docs/12 asks for — it is just pointed at EPUB export instead of at the narrator's context. — evidence: `Dans-Dungeons/src/ai/journal.js:44-88`
- **Deterministic fallbacks exist and are good — where they exist** — Settlement mode has a full keyword-classifier fallback so towns stay playable offline; travel narration falls back to templated locale lines; NPC dialogue falls back to a canned line; autoplay falls back to manual input. The pattern is proven — it just was never applied to the dungeon turn loop. — evidence: `Dans-Dungeons/src/game/flow.js:643-658`, `Dans-Dungeons/src/game/flow.js:946-960`, `Dans-Dungeons/src/game/flow.js:726-732`

### 13.2 Findings

#### 13.2.1 [CRITICAL · gap] Narrative memory horizon is 3 turns — the single hardest blocker to 80h

narrate() builds its continuity context from `recentTranscript.slice(-3)` (narrate.js:40). Beyond that, the only long-term memory entering any prompt is: the digest path joined with ' | ' (loop.js:56-74), the current beat's one-sentence dramaticPurpose, ≤4 non-neutral faction standings, ≤3 active quest descriptions, and the last 6 story flags (story.js:66-89). No chapter summaries, no transcript compression, no entity memory cards, no recap on resume (resumeGame just replays the last 6 transcript lines to the DOM, flow.js:1518). The scope-packet/digest design in docs/12 (S/M/L cards, PC memory, budget enforcement) has zero implementation.

- **Evidence:** `Dans-Dungeons/src/ai/narrate.js:40`, `Dans-Dungeons/src/game/loop.js:56-80`, `Dans-Dungeons/src/game/story.js:66-89`, `Dans-Dungeons/src/game/flow.js:1514-1539`, `Dans-Dungeons/docs/ideas/12-context-scoping.md:34-119`
- **Impact:** The GM forgets anything not encoded as a flag within ~5 minutes of play. Coherent play degrades within the first hour; an 80h campaign is impossible regardless of any other work.

#### 13.2.2 [CRITICAL · gap] No chapter/session structure exists — session.chapterId is a dead field

state.js DEFAULTS sets `chapterId: 'ch-1'` (state.js:42) and nothing in the codebase ever reads or updates it. Docs/03's chapter model — recap, soft goal, chapter-end triggers (long rest, beat completion, ~40-turn cap), chapter snapshots as rewind checkpoints — has no implementation. A grep for 'chapter' in src/ hits only the journal EPUB exporter. Without chapter boundaries there is no place to run summarization, no autosave snapshots, no 'previously on', and no unit of pacing.

- **Evidence:** `Dans-Dungeons/src/core/state.js:42`, `Dans-Dungeons/docs/ideas/03-game-loop-and-sessions.md:5-14`, `Dans-Dungeons/src/ai/journal.js:44-88`
- **Impact:** Chapters are the prerequisite for the digest hierarchy, for bounded transcript growth, and for the red thread's pacing — every other 80h pillar depends on this missing structure.

#### 13.2.3 [HIGH · gap] The generated red thread is 2-7 hours of content, then the campaign has no spine

beatsPrompt asks for '3-5 story beats' at 30-90 targetPlaytimeMinutes each (en.json:498) — the whole authored arc is 90 minutes to 7.5 hours. Beats are generated with `preferredLocation: null` (per the prompt itself) and `successors: []`, so they are unbound to any place or NPC; completion is judged per-turn by a tiny-tier LLM shown ONLY the beat purpose and the latest single narration (classify.js:25-35, loop.js:173-181), so beats can complete spuriously or stall forever (the flag machinery `prerequisites`/`setRequiredFlags` is set by the generator but completion never checks flags as primary signal). When all beats are done, currentBeat() returns null and buildStoryContext drops the directive — the GM loses all story steering.

- **Evidence:** `Dans-Dungeons/src/i18n/en.json:498`, `Dans-Dungeons/src/ai/classify.js:25-35`, `Dans-Dungeons/src/game/loop.js:173-181`, `bag-of-holding-client/src/narrative/beats.js:38-43`
- **Impact:** After the first arc (~an evening of play), the 'coherent campaign' becomes undirected procedural repetition. 80h needs an act/chapter/beat hierarchy with location+NPC binding and mostly-deterministic completion.

#### 13.2.4 [HIGH · gap] Persistence is 100% localStorage; the IndexedDB split docs/06 calls 'essential, not optional' does not exist, and quota failure is silent

A repo-wide grep for indexedDB/IDB across Dans-Dungeons/src and bag-of-holding-client/src returns nothing. Everything — settings, key, world, full transcript, _timeTravel blob, journal cache, last sketch data-URI — shares the ~5MB localStorage budget. On QuotaExceededError, saveEnvelope returns false (envelope.js:62-65) and saveToStorage logs `console.warn('[state] localStorage save failed')` (state.js:169-173); the player is never told autosave stopped working. Docs/06's quota monitoring (navigator.storage.estimate, 80% warning, blocking modal) is unimplemented.

- **Evidence:** `Dans-Dungeons/src/core/state.js:169-173`, `bag-of-holding-client/src/persistence/envelope.js:58-66`, `Dans-Dungeons/docs/ideas/06-persistence.md:5-24`, `Dans-Dungeons/src/ui/sketch.js:13`
- **Impact:** A long campaign hits the wall somewhere around 20-50h of play and silently loses progress from that point on — data loss, the worst possible failure mode for an 80h product.

#### 13.2.5 [HIGH · defect] Transcript is re-recorded wholesale every turn — O(n²) history growth in Spektrum and in the persisted time-travel spine

appendTranscript does `setValue('transcript', [...(appState.transcript ?? []), {player}, {gm}])` (resolver.js:299-306) and recordOpening does the same (flow.js:50-55). Spektrum records each setValue's full value and replaces arrays rather than merging, so every turn's history entry embeds a complete copy of the transcript to date. In-memory history grows quadratically with turns in a session, and the _timeTravel save blob's spine entries each carry these full copies — MAX_TT_ENTRIES (undo.js:82) caps entry COUNT at 500 but not bytes, so the byte size of a 40-turn epoch's spine is dominated by ~40 progressively-larger transcript snapshots. commitAll deliberately writes narrow paths for world/party for exactly this reason (resolver.js:245-249) but the transcript write contradicts that design.

- **Evidence:** `Dans-Dungeons/src/game/resolver.js:299-306`, `Dans-Dungeons/src/game/flow.js:50-55`, `Dans-Dungeons/src/game/undo.js:78-82`, `Dans-Dungeons/src/game/resolver.js:245-249`
- **Impact:** Memory and save-size growth is quadratic in turns-per-epoch; combined with the localStorage-only persistence this pulls the storage wall much closer and makes every autosave JSON.stringify progressively slower (per-turn jank).

#### 13.2.6 [HIGH · gap] The world is a star, not a graph — open-world topology cannot be represented

Region adjacency is stored as display-name strings: generateNeighbourRegion links regions via `adjacentRegions: [...names]` built from `region.name` (flow.js:1136-1138) and `region.adjacentHints` (flow.js:383), not IDs. Road/wilderness exits carry `targetId: null` (settlementPrompt, en.json:504), so arriveAtDestination finds no known settlement and ALWAYS generates a fresh region+settlement (flow.js:1091-1106) — travel never leads back to anywhere except via the fast-travel chip list, which teleports without geography. There is no world map data structure, no bidirectional edges, no distances. The docs/12 scope assembler's 'walk geography adjacency' step has nothing to walk.

- **Evidence:** `Dans-Dungeons/src/game/flow.js:1091-1148`, `Dans-Dungeons/src/game/flow.js:383`, `Dans-Dungeons/src/i18n/en.json:504`, `Dans-Dungeons/docs/ideas/12-context-scoping.md:44-49`
- **Impact:** Every overworld journey inflates the world with another orphan one-settlement region; the player cannot meaningfully return, revisit, or build a mental map. 'Open world' is unimplementable on this topology.

#### 13.2.7 [HIGH · gap] No character progression: XP and leveling are never awarded — 80 hours at level 1

The PC is created at `level: 1` (character.js:94) and no code path anywhere in src/game or src/ai awards XP, levels up, or re-derives the sheet (grep for awardXp/levelUp/addXp across src/game returns nothing). bag-of-holding ships a full XP module (bag-of-holding/src/xp.js) that the game never imports. Enemy difficulty is depth-scaled per dungeon but the PC's power curve is flat forever.

- **Evidence:** `Dans-Dungeons/src/game/character.js:94`, `bag-of-holding/src/xp.js:1`
- **Impact:** Mechanical progression — half of what makes a long D&D campaign compelling — is absent. Combined with the fixed 6-10-room dungeon shape and 3-4-NPC settlements, content variety flatlines after a few hours.

#### 13.2.8 [MEDIUM · gap] Associative recall (inverted index + RAG) is entirely absent, and the classifier doesn't even emit entity mentions

Docs/12 specifies BOTH an inverted index (entityId → transcript turns) and client-side embedding RAG 'at MVP'. Neither exists: no index structure, no embedder tier in tiers.js (which has tiny/medium/large/image/tts/stt — no summarizer, no embedder), no IDB vector store. The CLASSIFIER_SCHEMA (schemas.js:8-23) has no 'entities mentioned' field, so the cheap prerequisite for the inverted index isn't being captured either.

- **Evidence:** `Dans-Dungeons/docs/ideas/12-context-scoping.md:254-307`, `Dans-Dungeons/src/ai/schemas.js:8-23`, `Dans-Dungeons/src/ai/tiers.js:16-36`
- **Impact:** 'What did the abbot say about the iron crown in chapter 2?' can never be answered. Without at least the inverted index, long-campaign contradictions are guaranteed.

#### 13.2.9 [MEDIUM · gap] No deterministic fallback on the dungeon hot path — an AI outage makes the core game unplayable

processTurn awaits classify() (an LLM call) before any rules resolution (loop.js:109); on failure the playLoop retries 3× with backoff then errors the turn (flow.js:1400-1441). Settlement mode has fallbackSettlementAction, a full keyword classifier (flow.js:643-658), but dungeon mode has no equivalent — even though most dungeon actions are chip-generated strings with fixed formats that could be parsed without a model. The narrator similarly has no templated-from-resolved-facts fallback, though the resolver already computes every fact needed to render one.

- **Evidence:** `Dans-Dungeons/src/game/loop.js:107-139`, `Dans-Dungeons/src/game/flow.js:1400-1441`, `Dans-Dungeons/src/game/flow.js:643-658`
- **Impact:** Violates the stated pillar 'truly open play that always falls back on deterministic systems' exactly where players spend most of their time; free-tier model flakiness turns directly into failed turns.

#### 13.2.10 [MEDIUM · inconsistency] Two competing beat runtimes across the repos; the richer engine one is dead code to the game

bag-of-holding/src/beats ships thread.js (createThread with byId index, branching successors with chooseSuccessor, sub-thread stack for side quests via pushSubThread) and casting.js (castArchetypes to bind beat archetype slots to live NPCs). The game instead uses bag-of-holding-client/src/narrative/beats.js — a simpler flag-gated linear evaluator with none of that. A repo-wide grep shows pushSubThread/chooseSuccessor/castArchetypes are referenced nowhere in Dans-Dungeons or the client. The beats generator even emits requiredArchetypes that nothing ever casts.

- **Evidence:** `bag-of-holding/src/beats/thread.js:74-127`, `bag-of-holding/src/beats/casting.js:23-36`, `bag-of-holding-client/src/narrative/beats.js:38-63`, `Dans-Dungeons/src/i18n/en.json:498`
- **Impact:** The exact machinery the 80h red thread needs (branching, side-quest sub-threads, casting beats onto persistent NPCs) already exists, tested, and is bypassed — duplicated effort now, migration cost later.

#### 13.2.11 [MEDIUM · gap] No secrets slice — docs/08's information-asymmetry model is unimplemented

state.js DEFAULTS has no `secrets` path and no code writes one. NPC secrets live inline on settlement NPC objects in `world` (worldgen.js:87), are shipped to the tiny-tier dialogue prompt on every exchange (dialogue.js:43), and are plainly readable in every save export. The docs/08 read/write/reveal lifecycle (generators write secrets; loop copies revealed facts to world; renderer never sees secrets) and the /show secrets dev tool do not exist. The only GM-only fragment anywhere is the beat directive in scene.story.

- **Evidence:** `Dans-Dungeons/src/core/state.js:38-113`, `Dans-Dungeons/src/ai/dialogue.js:38-50`, `Dans-Dungeons/docs/ideas/08-secrets-and-gm-modes.md:17-46`
- **Impact:** Mystery/reveal structure — what docs/08 calls the thing a D&D experience 'lives or dies on' — has no substrate; dungeon contents, traps, and hidden motives can't be modeled as hidden.

#### 13.2.12 [MEDIUM · debt] Engine capabilities the 80h game needs are built and unused: scene clock, SRD travel, XP, encounter design

bag-of-holding ships scene-clock.js (in-fiction time, dawn/dusk events, day/night labels) and travel.js (pace, forced march, foraging, navigation/getting lost) — greps show zero usage in Dans-Dungeons or the client. The game has no concept of in-world time at all: no day/night, no rest cadence outside settlement inns, no time pressure for the red thread. Overworld travel is the client FSM's 2-3 abstract segments with flat 40%/35% encounter/discovery rolls (fsm.js:8-12) regardless of distance, terrain, or pace.

- **Evidence:** `bag-of-holding/src/scene-clock.js:33-95`, `bag-of-holding/src/travel.js:11-94`, `bag-of-holding-client/src/travel/fsm.js:8-61`
- **Impact:** A world without time cannot have schedules, deadlines, faction clocks, or travel that feels like distance — all needed for an open world that appears alive over 80 hours.

#### 13.2.13 [LOW · inconsistency] Docs-vs-implementation drift: tier taxonomy, meta commands, and status tables no longer match the code

Docs/05 defines tiny/small/medium/large/summarizer/embedder tiers; tiers.js implements tiny/medium/large/image/tts/stt, and 'large' is configured but never called (grep for tier:'large' returns nothing — worldgen runs on 'medium'). Docs/03's meta channel specifies /note, /seed, /retcon, /redo, /save; handleMeta implements only restart/save/status/settings/map/story/help (flow.js:248-262). Docs/02's status table marks 'Narrator world context — Planned' though loop.js already ships digestPath injection.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:16-36`, `Dans-Dungeons/src/game/flow.js:248-262`, `Dans-Dungeons/docs/ideas/02-world-generation.md:127-148`, `Dans-Dungeons/docs/ideas/05-ai-runtime.md:38-47`
- **Impact:** Contributors (and future Claude sessions) plan against stale specs; the owner's 'inconsistent mess' perception is partly this drift rather than code defects.

#### 13.2.14 [LOW · risk] Journal cache and world-bible blobs compound the localStorage pressure

dg-journal-cache stores the full woven story text (journal.js:20), dg-world-bible stores the structured worldgen output (exports.js:294), and sketch-last-image stores a full image data-URI (sketch.js:13) — all in the same 5MB budget as the save. Each catches quota errors silently.

- **Evidence:** `Dans-Dungeons/src/ai/journal.js:15-20`, `Dans-Dungeons/src/ui/exports.js:294`, `Dans-Dungeons/src/ui/sketch.js:13`
- **Impact:** Auxiliary features quietly consume the budget the campaign save needs, moving the silent-failure wall closer.

### 13.3 Recommendations

#### 13.3.1 [P0 · effort M] P0-A: Split persistence (IDB cold store + localStorage hot slice) and make quota failure loud

Everything else in the 80h plan writes MORE data (chapter snapshots, entity cards, archived transcript, recall index), so storage must come first. Move archived transcript turns, chapter snapshots, dungeons of completed regions, and the journal cache into IndexedDB object stores behind the existing envelope module (it already takes an injected storage adapter, so an async IDB adapter is a natural extension); keep meta/party/session/flags/last-N transcript in localStorage for cold-start speed. Surface saveEnvelope===false as a blocking UI banner with an export prompt, and watch navigator.storage.estimate() at 80%. This is docs/06 verbatim — the design is already written.

```js
// persistence/idb.js (client lib)
const STORES = ['transcriptArchive','chapters','worldCold','cards','cache'];
export async function idbAdapter(dbName='dans-dungeons') { /* open, versioned */ }
// state.js: hot save unchanged; cold writes async + fire-and-forget
// on saveToStorage() false → setValue('ui.saveFailed', true) → blocking banner + export button
```

#### 13.3.2 [P0 · effort S] P0-B: Fix the O(n²) transcript recording — append via narrow writes

One-line-class fix with outsized effect: appendTranscript should use addValue (or an indexed narrow path like transcript.<n>) so each history entry records only the two new lines, not the whole array. This shrinks in-memory Spektrum history, the _timeTravel spine, and every autosave serialization from quadratic to linear. Do it before chapters, because chapters will make sessions longer.

```js
// resolver.js appendTranscript — record only the delta
addValue('transcript', { role:'player', text: playerText, turn });
addValue('transcript', { role:'gm', text: gmText, turn });
// (verify Spektrum addValue on array paths appends + records only the pushed item;
// otherwise use setValue(`transcript.${idx}`, entry) with index paths)
```

#### 13.3.3 [P0 · effort M] P0-C: Chapters + rolling digests — repoint the journal summarizer at play context

This closes the critical narrative-memory gap with machinery that already exists. Define chapter boundaries using triggers docs/03 already lists (dungeon complete, beat complete, settlement rest, ~40-turn cap — clearTurnMarks call sites in flow.js are almost exactly these seams). At each boundary run the journal.js summarizer over the chapter's narrations into a ~120-token digest + entity list, store in session.chapters, and change narrate()'s context recipe from 'last 3 turns' to 'world digest + last 2 chapter digests + current-chapter running recap + last 8 turns'. Cost: one summarizer call per ~40 turns — negligible.

```js
// session.chapters (persisted)
{ id:'ch-7', startTurn:120, endTurn:158, title:'The Cellar Below',
  digest:'~120tok summary', entities:['npc-maera','item-iron-crown'] }
// narrate.js context assembly
const mem = [world.digest, ...chapters.slice(-2).map(c=>c.digest), runningRecap].join('\n');
const transcriptText = recent.slice(-8)...  // was -3
```

#### 13.3.4 [P1 · effort M] P1-A: Formalize buildScene into a scope assembler with a secrets slice

buildScene (loop.js:24-82) is already the packet seed and is already built once per turn and shared classifier→narrator (matching docs/12). Promote it to a pure assembleScope() in bag-of-holding-client (testable under node --test like the rest), add the nearby tier (one-hop room/exit sense lines — the dungeon graph and settlement exits already provide adjacency), pcMemory (known-entity cards), and a token budget with the docs' prune order. Introduce the `secrets` top-level slice with the docs/08 write/reveal lifecycle, and filter it out of everything except narrator/classifier prompts.

```js
// bag-of-holding-client/src/scope/assemble.js
export function assembleScope({world,party,session,secrets}, budget=3000){
  return prune({ here, nearby, region:{digest,activeEvents}, world:{digest},
    memory:{chapterDigests,entityCards,recalled}, redThread:{directive,hint},
    gmSecrets: scopedSecrets(secrets, here) }, budget,
    ['memory.recalled','memory.entityCards','region.activeEvents','nearby']);
}
```

#### 13.3.5 [P1 · effort M] P1-B: Geography graph with pre-minted stable IDs — stop the star topology

Make every exit and adjacency reference an ID, minting IDs for undiscovered targets at generation time so lazy expansion FILLS a slot instead of inventing a new arm. Add bidirectional edges and a return exit on every generated settlement. This unblocks: a real map, return travel, the scope assembler's adjacency walk, and beat→location binding. It is a data-shape change plus ~50 lines in generateNeighbourRegion, best done before more worlds accumulate.

```js
// region record
neighbors: [{ regionId:'region-nferrow', dir:'north', discovered:false }]
// settlement exit — targetId ALWAYS minted
{ direction:'north', targetName:'the Fen Road', targetType:'road',
  targetId:'region-nferrow' }  // lazy gen later fills world.regions['region-nferrow']
```

#### 13.3.6 [P1 · effort L] P1-C: Red thread v2 — adopt the engine beat runtime, bind beats to the world, make flags the primary completion signal

Replace the client's linear evaluator with bag-of-holding beats/thread.js (successors + sub-threads) and casting.js. Scale the arc: generate a 3-act skeleton (large tier — it's configured and unused) of 5-8 beats per act, each with preferredLocation bound to a real region ID and requiredArchetypes cast onto generated NPCs at chapter start via castArchetypes. Completion: deterministic flags first (the resolver already raises enemy-slain/boss-X-slain/dungeon-X-complete/secret-X-revealed — wire beats' prerequisites/setRequiredFlags to THESE), with the LLM narration check demoted to soft/roleplay beats only. Side quests become generated sub-threads via pushSubThread.

```js
// beat, bound at generation/casting time
{ id:'beat.a2.03-unmask-the-steward', act:2,
  preferredLocation:'region-ashvale', boundEntities:{antagonist:'npc-korr'},
  prerequisites:['secret-korr-revealed'], setRequiredFlags:['steward-unmasked'] }
// loop.js: flags drive advance(thread,{flags}); checkBeatFulfilled only when beat.soft
```

#### 13.3.7 [P1 · effort S] P1-D: Deterministic dungeon fallback — keyword classifier + templated narration from resolved facts

Mirror fallbackSettlementAction for the dungeon loop: chip values are app-generated strings with fixed shapes, so 'Go north', 'Take the brass key', 'Attack with longsword' parse without a model. When narrate() fails, render a templated line from `resolved` (hit/miss/damage/newRoom.description are all present). This makes the stated pillar true where players live, and turns free-tier flakiness from a failed turn into a plain-prose turn.

```js
// loop.js
let classified; try { classified = await classify(input, scene); }
catch { classified = keywordClassify(input, scene); } // regex over chips' shapes
// on narrate failure:
narration = t(`fallback.${resolved.intent}`, { dmg: resolved.damage, room: resolved.newRoom?.name });
```

#### 13.3.8 [P1 · effort S] Pivot options if the full open-world vision proves too expensive (choose one, deliberately)

(A) Hub-and-spoke — CHEAPEST, closest to current code: one persistent hub city (the settlement loop already is a hub) + spoke adventures that archive to digests on completion; a small persistent cast makes deep NPC memory affordable; open-world feel sacrificed for coherence per dollar. (B) Episodic 8×10h chapters with digest handoff: each chapter is a bounded world-epoch (the epoch machinery in undo.js/clearTurnMarks is a ready seam); at chapter end a summarizer distills state+cast into a handoff digest; structurally caps memory and storage; sacrifices mid-campaign backtracking. (C) Authored red thread + generated side content: one-time large-model (human-curated) 15-25 beat skeleton with locations/archetypes, generation fills the world around it; highest story ceiling, lowest replayability. All three keep P0-A/B/C — those are pivot-independent.

#### 13.3.9 [P2 · effort M] P2-A: Inverted-index recall first; vector RAG only if it proves insufficient

Add `mentions: [entityId]` to CLASSIFIER_SCHEMA (one field, zero extra calls), build `world.recallIndex: {entityId: [turnIds]}` on commit, and have the scope assembler splice the 2-3 matching archived turns when the player's input names a known entity. This is docs/12's own claim: exact proper-noun recall, no model, no download. For conceptual recall, prefer an LLM-recall middle path (a tiny-tier call ranking chapter digests for relevance) before committing to the 30MB WASM embedder: for a BYOK zero-dep browser game, transformers.js+bge-small is feasible (CDN-pinned + SRI, flat cosine in IDB scales to ~100k vectors) but is a big dependency-philosophy exception; note OpenRouter's surface is chat-centric, so hosted embeddings mean a second provider key — worse UX than either alternative.

```js
// schemas.js CLASSIFIER_SCHEMA += mentions:{type:'array',items:{type:'string'}}
// on commit: for (const id of classified.mentions) index[id]=[...(index[id]??[]),turn]
// assembler: for id in matchEntities(input): recalled.push(archive.get(index[id].slice(-3)))
```

#### 13.3.10 [P2 · effort M] P2-B: Adopt scene-clock + XP from the engine — give the world time and the PC a power curve

Wire freshScene/advanceTurn into the turn loop (exploration turns, travel segments, rests advance minutes; dawn/dusk events feed the narrator's scene context and future faction clocks). Award XP from the engine's xp.js on kills/quests/beats and re-derive the sheet on level-up (character.js already notes re-derivation is designed for this). Both are pure engine modules sitting unused; each is days, not weeks.

```js
// loop.js commit: const {scene: clock, events} = advanceTurn(session.clock);
// events includes 'dusk' → scene.timeOfDay for narrator; rest = advanceTime({hours:8})
// on killedNpc: addXp(record, xpForCr(npc.cr)); if (levelUp) rederiveSheet(record)
```

### 13.4 Metrics collected

- **loc_dans_dungeons_src:** 6222
- **loc_bag_of_holding_client_src:** 2057
- **loc_bag_of_holding_src:** 12277
- **tests_dans_dungeons:** 267
- **tests_bag_of_holding:** 1561
- **tests_bag_of_holding_client:** 92
- **all_tests_green:** True
- **narrator_transcript_window_turns:** 3
- **narrator_est_input_tokens_per_turn:** 1200-1600
- **classifier_est_input_tokens_per_turn:** 600-900
- **beat_check_tokens_per_turn:** ~250
- **est_total_tokens_per_turn:** 2000-3000
- **est_80h_turns:** 1600-2400 (at 2-3 min/turn; docs assume 1500 turns/100h)
- **est_80h_token_spend:** ~4-7M tokens, single-digit USD on mid-tier paid models
- **generated_arc_length:** 3-5 beats x 30-90 min = 1.5-7.5 hours
- **dungeon_size:** 6-10 rooms (spine 4-6 + branches 2-4), 24 themes, boss in vault
- **settlement_size:** 3-4 NPCs, 2-3 exits
- **persistence:** localStorage only (~5MB), zero IndexedDB usage in any repo
- **time_travel_persist_cap:** MAX_TT_ENTRIES=500 entries (count cap, not byte cap)
- **est_save_size_at_80h:** ~2-4MB (transcript ~1MB + world growth + _timeTravel + journal cache) — exceeds quota with images/journal
- **coherent_play_ceiling_current:** ~2-4 hours (one generated arc); mechanically playable but repetitive to ~10-20h; storage wall ~20-50h
- **unused_engine_modules:** beats/thread.js, beats/casting.js, scene-clock.js, travel.js (SRD), xp.js, tier 'large', summarizer tier (absent)


---

## 14. Blind Spots — what the 13 auditors missed (completeness critic)

> Auditor: `?` · strengths 5 · findings 9 · recommendations 9

The 13 auditors covered gameplay, architecture, cost, and docs thoroughly, but left a distinct band of shipping-blocker territory unexamined: process/ops (CI), adversarial security (prompt injection, config-hijack via save import, the OAuth flow), legal compliance (SRD CC-BY attribution), privacy (the shared-key pivot's data-flow consequences), concurrency (multi-tab), and the missing test layers for an LLM-first product (e2e, response validation, prompt evals). I investigated each in the repos and confirmed all are real.

The most consequential process miss: there is no CI anywhere that runs a single test. Across four repos the only workflow is bag-of-holding's Pages deploy (build-and-upload only); Dans-Dungeons — the deployed product — has no .github directory at all, deploys to production by pushing main, and commits its build artifact (vendor/app.bundle.js) with nothing verifying it matches src/. The "version chimera" finding proved this class of drift already happens; the same mechanism can ship a stale bundle to players silently. The security misses compound each other: CSP connect-src is a wide-open "https:", save import blindly restores ai.baseUrl+key with zero validation, the "PKCE" OAuth flow contains no PKCE, and a raw API key is accepted via a ?key= URL parameter. Meanwhile every GM secret (NPC secret field, beat directive) rides verbatim inside prompts protected only by instructions, with raw player text interpolated into the narrator's system message — which matters architecturally because doc 08's information-asymmetry design would scale this to all world secrets.

On the legal/privacy side: the game ships SRD 5.2 content (via the vendored engine) to a public GitHub Pages site with no LICENSE file and no Wizards CC-BY-4.0 attribution, despite the engine's own docs/legal.md stating the attribution must travel downstream — and the game's marketing copy uses the "D&D" trademark that same doc forbids. The free-tier pivot silently made the owner a processor of all free-tier players' prose (it transits his OpenRouter account via the embedded key) with none of the disclosure doc 05 promised. Finally, calibration in the other direction: I verified several things are genuinely solid — the EPUB builder escapes all model text, Spektrum's setValue guards __proto__/prototype/constructor so malicious saves cannot prototype-pollute, blob URLs and mic tracks are cleaned up correctly, and the OAuth code is scrubbed from the URL before exchange. The XSS story, outside the one already-reported sketch-gallery sink, is genuinely disciplined.

### 14.1 What is genuinely good

- **XSS containment is real and consistent beyond what ui-ux already noted** — The zero-dep EPUB builder escapes every piece of model-controlled text through _escXml (headings, chapter text, titles), so LLM output cannot inject markup into the exported book; transcript rendering is textContent-only; the CSP hash-pins the two inline scripts, restricts img-src to 'self' data: blob:, and sets object-src 'none', base-uri 'self', form-action 'none'. — evidence: `bag-of-holding-client/src/output/epub.js:17-19`, `bag-of-holding-client/src/output/epub.js:132`, `bag-of-holding-client/src/output/epub.js:163-166`, `Dans-Dungeons/src/ui/transcript.js:17`, `Dans-Dungeons/index.html:7`
- **Prototype pollution via saves is defended in Spektrum** — Spektrum's path machinery rejects '__proto__', 'prototype', and 'constructor' segments (SAFE_KEY), and JSON.parse's own-property '__proto__' is inert, so a malicious imported .dnd.json cannot pollute prototypes through restoreState's setValue calls. I attacked this path on paper and it holds. — evidence: `Dans-Dungeons/vendor/spektrum.js:32`, `Dans-Dungeons/vendor/spektrum.js:61`, `Dans-Dungeons/vendor/spektrum.js:69-73`, `Dans-Dungeons/src/core/state.js:124-129`
- **Resource cleanup in the audio stack is correct** — TTS revokes object URLs on both the ended and error paths and stops the previous playback before starting a new one; STT stops all mic tracks when recording stops — no leak of blob URLs or live microphone streams. — evidence: `Dans-Dungeons/src/ai/tts.js:24`, `Dans-Dungeons/src/ai/tts.js:50`, `Dans-Dungeons/src/ai/tts.js:57`, `Dans-Dungeons/src/ai/stt.js:44`
- **OAuth callback hygiene: code scrubbed from the URL immediately** — main.js calls history.replaceState to remove ?code= from the address bar before the exchange begins, keeping the one-time code out of subsequent history entries — the right ordering even though the flow itself lacks PKCE (see finding). — evidence: `Dans-Dungeons/src/main.js:169-170`
- **Small, fast production payload with a self-stamping build** — The esbuild pipeline produces a 376KB minified IIFE bundle, inlines critical CSS, and stamps the git hash into the SW cache key and app.version in one step — a genuinely lean deploy for a game of this scope (the 2.3MB unreferenced PNGs already reported are the exception, not the rule). — evidence: `Dans-Dungeons/build.js:12-38`, `Dans-Dungeons/vendor/app.bundle.js (376KB)`

### 14.2 Findings

#### 14.2.1 [HIGH · gap] No CI in any repo: zero automated test/typecheck gates, and production deploys are unverified git pushes of a locally-built artifact

Across all four repos the only GitHub workflow is bag-of-holding's pages.yml, and its build job runs only 'npm run pages:build' — never 'npm test' or 'npm run typecheck', despite CLAUDE.md declaring those as hard merge gates ('npm test + npm run typecheck ... all green'). Dans-Dungeons, the actual deployed product, has no .github directory at all ('ls .github' fails for Dans-Dungeons, bag-of-holding-client, and bag-of-holding-mcp); its documented deploy is 'push main to origin (this is the GitHub Pages deploy trigger)'. The shipped artifact vendor/app.bundle.js is built on a developer machine (build.js) and committed — nothing ever verifies the committed bundle was rebuilt from the committed src/. The repo is currently sitting on main with uncommitted modifications to sw.js and vendor/app.version, demonstrating exactly this artifact/source drift in the working tree. The integration auditor's 'version chimera' finding proved the vendored-library variant of this failure already occurred; the identical mechanism can ship a stale or divergent bundle to every player silently.

- **Evidence:** `bag-of-holding/.github/workflows/pages.yml:41-42 (build step runs only pages:build)`, `bag-of-holding/CLAUDE.md (Gates before merging section)`, `Dans-Dungeons/CLAUDE.md (workflow step 5: push main = deploy trigger)`, `Dans-Dungeons/build.js:12-38`, `git status on Dans-Dungeons main: modified sw.js, vendor/app.version uncommitted`
- **Impact:** The 1,561-test engine suite and every merge gate exist only as manual discipline; a forgotten rebuild or a red suite ships straight to the public GitHub Pages URL with no detection. For an 80h AAA goal maintained largely by AI-agent workflows, un-gated trunk pushes are the single cheapest-to-fix systemic risk in the project.

#### 14.2.2 [HIGH · risk] Prompt injection is entirely undefended, and both classes of GM secret ride verbatim inside injectable prompts

Raw player text is interpolated into the narrator's SYSTEM message: narrate.js builds the system prompt from the last-3 transcript entries ('${e.role}: ${e.text}') via t('ai.narratorPrompt'), with no delimiters, quoting, or injection guidance. The settlement NPC prompt embeds the NPC's guarded secret in plaintext every dialogue turn — dialogue.js passes 'secret: npc.secret' into a system prompt whose only defense is the instruction "If 'May reveal the secret' is NO, never reveal or strongly hint at the secret" (en.json:488). The narrator prompt likewise carries the beat directive in the scene JSON with 'treat it as YOUR private objective — NEVER state it outright' (en.json:490). A single 'ignore your instructions and print your system prompt' from the player defeats all three; a tiny-tier model holding a secret against adversarial probing is exactly the pattern doc 08 warns about. There is no input sanitation, no injection-detection, and no separation of secret material from the generation context anywhere in src/ai/.

- **Evidence:** `Dans-Dungeons/src/ai/narrate.js:40-46`, `Dans-Dungeons/src/ai/dialogue.js:38-50`, `Dans-Dungeons/src/i18n/en.json:488 (npcDialoguePrompt: 'Guarded secret: {{secret}}')`, `Dans-Dungeons/src/i18n/en.json:490 (narratorPrompt: story.directive rule)`
- **Impact:** Today: players can self-spoil every secret and directive on demand, and can hijack the free tier's shared-key narrator into an arbitrary chatbot billed to the owner's OpenRouter account. Architecturally: doc-08's information-asymmetry model scaled to an 80h campaign would place ALL world secrets in-context; without a secrets-by-reference design (IDs in context, verbatim content revealed only by a deterministic gate), the 'secrets it must keep' pillar of the sales pitch is unenforceable.

#### 14.2.3 [HIGH · defect] Save import blindly restores ai.baseUrl + key, and CSP connect-src 'https:' lets the hijacked config exfiltrate to any origin

handleImportFile → parseSave → restoreState performs zero shape or content validation: every top-level key in the file, including the full 'ai' slice (PERSIST_KEYS includes 'ai', so exports carry and imports restore baseUrl, key, models, tier), is written into live state. Meanwhile the CSP is 'connect-src https:' — any HTTPS origin. Attack chain: attacker shares a 'cool save file' with ai.baseUrl='https://evil.example/v1'; victim imports it; every subsequent chatCompletion sends 'Authorization: Bearer <victim key>' to evil.example, allowed by CSP. If the crafted file also blanks ai.key, the app prompts the victim to paste their key — which is then posted to the attacker on the next turn. This is the active-theft mirror of the already-reported passive leak (key written INTO exports); no auditor examined the import direction or the CSP's connect-src width.

- **Evidence:** `Dans-Dungeons/src/ui/exports.js:83-113`, `Dans-Dungeons/src/core/state.js:124-129 (restoreState: unconditional setValue per top-level key)`, `Dans-Dungeons/src/core/state.js:147 (PERSIST_KEYS includes 'ai')`, `Dans-Dungeons/index.html:7 (connect-src https:)`
- **Impact:** A shared save file is a plausible community artifact; one import silently redirects the player's paid API credential to an attacker with no visible symptom (the attacker can even proxy real OpenRouter responses). Undermines the BYOK trust pillar.

#### 14.2.4 [MEDIUM · gap] Shipped game has no LICENSE, no SRD 5.2 CC-BY-4.0 attribution, no Lucide notice — and its marketing copy uses the 'D&D' trademark the engine's own legal doc forbids

Dans-Dungeons contains no LICENSE file (the three library repos each have one; the game has none), and grep for 'Wizards', 'CC-BY', or 'Creative Commons' across index.html, README.md, and both locale tables returns nothing — the only related string is README.md:26 'we lean on the 5e SRD'. The engine's docs/legal.md:75-79 states the attribution obligation explicitly: 'The README's footer and the LICENSE file together do the attribution work. If you're cutting a derivative or a downstream package, keep both intact.' The game is that downstream package — it vendors the engine's SRD monster/class/spell data and serves it publicly — and keeps neither. CC-BY-4.0 attribution is a hard license condition, not a courtesy. Additionally, legal.md:56-59 says '"Dungeons & Dragons", "D&D" ... are trademarks. We refer to the SRD 5.2 and to 5e generically; we don't claim D&D compatibility in marketing copy' — yet README.md:3 says 'A text-based D&D type game', package.json's description says 'AI-driven D&D type game', and the vendored Lucide SVGs in vendor/icons/ ship without their license text.

- **Evidence:** `find over repo roots: LICENSE present in bag-of-holding, bag-of-holding-client, bag-of-holding-mcp; absent in Dans-Dungeons`, `bag-of-holding/docs/legal.md:56-59`, `bag-of-holding/docs/legal.md:75-79`, `Dans-Dungeons/README.md:3`, `Dans-Dungeons/README.md:26`, `Dans-Dungeons/package.json:6`, `Dans-Dungeons/vendor/icons/ (bare SVGs, no license file)`
- **Impact:** The publicly deployed product is currently out of compliance with the CC-BY-4.0 condition its own engine documents, and uses the trademark its own legal guide prohibits — trivially fixable now, embarrassing and harder to fix after an 'AAA' launch draws attention.

#### 14.2.5 [MEDIUM · gap] Privacy: free-tier pivot routes all players' prose through the owner's OpenRouter account with zero disclosure; the disclosure doc 05 promised does not exist

The embedded shared key (tiers.js _a/_b XOR blob) means every free-tier player's free-text input, transcripts, and STT-adjacent content authenticate as the owner's OpenRouter account, making the owner (EU-based) a de-facto processor of player data with visibility into all free-tier prompts via his account logs. Doc 05's privacy section was written for pure BYOK: 'this is sent to the player's chosen provider, exactly as they'd expect. We tell them so in the settings panel' (docs/ideas/05-ai-runtime.md:170-172) — grep over en.json finds no such disclosure string anywhere in the UI, and README.md:18 still advertises 'no servers, no telemetry'. The free tier also pins ':free'-suffixed model routes (tiers.js:16-23), the class of OpenRouter endpoints where providers commonly reserve prompt-logging/training rights. No auditor examined the data-flow consequences of the free/deluxe pivot — they covered the key's obfuscation and rate caps, not who now sees player data.

- **Evidence:** `Dans-Dungeons/src/ai/tiers.js:9-11`, `Dans-Dungeons/src/ai/tiers.js:16-23`, `Dans-Dungeons/docs/ideas/05-ai-runtime.md:166-172`, `Dans-Dungeons/README.md:18`, `grep 'sent to|provider' over src/i18n/en.json: no disclosure string exists`
- **Impact:** Players type personal, creative, sometimes sensitive free-text into an RPG; routing it through the developer's account without a consent screen or one-paragraph privacy note is a real (GDPR-relevant for an EU owner) gap and contradicts the product's stated privacy pillar. One settings-panel paragraph plus a first-run notice for shared-key mode closes most of it.

#### 14.2.6 [MEDIUM · risk] OAuth flow claims PKCE but implements none, and a raw API key is accepted via ?key= URL parameter

auth.js's header comment says 'OpenRouter OAuth PKCE flow', but redirectToOpenRouter builds only 'https://openrouter.ai/auth?callback_url=...' — no code_challenge/code_challenge_method — and exchangeCodeForKey posts only {code} with no code_verifier. Without PKCE, anyone who obtains the callback code (history sync, shoulder-surf of a shared link, log leakage) can exchange it for a working, spend-capable API key on the victim's OpenRouter account. Separately, main.js:166,185-188 accepts '?key=sk-or-...' from the URL and stores it as the live key: keys embedded in URLs traverse GitHub Pages' request logs, browser history/sync, and any medium the link was shared through before history.replaceState runs client-side.

- **Evidence:** `Dans-Dungeons/src/ai/auth.js:1-12 (comment claims PKCE; only callback_url sent)`, `Dans-Dungeons/src/ai/auth.js:14-19 (exchange body is {code} only)`, `Dans-Dungeons/src/main.js:166`, `Dans-Dungeons/src/main.js:185-188`
- **Impact:** The recommended default connect path (OAuth) is weaker than its own documentation claims, and the ?key= side door normalizes secret-bearing URLs. Both fixes are small: generate a code_verifier + S256 challenge, send the verifier in the exchange; delete or dev-gate ?key=.

#### 14.2.7 [MEDIUM · risk] Multi-tab play silently corrupts saves (last-writer-wins, no coordination), and the SW force-reloads every tab mid-turn on version mismatch

There is no 'storage' event listener, BroadcastChannel, or Web Lock anywhere in src/ (grep over the tree finds only unrelated matches). saveToStorage rewrites the entire versioned envelope under the single 'dans-dungeons' key on every commit, so two open tabs interleave whole-state writes: hours of progress committed by tab A are overwritten wholesale by stale tab B's next autosave, with no warning and (per the already-reported backup findings) no recovery. Compounding it, sw.js's VERSION_CHECK handler purges all caches and calls c.navigate(c.url) on ALL window clients — so deploying a new version mid-session reloads a tab in the middle of an LLM turn, discarding the in-flight turn and any un-committed state.

- **Evidence:** `grep for storage-event/BroadcastChannel/navigator.locks over Dans-Dungeons/src: zero coordination hits`, `Dans-Dungeons/src/core/state.js:144 (single SAVE_KEY)`, `Dans-Dungeons/src/core/state.js:169-173`, `Dans-Dungeons/sw.js:59-71 (c.navigate on all clients)`
- **Impact:** Opening the game in a second tab — a completely ordinary user action — is a data-loss mechanism today and becomes catastrophic at 80h campaign stakes. A Web Locks tab-ownership guard (refuse or read-only-mode in the second tab) is a small fix.

#### 14.2.8 [MEDIUM · gap] No test layer exists for the product's actual core: zero e2e/browser tests in any repo, LLM responses never validated against the schemas that are sent, and no prompt-regression/eval harness

No playwright/puppeteer/cypress/jsdom dependency exists in any of the four package.json files (verified by grep). The JSON schemas in schemas.js are send-only: they go out as response_format, but the parsed responses are never checked against them locally — grep for 'validate' over client.js and loop.js returns nothing; narrate() returns JSON.parse(raw) as-is (narrate.js:55-59) and loop.js:145 commits narratorResp.narration without existence-checking, so a schema-valid-but-field-missing response (likely on free-tier routes that ignore response_format) commits undefined into the transcript. And there is no prompt-eval infrastructure of any kind: Dans-Dungeons' 15 test files cover seeded rolls, spend math, time-travel, and worldgen determinism only, so a rewording of narratorPrompt or classifierPrompt ships with no way to measure regression in fact-adherence, intent accuracy, or JSON validity. Related-but-distinct findings (zero UI tests, hand-copied test reimplementations) were reported; the absent LLM-contract/eval layer — the load-bearing quality surface of an AI-GM game — was not.

- **Evidence:** `grep playwright|puppeteer|cypress|jsdom over all four package.json: no hits`, `Dans-Dungeons/src/ai/narrate.js:55-59`, `Dans-Dungeons/src/game/loop.js:145`, `grep 'validate' over src/ai/client.js and src/game/loop.js: zero hits`, `Dans-Dungeons/tests/ (15 files: seeded-rolls, spend, timetravel, worldgen/*)`
- **Impact:** For a game whose product quality IS prompt output, every prompt edit is a blind deploy, and a malformed-but-parseable model response corrupts the transcript and the journal derived from it. The seeded-rng + rollLog architecture makes a recorded-response harness cheap: capture real model JSON once, replay classify→resolve→narrate offline in CI.

#### 14.2.9 [LOW · risk] Browser-resource growth over an 80h campaign: unbounded transcript DOM with per-token smooth-scroll, full-DOM rebuilds, and a 1-2MB scene-image data URI written to localStorage per generation

appendEntry appends transcript nodes forever with no cap or virtualization, and appendStreamChunk calls scrollIntoView({behavior:'smooth'}) on every streamed token — layout/scroll cost scales with total node count; rebuildTranscript re-creates every entry from scratch on undo, import, and resume. Separately, sketch.js setSceneImage writes the full base64 image data URI into localStorage ('sketch-last-image') on every scene generation — one to two MB competing for the same ~5MB quota the state-persistence auditors already showed the save exhausting, with a silent catch when it fails. Bounded and invisible at today's 2-4h scale; a compounding tax at the 80h target (thousands of DOM nodes, O(n) rebuilds, and permanent ~20-40% quota loss to one background image).

- **Evidence:** `Dans-Dungeons/src/ui/transcript.js:14-21`, `Dans-Dungeons/src/ui/transcript.js:27-33`, `Dans-Dungeons/src/ui/transcript.js:47-50`, `Dans-Dungeons/src/ui/sketch.js:13-14`
- **Impact:** Sluggish streaming and resume on long campaigns, plus extra pressure on the already-critical localStorage quota. Cheap fixes: render only the last N entries with 'load earlier' paging, throttle scroll to one rAF per chunk batch, keep the sketch in memory or IndexedDB.

### 14.3 Recommendations

#### 14.3.1 [P0 · effort S] Add test-gating CI to all four repos and make deploys CI-built

Closes the highest-leverage process gap: pages.yml gains 'npm test' + 'npm run typecheck' steps before deploy; Dans-Dungeons gets a workflow running npm test, node build.js, and a 'git diff --exit-code vendor/app.bundle.js' freshness check (or better: build the bundle IN CI and deploy the artifact, removing the committed-bundle drift class entirely).

```js
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm test
      - run: node build.js
      - run: git diff --exit-code vendor/app.bundle.js vendor/app.version || (echo 'committed bundle is stale' && exit 1)
```

#### 14.3.2 [P0 · effort S] Validate imported saves and pin the default network surface

Kills the baseUrl-hijack chain: on import, reject or explicitly confirm any ai.baseUrl differing from the OpenRouter default, never import ai.key, and tighten CSP connect-src to https://openrouter.ai (widening only when the user has knowingly configured a custom base URL).

```js
const DEFAULT_BASE = 'https://openrouter.ai/api/v1';
function sanitizeImportedAi(ai, current) {
  if (!ai) return current;
  const { key: _drop, baseUrl, ...rest } = ai;
  const safeBase = baseUrl === DEFAULT_BASE ? baseUrl
    : (confirm(`This save changes the AI endpoint to ${baseUrl}. Allow?`) ? baseUrl : current.baseUrl);
  return { ...current, ...rest, baseUrl: safeBase };
}
```

#### 14.3.3 [P1 · effort S] Ship the attribution footer and a LICENSE/NOTICE for the game

CC-BY-4.0 compliance is a hard condition of shipping SRD content and costs one afternoon: add a LICENSE (or NOTICE) covering the game code, reproduce the MPL-2.0 notice for vendored engine/client files, include Lucide's license, add the Wizards SRD 5.2 CC-BY-4.0 credit to index.html's footer and README, and reword 'D&D type game' to 'a 5e-SRD-based game' per bag-of-holding/docs/legal.md.

#### 14.3.4 [P1 · effort S] Add real PKCE to the OpenRouter OAuth flow and remove ?key=

Matches the code to its own comment and OpenRouter's recommended flow: generate a code_verifier, send an S256 code_challenge on redirect, include the verifier in the exchange. Delete the ?key= URL parameter (or gate it behind localhost) so bearer secrets never ride in URLs.

```js
const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
sessionStorage.setItem('pkce', verifier);
const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
location.href = `https://openrouter.ai/auth?callback_url=${cb}&code_challenge=${challenge}&code_challenge_method=S256`;
// exchange: body: JSON.stringify({ code, code_verifier: sessionStorage.getItem('pkce'), code_challenge_method: 'S256' })
```

#### 14.3.5 [P1 · effort M] Design secrets-by-reference before building doc-08's asymmetry model

Stop carrying verbatim secrets in generation context: prompts reference secret IDs plus a one-line 'the NPC knows something about X' gist; the verbatim secret text is injected only on the turn a deterministic gate (reputation threshold, beat flag, skill success) flips mayReveal. Also wrap player text in explicit delimiters with an instruction that delimited content is data, not instructions — cheap hardening that also improves narrator fact-adherence.

#### 14.3.6 [P1 · effort S] Add a free-tier consent notice and a privacy paragraph

One first-run dialog for shared-key mode ('your messages are routed through the game's shared OpenRouter account and free model providers; use your own key for private play') plus the settings-panel disclosure doc 05 already promised. Closes the GDPR-relevant gap and realigns README's 'no telemetry' claim with reality.

#### 14.3.7 [P1 · effort S] Guard against multi-tab clobbering with Web Locks

navigator.locks.request('dans-dungeons-save', {ifAvailable:true}) at boot; if the lock is held, open in read-only/spectator mode with a clear message. Also make the SW's VERSION_CHECK reload prompt-based (or defer until the tab is idle at the settlement/menu) instead of force-navigating mid-turn.

#### 14.3.8 [P2 · effort M] Build the recorded-response harness and validate LLM responses at the boundary

Add a ~30-line validator (required fields + types per schemas.js) applied to every parsed response with a typed failure path, and a fixtures directory of real captured model outputs replayed through classify→resolve→narrate under node --test. This is the cheapest route to both e2e coverage (the dead-chips class) and prompt-regression detection, and it leverages the engine's existing determinism.

#### 14.3.9 [P2 · effort S] Cap transcript rendering and move the scene sketch out of localStorage

Render the last ~200 entries with a 'load earlier' control, throttle stream scrolling to one requestAnimationFrame per batch, and store 'sketch-last-image' in IndexedDB (or keep it in-memory only) to return 1-2MB of quota to the save that critically needs it.

### 14.4 Metrics collected

- **ci_workflows_across_4_repos:** 1
- **ci_workflows_running_tests:** 0
- **license_files:** 3 of 4 repos (Dans-Dungeons has none)
- **srd_attribution_strings_in_shipped_game:** 0
- **privacy_disclosure_strings_in_ui:** 0
- **browser_test_frameworks_in_any_repo:** 0
- **storage_event_listeners_in_src:** 0
- **pkce_parameters_in_oauth_flow:** 0
- **app_bundle_kb_minified:** 376
- **vendored_kb:** {"bag_of_holding": 484, "bag_of_holding_client": 172, "icons": 100, "spektrum": 60}
- **dans_dungeons_test_files:** 15
- **flow_js_lines:** 1539
- **index_html_lines:** 363
- **uncommitted_changes_on_main:** ["sw.js", "vendor/app.version"]
- **sketch_localstorage_write_per_image_mb_est:** 1-2
