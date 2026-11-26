import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createWallet, fetchWallets, updateWallet } from './api'

export const walletsQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => fetchWallets(signal),
  })

/**
 * Criar/editar carteira pode mudar a primária de outras: em vez de remendar o cache, refaz a lista
 * (a regra "exatamente uma primária" é do servidor). A mutation só resolve depois do refetch.
 */
function useWalletMutation<TInput>(userId: string, mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) }),
  })
}

export const useCreateWallet = (userId: string) => useWalletMutation(userId, createWallet)
export const useUpdateWallet = (userId: string) => useWalletMutation(userId, updateWallet)

export const NETWORK_LABEL = { ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base' } as const

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
