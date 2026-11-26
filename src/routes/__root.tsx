import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { NotFound } from '@/components/not-found'
import { SiteHeader } from '@/components/site-header'

export type RouterContext = { queryClient: QueryClient }

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      Promise.all([import('@tanstack/react-router-devtools'), import('@tanstack/react-query-devtools')]).then(
        ([router, query]) => ({
          default: () => (
            <>
              <router.TanStackRouterDevtools position="bottom-right" />
              <query.ReactQueryDevtools buttonPosition="bottom-left" />
            </>
          ),
        }),
      ),
    )
  : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-7xl px-4">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  )
}
