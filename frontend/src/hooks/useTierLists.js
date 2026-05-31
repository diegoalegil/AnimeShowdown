import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { endpoints } from '../lib/api'
import { queryKeys } from '../lib/queryClient'

export function useMisTierLists() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.tierListsMine(),
    queryFn: endpoints.tierListsMine,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
}

export function useTierListPublic(slug) {
  return useQuery({
    queryKey: queryKeys.tierListPublic(slug),
    queryFn: () => endpoints.tierListPublic(slug),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  })
}

export function useCrearTierList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.tierListCreate,
    onSuccess: (tierList) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierListsMine() })
      if (tierList?.slug) {
        queryClient.setQueryData(queryKeys.tierListPublic(tierList.slug), tierList)
      }
    },
  })
}

export function useActualizarTierList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => endpoints.tierListUpdate(id, data),
    onSuccess: (tierList) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierListsMine() })
      if (tierList?.slug) {
        queryClient.setQueryData(queryKeys.tierListPublic(tierList.slug), tierList)
      }
    },
  })
}

export function useEliminarTierList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: endpoints.tierListDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierListsMine() })
    },
  })
}
