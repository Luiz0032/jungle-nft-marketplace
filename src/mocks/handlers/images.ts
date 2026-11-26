import { http, HttpResponse } from 'msw'
import { PALETTES } from '@/mocks/fixtures/catalog'
import { createRng, hashString } from '@/mocks/lib/random'

/** Arte generativa determinística (SVG) para as imagens de NFT do seed. */
function renderSvg(seed: string): string {
  const rng = createRng(hashString(seed))
  const [a, b] = rng.pick(PALETTES)
  const shapes = Array.from({ length: 6 }, () => {
    const cx = rng.int(40, 560)
    const cy = rng.int(40, 560)
    const r = rng.int(40, 180)
    const o = (0.25 + rng.next() * 0.5).toFixed(2)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${rng.next() > 0.5 ? a : b}" fill-opacity="${o}"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><rect width="600" height="600" fill="#0b0b0f" fill-opacity="0.35"/>${shapes}</svg>`
}

export const imageHandlers = [
  http.get('/mock-images/:file', ({ params }) => {
    const file = String(params.file)
    if (!/^[\w-]+\.svg$/.test(file)) return new HttpResponse(null, { status: 404 })
    return new HttpResponse(renderSvg(file), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }),
]
