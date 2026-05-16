import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Copy, RotateCcw, Sparkles } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { fechaDelDia, safeStorage } from '../lib/games'

const STORAGE_KEY = 'animeshowdown.omikuji.v1'

/**
 * Suertes del omikuji (Plan v2 §13.5) en orden tradicional japonés del
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
    perk: 'Pista gratis disponible en cualquier juego del día.',
    weight: 31,
  },
  {
    kanji: '中吉',
    romaji: 'chū-kichi',
    nombre: 'Fortuna media',
    desc: 'Vientos favorables. Tus elecciones serán acertadas si confías en tu instinto otaku.',
    color: 'emerald',
    perk: 'Buen día para predecir el bracket de un torneo activo.',
    weight: 17,
  },
  {
    kanji: '小吉',
    romaji: 'shō-kichi',
    nombre: 'Pequeña fortuna',
    desc: 'Suerte discreta pero constante. Las pequeñas victorias hoy plantan árboles mañana.',
    color: 'cyan',
    perk: 'Tu primer voto del día tendrá doble peso visual.',
    weight: 18,
  },
  {
    kanji: '末吉',
    romaji: 'sue-kichi',
    nombre: 'Fortuna tardía',
    desc: 'Empieza despacio, termina fuerte. Reserva tus mejores votos para la tarde.',
    color: 'purple',
    perk: 'Buen día para mirar el ranking ELO y planear estrategia.',
    weight: 17,
  },
  {
    kanji: '凶',
    romaji: 'kyō',
    nombre: 'Mala suerte',
    desc: 'Las cosas se tuercen pero no se rompen. Para según tradición japonesa: ata tu omikuji a un árbol y déjalo allí (o ciérralo y vuelve mañana).',
    color: 'rose',
    perk: 'Día perfecto para descubrir un anime que no conocías.',
    weight: 17,
  },
]

const COLOR_CLASSES = {
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  cyan: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
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
 * Omikuji diario (Plan v2 §13.5).
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

  const fecha = fechaDelDia()
  const suerte = useMemo(() => elegirSuerte(`omikuji:${fecha}`), [fecha])
  const [revelado, setRevelado] = useState(() => {
    const raw = safeStorage.get(STORAGE_KEY)
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw)
      return parsed.fecha === fecha
    } catch {
      return false
    }
  })

  const revelar = () => {
    setRevelado(true)
    safeStorage.set(STORAGE_KEY, JSON.stringify({ fecha }))
  }

  const reset = () => {
    setRevelado(false)
    safeStorage.set(STORAGE_KEY, '')
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
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Omikuji', path: '/omikuji' },
        ])}
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            <Sparkles className="h-3 w-3" />
            お御籤 · Omikuji
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Tu suerte del día
          </h1>
          <p className="text-[13px] text-fg-muted">
            Tradición japonesa de santuario: agita el tubo, saca un palito,
            descubre la suerte que el día te trae. Una por persona y día —
            vuelve mañana para otra.
          </p>
        </motion.header>

        {!revelado ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="mb-6 text-[13px] text-fg-muted">
              El tubo de bambú espera. ¿Listo para ver qué te trae{' '}
              <strong className="text-fg-strong">{fecha}</strong>?
            </p>
            <motion.div
              className="mb-6 inline-block rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 px-8 py-12 font-mono text-6xl text-amber-200/40"
              animate={{
                rotate: [-2, 2, -2, 2, 0],
                y: [0, -3, 0, -3, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              ?
            </motion.div>
            <button
              type="button"
              onClick={revelar}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              <Sparkles className="h-4 w-4" />
              Sacar palito
            </button>
          </div>
        ) : (
          <SuerteRevelada
            suerte={suerte}
            onCompartir={compartir}
            onReset={reset}
          />
        )}

        <div className="mt-10 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Las 5 suertes
          </h2>
          <ul className="flex flex-col gap-2 text-[13px] text-fg-muted">
            {SUERTES.map((s) => (
              <li key={s.kanji} className="flex items-baseline gap-3">
                <span
                  className={`inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md border font-bold ${COLOR_CLASSES[s.color]}`}
                >
                  {s.kanji}
                </span>
                <span className="flex-1">
                  <strong className="text-fg-strong">{s.nombre}</strong> ·{' '}
                  {s.romaji}
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {s.weight}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-fg-muted">
            Probabilidades aproximadas de un omikuji real del santuario
            Meiji-jingu. Si te toca 凶 (kyō, mala suerte), la tradición
            dice que ates el papel a un árbol del santuario y dejes que el
            viento se lleve el mal augurio.
          </p>
        </div>
      </div>
    </section>
  )
}

function SuerteRevelada({ suerte, onCompartir, onReset }) {
  return (
    <div className={`rounded-2xl border-2 p-8 ${COLOR_CLASSES[suerte.color]}`}>
      <motion.div
        variants={palitoVariants}
        initial="hidden"
        animate="visible"
        className="mb-4 flex flex-col items-center text-center"
      >
        <span
          className={`mb-4 inline-flex h-24 w-24 items-center justify-center rounded-2xl border-2 font-bold ${COLOR_CLASSES[suerte.color]} text-5xl`}
        >
          {suerte.kanji}
        </span>
        <p className="text-[12px] uppercase tracking-wider text-fg-muted">
          {suerte.romaji}
        </p>
        <p className="text-2xl font-bold text-fg-strong">{suerte.nombre}</p>
      </motion.div>
      <p className="mb-4 text-center text-[14px] leading-relaxed text-fg">
        {suerte.desc}
      </p>
      <div className="mb-4 rounded-lg border border-border bg-bg p-3 text-center text-[12px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Bono del día
        </p>
        <p className="mt-1 text-fg-strong">{suerte.perk}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCompartir}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Copy className="h-3.5 w-3.5" />
          Compartir
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:text-fg-strong"
        >
          <RotateCcw className="h-3 w-3" />
          Reiniciar (solo testear)
        </button>
      </div>
      <p className="mt-4 text-center text-[11px] text-fg-muted">
        Vuelve mañana para otra suerte ·{' '}
        <Link to="/games" className="hover:text-accent hover:underline">
          Juegos del día
        </Link>
      </p>
    </div>
  )
}

export default OmikujiPage
