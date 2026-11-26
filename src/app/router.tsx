import { createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { Auth } from '@/features/auth/session'
import { NotFound } from '@/components/not-found'
import { routeTree } from '@/routeTree.gen'

export function createAppRouter(queryClient: QueryClient, auth: Auth) {
  return createRouter({
    routeTree,
    context: { queryClient, auth },
    defaultPreload: 'intent',
    // Dados ficam no TanStack Query; o router não cacheia loaders por conta própria.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
