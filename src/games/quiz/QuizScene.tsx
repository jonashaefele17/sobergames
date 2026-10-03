import { AnimatePresence, motion } from 'motion/react'
import './quiz.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'

/** Beamer-Ansicht eines Buzzer-Quiz: Frage groß, Antwort nach der Auflösung. */
export default function QuizScene({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const quiz = state.play.quiz
  const imageFirst = Boolean(def.quiz?.imageFirst)

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={quiz ? `${label} ${quiz.index + 1}` : def.category} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {!quiz ? (
            <motion.div
              key="title"
              className="quiz-title"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            >
              <div className="kicker">Spiel {state.games.findIndex((g) => g.id === game.id) + 1}</div>
              <h1 className="gold-text">{gameName(game)}</h1>
              <div className="sub">Gleich geht’s los</div>
            </motion.div>
          ) : (
            <motion.div
              key={`q-${quiz.index}`}
              className={`quiz-stage${quiz.imageUrl ? ' with-image' : ''}${imageFirst ? ' image-first' : ''}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            >
              {quiz.imageUrl && (
                <motion.div
                  className="quiz-image"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, ease: EASE_OUT }}
                >
                  <img src={quiz.imageUrl} alt="" />
                </motion.div>
              )}
              <div className="quiz-text">
                <div className={`question${quiz.text.length > 110 ? ' long' : ''}`}>{quiz.text}</div>
                <AnimatePresence>
                  {quiz.phase === 'answer' && quiz.answer !== null && (
                    <motion.div
                      key="answer"
                      className="answer"
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={SPRING}
                    >
                      <span className="answer-label">Antwort</span>
                      <span className="answer-text gold-text">{quiz.answer}</span>
                      {quiz.info && <span className="answer-info">{quiz.info}</span>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
