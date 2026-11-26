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
      className={cn(
        // Mobile (Figma 16:360): cartão com arte 100px à esquerda e quantidade à direita.
        'grid grid-cols-[100px_1fr_auto] gap-x-3 overflow-hidden rounded-[10px] bg-surface',
        // Desktop (Figma 70371:250): linha de tabela de 70px alinhada às colunas NFTs | Preço | Edições | Total.
        'lg:min-h-[70px] lg:grid-cols-[86px_225px_138px_137px_1fr_56px] lg:items-center lg:gap-x-0 lg:rounded-none',
      )}
    >
      <Link
        to="/nft/$id"
        params={{ id: line.nftId }}
        tabIndex={-1}
        aria-hidden
        className="col-start-1 row-span-3 row-start-1 lg:row-span-1 lg:self-stretch"
      >
        <img
          {...nftImageProps(line.image, '100px')}
          alt=""
          width={100}
          height={100}
          loading="lazy"
          decoding="async"
          className={cn('size-[100px] bg-surface-dark object-cover lg:size-[70px]', soldOut && 'opacity-60 grayscale')}
        />
      </Link>

      <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-0.5 pt-3 lg:pt-0">
        <h3 id={`${id}-title`} className="line-clamp-2 text-base leading-5 font-bold text-foreground lg:truncate">
          <Link to="/nft/$id" params={{ id: line.nftId }} className="rounded-sm outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">
            {line.title}
          </Link>
        </h3>
        <p className="truncate text-sm text-subtle">{line.editionLabel}</p>
      </div>

      <p className="col-start-2 row-start-2 text-xs text-subtle lg:col-start-3 lg:row-start-1 lg:text-base lg:font-bold lg:text-muted-foreground">
        <span className="sr-only">Preço unitário: </span>
        <span data-testid="unit-price">{formatEth(line.unitPrice)}</span>
        <span aria-hidden className="lg:hidden">
          {' '}
          / un.
        </span>
      </p>

      <div className="col-start-3 row-start-3 self-end pr-3 pb-3 lg:col-start-4 lg:row-start-1 lg:self-center lg:p-0">
        <LineQuantity
          title={line.title}
          value={line.quantity}
          max={line.available}
          describedBy={warning ? `${id}-warning` : undefined}
          onChange={onQuantity}
        />
      </div>

      <p className="col-start-2 row-start-3 self-end pb-3 text-lg leading-6 font-bold text-brand lg:col-start-5 lg:row-start-1 lg:self-center lg:pb-0 lg:text-base">
        <span className="sr-only">Subtotal da linha: </span>
        <span data-testid="line-total">{formatEth(mul(line.unitPrice, line.quantity))}</span>
      </p>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${line.title} (${line.editionLabel}) do carrinho`}
        className="col-start-3 row-start-1 mt-2 mr-2 grid size-9 shrink-0 place-items-center justify-self-end rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-coral focus-visible:ring-2 focus-visible:ring-ring lg:col-start-6 lg:m-0 lg:justify-self-center"
      >
        <Trash2 className="size-5" aria-hidden />
      </button>

      {warning && (
        <p id={`${id}-warning`} className="col-span-full px-3 pb-3 text-sm text-coral lg:px-4 lg:pb-3" data-testid="line-warning">
          {warning}
        </p>
      )}
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
  // Figma: botões redondos de 24px — contorno claro no mobile, preenchidos com primary no desktop.
  const btn =
    'grid size-6 place-items-center rounded-full border border-foreground/70 text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-raised disabled:text-subtle lg:border-0 lg:bg-primary lg:text-primary-foreground lg:hover:bg-primary/90 lg:disabled:bg-primary lg:disabled:text-primary-foreground lg:disabled:opacity-40'

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(value - 1, Math.max(max, 1)))}
        disabled={value <= 1}
        aria-label={`Diminuir quantidade de ${title}`}
      >
        <Minus className="size-3.5" strokeWidth={3} aria-hidden />
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
        className="w-8 bg-transparent text-center text-base text-foreground outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Aumentar quantidade de ${title}`}
      >
        <Plus className="size-3.5" strokeWidth={3} aria-hidden />
      </button>
    </div>
  )
}
