import { QueryClient } from '@tanstack/react-query'
import { isTransientError } from '@/lib/http'

/** Retry só para falhas transitórias (TRANSIENT, rede, timeout). 4xx nunca é repetido. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isTransientError(error)
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  })
}
