import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppLink } from '../../../components/AppLink'
import PersonajeImg from '../../../components/PersonajeImg'
import { markPersonajeHero } from '../../../lib/viewTransitions'
import { brandImage } from '../../../lib/brand-assets'
import './ranking-podium.css'

/**
 * RankingPodium — "El podio de los tres": tres estandartes verticales de
 * tela (oro al centro y más alto, plata y bronce flanqueando) colgados de
 * una varilla dorada, sobre el arte de marca del universo del nº1.
 *
 * Sustituye al podio "Salón del Trono" en /ranking (pestaña ELO). Las
 * clases podio-* viven en ranking-podium.css (importado aquí) — los
 * @keyframes NO se inyectan en runtime (CSP por hash).
 *
 * Coreografía (todas las duraciones escalan con --podio-vel):
 *  - Entrada: cuerdas 80ms antes que su tela; telas scaleY 0.04→1 en
 *    550ms var(--ease-lift), stagger 120ms (oro → plata → bronce). Gateada
 *    por [data-podio-vivo], que se retira al terminar: los remounts
 *    posteriores (swap de laterales) no re-despliegan.
 *  - Relevo de nº1 (delta WS → cambia top3[0].slug): el saliente se
 *    recoge (400ms var(--ease-brush)), el entrante cae (550ms), los
 *    laterales hacen swap por FLIP (WAAPI, translateX) y el sello 王 se
 *    estampa (380ms ease-stamp) con sangrado por cross-fade de una capa
 *    pre-renderizada. El fondo cross-fadea entre dos capas apiladas.
 *    Keyed por slug del nº1: un re-render con el mismo líder JAMÁS
 *    re-anima, y el sello solo existe tras un relevo real (no al montar).
 *  - prefers-reduced-motion: estandartes ya desplegados; el relevo entero
 *    degrada a un cross-fade de 200ms (.podio-xfade).
 *
 * Reglas de perf que cumple: solo transform/opacity; cero blur/filters;
 * cero loops infinitos (la ondulación de hover es una pasada CSS); el
 * grid reserva su geometría desde el primer paint → cero CLS bajo la
 * tabla (el skeleton usa la misma silueta).
 *
 * Datos que NO existen aún en el producto (no se inventan aquí):
 *  - kanji de universo: llega por la prop `kanjiPorAnime`; sin entrada,
 *    la esquina queda vacía (sin japonés de relleno).
 *  - slug de anime para brandImage(): llega por `animeSlugPorNombre`;
 *    sin entrada, el podio se pinta sin fondo de escena (solo scrim).
 *
 * @param {object} props
 * @param {Array<{slug: string, nombre: string, anime: string, elo: number,
 *   imagenUrl?: string, imagenColorDominante?: string}>} props.top3
 *   Los tres primeros del ranking, en orden. Mismo shape que consume
 *   RankRowElo. Longitud exacta 3 (el caller ya lo garantiza).
 * @param {Record<string, string>} [props.kanjiPorAnime]
 *   Mapa nombre de anime → kanji de universo (kanji REAL con significado,
 *   p.ej. 'Dragon Ball' → 龍). Pendiente de promover a data/.
 * @param {Record<string, string>} [props.animeSlugPorNombre]
 *   Mapa nombre de anime → slug canónico del catálogo, para resolver
 *   brandImage(`${slug}-scene-01`) del fondo.
 * @param {boolean} [props.isLoading] Silueta .skl de los tres estandartes.
 */
