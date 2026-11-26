import { expect, test, type Page } from '@playwright/test'
import { RealtimeEventSchema, type RealtimeEvent } from '../src/contracts'
import { api, bootMock } from './support/mock'

// Eventos saem SEMPRE do servidor Socket.IO mock (window.__mock → src/mocks/socket.ts) e chegam
// à UI pelo socket.io-client. Nada aqui mexe no cache/estado da app diretamente.

const EDITION = 'nft-001-std'

async function waitForSocket(page: Page) {
  await page.waitForFunction(() => (window.__mock?.socket().connections.length ?? 0) > 0)
}

async function lastEventFor(page: Page, resourceId: string): Promise<RealtimeEvent> {
  const events = await page.evaluate(() => window.__mock!.socket().emitted)
  const found = events.filter((e) => e.resource.id === resourceId).at(-1)
  if (!found) throw new Error(`nenhum evento para ${resourceId}`)
  return RealtimeEventSchema.parse(found)
}

test.describe('tempo real @realtime', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
    await page.goto('/nft/nft-001')
    await expect(page.getByTestId(`edition-price-${EDITION}`)).toBeVisible()
    await waitForSocket(page)
  })

  test('nft.updated muda o preço; duplicado e versões antigas não regridem', async ({ page }) => {
    const price = page.getByTestId(`edition-price-${EDITION}`)
    const available = page.getByTestId(`edition-available-${EDITION}`)

    // Mudança real no "backend" → servidor emite nft.updated → UI atualiza sem recarregar.
    await page.evaluate((id) => window.__mock!.updateEdition(id, { price: '9.99' }), EDITION)
    await expect(price).toHaveText('9,99 ETH')

    const applied = await lastEventFor(page, EDITION)
    expect(applied.type).toBe('nft.updated')

    await page.evaluate(
      ({ applied, editionId }) => {
        const base = { type: 'nft.updated' as const, resource: applied.resource }
        // 1) Duplicado: mesmo eventId (mesmo com versão maior e outro preço) → descartado.
        window.__mock!.emit({
          ...base,
          eventId: applied.eventId,
          version: applied.version + 5,
          payload: { nftId: 'nft-001', editionId, price: '1.11' },
        })
        // 2) Mesma versão, eventId novo → descartado.
        window.__mock!.emit({ ...base, version: applied.version, payload: { nftId: 'nft-001', editionId, price: '2.22' } })
        // 3) Versão antiga → descartado.
        window.__mock!.emit({ ...base, version: applied.version - 1, payload: { nftId: 'nft-001', editionId, price: '3.33' } })
        // 4) Marcador válido (só estoque): quando aparecer, os anteriores já foram processados (ordem do socket).
        window.__mock!.emit({ ...base, version: applied.version + 1, payload: { nftId: 'nft-001', editionId, available: 7 } })
      },
      { applied, editionId: EDITION },
    )
    await expect(available).toHaveText('7 disponíveis')
    await expect(price).toHaveText('9,99 ETH')
  })

  test('evento privado de outro usuário é descartado', async ({ page }) => {
    const price = page.getByTestId(`edition-price-${EDITION}`)
    const before = await price.textContent()
    const applied = await page.evaluate(
      (editionId) =>
        window.__mock!.emit({
          type: 'nft.updated',
          resource: { type: 'edition', id: editionId },
          version: 99,
          userId: 'usr-bruno', // convidado não deve aplicar evento endereçado a outro usuário
          payload: { nftId: 'nft-001', editionId, price: '5.55' },
        }),
      EDITION,
    )
    expect(applied.userId).toBe('usr-bruno')
    // Servidor nem entrega a conexão anônima; e o cliente também filtraria. Marcador público confirma o processamento.
    await page.evaluate((id) => window.__mock!.updateEdition(id, { available: 3 }), EDITION)
    await expect(page.getByTestId(`edition-available-${EDITION}`)).toHaveText('3 disponíveis')
    await expect(price).toHaveText(before!)
  })

  test('queda do socket: evento perdido é reconciliado via REST ao reconectar', async ({ page }) => {
    const price = page.getByTestId(`edition-price-${EDITION}`)
    await page.evaluate(() => window.__mock!.dropSockets({ outageMs: 1_500 }))
    await page.waitForFunction(() => window.__mock!.socket().connections.length === 0)

    // Muda o preço enquanto ninguém está conectado: o nft.updated não chega a ninguém.
    await page.evaluate((id) => window.__mock!.updateEdition(id, { price: '4.2' }), EDITION)
    await expect(price).not.toHaveText('4,2 ETH')

    await waitForSocket(page) // reconexão automática após a "queda"
    await expect(price).toHaveText('4,2 ETH') // refetch das queries ativas no 'reconnect'
  })

  test('cenário price-change emite nft.updated pelo socket após a cotação', async ({ page }) => {
    const price = page.getByTestId(`edition-price-${EDITION}`)
    const before = (await price.textContent())!
    await page.evaluate(() => window.__mock!.setScenario('price-change'))
    const quote = await api(page, 'POST', '/quote', { body: { items: [{ editionId: EDITION, quantity: 1 }] } })
    expect(quote.status).toBe(200)
    await expect(price).not.toHaveText(before, { timeout: 6_000 })
    const event = await lastEventFor(page, EDITION)
    expect(event.payload).toMatchObject({ editionId: EDITION })
  })
})
