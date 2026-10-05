import { AnimatePresence, motion } from 'motion/react'
import './measure.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { TitleCard } from '../common/TitleCard'
import { difference, measureData, measureTotals } from './logic'

const fmt = (n: number) => n.toLocaleString('de-DE')

/** Messspiel auf dem Beamer: Tabelle Objekte × Teams mit den Differenzen, unten die Summe. */
export default function MeasureScene({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const unit = def.unit ?? ''
  const data = measureData(state)
  const totals = measureTotals(data, state.teams.map((t) => t.id))
  const best = Math.min(...Object.values(totals))

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={data.items.length ? `Differenz in ${unit || 'Einheiten'}` : undefined} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {data.items.length === 0 ? (
            <TitleCard key="title" state={state} game={game} />
          ) : (
            <motion.div
              key="table"
              className="measure"
              style={{ gridTemplateColumns: `minmax(0, 1.1fr) repeat(${state.teams.length}, minmax(0, 1fr))` }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <div />
              {state.teams.map((t) => (
                <div key={t.id} className="m-team" style={teamStyle(t.color)}>
                  {t.name}
                </div>
              ))}
              {data.items.map((item) => {
                const diffs = state.teams.map((t) => difference(data, item.id, t.id))
                const min = Math.min(...diffs.filter((d): d is number => d !== null))
                return [
                  <motion.div key={item.id} layout className="m-item">
                    {item.name}
                  </motion.div>,
                  ...state.teams.map((t, i) => {
                    const pair = data.weights[item.id]?.[t.id] ?? [null, null]
                    const diff = diffs[i]
                    return (
                      <div key={`${item.id}-${t.id}`} className={`m-cell${diff !== null && diff === min ? ' best' : ''}`} style={teamStyle(t.color)}>
                        <AnimatePresence mode="wait">
                          {diff !== null ? (
                            <motion.div key="diff" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
                              <span className="m-diff">{fmt(diff)}</span>
                              <span className="m-pair">
                                {fmt(pair[0]!)} | {fmt(pair[1]!)}
                              </span>
                            </motion.div>
                          ) : (
                            <motion.span key="open" className="m-open" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              {pair[0] !== null || pair[1] !== null ? '…' : ''}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  }),
                ]
              })}
              <div className="m-item total">Gesamt</div>
              {state.teams.map((t) => (
                <div key={t.id} className={`m-cell total${totals[t.id] !== undefined && totals[t.id] === best ? ' best' : ''}`} style={teamStyle(t.color)}>
                  {totals[t.id] !== undefined ? (
                    <motion.span key={totals[t.id]} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
                      {fmt(totals[t.id])}
                      <small>{unit}</small>
                    </motion.span>
                  ) : (
                    <span className="m-open">–</span>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
