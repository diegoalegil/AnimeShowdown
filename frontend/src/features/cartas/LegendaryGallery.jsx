import { useEffect, useRef } from 'react'
import TiltCard from './TiltCard'
import CartaFace from './CartaFace'
import './legendary-gallery.css'

/**
 * Salón Legendario — museografía de "galería a oscuras".
 * Wrapper de página de las cartas existentes (TiltCard foil="especial" +
 * CartaFace): cada carta cuelga bajo un cono de spotlight cálido ESTÁTICO
 * cuya opacity se enciende al entrar al viewport; en hover el spot sube y
 * una penumbra compartida (UN solo elemento fijo, solo opacity) atenúa a
 * las vecinas. Placa dorada de museo bajo cada pieza; cabecera con kanji 殿.
 *
 * Ubicación sugerida: frontend/src/features/cartas/LegendaryGallery.jsx
 * (junto a TiltCard/CartaFace/cartas.css).
 *
 * Integración (EspecialesPage) — sustituye al <main> plano del estado de
 * éxito; loading/error/empty se quedan como están:
 *
 *   {!isLoading && !isError && cartas.length > 0 && (
 *     <LegendaryGallery cartas={cartas} />
 *   )}
 *
 * Perf (ver guía del proyecto):
 * - Cero canvas, cero 3D nuevo, cero blur()/backdrop-blur/SVG filters nuevos.
 * - Gradientes estáticos; solo se animan opacity (spots, penumbra) y
 *   transform (dolly scroll-driven vía animation-timeline: view() con
 *   @supports y fallback sin efecto). Sin framer-motion: no hace falta.
 * - Único loop infinito = el sheen ya existente de TiltCard; aquí se pausa
 *   fuera del viewport (.is-off) con el mismo IntersectionObserver.
 * - prefers-reduced-motion: spots encendidos fijos, sin dolly ni penumbra
 *   (resuelto en CSS; este efecto no monta listeners).
 * - Mobile-first: 2 columnas a 390px sin desbordes (el cono es overflow
 *   visual con pointer-events: none y clip dentro de la sala).
 */

const SHELF_SIZE = 4

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function LegendaryGallery({ cartas = [] }) {
  const roomRef = useRef(null)
  const penumbraRef = useRef(null)

  useEffect(() => {
    const room = roomRef.current
    const penumbra = penumbraRef.current
    if (!room || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const exhibits = Array.from(room.querySelectorAll('.lg-exhibit'))

    // Encendido de spots al entrar al viewport (una vez, sin loop) + pausa
    // del sheen fuera de pantalla / pestaña oculta (IO no dispara con la
    // pestaña oculta; el sheen además queda pausado al salir del viewport).
    let io
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) e.target.classList.add('is-lit')
            e.target.classList.toggle('is-off', !e.isIntersecting)
          }
        },
        { threshold: 0.22 },
      )
      exhibits.forEach((ex) => {
        ex.classList.add('is-off')
        io.observe(ex)
      })
    } else {
      exhibits.forEach((ex) => ex.classList.add('is-lit'))
    }

    // Penumbra compartida: solo con puntero fino. El agujero de la máscara
    // se POSICIONA al entrar (custom props, sin animar) y lo único que se
    // anima es la opacity de la capa — 60fps garantizado.
    let onOver
    let onOut
    if (penumbra && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      onOver = (e) => {
        const ex = e.target.closest('.lg-exhibit')
        if (!ex || ex.classList.contains('is-focus')) return
        exhibits.forEach((n) => n.classList.remove('is-focus'))
        ex.classList.add('is-focus')
        const r = ex.getBoundingClientRect()
        penumbra.style.setProperty('--lg-hx', `${(r.left + r.width / 2).toFixed(1)}px`)
        penumbra.style.setProperty('--lg-hy', `${(r.top + r.height / 2).toFixed(1)}px`)
        penumbra.style.setProperty('--lg-hw', `${(r.width * 0.85).toFixed(1)}px`)
        penumbra.style.setProperty('--lg-hh', `${(r.height * 0.62).toFixed(1)}px`)
        penumbra.classList.add('is-on')
      }
      onOut = (e) => {
        const ex = e.target.closest('.lg-exhibit')
        if (!ex || (e.relatedTarget && ex.contains(e.relatedTarget))) return
        ex.classList.remove('is-focus')
        penumbra.classList.remove('is-on')
      }
      room.addEventListener('pointerover', onOver)
      room.addEventListener('pointerout', onOut)
    }

    return () => {
      io?.disconnect()
      if (onOver) room.removeEventListener('pointerover', onOver)
      if (onOut) room.removeEventListener('pointerout', onOut)
    }
  }, [cartas.length])

  const shelves = chunk(cartas, SHELF_SIZE)

  return (
    <main ref={roomRef} className="lg-room w-full">
      <header className="relative mx-auto max-w-6xl px-4 pb-9 pt-20 text-center sm:pt-24">
        <span className="lg-kanji" aria-hidden="true">
          殿
        </span>
        <div className="relative">
          <p className="lg-sala font-mono">Sala I · Arte de autor</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-fg-strong sm:text-4xl">
            Salón Legendario
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-fg-muted">
            El arte de autor de AnimeShowdown. Cada pieza es única — consíguelas
            abriendo sobres.
          </p>
        </div>
        <div className="lg-filo mt-8" aria-hidden="true" />
      </header>

      {shelves.map((grupo, i) => (
        <section key={i} className="lg-shelf mx-auto max-w-6xl px-4 pb-11">
          <div className="lg-rail" aria-hidden="true" />
          <div className="lg-grid as-salon-grid as-card-grid-stagger">
            {grupo.map((carta) => (
              <figure key={carta.id} className="lg-exhibit m-0">
                <span className="lg-lamp" aria-hidden="true" />
                <div className="lg-spot" aria-hidden="true" />
                <div className="lg-boost" aria-hidden="true" />
                <div className="lg-exhibit-card">
                  <TiltCard foil="especial" sheen>
                    <CartaFace carta={carta} />
                  </TiltCard>
                </div>
                <figcaption className="lg-plaque">
                  <span className="lg-plaque-name">{carta.personajeNombre}</span>
                  <span className="lg-plaque-meta font-mono">{carta.anime}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <footer className="mx-auto max-w-6xl px-4 pb-24 pt-1 text-center">
        <div className="lg-filo" aria-hidden="true" />
        <p className="mt-4 font-mono text-xs text-fg-muted">
          Colección permanente · {cartas.length} piezas
        </p>
      </footer>

      <div ref={penumbraRef} className="lg-penumbra" aria-hidden="true" />
    </main>
  )
}

export default LegendaryGallery
