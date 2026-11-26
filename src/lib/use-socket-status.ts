import { useEffect, useState } from 'react'
import { getSocket, onSocketChange } from '@/lib/socket'

/** O socket atual está conectado? Reage a troca de socket (login/logout) e a quedas/reconexões. */
export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(() => getSocket()?.connected ?? false)
  useEffect(() => {
    let detach: (() => void) | null = null
    const off = onSocketChange((socket) => {
      detach?.()
      detach = null
      setConnected(socket?.connected ?? false)
      if (!socket) return
      const up = () => setConnected(true)
      const down = () => setConnected(false)
      socket.on('connect', up)
      socket.on('disconnect', down)
      socket.io.on('reconnect_attempt', down)
      detach = () => {
        socket.off('connect', up)
        socket.off('disconnect', down)
        socket.io.off('reconnect_attempt', down)
      }
    })
    return () => {
      detach?.()
      off()
    }
  }, [])
  return connected
}
