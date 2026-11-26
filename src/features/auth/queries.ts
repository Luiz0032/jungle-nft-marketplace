import { useMutation } from '@tanstack/react-query'
import { loginRequest, registerRequest } from './api'
import { useAuth } from './hooks'

export function useLoginMutation() {
  const auth = useAuth()
  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => auth.signIn(session),
  })
}

export function useRegisterMutation() {
  const auth = useAuth()
  return useMutation({
    mutationFn: registerRequest,
    onSuccess: (session) => auth.signIn(session),
  })
}

export function useLogoutMutation() {
  const auth = useAuth()
  return useMutation({ mutationFn: () => auth.signOut() })
}
