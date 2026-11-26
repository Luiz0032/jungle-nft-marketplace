import { SlidersHorizontal, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { CatalogSearch } from '../search'
import { hasActiveFilters } from '../search'
import { CatalogFilters } from './catalog-filters'

/**
 * Mobile: botão de filtros ao lado da busca (Figma 70395:239) abre um sheet inferior com os mesmos
 * filtros da sidebar. Radix Dialog cuida de foco preso, Esc e retorno do foco ao botão.
 */
export function FilterSheet({ search, onChange }: { search: CatalogSearch; onChange: (patch: Partial<CatalogSearch>) => void }) {
  const active = hasActiveFilters(search)
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={active ? 'Filtros (ativos)' : 'Filtros'}
        className="relative grid size-[45px] shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
        {active && <span aria-hidden="true" className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-background bg-coral" />}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[24px] bg-surface px-6 pt-6 pb-10 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
          <div className="mb-6 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">Filtros</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar filtros"
              className="grid size-9 place-items-center rounded-md text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Os resultados atualizam assim que você escolhe um filtro.</Dialog.Description>
          <CatalogFilters search={search} onChange={onChange} showSearch={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
