import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, definedTermSetSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { normalizar } from '../lib/games'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../contexts/AuthContext'
import { endpoints } from '../lib/api'
import { hasCategoriaPersonaje } from '../data/personajes-tags'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Glosario otaku — términos comunes del fandom anime
 * con definición curada en español. Cada entrada produce un
 * {@code DefinedTerm} en JSON-LD para captura long-tail SEO.
 *
 * <p>~30 términos cubre el grueso de queries "qué es X anime" — desde
 * dere variants (tsundere, yandere…) hasta géneros (shounen, isekai,
 * mecha) y tropos (harem, slice of life).
 *
 * <p>Cada término linkea a un ejemplo del catálogo cuando hay match
 * obvio. Sin atributos extendidos (nota técnica) no podemos auto-vincular
 * personajes que ejemplifican un tropo; queda como nota informativa.
 */

const TERMINOS = [
  {
    termino: 'Tsundere',
    kanji: 'ツンデレ',
    definicion:
      'Personaje que oscila entre frío y hostil (tsun-tsun) por fuera y cálido y enamorado (dere-dere) por dentro. El cambio se revela poco a poco cuando baja la guardia.',
    categoria: 'Tropos',
    ejemplo: 'Asuka Langley · Taiga Aisaka',
  },
  {
    termino: 'Yandere',
    kanji: 'ヤンデレ',
    definicion:
      'Personaje obsesivamente enamorado al punto de la violencia. Aparenta dulzura hasta que alguien amenaza su relación.',
    categoria: 'Tropos',
    ejemplo: 'Yuno Gasai',
  },
  {
    termino: 'Kuudere',
    kanji: 'クーデレ',
    definicion:
      'Frío y reservado en superficie, especialmente con extraños, pero leal y cariñoso una vez gana confianza. Diferente al tsundere en que el frío es consistente, no oscilante.',
    categoria: 'Tropos',
    ejemplo: 'Rei Ayanami · Mikasa Ackerman',
  },
  {
    termino: 'Dandere',
    kanji: 'ダンデレ',
    definicion:
      'Silencioso y tímido (dan-dan) por defecto, expresivo y dulce solo con quien le da confianza. Suelen ser introvertidos extremos.',
    categoria: 'Tropos',
    ejemplo: 'Hinata Hyūga · Nagato Yuki',
  },
  {
    termino: 'Himedere',
    kanji: 'ヒメデレ',
    definicion:
      'Se comporta como una princesa (hime) consentida que exige tratamiento real, pero ablanda con la persona adecuada.',
    categoria: 'Tropos',
  },
  {
    termino: 'Shounen',
    kanji: '少年',
    definicion:
      'Demografía masculina adolescente. Acción, amistad, superación, peleas. Los animes más comerciales suelen entrar aquí.',
    categoria: 'Demografías',
    ejemplo: 'Naruto · One Piece · Demon Slayer',
  },
  {
    termino: 'Seinen',
    kanji: '青年',
    definicion:
      'Demografía adulta masculina. Temas más maduros, violencia gráfica permitida, complejidad psicológica.',
    categoria: 'Demografías',
    ejemplo: 'Berserk · Vinland Saga · Vagabond',
  },
  {
    termino: 'Shoujo',
    kanji: '少女',
    definicion:
      'Demografía femenina adolescente. Romance, drama emocional, relaciones interpersonales como eje central.',
    categoria: 'Demografías',
    ejemplo: 'Fruits Basket · Sailor Moon',
  },
  {
    termino: 'Josei',
    kanji: '女性',
    definicion:
      'Demografía adulta femenina. Romances realistas, dinámicas de trabajo, vida diaria sin idealización.',
    categoria: 'Demografías',
    ejemplo: 'Nana · Honey and Clover',
  },
  {
    termino: 'Isekai',
    kanji: '異世界',
    definicion:
      'Subgénero donde el protagonista es transportado o reencarnado a otro mundo. Boom de los 2010s con cientos de adaptaciones.',
    categoria: 'Géneros',
    ejemplo: 'Re:Zero · Mushoku Tensei · KonoSuba',
  },
  {
    termino: 'Mecha',
    kanji: 'メカ',
    definicion:
      'Robots gigantes pilotados por humanos como elemento central. Pueden ser super-mecha (poder mítico) o real-mecha (verosímiles).',
    categoria: 'Géneros',
    ejemplo: 'Gundam · Evangelion · Code Geass',
  },
  {
    termino: 'Slice of life',
    kanji: '日常',
    definicion:
      'Cotidianidad sin estructura narrativa fuerte. La gracia está en los pequeños momentos del día a día.',
    categoria: 'Géneros',
    ejemplo: 'K-On! · Yuru Camp · Aria',
  },
  {
    termino: 'Harem',
    kanji: 'ハーレム',
    definicion:
      'Un protagonista (usualmente masculino) rodeado de varios intereses románticos. Reverse harem invierte los géneros.',
    categoria: 'Géneros',
  },
  {
    termino: 'Mahou shoujo',
    kanji: '魔法少女',
    definicion:
      'Niñas o adolescentes con poderes mágicos, normalmente combatiendo el mal. Sailor Moon es el pilar fundacional.',
    categoria: 'Géneros',
    ejemplo: 'Sailor Moon · Madoka Magica · Card Captor Sakura',
  },
  {
    termino: 'Sports anime',
    kanji: 'スポーツ',
    definicion:
      'Centrado en un deporte concreto. Estructura de torneos + dinámica de equipo + crecimiento personal.',
    categoria: 'Géneros',
    ejemplo: 'Haikyuu!! · Kuroko no Basket · Slam Dunk',
  },
  {
    termino: 'Sentai',
    kanji: '戦隊',
    definicion:
      'Equipo de héroes con uniformes coloreados luchando contra un mal organizado. Origen en live-action (Super Sentai → Power Rangers).',
    categoria: 'Géneros',
  },
  {
    termino: 'Senpai / Kouhai',
    kanji: '先輩 / 後輩',
    definicion:
      'Relación jerárquica de estudiante mayor (senpai) y menor (kouhai). Carga cultural fuerte en escuela y trabajo japonés. "Notice me senpai" es meme global.',
    categoria: 'Cultura',
  },
  {
    termino: 'Bakugeisha',
    kanji: '爆芸者',
    definicion:
      'Personaje que combina belleza estética con destrucción explosiva. No es término oficial pero se usa en círculos fans para Mahou Shoujo Madoka-style.',
    categoria: 'Cultura',
  },
  {
    termino: 'OP / ED',
    definicion:
      'Opening (OP) y ending (ED): canciones de apertura y cierre de cada episodio. Cambian cada arco/temporada. Los OPs icónicos son objeto de culto.',
    categoria: 'Producción',
  },
  {
    termino: 'Filler',
    definicion:
      'Episodios no canónicos al manga original, añadidos para evitar alcanzar la fuente. Tendencia a ser baja calidad — los fans suelen saltarlos.',
    categoria: 'Producción',
  },
  {
    termino: 'OVA / ONA',
    definicion:
      'Original Video Animation (lanzamiento directo a vídeo) / Original Net Animation (directo a streaming). Suelen ser side stories canónicas.',
    categoria: 'Producción',
  },
  {
    termino: 'Sakuga',
    kanji: '作画',
    definicion:
      'Animación especialmente fluida o detallada en una escena clave. Los fans coleccionan "sakuga moments" en compilaciones.',
    categoria: 'Producción',
  },
  {
    termino: 'Seiyuu',
    kanji: '声優',
    definicion:
      'Actor/actriz de voz. En Japón es una profesión codiciada con sus propias estrellas, conciertos y eventos. Algunos personajes son indisociables de su seiyuu.',
    categoria: 'Producción',
  },
  {
    termino: 'Ecchi',
    kanji: 'エッチ',
    definicion:
      'Contenido picante implícito o explícito (sin llegar a hentai). Fan service, panchira, situaciones embarazosas. Categoría amplia.',
    categoria: 'Géneros',
  },
  {
    termino: 'Moe',
    kanji: '萌え',
    definicion:
      'Sensación de afecto protector hacia un personaje (típicamente femenino, infantil o ingenuo). Estética con ojos grandes y proporciones exageradas.',
    categoria: 'Cultura',
  },
  {
    termino: 'Otaku',
    kanji: 'オタク',
    definicion:
      'Aficionado obsesivo a algo (originalmente cualquier hobby, hoy asociado a anime/manga/videojuegos). En Japón con tinte despectivo; en occidente reapropiado positivamente.',
    categoria: 'Cultura',
  },
  {
    termino: 'Weeb / Weeaboo',
    definicion:
      'Aficionado occidental al anime que adopta excesos del fandom (palabras japonesas mal usadas, idealización de Japón). Origen 4chan, hoy peyorativo aceptado con humor.',
    categoria: 'Cultura',
  },
  {
    termino: 'Tier list',
    definicion:
      'Ranking visual donde personajes/animes se clasifican en S-A-B-C-D-F. Origen Smash Bros, adoptado masivamente por el fandom anime.',
    categoria: 'Cultura',
  },
  {
    termino: 'Best girl / Best boy',
    definicion:
      'Personaje favorito del show. AnimeShowdown convierte esa pregunta en rankings ELO con voto comunitario.',
    categoria: 'Cultura',
  },
  {
    termino: 'Power scaling',
    definicion:
      'Comparación cuasi-científica del poder relativo entre personajes (típicamente de distintos animes). Discusión típica de cualquier foro: "¿gana Goku o Saitama?". AnimeShowdown lo resuelve por votación.',
    categoria: 'Cultura',
  },
]

