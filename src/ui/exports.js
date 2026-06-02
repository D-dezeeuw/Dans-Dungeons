// src/ui/exports.js — journal, screenshot, sketch gallery, and save file I/O.
// All functions are triggered by user action; none interact with the game loop.

import { appState, restoreState, tick, saveToStorage } from '../core/state.js';
import { appendEntry, setThinking } from './transcript.js';
import { getJournalLog } from '../game/flow.js';
import { t, locale } from '../i18n/i18n.js';

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
    appendEntry('system', t('exports.noSketch'));
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
    appendEntry('system', t('exports.noSketches'));
    return;
  }
  const pcName = appState.party?.pc?.record?.name ?? 'Adventurer';
  const rows   = sketches.map((e, i) =>
    `<figure>
  <figcaption>${i === 0 ? t('exports.openingScene') : t('exports.turnN', { n: e.turn })}</figcaption>
  <img src="${e.imageSrc}" alt="Scene sketch turn ${e.turn}">
</figure>`
  ).join('\n');
  const html = `<!DOCTYPE html>
<html lang="${locale()}">
<head><meta charset="UTF-8"><title>${t('exports.sketchesTitle', { name: pcName })}</title>
<style>
  body{background:#f5e6c8;color:#3a2a1a;font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem}
  h1{text-align:center;color:#5c3d1a;margin-bottom:2rem}
  figure{margin:0 0 2rem;border-top:1px solid #c8a878;padding-top:1.5rem}
  figcaption{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#8c6a3a;margin-bottom:.6rem}
  img{width:100%;border:1px solid #c8a878;border-radius:2px}
</style></head>
<body><h1>${t('exports.sketchesOf', { name: pcName })}</h1>${rows}</body></html>`;
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
      appendEntry('system', t('exports.imported', { file: file.name }));
    } catch {
      appendEntry('error', t('exports.importFail'));
    }
  };
  reader.readAsText(file);
}

// ─── HTML escape ─────────────────────────────────────────────────────────────

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Journal (LLM-enhanced) ──────────────────────────────────────────────────

export async function createJournal() {
  const journalLog = getJournalLog();
  if (!journalLog.length) return;

  const pcName  = appState.party?.pc?.record?.name ?? 'Adventurer';
  const pcClass = appState.party?.pc?.record?.classId ?? '';
  const images  = journalLog.filter(e => e.imageSrc).map(e => e.imageSrc);

  // Show progress in transcript.
  appendEntry('system', t('exports.crafting'));

  let story = null;
  try {
    const { generateJournalStory } = await import('../ai/journal.js');
    story = await generateJournalStory(journalLog, pcName, pcClass);
  } catch (e) {
    console.warn('Journal LLM failed:', e.message);
  }

  if (story?.chapters?.length) {
    await _downloadStoryJournal(story, pcName, pcClass, images);
  } else {
    appendEntry('system', t('exports.craftFail'));
    _downloadRawJournal(journalLog, pcName, pcClass);
  }
}

// ─── Story journal (LLM-enhanced, EPUB export) ──────────────────────────────

async function _downloadStoryJournal(story, pcName, pcClass, images) {
  const { buildEpub } = await import('./epub.js');

  // Pair images to chapters
  const chapters = story.chapters.map((ch, i) => ({
    heading:      ch.heading,
    text:         ch.text,
    imageDataUri: images[i] ?? null,
  }));

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const blob = await buildEpub({
    title:    story.title,
    subtitle: `${pcName} — ${cap(pcClass)}`,
    lang:     locale(),
    chapters,
  });

  triggerDownload(blob, `dans-dungeons-${pcName.toLowerCase().replace(/\s+/g, '-')}.epub`);
}

// ─── Raw journal (fallback) ──────────────────────────────────────────────────

function _downloadRawJournal(journalLog, pcName, pcClass) {
  const entriesHtml = journalLog.map((entry, i) => {
    const heading = i === 0 ? t('exports.adventureBegins') : t('exports.turnN', { n: entry.turn });
    const img = entry.imageSrc
      ? `<img src="${entry.imageSrc}" alt="Scene sketch" style="width:100%;display:block;margin-bottom:1.2rem;border-radius:2px;">`
      : '';
    const text = esc(entry.narration).replace(/\n/g, '<br>');
    return `<div class="entry">
  <div class="turn-label">${heading}</div>
  ${img}
  <p>${text}</p>
</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="${locale()}">
<head>
<meta charset="UTF-8">
<title>${t('exports.journalOf', { name: pcName }).replace(/</g, '&lt;')}</title>
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
<h1>${t('exports.journalOf', { name: pcName }).replace(/</g, '&lt;')}</h1>
<div class="subtitle">${t('exports.subtitle', { class: pcClass })}</div>
${entriesHtml}
</body>
</html>`;

  triggerDownload(new Blob([html], { type: 'text/html' }),
    `dans-dungeons-journal-${pcName.toLowerCase().replace(/\s+/g, '-')}.html`);
}
