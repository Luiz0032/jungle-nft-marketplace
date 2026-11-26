import { QuoteSchema, type QuoteInput } from '@/contracts'
import { request } from '@/lib/http'

export const fetchQuote = (input: QuoteInput, signal?: AbortSignal) =>
  request(QuoteSchema, { method: 'post', url: '/quote', data: input, signal })
