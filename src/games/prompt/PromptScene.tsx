import { AnimatePresence, motion } from 'motion/react'
import '../quiz/quiz.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { RoundBar } from '../common/RoundBar'
import { TitleCard } from '../common/TitleCard'
import { awarded, awardTotals } from './logic'

/** Fragenrunde auf dem Beamer: Frage groß, unten der Zwischenstand; Teams mit Punkt leuchten auf. */
export default function PromptScene({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const quiz = state.play.quiz

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={quiz ? `${label} ${quiz.index + 1}` : def.category} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {!quiz ? (
            <TitleCard key="title" state={state} game={game} />
          ) : (
            <motion.div
              key={`q-${quiz.index}`}
              className={`quiz-stage${quiz.imageUrl ? ' with-image' : ''}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            >
              {quiz.imageUrl && (
                <div className="quiz-image">
                  <img src={quiz.imageUrl} alt="" />
                </div>
              )}
              <div className="quiz-text">
                <div className={`question${quiz.text.length > 110 ? ' long' : ''}`}>{quiz.text}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <RoundBar state={state} scores={awardTotals(state)} highlight={quiz ? awarded(state, quiz.index) : []} />
    </div>
  )
}
