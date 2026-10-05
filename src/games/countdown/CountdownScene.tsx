import { AnimatePresence, motion } from 'motion/react'
import './countdown.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import { useSoundEnabled } from '../../lib/sound'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { formatClock } from '../common/time'
import { useCountdown } from './useCountdown'

/** Großer Countdown auf dem Beamer mit Pochen und Schlusston; danach die eingetragenen Werte je Team. */
export default function CountdownScene({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const { seconds, started, over, last } = useCountdown(state.play.timer)
  const sound = useSoundEnabled()
  const values = state.play.data.values ?? {}
  const ranked = state.teams.filter((t) => values[t.id] !== undefined).sort((a, b) => values[b.id] - values[a.id])

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={def.category} />
      <div className="scene-body">
        <div className="countdown">
          <motion.div
            className={`clock${over ? ' over' : last ? ' last' : ''}`}
            animate={last ? { scale: [1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            key={last ? seconds : 'steady'}
          >
            {over ? 'Zeit um' : formatClock(seconds * 1000)}
          </motion.div>
          {!started && <div className="sub">Gleich geht’s los</div>}
          <AnimatePresence>
            {ranked.length > 0 && (
              <motion.div className="values" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
                {ranked.map((t, i) => (
                  <motion.div key={t.id} layout transition={SPRING} className={`value${i === 0 ? ' best' : ''}`} style={teamStyle(t.color)}>
                    <span className="vname">{t.name}</span>
                    <span className="vnum">
                      {values[t.id].toLocaleString('de-DE')}
                      {def.unit && <small>{def.unit}</small>}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {!sound && !over && (
            <motion.div className="sound-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Ton aus – einmal klicken
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
