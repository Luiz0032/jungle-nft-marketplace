import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Share2, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRealtime } from '@/app/realtime-context'
import { NotFound } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import type { NftDetail } from '@/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { useAddToCart } from '@/features/cart/queries'
import { nftListQuery } from '@/features/catalog/queries'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import { EditionPicker, QuantityStepper } from '@/features/nft/components/edition-picker'
import { NftGallery } from '@/features/nft/components/nft-gallery'
import { nftDetailQuery } from '@/features/nft/queries'
import { isApiError } from '@/lib/http'
import { formatEth } from '@/lib/money'
import { notify } from '@/lib/notify'

/** Detalhe do NFT — Figma desktop 10:244 / mobile 15:5536. Preço/estoque ao vivo via `nft.updated`. */
export const Route = createFileRoute('/nft/$id')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.id))
  },
  component: NftPage,
})

function NftPage() {
  const { id } = Route.useParams()
  const query = useQuery(nftDetailQuery(id))

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    if (isApiError(query.error, 'NOT_FOUND')) return <NotFound />
    return (
      <div role="alert" className="flex flex-col items-start gap-4 py-16">
        <p className="text-lg font-bold">Não foi possível carregar este NFT.</p>
        <p className="text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
        <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    )
  }
  // `key`: trocar de NFT zera edição/quantidade escolhidas.
  return <NftDetailView key={query.data.id} nft={query.data} refreshing={query.isFetching} />
}

