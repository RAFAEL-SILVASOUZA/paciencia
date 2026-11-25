import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyStats,
  loadStats,
  recordResult,
  saveStats,
  recordGame,
  formatTimeMs,
} from '../js/stats.js';

class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

test('loadStats com storage vazio devolve estatísticas zeradas', () => {
  const s = loadStats(new FakeStorage());
  assert.deepEqual(s, emptyStats());
  assert.equal(s.played, 0);
  assert.equal(s.won, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.bestWinMs, null);
  assert.equal(s.bestWinMoves, null);
});

test('loadStats sem storage nenhum (navegador sem localStorage) não lança', () => {
  const s = loadStats(null);
  assert.deepEqual(s, emptyStats());
});

test('recordResult: vitória incrementa vitórias e sequência, gravando recordes', () => {
  let s = emptyStats();
  s = recordResult(s, { won: true, moves: 120, ms: 300000 });
  assert.equal(s.played, 1);
  assert.equal(s.won, 1);
  assert.equal(s.lost, 0);
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 1);
  assert.equal(s.bestWinMs, 300000);
  assert.equal(s.bestWinMoves, 120);
  // vitória melhor: atualiza os recordes
  s = recordResult(s, { won: true, moves: 90, ms: 200000 });
  assert.equal(s.won, 2);
  assert.equal(s.streak, 2);
  assert.equal(s.bestWinMs, 200000);
  assert.equal(s.bestWinMoves, 90);
  // vitória pior: mantém os recordes
  s = recordResult(s, { won: true, moves: 150, ms: 400000 });
  assert.equal(s.won, 3);
  assert.equal(s.bestWinMs, 200000);
  assert.equal(s.bestWinMoves, 90);
});

test('recordResult: derrota zera a sequência e não mexe em recordes', () => {
  let s = emptyStats();
  s = recordResult(s, { won: true, moves: 100, ms: 250000 });
  s = recordResult(s, { won: false, moves: 200, ms: 500000 });
  assert.equal(s.played, 2);
  assert.equal(s.won, 1);
  assert.equal(s.lost, 1);
  assert.equal(s.streak, 0);
  assert.equal(s.bestStreak, 1);
  assert.equal(s.bestWinMs, 250000);
  assert.equal(s.bestWinMoves, 100);
});

test('recordResult é puro: não altera o objeto original', () => {
  const original = emptyStats();
  const next = recordResult(original, { won: true, moves: 50, ms: 60000 });
  assert.equal(original.played, 0);
  assert.equal(next.played, 1);
  assert.notEqual(next, original);
});

test('recordGame grava e recarrega pelo mesmo storage', () => {
  const storage = new FakeStorage();
  const s1 = recordGame({ won: true, moves: 80, ms: 180000 }, storage);
  assert.equal(s1.won, 1);
  const s2 = loadStats(storage);
  assert.deepEqual(s2, s1);
  assert.equal(s2.bestWinMs, 180000);
  const s3 = recordGame({ won: false, moves: 300, ms: 900000 }, storage);
  assert.equal(s3.won, 1);
  assert.equal(s3.played, 2);
  assert.equal(s3.streak, 0);
  assert.deepEqual(loadStats(storage), s3);
});

test('recordGame tolera JSON corrompido no storage', () => {
  const storage = new FakeStorage();
  storage.setItem('paciencia.stats.v1', '{não é json');
  const s = recordGame({ won: true, moves: 40, ms: 90000 }, storage);
  assert.equal(s.won, 1);
  assert.equal(s.played, 1);
});

test('formatTimeMs formata minutos e segundos', () => {
  assert.equal(formatTimeMs(0), '0:00');
  assert.equal(formatTimeMs(59000), '0:59');
  assert.equal(formatTimeMs(60000), '1:00');
  assert.equal(formatTimeMs(185000), '3:05');
});
