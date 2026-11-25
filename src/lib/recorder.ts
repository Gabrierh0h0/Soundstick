export type Recording = { stop: () => Promise<File> }

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

/**
 * Graba la voz con el micrófono. Se detiene sola al llegar a `maxSeconds`;
 * `onDone` recibe el archivo en ese caso. Lanza si no hay permiso o micrófono.
 */
export async function startRecording(
  maxSeconds: number,
  onTick: (seconds: number) => void,
  onDone: (file: File) => void,
): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  const startedAt = performance.now()
  let finished: Promise<File> | null = null

  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<File>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const type = rec.mimeType || 'audio/webm'
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
      resolve(new File(chunks, `voz.${ext}`, { type }))
    }
  })

  const timer = window.setInterval(() => {
    const s = (performance.now() - startedAt) / 1000
    onTick(Math.min(s, maxSeconds))
    if (s >= maxSeconds) void stop().then(onDone)
  }, 100)

  function stop(): Promise<File> {
    finished ??= (() => {
      window.clearInterval(timer)
      if (rec.state !== 'inactive') rec.stop()
      return done
    })()
    return finished
  }

  rec.start()
  return { stop }
}
