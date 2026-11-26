#!/usr/bin/env node
/**
 * Gera/atualiza as baselines de regressão visual (@visual) em Linux, dentro da imagem oficial do
 * Playwright na MESMA versão do @playwright/test instalado. Assim as baselines batem com o CI
 * (.github/workflows/e2e.yml roda na mesma imagem), independentemente do SO de quem roda.
 *
 * Uso: pnpm test:visual:update [-- args extras do playwright]
 * Requer Docker. Sem Docker: GitHub → Actions → "E2E" → Run workflow com update_snapshots = true.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { version } = require('@playwright/test/package.json')
const image = `mcr.microsoft.com/playwright:v${version}-noble`
const extra = process.argv.slice(2).join(' ')

const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'ignore' })
if (docker.status !== 0) {
  console.error('Docker não está disponível. Gere as baselines pelo workflow "E2E" (workflow_dispatch, update_snapshots=true).')
  process.exit(1)
}

const inner = [
  'npm install -g pnpm@12.23.0',
  'pnpm install --frozen-lockfile',
  'pnpm build',
  `pnpm exec playwright test --grep @visual --update-snapshots ${extra}`,
].join(' && ')

console.log(`→ ${image}`)
const result = spawnSync(
  'docker',
  [
    'run', '--rm', '--ipc=host', '-e', 'CI=1',
    '-v', `${process.cwd()}:/work`,
    // node_modules do host (Windows/macOS) não serve no Linux: volume anônimo só para o container.
    '-v', '/work/node_modules',
    '-w', '/work',
    image,
    '/bin/bash', '-c', inner,
  ],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
