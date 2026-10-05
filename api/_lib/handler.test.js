import { describe, expect, it, vi } from 'vitest'
import { handleExplain } from './handler.js'
import { sniffImageType } from './image.js'
import { createRateLimiter } from './rateLimit.js'
import { normalizeExtraction, parseModelJson, toNumber } from './schema.js'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const env = { AI_API_KEY: 'test-key', AI_MODEL: 'model-a,model-b' }

let ipCounter = 0
function upload(body = JPEG, type = 'image/jpeg', ip = `10.0.0.${++ipCounter}`) {
  return new Request('http://localhost/api/explain', {
    method: 'POST',
    headers: { 'content-type': type, 'x-forwarded-for': ip },
    body,
  })
}

function completion(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

const goodBill = {
  isElectricityBill: true,
  company: 'LESCO',
  billMonth: 'AUG 26',
  unitsConsumed: '312',
  totalPayable: '18,450',
  lineItems: [
    { key: 'energy', label: 'Cost of Electricity', amount: '12,100' },
    { key: 'fpa', label: 'F.P.A', amount: 1450 },
    { key: 'made_up', label: 'Something', amount: 50 },
    { key: 'gst', label: 'GST', amount: 0 },
  ],
  history: [{ month: 'JUL 26', units: 240, amount: 13200 }],
}

describe('sniffImageType', () => {
  it('trusts the bytes, not the name', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg')
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
  })
})

describe('toNumber', () => {
  it('reads the formats bills print', () => {
    expect(toNumber('Rs. 1,234/-')).toBe(1234)
    expect(toNumber('(120)')).toBe(-120)
    expect(toNumber('-45.5')).toBe(-45.5)
    expect(toNumber('12 units')).toBeNull()
    expect(toNumber(Infinity)).toBeNull()
  })
})

describe('parseModelJson + normalizeExtraction', () => {
  it('strips reasoning and code fences, drops zero amounts, maps unknown keys to other', () => {
    const raw = `<think>looking</think>\n\`\`\`json\n${JSON.stringify(goodBill)}\n\`\`\``
    const bill = normalizeExtraction(parseModelJson(raw))
    expect(bill.totalPayable).toBe(18450)
    expect(bill.unitsConsumed).toBe(312)
    expect(bill.lineItems.map((i) => i.key)).toEqual(['energy', 'fpa', 'other'])
    expect(bill.history).toEqual([{ month: 'JUL 26', units: 240, amount: 13200 }])
  })

  it('rejects photos that are not bills, and empty readings', () => {
    expect(() => normalizeExtraction({ isElectricityBill: false })).toThrow(expect.objectContaining({ code: 'not_a_bill' }))
    expect(() => normalizeExtraction({ isElectricityBill: true, lineItems: [] })).toThrow(
      expect.objectContaining({ code: 'unreadable' }),
    )
    expect(() => parseModelJson('Sorry, I cannot read this.')).toThrow(expect.objectContaining({ code: 'unreadable' }))
  })

  it('strips bidi overrides and caps label length', () => {
    const bill = normalizeExtraction({
      totalPayable: 10,
      lineItems: [{ key: 'other', label: `‮evil${'x'.repeat(100)}`, amount: 5 }],
    })
    expect(bill.lineItems[0].label).not.toMatch(/‮/)
    expect(bill.lineItems[0].label.length).toBe(60)
  })
})

describe('createRateLimiter', () => {
  it('blocks after the limit and frees up after the window', () => {
    const limited = createRateLimiter({ limit: 2, windowMs: 1000 })
    expect(limited('a', 0)).toBe(false)
    expect(limited('a', 10)).toBe(false)
    expect(limited('a', 20)).toBe(true)
    expect(limited('b', 20)).toBe(false)
    expect(limited('a', 1015)).toBe(false)
  })
})

describe('handleExplain', () => {
  it('returns the normalized bill', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(completion(JSON.stringify(goodBill)))
    const res = await handleExplain(upload(), { env, fetchImpl })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bill.company).toBe('LESCO')
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(sent.model).toBe('model-a')
    expect(sent.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/)
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key')
  })

  it('falls back to the next model when one is busy', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited upstream', { status: 429 }))
      .mockResolvedValueOnce(completion(JSON.stringify(goodBill)))
    const res = await handleExplain(upload(), { env, fetchImpl })
    expect(res.status).toBe(200)
    expect((await res.json()).model).toBe('model-b')
  })

  it('rejects wrong methods, types, spoofed types and oversized bodies before calling the model', async () => {
    const fetchImpl = vi.fn()
    const get = await handleExplain(new Request('http://localhost/api/explain'), { env, fetchImpl })
    expect(get.status).toBe(405)
    expect((await handleExplain(upload(JPEG, 'image/svg+xml'), { env, fetchImpl })).status).toBe(415)
    const spoofed = await handleExplain(upload(new TextEncoder().encode('<html>not an image</html>')), { env, fetchImpl })
    expect(spoofed.status).toBe(415)
    const big = new Uint8Array(4 * 1024 * 1024 + 1)
    big.set(JPEG)
    expect((await handleExplain(upload(big), { env, fetchImpl })).status).toBe(413)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports a missing key as not configured, without leaking details', async () => {
    const res = await handleExplain(upload(), { env: {}, fetchImpl: vi.fn() })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })

  it('maps a non-bill photo to 422 and upstream failure to a generic 502', async () => {
    const notBill = vi.fn().mockResolvedValue(completion('{"isElectricityBill": false}'))
    expect((await handleExplain(upload(), { env, fetchImpl: notBill })).status).toBe(422)

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const down = vi.fn().mockResolvedValue(new Response('internal stack trace at /srv/app.js', { status: 500 }))
    const res = await handleExplain(upload(), { env, fetchImpl: down })
    expect(res.status).toBe(502)
    expect(await res.text()).not.toMatch(/stack|srv/)
    errSpy.mockRestore()
  })

  it('rate limits one address', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => completion(JSON.stringify(goodBill)))
    const statuses = []
    for (let i = 0; i < 5; i++) statuses.push((await handleExplain(upload(JPEG, 'image/jpeg', '9.9.9.9'), { env, fetchImpl })).status)
    expect(statuses).toEqual([200, 200, 200, 200, 429])
  })
})
