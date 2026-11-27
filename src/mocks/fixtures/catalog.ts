import type { CategorySlug, CollectionRef } from '@/contracts'
import type { ArtworkSlug } from '@/lib/artworks'

export const COLLECTIONS: (CollectionRef & { category: CategorySlug })[] = [
  { slug: 'selva-neon', name: 'Selva Neon', category: 'arte' },
  { slug: 'guardioes-da-mata', name: 'Guardiões da Mata', category: 'games' },
  { slug: 'pixel-primatas', name: 'Pixel Primatas', category: 'colecionaveis' },
  { slug: 'ritmos-tropicais', name: 'Ritmos Tropicais', category: 'musica' },
  { slug: 'ecos-do-rio', name: 'Ecos do Rio', category: 'fotografia' },
  { slug: 'fauna-fractal', name: 'Fauna Fractal', category: 'arte' },
]

export const CATEGORIES: { slug: CategorySlug; name: string }[] = [
  { slug: 'arte', name: 'Arte' },
  { slug: 'games', name: 'Games' },
  { slug: 'musica', name: 'Música' },
  { slug: 'fotografia', name: 'Fotografia' },
  { slug: 'colecionaveis', name: 'Colecionáveis' },
]

/**
 * Uma série por arte (`src/lib/artworks.ts`). O NFT de índice `i` tem como arte principal `SERIES[i % 4]`
 * e é numerado dentro da série (#001…#012). `blurb` completa a descrição e combina com a imagem.
 */
export const SERIES: { artwork: ArtworkSlug; name: string; blurb: string }[] = [
  {
    artwork: 'emerald-ape',
    name: 'Macaco Esmeralda',
    blurb: 'Um macaco de óculos redondos, jaqueta college verde e pingente de esmeralda no peito: estilo de quem já chegou.',
  },
  {
    artwork: 'sage-nomad',
    name: 'Gorila Andarilho',
    blurb: 'Um gorila de pelo prateado, chapéu bucket verde-oliva e moletom lilás, sempre pronto para a próxima trilha.',
  },
  {
    artwork: 'neon-vessel',
    name: 'Chimpanzé Galerista',
    blurb: 'Um chimpanzé de brinco dourado, blazer bege e gola alta verde-escura, com o olhar de quem faz a curadoria da cena.',
  },
  {
    artwork: 'golden-beat',
    name: 'Orangotango Groove',
    blurb: 'Um orangotango de pelo dourado com fones verdes e jaqueta bomber creme, embalado pela própria batida.',
  },
]

export const CREATORS = ['Lia Ramos', 'Kauã Tupi', 'Marina Flor', 'Davi Neon', 'Iara Costa', 'Theo Mata']

export const EDITION_TIERS = [
  { suffix: 'std', label: 'Edição Padrão', multiplier: 1, stock: [3, 25] },
  { suffix: 'rare', label: 'Edição Rara', multiplier: 2.5, stock: [1, 6] },
  { suffix: 'leg', label: 'Edição Lendária', multiplier: 6, stock: [0, 2] },
] as const

