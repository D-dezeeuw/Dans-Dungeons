// src/settings/voice.js — how this world sounds (doc 19 §6).
//
// The tables decide what exists; the voice decides how it is spoken about.
// They are different problems: a pack can swap every creature, every room and
// every place name and still read like a fantasy novel, because the narrator
// was never told that people here say "choom" rather than "friend" and that
// nobody has ever seen a tavern.
//
// The block is rendered into the narrator, dialogue, travel and journal
// prompts — the SPEAKERS. It deliberately never reaches the classifiers, the
// beat checker, the canon extractor or the digest summariser: those are
// READERS, and style in their prompts is a per-turn token bill with nothing
// player-visible to show for it, plus one more way for a structured answer to
// drift. The classic pack has no voice, so every one of these prompts renders
// an empty slot and reads exactly as it did before packs existed.

import { activePack } from './index.js';
import { renderVoiceFields } from './packs.js';

export { renderVoiceFields };

// audience: 'narrator' | 'npc' | 'journal'
export function voiceBlock(audience = 'narrator') {
  const v = activePack()?.voice;
  if (!v) return '';

  const lines = [];
  if (v.register)             lines.push(`Register: ${v.register}.`);
  if (v.address?.length)      lines.push(`People here address the player character as: ${v.address.join(', ')}. Use these the way real speech does — occasionally, not in every line.`);
  if (v.honorifics?.length)   lines.push(`Honorifics: ${v.honorifics.join('; ')}.`);
  if (v.exclamations?.length) lines.push(`Things people exclaim here: ${v.exclamations.join('; ')}.`);
  if (v.forbid?.length)       lines.push(`Never use these words or props — they belong to a different world: ${v.forbid.join(', ')}.`);

  const examples = v.examples?.[audience === 'npc' ? 'npc' : 'narrator'] ?? [];
  if (examples.length) lines.push(`Lines that sound right here:\n${examples.map(l => `- ${l}`).join('\n')}`);

  return lines.join('\n');
}

// What an NPC prompt calls the place the conversation is happening in — "a
// fantasy town" is itself setting content, and it was hardcoded in the prompt.
export function settingNoun(locale = 'en', fallback = 'a fantasy town') {
  const noun = activePack()?.voice?.settingNoun;
  if (!noun) return fallback;
  return (typeof noun === 'string' ? noun : (noun[locale] ?? noun.en)) ?? fallback;
}

// The sketch style for scene images. Also pack content: a cyberpunk campaign
// asking for "a medieval fantasy scene" got a castle.
export function imageStyle(fallback = '') {
  return activePack()?.imageStyle ?? fallback;
}
