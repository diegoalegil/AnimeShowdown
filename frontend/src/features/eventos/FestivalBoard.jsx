import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useSound } from '../../contexts/SoundContext'
import { brandImage } from '../../lib/brand-assets'
import './festival-board.css'
import { estadoDe, formatAriaSpan, formatCuentaAtras, pad } from './festival-board-data'

/* ──────────────────────────────────────────────────────────────────────────
 * Ticker coalescado de cartelera
 *
 * UN solo timeout para toda la página, alineado al borde de minuto.
 * Baja a paso de segundo SOLO si la deadline más cercana está a <1h.
 * Cada CountdownMono se suscribe vía useSyncExternalStore: el resto del
 * árbol no re-renderiza (los carteles son hojas estables; el board no
 * depende de `now`).
 * ────────────────────────────────────────────────────────────────────── */
const MIN = 60_000
const HORA = 3_600_000

const tickListeners = new Set()
const tickDeadlines = new Set()
let tickTimer = null

function nearestLeft() {
  let min = Infinity
  for (const d of tickDeadlines) {
    const left = d - Date.now()
    if (left > 0 && left < min) min = left
  }
  return min
}

function scheduleTick() {
  clearTimeout(tickTimer)
  if (!tickListeners.size || nearestLeft() === Infinity) return
  const step = nearestLeft() < HORA ? 1000 : MIN
  // Alinear al borde del paso: todos los countdowns cambian a la vez.
  tickTimer = setTimeout(() => {
    for (const l of tickListeners) l()
    scheduleTick()
  }, step - (Date.now() % step) + 30)
}

function subscribeTick(listener, deadlines) {
  tickListeners.add(listener)
  const propios = Array.isArray(deadlines) ? deadlines : deadlines ? [deadlines] : []
  for (const d of propios) tickDeadlines.add(d)
  scheduleTick()
  return () => {
    tickListeners.delete(listener)
    for (const d of propios) tickDeadlines.delete(d)
    if (!tickListeners.size) clearTimeout(tickTimer)
  }
}

/** Now compartido, granularidad minuto (segundo bajo 1h). */
function useTickerNow(deadline) {
  return useSyncExternalStore(
    (cb) => subscribeTick(cb, deadline),
    // Snapshot redondeado al paso vigente para que dos suscriptores del
    // mismo tick lean el mismo valor (evita renders dobles del compiler).
    () => Math.floor(Date.now() / 1000) * 1000,
  )
}

/* ── Formateadores ──────────────────────────────────────────────────── */

/* ── Hooks de comportamiento ────────────────────────────────────────── */

/**
 * Pausa el latido del cartel activo fuera del viewport y con la pestaña
 * oculta: escribe data-pulse="paused" en el contenedor (el CSS hace el
 * resto con animation-play-state). Mutación vía ref en effect — nada de
 * estado por frame (regla React Compiler).
 */
