import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import { LIMITS } from './limits'

let instance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

/** Carga el motor una sola vez (unos 30 MB la primera vez; luego queda en caché). */
export function loadFFmpeg(): Promise<FFmpeg> {
  if (instance) return Promise.resolve(instance)
  loading ??= (async () => {
    const ff = new FFmpeg()
    await ff.load({ coreURL, wasmURL })
    instance = ff
    return ff
  })().catch((e) => {
    loading = null
    throw e
  })
  return loading
}

export type Crop = { x: number; y: number; side: number }

export type ExportOptions = {
  file: File
  start: number
  duration: number
  crop: Crop
  onProgress?: (fraction: number) => void
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** Recorta, encuadra a cuadrado 512x512 y devuelve un MP4 (H.264 + AAC) con el sonido del clip. */
export async function exportSticker({ file, start, duration, crop, onProgress }: ExportOptions): Promise<Blob> {
  const ff = await loadFFmpeg()
  const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
  const input = `in.${ext}`
  const output = 'out.mp4'
  const handler = ({ progress }: { progress: number }) => onProgress?.(Math.min(1, Math.max(0, progress)))
  ff.on('progress', handler)
  try {
    await ff.writeFile(input, await fetchFile(file))
    const side = even(crop.side)
    const vf = `crop=${side}:${side}:${Math.round(crop.x)}:${Math.round(crop.y)},scale=${LIMITS.outputSize}:${LIMITS.outputSize}:flags=lanczos,setsar=1,fps=30`
    const code = await ff.exec([
      '-ss', start.toFixed(3), '-t', duration.toFixed(3), '-i', input,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-movflags', '+faststart', '-y', output,
    ])
    if (code !== 0) throw new Error(`ffmpeg exit ${code}`)
    const data = (await ff.readFile(output)) as Uint8Array
    onProgress?.(1)
    return new Blob([data.slice().buffer], { type: 'video/mp4' })
  } finally {
    ff.off('progress', handler)
    await ff.deleteFile(input).catch(() => {})
    await ff.deleteFile(output).catch(() => {})
  }
}
