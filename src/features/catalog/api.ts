import { CatalogFacetsSchema, NftPageSchema, type NftListQuery } from '@/contracts'
import { request } from '@/lib/http'

/** `signal` do TanStack Query: busca obsoleta é abortada quando a chave muda (respostas fora de ordem). */
export const fetchNfts = (params: NftListQuery, signal?: AbortSignal) =>
  request(NftPageSchema, { url: '/nfts', params, signal })

export const fetchFacets = (signal?: AbortSignal) => request(CatalogFacetsSchema, { url: '/catalog/facets', signal })
