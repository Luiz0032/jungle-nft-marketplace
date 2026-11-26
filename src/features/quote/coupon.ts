import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { privateKey, readStorage, removeStorage, writeStorage } from '@/lib/storage'

/**
 * Cupom aplicado ao carrinho, por escopo (`userId` ou `'guest'`). Só é gravado depois que a API aceitou
 * (POST /quote com o cupom). Usuário: `jg:user:<id>:coupon` (privado, some no logout). Convidado: `jg:guest-coupon`.
 */

const CouponSchema = z.string().min(1).max(32)
const keyOf = (scope: string) => (scope === 'guest' ? 'jg:guest-coupon' : privateKey(scope, 'coupon'))

const listeners = new Set<() => void>()
const cache = new Map<string, string | null>()

export const normalizeCoupon = (code: string) => code.trim().toUpperCase()

export const couponStore = {
  get(scope: string): string | null {
    if (!cache.has(scope)) cache.set(scope, readStorage(keyOf(scope), CouponSchema))
    return cache.get(scope) ?? null
  },
  set(scope: string, code: string | null) {
    cache.set(scope, code)
    if (code) writeStorage(keyOf(scope), code)
    else removeStorage(keyOf(scope))
    for (const l of listeners) l()
  },
  /** Logout/troca de usuário: o storage privado já foi apagado; esquece a memória também. */
  forget() {
    cache.clear()
    for (const l of listeners) l()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useCoupon(scope: string): string | null {
  return useSyncExternalStore(
    couponStore.subscribe,
    () => couponStore.get(scope),
    () => couponStore.get(scope),
  )
}
