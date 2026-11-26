import { z } from 'zod'
import { EthSchema, IdSchema, IsoDateSchema, QuantitySchema, VersionSchema } from './common'

export const QuoteInputSchema = z.object({
  items: z.array(z.object({ editionId: IdSchema, quantity: QuantitySchema })).min(1, 'Carrinho vazio'),
  coupon: z.string().trim().min(1).max(32).optional(),
})
export type QuoteInput = z.infer<typeof QuoteInputSchema>

export const QuoteLineSchema = z.object({
  editionId: IdSchema,
  unitPrice: EthSchema,
  quantity: QuantitySchema,
  lineTotal: EthSchema,
})
export type QuoteLine = z.infer<typeof QuoteLineSchema>

export const QuoteSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  expiresAt: IsoDateSchema,
  lines: z.array(QuoteLineSchema),
  subtotal: EthSchema,
  discount: EthSchema,
  networkFee: EthSchema,
  total: EthSchema,
  coupon: z.object({ code: z.string(), status: z.literal('applied') }).nullable(),
})
export type Quote = z.infer<typeof QuoteSchema>
