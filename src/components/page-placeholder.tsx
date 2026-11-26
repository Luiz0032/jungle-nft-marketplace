import type { ReactNode } from 'react'

/** Esqueleto temporário de tela. Sem botões de ação: nada finge funcionar (invariante 10). */
export function PagePlaceholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="py-10">
      <h1 id="page-title" className="text-2xl font-bold">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">Tela em construção.</p>
      {children}
    </section>
  )
}
