import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { NotFound } from '@/components/not-found'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import type { Auth } from '@/features/auth/session'
import { LIVE_REGION_ID } from '@/lib/notify'

export type RouterContext = { queryClient: QueryClient; auth: Auth }

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

// Figma mobile de Login/Cadastro é tela cheia, sem header/footer.
const AUTH_SCREENS = /^\/(login|register)\/?$/

function RootLayout() {
  const authScreen = useRouterState({ select: (s) => AUTH_SCREENS.test(s.location.pathname) })
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader className={authScreen ? 'max-lg:hidden' : undefined} />
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-content flex-1 px-4 outline-none lg:px-0">
          <Outlet />
        </main>
        <SiteFooter className={authScreen ? 'max-lg:hidden' : undefined} />
      </div>
      <div id={LIVE_REGION_ID} aria-live="polite" aria-atomic="true" className="sr-only" />
      {/* Embaixo: no topo direito o toast cobria o botão Entrar/Sair do header. */}
      <Toaster theme="dark" richColors position="bottom-right" />
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  )
}