function RankingPodium({
  top3,
  kanjiPorAnime,
  animeSlugPorNombre,
  isLoading = false,
}) {
  const [mostrar, setMostrar] = useState(top3)
  const [ceremonia, setCeremonia] = useState(null) // {fase:'recogida'|'caida'|'xfade', entrante?}
  const [selloPara, setSelloPara] = useState(null)
  const [vivo, setVivo] = useState(true)
  const mostrarRef = useRef(top3)
  const rectsRef = useRef(null)
  const liRefs = useRef(new Map())
  const anuncioRef = useRef(null)

  useEffect(() => {
    mostrarRef.current = mostrar
  }, [mostrar])

  // La gate de entrada se retira al terminar la coreografía (~1.6s):
  // a partir de ahí ninguna tela remontada vuelve a desplegarse sola.
  useEffect(() => {
    const t = setTimeout(() => setVivo(false), 1600)
    return () => clearTimeout(t)
  }, [])

  // Contrato del relevo, Compiler-safe en dos mitades:
  //  - mismo líder → `mostrar` converge a top3 AJUSTANDO DURANTE EL RENDER
  //    (patrón oficial de derived state; refetch del ELO y re-renders del
  //    padre jamás re-animan).
  //  - cambia el líder → se agenda el relevo como estado pendiente y un
  //    effect corre la ceremonia con timers (setState solo en callbacks).
  const [prevTop3, setPrevTop3] = useState(top3)
  const [liderVisto, setLiderVisto] = useState(top3[0]?.slug)
  const [relevoPendiente, setRelevoPendiente] = useState(null)
  if (prevTop3 !== top3) {
    setPrevTop3(top3)
    if (top3[0]?.slug === liderVisto) {
      setMostrar(top3)
    } else {
      setLiderVisto(top3[0]?.slug)
      setRelevoPendiente(top3)
    }
  }

  useEffect(() => {
    if (!relevoPendiente) return undefined
    const top3Nuevo = relevoPendiente
    const nuevoLider = top3Nuevo[0]?.slug
    // aria-live: el announce va en un nodo persistente, no en un toast.
    if (anuncioRef.current) {
      anuncioRef.current.textContent = `Nuevo número uno: ${top3Nuevo[0].nombre}, ${top3Nuevo[0].elo}`
    }
    const timers = []
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // El relevo entero degrada a un cross-fade de 200ms.
      timers.push(
        setTimeout(() => {
          setMostrar(top3Nuevo)
          setSelloPara(nuevoLider)
          setCeremonia({ fase: 'xfade' })
        }, 0),
      )
      timers.push(setTimeout(() => setCeremonia(null), 260))
    } else {
      timers.push(setTimeout(() => setCeremonia({ fase: 'recogida' }), 0))
      timers.push(
        setTimeout(() => {
          // Snapshot de posiciones (por slug visible) para el FLIP lateral.
          const rects = {}
          mostrarRef.current.forEach((p, i) => {
            const el = liRefs.current.get(i + 1)
            if (el) rects[p.slug] = el.getBoundingClientRect()
          })
          rectsRef.current = rects
          setMostrar(top3Nuevo)
          setSelloPara(nuevoLider)
          setCeremonia({ fase: 'caida', entrante: nuevoLider })
        }, 400),
      )
    }
    // El pendiente NO se anula aquí: anularlo dispararía este cleanup y
    // mataría el timer de los 400ms. Un relevo nuevo lo pisa (los timers
    // del anterior se limpian) — coalescencia natural de ráfagas.
    return () => timers.forEach(clearTimeout)
  }, [relevoPendiente])

  // FLIP de los laterales tras el commit del relevo (WAAPI, --ease-lift).
  useLayoutEffect(() => {
    if (ceremonia?.fase !== 'caida' || !rectsRef.current) return undefined
    const prev = rectsRef.current
    rectsRef.current = null
    mostrarRef.current.forEach((p, i) => {
      if (p.slug === ceremonia.entrante) return
      const el = liRefs.current.get(i + 1)
      const r0 = prev[p.slug]
      if (!el || !r0 || typeof el.animate !== 'function') return
      const dx = r0.left - el.getBoundingClientRect().left
      if (Math.abs(dx) < 1) return
      const ease =
        getComputedStyle(el).getPropertyValue('--ease-lift').trim() || 'ease-out'
      el.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
        { duration: 400, easing: ease },
      )
    })
    const t = setTimeout(() => setCeremonia(null), 1400)
    return () => clearTimeout(t)
  }, [ceremonia])

  const lider = mostrar[0]
  const escena = !isLoading && lider && animeSlugPorNombre?.[lider.anime]
    ? brandImage(`${animeSlugPorNombre[lider.anime]}-scene-01`)
    : null
  const hayEmpate =
    !isLoading &&
    mostrar.length === 3 &&
    (mostrar[1].elo === mostrar[0].elo || mostrar[2].elo === mostrar[1].elo)
  const eloEmpatado = hayEmpate
    ? (mostrar[1].elo === mostrar[0].elo ? mostrar[0].elo : mostrar[1].elo)
    : null

  return (
    <section
      className={`podio-escenario rounded-2xl border border-border bg-bg px-3 pb-5 pt-6 sm:px-6 sm:pb-8 sm:pt-9 ${
        ceremonia?.fase === 'xfade' ? 'podio-xfade' : ''
      }`}
      aria-label="podio del ranking"
    >
      {escena && <FondoEscena escena={escena} />}
      <div className="podio-varilla mx-auto max-w-3xl" aria-hidden="true" />
      <ol
        role="list"
        aria-label="podio del ranking"
        aria-busy={isLoading || undefined}
        data-podio-vivo={vivo || undefined}
        className="mx-auto flex max-w-3xl items-start justify-center gap-2 sm:gap-7"
      >
        {isLoading
          ? [1, 2, 3].map((rank) => <EstandarteSkeleton key={rank} rank={rank} />)
          : mostrar.map((p, i) => (
              <Estandarte
                key={`puesto-${i + 1}`}
                personaje={p}
                rank={i + 1}
                kanjiUniverso={kanjiPorAnime?.[p.anime]}
                empatado={i > 0 && p.elo === mostrar[0].elo}
                recogiendo={ceremonia?.fase === 'recogida' && i === 0}
                entrante={ceremonia?.fase === 'caida' && p.slug === ceremonia.entrante}
                sello={selloPara === p.slug && i === 0}
                registrarLi={(el) => liRefs.current.set(i + 1, el)}
              />
            ))}
      </ol>
      {hayEmpate && (
        <div className="mx-auto mt-4 max-w-xl text-center">
          <div className="podio-empate-regla" aria-hidden="true" />
          <p className="mt-2 font-mono text-[11px] text-fg-muted">
            empate a <strong className="font-bold text-gold">{eloEmpatado} ELO</strong>{' '}
            en el top 3 · desempate: orden de catálogo (
            <strong className="font-bold text-gold">personaje.id</strong> ascendente)
          </p>
        </div>
      )}
      {/* aria-live persistente: el relevo se anuncia aunque lo decorativo
          esté reducido o fuera de viewport. */}
      <p ref={anuncioRef} aria-live="polite" className="sr-only" />
    </section>
  )
}

