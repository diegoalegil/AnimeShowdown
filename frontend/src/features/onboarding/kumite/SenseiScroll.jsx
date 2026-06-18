import { useEffect, useRef } from 'react'

/**
 * SenseiScroll — el pergamino lateral del sensei. Por cada ejercicio del kumite
 * "traza" el kanji-concepto y escribe la lección + el gesto esperado.
 *
 * <p>El trazo NO usa stroke-paths (KanjiStroke no tiene datos para 票/同/索/記):
 * es un CORTE DE TINTA del lenguaje de la casa — una tapa que se retira con
 * translateX y filo dorado, revelando el kanji (font-kanji-serif). Solo
 * transform/opacity (60fps). Con reduced-motion el kanji aparece escrito, sin
 * corte. El kanji es decorativo (aria-hidden): el equivalente textual es la
 * lección + la instrucción, que SÍ se anuncian.
 *
 * <p>Layout: pergamino lateral en ≥sm; banda superior a 390px (CSS, sin prop).
 * Al acertar, el padre incrementa `nod` y el pergamino asiente (rota 2° y
 * vuelve) con WAAPI — un gesto one-shot, sin setState en effect ni re-montaje.
 *
 * @param {object} props
 * @param {import('./kumite-core').KumiteStep} props.step  Ejercicio actual.
 * @param {number} [props.nod]  Contador de asentimientos; cada incremento dispara
 *   el gesto de "el sensei asiente" (2°). No anima en el primer render.
 * @param {boolean} [props.reducedMotion]  true → sin corte de tinta ni asentir.
 */
function SenseiScroll({ step, nod = 0, reducedMotion = false }) {
  const scrollRef = useRef(null)
  const prevNod = useRef(nod)

  // Asentir = gesto one-shot por cada incremento de `nod`, vía WAAPI (no setState
  // en el cuerpo del effect — regla del Compiler; el spec lo prohíbe). El primer
  // render no anima (prevNod arranca igual a nod). Escribir un ref en effect sí
  // es legal (la regla es sobre el render).
  useEffect(() => {
    if (nod === prevNod.current) return
    prevNod.current = nod
    const el = scrollRef.current
    if (reducedMotion || !el || typeof el.animate !== 'function') return
    el.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0deg)' }],
      { duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }, [nod, reducedMotion])

  return (
    <aside ref={scrollRef} className="kumite-sensei" aria-label="El sensei">
      <p className="kumite-sensei__ordinal font-mono" aria-hidden="true">
        第 {step.ordinal} 問
      </p>

      {/* Trazo del concepto: kanji revelado por corte de tinta. Decorativo. */}
      <div className="kumite-sensei__trazo" aria-hidden="true">
        <span lang="ja" className="kumite-sensei__kanji font-kanji-serif">
          {step.kanji}
        </span>
        {!reducedMotion && <span className="kumite-sensei__cut" key={`cut-${step.id}`} />}
      </div>

      {/* Equivalente textual REAL (lo que se anuncia y queda si no hay motion).
          role=status: al cambiar de ejercicio el lector anuncia el paso nuevo
          (título + concepto + instrucción), no solo el aria-current del cordón. */}
      <div role="status">
        <h3 className="kumite-sensei__titulo">
          Ejercicio {step.ordinal} de 4 · {step.titulo}
        </h3>
        <p className="kumite-sensei__concepto">{step.concepto}</p>
        <p className="kumite-sensei__instruccion">{step.instruccion}</p>
      </div>
    </aside>
  )
}

export default SenseiScroll
