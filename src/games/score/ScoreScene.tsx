import { AnimatePresence, motion } from 'motion/react'
import './score.css'
import { CountUp, SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { TitleCard } from '../common/TitleCard'
import { gameDef, gameName } from '../catalog'
import { hasEntries, reached, scoreData, teamShots, totals } from './logic'

const MAX_CHIPS = 14

/** Punktetafel auf dem Beamer: Stand je Team, Rundenverlauf und Fortschritt zum Ziel. */
export default function ScoreScene({ state, game }: { state: State; game: Game }) {
  const config = gameDef(game.id).score
  const data = scoreData(state)
  const teamIds = state.teams.map((t) => t.id)
  const sum = totals(data, teamIds)
  const shotMode = config?.mode === 'shots'
  const started = hasEntries(data)
  const done = reached(data, teamIds)
  const ranking = [...state.teams].sort((a, b) => sum[b.id] - sum[a.id])
  const max = Math.max(1, data.target ?? 0, ...Object.values(sum))
  const rounds = data.rounds.slice(-MAX_CHIPS)
  const offset = data.rounds.length - rounds.length
  const perRound = config?.mode === 'round' || config?.mode === 'free'
  // nur bei festen Punktknöpfen ist eine Buchung keine Runde
  const unit = config?.mode === 'steps' ? 'Buchung' : 'Runde'

  return (
    <div className="scene">
      <SceneHead
        title={gameName(game)}
        sub={
          shotMode
            ? `${data.shotCount} Versuche`
            : data.rounds.length
              ? `${unit} ${data.rounds.length}${data.target ? ` · Ziel ${data.target}` : ''}`
              : gameDef(game.id).category
        }
      />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {!started ? (
            <TitleCard key="title" state={state} game={game} sub={data.target ? `Wer zuerst ${data.target} Punkte hat` : undefined} />
          ) : (
            <motion.div
              key="board"
              className="score-board"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              {ranking.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  className={`score-row${done.includes(t.id) ? ' reached' : ''}`}
                  style={teamStyle(t.color)}
                >
                  <motion.div
                    className="bar"
                    initial={false}
                    animate={{ scaleX: 0.03 + 0.97 * (Math.max(0, sum[t.id]) / max) }}
                    transition={{ duration: 0.9, ease: EASE_OUT }}
                  />
                  <div className="info">
                    <div className="tname">
                      {t.name}
                      <AnimatePresence>
                        {done.includes(t.id) && (
                          <motion.span
                            className="race-chip"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={SPRING}
                          >
                            Gewonnen
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="chips">
                      {shotMode &&
                        teamShots(data, t.id).map((p, i) => (
                          <span key={i} className={`round-chip shot${p === null ? ' open' : p === 0 ? ' miss' : ''}`}>
                            {p === null ? '' : p}
                          </span>
                        ))}
                      {rounds.map((r, i) => {
                        const p = r.points[t.id] ?? 0
                        return (
                          <motion.span
                            key={r.id}
                            className={`round-chip${p === 0 ? ' zero' : p < 0 ? ' minus' : ''}`}
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={SPRING}
                            title={`Runde ${offset + i + 1}`}
                          >
                            {perRound ? p : p === 0 ? '·' : p > 0 ? `+${p}` : p}
                          </motion.span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="points">
                    <CountUp value={sum[t.id]} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
