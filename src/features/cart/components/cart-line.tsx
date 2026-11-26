import { Link } from '@tanstack/react-router'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { nftImageProps } from '@/lib/images'
import { formatEth, mul } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { CartLine } from '../queries'

/** Linha do carrinho: arte, nome/edição, preço unitário, quantidade (presa a [1, estoque]), subtotal da linha e remover. */
export function CartLineRow({
  line,
  onQuantity,
  onRemove,
}: {
  line: CartLine
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const id = useId()
  const soldOut = line.available === 0
  const over = !soldOut && line.quantity > line.available
  const warning = soldOut
    ? 'Esgotada — remova do carrinho para continuar.'
    : over
      ? `Só ${line.available} ${line.available === 1 ? 'unidade disponível' : 'unidades disponíveis'} — diminua a quantidade.`
      : null

  return (
    <li
      data-testid={`cart-line-${line.editionId}`}
      aria-labelledby={`${id}-title`}
      className="flex gap-4 border-b border-border py-5 first:pt-0 lg:items-center lg:gap-6"
    >
      <Link to="/nft/$id" params={{ id: line.nftId }} tabIndex={-1} aria-hidden className="shrink-0">
        <img
          {...nftImageProps(line.image, '100px')}
          alt=""
          width={100}
          height={100}
          loading="lazy"
          decoding="async"
          className={cn('size-20 rounded-[10px] bg-surface object-cover lg:size-[100px]', soldOut && 'opacity-60 grayscale')}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 id={`${id}-title`} className="truncate text-base leading-5 text-foreground">
            <Link to="/nft/$id" params={{ id: line.nftId }} className="rounded-sm outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">
              {line.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{line.editionLabel}</p>
          <p className="text-sm text-muted-foreground">
            <span className="sr-only">Preço unitário: </span>
            <span data-testid="unit-price" className="font-bold text-brand">
              {formatEth(line.unitPrice)}
            </span>
            <span aria-hidden> / un.</span>
          </p>
          {warning && (
            <p id={`${id}-warning`} className="text-sm text-coral" data-testid="line-warning">
              {warning}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 lg:w-[300px] lg:justify-end lg:gap-6">
          <LineQuantity
            title={line.title}
            value={line.quantity}
            max={line.available}
            describedBy={warning ? `${id}-warning` : undefined}
            onChange={onQuantity}
          />
          <p className="min-w-[96px] text-right text-base font-bold text-foreground">
            <span className="sr-only">Subtotal da linha: </span>
            <span data-testid="line-total">{formatEth(mul(line.unitPrice, line.quantity))}</span>
          </p>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover ${line.title} (${line.editionLabel}) do carrinho`}
            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-coral focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  )
}

/**
 * − qtd + do carrinho. Botões confirmam na hora; o campo confirma no blur/Enter (uma requisição por edição,
 * não por tecla). Valor sempre inteiro em [1, estoque]; acima do estoque (estoque caiu) só permite diminuir.
 */
function LineQuantity({
  title,
  value,
  max,
  describedBy,
  onChange,
}: {
  title: string
  value: number
  max: number
  describedBy?: string
  onChange: (n: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Number.parseInt(draft, 10)
    setDraft(null)
    if (!Number.isFinite(n)) return
    const next = Math.min(Math.max(n, 1), Math.max(max, 1))
    if (next !== value) onChange(next)
  }
  const btn =
    'grid size-[33px] place-items-center rounded-md text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex h-[50px] w-[112px] items-center justify-between rounded-[10px] border border-border-soft px-1">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(value - 1, Math.max(max, 1)))}
        disabled={value <= 1}
        aria-label={`Diminuir quantidade de ${title}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`Quantidade de ${title}`}
        aria-describedby={describedBy}
        aria-invalid={value > max || undefined}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(null)
        }}
        className="w-9 bg-transparent text-center text-lg font-bold text-foreground outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Aumentar quantidade de ${title}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
