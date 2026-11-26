import axios, { isAxiosError, isCancel, type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { ApiErrorSchema, type ErrorCode } from '@/contracts/common'
import { env } from '@/lib/env'

/**
 * Cliente HTTP único da app (invariante 7).
 * - Valida TODA resposta com o schema zod passado em `config.schema` (invariante 8).
 * - Normaliza qualquer falha em `ApiRequestError` (cancelamento é repassado intacto ao TanStack Query).
 */

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Schema zod da resposta. Obrigatório para respostas com corpo (use `requestVoid` para 204). */
    schema?: z.ZodType
    /** Não dispara o handler de sessão expirada (rotas de auth tratam o 401 elas mesmas). */
    skipSessionExpiry?: boolean
  }
}

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'UNKNOWN'

export class ApiRequestError extends Error {
  readonly code: ClientErrorCode
  readonly status: number | undefined
  readonly fields: Record<string, string> | undefined
  readonly details: unknown

  constructor(
    code: ClientErrorCode,
    message: string,
    opts: { status?: number; fields?: Record<string, string>; details?: unknown } = {},
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = opts.status
    this.fields = opts.fields
    this.details = opts.details
  }
}

export const isApiError = (e: unknown, code?: ClientErrorCode): e is ApiRequestError =>
  e instanceof ApiRequestError && (code === undefined || e.code === code)

/** Falhas que valem retry automático de leitura. */
export const isTransientError = (e: unknown) =>
  e instanceof ApiRequestError && (e.code === 'TRANSIENT' || e.code === 'NETWORK_ERROR' || e.code === 'TIMEOUT')

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
  // `collection=a&collection=b` (sem colchetes), como o mock e a URL do catálogo esperam.
  paramsSerializer: { indexes: null },
})

let getAuthToken: () => string | null = () => null
/** Registrado pela feature de auth (`createAuth().install()`). */
export function setAuthTokenGetter(fn: () => string | null) {
  getAuthToken = fn
}

let onSessionExpired: ((token: string) => void) | null = null
/**
 * Chamado quando uma requisição autenticada recebe SESSION_EXPIRED/UNAUTHENTICATED.
 * Recebe o token USADO na requisição: a auth ignora se ele já não é o atual (resposta atrasada de outra sessão).
 */
export function setSessionExpiredHandler(fn: ((token: string) => void) | null) {
  onSessionExpired = fn
}

const bearerOf = (config: AxiosRequestConfig | undefined): string | null => {
  const header = config?.headers?.Authorization ?? config?.headers?.authorization
  const match = typeof header === 'string' ? /^Bearer\s+(.+)$/i.exec(header) : null
  return match?.[1] ?? null
}

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

http.interceptors.response.use(
  (response) => {
    const { schema } = response.config
    if (!schema || response.status === 204) return response
    const parsed = schema.safeParse(response.data)
    if (!parsed.success) {
      if (import.meta.env.DEV) console.error('[http] resposta fora do contrato', response.config.url, parsed.error)
      throw new ApiRequestError('INVALID_RESPONSE', 'Resposta inesperada do servidor.', {
        status: response.status,
        details: parsed.error.issues,
      })
    }
    response.data = parsed.data
    return response
  },
  (error: unknown) => {
    if (isCancel(error)) throw error
    const normalized = normalizeError(error)
    const config = isAxiosError(error) ? error.config : undefined
    const token = bearerOf(config)
    if (
      token &&
      !config?.skipSessionExpiry &&
      (normalized.code === 'SESSION_EXPIRED' || normalized.code === 'UNAUTHENTICATED')
    ) {
      onSessionExpired?.(token)
    }
    throw normalized
  },
)

function normalizeError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error
  if (!isAxiosError(error)) return new ApiRequestError('UNKNOWN', 'Erro inesperado.')
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiRequestError('TIMEOUT', 'O servidor demorou para responder.')
  }
  if (!error.response) return new ApiRequestError('NETWORK_ERROR', 'Sem conexão com o servidor.')
  const body = ApiErrorSchema.safeParse(error.response.data)
  if (body.success) {
    const { code, message, fields, details } = body.data
    return new ApiRequestError(code, message, { status: error.response.status, fields, details })
  }
  return new ApiRequestError('UNKNOWN', `Erro ${error.response.status}.`, { status: error.response.status })
}

/** Requisição com corpo validado. Passe o `signal` do TanStack Query em `config.signal`. */
export async function request<S extends z.ZodType>(schema: S, config: AxiosRequestConfig): Promise<z.output<S>> {
  const res = await http.request({ ...config, schema })
  return res.data as z.output<S>
}

/** Requisição sem corpo de resposta (204). */
export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
