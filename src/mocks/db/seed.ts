import Big from 'big.js'
import { toEth } from '@/lib/money'
import {
  ADJECTIVES,
  COLLECTIONS,
  CREATORS,
  EDITION_TIERS,
  NOUNS,
} from '@/mocks/fixtures/catalog'
import { hashPassword } from '@/mocks/lib/crypto'
import { createRng } from '@/mocks/lib/random'
import type { DbState, NftRecord, UserRecord } from './types'

export const SEED = 20261126
export const NFT_COUNT = 48
const BASE_DATE = Date.UTC(2026, 9, 1, 12, 0, 0)

export const SEED_USERS = [
  { id: 'usr-ana', name: 'Ana Souza', email: 'ana@jungle.test', password: 'Senha@123', salt: 'seed-salt-ana' },
  { id: 'usr-bruno', name: 'Bruno Lima', email: 'bruno@jungle.test', password: 'Senha@123', salt: 'seed-salt-bruno' },
] as const

/** Artes do Figma (public/assets/nft, webp 400/800). Cada NFT usa 3 delas em rodízio. */
const ARTWORKS = ['emerald-ape', 'sage-nomad', 'neon-vessel', 'golden-beat'] as const
export const imageUrl = (nftIndex: number, k: number) =>
  `/assets/nft/${ARTWORKS[(nftIndex + k) % ARTWORKS.length]}-800.webp`

function buildNfts(): NftRecord[] {
  const rng = createRng(SEED)
  return Array.from({ length: NFT_COUNT }, (_, i) => {
    const n = i + 1
    const id = `nft-${String(n).padStart(3, '0')}`
    const collection = COLLECTIONS[i % COLLECTIONS.length]!
    const noun = NOUNS[i % NOUNS.length]!
    const adjective = rng.pick(ADJECTIVES)
    const baseMilli = rng.int(8, 2400)
    const tierCount = rng.int(1, 3)
    const editions = EDITION_TIERS.slice(0, tierCount).map((tier) => ({
      id: `${id}-${tier.suffix}`,
      label: tier.label,
      price: toEth(new Big(baseMilli).times(tier.multiplier).div(1000)),
      available: rng.int(tier.stock[0], tier.stock[1]),
      version: 1,
    }))
    const title = `${noun} ${adjective} #${String(n).padStart(3, '0')}`
    return {
      id,
      title,
      collection: { slug: collection.slug, name: collection.name },
      // A maioria segue a categoria da coleção; ~1/4 varia para os filtros combinarem de forma interessante.
      category: rng.next() < 0.25 ? rng.pick(['arte', 'games', 'musica', 'fotografia', 'colecionaveis'] as const) : collection.category,
      description: `${title} faz parte da coleção ${collection.name}. Peça digital única, cunhada para colecionadores da selva.`,
      images: [0, 1, 2].map((k) => imageUrl(i, k)),
      creator: { name: rng.pick(CREATORS), address: `0x${rng.hex(40)}` },
      editions,
      version: 1,
      popularity: rng.int(0, 1000),
      createdAt: new Date(BASE_DATE + i * 9 * 3_600_000).toISOString(),
    }
  })
}

async function buildUsers(): Promise<UserRecord[]> {
  return Promise.all(
    SEED_USERS.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: null,
      salt: u.salt,
      passwordHash: await hashPassword(u.password, u.salt),
    })),
  )
}

export async function createSeed(): Promise<DbState> {
  const rng = createRng(SEED + 1)
  return {
    schemaVersion: 2,
    seq: 0,
    users: await buildUsers(),
    sessions: [],
    nfts: buildNfts(),
    favorites: { 'usr-ana': ['nft-001', 'nft-005'], 'usr-bruno': [] },
    carts: {},
    quotes: {},
    orders: {},
    wallets: {
      'usr-ana': [
        { id: 'wal-ana-1', label: 'MetaMask principal', address: `0x${rng.hex(40)}`, network: 'ethereum', primary: true },
        { id: 'wal-ana-2', label: 'Carteira Polygon', address: `0x${rng.hex(40)}`, network: 'polygon', primary: false },
      ],
      'usr-bruno': [
        { id: 'wal-bruno-1', label: 'Coinbase Wallet', address: `0x${rng.hex(40)}`, network: 'base', primary: true },
      ],
    },
    coupons: [
      { code: 'JUNGLE10', percent: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
      { code: 'EXPIRED5', percent: 5, expiresAt: '2020-01-01T00:00:00.000Z' },
    ],
    networkFee: '0.0025',
  }
}
