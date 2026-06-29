/**
 * AltarFive — forma final del altar del Top 5 (sustituye a Top5Altar).
 *
 * Cinco peanas escalonadas (la 1ª más alta y centrada) sobre tarima de
 * madera, numerales kanji canónicos 一二三四五, velas votivas pausables
 * y el arte de fondo del nº1 con scrim profundo.
 *
 * Reordenar = ritual: drag con FLIP (WAAPI, solo transform/opacity)
 * + botones ▲▼ por peana (100% teclado) + anuncio aria-live.
 * Cero libs nuevas (sin framer-motion: WAAPI + CSS de feature).
 *
 * React 19 + Compiler safe:
 *  - cero lecturas/escrituras de refs en el render;
 *  - derivados de props con el patrón render-adjust (setState con guard);
 *  - timers/observers solo dentro de effects/callbacks;
 *  - cero Date.now()/Math.random() en render.
 *
 * WAAPI con guard (jsdom no implementa element.animate): en tests el
 * ritual degrada a swap directo, igual que con reduced-motion.
 *
 * @typedef {object} AltarEntry
 * @property {string} slug             Slug canónico del personaje.
 * @property {string} name             Nombre visible.
 * @property {string} [colorDominante] Color dominante (lo consume PersonajeImg).
 *
 * @param {object}   props
 * @param {Array<AltarEntry|null>} props.entries
 *        SIEMPRE longitud 5; índice = puesto (0 → 一). MISMO array (en
 *        slugs) que persiste/comparte mi-top5: el contrato no cambia.
 * @param {(next: Array<AltarEntry|null>, meta: {type:'swap'|'remove', from?:number, to?:number, slug?:string}) => void} [props.onChange]
 *        Recibe el orden completo tras cada ritual. `meta` es informativo.
 * @param {boolean}  [props.readOnly=false]   Sin drag, sin botones.
 * @param {string}   [props.guestUsername]    Modo invitado (implica readOnly).
 * @param {string}   [props.bgSceneSrc]       Arte de fondo del nº1. El PADRE lo
 *        deriva: brandImage(`${slugifyAnime(animeDelN1)}-scene-01`).
 * @param {string}   [props.bgAlt]            Alt del arte de fondo (decorativo por defecto).
 * @param {() => void} [props.onBrowseCatalog] CTA del estado vacío.
 */
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import PersonajeImg from '../../components/PersonajeImg'
import { useSound } from '../../contexts/SoundContext'
import './altar-five.css'

const KANJI = ['一', '二', '三', '四', '五']
/* distancia al centro → stagger de entrada (×80ms) */
const RISE_DELAY = [0, 1, 1, 2, 2]
const EASE_LIFT = 'cubic-bezier(0.16, 1, 0.3, 1)'
const FLIP_MS = 400

const SQUASH_FRAMES = [
  { transform: 'translateY(0) scale(1, 1)' },
  { transform: 'translateY(2px) scale(1.04, 0.93)', offset: 0.45 },
  { transform: 'translateY(0) scale(1, 1)' },
]

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function canAnimate(el) {
  return Boolean(el) && typeof el.animate === 'function'
}

/* con la pestaña oculta no hay frames: swap directo, sin FLIP colgado */
function shouldSkipMotion() {
  return (
    prefersReducedMotion() ||
    (typeof document !== 'undefined' && document.hidden)
  )
}

function entriesSig(list) {
  return list.map((e) => (e ? e.slug : '·')).join('|')
}

function orderText(list) {
  return (
    'Nuevo orden del altar — ' +
    list
      .map((e, i) => 'puesto ' + (i + 1) + ': ' + (e ? e.name : 'vacío'))
      .join(', ') +
    '.'
  )
}

