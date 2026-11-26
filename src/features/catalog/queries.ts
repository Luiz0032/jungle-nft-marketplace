import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { NftListQuery } from '@/contracts'
import { queryKeys } from '@/lib/query-keys'
import { fetchFacets, fetchNfts } from './api'

export const nftListQuery = (query: NftListQuery) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => fetchNfts(query, signal),
    // Mantém a página anterior na tela enquanto a nova carrega (refetch em background, sem pular layout).
    placeholderData: keepPreviousData,
  })

export const facetsQuery = () =>
  queryOptions({
    queryKey: queryKeys.catalogFacets(),
    queryFn: ({ signal }) => fetchFacets(signal),
    staleTime: 5 * 60_000,
  })
