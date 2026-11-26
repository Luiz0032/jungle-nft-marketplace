import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchNft } from './api'

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => fetchNft(id, signal),
    staleTime: 30_000,
  })
