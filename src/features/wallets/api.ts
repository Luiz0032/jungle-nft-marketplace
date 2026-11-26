import { WalletListSchema } from '@/contracts'
import { request } from '@/lib/http'

export const fetchWallets = (signal?: AbortSignal) => request(WalletListSchema, { url: '/wallets', signal })
