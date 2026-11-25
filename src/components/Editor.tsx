import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useT, type Key } from '../lib/i18n'
import { exportSticker, loadFFmpeg } from '../lib/ffmpeg'
import { LIMITS, MAX_VIDEO_BYTES } from '../lib/limits'
import { saveSticker } from '../lib/library'
import { download, shareFile } from '../lib/share'
import { fmt } from '../lib/trim'
import { readPeaks } from '../lib/waveform'
import { clampFraming, framingToCrop, Preview, type Framing } from './Preview'
import { Trim } from './Trim'

type Loaded = { file: File; url: string; width: number; height: number; duration: number }
type Phase = 'idle' | 'loading' | 'exporting'
type Message = { kind: 'error' | 'info'; text: string } | null

const VIDEO_NAME = /\.(mp4|mov|m4v|webm|mkv|3gp)$/i
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

export function Editor({ onHelp }: { onHelp: () => void }) {
  const { t } = useT()
  const input = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cache = useRef<{ key: string; blob: Blob; saved: boolean } | null>(null)

  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [video, setVideo] = useState<Loaded | null>(null)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [win, setWin] = useState({ start: 0, end: 0 })
  const [framing, setFraming] = useState<Framing>({ cx: 0, cy: 0, zoom: 1 })
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<Message>(null)
  const [saved, setSaved] = useState(false)
  const [over, setOver] = useState(false)
  // El navegador exige un toque reciente para abrir "Compartir"; si exportar tardó, el botón queda armado para el siguiente toque.
  const [armedKey, setArmedKey] = useState('')

  const fail = useCallback((key: Key, vars?: Record<string, string | number>) => setMessage({ kind: 'error', text: t(key, vars) }), [t])

  // Libera la URL del video anterior cuando cambia o al salir.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url) }, [pending])

  function pick(file: File | undefined) {
    if (!file) return
    setMessage(null)
    setSaved(false)
    if (!file.type.startsWith('video/') && !VIDEO_NAME.test(file.name)) return fail('errType')
    if (file.size > MAX_VIDEO_BYTES) return fail('errSize', { mb: mb(file.size), max: LIMITS.maxVideoMB })
    cache.current = null
    setVideo(null)
    setPeaks(null)
    setPlaying(false)
    setPending({ file, url: URL.createObjectURL(file) })
    readPeaks(file, 96).then(setPeaks)
  }

  // El video se monta una vez que existe `pending`; sus metadatos definen ventana y encuadre iniciales.
  function onMeta() {
    const v = videoRef.current
    if (!v || !pending) return
    const width = v.videoWidth
    const height = v.videoHeight
    const duration = v.duration
    if (!width || !height || !Number.isFinite(duration)) return fail('errDecode')
    setVideo({ file: pending.file, url: pending.url, width, height, duration })
    setWin({ start: 0, end: Math.min(LIMITS.maxSeconds, duration) })
    setFraming({ cx: width / 2, cy: height / 2, zoom: 1 })
    setTime(0)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v || !video) return
    if (v.paused) {
      if (v.currentTime < win.start || v.currentTime >= win.end) v.currentTime = win.start
      void v.play()
    } else v.pause()
  }

  // Reproduce solo el tramo elegido, en bucle.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !video) return
    const tick = () => {
      setTime(v.currentTime)
      if (v.currentTime >= win.end - 0.03) v.currentTime = win.start
    }
    const on = () => setPlaying(true)
    const off = () => setPlaying(false)
    v.addEventListener('timeupdate', tick)
    v.addEventListener('play', on)
    v.addEventListener('pause', off)
    return () => {
      v.removeEventListener('timeupdate', tick)
      v.removeEventListener('play', on)
      v.removeEventListener('pause', off)
    }
  }, [video, win.start, win.end])

  const changeWindow = (start: number, end: number) => {
    const v = videoRef.current
    if (v?.paused) v.currentTime = start !== win.start ? start : Math.max(start, end - 0.1)
    setWin({ start, end })
    setSaved(false)
  }

  const keyOf = () => {
    if (!video) return ''
    const c = framingToCrop(framing, video.width, video.height)
    return [video.file.name, video.file.size, win.start.toFixed(2), win.end.toFixed(2), Math.round(c.x), Math.round(c.y), Math.round(c.side)].join('|')
  }

  async function render(): Promise<Blob | null> {
    if (!video) return null
    const key = keyOf()
    if (cache.current?.key === key) return cache.current.blob
    videoRef.current?.pause()
    setProgress(0)
    setPhase('loading')
    try {
      await loadFFmpeg()
      setPhase('exporting')
      const blob = await exportSticker({
        file: video.file,
        start: win.start,
        duration: win.end - win.start,
        crop: framingToCrop(framing, video.width, video.height),
        onProgress: setProgress,
      })
      cache.current = { key, blob, saved: false }
      return blob
    } catch {
      fail('errExport')
      return null
    } finally {
      setPhase('idle')
    }
  }

  async function keep(blob: Blob) {
    if (cache.current && !cache.current.saved) {
      await saveSticker(blob, win.end - win.start)
      cache.current.saved = true
    }
    setSaved(true)
  }

  async function onSave() {
    setMessage(null)
    const blob = await render()
    if (!blob) return
    await keep(blob)
    download(blob)
    setMessage({ kind: 'info', text: t('saved', { mb: mb(blob.size) }) })
  }

  async function onShare() {
    setMessage(null)
    const blob = await render()
    if (!blob) return
    await keep(blob)
    const result = await shareFile(blob)
    if (result === 'unsupported') {
      download(blob)
      setMessage({ kind: 'info', text: t('shareFallback') })
    } else if (result === 'needs-tap') {
      setArmedKey(keyOf())
      setMessage({ kind: 'info', text: t('shareAgain') })
    } else setMessage({ kind: 'info', text: t('saved', { mb: mb(blob.size) }) })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    pick(e.dataTransfer.files[0])
  }

  const busy = phase !== 'idle'
  const ready = !!video && armedKey !== '' && armedKey === keyOf()
  const len = win.end - win.start
  const label = `${LIMITS.outputSize}×${LIMITS.outputSize} · ${fmt(len)} s`

  return (
    <section className="editor" onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <input ref={input} type="file" accept="video/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />

      {!pending ? (
        <button type="button" className={`stage pick${over ? ' over' : ''}`} onClick={() => input.current?.click()}>
          <i className="plus" aria-hidden="true" />
          <strong>{t('pickVideo')}</strong>
          <small>{t('pickHint', { mb: LIMITS.maxVideoMB, s: LIMITS.maxSeconds })}</small>
        </button>
      ) : (
        <>
          {/* Video oculto hasta tener metadatos; luego lo toma el visor cuadrado. */}
          {!video && <video ref={videoRef} src={pending.url} preload="metadata" onLoadedMetadata={onMeta} onError={() => fail('errDecode')} hidden />}
          {video && (
            <>
              <Preview
                url={video.url}
                width={video.width}
                height={video.height}
                framing={framing}
                onFraming={(f) => { setFraming(f); setSaved(false) }}
                videoRef={videoRef}
                playing={playing}
                onTogglePlay={togglePlay}
                label={label}
              />
              <label className="zoom">
                <span>{t('zoom')}</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.05}
                  value={framing.zoom}
                  onChange={(e) => { setFraming(clampFraming({ ...framing, zoom: Number(e.target.value) }, video.width, video.height)); setSaved(false) }}
                />
              </label>
            </>
          )}
          {!video && <div className="stage pick" aria-busy="true"><strong>{t('loadingEngine')}</strong></div>}
        </>
      )}

      {video && (
        <div className="trim-block">
          <Trim duration={video.duration} start={win.start} end={win.end} time={time} peaks={peaks} onChange={changeWindow} />
          <p className="readout">
            <span>{fmt(win.start)} → {fmt(win.end)}</span> {t('trimLen', { len: fmt(len), max: LIMITS.maxSeconds })} · {t('fileSize', { mb: mb(video.file.size), max: LIMITS.maxVideoMB })}
            <button type="button" className="change" onClick={() => input.current?.click()}>{t('changeVideo')}</button>
          </p>
        </div>
      )}

      <div className="actions">
        <button type="button" className="mg" disabled={!video || busy} onClick={onSave}>{t('save')}</button>
        <button type="button" className={`cy${ready ? ' ready' : ''}`} disabled={!video || busy} onClick={onShare}>{ready ? t('shareNow') : t('share')}</button>
      </div>

      <div className="status" role="status" aria-live="polite">
        {busy && (
          <p className="progress" style={{ ['--p' as string]: phase === 'exporting' ? progress : 0 }}>
            <span>{phase === 'loading' ? t('loadingEngine') : t('exporting', { p: Math.round(progress * 100) })}</span>
          </p>
        )}
        {!busy && message && <p className={message.kind}>{message.text}</p>}
        {!busy && saved && message?.kind === 'info' && <button type="button" className="next" onClick={onHelp}>{t('savedNext')}</button>}
      </div>

      <div className="sources" role="group">
        <button type="button" className="on" aria-pressed="true">{t('srcVideo')}</button>
        <button type="button" disabled>{t('srcVideoAudio')}<small>{t('soon')}</small></button>
        <button type="button" disabled>{t('srcImageAudio')}<small>{t('soon')}</small></button>
        <button type="button" disabled>{t('srcVoice')}<small>{t('soon')}</small></button>
      </div>
    </section>
  )
}
