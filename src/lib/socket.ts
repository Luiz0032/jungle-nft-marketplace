import { io, type Socket } from 'socket.io-client'
import { SOCKET_AUTH_ERROR_EVENT } from '@/contracts/realtime'
import { env } from '@/lib/env'

/**
 * Conexão Socket.IO única da app.
 * - `transports: ['websocket']`: long-polling não é interceptado pelo MSW (ver ARCHITECTURE §5).
 * - Convidado conecta anônimo (recebe só eventos públicos); login reconecta com `auth: { token }`;
 *   logout desconecta, e a app reconecta anônimo depois de limpar o cache.
 * - IMPORTANTE: este módulo só pode ser avaliado DEPOIS de `worker.start()` — o engine.io-client
 *   captura `globalThis.WebSocket` na avaliação do módulo. Por isso `main.tsx` importa a app dinamicamente.
 */

type SocketListener = (socket: Socket | null) => void

let socket: Socket | null = null
let onAuthError: (() => void) | null = null
const listeners = new Set<SocketListener>()

const notify = () => {
  for (const l of listeners) l(socket)
}

export function connectSocket(token: string | null): Socket {
  disconnectSocket()
  const next = io(env.socketUrl, {
    transports: ['websocket'],
    auth: token ? { token } : {},
    reconnectionDelay: 500,
    reconnectionDelayMax: 3_000,
  })
  next.on(SOCKET_AUTH_ERROR_EVENT, () => onAuthError?.())
  socket = next
  notify()
  return next
}

/** Desconecta e remove TODOS os listeners do socket atual (eventos tardios da sessão antiga são descartados). */
export function disconnectSocket() {
  if (!socket) return
  const old = socket
  socket = null
  notify() // camada realtime se desliga antes do disconnect
  old.removeAllListeners()
  old.io.removeAllListeners()
  old.disconnect()
}

export const getSocket = () => socket

/** Notificado a cada troca de socket (conexão nova ou `null`). Retorna o unsubscribe. */
export function onSocketChange(listener: SocketListener) {
  listeners.add(listener)
  listener(socket)
  return () => {
    listeners.delete(listener)
  }
}

/** Handler para token recusado no handshake (a auth trata como sessão expirada). */
export function setSocketAuthErrorHandler(handler: (() => void) | null) {
  onAuthError = handler
}
