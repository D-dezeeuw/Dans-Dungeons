// src/ui/exports.js — journal, screenshot, sketch gallery, and save file I/O.
// All functions are triggered by user action; none interact with the game loop.

import { appState, restoreState, tick, saveToStorage } from '../core/state.js';
import { appendEntry } from './transcript.js';
import { getJournalLog } from '../game/flow.js';

// ─── Download helper ──────────────────────────────────────────────────────────

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

export function exportScreenshot() {
  const src = localStorage.getItem('sketch-last-image');
  if (!src?.startsWith('data:image')) {
    appendEntry('system', 'No scene sketch to export yet.');
    return;
  }
  const [header, b64] = src.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: mime });
  const name  = appState.party?.pc?.record?.name ?? 'adventurer';
  triggerDownload(blob, `dans-dungeons-sketch-${name.toLowerCase().replace(/\s+/g, '-')}.png`);
}

// ─── Sketch gallery ───────────────────────────────────────────────────────────

export function exportAllSketches() {
  const journalLog = getJournalLog();
  const sketches   = journalLog.filter(e => e.imageSrc);
  if (!sketches.length) {
    appendEntry('system', 'No sketches generated this session yet.');
    return;
  }
  const pcName = appState.party?.pc?.record?.name ?? 'Adventurer';
  const rows   = sketches.map((e, i) =>
    `<figure>
  <figcaption>${i === 0 ? 'Opening scene' : 'Turn ' + e.turn}</figcaption>
  <img src="${e.imageSrc}" alt="Scene sketch turn ${e.turn}">
</figure>`
  ).join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Sketches — ${pcName}</title>
<style>
  body{background:#f5e6c8;color:#3a2a1a;font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem}
  h1{text-align:center;color:#5c3d1a;margin-bottom:2rem}
  figure{margin:0 0 2rem;border-top:1px solid #c8a878;padding-top:1.5rem}
  figcaption{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#8c6a3a;margin-bottom:.6rem}
  img{width:100%;border:1px solid #c8a878;border-radius:2px}
</style></head>
<body><h1>Sketches of ${pcName}</h1>${rows}</body></html>`;
  triggerDownload(new Blob([html], { type: 'text/html' }),
    `dans-dungeons-sketches-${pcName.toLowerCase().replace(/\s+/g, '-')}.html`);
}

// ─── Save file import ─────────────────────────────────────────────────────────

export function importSave() {
  document.getElementById('import-file-input').click();
}

export function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const snap = JSON.parse(ev.target.result);
      restoreState(snap);
      tick();
      saveToStorage();
      appendEntry('system', `Imported save: ${file.name}`);
    } catch {
      appendEntry('error', 'Failed to import — file is not a valid save.');
    }
  };
  reader.readAsText(file);
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export function createJournal() {
  const journalLog = getJournalLog();
  if (!journalLog.length) return;
  const pcName  = appState.party?.pc?.record?.name ?? 'Adventurer';
  const pcClass = appState.party?.pc?.record?.classId ?? '';

  const entriesHtml = journalLog.map((entry, i) => {
    const heading = i === 0 ? 'The Adventure Begins' : `Turn ${entry.turn}`;
    const img = entry.imageSrc
      ? `<img src="${entry.imageSrc}" alt="Scene sketch" style="width:100%;display:block;margin-bottom:1.2rem;border-radius:2px;">`
      : '';
    const text = entry.narration
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<div class="entry">
  <div class="turn-label">${heading}</div>
  ${img}
  <p>${text}</p>
</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Journal of ${pcName.replace(/</g, '&lt;')}</title>
<style>
  body { background:#f5e6c8; color:#3a2a1a; font-family:Georgia,'Times New Roman',serif; max-width:700px; margin:0 auto; padding:2rem 1.5rem; line-height:1.8; }
  h1 { text-align:center; font-size:2rem; margin-bottom:0.3rem; color:#5c3d1a; letter-spacing:0.04em; }
  .subtitle { text-align:center; color:#8c6a3a; font-style:italic; margin-bottom:2.5rem; font-size:1rem; }
  .entry { border-top:1px solid #c8a878; padding-top:1.5rem; margin-top:1.5rem; }
  .entry:first-child { border-top:none; margin-top:0; }
  .turn-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; color:#8c6a3a; margin-bottom:0.8rem; }
  p { margin:0; }
  img { border:1px solid #c8a878; }
</style>
</head>
<body>
<h1>Journal of ${pcName.replace(/</g, '&lt;')}</h1>
<div class="subtitle">A ${pcClass} — Dan's Dungeons</div>
${entriesHtml}
</body>
</html>`;

  triggerDownload(new Blob([html], { type: 'text/html' }),
    `dans-dungeons-journal-${pcName.toLowerCase().replace(/\s+/g, '-')}.html`);
}
