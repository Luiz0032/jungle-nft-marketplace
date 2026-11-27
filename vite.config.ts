import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * `main.tsx` só importa a app depois que o MSW sobe (ver comentário lá). Sem isto, o navegador só
 * descobre os chunks da app quando o worker termina. `modulepreload` baixa e compila o grafo de
 * `src/app/app.tsx` em paralelo, mas não executa nada antes da hora.
 */
function preloadAppGraph(): Plugin {
  return {
    name: 'preload-app-graph',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        const entry = Object.values(bundle).find(
          (c) => c.type === 'chunk' && /[\\/]src[\\/]app[\\/]app\.tsx$/.test(c.facadeModuleId ?? ''),
        )
        if (!entry) throw new Error('preload-app-graph: chunk de src/app/app.tsx não encontrado')
        const files = new Set<string>()
        const visit = (file: string) => {
          const chunk = bundle[file]
          if (files.has(file) || chunk?.type !== 'chunk') return
          files.add(file)
          chunk.imports.forEach(visit)
        }
        visit(entry.fileName)
        return [...files]
          .filter((f) => !html.includes(f))
          .map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${f}` }, injectTo: 'head' as const }))
      },
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadAppGraph(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Só o tough-cookie (cookie store do MSW) importa o tldts; ver src/mocks/lib/tldts-lite.ts.
      { find: /^tldts$/, replacement: fileURLToPath(new URL('./src/mocks/lib/tldts-lite.ts', import.meta.url)) },
    ],
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