const MEDALLA = ['oro', 'plata', 'bronce']
const ETIQUETA = ['Campeón actual', '2º puesto', '3er puesto']
// Oro al centro: orden visual plata | oro | bronce; el DOM mantiene 1º→3º
// para lectores de pantalla. Stagger: oro primero.
const ORDEN_VISUAL = ['order-2', 'order-1', 'order-3']
const STAGGER_I = [0, 1, 2]

function Estandarte({
  personaje: p,
  rank,
  kanjiUniverso,
  empatado,
  recogiendo,
  entrante,
  sello,
  registrarLi,
}) {
  const retratoRef = useRef(null)
  const esOro = rank === 1
  const alto = esOro || empatado
  return (
    <li
      ref={registrarLi}
      className={`flex flex-col ${ORDEN_VISUAL[rank - 1]} ${
        esOro ? 'w-[40%] max-w-[248px]' : 'w-[27%] max-w-[200px]'
      }`}
      style={{ '--podio-i': STAGGER_I[rank - 1] }}
    >
      <div className="podio-cuerdas h-5 sm:h-9" aria-hidden="true">
        <span className="podio-cuerda podio-cuerda--l" />
        <span className="podio-cuerda podio-cuerda--r" />
      </div>
      <AppLink
        to={`/personajes/${p.slug}`}
        onViewTransitionStart={() => markPersonajeHero(retratoRef.current)}
        aria-label={`${rank}º — ${p.nombre}, ${p.anime}, ${p.elo} ELO. ${ETIQUETA[rank - 1]}. Ver ficha.`}
        className="podio-banner block rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-gold"
      >
        <div className="podio-pivote">
          {/* key por slug: la tela es la identidad del ocupante; al cambiar
              el ocupante del puesto, la tela nueva monta (y cae si es el
              entrante de un relevo). */}
          <div
            key={p.slug}
            className={`podio-tela podio-tela--${MEDALLA[rank - 1]} ${
              recogiendo ? 'podio-tela--recoge' : ''
            } ${entrante ? 'podio-tela--cae' : ''} ${
              alto ? 'h-[252px] sm:h-[444px]' : 'h-[196px] sm:h-[372px]'
            }`}
          >
            <span ref={retratoRef} className="podio-retrato" aria-hidden="true">
              <PersonajeImg
                slug={p.slug}
                src={p.imagenUrl}
                nombre={p.nombre}
                colorDominante={p.imagenColorDominante}
                alt=""
                loading="eager"
                sizes={esOro ? '(min-width: 640px) 248px, 40vw' : '(min-width: 640px) 200px, 27vw'}
                fit="cover"
                position="top"
                className="h-full w-full"
              />
            </span>
            <span className="podio-tela-scrim" aria-hidden="true" />
            {kanjiUniverso && (
              <>
                <span
                  lang="ja"
                  aria-hidden="true"
                  className="podio-kanji-universo text-[17px] sm:text-[28px]"
                >
                  {kanjiUniverso}
                </span>
                <span
                  lang="ja"
                  aria-hidden="true"
                  className="podio-kanji-agua text-5xl sm:text-[88px]"
                >
                  {kanjiUniverso}
                </span>
              </>
            )}
            {sello && (
              <span lang="ja" aria-hidden="true" className="podio-sello-rey">
                王
              </span>
            )}
            <span className="podio-pie relative z-[2] mt-auto flex flex-col gap-px px-2 pb-5 text-center sm:gap-0.5 sm:px-3.5 sm:pb-9">
              <span className="font-mono text-[9px] font-extrabold tracking-[0.04em] text-(--podio-medalla) sm:text-[11px]">
                {`Nº 0${rank}`}
              </span>
              <span
                className={`truncate font-extrabold text-fg-strong drop-shadow-scrim ${
                  esOro ? 'text-sm sm:text-xl' : 'text-xs sm:text-[17px]'
                }`}
              >
                {p.nombre}
              </span>
              <span className="truncate text-[9px] text-fg-muted drop-shadow-scrim sm:text-2xs">
                {p.anime}
              </span>
              <span
                className={`mt-0.5 font-mono font-extrabold tabular-nums text-(--podio-medalla) sm:mt-1.5 ${
                  esOro ? 'text-lg sm:text-[26px]' : 'text-[15px] sm:text-[22px]'
                }`}
              >
                {p.elo}
                <span className="ml-1 text-[10px] font-bold opacity-70">ELO</span>
              </span>
            </span>
          </div>
        </div>
      </AppLink>
    </li>
  )
}

