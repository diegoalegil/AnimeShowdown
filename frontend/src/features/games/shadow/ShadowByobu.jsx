import { useEffect, useId, useRef, useState } from 'react'
import './shadow-byobu.css'

/** Orden de apertura de paneles por fallo: centro-izq, centro-dcha, izq, dcha. */
const ORDEN_APERTURA = [1, 2, 0, 3]
/** Rango de stagger por panel al abrirse todo en el acierto (60ms por paso). */
const RANGO_STAGGER = [2, 0, 1, 3]

/**
 * ShadowByobu — la escena de Shadow Guess: la silueta vive detrás de un
 * biombo de 4 paneles retroiluminado (sombra chinesca real).
 *
 * <p>Capas, de atrás a delante:
 * 1. Luz cálida de vela: capa radial ESTÁTICA + segunda capa pre-horneada
 *    en cross-fade de opacity (ciclo 3s) — el vaivén "respira" los bordes
 *    de la sombra. Cero blur, cero filters (jank Safari).
 * 2. La silueta ({@code siluetaSrc}, asset PROPIO negro sobre alpha).
 * 3. El papel del biombo: 4 paneles translúcidos por composición de
 *    opacity (SIN blur ni backdrop-filter). Cada fallo desliza UNO
 *    (translateX 350ms var(--ease-lift)).
 * 4. El marco de madera con el kanji 影 (canónico del juego), estático.
 *
 * <p>ANTI-SPOILER (contrato verificable en Network): {@code arteSrc} solo
 * se referencia en el DOM cuando {@code resultado === 'acierto'} — hasta
 * ese momento no existe ningún nodo <img> con esa URL ni petición de red.
 *
 * <p>Componente CONTROLADO: el juego (intentos, pista, resultado) vive en
 * la página; esta escena solo coreografía. Los paneles son decorativos —
 * el juego se sigue jugando con el input existente.
 *
 * <p>El vaivén se pausa fuera del viewport y con la pestaña oculta
 * (IntersectionObserver + visibilitychange → animation-play-state).
 * prefers-reduced-motion: revelado por pasos (el bloque CSS anula
 * transiciones y vaivén con capas estáticas).
 *
 * @param {Object} props
 * @param {string} props.siluetaSrc
 *        Asset propio de silueta (negro sobre transparente, ratio 2:3).
 *        Es lo ÚNICO que se pide a red durante la partida.
 * @param {string} props.arteSrc
 *        URL del arte real 2:3 (/img/<Anime>/<slug>-600.webp). NO se
 *        monta ni se pide a red hasta resolver con acierto.
 * @param {{ nombre: string, anime: string }} props.personaje
 *        Datos a revelar al resolver. La cinta de pista muestra
 *        {@code personaje.anime} en font-mono.
 * @param {number} props.fallos
 *        0..4 — cada incremento abre el siguiente panel (orden 2,3,1,4).
 * @param {('acierto'|'derrota'|null)} props.resultado
 *        null mientras se juega. 'acierto' = apertura total + floración +
 *        arte + sello 当. 'derrota' = cierre digno (300ms) + placa.
 * @param {boolean} [props.pistaVisible=false]
 *        El caller la activa exactamente al 2º fallo (regla del juego,
 *        no de la escena).
 */
