import {
  newGame,
  legalMoves,
  applyMove,
  gameStatus,
  bestMove,
  describeMove,
  deepClone,
  rankLabel,
  cardName,
  columnName,
  SUIT_GLYPH,
  SUIT_COLOR,
  SUIT_NAME,
} from './engine.js?v=22';
import { sfx, isSoundEnabled, setSoundEnabled } from './sfx.js?v=22';
import { recordGame, loadStats, formatTimeMs } from './stats.js?v=22';
import { startCascade } from './winfx.js?v=22';
import { icon } from './icons.js?v=22';

const MAX_EXPORTS = 10;
let busy = false; // bloqueia entradas durante a cascata automática
let moveGeneration = 0; // nova partida cancela cascatas em andamento

function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // dispositivo sem vibração
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Estado da aplicação ----------
let state = newGame();
let undoStack = [];
let usedHelp = 0;
let usedUndo = 0;
let startedAt = Date.now();
let finished = false;
let won = false;
let elapsedMs = 0;
let hintTimer = null;
let toastTimer = null;
let confirmNewTimer = null;

// ---------- Referências de DOM ----------
const $ = (sel) => document.querySelector(sel);
const stockBtn = $('#stockBtn');
const wasteEl = $('#wastePile');
const foundationsEl = $('#foundations');
const tableauEl = $('#tableau');
const toastEl = $('#toast');
const overlayEl = $('#overlay');
const overlayIcon = $('#overlayIcon');
const overlayTitle = $('#overlayTitle');
const overlayMsg = $('#overlayMsg');
const overlayStats = $('#overlayStats');
const btnOverlayNew = $('#btnOverlayNew');
const btnOverlayUndo = $('#btnOverlayUndo');
const btnOverlayClose = $('#btnOverlayClose');
const btnHelp = $('#btnHelp');
const btnUndo = $('#btnUndo');
const btnNew = $('#btnNew');
const btnSound = $('#btnSound');
const winChip = $('#winChip');
const winCountEl = $('#winCount');
const overlayRecordText = $('#overlayRecordText');
const helpCountEl = $('#helpCount');
const undoCountEl = $('#undoCount');
const timerEl = $('#timer');
const statusEl = $('#statusLine');

// ---------- Utilidades ----------
function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('show');
  // força reflow para reiniciar a animação
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2300);
}

function clearToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  toastEl.textContent = '';
  toastEl.classList.remove('show');
}

function clearHint() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  document.querySelectorAll('.hint-src, .hint-dst').forEach((el) => {
    el.classList.remove('hint-src', 'hint-dst');
  });
  const bar = $('#hintBar');
  if (bar) {
    bar.classList.remove('show');
    bar.textContent = '';
  }
}

