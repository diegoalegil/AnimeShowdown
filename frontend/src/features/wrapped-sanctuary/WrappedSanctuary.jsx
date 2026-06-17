// ============================================================================
// WrappedSanctuary.jsx — ORQUESTADOR del peregrinaje. El Wrapped como recorrido
// de scroll vertical por SALAS de un santuario de montania: una sala por
// estadistica, cada una con su escenografia (capas transform/opacity
// pre-horneadas, cero blur). Una barra de peregrino vertical (nav de anclas,
// kanji por sala) marca el avance y permite saltar de sala.
//
// Stack: React 19 + React Compiler + Tailwind v4 (tokens) + sanctuary.css.
// CERO hex en JSX. Mobile-first. 60fps = solo transform/opacity.
//
// Datos: prop `wrapped` con la shape EXACTA de /api/wrapped/me:
//   { username, anio, votosTotales, top3:[{slug,nombre,votos}], mejorRacha,
//     universoTop:{anime,slug,pct} }
// Sin dato -> la sala correspondiente NO se monta (sin hueco). Cualquier
// estadistica extra entraria como prop OPCIONAL documentada.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext'
import PersonajeImg from '../../components/PersonajeImg'
import SanctuaryRoom from './SanctuaryRoom'
import BallotRain from './BallotRain'
import LanternPath from './LanternPath'
import TasteMirror, { TasteMirrorScene } from './TasteMirror'
import EmakiFinale from './EmakiFinale'
import {
  GUION,
  MAX_LANTERNS,
  TIMING,
  anioKanji,
  nfEs,
  podio,
  useCountUp,
  visibleRooms,
} from './sanctuary-core'

import './sanctuary.css'

const MEDALLA = ['bg-medal-gold', 'bg-medal-silver', 'bg-medal-bronze']
const ROMANO = ['I', 'II', 'III']

/* ── Odometro de votos (count-up al despertar). Componente a nivel de modulo
      (nunca definido dentro de otro componente: regla de react-refresh). ── */
function VotesOdometer({ value, awake, reduced }) {
  const ref = useRef(null)
  useCountUp(ref, Number(value || 0), awake, { durationMs: TIMING.odometer, reduced })
  return (
    <span
      ref={ref}
      className="sanctuary-odo font-mono text-[clamp(5rem,20vw,13rem)] font-extrabold leading-[0.92] tracking-tight tabular-nums text-gold"
    >
      {nfEs(value)}
    </span>
  )
}

