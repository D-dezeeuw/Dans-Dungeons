// src/game/resolver.js — pure D&D rules resolution: no AI calls, no network.
//
// resolveRules() maps a classified intent to mechanical facts (d20, hit/miss,
// damage, movement validation). goblinRetaliates() computes enemy counter-attack.
// commitAll() and appendTranscript() write the resolved state to Spektrum.

import { appState, setValue, addValue } from '../core/state.js';
import { Combat } from './rules.js';
import { plainRoller } from './rng.js';

// ─── Rules resolver ───────────────────────────────────────────────────────────

// `roller` threads the epoch-seeded, audited dice stream (src/game/rng.js)
// through every random roll. It defaults to the plain Math.random roller, so
// callers that don't care about replay-determinism (and direct unit tests) are
// unaffected.
export function resolveRules(classified, roller = plainRoller()) {
  const { record, sheet } = appState.party?.pc ?? {};
  if (!record || !sheet) return { intent: 'impossible', reason: 'No character found' };

  const { intent, target_id: targetId, skill, dc } = classified;

  // ── ATTACK ────────────────────────────────────────────────────────────────
  if (intent === 'attack') {
    const target = appState.world?.npcs?.[targetId];
    if (!target)       return { intent: 'impossible', reason: 'No valid target' };
    if (!target.alive) return { intent: 'impossible', reason: `${target.name} is already dead` };

    const weapon = sheet.attacks?.[0] ?? {
      name:         'unarmed strike',
      attackBonus:  sheet.proficiencyBonus + sheet.abilityScores.mod.str,
      damageDice:   '1d4',
      damageMod:    sheet.abilityScores.mod.str,
      damageType:   'bludgeoning',
    };

    const atk = roller.attack({ attackBonus: weapon.attackBonus, ac: target.ac });

    let damage = 0;
    let targetNewHp = target.hp;
    let targetDead  = false;

    if (atk.hit) {
      const dmg   = roller.damage({
        damageDice: weapon.damageDice,
        damageMod:  weapon.damageMod ?? 0,
        critical:   atk.critical,
      });
      damage      = dmg.total;
      targetNewHp = Math.max(0, target.hp - damage);
      targetDead  = targetNewHp <= 0;
    }

    return {
      intent, targetId, targetName: target.name,
      weaponName: weapon.name,
      d20: atk.d20, totalHit: atk.total, targetAC: target.ac,
      hit: atk.hit, crit: atk.critical, fumble: atk.fumble, damage,
      targetPrevHp: target.hp, targetNewHp, targetDead,
    };
  }

  // ── SKILL CHECK ───────────────────────────────────────────────────────────
  if (intent === 'skill') {
    const skillId  = skill ?? 'perception';
    const skillRow = sheet.skills?.[skillId] ?? sheet.skills?.perception;
    const ability  = skillRow?.ability ?? 'wis';
    const checkDC  = dc ?? 12;
    // Expertise doubles the proficiency portion; abilityCheck takes a flat
    // proficiencyBonus, so pass the doubled value when the skill has expertise.
    const profBonus = skillRow?.proficient ? sheet.proficiencyBonus : 0;
    const check = roller.check({
      abilityScore:     sheet.abilityScores.final[ability],
      proficient:       skillRow?.proficient ?? false,
      proficiencyBonus: skillRow?.expertise ? sheet.proficiencyBonus * 2 : sheet.proficiencyBonus,
      dc:               checkDC,
    });
    const abilMod = sheet.abilityScores.mod[ability] ?? 0;
    return { intent, skill: skillId, ability, d20: check.d20, abilMod, profBonus, total: check.total, dc: check.dc, success: check.success };
  }

  // ── MOVE ──────────────────────────────────────────────────────────────────
  if (intent === 'move') {
    const dir  = classified.direction;
    if (!dir)  return { intent: 'impossible', reason: 'No direction given.' };
    const room = appState.world?.rooms?.[appState.world?.currentRoom];
    const exit = (room?.exits ?? []).find(e => e.dir === dir);
    if (!exit) return { intent: 'impossible', reason: `No exit to the ${dir}.` };
    if (exit.locked) {
      const hasKey = (appState.party?.inventory ?? []).some(i => i.id === exit.keyId);
      if (!hasKey) return { intent: 'impossible', reason: 'The door is locked. You need a key.' };
    }
    const newRoom = appState.world?.rooms?.[exit.roomId];
    return {
      intent: 'move', direction: dir, newRoomId: exit.roomId,
      newRoom: {
        name:        newRoom?.name,
        description: newRoom?.description,
        npcs: Object.values(appState.world?.npcs ?? {})
          .filter(n => n.roomId === exit.roomId && n.alive)
          .map(n => ({ name: n.name, attitude: n.attitude, intro: n.intro })),
        loot: (newRoom?.loot ?? []).filter(i => !i.taken).map(i => ({ name: i.name, description: i.description })),
      },
    };
  }

  // ── TAKE ──────────────────────────────────────────────────────────────────
  if (intent === 'take') {
    const roomId = appState.world?.currentRoom;
    const loot   = (appState.world?.rooms?.[roomId]?.loot ?? []).filter(i => !i.taken);
    const item   = loot.find(i => i.id === targetId) ?? (loot.length === 1 ? loot[0] : null);
    if (!item) return { intent: 'impossible', reason: 'Nothing to take here.' };
    return { intent: 'take', itemId: item.id, itemName: item.name };
  }

  // ── UNLOCK ────────────────────────────────────────────────────────────────
  if (intent === 'unlock') {
    const roomId  = appState.world?.currentRoom;
    const locked  = (appState.world?.rooms?.[roomId]?.exits ?? []).find(e => e.locked);
    if (!locked)  return { intent: 'impossible', reason: 'Nothing to unlock here.' };
    const hasKey  = (appState.party?.inventory ?? []).some(i => i.id === locked.keyId);
    if (!hasKey)  return { intent: 'impossible', reason: "You don't have the right key." };
    return { intent: 'unlock', exitDir: locked.dir, newRoomId: locked.roomId };
  }

  // ── OTHERS ────────────────────────────────────────────────────────────────
  return { intent };
}

