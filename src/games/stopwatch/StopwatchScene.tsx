import { AnimatePresence, motion } from 'motion/react'
import './stopwatch.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { gameName } from '../catalog'
import { TitleCard } from '../common/TitleCard'
import { formatStopwatch, useNow } from '../common/time'
import { stopwatchData } from './logic'

/** Stoppuhr auf dem Beamer: laufende Zeit groß, daneben die gestoppten Zeiten aller Teams. */
export default function StopwatchScene({ state, game }: { state: State; game: Game }) {
  const data = stopwatchData(state)
  const now = useNow(40, data.running !== null)
  const active = state.teams.find((t) => t.id === data.running?.teamId)
  const timed = state.teams.filter((t) => data.times[t.id] !== undefined).sort((a, b) => data.times[a.id] - data.times[b.id])
  const waiting = state.teams.filter((t) => data.times[t.id] === undefined && t.id !== active?.id)
  const started = active !== undefined || timed.length > 0
  // zuletzt gestoppte Zeit groß zeigen, solange niemand läuft
  const best = timed[0]

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {!started ? (
            <TitleCard key="title" state={state} game={game} />
          ) : (
            <motion.div
              key="watch"
              className="stopwatch"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <div className="sw-main" style={teamStyle(active?.color ?? best?.color ?? '#e8b923')}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active?.id ?? 'idle'}
                    className="sw-who"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                  >
                    {active ? active.name : best ? `Bestzeit: ${best.name}` : ''}
                  </motion.div>
                </AnimatePresence>
                <div className={`sw-clock${active ? ' running' : ''}`}>
                  {formatStopwatch(active ? now - data.running!.startedAt : best ? data.times[best.id] : 0)}
                </div>
              </div>
              <div className="sw-list">
                {timed.map((t, i) => (
                  <motion.div key={t.id} layout transition={SPRING} className={`sw-row${i === 0 ? ' best' : ''}`} style={teamStyle(t.color)}>
                    <span className="rank">{i + 1}</span>
                    <span className="tname">{t.name}</span>
                    <span className="time">{formatStopwatch(data.times[t.id])}</span>
                  </motion.div>
                ))}
                {waiting.map((t) => (
                  <motion.div key={t.id} layout transition={SPRING} className="sw-row waiting" style={teamStyle(t.color)}>
                    <span className="rank">–</span>
                    <span className="tname">{t.name}</span>
                    <span className="time">–</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
