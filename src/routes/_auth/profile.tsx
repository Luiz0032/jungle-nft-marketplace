import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { profileQuery } from '@/features/profile/queries'

/**
 * Perfil — versão mínima (só leitura via GET /profile, chave com userId).
 * Edição, avatar e senha ainda não implementados (Figma 9:1238).
 */
export const Route = createFileRoute('/_auth/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { session } = Route.useRouteContext()
  const profile = useQuery(profileQuery(session.user.id))

  return (
    <section aria-labelledby="page-title" className="py-10">
      <h1 id="page-title" className="text-heading font-bold">
        Meu perfil
      </h1>
      <div className="mt-6 max-w-md rounded-lg bg-surface p-6" aria-busy={profile.isPending}>
        {profile.isPending ? (
          <div className="flex flex-col gap-3" aria-label="Carregando perfil">
            <span className="h-5 w-48 animate-pulse rounded bg-surface-raised motion-reduce:animate-none" />
            <span className="h-4 w-64 animate-pulse rounded bg-surface-raised motion-reduce:animate-none" />
          </div>
        ) : profile.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-coral">Não foi possível carregar seu perfil.</p>
            <Button variant="outline" onClick={() => void profile.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="text-lg font-bold" data-testid="profile-name">
                {profile.data.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd data-testid="profile-email">{profile.data.email}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
