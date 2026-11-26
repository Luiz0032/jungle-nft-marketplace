import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Favorites } from '@/contracts'
import { useCurrentUser } from '@/features/auth/hooks'
import { notify } from '@/lib/notify'
import { queryKeys } from '@/lib/query-keys'
import { addFavorite, fetchFavorites, removeFavorite } from './api'

export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.favorites(userId),
    queryFn: ({ signal }) => fetchFavorites(signal),
  })

/**
 * Ids favoritados do usuário logado (vazio para convidado). `ready = false` enquanto a lista do usuário
 * não chegou: alternar antes disso partiria de um estado desconhecido.
 */
export function useFavoriteIds(): { ids: ReadonlySet<string>; ready: boolean } {
  const user = useCurrentUser()
  const query = useQuery({ ...favoritesQuery(user?.id ?? ''), enabled: Boolean(user) })
  return { ids: new Set(user ? (query.data?.nftIds ?? []) : []), ready: !user || query.data !== undefined }
}

type ToggleVars = { nftId: string; title: string; favorite: boolean }

/**
 * Favoritar/desfavoritar otimista: a UI muda na hora; falha → rollback do snapshot + toast/aria-live.
 * A chave inclui o userId (invariante 5); no fim sempre reconcilia com o servidor.
 */
export function useToggleFavorite() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ nftId, favorite }: ToggleVars) => (favorite ? addFavorite(nftId) : removeFavorite(nftId)),
    onMutate: async ({ nftId, favorite }) => {
      if (!user) return { key: null, previous: undefined }
      const key = queryKeys.favorites(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      queryClient.setQueryData<Favorites>(key, (old) => {
        const ids = (old?.nftIds ?? []).filter((id) => id !== nftId)
        return { nftIds: favorite ? [...ids, nftId] : ids }
      })
      return { key, previous }
    },
    onError: (_error, { title, favorite }, context) => {
      if (context?.key) {
        // Sem snapshot, `setQueryData(key, undefined)` não faria nada e o valor otimista ficaria: zera a query.
        if (context.previous) queryClient.setQueryData(context.key, context.previous)
        else void queryClient.resetQueries({ queryKey: context.key })
      }
      notify.error(
        favorite
          ? `Não foi possível favoritar ${title}. Tente de novo.`
          : `Não foi possível remover ${title} dos favoritos. Tente de novo.`,
      )
    },
    onSuccess: (_data, { title, favorite }) => {
      notify.success(favorite ? `${title} adicionado aos favoritos.` : `${title} removido dos favoritos.`)
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context?.key) void queryClient.invalidateQueries({ queryKey: context.key })
    },
  })
}
