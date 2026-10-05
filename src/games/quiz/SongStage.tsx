import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useBuzzer } from '../../buzzer'
import { useSoundEnabled } from '../../lib/sound'
import type { AudioCue } from '../../store/types'
import * as player from './songPlayer'

const fmt = (s: number) => `${s.toLocaleString('de-DE')} s`

/**
 * Song-Anzeige auf dem Beamer: Stufen wie bei Songless, Equalizer und
 * Fortschritt, solange ein Schnipsel läuft. Spielt die Auslöser des Regiepults
 * ab – aber nur die, die diese Ansicht live miterlebt.
 */
export function SongStage({ audio, stages }: { audio: AudioCue; stages: number[] }) {
  const sound = useSoundEnabled()
  const buzzed = useBuzzer().state.status === 'locked'
  const seen = useRef(audio.nonce)
  const [running, setRunning] = useState<{ nonce: number; duration: number | null } | null>(null)

  useEffect(() => {
    void player.preload(audio.url).catch(() => undefined)
  }, [audio.url])

  useEffect(() => {
    if (audio.nonce === seen.current) return
    seen.current = audio.nonce
    if (audio.play === 'stop') {
      player.stop()
      queueMicrotask(() => setRunning(null))
      return
    }
    const duration = audio.play === 'stage' ? (stages[audio.stage] ?? null) : null
    const nonce = audio.nonce
    void player
      .play(audio.url, audio.start, duration ?? undefined)
      .then((ok) => {
        if (ok && seen.current === nonce) setRunning({ nonce, duration })
      })
      .catch(() => undefined)
  }, [audio, stages])

  // Schnipsel ist zu Ende: Anzeige zurücksetzen
  useEffect(() => {
    if (!running || running.duration === null) return
    const id = window.setTimeout(() => setRunning((r) => (r?.nonce === running.nonce ? null : r)), running.duration * 1000)
    return () => window.clearTimeout(id)
  }, [running])

  // beim Buzz stoppt die Musik sofort
  useEffect(() => {
    if (!buzzed) return
    player.stop()
    queueMicrotask(() => setRunning(null))
  }, [buzzed])

  useEffect(() => () => player.stop(), [])

  return (
    <div className="song">
      <div className={`equalizer${running ? ' on' : ''}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${(i * 137) % 600}ms` }} />
        ))}
      </div>
      <div className="stages">
        {stages.map((s, i) => (
          <div key={i} className={`stage${i < audio.stage ? ' done' : i === audio.stage ? ' current' : ''}`}>
            <span className="len">{fmt(s)}</span>
            {i === audio.stage && running?.duration != null && (
              <motion.span
                key={running.nonce}
                className="fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: running.duration, ease: 'linear' }}
              />
            )}
          </div>
        ))}
      </div>
      <AnimatePresence>
        {!sound && (
          <motion.div className="sound-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Ton aus – einmal klicken
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
