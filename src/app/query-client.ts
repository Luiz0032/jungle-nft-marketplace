import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

/** Retry só para falhas transitórias (rede ou 5xx). 4xx nunca é repetido. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  if (!isAxiosError(error)) return false
  if (error.code === 'ERR_CANCELED') return false
  const status = error.response?.status
  return status === undefined || status >= 500
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  })
}
