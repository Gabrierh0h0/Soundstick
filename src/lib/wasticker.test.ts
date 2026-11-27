import { describe, expect, it } from 'vitest'
import { PACK } from './brand'
import { buildExif, injectExif, sha256b64, toAnimated } from './wasticker'

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

/** WebP simple (un cuadro) con VP8L de 40x30 y alfa, como el que devuelve el codificador para clips quietos. */
function simpleVp8l(): Uint8Array {
  const bits = (40 - 1) | ((30 - 1) << 14) | (1 << 28)
  const payload = [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff, 1, 2, 3]
  const body = [...'WEBP'].map((c) => c.charCodeAt(0)).concat([...'VP8L'].map((c) => c.charCodeAt(0)), payload.length, 0, 0, 0, ...payload)
  return new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat(body.length, 0, 0, 0, ...body))
}

describe('toAnimated', () => {
  it('envuelve un WebP simple en VP8X + ANIM + ANMF con las medidas y el alfa', () => {
    const out = toAnimated(simpleVp8l())
    expect(ascii(out, 12, 4)).toBe('VP8X')
    expect(out[20] & 0x02).toBe(0x02) // animación
    expect(out[20] & 0x10).toBe(0x10) // alfa
    const w = (out[24] | (out[25] << 8) | (out[26] << 16)) + 1
    const h = (out[27] | (out[28] << 8) | (out[29] << 16)) + 1
    expect([w, h]).toEqual([40, 30])
    expect(ascii(out, 30, 4)).toBe('ANIM')
    expect(ascii(out, 44, 4)).toBe('ANMF')
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8)
  })

  it('genera dos cuadros con duración para que la imagen fija cuente como animada', () => {
    const out = toAnimated(simpleVp8l(), 4000)
    const text = Array.from(out, (b) => String.fromCharCode(b)).join('')
    expect(text.split('ANMF').length - 1).toBe(2)
    expect(out[44 + 8 + 12] | (out[44 + 8 + 13] << 8)).toBe(2000)
  })

  it('deja intacto un WebP que ya es animado', () => {
    const src = fakeWebp()
    expect(toAnimated(src)).toBe(src)
  })

  it('injectExif acepta un WebP simple', () => {
    const out = injectExif(simpleVp8l(), buildExif('abc='))
    expect(out[20] & 0x0a).toBe(0x0a)
    expect(ascii(out, 0, out.length)).toContain('EXIF')
  })
})
