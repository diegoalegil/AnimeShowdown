import { useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AppLink } from './AppLink'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'
import { useInstantSoundPress } from '../hooks/useInstantSoundPress'
import { useTorneos } from '../lib/torneosQueries'
import { useRankingPulso } from '../features/home/pulso/pulsoQueries'
import {
  sumarVotosComunidad,
  UMBRAL_COMUNIDAD_JOVEN,
} from '../features/home/pulso/pulso-utils'
import { contarTorneosEnVivo, contarTorneosProgramados } from './hearth-hero-core'
import './hearth-hero.css'

/**
 * EL HOGAR — hero de la home. Una llama compacta de brasero (SVG de 3
 * lenguas + 2 capas de luz en cross-fade de opacity) ardiendo en un
 * pebetero bajo; el titular de la casa entra por corte de tinta; los dos
 * números vivos (votos de la comunidad, torneos en marcha) laten en
 * font-mono; bajo el hogar, las 3 CTAs como tablillas.
 *
 * Coreografía (CSS en hearth-hero.css; CSP-safe, cero <style> en runtime):
 *   t0      llama prende (scaleY 0.2→1, 350ms ease-lift) + capas de luz
 *           suben a su opacity en 500ms
 *   t+200   titular por corte de tinta (420ms ease-brush, filo dorado 3px)
 *   t+450   números (rise 500ms + odómetro 900ms ease-lift)
 *   t+600   tablillas en stagger de 60ms
 * Reposo: respiración por cross-fade de las 2 capas (3.2s, desfase −1.6s)
 * y un chasquido de una lengua (rotate 1.5°) cada 7s.
 *
 * Pausa/estático:
 *   - [data-hearth-paused]: loops pausados fuera de viewport y con la
 *     pestaña oculta (IntersectionObserver + visibilitychange).
 *   - [data-hearth-static]: useReducedMotionPref() (que ya une
 *     prefers-reduced-motion del SO y el modo calma de la linterna) deja
 *     la llama en su frame más noble; solo los odómetros actualizan.
 *
 * Hito de millar: cuando los votos de la comunidad cruzan cada 1000, la
 * llama crece UNA vez (scale 1→1.06→1, 400ms). Keyed por millar
 * (Math.floor(votos/1000)): un re-render NO lo re-dispara; solo un cambio
 * real de millar. El primer dato fija la línea base sin animar.
 *
 * Datos: cifras reales ya en la cache de la home — la suma de votos del
 * ranking all-time (la misma query del Pulso, una sola request) y el
 * conteo de torneos IN_PROGRESS de useTorneos(). No existe aún endpoint
 * agregado de "votos hoy" / "duelos abiertos"; si llega un endpoint de
 * pulso, solo cambia este contenedor — la vista no se toca.
 */
function HearthHero() {
  const { data: ranking } = useRankingPulso()
  const { data: torneos } = useTorneos()
  return (
    <HearthHeroView
      votosComunidad={sumarVotosComunidad(ranking)}
      torneosEnVivo={contarTorneosEnVivo(torneos)}
      torneosProgramados={contarTorneosProgramados(torneos)}
    />
  )
}

/**
 * Vista presentacional del hogar: recibe las dos cifras ya derivadas.
 * Exportada para tests (el contrato del hito y los estados vacíos se
 * ejercitan con props controladas, sin red ni cache).
 *
 * @param {object} props
 * @param {number|null} [props.votosComunidad=null] Votos all-time de la
 *   comunidad (contrato del hito de millar). null = query sin datos → "—";
 *   por debajo de UMBRAL_COMUNIDAD_JOVEN, copy de arranque (mismo criterio
 *   de honestidad que el disclaimer del Pulso).
 * @param {number|null} [props.torneosEnVivo=null]  Torneos IN_PROGRESS.
 *   Con 0 y programados, "N a punto de empezar"; con 0 y nada programado,
 *   "ninguno ahora — enciende tú el primero" (link a crear torneo).
 * @param {number|null} [props.torneosProgramados=null] Torneos SCHEDULED.
 */
