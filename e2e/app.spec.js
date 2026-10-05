import { expect, test } from '@playwright/test'
import { SAMPLE_BILL } from '../src/lib/sample.js'

const PHOTO = 'e2e/fixtures/sample-bill.jpg'

async function noSidewaysScroll(page) {
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
  expect(scroll).toBe(client)
}

async function upload(page, { consent = true } = {}) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'گیلری سے تصویر چنیں' }).click()
  if (consent) await page.getByRole('dialog').getByRole('button', { name: 'ٹھیک ہے، آگے چلیں' }).click()
  await (await chooser).setFiles(PHOTO)
}

function mockApi(page, ...responses) {
  const calls = []
  return page
    .route('**/api/explain', async (route) => {
      const request = route.request()
      calls.push({ type: request.headers()['content-type'], bytes: request.postDataBuffer()?.length })
      const next = responses[Math.min(calls.length - 1, responses.length - 1)]
      if (next.gate) await next.gate
      await route.fulfill({ status: next.status, contentType: 'application/json', body: JSON.stringify(next.body) })
    })
    .then(() => calls)
}

const ok = { status: 200, body: { bill: SAMPLE_BILL, model: 'mock' } }

test('home screen has real metadata and fits a phone', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/بجلی بل ایکسپلینر/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /FPA/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('بجلی کا بل کیوں زیادہ آیا؟')
  await expect(page.getByRole('button', { name: 'بل کی تصویر کھینچیں' })).toBeVisible()
  await noSidewaysScroll(page)
})

test('sample bill is clearly labelled and explains the jump', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'نمونہ بل دیکھیں' }).click()
  await expect(page.getByRole('note').first()).toContainText('نمونہ بل')
  await expect(page.getByRole('heading', { name: 'بل کیوں زیادہ آیا؟' })).toBeVisible()
  await expect(page.locator('.reason')).toHaveCount(4)
  await expect(page.locator('.item')).toHaveCount(SAMPLE_BILL.lineItems.length)
  await expect(page.locator('.item.tone-tax').first()).toBeVisible()
  await noSidewaysScroll(page)
})

test('upload asks for consent once, sends a JPEG and shows the explanation', async ({ page }) => {
  const calls = await mockApi(page, ok)
  await page.goto('/')
  await upload(page)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('14,465')
  expect(calls).toHaveLength(1)
  expect(calls[0].type).toBe('image/jpeg')
  expect(calls[0].bytes).toBeGreaterThan(1000)
  await expect(page.locator('.your-photo img')).toHaveAttribute('src', /^blob:/)
  await noSidewaysScroll(page)

  await page.getByRole('button', { name: 'دوسرا بل دیکھیں' }).click()
  await upload(page, { consent: false })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('14,465')
})

test('declining consent sends nothing', async ({ page }) => {
  const calls = await mockApi(page, ok)
  await page.goto('/')
  await page.getByRole('button', { name: 'بل کی تصویر کھینچیں' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'ابھی نہیں' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(calls).toHaveLength(0)
})

test('a slow reading says so, and can be cancelled', async ({ page }) => {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  await page.clock.install()
  await mockApi(page, { ...ok, gate })
  await page.goto('/')
  await upload(page)
  await expect(page.getByText('عام طور پر 10 سے 20 سیکنڈ لگتے ہیں۔')).toBeVisible()
  await page.clock.fastForward(16_000)
  await expect(page.getByText(/سست لگ رہا ہے/)).toBeVisible()
  await page.getByRole('button', { name: 'رک جائیں' }).click()
  await expect(page.getByRole('button', { name: 'بل کی تصویر کھینچیں' })).toBeVisible()
  release()
})

test('a busy AI service offers a retry that works', async ({ page }) => {
  const calls = await mockApi(page, { status: 502, body: { error: 'upstream' } }, ok)
  await page.goto('/')
  await upload(page)
  await expect(page.getByRole('alert')).toContainText('AI سروس مصروف ہے')
  await page.getByRole('button', { name: 'دوبارہ کوشش کریں' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('14,465')
  expect(calls).toHaveLength(2)
})

test('a photo that is not a bill gets retake tips', async ({ page }) => {
  await mockApi(page, { status: 422, body: { error: 'not_a_bill' } })
  await page.goto('/')
  await upload(page)
  await expect(page.getByRole('alert')).toContainText('یہ بجلی کا بل نہیں لگتا')
  await expect(page.getByRole('alert').locator('.tips li')).toHaveCount(3)
})

test('when the service is not configured, the sample bill is offered', async ({ page }) => {
  await mockApi(page, { status: 503, body: { error: 'not_configured' } })
  await page.goto('/')
  await upload(page)
  await page.getByRole('alert').getByRole('button', { name: 'نمونہ بل دیکھیں' }).click()
  await expect(page.locator('.sample-badge')).toBeVisible()
})

test('offline: banner on home, clear error on upload', async ({ page, context }) => {
  await page.goto('/')
  await context.setOffline(true)
  await expect(page.locator('.banner')).toContainText('انٹرنیٹ بند ہے')
  await upload(page)
  await expect(page.getByRole('alert')).toContainText('انٹرنیٹ بند ہے')
  await context.setOffline(false)
})

test('wrong file type is refused before upload', async ({ page }) => {
  const calls = await mockApi(page, ok)
  await page.goto('/')
  await page.getByRole('button', { name: 'گیلری سے تصویر چنیں' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('dialog').getByRole('button', { name: 'ٹھیک ہے، آگے چلیں' }).click()
  await (await chooser).setFiles({ name: 'bill.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(page.getByRole('alert')).toContainText('یہ فائل نہیں چلے گی')
  expect(calls).toHaveLength(0)
})

for (const [route, heading] of [
  ['help', 'مدد اور الفاظ کے معنی'],
  ['privacy', 'پرائیویسی'],
  ['terms', 'استعمال کی شرائط'],
  ['nowhere', 'یہ صفحہ نہیں ملا'],
]) {
  test(`#/${route} renders and fits a phone`, async ({ page }) => {
    await page.goto(`/#/${route}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    await noSidewaysScroll(page)
  })
}

test('reloading the result screen goes back home instead of a blank page', async ({ page }) => {
  await page.goto('/#/result')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('بجلی کا بل کیوں زیادہ آیا؟')
})

test('robots.txt and sitemap.xml are served as files', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain('Sitemap:')
  const sitemap = await request.get('/sitemap.xml')
  expect(await sitemap.text()).toContain('<urlset')
})
