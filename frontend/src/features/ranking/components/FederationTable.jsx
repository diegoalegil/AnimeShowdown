import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  computeFlipMoves,
  computeRankShifts,
  snapshotOffsets,
} from '../live-flip'
import FederationRow, { FederationRowSkeleton } from './FederationRow'
import './federation-table.css'

/* ---- Timings de la coreografía (notas de handoff §Timing) ---- */
const FLIP_DURATION_MS = 450
const RIBBON_IN_MS = 200
const RIBBON_TOTAL_MS = 1200
const MAX_ANIMATED_ROW_MOVES = 8 // ráfaga WS: >8 filas → barrido único
const BURST_SWEEP_MS = 150
const ENTRANCE_ROWS = 12
const ENTRANCE_WINDOW_MS = ENTRANCE_ROWS * 30 + 300 + 80
const ANNOUNCE_EVERY_MS = 3000
const VIEWPORT_MARGIN_PX = 200
const CV_FROM_INDEX = 18
const SKELETON_ROWS = 9

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * FLIP + cinta + delta del Registro. Construido SOBRE live-flip.js (mismas
 * primitivas que useFlipList); difiere en la coreografía: 450ms ease-lift,
 * cinta lateral [data-fed-ribbon] 1.2s y delta [data-fed-delta] junto al
 * puesto. Todo por WAAPI con refs — cero re-render por frame, cero estado.
 *
 * Ráfaga de WS (>MAX_ANIMATED_ROW_MOVES filas en el mismo commit): SIN
 * animación individual; un único barrido de opacity de 150ms en el tbody.
 *
 * reduced-motion: ni FLIP ni stagger; la fila aparece ya en su sitio y la
 * cinta se muestra estática 1.2s (solo opacity).
 */
function useFederationFlip(tbodyRef, order, { onShifts }) {
  const prevOffsetsRef = useRef(null)
  const prevOrderRef = useRef(null)

  // Resize invalida el snapshot (mismo patrón que useFlipList).
  useEffect(() => {
    const listEl = tbodyRef.current
    if (!listEl || typeof ResizeObserver === 'undefined') return undefined
    let lastWidth = null
    const observer = new ResizeObserver((entries) => {
      const width = entries[entries.length - 1]?.contentRect?.width
      if (lastWidth !== null && width !== lastWidth) {
        prevOffsetsRef.current = null
      }
      lastWidth = width
    })
    observer.observe(listEl)
    return () => observer.disconnect()
  }, [tbodyRef])

  useLayoutEffect(() => {
    const listEl = tbodyRef.current
    const prevOffsets = prevOffsetsRef.current
    const prevOrder = prevOrderRef.current
    const nextOffsets = snapshotOffsets(listEl)
    prevOffsetsRef.current = nextOffsets
    prevOrderRef.current = order
    if (!listEl || !prevOffsets || !prevOrder) return

    const shifts = computeRankShifts(prevOrder, order)
    if (shifts.size === 0) return

    const reducedMotion = prefersReducedMotion()
    const prevIndex = new Map(prevOrder.map((key, index) => [key, index]))
    const nextIndex = new Map(order.map((key, index) => [key, index]))

    // El anuncio agregado sale SIEMPRE (también en ráfaga y reduced-motion).
    onShifts?.(
      [...shifts.entries()].map(([key, dir]) => ({
        key,
        dir,
        to: nextIndex.get(key) + 1,
      })),
    )

    if (shifts.size > MAX_ANIMATED_ROW_MOVES) {
      if (!reducedMotion && typeof listEl.animate === 'function') {
        listEl.animate([{ opacity: 0.55 }, { opacity: 1 }], {
          duration: BURST_SWEEP_MS,
          easing: 'ease-out',
        })
      }
      return
    }

    const rect = listEl.getBoundingClientRect()
    const base = listEl.offsetTop - rect.top
    const moves = computeFlipMoves(prevOffsets, nextOffsets, {
      viewportMin: base - VIEWPORT_MARGIN_PX,
      viewportMax: base + window.innerHeight + VIEWPORT_MARGIN_PX,
    })
    if (moves.length === 0) return

    const nodes = new Map()
    for (const el of listEl.children) {
      if (el.dataset?.flipKey) nodes.set(el.dataset.flipKey, el)
    }
    const ease =
      getComputedStyle(listEl).getPropertyValue('--ease-lift').trim() ||
      'ease-out'

    for (const { key, deltaY } of moves) {
      const node = nodes.get(key)
      const dir = shifts.get(key)
      if (!node || !dir || typeof node.animate !== 'function') continue

      if (!reducedMotion) {
        node.animate(
          [{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }],
          { duration: FLIP_DURATION_MS, easing: ease },
        )
      }

      const ribbon = node.querySelector('[data-fed-ribbon]')
      if (ribbon) {
        ribbon.setAttribute('data-dir', dir)
        const inOffset = RIBBON_IN_MS / RIBBON_TOTAL_MS
        ribbon.animate(
          reducedMotion
            ? [
                { transform: 'scaleY(1)', opacity: 1 },
                { transform: 'scaleY(1)', opacity: 1, offset: 0.82 },
                { transform: 'scaleY(1)', opacity: 0 },
              ]
            : [
                { transform: 'scaleY(0)', opacity: 1, easing: ease },
                { transform: 'scaleY(1)', opacity: 1, offset: inOffset },
                { transform: 'scaleY(1)', opacity: 1, offset: 0.82 },
                { transform: 'scaleY(1)', opacity: 0 },
              ],
          { duration: RIBBON_TOTAL_MS, easing: 'linear' },
        )
      }

      const chip = node.querySelector('[data-fed-delta]')
      const before = prevIndex.get(key)
      const after = nextIndex.get(key)
      if (chip && before != null && after != null) {
        const delta = before - after // positivo = sube
        chip.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta)
        chip.setAttribute('data-dir', dir)
        chip.animate(
          [
            { opacity: 0, transform: reducedMotion ? 'none' : 'translateY(3px)' },
            { opacity: 1, transform: 'translateY(0)', offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { opacity: 0 },
          ],
          { duration: RIBBON_TOTAL_MS, easing: 'ease-out' },
        )
      }
    }
  }, [tbodyRef, order, onShifts])
}

