import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2, MailCheck, WifiOff, X, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { NotFound } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import { TERMINAL_ORDER_STATUSES, type Order, type User } from '@/contracts'
import { useCurrentUser } from '@/features/auth/hooks'
import { OrderSummary } from '@/features/orders/components/order-summary'
import { isOrderMissing, orderQuery } from '@/features/orders/queries'
import { couponStore } from '@/features/quote/coupon'
import { NETWORK_LABEL, shortAddress } from '@/features/wallets/queries'
import { formatEth } from '@/lib/money'
import { attempts } from '@/lib/idempotency'
import { notify } from '@/lib/notify'
import { queryKeys } from '@/lib/query-keys'
import { useSocketConnected } from '@/lib/use-socket-status'

/**
 * Confirmação do pedido — Figma desktop 11:4385 (modal 70376:239, 578 px, sobre o checkout); sem mobile no Figma.
 * "Confirmado" SÓ quando a API/evento diz `confirmed` (invariante 3). O recibo é o snapshot do servidor.
 */
export const Route = createFileRoute('/_auth/orders/$id')({
  component: OrderPage,
})

function OrderPage() {
  const user = useCurrentUser()
  const { id } = Route.useParams()
  if (!user) return null
  return <OrderView key={`${user.id}:${id}`} user={user} orderId={id} />
}

function OrderView({ user, orderId }: { user: User; orderId: string }) {
  const queryClient = useQueryClient()
  const connected = useSocketConnected()
  const query = useQuery(orderQuery(user.id, orderId, connected))
  const order = query.data
  const status = order?.status

  // Estado terminal: a tentativa de compra termina (a chave de idempotência pode ser esquecida).
  useEffect(() => {
    if (!status || !TERMINAL_ORDER_STATUSES.includes(status)) return
    const open = attempts.get(user.id)
    if (open?.orderId === orderId) attempts.discard(user.id, open.key)
    if (status === 'confirmed') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart(user.id) }) // servidor tirou os itens comprados
      if (order?.receipt?.coupon && couponStore.get(user.id) === order.receipt.coupon) couponStore.set(user.id, null)
    }
  }, [status, orderId, user.id, queryClient, order?.receipt?.coupon])

  // Aviso só na transição vista nesta tela (não ao reabrir um pedido antigo).
  useAnnounceTransition(order)

  if (query.isPending) return <OrderSkeleton />
  if (query.isError) {
    if (isOrderMissing(query.error)) return <NotFound />
    return (
      <div role="alert" className="flex flex-col items-start gap-4 py-16">
        <p className="text-lg font-bold">Não foi possível carregar o pedido.</p>
        <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  const current = query.data
  return (
    <div className="flex justify-center py-8 lg:py-12">
      <article
        aria-labelledby="order-title"
        data-testid="order"
        data-status={current.status}
        className="relative w-full max-w-[578px] overflow-hidden bg-surface"
      >
        {/* Figma 70376:239: X no canto e faixa primary de 10px na base do modal. */}
        <Link
          to="/"
          hash="catalogo"
          aria-label="Fechar e voltar ao mercado"
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-md text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-[18px]" aria-hidden />
        </Link>
        <div className="flex flex-col gap-6 pt-6 pb-8">
          {current.status === 'pending' && <Pending order={current} connected={connected} />}
          {current.status === 'rejected' && <Rejected order={current} />}
          {current.status === 'confirmed' && <Confirmed order={current} />}
        </div>
        <div className="h-2.5 bg-primary" aria-hidden />
      </article>
    </div>
  )
}

function useAnnounceTransition(order: Order | undefined) {
  const status = order?.status
  const reason = order?.rejectionReason
  const sawPending = useRef(false)
  useEffect(() => {
    if (status === 'pending') {
      sawPending.current = true
      return
    }
    if (!status || !sawPending.current) return
    sawPending.current = false
    if (status === 'confirmed') notify.success('Pagamento confirmado! Seu NFT já é seu.')
    else notify.error(`Pagamento recusado: ${reason ?? 'tente de novo.'}`)
  }, [status, reason])
}

function Pending({ order, connected }: { order: Order; connected: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8 text-center lg:px-9" role="status" aria-live="polite">
      <Loader2 className="size-10 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
      <h1 id="order-title" className="text-xl font-bold text-foreground">
        Processando pagamento…
      </h1>
      <p className="text-sm text-muted-foreground">
        Pedido <span className="font-mono">{order.id}</span> enviado. Aguardando a confirmação da rede — pode sair desta
        tela, o pedido continua.
      </p>
      {!connected && (
        <p className="flex items-center gap-2 text-sm text-coral" data-testid="realtime-offline">
          <WifiOff className="size-4" aria-hidden />
          Conexão em tempo real perdida. Verificando o pedido a cada 3 s…
        </p>
      )}
    </div>
  )
}

function Rejected({ order }: { order: Order }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-6 text-center lg:px-9">
      <XCircle className="size-12 text-coral" aria-hidden />
      <h1 id="order-title" className="text-xl font-bold text-foreground">
        Pagamento recusado
      </h1>
      <p className="text-sm text-muted-foreground">{order.rejectionReason ?? 'O pagamento não foi aprovado.'}</p>
      <p className="text-sm text-muted-foreground">Nada foi cobrado e os itens continuam no seu carrinho.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/checkout"
          className="inline-flex h-[45px] items-center justify-center rounded-[2px] bg-primary px-6 font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tentar novamente
        </Link>
        <Link
          to="/cart"
          className="inline-flex h-[45px] items-center justify-center rounded-[2px] border border-primary px-6 font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Voltar ao carrinho
        </Link>
      </div>
    </div>
  )
}

