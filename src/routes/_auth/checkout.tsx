import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Breadcrumb, MobileTitle } from '@/components/breadcrumb'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { CollectorSchema, type Collector, type Network, type Quote, type User } from '@/contracts'
import { useCurrentUser } from '@/features/auth/hooks'
import { useLiveCartNotice } from '@/features/cart/hooks'
import { useCart, type CartLine } from '@/features/cart/queries'
import { WalletPicker } from '@/features/checkout/components/wallet-picker'
import { quoteSignature, usePlaceOrder, type Phase } from '@/features/checkout/use-place-order'
import { OrderSummary, type SummaryLine } from '@/features/orders/components/order-summary'
import { useCoupon } from '@/features/quote/coupon'
import { quoteQuery } from '@/features/quote/queries'
import { useWalletConnection } from '@/features/wallets/connection'
import { NETWORK_LABEL, shortAddress, walletsQuery } from '@/features/wallets/queries'
import { isApiError } from '@/lib/http'
import { useAttempt } from '@/lib/idempotency'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { usePageMeta } from '@/lib/page-meta'

/** Pagamento — Figma desktop 11:2862 (Checkout Page 70522:3321) / mobile 16:748. */
export const Route = createFileRoute('/_auth/checkout')({
  component: CheckoutPage,
})

function CheckoutPage() {
  usePageMeta('Pagamento', 'Escolha a rede e a carteira, revise a cotação e confirme a compra dos seus NFTs.')
  const user = useCurrentUser()
  if (!user) return null // o layout `_auth` já está levando ao login
  return <Checkout key={user.id} user={user} />
}

const BUSY: Phase['kind'][] = ['revalidating', 'submitting', 'recovering']

