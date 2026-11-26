import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Auth, AuthState } from './session'

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth fora do AuthContext')
  return auth
}

export function useAuthState(): AuthState {
  const auth = useAuth()
  return useSyncExternalStore(auth.subscribe, auth.getState, auth.getState)
}

/** Usuário logado (ou `null`). */
export function useCurrentUser() {
  const state = useAuthState()
  return state.status === 'authenticated' ? state.session.user : null
}
