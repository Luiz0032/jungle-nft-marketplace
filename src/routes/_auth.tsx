import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/**
 * Layout sem path das rotas autenticadas (/checkout, /orders/$id, /profile, /wallets).
 * Aguarda a validação da sessão restaurada (refresh); sem sessão → /login?redirect=<rota+search>.
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
  component: Outlet,
})
