import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ResponsivePicture from '../../components/ResponsivePicture'
import { FASES, SELLOS, deriveFaseActual, adaptTorneoParaPoster } from './torneo-poster-fases'
import './torneo-poster.css'

/**
 * TournamentPoster — card de torneo como cartel oficial de velada.
 *
 * Responde a la queja real: "el estado/fase del torneo no se ve de un vistazo".
 * Composición de póster: escena del banco de marca tenue de fondo con scrim de
 * legibilidad SOLO donde hay texto, título grande y — la pieza clave — la fase
 * como CAMINO DE NODOS horizontal donde el nodo actual late en oro
 * (solo opacity, halo pre-renderizado) y los completados quedan entintados.
 * Sello hanko de estado en la esquina con kanji real: 募 inscripción abierta ·
 * 戦 en juego · 終 cerrado.
 *
 * Tres variantes derivadas de torneo.estado (TorneoResumenDto):
 *   IN_PROGRESS → marquee (se imprime grande y primero; `destacado` aún más)
 *   SCHEDULED   → cartel medio con cuenta atrás del arranque
 *   FINISHED    → fila compacta desaturada para el archivo
 *
 * Perf, reglas de la casa: card 100% estática salvo el latido del nodo actual
 * (solo opacity); cero blur. El latido se pausa fuera de viewport
 * (IntersectionObserver), con la pestaña oculta y en modo calma; la cuenta
 * atrás se pausa con la pestaña oculta. Imágenes responsive del banco vía
 * ResponsivePicture.
 */

/* ── Hooks ───────────────────────────────────────────────────────────────── */

/** Cuenta atrás 1 Hz que se pausa con la pestaña oculta. */
function useCuentaAtras(fechaIso) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!fechaIso) return undefined
    let id = null
    const tick = () => setAhora(Date.now())
    const start = () => {
      if (id == null) {
        tick()
        id = setInterval(tick, 1000)
      }
    }
    const stop = () => {
      if (id != null) {
        clearInterval(id)
        id = null
      }
    }
    const onVisibilidad = () => (document.hidden ? stop() : start())
    start()
    document.addEventListener('visibilitychange', onVisibilidad)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilidad)
    }
  }, [fechaIso])

  if (!fechaIso) return null
  const resto = Math.max(0, new Date(fechaIso).getTime() - ahora)
  const s = Math.floor(resto / 1000)
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
    vencida: resto <= 0,
  }
}

/** true mientras el póster está (casi) en viewport — pausa el latido fuera. */
function usePosterEnViewport(ref) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '96px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}

/* ── Piezas ──────────────────────────────────────────────────────────────── */

function pad2(n) {
  return String(n).padStart(2, '0')
}

function CuentaAtras({ etiqueta, fechaIso, vencidaLabel = 'Resolviendo…' }) {
  const t = useCuentaAtras(fechaIso)
  if (!t) return null
  return (
    <div>
      <p className="text-[11px] font-bold text-fg-muted">{etiqueta}</p>
      <p
        className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-gold-bright sm:text-2xl"
        aria-live="off"
      >
        {t.vencida ? (
          <span className="text-fg-muted">{vencidaLabel}</span>
        ) : (
          <span>
            {t.dias > 0 && <span>{t.dias}d </span>}
            {pad2(t.horas)}
            <span className="text-gold/70">:</span>
            {pad2(t.minutos)}
            <span className="text-gold/70">:</span>
            {pad2(t.segundos)}
          </span>
        )}
      </p>
    </div>
  )
}

/** Sello hanko de estado: kanji real con significado, en serif display. */
function SelloEstado({ estado, size = 'md', className = '' }) {
  const sello = SELLOS[estado] ?? SELLOS.SCHEDULED
  const tam =
    size === 'lg'
      ? 'h-14 w-14 rounded-md text-3xl'
      : size === 'sm'
        ? 'h-9 w-9 rounded text-lg'
        : 'h-11 w-11 rounded text-2xl'
  return (
    <span
      role="img"
      aria-label={`Sello de estado: ${sello.titulo}`}
      title={sello.titulo}
      className={`font-kanji-serif flex shrink-0 rotate-3 select-none items-center justify-center border-2 leading-none ${sello.chip} ${tam} ${className}`}
      style={{ background: sello.fondo }}
    >
      {sello.kanji}
    </span>
  )
}

/**
 * Camino de fase horizontal. Nodos completados entintados en oro sólido,
 * nodo actual con halo que late (capa pre-renderizada, solo opacity),
 * nodos futuros huecos. Con reduced-motion el actual queda marcado sin latir.
 */
