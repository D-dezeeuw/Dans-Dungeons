// src/ui/console.js — re-export barrel.
// Import from specific modules for new code.

export { clear, appendEntry, beginStreamEntry, appendStreamChunk, setThinking, showRoleplayOverlay } from './transcript.js';
export { setInputEnabled, prompt, pickFrom, prefillChip, fireChip }            from './input.js';
export { showActionChips, showCharacterChips, showSkillChips,
         insertActionChip, clearChips, showRoomChips }                         from './chips.js';
export { showSceneImageLoading, setSceneImage, restoreSceneImage,
         hideSceneImage, setSketchOpacity }                                    from './sketch.js';
export { initCollapsibles, updateDebugPanel }                                  from './sidebar.js';
export { updateActionBar }                                                     from './actionbar.js';
