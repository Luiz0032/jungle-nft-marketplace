import { queryOptions } from '@tanstack/react-query'
import { isApiError, isTransientError } from '@/lib/http'
import { queryKeys } from '@/lib/query-keys'
import { fetchOrder } from './api'

export const ORDER_POLL_MS = 3_000

/**
 * Pedido. `order.updated` (socket) atualiza o cache; enquanto `pending` e SEM socket conectado, consulta a cada 3 s
 * (o evento pode ter se perdido na queda). Ao reconectar, o realtime refaz os pedidos pendentes.
 */
export const orderQuery = (userId: string, orderId: string, socketConnected: boolean) =>
  queryOptions({
    queryKey: queryKeys.order(userId, orderId),
    queryFn: ({ signal }) => fetchOrder(orderId, signal),
    staleTime: 0,
    retry: (count, error) => count < 3 && isTransientError(error),
    refetchInterval: (query) => (query.state.data?.status === 'pending' && !socketConnected ? ORDER_POLL_MS : false),
  })

export const isOrderMissing = (error: unknown) => isApiError(error, 'NOT_FOUND') || isApiError(error, 'FORBIDDEN')
