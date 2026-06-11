import { useEffect, useMemo, useState } from 'react'
import { useSeo } from '../hooks/useSeo'
import { getStatsPersonaje } from '../lib/personajes-core'
import { slugifyAnime } from '../lib/animes'
import { brandImage } from '../lib/brand-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import PersonajeImg from '../components/PersonajeImg'
import TvBroadcastShell from '../features/tv/TvBroadcastShell'

/**
 * TV Mode — retransmisión deportiva japonesa a pantalla completa, sin
 * chrome de la SPA. Para streamers, pantallas de eventos o una raspberry
 * en el local de un fan.
 *
 * <p>El paquete broadcast (TvBroadcastShell) pone el corte katana entre
 * vistas, el lower-third dorado del protagonista de cada segmento, el
 * ticker inferior con el top ELO y el bug de esquina (que es la salida).
 * Cada vista lleva de fondo la scene REAL del banco de marca del anime
 * protagonista, con scrim — las auroras decorativas desaparecen.
 *
 * <p>Sin backend — todo derivado del catálogo cliente-side. Los picks de
 * spotlight/matchup viven aquí (los lower-thirds los necesitan) y avanzan
 * con cada ciclo completo de rotación.
 */
const DURACION_S = 10

function pickRandom(arr, seed) {
  if (!arr.length) return null
  // Sin Math.random: el seed cycling produce el mismo personaje en el
  // mismo tick (predecible en tests).
  const idx = (seed * 2654435761) >>> 0
  return arr[idx % arr.length]
}

function sceneDe(anime) {
  if (!anime) return null
  return brandImage(`${slugifyAnime(anime)}-scene-01`)?.src ?? null
}

