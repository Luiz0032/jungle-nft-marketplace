import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/_auth/checkout')({
  component: () => <PagePlaceholder title="Finalizar compra" />,
})
