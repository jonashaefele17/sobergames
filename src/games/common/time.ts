import { useEffect, useState } from 'react'
import { syncedNow } from '../../lib/clock'

/** mm:ss, ohne Vorzeichen */
export function formatClock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Stoppuhr-Anzeige: s,hh bzw. m:ss,hh */
export function formatStopwatch(ms: number): string {
  const cs = Math.floor(Math.max(0, ms) / 10)
  const seconds = Math.floor(cs / 100)
  const rest = `${String(seconds % 60).padStart(seconds >= 60 ? 2 : 1, '0')},${String(cs % 100).padStart(2, '0')}`
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${rest}` : rest
}

/** aktuelle Zeit der gemeinsamen Uhr, die sich laufend aktualisiert */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => syncedNow())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(syncedNow()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, active])
  return now
}
