import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { teamStyle } from '../lib/motion'
import type { State } from '../store/types'
import { buzzerStore, useBuzzer } from '.'
import { QrOverlay } from './QrOverlay'

/** Regiepult-Tab: Team-Handys verteilen (QR-Codes) und prüfen, ob sie verbunden sind. */
export function BuzzerPanel({ state }: { state: State }) {
  const { connected } = useBuzzer()
  const [tokens, setTokens] = useState<Record<string, string>>({})
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [qrTeamId, setQrTeamId] = useState<string | null>(null)

  const teamIds = state.teams.map((t) => t.id).join('|')
  useEffect(() => {
    let cancelled = false
    buzzerStore
      .ensureTokens(teamIds.split('|').filter(Boolean))
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
  }, [teamIds])

  const team = (id: string | null) => state.teams.find((t) => t.id === id)
  const qrTeam = team(qrTeamId)

  const regenerate = async (teamId: string) => {
    if (!confirm('Neuen Code erzeugen? Der alte QR-Code funktioniert dann nicht mehr.')) return
    const token = await buzzerStore.regenerateToken(teamId)
    setTokens((t) => ({ ...t, [teamId]: token }))
    setQrTeamId(teamId)
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
        </div>
      ))}
      <details className="probe">
        <summary>Ohne Handys ausprobieren</summary>
        <div className="row">
          {state.teams.map((t) => (
            <button key={t.id} style={teamStyle(t.color)} className="team-btn" disabled={!tokens[t.id]} onClick={() => void buzzerStore.buzz(tokens[t.id])}>
              Buzz {t.name}
            </button>
          ))}
        </div>
      </details>

      <p className="hint">Gesteuert wird der Buzzer auf der Spielseite: Spiele → „Spiel starten“ → Tab „Spiel“.</p>

      <AnimatePresence>
        {qrTeam && tokens[qrTeam.id] && <QrOverlay team={qrTeam} token={tokens[qrTeam.id]} onClose={() => setQrTeamId(null)} />}
      </AnimatePresence>
    </section>
  )
}
