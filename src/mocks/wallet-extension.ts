import { USER_REJECTED, type WalletConnectRequest, type WalletExtension } from '@/contracts/wallet-extension'

/**
 * Extensão de carteira SIMULADA (como o MSW simula o servidor). Injeta `window.kurioWallet` e, a cada pedido
 * de conexão, abre o próprio popup (um `<dialog>` modal, fora da árvore React da app) onde a pessoa aprova
 * ou recusa. A app não sabe que é simulada: recebe a conta aprovada ou um erro 4001.
 */

const NETWORK_LABEL: Record<string, string> = { ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base' }
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, text?: string) {
  const node = document.createElement(tag)
  node.setAttribute('style', style)
  if (text !== undefined) node.textContent = text
  return node
}

function prompt(req: WalletConnectRequest): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = el(
      'dialog',
      'width:340px;max-width:calc(100vw - 32px);padding:20px;border:1px solid #55321f;border-radius:12px;background:#fbfbfb;color:#140d0a;font:14px/1.4 system-ui,sans-serif;box-shadow:0 20px 60px rgb(0 0 0/.5)',
    )
    dialog.setAttribute('aria-labelledby', 'kw-title')
    dialog.setAttribute('aria-describedby', 'kw-desc')
    dialog.dataset.testid = 'wallet-extension'

    const title = el('h2', 'margin:0 0 4px;font-size:16px;font-weight:700', 'KurioWallet — Solicitação de conexão')
    title.id = 'kw-title'
    const desc = el('p', 'margin:0 0 12px;color:#444')
    desc.id = 'kw-desc'
    desc.textContent = `${req.origin} quer se conectar à conta "${req.label}" (${short(req.address)}) na rede ${NETWORK_LABEL[req.network] ?? req.network}.`
    const note = el('p', 'margin:0 0 16px;font-size:12px;color:#666', 'Extensão simulada (ambiente de demonstração).')

    const actions = el('div', 'display:flex;gap:8px;justify-content:flex-end')
    const reject = el('button', 'padding:8px 14px;border:1px solid #999;border-radius:6px;background:#fff;color:#140d0a;cursor:pointer', 'Rejeitar')
    const approve = el('button', 'padding:8px 14px;border:0;border-radius:6px;background:#1f6feb;color:#fff;font-weight:700;cursor:pointer', 'Conectar')
    reject.type = approve.type = 'button'
    actions.append(reject, approve)
    dialog.append(title, desc, note, actions)
    document.body.append(dialog)

    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      dialog.close()
      dialog.remove()
      resolve(ok)
    }
    approve.addEventListener('click', () => done(true))
    reject.addEventListener('click', () => done(false))
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault()
      done(false) // Esc = recusar
    })
    dialog.showModal()
    approve.focus()
  })
}

export function installWalletExtension() {
  const extension: WalletExtension = {
    name: 'KurioWallet (simulada)',
    async connect(req) {
      const ok = await prompt(req)
      if (!ok) throw Object.assign(new Error('O usuário recusou a conexão.'), { code: USER_REJECTED })
      return { address: req.address, network: req.network }
    },
    async disconnect() {
      // Nada a revogar na simulação: a conexão vive na página.
    },
  }
  window.kurioWallet = extension
}
