import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import './manga-storyboard.css'

const FAQ = [
  {
    pregunta: '¿Qué es AnimeShowdown?',
    respuesta:
      'AnimeShowdown es una plataforma para votar duelos de personajes de anime, jugar retos diarios y ver rankings competitivos creados por la comunidad.',
  },
  {
    pregunta: '¿Necesito cuenta para votar?',
    respuesta:
      'Puedes probar varios votos como invitado. Crear cuenta sirve para guardar historial, rachas, logros y proteger mejor el ranking.',
  },
  {
    pregunta: '¿Qué puedo hacer cada día?',
    respuesta:
      'Completar la misión diaria: votar duelos, jugar un daily trial y revisar cómo se mueve el ranking.',
  },
]

/** Los 4 pasos reales mapeados a las viñetas 1-4 (mismo copy que la versión
 *  previa). La viñeta 5 es el cierre "La misión diaria". El orden = orden DOM
 *  = orden de lectura. Los numerales 一二三四五 y los kanji marca de agua
 *  決札位絆戦 están en el manifest de la display font (sin font dance). */
const KOMA = [
  { id: 'votar', kanjiNum: '一', watermark: '決', eyebrow: '1. Vota', linea: 'Elige ganador en duelos cara a cara.' },
  { id: 'juega', kanjiNum: '二', watermark: '札', eyebrow: '2. Juega', linea: 'Completa Shadow Guess, AniGrid o Impostor Trial.' },
  { id: 'ranking', kanjiNum: '三', watermark: '位', eyebrow: '3. Mira ranking', linea: 'Revisa qué personajes suben, caen o dominan.' },
  { id: 'progreso', kanjiNum: '四', watermark: '絆', eyebrow: '4. Guarda progreso', linea: 'Crea cuenta cuando quieras historial, racha y logros.' },
]

/* Los 5 marcos de tinta — polígonos hairline distintos + clip del contenido.
   vector-effect="non-scaling-stroke" mantiene el filo a cualquier tamaño. */
const FRAMES = [
  {
    clip: 'polygon(1.2% 2%, 91% 0.8%, 99% 9%, 98.6% 98.4%, 1.8% 97.6%)',
    points: '1.2,2 91,0.8 99,9 98.6,98.4 1.8,97.6',
    extras: [
      { x1: -2.5, y1: 2.1, x2: 14, y2: 1.7 },
      { x1: 98.7, y1: 92, x2: 98.5, y2: 103 },
    ],
  },
  {
    clip: 'polygon(2% 3.4%, 98.4% 1%, 99% 96.4%, 1% 99%)',
    points: '2,3.4 98.4,1 99,96.4 1,99',
    extras: [{ x1: 4, y1: 6.6, x2: 96, y2: 4.4, faint: true }],
  },
  {
    clip: 'polygon(3.4% 1.2%, 99.2% 2.6%, 96.6% 98.6%, 1% 96.4%)',
    points: '3.4,1.2 99.2,2.6 96.6,98.6 1,96.4',
    extras: [
      { x1: 0.6, y1: 90, x2: 1.6, y2: 102 },
      { x1: -3, y1: 96.8, x2: 10, y2: 96.1 },
    ],
  },
  {
    clip: 'polygon(1.4% 1.6%, 98.8% 2.2%, 98% 98.2%, 13% 99%, 0.8% 88%)',
    points: '1.4,1.6 98.8,2.2 98,98.2 13,99 0.8,88',
    extras: [{ x1: -1, y1: 91, x2: 16, y2: 102 }],
  },
  {
    clip: 'polygon(0.8% 4.5%, 99.4% 1.4%, 98.8% 98.6%, 1.2% 96%)',
    points: '0.8,4.5 99.4,1.4 98.8,98.6 1.2,96',
    inner: '2.2,7 98,4 97.4,96.2 2.6,93.6',
    extras: [],
  },
]

