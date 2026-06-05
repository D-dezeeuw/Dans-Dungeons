// src/game/blueprint-context.js — pure blueprint → prompt-constraint formatters.
//
// Zero imports on purpose: these functions turn a world blueprint (from
// worldseed.js) into the constraint strings each AI generator appends to its
// system prompt. Keeping them dependency-free makes them unit-testable in the
// node test runner (which can't resolve the `bag-of-holding` bare specifier or
// JSON imports that the rest of worldgen.js pulls in).
//
// Each `*Hints` helper returns the SUFFIX appended to a generator's prompt.

// Full constraint block — used verbatim by the world-seed generator.
export function blueprintContext(bp) {
  if (!bp) return '';
  const parts = [];
  if (bp.tone)           parts.push(`Tone: ${bp.tone}`);
  if (bp.worldArchetype) parts.push(`World archetype: ${bp.worldArchetype}`);
  if (bp.threatType)     parts.push(`Primary threat: ${bp.threatType}`);
  if (bp.climate)        parts.push(`Climate: ${bp.climate}`);
  if (bp.dungeonTheme)   parts.push(`Dungeon theme: ${bp.dungeonTheme}`);
  if (bp.godDomains?.length) {
    const doms = bp.godDomains.map(g => `${g.domain} (e.g. ${g.exemplars[0]})`).join(', ');
    parts.push(`God domains to draw from: ${doms}`);
  }
  if (bp.factionSlots?.length) {
    const facs = bp.factionSlots.map(f => `${f.type} — ${f.desc}`).join('; ');
    parts.push(`Faction archetypes: ${facs}`);
  }
  if (bp.beatArc?.length) {
    parts.push(`Story arc beats: ${bp.beatArc.join(' → ')}`);
  }
  if (bp.settlementType) parts.push(`Settlement type: ${bp.settlementType}`);
  if (bp.buildingTypes?.length) parts.push(`Key buildings: ${bp.buildingTypes.join(', ')}`);
  if (bp.locationTypes?.length) parts.push(`Nearby landmarks: ${bp.locationTypes.join(', ')}`);
  return parts.join('\n');
}

export function worldSeedConstraints(bp) {
  return bp ? `\n\nUse these creative constraints:\n${blueprintContext(bp)}` : '';
}

export function beatsHints(bp) {
  const arcHint = bp?.beatArc?.length
    ? `\n\nUse this story arc structure: ${bp.beatArc.join(' → ')}. Each beat maps to one step in this arc.`
    : '';
  const factionHint = bp?.factionSlots?.length
    ? `\nTie beats to these faction types: ${bp.factionSlots.map(f => f.type).join(', ')}.`
    : '';
  return arcHint + factionHint;
}

export function factionsHints(bp) {
  return bp?.factionSlots?.length
    ? `\n\nCreate exactly ${bp.factionSlots.length} factions using these archetypes:\n${bp.factionSlots.map((f, i) => `${i + 1}. A "${f.type}" faction (${f.desc})`).join('\n')}\n\nEach faction MUST reference the world's red thread and primary threat.`
    : '';
}

export function regionHints(bp) {
  const climateHint = bp?.climate
    ? `\n\nThe region's climate is: ${bp.climate}. Reflect this in the description, settlement architecture, and hazards.`
    : '';
  const themeHint = bp?.dungeonTheme
    ? `\nThe nearby dungeon should be themed as: ${bp.dungeonTheme}.`
    : '';
  const locationHint = bp?.locationTypes?.length
    ? `\nNearby landmarks include: ${bp.locationTypes.join(', ')}.`
    : '';
  return climateHint + themeHint + locationHint;
}

export function settlementHints(bp) {
  const typeHint = bp?.settlementType
    ? `\n\nThis settlement is a: ${bp.settlementType}. Reflect this in the description and NPC roles.`
    : '';
  const buildingHint = bp?.buildingTypes?.length
    ? `\nKey buildings in this settlement: ${bp.buildingTypes.join(', ')}. NPCs should relate to these.`
    : '';
  const factionHint = bp?.factionSlots?.length
    ? `\nAt least one NPC should be affiliated with one of these factions: ${bp.factionSlots.map(f => f.type).join(', ')}.`
    : '';
  return typeHint + buildingHint + factionHint;
}
