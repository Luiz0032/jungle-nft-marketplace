import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/_auth/profile')({
  component: () => <PagePlaceholder title="Meu perfil" />,
})
