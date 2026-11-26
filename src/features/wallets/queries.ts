import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchWallets } from './api'

export const walletsQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => fetchWallets(signal),
  })

export const NETWORK_LABEL = { ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base' } as const

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
