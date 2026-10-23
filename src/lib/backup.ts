import { gameToIdeas, IDEA_GAMES, ideaKey, type IdeaStatus } from '../collect/ideas'
import { GAMES, gameDef } from '../games/catalog'
import type { AnswerFormat } from '../games/estimate/logic'
import { newQuestion, questionStore, type Hint, type Question } from '../games/quiz/questionStore'
import type { ChallengeType, State } from '../store/types'
import { normalize } from './actions'

/** Komplette Sicherung: Spielstand und die Inhalte aller Spiele. */
export interface Backup {
  version: 1
  createdAt: string
  state: State
  /** Inhalte je Spiel (Fragen, Orte mit Hinweisen, Objekte) */
  content: Record<string, Question[]>
  /** die Sammlung je Spiel (siehe collect/ideas.ts); fehlt in älteren Sicherungen */
  ideas?: Record<string, Question[]>
}

/** Nur die Fragen: Spiellisten und Sammlung, ohne Spielstand */
export interface QuestionExport {
  version: 1
  kind: 'fragen'
  createdAt: string
  content: Record<string, Question[]>
  ideas: Record<string, Question[]>
}

/** Spiele, die eigene Inhalte haben */
const contentGames = () => GAMES.filter((g) => g.quiz).map((g) => g.id)

async function loadIdeas(): Promise<Record<string, Question[]>> {
  const ideas: Record<string, Question[]> = {}
  for (const { id } of IDEA_GAMES) ideas[id] = await questionStore.list(ideaKey(id))
  return ideas
}

async function saveIdeas(ideas: Record<string, Question[]>): Promise<void> {
  for (const { id } of IDEA_GAMES) {
    if (ideas[id]) await questionStore.save(ideaKey(id), ideas[id])
  }
}

export async function createBackup(state: State): Promise<Backup> {
  const content: Record<string, Question[]> = {}
  for (const id of contentGames()) content[id] = await questionStore.list(id)
  return { version: 1, createdAt: new Date().toISOString(), state, content, ideas: await loadIdeas() }
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
  return { version: 1, createdAt: data.createdAt ?? '', state: normalize(data.state), content: data.content, ideas: data.ideas }
}

/** Stellt Spielstand und Inhalte wieder her; Inhalte von Spielen, die in der Sicherung fehlen, bleiben unberührt. */
export async function restoreBackup(backup: Backup, applyState: (state: State) => void): Promise<void> {
  for (const id of contentGames()) {
    if (backup.content[id]) await questionStore.save(id, backup.content[id])
  }
  if (backup.ideas) await saveIdeas(backup.ideas)
  applyState(backup.state)
}

/** Kurzbeschreibung für die Rückfrage vor dem Einspielen */
export function describeBackup(backup: Backup): string {
  const entries = Object.values(backup.content).reduce((sum, list) => sum + list.length, 0)
  const played = backup.state.games.filter((g) => g.result).length
  const date = backup.createdAt ? new Date(backup.createdAt).toLocaleString('de-DE') : 'unbekannt'
  return `Sicherung vom ${date}: ${backup.state.players.length} Spieler, ${played} gewertete Spiele, ${entries} Fragen/Einträge.`
}

// ---------- nur Fragen ----------

export async function createQuestionExport(): Promise<QuestionExport> {
  const content: Record<string, Question[]> = {}
  for (const id of contentGames()) content[id] = await questionStore.list(id)
  return { version: 1, kind: 'fragen', createdAt: new Date().toISOString(), content, ideas: await loadIdeas() }
}

