import { AnimatePresence, motion } from 'motion/react'
import './estimate.css'
import '../quiz/quiz.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { gameName } from '../catalog'
import { RoundBar } from '../common/RoundBar'
import { TitleCard } from '../common/TitleCard'
import { estimateData, estimateTotals, formatNumber } from './logic'

/** Schätzfrage auf dem Beamer: Frage, je Team eine Karte, die einzeln aufgedeckt wird, dann die Lösung. */
export default function EstimateScene({ state, game }: { state: State; game: Game }) {
  const quiz = state.play.quiz
  const data = estimateData(state)
  const solved = data.solution !== null
  const points = quiz ? (data.points[quiz.index] ?? {}) : {}

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={quiz ? `Frage ${quiz.index + 1}` : undefined} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {!quiz ? (
            <TitleCard key="title" state={state} game={game} />
          ) : (
            <motion.div
              key={`q-${quiz.index}`}
              className={`estimate${quiz.imageUrl ? ' with-image' : ''}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            >
              <div className="est-top">
                {quiz.imageUrl && <img className="est-image" src={quiz.imageUrl} alt="" />}
                <div className="est-question">
                  <div className={`question${quiz.text.length > 110 ? ' long' : ''}`}>{quiz.text}</div>
                  {quiz.unit && !solved && <div className="est-unit">Gesucht in: {quiz.unit}</div>}
                  <AnimatePresence>
                    {solved && (
                      <motion.div className="est-solution" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
                        <span className="answer-label">Lösung</span>
                        <span className="answer-text gold-text">{formatNumber(data.solution!)}</span>
                        {quiz.unit && <span className="answer-info">{quiz.unit}</span>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="est-cards">
                {state.teams.map((t) => {
                  const guess = data.guesses[t.id]
                  const shown = guess !== undefined
                  const submitted = data.submitted.includes(t.id)
                  const won = (points[t.id] ?? 0) > 0
                  return (
                    <div key={t.id} className={`est-card${won ? ' won' : ''}${solved && !won ? ' lost' : ''}`} style={teamStyle(t.color)}>
                      <div className="est-team">{t.name}</div>
                      <AnimatePresence mode="wait">
                        {shown ? (
                          <motion.div
                            key="guess"
                            className="est-guess"
                            initial={{ rotateX: 90, opacity: 0 }}
                            animate={{ rotateX: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 160, damping: 16 }}
                          >
                            {formatNumber(guess)}
                          </motion.div>
                        ) : (
                          <motion.div key={submitted ? 'in' : 'wait'} className={`est-wait${submitted ? ' in' : ''}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
                            {submitted ? '✓' : '…'}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <AnimatePresence>
                        {solved && shown && (
                          <motion.div className="est-diff" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            {guess === data.solution ? 'Volltreffer' : `${guess > data.solution! ? '+' : '−'}${formatNumber(Math.abs(guess - data.solution!))}`}
                            {won && <b> · +{points[t.id]}</b>}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <RoundBar state={state} scores={estimateTotals(state)} highlight={Object.keys(points).filter((id) => points[id] > 0)} />
    </div>
  )
}
