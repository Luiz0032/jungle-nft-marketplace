import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import type { Session } from '@/contracts'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'
import { AuthSearchSchema, safeRedirect } from '@/features/auth/redirect'
import { firstName } from '@/features/auth/session'
import { notify } from '@/lib/notify'
import { usePageMeta } from '@/lib/page-meta'

export const Route = createFileRoute('/login')({
  validateSearch: AuthSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.getState().status === 'authenticated') throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: LoginPage,
})

function LoginPage() {
  usePageMeta('Entrar', 'Entre na sua conta Kurio para favoritar, comprar e acompanhar pedidos de NFTs.')
  const search = Route.useSearch()
  const navigate = useNavigate()

  const onSuccess = (session: Session) => {
    notify.success(`Bem-vindo(a) de volta, ${firstName(session.user)}!`)
    void navigate({ href: safeRedirect(search.redirect), replace: true })
  }

  return (
    <AuthLayout
      mode="login"
      search={search}
      notice={
        search.reason === 'expired' && (
          <p
            role="status"
            className="rounded-[5px] border border-primary/40 bg-primary/10 px-3 py-2 text-center text-[13px] text-brand lg:mx-20 lg:mt-6"
          >
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )
      }
    >
      <LoginForm onSuccess={onSuccess} />
    </AuthLayout>
  )
}
