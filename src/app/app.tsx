import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'
import { createRealtime } from '@/lib/realtime'
import { connectSocket, disconnectSocket, onSocketChange } from '@/lib/socket'

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createAppRouter(queryClient))
  // `getUserId` passa a ler a sessão; login/logout reconectam o socket.
  const [realtime] = useState(() => createRealtime({ queryClient, getUserId: () => null }))

  useEffect(() => {
    const off = onSocketChange((socket) => realtime.attach(socket))
    connectSocket(null)
    return () => {
      off()
      realtime.attach(null)
      disconnectSocket()
    }
  }, [realtime])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
