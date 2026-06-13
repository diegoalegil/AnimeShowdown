import { useLayoutEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { AppLink } from './AppLink'
import './section-gate.css'

/* ────────────────────────────────────────────────────────────────
   Observer COMPARTIDO (criterio 3): un único IntersectionObserver
   para todas las puertas de la página. threshold 0.2 sobre la
   <section> contenedora; cada target se des-observa al disparar
   (la ceremonia es una vez por carga — no hay re-entrada).
   ──────────────────────────────────────────────────────────────── */

const gateCallbacks = new WeakMap()
let sharedObserver = null

function getSharedObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const fire = gateCallbacks.get(entry.target)
          if (fire) {
            gateCallbacks.delete(entry.target)
            sharedObserver.unobserve(entry.target)
            fire()
          }
        }
      },
      { threshold: 0.2 },
    )
  }
  return sharedObserver
}

function observeGate(target, onEnter) {
  gateCallbacks.set(target, onEnter)
  getSharedObserver().observe(target)
  return () => {
    gateCallbacks.delete(target)
    sharedObserver?.unobserve(target)
  }
}

/* Fracción visible de la sección respecto a min(altura sección, viewport).
   Se usa SOLO en el mount para decidir "pintada directa" — el progreso
   posterior lo decide el IO compartido. */
function visibleRatio(rect, viewportHeight) {
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
  const base = Math.min(rect.height, viewportHeight)
  return base > 0 ? visible / base : 0
}

/**
 * SectionGate — "puerta del recinto": cabecera reutilizable de las
 * secciones de la home. Dintel con kanji canónico, título h2 real,
 * hairline dorada que se pinta al entrar al viewport (una vez por
 * carga) y tablilla "ver todo" colgada del dintel.
 *
 * Las cards internas de la sección NO cambian: este componente solo
 * sustituye la cabecera (las props eyebrow/title/headerAction que hoy
 * recibe <Section>).
 *
 * Estados (data-gate-state en el <header>, escritos imperativamente
 * vía ref — cero setState, cero re-renders; React Compiler-safe):
 *   - 'idle'     → aún no entró al viewport; la puerta espera sin pintar.
 *   - 'ceremony' → coreografía en curso (hairline 450ms ease-brush,
 *                  kanji 300ms, tablilla 250ms ease-stamp). CSS en
 *                  index.css (bloque "SECTION GATE").
 *   - 'painted'  → pintada directa, sin ceremonia: recarga con scroll
 *                  abajo (la sección ya era visible o quedó arriba en el
 *                  mount), prefers-reduced-motion, o sección ya ≥20%
 *                  visible al montar.
 *
 * Decisión de pintado en el mount (useLayoutEffect para que no haya
 * frame 'idle' visible en recargas con scroll restaurado):
 *   1. reduced-motion             → painted
 *   2. hash === '#'+id            → ceremony (la puerta recibe al visitante)
 *   3. sección arriba del viewport o ya ≥20% visible → painted
 *   4. resto                      → observe (ceremony al cruzar threshold 0.2)
 *
 * Si la sección no tiene contenido, el PADRE no monta la puerta
 * (mismo patrón que SectionTorneosActivos: `if (items.length === 0)
 * return null` — la puerta vive dentro de ese early return).
 *
 * @param {object} props
 * @param {string} props.kanji Kanji canónico de la sección (1 carácter,
 *   con significado documentado — ver mapa kanji→sección en las notas).
 *   Decorativo: va con aria-hidden y lang="ja".
 * @param {string} [props.kanjiMeaning] Significado del kanji ('batalla',
 *   'festival'…). No se renderiza: queda como data-attr para auditoría
 *   del mapa canónico (criterio 5).
 * @param {import('react').ReactNode} props.title Título de la sección
 *   (se renderiza dentro de un <h2> real).
 * @param {import('react').ReactNode} [props.eyebrow] Etiqueta pequeña
 *   sobre el título (mismo rol que el eyebrow de <Section>).
 * @param {string} [props.viewAllTo] Ruta del "ver todo". Sin ella no se
 *   monta la tablilla.
 * @param {string} [props.viewAllLabel='Ver todo'] Texto de la tablilla.
 * @param {string} [props.id] Ancla de la sección (#torneos…). Aplica
 *   scroll-margin-top vía CSS y dispara ceremonia si se llega con hash.
 * @param {string} [props.className] Clases extra para el <header>.
 *
 * @example
 * <SectionGate
 *   id="torneos"
 *   kanji="戦"
 *   kanjiMeaning="batalla"
 *   eyebrow="Torneos"
 *   title="Brackets en marcha"
 *   viewAllTo="/torneos"
 * />
 */
function SectionGate({
  kanji,
  kanjiMeaning,
  title,
  eyebrow,
  viewAllTo,
  viewAllLabel = 'Ver todo',
  id,
  className = '',
}) {
  const headerRef = useRef(null)

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return undefined
    // StrictMode monta doble: si la decisión ya corrió (dataset mutado),
    // no se repite la ceremonia.
    if (el.dataset.gateState !== 'idle') return undefined

    const target = el.closest('section') ?? el

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.dataset.gateState = 'painted'
      return undefined
    }
    if (id && window.location.hash === `#${id}`) {
      el.dataset.gateState = 'ceremony'
      return undefined
    }
    const rect = target.getBoundingClientRect()
    const aboveViewport = rect.bottom <= 0
    if (
      typeof IntersectionObserver === 'undefined' ||
      aboveViewport ||
      visibleRatio(rect, window.innerHeight) >= 0.2
    ) {
      // Ya estaba a la vista (o quedó arriba) en el primer paint:
      // pintada directa, sin re-ceremonia.
      el.dataset.gateState = 'painted'
      return undefined
    }
    return observeGate(target, () => {
      el.dataset.gateState = 'ceremony'
    })
  }, [id])

  const tabletLabel =
    typeof title === 'string' ? `${viewAllLabel} — ${title}` : undefined

  return (
    <header
      ref={headerRef}
      id={id}
      data-gate-state="idle"
      data-kanji-meaning={kanjiMeaning}
      className={`as-gate ${className}`}
    >
      <div className="as-gate__lintel">
        <span className="as-gate__kanji" lang="ja" aria-hidden="true">
          {kanji}
        </span>
        <span className="as-gate__post" aria-hidden="true"></span>
        <div className="as-gate__heading">
          {eyebrow && <span className="as-gate__eyebrow">{eyebrow}</span>}
          <h2 className="as-gate__title">{title}</h2>
        </div>
      </div>
      <span className="as-gate__hairline" aria-hidden="true"></span>
      {viewAllTo && (
        <div className="as-gate__ledge">
          <span className="as-gate__hang">
            <AppLink
              className="as-gate__tablet"
              to={viewAllTo}
              aria-label={tabletLabel}
            >
              {viewAllLabel}
              <ArrowRight className="as-gate__tablet-arrow" aria-hidden="true" />
            </AppLink>
          </span>
        </div>
      )}
    </header>
  )
}

export default SectionGate