function showHint(move) {
  clearHint();
  let sources = [];
  let targets = [];

  if (move.type === 'draw' || move.type === 'redeal') {
    sources = [stockBtn];
  } else if (move.type === 'foundation') {
    const card = move.from === 'waste' ? state.waste[state.waste.length - 1] : state.tableau[move.fromCol][move.fromIdx];
    if (!card) return;
    if (move.from === 'waste') sources = [wasteEl];
    else sources = [tableauEl.querySelector(`[data-col="${move.fromCol}"] [data-card-idx="${move.fromIdx}"]`)].filter(Boolean);
    targets = [foundationsEl.querySelector(`[data-suit="${move.to}"]`)].filter(Boolean);
  } else if (move.type === 'foundationPull') {
    const card = state.foundations[move.from][state.foundations[move.from].length - 1];
    if (!card) return;
    sources = [foundationsEl.querySelector(`[data-suit="${move.from}"]`)].filter(Boolean);
    targets = [tableauEl.querySelector(`[data-col="${move.to}"]`)].filter(Boolean);
  } else if (move.type === 'tableau') {
    if (move.from === 'waste') {
      sources = [wasteEl];
    } else {
      const el = tableauEl.querySelector(`[data-col="${move.fromCol}"] [data-card-idx="${move.fromIdx}"]`);
      if (el) sources = [el];
    }
    const col = tableauEl.querySelector(`[data-col="${move.to}"]`);
    if (col) targets = [col];
  }

  sources.forEach((el) => el.classList.add('hint-src'));
  targets.forEach((el) => el.classList.add('hint-dst'));

  const srcEl = sources[0];
  if (srcEl && typeof srcEl.scrollIntoView === 'function') {
    srcEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  const text = describeMove(move, state);
  const bar = $('#hintBar');
  bar.textContent = text;
  bar.classList.add('show');

  hintTimer = setTimeout(() => {
    clearHint();
  }, 3600);
}

// ---------- Renderização ----------
function renderBadges() {
  helpCountEl.textContent = `${Math.max(0, MAX_EXPORTS - usedHelp)}`;
  undoCountEl.textContent = `${Math.max(0, MAX_EXPORTS - usedUndo)}`;
  btnHelp.classList.toggle('exhausted', usedHelp >= MAX_EXPORTS);
  btnUndo.classList.toggle('exhausted', usedUndo >= MAX_EXPORTS);
}

function renderSound() {
  const on = isSoundEnabled();
  btnSound.classList.toggle('muted', !on);
  btnSound.innerHTML = `<span class="ic" aria-hidden="true">${icon(on ? 'volume2' : 'volumeX')}</span> ${on ? 'Som' : 'Mudo'}`;
  btnSound.setAttribute('aria-label', on ? 'Desligar o som' : 'Ligar o som');
}

function updateWinChip(stats) {
  const s = stats || loadStats();
  winCountEl.textContent = String(s.won);
  winChip.title = s.played === 0
    ? 'Nenhuma partida registrada ainda'
    : `${s.won} vitória${s.won === 1 ? '' : 's'} em ${s.played} partida${s.played === 1 ? '' : 's'}`;
}

function renderTimer() {
  const elapsed = finished ? elapsedMs : Date.now() - startedAt;
  timerEl.textContent = formatTime(elapsed);
}

function renderStock() {
  const restante = state.stock.length;
  const wasteCount = state.waste.length;
  const btn = stockBtn;
  btn.classList.toggle('empty', restante === 0);
  const podeReembaralhar = restante === 0 && wasteCount > 0;
  btn.setAttribute(
    'aria-label',
    restante > 0
      ? 'Comprar uma carta do baralho'
      : podeReembaralhar
        ? `Reembaralhar o descarte e devolvê-lo ao baralho (${wasteCount} cartas)`
        : 'Baralho vazio'
  );
  btn.innerHTML = `
    <span class="stock-card"></span>
    <span class="stock-count">${restante > 0 ? restante : podeReembaralhar ? `↻${wasteCount}` : '0'}</span>`;
}

function renderWaste() {
  const top = state.waste[state.waste.length - 1];
  wasteEl.innerHTML = '';
  if (top) {
    wasteEl.appendChild(buildCardEl(top, 'waste'));
    wasteEl.classList.add('has-card');
    wasteEl.setAttribute('aria-label', `Monte de descarte: carta ${cardName(top)}`);
  } else {
    wasteEl.classList.remove('has-card');
    wasteEl.innerHTML = '<span class="pile-placeholder">—</span>';
    wasteEl.setAttribute('aria-label', 'Monte de descarte vazio');
  }
}

function foundationsFirstCard(fIdx) {
  return state.foundations[fIdx][state.foundations[fIdx].length - 1] || null;
}

function renderFoundations() {
  foundationsEl.innerHTML = '';
  for (let s = 0; s < 4; s++) {
    const btn = document.createElement('button');
    btn.className = 'foundation';
    btn.type = 'button';
    btn.dataset.suit = String(s);
    const top = foundationsFirstCard(s);
    const count = state.foundations[s].length;
    if (top) {
      btn.appendChild(buildCardEl(top, 'base'));
      btn.classList.add('filled');
      btn.setAttribute('aria-label', `Base ${SUIT_NAME[s]}: ${count} de 13 cartas`);
    } else {
      btn.innerHTML = `<span class="foundation-glyph" aria-hidden="true">${SUIT_GLYPH[s]}</span>`;
      btn.setAttribute('aria-label', `Base ${SUIT_NAME[s]}: vazia`);
    }
    btn.addEventListener('click', () => onFoundationClick(s));
    foundationsEl.appendChild(btn);
  }
}

function buildCardEl(card, area) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.area = area;
  el.dataset.suit = String(card.suit);
  el.dataset.rank = String(card.rank);
  if (area === 'tableau') {
    el.dataset.cardIdx = String(card._index);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  if (card.faceUp) {
    el.classList.add('faceup', SUIT_COLOR[card.suit]);
    el.innerHTML = `
      <span class="corner tl"><b>${rankLabel(card.rank)}</b>${SUIT_GLYPH[card.suit]}</span>
      <span class="glyph" aria-hidden="true">${SUIT_GLYPH[card.suit]}</span>
      <span class="corner br"><b>${rankLabel(card.rank)}</b>${SUIT_GLYPH[card.suit]}</span>`;
    el.setAttribute('aria-label', `Carta ${cardName(card)}`);
  } else {
    el.classList.add('facedown');
    el.setAttribute('aria-label', 'Carta virada para baixo');
  }
  return el;
}

function renderTableau() {
  tableauEl.innerHTML = '';
  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    const colEl = document.createElement('div');
    colEl.className = 'col';
    colEl.dataset.col = String(c);
    colEl.setAttribute('role', 'group');
    colEl.setAttribute('aria-label', `Coluna ${columnName(c)}`);

    if (col.length === 0) {
      const ph = document.createElement('div');
      ph.className = 'col-placeholder';
      ph.setAttribute('aria-hidden', 'true');
      colEl.appendChild(ph);
    }

    for (let i = 0; i < col.length; i++) {
      const card = col[i];
      const cardView = { ...card, _index: i };
      const el = buildCardEl(cardView, 'tableau');
      colEl.appendChild(el);
    }
    tableauEl.appendChild(colEl);
  }
}

