/**
 * Artes estáticas de `public/assets/nft` (webp 400/800, vindas do Figma) e a descrição de cada uma.
 * Fonte única do texto alternativo: a home usa direto; o seed do mock usa para montar `imageAlt`/`images[].alt`.
 */
export const ARTWORKS = {
  'emerald-ape':
    'Ilustração de um macaco de pelo castanho com óculos redondos de lentes verdes, jaqueta college verde e colar com pingente de esmeralda',
  'sage-nomad': 'Ilustração de um gorila de pelo cinza com chapéu bucket verde-oliva e moletom lilás com capuz',
  'neon-vessel':
    'Ilustração de um chimpanzé de pelo preto com brinco dourado, blazer bege e blusa de gola alta verde-escura',
  'golden-beat': 'Ilustração de um orangotango de pelo dourado com fones de ouvido verdes e jaqueta bomber creme',
} as const

export type ArtworkSlug = keyof typeof ARTWORKS

export const artworkUrl = (slug: ArtworkSlug) => `/assets/nft/${slug}-800.webp`
