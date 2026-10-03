import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate } from 'motion/react'
import { EASE_OUT } from '../lib/motion'
import { LOGO_PARTS } from '../lib/logoParts'
import { WS_S, WS_W } from '../lib/wsPaths'

/** WS-Schild aus ws.svg */
export function WSShield({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg viewBox="4800 3900 14300 15100" aria-hidden>
      <path d={WS_W} fill={color} />
      <path d={WS_S} fill={color} />
    </svg>
  )
}

/** Pokal aus dem Logo, in Gold */
export function Trophy() {
  return (
    <svg viewBox="404 202 398 370" aria-hidden>
      <defs>
        <linearGradient id="trophy-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="35%" stopColor="#f2c94c" />
          <stop offset="60%" stopColor="#c9971c" />
          <stop offset="80%" stopColor="#f5d46a" />
          <stop offset="100%" stopColor="#a8740a" />
        </linearGradient>
      </defs>
      <path d={LOGO_PARTS.trophy} fill="url(#trophy-gold)" fillRule="evenodd" />
      <path d={LOGO_PARTS.rings} fill="url(#trophy-gold)" fillRule="evenodd" />
    </svg>
  )
}

export function SceneHead({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <header className="scene-head">
      <WSShield color="var(--gold)" />
      <h1>{title}</h1>
      {sub && <span className="sub">{sub}</span>}
    </header>
  )
}

/** Zahl, die weich zum neuen Wert zählt. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [initial] = useState(value)
  const shown = useRef(value)

  useEffect(() => {
    const controls = animate(shown.current, value, {
      duration: 0.9,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v
        if (ref.current) ref.current.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value])

  return <span ref={ref}>{Math.round(initial)}</span>
}

interface Mote {
  x: number
  y: number
  v: number
  r: number
  phase: number
}

/** Navy-Hintergrund mit langsam aufsteigendem Goldstaub (hinter allen Szenen außer dem Intro). */
export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const motes: Mote[] = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.006 + Math.random() * 0.02,
      r: 0.6 + Math.random() ** 3 * 3.2,
      phase: Math.random() * Math.PI * 2,
    }))
    let raf = 0
    let last = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { width: w, height: h } = canvas
      const scale = w / 1920
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (const m of motes) {
        m.y -= m.v * dt
        if (m.y < -0.02) {
          m.y = 1.02
          m.x = Math.random()
        }
        const t = now / 1000
        const x = (m.x + Math.sin(t * 0.3 + m.phase) * 0.012) * w
        const y = m.y * h
        const r = m.r * scale * 3
        const alpha = 0.25 + 0.3 * Math.abs(Math.sin(t * 0.8 + m.phase))
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(255,224,122,${alpha})`)
        g.addColorStop(1, 'rgba(232,185,35,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="backdrop">
      <canvas ref={ref} />
    </div>
  )
}
