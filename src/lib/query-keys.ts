import type { Query } from '@tanstack/react-query'
import type { NftListQuery, QuoteInput } from '@/contracts'

/**
 * Factory única de query keys. Dados privados SEMPRE sob `['user', userId, ...]` (invariante 5):
 * dá para limpar/invalidar por usuário e é impossível um usuário ler o cache do outro.
 */
const user = (userId: string) => ['user', userId] as const

export const queryKeys = {
  /** Validação da sessão atual (GET /auth/session). Some com `queryClient.clear()` no logout/troca. */
  session: () => ['auth', 'session'] as const,
  nfts: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (query: NftListQuery) => ['nfts', 'list', query] as const,
    details: () => ['nfts', 'detail'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  catalogFacets: () => ['catalog', 'facets'] as const,
  /** Cotação: `scope` = userId ou `'guest'`. */
  quotes: () => ['quote'] as const,
  quote: (scope: string, input: QuoteInput) => ['quote', scope, input] as const,
  favorites: (userId: string) => [...user(userId), 'favorites'] as const,
  cart: (userId: string) => [...user(userId), 'cart'] as const,
  orders: (userId: string) => [...user(userId), 'orders'] as const,
  order: (userId: string, orderId: string) => [...user(userId), 'orders', orderId] as const,
  profile: (userId: string) => [...user(userId), 'profile'] as const,
  wallets: (userId: string) => [...user(userId), 'wallets'] as const,
}

/** Predicado: queries privadas de um segmento (ex.: `'cart'`) de qualquer usuário. */
export const isUserScoped =
  (segment: 'favorites' | 'cart' | 'orders' | 'profile' | 'wallets') =>
  (query: Query): boolean =>
    query.queryKey[0] === 'user' && query.queryKey[2] === segment
