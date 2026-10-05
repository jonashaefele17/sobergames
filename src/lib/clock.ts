import { supabase } from './supabaseClient'

// Gemeinsame Uhr: Jedes Gerät gleicht sich einmal mit dem Supabase-Server ab,
// damit Countdown und Stoppuhr überall dieselbe Zeit zeigen, auch wenn die
// Geräteuhren um Sekunden auseinandergehen.
let offset = 0

/** aktuelle Zeit in ms auf der gemeinsamen Uhr */
export const syncedNow = () => Date.now() + offset

export interface ClockSample {
  /** eigene Uhr beim Absenden und beim Eintreffen der Antwort */
  sent: number
  received: number
  /** Serverzeit aus der Antwort */
  server: number
}

/**
 * Abweichung der eigenen Uhr zur Serverzeit. Die Messung mit der kürzesten
 * Laufzeit ist die genaueste; die Antwort wird in der Mitte der Laufzeit verortet.
 */
export function clockOffset(samples: ClockSample[]): number {
  if (samples.length === 0) return 0
  const best = samples.reduce((a, b) => (b.received - b.sent < a.received - a.sent ? b : a))
  return best.server - (best.sent + best.received) / 2
}

/** Gleicht die Uhr ab; ohne Supabase oder bei Fehlern bleibt es bei der eigenen Uhr. */
export async function syncClock(): Promise<void> {
  if (!supabase) return
  const samples: ClockSample[] = []
  for (let i = 0; i < 3; i++) {
    const sent = Date.now()
    const { data, error } = await supabase.rpc('sobergames_now')
    const received = Date.now()
    if (!error && typeof data === 'number') samples.push({ sent, received, server: data })
  }
  if (samples.length) offset = clockOffset(samples)
}
