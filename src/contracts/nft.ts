import { z } from 'zod'
import { EthSchema, IdSchema, pageSchema, StockSchema, VersionSchema } from './common'

export const CATEGORY_SLUGS = ['arte', 'games', 'musica', 'fotografia', 'colecionaveis'] as const
export const CategorySlugSchema = z.enum(CATEGORY_SLUGS)
export type CategorySlug = z.infer<typeof CategorySlugSchema>

export const CollectionRefSchema = z.object({ slug: z.string().min(1), name: z.string().min(1) })
export type CollectionRef = z.infer<typeof CollectionRefSchema>

export const EditionSchema = z.object({
  id: IdSchema,
  label: z.string(),
  price: EthSchema,
  available: StockSchema,
  version: VersionSchema,
})
export type Edition = z.infer<typeof EditionSchema>

export const NftSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  collection: CollectionRefSchema,
  category: CategorySlugSchema,
  image: z.string().min(1),
  /** Menor preço entre as edições disponíveis (ou entre todas, se esgotado). */
  price: EthSchema,
  /** Soma do estoque das edições. */
  available: StockSchema,
  version: VersionSchema,
})
export type NftSummary = z.infer<typeof NftSummarySchema>

export const CreatorSchema = z.object({ name: z.string(), address: z.string() })

export const NftDetailSchema = NftSummarySchema.extend({
  description: z.string(),
  images: z.array(z.string().min(1)).min(1),
  creator: CreatorSchema,
  editions: z.array(EditionSchema).min(1),
})
export type NftDetail = z.infer<typeof NftDetailSchema>

export const NFT_SORTS = ['newest', 'popular', 'price_asc', 'price_desc'] as const
export const NftSortSchema = z.enum(NFT_SORTS)
export type NftSort = z.infer<typeof NftSortSchema>

/** Abas do catálogo (Figma "Novos lançamentos" / "Em alta"): recortes, independentes da ordenação. */
export const NFT_HIGHLIGHTS = ['new', 'trending'] as const
export const NftHighlightSchema = z.enum(NFT_HIGHLIGHTS)
export type NftHighlight = z.infer<typeof NftHighlightSchema>
/** `new`: cunhados nos últimos N dias (relativo ao mais recente). `trending`: popularidade ≥ limiar. */
export const NEW_RELEASE_DAYS = 60
export const TRENDING_MIN_POPULARITY = 600

export const PAGE_SIZE_DEFAULT = 12
export const PAGE_SIZE_MAX = 48

/** Query de `GET /nfts`. Também serve de base para o `validateSearch` do catálogo. */
export const NftListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  collection: z.array(z.string().min(1)).default([]),
  category: z.array(CategorySlugSchema).default([]),
  minPrice: EthSchema.optional(),
  maxPrice: EthSchema.optional(),
  highlight: NftHighlightSchema.optional(),
  sort: NftSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
})
export type NftListQuery = z.input<typeof NftListQuerySchema>

export const NftPageSchema = pageSchema(NftSummarySchema)

/** `count` = NFTs no catálogo inteiro (não reage aos filtros ativos). */
export const CatalogFacetsSchema = z.object({
  collections: z.array(CollectionRefSchema.extend({ count: StockSchema })),
  categories: z.array(z.object({ slug: CategorySlugSchema, name: z.string(), count: StockSchema })),
  /** Menor e maior `NftSummary.price` do catálogo (limites do slider de preço). */
  priceRange: z.object({ min: EthSchema, max: EthSchema }),
})
export type CatalogFacets = z.infer<typeof CatalogFacetsSchema>
