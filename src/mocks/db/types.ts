import type {
  CategorySlug,
  CollectionRef,
  Edition,
  Eth,
  GuestItem,
  Network,
  Order,
  Quote,
  Receipt,
  Wallet,
} from '@/contracts'

export type UserRecord = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  passwordHash: string
  salt: string
}

export type SessionRecord = { token: string; userId: string; expiresAt: string }

export type NftRecord = {
  id: string
  title: string
  collection: CollectionRef
  category: CategorySlug
  description: string
  images: string[]
  creator: { name: string; address: string }
  editions: Edition[]
  version: number
  popularity: number
  createdAt: string
}

export type CartRecord = { items: (GuestItem & { id: string })[]; version: number }

export type QuoteRecord = {
  quote: Quote
  userId: string | null
  couponCode: string | null
  /** `editionId:version:price` de cada linha — muda se qualquer preço/estoque mudar. */
  fingerprint: string
}

export type OrderRecord = {
  order: Order
  userId: string
  idempotencyKey: string
  /** JSON estável do corpo — mesma key com payload diferente → 409. */
  payload: string
  network: Network
  resolveAt: string
  outcome: 'confirmed' | 'rejected'
  /** `order-hold`: só sai de `pending` por `window.__mock.settleOrder()` (sem timer nem assentamento preguiçoso). */
  held?: boolean
  /** Snapshot tirado na criação; vira `order.receipt` quando confirmado. */
  snapshot: Receipt
  reservations: { nftId: string; editionId: string; quantity: number }[]
}

export type CouponRecord = { code: string; percent: number; expiresAt: string }

export type DbState = {
  schemaVersion: 2
  seq: number
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: NftRecord[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  wallets: Record<string, Wallet[]>
  coupons: CouponRecord[]
  networkFee: Eth
}
