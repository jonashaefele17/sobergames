import { GAMES } from '../games/catalog'
import { questionStore, type Question } from '../games/quiz/questionStore'
import type { State } from '../store/types'
import { normalize } from './actions'

/** Komplette Sicherung: Spielstand und die Inhalte aller Spiele. */
export interface Backup {
  version: 1
  createdAt: string
  state: State
  /** Inhalte je Spiel (Fragen, Orte mit Hinweisen, Objekte) */
  content: Record<string, Question[]>
}

/** Spiele, die eigene Inhalte haben */
const contentGames = () => GAMES.filter((g) => g.quiz).map((g) => g.id)

export async function createBackup(state: State): Promise<Backup> {
  const content: Record<string, Question[]> = {}
  for (const id of contentGames()) content[id] = await questionStore.list(id)
  return { version: 1, createdAt: new Date().toISOString(), state, content }
}

/** Liest eine Sicherungsdatei und prüft, ob sie brauchbar ist. */
export function parseBackup(text: string): Backup {
  let data: Partial<Backup>
  try {
    data = JSON.parse(text) as Partial<Backup>
  } catch {
    throw new Error('Die Datei ist keine gültige Sicherung.')
  }
  if (data.version !== 1 || !data.state || typeof data.content !== 'object' || data.content === null) {
    throw new Error('Die Datei ist keine Sober-Games-Sicherung.')
  }
  return { version: 1, createdAt: data.createdAt ?? '', state: normalize(data.state), content: data.content }
}

/** Stellt Spielstand und Inhalte wieder her; Inhalte von Spielen, die in der Sicherung fehlen, bleiben unberührt. */
export async function restoreBackup(backup: Backup, applyState: (state: State) => void): Promise<void> {
  for (const id of contentGames()) {
    if (backup.content[id]) await questionStore.save(id, backup.content[id])
  }
  applyState(backup.state)
}

/** Kurzbeschreibung für die Rückfrage vor dem Einspielen */
export function describeBackup(backup: Backup): string {
  const entries = Object.values(backup.content).reduce((sum, list) => sum + list.length, 0)
  const played = backup.state.games.filter((g) => g.result).length
  const date = backup.createdAt ? new Date(backup.createdAt).toLocaleString('de-DE') : 'unbekannt'
  return `Sicherung vom ${date}: ${backup.state.players.length} Spieler, ${played} gewertete Spiele, ${entries} Fragen/Einträge.`
}
