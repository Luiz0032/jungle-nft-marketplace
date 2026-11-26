import { nanoid } from 'nanoid'
import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { CreateOrderInputSchema, type CreateOrderInput } from '@/contracts'
import { privateKey, readStorage, removeStorage, writeStorage } from '@/lib/storage'

/**
 * Tentativa de compra (invariante 9). Uma tentativa = UMA `Idempotency-Key` + o payload exato enviado com ela.
 * Persistida em `localStorage['jg:user:<id>:checkout-attempt']` (privada: some no logout) até o pedido chegar a
 * estado terminal. Regras:
 * - nova tentativa só quando não há outra em aberto (o botão de confirmar fica bloqueado enquanto houver);
 * - reenvio após falha sem resposta (timeout/rede) usa a MESMA key e o MESMO payload — o servidor devolve o
 *   pedido já criado em vez de criar outro;
 * - recusa definitiva do servidor (4xx: cotação desatualizada, estoque, validação) → a tentativa é descartada;
 * - pedido criado → guarda `orderId`; terminal (confirmed/rejected) → descartada.
 */

const AttemptSchema = z.object({
  key: z.string().min(1).max(128),
  input: CreateOrderInputSchema,
  orderId: z.string().nullable(),
  createdAt: z.string(),
})
export type Attempt = z.infer<typeof AttemptSchema>

const storageKey = (userId: string) => privateKey(userId, 'checkout-attempt')
const listeners = new Set<() => void>()
const cache = new Map<string, Attempt | null>()

function write(userId: string, attempt: Attempt | null) {
  cache.set(userId, attempt)
  if (attempt) writeStorage(storageKey(userId), attempt)
  else removeStorage(storageKey(userId))
  for (const l of listeners) l()
}

export const attempts = {
  get(userId: string): Attempt | null {
    if (!cache.has(userId)) cache.set(userId, readStorage(storageKey(userId), AttemptSchema))
    return cache.get(userId) ?? null
  },
  /** Abre uma tentativa nova. Lança se já existe uma em aberto (nunca gera key nova por cima de outra). */
  begin(userId: string, input: CreateOrderInput): Attempt {
    const open = attempts.get(userId)
    if (open) throw new Error('Já existe uma tentativa de compra em aberto.')
    const attempt: Attempt = { key: nanoid(), input, orderId: null, createdAt: new Date().toISOString() }
    write(userId, attempt)
    return attempt
  },
  recordOrder(userId: string, key: string, orderId: string) {
    const current = attempts.get(userId)
    if (current?.key === key) write(userId, { ...current, orderId })
  },
  /** Só descarta a tentativa indicada (uma resposta atrasada não apaga uma tentativa mais nova). */
  discard(userId: string, key: string) {
    if (attempts.get(userId)?.key === key) write(userId, null)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Troca de usuário: o storage privado já foi apagado pelo wipe; esquece a memória. */
  forget() {
    cache.clear()
    for (const l of listeners) l()
  },
}

export function useAttempt(userId: string): Attempt | null {
  return useSyncExternalStore(
    attempts.subscribe,
    () => attempts.get(userId),
    () => attempts.get(userId),
  )
}
