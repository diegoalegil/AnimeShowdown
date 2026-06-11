// Dorso "dossier" de la carta de personaje (ratio 2:3 — llena a su padre).
// Solo tokens del tema (bg-surface, text-gold, var(--color-*)); sin hex.
//
// Datos REALES de la ficha: los 4 ejes llegan ya calculados (con sus
// etiquetas "est." donde la métrica es estimada, igual que el resto de la
// ficha). La racha es opcional: sin dato real, la sección no se pinta —
// aquí no se inventan métricas.

const CX = 130
const CY = 108
const R = 64

// Ejes en orden: arriba, derecha, abajo, izquierda.
const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
]

const LABELS = [
  { x: CX, y: 18, vy: 32, anchor: 'middle' },
  { x: 200, y: 104, vy: 118, anchor: 'start' },
  { x: CX, y: 194, vy: 208, anchor: 'middle' },
  { x: 60, y: 104, vy: 118, anchor: 'end' },
]

const ring = (f) =>
  DIRS.map(({ dx, dy }) => `${CX + dx * R * f},${CY + dy * R * f}`).join(' ')

function RadarStats({ ejes }) {
  const puntos = ejes.map((eje, i) => {
    const f = Math.max(0.04, Math.min(1, eje.pct))
    return { x: CX + DIRS[i].dx * R * f, y: CY + DIRS[i].dy * R * f }
  })
  const poligono = puntos.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox="0 0 260 214"
      role="img"
      aria-label={ejes.map((e) => `${e.label} ${e.valor}`).join(', ')}
      className="mx-auto block w-full max-w-[272px] text-white/55"
    >
      {/* malla tenue */}
      <g stroke="var(--color-gold)" fill="none" strokeWidth="1">
        {[1, 0.75, 0.5, 0.25].map((f) => (
          <polygon key={f} points={ring(f)} strokeOpacity={f === 1 ? 0.28 : 0.13} />
        ))}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} strokeOpacity={0.12} />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} strokeOpacity={0.12} />
      </g>
      {/* datos en oro */}
      <polygon
        points={poligono}
        fill="var(--color-gold)"
        fillOpacity={0.12}
        stroke="var(--color-gold)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <g fill="var(--color-gold)">
        {puntos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} />
        ))}
      </g>
      {/* etiquetas + valores (mono) */}
      {ejes.map((eje, i) => (
        <g key={eje.label} className="font-mono" textAnchor={LABELS[i].anchor}>
          <text x={LABELS[i].x} y={LABELS[i].y} fontSize="10" fill="currentColor">
            {eje.label}
          </text>
          <text x={LABELS[i].x} y={LABELS[i].vy} fontSize="11" fill="var(--color-gold)">
            {eje.valor}
          </text>
        </g>
      ))}
    </svg>
  )
}

function PersonajeCardBack({
  nombre,
  ejes,
  racha = null, // ["V","D",...] últimos duelos REALES; null ⇒ sección oculta
  anime,
  subtitulo,
  selloKanji,
  numero,
}) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gold/50 bg-surface text-white/90 shadow-xl shadow-black/50">
      {/* marco dorado interior fino */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-[7px] rounded-[10px] border border-gold/20" />

      <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-3 px-6 pb-6 pt-7">
        {/* nombre */}
        <header>
          <h3 className="text-[19px] font-semibold leading-tight">{nombre}</h3>
          <p className="mt-1 font-mono text-[10.5px] text-white/45">perfil de combate</p>
          <div className="mt-4 h-px bg-gold/20" />
        </header>

        {/* radar 4 ejes */}
        <RadarStats ejes={ejes} />

        {/* racha de últimos duelos — solo con dato real */}
        {Array.isArray(racha) && racha.length > 0 && (
          <section aria-label="Últimos duelos">
            <div className="h-px bg-gold/20" />
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[10px] text-white/45">últimos duelos</span>
              <ol className="flex gap-[11px]">
                {racha.map((r, i) => (
                  <li key={i} className="flex flex-col items-center gap-1">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${r === 'V' ? 'bg-accent' : 'bg-electric'}`} />
                    <span aria-hidden="true" className="font-mono text-[8px] text-white/40">{r}</span>
                    <span className="sr-only">{r === 'V' ? 'victoria' : 'derrota'}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* sello del anime */}
        <footer className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selloKanji && (
              <span className="relative flex h-[46px] w-[46px] items-center justify-center rounded-full border border-accent/70">
                <span aria-hidden="true" className="absolute inset-[3px] rounded-full border border-accent/35" />
                <span lang="ja" className="text-[19px] text-accent-text" style={{ fontFamily: 'var(--font-kanji-serif)' }}>
                  {selloKanji}
                </span>
              </span>
            )}
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{anime}</span>
              {subtitulo && (
                <span className="font-mono text-[10px] text-white/45">{subtitulo}</span>
              )}
            </span>
          </div>
          {numero && <span className="font-mono text-[10px] text-white/40">{numero}</span>}
        </footer>
      </div>
    </div>
  )
}

export default PersonajeCardBack
