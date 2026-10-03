import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import './buzzer.css'
import { SPRING, teamStyle } from '../lib/motion'
import { useGame } from '../store'
import { buzzerStore, useBuzzer } from '.'
import type { TokenOwner } from './types'

type View = 'waiting' | 'ready' | 'ours' | 'theirs' | 'excluded'

/** Buzzer-Handy eines Teams, geöffnet über den QR-Code `#/buzz/<code>`. */
export default function TeamPhone({ token }: { token: string }) {
  const [owner, setOwner] = useState<TokenOwner | null | undefined>(undefined)
  const game = useGame()
  const data = useBuzzer()
  const [pressedAt, setPressedAt] = useState<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const vibratedFor = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void buzzerStore.resolveToken(token).then((o) => {
      if (!cancelled) setOwner(o)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!owner) return
    return buzzerStore.connect(owner)
  }, [owner])

  // Bildschirm anlassen; nach dem Zurückkehren in den Tab neu anfordern
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wakeLock.current?.released) void requestWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function requestWakeLock() {
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      // nicht unterstützt oder abgelehnt – dann eben ohne
    }
  }

  const buzzer = owner ? data[owner.mode] : null
  const state = owner ? game.byMode[owner.mode] : null
  const team = state?.teams.find((t) => t.id === owner?.teamId)

  let view: View = 'waiting'
  if (buzzer && team) {
    if (!buzzer.armed) view = 'waiting'
    else if (buzzer.status === 'locked') view = buzzer.buzzedTeamId === team.id ? 'ours' : 'theirs'
    else if (buzzer.excludedTeamIds.includes(team.id)) view = 'excluded'
    else view = 'ready'
  }

  // kurzes Vibrieren, wenn wir die Ersten waren
  useEffect(() => {
    if (view !== 'ours' || !buzzer?.buzzedAt || vibratedFor.current === buzzer.buzzedAt) return
    vibratedFor.current = buzzer.buzzedAt
    navigator.vibrate?.([80, 40, 160])
  }, [view, buzzer?.buzzedAt])

  if (owner === undefined || !game.ready || (owner && !data.ready)) {
    return <div className="phone phone-message">Verbinde…</div>
  }
  if (owner === null) {
    return <div className="phone phone-message">Code ungültig – frag den Host nach einem neuen QR-Code</div>
  }
  if (!team || !buzzer || !state) {
    return <div className="phone phone-message">Dieses Team gibt es nicht mehr – frag den Host nach einem neuen QR-Code</div>
  }

  const other = state.teams.find((t) => t.id === buzzer.buzzedTeamId)
  const ranking = [...state.teams].sort((a, b) => (buzzer.roundScores[b.id] ?? 0) - (buzzer.roundScores[a.id] ?? 0))
  // Tipp-Feedback, bis der Server antwortet
  const pressing = view === 'ready' && pressedAt !== null

  const press = () => {
    if (!wakeLock.current || wakeLock.current.released) void requestWakeLock()
    if (view !== 'ready') return
    setPressedAt(Date.now())
    navigator.vibrate?.(30)
    void buzzerStore.buzz(token).finally(() => setPressedAt(null))
  }

  return (
    <div className={`phone view-${view}`} style={teamStyle(team.color)}>
      <header className="phone-head">
        <div className="phone-team">{team.name}</div>
        <div className="phone-scores">
          {ranking.map((t) => (
            <motion.span key={t.id} layout transition={SPRING} className={t.id === team.id ? 'me' : ''} style={teamStyle(t.color)}>
              {t.name} <b>{buzzer.roundScores[t.id] ?? 0}</b>
            </motion.span>
          ))}
        </div>
      </header>

      <main className="phone-main" onPointerDown={press}>
        <AnimatePresence mode="wait">
          {view === 'ready' ? (
            <motion.button
              key="button"
              className="buzz-button"
              aria-label="Buzzern"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: pressing ? 0.9 : 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              Buzz
            </motion.button>
          ) : (
            <motion.div
              key={view}
              className="phone-state"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={SPRING}
            >
              {view === 'ours' && (
                <>
                  <b>Ihr seid dran</b>
                  <span>Antwort geben!</span>
                </>
              )}
              {view === 'theirs' && (
                <>
                  <b>Zu langsam</b>
                  <span>{other?.name ?? 'Ein anderes Team'} war schneller</span>
                </>
              )}
              {view === 'excluded' && (
                <>
                  <b>Gesperrt</b>
                  <span>für diese Frage</span>
                </>
              )}
              {view === 'waiting' && (
                <>
                  <b>Bereit machen</b>
                  <span>Warten auf die nächste Frage</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer className="phone-foot">Frage {buzzer.question}</footer>
    </div>
  )
}
