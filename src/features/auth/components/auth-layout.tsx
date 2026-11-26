import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { AuthSearch } from '../redirect'
import { SocialSignIn } from './social-sign-in'

type Mode = 'login' | 'register'

const copy: Record<Mode, { title: string; subtitle: string }> = {
  login: {
    title: 'Entrar',
    subtitle: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
  },
  register: {
    title: 'Criar perfil de colecionador',
    subtitle: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
  },
}

/**
 * Casca das telas de auth. Um só DOM, dois layouts:
 * - mobile (< lg): tela cheia — Figma "Mobile / Login" 16:1022 e "Mobile / Cadastro" 16:1228;
 * - desktop: cartão de 500px — Figma "Sign In Modal" 70381:239 e "Sign Up Modal" 70383:239.
 */
export function AuthLayout({
  mode,
  search,
  notice,
  children,
}: {
  mode: Mode
  search: AuthSearch
  notice?: ReactNode
  children: ReactNode
}) {
  const { title, subtitle } = copy[mode]
  const tab = (target: Mode, label: string) => (
    <Link
      to={target === 'login' ? '/login' : '/register'}
      search={search}
      aria-current={mode === target ? 'page' : undefined}
      className={cn(
        'rounded-sm text-xl leading-4 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
        mode === target ? 'text-brand' : 'text-foreground hover:text-brand',
      )}
    >
      {label}
    </Link>
  )

  return (
    <section
      aria-labelledby="auth-title"
      className={cn(
        'relative mx-auto flex w-full max-w-[414px] flex-col gap-10 px-3 pt-20 pb-6',
        'lg:my-16 lg:w-[500px] lg:max-w-none lg:gap-0 lg:overflow-hidden lg:rounded-[8px] lg:bg-surface lg:px-0 lg:pt-12 lg:pb-[58px]',
      )}
    >
      <p
        aria-hidden="true"
        className="flex h-[136px] items-center justify-center text-[32px] font-bold tracking-[0.1em] text-foreground lg:hidden"
      >
        KURIO
      </p>

      <h1 id="auth-title" className="text-center text-xl leading-4 font-bold text-foreground lg:sr-only">
        {title}
      </h1>

      <div className="hidden flex-col items-center gap-10 px-12 lg:flex">
        <nav aria-label="Entrar ou criar conta" className="flex items-stretch gap-2">
          {tab('login', 'Entrar')}
          <span aria-hidden="true" className="w-px bg-coral" />
          {tab('register', 'Criar conta')}
        </nav>
        <p className="text-center text-[13px] leading-4 text-foreground">{subtitle}</p>
      </div>

      {notice}
      {children}
      <SocialSignIn />

      <p className="text-center text-[15px] text-muted-foreground lg:hidden">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/register" search={search} className="rounded-sm text-brand underline underline-offset-4">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/login" search={search} className="rounded-sm text-brand underline underline-offset-4">
              Entre
            </Link>
          </>
        )}
      </p>

      <Link
        to="/"
        aria-label="Fechar e voltar para o início"
        className="absolute top-3 right-3 hidden size-8 place-items-center rounded-md text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:grid"
      >
        <X className="size-[18px]" aria-hidden />
      </Link>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 hidden h-2.5 bg-primary lg:block" />
    </section>
  )
}

/** Botão principal — Figma "Sign In Button" (desktop 45px/raio 5; mobile 60px/raio 10). */
export const authSubmitClass =
  'flex h-[60px] w-full items-center justify-center rounded-[10px] bg-primary text-base leading-4 font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70 lg:h-[45px] lg:rounded-[5px]'