const CATEGORIAS = [...new Set(TERMINOS.map((t) => t.categoria))]
const QUIZ_STORAGE_KEY = 'animeshowdown.glossary.quiz.sessions'

const QUIZ_POOL = [
  { pregunta: '¿Qué personaje es tsundere?', respuesta: 'Asuka Langley', opciones: ['Asuka Langley', 'Goku', 'Saber', 'Luffy'] },
  { pregunta: '¿Qué personaje es yandere?', respuesta: 'Yuno Gasai', opciones: ['Yuno Gasai', 'Kakashi', 'Frieren', 'Sanji'] },
  { pregunta: '¿Qué personaje encaja mejor con kuudere?', respuesta: 'Rei Ayanami', opciones: ['Rei Ayanami', 'Naruto', 'Asta', 'Brook'] },
  { pregunta: '¿Qué anime es un isekai?', respuesta: 'Re:Zero', opciones: ['Re:Zero', 'Death Note', 'Haikyuu', 'Cowboy Bebop'] },
  { pregunta: '¿Qué término habla de animación especialmente brillante?', respuesta: 'Sakuga', opciones: ['Sakuga', 'Seiyuu', 'Mecha', 'Moe'] },
  { pregunta: '¿Cómo se llama el actor de voz japonés?', respuesta: 'Seiyuu', opciones: ['Seiyuu', 'Shounen', 'Omake', 'Fanservice'] },
  { pregunta: '¿Qué demografía suele centrarse en acción, amistad y superación?', respuesta: 'Shounen', opciones: ['Shounen', 'Josei', 'Iyashikei', 'Harem'] },
  { pregunta: '¿Qué término describe robots gigantes pilotados?', respuesta: 'Mecha', opciones: ['Mecha', 'Slice of life', 'Tsundere', 'Omake'] },
  { pregunta: '¿Qué significa “best girl / best boy” en fandom?', respuesta: 'Personaje favorito', opciones: ['Personaje favorito', 'Villano final', 'Opening musical', 'Estudio de animación'] },
  { pregunta: '¿Qué formato clasifica personajes en S-A-B-C-D?', respuesta: 'Tier list', opciones: ['Tier list', 'OVA', 'AMV', 'Seinen'] },
  { pregunta: '¿Qué término describe episodios cotidianos y tranquilos?', respuesta: 'Slice of life', opciones: ['Slice of life', 'Battle shounen', 'Power scaling', 'Yandere'] },
  { pregunta: '¿Qué término compara poder entre personajes?', respuesta: 'Power scaling', opciones: ['Power scaling', 'Moe', 'Dandere', 'Omake'] },
]

