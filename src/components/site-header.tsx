import { Link } from '@tanstack/react-router'

const nav = [
  { to: '/', label: 'Explorar' },
  { to: '/cart', label: 'Carrinho' },
  { to: '/login', label: 'Entrar' },
] as const

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-bold">
          Jungle<span className="text-brand"> NFT</span>
        </Link>
        <nav aria-label="Principal">
          <ul className="flex gap-4 text-sm">
            {nav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  activeProps={{ className: 'text-foreground', 'aria-current': 'page' }}
                  activeOptions={{ exact: item.to === '/' }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
