import { Capacitor } from '@capacitor/core'

export const APP_VERSION = __APP_VERSION__
export const APK_URL = 'https://github.com/Gabrierh0h0/Soundstick/releases/latest/download/soundstick.apk'
const VERSION_URL = 'https://soundstick.vercel.app/version.json'

export type Update = { version: string; url: string; notes: string }

/** true si `a` es una versión posterior a `b` (formato 1.2.3). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** Consulta si hay una versión nueva. Solo en la app Android; cualquier fallo se ignora. */
export async function checkUpdate(): Promise<Update | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const r = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as Partial<Update>
    if (typeof j.version !== 'string' || !isNewer(j.version, APP_VERSION)) return null
    return { version: j.version, url: typeof j.url === 'string' && j.url.startsWith('https://') ? j.url : APK_URL, notes: j.notes ?? '' }
  } catch {
    return null
  }
}
