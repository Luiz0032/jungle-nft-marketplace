import type { Edition, Order } from '@/contracts'

/**
 * Barramento INTERNO do servidor mock (não é exposto à app).
 * Mudanças de estado do "backend" publicam aqui; `src/mocks/socket.ts` liga
 * a este barramento para emitir `nft.updated` / `order.updated` pelo Socket.IO.
 */
export type ServerEvent =
  | { type: 'edition.changed'; nftId: string; nftVersion: number; edition: Edition }
  | { type: 'order.changed'; userId: string; order: Order }

type Listener = (event: ServerEvent) => void
const listeners = new Set<Listener>()

export function onServerEvent(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publish(event: ServerEvent) {
  for (const l of listeners) l(event)
}
