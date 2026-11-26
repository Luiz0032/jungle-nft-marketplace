import { useEffect } from 'react'

const SITE = 'Kurio — Marketplace de NFTs'
const MAX_DESCRIPTION = 160

/**
 * Título e `meta description` por página. Atualiza as tags que já existem no `index.html`
 * (fallback antes do JS) em vez de criar duplicadas no `<head>`.
 */
export function usePageMeta(title: string | undefined, description: string) {
  useEffect(() => {
    document.title = title ? `${title} | Kurio` : SITE
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.append(tag)
    }
    tag.content = clip(description)
  }, [title, description])
}

function clip(text: string) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= MAX_DESCRIPTION ? flat : `${flat.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`
}
