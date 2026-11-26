import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/cart')({
  component: () => <PagePlaceholder title="Carrinho" />,
})
