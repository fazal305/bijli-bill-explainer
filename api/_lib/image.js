export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Vercel rejects request bodies above 4.5 MB; the browser shrinks photos well below this.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// The browser-declared type is only a hint; the stored bytes decide.
export function sniffImageType(bytes) {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}
