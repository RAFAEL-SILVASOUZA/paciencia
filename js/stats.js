// Estatísticas persistidas do jogador (localStorage). Sem dependência de DOM.
// `recordResult` é puro — testável sem navegador.

const KEY = 'paciencia.stats.v1';

export function emptyStats() {
  return {
    played: 0,
    won: 0,
    lost: 0,
    streak: 0,
    bestStreak: 0,
    bestWinMs: null,   // melhor tempo de vitória (menor = melhor)
    bestWinMoves: null, // vitória com menos jogadas
  };
}

function defaultStorage() {
  try {
    const s = window.localStorage;
    return s || null;
  } catch {
    return null;
  }
}

export function loadStats(storage = defaultStorage()) {
  const base = emptyStats();
  if (!storage) return base;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

// Puro: devolve as estatísticas atualizadas sem gravar nada.
export function recordResult(stats, { won, moves, ms }) {
  const next = { ...stats, played: stats.played + 1 };
  if (won) {
    next.won += 1;
    next.streak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    if (next.bestWinMs === null || ms < next.bestWinMs) next.bestWinMs = ms;
    if (next.bestWinMoves === null || moves < next.bestWinMoves) next.bestWinMoves = moves;
  } else {
    next.lost += 1;
    next.streak = 0;
  }
  return next;
}

export function saveStats(stats, storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // armazenamento indisponível: só não persiste
  }
}

// Carrega, registra o resultado da partida e salva; devolve as estatísticas atualizadas.
export function recordGame({ won, moves, ms }, storage = defaultStorage()) {
  const updated = recordResult(loadStats(storage), { won, moves, ms });
  saveStats(updated, storage);
  return updated;
}

export function formatTimeMs(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
