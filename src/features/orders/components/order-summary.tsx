import type { Eth } from '@/contracts'
import { nftImageProps } from '@/lib/images'
import { formatEth, isZero } from '@/lib/money'
import { cn } from '@/lib/utils'

export type SummaryLine = {
  editionId: string
  title: string
  editionLabel: string
  image: string | null
  unitPrice: Eth
  quantity: number
  lineTotal: Eth
}
export type SummaryTotals = { subtotal: Eth; discount: Eth; networkFee: Eth; total: Eth; coupon: string | null }

/** Itens + totais — usado na revisão do checkout (cotação) e no recibo (snapshot do pedido). Só exibe. */
export function OrderSummary({
  lines,
  totals,
  testIdPrefix,
  className,
  plain = false,
}: {
  lines: SummaryLine[]
  totals: SummaryTotals
  testIdPrefix: string
  className?: string
  /** Recibo (Figma 70376:239): linhas sem cartão e arte arredondada, sobre o fundo do modal. */
  plain?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div aria-hidden="true" className="flex justify-between border-b border-border pb-2 text-base leading-5 font-bold text-foreground">
        <span>NFTs</span>
        <span className="flex gap-10">
          {plain && <span>Edições</span>}
          <span>Subtotal</span>
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li
            key={l.editionId}
            className={cn('flex min-h-[70px] items-center gap-3', plain ? 'min-h-14' : 'bg-surface pr-3')}
            data-testid={`${testIdPrefix}-line-${l.editionId}`}
          >
            {l.image ? (
              <img
                {...nftImageProps(l.image, '70px')}
                alt=""
                width={70}
                height={70}
                loading="lazy"
                className={cn('shrink-0 object-cover', plain ? 'size-14 rounded-sm' : 'size-[70px]')}
              />
            ) : (
              <span className={cn('shrink-0 bg-surface-dark', plain ? 'size-14 rounded-sm' : 'size-[70px]')} aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 text-base leading-5 font-bold text-foreground">{l.title}</span>
              <span className="text-xs text-subtle">{l.editionLabel}</span>
              <span className="text-xs text-subtle">
                <span data-testid="unit-price">{formatEth(l.unitPrice)}</span> / un.
              </span>
            </div>
            <span className={cn('shrink-0 text-sm text-muted-foreground', plain && 'w-16 text-center')}>
              <span className="sr-only">Quantidade: </span>(x {l.quantity})
            </span>
            <span className="shrink-0 text-lg leading-6 font-bold text-brand">{formatEth(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-3 pt-2 text-base text-foreground">
        <Row label="Subtotal" value={formatEth(totals.subtotal)} testId={`${testIdPrefix}-subtotal`} />
        {!isZero(totals.discount) && (
          <Row
            label={`Desconto${totals.coupon ? ` (${totals.coupon})` : ''}`}
            value={`− ${formatEth(totals.discount)}`}
            testId={`${testIdPrefix}-discount`}
            className="text-success"
          />
        )}
        <Row label="Taxa de rede" value={formatEth(totals.networkFee)} testId={`${testIdPrefix}-fee`} note="Taxa estimada" />
        <div className="flex items-baseline justify-between border-t border-border pt-3 text-foreground">
          <dt className="text-base font-bold">Total</dt>
          <dd className="text-lg font-bold text-brand" data-testid={`${testIdPrefix}-total`}>
            {formatEth(totals.total)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function Row({ label, value, testId, className, note }: { label: string; value: string; testId: string; className?: string; note?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-4', className)}>
      <dt>{label}</dt>
      <dd className="text-right text-lg" data-testid={testId}>
        {value}
      </dd>
      {note && <dd className="w-full mt-2 text-center text-xs text-brand">{note}</dd>}
    </div>
  )
}
