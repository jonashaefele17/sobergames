import type { MeasureData, State } from '../../store/types'

export const measureData = (state: State): MeasureData => state.play.data.measure ?? { items: [], weights: {} }

/** so viele Objekte zeigt der Beamer auf einer Seite */
export const ITEMS_PER_PAGE = 4

export const pageCount = (data: MeasureData) => Math.max(1, Math.ceil(data.items.length / ITEMS_PER_PAGE))

/** die Seite auf dem Beamer, begrenzt auf die vorhandenen */
export const measurePage = (data: MeasureData) => Math.min(Math.max(0, data.page ?? 0), pageCount(data) - 1)

/** die Objekte einer Seite */
export const pageItems = (data: MeasureData, page: number) => data.items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

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
    return { ...d, items, weights }
  })

/** Schaltet den Beamer auf eine Seite */
export const showPage = (page: number) => (s: State): State => withData(s, (d) => ({ ...d, page: measurePage({ ...d, page }) }))

/**
 * Trägt eine der beiden Hälften (0 oder 1) eines Teams für ein Objekt ein; null leert sie.
 * Der Beamer springt dabei auf die Seite des Objekts.
 */
export const setWeight = (itemId: string, teamId: string, half: 0 | 1, value: number | null) => (s: State): State =>
  withData(s, (d) => {
    const pair: [number | null, number | null] = [...(d.weights[itemId]?.[teamId] ?? [null, null])]
    pair[half] = value
    const index = d.items.findIndex((i) => i.id === itemId)
    const page = index < 0 ? d.page : Math.floor(index / ITEMS_PER_PAGE)
    return { ...d, page, weights: { ...d.weights, [itemId]: { ...d.weights[itemId], [teamId]: pair } } }
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
