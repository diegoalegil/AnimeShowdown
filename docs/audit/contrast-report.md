# Auditoría de contraste WCAG — AnimeShowdown

> Generado: 2026-05-22T02:23:38.097Z
> Script: `scripts/audit/contrast-audit.mjs`
> Fuente de tokens: `frontend/src/index.css` (@theme + utilities)
> Criterio: WCAG 2.1 — AA = 4.5:1 (texto normal) / 3:1 (texto large ≥18pt o ≥14pt bold)

## Resumen

| Grado | Pares | % |
|---|---|---|
| AAA (>= 7:1) | 17 | 81% |
| AA (>= 4.5:1) | 1 | 5% |
| AA-large solo (3-4.5:1) | 0 | 0%  |
| FAIL (< 3:1) | 3 | 14% ⚠ |

## Tokens detectados en @theme

| Token | Valor raw | Hex resuelto |
|---|---|---|
| `--color-bg` | `#080b12` | `#080b12` |
| `--color-surface` | `#101620` | `#101620` |
| `--color-surface-alt` | `#171f2c` | `#171f2c` |
| `--color-border` | `#334155` | `#334155` |
| `--color-fg` | `#d7dce7` | `#d7dce7` |
| `--color-fg-strong` | `#f7f3ea` | `#f7f3ea` |
| `--color-fg-muted` | `#a8b1c3` | `#a8b1c3` |
| `--color-accent` | `#9f1d2c` | `#9f1d2c` |
| `--color-accent-hover` | `#be2b38` | `#be2b38` |
| `--color-accent-soft` | `rgb(159 29 44 / 0.16)` | `#9f1d2c` |
| `--color-gold` | `#c5a15a` | `#c5a15a` |
| `--color-gold-soft` | `rgb(197 161 90 / 0.15)` | `#c5a15a` |
| `--color-elo-number` | `#c5a15a` | `#c5a15a` |
| `--color-electric` | `#24c6dc` | `#24c6dc` |
| `--color-electric-soft` | `rgb(36 198 220 / 0.12)` | `#24c6dc` |

## Pares evaluados

