import { audioContext } from '../../lib/sound'

// Spielt Song-Schnipsel exakt auf die Länge geschnitten ab (Web Audio), damit
// auch 0,1 s sauber kommen. Läuft im Beamer-Fenster; der Ton muss dort wie bei
// allen Tönen einmal per Klick oder Taste freigegeben sein.

const files = new Map<string, Promise<ArrayBuffer>>()
const decoded = new Map<string, Promise<AudioBuffer>>()
let current: AudioBufferSourceNode | null = null

/** lädt die Datei schon beim Zeigen des Songs, damit der erste Schnipsel ohne Verzögerung startet */
export function preload(url: string) {
  if (!files.has(url)) {
    files.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Song konnte nicht geladen werden (${r.status})`)
        return r.arrayBuffer()
      }),
    )
  }
  return files.get(url)!
}

async function buffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  if (!decoded.has(url)) {
    // decodeAudioData verbraucht den Puffer, deshalb eine Kopie
    decoded.set(url, preload(url).then((data) => ctx.decodeAudioData(data.slice(0))))
  }
  return decoded.get(url)!
}

export function stop() {
  try {
    current?.stop()
  } catch {
    // lief schon nicht mehr
  }
  current = null
}

/**
 * Spielt ab `offset` Sekunden. Mit `duration` endet der Schnipsel exakt nach
 * dieser Länge, ohne läuft der Song bis zum Ende oder bis stop().
 * Gibt false zurück, wenn der Ton in diesem Fenster noch aus ist.
 */
export async function play(url: string, offset: number, duration?: number): Promise<boolean> {
  const ctx = audioContext()
  if (!ctx) return false
  const audio = await buffer(ctx, url)
  stop()
  const source = ctx.createBufferSource()
  source.buffer = audio
  source.connect(ctx.destination)
  const from = Math.min(Math.max(0, offset), Math.max(0, audio.duration - 0.05))
  if (duration === undefined) source.start(0, from)
  else source.start(0, from, duration)
  current = source
  source.onended = () => {
    if (current === source) current = null
  }
  return true
}
