import { IDEMPOTENCY_HEADER, OrderSchema, type CreateOrderInput } from '@/contracts'
import { request } from '@/lib/http'

export const createOrder = (input: CreateOrderInput, idempotencyKey: string) =>
  request(OrderSchema, {
    method: 'post',
    url: '/orders',
    data: input,
    headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
  })

export const fetchOrder = (id: string, signal?: AbortSignal) =>
  request(OrderSchema, { url: `/orders/${encodeURIComponent(id)}`, signal })

export const fetchOrderByKey = (key: string, signal?: AbortSignal) =>
  request(OrderSchema, { url: `/orders/by-key/${encodeURIComponent(key)}`, signal })
