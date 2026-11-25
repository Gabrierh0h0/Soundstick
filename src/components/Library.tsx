import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { listStickers, removeSticker, type Sticker } from '../lib/library'
import { download, shareFile } from '../lib/share'

export function Library() {
  const { t } = useT()
  const [items, setItems] = useState<Sticker[] | null>(null)
  const [sure, setSure] = useState<string | null>(null)

  useEffect(() => {
    void listStickers().then(setItems)
  }, [])

  const urls = useMemo(() => new Map((items ?? []).map((s) => [s.id, URL.createObjectURL(s.blob)])), [items])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  async function remove(id: string) {
    if (sure !== id) return setSure(id)
    await removeSticker(id)
    setSure(null)
    setItems((all) => (all ?? []).filter((s) => s.id !== id))
  }

  function toggle(e: React.MouseEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    if (v.paused) void v.play()
    else v.pause()
  }

  if (!items) return null
  if (!items.length) return <p className="empty">{t('libEmpty')}</p>

  return (
    <ul className="lib">
      {items.map((s) => (
        <li key={s.id}>
          {/* #t=0.1 hace que el navegador pinte un fotograma como portada. */}
          <video src={`${urls.get(s.id)}#t=0.1`} playsInline loop preload="metadata" onClick={toggle} />
          <div className="lib-actions">
            <button type="button" onClick={() => void shareFile(s.blob).then((r) => r === 'unsupported' && download(s.blob))}>{t('libShare')}</button>
            <button type="button" onClick={() => download(s.blob)}>{t('libDownload')}</button>
            <button type="button" className={sure === s.id ? 'sure' : ''} onClick={() => void remove(s.id)} onBlur={() => setSure(null)}>
              {sure === s.id ? t('libSure') : t('libDelete')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