// ─── Goblin retaliation ───────────────────────────────────────────────────────

export function goblinRetaliates(roller = plainRoller()) {
  const roomId   = appState.world?.currentRoom;
  const hostiles = Object.values(appState.world?.npcs ?? {})
    .filter(n => n.roomId === roomId && n.alive && n.attitude === 'hostile');
  if (!hostiles.length) return null;

  const goblin = hostiles[0];
  const { record, sheet } = appState.party?.pc ?? {};
  if (!record || !sheet) return null;

  const atk = roller.attack({ attackBonus: goblin.toHit, ac: sheet.ac.value });

  let damage = 0, pcNewHp = record.hpCurrent;
  if (atk.hit) {
    const dmg = roller.damage({
      damageDice: goblin.damageDie,
      damageMod:  goblin.damageBonus,
      critical:   atk.critical,
    });
    damage  = dmg.total;
    pcNewHp = Math.max(0, record.hpCurrent - damage);
  }

  return {
    goblinName: goblin.name,
    d20: atk.d20, totalHit: atk.total, pcAC: sheet.ac.value,
    hit: atk.hit, crit: atk.critical, fumble: atk.fumble, damage,
    pcPrevHp: record.hpCurrent, pcNewHp,
    pcUnconscious: pcNewHp === 0,
  };
}

// ─── Death saves (PC at 0 HP) ──────────────────────────────────────────────────

// True while the PC is downed: at 0 HP and not yet dead. (resolveDownTurn
// tolerates a missing tracker, so we don't require one here.)
export function isPcDown() {
  const r = appState.party?.pc?.record;
  return !!r && (r.hpCurrent ?? 1) <= 0 && !r.deathSaves?.dead;
}

// Resolve one turn while the PC is downed. All math is the vendor's: a hostile
// in the room strikes the helpless PC (SRD: a melee hit on a downed creature is
// an auto-crit = two failed saves), then the PC rolls a death save. Stabilising
// with no hostiles left revives the PC at 1 HP (house rule — the game has no
// healing). Pure: reads appState, mutates nothing.
export function resolveDownTurn(roller = plainRoller()) {
  const { record, sheet } = appState.party.pc;
  let actor = {
    hp:         record.hpCurrent,
    hpMax:      sheet.hp.max,
    deathSaves: record.deathSaves ?? Combat.freshDeathSaves(),
    conditions: record.conditions ?? [],
  };

  const roomId  = appState.world?.currentRoom;
  const hostile = Object.values(appState.world?.npcs ?? {})
    .find(n => n.roomId === roomId && n.alive && n.attitude === 'hostile');

  let strike = null;
  if (hostile) {
    const dmg = roller.damage({ damageDice: hostile.damageDie, damageMod: hostile.damageBonus, critical: true });
    const res = Combat.applyDamageWhileDown(actor, dmg.total, { critical: true, hpMax: actor.hpMax });
    actor = res.actor;
    strike = { by: hostile.name, damage: dmg.total, outcome: res.outcome };
  }

  let save = null;
  if (!actor.deathSaves.dead && !actor.deathSaves.stable) {
    const ds = roller.deathSave(actor);
    actor = ds.actor;
    save = { d20: ds.d20, outcome: ds.outcome };
  }

  // Revive-on-clear: stabilised and no hostiles remain → come to at 1 HP.
  const stillHostile = Object.values(appState.world?.npcs ?? {})
    .some(n => n.roomId === roomId && n.alive && n.attitude === 'hostile');
  let revived = save?.outcome === 'revived';   // natural 20 on the save
  if (actor.deathSaves.stable && !stillHostile) {
    actor = Combat.reviveTo(actor, 1);
    revived = true;
  }

  return {
    intent:     'deathSave',
    strike, save,
    deathSaves: actor.deathSaves,
    hp:         actor.hp,
    conditions: actor.conditions,
    dead:       actor.deathSaves.dead === true,
    revived,
  };
}

