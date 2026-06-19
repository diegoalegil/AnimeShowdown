import { useDeferredValue, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useController, useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Search,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { useCrearTorneoMio } from '../hooks/useTorneosCreados'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { ApiError } from '../lib/api'
import PersonajeImg from '../components/PersonajeImg'
import ScribeFieldRhf from '../components/scribe/ScribeFieldRhf'
import ScribeToggle from '../components/scribe/ScribeToggle'
import TournamentBannerForge from '../features/torneos/forge/TournamentBannerForge'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const TAMANOS = [8, 16]

/**
 * Creación de torneos por usuarios verificados.
 *
 * Flow:
 *   1. Radio explícito 8 o 16 personajes (decisión inicial; bloquea el
 *      contador para que la UI sepa cuántos esperar).
 *   2. Nombre + descripción opcional (react-hook-form).
 *   3. Grid de avatares con búsqueda local diferida para no pedir al
 *      backend en cada tecla.
 *   4. Submit con conversión slug → id usando el catálogo compacto antes de POST.
 *
 * Tras éxito redirige a /perfil — el torneo queda PENDIENTE y aparece
 * en la card "Mis torneos" con pill amarillo.
 */
function CrearTorneoPage() {
  useSeo({ title: 'Crea tu torneo', noindex: true })
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    personajes: catalogoPersonajes,
    isLoading: cargandoCatalogoPersonajes,
  } = usePersonajesCatalogo()

  const crearMutation = useCrearTorneoMio()

  const [tamano, setTamano] = useState(8)
  const [seleccionados, setSeleccionados] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ defaultValues: { nombre: '', descripcion: '', publico: true } })
  // Datos reales para el estandarte de la forja: el nombre se observa en
  // vivo, el organizador es el usuario logueado y la fecha es la de hoy.
  const nombreEnVivo = watch('nombre')
  // useState lazy en vez de useMemo([]): React puede descartar memos; el
  // inicializador lazy garantiza un único new Date() (convención de pureza del repo).
  const [hoy] = useState(() => new Date().toISOString().slice(0, 10))

  const slugToBackendId = useMemo(() => {
    const m = new Map()
    for (const p of catalogoPersonajes) {
      const id = Number(p.id)
      if (Number.isFinite(id)) m.set(p.slug, id)
    }
    return m
  }, [catalogoPersonajes])

  // Catálogo filtrado: trabajamos sobre el cliente-side porque trae
  // ids + imágenes y queremos render rápido sin llamar a /api/personajes
  // completo.
  const filtrados = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return catalogoPersonajes
    return catalogoPersonajes.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.anime.toLowerCase().includes(q),
    )
  }, [catalogoPersonajes, deferredQuery])

  if (!user) return <Navigate to="/login?next=/torneos/crear" replace />

  const toggleSeleccion = (slug) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else if (next.size < tamano) {
        next.add(slug)
      } else {
        // Cap: no permitir más allá del tamaño objetivo. Damos feedback.
        toast.info(`Ya tienes ${tamano} personajes elegidos`, {
          description: 'Quita uno para añadir otro.',
        })
      }
      return next
    })
  }

  const cambiarTamano = (nuevo) => {
    if (nuevo === tamano) return
    setTamano(nuevo)
    // Si reduces de 16 a 8 y tenías más de 8 elegidos, recortamos
    // los últimos para no dejar al user con un estado inválido.
    setSeleccionados((prev) => {
      if (prev.size <= nuevo) return prev
      const arr = Array.from(prev).slice(0, nuevo)
      return new Set(arr)
    })
  }

  const onSubmit = async (data) => {
    if (seleccionados.size !== tamano) {
      setError('root', {
        message: `Faltan personajes: tienes ${seleccionados.size}/${tamano}`,
      })
      return
    }
    // Mapeo slug → backend id. Si algún slug no está en la lista del
    // backend (catálogo cliente desincronizado), abortamos con error.
    const ids = []
    for (const slug of seleccionados) {
      const id = slugToBackendId.get(slug)
      if (!id) {
        setError('root', {
          message: `Personaje "${slug}" no está en el backend todavía.`,
        })
        return
      }
      ids.push(id)
    }
    try {
      await crearMutation.mutateAsync({
        nombre: data.nombre,
        descripcion: data.descripcion?.trim() || null,
        publico: data.publico !== false,
        participantesIds: ids,
      })
      toast.success('Torneo enviado a revisión', {
        description: 'Un admin lo revisará pronto. Te avisaremos.',
      })
      navigate('/perfil')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      setError('root', { message: msg })
      toast.error('No se pudo crear el torneo', { description: msg })
    }
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <Sparkles className="h-3 w-3" />
            Crea un torneo
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Tu torneo personalizado
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Elige el tamaño y los personajes. Tu torneo entrará en una cola
            de revisión; cuando un admin lo apruebe, se inicia en juego para
            que todos voten. El estandarte se teje con lo que escribes.
          </p>
        </motion.header>

        {/* Forja: formulario a la izquierda, estandarte en vivo a la derecha
            (sticky para acompañar al formulario largo). En móvil el cartel
            estático queda debajo del formulario. */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <CardTamano tamano={tamano} onCambio={cambiarTamano} />

          <CardDatos control={control} />

          <CardSeleccion
            tamano={tamano}
            seleccionados={seleccionados}
            onToggle={toggleSeleccion}
            query={query}
            onQuery={setQuery}
            filtrados={filtrados}
            cargandoBackend={cargandoCatalogoPersonajes}
          />

          {errors.root && (
            <p className="text-[13px] text-danger">{errors.root.message}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                crearMutation.isPending ||
                seleccionados.size !== tamano
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trophy className="h-4 w-4" />
              {crearMutation.isPending ? 'Enviando…' : 'Enviar a revisión'}
            </button>
            <Link
              to="/torneos"
              className="text-[13px] text-fg-muted transition-colors hover:text-gold"
            >
              Cancelar
            </Link>
          </div>
        </form>

        <div className="lg:sticky lg:top-24">
          <TournamentBannerForge
            nombre={nombreEnVivo}
            organizador={user?.username}
            fecha={hoy}
            bracketSize={tamano}
          />
        </div>
        </div>
      </div>
    </section>
  )
}

function CardTamano({ tamano, onCambio }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Tamaño del torneo</h2>
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">
        Elige cuántos personajes competirán en el bracket. 8 son 3 rondas; 16
        son 4 rondas.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg p-1">
        {TAMANOS.map((n) => {
          const activo = tamano === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onCambio(n)}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                activo
                  ? 'bg-accent text-bg'
                  : 'text-fg-muted hover:text-fg-strong'
              }`}
            >
              {n} personajes
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Datos del torneo con el kit del escriba: nombre y descripción son
 * ScribeField (label flotante, trazo de tinta, contador con tope duro por
 * atributo maxLength — las reglas de longitud máxima de RHF sobran) y el
 * checkbox de publicación pasa a ScribeToggle (role="switch" + clack).
 * La validación sigue en el padre vía rules: el kit solo pinta el error.
 */
function CardDatos({ control }) {
  const publico = useController({ name: 'publico', control })
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        <h2 className="text-lg font-bold text-fg-strong">Datos del torneo</h2>
      </div>
      <div className="flex flex-col gap-4">
        <ScribeFieldRhf
          control={control}
          name="nombre"
          rules={{
            required: 'El nombre es obligatorio',
            minLength: { value: 5, message: 'Mínimo 5 caracteres' },
          }}
          id="nombre"
          label="Nombre"
          maxLength={80}
          showCount
          hint="Ej. «Las mejores chicas de los 2010»"
        />
        <ScribeFieldRhf
          control={control}
          name="descripcion"
          id="descripcion"
          label="Descripción (opcional)"
          multiline
          rows={3}
          maxLength={500}
          showCount
          hint="Cuenta el concepto del torneo."
        />
        <div className="rounded-lg border border-border bg-bg/70 p-3">
          <ScribeToggle
            checked={Boolean(publico.field.value)}
            onChange={(next) => publico.field.onChange(next)}
            label="Publicar si el admin lo aprueba"
          />
          <p className="mt-1 text-[12px] text-fg-muted">
            Aparecerá en /torneos y cualquier cuenta podrá votar sus duelos.
          </p>
        </div>
      </div>
    </div>
  )
}

function CardSeleccion({
  tamano,
  seleccionados,
  onToggle,
  query,
  onQuery,
  filtrados,
  cargandoBackend,
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Participantes</h2>
        <span
          className={`ml-auto inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            seleccionados.size === tamano
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-border bg-bg text-fg-muted'
          }`}
        >
          {seleccionados.size} / {tamano}
        </span>
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">
        Pulsa los personajes que entrarán al torneo. Necesitas{' '}
        <strong className="font-semibold text-fg-strong">
          exactamente {tamano}
        </strong>
        .
      </p>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
        <Search className="h-4 w-4 text-fg-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Filtrar personajes para el torneo"
          placeholder="Filtra por nombre o anime…"
          className="flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none"
        />
      </div>
      {cargandoBackend && (
        <p className="mb-3 text-[11px] text-fg-muted">
          Cargando catálogo del backend…
        </p>
      )}
      <div className="scrollbar-hide grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
        {filtrados.map((p) => {
          const sel = seleccionados.has(p.slug)
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => onToggle(p.slug)}
              aria-pressed={sel}
              className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border p-2 text-center transition-all ${
                sel
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-bg hover:border-accent/40'
              }`}
            >
              <PersonajeImg
                slug={p.slug}
                src={p.imagenUrl ?? p.imagen}
                alt={p.nombre}
                loading="lazy"
                className="h-16 w-12 rounded-lg object-cover object-top"
              />
              <span className="line-clamp-1 text-[11px] font-semibold text-fg-strong">
                {p.nombre}
              </span>
              <span className="line-clamp-1 text-[10px] text-fg-muted">
                {p.anime}
              </span>
              {sel && (
                <CheckCircle2 className="absolute right-1 top-1 h-4 w-4 text-gold" />
              )}
            </button>
          )
        })}
        {filtrados.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[12px] text-fg-muted">
              No hay personajes que coincidan con "{query}".
            </p>
            {query && (
              <button
                type="button"
                onClick={() => onQuery('')}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-accent/50 hover:text-gold"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CrearTorneoPage
