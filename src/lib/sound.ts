import { useSyncExternalStore } from 'react'

// Töne: Ticken fürs Glücksrad, Pochen und Schlusston für Countdowns.
// Standardmäßig stumm. Browser erlauben Ton erst nach einer Eingabe im
// jeweiligen Fenster; auf der Show schaltet ihn jeder Klick oder Tastendruck ein.
let ctx: AudioContext | null = null
let enabled = false
const listeners = new Set<() => void>()

function setEnabled(on: boolean) {
  enabled = on
  if (on && !ctx) ctx = new AudioContext()
  if (on) void ctx?.resume()
  for (const l of listeners) l()
}

export function toggleSound(): boolean {
  setEnabled(!enabled)
  return enabled
}

/** schaltet den Ton ein, falls er noch aus ist */
export function enableSound() {
  if (!enabled) setEnabled(true)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** ob der Ton in diesem Fenster an ist */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled)
}

function beep(frequency: number, at: number, duration: number, volume: number, type: OscillatorType = 'triangle') {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(volume, ctx.currentTime + at)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ctx.currentTime + at)
  osc.stop(ctx.currentTime + at + duration + 0.02)
}

/** dumpfer Schlag: die Tonhöhe fällt schnell ab, damit er auch auf kleinen Lautsprechern hörbar ist */
function thump(at: number, volume: number) {
  if (!ctx) return
  const start = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(170, start)
  osc.frequency.exponentialRampToValueAtTime(55, start + 0.14)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + 0.25)
}

export function tick() {
  if (!enabled) return
  beep(520, 0, 0.05, 0.12)
}

/** Herzschlag für die letzten Sekunden eines Countdowns; wird zum Ende hin lauter (secondsLeft 10 … 1) */
export function heartbeat(secondsLeft: number) {
  if (!enabled) return
  const volume = 0.45 + 0.4 * (1 - Math.min(10, Math.max(1, secondsLeft)) / 10)
  thump(0, volume)
  thump(0.2, volume * 0.7)
}

/** Schlusston: drei kurze Töne, dann ein langer */
export function finishSound() {
  if (!enabled) return
  ;[0, 0.22, 0.44].forEach((at) => beep(660, at, 0.14, 0.3, 'sine'))
  beep(990, 0.7, 1.1, 0.35, 'sine')
}
