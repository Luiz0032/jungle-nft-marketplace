import { useState } from 'react'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import { nftImageProps } from '@/lib/images'
import { cn } from '@/lib/utils'

/**
 * Galeria — Figma "Product Images" (70363:239): coluna de miniaturas 100×100 (gap 16) + imagem principal
 * 444×444 (arte 404 com respiro de 20) e coração no canto. Mobile (70396:241): imagem cheia + miniaturas em linha.
 */
export function NftGallery({ nftId, title, images }: { nftId: string; title: string; images: string[] }) {
  const [index, setIndex] = useState(0)
  const current = images[index] ?? images[0]!

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row lg:gap-7">
      {images.length > 1 && (
        <ul aria-label="Imagens do NFT" className="flex gap-3 lg:flex-col lg:gap-4">
          {images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver imagem ${i + 1} de ${images.length}`}
                aria-pressed={i === index}
                className={cn(
                  'block size-16 overflow-hidden rounded-[10px] bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-[100px]',
                  i === index ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100',
                )}
              >
                <img {...nftImageProps(src, '100px')} alt="" width={100} height={100} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative rounded-[20px] bg-surface p-0 lg:size-[444px] lg:p-5">
        <img
          {...nftImageProps(current, '(min-width: 1024px) 404px, 100vw')}
          alt={`${title} — imagem ${index + 1} de ${images.length}`}
          width={404}
          height={404}
          fetchPriority="high"
          className="aspect-square w-full rounded-[20px] object-cover lg:rounded-[15px]"
        />
        <FavoriteButton nftId={nftId} title={title} className="absolute top-4 right-4" />
      </div>
    </div>
  )
}
