import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2, Loader2, WifiOff, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { NotFound } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import { TERMINAL_ORDER_STATUSES, type Order, type User } from '@/contracts'
import { useCurrentUser } from '@/features/auth/hooks'
import { OrderSummary } from '@/features/orders/components/order-summary'
import { isOrderMissing, orderQuery } from '@/features/orders/queries'
import { couponStore } from '@/features/quote/coupon'
import { NETWORK_LABEL, shortAddress } from '@/features/wallets/queries'
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
        className="w-full max-w-[578px] overflow-hidden rounded-lg bg-surface"
      >
        <div className="h-2.5 bg-primary" aria-hidden />
        <div className="flex flex-col gap-6 p-6 lg:p-8">
          {current.status === 'pending' && <Pending order={current} connected={connected} />}
          {current.status === 'rejected' && <Rejected order={current} />}
          {current.status === 'confirmed' && <Confirmed order={current} />}
        </div>
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
    <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
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
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <XCircle className="size-12 text-coral" aria-hidden />
      <h1 id="order-title" className="text-xl font-bold text-foreground">
        Pagamento recusado
      </h1>
      <p className="text-sm text-muted-foreground">{order.rejectionReason ?? 'O pagamento não foi aprovado.'}</p>
      <p className="text-sm text-muted-foreground">Nada foi cobrado e os itens continuam no seu carrinho.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/checkout"
          className="inline-flex h-[45px] items-center justify-center rounded-md bg-primary px-6 font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tentar novamente
        </Link>
        <Link
          to="/cart"
          className="inline-flex h-[45px] items-center justify-center rounded-md border border-primary px-6 font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Voltar ao carrinho
        </Link>
      </div>
    </div>
  )
}

function Confirmed({ order }: { order: Order }) {
  const receipt = order.receipt
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h1 id="order-title" className="text-xl font-bold text-foreground">
          Pedido confirmado
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date(order.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · pedido{' '}
          <span className="font-mono">{order.id}</span>
        </p>
        {order.transactionId && (
          <p className="max-w-full text-xs break-all text-subtle">
            Transação: <span className="font-mono" data-testid="tx-id">{order.transactionId}</span>
          </p>
        )}
      </div>

      {receipt ? (
        <>
          <section aria-labelledby="receipt-title" className="flex flex-col gap-4">
            <h2 id="receipt-title" className="text-base font-bold text-foreground">
              Recibo
            </h2>
            <OrderSummary
              lines={receipt.lines}
              totals={{ ...receipt, coupon: receipt.coupon }}
              testIdPrefix="receipt"
            />
          </section>
          <dl className="grid gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">Colecionador</dt>
            <dd className="text-foreground">
              {receipt.collector.name} · {receipt.collector.email}
            </dd>
            <dt className="text-muted-foreground">Carteira</dt>
            <dd className="text-foreground">
              {receipt.wallet.label} · <span className="font-mono">{shortAddress(receipt.wallet.address)}</span>
            </dd>
            <dt className="text-muted-foreground">Rede</dt>
            <dd className="text-foreground">{NETWORK_LABEL[receipt.network]}</dd>
          </dl>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">O recibo ainda não está disponível.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          hash="catalogo"
          className="inline-flex h-[45px] items-center justify-center rounded-md bg-primary px-6 font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Continuar explorando
        </Link>
        <Link
          to="/cart"
          className="inline-flex h-[45px] items-center justify-center rounded-md border border-primary px-6 font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver carrinho
        </Link>
      </div>
    </div>
  )
}

function OrderSkeleton() {
  return (
    <div className="flex justify-center py-12" aria-busy="true" aria-label="Carregando pedido">
      <div className="shimmer h-[480px] w-full max-w-[578px] rounded-lg" />
    </div>
  )
}