function usePulsePause(boardRef) {
  useEffect(() => {
    const el = boardRef.current
    if (!el) return undefined
    let hidden = document.hidden
    let inView = true
    const apply = () => {
      el.setAttribute('data-pulse', hidden || !inView ? 'paused' : 'running')
    }
    const onVis = () => { hidden = document.hidden; apply() }
    const io = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting
      apply()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', onVis)
    apply()
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [boardRef])
}

/**
 * Transición en caliente activo→pasado: cuando el estado derivado cruza,
 * marca `expirando` durante la coreografía (banderín cae 400ms + sello
 * 380ms después + sepia). El cartel NO se recarga: mismo nodo, mismas
 * capas, solo cambian data-attrs. setState guardado por condición de
 * cruce — compatible con React Compiler / StrictMode.
 */
function useExpiracionCaliente(estado, onExpira) {
  const prev = useRef(estado)
  const [expirando, setExpirando] = useState(false)
  useEffect(() => {
    const cruza = prev.current === 'activo' && estado === 'pasado'
    // SIEMPRE se avanza el previo: si no, el cruce se re-detecta en cada
    // re-render del board (el ticker re-renderiza por minuto/segundo) y la
    // ceremonia + el hanko se repetían en bucle.
    prev.current = estado
    if (cruza) {
      setExpirando(true)
      onExpira?.()
      const t = setTimeout(() => setExpirando(false), 1400)
      return () => clearTimeout(t)
    }
    return undefined
  }, [estado, onExpira])
  return expirando
}

/* ── Piezas visuales ────────────────────────────────────────────────── */

/**
 * Linterna chōchin con el día en mono dentro del cuerpo.
 *
 * @param {object} props
 * @param {string} props.dia    Día del mes a mostrar (texto ya formateado, p. ej. "05").
 * @param {string} props.mes    Mes corto bajo la linterna (p. ej. "JUN").
 * @param {'activo'|'futuro'|'pasado'|'apagada'} props.estado Tratamiento visual.
 */
export function ChochinLantern({ dia, mes, estado }) {
  return (
    <div className="flex flex-col items-center gap-1 pt-1" data-estado={estado}>
      <svg width="56" height="86" viewBox="0 0 56 86" aria-hidden="true" className="fest-lantern">
        <line className="fest-lantern-frame" x1="28" y1="0" x2="28" y2="10" strokeWidth="1.5" />
        <rect className="fest-lantern-cap" x="17" y="10" width="22" height="6" rx="2" strokeWidth="1" />
        <ellipse className="fest-lantern-body" cx="28" cy="44" rx="20" ry="27" strokeWidth="1.5" />
        {/* Luz interior: capa pre-renderizada, opacidad por estado en CSS. */}
        <circle className="fest-lantern-light" cx="28" cy="44" r="14" />
        <line className="fest-lantern-rib" x1="10" y1="34" x2="46" y2="34" strokeWidth="1" />
        <line className="fest-lantern-rib" x1="8" y1="44" x2="48" y2="44" strokeWidth="1" />
        <line className="fest-lantern-rib" x1="10" y1="54" x2="46" y2="54" strokeWidth="1" />
        <rect className="fest-lantern-cap" x="19" y="68" width="18" height="6" rx="2" strokeWidth="1" />
        {dia ? (
          <text className="fest-lantern-dia font-mono" x="28" y="50" textAnchor="middle" fontSize="16" fontWeight="700">
            {dia}
          </text>
        ) : null}
      </svg>
      {mes ? <span className="fest-lantern-mes font-mono text-[10px] tracking-[2px]">{mes}</span> : null}
    </div>
  )
}

/**
 * Chip de recompensa con el kanji del tipo (籤 sobres, 金 monedas…).
 *
 * @param {object} props
 * @param {string} props.kanji   Kanji del tipo de recompensa (semántico, no decorativo).
 * @param {string} props.label   Texto mono ("3 sobres", "500 monedas").
 * @param {boolean} [props.apagado] Tratamiento sepia para eventos pasados.
 */
export function ChipRecompensa({ kanji, label, apagado = false }) {
  return (
    <span className="fest-chip inline-flex items-center gap-[7px] rounded-[9px] border py-[5px] pl-[6px] pr-[10px]" data-apagado={apagado || undefined}>
      <span className="fest-chip-kanji font-kanji-serif inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-gold-soft text-sm" >
        {kanji}
      </span>
      <span className="fest-chip-label font-mono text-[11px]">{label}</span>
    </span>
  )
}

/** Cuenta atrás mono suscrita al ticker coalescado (solo este span re-renderiza). */
function CountdownMono({ hasta, className = '' }) {
  const now = useTickerNow(hasta.getTime())
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {formatCuentaAtras(hasta.getTime() - now)}
    </span>
  )
}

