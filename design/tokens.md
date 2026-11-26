# Tokens de design (Figma → código)

Fonte: extraído das variáveis e estilos do Figma, nos frames `2:2` (Início), `9:115` (Login), `11:2862` (Pagamento), `14:5226` (Início mobile).
Raios, espaçamentos e sombras não são variáveis no Figma: extraídos dos estilos dos componentes header (`70522:3240`), footer (`70492:696`) e card (`70342:2678`).
Implementação: `src/index.css` (variáveis `--jg-*` → shadcn → `@theme inline`).

## Cores

Tema único escuro, tons de marrom/âmbar.

| Variável Figma | Hex | CSS (`--jg-*`) | Classe Tailwind | Uso |
|---|---|---|---|---|
| `color/ink` | `#140D0A` | `--jg-ink` | `bg-background` / `text-ink` / `text-primary-foreground` | fundo da página; texto sobre primary |
| `color/surface-card` | `#241612` | `--jg-surface-card` | `bg-card` / `bg-surface` | cards, footer, modais |
| `color/surface-raised` | `#2F1D15` | `--jg-surface-raised` | `bg-surface-raised` / `bg-popover` / `bg-muted` / `bg-accent` (hover) | campos de modal, superfícies elevadas |
| `color/surface-dark` | `#38220F` | `--jg-surface-dark` | `bg-surface-dark` / `bg-secondary` | inputs, faixa de marca do footer, chips |
| `color/border` | `#3F2319` | `--jg-border` | `border-border` | bordas, divisórias |
| `color/border-soft` | `#55321F` | `--jg-border-soft` | `border-border-soft` | borda de chips/inputs |
| `color/primary` | `#D28A4C` | `--jg-primary` | `bg-primary` | botões, medalhões, divisórias verticais do footer, ring |
| `color/text-accent` | `#E89B55` | `--jg-accent` | `text-brand` (o `accent` do shadcn é fundo de hover, não esta cor) | preço, item de nav ativo, links de destaque |
| `color/foreground` | `#F5F1EB` | `--jg-fg` | `text-foreground` | texto principal |
| `color/text-primary` | `#F7F3EC` | `--jg-text-primary` | `text-text-primary` | títulos (quase igual a foreground) |
| `color/text-secondary` | `#CFB28C` | `--jg-text-secondary` | `text-muted-foreground` | texto de apoio |
| `color/secondary` | `#B39463` | `--jg-secondary` | `text-subtle` / `placeholder:text-subtle` | placeholder, texto terciário |
| `color/text-coral` | `#F0805F` | `--jg-coral` | `text-coral` / `text-destructive` | erro/alerta, preço riscado |
| `color/success` | `#00A66C` | `--jg-success` | `text-success` | confirmado, sucesso |
| `color/background-elevated` | `#FBFBFB` | `--jg-elevated` | `bg-elevated` | fundos claros pontuais |
| `color/gray-light` | `#EDEDED` | `--jg-gray-light` | `bg-gray-light` | mobile: elementos claros |
| `logo/*` | Google `#4086F4/#59C36A/#FFDA2D`, Facebook `#3B5999`, blue `#4175DF`, orange `#FF641A` | — | — | só nos ícones de login social (SVG) |

Contraste (WCAG, calculado): foreground/ink 17.1 · text-secondary/ink 9.5 · ink sobre primary 6.9 · accent/surface-card 7.7 · accent/ink 8.5 · placeholder/surface-dark 5.2 · coral/ink 7.3 · success/ink 6.1. Todos ≥ AA (4.5).

## Tipografia

Família única: **Roboto Mono** (`font/family`), pesos 400/500/700. Self-host: `public/fonts/roboto-mono-latin-var.woff2` (fonte variável 400–700, subset latin — cobre pt-BR), `font-display: swap`, `<link rel="preload">` em `index.html`.

