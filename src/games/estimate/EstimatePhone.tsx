import { useState } from 'react'
import { motion } from 'motion/react'
import './estimate.css'
import '../../buzzer/buzzer.css'
import { SPRING, teamStyle } from '../../lib/motion'
import type { State, Team } from '../../store/types'
import { answerStore } from './answerStore'
import { estimateData, estimateTotals, formatNumber, parseNumber } from './logic'

/** Eingabe einer Frage; wird je Frage neu angelegt, damit Feld und Abgabe leer beginnen. */
function Entry({ token, open }: { token: string; open: boolean }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const value = parseNumber(text)

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
        <span>{sent !== null ? `Eure Schätzung: ${formatNumber(sent)}` : 'Gleich wird aufgelöst'}</span>
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
      <input
        id="estimate-input"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Zahl eingeben"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" disabled={value === null || busy}>
        {sent === null ? 'Abschicken' : 'Ändern'}
      </button>
      {sent !== null && <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} key={sent}>Abgegeben: {formatNumber(sent)}</motion.p>}
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
            <b>{formatNumber(data.solution)}</b>
            <span>
              {guess === undefined
                ? 'Lösung'
                : guess === data.solution
                  ? 'Volltreffer!'
                  : `Ihr lagt mit ${formatNumber(guess)} um ${formatNumber(Math.abs(guess - data.solution))} daneben`}
            </span>
          </div>
        ) : (
          <Entry key={quiz.index} token={token} open={open} />
        )}
      </main>
      <footer className="phone-foot">{quiz ? `Frage ${quiz.index + 1}` : ''}</footer>
    </div>
  )
}
