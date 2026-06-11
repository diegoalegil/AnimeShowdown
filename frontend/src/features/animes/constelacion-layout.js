/**
 * Layout determinista del cielo de constelaciones — módulo sin componentes
 * (react-refresh/only-export-components). Mismo seed ⇒ mismo cielo.
 */

export const W = 2480
export const H = 700

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildLayout(grupos, seed) {
  const rnd = mulberry32(seed)
  const nodes = []
  const edges = []
  const labels = []
  const stars = []
  const cols = Math.max(2, Math.ceil(grupos.length / 2))

  grupos.forEach((g, gi) => {
    const col = gi % cols
    const row = (gi / cols) | 0
    const cx = 220 + col * ((W - 440) / (cols - 1)) + (rnd() - 0.5) * 90
    const cy = (row === 0 ? H * 0.3 : H * 0.72) + (rnd() - 0.5) * 60
    const start = nodes.length

    // Espiral de ángulo áureo + jitter sembrado: orgánico pero estable.
    g.list.forEach((a, i) => {
      const ang = i * 2.39996 + rnd() * 0.9
      const rad = i === 0 ? 0 : 34 + 24 * Math.sqrt(i) + rnd() * 20
      const x = Math.max(96, Math.min(W - 96, cx + Math.cos(ang) * rad * 1.25))
      const y = Math.max(78, Math.min(H - 70, cy + Math.sin(ang) * rad * 0.92))
      nodes.push({ name: a.name, slug: a.slug, chars: a.chars, top: a.top, g: gi, x, y })
    })

    // Árbol de expansión mínima (Prim) → trazo de constelación sin cruces feos.
    const ids = []
    for (let i = start; i < nodes.length; i++) ids.push(i)
    if (ids.length > 1) {
      const tree = [ids[0]]
      const rest = ids.slice(1)
      while (rest.length) {
        let bd = Infinity
        let ba = -1
        let bb = -1
        let bi = -1
        for (let ri = 0; ri < rest.length; ri++) {
          for (let ti = 0; ti < tree.length; ti++) {
            const p = nodes[rest[ri]]
            const q = nodes[tree[ti]]
            const d = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)
            if (d < bd) {
              bd = d
              ba = tree[ti]
              bb = rest[ri]
              bi = ri
            }
          }
        }
        edges.push({ a: ba, b: bb, g: gi })
        tree.push(rest[bi])
        rest.splice(bi, 1)
      }
    }

    labels.push({ k: g.k, name: g.name, x: cx, y: cy })
  })

  for (let i = 0; i < 150; i++) {
    stars.push({
      x: rnd() * W,
      y: rnd() * H,
      r: 0.4 + rnd() * 0.9,
      o: 0.08 + rnd() * 0.28,
      tw: rnd() > 0.84,
      d: rnd() * 6,
    })
  }

  return { nodes, edges, labels, stars }
}


export { buildLayout }
