// src/ui/transcript.js — transcript DOM operations.
// Appends entries, manages streaming text, shows the thinking indicator.

const transcriptEl = () => document.getElementById('transcript');

export function clear() {
  transcriptEl().querySelectorAll('.entry').forEach(e => e.remove());
}

export function appendEntry(role, text) {
  const el  = document.createElement('div');
  el.className = `entry entry-${role}`;
  el.textContent = text;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

// beginStreamEntry + appendStreamChunk: progressive GM narration display.
// beginStreamEntry creates an empty entry; appendStreamChunk grows it as
// each token arrives so the player sees text appear in real time.

export function beginStreamEntry(role) {
  const el = document.createElement('div');
  el.className = `entry entry-${role}`;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

export function appendStreamChunk(el, chunk) {
  el.textContent += chunk;
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

export function setThinking(on) {
  const ID = 'thinking-indicator';
  if (on) {
    if (document.getElementById(ID)) return;
    const el = appendEntry('thinking', '⏳ The Dungeon Master considers…');
    el.id = ID;
  } else {
    document.getElementById(ID)?.remove();
  }
}
