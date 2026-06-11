import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'
import PersonajeImg from '../../components/PersonajeImg'
import { imagenPersonaje } from '../../lib/personajes-core'
import Top5Slot from './Top5Slot'
import { COMPOSICIONES, KANJI_RANGO, TOP5_VUELO_EVENT } from './top5-altar'

/**
 * Altar de Mi Top 5 — escalonado en profundidad CSS 3D.
 *
 * <p>Sustituye al grid plano de slots en MiTop5Page cuando el contexto lo
 * permite. El nº1 va al frente y elevado con aura dorada; el resto retrocede
 * con translateZ/translateY por rango y "niebla" por opacity. Cada pedestal
 * lleva su numeral kanji grabado (一二三四五).
 *
 * <p><b>Fallbacks</b> (mismo criterio que KanjiInkSplash): móvil (&lt;640px) y
 * prefers-reduced-motion caen al grid plano actual (reusa Top5Slot tal cual,
 * cero código nuevo en ese camino). Suscripción matchMedia viva.
 *
 * <p><b>Vuelo FLIP</b>: cuando el buscador/sugerencias asignan un personaje,
 * llaman a {@link lanzarVueloTop5}(slug, originEl) ANTES o DESPUÉS de
 * addSlugAlPrimerSlotLibre (el orden da igual: el altar concilia por slug).
 * La carta vuela en arco parabólico fingido con WAAPI: X lineal en un
 * wrapper externo + Y en el interno con dos tramos de easing (decelera
 * hasta el ápice, acelera en la caída). Solo transform/opacity — nada de
 * width/top, nada de blur ni filters (jank de WebKit). Aterriza con squash.
 *
 * <p><b>Integración mínima en MiTop5Page</b>:
 * <pre>
 *   - &lt;div className="mb-5 grid grid-cols-5 …"&gt;{slots.map(Top5Slot)}&lt;/div&gt;
 *   + &lt;Top5Altar slots={effectiveSlots} personajesBySlug={personajesBySlug}
 *   +            onQuitar={quitarSlot} /&gt;
 * </pre>
 * Y en Top5QuickSuggestions / AutocompletePersonaje, al asignar:
 * <pre>
 *   onClick={(e) =&gt; { lanzarVueloTop5(personaje.slug, e.currentTarget); onAdd(personaje.slug) }}
 * </pre>
 *
 * <p>Perf: las animaciones en loop (aura del nº1, respiración de la silueta)
 * van con framer-motion gateadas por useInView + useReducedMotion: se pausan
 * fuera del viewport y con reduced-motion. El vuelo es one-shot. Ningún nodo
 * con transform-style: preserve-3d lleva filter/overflow/opacity (la niebla
 * por opacity vive en los HIJOS del nodo preserve-3d).
 */


// Mismo gate que el splash del hub: viewport ≥640px y sin reduced-motion.
const ALTAR_QUERY = '(min-width: 640px) and (prefers-reduced-motion: no-preference)'

