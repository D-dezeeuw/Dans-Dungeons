// src/game/resolver.js — pure D&D rules resolution: no AI calls, no network.
//
// resolveRules() maps a classified intent to mechanical facts (d20, hit/miss,
// damage, movement validation). goblinRetaliates() computes enemy counter-attack.
// commitAll() and appendTranscript() write the resolved state to Spektrum.

import { appState, setValue, addValue } from '../core/state.js';
import { Combat, Checks } from './rules.js';

// ─── Rules resolver ───────────────────────────────────────────────────────────

export function resolveRules(classified) {
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

    const atk = Combat.attackRoll({ attackBonus: weapon.attackBonus, ac: target.ac });

    let damage = 0;
    let targetNewHp = target.hp;
    let targetDead  = false;

    if (atk.hit) {
      const dmg   = Combat.damageRoll({
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
    const check = Checks.abilityCheck({
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

export function goblinRetaliates() {
  const roomId   = appState.world?.currentRoom;
  const hostiles = Object.values(appState.world?.npcs ?? {})
    .filter(n => n.roomId === roomId && n.alive && n.attitude === 'hostile');
  if (!hostiles.length) return null;

  const goblin = hostiles[0];
  const { record, sheet } = appState.party?.pc ?? {};
  if (!record || !sheet) return null;

  const atk = Combat.attackRoll({ attackBonus: goblin.toHit, ac: sheet.ac.value });

  let damage = 0, pcNewHp = record.hpCurrent;
  if (atk.hit) {
    const dmg = Combat.damageRoll({
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

  // Movement
  if (resolved.intent === 'move' && resolved.newRoomId) {
    setValue('world', { ...appState.world, currentRoom: resolved.newRoomId });
  }

  // Item pickup
  if (resolved.intent === 'take') {
    const roomId  = appState.world.currentRoom;
    const picked  = appState.world.rooms[roomId].loot.find(i => i.id === resolved.itemId);
    const rooms   = { ...appState.world.rooms };
    rooms[roomId] = {
      ...rooms[roomId],
      loot: rooms[roomId].loot.map(i => i.id === resolved.itemId ? { ...i, taken: true } : i),
    };
    setValue('world',  { ...appState.world, rooms });
    setValue('party',  { ...appState.party, inventory: [...(appState.party?.inventory ?? []), picked] });
  }

  // Unlock door
  if (resolved.intent === 'unlock') {
    const roomId  = appState.world.currentRoom;
    const rooms   = { ...appState.world.rooms };
    rooms[roomId] = {
      ...rooms[roomId],
      exits: rooms[roomId].exits.map(e => e.dir === resolved.exitDir ? { ...e, locked: false } : e),
    };
    setValue('world', { ...appState.world, rooms });
  }

  // NPC state
  if (resolved.intent === 'attack' && resolved.hit) {
    const npcs = { ...appState.world?.npcs };
    npcs[resolved.targetId] = {
      ...npcs[resolved.targetId],
      hp:       resolved.targetNewHp,
      alive:    !resolved.targetDead,
      attitude: resolved.targetDead ? 'dead' : npcs[resolved.targetId].attitude,
    };
    setValue('world', { ...appState.world, npcs });
  }

  // PC HP after goblin attack
  if (goblinResult?.hit) {
    setValue('party', {
      ...appState.party,
      pc: {
        ...appState.party.pc,
        record: { ...appState.party.pc.record, hpCurrent: goblinResult.pcNewHp },
      },
    });
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
