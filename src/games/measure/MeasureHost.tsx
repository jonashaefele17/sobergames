import { Fragment, useEffect, useState } from 'react'
import './measure.css'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { questionStore } from '../quiz/questionStore'
import { difference, ITEMS_PER_PAGE, measureData, measurePage, measureTotals, pageCount, setItems, setWeight, showPage } from './logic'

const run = (fn: (s: State) => State) => gameStore.update(fn)
const num = (v: string) => (v === '' ? null : Number(v))

/**
 * Regiepult für Messspiele: Objekte anlegen, je Team beide Hälften wiegen, kleinste Gesamtdifferenz gewinnt.
 * Der Beamer zeigt 4 Objekte je Seite; geblättert wird hier oder automatisch beim Eintragen.
 */
export default function MeasureHost({ state, game }: { state: State; game: Game }) {
  const unit = gameDef(game.id).unit ?? ''
  const data = measureData(state)
  const totals = measureTotals(data, state.teams.map((t) => t.id))
  const complete = state.teams.every((t) => totals[t.id] !== undefined)
  const pages = pageCount(data)
  const page = measurePage(data)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Objekte aus dem Setup holen; setItems schreibt nur, wenn sich etwas geändert hat
  useEffect(() => {
    let cancelled = false
    questionStore
      .list(game.id)
      .then((list) => {
        if (cancelled) return
        run(setItems(list.map((q, i) => ({ id: q.id, name: q.question.trim() || `Objekt ${i + 1}` }))))
        setLoaded(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Objekte konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [game.id])

  const end = () => {
    const missing = complete ? '' : ' Teams mit fehlenden Werten landen auf dem letzten Platz.'
    if (!confirm(`${gameName(game)} beenden und werten? Die kleinste Gesamtdifferenz gewinnt.${missing}`)) return
    run(act.endPlayRanked(totals, true))
  }

  return (
    <section>
      <h2>{gameName(game)}</h2>
      {error && <p className="warn">{error}</p>}
      {loaded && data.items.length === 0 && (
        <p className="warn">Noch keine Objekte – im Setup bei „{gameName(game)}“ auf „Objekte bearbeiten“ tippen.</p>
      )}

      {pages > 1 && (
        <>
          <div className="seg measure-pages">
            {Array.from({ length: pages }, (_, p) => (
              <button key={p} className={p === page ? 'on' : ''} onClick={() => run(showPage(p))}>
                Seite {p + 1}
              </button>
            ))}
          </div>
          <p className="hint">Beamer zeigt Seite {page + 1}. Beim Eintragen springt er von selbst zur Seite des Objekts.</p>
        </>
      )}

      {data.items.map((item, index) => (
        <Fragment key={item.id}>
          {pages > 1 && index % ITEMS_PER_PAGE === 0 && (
            <h3 className={`measure-page-head${index / ITEMS_PER_PAGE === page ? ' on' : ''}`}>
              Seite {index / ITEMS_PER_PAGE + 1}
              {index / ITEMS_PER_PAGE === page && <small>auf dem Beamer</small>}
            </h3>
          )}
          <div className="card">
            <div className="item-name">{item.name}</div>
            {state.teams.map((t) => {
              const pair = data.weights[item.id]?.[t.id] ?? [null, null]
              const diff = difference(data, item.id, t.id)
              return (
                <div key={t.id} className="row tight measure-row" style={teamStyle(t.color)}>
                  <span className="dot" />
                  <span className="grow">{t.name}</span>
                  {([0, 1] as const).map((half) => (
                    <input
                      key={half}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder={unit || '–'}
                      aria-label={`${item.name} ${t.name} Hälfte ${half + 1}`}
                      value={pair[half] ?? ''}
                      onChange={(e) => run(setWeight(item.id, t.id, half, num(e.target.value)))}
                    />
                  ))}
                  <b className="diff">{diff === null ? '–' : `Δ ${diff.toLocaleString('de-DE')}`}</b>
                </div>
              )
            })}
          </div>
        </Fragment>
      ))}

      {data.items.length > 0 && (
        <>
          <h2>Gesamtdifferenz{unit && ` in ${unit}`}</h2>
          {state.teams.map((t) => (
            <div key={t.id} className="row tight" style={teamStyle(t.color)}>
              <span className="dot" />
              <span className="grow">{t.name}</span>
              <b className="round-score wide">{totals[t.id] === undefined ? 'offen' : totals[t.id].toLocaleString('de-DE')}</b>
            </div>
          ))}
        </>
      )}

      <div className="row">
        <button className="primary big" disabled={Object.keys(totals).length === 0} onClick={end}>
          Spiel beenden & werten
        </button>
      </div>
      <button
        onClick={() => {
          if (confirm('Spielseite ohne Wertung verlassen? Die Werte gehen verloren.')) run(act.leavePlay)
        }}
      >
        Spielseite ohne Wertung verlassen
      </button>
    </section>
  )
}
