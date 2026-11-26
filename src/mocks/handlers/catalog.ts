import { HttpResponse } from 'msw'
import {
  NftListQuerySchema,
  type CatalogFacets,
  type NftDetail,
  type NftSummary,
  type Page,
} from '@/contracts'
import { compare } from '@/lib/money'
import { db } from '@/mocks/db'
import { CATEGORIES, COLLECTIONS } from '@/mocks/fixtures/catalog'
import { getScenario } from '@/mocks/scenarios'
import { byPrice, findNft, toDetail, toSummary } from './domain'
import { fail, parse, route } from './utils'

const optional = (v: string | null) => (v === null || v.trim() === '' ? undefined : v)

export const catalogHandlers = [
  route('get', '/catalog/facets', () =>
    HttpResponse.json<CatalogFacets>({
      collections: COLLECTIONS.map(({ slug, name }) => ({ slug, name })),
      categories: CATEGORIES,
    }),
  ),

  route('get', '/nfts', ({ url }) => {
    const sp = url.searchParams
    const query = parse(NftListQuerySchema, {
      q: optional(sp.get('q')),
      collection: sp.getAll('collection'),
      category: sp.getAll('category'),
      minPrice: optional(sp.get('minPrice')),
      maxPrice: optional(sp.get('maxPrice')),
      sort: optional(sp.get('sort')),
      page: optional(sp.get('page')),
      pageSize: optional(sp.get('pageSize')),
    })

    const nfts = getScenario() === 'empty' ? [] : db().nfts
    const q = query.q?.toLowerCase()
    const pop = new Map(nfts.map((n) => [n.id, n.popularity]))
    const created = new Map(nfts.map((n) => [n.id, n.createdAt]))

    let items: NftSummary[] = nfts
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.collection.name.toLowerCase().includes(q))
      .filter((n) => query.collection.length === 0 || query.collection.includes(n.collection.slug))
      .filter((n) => query.category.length === 0 || query.category.includes(n.category))
      .map(toSummary)
      .filter((n) => query.minPrice === undefined || compare(n.price, query.minPrice) >= 0)
      .filter((n) => query.maxPrice === undefined || compare(n.price, query.maxPrice) <= 0)

    const tie = (a: NftSummary, b: NftSummary) => a.id.localeCompare(b.id)
    switch (query.sort) {
      case 'price_asc':
        items = items.sort((a, b) => byPrice(1)(a, b) || tie(a, b))
        break
      case 'price_desc':
        items = items.sort((a, b) => byPrice(-1)(a, b) || tie(a, b))
        break
      case 'popular':
        items = items.sort((a, b) => pop.get(b.id)! - pop.get(a.id)! || tie(a, b))
        break
      case 'newest':
        items = items.sort((a, b) => created.get(b.id)!.localeCompare(created.get(a.id)!) || tie(a, b))
        break
    }

    const total = items.length
    const start = (query.page - 1) * query.pageSize
    return HttpResponse.json<Page<NftSummary>>({
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    })
  }),

  route('get', '/nfts/:id', ({ params }) => {
    const nft = findNft(params.id ?? '')
    if (!nft) fail('NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<NftDetail>(toDetail(nft))
  }),
]
