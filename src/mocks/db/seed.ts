import Big from 'big.js'
import { toEth } from '@/lib/money'
import type { NftImage } from '@/contracts'
import { ARTWORKS, artworkUrl } from '@/lib/artworks'
import { COLLECTIONS, CREATORS, EDITION_TIERS, SERIES } from '@/mocks/fixtures/catalog'
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

/**
 * Artes do Figma (public/assets/nft, webp 400/800). Cada NFT usa 3 delas em rodízio; a primeira é a da
 * série (título e descrição combinam com ela) e cada imagem leva o alt que descreve aquela arte.
 */
export const nftImage = (nftIndex: number, k: number): NftImage => {
  const artwork = SERIES[(nftIndex + k) % SERIES.length]!.artwork
  return { src: artworkUrl(artwork), alt: ARTWORKS[artwork] }
}

const pad3 = (n: number) => String(n).padStart(3, '0')

function buildNfts(): NftRecord[] {
  const rng = createRng(SEED)
  return Array.from({ length: NFT_COUNT }, (_, i) => {
    const n = i + 1
    const id = `nft-${pad3(n)}`
    const collection = COLLECTIONS[i % COLLECTIONS.length]!
    const series = SERIES[i % SERIES.length]!
    // Sorteio que antes escolhia o adjetivo do título: mantido para preços, estoque e categorias não mudarem.
    rng.next()
    const baseMilli = rng.int(8, 2400)
    const tierCount = rng.int(1, 3)
    const editions = EDITION_TIERS.slice(0, tierCount).map((tier) => ({
      id: `${id}-${tier.suffix}`,
      label: tier.label,
      price: toEth(new Big(baseMilli).times(tier.multiplier).div(1000)),
      available: rng.int(tier.stock[0], tier.stock[1]),
      version: 1,
    }))
    const title = `${series.name} #${pad3(Math.floor(i / SERIES.length) + 1)}`
    return {
      id,
      title,
      collection: { slug: collection.slug, name: collection.name },
      // A maioria segue a categoria da coleção; ~1/4 varia para os filtros combinarem de forma interessante.
      category: rng.next() < 0.25 ? rng.pick(['arte', 'games', 'musica', 'fotografia', 'colecionaveis'] as const) : collection.category,
      description: `${series.blurb} ${title} faz parte da coleção ${collection.name}. Peça digital única, cunhada para colecionadores.`,
      images: [0, 1, 2].map((k) => nftImage(i, k)),
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
    schemaVersion: 3,
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
