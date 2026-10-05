import { motion } from 'motion/react'
import './common.css'
import { CountUp } from '../../components/shared'
import { SPRING, teamStyle } from '../../lib/motion'
import type { State } from '../../store/types'

/** Zwischenstand des laufenden Spiels am unteren Rand der Spielseite. */
export function RoundBar({ state, scores, highlight = [] }: { state: State; scores: Record<string, number>; highlight?: string[] }) {
  const ranking = [...state.teams].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
  return (
    <div className="round-bar">
      {ranking.map((t) => (
        <motion.div
          key={t.id}
          layout
          transition={SPRING}
          className={`round-bar-item${highlight.includes(t.id) ? ' on' : ''}`}
          style={teamStyle(t.color)}
        >
          <span className="rname">{t.name}</span>
          <span className="rpts">
            <CountUp value={scores[t.id] ?? 0} />
          </span>
        </motion.div>
      ))}
    </div>
  )
}
