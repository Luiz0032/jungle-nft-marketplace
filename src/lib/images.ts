/**
 * Artes em webp têm duas larguras (`-400.webp` / `-800.webp`, ver design/tokens.md#assets).
 * Gera `srcSet` quando a URL segue essa convenção; outras URLs passam intactas.
 */
export function nftImageProps(url: string, sizes: string) {
  const match = /^(.*)-800\.webp$/.exec(url)
  if (!match) return { src: url }
  return { src: url, srcSet: `${match[1]}-400.webp 400w, ${url} 800w`, sizes }
}
