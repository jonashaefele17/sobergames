import { useEffect, useState } from 'react'
import { WSShield } from '../components/shared'
import { gameDef } from '../games/catalog'
import { questionStore } from '../games/quiz/questionStore'
import { termRounds } from '../games/score/terms'

type Sheet = 'solution' | 'player'

/**
 * Druckansicht der Begriffe im Spiel: je Runde eine A4-Seite quer mit den
 * nummerierten Kästchen. „Als PDF speichern“ im Druckdialog ergibt das PDF.
 * Das Spielerblatt hat dieselben Kästchen leer zum Zeichnen, darunter je ein
 * Streifen für die Antwort des Teams; es braucht keine Begriffe.
 */
export default function PrintTerms({ gameId, perRound, roundCount, onClose }: { gameId: string; perRound: number; roundCount: number; onClose: () => void }) {
  const [sheet, setSheet] = useState<Sheet>('solution')
  const [terms, setTerms] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = gameDef(gameId).name

  useEffect(() => {
    let cancelled = false
    questionStore
      .list(gameId)
      .then((list) => {
        if (!cancelled) setTerms(list.map((q) => q.question.trim()).filter(Boolean))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Begriffe konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  const solution = terms ? termRounds(terms) : []
  const player = sheet === 'player'
  const rounds = player ? Array.from({ length: roundCount }, (): string[] => []) : solution

  return (
    <div className="print-view">
      <div className="print-bar row">
        <div className="seg">
          <button className={player ? '' : 'on'} onClick={() => setSheet('solution')}>
            Lösungsblatt
          </button>
          <button className={player ? 'on' : ''} onClick={() => setSheet('player')}>
            Spielerblatt
          </button>
        </div>
        <span className="grow hint">
          {player ? `${rounds.length} Seiten · leer zum Zeichnen, darunter die Antwort des Teams` : rounds.length ? `${rounds.length} Seiten · gedruckt wird, was im Spiel steht` : ''}
        </span>
        <button onClick={onClose}>Schließen</button>
        <button className="primary" disabled={!rounds.length} onClick={() => window.print()}>
          Drucken / PDF
        </button>
      </div>
      {!player && error && <p className="warn">{error}</p>}
      {!player && terms && !rounds.length && <p className="hint">Im Spiel stehen noch keine Begriffe. Erst die ⭐ ins Spiel übernehmen.</p>}
      {rounds.map((list, r) => (
        <section key={r} className={`print-page${player ? ' player' : ''}`}>
          <header className="print-head">
            <WSShield />
            <div className="grow">
              <h1>{name}</h1>
              <span className="print-kicker">The Sober Games · {player ? 'Spielerblatt' : 'Lösungsblatt'}</span>
            </div>
            {player && (
              <div className="print-team">
                <small>Team</small>
                <i />
              </div>
            )}
            <div className="print-round">
              <small>Runde</small>
              <b>{r + 1}</b>
            </div>
          </header>
          <div className="print-grid">
            {Array.from({ length: perRound }, (_, i) =>
              player ? (
                <div key={i} className="print-cell">
                  <b>{i + 1}</b>
                  <div className="print-guess">
                    <small>Antwort</small>
                    <em />
                  </div>
                </div>
              ) : (
                <div key={i} className={`print-cell${list[i] ? '' : ' empty'}`}>
                  <b>{i + 1}</b>
                  <span>{list[i] ?? ''}</span>
                </div>
              ),
            )}
          </div>
          {player ? (
            <footer className="print-foot">
              <span />
              <span>Richtig: ______ / {perRound}</span>
            </footer>
          ) : (
            <footer className="print-foot">
              <span>Nicht den Teams zeigen</span>
              {list.length < perRound && <span>nur {list.length} {list.length === 1 ? 'Begriff' : 'Begriffe'} in dieser Runde</span>}
            </footer>
          )}
        </section>
      ))}
    </div>
  )
}