function slugTermino(termino) {
  return normalizar(termino)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function shuffle(items) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function GlossaryPage() {
  useSeo({
    title: 'Glosario otaku',
    description:
      'Diccionario de términos anime: tsundere, yandere, isekai, mecha, sakuga, seiyuu, moe y 25 más. Definiciones curadas en español con ejemplos.',
  })

  const [filtro, setFiltro] = useState('')
  const [categoria, setCategoria] = useState(null)
  const deferredFiltro = useDeferredValue(filtro)
  const { user } = useAuth()
  const [quiz, setQuiz] = useState([])
  const [answers, setAnswers] = useState({})
  const [quizResult, setQuizResult] = useState(null)

  const visibles = useMemo(() => {
    const q = normalizar(deferredFiltro)
    return TERMINOS.filter((t) => {
      if (categoria && t.categoria !== categoria) return false
      if (!q) return true
      return (
        normalizar(t.termino).includes(q) ||
        normalizar(t.definicion).includes(q) ||
        (t.kanji && t.kanji.includes(deferredFiltro))
      )
    })
  }, [deferredFiltro, categoria])

  const startQuiz = () => {
    const questions = shuffle(QUIZ_POOL)
      .slice(0, 10)
      .map((q) => ({ ...q, opciones: shuffle(q.opciones) }))
    setQuiz(questions)
    setAnswers({})
    setQuizResult(null)
  }

  const finishQuiz = async () => {
    if (quizResult) return
    const score = quiz.reduce(
      (acc, q, index) => acc + (answers[index] === q.respuesta ? 1 : 0),
      0,
    )
    const sessions = Number(localStorage.getItem(QUIZ_STORAGE_KEY) || '0') + 1
    localStorage.setItem(QUIZ_STORAGE_KEY, String(sessions))
    setQuizResult({ score, sessions })
    if (sessions >= 3) {
      if (user) {
        try {
          await endpoints.desbloquearOtakuCertificado()
          toast.success('Logro desbloqueado', { description: 'Otaku certificado' })
        } catch {
          toast.info('Test completado', {
            description: 'El logro se guardará cuando tu sesión esté disponible.',
          })
        }
      } else {
        toast.success('Otaku certificado listo', {
          description: 'Inicia sesión para guardarlo en tu perfil.',
        })
      }
    }
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="defined-terms"
        schema={definedTermSetSchema(
          TERMINOS.map((t) => ({
            termino: t.termino,
            definicion: t.definicion,
          })),
          'Glosario otaku — AnimeShowdown',
        )}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Glosario', path: '/glossary' },
        ])}
      />
      <div className="mx-auto max-w-4xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-fg-muted">
            <BookOpen className="h-3 w-3" />
            <span lang="ja">用語集</span> · Glosario
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Términos otaku
          </h1>
          <p className="max-w-2xl text-fg-muted">
            {TERMINOS.length} palabras imprescindibles para hablar de anime sin
            sonar a turista. De tropos clásicos (tsundere, yandere) a géneros
            (isekai, mecha) y jerga de producción (sakuga, seiyuu).
          </p>
        </motion.header>

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5">
            <Search className="h-4 w-4 text-fg-muted" />
            <input
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar glosario"
              placeholder="Filtra por palabra o definición…"
              className="flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                categoria === null
                  ? 'bg-accent text-white'
                  : 'border border-border bg-surface text-fg-muted hover:text-fg-strong'
              }`}
            >
              Todas ({TERMINOS.length})
            </button>
            {CATEGORIAS.map((c) => {
              const n = TERMINOS.filter((t) => t.categoria === c).length
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    categoria === c
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-fg-muted hover:text-fg-strong'
                  }`}
                >
                  {c} ({n})
                </button>
              )
            })}
          </div>
        </div>

        {visibles.length === 0 ? (
          <EmptyState scene
            icon={BookOpen}
            title={`Sin términos para "${filtro}"`}
            action={{ to: '/glossary', label: 'Limpiar búsqueda' }}
          >
            Prueba con otra palabra o limpia el filtro para ver el glosario
            completo.
          </EmptyState>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibles.map((t) => {
              const tag = slugTermino(t.termino)
              const tienePersonajes = hasCategoriaPersonaje(tag)
              return (
                <div
                  key={t.termino}
                  id={`term-${tag}`}
                  itemScope
                  itemType="https://schema.org/DefinedTerm"
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <dt className="mb-2 flex items-baseline justify-between gap-2">
                    <span itemProp="name" className="text-lg font-bold text-fg-strong">
                      {t.termino}
                    </span>
                    {t.kanji && (
                      <span lang="ja" className="font-jp text-[15px] text-gold">
                        {t.kanji}
                      </span>
                    )}
                  </dt>
                  <dd
                    itemProp="description"
                    className="text-[13px] leading-relaxed text-fg-muted"
                  >
                    {t.definicion}
                  </dd>
                  {t.ejemplo && (
                    <dd className="mt-3 text-[11px] font-semibold text-fg-muted/80">
                      Ej.: <span className="font-normal normal-case">{t.ejemplo}</span>
                    </dd>
                  )}
                  <dd className="mt-3 flex flex-col items-start gap-3">
                    <span className="inline-flex rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
                      {t.categoria}
                    </span>
                    {tienePersonajes && (
                      <Link
                        to={`/personajes?tag=${tag}`}
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold underline decoration-gold/60 underline-offset-2 transition-colors hover:text-fg-strong"
                      >
                        Ver personajes relacionados
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}

        <section className="mt-10 rounded-xl border border-gold/30 bg-gold/10 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-fg-strong">
                Test rápido — 10 preguntas
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                Repasa tropos, demografías y jerga. Tras tres sesiones
                completadas desbloqueas el logro Otaku certificado.
              </p>
            </div>
            <button
              type="button"
              onClick={startQuiz}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-white"
            >
              {quiz.length > 0 ? 'Reiniciar test' : 'Empezar test'}
            </button>
          </div>

          {quiz.length > 0 && (
            <div className="mt-5 space-y-4">
              {quiz.map((q, index) => (
                <fieldset
                  key={`${q.pregunta}-${index}`}
                  className="rounded-lg border border-border bg-bg/60 p-4"
                >
                  <legend className="px-1 text-sm font-bold text-fg-strong">
                    {index + 1}. {q.pregunta}
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.opciones.map((option) => (
                      <label
                        key={option}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                          answers[index] === option
                            ? 'border-gold/60 bg-gold/15 text-gold'
                            : 'border-border bg-surface text-fg-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`quiz-${index}`}
                          value={option}
                          checked={answers[index] === option}
                          onChange={() => setAnswers((prev) => ({ ...prev, [index]: option }))}
                          className="sr-only"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={finishQuiz}
                disabled={Object.keys(answers).length < quiz.length || Boolean(quizResult)}
                className="rounded-lg bg-gold px-5 py-3 text-sm font-black text-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ver resultado
              </button>
              {quizResult && (
                <p className="rounded-lg border border-border bg-surface p-4 text-sm font-bold text-fg-strong">
                  Resultado: {quizResult.score}/10 · sesiones completadas:{' '}
                  {quizResult.sessions}
                  {quizResult.sessions >= 3 && ' · Otaku certificado activado'}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-sm font-semibold text-fg-muted">
            Sigue explorando
          </h2>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            ¿Quieres ver ejemplos de estos tropos? Mira{' '}
            <Link to="/personajes" className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong">
              el catálogo completo
            </Link>{' '}
            con más de 1.000 personajes anime, o{' '}
            <Link to="/ranking" className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong">
              el ranking ELO
            </Link>{' '}
            para ver quién manda hoy. Si echas en falta algún término en este
            glosario,{' '}
            <a
              href="https://github.com/diegoalegil/AnimeShowdown/issues"
              target="_blank"
              rel="noreferrer"
              className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong"
            >
              abre un issue
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  )
}

export default GlossaryPage
