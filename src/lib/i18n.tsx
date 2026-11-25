import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'

const dict = {
  es: {
    navCreate: 'crear', navLibrary: 'biblioteca', navHelp: 'ayuda',
    pickVideo: 'elige un video', pickHint: 'hasta {mb} MB · se recorta a {s} s',
    srcVideo: 'video + sonido', srcVideoAudio: 'video + audio', srcImageAudio: 'imagen + audio', srcVoice: 'voz', soon: 'pronto',
    framingHint: 'arrastra el video para moverlo', zoom: 'zoom',
    play: 'reproducir', pause: 'pausar',
    trimFrom: 'inicio', trimTo: 'fin',
    trimLen: '{len} s de {max} s', fileSize: '{mb} de {max} MB', noWave: 'sin onda de audio',
    save: 'guardar mp4', share: 'compartir a whatsapp', changeVideo: 'otro video',
    loadingEngine: 'preparando el editor…', exporting: 'exportando {p}%',
    saved: 'listo · {mb} MB · guardado en tu biblioteca', savedNext: 'ver pasos en whatsapp',
    shareFallback: 'Este navegador no puede compartir archivos. Lo descargué para que lo envíes a mano.',
    shareAgain: 'Listo. Toca compartir otra vez para abrir WhatsApp.',
    shareNow: 'toca para compartir',
    errType: 'Ese archivo no es un video.', errSize: 'Pesa {mb} MB; el máximo es {max} MB.',
    errDecode: 'Tu navegador no puede leer este video. Prueba con un MP4.', errExport: 'No pude exportar este clip. Prueba con uno más corto.',
    libEmpty: 'Aún no hay stickers. Los que guardes aparecen aquí, solo en este dispositivo.',
    libShare: 'compartir', libDownload: 'descargar', libDelete: 'borrar', libSure: '¿seguro?',
    helpTitle: 'cómo llega a whatsapp',
    helpStep1: 'Crea y guarda tu sticker aquí: sale un MP4 cuadrado de 512×512, de hasta 10 s, con su sonido.',
    helpStep2: 'Abre WhatsApp, entra al teclado de stickers y toca Crear sticker.',
    helpStep3: 'Elige el video guardado. En el editor, deja el audio original con el botón de audio y envía.',
    helpNote: 'Los stickers con sonido se están activando poco a poco en WhatsApp. Empezaron en Android; si no ves el botón de audio, aún no te llega.',
    helpPrivacyTitle: 'tus archivos',
    helpPrivacy: 'Todo se procesa en tu dispositivo. Nada se sube a ningún servidor.',
    helpLimits: 'Límites: video hasta {mb} MB, clip final hasta {s} s.',
  },
  en: {
    navCreate: 'create', navLibrary: 'library', navHelp: 'help',
    pickVideo: 'pick a video', pickHint: 'up to {mb} MB · trimmed to {s} s',
    srcVideo: 'video + sound', srcVideoAudio: 'video + audio', srcImageAudio: 'image + audio', srcVoice: 'voice', soon: 'soon',
    framingHint: 'drag the video to move it', zoom: 'zoom',
    play: 'play', pause: 'pause',
    trimFrom: 'start', trimTo: 'end',
    trimLen: '{len} s of {max} s', fileSize: '{mb} of {max} MB', noWave: 'no audio waveform',
    save: 'save mp4', share: 'share to whatsapp', changeVideo: 'other video',
    loadingEngine: 'getting the editor ready…', exporting: 'exporting {p}%',
    saved: 'done · {mb} MB · saved to your library', savedNext: 'steps in whatsapp',
    shareFallback: "This browser can't share files. I downloaded it so you can send it by hand.",
    shareAgain: 'Ready. Tap share again to open WhatsApp.',
    shareNow: 'tap to share',
    errType: "That file isn't a video.", errSize: 'It is {mb} MB; the maximum is {max} MB.',
    errDecode: "Your browser can't read this video. Try an MP4.", errExport: "I couldn't export this clip. Try a shorter one.",
    libEmpty: 'No stickers yet. The ones you save show up here, on this device only.',
    libShare: 'share', libDownload: 'download', libDelete: 'delete', libSure: 'sure?',
    helpTitle: 'getting it into whatsapp',
    helpStep1: 'Make and save your sticker here: you get a square 512×512 MP4, up to 10 s, with its sound.',
    helpStep2: 'Open WhatsApp, go to the sticker keyboard and tap Create sticker.',
    helpStep3: 'Pick the saved video. In the editor, keep the original audio with the audio button and send.',
    helpNote: 'Sound stickers are rolling out gradually in WhatsApp. They started on Android; if you do not see the audio button, it has not reached you yet.',
    helpPrivacyTitle: 'your files',
    helpPrivacy: 'Everything is processed on your device. Nothing is uploaded to any server.',
    helpLimits: 'Limits: video up to {mb} MB, final clip up to {s} s.',
  },
} as const

export type Key = keyof (typeof dict)['es']
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string }

const I18n = createContext<Ctx | null>(null)

function initialLang(): Lang {
  const saved = localStorage.getItem('lang')
  const lang: Lang = saved === 'es' || saved === 'en' ? saved : navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
  document.documentElement.lang = lang
  return lang
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('lang', l)
    document.documentElement.lang = l
    setLangState(l)
  }, [])
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (k, vars) => dict[lang][k].replace(/\{(\w+)\}/g, (_, n: string) => String(vars?.[n] ?? '')),
    }),
    [lang, setLang],
  )
  return <I18n.Provider value={value}>{children}</I18n.Provider>
}

export function useT() {
  const c = useContext(I18n)
  if (!c) throw new Error('I18nProvider missing')
  return c
}