/* ── Pedestal del altar (top3). ── */
function Pedestal({ c, pos }) {
  const altura = c.rank === 0 ? 150 : c.rank === 1 ? 108 : 80
  return (
    <div
      className="sanctuary-pedestal flex flex-col items-center justify-end"
      style={{ '--pd': `${(pos * TIMING.pedestalStep) / 1000}s` }}
    >
      <span
        className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full font-mono text-xs font-bold text-canvas ${MEDALLA[c.rank]}`}
      >
        {ROMANO[c.rank]}
      </span>
      <div
        className={`relative my-3 aspect-[2/3] w-[clamp(92px,21vw,124px)] overflow-hidden rounded-[10px] border ${
          c.rank === 0 ? 'border-border-gold' : 'border-white/[0.14]'
        }`}
      >
        <PersonajeImg
          slug={c.slug}
          nombre={c.nombre}
          width={124}
          height={186}
          sizes="124px"
          className="h-full w-full"
        />
        <span className="sr-only">{`${c.nombre}, puesto ${c.rank + 1} con ${nfEs(c.votos)} votos tuyos.`}</span>
      </div>
      <p className="m-0 max-w-[14ch] text-[15px] font-bold leading-tight text-fg-strong">{c.nombre}</p>
      <p className="m-0 mt-0.5 text-xs text-fg-muted">{c.anime}</p>
      <p className="m-0 mb-3.5 mt-2 font-mono text-[15px] font-bold tabular-nums text-gold">{nfEs(c.votos)}</p>
      <div
        aria-hidden="true"
        className="w-[clamp(96px,24vw,150px)] rounded-t-md border border-b-0 border-border-gold-subtle bg-gradient-to-b from-surface-alt to-surface"
        style={{ height: altura }}
      />
    </div>
  )
}

/**
 * @typedef {object} WrappedSanctuaryProps
 * @property {object} wrapped datos del endpoint /api/wrapped/me (ver cabecera)
 * @property {()=>void} [onCompartir] handler de compartir del emaki
 * @property {()=>void} [onVolverArena] handler de "volver a la arena"
 */

/**
 * El santuario del Wrapped.
 * @param {WrappedSanctuaryProps} props
 */
function WrappedSanctuary({ wrapped, onCompartir, onVolverArena }) {
  const reduced = useReducedMotion()
  const { play } = useSound()
  const rootRef = useRef(null)
  const rooms = visibleRooms(wrapped)
  const [active, setActive] = useState(rooms[0]?.id)
  const [awoke, setAwoke] = useState(() => ({}))
  const [feedback, setFeedback] = useState('')

  // Sala activa para el aria-current de la barra (IntersectionObserver).
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.55) setActive(e.target.id)
        }
      },
      { threshold: [0.55] },
    )
    rooms.forEach((r) => {
      const node = root.querySelector(`#${r.id}`)
      if (node) io.observe(node)
    })
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapped])

  // Pausa de loops decorativos (niebla) cuando el santuario sale del viewport.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver(
      ([e]) => root.classList.toggle('is-offscreen', !e.isIntersecting),
      { threshold: [0] },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [])

  // Coreografia de sonido al despertar cada sala (respeta el mute global del
  // SoundContext). setState dentro de callbacks de IO/timers SI es legal.
  const onWake = (id) => {
    setAwoke((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
    if (reduced) return
    if (id === 'entrada') window.setTimeout(() => play('playAcunado'), TIMING.stampDelay)
    else if (id === 'votos') play('playWhoosh')
    else if (id === 'altar') {
      play('playWhoosh')
      podio(wrapped.top3).forEach((_, i) => window.setTimeout(() => play('playClink'), 200 + i * 120))
    } else if (id === 'racha') {
      play('playWhoosh')
      const n = Math.min(Number(wrapped.mejorRacha || 0), MAX_LANTERNS)
      for (let i = 0; i < n; i += 1) window.setTimeout(() => play('playStreakHito'), 220 + i * TIMING.lanternStep)
    } else if (id === 'espejo') {
      play('playWhoosh')
      window.setTimeout(() => play('playVerdictStamp'), 700)
    } else if (id === 'emaki') play('playCampanilla')
  }

  const onCompartirInner = () => {
    play('playCampanilla')
    onCompartir?.()
    setFeedback('Tu emaki está listo para compartir')
  }

  const cls = (id) => (active === id ? 'text-gold-bright' : 'text-fg-muted')

  return (
    <div ref={rootRef} className="sanctuary relative w-full bg-canvas">
      {/* ── Barra de peregrino: nav de anclas, kanji por sala ── */}
      <nav
        aria-label="Salas del santuario"
        className="fixed right-[18px] top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3.5 rounded-full border border-white/[0.08] bg-bg/80 px-2 py-3.5"
      >
        {rooms.map((r) => (
          <a
            key={r.id}
            href={`#${r.id}`}
            aria-label={`Ir a ${r.titulo}`}
            aria-current={active === r.id ? 'true' : undefined}
            className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-full border font-kanji-serif text-[17px] transition-colors before:absolute before:inset-[-5px] before:content-[''] ${
              active === r.id ? 'border-border-gold bg-surface' : 'border-white/10 bg-surface'
            } ${cls(r.id)}`}
          >
            <span lang="ja">{r.kanji}</span>
          </a>
        ))}
      </nav>


      {/* ░░ SALA 1 — LA ENTRADA ░░ */}
      <SanctuaryRoom
        id="entrada"
        kanji={GUION.entrada.kanji}
        eyebrow="AnimeShowdown · El santuario del Wrapped"
        titulo="Has cruzado el torii"
        headingLevel="h1"
        labelScreen="Sala 01 — La Entrada"
        onWake={() => onWake('entrada')}
        scenery={
          <>
            <div
              className="sanctuary-mist"
              style={{
                '--mist-dur': '52s',
                opacity: 0.7,
                backgroundImage:
                  'radial-gradient(55% 75% at 50% 70%, color-mix(in srgb, var(--color-fg-muted) 7%, transparent), transparent 60%)',
              }}
            />
            <div
              className="sanctuary-mist"
              style={{
                '--mist-dur': '34s',
                backgroundImage:
                  'radial-gradient(60% 80% at 25% 60%, color-mix(in srgb, var(--color-fg-muted) 10%, transparent), transparent 60%)',
              }}
            />
          </>
        }
      >
        <div className="mt-6 flex flex-col items-center">
          <div className="sanctuary-rise relative rounded-b-[10px] rounded-t-md border border-border-gold-subtle bg-gradient-to-b from-surface-alt to-surface px-[30px] pb-5 pt-4 shadow-elev-2" style={{ '--pd': '0.24s' }}>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted">peregrino</p>
            <p className="m-0 mt-1 text-[clamp(1.4rem,5vw,2rem)] font-extrabold text-fg-strong">@{wrapped.username}</p>
          </div>
          <div className="relative mt-7 h-24 w-24">
            <div
              lang="ja"
              className="sanctuary-stamp absolute inset-0 flex items-center justify-center rounded-[10px] border-2 border-gold-pale/50 text-white"
              style={{ background: 'radial-gradient(circle at 50% 36%, var(--color-hanko), color-mix(in srgb, var(--color-hanko) 60%, black) 78%)' }}
            >
              <span className="font-kanji-serif text-[34px] leading-none">{anioKanji(wrapped.anio)}</span>
            </div>
          </div>
          <p className="sanctuary-rise m-0 mt-3.5 font-mono text-sm text-fg-muted" style={{ '--pd': '0.3s' }}>
            Tu temporada <span className="font-bold text-gold-bright">{wrapped.anio}</span> queda acuñada
          </p>
          <span className="sr-only">{`Peregrino ${wrapped.username}. Tu temporada ${wrapped.anio} en AnimeShowdown.`}</span>
        </div>
      </SanctuaryRoom>

      {/* ░░ SALA 2 — LA LLUVIA DE VOTOS ░░ */}
      {wrapped.votosTotales > 0 ? (
        <SanctuaryRoom
          id="votos"
          kanji={GUION.votos.kanji}
          eyebrow="Sala 02 · La lluvia de votos"
          titulo="Tu voz cayó sobre la arena, papeleta a papeleta"
          labelScreen="Sala 02 — La Lluvia de Votos"
          onWake={() => onWake('votos')}
          scenery={<BallotRain />}
        >
          <div className="mt-3">
            <VotesOdometer value={wrapped.votosTotales} awake={!!awoke.votos} reduced={reduced} />
          </div>
          <p className="mt-2.5 text-[15px] text-fg-muted">votos emitidos en {wrapped.anio}</p>
          <span className="sr-only">{`${nfEs(wrapped.votosTotales)} votos emitidos en la arena en ${wrapped.anio}.`}</span>
        </SanctuaryRoom>
      ) : null}

      {/* ░░ SALA 3 — EL ALTAR DE LOS FIELES ░░ */}
      {Array.isArray(wrapped.top3) && wrapped.top3.length ? (
        <SanctuaryRoom
          id="altar"
          kanji={GUION.altar.kanji}
          eyebrow="Sala 03 · El altar de los fieles"
          titulo="Tres nombres recibieron tus ofrendas"
          labelScreen="Sala 03 — El Altar de los Fieles"
          onWake={() => onWake('altar')}
        >
          <div className="mt-9 flex items-end justify-center gap-[clamp(10px,3vw,26px)]">
            {podio(wrapped.top3).map((c, pos) => (
              <Pedestal key={c.slug ?? pos} c={c} pos={pos} />
            ))}
          </div>
        </SanctuaryRoom>
      ) : null}

      {/* ░░ SALA 4 — LA SENDA DE LA RACHA ░░ */}
      {wrapped.mejorRacha >= 1 ? (
        <SanctuaryRoom
          id="racha"
          kanji={GUION.racha.kanji}
          eyebrow="Sala 04 · La senda de la racha"
          titulo={
            wrapped.mejorRacha === 1
              ? 'Una sola chispa — pero toda llama empieza por una'
              : `${nfEs(wrapped.mejorRacha)} votos seguidos sin fallar a la arena`
          }
          labelScreen="Sala 04 — La Senda de la Racha"
          onWake={() => onWake('racha')}
        >
          <LanternPath racha={wrapped.mejorRacha} />
          <div
            className="sanctuary-lantern-num mt-6 font-mono text-[clamp(4rem,16vw,10rem)] font-extrabold leading-[0.9] tabular-nums text-gold"
            style={{
              // El número se planta DESPUÉS de que los faroles se enciendan en
              // stagger: --lnd ≈ (nº faroles × paso) + margen (lo consume sanctuary.css).
              '--lnd': `${Math.min(Number(wrapped.mejorRacha || 0), MAX_LANTERNS) * TIMING.lanternStep + 200}ms`,
            }}
          >
            {nfEs(wrapped.mejorRacha)}
          </div>
          <p className="mt-2.5 text-[15px] text-fg-muted">
            {wrapped.mejorRacha === 1 ? 'Vuelve mañana y enciende la segunda.' : 'tu mejor racha de votos consecutivos'}
          </p>
        </SanctuaryRoom>
      ) : null}

      {/* ░░ SALA 5 — EL ESPEJO DEL GUSTO ░░ */}
      {wrapped.universoTop?.anime ? (
        <SanctuaryRoom
          id="espejo"
          kanji={GUION.espejo.kanji}
          eyebrow="Sala 05 · El espejo del gusto"
          titulo="El espejo de tu gusto"
          headingSrOnly
          labelScreen="Sala 05 — El Espejo del Gusto"
          className="!items-end"
          scenery={<TasteMirrorScene universoTop={wrapped.universoTop} />}
          onWake={() => onWake('espejo')}
        >
          <TasteMirror universoTop={wrapped.universoTop} awake={!!awoke.espejo} reduced={reduced} />
        </SanctuaryRoom>
      ) : null}

      {/* ░░ SALA FINAL — EL EMAKI ░░ */}
      <SanctuaryRoom
        id="emaki"
        kanji={GUION.emaki.kanji}
        eyebrow="Sala final · El emaki"
        titulo="El emaki de tu temporada"
        headingSrOnly
        labelScreen="Sala Final — El Emaki"
        onWake={() => onWake('emaki')}
      >
        <EmakiFinale
          wrapped={wrapped}
          feedback={feedback}
          onCompartir={onCompartirInner}
          onVolver={onVolverArena}
        />
      </SanctuaryRoom>
    </div>
  )
}

export default WrappedSanctuary
