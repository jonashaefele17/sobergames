// Dezentes Ticken fürs Glücksrad. Standardmäßig stumm; auf der Show mit Taste S einschalten
// (Browser erlauben Ton erst nach einer Eingabe).
let ctx: AudioContext | null = null
let enabled = false

export function toggleSound(): boolean {
  enabled = !enabled
  if (enabled && !ctx) ctx = new AudioContext()
  if (enabled) void ctx?.resume()
  return enabled
}

export function tick() {
  if (!enabled || !ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 520
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.06)
}