function attachTableauEvents() {
  // eventos são delegados uma única vez (ver init); aqui só garantimos a presença
}

function render() {
  renderBadges();
  renderSound();
  renderTimer();
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  renderStatusLine();
}

function renderStatusLine() {
  const s = gameStatus(state);
  if (s.over) {
    statusEl.textContent = s.won ? 'Bases completas — vitória!' : 'Sem jogadas disponíveis';
  } else {
    statusEl.textContent = `${s.legalMoves} ${s.legalMoves === 1 ? 'jogada disponível' : 'jogadas disponíveis'}`;
  }
}

// ---------- Ações ----------
function captureSourceShot(move) {
  if (move.type === 'draw') return null; // sem carta de origem (sai do baralho)
  if (move.type === 'foundationPull') {
    const el = foundationsEl.querySelector(`[data-suit="${move.from}"] .card`);
    return el ? { rect: el.getBoundingClientRect(), clone: el.cloneNode(true) } : null;
  }
  if (move.type === 'redeal' || move.from === 'waste') {
    const el = wasteEl.querySelector('.card');
    return el ? { rect: el.getBoundingClientRect(), clone: el.cloneNode(true) } : null;
  }
  const el = tableauEl.querySelector(`[data-col="${move.fromCol}"] [data-card-idx="${move.fromIdx}"]`);
  return el ? { rect: el.getBoundingClientRect(), clone: el.cloneNode(true) } : null;
}

function playMoveAnimation(move, shot) {
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  if (move.type === 'draw') {
    // o card "sai do baralho" e cai no descarte
    const target = wasteEl.querySelector('.card');
    if (!target) return;
    flyGhost(stockBtn.getBoundingClientRect(), target.getBoundingClientRect(), target.cloneNode(true), target);
    return;
  }

  if (move.type === 'redeal') {
    // o descarte volta para o baralho
    if (!shot || !shot.rect || !shot.clone) return;
    flyGhost(shot.rect, stockBtn.getBoundingClientRect(), shot.clone, null);
    return;
  }

  if (move.type === 'foundation') {
    const fnd = foundationsEl.querySelector(`[data-suit="${move.to}"]`);
    if (!fnd || !shot || !shot.rect || !shot.clone) return;
    const card = fnd.querySelector('.card');
    const targetRect = (card || fnd).getBoundingClientRect();
    flyGhost(shot.rect, targetRect, shot.clone, card);
    return;
  }

  if (move.type === 'foundationPull') {
    const col = tableauEl.querySelector(`[data-col="${move.to}"]`);
    if (!col || !shot || !shot.rect || !shot.clone) return;
    const cards = col.querySelectorAll('.card');
    const target = cards[cards.length - 1] || col;
    flyGhost(shot.rect, target.getBoundingClientRect(), shot.clone, null);
    return;
  }

  if (move.type === 'tableau') {
    const col = tableauEl.querySelector(`[data-col="${move.to}"]`);
    if (!col || !shot || !shot.rect || !shot.clone) return;
    const cards = col.querySelectorAll('.card');
    const target = cards[cards.length - 1];
    if (!target) return;
    flyGhost(shot.rect, target.getBoundingClientRect(), shot.clone, target);
    return;
  }
}

