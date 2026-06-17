import { useEffect, useRef } from 'react'
import { framesCrisantemo, HANABI_PARTICULAS } from './festival-core'

/**
 * HanabiBurst — fuegos artificiales sobre el cielo: 3 crisantemos de 12
 * particulas PRE-POSICIONADAS (transform-only, una pasada, POOL reutilizado).
 *
 * Adaptacion al dominio REAL (decision del owner): NO hay cruce de hito en vivo;
 * los fuegos se disparan UNA sola vez en la ENTRADA, si y solo si el evento esta
 * ACTIVO (`celebrar`). En reduced-motion / calma degradan a un unico destello de
 * opacidad. El anuncio AT (aria-live) lo emite el padre, no este nodo decorativo.
 *
 * Pool: los 3 contenedores y sus particulas se montan una vez; al celebrar, el
 * effect arma la animacion por reflujo (remove clase -> reflow -> add), sin
 * recrear nodos ni asignar nada en el cuerpo del render. Determinista por indice.
 *
 * @param {object} props
 * @param {boolean} props.celebrar  true -> dispara la celebracion UNA vez al montar
 * @param {Array<{x:number,y:number,delayMs:number,radio:number,tono:('oro'|'carmin')}>} props.layout
 * @param {boolean} [props.reduce]  prefers-reduced-motion / calma
 */
export default function HanabiBurst({ celebrar = false, layout, reduce = false }) {
  const rootRef = useRef(null)

  // Particulas deterministas por crisantemo (pool, calculadas por layout).
  const crisantemos = layout.map((b, ci) => ({
    ...b,
    particulas: framesCrisantemo(ci, b.radio, HANABI_PARTICULAS),
  }))

  // Dispara UNA vez en el montaje si el evento esta ACTIVO. Effect con deps
  // estables: corre en el montaje; no re-dispara en re-renders (celebrar es un
  // booleano derivado del estado al entrar). En StrictMode el doble montaje
  // re-arma la misma animacion (idempotente, una pasada).
  useEffect(() => {
    if (!celebrar) return
    const root = rootRef.current
    if (!root) return
    if (reduce) {
      const flash = root.querySelector('.fest-hanabi--flash')
      if (flash) { flash.classList.remove('is-flashing'); void flash.offsetWidth; flash.classList.add('is-flashing') }
      return
    }
    root.querySelectorAll('.fest-burst').forEach((b) => {
      b.classList.remove('is-firing')
      void b.offsetWidth // reflow -> reinicia la animacion de una pasada (pool reusado)
      b.classList.add('is-firing')
      // Retira is-firing al terminar el viaje de la particula (la animacion mas
      // larga del burst), para que el will-change de festival.css no deje capas
      // de compositor colgadas en reposo. Las particulas de un burst comparten
      // delay+duracion -> terminan a la vez; { once } limpia tras el primer fly.
      b.addEventListener(
        'animationend',
        (e) => { if (e.animationName === 'fest-hanabi-fly') b.classList.remove('is-firing') },
        { once: true },
      )
    })
  }, [celebrar, reduce])

  return (
    <div className="fest-hanabi" ref={rootRef} aria-hidden="true">
      {crisantemos.map((c, ci) => (
        <span
          key={ci}
          className={`fest-burst fest-burst--${c.tono}`}
          style={{ left: `${c.x}%`, top: `${c.y}%`, '--burst-delay': `${c.delayMs}ms` }}
        >
          <span className="fest-burst__core" />
          {c.particulas.map((p, pi) => (
            <span key={pi} className="fest-particle" style={{ '--dx': p.dx, '--dy': p.dy }} />
          ))}
        </span>
      ))}
      <span className="fest-hanabi--flash" />
    </div>
  )
}
