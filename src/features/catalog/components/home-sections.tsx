import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { nftImageProps } from '@/lib/images'
import { nftListQuery } from '../queries'

/**
 * Seções estáticas/destaques da Home desktop (Figma 2:2) com variação mobile (14:5226).
 * Hero 70347:239 · destaque da sidebar 70410:3791 · promos 70353:241 · blog 70343:253.
 */

export function HomeHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex items-center gap-4 overflow-hidden rounded-[20px] bg-surface p-4 lg:h-[450px] lg:justify-between lg:rounded-none lg:bg-transparent lg:p-0 lg:pl-10"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:max-w-[600px] lg:gap-0 lg:self-start lg:pt-[50px]">
        <p className="text-xs text-foreground lg:mb-3 lg:text-sm">Bem-vindo à Kurio</p>
        <h1 id="hero-title" className="text-xl leading-[30px] font-bold text-foreground uppercase lg:text-display lg:leading-[70px]">
          <span className="lg:hidden">Seja dono da cultura digital</span>
          <span className="hidden lg:inline">
            Seja dono do futuro
            <br />
            da arte digital
          </span>
        </h1>
        <p className="text-xs leading-[18px] text-muted-foreground lg:mt-3 lg:max-w-[560px] lg:text-sm lg:leading-6">
          <span className="lg:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
          <span className="hidden lg:inline">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
            artistas e tenha uma parte da cultura da internet.
          </span>
        </p>
        <a
          href="#catalogo"
          className="mt-1 inline-flex items-center gap-2 self-start rounded-md text-sm font-bold text-brand uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring lg:mt-8 lg:h-10 lg:w-[140px] lg:justify-center lg:bg-primary lg:text-base lg:text-primary-foreground lg:hover:bg-primary/90"
        >
          Explorar
          <ArrowRight aria-hidden className="size-4 lg:hidden" />
        </a>
      </div>
      <img
        {...nftImageProps('/assets/nft/emerald-ape-800.webp', '(min-width: 1024px) 450px, 140px')}
        alt="Emerald Ape, primata de óculos redondos e jaqueta verde"
        width={450}
        height={450}
        fetchPriority="high"
        className="size-[140px] shrink-0 rounded-[15px] object-cover lg:size-[450px] lg:rounded-[20px]"
      />
      <span aria-hidden="true" className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 lg:bottom-11 lg:left-[620px]">
        <span className="size-2 rounded-full bg-primary" />
        <span className="size-2 rounded-full bg-primary lg:bg-primary/60" />
        <span className="size-2 rounded-full bg-primary lg:bg-primary/60" />
      </span>
    </section>
  )
}

/** "NFT EM DESTAQUE / OFERTA LIMITADA": o NFT mais popular entre os em alta (dado real da API). */
export function FeaturedNft() {
  const query = useQuery(
    nftListQuery({ highlight: 'trending', sort: 'popular', page: 1, pageSize: 1, category: [], collection: [] }),
  )
  const nft = query.data?.items[0]

  return (
    <section aria-labelledby="featured-title" className="mt-6 flex flex-col gap-4 bg-surface pt-6">
      <div className="px-5">
        <h2 id="featured-title" className="text-2xl leading-8 font-bold text-brand">
          NFT EM DESTAQUE
        </h2>
        <p className="mt-4 text-center text-base leading-4 font-bold text-foreground">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link to="/nft/$id" params={{ id: nft.id }} className="group relative block outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img
            {...nftImageProps(nft.image, '310px')}
            alt=""
            width={310}
            height={368}
            loading="lazy"
            className="h-[368px] w-full rounded-[20px] object-cover"
          />
          <span className="absolute inset-x-3 bottom-3 rounded-md bg-ink/85 px-3 py-2 text-sm text-foreground backdrop-blur-sm group-hover:text-brand">
            {nft.title}
          </span>
        </Link>
      ) : (
        <div className="shimmer h-[368px] rounded-[20px]" aria-hidden="true" />
      )}
    </section>
  )
}

const promos = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/assets/nft/emerald-ape-800.webp',
    search: { highlight: 'new' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a nova cultura.',
    image: '/assets/nft/neon-vessel-800.webp',
    search: { category: ['arte' as const] },
  },
]

export function Promos() {
  return (
    <section aria-label="Destaques" className="grid gap-6 lg:grid-cols-2 lg:gap-7">
      {promos.map((p) => (
        <article key={p.title} className="flex overflow-hidden rounded-[10px] bg-surface">
          <img
            {...nftImageProps(p.image, '(min-width: 1024px) 287px, 40vw')}
            alt=""
            width={287}
            height={250}
            loading="lazy"
            className="w-[40%] shrink-0 rounded-[15px] object-cover lg:h-[250px] lg:w-[287px]"
          />
          <div className="flex flex-1 flex-col items-end justify-center gap-3 p-4 text-right lg:pr-5">
            <h2 className="text-base leading-6 font-bold text-foreground">{p.title}</h2>
            <p className="text-[13px] leading-[22px] text-muted-foreground">{p.text}</p>
            <Link
              to="/"
              search={p.search}
              hash="catalogo"
              className="inline-flex h-10 w-[140px] items-center justify-center gap-1 rounded-md bg-primary text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explorar <ArrowRight aria-hidden className="size-4" />
              <span className="sr-only">{p.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const posts = [
  {
    date: '12 de setembro',
    read: 6,
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: 'neon-vessel',
  },
  {
    date: '13 de setembro',
    read: 2,
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    image: 'emerald-ape',
  },
  {
    date: '15 de setembro',
    read: 3,
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: 'sage-nomad',
  },
  {
    date: '15 de setembro',
    read: 2,
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: 'golden-beat',
  },
]

/** "Diário da Cunhagem": conteúdo editorial estático. Artigos não existem no escopo → "Ler mais" indisponível. */
export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="flex flex-col gap-10">
      <header className="text-center">
        <h2 id="journal-title" className="text-heading font-bold text-foreground">
          Diário da Cunhagem
        </h2>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {posts.map((p) => (
          <li key={p.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-[10px] bg-surface">
              <img
                {...nftImageProps(`/assets/nft/${p.image}-800.webp`, '(min-width: 1024px) 268px, 50vw')}
                alt=""
                width={268}
                height={195}
                loading="lazy"
                className="h-[195px] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xs leading-[18px] text-muted-foreground">
                  {p.date} &nbsp;|&nbsp; Leitura de {p.read} min
                </p>
                <h3 className="text-base leading-5 font-bold text-foreground">{p.title}</h3>
                <p className="text-xs leading-[18px] text-muted-foreground">{p.text}</p>
                <span
                  aria-disabled="true"
                  title="Artigos indisponíveis nesta demonstração"
                  className="mt-auto cursor-not-allowed text-xs font-bold text-brand/70"
                >
                  Ler mais →<span className="sr-only"> (indisponível nesta demonstração)</span>
                </span>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
