import { useEffect, useRef } from 'react'
import { useRealtime } from '@/app/realtime-context'
import { formatEth } from '@/lib/money'
import { notify } from '@/lib/notify'
import type { CartLine } from './queries'

/**
 * `nft.updated` de um NFT que está no carrinho (tela de carrinho ou checkout aberta) → toast + aria-live dizendo
 * o que mudou. O recálculo vem sozinho: o realtime já invalidou carrinho e cotação.
 */
export function useLiveCartNotice(lines: CartLine[], suffix = 'Resumo recalculado.') {
  const realtime = useRealtime()
  const latest = useRef(lines)
  useEffect(() => {
    latest.current = lines // último estado renderizado (antes do evento): base para dizer o que mudou
  })

  useEffect(
    () =>
      realtime.subscribe((e) => {
        if (e.type !== 'nft.updated') return
        const { nftId, editionId, price, available } = e.payload
        const affected = latest.current.filter((l) => l.nftId === nftId && (!editionId || l.editionId === editionId))
        for (const line of affected) {
          const parts: string[] = []
          if (price !== undefined && price !== line.unitPrice) parts.push(`preço agora ${formatEth(price)}`)
          if (available !== undefined && available !== line.available)
            parts.push(available === 0 ? 'esgotada' : `estoque agora ${available} ${available === 1 ? 'unidade' : 'unidades'}`)
          if (parts.length > 0) notify.info(`${line.title} (${line.editionLabel}): ${parts.join(', ')}. ${suffix}`)
        }
      }),
    [realtime, suffix],
  )
}
