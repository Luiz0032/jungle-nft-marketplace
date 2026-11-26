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

export const PAGE_SIZE_DEFAULT = 12
export const PAGE_SIZE_MAX = 48

/** Query de `GET /nfts`. Também serve de base para o `validateSearch` do catálogo. */
export const NftListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  collection: z.array(z.string().min(1)).default([]),
  category: z.array(CategorySlugSchema).default([]),
  minPrice: EthSchema.optional(),
  maxPrice: EthSchema.optional(),
  sort: NftSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
})
export type NftListQuery = z.input<typeof NftListQuerySchema>

export const NftPageSchema = pageSchema(NftSummarySchema)

export const CatalogFacetsSchema = z.object({
  collections: z.array(CollectionRefSchema),
  categories: z.array(z.object({ slug: CategorySlugSchema, name: z.string() })),
})
export type CatalogFacets = z.infer<typeof CatalogFacetsSchema>
