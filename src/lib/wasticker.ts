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

/** Agrega el chunk EXIF a un WebP extendido y enciende su bandera en VP8X. */
export function injectExif(webp: Uint8Array, exif: Uint8Array): Uint8Array {
  const tag = (o: number) => String.fromCharCode(webp[o], webp[o + 1], webp[o + 2], webp[o + 3])
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('WEBP_INVALID')
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
