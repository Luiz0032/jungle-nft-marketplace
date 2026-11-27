import { z } from 'zod'
import { EthSchema, IdSchema, QuantitySchema, StockSchema, VersionSchema } from './common'

export const FavoritesSchema = z.object({ nftIds: z.array(IdSchema) })
export type Favorites = z.infer<typeof FavoritesSchema>

export const CartItemSchema = z.object({
  id: IdSchema,
  nftId: IdSchema,
  editionId: IdSchema,
  title: z.string(),
  editionLabel: z.string(),
  image: z.string().min(1),
  imageAlt: z.string().min(1),
  unitPrice: EthSchema,
  quantity: QuantitySchema,
  available: StockSchema,
})
export type CartItem = z.infer<typeof CartItemSchema>

export const CartSchema = z.object({ items: z.array(CartItemSchema), version: VersionSchema })
export type Cart = z.infer<typeof CartSchema>

export const GuestItemSchema = z.object({ nftId: IdSchema, editionId: IdSchema, quantity: QuantitySchema })
export type GuestItem = z.infer<typeof GuestItemSchema>

export const AddCartItemInputSchema = GuestItemSchema
export type AddCartItemInput = z.infer<typeof AddCartItemInputSchema>

export const UpdateCartItemInputSchema = z.object({ quantity: QuantitySchema })
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInputSchema>

export const MergeCartInputSchema = z.object({ items: z.array(GuestItemSchema).max(100) })
export type MergeCartInput = z.infer<typeof MergeCartInputSchema>
