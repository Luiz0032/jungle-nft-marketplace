import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout sem path para rotas autenticadas (/checkout, /orders/$id, /profile, /wallets).
 * `beforeLoad` valida a sessão e redireciona para /login?redirect=<rota+search>.
 */
export const Route = createFileRoute('/_auth')({
  component: Outlet,
})