function TvModePage() {
  useSeo({
    title: 'TV Mode',
    description:
      'Vista pantalla completa para streamers. Rotación de top ELO, personaje destacado y matchup random.',
    noindex: true,
  })
  const { personajes } = usePersonajesCatalogo()
  const top10 = useMemo(
    () =>
      [...personajes]
        .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
        .sort((a, b) => b.elo - a.elo)
        .slice(0, 10),
    [personajes],
  )
  // El tick avanza al completar cada ciclo de rotación → spotlight y
  // matchup estrenan protagonistas en cada vuelta.
  const [tick, setTick] = useState(0)

  // Esc saca del fullscreen (la salida del modo es el bug de esquina).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && document.exitFullscreen) {
        try {
          document.exitFullscreen()
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const lider = top10[0]
  const spot = useMemo(() => pickRandom(personajes, tick + 7), [personajes, tick])
  const duelo = useMemo(() => {
    const a = pickRandom(personajes, tick + 1)
    let b = pickRandom(personajes, tick + 100)
    if (!a || !b) return null
    if (b.slug === a.slug) b = pickRandom(personajes, tick + 200)
    const eloA = getStatsPersonaje(a.slug).elo
    const eloB = getStatsPersonaje(b.slug).elo
    return { a, b, eloA, eloB, favorito: eloA > eloB ? a : b, diff: Math.abs(eloA - eloB) }
  }, [personajes, tick])

  const vistas = useMemo(() => {
    if (!lider || !spot || !duelo) return []
    const statsSpot = getStatsPersonaje(spot.slug)
    return [
      {
        id: 'top10',
        etiqueta: 'Top 10 ELO base',
        alineacion: 'centro',
        scene: sceneDe(lider.anime),
        lowerThird: {
          kanji: '王',
          titulo: lider.nombre,
          sub: `Nº 1 · ${lider.elo} ELO base · ${lider.anime}`,
        },
        render: () => <VistaTop10 top10={top10} />,
      },
      {
        id: 'spotlight',
        etiqueta: 'Personaje destacado',
        scene: sceneDe(spot.anime),
        lowerThird: {
          kanji: '推',
          titulo: spot.nombre,
          sub: `${spot.anime} · ${statsSpot.elo} ELO base`,
        },
        render: () => <VistaSpotlight p={spot} stats={statsSpot} />,
      },
      {
        id: 'matchup',
        etiqueta: 'Matchup random',
        alineacion: 'centro',
        scene: sceneDe(duelo.favorito.anime),
        lowerThird: {
          kanji: '対',
          titulo: `${duelo.a.nombre} vs ${duelo.b.nombre}`,
          sub: `favorito · ${duelo.favorito.nombre} (+${duelo.diff} ELO)`,
        },
        render: () => <VistaMatchup duelo={duelo} />,
      },
    ]
  }, [lider, spot, duelo, top10])

  // Ticker: el top 10 real con su rank — sin deltas inventados (el
  // catálogo cliente no trae histórico).
  const movers = useMemo(
    () => top10.map((p, i) => ({ slug: p.slug, nombre: p.nombre, elo: p.elo, rank: i + 1 })),
    [top10],
  )

  if (vistas.length === 0) {
    return <div className="fixed inset-0 z-50 bg-bg" aria-busy="true" />
  }

  return (
    <TvBroadcastShell
      vistas={vistas}
      movers={movers}
      segundos={DURACION_S}
      onVistaChange={(idx) => {
        if (idx === 0) setTick((t) => t + 1)
      }}
    />
  )
}

function VistaTop10({ top10 }) {
  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center px-4 pb-20 pt-14 sm:px-8">
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold text-gold sm:text-[12px]">Top 10 ELO base</p>
          <h1 className="font-display mt-2 text-[clamp(1.4rem,4.5vw,3.2rem)] font-bold leading-none">
            ¿Quién manda hoy?
          </h1>
        </div>
        <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
          {top10.map((p, i) => (
            <li
              key={p.slug}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-bg/65 p-2.5 sm:p-3"
            >
              <span className="font-mono text-[11px] font-bold text-gold">#{i + 1}</span>
              <PersonajeImg
                slug={p.slug}
                src={p.imagenUrl ?? p.imagen}
                alt={p.nombre}
                className="h-20 w-16 rounded-lg object-cover object-top sm:h-28 sm:w-20"
              />
              <p className="line-clamp-1 text-center text-[13px] font-bold sm:text-sm">{p.nombre}</p>
              <p className="line-clamp-1 text-center text-[10px] text-fg-muted sm:text-[11px]">{p.anime}</p>
              <p className="font-mono text-sm font-bold text-gold sm:text-base">{p.elo}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function VistaSpotlight({ p, stats }) {
  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0
  return (
    <section className="relative z-10 grid h-full w-full max-w-6xl items-center gap-6 justify-self-center px-4 pb-24 pt-16 sm:gap-12 sm:px-8 md:grid-cols-2">
      <div className="mx-auto aspect-[2/3] w-auto max-h-[40vh] md:max-h-[62vh] md:w-full md:max-w-md">
        <PersonajeImg
          slug={p.slug}
          src={p.imagenUrl ?? p.imagen}
          alt={p.nombre}
          className="h-full w-full rounded-2xl object-cover object-top shadow-elev-3 sm:rounded-3xl"
        />
      </div>
      <div className="flex flex-col gap-3 sm:gap-4">
        <p className="text-[10px] font-semibold text-gold sm:text-[12px]">Personaje destacado</p>
        <h2 className="font-display text-[clamp(1.75rem,6vw,4.5rem)] font-bold leading-none">{p.nombre}</h2>
        <p className="text-base text-fg-muted sm:text-2xl">{p.anime}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          <Kpi label="ELO" value={stats.elo} accent />
          <Kpi label="Victorias" value={stats.wins} />
          <Kpi label="Win rate" value={`${winRate}%`} />
        </div>
        {p.descripcion && (
          <p className="line-clamp-3 text-sm leading-relaxed text-fg-muted sm:text-lg">{p.descripcion}</p>
        )}
      </div>
    </section>
  )
}

function VistaMatchup({ duelo }) {
  const { a, b, eloA, eloB, favorito, diff } = duelo
  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center px-4 pb-24 pt-16 sm:px-8">
      <div className="w-full max-w-6xl">
        <div className="mb-5 flex flex-col items-center text-center sm:mb-8">
          <p className="text-[10px] font-semibold text-gold sm:text-[12px]">Matchup random</p>
          <h2 className="font-display mt-2 text-[clamp(1.5rem,5vw,4rem)] font-bold leading-none">
            ¿Quién ganaría?
          </h2>
        </div>
        <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
          <Versus personaje={a} elo={eloA} esFavorito={favorito.slug === a.slug} />
          <span
            lang="ja"
            className="order-first col-span-2 text-center text-3xl font-bold text-gold sm:order-none sm:col-span-1 sm:text-6xl [font-family:var(--font-kanji-serif)]"
          >
            対
          </span>
          <Versus personaje={b} elo={eloB} esFavorito={favorito.slug === b.slug} />
        </div>
        <p className="mt-4 text-center text-[12px] text-fg-muted sm:mt-6 sm:text-base">
          Diferencia ELO: <strong className="text-gold">{diff}</strong>
          {' · '}
          Favorito: <strong className="text-fg-strong">{favorito.nombre}</strong>
        </p>
      </div>
    </section>
  )
}

function Versus({ personaje, elo, esFavorito }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 sm:gap-3 sm:rounded-2xl sm:p-6 ${
        esFavorito ? 'border-accent bg-accent/15' : 'border-white/10 bg-bg/65'
      }`}
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl ?? personaje.imagen}
        alt={personaje.nombre}
        className="h-28 w-20 rounded-lg object-cover object-top sm:h-64 sm:w-48"
      />
      <p className="line-clamp-1 text-center text-sm font-bold sm:text-2xl">{personaje.nombre}</p>
      <p className="line-clamp-1 text-center text-[10px] text-fg-muted sm:text-sm">{personaje.anime}</p>
      <p className="font-mono text-lg font-extrabold text-gold sm:text-2xl">{elo}</p>
    </div>
  )
}

function Kpi({ label, value, accent = false }) {
  return (
    <div className="rounded-lg border border-white/10 bg-bg/65 p-2.5 sm:p-3">
      <p className="text-[9px] font-medium text-fg-muted sm:text-[10px]">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold sm:text-2xl ${accent ? 'text-gold' : 'text-fg-strong'}`}>
        {value}
      </p>
    </div>
  )
}

export default TvModePage
