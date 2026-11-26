import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Catalog } from '@/features/catalog/components/catalog'
import { CatalogFilters, SearchField } from '@/features/catalog/components/catalog-filters'
import { FilterSheet } from '@/features/catalog/components/filter-sheet'
import { FeaturedNft, HomeHero, Journal, Promos } from '@/features/catalog/components/home-sections'
import { facetsQuery, nftListQuery } from '@/features/catalog/queries'
import { CatalogSearchSchema, toListQuery, withFilters, type CatalogSearch } from '@/features/catalog/search'

/**
 * Home — Figma desktop 2:2 / mobile 14:5226. Busca, filtros, recorte, ordem e página vivem na URL
 * (`validateSearch`); qualquer mudança de filtro volta para a página 1.
 */
export const Route = createFileRoute('/')({
  validateSearch: CatalogSearchSchema,
  loaderDeps: ({ search }) => toListQuery(search),
  // Pré-busca sem bloquear a navegação: a tela mostra skeleton/página anterior enquanto chega.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
    void context.queryClient.prefetchQuery(facetsQuery())
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const onChange = useCallback(
    (patch: Partial<CatalogSearch>) =>
      void navigate({ search: (prev) => withFilters(prev, patch), resetScroll: false }),
    [navigate],
  )

  return (
    <div className="flex flex-col gap-6 pt-6 lg:gap-24 lg:pt-8">
      <div className="flex gap-3 lg:hidden">
        <div className="flex-1">
          <SearchField value={search.q ?? ''} onCommit={(q) => onChange({ q: q || undefined })} />
        </div>
        <FilterSheet search={search} onChange={onChange} />
      </div>

      <HomeHero />

      <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-6 lg:grid lg:grid-cols-[310px_1fr] lg:gap-12">
        <h2 id="catalog-title" className="sr-only">
          Explorar NFTs
        </h2>
        <aside aria-label="Filtros" className="hidden lg:block">
          <div className="bg-surface px-5 py-6">
            <CatalogFilters search={search} onChange={onChange} />
          </div>
          <FeaturedNft />
        </aside>
        <Catalog search={search} onChange={onChange} />
      </section>

      <Promos />
      <Journal />
    </div>
  )
}
