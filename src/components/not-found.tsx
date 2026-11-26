import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { usePageMeta } from '@/lib/page-meta'

export function NotFound() {
  usePageMeta('Página não encontrada', 'A página procurada não existe no marketplace Kurio.')
  return (
    <section
      aria-labelledby="not-found-title"
      className="mx-auto flex max-w-xl flex-col items-center gap-4 py-24 text-center"
    >
      <p className="text-sm font-medium text-muted-foreground">Erro 404</p>
      <h1 id="not-found-title" className="text-3xl font-bold">
        Página não encontrada
      </h1>
      <p className="text-muted-foreground">O endereço que você acessou não existe ou foi removido.</p>
      <Button asChild>
        <Link to="/">Voltar para o início</Link>
      </Button>
    </section>
  )
}
