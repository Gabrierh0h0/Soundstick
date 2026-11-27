export type Mode = 'video' | 'videoAudio' | 'imageAudio' | 'voice'

/** Lo que se ve: un video (con o sin su sonido) o una imagen fija. */
export type Visual = { kind: 'video' | 'image'; file: File; url: string; width: number; height: number; duration: number }

/** Sonido aparte: un archivo subido o una grabación de voz. */
export type AudioClip = { kind: 'file' | 'voice'; file: File; url: string; duration: number; peaks: number[] }

export type TextPos = 'top' | 'center' | 'bottom'

/** Formas del sticker dentro del lienzo de 512x512; lo que sobra queda transparente (o con el fondo elegido). */
export type Shape = 'square' | 'wide' | 'tall' | 'photo' | 'portrait'
export const SHAPES: { id: Shape; w: number; h: number; ratio: string }[] = [
  { id: 'square', w: 512, h: 512, ratio: '1:1' },
  { id: 'wide', w: 512, h: 288, ratio: '16:9' },
  { id: 'tall', w: 288, h: 512, ratio: '9:16' },
  { id: 'photo', w: 512, h: 384, ratio: '4:3' },
  { id: 'portrait', w: 384, h: 512, ratio: '3:4' },
]
/** Medidas de la caja donde cae la imagen dentro del lienzo. */
export const boxOf = (shape: Shape) => SHAPES.find((s) => s.id === shape) ?? SHAPES[0]

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
  /** Forma del sticker dentro del lienzo cuadrado. */
  shape: Shape
  /** 'fill' llena la forma recortando; 'whole' muestra todo y deja el sobrante. */
  fit: 'fill' | 'whole'
  /** Lo que rodea la imagen: 'transparent', 'blur' (el mismo contenido borroso) o un color. */
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
  shape: 'square',
  fit: 'fill',
  bg: 'transparent',
}

export const needsAudio = (m: Mode) => m !== 'video'
export const wantsVideoOnly = (m: Mode) => m === 'video' || m === 'videoAudio'
export const wantsImageOnly = (m: Mode) => m === 'imageAudio'

/** Al cambiar de modo, el sonido original solo se conserva cuando no hay audio que lo reemplace. */
export const defaultOrigVolume = (m: Mode) => (m === 'video' ? 1 : 0)

export const BG_COLORS = ['#000000', '#ffffff', '#9ccc00', '#00aeef', '#e3008c', '#ffd400'] as const
export const TEXT_COLORS = ['#ffffff', '#9ccc00', '#00aeef', '#e3008c', '#ffd400'] as const
