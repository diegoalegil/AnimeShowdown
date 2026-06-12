import { useEffect, useState } from 'react'
import { useSound } from '../../../contexts/SoundContext'
import './catalogo-archivo.css'

/**
 * Chip de filtro del índice del archivo con mini-sello hanko.
 *
 * <p>El sello CAE al activar (250ms ease-stamp, overshoot + sangrado
 * +110ms) y SE LEVANTA al desactivar (180ms inverso): para coreografiar
 * la salida, el nodo permanece montado 200ms tras soltar. aria-pressed
 * es veraz en todo momento (cambia síncrono con el estado del filtro).
 *
 * <p>Sonido: playAcunado (el golpe de sello de lib/sounds.js) al
 * estampar; respeta el mute global vía SoundContext.
 *
 * @param {object} props
 * @param {string} props.label     Texto del chip (nombre del universo).
 * @param {number} [props.count]   Conteo mostrado en font-mono.
 * @param {boolean} props.pressed  Filtro activo.
 * @param {() => void} props.onToggle
 */
function FilterStampChip({ label, count, pressed, onToggle }) {
  const { play } = useSound()
  const [fase, setFase] = useState(pressed ? 'cae' : null)
  const [prev, setPrev] = useState(pressed)

  // Ajuste durante render (patrón sancionado): la fase cambia síncrona
  // con el prop para que aria-pressed y sello nunca se desincronicen.
  if (prev !== pressed) {
    setPrev(pressed)
    setFase(pressed ? 'cae' : 'leva')
  }

  // El sello levantado permanece montado 200ms para coreografiar la
  // salida; el desmonte va por timer (async, no sync-en-effect).
  useEffect(() => {
    if (fase !== 'leva') return undefined
    const t = setTimeout(() => setFase(null), 200)
    return () => clearTimeout(t)
  }, [fase])

  return (
    <button
      type="button"
      className="cat-chip"
      aria-pressed={pressed}
      onClick={() => {
        play('playAcunado')
        onToggle()
      }}
    >
      {label}
      {count != null && <span className="cat-chip__n">{count}</span>}
      {fase && (
        <span className="cat-chip__sello" data-fase={fase} aria-hidden="true">
          選
        </span>
      )}
    </button>
  )
}

export default FilterStampChip
