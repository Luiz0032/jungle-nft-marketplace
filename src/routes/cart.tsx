import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { Breadcrumb, MobileTitle } from '@/components/breadcrumb'
import { Button } from '@/components/ui/button'
import { CartLineRow } from '@/features/cart/components/cart-line'
import { CartSummary } from '@/features/cart/components/cart-summary'
import { guestCart } from '@/features/cart/guest-cart'
import { useLiveCartNotice } from '@/features/cart/hooks'
import { useCart, useCartMutations } from '@/features/cart/queries'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { nftListQuery } from '@/features/catalog/queries'

/** Carrinho — Figma desktop 11:1278 (Top 70371:250 + Related 70371:239) / mobile 16:360. */
export const Route = createFileRoute('/cart')({
  component: CartPage,
})

function CartPage() {
  const cart = useCart()
  const { update, remove } = useCartMutations()
  useLiveCartNotice(cart.lines)

  return (
    <div className="flex flex-col gap-16 pt-2 pb-8 lg:gap-24 lg:pt-8">
      <div className="flex flex-col gap-6 lg:gap-3">
        <Breadcrumb items={[{ label: 'Início', link: { to: '/' } }, { label: 'Mercado', link: { to: '/', hash: 'catalogo' } }, { label: 'Carrinho' }]} />
        <MobileTitle back={{ to: '/', hash: 'catalogo' }} backLabel="Voltar ao mercado">
          Carrinho de NFTs
          {cart.status === 'success' && cart.count > 0 && (
            <span className="sr-only">
              {' '}
              ({cart.count} {cart.count === 1 ? 'item' : 'itens'})
            </span>
          )}
        </MobileTitle>

        {cart.mergeFailed && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-coral/50 p-4 text-sm">
            <p className="text-coral">Os itens adicionados antes de entrar ainda não foram juntados ao seu carrinho.</p>
            <Button variant="outline" size="sm" onClick={() => guestCart.setMerge('idle')}>
              Tentar de novo
            </Button>
          </div>
        )}

        {cart.status === 'pending' ? (
          <CartSkeleton />
        ) : cart.status === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-4 py-12">
            <p className="text-lg font-bold">Não foi possível carregar seu carrinho.</p>
            <p className="text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
            <Button onClick={cart.refetch}>Tentar novamente</Button>
          </div>
        ) : cart.lines.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
            <section aria-labelledby="items-title" aria-busy={cart.isFetching} className="min-w-0 flex-1 lg:max-w-[782px]">
              <h2 id="items-title" className="sr-only">
                Itens
              </h2>
              <div
                aria-hidden
                className="mb-3 hidden grid-cols-[311px_138px_137px_1fr] border-b border-border pb-3 text-base leading-5 font-bold text-foreground lg:grid"
              >
                <span>NFTs</span>
                <span>Preço</span>
                <span>Edições</span>
                <span>Total</span>
              </div>
              <ul className="flex flex-col gap-4 lg:gap-3">
                {cart.lines.map((line) => (
                  <CartLineRow
                    key={line.key}
                    line={line}
                    onQuantity={(quantity) => update.mutate({ line, quantity })}
                    onRemove={() => remove.mutate({ line })}
                  />
                ))}
              </ul>
            </section>
            <div className="-mx-4 lg:mx-0 lg:w-[332px] lg:shrink-0">
              <CartSummary cart={cart} blocked={cart.lines.some((l) => l.quantity > l.available)} />
            </div>
          </div>
        )}
      </div>

      <Related excludeIds={cart.lines.map((l) => l.nftId)} />
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[10px] bg-surface px-6 py-16 text-center">
      <ShoppingCart className="size-10 text-brand" aria-hidden />
      <p className="text-lg font-bold text-foreground">Seu carrinho está vazio</p>
      <p className="max-w-sm text-sm text-muted-foreground">Explore o mercado e adicione edições ao carrinho para ver o resumo aqui.</p>
      <Link
        to="/"
        hash="catalogo"
        className="mt-2 inline-flex h-10 items-center rounded-md bg-primary px-5 text-base font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Explorar o mercado
      </Link>
    </div>
  )
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-12" role="status" aria-busy="true" aria-label="Carregando carrinho">
      <div className="flex flex-1 flex-col gap-5">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <div className="shimmer size-20 shrink-0 rounded-[10px] lg:size-[100px]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="shimmer h-5 w-2/3 rounded-sm" />
              <div className="shimmer h-4 w-1/3 rounded-sm" />
              <div className="shimmer h-4 w-24 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
      <div className="shimmer h-[360px] rounded-[10px] lg:w-[332px]" />
    </div>
  )
}

/** "Colecionadores também viram" — Figma "Related Products" (70371:239). */
function Related({ excludeIds }: { excludeIds: string[] }) {
  const query = useQuery(nftListQuery({ collection: [], category: [], sort: 'popular', page: 1, pageSize: 10 }))
  const items = query.data?.items.filter((i) => !excludeIds.includes(i.id)).slice(0, 5)
  if (query.isError || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <div className="border-b border-border pb-3">
        <h2 id="related-title" className="text-lg leading-6 font-bold text-brand">
          Colecionadores também viram
        </h2>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="grid w-max auto-cols-[160px] grid-flow-col gap-4 lg:w-auto lg:grid-flow-row lg:grid-cols-5 lg:gap-6">
          {items
            ? items.map((i) => <NftCard key={i.id} nft={i} />)
            : Array.from({ length: 5 }, (_, i) => <NftCardSkeleton key={i} />)}
        </div>
      </div>
    </section>
  )
}
