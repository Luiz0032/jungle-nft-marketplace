import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/nft/$id')({
  component: NftPage,
})

function NftPage() {
  const { id } = Route.useParams()
  return (
    <PagePlaceholder title="Detalhe do NFT">
      <p className="mt-4 text-sm" data-testid="nft-id">
        ID: {id}
      </p>
    </PagePlaceholder>
  )
}