export default function AltarFive({
  entries,
  onChange,
  readOnly = false,
  guestUsername,
  bgSceneSrc,
  bgAlt = '',
  onBrowseCatalog,
}) {
  const { play } = useSound()

  /* normalización pura a 5 puestos */
  const slots = Array.from({ length: 5 }, (_, i) => (entries && entries[i]) || null)
  const sig = entriesSig(slots)
  const isReadOnly = readOnly || Boolean(guestUsername)
  const filled = slots.filter(Boolean).length

  const [dragFrom, setDragFrom] = useState(null)
  const [targetIdx, setTargetIdx] = useState(null)
  const [announce, setAnnounce] = useState('')
  const [offscreen, setOffscreen] = useState(false)

  /* render-adjust canónico: detectar llegadas (slug nuevo en un puesto) */
  const [prevSig, setPrevSig] = useState(sig)
  const [arriving, setArriving] = useState(() => new Set())
  if (prevSig !== sig) {
    const prev = prevSig.split('|')
    const next = slots.map((e) => (e ? e.slug : '·'))
    const fresh = new Set()
    next.forEach((slug, i) => {
      if (slug !== '·' && prev[i] !== slug && !prev.includes(slug)) fresh.add(slug)
    })
    setPrevSig(sig)
    setArriving(fresh)
    // a11y: una llegada (añadir desde sugerencias/buscador) ES un cambio del
    // altar — anunciarla por la misma región aria-live que swap/remove, para
    // que el lector de pantalla no se quede sin el evento más importante.
    // setState en render con guard = adjust-during-render canónico (legal).
    if (fresh.size > 0) {
      const llegada = slots
        .map((e, i) => (e && fresh.has(e.slug) ? e.name + ' al puesto ' + (i + 1) : null))
        .filter(Boolean)
        .join(', ')
      if (llegada) setAnnounce('Añadido a tu altar: ' + llegada + '.')
    }
  }

  const rootRef = useRef(null)
  const cardEls = useRef(new Map()) /* slug → nodo card */
  const slotEls = useRef(new Map()) /* puesto → nodo li */
  const dragRef = useRef(null) /* datos vivos del drag (>1×/frame) */
  const pendingFlipRef = useRef(null) /* rects "first" para el FLIP */
  const pendingFocusRef = useRef(null) /* restaurar foco tras swap por teclado */

  /* llegadas: limpiar la clase tras la animación (timer ⇒ legal) */
  useEffect(() => {
    if (arriving.size === 0) return undefined
    const t = setTimeout(() => setArriving(new Set()), 420)
    return () => clearTimeout(t)
  }, [arriving])

  /* pausa de velas fuera del viewport */
  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver((recs) => {
      setOffscreen(!recs[recs.length - 1].isIntersecting)
    })
    io.observe(node)
    return () => io.disconnect()
  }, [])

  /* FLIP: leer rects pendientes (escritos en handlers) y animar */
  useLayoutEffect(() => {
    const pend = pendingFlipRef.current
    if (pend) {
      pendingFlipRef.current = null
      Object.entries(pend.rects).forEach(([slug, first]) => {
        const el = cardEls.current.get(slug)
        if (!el || !first || !canAnimate(el)) return
        const last = el.getBoundingClientRect()
        const dx = first.left - last.left
        const dy = first.top - last.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        const anim = el.animate(
          [
            { transform: 'translate(' + dx + 'px, ' + dy + 'px)' },
            { transform: 'translate(0px, 0px)' },
          ],
          { duration: FLIP_MS, easing: EASE_LIFT },
        )
        if (slug === pend.primary) {
          anim.finished
            .then(() => {
              /* squash de asiento + golpe de asentar */
              el.animate(SQUASH_FRAMES, { duration: 180, easing: 'ease-out' })
              play('playAcunado')
            })
            .catch(() => {})
        }
      })
    }
    const pf = pendingFocusRef.current
    if (pf) {
      pendingFocusRef.current = null
      const root = rootRef.current
      if (root) {
        const btn = root.querySelector('[data-move="' + pf.slug + ':' + pf.dir + '"]')
        const alt = root.querySelector('[data-move="' + pf.slug + ':' + -pf.dir + '"]')
        const pick = btn && !btn.disabled ? btn : alt
        if (pick) pick.focus()
      }
    }
  })

  /* ---------- ritual de intercambio (camino único: drag y teclado) ---------- */

  function commitSwap(from, to, firstRectOverride, announceText) {
    if (from === to || to < 0 || to > 4) return
    const mover = slots[from]
    if (!mover) return
    const mel = cardEls.current.get(mover.slug)
    const reduced = shouldSkipMotion() || !canAnimate(mel)
    if (!reduced) {
      const rects = {}
      rects[mover.slug] = firstRectOverride || (mel && mel.getBoundingClientRect())
      const other = slots[to]
      if (other) {
        const oel = cardEls.current.get(other.slug)
        if (oel) rects[other.slug] = oel.getBoundingClientRect()
      }
      if (rects[mover.slug]) pendingFlipRef.current = { rects, primary: mover.slug }
    }
    const next = slots.slice()
    next[from] = slots[to] || null
    next[to] = mover
    if (reduced) play('playAcunado')
    if (onChange) onChange(next, { type: 'swap', from, to })
    // El drag puede mover a cualquier puesto → roster completo; el teclado
    // pasa un texto relativo (intercambio concreto) para no recitar los 5.
    setAnnounce(announceText || orderText(next))
  }

  /* ---------- drag (pointer events + setPointerCapture) ---------- */

  function onCardPointerDown(e, idx) {
    if (isReadOnly || !slots[idx]) return
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const rects = []
    for (let i = 0; i < 5; i += 1) {
      const li = slotEls.current.get(i)
      rects[i] = li ? li.getBoundingClientRect() : null
    }
    dragRef.current = {
      idx,
      el,
      rects,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      target: null,
      moved: false,
    }
    /* levita 6px ya al agarrar */
    el.style.transform = 'translate(0px, -6px)'
    setDragFrom(idx)
    setTargetIdx(null)
  }

  function onCardPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    d.dx = e.clientX - d.x
    d.dy = e.clientY - d.y
    if (!d.moved && (Math.abs(d.dx) > 4 || Math.abs(d.dy) > 4)) {
      d.moved = true
      play('playWhoosh')
    }
    /* >1×/frame ⇒ escritura directa al DOM, nunca estado */
    d.el.style.transform = 'translate(' + d.dx + 'px, ' + (d.dy - 6) + 'px)'
    let t = null
    for (let i = 0; i < 5; i += 1) {
      const r = d.rects[i]
      if (!r) continue
      if (
        e.clientX >= r.left - 6 &&
        e.clientX <= r.right + 6 &&
        e.clientY >= r.top - 20 &&
        e.clientY <= r.bottom + 20
      ) {
        t = i
        break
      }
    }
    if (t === d.idx) t = null
    if (t !== d.target) {
      d.target = t
      setTargetIdx(t) /* setState en handler, solo al cambiar de hueco */
    }
  }

  function onCardPointerUp() {
    finishDrag(true)
  }
  function onCardPointerCancel() {
    finishDrag(false)
  }

  function finishDrag(commit) {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setDragFrom(null)
    setTargetIdx(null)
    const goal = commit ? d.target : null
    if (goal !== null && goal !== undefined && goal !== d.idx) {
      /* "first" = posición arrastrada (con transform); se LIMPIA el inline
         ANTES del swap: el .af-card del puesto de origen no tiene key propia,
         así que React reusa ese nodo para el otro personaje — si no se limpia,
         hereda el offset del arrastre. El FLIP arranca igual desde `first`. */
      const first = d.el.getBoundingClientRect()
      d.el.style.transform = ''
      commitSwap(d.idx, goal, first)
      return
    }
    /* vuelta a casa */
    const { el, dx, dy, moved } = d
    el.style.transform = ''
    if (moved && !shouldSkipMotion() && canAnimate(el)) {
      el.animate(
        [
          { transform: 'translate(' + dx + 'px, ' + (dy - 6) + 'px)' },
          { transform: 'translate(0px, 0px)' },
        ],
        { duration: 250, easing: EASE_LIFT },
      )
    }
  }

  /* ---------- teclado ---------- */

  function moveByRank(idx, dir) {
    const mover = slots[idx]
    if (!mover) return
    pendingFocusRef.current = { slug: mover.slug, dir }
    play('playClick')
    const otra = slots[idx + dir]
    const texto =
      mover.name +
      ' al puesto ' +
      (idx + dir + 1) +
      ' (intercambia con ' +
      (otra ? otra.name : 'puesto vacío') +
      ').'
    commitSwap(idx, idx + dir, undefined, texto)
  }

  function removeAt(idx) {
    const gone = slots[idx]
    if (!gone) return
    const next = slots.slice()
    next[idx] = null
    play('playClick')
    if (onChange) onChange(next, { type: 'remove', slug: gone.slug })
    setAnnounce(gone.name + ' retirado del altar. ' + orderText(next))
  }

  /* ---------- render ---------- */

  const setCardEl = (slug) => (el) => {
    if (el) cardEls.current.set(slug, el)
    else cardEls.current.delete(slug)
  }
  const setSlotEl = (i) => (el) => {
    if (el) slotEls.current.set(i, el)
    else slotEls.current.delete(i)
  }

  return (
    <section
      ref={rootRef}
      className={'af-altar' + (offscreen ? ' is-offscreen' : '')}
      data-readonly={isReadOnly ? 'true' : 'false'}
      aria-label={guestUsername ? 'Altar de ' + guestUsername : 'Tu altar del Top 5'}
    >
      <div className="af-bg" aria-hidden="true">
        {bgSceneSrc ? (
          <img className="af-bg__img" src={bgSceneSrc} alt={bgAlt} loading="lazy" decoding="async" />
        ) : null}
        <div className="af-bg__scrim"></div>
      </div>

      <span className="af-watermark" aria-hidden="true" lang="ja">誓</span>

      {guestUsername ? (
        <div className="af-guest">
          Altar de <strong>@{guestUsername}</strong>
        </div>
      ) : null}

      <div className="af-stage">
        <ol className="af-row">
          {slots.map((entry, i) => (
            <li
              key={'slot-' + i}
              ref={setSlotEl(i)}
              className={
                'af-slot af-slot--r' + (i + 1) + (targetIdx === i ? ' is-target' : '')
              }
              style={{ '--af-d': RISE_DELAY[i] }}
              aria-label={'Puesto ' + (i + 1) + ': ' + (entry ? entry.name : 'vacío')}
            >
              <div className="af-perch">
                {entry ? (
                  <div className={'af-cardwrap' + (dragFrom === i ? ' is-lifted' : '')}>
                    <div className="af-card-shadow" aria-hidden="true"></div>
                    <div
                      ref={setCardEl(entry.slug)}
                      className={
                        'af-card' +
                        (dragFrom === i ? ' is-dragging' : '') +
                        (arriving.has(entry.slug) ? ' is-arriving' : '')
                      }
                      data-slug={entry.slug}
                      onPointerDown={(e) => onCardPointerDown(e, i)}
                      onPointerMove={onCardPointerMove}
                      onPointerUp={onCardPointerUp}
                      onPointerCancel={onCardPointerCancel}
                    >
                      <PersonajeImg
                        slug={entry.slug}
                        colorDominante={entry.colorDominante}
                        alt={entry.name}
                        loading="lazy"
                        sizes="(max-width: 600px) 20vw, 220px"
                        fit="cover"
                      />
                      <span className="af-card__name">{entry.name}</span>
                      {!isReadOnly ? (
                        <button
                          type="button"
                          className="af-card__remove"
                          aria-label={'Quitar a ' + entry.name + ' del altar'}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => removeAt(i)}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="af-socket" aria-hidden="true"></div>
                )}
              </div>

              <div className="af-pedestal">
                <span
                  className={'af-numeral' + (entry ? '' : ' is-off')}
                  aria-hidden="true"
                  lang="ja"
                >
                  {KANJI[i]}
                </span>
              </div>

              {!isReadOnly ? (
                <div className="af-moves">
                  <button
                    type="button"
                    className="af-move"
                    data-move={entry ? entry.slug + ':-1' : undefined}
                    disabled={!entry || i === 0}
                    aria-label={
                      !entry
                        ? 'Puesto vacío'
                        : i === 0
                          ? entry.name + ' ya está en el primer puesto'
                          : 'Subir a ' + entry.name + ' al puesto ' + i
                    }
                    onClick={() => moveByRank(i, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="af-move"
                    data-move={entry ? entry.slug + ':1' : undefined}
                    disabled={!entry || i === 4}
                    aria-label={
                      !entry
                        ? 'Puesto vacío'
                        : i === 4
                          ? entry.name + ' ya está en el último puesto'
                          : 'Bajar a ' + entry.name + ' al puesto ' + (i + 2)
                    }
                    onClick={() => moveByRank(i, 1)}
                  >
                    ▼
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="af-base" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <div key={'c' + n} className="af-candle" style={{ left: n * 20 + '%' }}>
              <span className="af-candle__glow af-candle__glow--a"></span>
              <span className="af-candle__glow af-candle__glow--b"></span>
              <span className="af-candle__stub"></span>
              <span className="af-candle__flame"></span>
            </div>
          ))}
          <div className="af-tarima"></div>
          <div className="af-tarima-front"></div>
        </div>
      </div>

      {filled === 0 ? (
        <div className="af-empty">
          <span className="af-empty__kanji" aria-hidden="true" lang="ja">誓</span>
          <h3 className="af-empty__title">Construye tu altar</h3>
          <p className="af-empty__sub">
            {guestUsername
              ? 'Este altar aún está vacío.'
              : 'Toca una sugerencia rápida o búscalos abajo.'}
          </p>
          {!isReadOnly ? (
            <button type="button" className="af-cta" onClick={onBrowseCatalog}>
              Elegir personajes
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="af-sr" aria-live="polite">
        {announce}
      </div>
    </section>
  )
}
