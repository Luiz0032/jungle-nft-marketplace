import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Profile } from '@/contracts'
import { useAuth } from '@/features/auth/hooks'
import { queryKeys } from '@/lib/query-keys'
import { changePassword, fetchProfile, updateProfile, uploadAvatar } from './api'

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => fetchProfile(signal),
  })

/** Resposta do servidor vira o cache do perfil e o usuário da sessão (header). */
function useApplyProfile(userId: string) {
  const queryClient = useQueryClient()
  const auth = useAuth()
  return (profile: Profile) => {
    if (auth.userId() !== userId || profile.id !== userId) return // sessão trocou no meio
    queryClient.setQueryData(queryKeys.profile(userId), profile)
    auth.updateUser(profile)
  }
}

export function useUpdateProfile(userId: string) {
  const apply = useApplyProfile(userId)
  return useMutation({ mutationFn: updateProfile, onSuccess: apply })
}

export function useUploadAvatar(userId: string) {
  const apply = useApplyProfile(userId)
  return useMutation({ mutationFn: uploadAvatar, onSuccess: apply })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}
