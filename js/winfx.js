// Cascata de vitória — as cartas das bases quicam pela tela (clássico do Windows).
// Módulo independente (sem DOM do jogo): recebe cartas pré-descriadas e retângulos de origem.
// Uso: startCascade({ cards, getOriginRect, onDone }) — cards: [{label, red}],
// getOriginRect(i) → DOMRect da base de onde a carta sai. Toque/clique encerra antes.

export function startCascade({ cards, getOriginRect, onDone }) {
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !cards || cards.length === 0) {
    onDone?.();
    return { stop() {} };
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'cascade-canvas';
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);

  const CW = Math.min(64, Math.max(40, W * 0.06));
  const CH = CW * 1.44;
  const GRAV = 1800; // px/s²
  const SPAWN_DELAY = 0.14; // s entre cartas

  let running = true;
  const flying = [];
  let spawnIdx = 0;
  let spawnTimer = SPAWN_DELAY; // primeira carta imediata

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawCard(c) {
    const { x, y } = c;
    roundRect(x, y, CW, CH, 6);
    g.fillStyle = '#fffdf8';
    g.fill();
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.lineWidth = 1;
    g.stroke();

    g.fillStyle = c.red ? '#c13a47' : '#1f2933';
    g.font = `bold ${Math.round(CW * 0.26)}px Georgia, serif`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(c.label, x + 4, y + 3);
    g.font = `${Math.round(CW * 0.62)}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(c.glyph, x + CW / 2, y + CH * 0.58);
  }

  function spawn() {
    const src = getOriginRect(spawnIdx % 4) || { left: W / 2, top: H / 2 };
    const card = cards[spawnIdx];
    flying.push({
      ...card,
      x: src.left + Math.random() * 8 - 4,
      y: src.top + Math.random() * 8 - 4,
      vx: (Math.random() < 0.5 ? -1 : 1) * (110 + Math.random() * 130),
      vy: -(320 + Math.random() * 200),
    });
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - frame.last) / 1000, 0.05);
    frame.last = now;

    spawnTimer += dt;
    if (spawnIdx < cards.length && spawnTimer >= SPAWN_DELAY) {
      spawn();
      spawnIdx++;
      spawnTimer = 0;
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const c = flying[i];
      c.vy += GRAV * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y > H - CH) {
        c.y = H - CH;
        c.vy = -c.vy;
      }
      drawCard(c);
      if (c.x < -CW * 2 || c.x > W + CW * 2) flying.splice(i, 1);
    }

    if (spawnIdx >= cards.length && flying.length === 0) {
      finish();
      return;
    }
    requestAnimationFrame(frame);
  }

  frame.last = performance.now();
  requestAnimationFrame(frame);

  function finish() {
    if (!running) return;
    running = false;
    canvas.remove();
    onDone?.();
  }

  canvas.addEventListener('click', finish);
  canvas.addEventListener('touchend', finish, { passive: true });

  return { stop: finish };
}
