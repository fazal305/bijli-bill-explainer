import { ALLOWED_TYPES, MAX_IMAGE_BYTES, sniffImageType } from './image.js'
import { readBill } from './model.js'
import { clientIp, createRateLimiter } from './rateLimit.js'
import { ExtractionError, normalizeExtraction, parseModelJson } from './schema.js'

const DEADLINE_MS = 50_000
const STATUS = {
  bad_request: 400,
  too_large: 413,
  unsupported_type: 415,
  not_a_bill: 422,
  unreadable: 422,
  rate_limited: 429,
  upstream: 502,
  not_configured: 503,
  timeout: 504,
}

const perMinute = createRateLimiter({ limit: 4, windowMs: 60_000 })
const perDay = createRateLimiter({ limit: 25, windowMs: 24 * 60 * 60_000 })

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Clients only ever see one of the codes above; details stay in the server log.
function fail(code) {
  return json(STATUS[code] || 500, { error: code })
}

export async function handleExplain(request, { env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  }

  const declared = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_TYPES.includes(declared)) return fail('unsupported_type')
  const length = Number(request.headers.get('content-length'))
  if (length > MAX_IMAGE_BYTES) return fail('too_large')

  const ip = clientIp(request)
  const time = now()
  if (perMinute(ip, time) || perDay(ip, time)) return fail('rate_limited')

  let image
  try {
    image = new Uint8Array(await request.arrayBuffer())
  } catch {
    return fail('bad_request')
  }
  if (image.length === 0) return fail('bad_request')
  if (image.length > MAX_IMAGE_BYTES) return fail('too_large')
  const mime = sniffImageType(image)
  if (!mime) return fail('unsupported_type')

  try {
    const { content, model } = await readBill({ image, mime, env, fetchImpl, deadline: time + DEADLINE_MS })
    const bill = normalizeExtraction(parseModelJson(content))
    return json(200, { bill, model })
  } catch (error) {
    if (error instanceof ExtractionError) {
      if (error.code !== 'not_a_bill') console.error(`[explain] ${error.code}: ${error.message}`)
      return fail(error.code)
    }
    console.error('[explain] unexpected', error)
    return json(500, { error: 'server' })
  }
}
