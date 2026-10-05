export const TIMEOUT_MS = 60_000

export class ApiError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export async function explainPhoto(blob, signal) {
  let response
  try {
    response = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)].filter(Boolean)),
    })
  } catch (error) {
    if (signal?.aborted) throw new ApiError('cancelled')
    if (error?.name === 'TimeoutError') throw new ApiError('timeout')
    throw new ApiError(navigator.onLine ? 'network' : 'offline')
  }

  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.bill) throw new ApiError(body?.error || 'server')
  return body.bill
}
