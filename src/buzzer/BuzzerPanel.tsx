import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import * as act from '../lib/actions'
import { teamStyle } from '../lib/motion'
import { gameStore } from '../store'
import type { Mode, State } from '../store/types'
import { buzzerStore, useBuzzer } from '.'
import { QrOverlay } from './QrOverlay'

const pad = (n: number) => String(n).padStart(2, '0')

/** Regiepult-Tab: Team-Handys verteilen, Buzzer steuern, Rundenpunkte übernehmen. */
export function BuzzerPanel({ state, mode }: { state: State; mode: Mode }) {
  const data = useBuzzer()
  const buzzer = data[mode]
  const connected = data.connected[mode]
  const [tokens, setTokens] = useState<Record<string, string>>({})
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [qrTeamId, setQrTeamId] = useState<string | null>(null)
  const [targetGame, setTargetGame] = useState('')

  const teamIds = state.teams.map((t) => t.id).join('|')
  useEffect(() => {
    let cancelled = false
    buzzerStore
      .ensureTokens(mode, teamIds.split('|').filter(Boolean))
      .then((t) => {
        if (cancelled) return
        setTokens(t)
        setTokenError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setTokenError(e instanceof Error ? e.message : 'Codes konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [mode, teamIds])

  const team = (id: string | null) => state.teams.find((t) => t.id === id)
  const buzzed = team(buzzer.buzzedTeamId)
  const qrTeam = team(qrTeamId)
  const gameId = targetGame || state.games.find((g) => !g.result)?.id || state.games[0]?.id

  const regenerate = async (teamId: string) => {
    if (!confirm('Neuen Code erzeugen? Der alte QR-Code funktioniert dann nicht mehr.')) return
    const token = await buzzerStore.regenerateToken(mode, teamId)
    setTokens((t) => ({ ...t, [teamId]: token }))
    setQrTeamId(teamId)
  }

  const takeOver = () => {
    const game = state.games.find((g) => g.id === gameId)
    if (!game) return
    if (game.result && !confirm(`„${game.name}“ ist schon gewertet. Ergebnis überschreiben?`)) return
    gameStore.update(act.setResultFromScores(game.id, buzzer.roundScores))
  }

  return (
    <section>
      <h2>Team-Handys</h2>
      <p className="hint">QR-Code einzeln dem jeweiligen Team zeigen. Grün = Handy verbunden.</p>
      {tokenError && <p className="warn">{tokenError}</p>}
      {state.teams.map((t) => (
        <div key={t.id} className="row tight" style={teamStyle(t.color)}>
          <span className={`presence${connected.includes(t.id) ? ' on' : ''}`} />
          <span className="grow">{t.name}</span>
          <button disabled={!tokens[t.id]} onClick={() => setQrTeamId(t.id)}>
            QR zeigen
          </button>
          <button disabled={!tokens[t.id]} onClick={() => void regenerate(t.id)}>
            Neuer Code
          </button>
          {mode === 'test' && (
            <button disabled={!tokens[t.id]} onClick={() => void buzzerStore.buzz(tokens[t.id])}>
              Buzz
            </button>
          )}
        </div>
      ))}

      <h2>Buzzer</h2>
      <button className={`big${buzzer.armed ? '' : ' primary'}`} onClick={() => buzzerStore.arm(mode, !buzzer.armed)}>
        {buzzer.armed ? 'Buzzer ausschalten' : 'Buzzer scharf schalten'}
      </button>

      {buzzer.armed && (
        <div className="card buzz-status" style={buzzed ? teamStyle(buzzed.color) : undefined}>
          <div className="row">
            <span className="hint grow">Frage {buzzer.question}</span>
            <button onClick={() => buzzerStore.nextQuestion(mode)}>Nächste Frage</button>
          </div>
          {buzzed ? (
            <>
              <div className="buzzed-name">{buzzed.name}</div>
              <div className="row">
                <button className="good big" onClick={() => buzzerStore.judge(mode, true)}>
                  Richtig
                </button>
                <button className="bad big" onClick={() => buzzerStore.judge(mode, false)}>
                  Falsch
                </button>
              </div>
              <button onClick={() => buzzerStore.release(mode)}>Freigeben ohne Wertung</button>
            </>
          ) : (
            <div className="buzzed-name idle">Frei – wartet auf Buzz</div>
          )}
          {buzzer.excludedTeamIds.length > 0 && (
            <p className="hint">Gesperrt: {buzzer.excludedTeamIds.map((id) => team(id)?.name).join(', ')}</p>
          )}
        </div>
      )}

      <h2>Runde</h2>
      {state.teams.map((t) => (
        <div key={t.id} className="row tight" style={teamStyle(t.color)}>
          <span className="dot" />
          <span className="grow">{t.name}</span>
          <button className="arrow" onClick={() => buzzerStore.adjustRound(mode, t.id, -1)}>
            −
          </button>
          <b className="round-score">{buzzer.roundScores[t.id] ?? 0}</b>
          <button className="arrow" onClick={() => buzzerStore.adjustRound(mode, t.id, 1)}>
            +
          </button>
        </div>
      ))}
      <div className="row">
        <select className="grow" value={gameId} onChange={(e) => setTargetGame(e.target.value)}>
          {state.games.map((g, i) => (
            <option key={g.id} value={g.id}>
              {pad(i + 1)} {g.name}
              {g.result ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <button className="primary" onClick={takeOver}>
          Ergebnis übernehmen
        </button>
      </div>
      <p className="hint">Rangfolge nach Rundenpunkten, bei Gleichstand teilen sich Teams den Platz.</p>
      <button
        onClick={() => {
          if (confirm('Rundenpunkte und Fragenzähler zurücksetzen?')) buzzerStore.resetRound(mode)
        }}
      >
        Runde zurücksetzen
      </button>

      <AnimatePresence>
        {qrTeam && tokens[qrTeam.id] && <QrOverlay team={qrTeam} token={tokens[qrTeam.id]} onClose={() => setQrTeamId(null)} />}
      </AnimatePresence>
    </section>
  )
}
