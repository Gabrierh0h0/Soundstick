import { describe, expect, it } from 'vitest'
import { PACK } from './brand'
import { buildExif, injectExif, sha256b64 } from './wasticker'

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n))

/** WebP extendido mínimo: RIFF + VP8X (animado, con alfa) + ANIM vacío. */
function fakeWebp(): Uint8Array {
  const out = new Uint8Array(12 + 18 + 14)
  const v = new DataView(out.buffer)
  out.set(new TextEncoder().encode('RIFF'), 0)
  v.setUint32(4, out.length - 8, true)
  out.set(new TextEncoder().encode('WEBP'), 8)
  out.set(new TextEncoder().encode('VP8X'), 12)
  v.setUint32(16, 10, true)
  out[20] = 0x12 // animación + alfa
  out.set(new TextEncoder().encode('ANIM'), 30)
  v.setUint32(34, 6, true)
  return out
}

describe('buildExif', () => {
  const hash = 'c90PlK4IhGxoaSZGm0F1cE1LfJsk1LOcDSuEWZTLgDE='
  const exif = buildExif(hash)
  const dv = new DataView(exif.buffer)

  it('usa la cabecera TIFF big-endian con el tag WA', () => {
    expect(ascii(exif, 0, 2)).toBe('MM')
    expect(dv.getUint16(2)).toBe(42)
    expect(dv.getUint32(4)).toBe(8)
    expect(dv.getUint16(10)).toBe(0x5741)
    expect(dv.getUint16(12)).toBe(7)
  })

  it('el tamaño y la posición declarados coinciden con el JSON', () => {
    const len = dv.getUint32(14)
    const off = dv.getUint32(18)
    expect(off + len).toBe(exif.length)
    const json = JSON.parse(new TextDecoder().decode(exif.subarray(off)))
    expect(json['sound-sha256']).toBe(hash)
    expect(json['sticker-pack-name']).toBe(PACK.name)
    expect(json['sticker-pack-publisher']).toBe(PACK.publisher)
    expect(json['is-from-sticker-maker']).toBe(1)
  })
})

describe('injectExif', () => {
  it('agrega el chunk EXIF, enciende la bandera y corrige el tamaño RIFF', () => {
    const src = fakeWebp()
    const exif = buildExif('abc=')
    const out = injectExif(src, exif)
    expect(out[20] & 0x08).toBe(0x08)
    expect(out[20] & 0x12).toBe(0x12) // conserva animación y alfa
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8)
    expect(ascii(out, src.length, 4)).toBe('EXIF')
    expect(out.length % 2).toBe(0)
  })

  it('rechaza archivos que no son WebP extendido', () => {
    expect(() => injectExif(new Uint8Array(40), buildExif('x'))).toThrow('WEBP_INVALID')
  })
})

describe('sha256b64', () => {
  it('coincide con el valor conocido de "abc"', async () => {
    expect(await sha256b64(new TextEncoder().encode('abc'))).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')
  })
})
