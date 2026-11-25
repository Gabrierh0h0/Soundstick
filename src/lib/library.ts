import { createStore, del, entries, set } from 'idb-keyval'

export type Sticker = { id: string; blob: Blob; seconds: number; createdAt: number }

const store = createStore('soundstick', 'stickers')

export async function saveSticker(blob: Blob, seconds: number): Promise<Sticker> {
  const s: Sticker = { id: crypto.randomUUID(), blob, seconds, createdAt: Date.now() }
  await set(s.id, s, store)
  return s
}

export async function listStickers(): Promise<Sticker[]> {
  const all = await entries<string, Sticker>(store)
  return all.map(([, v]) => v).sort((a, b) => b.createdAt - a.createdAt)
}

export const removeSticker = (id: string) => del(id, store)
