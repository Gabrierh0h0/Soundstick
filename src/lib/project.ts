export type Mode = 'video' | 'videoAudio' | 'imageAudio' | 'voice'

/** Lo que se ve: un video (con o sin su sonido) o una imagen fija. */
export type Visual = { kind: 'video' | 'image'; file: File; url: string; width: number; height: number; duration: number }

/** Sonido aparte: un archivo subido o una grabación de voz. */
export type AudioClip = { kind: 'file' | 'voice'; file: File; url: string; duration: number; peaks: number[] }

export type TextPos = 'top' | 'center' | 'bottom'

export type Effects = {
  speed: number
  fade: number
  /** Volumen del sonido original del video (0-1.5). */
  volOrig: number
  /** Volumen del audio añadido o de la voz (0-1.5). */
  volAdd: number
  text: string
  textPos: TextPos
  textColor: string
  textSize: number
  /** 'fill' llena el cuadrado recortando; 'whole' muestra todo y rellena lo que sobra. */
  fit: 'fill' | 'whole'
  /** Relleno cuando fit es 'whole': 'blur' (el mismo contenido borroso) o un color. */
  bg: string
}

export const DEFAULT_FX: Effects = {
  speed: 1,
  fade: 0,
  volOrig: 1,
  volAdd: 1,
  text: '',
  textPos: 'bottom',
  textColor: '#ffffff',
  textSize: 64,
  fit: 'fill',
  bg: 'blur',
}

export const needsAudio = (m: Mode) => m !== 'video'
export const wantsVideoOnly = (m: Mode) => m === 'video' || m === 'videoAudio'
export const wantsImageOnly = (m: Mode) => m === 'imageAudio'

/** Al cambiar de modo, el sonido original solo se conserva cuando no hay audio que lo reemplace. */
export const defaultOrigVolume = (m: Mode) => (m === 'video' ? 1 : 0)

export const BG_COLORS = ['#000000', '#ffffff', '#9ccc00', '#00aeef', '#e3008c', '#ffd400'] as const
export const TEXT_COLORS = ['#ffffff', '#9ccc00', '#00aeef', '#e3008c', '#ffd400'] as const
