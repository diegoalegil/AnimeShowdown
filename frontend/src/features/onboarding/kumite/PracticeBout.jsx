import { useState } from 'react'
import PersonajeImg from '../../../components/PersonajeImg'

/**
 * PracticeBout — el duelo dummy de los ejercicios 1 (EL VOTO) y 2 (EL EMPATE).
 *
 * <p>NUNCA llama a la red: el padre pasa dos personajes de práctica del catálogo
 * real ({slug,nombre,anime}); el arte carga lazy y pequeño (maxSourceWidth 300).
 * `activeStep` dicta qué gesto cuenta:
 *  · 'voto'   → tocar una carta emite el voto y ESTAMPA 票 (ease-stamp) en ella.
 *  · 'empate' → tocar la balanza central declara el empate (同).
 * El control del gesto activo está habilitado y resaltado; el resto queda
 * deshabilitado, así no hay interacción inválida posible ("fallos NO existen":
 * lo prevenimos en vez de castigarlo con wiggle). onGesto(id) avisa al padre una
 * sola vez. Cartas y balanza son <button> reales (≥44px, teclado completo).
 *
 * @param {object} props
 * @param {{slug:string,nombre:string,anime?:string}} props.izquierda
 * @param {{slug:string,nombre:string,anime?:string}} props.derecha
 * @param {'voto'|'empate'} props.activeStep  Gesto que cuenta ahora.
 * @param {(id:'voto'|'empate')=>void} props.onGesto  Notifica la superación.
 * @param {boolean} [props.reducedMotion]  true → el sello aparece sin overshoot.
 */
function PracticeBout({ izquierda, derecha, activeStep, onGesto, reducedMotion = false }) {
  const [votado, setVotado] = useState(null) // slug de la carta votada (estampa 票)
  const esVoto = activeStep === 'voto'
  const esEmpate = activeStep === 'empate'

  const votar = (p) => {
    if (!esVoto || votado) return
    setVotado(p.slug)
    onGesto?.('voto')
  }
  const empatar = () => {
    if (esEmpate) onGesto?.('empate')
  }

  const carta = (p) => (
    <button
      type="button"
      className="kumite-bout__carta"
      onClick={() => votar(p)}
      disabled={!esVoto}
      aria-label={esVoto ? `Votar por ${p.nombre}` : p.nombre}
    >
      <PersonajeImg
        slug={p.slug}
        nombre={p.nombre}
        alt=""
        sizes="120px"
        maxSourceWidth={300}
        loading="lazy"
        className="kumite-bout__art"
      />
      <span className="kumite-bout__nombre">{p.nombre}</span>
      {votado === p.slug && (
        <span
          lang="ja"
          aria-hidden="true"
          className={`kumite-bout__sello font-kanji-serif${reducedMotion ? '' : ' kumite-bout__sello--stamp'}`}
        >
          票
        </span>
      )}
    </button>
  )

  return (
    <div className="kumite-bout" role="group" aria-label="Duelo de práctica">
      {carta(izquierda)}
      <button
        type="button"
        className="kumite-bout__balanza"
        onClick={empatar}
        disabled={!esEmpate}
        aria-label="Declarar empate: no puedo decidir"
      >
        <span lang="ja" aria-hidden="true" className="kumite-bout__balanza-kanji font-kanji-serif">
          同
        </span>
        <span className="kumite-bout__balanza-txt">Empate</span>
      </button>
      {carta(derecha)}
    </div>
  )
}

export default PracticeBout
