import { z } from 'zod'

// Contratos compartilhados por app e mocks. Sem alias `@/` aqui: os specs do Playwright importam este arquivo.

/** Decimal ETH canônico: sem sinal, sem expoente, até 18 casas. NUNCA `number`. */
export const ETH_REGEX = /^(0|[1-9]\d*)(\.\d{1,18})?$/
export const EthSchema = z.string().regex(ETH_REGEX, 'Valor ETH inválido')
export type Eth = z.infer<typeof EthSchema>

export const IdSchema = z.string().min(1)
export const QuantitySchema = z.number().int('Quantidade deve ser inteira').min(1, 'Quantidade mínima é 1')
export const StockSchema = z.number().int().min(0)
export const VersionSchema = z.number().int().min(0)
export const IsoDateSchema = z.iso.datetime()

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'AVAILABILITY_CONFLICT',
  'QUOTE_OUTDATED',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'TRANSIENT',
] as const
export const ErrorCodeSchema = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
  details: z.unknown().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
}
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
