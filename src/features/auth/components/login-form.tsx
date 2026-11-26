import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { LoginInputSchema, type LoginInput, type Session } from '@/contracts'
import { useLoginMutation } from '../queries'
import { AuthField } from './auth-field'
import { authSubmitClass } from './auth-layout'
import { applyServerError } from './form-errors'

export function LoginForm({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const login = useLoginMutation()
  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState
  const busy = isSubmitting || login.isPending

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      onSuccess(await login.mutateAsync(values))
    } catch (error) {
      applyServerError(form, error, ['email', 'password'])
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={busy} className="flex flex-col gap-10 lg:gap-0">
      <div className="flex flex-col gap-3 lg:px-20 lg:pt-6">
        <AuthField
          id="login-email"
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <AuthField
          id="login-password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          revealable
          error={errors.password?.message}
          {...form.register('password')}
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled
            title="Recuperação de senha indisponível nesta demonstração"
            className="cursor-not-allowed text-sm leading-4 text-brand opacity-70"
          >
            Esqueceu a senha? <span className="sr-only">(indisponível nesta demonstração)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:px-20 lg:pt-6">
        {errors.root?.server && (
          <p role="alert" className="rounded-[5px] border border-coral/40 bg-coral/10 px-3 py-2 text-[13px] text-coral">
            {errors.root.server.message}
          </p>
        )}
        <button type="submit" disabled={busy} className={authSubmitClass}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
