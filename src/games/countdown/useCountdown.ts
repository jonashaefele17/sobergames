import { useEffect, useRef } from 'react'
import * as act from '../../lib/actions'
import { finishSound, heartbeat } from '../../lib/sound'
import type { Timer } from '../../store/types'
import { useNow } from '../common/time'

/** Ab so vielen Restsekunden pocht es und die Uhr pulsiert rot. */
export const LAST_SECONDS = 10

/**
 * Restzeit des Countdowns in ganzen Sekunden auf der gemeinsamen Uhr. Spielt
 * dabei Pochen und Schlusston – aber nur für Sekunden, die diese Ansicht live
 * herunterzählt, und nur wenn der Ton in diesem Fenster an ist.
 */
export function useCountdown(timer: Timer) {
  const running = timer.startedAt !== null
  const now = useNow(100, running)
  const left = timer.durationMs - act.timerElapsed(timer, now)
  const seconds = Math.max(0, Math.ceil(left / 1000))
  const started = running || timer.elapsedMs > 0

  const lastSecond = useRef(seconds)
  useEffect(() => {
    if (seconds === lastSecond.current) return
    const previous = lastSecond.current
    lastSecond.current = seconds
    if (!running || seconds > previous) return
    if (seconds === 0) finishSound()
    else if (seconds <= LAST_SECONDS) heartbeat(seconds)
  }, [seconds, running])

  return { seconds, started, running, over: started && left <= 0, last: started && left > 0 && seconds <= LAST_SECONDS }
}