function CaminoDeFase({ faseActual, compacto = false, className = '' }) {
  if (compacto) {
    // Variante archivo: solo puntos entintados, sin etiquetas.
    return (
      <span
        className={`inline-flex items-center gap-1 ${className}`}
        role="img"
        aria-label="Camino completado: inscripción, grupos, eliminatorias y final"
      >
        {FASES.map((fase, i) => (
          <span key={fase.id} className="inline-flex items-center gap-1">
            {i > 0 && <span className="h-px w-2.5 bg-gold/40" />}
            <span className="h-1.5 w-1.5 rounded-full bg-gold/80" />
          </span>
        ))}
      </span>
    )
  }

  return (
    <ol className={`grid grid-cols-4 ${className}`} aria-label="Fase del torneo">
      {FASES.map((fase, i) => {
        const hecha = i < faseActual
        const actual = i === faseActual
        const trackIzq = i <= faseActual ? 'bg-gold/55' : 'bg-border/70'
        const trackDer = i < faseActual ? 'bg-gold/55' : 'bg-border/70'
        return (
          <li
            key={fase.id}
            aria-current={actual ? 'step' : undefined}
            className="relative flex flex-col items-center gap-1.5"
          >
            {i > 0 && (
              <span
                className={`absolute left-0 right-1/2 top-[13px] mr-3.5 h-px ${trackIzq}`}
                aria-hidden="true"
              />
            )}
            {i < FASES.length - 1 && (
              <span
                className={`absolute left-1/2 right-0 top-[13px] ml-3.5 h-px ${trackDer}`}
                aria-hidden="true"
              />
            )}

            {actual ? (
              <span className="relative flex h-7 w-7 items-center justify-center">
                {/* Halo pre-renderizado: solo su opacity late (.tp-pulse). */}
                <span
                  className="tp-pulse absolute inset-0 rounded-full"
                  aria-hidden="true"
                  style={{
                    background: 'var(--color-gold-soft)',
                    boxShadow: '0 0 16px 5px var(--color-gold-aura)',
                  }}
                />
                <span
                  className="absolute inset-0 rounded-full border border-gold/75"
                  aria-hidden="true"
                />
                <span className="relative h-3 w-3 rounded-full bg-gold-bright" />
              </span>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center">
                <span
                  className={
                    hecha
                      ? 'h-2.5 w-2.5 rounded-full bg-gold' /* entintado */
                      : 'h-2.5 w-2.5 rounded-full border border-border'
                  }
                />
              </span>
            )}

            <span
              className={`max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-[11px] ${
                actual
                  ? 'text-gold-bright'
                  : hecha
                    ? 'text-fg-muted'
                    : 'text-fg-muted/60'
              }`}
            >
              {fase.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Placeholder rayado cuando la escena del banco no carga (offline / 404). */
function PlaceholderEscena({ etiqueta }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden bg-surface p-3"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 20%, rgb(var(--tp-accent, 159 29 44) / 0.14), transparent 60%), ' +
          'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-fg-strong) 5%, transparent) 0 12px, transparent 12px 26px)',
      }}
    >
      <span className="truncate rounded border border-fg/15 bg-canvas/60 px-2 py-1 font-mono text-[10px] text-fg-muted">
        scene: {etiqueta}.webp
      </span>
    </div>
  )
}

/* Scrims de legibilidad sobre el token canvas: 'poster' oscurece abajo donde
   vive el texto y 'plano' las filas de archivo. El resto de la imagen respira. */
const TP_SCRIMS = {
  poster:
    'linear-gradient(180deg, color-mix(in srgb, var(--color-canvas) 30%, transparent) 0%, color-mix(in srgb, var(--color-canvas) 6%, transparent) 32%, color-mix(in srgb, var(--color-canvas) 66%, transparent) 62%, color-mix(in srgb, var(--color-canvas) 94%, transparent) 100%)',
  plano:
    'linear-gradient(90deg, color-mix(in srgb, var(--color-canvas) 90%, transparent) 0%, color-mix(in srgb, var(--color-canvas) 74%, transparent) 55%, color-mix(in srgb, var(--color-canvas) 48%, transparent) 100%)',
}

/**
 * Escena del banco de marca + scrim de legibilidad. Variantes responsive
 * AVIF/WebP del visual vía ResponsivePicture; si el arte falla, placeholder.
 */
function EscenaPoster({ visual, sizes, desaturada = false, scrim = 'poster' }) {
  const [fallida, setFallida] = useState(false)
  const v = visual ?? {}
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {v.image && !fallida ? (
        <ResponsivePicture
          visual={v}
          sizes={sizes}
          onError={() => setFallida(true)}
          className="absolute inset-0"
          imgClassName={desaturada ? 'saturate-50' : 'saturate-105'}
          objectPosition={v.objectPosition ?? '50% 30%'}
        />
      ) : (
        <PlaceholderEscena etiqueta={v.slug ?? 'banco de marca'} />
      )}
      {/* Scrim de legibilidad (intensidad tweakeable vía --tp-scrim). */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 'var(--tp-scrim, 1)',
          background: TP_SCRIMS[scrim] ?? TP_SCRIMS.poster,
        }}
      />
      {/* Identidad: glow accent sutil en la esquina del texto (cf. EditorialCover). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 6% 100%, rgb(var(--tp-accent, 159 29 44) / 0.20), transparent 16rem)',
        }}
      />
    </div>
  )
}

function MetaMono({ children }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tabular-nums text-fg-muted">
      {children}
    </p>
  )
}

/* ── Variantes ───────────────────────────────────────────────────────────── */

/** EN JUEGO — cartel grande de cabecera de velada. */
function PosterEnJuego({ torneo, destacado }) {
  const ref = useRef(null)
  const vivo = usePosterEnViewport(ref)
  const faseActual = deriveFaseActual(torneo)
  const numFmt = new Intl.NumberFormat('es-ES')

  return (
    <article
      ref={ref}
      data-tp-paused={vivo ? undefined : 'true'}
      data-comment-anchor={`poster-${torneo.slug}`}
      className="group relative isolate overflow-hidden rounded-2xl border border-gold/30 bg-bg transition-colors hover:border-gold/55"
      style={{ '--tp-accent': torneo.visual?.accentRgb }}
    >
      <EscenaPoster
        visual={torneo.visual}
        sizes={destacado ? '(min-width: 1024px) 960px, 100vw' : '(min-width: 768px) 50vw, 100vw'}
      />
      <div
        className={`relative flex flex-col justify-between gap-6 p-5 sm:p-7 ${
          destacado ? 'min-h-[420px] sm:min-h-[480px]' : 'min-h-[360px]'
        }`}
      >
        {/* Cabecera: señal en vivo + sello 戦 */}
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-fg">
            <span className="relative inline-flex h-2 w-2" aria-hidden="true">
              <span className="tp-pulse absolute inline-flex h-full w-full rounded-full bg-hanko" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-hanko" />
            </span>
            <span className="font-bold text-accent-text">En juego</span>
            {torneo.rondaActual && torneo.totalRondas && (
              <span>· Ronda {torneo.rondaActual}/{torneo.totalRondas}</span>
            )}
          </p>
          <SelloEstado estado="IN_PROGRESS" size={destacado ? 'lg' : 'md'} />
        </div>

        {/* Pie del cartel: título, camino de fase y próximo hito */}
        <div>
          <h3
            className={`max-w-2xl font-black leading-[1.05] text-fg-strong ${
              destacado ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            {torneo.nombre}
          </h3>
          <MetaMono>
            <span>{torneo.numParticipantes} participantes</span>
            {Number.isFinite(torneo.votosUltimos7Dias) && (
              <span>· {numFmt.format(torneo.votosUltimos7Dias)} votos / 7d</span>
            )}
          </MetaMono>

          <CaminoDeFase faseActual={faseActual} className="mt-6 max-w-xl" />

          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-fg/10 pt-4">
            <CuentaAtras
              etiqueta={torneo.proximoHito?.label ?? 'Próximo hito en'}
              fechaIso={torneo.proximoHito?.fecha}
            />
            <Link
              to={`/torneos/${torneo.slug}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold-soft px-4 text-sm font-bold text-gold-bright transition-colors hover:border-gold/70 hover:text-gold-pale"
            >
              Votar duelos abiertos
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

/** INSCRIPCIÓN ABIERTA — cartel medio con cuenta atrás del arranque. */
function PosterInscripcion({ torneo }) {
  const ocupadas = torneo.numParticipantes ?? 0

  return (
    <article
      data-comment-anchor={`poster-${torneo.slug}`}
      className="group relative isolate overflow-hidden rounded-2xl border border-border bg-bg transition-colors hover:border-gold/45"
      style={{ '--tp-accent': torneo.visual?.accentRgb }}
    >
      <EscenaPoster visual={torneo.visual} sizes="(min-width: 768px) 50vw, 100vw" />
      <div className="relative flex min-h-[320px] flex-col justify-between gap-6 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[11px] font-bold tabular-nums text-gold">
            Inscripción abierta
          </p>
          <SelloEstado estado="SCHEDULED" />
        </div>

        <div>
          <h3 className="max-w-xl text-2xl font-black leading-tight text-fg-strong sm:text-3xl">
            {torneo.nombre}
          </h3>

          <MetaMono>
            <span>{ocupadas} inscritos</span>
          </MetaMono>

          <CaminoDeFase faseActual={0} className="mt-5 max-w-xl" />

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-fg/10 pt-4">
            <CuentaAtras
              etiqueta={torneo.proximoHito?.label ?? 'Arranca en'}
              fechaIso={torneo.proximoHito?.fecha}
              vencidaLabel="Arrancando…"
            />
            <Link
              to={`/torneos/${torneo.slug}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-4 text-sm font-bold text-fg-strong transition-colors hover:bg-accent-hover"
            >
              Ver participantes
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

/** CERRADO — fila de archivo compacta y desaturada. */
function PosterArchivo({ torneo }) {
  const fechaFinal = torneo.fechaFinalizacion
    ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(torneo.fechaFinalizacion),
      )
    : null

  return (
    <Link
      to={`/torneos/${torneo.slug}`}
      data-comment-anchor={`poster-${torneo.slug}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-3 opacity-80 transition-all hover:border-gold/40 hover:opacity-100 sm:gap-4"
      style={{ '--tp-accent': torneo.visual?.accentRgb }}
    >
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-fg/10 grayscale-[0.55]">
        <EscenaPoster visual={torneo.visual} sizes="96px" desaturada scrim="plano" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fg group-hover:text-fg-strong">
          {torneo.nombre}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-fg-muted">
          {torneo.ganadorNombre && (
            <span>
              Campeón <span className="text-gold/90">{torneo.ganadorNombre}</span>
            </span>
          )}
          {torneo.ganadorNombre && fechaFinal && <span> · </span>}
          {fechaFinal && <span>Final {fechaFinal}</span>}
        </p>
      </div>

      <CaminoDeFase compacto className="hidden shrink-0 sm:inline-flex" />
      <SelloEstado estado="FINISHED" size="sm" />
    </Link>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */

function TournamentPoster({ torneo, destacado = false }) {
  if (torneo.estado === 'IN_PROGRESS') {
    return <PosterEnJuego torneo={torneo} destacado={destacado} />
  }
  if (torneo.estado === 'FINISHED') {
    return <PosterArchivo torneo={torneo} />
  }
  return <PosterInscripcion torneo={torneo} />
}

/* ── Cartelera: jerarquía de la velada ───────────────────────────────────── */

function CabeceraSeccion({ kanji, titulo, count, tono }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border pb-3">
      <span
        className={`font-kanji-serif flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-[15px] leading-none ${tono}`}
        aria-hidden="true"
      >
        {kanji}
      </span>
      <h2 className={`text-[13px] font-semibold ${tono}`}>{titulo}</h2>
      <span className="font-mono text-[11px] tabular-nums text-fg-muted">({count})</span>
    </div>
  )
}

/**
 * La velada completa: EN JUEGO se imprime más grande y primero (el más vivo,
 * a página completa), después la inscripción abierta, y el historial queda
 * como archivo compacto desaturado. Recibe los grupos YA ordenados de
 * buildTorneosPageModel (única fuente de orden de la página).
 */
function CarteleraTorneos({ enCurso = [], proximos = [], historial = [] }) {
  const { t } = useTranslation()
  const enJuego = enCurso.map(adaptTorneoParaPoster)
  const inscripcion = proximos.map(adaptTorneoParaPoster)
  const cerrados = historial.map(adaptTorneoParaPoster)

  return (
    <div className="flex flex-col gap-12">
      {enJuego.length > 0 && (
        <section aria-label={t('torneos.carteleraEnJuego')}>
          <CabeceraSeccion
            kanji="戦"
            titulo={t('torneos.carteleraEnJuego')}
            count={enJuego.length}
            tono="text-accent-text"
          />
          <div className="mt-5 flex flex-col gap-5">
            <TournamentPoster torneo={enJuego[0]} destacado />
            {enJuego.length > 1 && (
              <div className="grid gap-5 lg:grid-cols-2">
                {enJuego.slice(1).map((torneo) => (
                  <TournamentPoster key={torneo.slug} torneo={torneo} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {inscripcion.length > 0 && (
        <section aria-label={t('torneos.carteleraInscripcion')}>
          <CabeceraSeccion
            kanji="募"
            titulo={t('torneos.carteleraInscripcion')}
            count={inscripcion.length}
            tono="text-gold"
          />
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {inscripcion.map((torneo) => (
              <TournamentPoster key={torneo.slug} torneo={torneo} />
            ))}
          </div>
        </section>
      )}

      {cerrados.length > 0 && (
        <section aria-label={t('torneos.carteleraArchivo')}>
          <CabeceraSeccion
            kanji="終"
            titulo={t('torneos.carteleraArchivo')}
            count={cerrados.length}
            tono="text-fg-muted"
          />
          <div className="mt-5 flex flex-col gap-3">
            {cerrados.map((torneo) => (
              <TournamentPoster key={torneo.slug} torneo={torneo} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export { CaminoDeFase, SelloEstado, CarteleraTorneos }
export default TournamentPoster
