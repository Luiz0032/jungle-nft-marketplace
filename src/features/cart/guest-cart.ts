import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { GuestItemSchema, type GuestItem } from '@/contracts'
import { readStorage, removeStorage, writeStorage } from '@/lib/storage'

/**
 * Carrinho de convidado: só `{ nftId, editionId, quantity }` em `localStorage['jg:guest-cart']` (chave pública,
 * sobrevive ao logout). Título, imagem, preço e estoque NÃO são guardados: vêm do detalhe do NFT (API),
 * para nunca exibir preço velho. Abas sincronizam pelo evento `storage`.
 *
 * `merge` coordena a fusão com o carrinho do servidor no login (ver `CartSync`):
 * - `idle`: nada a fazer ou fusão ainda não tentada;
 * - `pending`: POST /cart/merge em voo (a tela do carrinho espera);
 * - `error`: falhou — itens de convidado ficam guardados e a tela oferece tentar de novo.
 */

export const GUEST_CART_KEY = 'jg:guest-cart'
const GuestCartSchema = z.array(GuestItemSchema).max(100)

type MergeStatus = 'idle' | 'pending' | 'error'
type State = { items: GuestItem[]; merge: MergeStatus }

let state: State = { items: readStorage(GUEST_CART_KEY, GuestCartSchema) ?? [], merge: 'idle' }
const listeners = new Set<() => void>()

function set(next: Partial<State>, persist = true) {
  state = { ...state, ...next }
  if (persist && next.items) {
    if (next.items.length === 0) removeStorage(GUEST_CART_KEY)
    else writeStorage(GUEST_CART_KEY, next.items)
  }
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== GUEST_CART_KEY && e.key !== null) return
    set({ items: readStorage(GUEST_CART_KEY, GuestCartSchema) ?? [] }, false)
  })
}

export type GuestAddResult = { ok: true } | { ok: false; available: number }

export const guestCart = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Soma na mesma edição, respeitando o estoque informado pela API (mesma regra do servidor). */
  add(item: GuestItem, available: number): GuestAddResult {
    const existing = state.items.find((i) => i.editionId === item.editionId)
    const next = (existing?.quantity ?? 0) + item.quantity
    if (next > available) return { ok: false, available }
    set({
      items: existing
        ? state.items.map((i) => (i.editionId === item.editionId ? { ...i, quantity: next } : i))
        : [...state.items, item],
    })
    return { ok: true }
  },
  update(editionId: string, quantity: number) {
    set({ items: state.items.map((i) => (i.editionId === editionId ? { ...i, quantity } : i)) })
  },
  remove(editionId: string) {
    set({ items: state.items.filter((i) => i.editionId !== editionId) })
  },
  clear() {
    set({ items: [] })
  },
  setMerge(merge: MergeStatus) {
    if (state.merge !== merge) set({ merge }, false)
  },
}

export function useGuestCart(): State {
  return useSyncExternalStore(guestCart.subscribe, guestCart.get, guestCart.get)
}
