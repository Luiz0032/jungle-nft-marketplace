/**
 * "Ou continue com" + Google/Facebook — Figma "Social" (70381:247) / "Mobile Social Block" (70504:2994).
 * Login social está fora do escopo: os botões ficam desabilitados e o motivo é visível (invariante 10).
 */

const providers = [
  { id: 'google', label: 'Continuar com Google', icon: '/assets/icons/google.svg' },
  { id: 'facebook', label: 'Continuar com Facebook', icon: '/assets/icons/facebook.svg' },
] as const

export function SocialSignIn() {
  return (
    <div className="flex flex-col gap-3 lg:pt-6">
      <div className="flex items-center gap-2.5 lg:gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[13px] leading-4 text-foreground">Ou continue com</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <ul className="flex flex-col gap-4 lg:gap-3 lg:px-20" aria-label="Entrar com outra conta">
        {providers.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled
              aria-describedby="social-unavailable"
              className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[5px] border border-border text-[13px] leading-4 font-medium text-muted-foreground opacity-70"
            >
              <img src={p.icon} alt="" width={20} height={20} />
              {p.label}
            </button>
          </li>
        ))}
      </ul>
      <p id="social-unavailable" className="text-center text-xs text-subtle lg:px-20">
        Login social indisponível nesta demonstração.
      </p>
    </div>
  )
}