// Commit a resolved down-turn to the PC record. Narrow path (party.pc.record)
// so the recorded history entry is the small record object, not the whole party.
export function commitDownTurn(down) {
  const prev = appState.party.pc.record;
  setValue('party.pc.record', { ...prev, hpCurrent: down.hp, deathSaves: down.deathSaves, conditions: down.conditions });
}

// ─── State commits ────────────────────────────────────────────────────────────

export function commitAll(resolved, goblinResult) {
  // Skill cooldowns — tick down every turn, set 3-turn cooldown when skill used
  const prev = appState.session?.skillCooldowns ?? {};
  const cooldowns = {};
  for (const [s, turns] of Object.entries(prev)) {
    if (turns > 1) cooldowns[s] = turns - 1;
  }
  if (resolved.intent === 'skill') cooldowns[resolved.skill] = 3;
  setValue('session.skillCooldowns', cooldowns);

  // Every write below targets the smallest sub-path that actually changes, NOT
  // the whole `world`/`party` object. Spektrum deep-merges sub-path deltas (and
  // replaces arrays), so readers see the full merged map while each recorded
  // history entry stays tiny — keeping saved time-travel history small and fast.
  // (Dungeon ids are dot-free: room-N, boss, enemy-N — safe as path segments.)

  // Movement
  if (resolved.intent === 'move' && resolved.newRoomId) {
    setValue('world.currentRoom', resolved.newRoomId);
  }

  // Item pickup
  if (resolved.intent === 'take') {
    const roomId = appState.world.currentRoom;
    const loot   = appState.world.rooms[roomId].loot;
    const picked = loot.find(i => i.id === resolved.itemId);
    setValue('world.rooms.' + roomId + '.loot', loot.map(i => i.id === resolved.itemId ? { ...i, taken: true } : i));
    setValue('party.inventory', [...(appState.party?.inventory ?? []), picked]);
  }

  // Unlock door
  if (resolved.intent === 'unlock') {
    const roomId = appState.world.currentRoom;
    const exits  = appState.world.rooms[roomId].exits;
    setValue('world.rooms.' + roomId + '.exits', exits.map(e => e.dir === resolved.exitDir ? { ...e, locked: false } : e));
  }

  // NPC state
  if (resolved.intent === 'attack' && resolved.hit) {
    const npc = appState.world?.npcs?.[resolved.targetId];
    setValue('world.npcs.' + resolved.targetId, {
      ...npc,
      hp:       resolved.targetNewHp,
      alive:    !resolved.targetDead,
      attitude: resolved.targetDead ? 'dead' : npc.attitude,
    });
  }

  // PC HP after goblin attack
  if (goblinResult?.hit) {
    const prev = appState.party.pc.record;
    const record = { ...prev, hpCurrent: goblinResult.pcNewHp };
    // On a fresh transition from >0 to 0 HP, (re)initialise the death-save
    // tracker and apply Unconscious so the next turn rolls saves.
    if (goblinResult.pcNewHp <= 0 && (prev.hpCurrent ?? 1) > 0) {
      record.deathSaves = Combat.freshDeathSaves();
      record.conditions = prev.conditions?.includes('unconscious')
        ? prev.conditions
        : [...(prev.conditions ?? []), 'unconscious'];
    }
    setValue('party.pc.record', record);
  }
}

export function appendTranscript(playerText, gmText) {
  const turn = appState.session?.turnCount ?? 0;
  setValue('transcript', [
    ...(appState.transcript ?? []),
    { role: 'player', text: playerText, turn },
    { role: 'gm',     text: gmText,     turn },
  ]);
}
