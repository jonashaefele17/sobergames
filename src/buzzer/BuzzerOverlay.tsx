import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import './buzzer.css'
import { CountUp } from '../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../lib/motion'
import type { State } from '../store/types'
import type { BuzzerState } from './types'

const FX_MS = 1600

/**
 * Buzzer auf der Spielseite: Rundenstand unten, beim Buzz ein Banner in der
 * Titelzeile, damit Frage und Bild lesbar bleiben. Wie Rad und Aufdecken
 * animiert es nur, was es live miterlebt.
 */
export function BuzzerOverlay({ state, buzzer }: { state: State; buzzer: BuzzerState }) {
  const [initialNonce] = useState(buzzer.lastJudgement?.nonce ?? 0)
  const [fxDone, setFxDone] = useState(0)
  const [initialBuzz] = useState(buzzer.buzzedAt)
  const [flashDone, setFlashDone] = useState<string | null>(null)

  const judgement = buzzer.lastJudgement
  const showFx = judgement && judgement.nonce > initialNonce && judgement.nonce !== fxDone
  const flash = buzzer.buzzedAt && buzzer.buzzedAt !== initialBuzz && buzzer.buzzedAt !== flashDone

  useEffect(() => {
    if (!showFx) return
    const id = window.setTimeout(() => setFxDone(judgement.nonce), FX_MS)
    return () => window.clearTimeout(id)
  }, [showFx, judgement])

  useEffect(() => {
    if (!flash) return
    const at = buzzer.buzzedAt
    const id = window.setTimeout(() => setFlashDone(at), 700)
    return () => window.clearTimeout(id)
  }, [flash, buzzer.buzzedAt])

  const buzzed = state.teams.find((t) => t.id === buzzer.buzzedTeamId)
  const ranking = [...state.teams].sort((a, b) => (buzzer.roundScores[b.id] ?? 0) - (buzzer.roundScores[a.id] ?? 0))

  return (
    <>
      <motion.div
        className="buzzer-panel"
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        exit={{ y: '110%' }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <div className="round-scores">
          {ranking.map((t) => {
            const excluded = buzzer.excludedTeamIds.includes(t.id)
            const fx = showFx && judgement.teamId === t.id ? judgement : null
            return (
              <motion.div
                key={t.id}
                layout
                transition={SPRING}
                className={`round-item${excluded ? ' excluded' : ''}`}
                style={teamStyle(t.color)}
              >
                <span className="rname">{t.name}</span>
                <span className="rpts">
                  <CountUp value={buzzer.roundScores[t.id] ?? 0} />
                </span>
                <AnimatePresence>
                  {fx && (
                    <motion.span
                      key={fx.nonce}
                      className={`round-fx ${fx.correct ? 'good' : 'bad'}`}
                      initial={{ opacity: 0, y: 20, scale: 0.6 }}
                      animate={{ opacity: 1, y: -40, scale: 1 }}
                      exit={{ opacity: 0, y: -70 }}
                      transition={{ duration: 0.7, ease: EASE_OUT }}
                    >
                      {fx.correct ? '+1' : '✕'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
        <div className="buzzer-status">{!buzzer.armed ? 'Buzzer pausiert' : buzzed ? 'Gebuzzert' : 'Buzzer frei'}</div>
      </motion.div>

      <AnimatePresence>
        {buzzer.armed && buzzed && (
          <motion.div
            key={`banner-${buzzer.buzzedAt}`}
            className="buzz-banner"
            style={teamStyle(buzzed.color)}
            initial={{ opacity: 0, y: '-70%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '-50%', transition: { duration: 0.35 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <motion.div
              className="buzz-banner-bar"
              initial={{ scaleX: 0.2, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <motion.span
                className="buzz-team"
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
              >
                {buzzed.name}
              </motion.span>
              <span className="buzz-sub">hat gebuzzert</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flash && (
          <motion.div
            key={buzzer.buzzedAt}
            className="buzz-flash"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
