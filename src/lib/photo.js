export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_INPUT_BYTES = 25 * 1024 * 1024
const MAX_SIDE = 2000
const TARGET_BYTES = 2.5 * 1024 * 1024

export class PhotoError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError('unreadable_photo'))), 'image/jpeg', quality)
  })
}

// Redrawing the photo on a canvas shrinks it for slow connections and drops
// its EXIF data (camera details, GPS location) before anything is uploaded.
export async function preparePhoto(file) {
  if (!file) throw new PhotoError('no_file')
  if (!ACCEPTED_TYPES.includes(file.type)) throw new PhotoError('wrong_type')
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('too_big')

  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('unreadable_photo')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  let blob = await toBlob(canvas, 0.85)
  if (blob.size > TARGET_BYTES) blob = await toBlob(canvas, 0.65)
  if (blob.size > TARGET_BYTES) throw new PhotoError('too_big')
  return blob
}
