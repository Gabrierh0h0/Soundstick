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
  /** Video fuente (se recorta con `crop`) o, para imágenes, el cuadro 512x512 ya dibujado. */
  visual: { kind: 'video'; file: File; start: number; crop: Crop } | { kind: 'image'; frame: Blob }
  /** Audio aparte (archivo o voz) y desde dónde se usa. */
  audio: { file: File; start: number } | null
  /** Segundos de material fuente que entran al sticker (antes de aplicar la velocidad). */
  sourceLength: number
  speed: number
  fade: number
  volOrig: number
  volAdd: number
  overlay: Blob | null
  onProgress?: (fraction: number) => void
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
const num = (n: number) => Number(n.toFixed(3)).toString()
const extOf = (file: File, fallback: string) => (file.name.split('.').pop() ?? fallback).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback

async function hasAudioStream(ff: FFmpeg, name: string): Promise<boolean> {
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => lines.push(message)
  ff.on('log', onLog)
  try {
    await ff.exec(['-hide_banner', '-i', name])
  } finally {
    ff.off('log', onLog)
  }
  return lines.some((l) => /Stream #.*Audio/.test(l))
}

/** Construye el MP4 (H.264 + AAC, 512x512): recorte, mezcla de sonidos, velocidad, fundido y texto. */
export async function exportSticker(o: ExportOptions): Promise<Blob> {
  const ff = await loadFFmpeg()
  const handler = ({ progress }: { progress: number }) => o.onProgress?.(Math.min(1, Math.max(0, progress)))
  const written: string[] = []
  const put = async (name: string, data: Blob | File) => {
    await ff.writeFile(name, await fetchFile(data))
    written.push(name)
  }
  ff.on('progress', handler)
  try {
    const speed = o.speed
    const outLen = o.sourceLength / speed
    const fade = Math.min(o.fade, outLen / 2)
    const args: string[] = []
    let next = 0
    const idx = { visual: next++, audio: -1, overlay: -1 }

    // ── Entradas ──
    let origAudio = false
    if (o.visual.kind === 'video') {
      const name = `in-video.${extOf(o.visual.file, 'mp4')}`
      await put(name, o.visual.file)
      origAudio = await hasAudioStream(ff, name)
      args.push('-ss', num(o.visual.start), '-t', num(o.sourceLength), '-i', name)
    } else {
      await put('frame.png', o.visual.frame)
      args.push('-loop', '1', '-framerate', '30', '-t', num(o.sourceLength), '-i', 'frame.png')
    }
    if (o.audio) {
      const name = `in-audio.${extOf(o.audio.file, 'wav')}`
      await put(name, o.audio.file)
      idx.audio = next++
      args.push('-ss', num(o.audio.start), '-t', num(o.sourceLength), '-i', name)
    }
    if (o.overlay) {
      await put('overlay.png', o.overlay)
      idx.overlay = next++
      args.push('-i', 'overlay.png')
    }

    // ── Video ──
    const size = LIMITS.outputSize
    const chain: string[] = []
    const base =
      o.visual.kind === 'video'
        ? `crop=${even(o.visual.crop.side)}:${even(o.visual.crop.side)}:${Math.round(o.visual.crop.x)}:${Math.round(o.visual.crop.y)},scale=${size}:${size}:flags=lanczos`
        : `scale=${size}:${size}`
    chain.push(`[${idx.visual}:v]${base},setsar=1,fps=30,format=yuv420p[v0]`)
    let v = 'v0'
    if (o.overlay) {
      chain.push(`[${v}][${idx.overlay}:v]overlay=0:0:format=auto,format=yuv420p[v1]`)
      v = 'v1'
    }
    const vFx: string[] = []
    if (speed !== 1) vFx.push(`setpts=PTS/${num(speed)}`)
    if (fade > 0) vFx.push(`fade=t=in:st=0:d=${num(fade)}`, `fade=t=out:st=${num(outLen - fade)}:d=${num(fade)}`)
    chain.push(`[${v}]${vFx.length ? vFx.join(',') : 'null'}[vout]`)

    // ── Audio ──
    const sources: string[] = []
    const useOrig = origAudio && (o.audio === null || o.volOrig > 0)
    if (useOrig) {
      chain.push(`[${idx.visual}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${num(o.volOrig)}[ao]`)
      sources.push('ao')
    }
    if (o.audio) {
      chain.push(`[${idx.audio}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${num(o.volAdd)}[aa]`)
      sources.push('aa')
    }
    const hasAudio = sources.length > 0
    if (hasAudio) {
      let a = sources[0]
      if (sources.length === 2) {
        chain.push('[ao][aa]amix=inputs=2:duration=longest:normalize=0[am]')
        a = 'am'
      }
      const aFx = [`apad=whole_dur=${num(o.sourceLength)}`]
      if (speed !== 1) aFx.push(`atempo=${num(speed)}`)
      if (fade > 0) aFx.push(`afade=t=in:st=0:d=${num(fade)}`, `afade=t=out:st=${num(outLen - fade)}:d=${num(fade)}`)
      chain.push(`[${a}]${aFx.join(',')}[aout]`)
    }

    const code = await ff.exec([
      ...args,
      '-filter_complex', chain.join(';'),
      '-map', '[vout]',
      ...(hasAudio ? ['-map', '[aout]'] : ['-an']),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
      '-t', num(outLen), '-movflags', '+faststart', '-y', 'out.mp4',
    ])
    if (code !== 0) throw new Error(`ffmpeg exit ${code}`)
    const data = (await ff.readFile('out.mp4')) as Uint8Array
    o.onProgress?.(1)
    return new Blob([data.slice().buffer], { type: 'video/mp4' })
  } finally {
    ff.off('progress', handler)
    for (const name of [...written, 'out.mp4']) await ff.deleteFile(name).catch(() => {})
  }
}