const shortTx = (tx: string) => `${tx.slice(0, 6).toUpperCase().replace('0X', '0x')}…${tx.slice(-4).toUpperCase()}`

function Confirmed({ order }: { order: Order }) {
  const receipt = order.receipt
  const date = new Date(order.createdAt)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ de /g, ' ')
    .replace('.', ',')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 px-12 text-center">
        <MailCheck className="size-16 text-brand" strokeWidth={1.25} aria-hidden />
        <h1 id="order-title" className="text-base leading-5 font-bold text-muted-foreground">
          <span className="sr-only">Pedido confirmado. </span>
          Seus NFTs agora estão na sua carteira
        </h1>
      </div>

      {/* Faixa de metadados do Figma: 4 colunas separadas por fios primary. */}
      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm sm:grid-cols-[auto_auto_auto_auto] sm:justify-between lg:px-7">
        <div className="flex flex-col pr-3 sm:border-r sm:border-primary">
          <dt className="font-bold text-muted-foreground">ID da transação</dt>
          <dd className="font-mono text-muted-foreground">
            {order.transactionId ? (
              <>
                <span aria-hidden>{shortTx(order.transactionId)}</span>
                <span className="sr-only" data-testid="tx-id">
                  {order.transactionId}
                </span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="flex flex-col pr-3 sm:border-r sm:border-primary">
          <dt className="text-muted-foreground">Data</dt>
          <dd className="text-muted-foreground">{date}</dd>
        </div>
        <div className="flex flex-col pr-3 sm:border-r sm:border-primary">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-muted-foreground">{receipt ? formatEth(receipt.total) : '—'}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="font-bold text-muted-foreground">Carteira</dt>
          <dd className="text-muted-foreground">{receipt?.wallet.label ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-5 px-6 lg:px-9">
        {receipt ? (
          <section aria-labelledby="receipt-title" className="flex flex-col gap-2">
            <h2 id="receipt-title" className="text-sm font-bold text-foreground">
              Detalhes da transação
            </h2>
            <OrderSummary plain lines={receipt.lines} totals={{ ...receipt, coupon: receipt.coupon }} testIdPrefix="receipt" />
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">O recibo ainda não está disponível.</p>
        )}

        {receipt && (
          <p className="text-center text-sm leading-6 text-muted-foreground">
            Transação confirmada na {NETWORK_LABEL[receipt.network]}. A propriedade foi transferida para sua carteira{' '}
            <span className="font-mono">{shortAddress(receipt.wallet.address)}</span> e registrada na rede.
          </p>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            hash="catalogo"
            className="inline-flex h-[45px] items-center justify-center rounded-[2px] bg-primary px-6 font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Continuar explorando
          </Link>
          <Link
            to="/cart"
            className="inline-flex h-[45px] items-center justify-center rounded-[2px] border border-primary px-6 font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver carrinho
          </Link>
        </div>
      </div>
    </div>
  )
}

function OrderSkeleton() {
  return (
    <div className="flex justify-center py-12" role="status" aria-busy="true" aria-label="Carregando pedido">
      <div className="shimmer h-[640px] w-full max-w-[578px]" />
    </div>
  )
}
