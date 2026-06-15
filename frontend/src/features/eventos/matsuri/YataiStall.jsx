import { useEffect, useRef, useState } from 'react'

/**
 * YataiStall — un puesto de festival (yatai) generico con slot de contenido. Da
 * el marco escenografico (toldo a franjas carmesi/oro + tablilla colgante con
 * kanji) a una seccion REAL del evento; el contenido (children) es el dominio
 * real (mision, ranking, podio, roster) y se renderiza intacto.
 *
 * Adaptacion al dominio REAL: la tablilla es DECORATIVA (un <span> aria-hidden,
 * no un heading) para no competir con el <h2> real que vive dentro de children.
 * La <section> se etiqueta con `ariaLabel`. NUNCA introduce un h1/h2 extra: el
 * unico h1 de la pagina es el `titulo` del evento; cada stall envuelve su h2.
 *
 * Entrada: rise 350ms UNA sola vez al entrar en viewport (IntersectionObserver
 * propio). Solo transform/opacity. prefers-reduced-motion -> aparece sin rise.
 *
 * @param {object} props
 * @param {'regla'|'actividad'|'recompensa'|'texto'} props.tipo
 * @param {string} props.titulo  rotulo decorativo de la tablilla
 * @param {string} props.kanji  glifo de la tablilla (de festival-core KANJI_TIPO)
 * @param {string} props.etiqueta  etiqueta mono del tipo
 * @param {'carmin'|'oro'} props.toldo  color del toldo (alternado por el padre)
 * @param {string} props.ariaLabel  etiqueta accesible de la <section>
 * @param {boolean} [props.cerrado]  evento por empezar: persiana bajada
 * @param {boolean} [props.reduce]  prefers-reduced-motion / calma
 * @param {React.ReactNode} props.children  el contenido real del bloque
 */
export default function YataiStall({
  titulo,
  kanji,
  etiqueta,
  toldo,
  ariaLabel,
  cerrado = false,
  reduce = false,
  children,
}) {
  const ref = useRef(null)
  // Sin IntersectionObserver (jsdom/SSR) o con reduced-motion no hay rise: el
  // puesto nace visible. Lazy init -> cero setState sincrono en el effect.
  const [visible, setVisible] = useState(
    () => reduce || typeof IntersectionObserver !== 'function',
  )

  // Ajuste durante el render si `reduce` pasa a true tras montar (patron
  // compiler-safe con guard de valor previo): nunca setState en cuerpo de effect.
  const [prevReduce, setPrevReduce] = useState(reduce)
  if (prevReduce !== reduce) {
    setPrevReduce(reduce)
    if (reduce && !visible) setVisible(true)
  }

  useEffect(() => {
    if (visible) return undefined
    const el = ref.current
    if (!el || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        // setState dentro del callback del observer SI es legal (no es el cuerpo del effect).
        if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect() }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <section
      ref={ref}
      className={`fest-stall fest-stall--${toldo}${cerrado ? ' fest-stall--cerrado' : ''}${visible ? ' is-visible' : ''}`}
      aria-label={ariaLabel}
    >
      <div className="fest-stall__toldo" aria-hidden="true" />
      <div className="fest-stall__tablilla" aria-hidden="true">
        <span className="fest-stall__kanji">{kanji}</span>
        <span className="fest-stall__titulo">{titulo}</span>
        <span className="fest-stall__tipo">{etiqueta}</span>
      </div>
      <div className="fest-stall__body">{children}</div>
      {cerrado && (
        <div className="fest-stall__shutter" aria-hidden="true">
          <span className="fest-stall__shutter-kanji">{'祭'}</span>
          <span>abre al comenzar</span>
        </div>
      )}
    </section>
  )
}