const STATUSES: IdeaStatus[] = ['star', 'maybe', 'out']
const FORMATS: AnswerFormat[] = ['number', 'year', 'date']
const CHALLENGES: ChallengeType[] = ['count', 'list', 'free', 'time']
const text = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** Ein Eintrag aus einer fremden Datei: nur bekannte Felder, neue IDs */
function readEntry(raw: unknown, idea: boolean): Question | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const hints: Hint[] = Array.isArray(r.hints)
    ? r.hints
        .filter((h): h is Record<string, unknown> => typeof h === 'object' && h !== null && (h.kind === 'image' || h.kind === 'text'))
        .map((h) => ({ id: crypto.randomUUID(), kind: h.kind as Hint['kind'], value: text(h.value), ...(text(h.reveal) ? { reveal: text(h.reveal) } : {}) }))
    : []
  const q = newQuestion({
    question: text(r.question),
    answer: text(r.answer),
    info: text(r.info),
    imagePath: typeof r.imagePath === 'string' ? r.imagePath : null,
    ...(typeof r.answerImagePath === 'string' ? { answerImagePath: r.answerImagePath } : {}),
    hints,
    audioPath: typeof r.audioPath === 'string' ? r.audioPath : null,
    audioStart: typeof r.audioStart === 'number' && r.audioStart > 0 ? r.audioStart : 0,
  })
  if (FORMATS.includes(r.format as AnswerFormat)) q.format = r.format as AnswerFormat
  const c = typeof r.challenge === 'object' && r.challenge !== null ? (r.challenge as Record<string, unknown>) : null
  if (c && CHALLENGES.includes(c.type as ChallengeType)) {
    q.challenge = { type: c.type as ChallengeType, ...(typeof c.timers === 'number' && c.timers >= 1 ? { timers: Math.min(6, Math.round(c.timers)) } : {}) }
  }
  if (idea) {
    if (STATUSES.includes(r.status as IdeaStatus)) q.status = r.status as IdeaStatus
    q.note = text(r.note)
  }
  return q.question || q.answer ? q : null
}

function readLists(raw: unknown, ids: string[], idea: boolean): Record<string, Question[]> {
  const lists: Record<string, Question[]> = {}
  if (typeof raw !== 'object' || raw === null) return lists
  for (const id of ids) {
    const list = (raw as Record<string, unknown>)[id]
    if (Array.isArray(list)) lists[id] = list.map((e) => readEntry(e, idea)).filter((q): q is Question => q !== null)
  }
  return lists
}

/**
 * Liest eine Fragen-Datei. Eine komplette Sicherung geht auch: Von ihr werden
 * nur die Fragen genommen, der Spielstand bleibt außen vor.
 */
export function parseQuestionExport(input: string): QuestionExport {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(input) as Record<string, unknown>
  } catch {
    throw new Error('Die Datei ist keine gültige Fragen-Datei.')
  }
  if (typeof data !== 'object' || data === null || data.version !== 1 || typeof data.content !== 'object' || data.content === null) {
    throw new Error('Die Datei ist keine Sober-Games-Fragen-Datei.')
  }
  return {
    version: 1,
    kind: 'fragen',
    createdAt: text(data.createdAt),
    content: readLists(data.content, contentGames(), false),
    ideas: readLists(data.ideas, IDEA_GAMES.map((g) => g.id), true),
  }
}

/** Ersetzt die Fragen der Spiele, die in der Datei stehen; alles andere bleibt, auch der Spielstand. */
export async function restoreQuestions(data: QuestionExport): Promise<void> {
  for (const [id, list] of Object.entries(data.content)) await questionStore.save(id, list)
  await saveIdeas(data.ideas)
}

/**
 * Beim Einspielen in der Sammlung: Spiellisten aus der Datei, zu denen sie keine
 * Sammlung mitbringt, kommen auch in die Sammlung – Neues als ⭐, schon Vorhandenes
 * wird nur um Baustein und Liste ergänzt. Gibt die Zahl der neuen Einträge zurück.
 */
export async function contentToIdeas(data: QuestionExport): Promise<number> {
  let added = 0
  for (const { id } of IDEA_GAMES) {
    const content = data.content[id]
    if (!content?.length || data.ideas[id]) continue
    const ideas = await questionStore.list(ideaKey(id))
    const merged = gameToIdeas(ideas, content)
    added += merged.length - ideas.length
    await questionStore.save(ideaKey(id), merged)
  }
  return added
}

/** Rückfrage vor dem Einspielen: je Spiel, was ersetzt wird */
export function describeQuestionExport(data: QuestionExport): string {
  const date = data.createdAt ? new Date(data.createdAt).toLocaleString('de-DE') : 'unbekannt'
  const ids = [...new Set([...Object.keys(data.content), ...Object.keys(data.ideas)])]
  const filled = ids.filter((id) => data.content[id]?.length || data.ideas[id]?.length)
  const lines = filled.map((id) => {
    const parts = [
      data.content[id] && `${data.content[id].length} im Spiel`,
      data.ideas[id] && `${data.ideas[id].length} in der Sammlung`,
    ].filter(Boolean)
    return `${gameDef(id).name}: ${parts.join(', ')}`
  })
  // leere Listen in der Datei leeren beim Einspielen auch das Spiel – das soll man sehen
  const empty = ids.filter((id) => !filled.includes(id)).map((id) => gameDef(id).name)
  if (empty.length) lines.push(`Leer (wird geleert): ${empty.join(', ')}`)
  return [`Fragen vom ${date}`, ...lines].join('\n')
}