/** Marco de tinta hairline. Decorativo. */
function KomaFrame({ frame }) {
  const f = FRAMES[frame]
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="koma-frame">
      <polygon points={f.points} fill="none" stroke="var(--color-gold)" strokeOpacity="0.6" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      {f.inner ? (
        <polygon points={f.inner} fill="none" stroke="var(--color-gold)" strokeOpacity="0.22" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ) : null}
      {f.extras.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--color-gold)" strokeOpacity={l.faint ? 0.25 : 0.4} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

/** Speedlines de acento — one-shot vía .is-run (jamás loop). */
function Speedlines({ side }) {
  return (
    <div aria-hidden="true" className={'koma-speed' + (side === 'left' ? ' koma-speed-left' : '')}>
      <svg viewBox="0 0 150 100" className="h-full w-full">
        <line x1="148" y1="4" x2="78" y2="30" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="146" y1="16" x2="96" y2="34" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="142" y1="30" x2="86" y2="52" stroke="var(--color-accent-text)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="148" y1="44" x2="104" y2="58" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="138" y1="58" x2="92" y2="74" stroke="var(--color-accent)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** Numeral hanko estampado (decorativo: el orden real lo da el DOM). */
function HankoNumeral({ kanji }) {
  return (
    <div aria-hidden="true" className="koma-stamp">
      <span className="koma-bleed" />
      <span className="koma-hanko font-black">{kanji}</span>
    </div>
  )
}

function ComoFuncionaPage() {
  useSeo({
    title: 'Cómo funciona',
    description:
      'Guía rápida de AnimeShowdown: votar duelos anime, completar juegos diarios, leer rankings, seguir personajes y compartir resultados.',
    canonical: 'https://animeshowdown.dev/como-funciona',
    image: BRAND_VISUALS.home.image,
  })

  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    /* Coreografía sin estado: classList directo (cero re-renders, React
       Compiler feliz). One-shot: unobserve al disparar — jamás loop. */
    root.classList.add('manga-anim')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(e.target)
          e.target.classList.add('is-run')
        })
      },
      { threshold: 0.3 },
    )
    root.querySelectorAll('[data-beat]:not(.is-lcp)').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <VisualPageShell visual={BRAND_VISUALS.home} className="py-10 sm:py-12" lateralKanji={{ left: '始', right: '勝' }}>
      <JsonLd id="breadcrumbs" schema={breadcrumbsSchema([
        { label: 'Inicio', path: '/' },
        { label: 'Cómo funciona', path: '/como-funciona' },
      ])} />
      <JsonLd id="faq-como-funciona" schema={faqPageSchema(FAQ)} />
      <div className="mx-auto max-w-6xl">
        <header className="mb-7">
          <p className="text-xs font-black text-gold">Guía rápida</p>
          <h1 className="mt-2 text-3xl font-black text-fg-strong sm:text-4xl">Vota, juega y vuelve mañana</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-fg-muted">
            AnimeShowdown funciona como un ritual diario para fans: eliges
            ganadores, completas retos y ves cómo cambia la comunidad. Léelo como
            una página de manga, viñeta a viñeta.
          </p>
        </header>

        <article ref={rootRef} aria-label="Cómo funciona AnimeShowdown, en cinco viñetas" className="manga-stage">
          {KOMA.map((koma, i) => {
            const isLcp = i === 0
            return (
              <section
                key={koma.id}
                data-beat={koma.id}
                data-screen-label={`Viñeta ${i + 1} — ${koma.id}`}
                className={'manga-koma' + (isLcp ? ' is-lcp' : '')}
              >
                <div className="koma-ink absolute inset-0">
                  <div className="koma-clip absolute inset-0 overflow-hidden bg-bg" style={{ clipPath: FRAMES[i].clip }}>
                    <span aria-hidden="true" className="koma-watermark font-black">{koma.watermark}</span>
                    <div className="koma-caption">
                      <span aria-hidden="true" className="koma-hairline" />
                      <p className="koma-eyebrow">{koma.eyebrow}</p>
                      <h2 className="koma-linea text-fg-strong">{koma.linea}</h2>
                    </div>
                  </div>
                  <KomaFrame frame={i} />
                  <Speedlines side={i % 2 === 0 ? 'left' : 'right'} />
                  <HankoNumeral kanji={koma.kanjiNum} />
                </div>
              </section>
            )
          })}

          {/* Viñeta 5 — cierre "La misión diaria": párrafo largo real + todos los
              CTAs de navegación/conversión + bocadillo de grito → /votar. */}
          <section
            data-beat="mision-diaria"
            data-screen-label="Viñeta 5 — misión diaria"
            className="manga-koma"
          >
            <div className="koma-ink absolute inset-0">
              <div className="koma-clip absolute inset-0 overflow-hidden bg-bg" style={{ clipPath: FRAMES[4].clip }}>
                <span aria-hidden="true" className="koma-watermark font-black">戦</span>
                <div aria-hidden="true" className="koma-scrim-side absolute inset-0" />
                <div className="koma-panel-final">
                  <span aria-hidden="true" className="koma-hairline" />
                  <h2 className="koma-linea text-fg-strong">La misión diaria</h2>
                  <p className="koma-text">
                    La primera versión del loop diario vive en tu navegador: 10
                    votos, 1 juego diario y una visita al ranking. Es suficiente
                    para entender el producto sin cuenta y deja preparado el
                    camino a misiones, temporadas y recompensas persistentes.
                  </p>
                  <div className="koma-cta-row">
                    <Link to="/votar" className="as-button-primary rounded-lg px-4 py-2 text-sm font-black">
                      Completar votos
                    </Link>
                    <Link to="/games" className="as-button-ghost rounded-lg px-4 py-2 text-sm font-bold">
                      Jugar daily
                    </Link>
                    <Link to="/ranking" className="as-button-ghost rounded-lg px-4 py-2 text-sm font-bold">
                      Ver ranking
                    </Link>
                    <Link to="/metodologia-elo" className="as-button-ghost rounded-lg px-4 py-2 text-sm font-bold">
                      Entender metodología
                    </Link>
                  </div>
                  <Link to="/votar" className="koma-bubble" aria-label="¡A la arena! Empezar votando">
                    <span className="koma-bubble-tilt">
                      <svg aria-hidden="true" viewBox="0 0 200 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                        <polygon
                          points="198,60 174,73.6 179.3,94.1 145.9,95.6 130.3,115.2 100,104 69.7,115.2 54.1,95.6 20.7,94.1 25.8,73.6 2,60 25.8,46.4 20.7,25.9 54.1,24.4 69.7,4.8 100,16 130.3,4.8 145.9,24.4 179.3,25.9 174,46.4"
                          fill="var(--color-fg-strong)"
                          stroke="var(--color-gold)"
                          strokeWidth="1"
                        />
                      </svg>
                      <span className="koma-bubble-text font-black">¡A LA ARENA!</span>
                    </span>
                  </Link>
                </div>
              </div>
              <KomaFrame frame={4} />
              <Speedlines side="left" />
              <HankoNumeral kanji="五" />
            </div>
          </section>

          {/* Flechas de lectura en Z — decorativas, solo desktop, fuera del orden DOM útil. */}
          <div aria-hidden="true" className="manga-arrows">
            <svg viewBox="0 0 64 28" className="manga-arrow manga-arrow-1">
              <path d="M2,20 Q32,4 58,14" fill="none" stroke="var(--color-gold)" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M58,14 L47,9 L50,19 Z" fill="var(--color-gold)" fillOpacity="0.5" />
            </svg>
            <svg viewBox="0 0 150 58" className="manga-arrow manga-arrow-2">
              <path d="M144,6 Q86,44 12,48" fill="none" stroke="var(--color-gold)" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M12,48 L23,41 L21,52 Z" fill="var(--color-gold)" fillOpacity="0.5" />
            </svg>
            <svg viewBox="0 0 64 28" className="manga-arrow manga-arrow-3">
              <path d="M2,20 Q32,4 58,14" fill="none" stroke="var(--color-gold)" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M58,14 L47,9 L50,19 Z" fill="var(--color-gold)" fillOpacity="0.5" />
            </svg>
            <svg viewBox="0 0 150 56" className="manga-arrow manga-arrow-4">
              <path d="M142,6 Q92,40 12,46" fill="none" stroke="var(--color-gold)" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M12,46 L23,39 L21,50 Z" fill="var(--color-gold)" fillOpacity="0.5" />
            </svg>
          </div>
        </article>
      </div>
    </VisualPageShell>
  )
}

export default ComoFuncionaPage
