// Renders the home screen into dist/index.html after `vite build`, so phones
// on slow connections see the upload screen before the JavaScript has loaded.
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

const outDir = 'node_modules/.prerender'
await build({
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  publicDir: false,
  build: { ssr: 'src/entry-server.jsx', outDir, emptyOutDir: true },
})

const { render } = await import(pathToFileURL(path.resolve(outDir, 'entry-server.js')).href)
const file = 'dist/index.html'
const html = fs.readFileSync(file, 'utf8')
const mount = '<div id="root"></div>'
if (!html.includes(mount)) throw new Error('prerender: empty #root not found in dist/index.html')
fs.writeFileSync(file, html.replace(mount, `<div id="root">${render()}</div>`))
console.log('Prerendered the home screen into dist/index.html')
