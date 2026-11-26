import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Download, Heart, LineChart, LogOut, MapPin, ShoppingCart, User, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogoutMutation } from '@/features/auth/queries'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'

const item = 'flex h-[45px] items-center gap-3 border-l-[6px] px-2.5 text-[15px] text-brand'

/** Itens do Figma sem funcionalidade no escopo: visíveis, mas desabilitados (invariante 10). */
const UNAVAILABLE: { label: string; icon: LucideIcon }[] = [
  { label: 'Atividade', icon: ShoppingCart },
  { label: 'Lista de interesse', icon: Heart },
  { label: 'Ofertas', icon: LineChart },
  { label: 'Arquivos baixados', icon: Download },
  { label: 'Suporte', icon: AlertTriangle },
]

/**
 * Layout de "Meu perfil" (Figma Perfil 9:1238 / Carteiras 9:1670): sidebar de 310px em `surface` com as seções
 * da conta e "Sair"; conteúdo à direita. Abaixo de `lg` a sidebar vira uma faixa no topo.
 */
export function AccountShell({ active, children }: { active: 'profile' | 'wallets'; children: ReactNode }) {
  const navigate = useNavigate()
  const logout = useLogoutMutation()

  const onLogout = async () => {
    // Sai da rota protegida antes de encerrar a sessão (mesma ordem do header).
    await navigate({ to: '/', replace: true })
    await logout.mutateAsync()
    notify.success('Você saiu da conta.')
  }

  return (
    <div className="flex flex-col gap-6 pt-2 pb-10 lg:flex-row lg:items-start lg:gap-7 lg:pt-8">
      <aside className="bg-surface pb-1 lg:w-[310px] lg:shrink-0">
        <p className="px-2.5 pt-4 pb-2 text-lg leading-6 font-bold text-foreground">Meu perfil</p>
        <nav aria-label="Conta">
          <ul className="flex flex-col">
            <li>
              <Link
                to="/profile"
                aria-current={active === 'profile' ? 'page' : undefined}
                className={cn(item, 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', active === 'profile' ? 'border-primary' : 'border-transparent hover:bg-accent')}
              >
                <User className="size-[18px]" aria-hidden />
                Dados do perfil
              </Link>
            </li>
            <li>
              <Link
                to="/wallets"
                aria-current={active === 'wallets' ? 'page' : undefined}
                className={cn(item, 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', active === 'wallets' ? 'border-primary' : 'border-transparent hover:bg-accent')}
              >
                <MapPin className="size-[18px]" aria-hidden />
                Carteiras
              </Link>
            </li>
            {UNAVAILABLE.map(({ label, icon: Icon }) => (
              <li key={label} className="hidden lg:block">
                <span aria-disabled="true" title="Indisponível nesta demonstração" className={cn(item, 'cursor-not-allowed border-transparent text-subtle')}>
                  <Icon className="size-[18px]" aria-hidden />
                  {label}
                  <span className="sr-only"> (indisponível nesta demonstração)</span>
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-1 border-t border-border">
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={logout.isPending}
            className={cn(item, 'w-full border-transparent font-bold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60')}
          >
            <LogOut className="size-[18px]" aria-hidden />
            Sair
            <span className="sr-only"> da conta</span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
    </div>
  )
}
