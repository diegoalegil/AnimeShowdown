import { useEffect, useRef } from 'react'
import { catalogo } from '../lib/catalog.js'
import { imagenCarta } from '../lib/images.js'
import { pieza, TAMANO_SALA } from '../lib/marca.js'
import { cartasDestacadas } from '../lib/portada.js'
import { CartaDelDia } from './CartaDelDia.jsx'
import { Enlace } from './Enlace.jsx'

const SALA = pieza('personajes-archive')
const DESTACADAS = cartasDestacadas()
const TOTAL = catalogo.personajes.length + catalogo.especiales.length

/**
 * Portada de la galería: la sala de las cartas de fondo, brasas que suben y
 * seis cartas que flotan a los lados, el título, las acciones y la carta del
 * día. Lo que se mueve en bucle (brasas y cartas) se detiene cuando la
 * portada sale de la pantalla (data-fuera) y con movimiento reducido.
 */
export function Portada() {
  const ref = useRef(null)

  useEffect(() => {
    const seccion = ref.current
    if (!seccion || typeof window.IntersectionObserver !== 'function') return undefined
    const io = new window.IntersectionObserver(([entrada]) => seccion.toggleAttribute('data-fuera', !entrada.isIntersecting))
    io.observe(seccion)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="portada" aria-labelledby="portada-titulo">
      <div className="portada-fondo" aria-hidden="true">
        <img
          src={SALA.src}
          srcSet={SALA.srcSet}
          sizes={TAMANO_SALA}
          width="1672"
          height="941"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </div>
      <div className="portada-brasas" aria-hidden="true">
        <span className="brasas" />
      </div>

      <div className="portada-cartas" aria-hidden="true">
        {DESTACADAS.map((carta, i) => {
          const img = imagenCarta(carta)
          return (
            <div key={carta.id} className="flotante" data-lado={i < 3 ? 'izquierda' : 'derecha'} data-n={i} style={{ '--n': i }}>
              <div className="flotante-vaiven">
                <div className="flotante-lamina" style={{ '--tono': carta.color }}>
                  <img
                    src={img.src}
                    srcSet={img.srcSet}
                    sizes="(min-width: 1024px) 190px, (min-width: 768px) 140px, 96px"
                    width={img.width}
                    height={img.height}
                    alt=""
                    decoding="async"
                    fetchPriority="low"
                  />
                </div>
                <span className="flotante-placa">{carta.anime}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="wrap portada-contenido">
        <p className="rotulo portada-rotulo">
          Galería<span aria-hidden="true"> · </span>
          <span className="cifra">{TOTAL}</span> cartas
        </p>
        <h1 id="portada-titulo" className="portada-titulo revela-titulo">
          Más de mil cartas.
          <br />
          Una colección <span className="portada-oro">tuya</span>.
        </h1>
        <p className="portada-sub">
          <span className="cifra">{catalogo.personajes.length}</span> personajes de{' '}
          <span className="cifra">{catalogo.animes.length}</span> series y{' '}
          <span className="cifra">{catalogo.especiales.length}</span> especiales. Abre cinco sobres al día y completa
          tu álbum.
        </p>
        <div className="portada-acciones">
          <Enlace to="/sobres" className="boton boton--principal">
            Abrir los sobres de hoy
            <span className="boton-flecha" aria-hidden="true">
              →
            </span>
          </Enlace>
          <a href="#cartas" className="boton">
            Ver todas las cartas
          </a>
        </div>
        <CartaDelDia />
      </div>
    </section>
  )
}
