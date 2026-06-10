import { useEffect, useId, useMemo, useState } from 'react'

// KANJI_STROKES (~23KB gz) llegaba a casi todas las rutas vía
// PersonajePlaceholder siendo puramente decorativo. Se difiere con
// import(): hasta que el chunk resuelve se renderiza el carácter Unicode
// plano (mismo box → cero CLS) y al llegar los paths el SVG anima igual.
let cachedStrokes = null
let strokesPromise = null

function loadStrokes() {
  if (!strokesPromise) {
    strokesPromise = import('../lib/kanjiStrokes').then((mod) => {
      cachedStrokes = mod.KANJI_STROKES
      return cachedStrokes
    })
  }
  return strokesPromise
}

function useKanjiStrokes() {
  const [strokes, setStrokes] = useState(cachedStrokes)
  useEffect(() => {
    if (strokes) return undefined
    let alive = true
    loadStrokes()
      .then((data) => {
        if (alive) setStrokes(data)
      })
      .catch(() => {
        // Sin red para el chunk: queda el fallback Unicode, que ya es
        // contenido legible — no hay nada que romper.
      })
    return () => {
      alive = false
    }
  }, [strokes])
  return strokes
}

/**
 * KanjiStroke — anima un kanji trazo a trazo usando los paths de KanjiVG
 * (CC BY-SA 3.0). Cada trazo se dibuja en el orden oficial japonés con
 * stroke-dasharray + stroke-dashoffset escalonados.
 *
 * <p>Props:
 *   - kanji: string. Puede ser 1 carácter ('戦') o una palabra ('大吉'):
 *     en este último caso renderiza los kanji uno tras otro horizontalmente.
 *   - size: tamaño del SVG (default '1em', usa font-size del padre).
 *   - strokeMs: duración de un trazo individual (default 480).
 *   - gapMs: retardo entre el inicio de un trazo y el siguiente (default 100).
 *   - color: stroke color (default 'currentColor' — hereda del padre).
 *   - strokeWidth: grosor de la tinta sobre viewBox 109x109 (default 5).
 *   - replayKey: si cambia, vuelve a disparar la animación (útil para
 *     repetir al hover, click o cambio de estado). Si se omite, anima
 *     solo al montar.
 *   - className: clases extra para el wrapper.
 *
 * <p>Fallback: si el kanji no está en KANJI_STROKES (no se generó su
 * path), renderiza el carácter Unicode plano dentro de un &lt;span&gt;.
 * No rompe layout.
 *
 * <p>A11y: el wrapper tiene role="img" y aria-label con el kanji para
 * lectores de pantalla. Respeta prefers-reduced-motion vía CSS.
 */
function KanjiStroke({
  kanji,
  size = '1em',
  strokeMs = 480,
  gapMs = 100,
  color = 'currentColor',
  strokeWidth = 5,
  replayKey,
  className = '',
}) {
  const chars = useMemo(() => Array.from(kanji || ''), [kanji])
  if (chars.length === 0) return null
  if (chars.length === 1) {
    return (
      <SingleKanji
        char={chars[0]}
        size={size}
        strokeMs={strokeMs}
        gapMs={gapMs}
        color={color}
        strokeWidth={strokeWidth}
        replayKey={replayKey}
        className={className}
      />
    )
  }
  // Multi-kanji: stagger entre kanjis = (gapMs * 4) extra por kanji
  // para que el segundo empiece cuando el primero ya lleva ~½ animado.
  // Sensación de palabra escribiéndose, no de batch simultáneo.
  return (
    <span
      role="img"
      aria-label={kanji}
      lang="ja"
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {chars.map((c, i) => (
        <SingleKanji
          key={`${c}-${i}-${replayKey ?? ''}`}
          char={c}
          size={size}
          strokeMs={strokeMs}
          gapMs={gapMs}
          color={color}
          strokeWidth={strokeWidth}
          replayKey={replayKey}
          startDelayMs={i * (strokeMs * 0.6)}
        />
      ))}
    </span>
  )
}

function SingleKanji({
  char,
  size,
  strokeMs,
  gapMs,
  color,
  strokeWidth,
  replayKey,
  startDelayMs = 0,
  className = '',
}) {
  const uniqueId = useId() // por si en el futuro añadimos masks/clips por path
  const strokes = useKanjiStrokes()
  const paths = strokes?.[char]
  if (!paths) {
    // Fallback: el carácter Unicode plano, tanto mientras carga el chunk
    // de strokes como para kanji sin path generado. Lectores de pantalla
    // siguen viendo el texto.
    return (
      <span
        aria-label={char}
        lang="ja"
        className={className}
        style={{ display: 'inline-block', width: size, height: size, textAlign: 'center', lineHeight: 1 }}
      >
        {char}
      </span>
    )
  }
  return (
    <svg
      key={replayKey != null ? `${char}-${replayKey}` : char}
      viewBox="0 0 109 109"
      width={size}
      height={size}
      role="img"
      aria-label={char}
      lang="ja"
      className={`kanji-stroke ${className}`}
      style={{ overflow: 'visible' }}
    >
      <g
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <path
            key={`${uniqueId}-${i}`}
            d={d}
            pathLength="1"
            className="kanji-stroke__path"
            style={{
              animationDelay: `${startDelayMs + i * gapMs}ms`,
              animationDuration: `${strokeMs}ms`,
            }}
          />
        ))}
      </g>
    </svg>
  )
}

export default KanjiStroke
