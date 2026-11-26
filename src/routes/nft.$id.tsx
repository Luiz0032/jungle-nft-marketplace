import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import { nftDetailQuery } from '@/features/nft/queries'
import { isApiError } from '@/lib/http'
import { formatEth } from '@/lib/money'

// Versão mínima do detalhe (valida o tempo real). Layout final do Figma
export const Route = createFileRoute('/nft/$id')({
  component: NftPage,
})

function NftPage() {
  const { id } = Route.useParams()
  const query = useQuery(nftDetailQuery(id))

  if (query.isPending) {
    return (
      <div className="py-10" aria-busy="true" aria-label="Carregando NFT">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 h-24 w-full max-w-md animate-pulse rounded-md bg-muted" />
      </div>
    )
  }

  if (query.isError) {
    if (isApiError(query.error, 'NOT_FOUND')) return <NotFound />
    return (
      <div role="alert" className="py-10">
        <p>Não foi possível carregar este NFT.</p>
        <Button className="mt-4" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const nft = query.data
  return (
    <section aria-labelledby="nft-title" className="py-10">
      <p className="text-sm text-muted-foreground">{nft.collection.name}</p>
      <h1 id="nft-title" className="text-2xl font-bold">
        {nft.title}
      </h1>
      <ul className="mt-6 flex max-w-md flex-col gap-3">
        {nft.editions.map((edition) => (
          <li key={edition.id} className="flex items-center justify-between rounded-lg border p-4">
            <span>{edition.label}</span>
            <span className="text-right">
              <span className="block font-semibold" data-testid={`edition-price-${edition.id}`}>
                {formatEth(edition.price)}
              </span>
              <span className="block text-sm text-muted-foreground" data-testid={`edition-available-${edition.id}`}>
                {edition.available === 0 ? 'Esgotado' : `${edition.available} disponíveis`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
