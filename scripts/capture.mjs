// Renders the PNG icons from public/favicon.svg and captures the social
// preview image and README screenshots from a running build:
//   npm run build && npm run preview -- --port 4173
//   BASE_URL=http://localhost:4173/ npm run capture
// Screens show the built-in sample bill, which is labelled as a sample.
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173/'
const browser = await chromium.launch()

async function renderIcons() {
  const svg = fs.readFileSync('public/favicon.svg', 'utf8')
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const page = await browser.newPage()
  // Full-bleed background so iOS and maskable icons have no transparent corners.
  for (const [file, size, inset] of [
    ['public/apple-touch-icon.png', 180, 0],
    ['public/icon-192.png', 192, 0],
    ['public/icon-512.png', 512, 0.1],
  ]) {
    const pad = Math.round(size * inset)
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<body style="margin:0;background:#1b5e43"><img src="${src}" style="display:block;margin:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px"></body>`,
    )
    await page.screenshot({ path: file })
  }
  await page.close()
}

async function openApp() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'ur-PK' })
  const page = await context.newPage()
  await page.goto(BASE_URL)
  await page.evaluate(() => document.fonts.ready)
  return { context, page }
}

async function scrollTo(page, selector) {
  await page.locator(selector).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12))
}

async function captureScreenshots() {
  fs.mkdirSync('docs/screenshots', { recursive: true })
  const { context, page } = await openApp()
  await page.screenshot({ path: 'docs/screenshots/home.png' })

  await page.getByRole('button', { name: 'نمونہ بل دیکھیں' }).click()
  await page.locator('.reasons').waitFor()
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  await scrollTo(page, '.sample-badge')
  await page.screenshot({ path: 'docs/screenshots/total.png' })
  await scrollTo(page, '.why')
  await page.screenshot({ path: 'docs/screenshots/why.png' })
  await scrollTo(page, '.lines')
  await page.screenshot({ path: 'docs/screenshots/lines.png' })
  await page.screenshot({ path: 'docs/screenshots/result-full.png', fullPage: true })
  await context.close()

  // Two real phone screens side by side, on the app's own colours.
  const shot = (name) => `data:image/png;base64,${fs.readFileSync(`docs/screenshots/${name}.png`).toString('base64')}`
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await og.setContent(`<body style="margin:0;height:630px;background:#f5f1e8;border-top:10px solid #1b5e43;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:48px;font-family:Arial">
    <div style="max-width:380px;color:#1d2622">
      <div style="font-size:52px;font-weight:700;line-height:1.1">Bijli Bill Explainer</div>
      <div style="font-size:26px;color:#4d5852;margin-top:16px;line-height:1.4">Photograph a Pakistani electricity bill. Get a plain-Urdu, line-by-line explanation of why it went up.</div>
    </div>
    ${['total', 'why'].map((n) => `<img src="${shot(n)}" style="height:560px;border-radius:28px;border:6px solid #1d2622;box-shadow:0 18px 40px rgba(0,0,0,.18)">`).join('')}
  </body>`)
  await og.screenshot({ path: 'public/og-image.png' })
  await og.close()
}

await renderIcons()
await captureScreenshots()
await browser.close()
console.log('Icons, social image and screenshots written.')
