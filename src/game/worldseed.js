// src/game/worldseed.js — app blueprint wrapper + domain-themed item content.
//
// The blueprint factory + archetype tables now live in the client library
// (@zeeuw/bag-of-holding-client/worldgen). This module wraps it with the app's
// seed convention and keeps the domain-themed treasures/keys (consumed by the
// dungeon generator) plus a re-export of the dungeon-theme overlays.

import { buildBlueprint } from 'bag-of-holding-client';

export { DUNGEON_OVERLAYS } from './dungeon-overlays.js';

// Same seed → same blueprint. The library's seeded RNG (mulberry32) matches the
// engine's Dice.seededRng, so blueprints are identical to the pre-extraction
// build for any given seed.
export function buildWorldBlueprint(seed) {
  return buildBlueprint(seed);
}

// ─── Domain-themed treasures (20 domains) ────────────────────────────────────

export const DOMAIN_TREASURES = {
  'death':     { name: 'skull-crowned scepter',       desc: 'A scepter topped with a silver skull whose eye sockets glow faintly.' },
  'war':       { name: 'battle-scarred war banner',   desc: 'A tattered banner that fills you with courage when unfurled.' },
  'nature':    { name: 'living seed crystal',         desc: 'A gemstone with a tiny fern growing inside, warm to the touch.' },
  'trickery':  { name: 'mirror of false faces',       desc: 'A hand mirror that shows a different face each time you look.' },
  'light':     { name: 'sunstone pendant',            desc: 'A golden pendant that radiates warmth and a soft, steady glow.' },
  'knowledge': { name: 'tome of whispered truths',    desc: 'An ancient book that murmurs answers when you ask questions aloud.' },
  'tempest':   { name: 'stormcaller\'s horn',         desc: 'A curved horn that crackles with static electricity.' },
  'forge':     { name: 'anvil shard',                 desc: 'A fragment of a divine anvil, impossibly dense and warm.' },
  'life':      { name: 'chalice of renewal',          desc: 'A silver chalice. Any water poured in becomes sweet and restorative.' },
  'grave':     { name: 'mourner\'s lantern',          desc: 'A lantern that burns without fuel. The dead are drawn to its light.' },
  'order':     { name: 'seal of binding oaths',       desc: 'A heavy seal ring. Promises made while wearing it cannot be broken.' },
  'twilight':  { name: 'duskweave cloak',             desc: 'A cloak that seems woven from the last light of sunset.' },
  'arcana':    { name: 'crystallized spell',          desc: 'A hovering crystal containing a spell frozen mid-cast.' },
  'vengeance': { name: 'grudge-keeper\'s blade',      desc: 'A dagger that grows warm when pointed at someone who wronged you.' },
  'chaos':     { name: 'entropy marble',              desc: 'A sphere of constantly shifting matter. It is never the same twice.' },
  'sea':       { name: 'tide pearl',                  desc: 'A black pearl that hums with the rhythm of distant waves.' },
  'hunting':   { name: 'predator\'s fang necklace',   desc: 'A necklace of fangs from creatures that no longer exist.' },
  'dreams':    { name: 'sleepwalker\'s compass',      desc: 'A compass that points toward whatever you dreamed of last.' },
  'madness':   { name: 'whispering orb',              desc: 'A glass orb filled with smoke that forms words you almost understand.' },
  'beauty':    { name: 'rose that never wilts',       desc: 'A perfect crimson rose, eternally in bloom. It smells like nostalgia.' },
};

// ─── Domain-themed keys (20 domains) ─────────────────────────────────────────

export const DOMAIN_KEYS = {
  'death':     { name: 'bone key',          desc: 'Carved from a single finger bone. It feels heavier than it should.' },
  'war':       { name: 'iron war key',      desc: 'Forged from a melted-down sword hilt. Still warm.' },
  'nature':    { name: 'living vine key',   desc: 'A key of twisted green vine that pulses with sap.' },
  'trickery':  { name: 'invisible key',     desc: 'You can feel it in your hand but can only see it from the corner of your eye.' },
  'light':     { name: 'sunmetal key',      desc: 'A golden key that glows softly in darkness.' },
  'knowledge': { name: 'runic key',         desc: 'Covered in tiny runes that rearrange themselves when you blink.' },
  'tempest':   { name: 'lightning-scarred key', desc: 'A key with branching fracture lines like a lightning bolt.' },
  'forge':     { name: 'slag key',          desc: 'Rough-cast metal, still showing the pour marks. Unbreakable.' },
  'life':      { name: 'heartwood key',     desc: 'Smooth wood from a tree that was already ancient when the world was young.' },
  'grave':     { name: 'mourner\'s key',    desc: 'Cold iron wrapped in black cloth. It smells of lilies.' },
  'order':     { name: 'magistrate\'s key', desc: 'An official key stamped with a judicial seal. Heavy with authority.' },
  'twilight':  { name: 'dusk key',          desc: 'A key that only becomes solid at twilight. The rest of the time it shimmers.' },
  'arcana':    { name: 'crystal key',       desc: 'Transparent and faintly humming. It refracts light into impossible colours.' },
  'vengeance': { name: 'barbed key',        desc: 'A key with tiny hooks. It draws blood when turned.' },
  'chaos':     { name: 'shifting key',      desc: 'Its shape changes slightly each time you look away. It always fits.' },
  'sea':       { name: 'coral key',         desc: 'Encrusted with barnacles. It smells of salt and deep water.' },
  'hunting':   { name: 'antler key',        desc: 'Carved from a stag\'s antler. The tines form the teeth.' },
  'dreams':    { name: 'gossamer key',      desc: 'Light as a thought. You\'re not sure it\'s entirely real.' },
  'madness':   { name: 'wrong key',         desc: 'It shouldn\'t fit any lock. It does anyway.' },
  'beauty':    { name: 'rose-gold key',     desc: 'Delicate and ornate, too beautiful to be merely functional.' },
};