/**
 * FederationTable — el Registro de la Federación. REEMPLAZA la lista
 * <ol>+RankRowElo de la pestaña ELO de /ranking (las pestañas de votos
 * siguen en RankRowVotos hasta parametrizar la cifra acuñada).
 *
 * Es una <table> real con caption; el display custom por fila exige roles
 * ARIA explícitos (los pone el JSX). Los movimientos en vivo se anuncian
 * AGREGADOS por aria-live=polite, como máximo cada 3s, jamás fila a fila.
 *
 * @param {object} props
 * @param {Array}   props.items        Filas ordenadas (desc por elo):
 *   {slug, nombre, anime, animeJp?, elo, imagenUrl?, imagenColorDominante?}.
 * @param {number}  [props.rankBase=1] Puesto de la primera fila (la lista
 *   sin filtros arranca en el 4: el podio vive aparte).
 * @param {boolean} props.loading      Piel .skl en silueta de placa.
 * @param {'busqueda'|'sin-datos'} props.vacioMotivo  Variante del vacío honesto.
 * @param {?Function} props.onClearSearch  CTA "limpiar filtros" del vacío.
 * @param {?string} props.usuarioSlug  Fila propia ("tú", borde oro, siempre
 *   localizable vía locator sticky). La FUENTE de este slug no existe hoy
 *   en el producto (¿main del roster? ¿personaje seguido?) — decisión de
 *   producto pendiente; sin el prop no se pinta nada. Ver notas §Pendientes.
 * @param {?Function} props.renderAccion  Render-prop de la celda de acción
 *   (default: link "retar"). Se oculta a <480px.
 * @param {'contained'|'page'} props.scrollMode  'contained' scrollea dentro
 *   de maxHeight (el locator es sticky al wrap); 'page' deja el scroll al
 *   documento. Default: 'contained'.
 * @param {number}  props.maxHeight    Alto máx. del wrap en modo contained.
 * @param {?Function} props.onAnnounceText  Espejo del texto de aria-live
 *   (telemetría/debug). Opcional.
 * @param {import('react').Ref} [props.ref]  Ref imperativa { scrollToYou() }
 *   — centra la fila propia (sin scrollIntoView; usa scrollTo del
 *   contenedor, 'auto' en reduced-motion).
 */
