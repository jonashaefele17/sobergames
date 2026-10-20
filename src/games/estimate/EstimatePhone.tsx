import { useState } from 'react'
import { motion } from 'motion/react'
import './estimate.css'
import '../../buzzer/buzzer.css'
import { SPRING, teamStyle } from '../../lib/motion'
import type { State, Team } from '../../store/types'
import { answerStore } from './answerStore'
import AnswerInput from './AnswerInput'
import { estimateData, estimateTotals, formatAnswer, formatDistance, parseAnswer, type AnswerFormat } from './logic'

const ASKED: Record<AnswerFormat, string> = { number: '', year: 'Gesucht: eine Jahreszahl', date: 'Gesucht: ein Datum (Tag, Monat, Jahr)' }

/** Eingabe einer Frage; wird je Frage neu angelegt, damit Feld und Abgabe leer beginnen. */
function Entry({ token, open, unit, format }: { token: string; open: boolean; unit: string; format: AnswerFormat }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const value = parseAnswer(text, format)

  const submit = async () => {
    if (value === null) return
    setBusy(true)
    const ok = await answerStore.submit(token, value)
    setBusy(false)
    setFailed(!ok)
    if (ok) {
      setSent(value)
      navigator.vibrate?.(40)
    }
  }

  if (!open) {
    return (
      <div className="phone-state">
        <b>Eingabe geschlossen</b>
        <span>{sent !== null ? `Eure Schätzung: ${formatAnswer(sent, format)}${unit}` : 'Gleich wird aufgelöst'}</span>
      </div>
    )
  }
  return (
    <form
      className="est-entry"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label htmlFor="estimate-input">Eure Schätzung</label>
      <AnswerInput id="estimate-input" format={format} value={text} onChange={setText} />
      {unit && <span className="unit">Gesucht in:{unit}</span>}
      {ASKED[format] && <span className="unit">{ASKED[format]}</span>}
      <button type="submit" disabled={value === null || busy}>
        {sent === null ? 'Abschicken' : 'Ändern'}
      </button>
      {sent !== null && <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} key={sent}>Abgegeben: {formatAnswer(sent, format)}{unit}</motion.p>}
      {failed && <p className="error">Nicht angekommen – nochmal versuchen</p>}
    </form>
  )
}

/** Team-Handy bei Schätzfragen: Zahl eintippen und abschicken, nach der Auflösung die eigene Abweichung. */
export default function EstimatePhone({ token, team, state, open }: { token: string; team: Team; state: State; open: boolean }) {
  const quiz = state.play.quiz
  const data = estimateData(state)
  const totals = estimateTotals(state)
  const guess = data.guesses[team.id]
  // mit führendem Leerzeichen, damit sie direkt hinter eine Zahl passt
  const unit = quiz?.unit ? ` ${quiz.unit}` : ''
  const format = quiz?.format ?? 'number'
  const ranking = [...state.teams].sort((a, b) => totals[b.id] - totals[a.id])

  return (
    <div className="phone" style={teamStyle(team.color)}>
      <header className="phone-head">
        <div className="phone-team">{team.name}</div>
        <div className="phone-scores">
          {ranking.map((t) => (
            <motion.span key={t.id} layout transition={SPRING} className={t.id === team.id ? 'me' : ''} style={teamStyle(t.color)}>
              {t.name} <b>{totals[t.id]}</b>
            </motion.span>
          ))}
        </div>
      </header>
      <main className="phone-main">
        {!quiz ? (
          <div className="phone-state view-waiting">
            <b>Bereit machen</b>
            <span>Warten auf die erste Frage</span>
          </div>
        ) : data.solution !== null ? (
          <div className="phone-state">
            <b>
              {formatAnswer(data.solution, format)}
              {unit}
            </b>
            <span>
              {guess === undefined
                ? 'Lösung'
                : guess === data.solution
                  ? 'Volltreffer!'
                  : `Ihr lagt mit ${formatAnswer(guess, format)} um ${formatDistance(guess - data.solution, format)} daneben`}
            </span>
          </div>
        ) : (
          <Entry key={quiz.index} token={token} open={open} unit={unit} format={format} />
        )}
      </main>
      <footer className="phone-foot">{quiz ? `Frage ${quiz.index + 1}` : ''}</footer>
    </div>
  )
}
