import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Sparkles } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import KanjiStroke from '../components/KanjiStroke'
import { VisualPageShell } from '../components/VisualSystem'
import { getGameVisual } from '../data/visual-assets'
import { useDailyGameState } from '../hooks/useDailyGameState'
import OmikujiCylinder from '../features/games/omikuji/OmikujiCylinder'
import { EASE_LIFT } from '../lib/motion'

const STORAGE_KEY = 'animeshowdown.omikuji.v1'
const ESTADO_INICIAL = { revelado: false }
const normalizarEstado = (value) => ({ revelado: Boolean(value?.revelado) })

/**
 * Suertes del omikuji en orden tradicional japonés del
 * más afortunado al menos. Probabilidades aproximadas de un omikuji real
 * (santuario Meiji-jingu): 大吉 31%, 中吉 17%, 小吉 18%, 末吉 17%, 凶 17%.
 *
 * <p>Calculamos la suerte como hash determinístico de fecha+username
 * (o IP cuando haya), así cada visitante ve la misma suerte el mismo
 * día — sentación de ritual compartido, no de RNG.
 */
const SUERTES = [
  {
    kanji: '大吉',
    romaji: 'daikichi',
    nombre: 'Gran fortuna',
    desc: 'El cosmos sonríe. Todo lo que toques este día sale bien — vota, predice y crea torneos sin miedo.',
    color: 'amber',
    perk: 'Día propicio para arriesgar: lánzate a los duelos difíciles.',
    weight: 31,
    etimologia: '大 es la persona con los brazos extendidos al máximo — el carácter de "grande, enorme". 吉 muestra a un sabio (士) sobre su boca (口): las palabras del erudito traen buen augurio. Juntos: el mayor de los presagios.',
  },
  {
    kanji: '中吉',
    romaji: 'chū-kichi',
    nombre: 'Fortuna media',
    desc: 'Vientos favorables. Tus elecciones serán acertadas si confías en tu instinto otaku.',
    color: 'emerald',
    perk: 'Confía en tu instinto: hoy aciertas más de lo que crees.',
    weight: 17,
    etimologia: '中 es una flecha clavada en el centro de la diana — el carácter de "medio, centrado, equilibrio". Combinado con 吉 (buen augurio) da una fortuna justa: sin excesos, certera al blanco.',
  },
  {
    kanji: '小吉',
    romaji: 'shō-kichi',
    nombre: 'Pequeña fortuna',
    desc: 'Suerte discreta pero constante. Las pequeñas victorias hoy plantan árboles mañana.',
    color: 'cyan',
    perk: 'Las pequeñas victorias de hoy plantan la racha de mañana.',
    weight: 18,
    etimologia: '小 son tres partículas diminutas cayendo — "pequeño, menor". Con 吉 forma "buen augurio en lo pequeño": no cambia el mundo, pero acompaña.',
  },
  {
    kanji: '末吉',
    romaji: 'sue-kichi',
    nombre: 'Fortuna tardía',
    desc: 'Empieza despacio, termina fuerte. Reserva tus mejores votos para la tarde.',
    color: 'purple',
    perk: 'Empieza despacio: tu mejor momento llega al caer la tarde.',
    weight: 17,
    etimologia: '末 es el carácter de árbol (木) con una línea horizontal marcando la punta más alta — "el extremo, el final". Con 吉 significa que la buena suerte llega tarde: aguanta el principio del día y cosecha al final.',
  },
  {
    kanji: '凶',
    romaji: 'kyō',
    nombre: 'Mala suerte',
    desc: 'Las cosas se tuercen pero no se rompen. Por tradición japonesa: ata tu omikuji a un árbol y déjalo allí (o ciérralo y vuelve mañana).',
    color: 'rose',
    perk: 'Las cosas se tuercen sin romperse: paso firme y sin prisa.',
    weight: 17,
    etimologia: '凶 es un pozo (凵) con un aspa (✕) clavada en el fondo — el pictograma de "caer en una trampa, calamidad". Es un kanji solo, sin compañía: la ausencia del 吉 ya lo dice todo.',
  },
]

const COLOR_CLASSES = {
  amber: 'border-gold/40 bg-gold/10 text-gold',
  emerald: 'border-success/40 bg-success/10 text-success',
  cyan: 'border-electric/40 bg-electric/10 text-electric',
  purple: 'border-rarity-epic/40 bg-rarity-epic/10 text-rarity-epic',
  rose: 'border-danger/40 bg-danger/10 text-danger',
}

// RGB del glow latente de cada suerte — se inyecta como CSS custom
// prop --glow-rgb en la caja del kanji y la clase kanji-ink del
// index.css respira ese color (cross-fade de una capa pre-pintada).
// Coincide con los tones de Tailwind 400-500 para que el resplandor
// case con el borde y el texto sin chocar.
const GLOW_RGB = {
  amber: '251 191 36',
  emerald: '52 211 153',
  cyan: '34 211 238',
  purple: '168 85 247',
  rose: '244 63 94',
}

