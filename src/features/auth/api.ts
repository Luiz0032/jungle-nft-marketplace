import { SessionSchema, type LoginInput, type RegisterInput } from '@/contracts'
import { request, requestVoid } from '@/lib/http'

// Rotas de auth tratam o próprio 401 (credencial errada ≠ sessão expirada).
const authConfig = { skipSessionExpiry: true } as const

export const loginRequest = (input: LoginInput) =>
  request(SessionSchema, { ...authConfig, method: 'post', url: '/auth/login', data: input })

export const registerRequest = (input: RegisterInput) =>
  request(SessionSchema, { ...authConfig, method: 'post', url: '/auth/register', data: input })

export const fetchSession = (signal?: AbortSignal) =>
  request(SessionSchema, { ...authConfig, url: '/auth/session', signal })

/** Token explícito: no logout o estado local já pode ter sido limpo. */
export const logoutRequest = (token: string) =>
  requestVoid({
    ...authConfig,
    method: 'post',
    url: '/auth/logout',
    headers: { Authorization: `Bearer ${token}` },
  })
