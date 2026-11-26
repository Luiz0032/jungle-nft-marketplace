import { queryOptions } from '@tanstack/react-query'
import type { QuoteInput } from '@/contracts'
import { queryKeys } from '@/lib/query-keys'
import { fetchQuote } from './api'

/** Renova a cotação 15 s antes de expirar (validade de 5 min no servidor). */
const REFRESH_BEFORE_EXPIRY_MS = 15_000

/**
 * Cotação (POST /quote): única fonte de subtotal/desconto/taxa/total. A chave inclui itens e cupom, então
 * qualquer mudança gera uma nova cotação; `nft.updated` invalida todas (realtime.ts). Nunca reaproveitada:
 * staleTime 0 e sem retry (um 409/422 é resposta, não falha transitória).
 */
export const quoteQuery = (scope: string, input: QuoteInput) =>
  queryOptions({
    queryKey: queryKeys.quote(scope, input),
    queryFn: ({ signal }) => fetchQuote(input, signal),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const expiresAt = query.state.data?.expiresAt
      if (!expiresAt) return false
      return Math.max(Date.parse(expiresAt) - Date.now() - REFRESH_BEFORE_EXPIRY_MS, 5_000)
    },
  })
