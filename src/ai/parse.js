// src/ai/parse.js — making sense of what a model actually returned.
//
// Dependency-free on purpose: no transport, no locale, no state. Both of these
// run on the output of a paid call, which is exactly where a bug is most
// expensive to find, so they are the two things in the AI layer that are
// directly testable under `node --test`.

// ─── DC clamping ─────────────────────────────────────────────────────────────
//
// A d20 check is only interesting between "you basically can't fail" and "you
// basically can't succeed". The classifier used to return whatever number it
// liked — a DC of 35 is an automatic failure dressed up as a roll, and a DC of
// 2 is a cutscene. Both were handed to players as if the dice mattered.

export const DC_MIN = 5;
export const DC_MAX = 25;

export function clampDc(dc) {
  if (typeof dc !== 'number' || !Number.isFinite(dc)) return null;
  return Math.min(DC_MAX, Math.max(DC_MIN, Math.round(dc)));
}

// ─── JSON salvage ────────────────────────────────────────────────────────────

// Pull a JSON object out of text that may be fenced, prefixed, or trailed.
// Returns the parsed object, or null when there is nothing to recover.
//
// This runs BEFORE any paid repair call, and that ordering is the point: almost
// every "unparseable" narration is valid JSON wearing a markdown fence, and the
// player has ALREADY watched the streamed text arrive. A repair call that comes
// back with different words shows them one story and commits another.
export function salvageJson(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const candidates = [];
  // ```json … ``` or a bare ``` … ``` fence
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  // The outermost brace-delimited span
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim());
      if (parsed && typeof parsed === 'object' && typeof parsed.narration === 'string') return parsed;
    } catch { /* try the next candidate */ }
  }

  // Last resort: the stream carried readable prose and only the wrapper broke.
  // Showing the player the words they already watched arrive beats replacing
  // them with a different paragraph from a repair call.
  const prose = text.replace(/```(?:json)?/gi, '').trim();
  if (prose && !prose.startsWith('{')) return { narration: prose };
  return null;
}
