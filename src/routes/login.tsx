import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: () => <PagePlaceholder title="Entrar" />,
})
