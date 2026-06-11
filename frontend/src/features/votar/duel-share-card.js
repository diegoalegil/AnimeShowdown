/**
 * ShareCard de duelo 1v1 (1080×1080).
 *
 * Pintor de <canvas> puro, mismo patrón que features/miTop5/CanvasPreview.jsx:
 * NO rasteriza DOM (nada de html-to-image). Exporta:
 *
 *   drawDuelShareCard(ctx, duel, { images, layout, theme })
 *   loadDuelImages(duel)   → precarga el arte con CORS; null ⇒ placeholder
 *   resolveDuelTheme(el)   → lee los tokens en runtime desde las variables CSS
 *                            (--color-*, --font-jp). Cero hex literales en este
 *                            archivo: pasa el guard de CI tal cual.
 *
 * duel = {
 *   left:  { name, anime, image },   // image: /img/<Anime>/<slug>-600.webp
 *   right: { name, anime, image },
 *   leftPct: 62,                     // rightPct = 100 − leftPct
 * }
 *
 * El ganador se deriva del % (>50). Con 50/50 no hay oro para nadie.
 * layout: 'diagonal' (por defecto) | 'frontal'
 *
 * Integración: pintar en un canvas offscreen 1080×1080 desde
 * VoteResultPanel.jsx → canvas.toBlob() → useVotarShare (lib/share.ts).
 * El rombo de oro del pie es un stand-in del logo: sustituir por el asset
 * real del banco de marca cuando esté cargado como Image.
 */

export const DUEL_CARD_SIZE = 1080;

const FONT_SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_MONO = '"SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';

/* ------------------------------------------------ tokens ---- */

export function resolveDuelTheme(el) {
  const doc = (el && el.ownerDocument) || document;
  const css = getComputedStyle(doc.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  return {
    bg: v('--color-bg'),
    surface: v('--color-surface'),
    accent: v('--color-accent'),
    gold: v('--color-gold'),
    electric: v('--color-electric'),
    // Tokens reales del tema: fg/fg-muted (no existen --color-text/-muted).
    text: v('--color-fg'),
    muted: v('--color-fg-muted'),
    fontJp: v('--font-jp') || 'serif',
  };
}

/* ------------------------------------------------ helpers ---- */

function parseColor(c) {
  c = String(c || '').trim();
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0] || 0, p[1] || 0, p[2] || 0];
  }
  return [128, 128, 128];
}

const withAlpha = (c, a) => {
  const [r, g, b] = parseColor(c);
  return `rgba(${r},${g},${b},${a})`;
};

