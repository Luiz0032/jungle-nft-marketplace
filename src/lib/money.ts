import Big from 'big.js'
import { ETH_REGEX, type Eth } from '@/contracts/common'

/**
 * Toda aritmética de ETH passa por aqui (invariante 4). Entrada e saída são strings decimais canônicas.
 * Usado pela app (exibição) e pelos mocks (cálculo da cotação). A cotação da API é a referência no checkout.
 */
const ETH_DECIMALS = 18

type BigLike = Big | Eth

function big(v: BigLike): Big {
  if (v instanceof Big) return v
  if (!ETH_REGEX.test(v)) throw new Error(`Valor ETH inválido: "${v}"`)
  return new Big(v)
}

/** Big → Eth canônico (sem zeros à direita, sem expoente). Trunca além de 18 casas. */
export function toEth(v: BigLike): Eth {
  const fixed = big(v).round(ETH_DECIMALS, Big.roundDown).toFixed(ETH_DECIMALS)
  const trimmed = fixed.replace(/\.?0+$/, '')
  if (trimmed.startsWith('-')) throw new Error(`Valor ETH negativo: "${trimmed}"`)
  return trimmed === '' ? '0' : trimmed
}

export const isEth = (v: string): v is Eth => ETH_REGEX.test(v)

export function add(...values: BigLike[]): Eth {
  return toEth(values.reduce<Big>((acc, v) => acc.plus(big(v)), new Big(0)))
}

/** a − b, nunca negativo (lança se b > a). */
export function sub(a: BigLike, b: BigLike): Eth {
  return toEth(big(a).minus(big(b)))
}

export function mul(price: BigLike, quantity: number): Eth {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`Quantidade inválida: ${quantity}`)
  return toEth(big(price).times(quantity))
}

/** `percent`% de `value`, truncado em 18 casas. */
export function percentOf(value: BigLike, percent: number): Eth {
  return toEth(big(value).times(percent).div(100))
}

export function compare(a: BigLike, b: BigLike): -1 | 0 | 1 {
  return big(a).cmp(big(b)) as -1 | 0 | 1
}

export const isZero = (v: BigLike) => big(v).eq(0)

export const min = (a: BigLike, b: BigLike): Eth => toEth(compare(a, b) <= 0 ? a : b)

/** Formata para exibição pt-BR: `1.234,5 ETH`. Arredonda para `maxDecimals` casas (half-up). */
export function formatEth(v: Eth, { maxDecimals = 4, unit = true }: { maxDecimals?: number; unit?: boolean } = {}) {
  const [int = '0', frac = ''] = big(v).round(maxDecimals, Big.roundHalfUp).toFixed(maxDecimals).split('.')
  const intPt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fracTrim = frac.replace(/0+$/, '')
  const text = fracTrim ? `${intPt},${fracTrim}` : intPt
  return unit ? `${text} ETH` : text
}