export default function ShadowByobu({
  siluetaSrc,
  arteSrc,
  personaje,
  fallos,
  resultado,
  pistaVisible = false,
}) {
  const escenaRef = useRef(null)
  const [enViewport, setEnViewport] = useState(true)
  const [pestanaVisible, setPestanaVisible] = useState(true)
  const liveId = useId()

  useEffect(() => {
    const el = escenaRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      (entries) => setEnViewport(entries[0]?.isIntersecting ?? true),
      { threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onVis = () => setPestanaVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const acierto = resultado === 'acierto'
  const derrota = resultado === 'derrota'
  // En derrota los paneles VUELVEN (cierre digno); en acierto se abren todos.
  const abiertos = [0, 1, 2, 3].map((i) =>
    derrota ? false : acierto ? true : ORDEN_APERTURA.indexOf(i) < fallos,
  )
  const panelesAbiertos = abiertos.filter(Boolean).length
  // El vaivén respira solo en partida viva, dentro del viewport y con
  // pestaña visible. Tras resolver, la luz queda en su capa final.
  const swayActivo = !resultado && enViewport && pestanaVisible

  const anuncio = acierto
    ? `Acierto. Era ${personaje.nombre}, de ${personaje.anime}.`
    : derrota
      ? `Sin intentos. Era ${personaje.nombre}, de ${personaje.anime}.`
      : fallos > 0
        ? `Panel ${panelesAbiertos} de 4 abierto. La silueta se ve más nítida.`
        : 'Biombo cerrado. Cuatro paneles.'

  return (
    <figure className="sb-marco relative m-0 w-full rounded-xl p-3" aria-describedby={liveId}>
      {/* fuda con el kanji canónico del juego */}
      <span aria-hidden="true" className="sb-fuda absolute -top-2 right-6 z-10">
        <span className="sb-kanji text-gold">影</span>
        <span className="block h-1.5 w-1.5 rounded-full bg-hanko" />
      </span>

      <div ref={escenaRef} className="sb-escena relative overflow-hidden">
        {/* 1 · luz cálida estática */}
        <span aria-hidden="true" className="sb-luz-base absolute inset-0" />
        {/* 1b · vaivén: segunda luz pre-horneada en cross-fade 3s */}
        <span
          aria-hidden="true"
          className={`sb-luz-sway absolute inset-0 ${swayActivo ? '' : 'sb-pausado'}`}
        />
        {/* 1c · floración del acierto: cross-fade 400ms a la capa encendida */}
        <span
          aria-hidden="true"
          className={`sb-luz-bloom absolute inset-0 ${acierto ? 'sb-encendida' : ''}`}
        />

        {/* 2 · la silueta (asset propio; el arte real NO existe aquí) */}
        <img src={siluetaSrc} alt="" aria-hidden="true" className="sb-silueta" />

        {/* 3 · papel translúcido: 4 paneles que se deslizan */}
        <span aria-hidden="true" className="absolute inset-0 flex">
          {abiertos.map((abierto, i) => (
            <span
              key={i}
              className={`sb-panel ${abierto ? `sb-abierto-${i}` : ''} ${derrota ? 'sb-cierre' : ''}`}
              style={acierto ? { transitionDelay: `${RANGO_STAGGER[i] * 60}ms` } : undefined}
            />
          ))}
        </span>

        {/* 4 · montantes de madera, delante del papel */}
        <span aria-hidden="true" className="sb-montantes absolute inset-0">
          <span className="sb-montante" style={{ left: '25%' }} />
          <span className="sb-montante" style={{ left: '50%' }} />
          <span className="sb-montante" style={{ left: '75%' }} />
        </span>

        {/* cinta de PISTA — el caller la enciende al 2º fallo */}
        {pistaVisible && !resultado && (
          <p className="sb-pista absolute inset-x-2.5 top-2.5 z-10 m-0 flex items-center gap-2 rounded-lg px-3 py-1.5">
            <span className="text-2xs font-bold text-gold">Pista</span>
            <span className="font-mono text-[12px] text-fg">anime: {personaje.anime}</span>
          </p>
        )}

        {/* ACIERTO: el arte real entra en DOM SOLO ahora (anti-spoiler) */}
        {acierto && (
          <div className="absolute inset-0 z-10 flex items-end justify-center">
            <div className="sb-arte-entrada relative aspect-[2/3] h-[94%]">
              <img
                src={arteSrc}
                alt={personaje.nombre}
                decoding="async"
                className="h-full w-full rounded-t-md object-cover shadow-elev-2"
              />
              <div className="sb-scrim-nombre absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-9">
                <p className="m-0 text-2xs text-fg-muted">Acertaste. Era…</p>
                <p className="m-0 text-xl font-extrabold text-fg-strong">{personaje.nombre}</p>
                <p className="m-0 font-mono text-[12px] text-fg-muted">{personaje.anime}</p>
              </div>
              <span aria-hidden="true" className="sb-sello absolute -right-3.5 top-2.5">
                <span className="sb-kanji">当</span>
                <span className="sb-sello-anillo absolute -inset-2 rounded-full" />
              </span>
            </div>
          </div>
        )}

        {/* DERROTA: placa digna sobre el biombo cerrado, sin burla */}
        {derrota && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="sb-placa as-panel flex flex-col items-center gap-1.5 rounded-xl px-7 py-4 text-center">
              <span aria-hidden="true" className="sb-kanji text-[15px] text-gold/80">影</span>
              <p className="m-0 text-2xs text-fg-muted">La sombra guardó su secreto. Era…</p>
              <p className="m-0 text-2xl font-extrabold text-fg-strong">{personaje.nombre}</p>
              <p className="m-0 font-mono text-[12px] text-fg-muted">{personaje.anime}</p>
            </div>
          </div>
        )}
      </div>

      {/* progreso anunciado para SR — "panel 2 de 4 abierto" */}
      <figcaption id={liveId} role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </figcaption>
    </figure>
  )
}
