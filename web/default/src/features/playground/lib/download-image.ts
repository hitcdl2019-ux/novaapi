/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

type ImageFormat = 'png' | 'jpeg' | 'webp'

const MIME_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

interface DownloadOptions {
  url: string
  format: ImageFormat
  filename?: string
}

function triggerDirectDownload(url: string, filename?: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename || ''
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function triggerBlobDownload(blob: Blob, filename: string, format: ImageFormat) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename || 'image'}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function canvasConvert(
  url: string,
  format: ImageFormat
): Promise<Blob> {
  const img = new Image()
  img.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas context')

  ctx.drawImage(img, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to convert image'))
      },
      MIME_TYPES[format],
      format === 'jpeg' || format === 'webp' ? 0.92 : undefined
    )
  })
}

export async function downloadImage({
  url,
  format,
  filename,
}: DownloadOptions): Promise<void> {
  try {
    const blob = await canvasConvert(url, format)
    triggerBlobDownload(blob, filename || 'image', format)
  } catch {
    // If canvas conversion fails (CORS blocking, network error, etc.),
    // fall back to opening the original URL directly.
    triggerDirectDownload(url, filename)
  }
}