const mix = (c1, c2, t) => {
  const a = parseColor(c1), b = parseColor(c2);
  const f = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${f(0)},${f(1)},${f(2)})`;
};

export const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rr(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, weight, family, size, maxW, minSize) {
  let s = size;
  while (s > minSize) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    s -= 2;
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

/* ------------------------------------------------ imágenes ---- */

const imgCache = new Map();

export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; res(ok ? img : null); } };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    setTimeout(() => done(img.complete && img.naturalWidth > 0), 6000);
    img.src = url;
  });
  imgCache.set(url, p);
  return p;
}

export async function loadDuelImages(duel) {
  const [left, right] = await Promise.all([
    loadImage(duel.left && duel.left.image),
    loadImage(duel.right && duel.right.image),
  ]);
  return { left, right };
}

/* ------------------------------------------------ pintor ---- */

export function drawDuelShareCard(ctx, duel, opts = {}) {
  const S = DUEL_CARD_SIZE;
  const t = opts.theme || resolveDuelTheme(ctx.canvas);
  const images = opts.images || { left: null, right: null };
  const layout = opts.layout || 'diagonal';
  const JP = t.fontJp;

  const leftPct = Math.max(0, Math.min(100, Math.round(duel.leftPct ?? 50)));
  const rightPct = 100 - leftPct;
  const winner = leftPct > 50 ? 'left' : leftPct < 50 ? 'right' : null;

  const CW = 380, CH = 570;
  const geo = layout === 'diagonal'
    ? {
        left: { x: 296, y: 420, rot: (-3.2 * Math.PI) / 180 },
        right: { x: 784, y: 452, rot: (3.2 * Math.PI) / 180 },
      }
    : {
        left: { x: 286, y: 436, rot: 0 },
        right: { x: 794, y: 436, rot: 0 },
      };

  ctx.save();
  ctx.textBaseline = 'alphabetic';

  /* — fondo — */
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, S, S);

  /* — arena de estadio, muy tenue — */
  const rand = rng(20260611);
  for (let i = 0; i < 1100; i++) {
    const x = rand() * S, y = 560 + Math.pow(rand(), 1.6) * 520;
    ctx.fillStyle = withAlpha(rand() > 0.5 ? t.gold : t.text, 0.018 + rand() * 0.034);
    ctx.beginPath(); ctx.arc(x, y, 0.5 + rand() * 1.1, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 240; i++) {
    const x = rand() * S, y = rand() * 520;
    ctx.fillStyle = withAlpha(t.text, 0.012 + rand() * 0.02);
    ctx.beginPath(); ctx.arc(x, y, 0.4 + rand() * 0.8, 0, Math.PI * 2); ctx.fill();
  }

  /* — glow carmesí central — */
  let g = ctx.createRadialGradient(540, 430, 60, 540, 430, 560);
  g.addColorStop(0, withAlpha(t.accent, 0.13));
  g.addColorStop(1, withAlpha(t.accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  /* — kanji fantasma 決 — */
  ctx.font = `900 640px ${JP}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = withAlpha(t.gold, 0.05);
  ctx.fillText('決', 540, 470);
  ctx.textBaseline = 'alphabetic';

  /* — viñeta (antes del contenido para no apagarlo) — */
  const vg = ctx.createRadialGradient(540, 470, 300, 540, 470, 820);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);

  /* — cabecera: 戦 entre filetes — */
  ctx.strokeStyle = withAlpha(t.gold, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(310, 88); ctx.lineTo(478, 88);
  ctx.moveTo(602, 88); ctx.lineTo(770, 88);
  ctx.stroke();
  ctx.font = `700 40px ${JP}`;
  ctx.fillStyle = t.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('戦', 540, 90);
  ctx.textBaseline = 'alphabetic';

  /* — cartas — */
  const drawCover = (img, w, h) => {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  };

  const drawPlaceholder = (p, w, h) => {
    const lg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    lg.addColorStop(0, mix(t.surface, t.text, 0.08));
    lg.addColorStop(0.6, t.surface);
    lg.addColorStop(1, mix(t.surface, t.bg, 0.6));
    ctx.fillStyle = lg;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = withAlpha(t.text, 0.05);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -w / 2 - h; x < w / 2; x += 26) {
      ctx.moveTo(x, h / 2); ctx.lineTo(x + h, -h / 2);
    }
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `900 190px ${JP}`;
    ctx.fillStyle = withAlpha(t.text, 0.09);
    ctx.textBaseline = 'middle';
    ctx.fillText((p.name || '?').trim().charAt(0), 0, -52);
    ctx.textBaseline = 'alphabetic';
    ctx.font = `500 19px ${FONT_MONO}`;
    ctx.fillStyle = withAlpha(t.text, 0.5);
    ctx.fillText('arte 2:3', 0, h / 2 - 96);
    ctx.font = `400 15px ${FONT_MONO}`;
    ctx.fillStyle = withAlpha(t.text, 0.32);
    ctx.fillText(`/img/${slug(p.anime)}/${slug(p.name)}-600.webp`, 0, h / 2 - 68);
  };

  const card = (side) => {
    const gpos = geo[side], p = duel[side], img = images[side];
    const role = winner === side ? 'winner' : winner ? 'loser' : 'neutral';
    ctx.save();
    ctx.translate(gpos.x, gpos.y);
    ctx.rotate(gpos.rot);

    if (role === 'winner') {
      ctx.save();
      ctx.shadowColor = withAlpha(t.accent, 0.55);
      ctx.shadowBlur = 90;
      ctx.beginPath(); rr(ctx, -CW / 2, -CH / 2, CW, CH, 20);
      ctx.fillStyle = t.surface;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); rr(ctx, -CW / 2, -CH / 2, CW, CH, 20); ctx.clip();
    if (role === 'loser') ctx.filter = 'saturate(0.25) brightness(0.78)';
    if (img) drawCover(img, CW, CH); else drawPlaceholder(p, CW, CH);
    ctx.filter = 'none';
    const sc = ctx.createLinearGradient(0, CH / 2 - 150, 0, CH / 2);
    sc.addColorStop(0, withAlpha(t.bg, 0));
    sc.addColorStop(1, withAlpha(t.bg, 0.4));
    ctx.fillStyle = sc;
    ctx.fillRect(-CW / 2, CH / 2 - 150, CW, 150);
    if (role === 'loser') {
      ctx.fillStyle = withAlpha(t.bg, 0.28);
      ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
    }
    ctx.restore();

    ctx.beginPath(); rr(ctx, -CW / 2, -CH / 2, CW, CH, 20);
    ctx.lineWidth = role === 'winner' ? 4 : 2;
    ctx.strokeStyle = role === 'winner' ? t.gold : withAlpha(t.text, 0.16);
    ctx.stroke();

    if (role === 'winner') {
      ctx.beginPath(); rr(ctx, -CW / 2 - 9, -CH / 2 - 9, CW + 18, CH + 18, 27);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = withAlpha(t.gold, 0.35);
      ctx.stroke();
      /* sello 勝 (victoria) */
      const sz = 58, sx = CW / 2 - sz - 14, sy = -CH / 2 + 14;
      ctx.beginPath(); rr(ctx, sx, sy, sz, sz, 8);
      ctx.fillStyle = withAlpha(t.bg, 0.78);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = t.gold;
      ctx.stroke();
      ctx.font = `700 30px ${JP}`;
      ctx.fillStyle = t.gold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('勝', sx + sz / 2, sy + sz / 2 + 2);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  };

  /* perdedor primero, ganador encima */
  card(winner === 'right' ? 'left' : 'right');
  card(winner === 'right' ? 'right' : 'left');

  /* — badge central: rombo + 決 — */
  const bx = 540, by = (geo.left.y + geo.right.y) / 2;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.PI / 4);
  const D = 132;
  ctx.shadowColor = withAlpha(t.bg, 0.9);
  ctx.shadowBlur = 36;
  ctx.beginPath(); rr(ctx, -D / 2, -D / 2, D, D, 14);
  ctx.fillStyle = t.surface;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = t.gold;
  ctx.stroke();
  ctx.beginPath(); rr(ctx, -D / 2 + 9, -D / 2 + 9, D - 18, D - 18, 9);
  ctx.lineWidth = 1;
  ctx.strokeStyle = withAlpha(t.gold, 0.4);
  ctx.stroke();
  ctx.restore();
  ctx.font = `800 56px ${JP}`;
  ctx.fillStyle = t.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('決', bx, by + 2);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 21px ${FONT_MONO}`;
  ctx.fillStyle = withAlpha(t.text, 0.6);
  ctx.fillText('VS', bx, by + 132);

  /* — nombres — */
  const nameBlock = (side) => {
    const gpos = geo[side], p = duel[side];
    const role = winner === side ? 'winner' : winner ? 'loser' : 'neutral';
    const y0 = gpos.y + 338;
    ctx.textAlign = 'center';
    fitFont(ctx, p.name, 700, FONT_SANS, 40, 360, 26);
    ctx.fillStyle = role === 'winner' ? t.gold : role === 'loser' ? withAlpha(t.text, 0.66) : t.text;
    ctx.fillText(p.name, gpos.x, y0);
    fitFont(ctx, p.anime, 500, FONT_SANS, 23, 340, 16);
    ctx.fillStyle = withAlpha(t.text, 0.42);
    ctx.fillText(p.anime, gpos.x, y0 + 34);
  };
  nameBlock('left');
  nameBlock('right');

  /* — % de votos + barra divisoria — */
  const x0 = 120, x1 = 960, barY = 924, barH = 12, yNum = 900;

  const num = (side) => {
    const pct = side === 'left' ? leftPct : rightPct;
    const role = winner === side ? 'winner' : winner ? 'loser' : 'neutral';
    const colMain = role === 'winner' ? t.gold : role === 'loser' ? withAlpha(t.text, 0.38) : withAlpha(t.text, 0.8);
    const colPct = role === 'winner' ? withAlpha(t.gold, 0.8) : withAlpha(t.text, 0.35);
    const digits = String(pct);
    if (side === 'left') {
      ctx.textAlign = 'left';
      ctx.font = `700 92px ${FONT_MONO}`;
      ctx.fillStyle = colMain;
      ctx.fillText(digits, x0, yNum);
      const w = ctx.measureText(digits).width;
      ctx.font = `600 40px ${FONT_MONO}`;
      ctx.fillStyle = colPct;
      ctx.fillText('%', x0 + w + 10, yNum);
    } else {
      ctx.textAlign = 'right';
      ctx.font = `600 40px ${FONT_MONO}`;
      const wp = ctx.measureText('%').width;
      ctx.fillStyle = colPct;
      ctx.fillText('%', x1, yNum);
      ctx.font = `700 92px ${FONT_MONO}`;
      ctx.fillStyle = colMain;
      ctx.fillText(digits, x1 - wp - 10, yNum);
    }
  };
  num('left');
  num('right');

  const split = x0 + (x1 - x0) * (leftPct / 100);
  ctx.save();
  ctx.beginPath(); rr(ctx, x0, barY, x1 - x0, barH, 6); ctx.clip();
  ctx.fillStyle = withAlpha(t.text, 0.1);
  ctx.fillRect(x0, barY, x1 - x0, barH);
  ctx.fillStyle = winner === 'left' ? t.accent : withAlpha(t.text, 0.16);
  ctx.fillRect(x0, barY, split - x0, barH);
  ctx.fillStyle = winner === 'right' ? t.accent : withAlpha(t.text, 0.16);
  ctx.fillRect(split, barY, x1 - split, barH);
  ctx.restore();
  /* marcador de oro en el corte */
  ctx.beginPath(); rr(ctx, split - 2.5, barY - 8, 5, barH + 16, 2.5);
  ctx.fillStyle = t.gold;
  ctx.fill();

  /* — pie: logo (stand-in) + dominio — */
  ctx.font = `500 21px ${FONT_MONO}`;
  const domain = 'animeshowdown.dev';
  const tw = ctx.measureText(domain).width;
  const fx = 540 - (12 + 14 + tw) / 2, fy = 1008;
  ctx.save();
  ctx.translate(fx + 6, fy - 7);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = t.gold;
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = withAlpha(t.text, 0.5);
  ctx.fillText(domain, fx + 26, fy);

  /* — marco + esquinas de oro — */
  ctx.strokeStyle = withAlpha(t.gold, 0.25);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(30, 30, S - 60, S - 60);
  ctx.strokeStyle = t.gold;
  ctx.lineWidth = 3;
  ctx.lineCap = 'square';
  const L = 56, o = 30;
  ctx.beginPath();
  ctx.moveTo(o, o + L); ctx.lineTo(o, o); ctx.lineTo(o + L, o);
  ctx.moveTo(S - o - L, o); ctx.lineTo(S - o, o); ctx.lineTo(S - o, o + L);
  ctx.moveTo(S - o, S - o - L); ctx.lineTo(S - o, S - o); ctx.lineTo(S - o - L, S - o);
  ctx.moveTo(o + L, S - o); ctx.lineTo(o, S - o); ctx.lineTo(o, S - o - L);
  ctx.stroke();

  ctx.restore();
}
