import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { RegisterInputSchema, type Session } from '@/contracts'
import { useRegisterMutation } from '../queries'
import { AuthField } from './auth-field'
import { authSubmitClass } from './auth-layout'
import { applyServerError } from './form-errors'

/** Contrato da API + confirmação de senha (só no cliente; não vai para o servidor). */
const RegisterFormSchema = RegisterInputSchema.extend({
  confirmPassword: z.string().min(1, 'Confirme a senha'),
}).refine((v) => v.password === v.confirmPassword, {
  path: ['confirmPassword'],
  message: 'As senhas não conferem',
})
type RegisterForm = z.input<typeof RegisterFormSchema>

export function RegisterForm({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const registerUser = useRegisterMutation()
  const form = useForm<RegisterForm, unknown, z.output<typeof RegisterFormSchema>>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState
  const busy = isSubmitting || registerUser.isPending

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    try {
      onSuccess(await registerUser.mutateAsync({ name, email, password }))
    } catch (error) {
      applyServerError(form, error, ['name', 'email', 'password'])
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={busy} className="flex flex-col gap-10 lg:gap-0">
      <div className="flex flex-col gap-3 lg:px-20 lg:pt-6">
        <AuthField
          id="register-name"
          label="Nome de usuário"
          autoComplete="name"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <AuthField
          id="register-email"
          label="Digite seu e-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <AuthField
          id="register-password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          revealable
          error={errors.password?.message}
          {...form.register('password')}
        />
        <AuthField
          id="register-confirm"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          revealable
          error={errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
      </div>

      <div className="flex flex-col gap-3 lg:px-20 lg:pt-6">
        {errors.root?.server && (
          <p role="alert" className="rounded-[5px] border border-coral/40 bg-coral/10 px-3 py-2 text-[13px] text-coral">
            {errors.root.server.message}
          </p>
        )}
        <button type="submit" disabled={busy} className={authSubmitClass}>
          {busy ? (
            'Criando…'
          ) : (
            <>
              <span className="lg:hidden">Criar perfil</span>
              <span className="hidden lg:inline">Criar conta</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
