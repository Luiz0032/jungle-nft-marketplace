// Lighthouse CI nos perfis mobile e desktop (3 runs cada) contra o `pnpm preview`.
// Relatórios HTML+JSON de todos os runs em lighthouse/reports/<perfil>/ e o resumo de medianas
// em lighthouse/reports/summary.{md,json}. `--no-build` reaproveita o dist/ existente;
// `--summary-only` só refaz o resumo a partir dos relatórios já gravados.
// `--prod` mede a demo pública (lighthouse/lighthouserc.prod.json) em vez do preview local; não faz build
// e grava em lighthouse/reports/prod/.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PROD = process.argv.includes('--prod')
const REPORTS_REL = PROD ? 'lighthouse/reports/prod' : 'lighthouse/reports'
const REPORTS = path.join(ROOT, REPORTS_REL)
const CONFIG = PROD ? 'lighthouse/lighthouserc.prod.json' : 'lighthouse/lighthouserc.json'
const PROFILES = [
  { name: 'mobile', collectArgs: [] },
  { name: 'desktop', collectArgs: ['--settings.preset=desktop'] },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`)
  return spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true }).status ?? 1
}

const summaryOnly = process.argv.includes('--summary-only')
if (!summaryOnly && !PROD && !process.argv.includes('--no-build') && run('pnpm', ['build']) !== 0) process.exit(1)

for (const p of summaryOnly ? [] : PROFILES) fs.rmSync(path.join(REPORTS, p.name), { recursive: true, force: true })
let failed = false
for (const p of summaryOnly ? [] : PROFILES) {
  fs.rmSync(path.join(ROOT, '.lighthouseci'), { recursive: true, force: true })
  if (run('pnpm', ['exec', 'lhci', 'collect', `--config=${CONFIG}`, ...p.collectArgs]) !== 0) process.exit(1)
  run('pnpm', ['exec', 'lhci', 'upload', `--config=${CONFIG}`, `--outputDir=${REPORTS_REL}/${p.name}`])
  tidyManifest(path.join(REPORTS, p.name))
  if (run('pnpm', ['exec', 'lhci', 'assert', `--config=${CONFIG}`]) !== 0) failed = true
}

/** `/` vira `home-…` (o pathname vazio gerava nomes começando com `-`) e caminhos relativos ao repo. */
function tidyManifest(dir) {
  const file = path.join(dir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const entry of manifest) {
    for (const key of ['htmlPath', 'jsonPath']) {
      let abs = path.resolve(ROOT, entry[key])
      if (path.basename(abs).startsWith('-')) {
        const renamed = path.join(path.dirname(abs), `home${path.basename(abs)}`)
        fs.renameSync(abs, renamed)
        abs = renamed
      }
      entry[key] = path.relative(ROOT, abs).split(path.sep).join('/')
    }
  }
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
}

// ---- resumo: mediana por página/perfil ----
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const rows = []
let env
for (const p of PROFILES) {
  const dir = path.join(REPORTS, p.name)
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const byUrl = Object.groupBy(manifest, (e) => new URL(e.url).pathname)
  for (const [page, entries] of Object.entries(byUrl)) {
    const lhrs = entries.map((e) => JSON.parse(fs.readFileSync(path.resolve(ROOT, e.jsonPath), 'utf8')))
    env ??= lhrs[0]
    const audit = (id) => median(lhrs.map((l) => l.audits[id].numericValue))
    rows.push({
      profile: p.name,
      page,
      perfRuns: lhrs.map((l) => Math.round(l.categories.performance.score * 100)),
      ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(median(lhrs.map((l) => l.categories[c].score)) * 100)])),
      lcpMs: Math.round(audit('largest-contentful-paint')),
      cls: Number(audit('cumulative-layout-shift').toFixed(3)),
      tbtMs: Math.round(audit('total-blocking-time')),
      fcpMs: Math.round(audit('first-contentful-paint')),
    })
  }
}
// O user agent do LHR é reduzido (158.0.0.0); no Windows a versão completa está no registro.
function chromeVersion() {
  if (process.platform !== 'win32') return undefined
  const out = spawnSync('reg', ['query', 'HKCU\\Software\\Google\\Chrome\\BLBeacon', '/v', 'version'], { encoding: 'utf8' })
  return out.stdout?.match(/version\s+REG_SZ\s+([\d.]+)/)?.[1]
}
const environment = {
  target: PROD ? 'Vercel (produção, CDN)' : 'pnpm preview (localhost:4173)',
  date: env.fetchTime,
  node: process.version,
  lighthouse: env.lighthouseVersion,
  chrome: chromeVersion() ?? env.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1],
  benchmarkIndex: env.environment.benchmarkIndex,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpu: `${os.cpus()[0]?.model.trim()} (${os.cpus().length} threads)`,
  memoryGb: Math.round(os.totalmem() / 2 ** 30),
}
fs.writeFileSync(path.join(REPORTS, 'summary.json'), JSON.stringify({ environment, rows }, null, 2) + '\n')

const md = [
  '| Perfil | Página | Perf (runs) | A11y | BP | SEO | LCP | CLS | TBT | FCP |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.profile} | \`${r.page}\` | ${r.performance} (${r.perfRuns.join(' / ')}) | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${(r.lcpMs / 1000).toFixed(2)} s | ${r.cls} | ${r.tbtMs} ms | ${(r.fcpMs / 1000).toFixed(2)} s |`,
  ),
  '',
  `Alvo: ${environment.target} · Node ${environment.node} · Lighthouse ${environment.lighthouse} · Chrome ${environment.chrome} · ${environment.os} · ${environment.cpu} · ${environment.memoryGb} GB · benchmarkIndex ${environment.benchmarkIndex} · ${environment.date}`,
  '',
].join('\n')
fs.writeFileSync(path.join(REPORTS, 'summary.md'), md)
console.log('\n' + md)
if (failed) {
  console.error('Alguma meta ficou abaixo do mínimo (ver asserções acima).')
  process.exit(1)
}