function NftDetailView({ nft, refreshing }: { nft: NftDetail; refreshing: boolean }) {
  const realtime = useRealtime()
  const [editionId, setEditionId] = useState(() => (nft.editions.find((e) => e.available > 0) ?? nft.editions[0]!).id)
  const [quantity, setQuantity] = useState(1)
  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const max = edition.available
  // Estoque pode cair por evento em tempo real: a quantidade exibida nunca passa do disponível.
  const qty = Math.min(Math.max(quantity, 1), Math.max(max, 1))
  const tokenId = `#${nft.id.replace(/^\D+/, '').padStart(4, '0')}`
  const soldOut = max === 0
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const add = (thenGoToCart: boolean) =>
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty, title: `${nft.title} (${edition.label})`, available: max },
      {
        onSuccess: () => {
          if (thenGoToCart) void navigate({ to: '/cart' })
        },
      },
    )

  // Aviso acessível quando o servidor muda preço/estoque deste NFT (evento já aplicado no cache).
  useEffect(
    () =>
      realtime.subscribe((e) => {
        if (e.type !== 'nft.updated' || e.payload.nftId !== nft.id) return
        // `nft` aqui é o último estado renderizado (antes do evento): compara para dizer o que mudou.
        const before = nft.editions.find((x) => x.id === e.payload.editionId)
        const label = before?.label ?? nft.title
        const { price, available } = e.payload
        const parts: string[] = []
        if (price !== undefined && price !== before?.price) parts.push(`preço agora ${formatEth(price)}`)
        if (available !== undefined && available !== before?.available)
          parts.push(available === 0 ? 'esgotada' : `estoque agora ${available} ${available === 1 ? 'unidade' : 'unidades'}`)
        if (parts.length > 0) notify.info(`${label} de ${nft.title}: ${parts.join(', ')}.`)
      }),
    [realtime, nft.id, nft.title, nft.editions],
  )

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify.success('Link do NFT copiado.')
    } catch {
      notify.error('Não foi possível copiar o link.')
    }
  }

  return (
    <article aria-labelledby="nft-title" aria-busy={refreshing} className="flex flex-col gap-16 pt-2 lg:gap-24 lg:pt-8">
      <div className="flex flex-col gap-3">
        <nav aria-label="Trilha" className="hidden text-sm text-muted-foreground lg:block">
          <ol className="flex gap-1">
            <li>
              <Link to="/" className="rounded-sm hover:text-brand">
                Início
              </Link>{' '}
              /
            </li>
            <li>
              <Link to="/" hash="catalogo" className="rounded-sm hover:text-brand">
                Mercado
              </Link>{' '}
              /
            </li>
            <li aria-current="page" className="text-foreground">
              {nft.title}
            </li>
          </ol>
        </nav>
        <BackButton />

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-8">
          <div className="shrink-0 lg:w-[573px]">
            <NftGallery nftId={nft.id} title={nft.title} images={nft.images} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <header className="flex flex-col gap-3 border-b border-border pb-3">
              <p className="text-sm text-muted-foreground">
                <Link
                  to="/"
                  search={{ collection: [nft.collection.slug] }}
                  hash="catalogo"
                  className="rounded-sm hover:text-brand"
                >
                  {nft.collection.name}
                </Link>
              </p>
              <h1 id="nft-title" className="text-xl leading-tight font-bold text-foreground lg:text-[32px]">
                {nft.title}
              </h1>
              <p className="text-lg leading-5 font-bold text-brand" aria-hidden="true">
                {formatEth(edition.price)}
              </p>
            </header>

            <section aria-labelledby="about-title" className="flex flex-col gap-3">
              <h2 id="about-title" className="text-base leading-4 font-bold text-foreground">
                Sobre este NFT:
              </h2>
              <p className="text-sm leading-[22px] text-muted-foreground">{nft.description}</p>
            </section>

            <EditionPicker editions={nft.editions} selectedId={edition.id} onSelect={setEditionId} />
            <p className="text-sm text-foreground">
              <span className="sr-only">Preço da {edition.label}: </span>
              <span data-testid={`edition-price-${edition.id}`} className="font-bold text-brand">
                {formatEth(edition.price)}
              </span>
              <span aria-hidden="true"> · </span>
              <span data-testid={`edition-available-${edition.id}`} className={edition.available === 0 ? 'text-coral' : 'text-muted-foreground'}>
                {edition.available === 0 ? 'Esgotado' : `${edition.available} disponíveis`}
              </span>
            </p>

            {/* Compra: barra fixa no mobile (Figma "Buy Bar" 70396:245), em linha no desktop. */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-5 rounded-t-[24px] bg-surface px-6 pt-5 pb-6 shadow-[0_-10px_30px_rgb(10_6_4/0.5)] lg:static lg:flex-row lg:items-center lg:justify-between lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
              <div className="flex items-center justify-between">
                <QuantityStepper value={qty} max={max} onChange={(n) => setQuantity(Math.min(Math.max(n, 1), Math.max(max, 1)))} />
                <p className="text-lg font-bold text-brand lg:hidden" aria-hidden="true">
                  {formatEth(edition.price)}
                </p>
              </div>
              <div className="flex items-center gap-3 lg:gap-2">
                {/* "Comprar": adiciona e leva ao carrinho (o checkout parte dele). Ícone: só adiciona. */}
                <button
                  type="button"
                  disabled={soldOut || addToCart.isPending}
                  aria-describedby={soldOut ? 'buy-unavailable' : undefined}
                  onClick={() => add(true)}
                  className="flex h-[60px] flex-1 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 lg:h-10 lg:w-[130px] lg:flex-none lg:rounded-md"
                >
                  <span className="lg:hidden">Comprar NFT</span>
                  <span className="hidden lg:inline">COMPRAR</span>
                </button>
                <button
                  type="button"
                  disabled={soldOut || addToCart.isPending}
                  aria-label="Adicionar ao carrinho"
                  aria-describedby={soldOut ? 'buy-unavailable' : undefined}
                  onClick={() => add(false)}
                  className="grid size-[60px] place-items-center rounded-[10px] border border-primary text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 lg:size-10 lg:rounded-md"
                >
                  <ShoppingCart className="size-5" aria-hidden />
                </button>
                <FavoriteButton nftId={nft.id} title={nft.title} variant="pill" className="hidden lg:flex" />
              </div>
              {soldOut && (
                <p id="buy-unavailable" className="text-xs text-coral">
                  Esta edição está esgotada.
                </p>
              )}
            </div>

            <dl className="flex flex-col gap-3 text-base leading-5 text-foreground">
              <div className="flex gap-2">
                <dt>ID do token:</dt>
                <dd>{tokenId}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Coleção:</dt>
                <dd>{nft.collection.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Criador:</dt>
                <dd>{nft.creator.name}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-3 text-base text-foreground">
              <span>Compartilhar este NFT:</span>
              <button
                type="button"
                onClick={() => void share()}
                aria-label="Copiar link do NFT"
                className="grid size-8 place-items-center rounded-md text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Share2 className="size-[18px]" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="details-title" className="flex flex-col gap-6">
        <div className="border-b border-border">
          <h2 id="details-title" className="inline-block border-b border-brand pb-3 text-base leading-4 font-bold text-brand">
            Detalhes do NFT
          </h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{nft.description}</p>
        <dl className="grid gap-x-2 gap-y-1 text-sm leading-6 sm:grid-cols-[max-content_1fr]">
          <dt className="font-bold text-foreground">Criador:</dt>
          <dd className="text-muted-foreground">
            {nft.creator.name} · <span className="font-mono break-all">{nft.creator.address}</span>
          </dd>
          <dt className="font-bold text-foreground">Edições:</dt>
          <dd className="text-muted-foreground">{nft.editions.map((e) => e.label).join(', ')}</dd>
          <dt className="font-bold text-foreground">Disponível no total:</dt>
          <dd className="text-muted-foreground">{nft.available} unidades</dd>
        </dl>
      </section>

      <Related nft={nft} />
    </article>
  )
}

function BackButton() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: '/' }))}
      className="flex items-center gap-2 self-start rounded-md text-sm text-foreground outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      <span className="grid size-[35px] place-items-center rounded-[10px] bg-surface">
        <ArrowLeft className="size-5" aria-hidden />
      </span>
      Voltar
    </button>
  )
}

/** "Mais desta coleção" — Figma "Related Products" (70364:239). */
function Related({ nft }: { nft: NftDetail }) {
  const query = useQuery(
    nftListQuery({ collection: [nft.collection.slug], category: [], sort: 'popular', page: 1, pageSize: 6 }),
  )
  const items = query.data?.items.filter((i) => i.id !== nft.id).slice(0, 5)
  if (query.isError || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <div className="border-b border-border pb-3">
        <h2 id="related-title" className="text-base leading-4 font-bold text-foreground">
          Mais desta coleção
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

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-8 py-8 lg:flex-row" aria-busy="true" aria-label="Carregando NFT">
      <div className="shimmer aspect-square w-full rounded-[20px] lg:size-[444px] lg:shrink-0 lg:ml-32" />
      <div className="flex flex-1 flex-col gap-4">
        <div className="shimmer h-4 w-32 rounded-sm" />
        <div className="shimmer h-9 w-3/4 rounded-sm" />
        <div className="shimmer h-5 w-24 rounded-sm" />
        <div className="shimmer h-20 w-full rounded-sm" />
        <div className="shimmer h-7 w-56 rounded-full" />
        <div className="shimmer h-[50px] w-full rounded-[10px]" />
      </div>
    </div>
  )
}
