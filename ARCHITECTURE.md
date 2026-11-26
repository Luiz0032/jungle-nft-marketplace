# ARCHITECTURE.md

> Documento vivo. Seções marcadas com `TODO` ainda não foram detalhadas.
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
Playwright: `webServer = pnpm preview` (porta 4173) — **rode `pnpm build` antes de `pnpm test:e2e`**; projetos `chromium-desktop` (1440) e `chromium-mobile` (390).

### Tokens de design
`src/index.css`: variáveis `--jg-*` em `:root` → mapeadas para as variáveis do shadcn → expostas no Tailwind via `@theme inline` (`bg-brand`, `bg-surface`, …). Fontes/breakpoints em `@theme`. **Valores provisórios**: `design/tokens.md` ainda não existe (ver Limitações).

Cenário de mock: query param `?scenario=<nome>` (persistido na sessão) ou painel de dev (canto inferior, só com mocks ligados). Reset: `?reset=1` ou botão "Resetar cenário".
Bootstrap: `await worker.start()` ANTES de criar o socket e renderizar a app (o MSW precisa ter substituído o `WebSocket` global antes do `socket.io-client` capturá-lo). Por isso a app inteira é carregada com `import('@/app/app')` **depois** do start — ver §5 "Limitações do binding".

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
| GET | `/nfts` | `q, collection[], category[], minPrice, maxPrice, sort (price_asc|price_desc|newest|popular), page, pageSize` | `Page<NftSummary>` |
| GET | `/nfts/:id` | — | `NftDetail` · 404 |

```ts
type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
type NftSummary = { id; title; collection; image; price: Eth; available: number; version: number }
type NftDetail = NftSummary & { description; images: string[]; creator; editions: Edition[] }
type Edition = { id; label; price: Eth; available: number; version: number }
```

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
- **Novo** `GET /catalog/facets` → `{ collections: {slug,name}[], categories: {slug,name}[] }` (opções dos filtros).
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
- `db/`: estado único em memória, persistido em `localStorage['jungle-mock-db:v1']` após cada escrita; seed determinístico (`seed.ts`, PRNG mulberry32 com semente fixa): 48 NFTs `nft-001…nft-048`, edições `<id>-std|-rare|-leg` (a `std` sempre tem estoque), 6 coleções, 2 usuários com carteiras, cupons. Senhas: SHA-256(`salt:senha`) via `crypto.subtle`, salt aleatório por usuário.
- `handlers/utils.ts#route`: toda rota `/api` passa por efeitos do cenário → assentamento de pedidos vencidos → resolver; erros são `throw apiError(...)` tipados; corpo validado com os schemas de `src/contracts` (422 com `fields`).
- `events.ts`: barramento interno do servidor (`edition.changed`, `order.changed`) que `src/mocks/socket.ts` liga ao Socket.IO mock.
- Imagens de NFT: `/mock-images/<nftId>-<n>.svg`, SVG generativo determinístico servido pelo MSW (sem dependência externa).

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
TODO: token em `localStorage` (`session`) com `expiresAt`; validação via `/auth/session` no boot; interceptor Axios 401 → limpa sessão e redireciona para `/login?redirect=<rota+search>`; no checkout, rascunho do formulário persiste em `sessionStorage` para retomada.

## 7. Carrinho
TODO: convidado em `localStorage`; logado no servidor mock; merge no login; atualização otimista de quantidade com rollback.

## 8. Política de cache, retry e sincronização
| Query | staleTime | retry | Observações |
|---|---|---|---|
| nfts (lista) | 30 s | 2 (só TRANSIENT/rede) | `placeholderData: keepPreviousData` |
| nft detalhe | 30 s | 2 | atualizado por `nft.updated` |
| cart | 0 | 1 | invalidado após mutação e eventos |
| quote | 0 | 0 | nunca reutilizada após mudança |
| order | 0 | 3 | polling 3 s enquanto `pending` se socket desconectado |
| privadas | — | — | key inclui `userId`; `clear()` no logout |
Mutações: retry 0, exceto `POST /orders` (retry manual com a MESMA idempotency key).
Otimista: favoritos (toggle) e quantidade do carrinho, com rollback + toast em erro.

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
Controle programático (Playwright): `window.__mock.setScenario()`, `.getScenario()`, `.reset()`, `.emit(event)` — emite PELO servidor mock do socket, nunca direto na UI. Também: `.updateEdition(editionId, { price?, available? })` (muda o banco; o servidor emite `nft.updated`), `.dropSockets({ userId?, outageMs? })` e `.socket()` (conexões autenticadas + log de eventos emitidos). `window.__mock` só aparece **depois** de `worker.start()` (specs esperam por ele com `waitForFunction`).

Implementação (`src/mocks/scenarios`): estado em `sessionStorage['jungle-mock-scenario']` (por aba, sobrevive a refresh). Latência e falhas do `flaky` saem de PRNG semeado por `cenário + nº da requisição` → **reproduzível** (mesma sequência de chamadas → mesmos resultados; `setScenario` zera o contador). Detalhes: `out-of-order` só afeta `GET /nfts` (2,5 s, 1,8 s, 1,1 s, 0,4 s, 0,15 s…); `session-expired` expira uma única vez; `sold-out` zera o estoque da 1ª linha no `POST /orders` e responde 409; `order-timeout` cria o pedido e segura a resposta 15 s (> timeout de 10 s do Axios); `payment-declined` assenta `rejected` e devolve o estoque. `price-change` e `socket-drop` dependem do socket.
Fixtures: ≥ 40 NFTs (filtros/paginação), 2 usuários (`ana@jungle.test` / `Senha@123`, `bruno@jungle.test` / `Senha@123`), cupons `JUNGLE10` (válido), `EXPIRED5` (expirado).

## 10. Decisões de UX
TODO

## 11. Desvios do Figma e acessibilidade
TODO

## 12. Limitações conhecidas
- `design/` (PNGs do Figma e `tokens.md`) ainda não foi criado. Tokens em `src/index.css` são provisórios e devem ser substituídos
- TODO: demais itens.