function Checkout({ user }: { user: User }) {
  const cart = useCart()
  const coupon = useCoupon(user.id)
  const wallets = useQuery(walletsQuery(user.id))
  const connection = useWalletConnection(user.id)
  const attempt = useAttempt(user.id)
  useLiveCartNotice(cart.lines, 'Valores do pedido atualizados.')

  const items = cart.lines.map((l) => ({ editionId: l.editionId, quantity: l.quantity }))
  const quoteInput = coupon ? { items, coupon } : { items }
  const quote = useQuery({ ...quoteQuery(user.id, quoteInput), enabled: items.length > 0 })

  const [step, setStep] = useState<'details' | 'review'>('details')
  const [accepted, setAccepted] = useState<Quote | null>(null)
  const [network, setNetwork] = useState<Network | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletError, setWalletError] = useState<string | undefined>()
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const formId = useId()

  const form = useForm<Collector>({
    resolver: zodResolver(CollectorSchema),
    defaultValues: { name: user.name, email: user.email },
  })
  const place = usePlaceOrder({ userId: user.id, scope: user.id, quoteInput, accepted })

  // Padrão: carteira principal e a rede dela.
  const list = wallets.data ?? []
  const primary = list.find((w) => w.primary) ?? list[0]
  const effNetwork: Network = network ?? primary?.network ?? 'ethereum'
  const effWalletId = walletId ?? (primary && primary.network === effNetwork ? primary.id : null)
  const wallet = list.find((w) => w.id === effWalletId && w.network === effNetwork) ?? null
  const connected = Boolean(wallet && connection?.walletId === wallet.id)

  const changed = step === 'review' && accepted && quote.data ? quoteSignature(quote.data) !== quoteSignature(accepted) : false
  const busy = BUSY.includes(place.phase.kind)

  useEffect(() => {
    stepHeading.current?.focus()
  }, [step])

  const toReview = form.handleSubmit((values) => {
    void values
    if (!wallet) return setWalletError('Selecione uma carteira.')
    if (!connected) return setWalletError('Conecte a carteira selecionada para continuar.')
    if (!quote.data) return
    setWalletError(undefined)
    setAccepted(quote.data)
    setStep('review')
  })

  const confirm = () => {
    if (!wallet) return
    void place.confirm({ walletId: wallet.id, network: effNetwork, collector: form.getValues() })
  }

  if (cart.status === 'pending' || wallets.isPending) return <CheckoutSkeleton />
  if (cart.status === 'error' || wallets.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4 py-16">
        <p className="text-lg font-bold">Não foi possível carregar o checkout.</p>
        <Button
          onClick={() => {
            cart.refetch()
            void wallets.refetch()
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (cart.lines.length === 0 && !attempt) {
    return (
      <div className="flex flex-col items-start gap-4 py-16">
        <h1 className="text-heading font-bold text-foreground">Pagamento</h1>
        <p className="text-muted-foreground">Seu carrinho está vazio — não há o que pagar.</p>
        <Link to="/" hash="catalogo" className="text-brand underline-offset-2 hover:underline">
          Explorar o mercado
        </Link>
      </div>
    )
  }

  const quoteConflict = quote.isError && isApiError(quote.error, 'AVAILABILITY_CONFLICT')
  const canConfirm =
    step === 'review' && Boolean(quote.data) && !quote.isFetching && !changed && connected && !busy && !quote.isError

  return (
    <div className="flex flex-col gap-6 pt-2 pb-8 lg:pt-8">
      <Breadcrumb items={[{ label: 'Início', link: { to: '/' } }, { label: 'Mercado', link: { to: '/', hash: 'catalogo' } }, { label: 'Carrinho', link: { to: '/cart' } }, { label: 'Pagamento' }]} />
      <div className="flex flex-col gap-2">
        {/* Figma: o desktop não tem título visível (a trilha termina em "Pagamento"); o mobile tem. */}
        <MobileTitle back={{ to: '/cart' }} backLabel="Voltar ao carrinho">
          Pagamento com carteira
        </MobileTitle>
        <ol className="flex justify-center gap-4 text-sm lg:justify-start" aria-label="Etapas">
          <li className={step === 'details' ? 'font-bold text-brand' : 'text-muted-foreground'} aria-current={step === 'details' ? 'step' : undefined}>
            1. Dados e carteira
          </li>
          <li className={step === 'review' ? 'font-bold text-brand' : 'text-muted-foreground'} aria-current={step === 'review' ? 'step' : undefined}>
            2. Revisão
          </li>
        </ol>
      </div>

      <PhaseNotice phase={place.phase} onDiscard={place.discardOpen} onDismiss={place.clearFailure} />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-8 lg:max-w-[763px]">
          {step === 'details' ? (
            <form id={formId} onSubmit={(e) => void toReview(e)} noValidate className="flex flex-col gap-8">
              <h2 ref={stepHeading} tabIndex={-1} className="sr-only">
                Dados e carteira
              </h2>
              <fieldset className="grid gap-4 lg:grid-cols-2 lg:gap-x-6">
                <legend className="mb-4 text-lg leading-6 font-bold text-foreground">Perfil do colecionador</legend>
                <FormField id={`${formId}-name`} label="Nome completo" requiredMark error={form.formState.errors.name?.message} {...form.register('name')} autoComplete="name" />
                <FormField id={`${formId}-email`} label="E-mail" requiredMark type="email" error={form.formState.errors.email?.message} {...form.register('email')} autoComplete="email" />
              </fieldset>
              <WalletPicker
                userId={user.id}
                wallets={list}
                network={effNetwork}
                walletId={effWalletId}
                connection={connection}
                onNetwork={(n) => {
                  setNetwork(n)
                  setWalletId(list.find((w) => w.network === n && w.primary)?.id ?? list.find((w) => w.network === n)?.id ?? null)
                  setWalletError(undefined)
                }}
                onWallet={(wid) => {
                  setWalletId(wid)
                  setWalletError(undefined)
                }}
                error={walletError}
              />
              <button
                type="submit"
                disabled={!quote.data || quote.isError}
                className="h-[60px] rounded-full bg-linear-to-r from-primary to-[#b5743f] text-base font-bold text-primary-foreground outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 lg:h-[45px] lg:w-[260px] lg:rounded-[2px] lg:bg-primary lg:bg-none"
              >
                Revisar pedido
              </button>
            </form>
          ) : (
            <section aria-labelledby={`${formId}-review`} className="flex flex-col gap-6">
              <h2 id={`${formId}-review`} ref={stepHeading} tabIndex={-1} className="text-lg font-bold text-foreground outline-none">
                Revise antes de pagar
              </h2>
              <dl className="grid gap-x-6 gap-y-3 rounded-[10px] bg-surface p-5 text-sm sm:grid-cols-[max-content_1fr]">
                <dt className="text-muted-foreground">Colecionador</dt>
                <dd className="text-foreground">
                  {form.getValues('name')} · {form.getValues('email')}
                </dd>
                <dt className="text-muted-foreground">Rede</dt>
                <dd className="text-foreground">{NETWORK_LABEL[effNetwork]}</dd>
                <dt className="text-muted-foreground">Carteira</dt>
                <dd className="text-foreground">
                  {wallet?.label} · <span className="font-mono">{wallet && shortAddress(wallet.address)}</span>
                  {!connected && <span className="ml-2 text-coral">(desconectada)</span>}
                </dd>
              </dl>

              {changed && accepted && quote.data && (
                <QuoteChanged before={accepted} after={quote.data} lines={cart.lines} onAccept={() => setAccepted(quote.data)} />
              )}
              {!connected && (
                <p role="alert" className="text-sm text-coral">
                  A carteira foi desconectada. Volte e conecte de novo para pagar.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    place.clearFailure()
                    setStep('details')
                  }}
                  disabled={busy}
                  className="h-[45px] rounded-[2px] border border-primary px-6 text-base font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  Voltar e editar
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!canConfirm && place.phase.kind !== 'unresolved'}
                  aria-busy={busy}
                  className="flex h-[45px] items-center justify-center gap-2 rounded-[2px] bg-primary px-6 text-base font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[260px]"
                >
                  {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                  {busy ? 'Processando…' : place.phase.kind === 'unresolved' ? 'Reenviar pedido' : 'Confirmar pagamento'}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby={`${formId}-summary`} aria-busy={quote.isFetching} className="flex flex-col gap-3 lg:sticky lg:top-6 lg:w-[405px] lg:shrink-0">
          <h2 id={`${formId}-summary`} className="text-lg leading-6 font-bold text-foreground">
            Seus NFTs
          </h2>
          {quote.isPending ? (
            <div className="flex flex-col gap-3" role="status" aria-label="Calculando resumo">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="shimmer h-5 w-full rounded-sm" />
              ))}
            </div>
          ) : quote.isError ? (
            <div role="alert" className="flex flex-col gap-3 text-sm">
              <p className="text-coral">
                {quoteConflict ? `${quote.error.message} Ajuste o carrinho para continuar.` : 'Não foi possível calcular os valores.'}
              </p>
              {quoteConflict ? (
                <Link to="/cart" className="font-bold text-brand underline-offset-2 hover:underline">
                  Voltar ao carrinho
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="self-start" onClick={() => void quote.refetch()}>
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : (
            <OrderSummary lines={toSummaryLines(quote.data, cart.lines)} totals={{ ...quote.data, coupon: quote.data.coupon?.code ?? null }} testIdPrefix="checkout" />
          )}
          <p className="min-h-4 text-xs text-subtle">{quote.isFetching && !quote.isPending ? 'Atualizando valores…' : ''}</p>
        </aside>
      </div>
    </div>
  )
}

function toSummaryLines(quote: Quote, lines: CartLine[]): SummaryLine[] {
  return quote.lines.map((q) => {
    const line = lines.find((l) => l.editionId === q.editionId)
    return {
      editionId: q.editionId,
      title: line?.title ?? q.editionId,
      editionLabel: line?.editionLabel ?? '',
      image: line?.image ?? null,
      imageAlt: line?.imageAlt ?? '',
      unitPrice: q.unitPrice,
      quantity: q.quantity,
      lineTotal: q.lineTotal,
    }
  })
}

/** Cotação mudou depois da revisão (evento ou QUOTE_OUTDATED): mostra o que mudou e exige aceite explícito. */
function QuoteChanged({ before, after, lines, onAccept }: { before: Quote; after: Quote; lines: CartLine[]; onAccept: () => void }) {
  const priceChanges = after.lines.flatMap((a) => {
    const b = before.lines.find((x) => x.editionId === a.editionId)
    if (!b || b.unitPrice === a.unitPrice) return []
    const title = lines.find((l) => l.editionId === a.editionId)?.title ?? a.editionId
    return [`${title}: ${formatEth(b.unitPrice)} → ${formatEth(a.unitPrice)}`]
  })
  return (
    <div role="alert" data-testid="quote-changed" className="flex flex-col gap-3 rounded-[10px] border border-coral/60 bg-surface p-4 text-sm">
      <p className="flex items-center gap-2 font-bold text-coral">
        <AlertTriangle className="size-4" aria-hidden />
        Os valores mudaram desde a sua revisão
      </p>
      <ul className="flex flex-col gap-1 text-foreground">
        {priceChanges.map((c) => (
          <li key={c}>{c}</li>
        ))}
        <li>
          Total: {formatEth(before.total)} → <strong>{formatEth(after.total)}</strong>
        </li>
      </ul>
      <button
        type="button"
        onClick={onAccept}
        className="self-start rounded-md border border-primary px-4 py-2 font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        Aceitar novos valores
      </button>
    </div>
  )
}

function PhaseNotice({ phase, onDiscard, onDismiss }: { phase: Phase; onDiscard: () => void; onDismiss: () => void }) {
  const text: Partial<Record<Phase['kind'], string>> = {
    revalidating: 'Revalidando os valores do pedido…',
    submitting: 'Enviando o pedido…',
    recovering: 'A resposta demorou. Procurando o seu pedido pela chave de envio…',
  }
  if (text[phase.kind]) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-md bg-surface px-4 py-3 text-sm text-foreground" data-testid="checkout-phase">
        <Loader2 className="size-4 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
        {text[phase.kind]}
      </p>
    )
  }
  if (phase.kind === 'unresolved') {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-md border border-coral/60 p-4 text-sm" data-testid="checkout-phase">
        <p className="text-foreground">
          Não conseguimos confirmar se o pedido foi criado. Use “Reenviar pedido”: ele vai com a mesma chave de envio, então
          não há risco de compra duplicada.
        </p>
        {phase.notFound && (
          <button type="button" onClick={onDiscard} className="self-start text-brand underline-offset-2 hover:underline">
            Descartar esta tentativa e revisar
          </button>
        )}
      </div>
    )
  }
  if (phase.kind === 'failed') {
    return (
      <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-md border border-coral/60 p-4 text-sm')} data-testid="checkout-phase">
        <p className="text-coral">{phase.message}</p>
        {phase.backToCart ? (
          <Link to="/cart" className="font-bold text-brand underline-offset-2 hover:underline">
            Voltar ao carrinho
          </Link>
        ) : (
          <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            Fechar aviso
          </button>
        )}
      </div>
    )
  }
  return null
}

function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-8 py-8 lg:flex-row lg:gap-12" role="status" aria-busy="true" aria-label="Carregando pagamento">
      <div className="flex flex-1 flex-col gap-4">
        <div className="shimmer h-8 w-48 rounded-sm" />
        <div className="shimmer h-10 w-full rounded-md" />
        <div className="shimmer h-10 w-full rounded-md" />
        <div className="shimmer h-24 w-full rounded-[10px]" />
      </div>
      <div className="shimmer h-[360px] rounded-[10px] lg:w-[405px]" />
    </div>
  )
}
