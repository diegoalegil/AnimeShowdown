import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useSound } from '../contexts/SoundContext'
import {
  subscribe,
  getSnapshot,
  dismiss,
  hold,
  remove,
  setMotionOff,
  setMaxVisible,
  setSoundFn,
} from './dispatch-toast-store'
import './dispatch-toast.css'

/**
 * Vista (viewport) de los Partes de combate. SEPARADA del store
 * (DispatchToast.jsx) a propósito: este módulo importa framer-motion y se
 * carga con React.lazy desde el wrapper `Toaster` de DispatchToast, de modo
 * que framer NO entra en el chunk eager `app-runtime` que importan los 65
 * call-sites de `toast`. El store es la única fuente de verdad; aquí solo se
 * lee el snapshot y se reenvían intenciones (descartar/pausar/retirar).
 *
 * Requiere en @theme: --ease-stamp: cubic-bezier(0.34, 1.56, 0.64, 1);
 */

const KANJI_PARTE = { success: '成', error: '否', info: '報', achievement: '章' }
const TIPO_LABEL = {
  success: 'Parte logrado',
  error: 'Parte rechazado',
  info: 'Parte informativo',
  achievement: 'Parte de logro',
}
const EASE_BRUSH = [0.65, 0.05, 0.36, 1]

/**
 * Una tira de parte. El drag horizontal es framer (umbral 30% del ancho o
 * velocidad >600 px/s; rebote elástico si no llega). La salida natural es
 * CSS (clase data-leaving sobre .dt-card) para no pisar el transform que
 * framer escribe en .dt-strip.
 *
 * @param {object} props
 * @param {object} props.t Parte del store.
 * @param {number} props.depth 0 = la más nueva; 1-2 se compactan (CSS).
 * @param {boolean} props.motionOff prefers-reduced-motion.
 */
function ParteToast({ t, depth, motionOff }) {
  const stripRef = useRef(null)
  const [flung, setFlung] = useState(null)

  const onDragEnd = (event, info) => {
    const el = stripRef.current
    const w = el ? el.offsetWidth : 360
    const past = Math.abs(info.offset.x) > w * 0.3 || Math.abs(info.velocity.x) > 600
    if (past) {
      const dir = (info.offset.x || info.velocity.x) >= 0 ? 1 : -1
      dismiss(t.id, 'swipe')
      setFlung({ x: dir * w * 1.35, r: dir * 4 })
    } else if (el && !el.matches(':hover')) {
      hold(t.id, false)
    }
  }

  const onCardTransitionEnd = (e) => {
    if (t.leaving === 'natural' && e.propertyName === 'opacity') remove(t.id)
  }

  const kanji = KANJI_PARTE[t.type] || '報'

  return (
    <motion.li
      layout={!motionOff}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="dt-parte"
      data-type={t.type}
      data-depth={depth}
      data-held={t.held ? 'true' : 'false'}
      data-fuse={t.ttl > 0 ? 'live' : 'off'}
      data-leaving={t.leaving || undefined}
      tabIndex={t.action ? 0 : undefined}
      aria-label={`${TIPO_LABEL[t.type]}: ${t.title}${t.data ? ` — ${t.data}` : ''}`}
      onFocus={() => hold(t.id, true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hold(t.id, false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss(t.id, 'natural')
      }}
    >
      <div className="dt-card" onTransitionEnd={onCardTransitionEnd}>
        <motion.div
          ref={stripRef}
          className="dt-strip"
          style={t.ttl > 0 ? { '--dt-ttl': `${t.ttl}ms` } : undefined}
          drag={!t.leaving && !flung && !motionOff ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.85}
          dragSnapToOrigin
          onDragStart={() => hold(t.id, true)}
          onDragEnd={onDragEnd}
          animate={flung ? { x: flung.x, rotate: flung.r, opacity: 0 } : undefined}
          transition={flung ? { duration: 0.2, ease: EASE_BRUSH } : undefined}
          onAnimationComplete={() => {
            if (flung) remove(t.id)
          }}
          onHoverStart={() => hold(t.id, true)}
          onHoverEnd={() => hold(t.id, false)}
        >
          <span className="dt-seal" aria-hidden="true" lang="ja">
            <span>{kanji}</span>
          </span>
          <p className="dt-line">
            <span className="dt-title">{t.title}</span>
            {t.data ? <span className="dt-data">{t.data}</span> : null}
          </p>
          {t.action ? (
            <button
              type="button"
              className="dt-action"
              onClick={() => {
                try {
                  t.action.onClick?.()
                } finally {
                  dismiss(t.id, 'natural')
                }
              }}
            >
              {t.action.label}
            </button>
          ) : null}
          <button type="button" className="dt-close" aria-label="Cerrar parte" onClick={() => dismiss(t.id, 'natural')}>
            ✕
          </button>
          <span className="dt-watermark" aria-hidden="true" lang="ja">
            {kanji}
          </span>
          <span className="dt-fuse" aria-hidden="true"></span>
        </motion.div>
      </div>
    </motion.li>
  )
}

/**
 * Viewport de los Partes de combate. Lo monta el wrapper lazy `Toaster` de
 * DispatchToast.jsx (que App.jsx renderiza en el lugar del <Toaster /> de
 * sonner, dentro de SoundProvider).
 *
 * @param {object} props
 * @param {number} [props.maxVisible=3] Pila máxima simultánea; el resto espera en cola FIFO.
 * @param {boolean} [props.sound=true] Golpe playAcunado al estampar (respeta el mute global vía SoundContext).
 * @param {string} [props.className] Clases extra para el viewport (p.ej. ajustar top).
 */
export default function DispatchToasterView({ maxVisible: maxProp = 3, sound = true, className = '' }) {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const reduced = useReducedMotion()
  const { play } = useSound()

  // Config del store: efectos de sincronización, idempotentes.
  useLayoutEffect(() => {
    setMotionOff(reduced)
  }, [reduced])
  useLayoutEffect(() => {
    setMaxVisible(maxProp)
  }, [maxProp])
  useLayoutEffect(() => {
    setSoundFn(sound ? () => play('playAcunado') : null)
    return () => {
      setSoundFn(null)
    }
  }, [sound, play])

  const shown = state.active.slice().reverse() // la más nueva arriba

  return (
    <section className={`dt-viewport ${className}`} data-motion={reduced ? 'off' : 'on'} aria-label="Partes del cuartel">
      {/* Las regiones aria-live viven EAGER en DispatchToast.jsx (persistentes
          desde el primer render, no en esta vista lazy) — ver a11y.spec. */}
      <ol className="dt-stack">
        {shown.map((t, i) => (
          <ParteToast key={t.id} t={t} depth={Math.min(i, 2)} motionOff={Boolean(reduced)} />
        ))}
      </ol>
      {state.queue.length > 0 ? (
        <div className="dt-queue" aria-hidden="true">
          +{state.queue.length} en cola · FIFO
        </div>
      ) : null}
    </section>
  )
}
