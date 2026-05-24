# Tokens Audit

Tailwind v4 usa `@theme` en `frontend/src/index.css`. No se encontro `frontend/tailwind.config.js` en este worktree.

## Tokens en index.css

| Token | Valor |
|---|---|
| `--color-bg` | `#080b12` |
| `--color-surface` | `#101620` |
| `--color-surface-alt` | `#171f2c` |
| `--color-border` | `#334155` |
| `--color-fg` | `#d7dce7` |
| `--color-fg-strong` | `#f7f3ea` |
| `--color-fg-muted` | `#a8b1c3` |
| `--color-accent` | `#9f1d2c` |
| `--color-accent-hover` | `#be2b38` |
| `--color-accent-soft` | `rgb(159 29 44 / 0.16)` |
| `--color-gold` | `#c5a15a` |
| `--color-gold-soft` | `rgb(197 161 90 / 0.15)` |
| `--color-elo-number` | `#c5a15a` |
| `--color-electric` | `#24c6dc` |
| `--color-electric-soft` | `rgb(36 198 220 / 0.12)` |
| `--font-sans` | `"Geist", "Noto Sans JP", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--font-mono` | `"Geist Mono", ui-monospace, "JetBrains Mono", Consolas, monospace` |
| `--animate-aurora-1` | `aurora-1 14s ease-in-out infinite` |
| `--animate-aurora-2` | `aurora-2 18s ease-in-out infinite` |
| `--animate-aurora-3` | `aurora-3 16s ease-in-out infinite` |
| `--animate-shimmer` | `shimmer 5s ease-in-out infinite` |
| `--animate-marquee` | `marquee 40s linear infinite` |
| `--animate-pulse-halo` | `pulse-halo 2.4s ease-out infinite` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/home-hero.svg')` |
| `--as-stage-kanji` | `"決"` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/home-pulse.svg')` |
| `--as-stage-kanji` | `"今"` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/games-hub.svg')` |
| `--as-stage-kanji` | `"遊"` |
| `--as-stage-image` | `url('/assets/game-covers/shadow-guess-v2.webp')` |
| `--as-stage-kanji` | `"影"` |
| `--as-stage-image` | `url('/assets/game-covers/anigrid.webp')` |
| `--as-stage-kanji` | `"格"` |
| `--as-stage-image` | `url('/assets/game-covers/anime-reveal.webp')` |
| `--as-stage-kanji` | `"謎"` |
| `--as-stage-image` | `url('/assets/game-covers/elo-duel.webp')` |
| `--as-stage-kanji` | `"対"` |
| `--as-stage-image` | `url('/assets/game-covers/impostor-trial.webp')` |
| `--as-stage-kanji` | `"裏"` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/ranking-hero.svg')` |
| `--as-stage-kanji` | `"冠"` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/anime-catalog.svg')` |
| `--as-stage-kanji` | `"界"` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/tournament-catalog.svg')` |
| `--as-stage-kanji` | `"戦"` |
| `--as-stage-image` | `url('/assets/brand/backgrounds/events-hero.svg')` |
| `--as-stage-kanji` | `"祭"` |
| `--as-stage-image` | `url('/assets/game-covers/omikuji.svg')` |
| `--as-stage-kanji` | `"吉"` |

## Tailwind config

- No detectado: `rg --files -g "tailwind.config.*"` no devolvio archivos.

## Gaps detectados

- `frontend/src/index.css` define tokens de color y fuente, pero tambien hay colores literales en utilidades custom (`rgb(...)`, hex y data URLs). Recomendacion: migrar solo los colores recurrentes a tokens cuando haya un patron estable.
- No hay namespace formal para tonos de estado (`ok`, `warn`, `err`, `info`). `Badge.jsx` usa clases Tailwind existentes como capa de componente, no tokens nuevos.
- `gold`, `accent`, `electric`, `surface` y `fg-*` son la base visual real. Mantenerlos como fuente antes de introducir paletas nuevas.
- `tailwind.config.js` fue esperado por la receta, pero el repo parece estar en Tailwind v4 con `@theme`. Documentado como gap, sin crear config.

## Recomendaciones no ejecutadas

- Crear un mapa documentado de tonos semanticos sobre tokens existentes antes de tocar `tailwind.config.js`.
- Reducir hex/rgb nuevos en componentes futuros usando `text-gold`, `bg-accent-soft`, `border-border`, `text-fg-muted` y `bg-surface`.
- Si se necesita Tailwind config de nuevo, hacerlo en una sesion separada porque `tailwind.config.js` esta en lista de no modificar.
