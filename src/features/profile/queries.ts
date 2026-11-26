import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchProfile } from './api'

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => fetchProfile(signal),
  })
