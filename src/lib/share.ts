export const toFile = (blob: Blob, name = 'soundstick.mp4') => new File([blob], name, { type: 'video/mp4' })

export function download(blob: Blob, name = 'soundstick.mp4') {
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
