import type { IdeaStatus } from '../../collect/ideas'
import type { AnswerFormat } from '../estimate/logic'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'
import type { ChallengeConfig } from '../../store/types'

/** Ein Hinweis zu einem Eintrag; bei Bildern ist value der Pfad im Medienordner (siehe common/media.ts) */
export interface Hint {
  id: string
  kind: 'image' | 'text'
  value: string
  /** nur bei Bildern: Bild, das bei der Auflösung an diese Stelle tritt (z. B. rausgezoomt) */
  reveal?: string
}

export interface Question {
  id: string
  question: string
  answer: string
  /** optionale Zusatzinfo, die mit der Antwort erscheint */
  info: string
  /** Pfad eines Bildes im Medienordner */
  imagePath: string | null
  /** Pfad eines Bildes, das erst mit der Antwort erscheint (bzw. das Bild der Frage ersetzt) */
  answerImagePath?: string | null
  /** weitere Hinweise, die nacheinander aufgedeckt werden */
  hints: Hint[]
  /** Pfad eines Songs im Medienordner */
  audioPath?: string | null
  /** Startstelle im Song in Sekunden */
  audioStart?: number
  /** Schätzfragen: Format der Lösung; ohne Angabe eine Zahl */
  format?: AnswerFormat
  /** Mein Team kann: Baustein der Aufgabe; Antwortliste bzw. Bilder stehen in den Hinweisen */
  challenge?: ChallengeConfig
  /** nur in der Sammlung: Bewertung und eigene Notiz */
  status?: IdeaStatus
  note?: string
}

/**
 * Inhalte der Spiele (Fragen, Orte, Objekte). Nur der Host liest und schreibt
 * sie; auf den Beamer kommt immer nur der gerade gezeigte Eintrag über den
 * öffentlichen Spielstand. Kein Reset des Spielstands fasst sie an.
 */
export interface QuestionStore {
  list(gameId: string): Promise<Question[]>
  /** speichert die komplette Liste in dieser Reihenfolge */
  save(gameId: string, questions: Question[]): Promise<void>
}

const TABLE = 'sobergames_questions'

export const newQuestion = (patch: Partial<Question> = {}): Question => ({
  id: crypto.randomUUID(),
  question: '',
  answer: '',
  info: '',
  imagePath: null,
  hints: [],
  ...patch,
})

interface Row {
  id: string
  game_id: string
  position: number
  question: string
  answer: string
  info: string
  image_path: string | null
  answer_image_path?: string | null
  hints?: Hint[] | null
  audio_path?: string | null
  audio_start?: number | null
  status?: string | null
  note?: string | null
  format?: string | null
  challenge?: ChallengeConfig | null
}

/** fehlende Spalten heißen fast immer: das Schema-Update wurde noch nicht eingespielt */
const schemaError = (error: { message: string }) =>
  /column|schema cache/i.test(error.message) ? new Error('Die Datenbank kennt die neuen Spalten noch nicht: supabase/schema.sql einmal im SQL-Editor ausführen.') : error

const supabaseStore: QuestionStore = {
  async list(gameId) {
    const { data, error } = await supabase!.from(TABLE).select('*').eq('game_id', gameId).order('position')
    if (error) throw error
    return (data as Row[]).map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      info: r.info,
      imagePath: r.image_path,
      ...(r.answer_image_path ? { answerImagePath: r.answer_image_path } : {}),
      hints: r.hints ?? [],
      audioPath: r.audio_path ?? null,
      audioStart: r.audio_start ?? 0,
      ...(r.status ? { status: r.status as IdeaStatus } : {}),
      ...(r.note ? { note: r.note } : {}),
      ...(r.format ? { format: r.format as AnswerFormat } : {}),
      ...(r.challenge ? { challenge: r.challenge } : {}),
    }))
  },

  async save(gameId, questions) {
    // Listen der Sammlung (siehe collect/ideas.ts) brauchen das neue Schema und schreiben deshalb alle Spalten, auch wenn sie wieder leer sind
    const withIdea = gameId.startsWith('ideen:')
    const withHints = withIdea || questions.some((q) => q.hints.length > 0)
    const withAudio = withIdea || questions.some((q) => q.audioPath)
    // gesetzt wird das Format nur bei Schätzfragen, dort auch „number“, damit ein Zurückstellen gespeichert wird
    const withFormat = questions.some((q) => q.format !== undefined)
    const withChallenge = questions.some((q) => q.challenge)
    const withAnswerImage = withIdea || questions.some((q) => q.answerImagePath)
    const rows = questions.map((q, position) => ({
      id: q.id,
      game_id: gameId,
      position,
      question: q.question,
      answer: q.answer,
      info: q.info,
      image_path: q.imagePath,
      updated_at: new Date().toISOString(),
      // diese Spalten gibt es erst nach dem Schema-Update; ohne Hinweise bzw. Songs bleibt das Speichern davon unabhängig
      ...(withHints ? { hints: q.hints } : {}),
      ...(withAudio ? { audio_path: q.audioPath ?? null, audio_start: q.audioStart ?? 0 } : {}),
      ...(withIdea ? { status: q.status ?? '', note: q.note ?? '' } : {}),
      ...(withFormat ? { format: q.format ?? '' } : {}),
      ...(withChallenge ? { challenge: q.challenge ?? null } : {}),
      ...(withAnswerImage ? { answer_image_path: q.answerImagePath ?? null } : {}),
    }))
    if (rows.length) {
      const { error } = await supabase!.from(TABLE).upsert(rows)
      if (error) throw schemaError(error)
    }
    let del = supabase!.from(TABLE).delete().eq('game_id', gameId)
    if (rows.length) del = del.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`)
    const { error } = await del
    if (error) throw error
  },
}

const LOCAL_KEY = 'sobergames-questions-v1'

const readLocal = (): Record<string, Question[]> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<string, Question[]>
  } catch {
    return {}
  }
}

/** Lokal für Entwicklung und Tests: alles im localStorage. */
const localStore: QuestionStore = {
  async list(gameId) {
    return (readLocal()[gameId] ?? []).map((q) => ({ ...q, hints: q.hints ?? [] }))
  },
  async save(gameId, questions) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...readLocal(), [gameId]: questions }))
  },
}

export const questionStore: QuestionStore = isSupabaseConfigured ? supabaseStore : localStore
