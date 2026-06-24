import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { ApiError, endpoints } from '../lib/api'
import VoiceWall from './voiceWall/VoiceWall.jsx'

const PAGE_SIZE = 10
// Límite REAL de la API de comentarios (mismo tope que usa el backend y que
// ya aplicaba este componente). No es el 280 de muestra de la demo del muro.
const MAX_LENGTH = 1000

function ComentariosPersonaje({ slug, nombre }) {
  const { user } = useAuth()
  const { play } = useSound()
  const qc = useQueryClient()
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

  // Lista PLANA del server -> voces del muro. Sin reacciones ni respuestas
  // (el backend no las tiene): reactions y replies SIEMPRE vacíos. El
  // timeLabel se formatea aquí (nunca Date.now() en render).
  const voices = useMemo(
    () =>
      comentarios.map((c) => ({
        id: c.id,
        author: {
          id: c.autor?.id ?? null,
          name: c.autor?.username ?? 'Usuario',
          avatarUrl: c.autor?.avatarUrl ?? undefined,
        },
        timeLabel: formatFecha(c.creadoEn),
        text: c.contenido,
        reactions: [],
        replies: [],
      })),
    [comentarios],
  )

  const crearComentario = useMutation({
    mutationFn: (texto) => endpoints.crearComentarioPersonaje(slug, texto),
    onSuccess: (comentario) => {
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

  // El observer leía el objeto-query completo en deps → se recreaba en CADA
  // render (cada fetch/cambio de estado lo re-referencia). Ahora se recrea solo
  // cuando cambia hasNextPage; el callback lee el estado volátil (isFetching/
  // fetchNextPage) desde una ref siempre fresca.
  const queryRef = useRef(comentariosQuery)
  useEffect(() => {
    queryRef.current = comentariosQuery
  })
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !comentariosQuery.hasNextPage) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        const q = queryRef.current
        if (entry.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
          q.fetchNextPage()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [comentariosQuery.hasNextPage])

  // Publicar: conserva el flujo de moderación (toast.message en
  // PENDIENTE_REVISION, toast.success al publicar, toast.error al fallar) que
  // ya vive en la mutation. mutateAsync resuelve con el comentario (=> el muro
  // confirma la tira) o rechaza (=> el muro devuelve el texto INTACTO al
  // pincel). parentId siempre null: no hay respuestas anidadas.
  const handlePublish = useCallback(
    (text) => {
      const texto = text.trim()
      if (texto.length < 2) {
        toast.error('Escribe un comentario un poco más largo')
        // Rechaza para que el pincel conserve el texto sin publicarse.
        return Promise.reject(new Error('demasiado-corto'))
      }
      return crearComentario.mutateAsync(texto)
    },
    [crearComentario],
  )

  const handleReport = useCallback(
    (voiceId) => reportarComentario.mutateAsync(voiceId),
    [reportarComentario],
  )

  // Sonidos del muro vía useSound().play (respeta el mute global). Solo los
  // que existen en lib/sounds.js: playStamp NO existe -> el "asentamiento" usa
  // playSello (el golpe de sello real). playWhoosh/playClink/playClack reales.
  const sounds = useMemo(
    () => ({
      playWhoosh: () => play('playWhoosh'),
      playSello: () => play('playSello'),
      playClink: () => play('playClink'),
      playClack: () => play('playClack'),
    }),
    [play],
  )

  const currentUser = user
    ? {
        id: user.id,
        name: user.username,
        avatarUrl: user.avatarUrl ?? undefined,
      }
    : null

  const footer = (
    <>
      <div ref={sentinelRef} className="h-3" aria-hidden="true" />
      {comentariosQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : null}
      {comentariosQuery.isFetchingNextPage ? (
        <div className="flex justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : null}
    </>
  )

  return (
    <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
      <VoiceWall
        voices={voices}
        currentUser={currentUser}
        maxLength={MAX_LENGTH}
        dojoHref="/login"
        onPublish={handlePublish}
        onReport={handleReport}
        sounds={sounds}
        title={`Comentarios sobre ${nombre}`}
        footer={footer}
        pending={comentariosQuery.isLoading}
      />
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