| Contexto | Foreground | Background | Ratio | Grado |
|---|---|---|---|---|
| Texto body por defecto | `--color-fg` (#d7dce7) | `--color-bg` (#080b12) | 14.32:1 | ✅ AAA |
| Headings h1/h2/h3 | `--color-fg-strong` (#f7f3ea) | `--color-bg` (#080b12) | 17.77:1 | ✅ AAA |
| Texto secundario (.as-chip, captions) | `--color-fg-muted` (#a8b1c3) | `--color-bg` (#080b12) | 9.13:1 | ✅ AAA |
| Texto body sobre paneles | `--color-fg` (#d7dce7) | `--color-surface` (#101620) | 13.20:1 | ✅ AAA |
| Heading sobre panel | `--color-fg-strong` (#f7f3ea) | `--color-surface` (#101620) | 16.38:1 | ✅ AAA |
| Texto secundario sobre panel | `--color-fg-muted` (#a8b1c3) | `--color-surface` (#101620) | 8.42:1 | ✅ AAA |
| Texto sobre surface elevado | `--color-fg` (#d7dce7) | `--color-surface-alt` (#171f2c) | 12.04:1 | ✅ AAA |
| Caption sobre surface elevado | `--color-fg-muted` (#a8b1c3) | `--color-surface-alt` (#171f2c) | 7.68:1 | ✅ AAA |
| Texto rojo de marca sobre fondo | `--color-accent` (#9f1d2c) | `--color-bg` (#080b12) | 2.52:1 | ❌ FAIL |
| Texto dorado (números ELO) sobre fondo | `--color-gold` (#c5a15a) | `--color-bg` (#080b12) | 8.08:1 | ✅ AAA |
| Texto cyan acento sobre fondo | `--color-electric` (#24c6dc) | `--color-bg` (#080b12) | 9.55:1 | ✅ AAA |
| Acento rojo sobre panel | `--color-accent` (#9f1d2c) | `--color-surface` (#101620) | 2.32:1 | ❌ FAIL |
| Acento dorado sobre panel | `--color-gold` (#c5a15a) | `--color-surface` (#101620) | 7.45:1 | ✅ AAA |
| Acento cyan sobre panel | `--color-electric` (#24c6dc) | `--color-surface` (#101620) | 8.80:1 | ✅ AAA |
| .as-button-primary (blanco sobre rojo) | `#fff` (#ffffff) | `--color-accent (#9f1d2c)` (#9f1d2c) | 7.82:1 | ✅ AAA |
| .as-button-primary:hover | `#fff` (#ffffff) | `--color-accent-hover (#be2b38)` (#be2b38) | 5.85:1 | ✅ AA |
| .as-button-primary (gradient end más oscuro) | `#fff` (#ffffff) | `gradient end (#871927)` (#871927) | 9.55:1 | ✅ AAA |
| ::selection (texto seleccionado) | `#fff` (#ffffff) | `--color-accent` (#9f1d2c) | 7.82:1 | ✅ AAA |
| .as-chip-active (texto claro sobre rojo oscuro) | `#fff7e6` (#fff7e6) | `gradient (#66172a base)` (#66172a) | 11.45:1 | ✅ AAA |
| .as-kicker (gold-soft sobre fondo) | `kicker gold (#d6b164)` (#d6b164) | `--color-bg` (#080b12) | 9.68:1 | ✅ AAA |
| Borde sobre fondo (no-texto, UI element) | `--color-border` (#334155) | `--color-bg` (#080b12) | 1.90:1 | ❌ FAIL |

## Hallazgos y recomendaciones

### Texto rojo de marca sobre fondo

- **Ratio actual:** 2.52:1
- **Necesario para AA:** 4.5:1
- **Foreground:** `--color-accent` → #9f1d2c
- **Background:** `--color-bg` → #080b12
- **Recomendación:** Subir la luminancia del foreground (o reservar este par a contextos large-text). Si es un acento de marca y no debe cambiar, restringir su uso a iconos / texto large bold, no a body copy.

### Acento rojo sobre panel

- **Ratio actual:** 2.32:1
- **Necesario para AA:** 4.5:1
- **Foreground:** `--color-accent` → #9f1d2c
- **Background:** `--color-surface` → #101620
- **Recomendación:** Subir la luminancia del foreground (o reservar este par a contextos large-text). Si es un acento de marca y no debe cambiar, restringir su uso a iconos / texto large bold, no a body copy.

### Borde sobre fondo (no-texto, UI element)

- **Ratio actual:** 1.90:1
- **Necesario para AA:** 3:1
- **Foreground:** `--color-border` → #334155
- **Background:** `--color-bg` → #080b12
- **Recomendación:** Ya pasa para texto large / elemento no-texto. Si se usa para texto normal, subir luminancia del foreground o oscurecer el background.

---

## Notas

- Esta auditoría es **estática** sobre tokens declarados, no escanea todos los `bg-X text-Y` usados en JSX. Para una cobertura exhaustiva habría que parsear todas las utility classes de Tailwind generadas — caro y con muchos falsos positivos.
- Los tokens con alpha (ej. `--color-accent-soft` rgba) NO se evalúan directamente porque dependen del fondo sobre el que se componen. Si se usan como background con texto encima, hay que componerlos sobre `--color-bg` y luego medir.
- **Texto large (>=18pt o >=14pt bold):** umbral más permisivo (3:1) — aplicado a headings (h1/h2/h3) y elementos marcados con `large: true` en el script.
- **Elementos no-texto** (bordes, iconos decorativos): WCAG 2.1 SC 1.4.11 pide 3:1 si son significativos para el UX. Los bordes meramente decorativos están exentos.
- Para una auditoría runtime exhaustiva (que sí ve cada combinación realmente pintada en la página), usar `axe-core` o Lighthouse contra producción. El script `npm run audit:a11y` del frontend ya hace algo así con `@axe-core/cli`.

## Cómo ejecutar

```bash
node scripts/audit/contrast-audit.mjs
```

Sin args, sin instalación. Usa solo Node stdlib + lee `frontend/src/index.css`.
