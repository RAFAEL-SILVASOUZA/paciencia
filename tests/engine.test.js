import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame,
  legalMoves,
  applyMove,
  gameStatus,
  bestMove,
  describeMove,
  movesFromSelection,
  cardName,
  columnName,
  rankLabel,
  SUIT_GLYPH,
  mulberry32,
} from '../js/engine.js';

let uid = 1000;
function card(suit, rank, faceUp = true) {
  return { id: uid++, suit, rank, faceUp };
}

function baseState() {
  return {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    moves: 0,
  };
}

test('newGame reparte 24 cartas para o baralho e 28 para a mesa', () => {
  const s = newGame(mulberry32(42));
  const total = s.tableau.reduce((n, c) => n + c.length, 0);
  assert.equal(total, 28);
  assert.equal(s.stock.length, 24);
  assert.equal(s.waste.length, 0);
  assert.equal(s.foundations.reduce((n, f) => n + f.length, 0), 0);
  s.tableau.forEach((col, i) => {
    assert.equal(col.length, i + 1);
    assert.equal(col[col.length - 1].faceUp, true);
    for (let j = 0; j < col.length - 1; j++) assert.equal(col[j].faceUp, false);
  });
});

test('newGame não repete cartas (52 únicas no baralho)', () => {
  const s = newGame(mulberry32(7));
  const ids = new Set();
  for (const col of s.tableau) for (const c of col) {
    assert.ok(!ids.has(c.id)); ids.add(c.id);
  }
  for (const c of s.stock) {
    assert.ok(!ids.has(c.id)); ids.add(c.id);
  }
  assert.equal(ids.size, 52);
});

test('legalMoves inclui compra do baralho quando há cartas', () => {
  const s = baseState();
  s.stock = [card(0, 5, false), card(1, 9, false)];
  const moves = legalMoves(s);
  assert.ok(moves.some((m) => m.type === 'draw'));
});

test('legalMoves aponta a movimentação válida para mesa vazia (Rei)', () => {
  const s = baseState();
  s.tableau[0] = [card(0, 13)]; // Rei espadas
  const moves = legalMoves(s);
  assert.ok(moves.some((m) => m.type === 'tableau' && m.from === 'tableau' && m.fromCol === 0 && m.to === 1));
});

test('legalMoves aponta movimentação válida para a base (Ás)', () => {
  const s = baseState();
  s.tableau[0] = [card(1, 1)]; // Ás de copas
  const moves = legalMoves(s);
  assert.ok(moves.some((m) => m.type === 'foundation' && m.fromCol === 0 && m.to === 1));
});

test('legalMoves de uma coluna vazia não aceita carta que não seja Rei', () => {
  const s = baseState();
  s.tableau[0] = [card(0, 12)]; // Dama
  const moves = legalMoves(s);
  assert.ok(!moves.some((m) => m.type === 'tableau' && m.from === 'tableau' && m.fromCol === 0 && m.to === 1));
});

test('applyMove: compra cartas uma por uma', () => {
  const s = baseState();
  s.stock = [card(0, 5, false), card(1, 9, false)];
  const drawn = applyMove(s, { type: 'draw' });
  assert.equal(s.stock.length, 1);
  assert.equal(s.waste.length, 1);
  assert.equal(s.waste[0].faceUp, true);
  assert.equal(s.moves, 1);
  assert.deepEqual(drawn, s);
});

test('applyMove: mover do descarte para a mesa', () => {
  const s = baseState();
  s.tableau[0] = [card(0, 13)]; // Rei espadas (mesa)
  s.tableau[1] = [card(2, 4, false), card(2, 3, true)]; // 4♦ escondido, 3♦ acima
  s.waste = [card(3, 2)]; // 2♣ preto — 3♦ vermelho: é legal empilhar 2♣ sob 3♦
  const moves = legalMoves(s);
  const mov = moves.find((m) => m.type === 'tableau' && m.from === 'waste' && m.to === 1);
  assert.ok(mov, 'deveria haver movimento de descarte para coluna 1');
  applyMove(s, mov);
  assert.equal(s.waste.length, 0);
  assert.equal(s.tableau[1].length, 3);
  assert.equal(s.tableau[1][2].rank, 2);
});

test('applyMove: mover da mesa vira a carta escondida', () => {
  const s = baseState();
  s.tableau[0] = [card(1, 9, false), card(0, 8, true)]; // 9♥ escondida, 8♠ acima
  s.tableau[1] = [card(1, 9, true)]; // 9♥ acima — 8♠ (preto) sobre 9♥ (vermelho) é legal
  const moves = legalMoves(s);
  const mov = moves.find((m) => m.type === 'tableau' && m.from === 'tableau' && m.fromCol === 0 && m.to === 1);
  assert.ok(mov, 'deveria haver movimento de mesa para coluna 1');
  applyMove(s, mov);
  assert.equal(s.tableau[0].length, 1);
  assert.equal(s.tableau[0][0].faceUp, true, 'a carta escondida deve virar para cima');
  assert.equal(s.tableau[1].length, 2);
});

