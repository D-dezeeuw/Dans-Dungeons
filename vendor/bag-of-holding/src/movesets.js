/**
 * Return the set of legal action chips for a (pc, scene) pair. The
 * engine produces structured chips; the app's UI decides whether to
 * render them, hide them in favour of free-text, or surface them
 * inline as part of Nerd mode.
 *
 * The cost vocabulary (`free | action | bonus | reaction`) matches
 * SRD action types — "free" covers both speak-as-free and
 * look-around-as-free, which the SRD treats as the same category.
 *
 * Since 0.6.0 the provider dispatches over the PC's class. Each
 * class registers its signature class-feature chips (Rage,
 * Bardic Inspiration, Cunning Action, …) keyed by level and an
 * optional scene predicate. Anything not class-specific (talk,
 * look, basic move/attack) lands in the base set.
 */
export function legal({ pc, scene }) {
  // Condition-aware (since 0.7.0): incapacitating conditions
  // collapse the moveset to a single "wait" affordance; prone
  // replaces the chip set with "stand up".
  const blockers = incapacitatingConditions(pc);
  if (blockers.length > 0) return incapacitatedActions(blockers);
  if (Array.isArray(pc?.conditions) && pc.conditions.includes('prone')) {
    return [
      { id: 'talk',     label: 'Free-form dialogue',         cost: 'free' },
      { id: 'look',     label: 'Look around',                cost: 'free' },
      { id: 'stand-up', label: 'Stand up (half movement)',   cost: 'movement' }
    ];
  }

  const actions = baseActions(scene);
  const provider = CLASS_PROVIDERS[pc?.classId];
  const level = pc?.level ?? 0;
  if (provider) {
    for (const chip of provider) {
      if (level >= chip.minLevel && chipApplies(chip, scene)) {
        actions.push({ id: chip.id, label: chip.label, cost: chip.cost });
      }
    }
  }
  return actions;
}

const INCAPACITATING = new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']);

function incapacitatingConditions(pc) {
  const list = pc?.conditions ?? [];
  return list.filter((c) => INCAPACITATING.has(c));
}

function incapacitatedActions(blockers) {
  return [{ id: 'wait', label: `Incapacitated (${blockers.join(', ')})`, cost: 'free' }];
}

function baseActions(scene) {
  const actions = [
    { id: 'talk', label: 'Free-form dialogue', cost: 'free' },
    { id: 'look', label: 'Look around', cost: 'free' }
  ];
  if (scene?.mode === 'combat') {
    actions.push({ id: 'attack.melee', label: 'Melee attack', cost: 'action' });
    actions.push({ id: 'move.disengage', label: 'Disengage', cost: 'action' });
    actions.push({ id: 'move.dash', label: 'Dash', cost: 'action' });
  } else {
    actions.push({ id: 'move', label: 'Move to another location', cost: 'free' });
  }
  return actions;
}

// Each chip declares `combatOnly?: boolean` — if true and the scene
// isn't combat, the chip is skipped. Default is "always visible at
// or above its minLevel".
function chipApplies(chip, scene) {
  if (chip.combatOnly && scene?.mode !== 'combat') return false;
  return true;
}

const CLASS_PROVIDERS = {
  fighter: [
    { minLevel: 1, id: 'fighter.second-wind', label: 'Second Wind', cost: 'bonus', combatOnly: true },
    { minLevel: 2, id: 'fighter.action-surge', label: 'Action Surge', cost: 'free', combatOnly: true }
  ],
  rogue: [
    { minLevel: 2, id: 'rogue.cunning-action.dash',      label: 'Cunning Action (Dash)',      cost: 'bonus', combatOnly: true },
    { minLevel: 2, id: 'rogue.cunning-action.disengage', label: 'Cunning Action (Disengage)', cost: 'bonus', combatOnly: true },
    { minLevel: 2, id: 'rogue.cunning-action.hide',      label: 'Cunning Action (Hide)',      cost: 'bonus', combatOnly: true }
  ],
  barbarian: [
    { minLevel: 1, id: 'barbarian.rage',             label: 'Rage',             cost: 'bonus', combatOnly: true },
    { minLevel: 2, id: 'barbarian.reckless-attack',  label: 'Reckless Attack',  cost: 'free',  combatOnly: true }
  ],
  bard: [
    { minLevel: 1, id: 'bard.bardic-inspiration', label: 'Bardic Inspiration', cost: 'bonus' }
  ],
  cleric: [
    { minLevel: 2, id: 'cleric.channel-divinity', label: 'Channel Divinity', cost: 'action' }
  ],
  druid: [
    { minLevel: 2, id: 'druid.wild-shape', label: 'Wild Shape', cost: 'action', combatOnly: true }
  ],
  monk: [
    { minLevel: 1, id: 'monk.martial-arts',     label: 'Martial Arts (unarmed strike)', cost: 'bonus', combatOnly: true },
    { minLevel: 5, id: 'monk.stunning-strike',  label: 'Stunning Strike',               cost: 'free',  combatOnly: true }
  ],
  paladin: [
    { minLevel: 1, id: 'paladin.lay-on-hands',  label: 'Lay on Hands',                cost: 'bonus' },
    { minLevel: 2, id: 'paladin.divine-smite',  label: 'Divine Smite (spend a slot)', cost: 'free', combatOnly: true }
  ],
  ranger: [
    { minLevel: 1, id: 'ranger.favored-enemy', label: 'Recall lore (Favored Enemy)', cost: 'free' }
  ],
  sorcerer: [
    { minLevel: 2, id: 'sorcerer.font-of-magic', label: 'Convert sorcery points ↔ slots', cost: 'bonus' }
  ],
  warlock: [
    { minLevel: 1, id: 'warlock.eldritch-blast', label: 'Eldritch Blast', cost: 'action', combatOnly: true }
  ],
  wizard: [
    { minLevel: 1, id: 'wizard.arcane-recovery', label: 'Arcane Recovery (during short rest)', cost: 'free' }
  ]
};
