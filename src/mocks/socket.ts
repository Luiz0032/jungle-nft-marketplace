import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import { nanoid } from 'nanoid'
import {
  RealtimeEventSchema,
  SOCKET_AUTH_ERROR_EVENT,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type RealtimeEvent,
} from '@/contracts'
import { env } from '@/lib/env'
import { db } from '@/mocks/db'
import { onServerEvent, type ServerEvent } from '@/mocks/events'

/**
 * Servidor Socket.IO mock (invariante 2: todo evento de tempo real nasce AQUI e chega à app
 * pelo `socket.io-client`). Interceptado por `ws.link` do MSW + `toSocketIo`.
 *
 * Achados do binding 0.2 (ver ARCHITECTURE "Limitações do binding"):
 * - Ele envia sozinho o OPEN do Engine.IO e o CONNECT do Socket.IO (`0{…}` / `40{…}`), sem esperar
 *   o CONNECT do cliente → a autenticação é feita lendo o pacote `40{auth}` cru do cliente.
 *   Token inválido: emitimos `auth_error` e mandamos DISCONNECT (`41`).
 * - Ele não envia PING; sem isso o cliente derruba a conexão após pingInterval+pingTimeout (30 s).
 * - O MSW 2.15 reescreve o path `/socket.io/` do cliente para `/` ANTES de casar a URL
 *   (`WebSocketHandler.parse`). Por isso o wildcard é na raiz: `/*` cobre `/socket.io/?EIO=4…`;
 *   um padrão `…/socket.io/*` NUNCA casa e a conexão vaza para a rede real.
 */

const link = ws.link(`${env.socketUrl}/*`)

type SocketIo = ReturnType<typeof toSocketIo>
type Conn = {
  id: string
  /** null até o CONNECT do cliente chegar; depois `anonymous` ou `user`. */
  state: 'handshake' | 'anonymous' | 'user'
  userId: string | null
  io: SocketIo
  close: () => void
}

const PING_INTERVAL_MS = 20_000
const LOG_LIMIT = 200

const connections = new Set<Conn>()
const emitted: RealtimeEvent[] = []
let outageUntil = 0

function authenticate(token: unknown): { ok: true; userId: string | null } | { ok: false } {
  if (token === undefined || token === null || token === '') return { ok: true, userId: null }
  const session = db().sessions.find((s) => s.token === token)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return { ok: false }
  return { ok: true, userId: session.userId }
}

/** Pacote CONNECT do cliente: `40` ou `40{"token":"…"}` (namespace padrão). */
function parseConnectPacket(data: string): Record<string, unknown> | null {
  if (!data.startsWith('40')) return null
  const json = data.slice(2)
  if (json === '') return {}
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const socketHandlers = [
  link.addEventListener('connection', (connection) => {
    const { client } = connection
    const io = toSocketIo(connection as Parameters<typeof toSocketIo>[0])
    const conn: Conn = { id: client.id, state: 'handshake', userId: null, io, close: () => client.close() }

    // `socket-drop`: durante a "queda", novas conexões caem logo após o handshake.
    if (Date.now() < outageUntil) {
      setTimeout(() => client.close(), 50)
      return
    }

    connections.add(conn)
    const ping = setInterval(() => client.send('2'), PING_INTERVAL_MS)

    client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return
      const auth = parseConnectPacket(event.data)
      if (!auth || conn.state !== 'handshake') return
      const result = authenticate(auth.token)
      if (!result.ok) {
        io.client.emit(SOCKET_AUTH_ERROR_EVENT, { code: 'SESSION_EXPIRED' })
        client.send('41')
        connections.delete(conn)
        return
      }
      conn.userId = result.userId
      conn.state = result.userId ? 'user' : 'anonymous'
    })

    client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(conn)
    })
  }),
]

/** Entrega um evento já montado: públicos para todos, privados só para conexões do dono. */
export function broadcast(event: RealtimeEvent) {
  emitted.push(event)
  if (emitted.length > LOG_LIMIT) emitted.shift()
  for (const conn of connections) {
    if (conn.state === 'handshake') continue
    if (event.userId !== null && conn.userId !== event.userId) continue
    conn.io.client.emit(event.type, event)
  }
}

function toRealtimeEvent(e: ServerEvent): RealtimeEvent {
  const base = { eventId: nanoid(), emittedAt: new Date().toISOString() }
  if (e.type === 'edition.changed') {
    return {
      ...base,
      type: 'nft.updated',
      resource: { type: 'edition', id: e.edition.id },
      version: e.edition.version,
      userId: null,
      payload: { nftId: e.nftId, editionId: e.edition.id, price: e.edition.price, available: e.edition.available },
    } satisfies NftUpdatedEvent
  }
  return {
    ...base,
    type: 'order.updated',
    resource: { type: 'order', id: e.order.id },
    version: e.order.version,
    userId: e.userId,
    payload: {
      orderId: e.order.id,
      status: e.order.status,
      transactionId: e.order.transactionId,
      rejectionReason: e.order.rejectionReason,
    },
  } satisfies OrderUpdatedEvent
}

// Mudanças de estado do backend mock viram eventos Socket.IO.
onServerEvent((e) => broadcast(toRealtimeEvent(e)))

export type EmitInput = Omit<RealtimeEvent, 'eventId' | 'emittedAt' | 'userId'> & {
  eventId?: string
  emittedAt?: string
  userId?: string | null
}

/** `window.__mock.emit`: envia um evento arbitrário PELO servidor socket (para testar dedupe/versão). */
export function emitRaw(input: EmitInput): RealtimeEvent {
  const event = RealtimeEventSchema.parse({
    eventId: nanoid(),
    emittedAt: new Date().toISOString(),
    userId: null,
    ...input,
  })
  broadcast(event)
  return event
}

/** Derruba as conexões (todas ou de um usuário) e recusa reconexões por `outageMs`. */
export function dropConnections({ userId, outageMs }: { userId?: string; outageMs: number }) {
  outageUntil = Date.now() + outageMs
  for (const conn of [...connections]) {
    if (userId === undefined || conn.userId === userId) conn.close()
  }
}

export const socketStats = () => ({
  connections: [...connections].filter((c) => c.state !== 'handshake').map((c) => ({ id: c.id, userId: c.userId })),
  emitted: [...emitted],
})

export function resetSocketServer() {
  emitted.length = 0
  outageUntil = 0
}