function useAltarCapaz() {
  const [capaz, setCapaz] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(ALTAR_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia(ALTAR_QUERY)
    const update = () => setCapaz(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return capaz
}



// Tamaños por rango: carta 2:3, peana y numeral.
const TAMANOS = [
  { cardW: 148, cardH: 222, w: 168, plinthH: 88, kanji: 'text-3xl' },
  { cardW: 120, cardH: 180, w: 138, plinthH: 62, kanji: 'text-xl' },
  { cardW: 120, cardH: 180, w: 138, plinthH: 62, kanji: 'text-xl' },
  { cardW: 106, cardH: 159, w: 122, plinthH: 48, kanji: 'text-lg' },
  { cardW: 106, cardH: 159, w: 122, plinthH: 48, kanji: 'text-lg' },
]

const RESPIRACION = {
  animate: { opacity: [0.45, 0.85, 0.45], scale: [1, 1.03, 1] },
  transition: { duration: 5.8, ease: 'easeInOut', repeat: Infinity },
}

const LATIDO_AURA = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { duration: 4.6, ease: 'easeInOut', repeat: Infinity },
}

/** Silueta de tinta que respira en el slot vacío. */
function SiluetaVacia({ silueta, animar }) {
  const props = animar ? RESPIRACION : { animate: { opacity: 0.6 } }
  if (silueta === 'enso') {
    return (
      <motion.div {...props} className="absolute inset-0 grid place-items-center">
        <div className="aspect-square w-3/5 rounded-full border-8 border-surface-alt/80" />
      </motion.div>
    )
  }
  if (silueta === 'kanji') {
    return (
      <motion.div {...props} className="absolute inset-0 grid place-items-center">
        <span className="font-kanji-serif text-6xl text-surface-alt">誰</span>
      </motion.div>
    )
  }
  // Default: busto de tinta.
  return (
    <motion.div
      {...props}
      className="absolute inset-0 flex flex-col items-center justify-end pb-[12%]"
    >
      <div className="aspect-square w-1/3 rounded-full bg-surface-alt" />
      <div className="-mt-[7%] h-1/3 w-3/4 rounded-t-[48%] bg-surface-alt" />
    </motion.div>
  )
}

function Top5Altar({
  slots,
  personajesBySlug,
  onQuitar,
  composicion = 'ceremonial',
  silueta = 'busto',
}) {
  const capaz = useAltarCapaz()
  const prefiereQuieto = useReducedMotion()
  const rootRef = useRef(null)
  const enVista = useInView(rootRef, { amount: 0.2 })
  const cardRefs = useRef([])
  const [aterrizando, setAterrizando] = useState({})
  const [vueloPendiente, setVueloPendiente] = useState(null)

  const animar = enVista && !prefiereQuieto

  useEffect(() => {
    const onVuelo = (e) => setVueloPendiente(e.detail)
    window.addEventListener(TOP5_VUELO_EVENT, onVuelo)
    return () => window.removeEventListener(TOP5_VUELO_EVENT, onVuelo)
  }, [])

  function lanzarFlip(vuelo, idx, target) {
    setVueloPendiente(null)
    setAterrizando((prev) => ({ ...prev, [idx]: true }))

    const o = vuelo.originRect
    const t = target.getBoundingClientRect()
    const outer = document.createElement('div')
    outer.style.cssText = `position:fixed;left:0;top:0;width:${t.width}px;height:${t.height}px;z-index:60;pointer-events:none;will-change:transform;`
    const inner = document.createElement('div')
    inner.style.cssText = 'width:100%;height:100%;will-change:transform;'
    const visual = document.createElement('div')
    visual.style.cssText =
      'width:100%;height:100%;border-radius:0.5rem;overflow:hidden;border:1px solid var(--color-gold-aura);background:var(--color-surface);box-shadow:var(--shadow-elev-2);'
    const img = document.createElement('img')
    img.src = imagenPersonaje(vuelo.slug)
    img.alt = ''
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:top;'
    visual.appendChild(img)
    inner.appendChild(visual)
    outer.appendChild(inner)
    document.body.appendChild(outer)

    const x0 = o.left + o.width / 2 - t.width / 2
    const y0 = o.top + o.height / 2 - t.height / 2
    const apice = Math.min(y0, t.top) - 150
    const dur = 640
    // Parábola fingida: X lineal + Y con 2 tramos de easing (sube/cae).
    outer.animate(
      [{ transform: `translateX(${x0}px)` }, { transform: `translateX(${t.left}px)` }],
      { duration: dur, easing: 'linear', fill: 'forwards' },
    )
    const caida = inner.animate(
      [
        { transform: `translateY(${y0}px) scale(0.4) rotate(-8deg)`, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
        { transform: `translateY(${apice}px) scale(0.85) rotate(4deg)`, offset: 0.52, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `translateY(${t.top}px) scale(1) rotate(0deg)` },
      ],
      { duration: dur, fill: 'forwards' },
    )
    const finalizar = () => {
      outer.remove()
      setAterrizando((prev) => {
        const next = { ...prev }
        delete next[idx]
        return next
      })
      // Squash de aterrizaje sobre la carta real (transform only).
      const el = cardRefs.current[idx]
      if (el) {
        el.style.transformOrigin = '50% 100%'
        el.animate(
          [
            { transform: 'scaleX(1.16) scaleY(0.8)' },
            { transform: 'scaleX(0.95) scaleY(1.05)', offset: 0.55 },
            { transform: 'scale(1)' },
          ],
          { duration: 340, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
        )
      }
    }
    caida.onfinish = finalizar
    caida.oncancel = finalizar
  }

  // Conciliación del vuelo: cuando el slug pendiente aparece en slots y su
  // carta real ya está montada, lanzamos el FLIP desde originRect hasta
  // ella. Todo el cuerpo (setStates de bookkeeping + WAAPI) va diferido a
  // microtask: la regla react-hooks/set-state-in-effect veta el setState
  // síncrono en el body del effect.
  useEffect(() => {
    const vuelo = vueloPendiente
    if (!vuelo) return
    if (!capaz || prefiereQuieto) {
      queueMicrotask(() => setVueloPendiente(null))
      return
    }
    const idx = slots.indexOf(vuelo.slug)
    if (idx === -1) return
    const target = cardRefs.current[idx]
    if (!target) return
    queueMicrotask(() => lanzarFlip(vuelo, idx, target))
  }, [vueloPendiente, slots, capaz, prefiereQuieto])

  const config = COMPOSICIONES[composicion] ?? COMPOSICIONES.ceremonial

  const pedestales = useMemo(
    () =>
      slots.map((slug, idx) => ({
        slug,
        personaje: slug ? personajesBySlug.get(slug) : null,
        cfg: config[idx],
        tam: TAMANOS[idx],
        idx,
      })),
    [slots, personajesBySlug, config],
  )

  // ── Fallback plano: móvil / reduced-motion = grid compacto actual. ──
  if (!capaz) {
    return (
      <div className="mb-5 grid grid-cols-5 gap-2 sm:mb-8 sm:gap-4">
        {slots.map((slug, i) => (
          <Top5Slot
            key={i}
            slug={slug}
            personaje={slug ? personajesBySlug.get(slug) : null}
            index={i}
            onQuitar={() => onQuitar(i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="relative mb-5 h-[27.5rem] overflow-hidden sm:mb-8"
      style={{ perspective: '1150px', perspectiveOrigin: '50% 24%' }}
    >
      {/* Vaho carmesí al fondo + suelo dorado: gradientes estáticos, sin blur. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-3/5 bg-[radial-gradient(60%_85%_at_50%_0%,var(--color-accent-soft),transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] bottom-1 h-24 bg-[radial-gradient(50%_62%_at_50%_70%,var(--color-gold-soft),transparent_72%)]"
      />
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {pedestales.map(({ slug, personaje, cfg, tam, idx }) => {
          const esUno = idx === 0
          return (
            <div
              key={idx}
              className="absolute flex flex-col items-center"
              style={{
                left: cfg.left,
                bottom: cfg.bottom,
                zIndex: 200 + Math.round(cfg.z),
                opacity: cfg.fog,
                transform: `translateX(-50%) translateZ(${cfg.z}px) translateY(${cfg.y}px) rotateY(${cfg.ry}deg)`,
              }}
            >
              {esUno && (
                <motion.div
                  aria-hidden="true"
                  {...(animar ? LATIDO_AURA : { animate: { opacity: 0.6 } })}
                  className="pointer-events-none absolute -top-9 left-1/2 h-[16.875rem] w-[16.875rem] -translate-x-1/2 bg-[radial-gradient(closest-side,var(--color-gold-aura-soft),transparent_72%)]"
                />
              )}
              <div
                ref={(node) => { cardRefs.current[idx] = node }}
                className="relative"
                style={{ width: tam.cardW, height: tam.cardH }}
              >
                {slug ? (
                  <div
                    className={`group absolute inset-0 overflow-hidden rounded-lg border shadow-elev-2 transition-opacity ${
                      esUno ? 'border-gold/60' : 'border-border'
                    } ${aterrizando[idx] ? 'opacity-0' : 'opacity-100'}`}
                  >
                    <PersonajeImg
                      slug={slug}
                      src={personaje?.imagenUrl ?? personaje?.imagen}
                      alt={personaje?.nombre ?? slug}
                      className="h-full w-full object-cover object-top"
                    />
                    {/* Scrim de legibilidad solo bajo el texto. */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/55 to-transparent p-2 pt-6">
                      <p className="line-clamp-1 text-[12px] font-bold text-fg-strong">
                        {personaje?.nombre ?? slug}
                      </p>
                      <p className="line-clamp-1 text-[10px] text-fg-muted">
                        {personaje?.anime}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuitar(idx)}
                      aria-label={`Quitar ${personaje?.nombre ?? 'personaje'} del top`}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-bg/80 text-[11px] leading-none text-fg-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="absolute inset-0 overflow-hidden rounded-lg border-2 border-dashed border-border/70 bg-bg/50">
                    <SiluetaVacia silueta={silueta} animar={animar} />
                    <span className="sr-only">Slot {idx + 1} vacío</span>
                    <Plus className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 text-fg-muted/50" />
                  </div>
                )}
              </div>
              {/* Peana con numeral kanji grabado. */}
              <div
                className={`relative -mt-0.5 grid place-items-center rounded border border-border/80 bg-gradient-to-b from-surface-alt to-bg shadow-elev-1 ${
                  esUno ? 'border-t-gold/55' : 'border-t-border'
                }`}
                style={{ width: tam.w, height: tam.plinthH }}
              >
                <span
                  className={`font-kanji-serif font-bold leading-none ${tam.kanji} ${
                    esUno
                      ? 'text-gold'
                      : 'text-bg [text-shadow:0_1px_0_color-mix(in_srgb,white_7%,transparent),0_-1px_2px_color-mix(in_srgb,black_85%,transparent)]'
                  }`}
                >
                  {KANJI_RANGO[idx]}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Top5Altar
