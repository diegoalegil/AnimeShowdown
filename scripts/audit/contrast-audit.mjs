#!/usr/bin/env node
/**
 * Auditoría WCAG de contraste de colores.
 *
 * Toma los tokens declarados en frontend/src/index.css (@theme) más
 * los pares foreground/background usados explícitamente en utility
 * classes (.as-button-primary, .as-chip-active, etc.) y calcula el
 * ratio de contraste WCAG 2.1 para cada combinación canónica.
 *
 * Genera docs/audit/contrast-report.md con:
 *   - tokens detectados
 *   - tabla pass/fail por pareja
 *   - recomendaciones para los que fallan WCAG AA
 *
 * Uso:
 *   node scripts/audit/contrast-audit.mjs
 *
 * Sin args. Lee frontend/src/index.css en read-only. No modifica nada
 * fuera de docs/audit/.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CSS_PATH = join(ROOT, 'frontend/src/index.css')
const OUTPUT = join(ROOT, 'docs/audit/contrast-report.md')

// ---------- Parseo de colores ----------

function parseHex(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    }
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  if (h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    }
  }
  return null
}

function parseRgb(str) {
  // formatos: "rgb(R G B)", "rgb(R G B / A)", "rgb(R, G, B)", "rgb(R, G, B, A)"
  const m = str.match(/rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)\s*(?:[,/]\s*([\d.]+)\s*)?\)/i)
  if (!m) return null
  return {
    r: parseInt(m[1], 10),
    g: parseInt(m[2], 10),
    b: parseInt(m[3], 10),
    a: m[4] !== undefined ? parseFloat(m[4]) : 1,
  }
}

function parseColor(str) {
  if (!str) return null
  const s = str.trim()
  if (s.startsWith('#')) return parseHex(s)
  if (s.toLowerCase().startsWith('rgb')) return parseRgb(s)
  return null
}

// Combina foreground con alpha sobre un background opaco (composición alfa)
function compositeOver(fg, bg) {
  const a = fg.a ?? 1
  if (a >= 1) return { r: fg.r, g: fg.g, b: fg.b }
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  }
}

// ---------- WCAG luminance + contrast ratio ----------

function srgbToLinear(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1)
  const l2 = relativeLuminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function gradeWcag(ratio, opts = {}) {
  const isLarge = opts.large === true
  const aaThreshold = isLarge ? 3 : 4.5
  const aaaThreshold = isLarge ? 4.5 : 7
  if (ratio >= aaaThreshold) return 'AAA'
  if (ratio >= aaThreshold) return 'AA'
  if (ratio >= 3) return 'AA-large-only'
  return 'FAIL'
}

function colorToHex({ r, g, b }) {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

// ---------- Extracción de tokens desde index.css ----------

function extractThemeTokens(css) {
  const tokens = {}
  // Match dentro de @theme { ... }
  const themeMatch = css.match(/@theme\s*\{([\s\S]*?)\}/m)
  if (!themeMatch) return tokens
  const themeBody = themeMatch[1]
  const re = /--color-([a-z0-9-]+):\s*([^;]+);/gi
  let m
  while ((m = re.exec(themeBody))) {
    const name = m[1].trim()
    const value = m[2].trim()
    tokens[name] = value
  }
  return tokens
}

// ---------- Plan de auditoría ----------

function main() {
  const css = readFileSync(CSS_PATH, 'utf8')
  const tokens = extractThemeTokens(css)

  // Resolver tokens a colores reales (opacos cuando hace falta)
  // Algunos tokens son rgb con alpha (--color-accent-soft). Para ésos
  // los componeremos sobre --color-bg como fondo asumido.
  const resolved = {}
  for (const [name, raw] of Object.entries(tokens)) {
    const color = parseColor(raw)
    if (color) resolved[name] = { raw, color }
  }

  const bg = resolved.bg.color
  const surface = resolved.surface.color
  const surfaceAlt = resolved['surface-alt'].color

  // Color "blanco hueso" usado en chips activos
  const offWhite = parseHex('#fff7e6')
  // Color del kicker (gold derivado)
  const kickerGold = parseHex('#d6b164') // rgb(214 177 100)
  // Texto blanco puro
  const white = parseHex('#ffffff')
  // Color de selección
  const selectionText = parseHex('#ffffff')

  // Pares foreground/background a evaluar.
  // Source: cada par viene del CSS o de pares textuales canónicos en la app.
  const pairs = [
    // ---- Texto sobre fondo principal ----
    { fg: resolved.fg.color, bg, fgName: '--color-fg', bgName: '--color-bg', context: 'Texto body por defecto', large: false },
    { fg: resolved['fg-strong'].color, bg, fgName: '--color-fg-strong', bgName: '--color-bg', context: 'Headings h1/h2/h3', large: true },
    { fg: resolved['fg-muted'].color, bg, fgName: '--color-fg-muted', bgName: '--color-bg', context: 'Texto secundario (.as-chip, captions)', large: false },

    // ---- Texto sobre surface ----
    { fg: resolved.fg.color, bg: surface, fgName: '--color-fg', bgName: '--color-surface', context: 'Texto body sobre paneles', large: false },
    { fg: resolved['fg-strong'].color, bg: surface, fgName: '--color-fg-strong', bgName: '--color-surface', context: 'Heading sobre panel', large: true },
    { fg: resolved['fg-muted'].color, bg: surface, fgName: '--color-fg-muted', bgName: '--color-surface', context: 'Texto secundario sobre panel', large: false },

    // ---- Texto sobre surface-alt ----
    { fg: resolved.fg.color, bg: surfaceAlt, fgName: '--color-fg', bgName: '--color-surface-alt', context: 'Texto sobre surface elevado', large: false },
    { fg: resolved['fg-muted'].color, bg: surfaceAlt, fgName: '--color-fg-muted', bgName: '--color-surface-alt', context: 'Caption sobre surface elevado', large: false },

    // ---- Acentos sobre fondo (texto en color de marca) ----
    { fg: resolved.accent.color, bg, fgName: '--color-accent', bgName: '--color-bg', context: 'Texto rojo de marca sobre fondo', large: false },
    { fg: resolved.gold.color, bg, fgName: '--color-gold', bgName: '--color-bg', context: 'Texto dorado (números ELO) sobre fondo', large: false },
    { fg: resolved.electric.color, bg, fgName: '--color-electric', bgName: '--color-bg', context: 'Texto cyan acento sobre fondo', large: false },

    // ---- Acentos sobre surface ----
    { fg: resolved.accent.color, bg: surface, fgName: '--color-accent', bgName: '--color-surface', context: 'Acento rojo sobre panel', large: false },
    { fg: resolved.gold.color, bg: surface, fgName: '--color-gold', bgName: '--color-surface', context: 'Acento dorado sobre panel', large: false },
    { fg: resolved.electric.color, bg: surface, fgName: '--color-electric', bgName: '--color-surface', context: 'Acento cyan sobre panel', large: false },

    // ---- Botón primario: blanco sobre acento ----
    { fg: white, bg: resolved.accent.color, fgName: '#fff', bgName: '--color-accent (#9f1d2c)', context: '.as-button-primary (blanco sobre rojo)', large: false },
    { fg: white, bg: resolved['accent-hover'].color, fgName: '#fff', bgName: '--color-accent-hover (#be2b38)', context: '.as-button-primary:hover', large: false },
    { fg: white, bg: parseHex('#871927'), fgName: '#fff', bgName: 'gradient end (#871927)', context: '.as-button-primary (gradient end más oscuro)', large: false },

    // ---- Selection ----
    { fg: selectionText, bg: resolved.accent.color, fgName: '#fff', bgName: '--color-accent', context: '::selection (texto seleccionado)', large: false },

    // ---- Chip activo ----
    { fg: offWhite, bg: parseHex('#66172A'), fgName: '#fff7e6', bgName: 'gradient (#66172a base)', context: '.as-chip-active (texto claro sobre rojo oscuro)', large: false },

    // ---- Kicker ----
    { fg: kickerGold, bg, fgName: 'kicker gold (#d6b164)', bgName: '--color-bg', context: '.as-kicker (gold-soft sobre fondo)', large: false },

    // ---- Borde sobre fondo (no texto, pero relevante UI) ----
    { fg: resolved.border.color, bg, fgName: '--color-border', bgName: '--color-bg', context: 'Borde sobre fondo (no-texto, UI element)', large: true, nonText: true },
  ]

  // Computar
  const results = pairs.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg)
    return {
      ...p,
      ratio,
      grade: gradeWcag(ratio, { large: p.large }),
      fgHex: colorToHex(p.fg),
      bgHex: colorToHex(p.bg),
    }
  })

  // Generar reporte
  const report = generateReport(tokens, resolved, results)
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, report)

  // Resumen consola
  console.log(`\nAudit de contraste — ${pairs.length} pares evaluados`)
  const fails = results.filter((r) => r.grade === 'FAIL' || r.grade === 'AA-large-only').length
  const aa = results.filter((r) => r.grade === 'AA' || r.grade === 'AAA').length
  console.log(`  ${aa} pasan AA, ${fails} fallan o solo AA-large`)
  console.log(`Reporte: ${OUTPUT}`)
}

function generateReport(tokens, resolved, results) {
  const lines = []
  lines.push('# Auditoría de contraste WCAG — AnimeShowdown')
  lines.push('')
  lines.push(`> Generado: ${new Date().toISOString()}`)
  lines.push(`> Script: \`scripts/audit/contrast-audit.mjs\``)
  lines.push(`> Fuente de tokens: \`frontend/src/index.css\` (@theme + utilities)`)
  lines.push(`> Criterio: WCAG 2.1 — AA = 4.5:1 (texto normal) / 3:1 (texto large ≥18pt o ≥14pt bold)`)
  lines.push('')

  // Resumen
  const total = results.length
  const aaa = results.filter((r) => r.grade === 'AAA').length
  const aa = results.filter((r) => r.grade === 'AA').length
  const aaLarge = results.filter((r) => r.grade === 'AA-large-only').length
  const fails = results.filter((r) => r.grade === 'FAIL').length

  lines.push('## Resumen')
  lines.push('')
  lines.push('| Grado | Pares | % |')
  lines.push('|---|---|---|')
  lines.push(`| AAA (>= 7:1) | ${aaa} | ${Math.round(aaa / total * 100)}% |`)
  lines.push(`| AA (>= 4.5:1) | ${aa} | ${Math.round(aa / total * 100)}% |`)
  lines.push(`| AA-large solo (3-4.5:1) | ${aaLarge} | ${Math.round(aaLarge / total * 100)}% ${aaLarge > 0 ? '⚠' : ''} |`)
  lines.push(`| FAIL (< 3:1) | ${fails} | ${Math.round(fails / total * 100)}% ${fails > 0 ? '⚠' : ''} |`)
  lines.push('')

  // Tokens detectados
  lines.push('## Tokens detectados en @theme')
  lines.push('')
  lines.push('| Token | Valor raw | Hex resuelto |')
  lines.push('|---|---|---|')
  for (const [name, raw] of Object.entries(tokens)) {
    const res = resolved[name]
    const hex = res ? colorToHex(res.color) : '—'
    lines.push(`| \`--color-${name}\` | \`${raw}\` | \`${hex}\` |`)
  }
  lines.push('')

  // Tabla de resultados
  lines.push('## Pares evaluados')
  lines.push('')
  lines.push('| Contexto | Foreground | Background | Ratio | Grado |')
  lines.push('|---|---|---|---|---|')
  for (const r of results) {
    const ratio = r.ratio.toFixed(2)
    const gradeBadge = {
      AAA: '✅ AAA',
      AA: '✅ AA',
      'AA-large-only': '⚠ AA-large solo',
      FAIL: '❌ FAIL',
    }[r.grade]
    lines.push(`| ${r.context} | \`${r.fgName}\` (${r.fgHex}) | \`${r.bgName}\` (${r.bgHex}) | ${ratio}:1 | ${gradeBadge} |`)
  }
  lines.push('')

  // Recomendaciones para los que fallan
  const problematic = results.filter((r) => r.grade === 'FAIL' || (r.grade === 'AA-large-only' && !r.large && !r.nonText))
  if (problematic.length) {
    lines.push('## Hallazgos y recomendaciones')
    lines.push('')
    for (const r of problematic) {
      lines.push(`### ${r.context}`)
      lines.push('')
      lines.push(`- **Ratio actual:** ${r.ratio.toFixed(2)}:1`)
      lines.push(`- **Necesario para AA:** ${r.large ? '3:1' : '4.5:1'}`)
      lines.push(`- **Foreground:** \`${r.fgName}\` → ${r.fgHex}`)
      lines.push(`- **Background:** \`${r.bgName}\` → ${r.bgHex}`)
      const recommendation = recommendFix(r)
      lines.push(`- **Recomendación:** ${recommendation}`)
      lines.push('')
    }
  } else {
    lines.push('## Hallazgos y recomendaciones')
    lines.push('')
    lines.push('_Todos los pares de texto evaluados pasan WCAG AA. Solo elementos no-texto (bordes) podrían quedar bajo umbral, lo cual es aceptable._')
    lines.push('')
  }

  // Notas finales
  lines.push('---')
  lines.push('')
  lines.push('## Notas')
  lines.push('')
  lines.push('- Esta auditoría es **estática** sobre tokens declarados, no escanea todos los `bg-X text-Y` usados en JSX. Para una cobertura exhaustiva habría que parsear todas las utility classes de Tailwind generadas — caro y con muchos falsos positivos.')
  lines.push('- Los tokens con alpha (ej. `--color-accent-soft` rgba) NO se evalúan directamente porque dependen del fondo sobre el que se componen. Si se usan como background con texto encima, hay que componerlos sobre `--color-bg` y luego medir.')
  lines.push('- **Texto large (>=18pt o >=14pt bold):** umbral más permisivo (3:1) — aplicado a headings (h1/h2/h3) y elementos marcados con `large: true` en el script.')
  lines.push('- **Elementos no-texto** (bordes, iconos decorativos): WCAG 2.1 SC 1.4.11 pide 3:1 si son significativos para el UX. Los bordes meramente decorativos están exentos.')
  lines.push('- Para una auditoría runtime exhaustiva (que sí ve cada combinación realmente pintada en la página), usar `axe-core` o Lighthouse contra producción. El script `npm run audit:a11y` del frontend ya hace algo así con `@axe-core/cli`.')
  lines.push('')
  lines.push('## Cómo ejecutar')
  lines.push('')
  lines.push('```bash')
  lines.push('node scripts/audit/contrast-audit.mjs')
  lines.push('```')
  lines.push('')
  lines.push('Sin args, sin instalación. Usa solo Node stdlib + lee `frontend/src/index.css`.')
  lines.push('')

  return lines.join('\n')
}

function recommendFix(r) {
  if (r.large || r.nonText) {
    return `Ya pasa para texto large / elemento no-texto. Si se usa para texto normal, subir luminancia del foreground o oscurecer el background.`
  }
  const fgLuma = relativeLuminance(r.fg)
  const bgLuma = relativeLuminance(r.bg)
  if (fgLuma < bgLuma) {
    return `Foreground es más oscuro que background. Oscurece más el foreground (o usa un foreground más oscuro) — o asegúrate de que este par se use solo para texto large.`
  }
  // Fg más claro que bg → subir saturación del fg o bajar bg
  return `Subir la luminancia del foreground (o reservar este par a contextos large-text). Si es un acento de marca y no debe cambiar, restringir su uso a iconos / texto large bold, no a body copy.`
}

main()
