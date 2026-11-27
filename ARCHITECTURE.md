# ARCHITECTURE.md

> Contratos aqui são a especificação; o código em `src/contracts` é a implementação e deve bater com ela.

## 1. Visão geral
SPA React servida estaticamente (Vercel). Não há backend real: REST e Socket.IO são interceptados pelo MSW na camada de rede, em dev, demo (produção) e testes.

```
UI (routes/features) ──► TanStack Query ──► Axios (lib/http) ──► fetch/XHR ──► MSW handlers ──► mock db
        ▲                      ▲
        │                      └── lib/realtime (aplica eventos no cache, dedupe/versão)
        └──────────── socket.io-client (lib/socket) ──► WebSocket ──► MSW ws.link + toSocketIo ──► mock db
```

## 2. Configuração
| Variável | Padrão | Uso |
|---|---|---|
| `VITE_API_URL` | `/api` | base do Axios |
| `VITE_SOCKET_URL` | `wss://realtime.jungle.mock` | URL do Socket.IO (interceptada pelo MSW) |
| `VITE_ENABLE_MOCKS` | `true` | liga o worker MSW (inclusive no build de produção) |

### Versões e dependências
- **MSW fixado em 2.x** (`^2.15`): o `latest` já é 3.x, mas a stack exige MSW 2 e `@mswjs/socket.io-binding@0.2` tem peer `msw ^2.10`.
- **TypeScript fixado em 6.0.x**: TS 7 (latest) ainda não é suportado pelo `typescript-eslint` (peer `<6.1`).
- Vite 8, React 19.3, TanStack Router 1.170 (plugin com `autoCodeSplitting`), Tailwind 4.3, zod 4.
- Deps extras trazidas pelo shadcn/ui (parte da stack shadcn, não libs novas): `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`. Devtools do Router/Query só em dev (lazy, eliminados no build).
- `components.json` mantido à mão (o `shadcn init` é interativo); `shadcn add <comp> -y` funciona, mas gerou `import { cn } from "cn"` — conferir o import após cada `add`.

### Rotas
File-based em `src/routes`; `src/routeTree.gen.ts` é gerado pelo plugin e **versionado** (o `tsc -b` do build roda antes do Vite). Rotas privadas ficam sob o layout sem path `_auth` (`/checkout`, `/orders/$id`, `/profile`, `/wallets`); o guard é o `beforeLoad` desse layout (§6). `notFoundComponent` no root + `defaultNotFoundComponent` no router.

### Bootstrap e deploy
`main.tsx` aguarda `worker.start()` (import dinâmico de `src/mocks/browser`, só se `VITE_ENABLE_MOCKS !== 'false'`) e só então renderiza. `.env` versionado com os padrões (sem segredos). `vercel.json`: rewrite `/(.*) → /index.html` (a Vercel serve arquivos estáticos, como `mockServiceWorker.js`, antes dos rewrites).
Playwright: `webServer = pnpm preview` (porta 4173, reaproveitado se já estiver no ar fora do CI) — **rode `pnpm build` antes de `pnpm test:e2e`** (um preview antigo esquecido na 4173 serve o `dist/` dele); projetos `chromium-desktop` (1440) e `chromium-mobile` (390).

