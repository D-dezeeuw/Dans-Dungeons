// src/game/dungeon-overlays.js — the client lib's dungeon-theme → creature-pool
// table, re-exported.
//
// This file used to hold its own copy of the 24 themes, justified by "zero
// imports so node tests can load it" — but the justification was about the
// `bag-of-holding` BARE specifier, and a relative path into the vendored
// client has no such problem: node resolves it in tests, and esbuild resolves
// it to the same file as the 'bag-of-holding-client' alias, so the bundle
// carries one table. Two identical 24-theme tables in two repos is exactly the
// kind of silent drift the vendor manifest exists to prevent.
//
// Pools are ordered ascending by challenge (the last entry is the vault boss),
// and every id must exist in BESTIARY — tests/worldgen/bestiary.test.js
// enforces that against this export, i.e. against the real table.

export { DUNGEON_OVERLAYS } from '../../vendor/bag-of-holding-client/index.js';
