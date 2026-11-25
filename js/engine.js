// Motor do jogo Paciência (Klondike). Sem dependência de DOM.
// Mantém o estado puro e toda a lógica de regras, busca de jogadas e dicas.

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
export const SUIT_COLOR = ['black', 'red', 'red', 'black'];
export const SUIT_NAME = ['Espadas', 'Copas', 'Ouros', 'Paus'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(rng = Math.random) {
  const deck = [];
  let id = 0;
  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: id++, suit: s, rank: r, faceUp: false });
    }
  }
  return shuffle(deck, rng);
}

export function rankLabel(rank) {
  return ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank];
}

export function newGame(rng = Math.random) {
  const deck = createDeck(rng);
  const tableau = [];
  let pos = 0;
  for (let col = 0; col < 7; col++) {
    const column = [];
    for (let j = 0; j <= col; j++) column.push(deck[pos++]);
    column[column.length - 1].faceUp = true;
    tableau.push(column);
  }
  return {
    stock: deck.slice(pos), // 24 cartas, todas viradas para baixo
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    moves: 0,
  };
}

const topCard = (col) => (col.length ? col[col.length - 1] : null);

// Base vazia só aceita Ás; base preenchida aceita a carta seguinte da sequência
function starter(foundation, card) {
  if (foundation.length === 0) return card.rank === 1;
  return foundation[foundation.length - 1].rank + 1 === card.rank;
}

