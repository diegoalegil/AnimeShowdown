import { useEffect, useRef } from 'react'
import './fighter-dossier.css'

/**
 * Piezas del "expediente de federación" de la ficha de personaje
 * (PersonajeDetailPage). La página conserva su retrato-morph, sus CTAs y
 * su microdata; de aquí salen el marco de expediente del retrato, la
 * placa ELO acuñada con odómetro y el win-rate como UNA pincelada.
 *
 * Reglas de la casa: solo transform/opacity; el odómetro escribe
 * textContent vía ref (cero re-renders, cero setState por frame); todas
 * las animaciones son one-shot (nada que pausar fuera del viewport);
 * cada bloque reserva su espacio → cero CLS.
 */

function easeOutCubic(p) {
  return 1 - Math.pow(1 - p, 3)
}

/**
 * Marco de expediente para el retrato existente: cuatro esquinas doradas
 * finas + sello hanko del anime. Overlays estáticos (jamás animan) que
 * viajan con el morph del contenedor.
 *
 * @param {object} props
 * @param {string} [props.animeKanji] Kanji REAL del universo
 *   (visualAnime.identity.kanji). Sin kanji con significado → el sello
 *   NO se renderiza (nunca japonés de relleno).
 * @param {string} [props.anime] Título del anime (title del sello).
 */
export function MarcoExpediente({ animeKanji, anime }) {
  return (
    <>
      <span className="fdh-corner" data-pos="tl" aria-hidden="true"></span>
      <span className="fdh-corner" data-pos="tr" aria-hidden="true"></span>
      <span className="fdh-corner" data-pos="bl" aria-hidden="true"></span>
      <span className="fdh-corner" data-pos="br" aria-hidden="true"></span>
      {animeKanji ? (
        <span className="fdh-seal" title={anime} aria-hidden="true">
          {animeKanji}
        </span>
      ) : null}
    </>
  )
}

/**
 * Placa ELO acuñada: entra con golpe de cuño (250ms ease-stamp, t0+100ms)
 * mientras el odómetro rueda 600ms (rAF → textContent, easeOutCubic).
 * `tabular-nums` + `min-width: 4ch` → la cifra nunca empuja el layout.
 * Con reduced-motion la cifra se pinta directa.
 *
 * @param {object} props
 * @param {number} props.elo    Cifra de la placa (la página decide si es
 *   ELO base o competitivo — este componente no lo inventa).
 * @param {number} props.puesto Puesto en el archivo ("nº X de N").
 * @param {number} props.total  Tamaño del archivo (N).
 */
export function PlacaElo({ elo, puesto, total }) {
  const numRef = useRef(null)

  useEffect(() => {
    const el = numRef.current
    if (!el) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(elo)
      return undefined
    }
    const dur = 600
    const t0 = performance.now() + 100
    el.textContent = '0'
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, Math.max(0, (now - t0) / dur))
      el.textContent = String(Math.round(easeOutCubic(p) * elo))
      if (p < 1) raf = requestAnimationFrame(tick)
    })
    // Seguro: con rAF estrangulado (pestaña oculta) la cifra acaba
    // pintada igualmente. One-shot, se limpia con el unmount.
    const timer = setTimeout(() => {
      if (el.isConnected && el.textContent !== String(elo)) {
        el.textContent = String(elo)
      }
    }, 950)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [elo])

  return (
    <div
      className="fdh-placa-wrap"
      role="img"
      aria-label={`ELO ${elo}, puesto ${puesto} de ${total}`}
    >
      <div className="fdh-placa" aria-hidden="true">
        <span className="fdh-placa-label">ELO</span>
        <span className="fdh-placa-num" ref={numRef}>
          {elo}
        </span>
      </div>
      <p className="fdh-puesto" aria-hidden="true">
        nº {puesto} de {total} en el archivo
      </p>
    </div>
  )
}

/**
 * Win-rate como UNA pincelada: el fill viaja dentro de un clip estático
 * (translateX −100%→0) y la cifra cabalga el filo dorado porque carrier
 * y fill comparten exactamente los mismos keyframes/duración/easing —
 * sincronía por motor, sin JS. Con winRate=null, variante honesta
 * "sin clasificar aún" del MISMO alto (cero CLS).
 *
 * @param {object} props
 * @param {number|null} props.winRate 0..100, o null → sin clasificar.
 * @param {number} [props.combates] Combates contados (para la nota).
 */
export function PinceladaWinRate({ winRate, combates }) {
  const wr = typeof winRate === 'number' ? Math.max(0, Math.min(100, winRate)) : null

  if (wr === null) {
    return (
      <div className="fdh-wr">
        <span className="fdh-wr-label">win rate</span>
        <div className="fdh-wr-empty">
          <span className="fdh-wr-empty-titulo">sin clasificar aún</span>
          <span className="fdh-wr-empty-nota">
            {typeof combates === 'number'
              ? `${combates} combate${combates === 1 ? '' : 's'} en el archivo`
              : 'sin combates en el archivo'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fdh-wr"
      role="img"
      aria-label={
        typeof combates === 'number'
          ? `Ratio de victorias ${wr}% sobre ${combates} combates`
          : `Ratio de victorias ${wr}%`
      }
    >
      <span className="fdh-wr-label" aria-hidden="true">
        win rate est.
      </span>
      <div className="fdh-wr-track" style={{ '--fdh-wr': wr / 100 }} aria-hidden="true">
        <div className="fdh-wr-clip">
          <div className="fdh-wr-fill"></div>
        </div>
        <div className="fdh-wr-carrier">
          <span className="fdh-wr-cifra">{wr}%</span>
        </div>
      </div>
    </div>
  )
}
