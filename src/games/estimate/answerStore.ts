import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

/**
 * Schätzungen der Teams. Die Handys schreiben nur über ihren geheimen Code und
 * nur solange die Eingabe offen ist; lesen kann sie allein der Host. Auf den
 * Beamer kommen sie erst, wenn der Host sie aufdeckt.
 */
export interface AnswerStore {
  /** Team-Handy: Schätzung abgeben oder ändern; false, wenn die Eingabe zu ist oder der Code nicht stimmt */
  submit(token: string, value: number): Promise<boolean>
  /** Host: alle Schätzungen je Team */
  list(): Promise<Record<string, number>>
  /** Host: Schätzung von Hand eintragen, z. B. wenn ein Handy ausfällt */
  set(teamId: string, value: number): Promise<void>
  /** Host: alle Schätzungen löschen (neue Frage) */
  clear(): Promise<void>
  /** Host: meldet jede Änderung */
  subscribe(listener: () => void): () => void
}

const TABLE = 'sobergames_answers'

const supabaseStore: AnswerStore = {
  async submit(token, value) {
    const { data, error } = await supabase!.rpc('sobergames_answer', { p_token: token, p_value: value })
    if (error) console.error('answer failed', error)
    return data === true
  },
  async list() {
    const { data, error } = await supabase!.from(TABLE).select('team_id, value')
    if (error) throw error
    return Object.fromEntries((data as { team_id: string; value: number }[]).map((r) => [r.team_id, Number(r.value)]))
  },
  async set(teamId, value) {
    const { error } = await supabase!.from(TABLE).upsert({ team_id: teamId, value, updated_at: new Date().toISOString() })
    if (error) throw error
  },
  async clear() {
    const { error } = await supabase!.from(TABLE).delete().neq('team_id', '')
    if (error) throw error
  },
  subscribe(listener) {
    const channel = supabase!
      .channel(`sobergames-answers-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, listener)
      .subscribe()
    return () => {
      void supabase!.removeChannel(channel)
    }
  },
}

const KEY = 'sobergames-answers-v1'
const CHANNEL = 'sobergames-answers-sync-v1'
// dieselben Einträge, die der lokale Buzzer-Store schreibt
const TOKEN_KEY = 'sobergames-buzzer-tokens-v2'
const BUZZER_KEY = 'sobergames-buzzer-v2'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

function writeLocal(answers: Record<string, number>) {
  localStorage.setItem(KEY, JSON.stringify(answers))
  channel?.postMessage('update')
  for (const l of localListeners) l()
}

const localListeners = new Set<() => void>()
channel?.addEventListener('message', () => {
  for (const l of localListeners) l()
})

/** Lokal für Entwicklung und Tests; verhält sich wie die Datenbankfunktion. */
const localStore: AnswerStore = {
  async submit(token, value) {
    const teamId = read<Record<string, string>>(TOKEN_KEY, {})[token]
    const open = read<{ armed?: boolean }>(BUZZER_KEY, {}).armed === true
    if (!teamId || !open) return false
    writeLocal({ ...read<Record<string, number>>(KEY, {}), [teamId]: value })
    return true
  },
  async list() {
    return read<Record<string, number>>(KEY, {})
  },
  async set(teamId, value) {
    writeLocal({ ...read<Record<string, number>>(KEY, {}), [teamId]: value })
  },
  async clear() {
    writeLocal({})
  },
  subscribe(listener) {
    localListeners.add(listener)
    return () => {
      localListeners.delete(listener)
    }
  },
}

export const answerStore: AnswerStore = isSupabaseConfigured ? supabaseStore : localStore