export function cardName(card) {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`;
}

// Uma pilha com carta do topo `card` (height = stackLen) pode ser empilhada
// em cima da coluna do alvo?
export function canStackOn(card, targetCol, stackLen) {
  const top = topCard(targetCol);
  if (!top) {
    // Coluna vazia só aceita um Rei sozinho
    return stackLen === 1 && card.rank === 13;
  }
  return (
    top.rank - 1 === card.rank &&
    SUIT_COLOR[top.suit] !== SUIT_COLOR[card.suit]
  );
}

export function legalMoves(state) {
  const moves = [];

  // Comprar uma carta do baralho (ou reembaralhar o descarte quando o baralho está vazio)
  if (state.stock.length > 0) {
    moves.push({ type: 'draw' });
  } else if (state.waste.length > 0) {
    moves.push({ type: 'redeal' });
  }

  const wasteTop = topCard(state.waste);
  if (wasteTop) {
    // Base
    const fid = wasteTop.suit;
    const foundation = state.foundations[fid];
    if (starter(foundation, wasteTop)) {
      moves.push({ type: 'foundation', from: 'waste', to: fid });
    }
    // Para coluna de mesa
    for (let c = 0; c < 7; c++) {
      if (canStackOn(wasteTop, state.tableau[c], 1)) {
        moves.push({ type: 'tableau', from: 'waste', to: c });
      }
    }
  }

  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    const first = col.findIndex((card) => card.faceUp);
    if (first === -1) continue;
    for (let i = first; i < col.length; i++) {
      const stack = col.slice(i);
      const top = stack[0];
      // Base (uma carta por vez)
      if (stack.length === 1) {
        const fid = top.suit;
        const foundation = state.foundations[fid];
        if (starter(foundation, top)) {
          moves.push({ type: 'foundation', from: 'tableau', fromCol: c, fromIdx: i, to: fid });
        }
      }
      // Mesa
      for (let d = 0; d < 7; d++) {
        if (d === c) continue;
        if (canStackOn(top, state.tableau[d], stack.length)) {
          moves.push({ type: 'tableau', from: 'tableau', fromCol: c, fromIdx: i, to: d });
        }
      }
    }
  }

  // Puxar de volta a carta do topo de uma base para a mesa
  for (let f = 0; f < 4; f++) {
    const top = topCard(state.foundations[f]);
    if (!top) continue;
    for (let d = 0; d < 7; d++) {
      if (canStackOn(top, state.tableau[d], 1)) {
        moves.push({ type: 'foundationPull', from: f, to: d });
      }
    }
  }

  return moves;
}

export function applyMove(state, move) {
  switch (move.type) {
    case 'draw': {
      const card = state.stock.pop();
      if (card) {
        state.waste.push({ ...card, faceUp: true });
      }
      break;
    }
    case 'redeal': {
      // Devolve o descarte ao baralho (invertido), todas viradas para baixo,
      // mantendo a ordem de desenho original (a primeira compra é a primeira a sair de novo)
      state.stock = state.waste.slice().reverse().map((c) => ({ ...c, faceUp: false }));
      state.waste = [];
      break;
    }
    case 'foundation': {
      let card;
      if (move.from === 'waste') {
        card = state.waste.pop();
      } else {
        const col = state.tableau[move.fromCol];
        [card] = col.splice(move.fromIdx, 1);
        flipNewTop(col);
      }
      state.foundations[move.to].push(card);
      break;
    }
    case 'tableau': {
      if (move.from === 'waste') {
        const card = state.waste.pop();
        state.tableau[move.to].push(card);
      } else {
        const col = state.tableau[move.fromCol];
        const stack = col.splice(move.fromIdx);
        state.tableau[move.to].push(...stack);
        flipNewTop(col);
      }
      break;
    }
    case 'foundationPull': {
      const card = state.foundations[move.from].pop();
      state.tableau[move.to].push(card);
      break;
    }
    default:
      throw new Error(`Movimentação desconhecida: ${move.type}`);
  }
  state.moves++;
  return state;
}

function flipNewTop(col) {
  const card = topCard(col);
  if (card && !card.faceUp) card.faceUp = true;
}

export function gameStatus(state) {
  const onBases = state.foundations.reduce((n, f) => n + f.length, 0);
  if (onBases === 52) return { over: true, won: true, onBases };
  // Puxar de volta da base não conta como jogada para o fim de jogo
  // (senão o jogo nunca terminaria: puxa e devolve em loop)
  const moves = legalMoves(state).filter((m) => m.type !== 'foundationPull');
  if (moves.length === 0) return { over: true, won: false, onBases, legalMoves: 0 };
  return { over: false, won: false, onBases, legalMoves: moves.length };
}

// ------------------------- Sugestão inteligente -------------------------

function scoreMove(move, state) {
  switch (move.type) {
    case 'draw':
      return 1;
    case 'redeal':
      return 2; // só faz sentido quando nada mais existe
    case 'foundation': {
      let s = 200;
      const foundation = state.foundations[move.to];
      const card = move.from === 'waste' ? topCard(state.waste) : state.tableau[move.fromCol][move.fromIdx];
      if (card && card.rank === 1) s += 120; // A é a base de tudo
      if (foundation.length === 12) s += 500; // completa a base
      if (move.from === 'waste') s += 30;
      return s;
    }
    case 'tableau': {
      if (move.from === 'waste') {
        let s = 60;
        if (state.tableau[move.to].length === 0) s += 80;
        return s;
      }
      const fromCol = state.tableau[move.fromCol];
      let s = 50;
      // revela uma carta virada para baixo abaixo da sequência
      const i = move.fromIdx;
      if (i > 0 && !fromCol[i - 1].faceUp) s += 100;
      if (state.tableau[move.to].length === 0) s += 60;
      return s;
    }
    case 'foundationPull':
      // quase nunca é a melhor jogada (abaixo de comprar carta = 1);
      // puxar para coluna vazia (estagiamento) vale mais que puxar para empilhar
      return state.tableau[move.to].length === 0 ? 3 : 0.5;
    default:
      return 0;
  }
}

export function movesFromSelection(state, selection) {
  if (!selection) return legalMoves(state);
  const all = legalMoves(state);
  if (selection.type === 'waste') {
    return all.filter((m) => m.type === 'foundation' && m.from === 'waste')
      .concat(all.filter((m) => m.type === 'tableau' && m.from === 'waste'));
  }
  return all.filter((m) => m.fromCol === selection.col && m.fromIdx === selection.idx);
}

export function bestMove(state, selection) {
  const candidates = movesFromSelection(state, selection);
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestScore = scoreMove(best, state);
  for (const m of candidates) {
    const s = scoreMove(m, state);
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return best;
}

export function describeMove(move, state) {
  switch (move.type) {
    case 'draw':
      return `Compre uma carta (${state.stock.length} restante${state.stock.length === 1 ? '' : 's'})`;
    case 'redeal':
      return `Recoloca o descarte no baralho (${state.waste.length} carta${state.waste.length === 1 ? '' : 's'})`;
    case 'foundation': {
      const card = move.from === 'waste' ? topCard(state.waste) : state.tableau[move.fromCol][move.fromIdx];
      return `Mova ${cardName(card)} para a base (${SUIT_NAME[card.suit]})`;
    }
    case 'tableau': {
      if (move.from === 'waste') {
        const card = topCard(state.waste);
        return `Mova ${cardName(card)} do monte de descarte para a coluna ${columnName(move.to)}`;
      }
      const col = state.tableau[move.fromCol];
      const stack = col.slice(move.fromIdx);
      const first = stack[0];
      if (stack.length === 1) {
        return `Mova ${cardName(first)} para a coluna ${columnName(move.to)}`;
      }
      return `Mova a sequência de ${stack.length} cartas (${cardName(first)}) para a coluna ${columnName(move.to)}`;
    }
    case 'foundationPull': {
      const card = topCard(state.foundations[move.from]);
      return `Puxe ${cardName(card)} da base de volta para a coluna ${columnName(move.to)}`;
    }
    default:
      return '';
  }
}

export function columnName(colIndex) {
  return String.fromCharCode(65 + colIndex); // A..G (colunas 0..6)
}

export function deepClone(state) {
  return JSON.parse(JSON.stringify(state));
}
