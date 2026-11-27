import { z } from 'zod'
import { EmailSchema, NameSchema } from './auth'
import { EthSchema, IdSchema, IsoDateSchema, QuantitySchema, VersionSchema } from './common'
import { NetworkSchema, WalletAddressSchema } from './wallet'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

export const ORDER_STATUSES = ['pending', 'confirmed', 'rejected'] as const
export const OrderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof OrderStatusSchema>
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'rejected']

export const CollectorSchema = z.object({ name: NameSchema, email: EmailSchema })
export type Collector = z.infer<typeof CollectorSchema>

export const CreateOrderInputSchema = z.object({
  quoteId: IdSchema,
  quoteVersion: VersionSchema,
  walletId: IdSchema,
  network: NetworkSchema,
  collector: CollectorSchema,
})
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>

export const ReceiptLineSchema = z.object({
  nftId: IdSchema,
  editionId: IdSchema,
  title: z.string(),
  editionLabel: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  unitPrice: EthSchema,
  quantity: QuantitySchema,
  lineTotal: EthSchema,
})

/** Snapshot imutável no momento da criação do pedido. */
export const ReceiptSchema = z.object({
  lines: z.array(ReceiptLineSchema),
  subtotal: EthSchema,
  discount: EthSchema,
  networkFee: EthSchema,
  total: EthSchema,
  coupon: z.string().nullable(),
  wallet: z.object({ id: IdSchema, label: z.string(), address: WalletAddressSchema }),
  network: NetworkSchema,
  collector: CollectorSchema,
})
export type Receipt = z.infer<typeof ReceiptSchema>

export const OrderSchema = z.object({
  id: IdSchema,
  status: OrderStatusSchema,
  transactionId: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  receipt: ReceiptSchema.nullable(),
  createdAt: IsoDateSchema,
  version: VersionSchema,
})
export type Order = z.infer<typeof OrderSchema>
