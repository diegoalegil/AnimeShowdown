import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { ArrowRight, Swords } from 'lucide-react'
import PersonajeImg from './PersonajeImg'
import Button from './Button'
import { Embers, LightningStrike } from './AtmosphereEffects'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { getCombateEstelarDelDia } from '../lib/combate-estelar'
import { hexToRgbChannels } from '../lib/color'

/**
 * Combate estelar — cartel de velada de la home. Dos personajes del catálogo
 * se encaran a pantalla ancha con el escenario partido en diagonal por sus
 * colores dominantes, emblema VS con kanji y CTA directo a ese duelo en
 * /votar. El duelo rota cada día de forma determinista (lib/combate-estelar).
 */

// Canales RGB ("R G B") de tokens de @theme para glows y custom props runtime.
const CANALES_GOLD = '197 161 90' // --color-gold
const CANALES_ACCENT = '159 29 44' // --color-accent
const CANALES_ELECTRIC = '36 198 220' // --color-electric

// Curva --ease-lift de index.css, para las entradas framer-motion.
const EASE_LIFT = [0.16, 1, 0.3, 1]

const MQ_PARALLAX = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
const MQ_EFECTOS = '(min-width: 768px)'

function matchMediaSafe(query) {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(query).matches
}

// Visibilidad del stage en viewport, mismo patrón useVisible de los canvas
// de AtmosphereEffects (replicado: ese archivo solo puede exportar
// componentes por la regla react-refresh/only-export-components). Sin
// IntersectionObserver se asume visible para no perder el parallax.
function useVisible(ref) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}

