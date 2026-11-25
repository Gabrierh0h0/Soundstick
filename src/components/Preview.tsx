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
  label: string
  /** Texto superpuesto (PNG transparente) para ver cómo quedará. */
  overlay: string | null
}

export function Preview({ kind, url, width, height, framing, onFraming, videoRef, playing, canPlay, onTogglePlay, label, overlay }: Props) {
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

  const down = (e: PointerEvent<HTMLDivElement>) => {
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
    <div className="stage" ref={box}>
      <div className="stage-pan" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title={t('framingHint')}>
        {kind === 'video' ? (
          <video ref={videoRef} src={url} playsInline preload="auto" style={style} />
        ) : (
          <img src={url} alt="" draggable={false} style={style} />
        )}
      </div>
      {overlay && <img className="stage-overlay" src={overlay} alt="" draggable={false} />}
      <span className="stage-label">{label}</span>
      <button type="button" className="play" onClick={onTogglePlay} disabled={!canPlay} aria-label={playing ? t('pause') : t('play')}>
        <i className={playing ? 'pause' : 'tri'} />
      </button>
    </div>
  )
}
