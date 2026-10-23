import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import './quiz.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING } from '../../lib/motion'
import type { Game, ShownHint, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { TitleCard } from '../common/TitleCard'
import { SongStage } from './SongStage'

/** blendet erst ein, wenn das Bild geladen ist, damit es nicht halb aufgebaut erscheint */
function LoadedImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <motion.img
      src={src}
      alt=""
      onLoad={() => setLoaded(true)}
      initial={{ opacity: 0, scale: 1.04 }}
      animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.04 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: EASE_OUT }}
    />
  )
}

/** Bild, das beim Wechsel der Quelle weich überblendet (z. B. bei der Auflösung) */
function FadeImage({ src, initial = false }: { src: string; initial?: boolean }) {
  return (
    <AnimatePresence initial={initial}>
      <LoadedImage key={src} src={src} />
    </AnimatePresence>
  )
}

/** Beamer-Ansicht eines Buzzer-Quiz: Frage groß, Antwort nach der Auflösung. */
export default function QuizScene({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const quiz = state.play.quiz
  const imageFirst = Boolean(def.quiz?.imageFirst)
  const hints = quiz?.hints ?? []
  const focus = Math.min(quiz?.hintFocus ?? hints.length - 1, hints.length - 1)
  const currentHint = hints[focus]
  // nach der Auflösung treten Auflösungsbilder (z. B. rausgezoomt) an die Stelle ihrer Hinweise
  const answered = quiz?.phase === 'answer'
  const imageOf = (h: ShownHint) => (answered && h.reveal) || h.value
  // Bild der Frage; ein Bild zur Antwort tritt nach der Auflösung an seine Stelle oder kommt neu dazu
  const image = (answered && quiz?.answerImageUrl) || quiz?.imageUrl
  const reveals = JSON.stringify(hints.flatMap((h) => (h.reveal ? [h.reveal] : [])))

  // vorladen, damit die Überblendung bei der Auflösung nicht auf das Bild warten muss
  useEffect(() => {
    for (const url of JSON.parse(reveals) as string[]) new Image().src = url
  }, [reveals])

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={quiz ? `${label} ${quiz.index + 1}` : undefined} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {!quiz ? (
            <TitleCard key="title" state={state} game={game} />
          ) : (
            <motion.div
              key={`q-${quiz.index}`}
              className={`quiz-stage${image || currentHint ? ' with-image' : ''}${imageFirst ? ' image-first' : ''}${quiz.audio ? ' with-song' : ''}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            >
              {currentHint && (
                <div className="quiz-hints">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={focus}
                      className="hint-main"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.03 }}
                      transition={{ duration: 0.5, ease: EASE_OUT }}
                    >
                      {currentHint.kind === 'image' ? <FadeImage src={imageOf(currentHint)} /> : <div className="hint-text">{currentHint.value}</div>}
                    </motion.div>
                  </AnimatePresence>
                  {hints.length > 1 && (
                    <div className="hint-strip">
                      {hints.map((h, i) => (
                        <motion.div
                          key={i}
                          className={`hint-thumb${i === focus ? ' current' : ''}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={SPRING}
                        >
                          <span className="n">{i + 1}</span>
                          {h.kind === 'image' ? <FadeImage src={imageOf(h)} /> : <span className="t">{h.value}</span>}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <AnimatePresence>
                {image && !currentHint && (
                  <motion.div key="image" className="quiz-image" exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
                    <FadeImage src={image} initial />
                  </motion.div>
                )}
              </AnimatePresence>
              {quiz.audio && <SongStage audio={quiz.audio} stages={def.quiz?.stages ?? [1, 2, 4, 8, 16]} />}
              {/* rückt weich zur Seite, wenn mit der Antwort ein Bild dazukommt */}
              <motion.div layout="position" className="quiz-text" transition={{ duration: 0.6, ease: EASE_OUT }}>
                {quiz.text && <div className={`question${quiz.text.length > 110 ? ' long' : ''}`}>{quiz.text}</div>}
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
