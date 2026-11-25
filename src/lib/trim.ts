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
  const max = Math.max(min, maxLen)
  if (kind === 'move') {
    const len = base.end - base.start
    const start = clamp(base.start + delta, 0, Math.max(0, duration - len))
    return { start, end: start + len }
  }
  if (kind === 'start') {
    const start = clamp(base.start + delta, Math.max(0, base.end - max), base.end - min)
    return { start, end: base.end }
  }
  const end = clamp(base.end + delta, base.start + min, Math.min(duration, base.start + max))
  return { start: base.start, end }
}

/** Ventana inicial: desde el principio, con el largo máximo permitido. */
export const initialWindow = (duration: number, maxLen: number) => ({ start: 0, end: Math.min(duration, maxLen) })

/** Recorta una ventana existente si ahora excede el máximo. */
export const clampWindow = (w: { start: number; end: number }, maxLen: number) =>
  w.end - w.start > maxLen ? { start: w.start, end: w.start + maxLen } : w

export const fmt = (s: number) => s.toFixed(1)
