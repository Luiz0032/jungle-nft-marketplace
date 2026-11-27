# Kurio — Marketplace de NFTs

Front-end de um marketplace de NFTs: catálogo com busca, filtros e paginação, detalhe com edições, favoritos, carrinho com cupom, checkout com carteira simulada, acompanhamento do pedido em tempo real, perfil e carteiras. Feito para o [desafio de front-end da Jungle Gaming](https://github.com/junglegaming/frontend-challenge).

Não há backend real. REST e Socket.IO são atendidos por um servidor mock (MSW) que roda no navegador, na camada de rede. A app não sabe que fala com um mock, e o mesmo build serve para desenvolvimento, testes e a demo pública.

**Demo pública:** https://jungle-nft-marketplace-gamma.vercel.app

Stack: React 19 + TypeScript (strict) · Vite · TanStack Router · TanStack Query · Axios · Socket.IO · Tailwind CSS v4 · shadcn/ui · MSW 2 + `@mswjs/socket.io-binding` · Playwright · Lighthouse CI.

Decisões técnicas, contratos REST/tempo real, política de cache e limitações estão em [ARCHITECTURE.md](ARCHITECTURE.md).

## Requisitos
- Node.js 24 (testado com 24.21)
- pnpm 12 (testado com 12.23): `corepack enable` ou `npm i -g pnpm@12`
- Para os testes E2E, o Chromium do Playwright (instalado no setup abaixo)
- Para o Lighthouse, Google Chrome instalado
- Opcional: Docker, só para regenerar as baselines de regressão visual

## Setup (a partir de um checkout limpo)
```bash
git clone https://github.com/Luiz0032/jungle-nft-marketplace.git
cd jungle-nft-marketplace
pnpm install --frozen-lockfile
pnpm exec playwright install chromium   # só para os testes E2E
pnpm dev                                 # http://localhost:5173
```
O `postinstall` do MSW fica desligado de propósito (`allowBuilds` em `pnpm-workspace.yaml`): o service worker `public/mockServiceWorker.js` já está versionado.

## Variáveis de ambiente
Os padrões estão no `.env` versionado (não há segredos). Para sobrescrever localmente, use `.env.local`.

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_API_URL` | `/api` | base do cliente Axios |
| `VITE_SOCKET_URL` | `wss://realtime.jungle.mock` | URL do Socket.IO (interceptada pelo MSW) |
| `VITE_ENABLE_MOCKS` | `true` | liga o servidor mock, inclusive no build de produção (a demo pública depende dele) |

## Credenciais fictícias
| E-mail | Senha |
|---|---|
| `ana@jungle.test` | `Senha@123` |
| `bruno@jungle.test` | `Senha@123` |

Os dois já têm carteiras cadastradas. Cupons: `JUNGLE10` (10% de desconto, válido) e `EXPIRED5` (expirado). Também dá para criar uma conta em `/register`. Os dados ficam só no `localStorage` daquele navegador.

## Cenários do mock
O cenário vale para a aba (fica no `sessionStorage` e sobrevive a refresh).

- **Escolher:** abra qualquer URL com `?scenario=<nome>`, por exemplo `/?scenario=slow`. Pelo console: `window.__mock.setScenario('slow')`.
- **Resetar:** `?reset=1` recria o banco mock a partir do seed (apaga cadastros, carrinhos e pedidos) e volta ao cenário `default`. Pelo console: `await window.__mock.reset()`.

| Cenário | Efeito |
|---|---|
| `default` | latência de 150–400 ms, tudo funciona |
| `slow` | 2–4 s por chamada (skeletons); pedido assenta em 5 s |
| `flaky` | 30% dos GET respondem 503 (retry automático e "Tentar novamente") |
| `offline` | erro de rede em todas as chamadas |
| `out-of-order` | respostas da busca chegam em ordem invertida |
| `empty` | catálogo vazio |
| `session-expired` | a próxima chamada privada encontra a sessão expirada (uma vez) |
| `price-change` | 3 s depois da primeira cotação, o preço da 1ª linha sobe 10% (evento pelo socket) |
| `sold-out` | a 1ª linha esgota no envio do pedido (409) |
| `order-timeout` | o pedido é criado, mas a resposta demora 15 s (o cliente desiste em 10 s) |
| `payment-declined` | o pedido termina recusado e o estoque volta |
| `socket-drop` | o socket cai logo após o pedido e só volta 3 s depois (a confirmação chega por REST) |
| `order-hold` | o pedido fica pendente até `window.__mock.settleOrder(id, 'confirmed' \| 'rejected')` |

Outros controles no console (`window.__mock`): `getScenario()`, `updateEdition(editionId, { price?, available? })` (muda o banco e o servidor emite `nft.updated`), `dropSockets()`, `orders()`, `socket()`.

## Comandos
| Comando | O que faz |
|---|---|
| `pnpm dev` | servidor de desenvolvimento com mocks (http://localhost:5173) |
| `pnpm build` | `tsc -b` + build de produção em `dist/` |
| `pnpm preview` | serve o `dist/` com mocks (http://localhost:4173) |
| `pnpm typecheck` | checagem de tipos |
| `pnpm lint` | ESLint |
| `pnpm test:e2e` | suíte Playwright completa (sobe o `pnpm preview` sozinho; **rode `pnpm build` antes**) |
| `pnpm test:e2e --grep @checkout` | só uma feature (`@catalog`, `@cart`, `@checkout`, `@realtime`, `@auth`, `@a11y`, `@visual`, `@slow`…) |
| `pnpm test:e2e:ui` | Playwright em modo UI |
| `pnpm test:slow` | skeletons e recuperação com relógio controlado (`@slow`) |
| `pnpm test:visual` | regressão visual (`@visual`). Compara só em Linux; em outros sistemas os testes são pulados |
| `pnpm test:visual:update` | regenera as baselines visuais em Docker (imagem oficial do Playwright) |
| `pnpm lhci` | build + Lighthouse CI em `/` e `/nft/nft-001`, mobile e desktop, 3 runs cada, contra o `pnpm preview` local |
| `pnpm lhci:prod` | o mesmo contra a demo pública na Vercel (sem build) |

## Reproduzir os fluxos de falha
Use a demo pública ou `pnpm dev`. Para começar do zero, abra antes `/?reset=1`. "Entrar" é com `ana@jungle.test` / `Senha@123`.

Compra completa (base dos fluxos abaixo): abra um NFT, escolha a edição e clique em **Comprar** (ou adicione ao carrinho) → no carrinho, **Conectar e finalizar** → em Pagamento, confira nome/e-mail, escolha a rede e a carteira, clique em **Conectar carteira** e aprove no popup da carteira simulada (**Conectar**) → **Revisar pedido** → **Confirmar pagamento**. O pedido abre como pendente e só aparece como confirmado quando o servidor mock confirma, cerca de 2 s depois, via evento do socket.

1. **Sessão expirada.** Entre, depois abra `/profile?scenario=session-expired`. A chamada privada seguinte recebe `401 SESSION_EXPIRED`, a app volta para `/login` com o aviso "Sua sessão expirou. Entre novamente para continuar." e, depois de entrar de novo, retorna a `/profile`.
2. **Cupom inválido / expirado.** Com itens no carrinho, digite `XYZ` em "Código promocional" e clique em **Aplicar**: o campo mostra "Cupom inválido.". Com `EXPIRED5`: "Este cupom expirou.". Com `JUNGLE10` o desconto entra no resumo.
3. **Mudança de preço.** Entre, adicione um NFT ao carrinho e abra `/cart?scenario=price-change`. Cerca de 3 s depois da cotação, o servidor emite `nft.updated` pelo socket: toast com o preço antigo e o novo, e o resumo é recalculado. No checkout, se o preço muda depois de "Revisar pedido", aparece "Os valores mudaram desde a sua revisão" e o pagamento fica bloqueado até **Aceitar novos valores**.
4. **Estoque esgotado.** Entre, abra `/cart?scenario=sold-out` com itens no carrinho e siga até **Confirmar pagamento**. O servidor esgota a edição e responde 409: "Uma das edições esgotou durante a compra.", com link de volta ao carrinho, onde a linha aparece como esgotada. Nenhum pedido é criado.
5. **Timeout com recuperação.** Entre, abra `/cart?scenario=order-timeout` e siga até **Confirmar pagamento**. Depois de 10 s o cliente desiste da resposta, mostra "A resposta demorou. Procurando o seu pedido pela chave de envio…" e encontra o pedido pela `Idempotency-Key` (`GET /orders/by-key/:key`), sem duplicar. Se ainda não achar, **Reenviar pedido** reenvia com a mesma chave. `window.__mock.orders()` mostra um único pedido.
6. **Pagamento recusado.** Entre, abra `/cart?scenario=payment-declined` e conclua a compra. O pedido fica pendente e depois aparece "Pagamento recusado" com o motivo. O carrinho continua intacto e o estoque volta; **Tentar novamente** abre uma nova tentativa.
7. **Queda do socket.** Entre, abra `/cart?scenario=socket-drop` e conclua a compra. Logo após o envio o socket cai e recusa reconexão por 3 s, então o evento de confirmação se perde. A tela do pedido mostra "Conexão em tempo real perdida. Verificando o pedido a cada 3 s…" e confirma pela API REST. Ao reconectar, o socket refaz as queries ativas.

Outros: `?scenario=slow` (skeletons), `?scenario=flaky` / `?scenario=offline` (erro com "Tentar novamente"), `?scenario=empty` (catálogo vazio).

## Relatórios
- **Playwright:** relatório HTML em `playwright-report/` depois de `pnpm test:e2e` (`pnpm exec playwright show-report`). Traces e anexos das falhas ficam em `test-results/`. No CI (GitHub Actions → workflow **E2E**), o relatório é publicado em todo run como artifact `playwright-report`, e os traces das falhas como `playwright-traces`. Baselines visuais em `e2e/__screenshots__/`.
- **Lighthouse:** medição local em `lighthouse/reports/mobile/` e `lighthouse/reports/desktop/`, da demo pública em `lighthouse/reports/prod/{mobile,desktop}/` (HTML + JSON de cada run, com `manifest.json`); medianas e ambiente em `lighthouse/reports/summary.md` e `lighthouse/reports/prod/summary.md`. Resultados e análise em [ARCHITECTURE.md §13](ARCHITECTURE.md#13-performance-e-lighthouse).
