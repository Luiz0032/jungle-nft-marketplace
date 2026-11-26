import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

/**
 * Footer — Figma "Footer" (70492:696). Conteúdo institucional estático.
 * Só viram link os itens com rota real; o resto é texto, e a newsletter fica
 * desabilitada (fora do escopo, invariante 10).
 */

const features = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
] as const

type FooterItem = { label: string; to?: '/profile' | '/wallets' }

const columns: { title: string; items: FooterItem[] }[] = [
  {
    title: 'Meu perfil',
    items: [
      { label: 'Meu perfil', to: '/profile' },
      { label: 'Minha coleção' },
      { label: 'Atividade' },
      { label: 'Estúdio do criador' },
      { label: 'Lista de interesse' },
    ],
  },
  {
    title: 'Central de ajuda',
    items: [
      { label: 'Central de ajuda' },
      { label: 'Como comprar NFTs' },
      { label: 'Carteira e segurança', to: '/wallets' },
      { label: 'Política do mercado' },
      { label: 'Denunciar item' },
    ],
  },
  {
    title: 'Coleções',
    items: [
      { label: 'Arte digital' },
      { label: 'Fotografia' },
      { label: 'Música' },
      { label: 'Arte 3D' },
      { label: 'Utilidade' },
    ],
  },
]

const socials = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'] as const
const socialNames: Record<(typeof socials)[number], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

const focusRing = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mx-auto mt-24 w-full max-w-content lg:px-0", className)}>
      {/* Medalhões + newsletter */}
      <div className="bg-surface p-8">
        <div className="grid gap-8 md:grid-cols-2 lg:flex lg:items-stretch lg:gap-0">
          {features.map((f) => (
            <section
              key={f.letter}
              aria-labelledby={`footer-feature-${f.letter}`}
              className="flex flex-col gap-3 lg:w-[265px] lg:border-r lg:border-primary lg:px-4 lg:first:flex-1"
            >
              <span
                aria-hidden="true"
                className="grid size-[74px] place-items-center rounded-full bg-primary text-heading font-bold text-primary-foreground"
              >
                {f.letter}
              </span>
              <h2 id={`footer-feature-${f.letter}`} className="text-[17px] leading-4 font-bold text-foreground">
                {f.title}
              </h2>
              <p className="max-w-[204px] text-sm leading-[22px] text-muted-foreground">{f.text}</p>
            </section>
          ))}

          <form
            aria-labelledby="footer-newsletter"
            aria-describedby="footer-newsletter-status"
            className="flex flex-col gap-4 lg:w-[357px] lg:px-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <h2 id="footer-newsletter" className="text-lg leading-4 font-bold text-foreground">
              Antecipe-se ao próximo lançamento
            </h2>
            <div className="flex h-10 items-center rounded-md bg-surface-dark shadow-field">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                E-mail para a newsletter
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                disabled
                placeholder="digite seu e-mail..."
                className="h-full min-w-0 flex-1 bg-transparent pl-3 text-sm text-foreground placeholder:text-subtle disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled
                className="h-10 w-[85px] shrink-0 rounded-r-md bg-primary text-lg leading-4 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                Enviar
              </button>
            </div>
            <p id="footer-newsletter-status" className="text-[13px] leading-[22px] text-muted-foreground">
              Receba lançamentos selecionados, histórias de criadores e novidades do mercado.{' '}
              <span className="text-subtle">(Indisponível nesta demonstração.)</span>
            </p>
          </form>
        </div>
      </div>

      {/* Faixa da marca */}
      <div className="grid gap-4 bg-surface-dark p-8 text-sm leading-[22px] text-foreground md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:items-center lg:gap-[92px]">
        <p className="font-bold tracking-[0.1em]">KURIO</p>
        <p>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <p>contato@email.com</p>
        <p>+55 11 4002 8922</p>
      </div>

      {/* Colunas de links */}
      <div className="grid gap-8 bg-surface p-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-x-[100px]">
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
            <h2 className="text-lg leading-4 font-bold text-foreground">{col.title}</h2>
            <ul className="text-sm leading-[30px] text-foreground">
              {col.items.map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <Link to={item.to} className={`${focusRing} hover:text-brand`}>
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="flex flex-col gap-8">
          <div className="flex w-[190px] flex-col gap-5">
            <h2 className="text-lg leading-4 font-bold text-foreground">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {socials.map((s) => (
                <li key={s}>
                  <img src={`/assets/icons/social-${s}.svg`} alt={socialNames[s]} width={30} height={30} />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg leading-4 font-bold whitespace-nowrap text-foreground">Carteiras compatíveis</h2>
            <p className="flex h-[26px] items-center overflow-hidden rounded-md border border-border-soft bg-surface-dark pl-2 text-[9px] font-bold tracking-[0.1px] whitespace-pre text-brand">
              {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
            </p>
          </div>
        </div>
      </div>

      <p className="py-1.5 text-center text-sm leading-[30px] text-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  )
}
