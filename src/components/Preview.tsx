import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useT } from '../lib/i18n'
import type { Crop } from '../lib/ffmpeg'
import { clamp } from '../lib/trim'

export type Framing = { cx: number; cy: number; zoom: number }

export function clampFraming(f: Framing, w: number, h: number): Framing {
  const side = Math.min(w, h) / f.zoom
  return { zoom: f.zoom, cx: clamp(f.cx, side / 2, w - side / 2), cy: clamp(f.cy, side / 2, h - side / 2) }
}

export function framingToCrop(f: Framing, w: number, h: number): Crop {
  const side = Math.min(w, h) / f.zoom
  return { side, x: clamp(f.cx - side / 2, 0, w - side), y: clamp(f.cy - side / 2, 0, h - side) }
}

type Props = {
  kind: 'video' | 'image'
  url: string
  width: number
  height: number
  framing: Framing
  onFraming: (f: Framing) => void
  videoRef: RefObject<HTMLVideoElement | null>
  playing: boolean
  canPlay: boolean
  onTogglePlay: () => void
  /** Etiquetas flotantes: tiempo (arriba izquierda), tipo (arriba derecha) y medida (abajo izquierda). */
  tags: { tl: string; tr: string; bl: string }
  fit: 'fill' | 'whole'
  bg: string
  /** Texto superpuesto (PNG transparente) para ver cómo quedará. */
  overlay: string | null
}

export function Preview({ kind, url, width, height, framing, onFraming, videoRef, playing, canPlay, onTogglePlay, tags, overlay, fit, bg }: Props) {
  const { t } = useT()
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(354)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize(el.clientWidth))
    ro.observe(el)
    setSize(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const side = Math.min(width, height) / framing.zoom
  const scale = size / side
  const style = {
    width: width * scale,
    height: height * scale,
    left: size / 2 - framing.cx * scale,
    top: size / 2 - framing.cy * scale,
  }

  const whole = fit === 'whole'
  const place = (s: number) => ({ width: width * s, height: height * s, left: (size - width * s) / 2, top: (size - height * s) / 2 })
  const mainStyle = whole ? place(size / Math.max(width, height)) : style
  const blurStyle = { ...place(size / Math.min(width, height)), filter: 'blur(14px)', transform: 'scale(1.15)' }
  const bgVideo = useRef<HTMLVideoElement>(null)

  // El fondo borroso de un video es una copia muda que sigue al video principal.
  const wantBlur = whole && bg === 'blur'
  useEffect(() => {
    if (!wantBlur || kind !== 'video') return
    let raf = 0
    const tick = () => {
      const m = videoRef.current
      const b = bgVideo.current
      if (m && b) {
        if (Math.abs(b.currentTime - m.currentTime) > 0.12) b.currentTime = m.currentTime
        if (m.paused !== b.paused) void (m.paused ? b.pause() : b.play().catch(() => {}))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [wantBlur, kind, videoRef])

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (whole) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, cx: framing.cx, cy: framing.cy }
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    onFraming(clampFraming({ zoom: framing.zoom, cx: d.cx - (e.clientX - d.x) / scale, cy: d.cy - (e.clientY - d.y) / scale }, width, height))
  }
  const up = () => {
    drag.current = null
  }

  return (
    <div className="stage" ref={box} style={whole && bg !== 'blur' ? { background: bg } : undefined}>
      {wantBlur && (kind === 'video' ? <video ref={bgVideo} src={url} muted playsInline preload="auto" style={blurStyle} aria-hidden="true" /> : <img src={url} alt="" draggable={false} style={blurStyle} />)}
      <div className={`stage-pan${whole ? ' still' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title={t('framingHint')}>
        {kind === 'video' ? (
          <video ref={videoRef} src={url} playsInline preload="auto" style={mainStyle} />
        ) : (
          <img src={url} alt="" draggable={false} style={mainStyle} />
        )}
      </div>
      {overlay && <img className="stage-overlay" src={overlay} alt="" draggable={false} />}
      <span className="tag tl">{tags.tl}</span>
      <span className="tag tr">{tags.tr}</span>
      <span className="tag bl">{tags.bl}</span>
      <button type="button" className="play" onClick={onTogglePlay} disabled={!canPlay} aria-label={playing ? t('pause') : t('play')}>
        <i className={playing ? 'pause' : 'tri'} />
      </button>
    </div>
  )
}
