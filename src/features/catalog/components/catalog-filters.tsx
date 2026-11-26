import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { CatalogFacets, CategorySlug, Eth } from '@/contracts'
import { compare, formatEth, parseEthInput } from '@/lib/money'
import { cn } from '@/lib/utils'
import { facetsQuery } from '../queries'
import { CLEAR_FILTERS, hasActiveFilters, type CatalogSearch } from '../search'

type Patch = Partial<CatalogSearch>

/**
 * Filtros do catálogo — Figma "Sidebar/Filters" (70485:382). Mapeamento: o bloco "Coleções" do Figma lista
 * as CATEGORIAS do contrato; o bloco "Rede" (sem dado equivalente) lista as COLEÇÕES. Tudo combinável.
 */
export function CatalogFilters({
  search,
  onChange,
  showSearch = true,
}: {
  search: CatalogSearch
  onChange: (patch: Patch) => void
  showSearch?: boolean
}) {
  const facets = useQuery(facetsQuery())

  const toggle = <T extends string>(list: T[] | undefined, value: T): T[] =>
    list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]

  return (
    <div className="flex flex-col gap-8">
      {showSearch && <SearchField value={search.q ?? ''} onCommit={(q) => onChange({ q: q || undefined })} />}

      <FacetGroup title="Categorias" loading={facets.isPending}>
        {facets.data?.categories.map((c) => (
          <FacetOption
            key={c.slug}
            label={c.name}
            count={c.count}
            checked={search.category?.includes(c.slug) ?? false}
            onChange={() => onChange({ category: toggle<CategorySlug>(search.category, c.slug) })}
            emphasis
          />
        ))}
      </FacetGroup>

      {facets.data && (
        <PriceRange
          key={`${search.minPrice}-${search.maxPrice}`}
          bounds={facets.data.priceRange}
          min={search.minPrice}
          max={search.maxPrice}
          onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      )}

      <FacetGroup title="Coleções" loading={facets.isPending}>
        {facets.data?.collections.map((c) => (
          <FacetOption
            key={c.slug}
            label={c.name}
            count={c.count}
            checked={search.collection?.includes(c.slug) ?? false}
            onChange={() => onChange({ collection: toggle(search.collection, c.slug) })}
          />
        ))}
      </FacetGroup>

      {facets.isError && (
        <p role="alert" className="text-sm text-coral">
          Não foi possível carregar os filtros.{' '}
          <button type="button" className="underline" onClick={() => void facets.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}

      {hasActiveFilters(search) && (
        <button
          type="button"
          onClick={() => onChange(CLEAR_FILTERS)}
          className="self-start rounded-sm text-sm text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}

/** Busca: confirma com debounce de 350 ms (uma entrada de histórico por busca, não por tecla) ou Enter. */
export function SearchField({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [draft, setDraft] = useState(value)
  const id = useId()
  // Ref: callback novo a cada render do pai não pode reiniciar o debounce.
  const commit = useRef(onCommit)
  useEffect(() => {
    commit.current = onCommit
  })

  // URL mudou por fora (voltar/avançar, limpar filtros) → reflete no campo (ajuste durante o render).
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    setSynced(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft.trim() === value) return
    const t = setTimeout(() => commit.current(draft.trim()), 350)
    return () => clearTimeout(t)
  }, [draft, value])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        commit.current(draft.trim())
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <div className="flex h-[45px] items-center gap-3 rounded-[10px] bg-surface-dark px-3 shadow-field focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-5 shrink-0 text-subtle" aria-hidden />
        <input
          id={id}
          type="search"
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Explorar coleções"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle"
        />
      </div>
    </form>
  )
}

function FacetGroup({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-3 text-lg leading-4 font-bold text-foreground">{title}</legend>
      {loading
        ? Array.from({ length: 5 }, (_, i) => <div key={i} className="shimmer my-2 h-4 rounded-sm" aria-hidden="true" />)
        : children}
    </fieldset>
  )
}

function FacetOption({
  label,
  count,
  checked,
  onChange,
  emphasis = false,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
  emphasis?: boolean
}) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center justify-between rounded-sm py-2 pl-3 text-sm leading-6 has-focus-visible:ring-2 has-focus-visible:ring-ring',
        checked ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-2">
        {/* Input transparente cobrindo o rótulo inteiro: clique, teclado e leitor de tela no próprio checkbox. */}
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-sm opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', checked ? 'bg-brand' : 'bg-transparent')}
        />
        {label}
      </span>
      <span className={cn(emphasis && 'font-bold')}>
        ({count}) <span className="sr-only">NFTs</span>
      </span>
    </label>
  )
}

/** Faixa de preço: dois sliders (strings ETH; nenhum `number` para dinheiro) + "Aplicar". */
function PriceRange({
  bounds,
  min,
  max,
  onApply,
}: {
  bounds: CatalogFacets['priceRange']
  min: Eth | undefined
  max: Eth | undefined
  onApply: (min: Eth | undefined, max: Eth | undefined) => void
}) {
  const [lo, setLo] = useState<Eth>(min ?? bounds.min)
  const [hi, setHi] = useState<Eth>(max ?? bounds.max)
  const id = useId()

  const setLow = (v: string) => {
    const next = parseEthInput(v)
    if (next) setLo(compare(next, hi) > 0 ? hi : next)
  }
  const setHigh = (v: string) => {
    const next = parseEthInput(v)
    if (next) setHi(compare(next, lo) < 0 ? lo : next)
  }
  const apply = () =>
    onApply(compare(lo, bounds.min) <= 0 ? undefined : lo, compare(hi, bounds.max) >= 0 ? undefined : hi)

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-lg leading-4 font-bold text-foreground">Faixa de preço</legend>
      <div className="relative mx-1 h-5">
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary" />
        <input
          type="range"
          aria-label="Preço mínimo (ETH)"
          aria-valuetext={formatEth(lo)}
          min={bounds.min}
          max={bounds.max}
          step="0.01"
          value={lo}
          onChange={(e) => setLow(e.target.value)}
          className="range-thumb"
        />
        <input
          type="range"
          aria-label="Preço máximo (ETH)"
          aria-valuetext={formatEth(hi)}
          min={bounds.min}
          max={bounds.max}
          step="0.01"
          value={hi}
          onChange={(e) => setHigh(e.target.value)}
          className="range-thumb"
        />
      </div>
      <p id={id} className="text-sm text-foreground" aria-live="polite">
        Preço: {formatEth(lo, { unit: false })} - {formatEth(hi)}
      </p>
      <button
        type="button"
        onClick={apply}
        aria-describedby={id}
        className="h-[35px] self-start rounded-md bg-primary px-3 text-base font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Aplicar
      </button>
    </fieldset>
  )
}
