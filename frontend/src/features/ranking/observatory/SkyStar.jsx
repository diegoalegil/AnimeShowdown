import { memo, useEffect, useRef } from 'react'
import PersonajeImg from '../../../components/PersonajeImg'
import './observatory.css'

/**
 * SkyStar — una estrella del observatorio: retrato circular + halo pre-horneado
 * (+ estela opcional en scrub). Es un ENLACE focusable a la ficha del personaje.
 * Memoizada porque el cielo monta ~60. El padre la posiciona con --x/--y (y la
 * deriva del escrutador transiciona sola); el titileo de las subidas del dia es
 * un one-shot WAAPI al entrar en viewport (cero en reduced-motion).
 *
 * @param {Object} props
 * @param {import('./observatory-core').Estrella} props.estrella  estrella proyectada
 * @param {string} props.href                       destino de la ficha (hrefPersonaje)
 * @param {number} [props.retardoMs=0]              delay del encendido (stagger)
 * @param {boolean} [props.destacada=false]         estrella del propio usuario (aro oro + "tu")
 * @param {boolean} [props.titila=false]            subida del dia → titilar una vez al entrar
 * @param {{x:number,y:number}|null} [props.estelaDesde=null]  origen de la estela (scrub real)
 * @param {boolean} [props.atenuada=false]          la leyenda filtra otra constelación
 * @param {boolean} [props.reducedMotion=false]
 * @param {(slug:string)=>void} [props.onFocoEstrella]
 */
function SkyStarBase({
  estrella,
  href,
  retardoMs = 0,
  destacada = false,
  titila = false,
  estelaDesde = null,
  atenuada = false,
  reducedMotion = false,
  onFocoEstrella,
}) {
  const ref = useRef(null)

  // Titileo de subida: una sola pasada al entrar en viewport. WAAPI con guard
  // (jsdom no implementa animate → camino degradado, como reduced-motion).
  useEffect(() => {
    const el = ref.current
    if (!el || !titila || reducedMotion) return undefined
    if (typeof el.animate !== 'function' || typeof IntersectionObserver !== 'function') {
      return undefined
    }
    let lanzado = false
    const io = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting && !lanzado) {
            lanzado = true
            el.animate(
              [
                { filter: 'brightness(1)' },
                { filter: 'brightness(1.85)', offset: 0.4 },
                { filter: 'brightness(1)' },
              ],
              { duration: 900, easing: 'cubic-bezier(0.16,1,0.3,1)' },
            )
            io.disconnect()
          }
        }
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [titila, reducedMotion])

  // Geometria de la estela (determinista): largo y angulo hacia el origen del
  // movimiento. Math.hypot/atan2 son puros — no son Date ni random.
  let estela = null
  if (estelaDesde) {
    const dx = estelaDesde.x - estrella.x
    const dy = estelaDesde.y - estrella.y
    estela = { largo: Math.hypot(dx, dy), angulo: Math.atan2(dy, dx) }
  }

  const estilo = {
    '--x': `${estrella.x}px`,
    '--y': `${estrella.y}px`,
    '--tam': `${estrella.tam}px`,
    '--brillo': estrella.brillo,
    '--delay': `${retardoMs}ms`,
  }

  return (
    <a
      ref={ref}
      href={href}
      className={`sky-star${destacada ? ' sky-star--tu' : ''}${atenuada ? ' sky-star--atenuada' : ''}`}
      style={estilo}
      data-slug={estrella.slug}
      aria-label={`${estrella.posicion}º: ${estrella.nombre}, ${estrella.anime}, ELO ${estrella.elo}`}
      onFocus={onFocoEstrella ? () => onFocoEstrella(estrella.slug) : undefined}
    >
      <span className="sky-star__cuerpo">
        <span className="sky-star__halo" aria-hidden="true" />
        {estela ? (
          <span
            className="sky-star__estela"
            aria-hidden="true"
            style={{ '--largo': `${estela.largo}px`, '--angulo': `${estela.angulo}rad` }}
          />
        ) : null}
        <span className="sky-star__disco">
          <PersonajeImg
            slug={estrella.slug}
            alt=""
            fit="cover"
            loading="lazy"
            className="sky-star__img"
          />
        </span>
        {destacada ? (
          <span className="sky-star__tu font-mono">tú</span>
        ) : null}
      </span>
    </a>
  )
}

const SkyStar = memo(SkyStarBase)
export default SkyStar
