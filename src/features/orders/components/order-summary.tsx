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
}: {
  lines: SummaryLine[]
  totals: SummaryTotals
  testIdPrefix: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.editionId} className="flex items-center gap-3" data-testid={`${testIdPrefix}-line-${l.editionId}`}>
            {l.image ? (
              <img {...nftImageProps(l.image, '56px')} alt="" width={56} height={56} loading="lazy" className="size-14 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="size-14 shrink-0 rounded-md bg-surface-dark" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <span className="truncate text-foreground">{l.title}</span>
              <span className="text-xs text-muted-foreground">
                {l.editionLabel} · {l.quantity} × <span data-testid="unit-price">{formatEth(l.unitPrice)}</span>
              </span>
            </div>
            <span className="text-sm font-bold text-foreground">{formatEth(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <Row label="Subtotal" value={formatEth(totals.subtotal)} testId={`${testIdPrefix}-subtotal`} />
        {!isZero(totals.discount) && (
          <Row
            label={`Desconto${totals.coupon ? ` (${totals.coupon})` : ''}`}
            value={`− ${formatEth(totals.discount)}`}
            testId={`${testIdPrefix}-discount`}
            className="text-success"
          />
        )}
        <Row label="Taxa de rede" value={formatEth(totals.networkFee)} testId={`${testIdPrefix}-fee`} />
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3 text-foreground">
          <dt className="text-base font-bold">Total</dt>
          <dd className="text-lg font-bold text-brand" data-testid={`${testIdPrefix}-total`}>
            {formatEth(totals.total)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function Row({ label, value, testId, className }: { label: string; value: string; testId: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt>{label}</dt>
      <dd className="font-bold" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}
