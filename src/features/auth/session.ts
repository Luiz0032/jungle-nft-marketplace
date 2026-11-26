import type { QueryClient } from '@tanstack/react-query'
import { SessionSchema, type Session, type User } from '@/contracts'
import { isApiError, setAuthTokenGetter, setSessionExpiredHandler } from '@/lib/http'
import { queryKeys } from '@/lib/query-keys'
import type { Realtime } from '@/lib/realtime'
import { connectSocket, disconnectSocket, setSocketAuthErrorHandler } from '@/lib/socket'
import { clearPrivateStorage, readStorage, SESSION_KEY, writeStorage } from '@/lib/storage'
import { fetchSession, logoutRequest } from './api'

/**
 * Dono da sessão no cliente (ARCHITECTURE §6). Única peça que conecta/desconecta o socket por usuário
 * e que limpa cache + storage privado (invariante 5).
 *
 * - Boot/refresh: sessão lida do localStorage fica `validated: false` até GET /auth/session confirmar.
 *   Rotas protegidas aguardam essa validação no `beforeLoad` (`ensureSession()`).
 * - Sessão já validada (ou recém-criada por login/cadastro) não é revalidada a cada navegação: expiração
 *   posterior é detectada pela próxima chamada privada — 401/SESSION_EXPIRED (http.ts) ou `auth_error`
 *   do socket → `expire()`. Revalidar em toda navegação criava corrida com o logout (redirect atrasado).
 */

export type AuthState =
  | { status: 'guest' }
  | { status: 'authenticated'; session: Session; validated: boolean }

export type EnsureResult = { session: Session | null; expired: boolean }

export type Auth = ReturnType<typeof createAuth>

const GUEST: AuthState = { status: 'guest' }

export function createAuth({ queryClient, realtime }: { queryClient: QueryClient; realtime: Realtime }) {
  const stored = readStorage(SESSION_KEY, SessionSchema)
  let state: AuthState =
    stored && Date.parse(stored.expiresAt) > Date.now()
      ? { status: 'authenticated', session: stored, validated: false }
      : GUEST
  if (!stored || state.status === 'guest') clearPrivateStorage()

  const listeners = new Set<() => void>()
  let onExpired: (() => void) | null = null
  let inflight: Promise<EnsureResult> | null = null
  /** A última sessão terminou por expiração (e não por logout). Vale até o próximo login/logout. */
  let expiredFlag = false

  const set = (next: AuthState) => {
    state = next
    for (const l of listeners) l()
  }
  const currentToken = () => (state.status === 'authenticated' ? state.session.token : null)

  /**
   * Zera tudo que pertence a uma sessão: socket (antes, para nenhum evento tardio entrar),
   * queries em voo, cache, memória do realtime e storage privado.
   */
  function wipe() {
    disconnectSocket()
    void queryClient.cancelQueries()
    queryClient.clear()
    realtime.reset()
    clearPrivateStorage()
  }

  function toGuest(expired: boolean) {
    expiredFlag = expired
    wipe()
    set(GUEST)
    connectSocket(null)
  }

  /**
   * A sessão mudou enquanto a validação estava em voo (outra chamada privada recebeu 401 e expirou a sessão,
   * ou houve login/logout). Responde com o estado ATUAL — inclusive `expired`, para o redirect levar `reason=expired`.
   */
  const settledElsewhere = (): EnsureResult =>
    state.status === 'authenticated'
      ? { session: state.session, expired: false }
      : { session: null, expired: expiredFlag }

  async function validate(token: string): Promise<EnsureResult> {
    try {
      const session = await queryClient.fetchQuery({
        queryKey: queryKeys.session(),
        queryFn: ({ signal }) => fetchSession(signal),
        staleTime: 0,
        retry: false,
      })
      if (currentToken() !== token) return settledElsewhere() // trocou de sessão no meio
      writeStorage(SESSION_KEY, session)
      set({ status: 'authenticated', session, validated: true })
      return { session, expired: false }
    } catch (error) {
      if (currentToken() !== token) return settledElsewhere()
      if (isApiError(error, 'SESSION_EXPIRED') || isApiError(error, 'UNAUTHENTICATED')) {
        toGuest(true)
        return { session: null, expired: true }
      }
      // Falha de rede/servidor: não desloga; a próxima chamada privada decide.
      return { session: state.status === 'authenticated' ? state.session : null, expired: false }
    }
  }

  const auth = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    token: currentToken,
    /** A sessão atual de convidado começou por expiração (não por logout)? */
    endedByExpiry: () => expiredFlag,
    userId: (): string | null => (state.status === 'authenticated' ? state.session.user.id : null),

    /** Sessão utilizável. Só vai ao servidor se ainda não foi validada; chamadas simultâneas compartilham a requisição. */
    ensureSession(): Promise<EnsureResult> {
      // `expired` sobrevive ao preload (hover) que já tenha descoberto a expiração antes do clique.
      if (state.status === 'guest') return Promise.resolve({ session: null, expired: expiredFlag })
      if (Date.parse(state.session.expiresAt) <= Date.now()) {
        toGuest(true)
        return Promise.resolve({ session: null, expired: true })
      }
      if (state.validated) return Promise.resolve({ session: state.session, expired: false })
      inflight ??= validate(state.session.token).finally(() => {
        inflight = null
      })
      return inflight
    },

    /** Login/cadastro bem-sucedido. Trocar de usuário zera tudo da sessão anterior antes. */
    signIn(session: Session) {
      const previous = state.status === 'authenticated' ? state.session.user.id : null
      if (previous !== null) wipe()
      else {
        // Convidado → usuário: o cache público (catálogo) continua válido; só o socket troca.
        disconnectSocket()
        realtime.reset()
      }
      expiredFlag = false
      writeStorage(SESSION_KEY, session)
      set({ status: 'authenticated', session, validated: true })
      connectSocket(session.token)
    },

    /** Perfil editado (nome, e-mail, avatar): atualiza o usuário da sessão atual — ignora resposta de outro usuário. */
    updateUser(user: User) {
      if (state.status !== 'authenticated' || state.session.user.id !== user.id) return
      const session = { ...state.session, user }
      writeStorage(SESSION_KEY, session)
      set({ ...state, session })
    },

    async signOut() {
      const token = currentToken()
      toGuest(false)
      if (token) await logoutRequest(token).catch(() => undefined) // melhor esforço
    },

    /** Sessão recusada pelo servidor. `token` = o usado na requisição que falhou. */
    expire(token?: string) {
      if (state.status === 'guest') return
      if (token !== undefined && token !== state.session.token) return // resposta de sessão antiga
      toGuest(true)
      onExpired?.()
    },

    /** A app decide o que fazer quando a sessão expira (redirecionar, avisar). */
    setExpiredHandler(handler: (() => void) | null) {
      onExpired = handler
    },

    /** Liga http e socket a esta instância. Retorna o teardown. */
    install() {
      setAuthTokenGetter(currentToken)
      setSessionExpiredHandler((token) => auth.expire(token))
      setSocketAuthErrorHandler(() => auth.expire())
      connectSocket(currentToken())
      return () => {
        setAuthTokenGetter(() => null)
        setSessionExpiredHandler(null)
        setSocketAuthErrorHandler(null)
        disconnectSocket()
      }
    },
  }
  return auth
}

export const firstName = (user: Pick<User, 'name'>) => user.name.trim().split(/\s+/)[0] ?? user.name
