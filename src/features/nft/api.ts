import { NftDetailSchema } from '@/contracts'
import { request } from '@/lib/http'

export const fetchNft = (id: string, signal?: AbortSignal) =>
  request(NftDetailSchema, { url: `/nfts/${encodeURIComponent(id)}`, signal })
