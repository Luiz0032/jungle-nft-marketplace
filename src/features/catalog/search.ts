import { z } from 'zod'
import {
  CategorySlugSchema,
  EthSchema,
  NftHighlightSchema,
  NftSortSchema,
  type NftListQuery,
  type NftSort,
} from '@/contracts'

/**
 * Search params da Home (`validateSearch`). Tudo opcional: valor padrão não vai para a URL.
 * Valor inválido na URL cai para o padrão em vez de quebrar a página (`.catch`).
 */
export const CatalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.array(CategorySlugSchema).optional().catch(undefined),
  collection: z.array(z.string().min(1)).optional().catch(undefined),
  minPrice: EthSchema.optional().catch(undefined),
  maxPrice: EthSchema.optional().catch(undefined),
  highlight: NftHighlightSchema.optional().catch(undefined),
  sort: NftSortSchema.optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof CatalogSearchSchema>

export const DEFAULT_SORT: NftSort = 'newest'
/** Grade do Figma: 3 × 3 no desktop. */
export const CATALOG_PAGE_SIZE = 9

/** Converte a URL na query da API (com padrões explícitos: chave de cache estável). */
export function toListQuery(search: CatalogSearch): NftListQuery {
  return {
    q: search.q || undefined,
    category: search.category ?? [],
    collection: search.collection ?? [],
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    highlight: search.highlight,
    sort: search.sort ?? DEFAULT_SORT,
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

/** Remove chaves vazias/padrão para a URL ficar limpa (`[]`, `''`, sort padrão, página 1). */
export function cleanSearch(search: CatalogSearch): CatalogSearch {
  const out: CatalogSearch = {}
  if (search.q) out.q = search.q
  if (search.category?.length) out.category = search.category
  if (search.collection?.length) out.collection = search.collection
  if (search.minPrice) out.minPrice = search.minPrice
  if (search.maxPrice) out.maxPrice = search.maxPrice
  if (search.highlight) out.highlight = search.highlight
  if (search.sort && search.sort !== DEFAULT_SORT) out.sort = search.sort
  if (search.page && search.page > 1) out.page = search.page
  return out
}

/** Qualquer mudança de filtro/busca/ordem volta para a página 1. */
export function withFilters(prev: CatalogSearch, patch: Partial<CatalogSearch>): CatalogSearch {
  return cleanSearch({ ...prev, ...patch, page: undefined })
}

export const hasActiveFilters = (s: CatalogSearch) =>
  Boolean(s.q || s.category?.length || s.collection?.length || s.minPrice || s.maxPrice || s.highlight)

/** Patch que remove todo filtro/busca (mantém a ordenação). */
export const CLEAR_FILTERS: Partial<CatalogSearch> = {
  q: undefined,
  category: undefined,
  collection: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  highlight: undefined,
}
