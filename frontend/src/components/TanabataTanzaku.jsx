import { useEffect, useRef, useState } from 'react'
import PersonajeImg from './PersonajeImg'
import { readLocalVotes } from '../lib/localVoteRanking'
import { getPersonajeBySlug } from '../lib/personajes-core'

/**
 * TanabataTanzaku — capa estacional de Tanabata (1–7 de julio).
 *
 * <p>Del borde superior de la PÁGINA (absolute, no fixed: las tiras se
 * quedan arriba y desaparecen con el scroll — discreción) cuelgan
 * {@link NUM_TANZAKU} tanzaku de washi en cian/oro/carmesí con el kanji
 * 願 (deseo) en vertical, suspendidos de un hairline de bambú. Oscilan
 * con rotate + transform-origin top a fases distintas — CSS puro, mismo
 * enfoque que los pétalos del hanami.
 *
 * <p>UNA tira por sesión es "tuya" (sessionStorage): hilo dorado + nudo.
 * Al tocarla gira (rotateY + scale, solo transform) y revela tu personaje
 * más votado del ranking personal LOCAL como deseo concedido. Las demás
 * tiras responden al tacto/hover con un impulso pendular one-shot
 * (tz-nudge, solo rotate) — siguen siendo decoración aria-hidden.
 *
 * <p>Perf (presupuesto Safari): 7 nodos animados solo-transform; el nodo
 * preserve-3d (.tz-flip) no lleva filter/overflow/opacity y ambas caras
 * llevan -webkit-backface-visibility; pausa fuera de viewport (IO) y con
 * pestaña oculta (html.as-tab-hidden existente); carga vía import()
 * dinámico desde SeasonalLayer — 0 bytes fuera de ventana.
 *
 * <p>A11y: con prefers-reduced-motion las tiras quedan ESTÁTICAS pero
 * visibles y tu tanzaku sigue siendo tocable (la media query apaga
 * animación y transición; el flip resuelve instantáneo). La tira propia
 * es un <button> real con aria-label; el resto es decoración aria-hidden.
 *
 * @param topPersonaje  {nombre, slug, imagenUrl} — override para tests;
 *                      por defecto se deriva del ranking personal local.
 */

const NUM_TANZAKU = 7
const SESSION_KEY = 'animeshowdown.tanabata.miTanzaku'
const TONOS = ['tz-gold', 'tz-electric', 'tz-accent']

function elegirMiTanzaku() {
  try {
    const guardado = sessionStorage.getItem(SESSION_KEY)
    if (guardado !== null) return Number(guardado)
    const idx = Math.floor(Math.random() * NUM_TANZAKU)
    sessionStorage.setItem(SESSION_KEY, String(idx))
    return idx
  } catch {
    return 0
  }
}

function generarTanzaku() {
  const miIndex = elegirMiTanzaku()
  return Array.from({ length: NUM_TANZAKU }, (_, i) => ({
    id: i,
    // Reparto uniforme con jitter: nunca dos tiras solapadas.
    left: ((i + 0.5) / NUM_TANZAKU) * 100 + (Math.random() - 0.5) * 6,
    hilo: 28 + Math.random() * 58,
    alto: 150 + Math.random() * 40,
    dur: 4.5 + Math.random() * 2.5,
    delay: -Math.random() * 6, // fase distinta por tira
    amp: 1.8 + Math.random() * 1.2,
    tono: TONOS[i % TONOS.length],
    mia: i === miIndex,
  }))
}

/** El deseo: tu personaje más votado del ranking personal local. */
function topPersonajeLocal() {
  try {
    const votos = readLocalVotes()
    if (!votos.length) return null
    const cuenta = new Map()
    for (const voto of votos) {
      cuenta.set(voto.ganadorSlug, (cuenta.get(voto.ganadorSlug) ?? 0) + 1)
    }
    const [slug] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]
    const personaje = getPersonajeBySlug(slug)
    if (!personaje) return null
    return { slug: personaje.slug, nombre: personaje.nombre, imagenUrl: personaje.imagenUrl }
  } catch {
    return null
  }
}

