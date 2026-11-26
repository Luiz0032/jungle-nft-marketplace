import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth, useCurrentUser } from '@/features/auth/hooks'
import { couponStore } from '@/features/quote/coupon'
import { walletConnection } from '@/features/wallets/connection'
import { attempts } from '@/lib/idempotency'
import { notify } from '@/lib/notify'
import { queryKeys } from '@/lib/query-keys'
import { mergeCart } from '../api'
import { guestCart, useGuestCart } from '../guest-cart'

/**
 * Sem UI. Ao entrar (convidado → usuário, inclusive após refresh), junta o carrinho de convidado ao da conta
 * com POST /cart/merge (servidor soma e limita ao estoque) e só então limpa o localStorage. Falha mantém os
 * itens guardados (`merge = 'error'`) e a tela do carrinho oferece tentar de novo.
 */
export function CartSync() {
  const auth = useAuth()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const { items, merge } = useGuestCart()
  const userId = user?.id ?? null
  const lastUser = useRef<string | null>(userId)

  // Troca de usuário: esquece cupom em memória (o storage privado já foi apagado pelo wipe) e tentativas antigas.
  useEffect(() => {
    if (lastUser.current === userId) return
    lastUser.current = userId
    couponStore.forget()
    attempts.forget()
    walletConnection.forget()
    guestCart.setMerge('idle')
  }, [userId])

  useEffect(() => {
    // Lê o estado atual (não o do closure): o StrictMode reexecuta o efeito com o mesmo closure.
    if (!userId || items.length === 0 || guestCart.get().merge !== 'idle') return
    guestCart.setMerge('pending')
    const guestCoupon = couponStore.get('guest')
    mergeCart(items)
      .then((cart) => {
        if (auth.userId() !== userId) return // saiu/trocou durante a fusão: resposta descartada
        queryClient.setQueryData(queryKeys.cart(userId), cart)
        guestCart.clear()
        if (guestCoupon && !couponStore.get(userId)) couponStore.set(userId, guestCoupon)
        couponStore.set('guest', null)
        guestCart.setMerge('idle')
        notify.info('Os itens que você adicionou antes de entrar foram para o seu carrinho.')
      })
      .catch(() => {
        if (auth.userId() !== userId) return
        guestCart.setMerge('error')
        notify.error('Não foi possível juntar os itens do carrinho de convidado à sua conta.')
      })
  }, [auth, queryClient, userId, items, merge])

  return null
}