| Estilo Figma | Tamanho / line-height / peso | Uso típico |
|---|---|---|
| Display/43 Bold | 43 / 70 / 700 | título do hero |
| Heading/24 Bold | 24 / auto / 700 | títulos de seção, letra do medalhão |
| Title/22 Regular | 22 / 29 / 400 | título mobile |
| Title/20 Medium | 20 / 16 / 500 | título de modal |
| Body Large/18 Bold · lh 16/24 | 18 / 16–24 / 700 | preço, títulos de coluna do footer |
| Body Large/18 Regular | 18 / 16 / 400 | |
| Body Large/17 Bold | 17 / 16 / 700 | títulos dos medalhões do footer |
| Body Large/16 Regular·Medium·Bold | 16 / auto–20 / 400·500·700 | nav, nome do NFT, botões |
| Body/15 Regular·Medium·Bold | 15 / 16–40 / 400·500·700 | |
| Body/14 Regular | 14 / 16·22·24·30 / 400 | corpo, links do footer (lh 30) |
| Body/14 Medium · lh 16/20 | 14 / 16–20 / 500 | |
| Body/14 Bold · lh auto | 14 / auto / 700, tracking 10% (1.4px) | wordmark KURIO |
| Caption/13 Regular·Medium | 13 / 16·22 / 400·500 | legendas |
| Caption/12 Regular·Bold | 12 / 14–18 / 400·700 | badges, metadados |
| Tiny/10 Medium | 10 / auto / 500 | número do badge do carrinho |
| Tiny/9 Bold | 9 / auto / 700, tracking 0.1px | chip "METAMASK • WALLETCONNECT • COINBASE" |

Tailwind: usar `text-[43px]/[70px]` etc. só onde a escala padrão não bate; classes utilitárias `text-display` e `text-heading` definidas no `@theme`.

## Raios

| Token | Valor | Uso |
|---|---|---|
| `--radius` (`rounded-md`) | 6px | botões, inputs, chips, newsletter |
| `rounded-sm` | 4px | |
| `rounded-lg` | 10px | modais, cards de blog |
| `--radius-art` (`rounded-art`) | 15px | arte do NFT no card |
| `rounded-full` | — | medalhões do footer (74px, radius 37), badge |

## Espaçamentos (recorrentes)

| Valor | Onde |
|---|---|
| 4 | gap ícone/texto no botão |
| 8 | gap título/links no footer |
| 10 | gap ícones sociais |
| 12 | gap do card de NFT; gap dos medalhões |
| 16 | padding horizontal de coluna do footer |
| 24 | topo da página (desktop); padding lateral mobile |
| 28 | gap das ações do header |
| 32 | padding das faixas do footer |
| 40 | gap da nav do header |
| 96 | espaço vertical entre seções (`Top`→`Products` etc.) |
| 120 | margem lateral desktop (1440 − 1200) / 2 |

Container: `max-w-[1200px]` (`max-w-content`) com `px-4 lg:px-0`.

## Sombras

| Token | Valor | Uso |
|---|---|---|
| `shadow-field` | `0 0 10px rgba(10, 6, 4, 0.45)` | input da newsletter / campos |

## Breakpoints

Figma tem só dois tamanhos: mobile 414 e desktop 1440 (conteúdo 1200).

| Token | Valor | Decisão |
|---|---|---|
| `sm` | 40rem (640) | padrão Tailwind |
| `md` | 48rem (768) | tablet: grid de 2 colunas |
| `lg` | 64rem (1024) | **troca para layout desktop** (header com nav, footer completo, sidebar) |
| `xl` | 80rem (1280) | container 1200 + respiro |

## Assets

Em `public/assets/`. Artes de NFT 1254 × 1254 no Figma → webp em duas larguras para `srcset`.

| Arquivo | Dimensões | Peso | Origem |
|---|---|---|---|
| `nft/emerald-ape-{400,800}.webp` | 400², 800² | 11 / 37 KB | Emerald Ape #042 |
| `nft/sage-nomad-{400,800}.webp` | 400², 800² | 11 / 33 KB | Sage Nomad #009 |
| `nft/neon-vessel-{400,800}.webp` | 400², 800² | 14 / 38 KB | Neon Vessel #552 |
| `nft/golden-beat-{400,800}.webp` | 400², 800² | 14 / 47 KB | Golden Beat #207 |
| `icons/search.svg` | 20 × 20 | 1 KB | header |
| `icons/cart.svg` | 24 × 24 | 1.4 KB | header |
| `icons/login.svg` | 17.8 × 16.9 (slot 20 × 20) | 0.8 KB | botão Entrar |
| `icons/badge.svg` | 20 × 20 (slot 16, inset −12.5%) | 0.3 KB | badge do carrinho (círculo) |
| `icons/active-underline.svg` | 58 × 3 | 0.3 KB | sublinhado do nav ativo (implementado em CSS) |
| `icons/social-{facebook,instagram,twitter,linkedin,youtube}.svg` | 32 × 32 (slot 30, inset −3.33%) | 0.5–1.7 KB | footer |

Ícones são SVG (vetor), não webp. Ícones de UI genéricos (coração, setas, fechar) vêm de `lucide-react`.
