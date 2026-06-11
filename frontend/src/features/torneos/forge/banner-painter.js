// banner-painter.js
// ─────────────────────────────────────────────────────────────────────────────
// Pintor 2D del estandarte del torneo. Sin frameworks, sin estado.
// Lo comparten dos consumidores:
//   1. La textura del plano de tela (se re-sube como CanvasTexture con debounce)
//   2. El cartel estático 2D (móvil / reduced-motion / sin WebGL), que es la
//      misma composición que servirá de imagen OG del torneo.
// Los colores y fuentes se leen de los tokens CSS reales del proyecto
// (--color-bg/surface/accent/gold/electric/fg-strong/fg-muted y --font-*);
// los hex de abajo son solo fallback por si corre fuera del DOM tematizado.
// ─────────────────────────────────────────────────────────────────────────────

export const BANNER_W = 1024;
export const BANNER_H = 1536; // 2:3, mismo ratio que las imágenes de personaje

const FALLBACK_PALETTE = {
  bg: '#04070c',
  surface: '#080b12',
  accent: '#9f1d2c',
  gold: '#c5a15a',
  electric: '#43c4dd',
  ink: '#ece7db',
  muted: '#7d7a6e',
};

const FALLBACK_FONTS = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  kanji: "'Noto Serif JP', 'Hiragino Mincho ProN', serif",
};

/** Lee paleta y fuentes desde los tokens CSS del documento. */
export function readTheme(root) {
  const el = root || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) return { palette: { ...FALLBACK_PALETTE }, fonts: { ...FALLBACK_FONTS } };
  const cs = getComputedStyle(el);
  const v = (name, fb) => {
    const s = cs.getPropertyValue(name).trim();
    return s || fb;
  };
  return {
    palette: {
      bg: v('--color-bg', FALLBACK_PALETTE.bg),
      surface: v('--color-surface', FALLBACK_PALETTE.surface),
      accent: v('--color-accent', FALLBACK_PALETTE.accent),
      gold: v('--color-gold', FALLBACK_PALETTE.gold),
      electric: v('--color-electric', FALLBACK_PALETTE.electric),
      ink: v('--color-fg-strong', FALLBACK_PALETTE.ink),
      muted: v('--color-fg-muted', FALLBACK_PALETTE.muted),
    },
    fonts: {
      sans: v('--font-sans', FALLBACK_FONTS.sans),
      mono: v('--font-mono', FALLBACK_FONTS.mono),
      kanji: v('--font-kanji-serif', FALLBACK_FONTS.kanji),
    },
  };
}

/**
 * Pinta el estandarte completo en `canvas` (lo redimensiona a 1024×1536).
 * data = { name, organizer, date ('YYYY-MM-DD'), bracketSize (8|16|32) }
 */
