import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/_auth/orders/$id')({
  component: OrderPage,
})

function OrderPage() {
  const { id } = Route.useParams()
  return (
    <PagePlaceholder title="Pedido">
      <p className="mt-4 text-sm">ID: {id}</p>
    </PagePlaceholder>
  )
}