function HearthHeroView({
  votosComunidad = null,
  torneosEnVivo = null,
  torneosProgramados = null,
}) {
  const { t } = useTranslation()
  const staticMode = useReducedMotionPref()
  const sectionRef = useRef(null)
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )

  // Loops pausados fuera del viewport (umbral bajo: el hero es grande).
  useEffect(() => {
    const node = sectionRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      // La última entry del batch es el estado más reciente: con cruces
      // rápidos de viewport, quedarse con la primera deja la pausa stale.
      (entries) => setInView(entries[entries.length - 1].isIntersecting),
      { threshold: 0.05 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  // Loops pausados con la pestaña oculta.
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Hito por cruce ascendente de millar: ajuste de estado durante el
  // render (patrón oficial de React para derivar de props; compatible
  // React Compiler — sin setState en efectos ni refs en render). La key
  // es el número de cruces vistos, no el millar: una bajada no re-monta
  // nada y re-cruzar el MISMO millar vuelve a celebrarse.
  const millar = votosComunidad != null ? Math.floor(votosComunidad / 1000) : null
  const [lastMillar, setLastMillar] = useState(millar)
  const [hitoSeq, setHitoSeq] = useState(0)
  if (millar !== lastMillar) {
    setLastMillar(millar)
    if (lastMillar != null && millar != null && millar > lastMillar) {
      setHitoSeq(hitoSeq + 1)
    }
  }

  const paused = !inView || !pageVisible

  return (
    <section
      ref={sectionRef}
      className="hearth-hero"
      data-hearth-static={staticMode || undefined}
      data-hearth-paused={paused || undefined}
      data-screen-label="El hogar (hero home)"
    >
      {/* La llama es decorativa: todo el hogar va aria-hidden. */}
      <div className="hearth-media" aria-hidden="true">
        <span className="hearth-watermark" lang="ja">炎</span>
        <div className="hearth-fire">
          <span className="hearth-glow hearth-glow--a"></span>
          <span className="hearth-glow hearth-glow--b"></span>
          <div className="hearth-ignite">
            <div
              key={hitoSeq}
              className={hitoSeq > 0 ? 'hearth-hito-pop' : undefined}
            >
              <HearthFlameSvg />
            </div>
          </div>
        </div>
        <div className="hearth-pebetero">
          <span className="hearth-pebetero__brasas"></span>
          <span className="hearth-pebetero__rim"></span>
          <span className="hearth-pebetero__bowl"></span>
          <span className="hearth-pebetero__stem"></span>
          <span className="hearth-pebetero__base"></span>
        </div>
      </div>

      <div className="hearth-copy">
        <span className="hearth-kicker hearth-rise" style={{ '--rise-delay': '260ms' }}>
          {t('hero.kicker')}
        </span>
        <div className="hearth-cut">
          {/* El titular es UNA clave por locale (<gold> como markup):
              componerlo en 3 segmentos con espacios ASCII fijaba el orden
              de palabras desde el JSX y metía espacios occidentales
              dentro de la frase japonesa (antes de la partícula を). */}
          <h1 className="hearth-title">
            <Trans
              i18nKey="hero.titulo"
              components={{ gold: <span className="hearth-title__gold" /> }}
            />
          </h1>
          <span className="hearth-cut__cover" aria-hidden="true"></span>
        </div>
        <p className="hearth-sub hearth-rise" style={{ '--rise-delay': '320ms' }}>
          {t('hero.subtitulo')}
        </p>
        <dl className="hearth-stats hearth-rise" style={{ '--rise-delay': '450ms' }}>
          <div className="hearth-stat">
            <dt>{t('hero.statVotos')}</dt>
            <dd>
              {/* Comunidad joven: mismo criterio de honestidad que el
                  disclaimer del Pulso — bajo el umbral no se presenta la
                  cifra como señal, se invita a prender la llama. */}
              {votosComunidad != null && votosComunidad < UMBRAL_COMUNIDAD_JOVEN ? (
                <span className="hearth-stat__vacio">
                  {t('hero.statVotosVacio')}{' '}
                  <HearthVacioCta to="/votar" labelKey="hero.statVotosVacioCta" />
                </span>
              ) : (
                <HearthOdometer value={votosComunidad} instant={staticMode} />
              )}
            </dd>
          </div>
          <div className="hearth-stat">
            <dt>
              {torneosEnVivo != null && torneosEnVivo > 0 && (
                <span className="hearth-stat__dot" aria-hidden="true"></span>
              )}
              {t('hero.statTorneos')}
            </dt>
            <dd>
              {torneosEnVivo === 0 ? (
                <span className="hearth-stat__vacio">
                  {torneosProgramados != null && torneosProgramados > 0 ? (
                    t('hero.statTorneosProgramados', { count: torneosProgramados })
                  ) : (
                    <>
                      {t('hero.statTorneosVacio')}{' '}
                      <HearthVacioCta
                        to="/torneos/crear"
                        labelKey="hero.statTorneosVacioCta"
                      />
                    </>
                  )}
                </span>
              ) : (
                <HearthOdometer value={torneosEnVivo} instant={staticMode} />
              )}
            </dd>
          </div>
        </dl>
      </div>

      <nav className="hearth-tablillas" aria-label={t('hero.accionesAria')}>
        {TABLILLAS.map((tb, i) => (
          <HearthTablilla key={tb.to} tablilla={tb} index={i} />
        ))}
      </nav>
    </section>
  )
}

/* Kanji con significado: 票 voto · 戦 batalla · 遊 juego.
   Copys vía hero.* de los locales (paridad es/en/ja). */
// `primary` marca la acción dominante para el visitante nuevo: votar es el
// bucle núcleo (se hace sin cuenta). Antes las 3 tablillas eran visualmente
// idénticas, sin jerarquía → el recién llegado no sabía por dónde empezar.
const TABLILLAS = [
  { to: '/votar', kanji: '票', labelKey: 'hero.tablillaVotarLabel', descKey: 'hero.tablillaVotarDesc', primary: true },
  { to: '/torneos', kanji: '戦', labelKey: 'hero.tablillaTorneosLabel', descKey: 'hero.tablillaTorneosDesc' },
  { to: '/games', kanji: '遊', labelKey: 'hero.tablillaJuegosLabel', descKey: 'hero.tablillaJuegosDesc' },
]

/**
 * CTA de los estados vacíos de las cifras: el copy de acción ("enciende
 * tú el primero" / "vota tú") es un link de verdad, con hit-area >=44px
 * por padding negativo-compensado (la línea de texto no se mueve) y
 * subrayado para que la afordancia no dependa solo del color.
 * Componente propio para llamar useInstantSoundPress incondicionalmente
 * (el estado vacío es condicional en el JSX del padre).
 */
function HearthVacioCta({ to, labelKey }) {
  const { t } = useTranslation()
  const press = useInstantSoundPress('playClick')
  return (
    <AppLink
      to={to}
      className="hearth-stat__vacio-cta"
      onPointerDown={press.onPointerDown}
      onClick={press.onClick}
    >
      <strong>{t(labelKey)}</strong>
    </AppLink>
  )
}

/**
 * Tablilla individual: componente propio para que cada CTA tenga su
 * useInstantSoundPress (hooks fuera del map) — mismo lenguaje de
 * interacción que el resto de CTAs de la casa: el click suena al
 * INICIO de la pulsación.
 */
function HearthTablilla({ tablilla, index }) {
  const { t } = useTranslation()
  const press = useInstantSoundPress('playClick')
  return (
    <AppLink
      to={tablilla.to}
      className={`hearth-tablilla hearth-rise${tablilla.primary ? ' hearth-tablilla--primary' : ''}`}
      style={{ '--rise-delay': `${600 + index * 60}ms` }}
      onPointerDown={press.onPointerDown}
      onClick={press.onClick}
    >
      <span lang="ja" aria-hidden="true" className="hearth-tablilla__kanji">
        {tablilla.kanji}
      </span>
      <span className="hearth-tablilla__texto">
        <span className="hearth-tablilla__label">{t(tablilla.labelKey)}</span>
        <span className="hearth-tablilla__desc">{t(tablilla.descKey)}</span>
      </span>
    </AppLink>
  )
}

/**
 * SVG de la llama: 3 lenguas (carmesí / oro / oro pálido), <1KB inline.
 * Los fills beben de los tokens del sistema vía CSS variables.
 * La lengua intermedia lleva el chasquido (.hearth-lengua--flick).
 */
function HearthFlameSvg() {
  return (
    <svg
      className="hearth-flame"
      viewBox="0 0 120 150"
      role="presentation"
      focusable="false"
    >
      <path
        className="hearth-lengua"
        style={{ '--i': 0 }}
        fill="var(--color-accent)"
        d="M63 4C59 22 47 34 41 50C33 70 30 88 36 106C42 126 50 138 61 141C74 138 84 124 88 106C93 86 88 68 78 50C70 36 66 20 63 4Z"
      />
      <path
        className="hearth-lengua hearth-lengua--flick"
        style={{ '--i': 1 }}
        fill="var(--color-gold)"
        d="M58 42C55 56 47 64 44 76C40 90 41 103 47 113C52 121 57 126 60 127C66 124 73 116 76 104C79 92 76 80 69 68C64 59 60 52 58 42Z"
      />
      <path
        className="hearth-lengua"
        style={{ '--i': 2 }}
        fill="var(--color-gold-pale)"
        d="M60 74C58 84 53 89 51 97C49 105 51 112 55 117C57 120 59 122 60 122C63 120 66 116 68 110C70 103 68 95 65 88C63 83 61 79 60 74Z"
      />
    </svg>
  )
}

const ODO_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * HearthOdometer — odómetro font-mono transform-only. Cada dígito es una
 * tira 0-9 que rueda por translateY; la transición vive en CSS
 * (.hearth-odo__strip, 900ms ease-lift) y con reduced-motion/calma el
 * valor cambia en seco (transition: none), porque los odómetros son lo
 * único que sigue vivo en estático.
 *
 * Nota: LiveNumber (features/ranking) es el odómetro de la tabla viva —
 * otro contrato (rAF del número completo + burst ±N + gate de ráfagas).
 * Aquí el rodillo por columnas y la entrada alineada con el rise son
 * parte de la coreografía del hogar; no se fusionan a propósito.
 *
 * @param {object} props
 * @param {number|null} props.value          Valor a mostrar. null → "—".
 * @param {boolean}     [props.instant]      true = sin rodillo (estático).
 * @param {number}      [props.entranceMs=450] Retardo del primer rodillo,
 *                                           alineado con el rise de los números.
 */
function HearthOdometer({ value, instant = false, entranceMs = 450 }) {
  const { t, i18n } = useTranslation()
  const [armed, setArmed] = useState(false)
  const montadoEnRef = useRef(null)
  const hasValue = value != null

  // Marca de montaje (ref solo en efectos: regla Compiler).
  useEffect(() => {
    montadoEnRef.current ??= performance.now()
  }, [])

  // El primer rodillo se arma cuando HAY cifra: con dato en caché queda
  // alineado con el rise (t+entranceMs desde el montaje); si el dato
  // llega tarde (red fría > entranceMs), rueda de inmediato — el suelo
  // de 50ms garantiza que el frame a translateY(0) se pinte y la
  // transición CSS tenga punto de partida.
  useEffect(() => {
    if (!hasValue || armed) return undefined
    const transcurrido = performance.now() - (montadoEnRef.current ?? performance.now())
    const id = setTimeout(() => setArmed(true), Math.max(50, entranceMs - transcurrido))
    return () => clearTimeout(id)
  }, [hasValue, armed, entranceMs])

  if (value == null) {
    // null cubre también query fallida: nada de "cargando…" — honesto.
    return (
      <span className="hearth-odo">
        <span className="sr-only">{t('hero.statSinDatos')}</span>
        <span aria-hidden="true">—</span>
      </span>
    )
  }

  const safe = Math.max(0, Math.floor(value))
  const text = new Intl.NumberFormat(i18n.language || 'es').format(safe)
  const chars = Array.from(text)
  const show = armed || instant

  return (
    <span className="hearth-odo">
      <span className="sr-only">{text}</span>
      {chars.map((ch, idx) => {
        // Keyed desde la derecha: al ganar un dígito (999→1.004) las
        // columnas existentes conservan identidad y solo ruedan.
        const key = chars.length - idx
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${key}`} className="hearth-odo__sep" aria-hidden="true">
              {ch}
            </span>
          )
        }
        const d = show ? Number(ch) : 0
        return (
          <span key={`d${key}`} className="hearth-odo__col" aria-hidden="true">
            <span
              className="hearth-odo__strip"
              style={{ transform: `translateY(-${d}em)` }}
            >
              {ODO_DIGITS.map((n) => (
                <span key={n} className="hearth-odo__digit">
                  {n}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}

export default HearthHero
export { HearthHeroView, HearthOdometer }