export function paintBanner(canvas, data = {}, theme = readTheme()) {
  const { palette: P, fonts: F } = theme;
  const W = BANNER_W;
  const H = BANNER_H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── fondo: gradiente vertical sobrio surface → bg → surface
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, P.surface);
  g.addColorStop(0.55, P.bg);
  g.addColorStop(1, P.surface);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // ── trama de tejido (hilos muy tenues)
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.045;
  for (let y = 0; y < H; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.025;
  for (let x = 0; x < W; x += 13) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── kanji marca de agua: 戦 (batalla)
  ctx.save();
  ctx.font = `700 ${Math.round(W * 0.98)}px ${F.kanji}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.accent;
  ctx.globalAlpha = 0.15;
  ctx.fillText('戦', W / 2, H * 0.47);
  ctx.restore();

  // ── marco doble en oro
  ctx.strokeStyle = P.gold;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 42, W - 84, H - 84);
  ctx.globalAlpha = 1;

  // ── cabecera (mono, sin tracking ancho)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 26px ${F.mono}`;
  ctx.fillStyle = P.gold;
  ctx.globalAlpha = 0.85;
  ctx.fillText('Anime Showdown · torneo oficial', W / 2, 102);
  ctx.globalAlpha = 1;
  drawDiamond(ctx, W / 2 - 250, 102, 7, P.accent, 0.9);
  drawDiamond(ctx, W / 2 + 250, 102, 7, P.accent, 0.9);

  // ── nombre del torneo (grande, con ajuste de línea y autoencogido)
  const rawName = (data.name || '').trim();
  const display = rawName || 'Torneo sin nombre';
  const fit = fitLines(ctx, display, F.sans, W - 220, 116, 62, 3);
  ctx.font = `800 ${fit.size}px ${F.sans}`;
  ctx.fillStyle = rawName ? P.ink : P.muted;
  const lineH = fit.size * 1.12;
  let y = 232;
  for (const line of fit.lines) {
    ctx.fillText(line, W / 2, y);
    y += lineH;
  }

  // ── divisor: regla en oro con rombo central
  const divY = y + 8;
  ctx.strokeStyle = P.gold;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(170, divY);
  ctx.lineTo(W / 2 - 26, divY);
  ctx.moveTo(W / 2 + 26, divY);
  ctx.lineTo(W - 170, divY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawDiamond(ctx, W / 2, divY, 9, P.gold, 0.8);

  // ── etiqueta del cuadro
  const size = data.bracketSize || 16;
  ctx.font = `500 27px ${F.mono}`;
  ctx.fillStyle = P.muted;
  ctx.fillText(`cuadro de ${size} · eliminación directa`, W / 2, divY + 52);

  // ── bracket fantasma del tamaño elegido
  drawGhostBracket(ctx, 120, 642, W - 240, 470, size, P, F);

  // ── sello del organizador + pie
  drawSeal(ctx, W / 2, 1268, (data.organizer || '').trim(), P, F);
  const org = (data.organizer || '').trim();
  ctx.textAlign = 'center';
  ctx.font = `600 28px ${F.mono}`;
  ctx.fillStyle = org ? P.ink : P.muted;
  ctx.globalAlpha = org ? 0.85 : 0.5;
  ctx.fillText(org ? `organiza · ${org}` : 'organizador por anunciar', W / 2, 1400);
  ctx.globalAlpha = 1;
  if (data.date) {
    ctx.font = `500 25px ${F.mono}`;
    ctx.fillStyle = P.gold;
    ctx.globalAlpha = 0.8;
    ctx.fillText(formatDate(data.date), W / 2, 1444);
    ctx.globalAlpha = 1;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function drawDiamond(ctx, cx, cy, r, color, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(-r / 1.41, -r / 1.41, r * 1.41, r * 1.41);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitLines(ctx, text, font, maxWidth, startSize, minSize, maxLines) {
  for (let size = startSize; size >= minSize; size -= 6) {
    ctx.font = `800 ${size}px ${font}`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { size, lines };
    }
  }
  ctx.font = `800 ${minSize}px ${font}`;
  return { size: minSize, lines: wrapText(ctx, text, maxWidth).slice(0, maxLines) };
}

function drawGhostBracket(ctx, x0, y0, w, h, size, P, F) {
  const perSide = Math.max(2, size / 2);
  const rounds = Math.round(Math.log2(perSide));
  const cx = x0 + w / 2;
  const gap = 30; // hueco central para el rombo del campeón
  const colW = (w / 2 - gap - 6) / (rounds + 1);

  ctx.save();
  ctx.strokeStyle = P.electric;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const line = (ax, ay, bx, by) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  for (const dir of [1, -1]) {
    const sx = dir === 1 ? x0 : x0 + w;
    for (let r = 0; r < rounds; r++) {
      const count = perSide >> r;
      const xA = sx + dir * colW * r;
      const xB = sx + dir * colW * (r + 1);
      for (let i = 0; i < count; i++) {
        const yy = y0 + (h * (i + 0.5)) / count;
        line(xA, yy, xB, yy);
        if (i % 2 === 0) {
          const y2 = y0 + (h * (i + 1.5)) / count;
          line(xB, yy, xB, y2);
        }
      }
    }
    // tramo final hacia el centro
    const xF = sx + dir * colW * rounds;
    line(xF, y0 + h / 2, cx - dir * gap, y0 + h / 2);
  }
  ctx.restore();

  // campeón: rombo en oro + kanji 決 (decisión)
  drawDiamond(ctx, cx, y0 + h / 2, 11, P.gold, 0.6);
  ctx.save();
  ctx.font = `700 46px ${F.kanji}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.gold;
  ctx.globalAlpha = 0.55;
  ctx.fillText('決', cx, y0 + h / 2 - 52);
  ctx.restore();
}

function drawSeal(ctx, cx, cy, organizer, P, F) {
  const has = !!organizer;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.055);
  ctx.strokeStyle = P.accent;
  ctx.lineWidth = 5;
  ctx.globalAlpha = has ? 0.9 : 0.4;
  if (!has) ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.arc(0, 0, 84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = has ? 0.55 : 0.25;
  ctx.beginPath();
  ctx.arc(0, 0, 69, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (has) {
    // iniciales del organizador, como hanko
    const initials = organizer
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
    ctx.font = `800 ${initials.length > 1 ? 56 : 66}px ${F.kanji}`;
    ctx.fillStyle = P.accent;
    ctx.globalAlpha = 0.95;
    ctx.fillText(initials, 0, 2);
  } else {
    // 主催 = «organiza» — hueco a la espera de sello
    ctx.font = `700 36px ${F.kanji}`;
    ctx.fillStyle = P.muted;
    ctx.globalAlpha = 0.55;
    ctx.fillText('主催', 0, 2);
  }
  ctx.restore();
}

function formatDate(iso) {
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]} · ${parts[1]} · ${parts[0]}`;
}
