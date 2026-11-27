import { LIMITS } from './limits'
import type { Effects } from './project'

type TextStyle = Pick<Effects, 'text' | 'textPos' | 'textColor' | 'textSize'>

const FONT = '"Oxanium", system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

function draw(style: TextStyle): HTMLCanvasElement | null {
  const text = style.text.trim()
  if (!text) return null
  const size = LIMITS.outputSize
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size })
  const ctx = canvas.getContext('2d')!
  ctx.font = `700 ${style.textSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const lines = wrap(ctx, text, size - 56)
  const lineH = style.textSize * 1.18
  const block = lineH * lines.length
  const margin = 28
  const top = style.textPos === 'top' ? margin : style.textPos === 'bottom' ? size - margin - block : (size - block) / 2
  ctx.lineWidth = Math.max(4, style.textSize * 0.16)
  ctx.strokeStyle = '#000'
  ctx.fillStyle = style.textColor
  lines.forEach((l, i) => {
    const y = top + lineH * i + lineH / 2
    ctx.strokeText(l, size / 2, y)
    ctx.fillText(l, size / 2, y)
  })
  return canvas
}

/** Imagen transparente (data URL) con el texto, para previsualizar encima del video. */
export const overlayDataUrl = (style: TextStyle): string | null => draw(style)?.toDataURL('image/png') ?? null

/** PNG transparente con el texto, listo para superponer en ffmpeg. Soporta emojis. */
export async function overlayBlob(style: TextStyle): Promise<Blob | null> {
  await document.fonts.load(`700 ${style.textSize}px "Oxanium"`).catch(() => {})
  const canvas = draw(style)
  if (!canvas) return null
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/**
 * Cuadro 512x512 para una imagen fija: la imagen (recortada o completa) cae dentro de la caja de la forma elegida
 * y el resto del lienzo queda transparente, borroso o de un color.
 */
export async function stickerFrameBlob(
  img: HTMLImageElement,
  o: { crop: { x: number; y: number; w: number; h: number }; whole: boolean; box: { w: number; h: number }; bg: string },
): Promise<Blob> {
  const size = LIMITS.outputSize
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size })
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (o.bg === 'blur') {
    const cover = size / Math.min(w, h)
    ctx.filter = 'blur(14px)'
    ctx.drawImage(img, (size - w * cover) / 2 - 20, (size - h * cover) / 2 - 20, w * cover + 40, h * cover + 40)
    ctx.filter = 'none'
  } else if (o.bg !== 'transparent') {
    ctx.fillStyle = o.bg
    ctx.fillRect(0, 0, size, size)
  }
  const left = (size - o.box.w) / 2
  const top = (size - o.box.h) / 2
  if (o.whole) {
    const fit = Math.min(o.box.w / w, o.box.h / h)
    ctx.drawImage(img, (size - w * fit) / 2, (size - h * fit) / 2, w * fit, h * fit)
  } else {
    const c = o.crop
    ctx.drawImage(img, c.x, c.y, c.w, c.h, left, top, o.box.w, o.box.h)
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'))
}
