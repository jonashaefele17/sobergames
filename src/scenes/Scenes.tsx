import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { gameDef, gameName } from '../games/catalog'
import { race, type Race } from '../lib/race'
import { gamePoints, standings } from '../lib/scoring'
import { EASE_OUT, SPRING, teamStyle } from '../lib/motion'
import { CountUp, SceneHead, Trophy } from '../components/shared'
import type { Game, State, Team } from '../store/types'

const pad = (n: number) => String(n).padStart(2, '0')

const teamNames = (ids: string[], teams: Team[]) =>
  ids
    .map((id) => teams.find((t) => t.id === id)?.name)
    .filter(Boolean)
    .join(' & ')

// ---------- Teams ----------

export function TeamsScene({ state }: { state: State }) {
  return (
    <div className="scene">
      <SceneHead title="Die Teams" sub="The Sober Games 2026" />
      <div className="scene-body">
        <div className="teams-grid">
          {state.teams.map((team, i) => (
            <motion.div
              key={team.id}
              className="team-card"
              style={teamStyle(team.color)}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.15 + i * 0.14 }}
            >
              <div className="label">Team {i + 1}</div>
              <h2>{team.name}</h2>
              <ul>
                {team.playerIds.map((id) => (
                  <li key={id}>{state.players.find((p) => p.id === id)?.name}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Spiele ----------

function GameCard({ game, index, state, flipped }: { game: Game; index: number; state: State; flipped: boolean }) {
  const finale = index === state.games.length - 1
  const firsts = game.result?.places[0] ?? []
  const winner = firsts.length ? state.teams.find((t) => t.id === firsts[0]) : undefined
  const points = (
    <span className="pts">
      {gamePoints(index, state)
        .slice(0, state.teams.length)
        .join(' · ')}
    </span>
  )
  return (
    <motion.div
      className={`game-card${winner ? ' played' : ''}${finale ? ' finale' : ''}`}
      style={winner ? teamStyle(winner.color) : undefined}
      initial={false}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={{ type: 'spring', stiffness: 60, damping: 14 }}
    >
      <div className="game-face front">
        {points}
        <span className="word">{finale ? `Game ${pad(index + 1)} · ×${state.scoring.finaleFactor}` : 'Game'}</span>
        <span className="num gold-text">{finale ? 'Finale' : pad(index + 1)}</span>
      </div>
      <div className="game-face back">
        <span className="num">{finale ? `${pad(index + 1)} · Finale ×${state.scoring.finaleFactor}` : pad(index + 1)}</span>
        {points}
        <span className="name">{gameName(game)}</span>
        {gameDef(game.id).category && <span className="cat">{gameDef(game.id).category}</span>}
        {winner && <span className="game-winner">{teamNames(firsts, state.teams)}</span>}
      </div>
    </motion.div>
  )
}

/** Goldener Hinweis am Team: Matchball oder uneinholbar. */
function RaceChip({ teamId, info }: { teamId: string; info: Race }) {
  const label =
    info.decidedFor?.id === teamId ? 'Uneinholbar' : info.matchball.some((m) => m.team.id === teamId) ? 'Matchball' : null
  return (
    <AnimatePresence>
      {label && (
        <motion.span
          key={label}
          className="race-chip"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={SPRING}
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** Teams, die rechnerisch nicht mehr gewinnen können, treten etwas zurück. */
const isOut = (teamId: string, info: Race) => !info.contenders.some((t) => t.id === teamId)

/** Großer Auftritt beim Aufdecken: Karte dreht sich einmal bildfüllend um. */
function Spotlight({ game, index, state }: { game: Game; index: number; state: State }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setFlipped(true), 900)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <motion.div
      className="spotlight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ scale: 0.5, y: 80 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={SPRING}
        style={{ perspective: 'inherit' }}
      >
        <GameCard game={game} index={index} state={state} flipped={flipped} />
      </motion.div>
    </motion.div>
  )
}

const SPOTLIGHT_MS = 4600

export function GamesScene({ state, hideTicker = false }: { state: State; hideTicker?: boolean }) {
  const { nonce, gameId } = state.spotlight
  // nur Aufdeckungen zeigen, die live passieren
  const [seen, setSeen] = useState(nonce)
  const spotIndex = nonce !== seen ? state.games.findIndex((g) => g.id === gameId) : -1

  useEffect(() => {
    if (nonce === seen) return
    const id = window.setTimeout(() => setSeen(nonce), SPOTLIGHT_MS)
    return () => window.clearTimeout(id)
  }, [nonce, seen])

  const n = state.games.length
  const cols = n <= 7 ? 3 : n <= 13 ? 5 : 6
  // das Finale füllt die letzte Reihe auf
  const rest = (n - 1) % cols
  const finaleSpan = cols - rest
  const rows = Math.ceil((n - 1) / cols) + (rest === 0 ? 1 : 0)
  const played = state.games.filter((g) => g.result).length
  const table = standings(state)
  const info = race(state)

  return (
    <div className="scene">
      <SceneHead title="Die Spiele" sub={`${played} von ${n} gespielt`} />
      <div className="scene-body">
        <div
          className="games-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {state.games.map((game, i) => (
            <motion.div
              key={game.id}
              className="game-slot"
              layout
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
              style={i === n - 1 ? { gridColumn: `span ${finaleSpan}` } : undefined}
            >
              {/* die Karte im Raster dreht sich erst, wenn der große Auftritt vorbei ist */}
              <GameCard game={game} index={i} state={state} flipped={game.revealed && i !== spotIndex} />
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {spotIndex >= 0 && <Spotlight key={nonce} game={state.games[spotIndex]} index={spotIndex} state={state} />}
        </AnimatePresence>
      </div>
      {state.showTicker && !hideTicker && (
        <div className="ticker">
          {table.map((row) => (
            <motion.div
              key={row.team.id}
              className={`ticker-item${state.showRaceHints && isOut(row.team.id, info) ? ' out' : ''}`}
              style={teamStyle(row.team.color)}
              layout
              transition={SPRING}
            >
              <span className="tname">{row.team.name}</span>
              {state.showRaceHints && <RaceChip teamId={row.team.id} info={info} />}
              <span className="tpts">
                <CountUp value={row.points} />
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Tabelle ----------

export function ScoreboardScene({ state }: { state: State }) {
  const table = standings(state)
  const max = Math.max(1, ...table.map((r) => r.points))
  const anyPoints = table.some((r) => r.points > 0)
  const info = race(state)

  return (
    <div className="scene">
      <SceneHead title="Tabelle" sub={`${state.games.filter((g) => g.result).length} von ${state.games.length} gespielt`} />
      <div className="scene-body">
        <div className="board">
          {table.map((row) => (
            <motion.div
              key={row.team.id}
              className={`board-row${anyPoints && row.rank === 1 ? ' lead' : ''}${state.showRaceHints && isOut(row.team.id, info) ? ' out' : ''}`}
              style={teamStyle(row.team.color)}
              layout
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            >
              <motion.div
                className="bar"
                initial={false}
                animate={{ scaleX: 0.04 + 0.96 * (Math.max(0, row.points) / max) }}
                transition={{ duration: 0.9, ease: EASE_OUT }}
              />
              <div className="rank">{row.rank}</div>
              <div style={{ minWidth: 0 }}>
                <div className="tname">
                  {row.team.name}
                  {state.showRaceHints && <RaceChip teamId={row.team.id} info={info} />}
                </div>
                <div className="members">
                  {row.team.playerIds.map((id) => state.players.find((p) => p.id === id)?.name).join(' · ')}
                </div>
              </div>
              <div className="points">
                <CountUp value={row.points} />
                <small>Punkte</small>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="strip">
        {state.games.map((game, i) => {
          const winner = state.teams.find((t) => t.id === game.result?.places[0]?.[0])
          return (
            <div key={game.id} className={`strip-cell${winner ? ' won' : ''}`} style={winner ? teamStyle(winner.color) : undefined}>
              {i === state.games.length - 1 ? 'F' : pad(i + 1)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Sieger ----------

/** Fallende Goldplättchen */
function GoldRain() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    const colors = ['#ffe07a', '#e8b923', '#b8860b', '#fff4c4']
    const flakes = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: -Math.random() * 1.2,
      v: 0.08 + Math.random() * 0.16,
      w: 5 + Math.random() * 9,
      spin: Math.random() * Math.PI * 2,
      spinV: 1.5 + Math.random() * 4,
      sway: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)
      for (const f of flakes) {
        f.y += f.v * dt
        f.spin += f.spinV * dt
        if (f.y > 1.05) f.y = -0.05
        const x = (f.x + Math.sin(now / 1400 + f.sway) * 0.02) * w
        ctx.save()
        ctx.translate(x, f.y * h)
        ctx.rotate(f.spin * 0.4)
        ctx.scale(1, Math.cos(f.spin))
        ctx.fillStyle = f.color
        ctx.fillRect(-f.w / 2, -f.w / 3, f.w, f.w / 1.5)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} />
}

export function WinnerScene({ state }: { state: State }) {
  const table = standings(state)
  const winners = table.filter((r) => r.rank === 1)
  const color = winners[0]?.team.color ?? '#e8b923'
  const members = winners
    .flatMap((r) => r.team.playerIds)
    .map((id) => state.players.find((p) => p.id === id)?.name)
    .filter(Boolean)

  return (
    <div className="winner" style={teamStyle(color)}>
      <GoldRain />
      <motion.div initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 11, delay: 0.3 }}>
        <Trophy />
      </motion.div>
      <motion.div className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
        Sieger der Sober Games 2026
      </motion.div>
      <motion.h1
        className="gold-text"
        initial={{ opacity: 0, scale: 1.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5, duration: 0.9, ease: EASE_OUT }}
      >
        {winners.map((r) => r.team.name).join(' & ')}
      </motion.h1>
      <motion.div className="who" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, duration: 0.8, ease: EASE_OUT }}>
        {members.join(' · ')}
      </motion.div>
      <motion.div className="score" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8, duration: 0.8 }}>
        {winners[0]?.points ?? 0} Punkte
      </motion.div>
    </div>
  )
}
