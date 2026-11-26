import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { NetworkSchema, WalletAddressSchema } from '@/contracts'
import { USER_REJECTED } from '@/contracts/wallet-extension'
import { privateKey, readStorage, removeStorage, writeStorage } from '@/lib/storage'

/**
 * Conexão com a extensão de carteira (`window.kurioWallet`), por usuário, em
 * `sessionStorage['jg:user:<id>:wallet-connection']` (privada: some no logout; não sobrevive ao fechar a aba,
 * como uma permissão de dapp). Só a extensão decide aprovar/recusar.
 */

const ConnectionSchema = z.object({ walletId: z.string(), address: WalletAddressSchema, network: NetworkSchema })
export type Connection = z.infer<typeof ConnectionSchema>

const key = (userId: string) => privateKey(userId, 'wallet-connection')
const listeners = new Set<() => void>()
const cache = new Map<string, Connection | null>()

function set(userId: string, value: Connection | null) {
  cache.set(userId, value)
  if (value) writeStorage(key(userId), value, 'session')
  else removeStorage(key(userId), 'session')
  for (const l of listeners) l()
}

const get = (userId: string) => {
  if (!cache.has(userId)) cache.set(userId, readStorage(key(userId), ConnectionSchema, 'session'))
  return cache.get(userId) ?? null
}

export class WalletConnectError extends Error {
  readonly reason: 'rejected' | 'missing' | 'mismatch' | 'failed'
  constructor(reason: WalletConnectError['reason'], message: string) {
    super(message)
    this.reason = reason
  }
}

export const walletConnection = {
  get,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  async connect(userId: string, wallet: { id: string; label: string; address: string; network: Connection['network'] }) {
    const extension = window.kurioWallet
    if (!extension) throw new WalletConnectError('missing', 'Nenhuma extensão de carteira encontrada neste navegador.')
    try {
      const result = await extension.connect({
        address: wallet.address,
        network: wallet.network,
        label: wallet.label,
        origin: window.location.host,
      })
      if (result.address.toLowerCase() !== wallet.address.toLowerCase() || result.network !== wallet.network) {
        throw new WalletConnectError('mismatch', 'A carteira conectou outra conta ou rede. Tente de novo.')
      }
      set(userId, { walletId: wallet.id, address: wallet.address, network: wallet.network })
    } catch (error) {
      if (error instanceof WalletConnectError) throw error
      if ((error as { code?: unknown } | null)?.code === USER_REJECTED) {
        throw new WalletConnectError('rejected', 'Conexão recusada na carteira.')
      }
      throw new WalletConnectError('failed', 'A carteira não respondeu. Tente de novo.')
    }
  },
  async disconnect(userId: string) {
    const current = get(userId)
    set(userId, null)
    if (current) await window.kurioWallet?.disconnect(current.address).catch(() => undefined)
  },
  forget() {
    cache.clear()
    for (const l of listeners) l()
  },
}

export function useWalletConnection(userId: string): Connection | null {
  return useSyncExternalStore(
    walletConnection.subscribe,
    () => get(userId),
    () => get(userId),
  )
}
