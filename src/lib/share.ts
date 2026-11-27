import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const toFile = (blob: Blob, name = 'soundstick.mp4') => new File([blob], name, { type: 'video/mp4' })

const isNative = () => Capacitor.isNativePlatform()

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** En la app Android no existen las descargas ni Web Share con archivos: se escribe en caché y se abre el menú Compartir. */
async function nativeShare(blob: Blob, name: string): Promise<'shared' | 'unsupported'> {
  try {
    const written = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache })
    await Share.share({ files: [written.uri] })
    return 'shared'
  } catch (e) {
    // Cancelar el menú Compartir no es un error.
    return /cancel/i.test(String((e as Error)?.message)) ? 'shared' : 'unsupported'
  }
}

export function download(blob: Blob, name = 'soundstick.mp4') {
  if (isNative()) {
    void nativeShare(blob, name)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ShareResult = 'shared' | 'unsupported' | 'needs-tap'

/**
 * Abre el menu Compartir del sistema con el archivo.
 * 'needs-tap': el navegador exige un toque reciente y la exportacion tardo demasiado; hay que tocar otra vez.
 */
export async function shareFile(blob: Blob): Promise<ShareResult> {
  if (isNative()) return nativeShare(blob, 'soundstick.mp4')
  const file = toFile(blob)
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (e) {
    const name = (e as DOMException).name
    if (name === 'AbortError') return 'shared'
    if (name === 'NotAllowedError') return 'needs-tap'
    return 'unsupported'
  }
}
