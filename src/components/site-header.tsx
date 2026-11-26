import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useCurrentUser } from '@/features/auth/hooks'
import { useLogoutMutation } from '@/features/auth/queries'
import { firstName } from '@/features/auth/session'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'

/**
 * Header desktop/mobile — Figma "Header With Divider" (70522:3240) / "Header Row" (70486:560).
 * "Mercado" fica ativo nas telas do fluxo de compra; "Criadores" e "Aprenda" estão fora do
 * escopo do desafio e aparecem como indisponíveis (invariante 10).
 */

const HOME_SECTION = /^\/(login|register|profile|wallets)?\/?$/
const MARKET_FLOW = /^\/(nft|cart|checkout|orders)(\/|$)/

function useActiveSection(): 'home' | 'market' | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (MARKET_FLOW.test(pathname)) return 'market'
  // Figma: "Início" ativo também em Entrar, Criar conta, Perfil e Carteiras.
  if (HOME_SECTION.test(pathname)) return 'home'
  return null
}

const navLink =
  'relative block pb-[22px] text-base leading-none outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring'
const activeLink =
  'font-bold text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary'

export function SiteHeader({ className }: { className?: string }) {
  const active = useActiveSection()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isMarket = active === 'market'

  return (
    <header className={cn("mx-auto w-full max-w-content px-4 pt-6 lg:px-0", className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-4 lg:items-start lg:gap-6',
          // Telas do fluxo "Mercado" usam o Header Row sem divisor.
          !isMarket && 'border-b-[0.6px] border-border',
        )}
      >
        <Link
          to="/"
          className="flex h-[34px] shrink-0 lg:w-[160px] items-center text-sm font-bold tracking-[0.1em] text-foreground outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring lg:items-start lg:pt-2"
          aria-label="Kurio — página inicial"
        >
          KURIO
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex gap-10">
            <li>
              <Link
                to="/"
                className={cn(navLink, active === 'home' ? activeLink : 'font-normal text-foreground hover:text-brand')}
                aria-current={pathname === '/' ? 'page' : undefined}
              >
                Início
              </Link>
            </li>
            <li>
              <Link
                to="/"
                hash="catalogo"
                className={cn(navLink, isMarket ? activeLink : 'font-normal text-foreground hover:text-brand')}
                aria-current={isMarket ? 'page' : undefined}
              >
                Mercado
              </Link>
            </li>
            <li>
              <span className={cn(navLink, 'cursor-not-allowed text-foreground/60')} aria-disabled="true" title="Indisponível">
                Criadores
              </span>
            </li>
            <li>
              <span className={cn(navLink, 'cursor-not-allowed text-foreground/60')} aria-disabled="true" title="Indisponível">
                Aprenda
              </span>
            </li>
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-3 pb-[10px] lg:gap-7">
          <Link
            to="/"
            hash="catalogo"
            className="grid size-8 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Buscar no catálogo"
          >
            <img src="/assets/icons/search.svg" alt="" width={20} height={20} />
          </Link>
          <Link
            to="/cart"
            className="grid size-8 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Carrinho"
            activeProps={{ 'aria-current': 'page' }}
          >
            {/* O badge com a contagem entra quando o carrinho existir quando o carrinho existir; nada de número falso. */}
            <img src="/assets/icons/cart.svg" alt="" width={24} height={24} />
          </Link>
          <AccountActions />
        </div>
      </div>
    </header>
  )
}

const primaryAction =
  'inline-flex h-[35px] items-center justify-center gap-1 rounded-md bg-primary px-3 text-base font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70 lg:min-w-[100px]'

/** "Entrar" (Figma) para convidado; perfil + "Sair" para usuário logado (estado não desenhado no Figma). */
function AccountActions() {
  const user = useCurrentUser()
  const logout = useLogoutMutation()
  const navigate = useNavigate()
  const onProtected = useRouterState({ select: (s) => s.matches.some((m) => m.routeId === '/_auth') })

  if (!user) {
    return (
      <Link to="/login" className={primaryAction}>
        <img src="/assets/icons/login.svg" alt="" width={18} height={17} className="m-px" />
        Entrar
      </Link>
    )
  }

  const onLogout = async () => {
    // Sai da rota protegida ANTES de encerrar a sessão: a navegação nova cancela qualquer `beforeLoad`
    // pendente (ex.: revalidação logo após o login), que senão mandaria para /login?redirect=…
    if (onProtected) await navigate({ to: '/', replace: true })
    await logout.mutateAsync()
    notify.success('Você saiu da conta.')
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/profile"
        className="flex items-center gap-2 rounded-md text-sm outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring"
        activeProps={{ 'aria-current': 'page' }}
        aria-label={`Meu perfil (${user.name})`}
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-surface-dark text-sm font-bold text-brand"
        >
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[10ch] truncate xl:inline">{firstName(user)}</span>
      </Link>
      <button type="button" onClick={() => void onLogout()} disabled={logout.isPending} className={primaryAction}>
        <LogOut className="size-[18px]" aria-hidden />
        Sair
      </button>
    </div>
  )
}
