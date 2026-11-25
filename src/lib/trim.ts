export type Handle = 'start' | 'end' | 'move'

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Aplica un desplazamiento (en segundos) a la ventana de recorte respetando minimo y maximo. */
export function moveWindow(
  kind: Handle,
  base: { start: number; end: number },
  delta: number,
  duration: number,
  minLen: number,
  maxLen: number,
): { start: number; end: number } {
  const min = Math.min(minLen, duration)
  if (kind === 'move') {
    const len = base.end - base.start
    const start = clamp(base.start + delta, 0, duration - len)
    return { start, end: start + len }
  }
  if (kind === 'start') {
    const start = clamp(base.start + delta, Math.max(0, base.end - maxLen), base.end - min)
    return { start, end: base.end }
  }
  const end = clamp(base.end + delta, base.start + min, Math.min(duration, base.start + maxLen))
  return { start: base.start, end }
}

export const fmt = (s: number) => s.toFixed(1)
