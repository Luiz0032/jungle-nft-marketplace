import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { TicketPercent, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import type { QuoteInput } from '@/contracts'
import { couponStore, normalizeCoupon, useCoupon } from '@/features/quote/coupon'
import { quoteQuery } from '@/features/quote/queries'
import { isApiError } from '@/lib/http'
import { formatEth, isZero } from '@/lib/money'
import { notify } from '@/lib/notify'
import type { CartView } from '../queries'

const isCouponError = (e: unknown) => isApiError(e, 'COUPON_INVALID') || isApiError(e, 'COUPON_EXPIRED')

/**
 * Resumo do pedido. Subtotal, desconto, taxa e total vêm SEMPRE do POST /quote (o cliente não soma o total).
 * Nova cotação a cada mudança de itens/cupom e após `nft.updated` (realtime invalida `['quote']`).
 */
export function CartSummary({ cart, blocked }: { cart: CartView; blocked: boolean }) {
  const coupon = useCoupon(cart.scope)
  const items = cart.lines.map((l) => ({ editionId: l.editionId, quantity: l.quantity }))
  const input: QuoteInput = coupon ? { items, coupon } : { items }
  const quote = useQuery({ ...quoteQuery(cart.scope, input), enabled: items.length > 0, placeholderData: keepPreviousData })

  // Cupom salvo que deixou de valer (expirou depois de aplicado): sai do carrinho com aviso.
  const couponError = quote.isError && isCouponError(quote.error) ? quote.error.message : null
  useEffect(() => {
    if (!couponError || !coupon) return
    couponStore.set(cart.scope, null)
    notify.error(`Cupom ${coupon} removido: ${couponError}`)
  }, [couponError, coupon, cart.scope])

  const data = quote.data
  const updating = quote.isFetching
  const conflict = quote.isError && isApiError(quote.error, 'AVAILABILITY_CONFLICT')
  const canCheckout = Boolean(data) && !quote.isError && !blocked && !updating

  return (
    <section
      aria-labelledby="summary-title"
      aria-busy={updating}
      // Mobile (Figma 70397:245): folha inferior arredondada. Desktop: coluna sem cartão, título com divisória.
      className="flex flex-col gap-5 rounded-t-[24px] bg-surface px-6 pt-6 pb-8 lg:sticky lg:top-6 lg:rounded-none lg:bg-transparent lg:p-0"
    >
      <h2 id="summary-title" className="sr-only lg:not-sr-only lg:border-b lg:border-border lg:pb-3 lg:text-lg lg:leading-5 lg:font-bold lg:text-foreground">
        Resumo da carteira
      </h2>

      <CouponForm scope={cart.scope} items={items} applied={coupon} disabled={items.length === 0} />

      {quote.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Calculando resumo">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer h-5 w-full rounded-sm" />
          ))}
        </div>
      ) : quote.isError && !isCouponError(quote.error) ? (
        <div role="alert" className="flex flex-col gap-3 text-sm">
          <p className="text-coral">
            {conflict ? `${quote.error.message} Ajuste as quantidades destacadas.` : 'Não foi possível calcular o resumo.'}
          </p>
          {!conflict && (
            <button
              type="button"
              onClick={() => void quote.refetch()}
              className="self-start rounded-md border border-primary px-3 py-1.5 font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : data ? (
        <dl className="flex flex-col gap-3 text-base text-foreground" data-testid="quote-summary">
          <Row label="Subtotal" value={formatEth(data.subtotal)} testId="quote-subtotal" />
          {!isZero(data.discount) && (
            <Row
              label={`Desconto${data.coupon ? ` (${data.coupon.code})` : ''}`}
              value={`− ${formatEth(data.discount)}`}
              testId="quote-discount"
              className="text-success"
            />
          )}
          <Row label="Taxa de rede" value={formatEth(data.networkFee)} testId="quote-fee" note="Taxa estimada" />
          <div className="flex items-baseline justify-between pt-2 text-foreground">
            <dt className="text-base font-bold">Total</dt>
            <dd className="text-lg font-bold text-brand" data-testid="quote-total">
              {formatEth(data.total)}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className={updating && !quote.isPending ? "-my-2 text-xs text-subtle" : "sr-only"} aria-hidden={!updating}>
        {updating && !quote.isPending ? 'Atualizando valores…' : ''}
      </p>

      {cart.userId ? (
        canCheckout ? (
          <Link
            to="/checkout"
            className={cta}
          >
            Conectar e finalizar
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby="checkout-blocked"
              className={`${cta} cursor-not-allowed opacity-60`}
            >
              Conectar e finalizar
            </button>
            <p id="checkout-blocked" className="-mt-3 text-xs text-subtle">
              {updating ? 'Atualizando valores…' : 'Resolva os avisos do carrinho para continuar.'}
            </p>
          </>
        )
      ) : (
        <Link
          to="/login"
          search={{ redirect: '/cart' }}
          className={cta}
        >
          Entrar para finalizar
        </Link>
      )}
      <Link
        to="/"
        hash="catalogo"
        className="-mt-1 self-center rounded-sm text-base text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Continuar explorando
      </Link>
    </section>
  )
}

/** Figma: pílula com degradê de 60px no mobile; retângulo primary de 40px no desktop. */
const cta =
  'grid h-[60px] w-full place-items-center rounded-full bg-linear-to-r from-primary to-[#b5743f] text-base font-bold text-primary-foreground outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:h-10 lg:rounded-none lg:bg-primary lg:bg-none'

function Row({ label, value, testId, className, note }: { label: string; value: string; testId: string; className?: string; note?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 ${className ?? ''}`}>
      <dt>{label}</dt>
      <dd className="text-right text-base lg:text-lg" data-testid={testId}>
        {value}
      </dd>
      {note && <dd className="w-full mt-1 text-right text-xs text-brand">{note}</dd>}
    </div>
  )
}

/** Aplicar/remover cupom. Só grava o cupom depois que a API aceitou (cotação com ele). */
function CouponForm({
  scope,
  items,
  applied,
  disabled,
}: {
  scope: string
  items: QuoteInput['items']
  applied: string | null
  disabled: boolean
}) {
  const queryClient = useQueryClient()
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-dark px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <TicketPercent className="size-4 text-success" aria-hidden />
          Cupom <strong data-testid="applied-coupon">{applied}</strong> aplicado
        </span>
        <button
          type="button"
          onClick={() => {
            couponStore.set(scope, null)
            notify.info(`Cupom ${applied} removido.`)
          }}
          aria-label={`Remover cupom ${applied}`}
          className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-coral focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeCoupon(code)
    if (!normalized) {
      setError('Digite um cupom.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await queryClient.fetchQuery(quoteQuery(scope, { items, coupon: normalized }))
      couponStore.set(scope, normalized)
      setCode('')
      notify.success(`Cupom ${normalized} aplicado.`)
    } catch (err) {
      const message = isCouponError(err) && isApiError(err) ? err.message : 'Não foi possível aplicar o cupom agora. Tente de novo.'
      setError(message)
      notify.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only lg:not-sr-only lg:text-sm lg:font-bold lg:text-foreground">
        Código promocional
      </label>
      {/* Figma: campo e botão acoplados — pílula no mobile, retângulo com borda primary no desktop. */}
      <div className="flex h-[50px] overflow-hidden rounded-full border border-border-soft bg-surface-dark focus-within:ring-2 focus-within:ring-ring lg:h-10 lg:rounded-none lg:border-primary lg:bg-transparent">
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          maxLength={32}
          autoComplete="off"
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground uppercase outline-none placeholder:text-xs placeholder:text-subtle placeholder:normal-case aria-invalid:text-coral lg:px-2"
        />
        <button
          type="submit"
          disabled={disabled || busy}
          className="m-1 shrink-0 rounded-full bg-linear-to-r from-primary to-[#b5743f] px-4 text-base font-bold text-primary-foreground outline-none hover:brightness-105 disabled:opacity-60 lg:m-0 lg:w-[102px] lg:rounded-none lg:bg-primary lg:bg-none"
        >
          {busy ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-coral">
          {error}
        </p>
      )}
    </form>
  )
}
