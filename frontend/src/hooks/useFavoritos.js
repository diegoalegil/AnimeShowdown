import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints, ApiError } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hooks de "Mi roster / favoritos".
 *
 * <p>Diseño:
 * <ul>
 *   <li>useMisFavoritos: lista completa del roster del user logueado.
 *       Disabled si no hay user (evita 403 ruidoso en consola).</li>
 *   <li>useEstadoFavorito(slug): bool "¿lo sigo?" — para el botón Heart
 *       en la ficha. Lo separamos del listado completo para no forzar
 *       a cargar todo el roster solo para pintar un corazón. Disabled
 *       si no hay user (botón renderiza como "necesitas login").</li>
 *   <li>useToggleFavorito(slug): mutation con optimistic update. El
 *       caller no decide POST vs DELETE — el hook calcula a partir del
 *       estado actual del cache.</li>
 * </ul>
 */
export function useMisFavoritos() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.misFavoritos(),
    queryFn: endpoints.misFavoritos,
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}

export function useEstadoFavorito(slug) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.favoritoSlug(slug),
    queryFn: () => endpoints.estadoFavoritoPersonaje(slug),
    enabled: Boolean(user && slug),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) =>
      !(err instanceof ApiError && [403, 404].includes(err.status)) && count < 1,
  })
}

/**
 * Mutation toggle con optimistic update. Devuelve un objeto con:
 *   - toggle(): dispara la mutation calculando POST/DELETE según estado.
 *   - isPending: bool para deshabilitar el botón mientras va la req.
 *   - isFollowing: estado optimista actual (true/false/null si no
 *     sabemos todavía).
 */
export function useToggleFavorito(slug) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const estadoQ = useEstadoFavorito(slug)
  const isFollowing = estadoQ.data?.following ?? null

  const mutation = useMutation({
    mutationFn: async (siguiendoActual) => {
      // siguiendoActual es lo que el usuario ve EN ESTE MOMENTO. Si
      // estaba siguiendo, la acción es dejar de seguir, y viceversa.
      if (siguiendoActual) {
        return endpoints.dejarDeSeguirPersonaje(slug)
      }
      return endpoints.seguirPersonaje(slug)
    },
    onMutate: async (siguiendoActual) => {
      // Cancelamos refetches en vuelo para que la optimistic no se
      // sobrescriba al instante con datos viejos.
      await queryClient.cancelQueries({ queryKey: queryKeys.favoritoSlug(slug) })
      await queryClient.cancelQueries({ queryKey: queryKeys.misFavoritos() })
      const prevEstado = queryClient.getQueryData(queryKeys.favoritoSlug(slug))
      const prevLista = queryClient.getQueryData(queryKeys.misFavoritos())

      queryClient.setQueryData(queryKeys.favoritoSlug(slug), {
        following: !siguiendoActual,
      })

      // Actualizamos la lista optimistically para que el roster en
      // /perfil refleje el cambio sin esperar al refetch.
      if (Array.isArray(prevLista)) {
        if (siguiendoActual) {
          queryClient.setQueryData(
            queryKeys.misFavoritos(),
            prevLista.filter((f) => f.slug !== slug),
          )
        } else {
          // No tenemos el resto del PersonajeMini aquí (anime, imagen)
          // — confiamos en el refetch para llenar. Mientras, ponemos
          // un placeholder mínimo para que el contador suba ya.
          queryClient.setQueryData(
            queryKeys.misFavoritos(),
            [
              { slug, nombre: slug, anime: '', imagenUrl: null, seguidoEn: new Date().toISOString() },
              ...prevLista,
            ],
          )
        }
      }
      return { prevEstado, prevLista }
    },
    onError: (_err, _vars, ctx) => {
      // Rollback si la mutation falló.
      if (ctx?.prevEstado !== undefined) {
        queryClient.setQueryData(queryKeys.favoritoSlug(slug), ctx.prevEstado)
      }
      if (ctx?.prevLista !== undefined) {
        queryClient.setQueryData(queryKeys.misFavoritos(), ctx.prevLista)
      }
    },
    onSettled: () => {
      // Refetch lista para reemplazar el placeholder con datos reales.
      queryClient.invalidateQueries({ queryKey: queryKeys.misFavoritos() })
      queryClient.invalidateQueries({ queryKey: queryKeys.favoritoSlug(slug) })
    },
  })

  return {
    isFollowing,
    isPending: mutation.isPending,
    isReady: Boolean(user) && !estadoQ.isLoading,
    isError: estadoQ.isError || mutation.isError,
    // opciones opcionales {onSuccess, onError} para feedback ligado al resultado
    // real (el caller muestra el toast tras confirmar, no de forma optimista).
    toggle: (opciones) => mutation.mutate(Boolean(isFollowing), opciones),
  }
}
