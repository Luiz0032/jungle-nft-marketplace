import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/contracts'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import { nftImageProps } from '@/lib/images'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

const LOW_STOCK = 3

/**
 * Card do catálogo — Figma "Frame 141" (70342:2678): bloco surface 258×300 com a arte 250×250 (raio 15)
 * a 31px do topo, nome 16 regular, preço 18 bold accent, gap 12. Link esticado cobre o card inteiro.
 */
export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  const soldOut = nft.available === 0
  const badge = soldOut ? 'ESGOTADO' : nft.available <= LOW_STOCK ? 'RARO' : null

  return (
    <article className="group relative flex flex-col gap-3" data-testid="nft-card">
      <div className="relative bg-surface px-[1.6%] pt-[12%] pb-[7.4%]">
        <img
          {...nftImageProps(nft.image, '(min-width: 1024px) 250px, 45vw')}
          alt=""
          width={250}
          height={250}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn(
            'aspect-square w-full rounded-[15px] object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none',
            soldOut && 'opacity-60 grayscale',
          )}
        />
        {badge && (
          <span
            className={cn(
              'absolute top-[12%] left-[1.6%] z-10 px-2 py-1 text-xs leading-[14px] font-bold',
              soldOut ? 'bg-surface-dark text-foreground' : 'bg-primary text-primary-foreground',
            )}
          >
            {badge}
          </span>
        )}
        <FavoriteButton
          nftId={nft.id}
          title={nft.title}
          className="absolute top-[calc(12%+8px)] right-[calc(1.6%+8px)] z-10"
        />
      </div>
      <h3 className="text-base leading-4 text-foreground">
        <Link
          to="/nft/$id"
          params={{ id: nft.id }}
          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {nft.title}
        </Link>
      </h3>
      <p className="text-lg leading-4 font-bold text-brand">
        <span className="sr-only">A partir de </span>
        {formatEth(nft.price)}
        {soldOut && <span className="ml-2 text-sm font-normal text-subtle">· Esgotado</span>}
      </p>
    </article>
  )
}

/** Skeleton com as MESMAS dimensões do card (sem salto de layout). */
export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="bg-surface px-[1.6%] pt-[12%] pb-[7.4%]">
        <div className="shimmer aspect-square w-full rounded-[15px]" />
      </div>
      <div className="shimmer h-4 w-3/4 rounded-sm" />
      <div className="shimmer h-4 w-1/3 rounded-sm" />
    </div>
  )
}