function SectionCombateEstelar() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const { personajes } = usePersonajesCatalogo()
  const combate = useMemo(() => getCombateEstelarDelDia(personajes), [personajes])
  const cta = useInstantSoundPress('playClick')

  const [canParallax, setCanParallax] = useState(() => matchMediaSafe(MQ_PARALLAX))
  const [conEfectos, setConEfectos] = useState(() => matchMediaSafe(MQ_EFECTOS))
  const stageRef = useRef(null)
  const stageVisible = useVisible(stageRef)
  const rafRef = useRef(null)
  const pointerRef = useRef(0)
  const mouseX = useMotionValue(0)
  const xRetador = useTransform(mouseX, (v) => v * 8)
  const xRival = useTransform(mouseX, (v) => v * -8)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mqParallax = window.matchMedia(MQ_PARALLAX)
    const mqEfectos = window.matchMedia(MQ_EFECTOS)
    const onParallax = (e) => setCanParallax(e.matches)
    const onEfectos = (e) => setConEfectos(e.matches)
    mqParallax.addEventListener?.('change', onParallax)
    mqEfectos.addEventListener?.('change', onEfectos)
    return () => {
      mqParallax.removeEventListener?.('change', onParallax)
      mqEfectos.removeEventListener?.('change', onEfectos)
    }
  }, [])

  // El listener de mousemove es global (window): además de reduceMotion y la
  // media query, se apaga cuando el stage sale del viewport (useVisible,
  // mismo patrón que los canvas de AtmosphereEffects).
  useEffect(() => {
    if (reduceMotion || !canParallax || !stageVisible) return undefined
    const handle = (e) => {
      pointerRef.current = (e.clientX / window.innerWidth) * 2 - 1
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        mouseX.set(pointerRef.current)
      })
    }
    window.addEventListener('mousemove', handle)
    return () => {
      window.removeEventListener('mousemove', handle)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [canParallax, mouseX, reduceMotion, stageVisible])

  if (!combate) return null
  const { retador, rival } = combate
  const canalesRetador = hexToRgbChannels(retador.imagenColorDominante) ?? CANALES_ACCENT
  const canalesRival = hexToRgbChannels(rival.imagenColorDominante) ?? CANALES_ELECTRIC
  const duelHref = `/votar?personaje=${encodeURIComponent(retador.slug)}&rival=${encodeURIComponent(rival.slug)}`

  const entrada = (delay = 0, x = 0, y = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, x, y },
          whileInView: { opacity: 1, x: 0, y: 0 },
          viewport: { once: true, amount: 0.2 },
          transition: { duration: 0.6, delay, ease: EASE_LIFT },
        }

  return (
    <section className="px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-2 sm:mb-8">
          <span className="text-[12px] font-semibold text-fg-muted">
            {t('combate.eyebrow')}
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
            {t('combate.titulo')}
          </h2>
          <p className="max-w-2xl text-[14px] text-fg-muted">
            {t('combate.descripcion')}
          </p>
        </div>

        {/* Wrapper sin overflow: los nombres solapan los bordes del cartel. */}
        <div className="relative">
          <div
            ref={stageRef}
            className="combate-stage relative isolate min-h-[30rem] overflow-hidden rounded-3xl border border-border sm:aspect-[16/9] sm:min-h-0 lg:aspect-[21/9]"
            style={{ '--combate-a': canalesRetador, '--combate-b': canalesRival }}
          >
            <div aria-hidden="true" className="combate-split-a" />
            <div aria-hidden="true" className="combate-split-b" />
            <div aria-hidden="true" className="combate-seam" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-asanoha opacity-[0.05]"
            />
            {conEfectos && (
              <>
                <Embers density="low" tone="amber" />
                <LightningStrike minInterval={14000} maxInterval={26000} />
              </>
            )}

            <EmblemaVs reduceMotion={reduceMotion} />

            <PanelContendiente
              personaje={retador}
              canales={canalesRetador}
              parallaxX={xRetador}
              posicion="left-3 top-7 h-[40%] sm:left-[7%] sm:top-[9%] sm:h-[72%]"
              giro="-rotate-3"
              entrada={entrada(0.1, -40)}
              respiracion={reduceMotion ? null : { delay: 0 }}
            />
            <PanelContendiente
              personaje={rival}
              canales={canalesRival}
              parallaxX={xRival}
              posicion="bottom-7 right-3 h-[40%] sm:bottom-[9%] sm:right-[7%] sm:top-auto sm:h-[72%]"
              giro="rotate-2"
              entrada={entrada(0.2, 40)}
              respiracion={reduceMotion ? null : { delay: 2.4 }}
            />

            {/* Scrim inferior que asienta las figuras y la zona de lectura. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[12] h-[30%] bg-gradient-to-t from-black/70 via-black/30 to-transparent"
            />
          </div>

          <NombreCartel
            personaje={retador}
            canales={canalesRetador}
            className="absolute -top-4 left-3 z-20 max-w-[82%] sm:-top-7 sm:left-6"
            align="left"
            entrada={entrada(0.05, -24)}
          />
          <NombreCartel
            personaje={rival}
            canales={canalesRival}
            className="absolute -bottom-4 right-3 z-20 max-w-[82%] sm:-bottom-7 sm:right-6"
            align="right"
            entrada={entrada(0.15, 24)}
          />
        </div>

        <motion.div
          className="mt-10 flex flex-col items-center gap-7 sm:mt-12"
          {...entrada(0.15, 0, 16)}
        >
          <TaleOfTheTape retador={retador} rival={rival} t={t} />
          <div className="flex flex-col items-center gap-2">
            <Button
              as={Link}
              to={duelHref}
              size="lg"
              onPointerDown={cta.onPointerDown}
              onClick={cta.onClick}
              aria-label={`${t('combate.cta')} — ${t('combate.duelAria', { a: retador.nombre, b: rival.nombre })}`}
              className="group"
            >
              <Swords className="h-4 w-4" />
              {t('combate.cta')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <p className="text-[11px] font-medium text-fg-muted">
              {t('combate.rotacion')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/**
 * Panel-retrato de un contendiente, ligeramente girado como cartel pegado.
 * Capas de movimiento separadas para que no se pisen los transforms:
 * parallax de puntero (motion value) → giro estático (clase) → entrada
 * lateral (whileInView) → respiración idle (scale, decorativa).
 */
function PanelContendiente({
  personaje,
  canales,
  parallaxX,
  posicion,
  giro,
  entrada,
  respiracion,
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 ${posicion}`}
      style={{ x: parallaxX, aspectRatio: '2 / 3' }}
    >
      <div className={`h-full w-full ${giro}`}>
        <motion.div className="h-full w-full" {...entrada}>
          <motion.div
            className="h-full w-full"
            animate={respiracion ? { scale: 1.012 } : undefined}
            transition={
              respiracion
                ? {
                    duration: 6,
                    delay: respiracion.delay,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  }
                : undefined
            }
          >
            <div
              className="relative h-full w-full overflow-hidden rounded-2xl border border-white/12 shadow-aura-lg inset-shadow-hairline"
              style={{ '--aura-color': `rgb(${canales} / 0.4)` }}
            >
              <PersonajeImg
                slug={personaje.slug}
                src={personaje.imagenUrl}
                alt=""
                nombre={personaje.nombre}
                colorDominante={personaje.imagenColorDominante}
                loading="lazy"
                sizes="(min-width: 1024px) 420px, (min-width: 640px) 300px, 150px"
                className="h-full w-full"
                fit="cover"
                position="top"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}

function EmblemaVs({ reduceMotion }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-[60%] top-[44%] z-[5] -translate-x-1/2 -translate-y-1/2 sm:left-[51.5%] sm:top-[36%]"
    >
      <motion.div
        className="flex flex-col items-center"
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, scale: 0.82 },
              whileInView: { opacity: 1, scale: 1 },
              viewport: { once: true, amount: 0.2 },
              transition: { duration: 0.7, delay: 0.3, ease: EASE_LIFT },
            })}
      >
        <span
          lang="ja"
          data-glyph="決"
          className="kanji-ink-glyph block font-kanji-serif text-[clamp(3.6rem,9vw,7rem)] font-black leading-none text-fg-strong/95"
          style={{ '--glow-rgb': CANALES_GOLD }}
        >
          決
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] font-black text-gold-bright drop-shadow-scrim">
          <Swords className="h-4 w-4" />
          VS
        </span>
      </motion.div>
    </div>
  )
}

function NombreCartel({ personaje, canales, className, align, entrada }) {
  const alineado = align === 'right' ? 'text-right' : 'text-left'
  return (
    <motion.div className={className} {...entrada}>
      <Link to={`/personajes/${personaje.slug}`} className="group block">
        {align === 'right' && (
          <span className={`block text-[12px] font-semibold text-fg-muted drop-shadow-scrim-sm ${alineado}`}>
            {personaje.anime}
          </span>
        )}
        <span
          className={`block truncate text-[clamp(1.7rem,5.5vw,4.25rem)] font-extrabold leading-none tracking-tight text-fg-strong transition-colors group-hover:text-gold ${alineado}`}
          style={{ textShadow: `0 4px 34px rgb(${canales} / 0.55), var(--text-shadow-scrim)` }}
        >
          {personaje.nombre}
        </span>
        {align !== 'right' && (
          <span className={`mt-1 block text-[12px] font-semibold text-fg-muted drop-shadow-scrim-sm ${alineado}`}>
            {personaje.anime}
          </span>
        )}
      </Link>
    </motion.div>
  )
}

/**
 * "Tale of the tape": comparación de stats al estilo cartel de boxeo.
 * Los valores vienen de la estimación determinista del catálogo, por eso
 * las etiquetas dicen "base"/"est." (regla de honestidad de personajes-core).
 */
function TaleOfTheTape({ retador, rival, t }) {
  // Sin IntersectionObserver no hay onViewportEnter: los contadores
  // arrancan al montar para no quedarse en cero.
  const [activo, setActivo] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )
  const filas = [
    { etiqueta: t('combate.statElo'), a: retador.elo, b: rival.elo, destacada: true },
    { etiqueta: t('combate.statVictorias'), a: retador.wins, b: rival.wins },
    { etiqueta: t('combate.statDerrotas'), a: retador.losses, b: rival.losses },
  ]
  return (
    <motion.div
      className="grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-baseline gap-x-6 gap-y-2.5"
      viewport={{ once: true, amount: 0.5 }}
      onViewportEnter={() => setActivo(true)}
    >
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="contents">
          <span
            className={`text-right font-mono font-bold tabular-nums ${
              fila.destacada ? 'text-xl text-gold' : 'text-base text-fg-strong'
            }`}
          >
            <StatContador value={fila.a} activo={activo} />
          </span>
          <span className="text-center text-[11px] font-semibold text-fg-muted">
            {fila.etiqueta}
          </span>
          <span
            className={`text-left font-mono font-bold tabular-nums ${
              fila.destacada ? 'text-xl text-gold' : 'text-base text-fg-strong'
            }`}
          >
            <StatContador value={fila.b} activo={activo} />
          </span>
        </div>
      ))}
    </motion.div>
  )
}

// Contador rAF con easing cúbico (patrón AnimatedNumber de
// VoteFeedbackBurst): sube hasta el valor al entrar en viewport.
function StatContador({ value, activo }) {
  const reduceMotion = useReducedMotion()
  const directo = reduceMotion || !Number.isFinite(value)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (directo || !activo) return undefined
    const inicio = performance.now()
    const duracion = 900
    let raf = 0
    const tick = (now) => {
      const progreso = Math.min(1, (now - inicio) / duracion)
      const eased = 1 - Math.pow(1 - progreso, 3)
      setDisplay(Math.round(value * eased))
      if (progreso < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [directo, activo, value])

  return <span>{directo ? value : display}</span>
}

export default SectionCombateEstelar
