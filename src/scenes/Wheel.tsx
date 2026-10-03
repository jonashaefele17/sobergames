import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { unassignedPlayers } from '../lib/actions'
import { tick } from '../lib/sound'
import { EASE_OUT, SPRING, teamStyle } from '../lib/motion'
import { SceneHead, WSShield } from '../components/shared'
import type { Player, State } from '../store/types'

const SPIN_MS = 6200
const REVEAL_MS = 2300
const IDLE_SPEED = 0.05 // rad/s
const TAU = Math.PI * 2

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

function drawWheel(canvas: HTMLCanvasElement, players: Player[]) {
  const size = 1400
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const R = c - 34
  const n = Math.max(players.length, 1)
  const seg = TAU / n

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(c, c)
  // Segment 0 beginnt oben und läuft im Uhrzeigersinn
  ctx.rotate(-Math.PI / 2)

  const fills = ['#16224a', '#0d1530', '#1f2f63']
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R, i * seg, (i + 1) * seg)
    ctx.closePath()
    // bei ungerader Anzahl eine dritte Farbe, damit nie zwei gleiche nebeneinander liegen
    ctx.fillStyle = fills[n % 2 === 1 && i === n - 1 ? 2 : i % 2]
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(232,185,35,0.55)'
  ctx.lineWidth = 3
  for (let i = 0; i < n && n > 1; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(i * seg) * R, Math.sin(i * seg) * R)
    ctx.stroke()
  }

  // Namen
  const fontSize = Math.min(92, Math.max(34, (R * seg) / 1.9))
  ctx.font = `${fontSize}px "Bebas Neue", sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  players.forEach((p, i) => {
    ctx.save()
    ctx.rotate((i + 0.5) * seg)
    ctx.fillText(p.name.toUpperCase(), R - 46, fontSize * 0.06, R * 0.62)
    ctx.restore()
  })

  // Goldener Rand mit Nieten
  const ring = ctx.createLinearGradient(-R, -R, R, R)
  ring.addColorStop(0, '#ffe07a')
  ring.addColorStop(0.5, '#b8860b')
  ring.addColorStop(1, '#ffe07a')
  ctx.strokeStyle = ring
  ctx.lineWidth = 26
  ctx.beginPath()
  ctx.arc(0, 0, R + 8, 0, TAU)
  ctx.stroke()
  ctx.fillStyle = '#fff4c4'
  for (let i = 0; i < n * 2; i++) {
    const a = (i * seg) / 2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8), 5, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

interface WheelProps {
  players: Player[]
  /** Spieler, auf dem das Rad stehen bleiben soll, solange gedreht wird */
  targetId: string | null
  spinKey: number
  onStop: () => void
}

function WheelDisc({ players, targetId, spinKey, onStop }: WheelProps) {
  const disc = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<SVGSVGElement>(null)
  const angle = useRef(0)
  const spin = useRef<{ from: number; to: number; start: number } | null>(null)
  const latest = useRef({ players, targetId, onStop })

  useEffect(() => {
    latest.current = { players, targetId, onStop }
  })

  const names = players.map((p) => p.id + p.name).join('|')
  useEffect(() => {
    const draw = () => canvas.current && drawWheel(canvas.current, latest.current.players)
    draw()
    void document.fonts.ready.then(draw)
    disc.current?.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' })
  }, [names])

  // Neuer Dreh: Ziel so berechnen, dass das Segment des gezogenen Spielers oben am Zeiger landet
  useEffect(() => {
    const { players, targetId } = latest.current
    const index = players.findIndex((p) => p.id === targetId)
    if (index < 0) return
    const seg = TAU / players.length
    const within = (Math.random() - 0.5) * 0.7 * seg
    const rest = -((index + 0.5) * seg + within)
    const current = angle.current
    const delta = (((rest - current) % TAU) + TAU) % TAU
    spin.current = { from: current, to: current + delta + TAU * 6, start: performance.now() }
  }, [spinKey])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastSegment = -1

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = spin.current
      if (s) {
        const t = Math.min(1, (now - s.start) / SPIN_MS)
        angle.current = s.from + (s.to - s.from) * easeOutQuart(t)
        if (t >= 1) {
          spin.current = null
          latest.current.onStop()
        }
      } else if (!latest.current.targetId) {
        angle.current += IDLE_SPEED * dt
      }
      if (disc.current) disc.current.style.transform = `rotate(${angle.current}rad)`

      // Zeiger schnippt, sobald eine Segmentgrenze durchläuft
      const n = Math.max(latest.current.players.length, 1)
      const segment = Math.floor((((-angle.current % TAU) + TAU) % TAU) / (TAU / n))
      if (s && segment !== lastSegment && lastSegment !== -1) {
        pointer.current?.animate(
          [{ transform: 'translateX(-50%) rotate(-16deg)' }, { transform: 'translateX(-50%) rotate(0deg)' }],
          { duration: 160, easing: 'ease-out' },
        )
        tick()
      }
      lastSegment = segment
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="wheel-wrap">
      <div className="wheel-disc" ref={disc}>
        <canvas ref={canvas} />
      </div>
      <div className="wheel-hub">
        <WSShield color="#3d2c05" />
      </div>
      <svg className="wheel-pointer" ref={pointer} viewBox="0 0 60 80">
        <defs>
          <linearGradient id="pointer-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff1b8" />
            <stop offset="55%" stopColor="#e8b923" />
            <stop offset="100%" stopColor="#8a6508" />
          </linearGradient>
        </defs>
        <path d="M30 78 L4 16 A28 28 0 0 1 56 16 Z" fill="url(#pointer-gold)" stroke="#5b4204" strokeWidth="2" />
        <circle cx="30" cy="22" r="8" fill="#3d2c05" />
      </svg>
    </div>
  )
}

type Phase = 'idle' | 'spinning' | 'reveal'

export default function WheelScene({ state }: { state: State }) {
  const { spinId, targetPlayerId } = state.wheel
  // Nur Drehs animieren, die diese Ansicht live miterlebt (nicht nach einem Neuladen)
  const [settled, setSettled] = useState(spinId)
  const [stopped, setStopped] = useState(-1)

  const pending = spinId !== settled && targetPlayerId !== null
  const phase: Phase = !pending ? 'idle' : stopped === spinId ? 'reveal' : 'spinning'
  const target = pending ? state.players.find((p) => p.id === targetPlayerId) : undefined
  const targetTeam = target ? state.teams.find((t) => t.playerIds.includes(target.id)) : undefined

  useEffect(() => {
    if (phase !== 'reveal') return
    const id = window.setTimeout(() => setSettled(spinId), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [phase, spinId])

  // Solange gedreht wird, steht der gezogene Name noch auf dem Rad und nicht im Team
  const free = unassignedPlayers(state)
  const onWheel = target ? state.players.filter((p) => p.id === target.id || free.includes(p)) : free
  const done = state.players.length > 0 && onWheel.length === 0

  return (
    <div className="scene">
      <SceneHead title="Teamauslosung" sub={done ? 'Die Teams stehen' : `${onWheel.length} im Lostopf`} />
      <div className="scene-body">
        <LayoutGroup>
          <div className="wheel-layout">
            {state.players.length === 0 ? (
              <div className="wheel-empty">Noch keine Namen eingetragen</div>
            ) : (
              <WheelDisc
                players={onWheel}
                targetId={target?.id ?? null}
                spinKey={pending ? spinId : -1}
                onStop={() => setStopped(spinId)}
              />
            )}
            <div className="wheel-teams">
              {state.teams.map((team) => (
                <motion.div key={team.id} className="team-col" style={teamStyle(team.color)} layout transition={SPRING}>
                  <motion.h2 layout="position">
                    {team.name}
                    <small>{team.playerIds.filter((id) => id !== target?.id).length}</small>
                  </motion.h2>
                  <div className="chips">
                    {team.playerIds
                      .filter((id) => id !== target?.id)
                      .map((id) => (
                        <motion.span key={id} layoutId={`player-${id}`} className="chip" transition={SPRING}>
                          {state.players.find((p) => p.id === id)?.name}
                        </motion.span>
                      ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {phase === 'reveal' && target && targetTeam && (
              <motion.div
                className="draw-overlay"
                style={teamStyle(targetTeam.color)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="draw-card">
                  <motion.div
                    className="name"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  >
                    <motion.span layoutId={`player-${target.id}`} className="gold-text" style={{ display: 'inline-block' }}>
                      {target.name}
                    </motion.span>
                  </motion.div>
                  <motion.div
                    className="to"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.6, ease: EASE_OUT }}
                  >
                    → {targetTeam.name}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  )
}
