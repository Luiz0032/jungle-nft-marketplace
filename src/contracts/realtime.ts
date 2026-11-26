import { z } from 'zod'
import { EthSchema, IdSchema, IsoDateSchema, StockSchema, VersionSchema } from './common'
import { OrderStatusSchema } from './order'

/** Nome dos eventos Socket.IO = `type` do envelope. */
export const REALTIME_EVENT_TYPES = ['nft.updated', 'order.updated'] as const
export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number]

const envelope = {
  eventId: z.string().min(1),
  resource: z.object({ type: z.enum(['nft', 'edition', 'order']), id: IdSchema }),
  version: VersionSchema,
  userId: z.string().nullable(),
  emittedAt: IsoDateSchema,
}

export const NftUpdatedPayloadSchema = z.object({
  nftId: IdSchema,
  editionId: IdSchema.optional(),
  price: EthSchema.optional(),
  available: StockSchema.optional(),
})

export const OrderUpdatedPayloadSchema = z.object({
  orderId: IdSchema,
  status: OrderStatusSchema,
  transactionId: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
})

export const NftUpdatedEventSchema = z.object({
  ...envelope,
  type: z.literal('nft.updated'),
  payload: NftUpdatedPayloadSchema,
})
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEventSchema>

export const OrderUpdatedEventSchema = z.object({
  ...envelope,
  type: z.literal('order.updated'),
  payload: OrderUpdatedPayloadSchema,
})
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEventSchema>

export const RealtimeEventSchema = z.discriminatedUnion('type', [NftUpdatedEventSchema, OrderUpdatedEventSchema])
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>

/** Evento extra do servidor: token do handshake inválido/expirado (a conexão é encerrada em seguida). */
export const SOCKET_AUTH_ERROR_EVENT = 'auth_error'