function flyGhost(sourceRect, targetRect, clone, hideEl) {
  if (!sourceRect || !targetRect || !clone) return;
  const ghost = document.createElement('div');
  ghost.className = 'fly-ghost';
  ghost.style.left = `${sourceRect.left}px`;
  ghost.style.top = `${sourceRect.top}px`;
  ghost.style.width = `${targetRect.width}px`;
  ghost.style.height = `${targetRect.height}px`;
  const cloneToUse = clone.cloneNode(true);
  cloneToUse.classList.remove('hint-src', 'hint-dst', 'fly-hidden');
  ghost.appendChild(cloneToUse);
  document.body.appendChild(ghost);
  if (hideEl && hideEl.isConnected) {
    hideEl.classList.add('fly-hidden');
  }
  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px)`;
  });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ghost.remove();
    if (hideEl && hideEl.isConnected) {
      hideEl.classList.remove('fly-hidden');
      hideEl.classList.add('fly-landed');
      setTimeout(() => hideEl.classList.remove('fly-landed'), 220);
    }
  };
  ghost.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 460);
}

function playSfxForMove(move) {
  switch (move.type) {
    case 'draw':
      sfx.draw();
      break;
    case 'redeal':
      sfx.shuffle();
      break;
    case 'foundation':
    case 'tableau':
      sfx.place();
      break;
    default:
      break;
  }
}

// Auto-play: depois que uma carta vai para a base (manual ou automática),
// todas as outras cartas candidatas na mesa/descarte vão sozinhas em cascata.
async function cascadeFoundations(delayMs = 220) {
  const gen = moveGeneration;
  for (let guard = 0; guard < 60; guard++) {
    const move = legalMoves(state).find((m) => m.type === 'foundation');
    if (!move || gen !== moveGeneration) break;
    await sleep(delayMs);
    if (gen !== moveGeneration) break;
    const sourceShot = captureSourceShot(move);
    applyMove(state, move);
    render();
    playMoveAnimation(move, sourceShot);
    sfx.place();
    buzz(10);
  }
}

async function doMove(move) {
  if (finished || busy) return;
  busy = true;
  const gen = moveGeneration;
  const sourceShot = captureSourceShot(move);
  // um único snapshot: desfazer reverte a jogada do usuário + toda a cascata
  undoStack.push(deepClone(state));
  applyMove(state, move);
  clearHint();
  clearToast();
  render();
  playMoveAnimation(move, sourceShot);
  playSfxForMove(move);
  buzz(12);
  if (move.type !== 'foundationPull') {
    // puxar de volta não dispara auto-play (senão a carta voltaria sozinha)
    await cascadeFoundations();
  }
  busy = false;
  if (gen !== moveGeneration) return; // nova partida começou durante a cascata
  const s = gameStatus(state);
  if (s.over) endGame(s);
}

function doDraw() {
  if (busy) return;
  if (finished) {
    toast('Partida encerrada — clique em Nova partida para recomeçar');
    return;
  }
  if (state.stock.length > 0) {
    doMove({ type: 'draw' });
    return;
  }
  // Baralho zerado: recoloca o descarte de volta (se houver)
  if (state.waste.length > 0) {
    doMove({ type: 'redeal' });
    return;
  }
  toast('Baralho vazio');
}

function doUndo() {
  if (busy) return;
  clearHint();
  if (usedUndo >= MAX_EXPORTS) {
    toast(`Sem usos restantes de Voltar (${MAX_EXPORTS} por partida)`);
    return;
  }
  if (undoStack.length === 0) {
    toast('Nada para desfazer');
    return;
  }
  const snap = undoStack.pop();
  state = snap;
  usedUndo++;
  finished = false;
  won = false;
  overlayEl.classList.remove('show');
  overlayEl.setAttribute('hidden', '');
  render();
  sfx.undo();
  buzz(8);
  toast('Jogada desfeita');
}

function doHelp() {
  if (busy || finished) return;
  if (usedHelp >= MAX_EXPORTS) {
    clearHint();
    toast(`Sem usos restantes de Ajuda (${MAX_EXPORTS} por partida)`);
    return;
  }
  const move = bestMove(state, null);
  if (!move) {
    toast('Nenhuma jogada disponível');
    return;
  }
  usedHelp++;
  renderBadges();
  showHint(move);
}

function endGame(s) {
  finished = true;
  won = s.won;
  elapsedMs = Date.now() - startedAt;
  renderStatusLine();
  const stats = recordGame({ won, moves: state.moves, ms: elapsedMs });
  updateWinChip(stats);
  if (won) {
    sfx.win();
    buzz([10, 70, 10, 70, 26]);
    launchWinCascade(stats);
  } else {
    sfx.over();
    buzz([14, 90, 14]);
    setTimeout(showOverlay, 450);
  }
}

function launchWinCascade(stats) {
  // ordem clássica: topo de cada base, uma carta por vez
  const piles = state.foundations.map((p) => p.slice());
  const cards = [];
  for (let r = 0; r < 13; r++) {
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const c = piles[sIdx].pop();
      if (c) {
        cards.push({
          label: cardName(c),
          glyph: SUIT_GLYPH[c.suit],
          red: SUIT_COLOR[c.suit] === 'red',
        });
      }
    }
  }
  const origins = [0, 1, 2, 3].map((sIdx) =>
    foundationsEl.querySelector(`[data-suit="${sIdx}"]`).getBoundingClientRect()
  );
  startCascade({
    cards,
    getOriginRect: (i) => origins[i % 4],
    onDone: showOverlay,
  });
}

function showOverlay() {
  const s = gameStatus(state);
  overlayIcon.innerHTML = icon(won ? 'partyPopper' : 'flag');
  overlayTitle.textContent = won ? 'Vitória!' : 'Fim de jogo';
  overlayMsg.textContent = won
    ? 'Todas as bases foram completadas. Excelente trabalho!'
    : 'Não há mais jogadas disponíveis. Tente uma nova partida.';
  const baseCount = s.onBases;
  overlayStats.innerHTML = `
    <div class="stat"><span class="stat-n">${state.moves}</span><span class="stat-l">jogadas</span></div>
    <div class="stat"><span class="stat-n">${baseCount}/52</span><span class="stat-l">bases</span></div>
    <div class="stat"><span class="stat-n">${formatTime(elapsedMs)}</span><span class="stat-l">tempo</span></div>`;
  const canUndo = usedUndo < MAX_EXPORTS && undoStack.length > 0;
  btnOverlayUndo.style.display = canUndo ? '' : 'none';
  btnOverlayUndo.textContent = `↩ Voltar jogada (${MAX_EXPORTS - usedUndo})`;
  const stats = loadStats();
  if (stats.played > 0) {
    const recorde = stats.bestWinMs !== null
      ? `recorde ${formatTimeMs(stats.bestWinMs)} · ${stats.bestWinMoves} jogadas`
      : 'sem vitória ainda';
    overlayRecordText.textContent = `${stats.won} vitória${stats.won === 1 ? '' : 's'} em ${stats.played} · sequência ${stats.streak} · ${recorde}`;
  } else {
    overlayRecordText.textContent = '';
  }
  overlayEl.classList.add('show');
  overlayEl.removeAttribute('hidden');
}

function hideOverlay() {
  overlayEl.classList.remove('show');
  overlayEl.setAttribute('hidden', '');
}

function doNewGame() {
  moveGeneration++; // cancela cascatas de auto-play em andamento
  busy = false;
  state = newGame();
  undoStack = [];
  usedHelp = 0;
  usedUndo = 0;
  startedAt = Date.now();
  finished = false;
  won = false;
  elapsedMs = 0;
  clearHint();
  hideOverlay();
  disarmNewConfirm();
  render();
  toast('Nova partida iniciada');
}

function disarmNewConfirm() {
  clearTimeout(confirmNewTimer);
  btnNew.classList.remove('armed');
  btnNew.innerHTML = `<span class="ic" aria-hidden="true">${icon('rotateCw')}</span> Nova partida`;
}

// ---------- Interações ----------
function moveSmartForSelection(selection) {
  // Executa a jogada mais inteligente para a carta/pilha selecionada
  const move = bestMove(state, selection);
  if (!move) {
    toast('Sem jogadas para essa carta');
    return false;
  }
  doMove(move);
  return true;
}

function onCardClick(col, idx) {
  if (busy) return;
  if (finished) {
    toast('Partida encerrada — clique em Nova partida para recomeçar');
    return;
  }
  const colState = state.tableau[col];
  const card = colState[idx];
  if (!card || !card.faceUp) return;
  // Click inteligente: move a melhor jogada da carta automaticamente
  moveSmartForSelection({ type: 'tableau', col, idx });
}

function onFoundationClick(suit) {
  if (busy) return;
  if (finished) {
    toast('Partida encerrada — clique em Nova partida para recomeçar');
    return;
  }
  const moves = legalMoves(state)
    .filter((m) => m.type === 'foundation' && m.to === suit)
    // prefere a carta do descarte (mais recente) ao auto-mover
    .sort((a, b) => (a.from === 'waste' ? 0 : 1) - (b.from === 'waste' ? 0 : 1));
  if (moves.length > 0) {
    doMove(moves[0]);
    return;
  }
  // nada pode ir para essa base: puxa de volta a carta do topo (click inteligente,
  // preferindo coluna vazia como estagiamento)
  const pulls = legalMoves(state)
    .filter((m) => m.type === 'foundationPull' && m.from === suit)
    .sort(
      (a, b) =>
        (state.tableau[b.to].length === 0 ? 1 : 0) - (state.tableau[a.to].length === 0 ? 1 : 0)
    );
  if (pulls.length > 0) {
    doMove(pulls[0]);
    return;
  }
  toast(`Nada pode ir para a base de ${SUIT_NAME[suit]} agora`);
}

function onTableauEmptyClick(col) {
  if (busy) return;
  if (finished) {
    toast('Partida encerrada — clique em Nova partida para recomeçar');
    return;
  }
  // auto-move: tenta auto-mover o Rei (do descarte ou da mesa)
  const moves = legalMoves(state)
    .filter((m) => m.type === 'tableau' && m.to === col)
    // prefere o Rei do descarte (mais recente)
    .sort((a, b) => (a.from === 'waste' ? 0 : 1) - (b.from === 'waste' ? 0 : 1));
  if (moves.length > 0) {
    doMove(moves[0]);
    return;
  }
  toast('Coluna vazia só aceita um Rei sozinho');
}

function onWasteClick() {
  if (busy) return;
  if (finished) {
    toast('Partida encerrada — clique em Nova partida para recomeçar');
    return;
  }
  if (state.waste.length === 0) return;
  // Click inteligente: move a melhor jogada do descarte automaticamente
  moveSmartForSelection({ type: 'waste' });
}

// ---------- Orientação paisagem ----------
function requestLandscapeOrientation() {
  const touchDevice = navigator.maxTouchPoints > 0;
  if (!touchDevice || !(screen.orientation && screen.orientation.lock)) return;
  try {
    screen.orientation.lock('landscape').catch(() => {
      // algumas plataformas não permitem travar a orientação; sem dano
    });
  } catch { /* ambiente não suporta */ }
}

function initRotateDismiss() {
  const btn = document.getElementById('btnRotateDismiss');
  const hint = document.getElementById('rotateHint');
  if (!btn || !hint) return;
  btn.addEventListener('click', () => {
    hint.style.display = 'none';
  });
}

// ---------- Eventos ----------
function initEvents() {
  stockBtn.addEventListener('click', doDraw);
  wasteEl.addEventListener('click', onWasteClick);
  wasteEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onWasteClick();
    }
  });

  tableauEl.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) {
      const col = +card.closest('.col').dataset.col;
      const idx = +card.dataset.cardIdx;
      onCardClick(col, idx);
      return;
    }
    const colEl = e.target.closest('.col');
    if (colEl) {
      onTableauEmptyClick(+colEl.dataset.col);
    }
  });

  tableauEl.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const col = +card.closest('.col').dataset.col;
      const idx = +card.dataset.cardIdx;
      onCardClick(col, idx);
    }
  });

  btnHelp.addEventListener('click', doHelp);
  btnUndo.addEventListener('click', doUndo);
  btnNew.addEventListener('click', () => {
    if (confirmNewTimer) {
      doNewGame();
      return;
    }
    btnNew.classList.add('armed');
    btnNew.innerHTML = `<span class="ic" aria-hidden="true">${icon('triangleAlert')}</span> Confirmar?`;
    confirmNewTimer = setTimeout(disarmNewConfirm, 2600);
  });

  btnOverlayNew.addEventListener('click', doNewGame);
  btnOverlayClose.addEventListener('click', hideOverlay);
  btnOverlayUndo.addEventListener('click', () => {
    doUndo();
  });

  btnSound.addEventListener('click', () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    renderSound();
    if (next) sfx.place();
    buzz(8);
  });

  initRotateDismiss();
}

// ---------- Ciclo ----------
function init() {
  initEvents();
  render();
  updateWinChip();
  requestLandscapeOrientation();

  setInterval(() => {
    if (!finished) renderTimer();
  }, 1000);

  // Registra o service worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service worker não registrado:', err);
    });
  }
}

init();
