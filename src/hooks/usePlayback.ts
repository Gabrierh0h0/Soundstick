import { useCallback, useEffect, useState, type RefObject } from 'react'

type Window = { start: number; end: number }

type Args = {
  hasVideo: boolean
  hasAudio: boolean
  vWin: Window
  aWin: Window
  speed: number
  volOrig: number
  volAdd: number
  videoRef: RefObject<HTMLVideoElement | null>
  audioRef: RefObject<HTMLAudioElement | null>
  /** Cambia cuando se cargan otros medios, para volver a enganchar los elementos. */
  mediaKey: string
}

/**
 * Previsualiza el tramo elegido: el video (si hay) manda el bucle; si no, el audio.
 * Aplica velocidad y volúmenes en vivo; los fundidos solo se oyen en el archivo final.
 */
export function usePlayback({ hasVideo, hasAudio, vWin, aWin, speed, volOrig, volAdd, videoRef, audioRef, mediaKey }: Args) {
  const [playing, setPlaying] = useState(false)
  const [timeV, setTimeV] = useState(0)
  const [timeA, setTimeA] = useState(0)

  const master = useCallback(() => (hasVideo ? videoRef.current : audioRef.current), [hasVideo, videoRef, audioRef])

  // Velocidad y volumen en vivo.
  useEffect(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (v) {
      v.playbackRate = speed
      v.volume = Math.min(1, volOrig)
      v.muted = volOrig === 0
    }
    if (a) {
      a.playbackRate = speed
      a.volume = Math.min(1, volAdd)
    }
  }, [speed, volOrig, volAdd, videoRef, audioRef, mediaKey, playing])

  // Estado de reproducción según el elemento que manda.
  useEffect(() => {
    const m = master()
    if (!m) return
    const on = () => setPlaying(true)
    const off = () => setPlaying(false)
    m.addEventListener('play', on)
    m.addEventListener('pause', off)
    m.addEventListener('ended', off)
    return () => {
      m.removeEventListener('play', on)
      m.removeEventListener('pause', off)
      m.removeEventListener('ended', off)
    }
  }, [master, mediaKey])

  // Bucle del tramo y línea de avance, con precisión de fotograma.
  useEffect(() => {
    if (!playing) return
    let id = 0
    const step = () => {
      const v = videoRef.current
      const a = audioRef.current
      if (v) setTimeV(v.currentTime)
      if (a) setTimeA(a.currentTime)
      const mainEnd = hasVideo ? (v?.currentTime ?? 0) >= vWin.end - 0.04 : (a?.currentTime ?? 0) >= aWin.end - 0.04
      if (mainEnd) {
        if (v && hasVideo) v.currentTime = vWin.start
        if (a && hasAudio) {
          a.currentTime = aWin.start
          void a.play().catch(() => {})
        }
      } else if (a && hasVideo && a.currentTime >= aWin.end) a.pause()
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [playing, hasVideo, hasAudio, vWin.start, vWin.end, aWin.start, aWin.end, videoRef, audioRef])

  const toggle = useCallback(() => {
    const v = videoRef.current
    const a = audioRef.current
    const m = master()
    if (!m) return
    if (!m.paused) {
      v?.pause()
      a?.pause()
      return
    }
    if (v && hasVideo && (v.currentTime < vWin.start || v.currentTime >= vWin.end)) v.currentTime = vWin.start
    if (a && hasAudio && (a.currentTime < aWin.start || a.currentTime >= aWin.end)) a.currentTime = aWin.start
    void v?.play().catch(() => {})
    void a?.play().catch(() => {})
  }, [master, videoRef, audioRef, hasVideo, hasAudio, vWin.start, vWin.end, aWin.start, aWin.end])

  const pause = useCallback(() => {
    videoRef.current?.pause()
    audioRef.current?.pause()
  }, [videoRef, audioRef])

  /** Salta a un instante (solo con la reproducción en pausa) para ver el cuadro del recorte. */
  const seek = useCallback((which: 'video' | 'audio', t: number) => {
    const el = which === 'video' ? videoRef.current : audioRef.current
    if (el && el.paused) el.currentTime = t
  }, [videoRef, audioRef])

  return { playing, timeV, timeA, toggle, pause, seek }
}
