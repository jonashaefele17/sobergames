import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

/** Ein Hinweis zu einer Frage; bei Bildern ist value der Pfad im Bucket (bzw. lokal die Data-URL) */
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
  /** Pfad im privaten Bucket (Supabase) bzw. Data-URL (lokal) */
  imagePath: string | null
  /** weitere Hinweise, die nacheinander aufgedeckt werden */
  hints: Hint[]
}

/**
 * Inhalte der Quiz-Spiele. Nur der Host liest und schreibt sie; auf den Beamer
 * kommt immer nur die gerade gezeigte Frage über den öffentlichen Spielstand.
 */
export interface QuestionStore {
  list(gameId: string): Promise<Question[]>
  /** speichert die komplette Liste in dieser Reihenfolge */
  save(gameId: string, questions: Question[]): Promise<void>
  uploadImage(file: Blob): Promise<string>
  /** anzeigbare URL; bei Supabase eine zeitlich begrenzte Signed URL */
  imageUrl(path: string): Promise<string>
  removeImage(path: string): Promise<void>
}

const TABLE = 'sobergames_questions'
const BUCKET = 'sobergames-media'
const SIGNED_URL_SECONDS = 6 * 60 * 60

export const newQuestion = (patch: Partial<Question> = {}): Question => ({
  id: crypto.randomUUID(),
  question: '',
  answer: '',
  info: '',
  imagePath: null,
  hints: [],
  ...patch,
})

/** Verkleinert Fotos vor dem Hochladen (max. 1600 px, JPEG), damit Beamer und Handys schnell laden. */
export async function resizeImage(file: Blob, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht umgewandelt werden'))), 'image/jpeg', 0.85),
  )
}

interface Row {
  id: string
  game_id: string
  position: number
  question: string
  answer: string
  info: string
  image_path: string | null
  hints?: Hint[] | null
}

const supabaseStore: QuestionStore = {
  async list(gameId) {
    const { data, error } = await supabase!
      .from(TABLE)
      .select('*')
      .eq('game_id', gameId)
      .order('position')
    if (error) throw error
    return (data as Row[]).map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      info: r.info,
      imagePath: r.image_path,
      hints: r.hints ?? [],
    }))
  },

  async save(gameId, questions) {
    const withHints = questions.some((q) => q.hints.length > 0)
    const rows = questions.map((q, position) => ({
      id: q.id,
      game_id: gameId,
      position,
      question: q.question,
      answer: q.answer,
      info: q.info,
      image_path: q.imagePath,
      updated_at: new Date().toISOString(),
      // die Spalte gibt es erst nach dem Schema-Update; ohne Hinweise bleibt das Speichern davon unabhängig
      ...(withHints ? { hints: q.hints } : {}),
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

  async uploadImage(file) {
    const path = `${crypto.randomUUID()}.jpg`
    const { error } = await supabase!.storage.from(BUCKET).upload(path, await resizeImage(file), { contentType: 'image/jpeg' })
    if (error) throw error
    return path
  },

  async imageUrl(path) {
    const { data, error } = await supabase!.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
    if (error) throw error
    return data.signedUrl
  },

  async removeImage(path) {
    await supabase!.storage.from(BUCKET).remove([path])
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

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** Lokal für Entwicklung und Tests: alles im localStorage, Bilder als kleine Data-URL. */
const localStore: QuestionStore = {
  async list(gameId) {
    return (readLocal()[gameId] ?? []).map((q) => ({ ...q, hints: q.hints ?? [] }))
  },
  async save(gameId, questions) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...readLocal(), [gameId]: questions }))
  },
  async uploadImage(file) {
    return toDataUrl(await resizeImage(file, 900))
  },
  async imageUrl(path) {
    return path
  },
  async removeImage() {},
}

export const questionStore: QuestionStore = isSupabaseConfigured ? supabaseStore : localStore
