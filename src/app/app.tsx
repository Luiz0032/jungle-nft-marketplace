import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'
import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'
import { AuthContext } from '@/features/auth/hooks'
import { createAuth } from '@/features/auth/session'
import { notify } from '@/lib/notify'
import { createRealtime } from '@/lib/realtime'
import { onSocketChange } from '@/lib/socket'

/**
 * Serviços da app, criados UMA vez (singleton de módulo, não `useState`: o StrictMode chamaria o
 * inicializador duas vezes e abriria dois sockets). Instalados de forma síncrona, antes do primeiro
 * `beforeLoad` do router — senão a validação da sessão sairia sem o token.
 */
function createAppServices() {
  const queryClient = createQueryClient()
  let getUserId: () => string | null = () => null // `auth` ainda não existe; resolvido por evento
  const realtime = createRealtime({ queryClient, getUserId: () => getUserId() })
  const auth = createAuth({ queryClient, realtime })
  getUserId = auth.userId
  const router = createAppRouter(queryClient, auth)

  auth.setExpiredHandler(() => {
    notify.info('Sua sessão expirou. Entre novamente para continuar.')
    // Em rota protegida, volta ao login guardando o destino; em rota pública, só avisa.
    if (router.state.matches.some((m) => m.routeId === '/_auth')) {
      void router.navigate({
        to: '/login',
        search: { redirect: router.state.location.href, reason: 'expired' },
        replace: true,
      })
    }
  })

  onSocketChange((socket) => realtime.attach(socket))
  auth.install()
  return { queryClient, auth, router }
}

let services: ReturnType<typeof createAppServices> | undefined
const getServices = () => (services ??= createAppServices())

export function App() {
  const { queryClient, auth, router } = getServices()

  // Refresh: confirma a sessão salva com GET /auth/session (rotas protegidas também aguardam isso).
  useEffect(() => {
    void auth.ensureSession()
  }, [auth])

  return (
    <AuthContext value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext>
  )
}
