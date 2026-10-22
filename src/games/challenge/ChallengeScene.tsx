import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import './challenge.css'
import { SceneHead } from '../../components/shared'
import { EASE_OUT, SPRING, teamStyle } from '../../lib/motion'
import type { ChallengeRun, Game, State } from '../../store/types'
import { gameName } from '../catalog'
import { RoundBar } from '../common/RoundBar'
import { TitleCard } from '../common/TitleCard'
import { formatStopwatch, useNow } from '../common/time'
import { challengeData, challengeTotals, formatTarget, LOSE_POINTS, progress, reached, timerMs, visibleNames, WIN_POINTS } from './logic'

/**
 * „Mein Team kann“ auf dem Beamer: Aufgabe und spielendes Team, das Ziel als
 * Reveal, darunter je nach Baustein Runden, Genanntes oder Zeit, zum Schluss die Wertung.
 */
export default function ChallengeScene({ state, game }: { state: State; game: Game }) {
  const data = challengeData(state)
  const r = data.current
  const played = Object.keys(data.results).length > 0

  return (
    <div className="scene">
      <SceneHead title={gameName(game)} sub={r ? `Aufgabe ${r.index + 1} / ${r.total}` : undefined} />
      <div className="scene-body">
        <AnimatePresence mode="wait">
          {r ? (
            <motion.div
              key={`task-${r.index}`}
              className="challenge"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            >
              <Run r={r} state={state} />
            </motion.div>
          ) : (
            <TitleCard key="title" state={state} game={game} sub={played ? 'Gleich kommt die nächste Aufgabe' : undefined} />
          )}
        </AnimatePresence>
      </div>
      {/* während Bilder laufen, klappt der Punktestand weg und gibt dem Bild Platz */}
      <motion.div
        className="ch-bar"
        initial={false}
        animate={r?.type === 'time' && r.image ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <RoundBar state={state} scores={challengeTotals(state)} highlight={r?.teamId ? [r.teamId] : []} />
      </motion.div>
    </div>
  )
}

function Run({ r, state }: { r: ChallengeRun; state: State }) {
  const running = r.timers.some((t) => t.startedAt !== null)
  const now = useNow(40, running)
  const team = state.teams.find((t) => t.id === r.teamId)
  const isTime = r.type === 'time'
  const p = progress(r, now)
  const done = r.targetShown && reached(r, now) === true
  const withImage = isTime && r.image !== null
  const fmt = (n: number) => (isTime ? formatStopwatch(n) : String(n))
  const goal = (n: number) => (isTime ? formatTarget(n) : String(n))

  const progressBar = (
    <div className="ch-progress">
      {/* bei einem einzigen Timer steht die Zeit schon groß darüber */}
      {!(isTime && r.timers.length === 1) && (
        <span className="ch-count">
          {fmt(p)}
          {r.targetShown && r.target !== null && <small> / {goal(r.target)}</small>}
        </span>
      )}
      <div className="ch-track">
        <motion.div
          className={`ch-fill${done ? ' done' : ''}`}
          initial={false}
          animate={{ scaleX: r.targetShown && r.target ? Math.min(1, p / r.target) : 0 }}
          transition={running ? { duration: 0.1, ease: 'linear' } : { duration: 0.8, ease: EASE_OUT }}
        />
      </div>
    </div>
  )

  return (
    <div className={`ch-run${withImage ? ' with-image' : ''}`} style={teamStyle(team?.color ?? '#e8b923')}>
      <div className="ch-top">
        <div className="ch-title-block">
          <AnimatePresence mode="wait">
            <motion.div key={team?.id ?? 'none'} className="ch-team" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
              {team ? `${team.name} spielt` : 'Wer traut sich?'}
            </motion.div>
          </AnimatePresence>
          <div className={`ch-title${r.title.length > 70 ? ' longer' : r.title.length > 34 ? ' long' : ''}`}>{r.title}</div>
        </div>
        <AnimatePresence>
          {r.target !== null && (
            <motion.div className={`ch-goal${r.targetShown ? ' shown' : ''}${done ? ' done' : ''}`} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={SPRING}>
              <span className="ch-goal-label">{isTime ? 'Zielzeit' : 'Ziel'}</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={r.targetShown ? `t-${r.target}` : 'hidden'}
                  className="ch-goal-value"
                  initial={{ rotateX: 90, opacity: 0 }}
                  animate={{ rotateX: 0, opacity: 1 }}
                  exit={{ rotateX: -90, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 16 }}
                >
                  {r.targetShown ? goal(r.target) : '?'}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`ch-main ${r.type}${withImage ? ' with-image' : ''}`}>
        {r.type === 'count' && <Counts r={r} />}
        {(r.type === 'list' || r.type === 'free') && <Names r={r} />}
        {/* mit Bild steht der Fortschritt klein bei den Timern in der Ecke */}
        {isTime && <Times r={r} now={now} footer={withImage ? progressBar : null} />}
      </div>

      {!withImage && progressBar}

      <AnimatePresence>
        {r.verdict && (
          <motion.div
            key={r.verdict}
            className={`ch-verdict ${r.verdict}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 140, damping: 14 }}
          >
            <span className="ch-verdict-main">{r.verdict === 'won' ? 'Geschafft!' : 'Nicht geschafft'}</span>
            <span className="ch-verdict-sub">{r.verdict === 'won' ? `${team?.name} +${WIN_POINTS}` : `+${LOSE_POINTS} für alle anderen Teams`}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Counts({ r }: { r: ChallengeRun }) {
  if (r.counts.length === 0) return null
  return (
    <div className="ch-rounds">
      {r.counts.map((c, i) => (
        <motion.div key={i} layout transition={SPRING} className={`ch-round${c !== null ? ' filled' : ''}`}>
          <span className="ch-round-label">Runde {i + 1}</span>
          <AnimatePresence mode="wait">
            <motion.span key={c ?? 'open'} className="ch-round-value" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
              {c ?? '–'}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}

function Names({ r }: { r: ChallengeRun }) {
  const names = visibleNames(r)
  const ref = useRef<HTMLDivElement>(null)
  const pending = r.type === 'list' && !r.live && r.named.length > r.revealed.length
  const fitKey = `${names.join('|')}#${r.missed?.length ?? 0}#${pending}`

  // so weit verkleinern, bis alles auf die Fläche passt; die Chips gleiten per layout in die neue Größe
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let scale = 1
    el.style.setProperty('--s', '1')
    while (el.scrollHeight > el.clientHeight + 1 && scale > 0.35) {
      scale -= 0.05
      el.style.setProperty('--s', String(scale))
    }
  }, [fitKey])

  return (
    <div ref={ref} className="ch-names">
      <AnimatePresence>
        {names.map((n) => (
          <motion.span key={n} layout className="ch-name" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SPRING}>
            {n}
          </motion.span>
        ))}
        {r.missed?.map((n) => (
          <motion.span key={`missed-${n}`} layout className="ch-name missed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {n}
          </motion.span>
        ))}
      </AnimatePresence>
      {pending && (
        <motion.span layout className="ch-name pending" transition={SPRING}>
          + {r.named.length - r.revealed.length} genannt
        </motion.span>
      )}
    </div>
  )
}

function Times({ r, now, footer }: { r: ChallengeRun; now: number; footer: ReactNode }) {
  const active = r.timers.findIndex((t) => t.startedAt !== null)
  return (
    <>
      <AnimatePresence mode="wait">
        {r.image && <motion.img key={r.image} className="ch-image" src={r.image} alt="" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.45, ease: EASE_OUT }} />}
      </AnimatePresence>
      <div className="ch-timers">
        <div className="ch-clocks">
          {r.timers.map((t, i) => (
            <div key={i} className={`ch-clock${i === active ? ' running' : ''}${r.timers.length > 1 ? ' small' : ''}`}>
              {r.timers.length > 1 && <span className="ch-round-label">Timer {i + 1}</span>}
              <span className="ch-clock-value">{formatStopwatch(timerMs(t, now))}</span>
            </div>
          ))}
        </div>
        {footer}
      </div>
    </>
  )
}
