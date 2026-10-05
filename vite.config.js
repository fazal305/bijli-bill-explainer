import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// vercel.json sends the full policy as headers; the meta copy keeps it in place
// for `vite preview`. Dev is left alone because Vite's HMR preamble relies on
// inline scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ')

const securityMeta = {
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
  ],
}

// Hashed asset names are only known after bundling, so the service worker's
// precache list and cache version are written into dist/sw.js here.
const swPrecache = {
  name: 'sw-precache',
  apply: 'build',
  writeBundle(options, bundle) {
    const files = Object.keys(bundle)
      .filter((f) => f !== 'index.html' && !f.endsWith('.woff'))
      .sort()
      .map((f) => `./${f}`)
    const version = createHash('sha256').update(files.join()).digest('hex').slice(0, 10)
    const swPath = path.join(options.dir, 'sw.js')
    const source = fs.readFileSync(swPath, 'utf8')
    const marker = "const BUILD = { version: 'dev', files: [] }"
    if (!source.includes(marker)) throw new Error('sw-precache: BUILD marker missing from sw.js')
    fs.writeFileSync(swPath, source.replace(marker, `const BUILD = ${JSON.stringify({ version, files })}`))
  },
}

// Serves api/explain.js from `vite` and `vite preview` the same way Vercel does,
// so the whole flow runs locally with a key in .env.local.
function localApi(env) {
  async function middleware(req, res, next) {
    if (!req.url?.startsWith('/api/explain')) return next()
    const { handleExplain } = await import('./api/_lib/handler.js')
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress || 'local' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    })
    const response = await handleExplain(request, { env })
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  }
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'AI_')
  return {
    base: '/',
    plugins: [react(), securityMeta, swPrecache, localApi(env)],
    test: { include: ['src/**/*.test.js', 'api/**/*.test.js'] },
  }
})