function CaraFrente({ tono }) {
  return (
    <span className={`tz-cara tz-frente ${tono}`}>
      <span className="tz-agujero" />
      <span className="tz-kanji">願</span>
      <span className="tz-firma">七夕</span>
    </span>
  )
}

function CaraReverso({ topPersonaje }) {
  return (
    <span className="tz-cara tz-reverso">
      {topPersonaje ? (
        <PersonajeImg
          slug={topPersonaje.slug}
          src={topPersonaje.imagenUrl}
          nombre={topPersonaje.nombre}
          alt=""
          loading="lazy"
          sizes="96px"
          className="tz-arte"
        />
      ) : (
        <span className="tz-arte tz-arte-vacia">願いが叶う</span>
      )}
      <span className="tz-pie">
        <span className="tz-pie-kanji text-gold">願いが叶った</span>
        <span className="tz-pie-nombre font-mono">
          {topPersonaje?.nombre ?? 'vota duelos para pedir tu deseo'}
        </span>
      </span>
    </span>
  )
}

function TanabataTanzaku({ topPersonaje: topPersonajeProp = null }) {
  // useState lazy init (no useMemo): mismo criterio que SakuraPetals —
  // React Compiler exige useMemo puro y aquí hay Math.random/storage.
  const [tiras] = useState(generarTanzaku)
  const [deseo] = useState(() => topPersonajeProp ?? topPersonajeLocal())
  const [concedido, setConcedido] = useState(false)
  // Tira con impulso activo (una a la vez). El animationend limpia el
  // atributo para que el próximo toque pueda relanzar la animación.
  const [empujada, setEmpujada] = useState(null)
  const [pausado, setPausado] = useState(false)
  const contenedorRef = useRef(null)

  // Loop infinito pausado fuera del viewport (las tiras viven arriba de
  // la página: en cuanto haces scroll, dejan de costar frames).
  useEffect(() => {
    const nodo = contenedorRef.current
    if (!nodo || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setPausado(!entry.isIntersecting))
    io.observe(nodo)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={contenedorRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-72 overflow-x-clip"
      data-tz-pausado={pausado ? 'true' : undefined}
    >
      <span className="tz-bambu" aria-hidden="true" />
      {tiras.map((t) => (
        <div
          key={t.id}
          aria-hidden={t.mia ? undefined : 'true'}
          className="absolute top-2 -ml-8 w-16"
          style={{ left: `${t.left}%` }}
        >
          <div
            className="tz-sway"
            style={{
              '--tz-amp': `${t.amp}deg`,
              animationDuration: `${t.dur}s`,
              animationDelay: `${t.delay}s`,
            }}
          >
            <span className="tz-hilo" data-mia={t.mia || undefined} style={{ height: t.hilo }} />
            {t.mia && <span className="tz-nudo" />}
            <span
              className="tz-empuje"
              data-activa={empujada === t.id || undefined}
              onAnimationEnd={() => setEmpujada((v) => (v === t.id ? null : v))}
            >
              <span className="tz-escena">
                {t.mia ? (
                  <button
                    type="button"
                    className="tz-flip pointer-events-auto"
                    data-revelada={concedido || undefined}
                    style={{ height: t.alto }}
                    aria-label="Tu tanzaku de Tanabata: toca para revelar tu deseo"
                    onPointerEnter={() => {
                      if (!concedido) setEmpujada(t.id)
                    }}
                    onClick={() => setConcedido((v) => !v)}
                  >
                    <CaraFrente tono={t.tono} />
                    <CaraReverso topPersonaje={deseo} />
                  </button>
                ) : (
                  <span
                    className="tz-flip pointer-events-auto"
                    style={{ height: t.alto }}
                    onPointerEnter={() => setEmpujada(t.id)}
                    onClick={() => setEmpujada(t.id)}
                  >
                    <CaraFrente tono={t.tono} />
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TanabataTanzaku
