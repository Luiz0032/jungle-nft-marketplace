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
Bootstrap: `await worker.start()` ANTES de criar o socket e renderizar a app (o MSW precisa ter substituído o `WebSocket` global antes do `socket.io-client` capturá-lo).

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
Suporta só o namespace padrão e eventos de texto (sem namespaces customizados, acks ou binário). Long-polling não é interceptado: forçamos `websocket`. TODO: registrar o que for observado no POC.

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
Controle programático (Playwright): `window.__mock.setScenario()`, `.reset()`, `.emit(event)` — emite PELO servidor mock do socket, nunca direto na UI.
Fixtures: ≥ 40 NFTs (filtros/paginação), 2 usuários (`ana@jungle.test` / `Senha@123`, `bruno@jungle.test` / `Senha@123`), cupons `JUNGLE10` (válido), `EXPIRED5` (expirado).

## 10. Decisões de UX
TODO

## 11. Desvios do Figma e acessibilidade
TODO

## 12. Limitações conhecidas
- `design/` (PNGs do Figma e `tokens.md`) ainda não foi criado. Tokens em `src/index.css` são provisórios e devem ser substituídos
- TODO: demais itens.