// Entry "pincelada": el kanji se revela de izquierda a derecha con
// clip-path mientras escala desde 0.55 y rota -8° → 0°. Da sensación
// de tinta cayendo en papel washi, no de pop-in genérico. El stagger
// por índice (i * 0.14s) hace que los 5 kanji caigan en cascada.
const kanjiEntryVariants = {
  hidden: {
    opacity: 0,
    scale: 0.55,
    rotate: -8,
    clipPath: 'inset(0 100% 0 0)',
  },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    rotate: 0,
    clipPath: 'inset(0 0% 0 0)',
    transition: {
      delay: i * 0.14,
      duration: 0.65,
      ease: EASE_LIFT,
    },
  }),
}

function djb2(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

function elegirSuerte(seed) {
  const total = SUERTES.reduce((a, s) => a + s.weight, 0)
  const r = djb2(seed) % total
  let acc = 0
  for (const s of SUERTES) {
    acc += s.weight
    if (r < acc) return s
  }
  return SUERTES[0]
}

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const palitoVariants = {
  hidden: { y: -200, opacity: 0, rotate: -10 },
  visible: {
    y: 0,
    opacity: 1,
    rotate: 0,
    transition: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] },
  },
}

/**
 * Omikuji diario.
 *
 * <p>Cada visitante recibe una suerte determinística por fecha local —
 * todos en el mismo día ven la misma. Sin login no hay personalización
 * (es un acto ritual, no un horóscopo).
 *
 * <p>JST sería el reset "auténtico", pero un usuario en LATAM vería
 * cambiar la suerte a las 9am de su mañana, raro. Usamos fecha local
 * como en los otros juegos diarios. Pureza vs UX — gana UX.
 */