/**
 * Un cartel de la cartelera. Link navegable con aria-label completo.
 *
 * @param {object} props
 * @param {FestivalEvento} props.evento
 * @param {number} props.indice            Posición en el rail (delay del stagger: indice × 80ms).
 * @param {string} props.href              Destino (/eventos/:slug).
 * @param {number} props.now               Now del board (granularidad minuto, para derivar estado).
 * @param {() => void} [props.onExpira]    Callback al cruzar activo→pasado (sonido, telemetría).
 */
export function CartelFestival({ evento, indice, href, now, onExpira }) {
  const estado = estadoDe(evento, now)
  const expirando = useExpiracionCaliente(estado, onExpira)
  /* Arte: el caller puede pasar src/srcSet ya resueltos (visual del banco
     de la página); `arte` como nombre de asset sigue funcionando. */
  const arte = evento.arteSrc
    ? { src: evento.arteSrc, srcSet: evento.arteSrcSet }
    : evento.arte
      ? brandImage(evento.arte)
      : null

  const msFin = evento.fin.getTime() - now
  const msInicio = evento.inicio.getTime() - now
  const ariaLabel =
    estado === 'activo'
      ? `${evento.titulo}, festival en curso, termina en ${formatAriaSpan(msFin)}`
      : estado === 'futuro'
        ? `${evento.titulo}, próximamente, empieza en ${formatAriaSpan(msInicio)}`
        : `${evento.titulo}, festival finalizado${evento.canjeDisponible ? ', canje de recompensas disponible' : ''}`

  const dia = pad(evento.inicio.getDate())
  const mes = evento.inicio.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase()

  return (
    <li className="fest-enter" style={{ '--fest-i': indice }}>
      <div className="grid grid-cols-[68px_1fr] gap-x-4" style={{ marginBottom: evento.canjeDisponible ? 66 : 30 }}>
        <ChochinLantern dia={dia} mes={mes} estado={estado} />

        <div className="relative">
          {/* Latido: dos capas de luz pre-renderizadas en cross-fade 2.8s.
              Montadas solo para el activo; fade-out de 500ms al expirar. */}
          {(estado === 'activo' || expirando) && (
            <div aria-hidden="true" className="fest-pulse pointer-events-none absolute -inset-[14px]" data-apagando={estado !== 'activo' || undefined}>
              <div className="fest-pulse-a absolute inset-0 rounded-[26px]" />
              <div className="fest-pulse-b absolute inset-0 rounded-[26px]" />
            </div>
          )}

          <Link
            to={href}
            aria-label={ariaLabel}
            className="fest-cartel relative z-[1] block rounded-2xl border bg-surface no-underline"
            data-estado={estado}
            data-expirando={expirando || undefined}
          >
            <div className="relative h-[150px] overflow-hidden rounded-t-[15px] bg-surface-alt">
              {arte ? (
                <img
                  src={arte.src}
                  srcSet={arte.srcSet}
                  sizes="(max-width: 640px) 90vw, 660px"
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
              {evento.kanji ? (
                <span aria-hidden="true" className="fest-art-kanji font-kanji-serif absolute right-3 top-0 text-[86px] leading-[1.1]" >
                  {evento.kanji}
                </span>
              ) : null}
              {/* Scrim de legibilidad solo en el tercio inferior (texto encima). */}
              <div className="fest-art-scrim absolute inset-0" />

              {/* Sepia de pasado: capa de color con opacity — PROHIBIDO filter. */}
              {(estado === 'pasado' || expirando) && (
                <>
                  <div className="fest-sepia-sat absolute inset-0" data-anim={expirando || undefined} />
                  <div className="fest-sepia-tint absolute inset-0" data-anim={expirando || undefined} />
                </>
              )}

              {estado === 'futuro' && (
                <>
                  <div className="fest-futuro-dim absolute inset-0" />
                  <div aria-hidden="true" className="fest-cordon absolute -left-2 -right-2 top-1/2" />
                  <span className="fest-cordon-tag absolute left-1/2 top-1/2 inline-flex items-baseline gap-2 rounded-[9px] border px-[13px] py-[7px] font-mono text-xs">
                    próximamente · <CountdownMono hasta={evento.inicio} className="text-electric-soft" />
                  </span>
                </>
              )}

              {(estado === 'pasado' || expirando) && (
                <div aria-hidden="true" className="fest-stamp absolute right-7 top-[22px] z-[3]" data-anim={expirando || undefined}>
                  <div className="fest-stamp-bleed absolute -inset-[5px] rounded-full border-[3px]" />
                  <div className="fest-stamp-seal flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px]">
                    <span className="font-kanji-serif text-[38px]">終</span>
                  </div>
                </div>
              )}
            </div>

            {/* Banderín 開催中: cuelga del borde superior; cae al expirar. */}
            {(estado === 'activo' || expirando) && (
              <div aria-hidden="true" className="fest-banner absolute -top-2 right-[26px] z-[3]" data-cae={expirando || undefined}>
                <div className="fest-banner-tela flex w-[38px] justify-center pb-5 pt-4">
                  <span className="fest-banner-texto font-kanji-serif text-[17px] tracking-[6px]" >開催中</span>
                </div>
                <span className="fest-banner-clavo absolute -top-[3px] left-1/2 h-[6px] w-[6px] -translate-x-1/2 rounded-full" />
              </div>
            )}

            <div className="flex flex-col gap-2 px-[18px] pb-4 pt-[14px]">
              <h3 className="fest-titulo font-kanji-serif m-0 text-[21px] font-bold" style={{ textWrap: 'pretty' }}>
                {evento.titulo}
              </h3>
              <p className="fest-desc m-0 text-[13px] leading-[1.55]" style={{ textWrap: 'pretty' }}>
                {evento.descripcionCorta}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                {(evento.recompensas ?? []).map((r) => (
                  <ChipRecompensa key={r.kanji + r.label} kanji={r.kanji} label={r.label} apagado={estado === 'pasado'} />
                ))}
                <span className="fest-meta ml-auto font-mono text-xs">
                  {estado === 'activo' && (
                    <>termina en <CountdownMono hasta={evento.fin} /></>
                  )}
                  {estado === 'futuro' && `empieza el ${dia} ${mes.toLowerCase()}`}
                  {estado === 'pasado' && 'finalizado'}
                </span>
              </div>
            </div>
          </Link>

          {/* Cordón de regalo: canje pendiente (info ya en el aria-label). */}
          {estado === 'pasado' && evento.canjeDisponible && (
            <div aria-hidden="true" className="absolute left-[30px] top-full z-[2] flex flex-col items-start">
              <span className="fest-canje-hilo ml-[15px] block h-4 w-px" />
              <span className="fest-canje-tag inline-flex items-center gap-2 rounded-[9px] border py-1.5 pl-[7px] pr-3">
                <span className="fest-canje-kanji inline-flex h-6 w-6 -rotate-[8deg] items-center justify-center rounded-full border-[1.5px] text-[13px]" >贈</span>
                <span className="font-mono text-[11px] text-gold-bright">canje disponible</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

/** Plaza vacía: linterna apagada — el vacío también es marca. */
export function PlazaVacia() {
  return (
    <div className="relative mt-12 flex min-h-[380px] flex-col items-center justify-center gap-[18px] overflow-hidden rounded-[18px] border border-border/50 bg-bg">
      <span aria-hidden="true" className="fest-watermark pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[280px] leading-none" >祭</span>
      <div className="relative scale-[1.4]">
        <ChochinLantern dia="" mes="" estado="apagada" />
      </div>
      <h2 className="relative m-0 text-[25px] font-bold text-fg-muted" >Pronto habrá festival</h2>
      <p className="relative m-0 max-w-[40ch] text-center font-mono text-xs leading-[1.7] text-fg-muted/70">
        no hay copas en el calendario — la próxima encenderá esta linterna
      </p>
    </div>
  )
}

/* ── Board ──────────────────────────────────────────────────────────── */

/**
 * @typedef {object} FestivalEvento
 * @property {string} slug                Slug canónico (/eventos/:slug, y nombre de asset de marca).
 * @property {string} titulo
 * @property {string} descripcionCorta
 * @property {Date}   inicio
 * @property {Date}   fin
 * @property {string} [arte]              Nombre de asset del banco de marca (lib/brand-assets); sin él, el cartel queda en superficie plana + kanji.
 * @property {string} [kanji]             Kanji identitario del evento (semántico: 戦, 華…). NO se inventa: viene del contenido.
 * @property {Array<{kanji: string, label: string}>} [recompensas]
 * @property {boolean} [canjeDisponible]  Recompensas ganadas sin canjear (cuelga el cordón 贈).
 */

/**
 * Cartelera de festivales: rail temporal vertical con nudos por mes,
 * un cartel por evento y su linterna chōchin de fecha. Tres tiempos,
 * tres tratamientos (activo late / pasado en sepia con 終 / futuro con
 * cordón y cuenta atrás). Orden esperado: descendente por fecha
 * (futuros arriba, pasados abajo) — el board no reordena.
 *
 * @param {object} props
 * @param {FestivalEvento[]} props.eventos       Lista ya ordenada (desc por inicio).
 * @param {(slug: string) => string} [props.hrefDe] Constructor de rutas. Default: `/eventos/${slug}`.
 * @param {() => void} [props.onExpiraActivo]    Disparado al cruce en caliente activo→pasado (p. ej. play('playAcunado')).
 */
export default function FestivalBoard({ eventos, hrefDe = (slug) => `/eventos/${slug}`, onExpiraActivo }) {
  const boardRef = useRef(null)
  usePulsePause(boardRef)
  const { play } = useSound()
  // Now de granularidad gruesa para derivar estados (los countdowns finos
  // van por CountdownMono y no re-renderizan el board).
  // Registramos TODOS los hitos: nearestLeft ya descarta los pasados
  // (cero Date.now() en render — regla del Compiler).
  const deadlineEstados = eventos.flatMap((e) => [e.inicio.getTime(), e.fin.getTime()])
  const now = useTickerNow(deadlineEstados)

  // Identidad estable: con una arrow inline cada render del board creaba
  // un onExpira nuevo y re-disparaba el effect del cruce en cada tick.
  const onExpira = useCallback(() => {
    play('playAcunado') // respeta el mute global vía SoundContext
    onExpiraActivo?.()
  }, [play, onExpiraActivo])

  if (!eventos.length) return <PlazaVacia />

  const mesDe = (e) => `${e.inicio.getMonth()}-${e.inicio.getFullYear()}`
  return (
    <div ref={boardRef} className="relative mt-10" data-pulse="running">
      <div aria-hidden="true" className="fest-rail absolute bottom-0 left-[33px] top-0 w-px" />
      <ul className="m-0 list-none p-0">
        {eventos.map((evento, i) => {
          const nudo = i === 0 || mesDe(evento) !== mesDe(eventos[i - 1])
          return (
            <FragmentoMes key={evento.slug} mostrar={nudo} fecha={evento.inicio}>
              <CartelFestival evento={evento} indice={i} href={hrefDe(evento.slug)} now={now} onExpira={onExpira} />
            </FragmentoMes>
          )
        })}
      </ul>
    </div>
  )
}

/** Nudo de mes en el rail (rombo + etiqueta mono) antes de su primer cartel. */
function FragmentoMes({ mostrar, fecha, children }) {
  return (
    <>
      {mostrar && (
        <li aria-hidden="true" className="mb-4 mt-1 grid grid-cols-[68px_1fr] items-center gap-x-4">
          <div className="flex justify-center">
            <span className="fest-nudo block h-[9px] w-[9px] rotate-45 border" />
          </div>
          <span className="font-mono text-[11px] tracking-[1.5px] text-gold/75">
            {fecha.toLocaleDateString('es-ES', { month: 'long' })} · {fecha.getFullYear()}
          </span>
        </li>
      )}
      {children}
    </>
  )
}
