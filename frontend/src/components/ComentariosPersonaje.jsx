import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, MessageSquare, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, endpoints } from '../lib/api'

const PAGE_SIZE = 10

function ComentariosPersonaje({ slug, nombre }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [contenido, setContenido] = useState('')
  const sentinelRef = useRef(null)

  const comentariosQuery = useInfiniteQuery({
    queryKey: ['comentarios', 'personaje', slug],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      endpoints.comentariosPersonaje(slug, { page: pageParam, size: PAGE_SIZE }),
    getNextPageParam: (lastPage) =>
      lastPage?.last ? undefined : (lastPage?.number ?? 0) + 1,
    staleTime: 20_000,
  })

  const comentarios = useMemo(
    () => comentariosQuery.data?.pages.flatMap((page) => page?.content ?? []) ?? [],
    [comentariosQuery.data],
  )

  const crearComentario = useMutation({
    mutationFn: (texto) => endpoints.crearComentarioPersonaje(slug, texto),
    onSuccess: (comentario) => {
      setContenido('')
      qc.invalidateQueries({ queryKey: ['comentarios', 'personaje', slug] })
      if (comentario.estado === 'PENDIENTE_REVISION') {
        toast.message('Comentario enviado a revisión')
      } else {
        toast.success('Comentario publicado')
      }
    },
    onError: (err) => {
      toast.error('No se pudo publicar', {
        description: describeApiError(err),
      })
    },
  })

  const reportarComentario = useMutation({
    mutationFn: endpoints.reportarComentario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comentarios', 'personaje', slug] })
      toast.success('Comentario reportado')
    },
    onError: (err) => {
      toast.error('No se pudo reportar', {
        description: describeApiError(err),
      })
    },
  })

  const eliminarComentario = useMutation({
    mutationFn: endpoints.eliminarComentario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comentarios', 'personaje', slug] })
      toast.success('Comentario eliminado')
    },
    onError: (err) => {
      toast.error('No se pudo eliminar', {
        description: describeApiError(err),
      })
    },
  })

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !comentariosQuery.hasNextPage) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !comentariosQuery.isFetchingNextPage) {
          comentariosQuery.fetchNextPage()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [comentariosQuery])

  const handleSubmit = (event) => {
    event.preventDefault()
    const texto = contenido.trim()
    if (!user) {
      toast.message('Inicia sesión para comentar')
      return
    }
    if (texto.length < 2) {
      toast.error('Escribe un comentario un poco más largo')
      return
    }
    crearComentario.mutate(texto)
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
            <MessageSquare className="h-3.5 w-3.5" />
            Comunidad
          </span>
          <h2 className="mt-1 text-xl font-bold text-fg-strong">
            Comentarios sobre {nombre}
          </h2>
        </div>
        {comentariosQuery.data?.pages?.[0]?.totalElements != null && (
          <span className="rounded-full border border-border bg-bg px-3 py-1 text-[12px] text-fg-muted">
            {comentariosQuery.data.pages[0].totalElements} visibles
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-border bg-bg p-3">
        <textarea
          value={contenido}
          onChange={(event) => setContenido(event.target.value.slice(0, 1000))}
          rows={3}
          placeholder={user ? 'Suma tu lectura del personaje...' : 'Entra para comentar en esta ficha'}
          disabled={!user || crearComentario.isPending}
          className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-fg-muted">
            {contenido.length}/1000
          </span>
          {user ? (
            <button
              type="submit"
              disabled={crearComentario.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {crearComentario.isPending ? 'Enviando...' : 'Publicar'}
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Entrar
            </Link>
          )}
        </div>
      </form>

      {comentariosQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : comentarios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg/60 p-6 text-center text-sm text-fg-muted">
          Todavía no hay comentarios visibles.
        </div>
      ) : (
        <div className="grid gap-3">
          {comentarios.map((comentario) => (
            <article
              key={comentario.id}
              className="rounded-lg border border-border bg-bg p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg-strong">
                    {comentario.autor?.username ?? 'Usuario'}
                  </p>
                  <p className="text-[11px] text-fg-muted">
                    {formatFecha(comentario.creadoEn)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {!comentario.mio && user && (
                    <button
                      type="button"
                      onClick={() => reportarComentario.mutate(comentario.id)}
                      disabled={reportarComentario.isPending}
                      aria-label="Reportar comentario"
                      title="Reportar comentario"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:border-warning/60 hover:text-warning disabled:opacity-60"
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                  )}
                  {comentario.mio && (
                    <button
                      type="button"
                      onClick={() => eliminarComentario.mutate(comentario.id)}
                      disabled={eliminarComentario.isPending}
                      aria-label="Eliminar comentario"
                      title="Eliminar comentario"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
                {comentario.contenido}
              </p>
            </article>
          ))}
          <div ref={sentinelRef} className="h-3" />
          {comentariosQuery.isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function formatFecha(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function describeApiError(err) {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Has llegado al límite de 5 comentarios por hora.'
    return err.message || `Error ${err.status}`
  }
  return 'Revisa la conexión e inténtalo de nuevo.'
}

export default ComentariosPersonaje
