import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import type { Edition } from '@/contracts'
import { cn } from '@/lib/utils'

/** "Edição Padrão" → "Padrão" (pílulas curtas como as do Figma: 1/1, 1/10, ABERTA). */
const shortLabel = (label: string) => label.replace(/^Edição\s+/i, '')

/** Pílulas de edição — Figma "Frame 156" (70342:2695): altura 28, raio cheio, borda; selecionada em primary. */
export function EditionPicker({
  editions,
  selectedId,
  onSelect,
}: {
  editions: Edition[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-3">
      <p id={labelId} className="text-base leading-4 font-bold text-foreground">
        Edição:
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {editions.map((e) => {
          const checked = e.id === selectedId
          return (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onSelect(e.id)}
              className={cn(
                'h-7 rounded-full border px-3 text-sm leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                checked ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-border-soft text-foreground hover:border-primary',
                e.available === 0 && !checked && 'text-subtle line-through decoration-1',
              )}
            >
              {shortLabel(e.label)}
              {e.available === 0 && <span className="sr-only"> (esgotada)</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Quantidade — Figma "Frame 160" (103×50): − 1 +. Sempre inteira, entre 1 e o estoque da edição.
 * Com estoque 0 fica desabilitada.
 */
export function QuantityStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const id = useId()
  const disabled = max < 1
  const btn =
    'grid size-[33px] place-items-center rounded-md text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-base text-foreground lg:sr-only">
        Qtd.
      </label>
      <div className="flex h-[50px] items-center rounded-[10px] border border-border-soft px-1 lg:w-[103px] lg:justify-between">
        <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Diminuir quantidade">
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Quantidade"
          aria-describedby={`${id}-hint`}
          disabled={disabled}
          value={disabled ? 0 : value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10)
            if (Number.isFinite(n)) onChange(n)
          }}
          className="w-8 bg-transparent text-center text-lg font-bold text-foreground outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring disabled:text-subtle"
        />
        <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Aumentar quantidade">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <span id={`${id}-hint`} className="sr-only">
        {disabled ? 'Edição esgotada.' : `Máximo de ${max} ${max === 1 ? 'unidade' : 'unidades'}.`}
      </span>
    </div>
  )
}
