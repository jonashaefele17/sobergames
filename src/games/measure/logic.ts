import type { MeasureData, State } from '../../store/types'

export const measureData = (state: State): MeasureData => state.play.data.measure ?? { items: [], weights: {} }

const withData = (s: State, fn: (d: MeasureData) => MeasureData): State => ({
  ...s,
  play: { ...s.play, data: { ...s.play.data, measure: fn(measureData(s)) } },
})

/**
 * Übernimmt die im Setup gepflegten Objekte. Bereits eingetragene Gewichte
 * bleiben erhalten, Werte gelöschter Objekte fallen weg.
 */
export const setItems = (items: MeasureData['items']) => (s: State): State =>
  withData(s, (d) => {
    if (JSON.stringify(d.items) === JSON.stringify(items)) return d
    const weights = Object.fromEntries(items.filter((i) => d.weights[i.id]).map((i) => [i.id, d.weights[i.id]]))
    return { items, weights }
  })

/** Trägt eine der beiden Hälften (0 oder 1) eines Teams für ein Objekt ein; null leert sie. */
export const setWeight = (itemId: string, teamId: string, half: 0 | 1, value: number | null) => (s: State): State =>
  withData(s, (d) => {
    const pair: [number | null, number | null] = [...(d.weights[itemId]?.[teamId] ?? [null, null])]
    pair[half] = value
    return { ...d, weights: { ...d.weights, [itemId]: { ...d.weights[itemId], [teamId]: pair } } }
  })

/** Differenz der beiden Hälften, sobald beide eingetragen sind */
export function difference(data: MeasureData, itemId: string, teamId: string): number | null {
  const [a, b] = data.weights[itemId]?.[teamId] ?? [null, null]
  return a === null || b === null ? null : Math.round(Math.abs(a - b) * 10) / 10
}

/**
 * Gesamtdifferenz je Team. Ein Team zählt erst, wenn es für jedes Objekt beide
 * Hälften hat – sonst wäre ein Team mit weniger Objekten im Vorteil.
 */
export function measureTotals(data: MeasureData, teamIds: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  if (data.items.length === 0) return out
  for (const teamId of teamIds) {
    const diffs = data.items.map((i) => difference(data, i.id, teamId))
    if (diffs.every((d) => d !== null)) out[teamId] = Math.round(diffs.reduce<number>((sum, d) => sum + (d ?? 0), 0) * 10) / 10
  }
  return out
}
