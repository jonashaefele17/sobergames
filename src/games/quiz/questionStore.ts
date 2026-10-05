import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

/** Ein Hinweis zu einem Eintrag; bei Bildern ist value der Pfad im Medienordner (siehe common/media.ts) */
export interface Hint {
  id: string
  kind: 'image' | 'text'
  value: string
}

export interface Question {
  id: string
  question: string
  answer: string
  /** optionale Zusatzinfo, die mit der Antwort erscheint */
  info: string
  /** Pfad eines Bildes im Medienordner */
  imagePath: string | null
  /** weitere Hinweise, die nacheinander aufgedeckt werden */
  hints: Hint[]
  /** Pfad eines Songs im Medienordner */
  audioPath?: string | null
  /** Startstelle im Song in Sekunden */
  audioStart?: number
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
  hints?: Hint[] | null
  audio_path?: string | null
  audio_start?: number | null
}

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
      hints: r.hints ?? [],
      audioPath: r.audio_path ?? null,
      audioStart: r.audio_start ?? 0,
    }))
  },

  async save(gameId, questions) {
    const withHints = questions.some((q) => q.hints.length > 0)
    const withAudio = questions.some((q) => q.audioPath)
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
    }))
    if (rows.length) {
      const { error } = await supabase!.from(TABLE).upsert(rows)
      if (error) throw error
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