function FederationTable({
  items = [],
  rankBase = 1,
  loading = false,
  vacioMotivo = 'sin-datos',
  onClearSearch,
  usuarioSlug,
  renderAccion,
  scrollMode = 'contained',
  maxHeight = 560,
  onAnnounceText,
  ref,
}) {
  const wrapRef = useRef(null)
  const tbodyRef = useRef(null)

  /* Entrada de página: UNA vez, con la primera tanda de filas. Re-renders,
     búsqueda y paginación montan sin ceremonia (la ventana ya cerró). */
  const [entranceDone, setEntranceDone] = useState(false)
  const hasRows = !loading && items.length > 0
  useEffect(() => {
    if (!hasRows || entranceDone) return undefined
    const t = setTimeout(() => setEntranceDone(true), ENTRANCE_WINDOW_MS)
    return () => clearTimeout(t)
  }, [hasRows, entranceDone])

  /* Anuncios agregados: cola + flush como máximo cada 3s. Los espejos de
     items/onAnnounceText viven en refs actualizadas POR EFFECT (el único
     lector, flush, corre por setTimeout — siempre después del commit). */
  const [announcement, setAnnouncement] = useState('')
  const queueRef = useRef([])
  const timerRef = useRef(0)
  const lastFlushRef = useRef(0)
  const itemsRef = useRef(items)
  const onAnnounceRef = useRef(onAnnounceText)
  useEffect(() => {
    itemsRef.current = items
    onAnnounceRef.current = onAnnounceText
  })

  const onShifts = useMemo(() => {
    const flush = () => {
      timerRef.current = 0
      lastFlushRef.current = Date.now()
      const q = queueRef.current
      queueRef.current = []
      if (q.length === 0) return
      const bySlug = new Map(q.map((m) => [m.key, m])) // el último cambio gana
      const cambios = [...bySlug.values()]
      const nombre = (slug) =>
        itemsRef.current.find((r) => r.slug === slug)?.nombre ?? slug
      const partes = cambios
        .slice(0, 3)
        .map((m) => `${nombre(m.key)} ${m.dir === 'up' ? 'sube' : 'baja'} a ${m.to}º`)
      const msg =
        `${cambios.length} cambio${cambios.length > 1 ? 's' : ''}: ` +
        partes.join(', ') +
        (cambios.length > 3 ? ` y ${cambios.length - 3} más` : '') +
        '.'
      setAnnouncement(msg)
      onAnnounceRef.current?.(msg)
    }
    return (movs) => {
      queueRef.current.push(...movs)
      if (timerRef.current) return
      const elapsed = Date.now() - lastFlushRef.current
      timerRef.current = setTimeout(flush, Math.max(400, ANNOUNCE_EVERY_MS - elapsed))
    }
  }, [])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const order = useMemo(() => items.map((r) => r.slug), [items])
  useFederationFlip(tbodyRef, order, { onShifts })

  /* Fila propia siempre localizable. El IO resetea por callback (dispara
     al observe()); el cuerpo del effect no toca estado. */
  const [youOut, setYouOut] = useState(null) // null | 'up' | 'down'
  const youIndex = usuarioSlug ? order.indexOf(usuarioSlug) : -1
  const youRank = youIndex >= 0 ? youIndex + rankBase : 0
  const youRow = youIndex >= 0 ? items[youIndex] : null
  useEffect(() => {
    const wrap = wrapRef.current
    const node = tbodyRef.current?.querySelector('[data-you]')
    if (!wrap || !node || typeof IntersectionObserver === 'undefined') {
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        if (e.isIntersecting) {
          setYouOut(null)
        } else {
          const rootTop = e.rootBounds?.top ?? 0
          setYouOut(e.boundingClientRect.top < rootTop ? 'up' : 'down')
        }
      },
      { root: scrollMode === 'contained' ? wrap : null, threshold: 0.4 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [usuarioSlug, hasRows, order, scrollMode])

  const scrollToYou = () => {
    const wrap = wrapRef.current
    const node = tbodyRef.current?.querySelector('[data-you]')
    if (!wrap || !node) return
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (scrollMode === 'contained') {
      wrap.scrollTo({
        top: node.offsetTop - wrap.clientHeight / 2 + node.offsetHeight / 2,
        behavior,
      })
    } else {
      const top =
        node.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2
      window.scrollTo({ top, behavior })
    }
  }
  useImperativeHandle(ref, () => ({ scrollToYou }))

  if (!loading && items.length === 0) {
    return (
      <div className="fed-shell">
        <div className="fed-empty">
          <span className="fed-empty-kanji" aria-hidden="true">空</span>
          <p className="fed-empty-title">
            {vacioMotivo === 'busqueda'
              ? 'El registro no encontró ese combatiente'
              : 'El registro está vacío'}
          </p>
          <p className="fed-empty-body">
            {vacioMotivo === 'busqueda'
              ? 'Revisa el nombre o limpia los filtros para volver a la tabla completa.'
              : 'Todavía no hay duelos suficientes para acuñar posiciones. Los primeros votos estrenan la tabla.'}
          </p>
          {vacioMotivo === 'busqueda' && onClearSearch && (
            <button type="button" className="fed-empty-action" onClick={onClearSearch}>
              Limpiar filtros
            </button>
          )}
        </div>
        <div aria-live="polite" className="sr-only">{announcement}</div>
      </div>
    )
  }

  return (
    <div className={`fed-shell${!entranceDone && hasRows ? ' fed-entrance' : ''}`}>
      <div
        className="fed-wrap"
        ref={wrapRef}
        data-scroll={scrollMode === 'contained' ? '' : undefined}
        style={scrollMode === 'contained' ? { maxHeight } : undefined}
      >
        <span className="fed-watermark" aria-hidden="true">番付</span>
        <table
          role="table"
          className="fed-table"
          aria-labelledby="fed-caption"
          aria-busy={loading || undefined}
        >
          <caption className="fed-caption" id="fed-caption">
            <span className="fed-caption-title">Registro de la Federación</span>
            <span className="fed-caption-sub">clasificación elo</span>
          </caption>
          <thead role="rowgroup" className="fed-thead">
            <tr role="row" className="fed-row-head">
              <th role="columnheader" scope="col" className="fed-th">puesto</th>
              <th role="columnheader" scope="col" className="fed-th">
                <span className="sr-only">retrato</span>
              </th>
              <th role="columnheader" scope="col" className="fed-th">combatiente</th>
              <th role="columnheader" scope="col" className="fed-th fed-th-action">
                <span className="sr-only">acciones</span>
              </th>
              <th role="columnheader" scope="col" className="fed-th fed-th-elo">elo</th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="fed-tbody" ref={tbodyRef}>
            {loading
              ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <FederationRowSkeleton key={i} />
                ))
              : items.map((row, i) => (
                  <FederationRow
                    key={row.slug}
                    row={row}
                    rank={i + rankBase}
                    isYou={row.slug === usuarioSlug}
                    stagger={!entranceDone && i < ENTRANCE_ROWS ? i : null}
                    cv={i >= CV_FROM_INDEX}
                    renderAccion={renderAccion}
                  />
                ))}
          </tbody>
        </table>
        {youRow && (
          <button
            type="button"
            className="fed-locator"
            hidden={youOut === null}
            onClick={scrollToYou}
          >
            <span className="fed-locator-dir" aria-hidden="true">
              {youOut === 'up' ? '↑' : '↓'}
            </span>
            tú · {String(youRank).padStart(2, '0')} {youRow.nombre} — ver placa
          </button>
        )}
      </div>
      <div aria-live="polite" className="sr-only">{announcement}</div>
    </div>
  )
}

export default FederationTable
