import { http, HttpResponse, type PathParams } from 'msw'
import type { z } from 'zod'
import type { ApiError, ErrorCode } from '@/contracts'
import { env } from '@/lib/env'
import { consumeSessionExpiry, applyNetworkEffects } from '@/mocks/scenarios'
import { db, persist } from '@/mocks/db'
import type { UserRecord } from '@/mocks/db'
import { settleDueOrders } from '@/mocks/handlers/order-engine'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
export type Ctx = { request: Request; params: Record<string, string>; url: URL }

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_OUTDATED: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  TRANSIENT: 503,
}

export function apiError(code: ErrorCode, message: string, extra: Omit<ApiError, 'code' | 'message'> = {}) {
  return HttpResponse.json<ApiError>({ code, message, ...extra }, { status: STATUS[code] })
}

/** Interrompe o handler respondendo com um ApiError tipado. */
export function fail(code: ErrorCode, message: string, extra?: Omit<ApiError, 'code' | 'message'>): never {
  throw apiError(code, message, extra)
}

export function validationFail(error: z.ZodError): never {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  fail('VALIDATION_ERROR', 'Dados inválidos.', { fields })
}

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) validationFail(result.error)
  return result.data
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    fail('VALIDATION_ERROR', 'Corpo da requisição não é um JSON válido.')
  }
  return parse(schema, json)
}

export const noContent = () => new HttpResponse(null, { status: 204 })

/** Usuário autenticado pelo header `Authorization: Bearer <token>`. */
export function requireUser(request: Request): { user: UserRecord; token: string } {
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match?.[1]) fail('UNAUTHENTICATED', 'Faça login para continuar.')
  const token = match[1]
  const s = db()
  const session = s.sessions.find((x) => x.token === token)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    fail('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  }
  if (consumeSessionExpiry()) {
    s.sessions = s.sessions.filter((x) => x.token !== token)
    persist()
    fail('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  }
  const user = s.users.find((u) => u.id === session.userId)
  if (!user) fail('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  return { user, token }
}

/**
 * Registra uma rota `/api/*`: aplica cenário (latência/falhas/offline), assenta pedidos vencidos,
 * converte `throw Response` em resposta e persiste o banco após escritas.
 */
export function route(method: Method, path: string, resolver: (ctx: Ctx) => Response | Promise<Response>) {
  return http[method]<PathParams>(`${env.apiUrl}${path}`, async ({ request, params }) => {
    const effect = await applyNetworkEffects(request.method, path)
    if (effect) return effect
    settleDueOrders()
    try {
      const response = await resolver({ request, params: params as Record<string, string>, url: new URL(request.url) })
      if (method !== 'get') persist()
      return response
    } catch (error) {
      if (error instanceof Response) {
        if (method !== 'get') persist() // ex.: `sold-out` altera estoque e responde 409
        return error
      }
      console.error('[mock] erro inesperado em', method.toUpperCase(), path, error)
      return apiError('TRANSIENT', 'Erro inesperado no servidor mock.')
    }
  })
}