function EstandarteSkeleton({ rank }) {
  const esOro = rank === 1
  return (
    <li
      aria-hidden="true"
      className={`flex flex-col ${ORDEN_VISUAL[rank - 1]} ${
        esOro ? 'w-[40%] max-w-[248px]' : 'w-[27%] max-w-[200px]'
      }`}
      style={{ '--podio-i': STAGGER_I[rank - 1] }}
    >
      <div className="podio-cuerdas h-5 sm:h-9">
        <span className="podio-cuerda podio-cuerda--l" />
        <span className="podio-cuerda podio-cuerda--r" />
      </div>
      <div
        className={`podio-skl skl ${
          esOro ? 'h-[252px] sm:h-[444px]' : 'h-[196px] sm:h-[372px]'
        }`}
      />
    </li>
  )
}

/**
 * Dos capas de escena apiladas: el relevo solo cross-fadea opacity entre
 * ellas (regla anti-jank de Safari: nada de animar src/filters).
 * @param {{escena: import('../../../lib/brand-assets').BrandImage}} props
 */
function FondoEscena({ escena }) {
  const [capas, setCapas] = useState(() => [
    { escena, activa: true },
    { escena: null, activa: false },
  ])
  // Ajuste durante el render (patrón oficial, Compiler-safe): si la escena
  // cambió, la capa inactiva recibe la nueva y pasa a activa — el CSS
  // cross-fadea opacity entre las dos <img> apiladas.
  const activa = capas.find((c) => c.activa)
  if (activa?.escena?.src !== escena.src) {
    setCapas((prev) =>
      prev.map((c) =>
        c.activa ? { ...c, activa: false } : { escena, activa: true },
      ),
    )
  }
  return (
    <div className="podio-fondo" aria-hidden="true">
      {capas.map((c, i) =>
        c.escena ? (
          <img
            key={i}
            src={c.escena.src}
            srcSet={c.escena.srcSet}
            sizes="100vw"
            alt=""
            data-activa={c.activa || undefined}
            loading="lazy"
            decoding="async"
          />
        ) : null,
      )}
      <div className="podio-fondo-scrim" />
    </div>
  )
}

export default RankingPodium