test('applyMove: mover da mesa ara base e vira a carta escondida', () => {
  const s = baseState();
  s.tableau[0] = [card(0, 5, false), card(1, 1, true)]; // escondida + Ás de copas
  const moves = legalMoves(s);
  const mov = moves.find((m) => m.type === 'foundation' && m.fromCol === 0);
  assert.ok(mov);
  applyMove(s, mov);
  assert.equal(s.foundations[1].length, 1);
  assert.equal(s.foundations[1][0].rank, 1);
  assert.equal(s.tableau[0].length, 1);
  assert.equal(s.tableau[0][0].faceUp, true, 'a carta escondida deve virar para cima');
});

test('gameStatus retorna vitória quando as bases estão completas', () => {
  const s = baseState();
  for (let suit = 0; suit < 4; suit++) {
    for (let r = 1; r <= 13; r++) s.foundations[suit].push(card(suit, r, true));
  }
  const st = gameStatus(s);
  assert.equal(st.over, true);
  assert.equal(st.won, true);
});

test('gameStatus retorna fim de jogo quando não há jogadas', () => {
  const s = baseState();
  // 7 colunas preenchidas com Reis; sem colunar vazia; bases vazias; baralho vazio
  s.tableau = [
    [card(0, 13)], [card(1, 13)], [card(2, 13)], [card(3, 13)],
    [card(0, 13)], [card(1, 13)], [card(2, 13)],
  ];
  const st = gameStatus(s);
  assert.equal(st.over, true);
  assert.equal(st.won, false);
});

test('gameStatus não termina enquanto há movimentações', () => {
  const s = baseState();
  s.tableau[0] = [card(0, 13)]; // Rei para coluna vazia
  const st = gameStatus(s);
  assert.equal(st.over, false);
  assert.ok(st.legalMoves >= 1);
});

test('bestMove recomenda a base para Ás no descarte', () => {
  const s = baseState();
  s.waste = [card(1, 1)]; // Ás copas
  const m = bestMove(s, { type: 'waste' });
  assert.equal(m.type, 'foundation');
  assert.equal(m.to, 1);
});

test('bestMove recomenda compra quando só há baralho', () => {
  const s = baseState();
  s.stock = [card(0, 5, false)];
  const m = bestMove(s, null);
  assert.equal(m.type, 'draw');
});

test('bestMove prefere comprar a puxar da base (quebra o loop indo-e-voltando)', () => {
  const s = baseState();
  s.stock = [card(0, 5, false)];
  s.foundations[0] = [card(0, 13)]; // K♠ na base
  s.tableau[1] = []; // coluna vazia: puxar K teria sido sugerido antes
  const m = bestMove(s, null);
  assert.equal(m.type, 'draw');
});

test('bestMove prefere reembaralhar a puxar da base', () => {
  const s = baseState();
  s.waste = [card(0, 5)];
  s.foundations[0] = [card(0, 13)]; // K♠ na base
  s.tableau[1] = []; // coluna vazia
  const m = bestMove(s, null);
  assert.equal(m.type, 'redeal');
});

test('bestMove só sugere puxar da base quando não há compra nem reembaralho', () => {
  const s = baseState();
  s.foundations[0] = [card(0, 13)]; // K♠ na base
  // sem baralho nem descarte: o jogo já terminaria (travado),
  // mas a dica ainda aponta o puxar como último recurso
  const m = bestMove(s, null);
  assert.equal(m.type, 'foundationPull');
  assert.equal(s.tableau[m.to].length, 0); // alvo é uma coluna vazia
});

test('movesFromSelection filtra por seleção de descarte', () => {
  const s = baseState();
  s.waste = [card(3, 5)]; // 5♣ preto
  s.tableau[0] = [card(0, 6)]; // 6♠ preto
  const moves = movesFromSelection(s, { type: 'waste' });
  // 5♣ sobre 6♠ não é legal (mesma cor); a seleção de descarte não deve aparecer
  assert.ok(!moves.some((m) => m.type === 'tableau' && m.to === 0));
});

test('redeal: baralho vazio + descarte não vazio oferece reembaralhar', () => {
  const s = baseState();
  s.waste = [card(0, 5), card(1, 9)]; // 5♠ preto, 9♥ vermelho (topo)
  const moves = legalMoves(s);
  assert.ok(moves.some((m) => m.type === 'redeal'));
});

test('redeal: devolve o descarte ao baralho (invertido, viradas para baixo)', () => {
  const s = baseState();
  const a = card(2, 7);  // primeiro comprado (base do descarte)
  const b = card(1, 2);  // segundo comprado (topo do descarte)
  s.waste = [a, b];
  const moves = legalMoves(s);
  const redeal = moves.find((m) => m.type === 'redeal');
  applyMove(s, redeal);
  // primeiro comprado volta ao topo do baralho (sairá primeiro)
  assert.deepEqual(s.stock.map((c) => c.rank).sort(), [2, 7]);
  assert.equal(s.stock[s.stock.length - 1].rank, 7);
  assert.equal(s.waste.length, 0);
  assert.equal(s.stock.every((c) => c.faceUp === false), true);
  assert.equal(s.moves, 1);
});

