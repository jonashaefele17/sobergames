import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import './measure.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { TitleCard } from '../common/TitleCard'
import { difference, ITEMS_PER_PAGE, measureData, measurePage, measureTotals, pageCount, pageItems } from './logic'

const fmt = (n: number) => n.toLocaleString('de-DE')

/** Seitenwechsel: die neue Seite kommt aus der Richtung, in die geblättert wurde */
const slide = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * 6}%` }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: `${dir * -6}%` }),
}

/**
 * Messspiel auf dem Beamer: Tabelle Objekte × Teams mit den Differenzen, unten die Summe.
 * Bei mehr als 4 Objekten blättert das Regiepult seitenweise; die Summe bleibt stehen.
 */
export default function MeasureScene({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const unit = def.unit ?? ''
  const data = measureData(state)
  const totals = measureTotals(data, state.teams.map((t) => t.id))
  const best = Math.min(...Object.values(totals))
  const pages = pageCount(data)
  const page = measurePage(data)
  const items = pageItems(data, page)
  // Richtung merken, damit die Seite passend hereingleitet
  const [shown, setShown] = useState(page)
  const [dir, setDir] = useState(1)
  if (page !== shown) {
    setDir(page > shown ? 1 : -1)
    setShown(page)
  }
  const sub = data.items.length ? `Differenz in ${unit || 'Einheiten'}${pages > 1 ? ` · Seite ${page + 1} / ${pages}` : ''}` : undefined

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={sub} />
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
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={page}
                  className="m-page"
                  custom={dir}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  {items.map((item) => {
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
                  {/* letzte Seite auffüllen, damit Kopf und Summe beim Blättern nicht springen */}
                  {pages > 1 && Array.from({ length: ITEMS_PER_PAGE - items.length }, (_, i) => <div key={`gap-${i}`} className="m-gap" />)}
                </motion.div>
              </AnimatePresence>
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
