/**
 * Formato de sticker con sonido de WhatsApp: WebP animado + chunk EXIF con el hash del audio.
 * El audio viaja aparte; el WebP solo lo referencia con "sound-sha256" (base64 del SHA-256 del Opus).
 */

import { PACK } from './brand'

const enc = new TextEncoder()

export async function sha256b64(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))
  let s = ''
  for (const b of digest) s += String.fromCharCode(b)
  return btoa(s)
}

/** EXIF mínimo (TIFF big-endian, un solo tag 0x5741 "WA" con el JSON), igual que los stickers reales. */
export function buildExif(soundSha256: string): Uint8Array {
  const json = enc.encode(
    JSON.stringify({
      'sticker-pack-id': PACK.id,
      'sticker-pack-name': PACK.name,
      'sticker-pack-publisher': PACK.publisher,
      'is-from-sticker-maker': 1,
      'sticker-maker-source-type': 4,
      'sound-sha256': soundSha256,
    }),
  )
  const head = 26
  const out = new Uint8Array(head + json.length)
  const v = new DataView(out.buffer)
  out.set([0x4d, 0x4d, 0x00, 0x2a], 0) // "MM" + 42
  v.setUint32(4, 8) // offset del primer IFD
  v.setUint16(8, 1) // una entrada
  v.setUint16(10, 0x5741) // tag "WA"
  v.setUint16(12, 7) // tipo UNDEFINED
  v.setUint32(14, json.length) // cantidad
  v.setUint32(18, head) // offset de los datos
  v.setUint32(22, 0) // sin siguiente IFD
  out.set(json, head)
  return out
}

const u24 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff]
const fourcc = (s: string) => Array.from(enc.encode(s))
const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]

function chunk(name: string, data: Uint8Array | number[]): number[] {
  const d = Array.from(data)
  const out = [...fourcc(name), ...u32(d.length), ...d]
  if (d.length & 1) out.push(0)
  return out
}

/**
 * El codificador entrega un WebP "simple" (un solo cuadro) cuando el clip casi no se mueve. WhatsApp espera el
 * contenedor animado incluso con un cuadro, así que se envuelve igual que los stickers reales: VP8X + ANIM + ANMF.
 */
export function toAnimated(webp: Uint8Array, durationMs = 1000): Uint8Array {
  const tag = (o: number) => String.fromCharCode(webp[o], webp[o + 1], webp[o + 2], webp[o + 3])
  const dv = new DataView(webp.buffer, webp.byteOffset, webp.byteLength)
  if (webp.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('WEBP_INVALID')
  if (tag(12) === 'VP8X' && webp[20] & 0x02) return webp // ya es animado
  let alph: Uint8Array | null = null
  let image: { name: string; data: Uint8Array } | null = null
  for (let p = 12; p + 8 <= webp.length; ) {
    const name = tag(p)
    const n = dv.getUint32(p + 4, true)
    const data = webp.subarray(p + 8, p + 8 + n)
    if (name === 'ALPH') alph = data
    else if (name === 'VP8 ' || name === 'VP8L') image = { name, data }
    p += 8 + n + (n & 1)
  }
  if (!image) throw new Error('WEBP_NO_IMAGE')
  const d = new DataView(image.data.buffer, image.data.byteOffset, image.data.byteLength)
  let w: number
  let h: number
  let alpha = alph !== null
  if (image.name === 'VP8L') {
    const bits = d.getUint32(1, true)
    w = (bits & 0x3fff) + 1
    h = ((bits >> 14) & 0x3fff) + 1
    alpha = alpha || ((bits >> 28) & 1) === 1
  } else {
    w = d.getUint16(6, true) & 0x3fff
    h = d.getUint16(8, true) & 0x3fff
  }
  const frame = [...(alph ? chunk('ALPH', alph) : []), ...chunk(image.name, image.data)]
  // Dos cuadros iguales con duración real: una imagen fija con un solo cuadro de duración 0 se toma como estática
  // y WhatsApp no reproduce el sonido.
  const each = Math.max(40, Math.round(durationMs / 2))
  const anmf = [...u24(0), ...u24(0), ...u24(w - 1), ...u24(h - 1), ...u24(each), 2, ...frame]
  const body = [
    ...fourcc('WEBP'),
    ...chunk('VP8X', [0x02 | (alpha ? 0x10 : 0), 0, 0, 0, ...u24(w - 1), ...u24(h - 1)]),
    ...chunk('ANIM', [0, 0, 0, 0, 0, 0]),
    ...chunk('ANMF', anmf),
    ...chunk('ANMF', anmf),
  ]
  return new Uint8Array([...fourcc('RIFF'), ...u32(body.length), ...body])
}

/** Agrega el chunk EXIF a un WebP y enciende su bandera en VP8X (convierte a animado si hace falta). */
export function injectExif(input: Uint8Array, exif: Uint8Array, durationMs = 1000): Uint8Array {
  const webp = toAnimated(input, durationMs)
  const tag = (o: number) => String.fromCharCode(webp[o], webp[o + 1], webp[o + 2], webp[o + 3])
  if (tag(12) !== 'VP8X') throw new Error('WEBP_NOT_EXTENDED')
  const pad = exif.length & 1
  const out = new Uint8Array(webp.length + 8 + exif.length + pad)
  out.set(webp, 0)
  out[20] |= 0x08 // bandera EXIF
  const o = webp.length
  out.set(enc.encode('EXIF'), o)
  new DataView(out.buffer).setUint32(o + 4, exif.length, true)
  out.set(exif, o + 8)
  new DataView(out.buffer).setUint32(4, out.length - 8, true)
  return out
}
