import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useAuth, useAuthState } from '@/features/auth/hooks'

/**
 * Layout sem path das rotas autenticadas (/checkout, /orders/$id, /profile, /wallets).
 * - Entrada: aguarda a validação da sessão restaurada (refresh); sem sessão → /login?redirect=<rota+search>.
 * - Já dentro: se a sessão acabar (expiração, logout, troca de aba) o layout sai na hora para o login,
 *   guardando o destino. Cobre também a corrida "Sair" clicado antes da navegação pós-login terminar.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const { session, expired } = await context.auth.ensureSession()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href, reason: expired ? 'expired' : undefined },
      })
    }
    return { session }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const auth = useAuth()
  const guest = useAuthState().status === 'guest'
  // Destino = rota protegida ATUAL (match deste layout), não a localização em transição.
  const href = useRouterState({
    select: (s) => (s.matches.some((m) => m.routeId === '/_auth') ? s.location.href : null),
  })
  const navigate = useNavigate()
  const redirected = useRef(false)

  useEffect(() => {
    if (!guest) {
      redirected.current = false
      return
    }
    if (redirected.current || href === null) return // uma vez por perda de sessão; sem loop na transição
    redirected.current = true
    void navigate({
      to: '/login',
      search: { redirect: href, reason: auth.endedByExpiry() ? 'expired' : undefined },
      replace: true,
    })
  }, [guest, href, auth, navigate])

  // Nunca renderiza conteúdo privado sem sessão (nem por um frame).
  return guest ? null : <Outlet />
}
