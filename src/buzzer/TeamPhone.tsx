import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import './buzzer.css'
import { gameKind } from '../games/catalog'
import EstimatePhone from '../games/estimate/EstimatePhone'
import { SPRING, teamStyle } from '../lib/motion'
import { useGame } from '../store'
import { buzzerStore, useBuzzer } from '.'

type View = 'waiting' | 'ready' | 'ours' | 'theirs' | 'excluded'

/** Buzzer-Handy eines Teams, geöffnet über den QR-Code `#/buzz/<code>`. */
export default function TeamPhone({ token }: { token: string }) {
  const [teamId, setTeamId] = useState<string | null | undefined>(undefined)
  const game = useGame()
  const data = useBuzzer()
  const [pressedAt, setPressedAt] = useState<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const vibratedFor = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void buzzerStore.resolveToken(token).then((id) => {
      if (!cancelled) setTeamId(id)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!teamId) return
    return buzzerStore.connect(teamId)
  }, [teamId])

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

  const buzzer = data.state
  const state = game.state
  const team = state.teams.find((t) => t.id === teamId)

  let view: View = 'waiting'
  if (team) {
    if (!buzzer.armed) view = 'waiting'
    else if (buzzer.status === 'locked') view = buzzer.buzzedTeamId === team.id ? 'ours' : 'theirs'
    else if (buzzer.excludedTeamIds.includes(team.id)) view = 'excluded'
    else view = 'ready'
  }

  // kurzes Vibrieren, wenn wir die Ersten waren
  useEffect(() => {
    if (view !== 'ours' || !buzzer.buzzedAt || vibratedFor.current === buzzer.buzzedAt) return
    vibratedFor.current = buzzer.buzzedAt
    navigator.vibrate?.([80, 40, 160])
  }, [view, buzzer.buzzedAt])

  if (teamId === undefined || !game.ready || (teamId && !data.ready)) {
    return <div className="phone phone-message">Verbinde…</div>
  }
  if (teamId === null) {
    return <div className="phone phone-message">Code ungültig – frag den Host nach einem neuen QR-Code</div>
  }
  if (!team) {
    return <div className="phone phone-message">Dieses Team gibt es nicht mehr – frag den Host nach einem neuen QR-Code</div>
  }

  // bei Schätzfragen zeigt das Handy die Zahleneingabe statt des Buzzers
  const playing = state.scene === 'play' ? state.games.find((g) => g.id === state.play.gameId) : undefined
  if (playing && gameKind(playing) === 'estimate') {
    return <EstimatePhone token={token} team={team} state={state} open={buzzer.armed} />
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
