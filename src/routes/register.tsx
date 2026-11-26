import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import type { Session } from '@/contracts'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { RegisterForm } from '@/features/auth/components/register-form'
import { AuthSearchSchema, safeRedirect } from '@/features/auth/redirect'
import { firstName } from '@/features/auth/session'
import { notify } from '@/lib/notify'
import { usePageMeta } from '@/lib/page-meta'

export const Route = createFileRoute('/register')({
  validateSearch: AuthSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.getState().status === 'authenticated') throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: RegisterPage,
})

function RegisterPage() {
  usePageMeta('Criar conta', 'Crie sua conta Kurio para favoritar, comprar e acompanhar pedidos de NFTs.')
  const search = Route.useSearch()
  const navigate = useNavigate()

  const onSuccess = (session: Session) => {
    notify.success(`Conta criada. Bem-vindo(a), ${firstName(session.user)}!`)
    void navigate({ href: safeRedirect(search.redirect), replace: true })
  }

  return (
    <AuthLayout mode="register" search={search}>
      <RegisterForm onSuccess={onSuccess} />
    </AuthLayout>
  )
}
