// src/ui/sketch.js — scene background image management.
// The generated sketch is displayed as the transcript background at low opacity.

const transcriptBgEl = () => document.getElementById('transcript-bg');

export function showSceneImageLoading() {
  // The existing background stays visible until the new image arrives.
}

export function setSceneImage(src) {
  const el = transcriptBgEl();
  if (el) el.style.backgroundImage = `url("${src}")`;
  try { localStorage.setItem('sketch-last-image', src); } catch { /* quota — skip */ }
}

export function restoreSceneImage() {
  const src = localStorage.getItem('sketch-last-image');
  if (!src) return false;
  const el = transcriptBgEl();
  if (el) el.style.backgroundImage = `url("${src}")`;
  return true;
}

export function hideSceneImage() {
  transcriptBgEl()?.classList.add('sketch-off');
}

export function setSketchOpacity(tier) {
  const el = transcriptBgEl();
  if (!el) return;
  el.classList.remove('sketch-off', 'sketch-hi');
  if (tier === 'off') el.classList.add('sketch-off');
  if (tier === 'hi')  el.classList.add('sketch-hi');
  // 'normal' = no class = 0.2 opacity (CSS default)
}
