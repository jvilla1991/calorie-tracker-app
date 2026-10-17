// Shrinks a photo on the phone before it is uploaded: a 1600px JPEG for viewing and a
// 400px one for the thumbnail strip. Drawing to a canvas and re-encoding also drops
// every bit of EXIF metadata (GPS position, camera, time) — keep it that way: meal
// photos are visible to anyone with the read-only diary link.

/** Longest edge, in px, of the uploaded photo and of its thumbnail. */
export const FULL_MAX = 1600
export const THUMB_MAX = 400

const FULL_QUALITY = 0.82
const THUMB_QUALITY = 0.75
/** Lower qualities tried, in turn, while the full JPEG is over budget. */
const RETRY_QUALITIES = [0.7, 0.6, 0.5]
/** Headroom under the API's limits (3 MB full, 500 KB thumbnail). */
const FULL_BUDGET = 2.8 * 1024 * 1024
const THUMB_BUDGET = 480 * 1024

export interface ResizedPhoto {
  full: Blob
  thumb: Blob
  /** Size of `full` in px (after rotation and resizing). */
  width: number
  height: number
}

/** A photo that couldn't be prepared; `message` is ready to show to the user. */
export class PhotoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoError'
  }
}

const UNSUPPORTED = 'This photo format isn’t supported — try a JPEG or PNG'

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

/** Decodes the file the right way up (EXIF orientation applied). */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      // Option or format not supported here — try an <img> instead.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) })
      } else {
        URL.revokeObjectURL(url)
        reject(new PhotoError(UNSUPPORTED))
      }
    }
    // e.g. HEIC on desktop Chrome: neither path can decode it.
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new PhotoError(UNSUPPORTED))
    }
    img.src = url
  })
}

/** Scales (w, h) down so the longer edge is at most `max`; never scales up. */
function fit(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

function draw(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('This photo couldn’t be prepared for upload.')
  // JPEG has no transparency: start from white so transparent PNG areas don't turn black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return canvas
}

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b && b.type === 'image/jpeg' ? resolve(b) : reject(new PhotoError('This photo couldn’t be prepared for upload.'))),
      'image/jpeg',
      quality,
    )
  })
}

/** Frees a canvas's pixels now (iOS Safari holds on to them until the element shrinks). */
const free = (c: HTMLCanvasElement) => { c.width = 0; c.height = 0 }

/**
 * A photo file → a full JPEG (long edge ≤ 1600px, ≤ ~2.8 MB) and a thumbnail JPEG
 * (long edge ≤ 400px), both without EXIF. Throws PhotoError with a user-facing message.
 */
export async function resizeForUpload(file: Blob): Promise<ResizedPhoto> {
  const img = await decode(file)
  const size = fit(img.width, img.height, FULL_MAX)
  let full: HTMLCanvasElement
  try {
    full = draw(img.source, size.w, size.h)
  } finally {
    img.release()
  }
  try {
    let fullBlob = await jpeg(full, FULL_QUALITY)
    for (const q of RETRY_QUALITIES) {
      if (fullBlob.size <= FULL_BUDGET) break
      fullBlob = await jpeg(full, q)
    }
    if (fullBlob.size > FULL_BUDGET) throw new PhotoError('This photo is too large to upload.')

    // The thumbnail is drawn from the 1600px canvas: a second, smaller step looks sharper.
    const t = fit(full.width, full.height, THUMB_MAX)
    const thumb = draw(full, t.w, t.h)
    try {
      let thumbBlob = await jpeg(thumb, THUMB_QUALITY)
      if (thumbBlob.size > THUMB_BUDGET) thumbBlob = await jpeg(thumb, 0.5)
      return { full: fullBlob, thumb: thumbBlob, width: full.width, height: full.height }
    } finally {
      free(thumb)
    }
  } finally {
    free(full)
  }
}
