import axios from 'axios'
import { env } from '@/lib/env'

/**
 * Cliente HTTP único da app. Toda chamada REST passa por aqui (invariante 7).
 * interceptor de validação zod + normalização de ApiError.
 * header Authorization + tratamento de 401.
 */
export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})
