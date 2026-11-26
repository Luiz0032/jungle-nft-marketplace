import type { Cart, Edition, NftDetail, NftSummary } from '@/contracts'
import { compare, min } from '@/lib/money'
import { db } from '@/mocks/db'
import type { NftRecord } from '@/mocks/db'
import { publish } from '@/mocks/events'
import { fail } from './utils'

export function findNft(id: string): NftRecord | undefined {
  return db().nfts.find((n) => n.id === id)
}

export function findEdition(editionId: string): { nft: NftRecord; edition: Edition } | undefined {
  for (const nft of db().nfts) {
    const edition = nft.editions.find((e) => e.id === editionId)
    if (edition) return { nft, edition }
  }
  return undefined
}

export function requireEdition(editionId: string, nftId?: string) {
  const found = findEdition(editionId)
  if (!found || (nftId !== undefined && found.nft.id !== nftId)) {
    fail('NOT_FOUND', 'Edição não encontrada.', { details: { editionId } })
  }
  return found
}

export function nftPrice(nft: NftRecord) {
  const inStock = nft.editions.filter((e) => e.available > 0)
  const pool = inStock.length > 0 ? inStock : nft.editions
  return pool.map((e) => e.price).reduce((a, b) => min(a, b))
}

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    title: nft.title,
    collection: nft.collection,
    category: nft.category,
    image: nft.images[0]!,
    price: nftPrice(nft),
    available: nft.editions.reduce((acc, e) => acc + e.available, 0),
    version: nft.version,
  }
}

export function toDetail(nft: NftRecord): NftDetail {
  return {
    ...toSummary(nft),
    description: nft.description,
    images: nft.images,
    creator: nft.creator,
    editions: nft.editions,
  }
}

/** Altera preço/estoque de uma edição, incrementa versões e publica no barramento do servidor. */
export function updateEdition(editionId: string, patch: Partial<Pick<Edition, 'price' | 'available'>>) {
  const found = findEdition(editionId)
  if (!found) throw new Error(`Edição inexistente: ${editionId}`)
  const { nft, edition } = found
  if (patch.price !== undefined) edition.price = patch.price
  if (patch.available !== undefined) edition.available = Math.max(0, patch.available)
  edition.version += 1
  nft.version += 1
  publish({ type: 'edition.changed', nftId: nft.id, nftVersion: nft.version, edition: { ...edition } })
  return found
}

export function cartOf(userId: string) {
  const carts = db().carts
  carts[userId] ??= { items: [], version: 0 }
  return carts[userId]
}

export function toCart(userId: string): Cart {
  const cart = cartOf(userId)
  return {
    version: cart.version,
    items: cart.items.flatMap((item) => {
      const found = findEdition(item.editionId)
      if (!found) return [] // edição removida do catálogo → item some do carrinho
      return [
        {
          id: item.id,
          nftId: found.nft.id,
          editionId: found.edition.id,
          title: found.nft.title,
          editionLabel: found.edition.label,
          image: found.nft.images[0]!,
          unitPrice: found.edition.price,
          quantity: item.quantity,
          available: found.edition.available,
        },
      ]
    }),
  }
}

export const byPrice = (dir: 1 | -1) => (a: NftSummary, b: NftSummary) => dir * compare(a.price, b.price)
