import { audioContext } from '../../lib/sound'

// Spielt Song-Schnipsel exakt auf die Länge geschnitten ab (Web Audio), damit
// auch 0,1 s sauber kommen. Läuft im Beamer-Fenster; der Ton muss dort wie bei
// allen Tönen einmal per Klick oder Taste freigegeben sein.

const files = new Map<string, Promise<ArrayBuffer>>()
const decoded = new Map<string, Promise<{ audio: AudioBuffer; lead: number }>>()
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

/**
 * Index des ersten hörbaren Samples über alle Kanäle; 0, wenn alles still ist.
 * MP3s beginnen oft mit einigen Zehntelsekunden Stille – die kurzen Stufen
 * wären sonst stumm.
 */
export function firstSound(channels: ArrayLike<number>[], threshold = 0.01): number {
  const length = Math.min(...channels.map((c) => c.length))
  for (let i = 0; i < length; i++) {
    for (const c of channels) {
      if (Math.abs(c[i]) >= threshold) return i
    }
  }
  return 0
}

async function buffer(ctx: AudioContext, url: string) {
  if (!decoded.has(url)) {
    decoded.set(
      url,
      preload(url)
        // decodeAudioData verbraucht den Puffer, deshalb eine Kopie
        .then((data) => ctx.decodeAudioData(data.slice(0)))
        .then((audio) => {
          const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
          return { audio, lead: firstSound(channels) / audio.sampleRate }
        }),
    )
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
 * Spielt ab `offset` Sekunden nach dem ersten hörbaren Ton. Mit `duration` endet der Schnipsel exakt nach
 * dieser Länge, ohne läuft der Song bis zum Ende oder bis stop().
 * Gibt false zurück, wenn der Ton in diesem Fenster noch aus ist.
 */
export async function play(url: string, offset: number, duration?: number): Promise<boolean> {
  const ctx = audioContext()
  if (!ctx) return false
  const { audio, lead } = await buffer(ctx, url)
  stop()
  const source = ctx.createBufferSource()
  source.buffer = audio
  source.connect(ctx.destination)
  const from = Math.min(lead + Math.max(0, offset), Math.max(0, audio.duration - 0.05))
  if (duration === undefined) source.start(0, from)
  else source.start(0, from, duration)
  current = source
  source.onended = () => {
    if (current === source) current = null
  }
  return true
}
