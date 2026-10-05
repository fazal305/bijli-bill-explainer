// Best-effort limiter: counts live in one function instance's memory, so a
// burst spread across cold instances can slip past it. The README explains
// how to add a Vercel Firewall rate-limit rule for a hard, shared limit.
export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }) {
  const hits = new Map()

  return function isLimited(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
    if (recent.length >= limit) {
      hits.set(key, recent)
      return true
    }
    recent.push(now)
    hits.delete(key)
    hits.set(key, recent)
    // Map keeps insertion order, so the first key is the least recently seen.
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value)
    return false
  }
}

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}
