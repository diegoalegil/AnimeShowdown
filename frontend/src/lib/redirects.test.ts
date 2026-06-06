import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Guard anti-404 en producción. Cloudflare Pages NO usa catch-all: `_redirects`
// es una allowlist explícita. Si una ruta de la SPA (App.jsx) no tiene entrada
// (rewrite 200 o redirect 301), la carga directa/recarga/enlace de esa página
// devuelve 404.html en prod aunque funcione en local. Este test falla si se
// añade una <Route> sin su entrada en _redirects.

// vitest corre con cwd = frontend/, así que resolvemos desde ahí (import.meta.url
// no es file:// bajo el entorno jsdom de vitest).
const root = process.cwd()
const redirects = readFileSync(resolve(root, 'public/_redirects'), 'utf8')
const appJsx = readFileSync(resolve(root, 'src/App.jsx'), 'utf8')

// Normaliza nombres de params (:slug, :par, :username → :p) y quita la barra
// final, para comparar patrones de App.jsx y _redirects sin falsos negativos.
function norm(path: string): string {
  let s = path.trim().replace(/:[A-Za-z_]+/g, ':p')
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s
}

// Fuentes cubiertas por _redirects (cualquier status: 200 sirve la SPA, 301
// redirige un alias legacy). Ambas evitan el 404.
const cubiertas = new Set(
  redirects
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => norm(l.split(/\s+/)[0])),
)

// Rutas declaradas en App.jsx. Excluimos "/" (lo sirve index.html) y el
// catch-all "*" (es justo el 404 deliberado).
const rutasApp = [
  ...new Set(
    [...appJsx.matchAll(/path="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((p) => p.startsWith('/') && p !== '/')
      .map(norm),
  ),
]

describe('_redirects cubre las rutas reales de la SPA', () => {
  it('toda <Route> de App.jsx tiene entrada en public/_redirects (evita 404 en prod)', () => {
    const faltan = rutasApp.filter((r) => !cubiertas.has(r))
    expect(
      faltan,
      `Rutas en App.jsx sin entrada en _redirects (darán 404 en prod): ${faltan.join(', ')}`,
    ).toEqual([])
  })
})
