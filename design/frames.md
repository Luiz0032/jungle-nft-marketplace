# Frames do Figma → telas

Arquivo (cópia editável): `pJtZ1Ne6GsguDac7Yaij8V` · página única `0:1` "Marketplace de NFTs GreenMint".
Marca no layout: **KURIO** (wordmark em texto, Roboto Mono Bold 14 / tracking 1.4px).
Grid desktop: frame 1440, conteúdo 1200 centralizado (margem 120), topo com 24px.
Mobile: frame 414 × 896, padding lateral 24 (Início) / 28 (auth, pagamento).

URL de um node: `https://www.figma.com/design/pJtZ1Ne6GsguDac7Yaij8V/?node-id=<id com - no lugar de :>`

## Telas

| Tela | Rota | Desktop (node · largura) | Mobile (node · largura) |
|---|---|---|---|
| Início | `/` | `2:2` · 1440 × 3668 | `14:5226` · 414 × 896 |
| Detalhes do NFT | `/nft/$id` | `10:244` · 1440 × 2246 | `15:5536` · 414 × 896 |
| Carrinho | `/cart` | `11:1278` · 1440 × 1754 | `16:360` · 414 × 896 |
| Pagamento (Checkout) | `/checkout` | `11:2862` · 1440 × 1657 | `16:748` · 414 × 896 |
| Confirmação de pedido | `/orders/$id` | `11:4385` · 1440 × 1657 (modal `70376:239` · 578 × 821 sobre scrim `11:5105`) | — (não existe no Figma; adaptar o modal desktop) |
| Login | `/login` | `9:115` · 1440 × 1981 (modal `70381:239` · 500 × 600 sobre scrim `9:945`) | `16:1022` · 414 × 896 |
| Cadastro | `/register` | `9:1022` · 1440 × 1981 (modal `70383:239` · 500 × 656 sobre scrim `9:1145`) | `16:1228` · 414 × 896 |
| Perfil do colecionador | `/_auth/profile` | `9:1238` · 1440 × 1080 | — (não existe) |
| Carteiras | `/_auth/wallets` | `9:1670` · 1440 × 1080 | — (não existe) |

### Seções principais (desktop)

| Tela | Seção | Node · tamanho |
|---|---|---|
| Início | Top (header + hero) | `70353:242` · 1200 × 527 |
| Início | Hero | `70347:239` · 1200 × 450 |
| Início | Products (sidebar + grid) | `70342:2831` · 1200 × 1373 |
| Início | Sidebar / Filtros | `70410:3725` · 310 × 1279 · Filters `70485:382` · Featured banner `70410:3791` |
| Início | Product Grid (toolbar, 3×3, paginação) | `70342:2830` · 842 × 1373 · Toolbar `70351:239` · Pagination `70342:2825` |
| Início | Promos | `70353:241` · 1200 × 250 (cards `70353:239`, `70353:240` · 586 × 250) |
| Início | Blog "Diário da Cunhagem" | `70343:253` · 1200 × 476 (cards 268 × 369) |
| NFT | Top / Product (galeria + detalhes) | `70342:2770` · Product `70342:2764` (Images `70363:239` 573, Details `70342:2763` 595) |
| NFT | Description | `70342:2780` · 1200 × 340 |
| NFT | Related Products | `70364:239` · 1200 × 407 |
| Carrinho | Top | `70371:250` · 1200 × 493 |
| Carrinho | Related Products | `70371:239` · 1200 × 411 |
| Pagamento | Checkout Page (instância) | `70522:3321` · 1200 × 903 |
| Confirmação | Checkout Page (fundo) | `70522:3496` · 1200 × 903 |
| Perfil | Top | `70386:264` · 1200 × 803 |
| Carteiras | Top | `70390:267` · 1200 × 716 |

### Seções principais (mobile)

| Tela | Seção | Node · tamanho |
|---|---|---|
| Início | Search Bar · Hero Banner · Tabs · Product Grid · Tab Bar | `70395:239` · `70395:240` · `70395:241` · `70395:242` · `70395:245` (414 × 126) |
| NFT | Hero · Details Sheet · Buy Bar | `70396:241` · `70396:242` · `70396:245` |
| Carrinho | Content · Payment Summary | `70397:239` · `70397:245` |
| Pagamento | Content | `70398:239` · 358 × 832 |
| Login | Logo · Title · Form · Sign In Button · Social · Signup Link | `70399:239` · `70399:240` · `70399:241` · `70399:243` · `70522:3186` · `70399:247` |
| Cadastro | Logo · Title · Form · Create Profile Button · Social · Login Link | `70410:4345` · `70399:249` · `70399:250` · `70399:251` · `70522:3213` · `70399:255` |

## Componentes recorrentes

| Componente | Node · tamanho | Observação |
|---|---|---|
| Header With Divider (desktop) | instância `70522:3240` · 1200 × 45 · componente `70504:3017` | Logo + nav (Início/Mercado/Criadores/Aprenda) + busca + carrinho c/ badge + botão Entrar. Com divisor em Início, Perfil, Carteiras, Login, Cadastro |
| Header Row (sem divisor) | instância `70488:626` (NFT) · componente `70486:560` | Telas do fluxo "Mercado" (NFT, Carrinho, Pagamento, Confirmação): item ativo = Mercado |
| Footer (desktop) | instância `70492:696` · 1200 × 610 · componente `70491:1286` | Igual em todas as telas desktop |
| Tab Bar (mobile) | `70395:245` · 414 × 126 | Início, Favoritos, botão central, Carrinho, Perfil |
| Card de NFT (grid) | `70342:2678` · 258 × 356 | bloco `surface-card` 258 × 300, arte 250 × 250 radius 15, nome 16 Regular, preço 18 Bold accent, gap 12 |
| Card de blog | `70343:258` · 268 × 369 | |
| Card promo | `70353:239` · 586 × 250 | |
| Botão primário (header "Entrar") | `I70522:3240;70504:3015;70486:525` · 100 × 35 | bg primary, texto ink 16 Medium, radius 6, ícone 20 + gap 4 |
| Botão primário (modal) | Sign In Button `70381:246` · 340 × 45 | |
| Input (modal) | Email `70381:242` / Password `70381:243` · 340 × 40 | |
| Input + botão (newsletter) | `I70492:696;70491:1237` · h 40 | bg surface-dark, radius 6, sombra `0 0 10px rgba(10,6,4,.45)` |
| Paginação | `70342:2825` · 207 × 35 | |
| Modal (auth) | `70381:239` · 500 × 600 | header 140, faixa decorativa 500 × 10, botão fechar `9:947` 18 × 18 |

## Referências visuais salvas

- `design/screens/home-desktop.png` — export 1440×3668 da Home desktop (`2:2`), referência visual da Home.

## Assets baixados

Ver `public/assets/` — tabela com dimensões em `design/tokens.md#assets`.

## Pendências de design

- Mobile não tem Confirmação, Perfil nem Carteiras: adaptar a partir do desktop com os mesmos tokens.
