import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cleanSearch, type CatalogSearch } from '../search'

const box =
  'grid size-[35px] place-items-center rounded-[4px] border text-base leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Paginação — Figma "Pagination" (70342:2825): caixas 35×35, gap 8, atual em primary. Janela de 4 páginas. */
export function Pagination({ search, page, totalPages }: { search: CatalogSearch; page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const start = Math.max(1, Math.min(page - 1, totalPages - 3))
  const pages = Array.from({ length: Math.min(4, totalPages) }, (_, i) => start + i)
  const to = (p: number) => cleanSearch({ ...search, page: p })

  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end gap-2">
      {page > 1 && (
        <Link to="/" search={to(page - 1)} hash="catalogo" className={cn(box, 'border-border')} aria-label="Página anterior">
          <ChevronLeft className="size-[18px]" aria-hidden />
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          to="/"
          search={to(p)}
          hash="catalogo"
          aria-label={`Página ${p}`}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            box,
            p === page ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-border hover:border-primary',
          )}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link to="/" search={to(page + 1)} hash="catalogo" className={cn(box, 'border-border')} aria-label="Próxima página">
          <ChevronRight className="size-[18px]" aria-hidden />
        </Link>
      )}
    </nav>
  )
}
