import type { CategorySlug, CollectionRef } from '@/contracts'

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

export const NOUNS = [
  'Onça',
  'Arara',
  'Tucano',
  'Jiboia',
  'Capivara',
  'Mico',
  'Preguiça',
  'Boto',
  'Jacaré',
  'Sapo',
  'Beija-flor',
  'Tamanduá',
]

export const ADJECTIVES = [
  'Elétrica',
  'Cósmica',
  'Dourada',
  'Noturna',
  'Holográfica',
  'Ancestral',
  'Prismática',
  'Selvagem',
]

export const CREATORS = ['Lia Ramos', 'Kauã Tupi', 'Marina Flor', 'Davi Neon', 'Iara Costa', 'Theo Mata']

export const EDITION_TIERS = [
  { suffix: 'std', label: 'Edição Padrão', multiplier: 1, stock: [3, 25] },
  { suffix: 'rare', label: 'Edição Rara', multiplier: 2.5, stock: [1, 6] },
  { suffix: 'leg', label: 'Edição Lendária', multiplier: 6, stock: [0, 2] },
] as const

export const PALETTES = [
  ['#7c3aed', '#22d3ee'],
  ['#f97316', '#facc15'],
  ['#10b981', '#0ea5e9'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#84cc16'],
  ['#ef4444', '#f59e0b'],
] as const
