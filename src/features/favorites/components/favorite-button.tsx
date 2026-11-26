import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useCurrentUser } from '@/features/auth/hooks'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useFavoriteIds, useToggleFavorite } from '../queries'

/**
 * Coração de favoritar (card, galeria, detalhe). Convidado → login com retorno para a página atual.
 * `variant="pill"` = botão "Favoritar" do detalhe (Figma Frame 162); `icon` = círculo sobre a arte.
 */
export function FavoriteButton({
  nftId,
  title,
  variant = 'icon',
  className,
}: {
  nftId: string
  title: string
  variant?: 'icon' | 'pill'
  className?: string
}) {
  const user = useCurrentUser()
  const { ids: favorites, ready } = useFavoriteIds()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const active = favorites.has(nftId)

  const onClick = () => {
    if (!user) {
      notify.info('Entre na sua conta para favoritar.')
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    toggle.mutate({ nftId, title, favorite: !active })
  }

  const label = active ? `Remover ${title} dos favoritos` : `Favoritar ${title}`
  const icon = <Heart aria-hidden className={cn('size-5', active && 'fill-current')} />

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!ready}
        aria-pressed={active}
        aria-label={label}
        className={cn(
          'flex h-10 disabled:cursor-wait disabled:opacity-60 w-[130px] items-center justify-center gap-2 rounded-md border border-primary text-base font-medium outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'text-brand' : 'text-foreground',
          className,
        )}
      >
        {icon}
        {active ? 'Favorito' : 'Favoritar'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'grid size-[35px] disabled:cursor-wait disabled:opacity-60 place-items-center rounded-full bg-ink/80 text-foreground outline-none backdrop-blur-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-ring',
        active && 'text-brand',
        className,
      )}
    >
      {icon}
    </button>
  )
}