### Tokens de design
`src/index.css`: variáveis `--jg-*` em `:root` (valores do Figma) → mapeadas para as variáveis do shadcn → expostas no Tailwind via `@theme inline` (`bg-surface`, `bg-surface-dark`, `text-brand`, `text-subtle`, `rounded-art`, `max-w-content`, `shadow-field`…). Tabela completa e origem em `design/tokens.md`; tela → node-id em `design/frames.md`.
- Tema único escuro (marrom/âmbar). `--accent` do shadcn = superfície de hover; a cor de destaque do Figma (`text-accent` #E89B55) é `text-brand`.
- Fonte única Roboto Mono, self-host (`public/fonts/roboto-mono-latin-var.woff2`, variável 400–700, subset latin), `font-display: swap` + `<link rel="preload">`. Sem Google Fonts em runtime (teste em `e2e/layout.spec.ts`).
- Assets do layout em `public/assets/` (ícones SVG, artes de NFT em webp 400/800).

Cenário de mock: query param `?scenario=<nome>` (persistido no `sessionStorage` da aba) ou `window.__mock.setScenario()`. Reset do banco mock (e cenário de volta a `default`): `?reset=1` ou `window.__mock.reset()`. Não há painel visual de cenários.
`<head>`: `lang="pt-BR"`, `meta description` e `<title>` padrão no `index.html` (valem antes do JS); cada página atualiza as duas tags com `usePageMeta` (`src/lib/page-meta.ts`) em vez de criar duplicadas. `public/robots.txt` libera o catálogo e bloqueia as rotas privadas.
Bootstrap: `await worker.start()` ANTES de criar o socket e renderizar a app (o MSW precisa ter substituído o `WebSocket` global antes do `socket.io-client` capturá-lo). Por isso a app inteira é carregada com `import('@/app/app')` **depois** do start — ver §5 "Limitações do binding". Para não serializar download e boot, o plugin `preload-app-graph` (`vite.config.ts`) injeta `<link rel="modulepreload">` do grafo estático de `src/app/app.tsx` no `index.html`: o navegador baixa e compila esses chunks enquanto o MSW sobe, mas só os **executa** no `import()` (a ordem de avaliação exigida pelo binding continua igual).

## 3. Dinheiro e quantidades
- Tipo `Eth = string` decimal (ex.: `"0.125000000000000000"`), regex validada no zod.
- Toda conta em `lib/money.ts` com `big.js` (`add`, `mul`, `format`). Nunca `parseFloat`.
- Quantidades: inteiros ≥ 1, validados no schema.
- A cotação da API (`Quote`) é a referência na finalização. O client só exibe; não recalcula o total final.

## 4. Contratos REST
Todas as respostas de erro seguem:
```ts
type ApiError = { code: ErrorCode; message: string; fields?: Record<string, string>; details?: unknown }
type ErrorCode =
  | 'VALIDATION_ERROR'      // 422
  | 'UNAUTHENTICATED'       // 401 (sem sessão)
  | 'SESSION_EXPIRED'       // 401
  | 'FORBIDDEN'             // 403
  | 'NOT_FOUND'             // 404
  | 'CONFLICT'              // 409 (email já usado, idempotency-key com payload diferente)
  | 'AVAILABILITY_CONFLICT' // 409 (estoque/edição esgotada)
  | 'QUOTE_OUTDATED'        // 409 (preço/taxa/cupom mudou)
  | 'COUPON_INVALID' | 'COUPON_EXPIRED' // 422
  | 'TRANSIENT'             // 503
```

### Sessão e conta
| Método | Rota | Corpo / Query | Resposta |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` | `201 Session` · 409 CONFLICT · 422 |
| POST | `/auth/login` | `{ email, password }` | `200 Session` · 401 |
| GET | `/auth/session` | — | `200 Session` · 401 SESSION_EXPIRED |
| POST | `/auth/logout` | — | `204` |

```ts
type Session = { token: string; expiresAt: string; user: User }
type User = { id: string; name: string; email: string; avatarUrl: string | null }
```

### NFTs
| GET | `/nfts` | `q, collection[], category[], minPrice, maxPrice, highlight (new|trending), sort (price_asc|price_desc|newest|popular), page, pageSize` | `Page<NftSummary>` |
| GET | `/catalog/facets` | — | `CatalogFacets` |
| GET | `/nfts/:id` | — | `NftDetail` · 404 |

```ts
type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
type NftSummary = { id; title; collection; image; price: Eth; available: number; version: number }
type NftDetail = NftSummary & { description; images: string[]; creator; editions: Edition[] }
type Edition = { id; label; price: Eth; available: number; version: number }
```

`highlight` são as abas do Figma "Novos lançamentos"/"Em alta" como **recorte**, independente da ordenação: `new` = cunhados nos últimos `NEW_RELEASE_DAYS` (60) dias contados do mais recente; `trending` = popularidade ≥ `TRENDING_MIN_POPULARITY` (600). `CatalogFacets` = `{ collections: {slug,name,count}[], categories: {slug,name,count}[], priceRange: {min: Eth, max: Eth} }`; `count` é do catálogo inteiro (não reage aos filtros).

### Favoritos (auth)
`GET /favorites` → `{ nftIds: string[] }` · `PUT /favorites/:nftId` → 204 · `DELETE /favorites/:nftId` → 204

### Carrinho (auth; convidado fica em localStorage)
| GET | `/cart` | — | `Cart` |
| POST | `/cart/items` | `{ nftId, editionId, quantity }` | `Cart` · 409 AVAILABILITY_CONFLICT |
| PATCH | `/cart/items/:itemId` | `{ quantity }` | `Cart` · 409 |
| DELETE | `/cart/items/:itemId` | — | `Cart` |
| POST | `/cart/merge` | `{ items: GuestItem[] }` | `Cart` (após login; soma respeitando estoque) |

```ts
type Cart = { items: CartItem[]; version: number }
type CartItem = { id; nftId; editionId; title; image; unitPrice: Eth; quantity: number; available: number }
```

### Cotação
`POST /quote` `{ items: {editionId, quantity}[], coupon?: string }` →
```ts
type Quote = { id: string; version: number; expiresAt: string;
  lines: { editionId; unitPrice: Eth; quantity; lineTotal: Eth }[];
  subtotal: Eth; discount: Eth; networkFee: Eth; total: Eth;
  coupon: { code; status: 'applied' } | null }
```
Erros: COUPON_INVALID, COUPON_EXPIRED, AVAILABILITY_CONFLICT.

### Pedidos (auth)
| POST | `/orders` | header `Idempotency-Key`; `{ quoteId, quoteVersion, walletId, network, collector: {...} }` | `202 Order(pending)` · 409 QUOTE_OUTDATED · 409 CONFLICT (key reutilizada com payload diferente) |
| GET | `/orders/:id` | — | `Order` · 403 · 404 |
| GET | `/orders/by-key/:idempotencyKey` | — | `Order` · 404 (recuperação após timeout) |

```ts
type OrderStatus = 'pending' | 'confirmed' | 'rejected'   // confirmed e rejected são terminais
type Order = { id; status: OrderStatus; transactionId: string | null; rejectionReason: string | null;
  receipt: Receipt | null; createdAt; version: number }
type Receipt = { lines: {...snapshot}; subtotal; discount; networkFee; total; wallet; network } // snapshot imutável
```
Mesma key + mesmo payload → devolve o mesmo pedido (sem duplicar). Mesma key + payload diferente → 409.

### Perfil e carteiras (auth)
`GET/PATCH /profile` · `PUT /profile/avatar` (data URL ≤ 1 MB) · `POST /profile/password` `{ current, next }`
`GET /wallets` · `POST /wallets` · `PATCH /wallets/:id` → `Wallet { id; label; address; network; primary: boolean }` (exatamente uma primária)

### Detalhes e acréscimos definidos na implementação
Implementação em `src/contracts/*.ts` (sem alias `@/`, para os specs importarem). Acréscimos ao contrato acima:
- `Eth`: regex `^(0|[1-9]\d*)(\.\d{1,18})?$`, forma **canônica sem zeros à direita** (`"0.125"`, não `"0.125000…"`). `lib/money.ts`: `toEth`, `add`, `sub`, `mul(preço, qtdInteira)`, `percentOf`, `compare`, `min`, `formatEth` (pt-BR, `1.234,5 ETH`).
- `NftSummary.collection` = `{ slug, name }`; `NftSummary.category` ∈ `arte|games|musica|fotografia|colecionaveis`; `price` = menor preço entre edições com estoque (ou entre todas, se esgotado); `available` = soma. `NftDetail.creator` = `{ name, address }`.
- **Novo** `GET /catalog/facets` → `CatalogFacets` (ver acima: coleções e categorias com `count`, `priceRange` com os limites do slider de preço).
- `GET /nfts`: arrays repetidos sem colchetes (`collection=a&collection=b`; Axios com `paramsSerializer: { indexes: null }`). Padrões `sort=newest`, `page=1`, `pageSize=12` (máx. 48 → senão 422). `q` busca em título e nome da coleção. `NftListQuerySchema` serve de base para o `validateSearch`.
- `CartItem.editionLabel` adicionado. Carrinho: somar quantidade da mesma edição; exceder estoque → 409 `AVAILABILITY_CONFLICT` com `details: { editionId, available }`. Merge ignora itens inválidos/esgotados e limita ao estoque.
- `POST /quote` é **pública** (carrinho de convidado); com Bearer, a cotação fica vinculada ao usuário. Cupom case-insensitive. Taxa de rede fixa `0.0025`. `version` = soma das versões das edições cotadas. Validade 5 min. Erros de cupom vêm com `fields.coupon`.
- `POST /orders`: sem `Idempotency-Key` → 422. Replay (mesma key + mesmo payload, comparação por JSON com chaves ordenadas, escopo por usuário) → **200** com o estado atual do pedido. Cotação inexistente/de outro usuário/expirada/versão diferente/preço ou estoque mudou desde a cotação → 409 `QUOTE_OUTDATED`. `walletId` deve ser do usuário e `network` igual à da carteira (senão 422). Estoque é **reservado** na criação e devolvido se `rejected`. Pedido assenta 2 s depois (5 s no `slow`), por timer ou preguiçosamente na próxima requisição (sobrevive a refresh).
- `Receipt` = `{ lines: {nftId, editionId, title, editionLabel, image, unitPrice, quantity, lineTotal}[], subtotal, discount, networkFee, total, coupon: string|null, wallet: {id,label,address}, network, collector }`; `order.receipt` só é preenchido quando `confirmed`. `Network` ∈ `ethereum|polygon|base`.
- `GET /wallets` → `Wallet[]`. `PATCH /wallets/:id` aceita `{ label?, primary?: true }` — só é possível **tornar** primária (as demais viram `false`), garantindo exatamente uma. A primeira carteira criada é primária.
- Senha: 8–72 caracteres, com letra e número. `POST /profile/password` com senha atual errada → 422 `fields.current`; sucesso encerra as outras sessões. Avatar: data URL PNG/JPEG/WebP ≤ 1 MB decodificado.
- Sessão dura 2 h. Sem header → 401 `UNAUTHENTICATED`; token desconhecido/expirado → 401 `SESSION_EXPIRED`.

### Cliente HTTP (`src/lib/http.ts`)
`request(schema, config)` → resposta validada pelo zod no interceptor (`config.schema`); `requestVoid(config)` para 204. Toda falha vira `ApiRequestError { code, status, fields, details }`, com `code` = `ErrorCode` do servidor ou `NETWORK_ERROR | TIMEOUT | INVALID_RESPONSE | UNKNOWN` (cliente). Cancelamento (`signal`) é repassado intacto. `isTransientError` (TRANSIENT/rede/timeout) é o único caso com retry automático de leitura. Token injetado via `setAuthTokenGetter` (ligado por `createAuth().install()`).

### Backend mock (`src/mocks`)
- `db/`: estado único em memória, persistido em `localStorage['jungle-mock-db:v1']` após cada escrita; seed determinístico (`seed.ts`, PRNG mulberry32 com semente fixa): 48 NFTs `nft-001…nft-048`, edições `<id>-std|-rare|-leg` (a `std` sempre tem estoque), 6 coleções, 2 usuários com carteiras, cupons. Senhas: SHA-256(`salt:senha`) via `crypto.subtle`, salt por usuário (fixo nos 2 usuários do seed, para o banco ser determinístico; `randomHex(16)` no cadastro).
- `handlers/utils.ts#route`: toda rota `/api` passa por efeitos do cenário → assentamento de pedidos vencidos → resolver; erros são `throw apiError(...)` tipados; corpo validado com os schemas de `src/contracts` (422 com `fields`).
- `events.ts`: barramento interno do servidor (`edition.changed`, `order.changed`) que `src/mocks/socket.ts` liga ao Socket.IO mock.
- Imagens de NFT: as 4 artes do Figma em `public/assets/nft/<arte>-{400,800}.webp`, em rodízio determinístico no seed (3 por NFT). A app monta `srcset` 400w/800w (`nftImageProps`).

## 5. Contratos de tempo real
Transporte: `socket.io-client` com `transports: ['websocket']`, interceptado por `ws.link` do MSW + `toSocketIo` (`@mswjs/socket.io-binding`).
Autenticação: `auth: { token }` no handshake; o mock associa o socket ao `userId`.

```ts
type RealtimeEvent<T> = {
  eventId: string           // identidade estável (dedupe)
  type: 'nft.updated' | 'order.updated'
  resource: { type: 'nft' | 'edition' | 'order'; id: string }
  version: number           // monotônica por recurso
  userId: string | null     // null = público (nft), obrigatório para order
  payload: T
  emittedAt: string
}
```
- `nft.updated` payload: `{ nftId, editionId?, price?: Eth, available?: number }` → atualiza catálogo, detalhe, carrinho; invalida a cotação.
- `order.updated` payload: `{ orderId, status, transactionId?, rejectionReason? }`.

Regras do cliente (`lib/realtime.ts`):
1. Descarta `eventId` já visto (LRU).
2. Descarta se `version <= lastVersion[resource]`.
3. Descarta `order.updated` com `userId` diferente do usuário atual.
4. Não regride estado terminal de pedido.
5. Ao reconectar: refetch REST dos recursos ativos (queries com observers + pedido pendente).

### Limitações do binding
Suporta só o namespace padrão e eventos de texto (sem namespaces customizados, acks ou binário). Long-polling não é interceptado: forçamos `websocket`.

Achados do POC (msw 2.15.0, @mswjs/socket.io-binding 0.2.0, socket.io-client 4.8.4 / engine.io-client 6.6.8). O binding **funciona**, com quatro armadilhas:
1. **Ordem de import.** O engine.io-client captura `globalThis.WebSocket` na *avaliação do módulo* (`transports/websocket.js`: `const WebSocketCtor = globalThis.WebSocket`), e o MSW só troca o global dentro de `worker.start()`. Se `socket.io-client` for importado estaticamente pela árvore da app, ele fica com o WebSocket nativo e a conexão vai para a rede real (`ERR_NAME_NOT_RESOLVED`). Solução: `main.tsx` faz `await startMocks()` e só então `await import('@/app/app')`.
2. **Path `/socket.io/`.** O `WebSocketHandler.parse` do MSW 2.15 reescreve o path do cliente `/socket.io/` → `/` antes de casar a URL. Um `ws.link('…/socket.io/*')` nunca casa (a conexão fica sem handler e vaza para a rede). Usamos `ws.link(\`${VITE_SOCKET_URL}/*\`)`.
3. **Handshake automático.** O binding responde sozinho `0{…}` (OPEN) e `40{"sid":"test"}` (CONNECT) sem esperar o CONNECT do cliente nem validar `auth`. A autenticação é feita no `src/mocks/socket.ts` lendo o pacote cru do cliente `40{"token":…}`: sem token → conexão anônima (só eventos públicos); token inválido/expirado → evento `auth_error` + DISCONNECT (`41`), sem reconexão automática. Todo socket tem `sid` `"test"`; identificamos conexões pelo `client.id` do MSW.
4. **Sem PING.** O OPEN anuncia `pingInterval 25s / pingTimeout 5s`, mas o binding nunca pinga; o cliente derrubaria a conexão a cada ~30 s. O servidor mock envia `2` (PING) a cada 20 s (verificado: mesma conexão após 36 s).

### Implementação
- Contrato em `src/contracts/realtime.ts` (`RealtimeEventSchema`, união discriminada por `type`); o nome do evento Socket.IO é o próprio `type`. `nft.updated` de edição usa `resource: { type: 'edition', id: editionId }` e `version` = versão da edição.
- Servidor (`src/mocks/socket.ts`): o barramento interno (`mocks/events.ts`) vira evento — `edition.changed` → `nft.updated` público para todas as conexões; `order.changed` → `order.updated` só para conexões do dono. Mantém log dos últimos 200 eventos emitidos (`__mock.socket().emitted`).
- Cliente (`src/lib/socket.ts`): um socket por vez; convidado conecta anônimo; `connectSocket(token)` troca a conexão; `disconnectSocket()` remove todos os listeners antes de desconectar. Backoff de reconexão 0,5–3 s.
- `src/lib/realtime.ts`: valida com zod; LRU de 500 `eventId`; última versão por `resource.type:id` + comparação com a versão já no cache (REST mais novo vence); filtra `userId`; pedido terminal nunca muda (e terminal dispara refetch do pedido para trazer o recibo); `nft.updated` atualiza o detalhe, recalcula o resumo nas listas (ou invalida as listas que contêm o NFT se o detalhe não está em cache), invalida carrinho e cotação; no `reconnect` do Manager refaz as queries ativas + pedidos `pending`. Cada `attach` incrementa uma época: handlers do socket anterior são removidos e, se algo atrasado chegar, é descartado.
- Cenários: `price-change` sobe 10% o preço da 1ª linha 3 s após o primeiro `POST /quote` (uma vez); `socket-drop` derruba as conexões do usuário 300 ms após criar o pedido e recusa reconexões por 3 s (o pedido assenta em 2 s → o `order.updated` é perdido e precisa de reconciliação REST).

## 6. Sessão
Implementação: `src/features/auth/session.ts` (`createAuth`), instanciado uma vez em `src/app/app.tsx` (singleton de módulo, instalado antes do primeiro `beforeLoad`) e exposto no contexto do router (`context.auth`) e no React (`AuthContext`, `useAuthState`/`useCurrentUser`).

- **Persistência:** `localStorage['jg:session']` = `Session` validada com zod na leitura. Dados privados do usuário vivem em `jg:user:<userId>:*` (local ou session storage); `clearPrivateStorage()` apaga sessão + todo `jg:user:*`. Chaves públicas (`jg:guest-cart`) sobrevivem ao logout.
- **Validação concorrente:** se outra chamada privada recebe 401 enquanto `GET /auth/session` está em voo, a validação responde com o estado atual (`expired: true`), e o redirect leva `reason=expired`.
- **Refresh:** a sessão restaurada fica `validated: false`; `GET /auth/session` (query `['auth','session']`, `skipSessionExpiry`) confirma no boot. Rotas `_auth` aguardam essa validação no `beforeLoad`. 401 → convidado + `reason=expired`; erro de rede → mantém a sessão (a próxima chamada privada decide).
- **Sessão já validada não é revalidada a cada navegação.** Revalidar em todo `beforeLoad` criou uma corrida real (logout logo após o login: o redirect de um `beforeLoad` atrasado vencia a navegação mais nova). Expiração posterior chega pela próxima chamada privada.
- **Expiração:** `http.ts` chama `setSessionExpiredHandler(token)` em `SESSION_EXPIRED`/`UNAUTHENTICATED` de requisição que levava `Authorization` (exceto rotas de auth, `skipSessionExpiry`). A auth só expira se o token for o **atual** (resposta atrasada de sessão antiga é ignorada). O `auth_error` do socket faz o mesmo. Em rota protegida → `/login?redirect=<href atual>&reason=expired` (toast + aria-live); em rota pública → só aviso. O flag `expired` sobrevive ao preload por hover (`defaultPreload: 'intent'`), que pode descobrir a expiração antes do clique.
- **Login/cadastro:** `useLoginMutation`/`useRegisterMutation` → `auth.signIn(session)`. Convidado → usuário: mantém o cache público, troca o socket. Usuário A → B: `wipe()` completo antes.
- **Logout:** sai da rota protegida primeiro (cancela `beforeLoad` pendente), depois `wipe()` + `POST /auth/logout` (melhor esforço) + socket anônimo.
- **`wipe()` (invariante 5), nesta ordem:** desconecta o socket (remove listeners; nenhum evento tardio entra) → cancela queries → `queryClient.clear()` → `realtime.reset()` (ids/versões vistos) → `clearPrivateStorage()`.
- **Redirect seguro:** `safeRedirect()` aceita só caminho relativo da app (bloqueia `//host`, `/\host`, URL absoluta e loop para /login|/register).
- **Formulários:** react-hook-form + `zodResolver` com os schemas de `src/contracts` (cadastro estende com `confirmPassword`, só no cliente). `fields` do erro da API → erro no campo com foco (`CONFLICT` de e-mail); demais erros → `root.server` com `role="alert"`.

## 7. Carrinho
- **Um hook, duas fontes** (`features/cart/queries.ts` → `useCart()`), mesma `CartLine` (chave = `editionId`):
  - **Convidado:** `localStorage['jg:guest-cart']` guarda só `{ nftId, editionId, quantity }` (zod na leitura; abas sincronizam pelo evento `storage`). Título, arte, preço e estoque vêm do `GET /nfts/:id` de cada NFT (`nftDetailQuery`) — nunca preço salvo, e o `nft.updated` já atualiza esse cache. Somar a mesma edição respeita o estoque informado pela API (mesma regra do servidor).
  - **Usuário:** `GET /cart` em `['user', userId, 'cart']` (staleTime 0, retry 1).
- **Fusão no login** (`CartSync`, montado no `__root`): ao existir usuário e itens de convidado, `POST /cart/merge` (servidor soma e limita ao estoque) → `setQueryData` do carrinho → limpa o localStorage → toast/aria-live. Também roda após refresh com sessão salva. Enquanto a fusão está em voo o `GET /cart` espera (não mostra carrinho incompleto); falha mantém os itens (`merge = 'error'`) e a tela oferece "Tentar de novo". Resposta que chega depois de logout/troca de usuário é descartada. Cupom do convidado passa para o usuário se ele não tiver um.
- **Quantidade e remoção otimistas** (usuário): `cancelQueries` → snapshot → `setQueryData`; erro → snapshot de volta + toast/aria-live (mensagem do 409 `AVAILABILITY_CONFLICT` quando houver). Mutações compartilham `mutationKey`; só a última em voo reconcilia (`setQueryData` + `invalidateQueries`), evitando o "pisca" de respostas intermediárias. Convidado: síncrono no localStorage.
- **Limites:** quantidade inteira em `[1, estoque da edição]`; botões −/+ confirmam na hora, o campo confirma no blur/Enter (uma requisição por edição, não por tecla) e é preso ao intervalo. Se o estoque cair abaixo do que está no carrinho (evento), a linha avisa ("Só N disponíveis" / "Esgotada"), só permite diminuir/remover e o resumo mostra o 409 da cotação — não ajustamos sozinhos a escolha do usuário.
- **Resumo = `POST /quote`** (`features/quote`): chave `['quote', scope, { items, coupon }]` → toda mudança de itens/cupom gera cotação nova; `nft.updated` invalida `['quote']`. staleTime 0, sem retry, `keepPreviousData` com "Atualizando valores…" + `aria-busy`, renovada 15 s antes de `expiresAt`. O cliente não soma o total (o subtotal de cada linha é só exibição).
- **Cupom:** "Aplicar" faz `fetchQuery` da cotação com o cupom normalizado (trim + maiúsculas); só se a API aceitar o cupom é gravado (`jg:user:<id>:coupon`, privado, ou `jg:guest-coupon`). `COUPON_INVALID`/`COUPON_EXPIRED` → erro no campo (`aria-invalid` + `aria-describedby`) + toast/aria-live. Cupom salvo que deixar de valer numa cotação posterior é removido com aviso.
- **Tempo real com o carrinho aberto:** a tela assina o `realtime`; `nft.updated` de um NFT do carrinho → toast + aria-live dizendo o que mudou (preço/estoque, comparando com o último estado renderizado) + "Resumo recalculado" (o recálculo vem da invalidação feita pelo `realtime.ts`).
- **Badge do header:** soma das quantidades, só com carrinho carregado e > 0; o nome acessível do link inclui a contagem.
- Convidado não finaliza: o resumo mostra "Entrar para finalizar" (`/login?redirect=/cart`), e a fusão leva os itens para a conta.

### 7.1 Checkout e pedidos
- **Rotas:** `/_auth/checkout` e `/_auth/orders/$id` (protegidas). "Finalizar compra" no carrinho só vira link com cotação válida e sem avisos; convidado vê "Entrar para finalizar".
- **Etapas:** (1) dados do colecionador (react-hook-form + `CollectorSchema`, pré-preenchidos com o usuário), rede → carteira daquela rede (padrão: a principal) → conexão; (2) revisão. "Revisar pedido" exige carteira conectada e grava a cotação vista como **aceita**.
- **Conexão de carteira:** `features/wallets/connection.ts` fala com `window.kurioWallet` (`connect`/`disconnect`; recusa = erro 4001 → "Conexão recusada na carteira."). Conexão guardada em `sessionStorage['jg:user:<id>:wallet-connection']` (privada). A conta/rede devolvida precisa bater com a carteira escolhida. Desconectar na revisão bloqueia o pagamento.
- **Reconfirmação:** `quoteSignature` (linhas, preços, quantidades, subtotal, desconto, taxa, total, cupom). Se a cotação atual difere da aceita — por `nft.updated` (o realtime invalida `['quote']`) ou pela revalidação —, aparece "Os valores mudaram" com o antes/depois e o botão de pagar fica bloqueado até "Aceitar novos valores". Estoque insuficiente → 409 na cotação → bloqueado com link para o carrinho.
- **Confirmar:** (a) trava síncrona (`useRef`) + botão desabilitado contra cliques repetidos; (b) **revalida** a cotação (`fetchQuery`, staleTime 0) — mudou → não envia; (c) abre a tentativa em `src/lib/idempotency.ts` (`nanoid` como `Idempotency-Key`, payload exato com `quoteId`/`quoteVersion`, persistida em `jg:user:<id>:checkout-attempt`); (d) `POST /orders`.
- **Respostas:** 202/200 → grava `orderId` na tentativa e vai para `/orders/<id>`. 4xx definitivo (`QUOTE_OUTDATED`, `AVAILABILITY_CONFLICT`, validação, `CONFLICT`) → tentativa descartada (o pedido não existe), cotação invalidada e aviso. Sem resposta (timeout de 10 s do Axios, rede, 5xx) → **não descarta**: `GET /orders/by-key/:key` (3 tentativas, 1 s); achou → segue para o pedido; não achou → "Reenviar pedido", que reenvia a MESMA chave e o MESMO payload (o servidor devolve o pedido se já existir). Descartar a tentativa só é oferecido depois de `by-key` responder 404.
- **Refresh:** ao abrir o checkout com tentativa em aberto → com `orderId` vai direto ao pedido; sem → já começa procurando pela chave. Logout apaga a tentativa (storage privado).
- **Pedido:** `['user', userId, 'orders', id]`, staleTime 0, retry só transitório. `order.updated` atualiza o cache (realtime.ts); enquanto `pending` **e** socket desconectado (`useSocketConnected`), consulta a cada 3 s, com aviso "Conexão em tempo real perdida"; ao reconectar, o realtime refaz pedidos pendentes. A tela só mostra "Pedido confirmado" com `status === 'confirmed'` vindo da API/evento; `rejected` mostra o motivo e "Tentar novamente" (nova tentativa = nova chave). Estado terminal → tentativa encerrada.
- **Recibo:** `order.receipt`, snapshot criado pelo servidor no `POST /orders` e liberado no `confirmed` — preços mudados depois não o alteram.
- **Carrinho após a compra:** o servidor mock, ao confirmar, subtrai do carrinho do usuário só as quantidades compradas (o que foi adicionado depois do envio continua); a app invalida o carrinho no `confirmed` (evento ou REST) e remove o cupom usado. Recusado → carrinho intacto e estoque devolvido.
- Controle de teste: `window.__mock.orders()` lista os pedidos (id, status, chave) para provar "N cliques / timeout → 1 pedido"; `window.__mock.settleOrder(id, outcome)` assenta um pedido do cenário `order-hold`.
- **Fronteira mock × app:** nada fora de `src/mocks` importa de lá, exceto o bootstrap em `main.tsx` (`import('@/mocks/browser')`). A carteira simulada chega só como `window.kurioWallet`, tipada por `src/contracts/wallet-extension.ts`.

## 8. Política de cache, retry e sincronização
| Query | staleTime | retry | Observações |
|---|---|---|---|
| nfts (lista) | 30 s | 2 (só TRANSIENT/rede) | `placeholderData: keepPreviousData` |
| facets | 5 min | 2 | contagens do catálogo inteiro |
| sessão (`GET /auth/session`) | 0 | não | confirma a sessão restaurada no boot (§6) |
| nft detalhe | 30 s | 2 | atualizado por `nft.updated` |
| cart | 0 | 1 | invalidado após mutação e eventos |
| quote | 0 | 0 | nunca reutilizada após mudança |
| order | 0 | 3 | polling 3 s enquanto `pending` se socket desconectado |
| privadas | — | — | key inclui `userId`; `clear()` no logout |
Mutações: retry 0, exceto `POST /orders` (retry manual com a MESMA idempotency key).
Otimista: favoritos (toggle) e quantidade do carrinho, com rollback + toast em erro.

**Catálogo:** a URL é a fonte da verdade (`validateSearch` com `CatalogSearchSchema`; valores inválidos caem no padrão com `.catch`). Padrões não vão para a URL (`cleanSearch`); toda mudança de filtro/busca/ordem/recorte passa por `withFilters` e zera `page`. `toListQuery` monta a query da API com padrões explícitos (chave de cache estável) e `pageSize` 9 (grade 3×3 do Figma). A busca confirma com debounce de 350 ms (uma entrada de histórico por busca, não por tecla). O `loader` da rota só faz `prefetchQuery` (não bloqueia a navegação). Respostas fora de ordem: cada busca tem a sua chave, a tela só lê a chave atual e o TanStack Query aborta (via `signal` no Axios) a busca que perdeu o observador — testado com o cenário `out-of-order`.

**Favoritos:** `['user', userId, 'favorites']`. Toggle otimista: `cancelQueries` → snapshot → `setQueryData`; erro → volta o snapshot (sem snapshot, `resetQueries`, porque `setQueryData(key, undefined)` não faz nada) + toast/aria-live; sempre `invalidateQueries` no fim. O coração fica desabilitado até a lista do usuário chegar (alternar partindo de estado desconhecido gerava rollback errado). Convidado → `/login?redirect=<página atual>`.

**Detalhe:** a quantidade é inteira e presa a `[1, estoque da edição]`; se `nft.updated` baixa o estoque abaixo do escolhido, a quantidade exibida acompanha e o aviso diz o que mudou (preço e/ou estoque, comparando com o último estado renderizado).

**Rotas protegidas:** além do `beforeLoad`, o layout `_auth` reage a qualquer perda de sessão já dentro da rota (logout, expiração, corrida "Sair" antes da navegação pós-login terminar): não renderiza nada privado e vai uma vez para `/login?redirect=<rota>` (`reason=expired` se foi expiração).

**Deploy:** `vite:preloadError` recarrega a página (aba aberta antes de um deploy pede chunks que não existem mais).

## 9. Cenários de mock
| Cenário | Efeito |
|---|---|
| `default` | latência 150–400 ms, tudo funciona |
| `slow` | 2–4 s (skeletons) |
| `flaky` | 30% TRANSIENT 503 em GET |
| `offline` | erro de rede em tudo |
| `out-of-order` | respostas de busca com latência invertida |
| `empty` | catálogo vazio |
| `session-expired` | sessão expira na próxima chamada privada |
| `price-change` | emite `nft.updated` 3 s após abrir o carrinho/checkout |
| `sold-out` | edição esgota durante a compra |
| `order-timeout` | POST /orders cria o pedido mas a resposta estoura timeout |
| `payment-declined` | pedido termina `rejected` |
| `socket-drop` | derruba o socket com pedido pendente e reconecta |
| `order-hold` | pedido fica `pending` (sem timer, sobrevive a refresh) até `window.__mock.settleOrder(id, 'confirmed' \| 'rejected')`, que assenta pelo mesmo caminho do servidor e emite `order.updated` pelo socket |
Controle programático (Playwright): `window.__mock.setScenario()`, `.getScenario()`, `.reset()`, `.emit(event)` — emite PELO servidor mock do socket, nunca direto na UI. Também: `.updateEdition(editionId, { price?, available? })` (muda o banco; o servidor emite `nft.updated`), `.dropSockets({ userId?, outageMs? })` e `.socket()` (conexões autenticadas + log de eventos emitidos). `window.__mock` só aparece **depois** de `worker.start()` (specs esperam por ele com `waitForFunction`).

Implementação (`src/mocks/scenarios`): estado em `sessionStorage['jungle-mock-scenario']` (por aba, sobrevive a refresh). Latência e falhas do `flaky` saem de PRNG semeado por `cenário + nº da requisição` → **reproduzível** (mesma sequência de chamadas → mesmos resultados; `setScenario` zera o contador). Detalhes: `out-of-order` só afeta `GET /nfts` (2,5 s, 1,8 s, 1,1 s, 0,4 s, 0,15 s…); `session-expired` expira uma única vez; `sold-out` zera o estoque da 1ª linha no `POST /orders` e responde 409; `order-timeout` cria o pedido e segura a resposta 15 s (> timeout de 10 s do Axios); `payment-declined` assenta `rejected` e devolve o estoque. `price-change` e `socket-drop` dependem do socket.
Fixtures: ≥ 40 NFTs (filtros/paginação), 2 usuários (`ana@jungle.test` / `Senha@123`, `bruno@jungle.test` / `Senha@123`), cupons `JUNGLE10` (válido), `EXPIRED5` (expirado).

**Testes e cenários:** `setScenario()` vale na hora para a app já aberta. Antes de ativar um cenário de efeito único (`session-expired`) ou de falha (`offline`), o spec espera a rede assentar (`waitForLoadState('networkidle')` ou a resposta da mutação). Senão uma query ainda em voo (por exemplo o carrinho do header) consome o efeito no lugar da chamada testada. O único teste que era pulado no mobile (nav do header) agora verifica o comportamento do mobile (nav oculta, carrinho com `aria-current`).

### 9.1 Suíte E2E (Sessão 10)
- **Isolamento:** todo teste chama `bootMock(page, '<cenário>')`, que espera o worker, roda `window.__mock.reset()` e ativa o cenário. O cenário é parâmetro obrigatório, então nenhum spec depende do padrão implícito.
- **Cobertura dos 12 itens do README:** 1 `catalog` (busca/filtros/ordem/página/histórico, fora de ordem) · 2 `catalog`/`smoke` (acesso direto, 404) · 3 `auth` · 4 `favorites` (rollback + nova tentativa) · 5 `cart` · 6 `checkout` (compra completa + recibo snapshot) · 7 `checkout` (recusa, cliques repetidos, timeout → mesmo pedido pela chave) · 8 `profile` · 9 `checkout`/`realtime` (preço/estoque pelo socket) · 10 `realtime`/`checkout` (duplicado/antigo, outro usuário, queda/reconciliação, pedido pendente retomado) · 11 `a11y` · 12 `slow` (`@slow`: skeleton de catálogo, detalhe e resumo do carrinho; erro após retries e recuperação pelo botão em catálogo, detalhe e carrinho).
- **Relógio controlado (`page.clock`, `e2e/support/clock.ts`):** o servidor mock (`delay()`, assentamento, `setTimeout` do `price-change`) e o TanStack Query rodam na página. Com o relógio pausado nada que dependa de timer acontece até o teste avançar o tempo. Usos: skeletons ficam na tela sem depender da velocidade da máquina; backoff de retry; pedido só confirma depois de 2 s de relógio (tempo real sozinho não confirma); renovação da cotação 15 s antes dos 5 min; cotação vencida → `409 QUOTE_OUTDATED`; `price-change` só emite depois de 3 s. `advanceUntil` avança em passos curtos porque cada requisição passa pelo Service Worker (assíncrono, em tempo real) antes de o handler agendar o timer. **Não coberto pelo relógio:** o timeout do Axios (XHR nativo); o teste de `order-timeout` mede tempo real (entre 9,5 e 15 s).
- **Traces:** `trace: 'retain-on-failure'` (toda falha, inclusive a primeira tentativa).
- **Regressão visual (`e2e/visual.spec.ts`, `@visual`):** início, detalhe, carrinho e pagamento × desktop 1440 / mobile 390. Para estabilidade: seed determinística + cenário `default`, `reducedMotion: 'reduce'` + `animations: 'disabled'`, caret escondido, espera de `document.fonts.ready`, imagens decodificadas e nenhum `aria-busy`, máscara em toasts e no indicador de tempo real, `maxDiffPixelRatio: 0.01`. Baselines em `e2e/__screenshots__/` **sem plataforma no nome** (`snapshotPathTemplate`) e **sempre geradas em Linux** na imagem `mcr.microsoft.com/playwright:v<versão do @playwright/test>-noble`: `pnpm test:visual:update` (Docker; `node_modules` do host isolado por volume anônimo) ou, sem Docker, Actions → **E2E** → *Run workflow* com `update_snapshots`, que regenera e faz commit. Fora do Linux a comparação é pulada (8 testes "skipped"; `VISUAL_LOCAL=1` força, para inspecionar).
- **CI (`.github/workflows/e2e.yml`):** ubuntu + container da mesma imagem do Playwright (confere a versão contra o lockfile), `typecheck`, `lint`, `build` e a suíte completa (2 workers, 2 retries). Permissão padrão `contents: read`; só o job `baselines` (disparo manual com `update_snapshots`) tem `contents: write`. Actions fixadas por SHA de commit. O relatório HTML é publicado sempre como artifact `playwright-report`; os traces/anexos das falhas, como `playwright-traces`.
- **Flakiness:** suíte rodada 2× seguidas sem retries no Windows: 171 passaram, 8 visuais pulados (por desenho), 0 falhas nas duas. `@slow` também rodou com `--repeat-each=2`: 24/24.

## 10. Decisões de UX
- **Estados de tela.** Toda tela com dado remoto tem cinco estados. Carregando: skeleton com shimmer e as mesmas dimensões do conteúdo final, `role="status"` + `aria-busy`. O skeleton do detalhe espelha trilha, galeria e "Mais desta coleção", para o footer não pular. Os outros quatro: vazio com uma ação de saída (ex.: "Limpar filtros" no catálogo filtrado), erro com "Tentar novamente" (só depois dos retries automáticos de erro transitório), sucesso, e refetch em background que mantém o dado anterior (`keepPreviousData`; no resumo, "Atualizando valores…" + `aria-busy`).
- **Feedback.** Mutações e eventos de tempo real usam `notify()` (`src/lib/notify.ts`), que dispara o toast (sonner, canto inferior direito) e escreve o mesmo texto na região `aria-live="polite"` do root. Erro de campo fica no campo (`aria-invalid` + `aria-describedby`, foco no primeiro inválido). Erro geral de formulário usa `role="alert"`.
- **Nada finge funcionar** (invariante 10). O que está fora do escopo fica desabilitado com aviso: login social, "Esqueceu a senha?", newsletter, "Criadores"/"Aprenda", Tab Bar. Pedido só aparece como confirmado com `confirmed` da API ou do evento. Durante `pending`, a tela diz que está aguardando a confirmação da rede.
- **Otimista só onde o desfazer é barato:** favoritos e quantidade/remoção no carrinho, com rollback + aviso. Cupom, cotação e pedido nunca são otimistas: dependem da resposta do servidor.
- **Mudança de valores nunca é silenciosa.** Preço ou estoque que muda pelo socket aparece com o antes e o depois (detalhe, carrinho, checkout). No checkout, o pagamento fica bloqueado até "Aceitar novos valores". A escolha do usuário (quantidade) nunca é corrigida sozinha: a tela avisa e oferece a correção.
- **URL é estado:** filtros, busca, ordem, recorte e página do catálogo ficam na URL (voltar/avançar, compartilhar e refresh funcionam). `redirect` preserva o destino depois do login.
- **Movimento:** `prefers-reduced-motion` desliga shimmer, transições e rolagem suave (CSS global).

## 11. Desvios do Figma e acessibilidade
- **Home/Detalhe:** artes de NFT do Figma em rodízio no seed (4 imagens para 48 NFTs, 3 por NFT). Coleções e nomes vêm do mock, não dos textos do Figma.
- Busca: no desktop o Figma só tem o ícone no header; o campo fica no topo da sidebar de filtros (mesmo estilo do campo mobile "Explorar coleções"). O ícone do header leva ao catálogo.
- Filtros: o bloco "Coleções" do Figma lista as **categorias** do contrato; o bloco "Rede" (o contrato não tem rede) lista as **coleções**. Contagens são reais (facetas). O slider de faixa de preço é feito com dois `<input type=range>` (teclado e leitor de tela nativos) + "Aplicar".
- Abas "Todos os NFTs / Novos lançamentos / Em alta" = recorte `highlight`; "Ordenar por" é um `<select>` nativo estilizado.
- Card: selo "RARO" (≤ 3 unidades) e "ESGOTADO" (0) com dado real; preço riscado do Figma omitido (não há preço anterior no contrato). Coração sempre visível (o Figma mostra ações só no hover desktop; aqui é acessível por toque/teclado). Ícone de carrinho no card ainda não implementado.
- Hero: slide único; os 3 pontos do carrossel são decorativos (`aria-hidden`), sem fingir navegação.
- "Diário da Cunhagem": conteúdo editorial estático; "Ler mais" indisponível (não há artigos no escopo).
- Detalhe: estrelas/"19 avaliações" e a aba "Avaliações" omitidas (não há avaliações no contrato — não inventamos dado). "Atributos", "Rede", "Contrato" e "Royalties" trocados por dados reais (criador, edições, estoque total). Pílulas de edição mostram o rótulo da edição (Padrão/Rara/Lendária). "COMPRAR"/"Comprar NFT" adiciona a quantidade escolhida e leva ao carrinho; o botão-ícone de carrinho só adiciona — e aparece também no desktop (no Figma só existe no mobile), para adicionar sem sair da página. Edição esgotada → ambos desabilitados com aviso. "Compartilhar" copia o link.
- Mobile: header compacto continua visível (a Tab Bar do Figma não foi implementada); barra de compra fixa no detalhe como no Figma, com respiro no fim da página.
- **Login/Cadastro:** no desktop o Figma mostra o modal sobre a Home com scrim; `/login` e `/register` são rotas próprias (acesso direto, refresh e `redirect` funcionam sem montar o catálogo atrás), com o cartão de 500px (mesmas medidas do modal: raio 8, faixa primary de 10px, X que volta ao início) sobre o fundo `ink`, sem scrim. Abas "Entrar | Criar conta" são links que preservam `redirect`. No mobile (< lg) header e footer somem, como no Figma.
- Inputs do Figma usam só placeholder: o `<label>` existe e está associado (`sr-only`); erros ficam abaixo do campo (`aria-describedby`, `aria-invalid`, borda coral). Mostrar/ocultar senha usa `EyeOff`/`Eye` do lucide (o Figma só desenha o estado "oculto"); também na confirmação de senha.
- Botão principal do cadastro: "Criar perfil" no mobile e "Criar conta" no desktop, como nos frames.
- Login social e "Esqueceu a senha?" estão fora do escopo: desabilitados, com o aviso "Login social indisponível nesta demonstração." (texto extra em relação ao Figma).
- Header logado (não desenhado no Figma): avatar com inicial + primeiro nome (≥ xl) levando ao perfil, e botão "Sair" no estilo do "Entrar".
- "Início" fica visualmente ativo em Entrar/Criar conta/Perfil/Carteiras (descrição do componente no Figma); `aria-current="page"` só na Home.
- Toasts no canto inferior direito: no superior cobriam o botão Entrar/Sair do header (e o hover pausava o fechamento).
- Input da newsletter renomeado para "E-mail para a newsletter" (o nome "E-mail" colidia com o do login).
- Marca do layout é **KURIO** (wordmark em texto, como no Figma); `<title>` = "Kurio — Marketplace de NFTs".
- Layout base (`__root`): header e footer dentro do container de 1200px, como nos frames desktop. Header com divisor nas telas Início/Perfil/Carteiras/auth; sem divisor no fluxo "Mercado" (NFT, carrinho, checkout, pedido), onde "Mercado" fica ativo.
- Itens sem funcionalidade no escopo **não fingem funcionar** (invariante 10): "Criadores"/"Aprenda" no header são texto `aria-disabled`; links do footer só existem para rotas reais (`/profile`, `/wallets`), o resto é texto; newsletter tem input e botão `disabled` com aviso "Indisponível nesta demonstração".
- Busca (ícone do header) leva ao catálogo (`/#catalogo`), onde fica o campo de busca.
- Badge do carrinho no header só aparece quando houver contagem real do carrinho — nada de número estático do Figma.
- Abaixo de `lg` (1024) o header esconde a nav e mantém busca/carrinho/Entrar; o footer empilha colunas. O Figma mobile não tem footer e usa Tab Bar inferior (`70395:245`) — ver Limitações.
- Ícones sociais do footer são imagens com `alt` (sem link: não há perfis reais).
- **Perfil:** layout do Figma `9:1238` — sidebar "Meu perfil" (`AccountShell`) + formulário em duas colunas sem cartões; avatar de 50px + nome/e-mail e botão "Alterar" (nome acessível "Alterar foto") (`<input type=file>` visualmente oculto com label-botão; tipo PNG/JPEG/WebP e ≤ 1 MB checados no cliente antes de ler o arquivo e de novo pelo servidor com o mesmo `AvatarInputSchema`). "Dados pessoais" envia só os campos alterados (`PATCH /profile`), botão desabilitado sem alteração; a resposta atualiza o cache do perfil e o usuário da sessão (`auth.updateUser`, header). "Alterar senha" pede senha atual + nova + confirmação; sucesso limpa o formulário e avisa que as outras sessões foram encerradas. Erros do servidor (`fields`) vão para o campo com foco (`applyServerError`).
- **Carteiras:** mesmo `AccountShell`; blocos sem cartão, formulário "Adicionar carteira" em duas colunas (Nome | Rede, Endereço inteiro) com select de seta própria e marcador redondo do Figma para "Definir como primária" (checkbox nativo estilizado). Lista com selo "Primária" (ícone + texto, borda primary — não só cor), "Editar" abre edição inline do nome (Esc cancela, foco volta ao botão) e "Tornar primária" só aparece nas não primárias — a UI nunca permite ficar sem primária; quem garante "exatamente uma" é o servidor, e após criar/editar a lista é refeita (`invalidateQueries`) em vez de remendada. Endereço duplicado na mesma rede → 409 no campo. Header do avatar usa `UserAvatar` (imagem enviada ou inicial).

- **Passada visual (Sessão 9, refs em `design/ref/` — não versionado).** Comparadas lado a lado com screenshots Playwright em 1440 e 414:
  - **Carrinho** (`11:1278`/`16:360`): desktop vira tabela — trilha "Início / Mercado / Carrinho" em 16 Bold, cabeçalho NFTs | Preço | Edições | Total com divisória, linhas de 70px em `surface` (arte 70px, nome Bold, preço tan, total accent, − / + redondos primary). Resumo **sem cartão** em 332px: "Resumo da carteira" com divisória, "Código promocional" com campo e "Aplicar" acoplados, "Taxa estimada" sob a taxa, "Conectar e finalizar" (40px) e "Continuar explorando". Mobile: voltar redondo + "Carrinho de NFTs" centralizado, cartões com arte de 100px e quantidade à direita, resumo como folha inferior arredondada com cupom em pílula e CTA em pílula com degradê. "Related" virou "Colecionadores também viram" em accent.
  - **Pagamento** (`11:2862`/`16:748`): trilha até "Pagamento" (título só no mobile: "Pagamento com carteira" + voltar); campos do Figma (transparentes, borda fina, raio 2, rótulo 15 com asterisco coral fora do `<label>`); rede e carteira como linhas com rádio redondo (caixa com borda no desktop, cartão arredondado no mobile); resumo "Seus NFTs" sem cartão, 405px, linhas em `surface` com "(x N)" e subtotal accent.
  - **Confirmação** (`70376:239`): cartão de 578px com X, ícone de envelope, "Seus NFTs agora estão na sua carteira", faixa de metadados com fios primary (ID da transação abreviado, data, total, carteira), "Detalhes da transação" (NFTs | Edições | Subtotal), parágrafo da rede e faixa primary na **base**, como no Figma.
  - **Perfil/Carteiras** (`9:1238`/`9:1670`): ver itens acima.
  - **Detalhe** (`10:244`/`15:5536`): trilha em Bold branca, sem o rótulo de coleção acima do título (a coleção fica nos metadados, com link), título 26, pílulas de edição contornadas (selecionada com borda primary, não preenchida), quantidade com botões redondos primary, metadados em 15 tan; mobile com voltar redondo, CTA "Comprar NFT" em pílula com degradê e carrinho redondo.
  - **Home** (`2:2`): bloco de texto do hero alinhado ao topo como no frame (estava ~17px abaixo), botão "Explorar" 8px mais perto do texto, pontos do carrossel na posição do Figma.
  - **Login/Cadastro**: já fiéis (modal desktop e telas mobile); sem mudanças.
  - Componentes compartilhados novos: `Breadcrumb`/`MobileTitle` (`src/components/breadcrumb.tsx`), `RadioDot`/`radioRowClass`/`RequiredMark` (`form-field.tsx`), `AccountShell` (`features/profile`). `OrderSummary` ganhou o visual do Figma e a variante `plain` (recibo).
- **Desvios do Figma que permanecem (decisão):**
  - Valores em ETH no formato pt-BR (`1,343 ETH`), não `1.19 ETH`: é a formatação da app inteira (`money.ts`).
  - "ID do token: #0042" do Figma → rótulo da edição; "Desconto do lançamento (-) 00.00" só aparece quando há desconto real (cupom), para não mostrar linha vazia.
  - Carrinho: sem os pontos de carrossel em "Colecionadores também viram" (são 5 cards fixos, sem paginação — pontos fingiriam navegação). Cards relacionados mantêm o coração de favorito.
  - Pagamento: o Figma pede campos que não existem no contrato (usuário, ENS, código de indicação, tipo de carteira, observação) — mantidos só Nome e E-mail; o pagamento é em duas etapas (dados/carteira → revisão) e "Revisar pedido"/"Confirmar pagamento" ficam na coluna da esquerda, não sob o resumo.
  - Confirmação: rota própria `/orders/$id` em vez de modal sobre o checkout com scrim (refresh e acesso direto funcionam); ícone de envelope do lucide no lugar da ilustração "THANK YOU"; "Ver no Etherscan" trocado por "Continuar explorando"/"Ver carrinho" (não há explorer real — invariante 10).
  - Perfil/Carteiras: o footer aparece (os frames de 1080px terminam antes dele); itens da sidebar fora do escopo (Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte) aparecem em `subtle`, `aria-disabled`, e somem abaixo de `lg`; "Remover" avatar, "Nome ENS", "Apelido" e "Carteira secundária" não existem no contrato. No mobile (sem frame) a sidebar vira uma faixa acima do conteúdo.
  - Header: "Criadores"/"Aprenda" ficam em tom apagado (o Figma os pinta como links ativos), porque não têm destino.
  - Home mobile: sem a grade escalonada ("masonry") e sem as formas decorativas/segunda arte do hero; Tab Bar inferior não implementada (ver Limitações).
- **Acessibilidade (Sessão 9, `e2e/a11y.spec.ts`, `@axe-core/playwright` com WCAG 2.1 A/AA):** Home, Detalhe, Login, Cadastro, 404, Carrinho, Checkout, Confirmação, Perfil e Carteiras sem violações em 1440, 768 e 390; sem overflow horizontal (os trilhos de "Related Products" rolam dentro do próprio contêiner); zoom 200% simulado com viewport 720×450; teclado (foco visível em todas as paradas de Tab — no próprio elemento, no `::after` do link esticado do card ou no wrapper `:focus-within` da busca), sheet de filtros com foco preso/Esc/retorno, `prefers-reduced-motion` sem animações, `alt` em todas as imagens, validação de login/cadastro com `aria-invalid` + `aria-describedby` e foco no primeiro inválido. Correções desta passada:
  - Busca do catálogo ganhou anel de foco no wrapper (o input tinha `outline-none` sem substituto).
  - Nome acessível contém o texto visível (`label-content-name-mismatch`): link do avatar no header usa texto `sr-only` "Meu perfil (Nome)" no lugar de `aria-label`; "Editar"/"Tornar primária" nas carteiras viram "Editar nome de X" / "Tornar primária (X)".
  - Skeletons com `aria-label` ganharam `role="status"` (`aria-label` em `div` genérica é proibido).
  - Links "Criar conta"/"Entrar" dentro do texto do modal de auth ficam sempre sublinhados (o Figma só usa cor; `link-in-text-block`).
  - Popup da carteira simulada: ao fechar (aprovar, recusar ou Esc) o foco volta à ação do cartão ("Desconectar" ou "Conectar carteira"), em vez de cair no `body` porque o botão estava desabilitado.
  - Toolbar do catálogo em 768: abas rolam (`min-w-0`) e "Ordenar por" não encolhe — antes vazava 12px.

## 12. Limitações conhecidas
- Sessão não é sincronizada entre abas: logout/login em outra aba não atualiza esta até a próxima chamada privada (401) ou refresh. Não há vazamento: cada aba só usa o próprio token em memória.
- **Extensão de carteira simulada.** Não há carteira real: `src/mocks/wallet-extension.ts` injeta `window.kurioWallet` (contrato em `src/contracts/wallet-extension.ts`) com o próprio popup de aprovação. Sem extensão, a app diz "Nenhuma extensão de carteira encontrada". Não há assinatura de transação: o "pagamento" é o `POST /orders` e o assentamento do mock.
- Não há lista "Meus pedidos": um pedido é acessado pela URL `/orders/<id>` (o fluxo leva até ela).
- Avatar é guardado como data URL no banco mock (localStorage): limite de 1 MB decodificado; sem recorte/redimensionamento no cliente. Não há remover foto (o contrato não tem `DELETE /profile/avatar`).
- Não há excluir carteira (fora do contrato): só adicionar, renomear e tornar primária.
- Tab Bar mobile do Figma (`70395:245`) não implementada; mobile usa header compacto + footer empilhado.
- Figma não tem mobile para Confirmação, Perfil e Carteiras: adaptados do desktop com os mesmos tokens (cartão de largura total; sidebar da conta vira faixa no topo).
- Comparação visual da Sessão 9 feita contra PNGs exportados manualmente (`design/ref/`, fora do git): o Figma MCP segue no limite do plano Starter.
- **Performance mobile do Lighthouse abaixo de 90 só no `pnpm preview` local** (85/85, mediana de 3 runs). Na demo pública fica em 95/95. O backend mock roda no navegador e fica no caminho crítico do LCP, e o preview local não tem a compressão da CDN; ver §13.
- Sem SSR/pré-renderização: crawlers sem JS veem só o `<title>`/`description` padrão do `index.html`; os específicos de cada rota (`usePageMeta`) aparecem depois do JS.
- Os dados da demo vivem no `localStorage` de cada navegador (banco mock). Não há estado compartilhado entre dispositivos, e limpar os dados do site volta ao seed. Cadastros só existem naquele navegador.
- Tempo real só existe dentro da mesma aba: o servidor Socket.IO mock roda na página, então uma compra em outra aba ou dispositivo não gera evento aqui. Para ver mudança de preço/estoque, use os cenários (`price-change`, `sold-out`) ou `window.__mock.updateEdition`.
- E2E só em Chromium (desktop 1440 e mobile 390); Firefox/WebKit não fazem parte da suíte.
- Regressão visual compara só em Linux (baselines da imagem oficial do Playwright); no Windows/macOS os 8 testes `@visual` são pulados.
- **Token de sessão em `localStorage`** (`jg:session`, `src/lib/storage.ts`), legível por qualquer script da página. Aceito porque o backend é mock no navegador. Em produção o token iria em cookie `httpOnly; Secure; SameSite`, emitido pelo servidor, com proteção CSRF.
- **Sem Content-Security-Policy.** O `vercel.json` envia em todas as rotas só `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `X-Frame-Options: DENY`. A mitigação de XSS hoje é o próprio React (o `src/` não usa `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` nem `target="_blank"`). Em produção: CSP restritiva (`script-src 'self'`, `connect-src` da API/socket, `frame-ancestors 'none'`). Ficou fora porque o MSW roda via service worker e a CSP precisaria de testes próprios.
- **`pnpm audit --prod` (2026-11-27): nenhuma vulnerabilidade conhecida** (0 info/low/moderate/high/critical em 144 dependências de produção).

## 13. Performance e Lighthouse
**Como medir:** `pnpm lhci` (`scripts/lhci.mjs`). Faz o build, sobe o `pnpm preview` e roda `@lhci/cli` em `/` e `/nft/nft-001`, nos perfis **mobile** (padrão do Lighthouse: Moto G Power emulado, 4G lento simulado a 150 ms RTT / 1,6 Mbps, CPU 4×) e **desktop** (`preset=desktop`), 3 runs cada. Grava HTML+JSON de todos os runs em `lighthouse/reports/{mobile,desktop}/` (com `manifest.json`) e as medianas em `lighthouse/reports/summary.{md,json}`. `pnpm lhci:prod` faz o mesmo contra a demo pública (`lighthouse/lighthouserc.prod.json`, sem build nem servidor local) e grava em `lighthouse/reports/prod/`. Asserções (mediana): Perf ≥ 0,90, A11y ≥ 0,95, BP ≥ 0,95, SEO ≥ 0,90; o script sai com código 1 se alguma falhar. `--no-build` reaproveita o `dist/`; `--summary-only` só refaz o resumo.

São duas medições porque medem coisas diferentes:
- **Local** (`pnpm preview`): reprodutível por quem clona o repo, mas o `vite preview` serve só gzip, sem CDN.
- **Produção** (Vercel): o que o avaliador abre. A CDN serve Brotli e HTTP/2 a partir do edge, o que encurta a transferência dos chunks.

Nas duas, o Lighthouse roda na mesma máquina (abaixo), com throttling **simulado** (Lantern, padrão do Lighthouse), storage limpo a cada run (o MSW instala o service worker e faz o seed toda vez), mocks ligados e cenário `default` (latência simulada de 150–400 ms por chamada `/api`).

Ambiente: Node 24.21.0 · Lighthouse 13.6.0 (`@lhci/cli` 0.16.1) · Chrome 158.0.8127.88 headless · Windows 11 Pro (10.0.26300) x64 · AMD Ryzen 7 5700X (8 núcleos/16 threads) · 32 GB RAM · `benchmarkIndex` ≈ 3000 · 26–27/11/2026. Produção medida pela internet residencial da mesma máquina (o Lantern simula a rede a partir do RTT observado).

**Resultado versionado** (mediana de 3 runs; entre parênteses o Perf de cada run):

| Alvo | Perfil | Página | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|
| local | mobile | `/` | **85** (85 / 85 / 85) | 100 | 100 | 100 | 4,28 s | 0 | 111 ms |
| local | mobile | `/nft/nft-001` | **85** (74 / 86 / 85) | 100 | 100 | 100 | 4,20 s | 0 | 131 ms |
| local | desktop | `/` | **98** | 100 | 100 | 100 | 1,04 s | 0 | 0 ms |
| local | desktop | `/nft/nft-001` | **99** | 100 | 100 | 100 | 0,95 s | 0 | 0 ms |
| produção | mobile | `/` | **95** (76 / 95 / 95) | 100 | 100 | 100 | 2,73 s | 0 | 132 ms |
| produção | mobile | `/nft/nft-001` | **95** (95 / 91 / 96) | 100 | 100 | 100 | 2,66 s | 0 | 112 ms |
| produção | desktop | `/` | **100** | 100 | 100 | 100 | 0,58 s | 0 | 0 ms |
| produção | desktop | `/nft/nft-001` | **100** | 100 | 100 | 100 | 0,56 s | 0 | 0 ms |

**Antes × depois do enxugamento do chunk do mock** (mobile, mediana):

| Alvo | Página | Antes | Depois |
|---|---|---|---|
| local | `/` | 82 · LCP 4,74 s · TBT 125 ms | 85 · LCP 4,28 s · TBT 111 ms |
| local | `/nft/nft-001` | 66 (83 / 66 / 63) · LCP 4,68 s · TBT 689 ms | 85 (74 / 86 / 85) · LCP 4,20 s · TBT 131 ms |
| produção | `/` | 93 (93 / 91 / 93) · LCP 2,91 s · TBT 169 ms | 95 (76 / 95 / 95) · LCP 2,73 s · TBT 132 ms |
| produção | `/nft/nft-001` | 78 (78 / 68 / 80) · LCP 2,87 s · TBT 685 ms | 95 (95 / 91 / 96) · LCP 2,66 s · TBT 112 ms |

Desktop já passava antes (local 98/99; produção 100/100).

**Otimizações aplicadas** (valem para usuários reais, não só para o teste):
- **Chunk do mock de 174 kB para 60 kB gzip** (469 → 199 kB de fonte). Medindo o chunk por sourcemap, o código do próprio mock (handlers, banco, fixtures, servidor socket) somava só 27 kB; 258 kB eram do `tldts`, a Public Suffix List inteira, puxada pelo `tough-cookie` que o MSW usa no cookie store. Nem a app nem o mock usam cookies (a sessão é Bearer token), então `vite.config.ts` troca o `tldts` por `src/mocks/lib/tldts-lite.ts`, que usa a heurística "dois últimos rótulos". Efeito colateral aceito: o cookie store do MSW não reconhece sufixos privados (`vercel.app`). Só o `tough-cookie` importa o `tldts`. Se um dia o mock usar cookies, basta remover o alias.
- `modulepreload` do grafo da app durante o boot do MSW (§2). Antes, o navegador só descobria os chunks da app quando o worker terminava. Mobile foi de 72/62 para 82/83 nos melhores runs, e o TBT caiu de 561/1268 ms para ~120 ms.
- Skeleton do detalhe com a mesma geometria do conteúdo: CLS desktop do detalhe de 0,155 para 0.
- Slider de preço com 24 px de altura de alvo (WCAG 2.5.8, `target-size`), sem mudar o layout: A11y desktop da home de 97 para 100.
- Já existiam: imagens com `width`/`height` e `srcset` 400w/800w; `loading="lazy"` fora da dobra; `fetchpriority="high"` na arte do hero e na imagem principal do detalhe; preload da fonte self-host (woff2 variável, subset latin, `font-display: swap`); code-splitting por rota (`autoCodeSplitting`); devtools só em dev.
- SEO: `lang="pt-BR"`, `<title>` e `meta description` por rota (`usePageMeta`), `robots.txt`. Sem erros no console (auditoria `errors-in-console` passa).

**Tentado e revertido: renderizar o shell sem esperar o `worker.start()`.** A app era importada em paralelo com o mock. O Axios aguardava uma promise de prontidão num interceptor, e o socket importava o `socket.io-client` só depois dela, porque o engine.io captura o `WebSocket` na avaliação do módulo. A/B local, mobile, os dois já com o chunk enxuto: `/` 87 → 85 (LCP 4,01 → 4,17 s); detalhe 81 → 86, com runs 84/76/81 contra 87/84/86. A diferença ficou dentro da dispersão entre runs, e o LCP não melhorou. A imagem LCP depende da resposta da API, que de todo jeito espera o worker. Pelo critério "sem ganho, reverte", voltou ao boot sequencial, que é mais simples (connect síncrono do socket, sem barreira no cliente HTTP). Separar fixtures e handlers de socket do chunk inicial também foi descartado: somam poucos kB, e o worker precisa de todos antes da primeira resposta.

**Abaixo da meta: Performance mobile só na medição local (85/85).** Na demo pública o mobile passa (95/95) e o desktop passa com folga nos dois alvos; A11y, BP e SEO ficam em 100 em todas as medições. A diferença local × produção é a entrega: Brotli e HTTP/2 da CDN contra gzip do `vite preview`, com o LCP caindo de ~4,2 s para ~2,7 s. O que segura o mobile local:
1. **O backend roda no navegador.** Mesmo enxuto, o chunk do mock (`msw` ~100 kB de fonte, `@mswjs/interceptors`, `tough-cookie`, handlers) precisa ser baixado, executado e registrar o service worker **antes** da primeira chamada `/api`. O MSW é obrigatório na stack e a demo pública usa mocks. Cadeia do LCP: `index` → mock → app → chunk da rota → `GET /api/...` (150–400 ms simulados) → imagem. Com backend real, esse chunk e a latência simulada saem do caminho crítico.
2. **LCP depende de dado.** A imagem LCP (hero na home, arte do NFT no detalhe) só é conhecida depois do JSON da API. É uma SPA estática (sem SSR/SSG na stack), então não dá para pré-renderizar o HTML com a imagem. Um `preload` fixo no `index.html` baixaria uma arte errada nas outras rotas.
3. **Dispersão entre runs.** Antes do alias, os runs ruins do detalhe tinham uma tarefa longa sem atribuição a script (trabalho nativo do Chrome, sem eventos-filho de JS, layout ou parse no trace), de 131 a 874 ms. Com o chunk enxuto o TBT mediano caiu para ~130 ms, mas ainda aparece um run fora da curva (74 no local).

Medidas que não adotamos por serem truques só para o teste: desligar o MSW no build medido, servir dados embutidos no HTML, pré-carregar no `index.html` uma imagem que só serve a uma rota.
