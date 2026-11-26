import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

type Crumb = { label: string; link?: Pick<LinkProps, 'to' | 'hash' | 'params' | 'search'> }

/** Trilha do Figma (Carrinho/Pagamento): "Início / Mercado / …" em 16 Bold, só no desktop. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha" className="hidden text-base leading-5 font-bold text-foreground lg:block">
      <ol className="flex flex-wrap gap-2">
        {items.map((c, i) => (
          <li key={c.label} className="flex gap-2" aria-current={i === items.length - 1 ? 'page' : undefined}>
            {c.link ? (
              <Link {...(c.link as LinkProps)} className="rounded-sm outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">
                {c.label}
              </Link>
            ) : (
              <Fragment>{c.label}</Fragment>
            )}
            {i < items.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Cabeçalho das telas mobile do Figma (Carrinho 16:360, Pagamento 16:748): botão redondo de voltar + título
 * centralizado. No desktop o título fica só para leitores de tela (a trilha cumpre o papel visual).
 */
export function MobileTitle({ back, backLabel, children }: { back: Pick<LinkProps, 'to' | 'hash'>; backLabel: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-9 items-center justify-center lg:block lg:min-h-0">
      <Link
        {...(back as LinkProps)}
        aria-label={backLabel}
        className="absolute left-0 grid size-9 place-items-center rounded-full bg-surface-raised text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <h1 className="px-11 text-center text-xl leading-7 font-bold text-foreground lg:sr-only">{children}</h1>
    </div>
  )
}
