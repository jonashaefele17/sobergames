import { motion } from 'motion/react'
import './common.css'
import { EASE_OUT } from '../../lib/motion'
import type { Game, State } from '../../store/types'
import { DEMO_ID, gameName } from '../catalog'

/** Titelseite eines Spiels auf dem Beamer: Nummer und Name. */
export function TitleCard({ state, game, sub = 'Gleich geht’s los' }: { state: State; game: Game; sub?: string }) {
  return (
    <motion.div
      className="title-card"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
    >
      <div className="kicker">{game.id === DEMO_ID ? 'Zum Ausprobieren' : `Spiel ${state.games.findIndex((g) => g.id === game.id) + 1}`}</div>
      <h1 className="gold-text">{gameName(game)}</h1>
      <div className="sub">{sub}</div>
    </motion.div>
  )
}
