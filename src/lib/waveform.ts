/** Picos de volumen (0-1) del audio de un archivo; null si el navegador no puede decodificarlo. */
export async function readPeaks(file: File, bars: number): Promise<number[] | null> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  try {
    const audio = await ctx.decodeAudioData(await file.arrayBuffer())
    const data = audio.getChannelData(0)
    const block = Math.max(1, Math.floor(data.length / bars))
    const peaks: number[] = []
    for (let i = 0; i < bars; i++) {
      let max = 0
      const end = Math.min(data.length, (i + 1) * block)
      for (let j = i * block; j < end; j += 8) max = Math.max(max, Math.abs(data[j]))
      peaks.push(max)
    }
    const top = Math.max(...peaks, 0.001)
    return peaks.map((p) => Math.max(0.06, p / top))
  } catch {
    return null
  } finally {
    ctx.close().catch(() => {})
  }
}
