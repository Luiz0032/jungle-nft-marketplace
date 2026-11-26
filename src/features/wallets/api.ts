import { WalletListSchema, WalletSchema, type CreateWalletInput, type UpdateWalletInput } from '@/contracts'
import { request } from '@/lib/http'

export const fetchWallets = (signal?: AbortSignal) => request(WalletListSchema, { url: '/wallets', signal })

export const createWallet = (input: CreateWalletInput) =>
  request(WalletSchema, { method: 'post', url: '/wallets', data: input })

export const updateWallet = ({ id, ...input }: UpdateWalletInput & { id: string }) =>
  request(WalletSchema, { method: 'patch', url: `/wallets/${encodeURIComponent(id)}`, data: input })