test('redeal: não aparece quando o baralho ainda tem cartas', () => {
  const s = baseState();
  s.stock = [card(0, 5, false)];
  s.waste = [card(1, 9)];
  const moves = legalMoves(s);
  assert.ok(!moves.some((m) => m.type === 'redeal'));
  assert.ok(moves.some((m) => m.type === 'draw'));
});

test('describeMove do redeal menciona o descarte', () => {
  const s = baseState();
  s.waste = [card(0, 5), card(1, 9), card(2, 1)];
  const t = describeMove({ type: 'redeal' }, s);
  assert.match(t, /descarte/i);
  assert.match(t, /3 cart/);
});

test('describeMove produz texto em português', () => {
  const s = baseState();
  s.waste = [card(1, 1)]; // Ás copas
  const m = bestMove(s, { type: 'waste' });
  const t = describeMove(m, s);
  assert.match(t, /A♥/);
  assert.match(t, /base/);
});

test('rankLabel, cardName, columnName', () => {
  assert.equal(rankLabel(1), 'A');
  assert.equal(rankLabel(10), '10');
  assert.equal(rankLabel(13), 'K');
  assert.equal(cardName(card(1, 1)), 'A♥');
  assert.equal(columnName(0), 'A');
  assert.equal(columnName(6), 'G');
  assert.equal(SUIT_GLYPH[2], '♦');
});

test('foundationPull: topo da base pode voltar para coluna vazia (Rei)', () => {
  const s = baseState();
  s.foundations[0] = [card(0, 13)]; // K♠ na base
  const moves = legalMoves(s);
  const pull = moves.find((m) => m.type === 'foundationPull' && m.from === 0 && m.to === 1);
  assert.ok(pull, 'K♠ deveria poder voltar para a coluna vazia B');
});

test('foundationPull: topo da base pode voltar empilhando (cor alternada)', () => {
  const s = baseState();
  s.foundations[0] = [card(0, 1)]; // A♠ na base
  s.tableau[0] = [card(1, 2)]; // 2♥ na mesa: A♠ (preto) sobre 2♥ (vermelho) é legal
  const moves = legalMoves(s);
  assert.ok(moves.some((m) => m.type === 'foundationPull' && m.from === 0 && m.to === 0));
});

test('foundationPull: não é legal quando nenhuma coluna aceita', () => {
  const s = baseState();
  s.foundations[0] = [card(0, 1)]; // A♠ não empilha em coluna sem 2
  s.tableau[0] = [card(1, 13)]; // K♥
  const moves = legalMoves(s);
  assert.ok(!moves.some((m) => m.type === 'foundationPull' && m.from === 0));
});

test('applyMove: foundationPull move a carta da base para a mesa', () => {
  const s = baseState();
  s.foundations[1] = [card(1, 1)]; // A♥ na base
  s.tableau[0] = [card(0, 2)]; // 2♠ na mesa: A♥ (vermelho) sobre 2♠ (preto) é legal
  const moves = legalMoves(s);
  const pull = moves.find((m) => m.type === 'foundationPull' && m.from === 1 && m.to === 0);
  assert.ok(pull);
  applyMove(s, pull);
  assert.equal(s.foundations[1].length, 0);
  assert.equal(s.tableau[0].length, 2);
  assert.equal(s.tableau[0][1].rank, 1);
  assert.equal(s.moves, 1);
});

test('gameStatus ignora foundationPull: só puxar de volta não evita o fim de jogo', () => {
  const s = baseState();
  // K♠ na base e coluna A vazia: a única saída seria puxá-lo de volta,
  // mas isso não conta como jogada (senão puxa e devolve em loop).
  // Nenhum rei está acessível na mesa (enterrados) e todas as cartas
  // expostas são pretas — nada empilha, nada vai para a base, baralho vazio.
  s.foundations[0] = [card(0, 13)];
  s.tableau = [
    [],
    [card(1, 13, false), card(0, 12, true)], // K♥ enterrado, Q♠ exposta
    [card(2, 13, false), card(0, 11, true)], // K♦ enterrado, J♠ exposta
    [card(3, 13, false), card(0, 10, true)], // K♣ enterrado, 10♠ exposta
    [card(0, 9, true)],  // 9♠
    [card(3, 12, true)], // Q♣
    [card(3, 11, true)], // J♣
  ];
  assert.ok(legalMoves(s).some((m) => m.type === 'foundationPull'), 'puxar deveria existir');
  const st = gameStatus(s);
  assert.equal(st.over, true);
  assert.equal(st.won, false);
  assert.equal(st.legalMoves, 0);
});

test('gameStatus conta jogadas reais além do puxar de volta', () => {
  const s = baseState();
  s.foundations[0] = [card(0, 13)]; // K♠ na base
  s.tableau[1] = [card(0, 10)]; // 10♠
  s.waste = [card(1, 9)]; // 9♥: jogada real (empilha na 10♠) + puxar K♠ para coluna vazia
  const st = gameStatus(s);
  assert.equal(st.over, false);
  assert.ok(st.legalMoves >= 1);
});
