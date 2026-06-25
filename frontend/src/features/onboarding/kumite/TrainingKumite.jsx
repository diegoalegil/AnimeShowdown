import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useSoundOptional } from '../../../contexts/SoundContext'
import SenseiScroll from './SenseiScroll'
import PracticeBout from './PracticeBout'
import PracticeSearch from './PracticeSearch'
import {
  KUMITE_STEPS,
  CEREMONIA_SELLO,
  siguientePaso,
  kumiteCompleto,
} from './kumite-core'
import './kumite.css'

/**
 * TrainingKumite — orquestador del KUMITE DE INICIACIÓN (pieza 122): convierte el
 * onboarding en 4 ejercicios reales sobre una maqueta SIN red, guiados por el
 * SenseiScroll. Cada ejercicio superado anuda un cordón; los 4 → ceremonia del
 * cinturón (lazo SVG + sello 誓 + campanilla) y onComplete().
 *
 * <p>Saltable SIEMPRE (Esc o botón "ya entrené", ≤2 interacciones) vía onSkip.
 * Focus-trap suave dentro del overlay. La persistencia del "ya entrenado" es del
 * PADRE (clave de localStorage del onboarding existente) — aquí solo se notifica.
 * La ceremonia se dispara UNA vez (ref guard), no se re-lanza en re-render.
 *
 * @param {object} props
 * @param {{slug:string,nombre:string,anime?:string}} props.izquierda  Carta de práctica izq (ej.1-2).
 * @param {{slug:string,nombre:string,anime?:string}} props.derecha    Carta de práctica der (ej.1-2).
 * @param {{slug:string,nombre:string,anime?:string}} props.objetivo   Personaje a buscar (ej.3).
 * @param {(id:string)=>void} [props.onGesto]  Notifica cada superación al padre (progreso real).
 * @param {()=>void} props.onComplete  Kumite terminado (tras la ceremonia).
 * @param {()=>void} props.onSkip      Saltar el entrenamiento.
 */
function TrainingKumite({ izquierda, derecha, objetivo, onGesto, onComplete, onSkip }) {
  const reduced = useReducedMotion() ?? false
  const { play } = useSoundOptional()
  const [completados, setCompletados] = useState(() => new Set())
  const [nod, setNod] = useState(0)
  const rootRef = useRef(null)
  const ceremoniaRef = useRef(false)

  const pasoActual = siguientePaso(completados)
  const completo = kumiteCompleto(completados)

  const superar = useCallback((id) => {
    setCompletados((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setNod((n) => n + 1)
    onGesto?.(id)
  }, [onGesto])

  // Foco al overlay al montar (rAF, no síncrono).
  useEffect(() => {
    const id = requestAnimationFrame(() => rootRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  // Focus-trap suave + Esc = saltar.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkip?.()
        return
      }
      if (e.key !== 'Tab') return
      // Excluye disabled e invisibles: un botón deshabilitado como primero/último
      // del set rompía el trap (no recibe foco) y dejaba escapar el Tab del modal.
      const foco = Array.from(
        el.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null)
      if (foco.length === 0) return
      const primero = foco[0]
      const ultimo = foco[foco.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [onSkip])

  // Ceremonia ONE-SHOT: al completar los 4, campanilla + cierre tras la
  // animación. ref guard => no se re-dispara en re-render. play/onComplete fuera
  // de deps (se leen al disparar; meterlos re-correría al togglear mute).
  useEffect(() => {
    if (!completo || ceremoniaRef.current) return undefined
    ceremoniaRef.current = true
    play('playCampanilla')
    const t = setTimeout(() => onComplete?.(), reduced ? 700 : 1600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completo])

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Kumite de iniciación: entrenamiento de 4 ejercicios"
      className={`kumite${reduced ? '' : ' kumite--telon'}`}
    >
      <div className="kumite__panel">
        <header className="kumite__head">
          <p className="kumite__eyebrow font-mono" aria-hidden="true">Kumite · entrenamiento</p>
          <button type="button" className="kumite__skip" onClick={() => onSkip?.()}>
            Ya entrené
          </button>
        </header>

        {/* Progreso de cordones: lista ordenada con aria-current en el activo. */}
        <ol className="kumite__cordones" aria-label="Progreso del kumite">
          {KUMITE_STEPS.map((s) => {
            const hecho = completados.has(s.id)
            const actual = pasoActual?.id === s.id
            return (
              <li
                key={s.id}
                className={`kumite__cordon${hecho ? ' kumite__cordon--hecho' : ''}`}
                aria-current={actual ? 'step' : undefined}
              >
                <span className="kumite__cordon-num font-mono" aria-hidden="true">{s.ordinal}</span>
                <span className="kumite__cordon-label">{s.cordon}</span>
                {hecho && <span className="kumite__cordon-check" aria-hidden="true">✓</span>}
              </li>
            )
          })}
        </ol>

        {completo ? (
          <div className="kumite__ceremonia" role="status">
            {/* El cinturón se ata: lazo trazado (stroke-dashoffset) + sello 誓. */}
            <svg className="kumite__lazo" viewBox="0 0 120 60" aria-hidden="true" fill="none">
              <path
                className="kumite__lazo-path"
                d="M12 30 H108 M60 30 C42 12 42 48 60 30 C78 12 78 48 60 30"
              />
            </svg>
            <span lang="ja" aria-hidden="true" className="kumite__sello font-kanji-serif">
              {CEREMONIA_SELLO}
            </span>
            <p className="kumite__ceremonia-txt">Cinturón completo. Ya sabes lo esencial — ahora la arena es tuya.</p>
          </div>
        ) : pasoActual ? (
          <div className="kumite__acto">
            <SenseiScroll step={pasoActual} nod={nod} reducedMotion={reduced} />

            <div className="kumite__ejercicio">
              {(pasoActual.id === 'voto' || pasoActual.id === 'empate') && (
                <PracticeBout
                  izquierda={izquierda}
                  derecha={derecha}
                  activeStep={pasoActual.id}
                  onGesto={superar}
                  reducedMotion={reduced}
                />
              )}
              {pasoActual.id === 'busqueda' && (
                <PracticeSearch objetivo={objetivo} onGesto={superar} />
              )}
              {pasoActual.id === 'archivo' && (
                <div className="kumite-archivo">
                  <p className="kumite-archivo__titulo">Tu primer rastro</p>
                  <ul className="kumite-archivo__lista">
                    <li>
                      <span className="kumite-archivo__pos font-mono" aria-hidden="true">1</span>
                      {izquierda.nombre}
                    </li>
                    <li>
                      <span className="kumite-archivo__pos font-mono" aria-hidden="true">2</span>
                      {derecha.nombre}
                    </li>
                  </ul>
                  <p className="kumite-archivo__nota">
                    Cada voto se guarda aquí: tu ranking personal se escribe solo.
                  </p>
                  <button
                    type="button"
                    className="kumite-archivo__ok"
                    onClick={() => superar('archivo')}
                  >
                    Entendido
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default TrainingKumite