function OmikujiPage() {
  useSeo({
    title: 'Omikuji diario',
    description:
      'Suerte japonesa del día estilo santuario: 大吉, 中吉, 小吉, 末吉 o 凶. Tira tu palito y descubre qué te depara el día en AnimeShowdown.',
  })

  // useDailyGameState (el mismo hook del resto de juegos diarios) en vez
  // del localStorage ad-hoc: aporta el reset automático a medianoche y al
  // volver a la pestaña, y guarda por clave de día — antes la suerte
  // revelada se quedaba congelada hasta recargar.
  const [estado, setEstado, { todayKey: fecha }] = useDailyGameState({
    initialState: ESTADO_INICIAL,
    normalize: normalizarEstado,
    storageKeyPrefix: STORAGE_KEY,
  })
  const suerte = useMemo(() => elegirSuerte(`omikuji:${fecha}`), [fecha])
  // Nº de varilla del día (第 N 番): mismo seed determinista que la suerte —
  // todos ven la misma varilla el mismo día, como en el santuario.
  const varilla = useMemo(() => (djb2(`omikuji-vara:${fecha}`) % 100) + 1, [fecha])
  const revelado = estado.revelado

  const revelar = () => {
    setEstado({ revelado: true })
  }

  const compartir = async () => {
    const texto = `🎋 Omikuji — ${fecha}\n${suerte.kanji} (${suerte.romaji}) · ${suerte.nombre}\nanimeshowdown.dev/omikuji`
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <VisualPageShell visual={getGameVisual("/omikuji", "Omikuji diario")} contentClassName="mx-auto max-w-3xl" lateralKanji={{left: "御", right: "籤"}} atmosphere="ritual">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Omikuji', path: '/omikuji' },
        ])}
      />
      <JsonLd
        id="game-omikuji"
        schema={gameWebApplicationSchema({
          name: 'Omikuji diario',
          alternateName: 'Suerte japonesa diaria',
          path: '/omikuji',
          description:
            'Suerte japonesa del día estilo santuario: 大吉, 中吉, 小吉, 末吉 o 凶. Tira tu palito y descubre qué te depara el día en AnimeShowdown.',
          featureList: [
            'Suerte determinista diaria',
            'Cinco fortunas tradicionales con su kanji',
            'Animación de cilindro de palitos',
            'Resultado compartible',
          ],
          keywords: ['omikuji', 'suerte japonesa', 'fortuna diaria anime', 'omikuji online'],
        })}
      />
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <Sparkles className="h-3 w-3" />
            <span lang="ja">お御籤</span> · Omikuji
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Tu suerte del día
          </h1>
          <p className="text-[13px] text-fg-muted">
            Tradición japonesa de santuario: agita el tubo, saca un palito,
            descubre la suerte que el día te trae. Una por persona y día —
            vuelve mañana para otra.
          </p>
        </motion.header>

        {!revelado ? (
          <div className="rounded-2xl border border-border bg-surface px-4 pb-2 pt-8 text-center sm:px-10">
            <p className="mb-2 text-[13px] text-fg-muted">
              El cilindro espera tu mano. Agítalo y deja que{' '}
              <strong className="text-fg-strong">{fecha}</strong> suelte su varilla.
            </p>
            <OmikujiCylinder fortuna={suerte.kanji} numero={varilla} onRevealed={revelar} />
          </div>
        ) : (
          <SuerteRevelada
            suerte={suerte}
            onCompartir={compartir}
          />
        )}

        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-3 text-sm font-semibold text-fg-muted">
            Las 5 suertes y su kanji
          </h2>
          <ul className="flex flex-col gap-4 text-[13px] text-fg-muted">
            {SUERTES.map((s, i) => (
              <li key={s.kanji} className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <motion.span
                  custom={i}
                  variants={kanjiEntryVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  whileHover={{
                    scale: 1.12,
                    rotate: [0, -3, 3, 0],
                    transition: { duration: 0.5 },
                  }}
                  style={{
                    '--glow-rgb': GLOW_RGB[s.color],
                    // Cada kanji late con un pequeño desfase para que los
                    // 5 brillen "out of sync" — sensación viva, no robot.
                    '--glow-delay': `${i * 0.4}s`,
                  }}
                  className={`kanji-ink inline-flex h-14 w-14 shrink-0 cursor-default items-center justify-center self-start rounded-lg border ${COLOR_CLASSES[s.color]}`}
                >
                  <KanjiStroke
                    kanji={s.kanji}
                    size="2.25em"
                    strokeMs={520}
                    gapMs={120}
                    strokeWidth={5}
                  />
                </motion.span>
                <div className="flex flex-1 flex-col gap-1">
                  <span>
                    <strong className="text-fg-strong">{s.nombre}</strong>{' '}
                    <span className="text-fg-muted">·</span>{' '}
                    <em className="not-italic font-mono text-[12px] text-fg-muted">
                      {s.romaji}
                    </em>
                  </span>
                  <p className="text-[12px] leading-relaxed text-fg-muted">
                    {s.etimologia}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[11px] leading-relaxed text-fg-muted">
            Las 5 suertes del omikuji vienen de la tradición de los
            santuarios japoneses. Si te toca 凶 (kyō, mala suerte),
            la costumbre dice que ates el papel a un pino del santuario
            (松 matsu — homófono de "esperar"): dejas el mal augurio
            atado allí y el viento se lo lleva.
          </p>
        </div>
      </div>
    </VisualPageShell>
  )
}

function SuerteRevelada({ suerte, onCompartir }) {
  return (
    <div className={`rounded-2xl border-2 p-8 ${COLOR_CLASSES[suerte.color]}`}>
      <motion.div
        variants={palitoVariants}
        initial="hidden"
        animate="visible"
        className="mb-4 flex flex-col items-center text-center"
      >
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.15,
            duration: 0.5,
            ease: EASE_LIFT,
          }}
          whileHover={{
            scale: 1.08,
            rotate: [0, -2, 2, 0],
            transition: { duration: 0.6 },
          }}
          style={{
            '--glow-rgb': GLOW_RGB[suerte.color],
          }}
          className={`kanji-ink mb-4 inline-flex h-32 w-32 cursor-default items-center justify-center rounded-2xl border-2 ${COLOR_CLASSES[suerte.color]}`}
        >
          {/* KanjiStroke con replayKey = suerte.kanji para que al cambiar
              la suerte (nuevo día) los trazos se redibujen en vez de
              aparecer instantáneos. */}
          <KanjiStroke
            kanji={suerte.kanji}
            size="5em"
            strokeMs={700}
            gapMs={160}
            strokeWidth={5}
            replayKey={suerte.kanji}
          />
        </motion.span>
        <p className="text-[12px] text-fg-muted">
          {suerte.romaji}
        </p>
        <p className="text-2xl font-bold text-fg-strong">{suerte.nombre}</p>
      </motion.div>
      <p className="mb-4 text-center text-[14px] leading-relaxed text-fg">
        {suerte.desc}
      </p>
      <div className="mb-4 rounded-lg border border-border bg-bg p-3 text-center text-[12px]">
        <p className="text-[10px] font-semibold text-fg-muted">
          Consejo del día
        </p>
        <p className="mt-1 text-fg-strong">{suerte.perk}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCompartir}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Copy className="h-3.5 w-3.5" />
          Compartir
        </button>
      </div>
      <p className="mt-4 text-center text-[11px] text-fg-muted">
        Vuelve mañana para otra suerte ·{' '}
        <Link to="/games" className="hover:text-gold hover:underline">
          Juegos del día
        </Link>
      </p>
    </div>
  )
}

export default OmikujiPage
