import type { User } from '@/contracts'
import { cn } from '@/lib/utils'

/** Avatar do usuário: a imagem enviada (data URL) ou a inicial do nome. Decorativo — o nome sempre está ao lado. */
export function UserAvatar({ user, className }: { user: Pick<User, 'name' | 'avatarUrl'>; className?: string }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" aria-hidden="true" className={cn('rounded-full object-cover', className)} />
  }
  return (
    <span
      aria-hidden="true"
      className={cn('grid place-items-center rounded-full bg-surface-dark font-bold text-brand', className)}
    >
      {user.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
