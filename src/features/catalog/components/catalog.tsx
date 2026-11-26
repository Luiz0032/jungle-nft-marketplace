import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import type { NftHighlight, NftSort } from '@/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { nftListQuery } from '../queries'
import {
  CATALOG_PAGE_SIZE,
  CLEAR_FILTERS,
  DEFAULT_SORT,
  hasActiveFilters,
  toListQuery,
  withFilters,
  type CatalogSearch,
} from '../search'
import { NftCard, NftCardSkeleton } from './nft-card'
import { Pagination } from './pagination'

type Patch = Partial<CatalogSearch>

const TABS: { label: string; highlight: NftHighlight | undefined }[] = [
  { label: 'Todos os NFTs', highlight: undefined },
  { label: 'Novos lançamentos', highlight: 'new' },
  { label: 'Em alta', highlight: 'trending' },
]

const SORTS: { value: NftSort; label: string }[] = [
  { value: 'newest', label: 'Listados recentemente' },
  { value: 'popular', label: 'Mais populares' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
]


/**
 * Toolbar + grade + paginação — Figma "Product Grid" (70342:2830). Estados: skeleton (1ª carga),
 * vazio, erro com retry, sucesso e refetch em background (página anterior mantida, `aria-busy`).
 */
export function Catalog({ search, onChange }: { search: CatalogSearch; onChange: (patch: Patch) => void }) {
  const query = useQuery(nftListQuery(toListQuery(search)))
  const sortId = useId()
  const { data } = query
  const page = search.page ?? 1
  const updating = query.isFetching && !query.isPending

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Recortes do catálogo" className="-mx-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          <ul className="flex gap-4 px-1 whitespace-nowrap md:gap-5">
            {TABS.map((t) => {
              const active = search.highlight === t.highlight
              return (
                <li key={t.label}>
                  <Link
                    to="/"
                    search={withFilters(search, { highlight: t.highlight })}
                    resetScroll={false}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative block pb-2 text-sm leading-4 font-bold outline-none md:text-base focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-brand'
                        : 'text-foreground hover:text-brand',
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-2 text-sm md:text-base">
          <label htmlFor={sortId} className="shrink-0 text-foreground">
            Ordenar por:
          </label>
          <div className="relative">
            <select
              id={sortId}
              value={search.sort ?? DEFAULT_SORT}
              onChange={(e) => onChange({ sort: e.target.value as NftSort })}
              className="h-8 appearance-none rounded-sm bg-transparent pr-7 pl-1 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-surface"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-1 size-4 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <p role="status" className="sr-only">
        {query.isPending
          ? 'Carregando NFTs…'
          : data
            ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}. Página ${data.page} de ${Math.max(1, data.totalPages)}.`
            : ''}
      </p>

      {query.isPending ? (
        <Grid busy>
          {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </Grid>
      ) : !data ? (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface p-8">
          <p className="text-lg font-bold">Não foi possível carregar o catálogo.</p>
          <p className="text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
          <Button onClick={() => void query.refetch()}>Tentar de novo</Button>
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState search={search} onChange={onChange} outOfRange={data.total > 0} />
      ) : (
        <>
          {query.isError && (
            <div role="alert" className="flex items-center justify-between gap-4 rounded-md bg-surface px-4 py-3 text-sm">
              <span className="text-coral">Não foi possível atualizar. Mostrando os últimos resultados.</span>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                Tentar de novo
              </Button>
            </div>
          )}
          <Grid busy={updating}>
            {data.items.map((nft, i) => (
              <NftCard key={nft.id} nft={nft} priority={i < 3 && page === 1} />
            ))}
          </Grid>
          <Pagination search={search} page={data.page} totalPages={data.totalPages} />
        </>
      )}
    </div>
  )
}

function Grid({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <div
      aria-busy={busy}
      data-testid="nft-grid"
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity md:grid-cols-3 lg:gap-x-[34px] lg:gap-y-[47px]',
        busy && 'opacity-60',
      )}
    >
      {children}
    </div>
  )
}

function EmptyState({ search, onChange, outOfRange }: { search: CatalogSearch; onChange: (p: Patch) => void; outOfRange: boolean }) {
  const filtered = hasActiveFilters(search)
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg bg-surface p-8" data-testid="catalog-empty">
      <p className="text-lg font-bold">{outOfRange ? 'Esta página não existe.' : 'Nenhum NFT encontrado.'}</p>
      <p className="text-sm text-muted-foreground">
        {outOfRange
          ? 'O catálogo tem menos páginas com esses filtros.'
          : filtered
            ? 'Tente outros termos ou remova alguns filtros.'
            : 'Ainda não há NFTs à venda.'}
      </p>
      {outOfRange ? (
        <Button asChild>
          <Link to="/" search={withFilters(search, {})}>
            Ir para a primeira página
          </Link>
        </Button>
      ) : (
        filtered && <Button onClick={() => onChange(CLEAR_FILTERS)}>Limpar filtros</Button>
      )}
    </div>
  )
}
