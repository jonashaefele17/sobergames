import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { applyJudge, applyStartQuestion, applyUndo, initialBuzzer, newToken, type BuzzerData, type BuzzerState, type BuzzerStore, type Judgement } from './types'

const ROW_ID = 1
const TABLE = 'sobergames_buzzer'
const TOKENS = 'sobergames_tokens'

interface Row {
  armed: boolean
  status: BuzzerState['status']
  buzzed_team_id: string | null
  buzzed_at: string | null
  excluded_team_ids: string[]
  question: number
  round_scores: Record<string, number>
  last_judgement: Judgement | null
  updated_at: string
}

const rowToState = (r: Row): BuzzerState => ({
  armed: r.armed,
  status: r.status,
  buzzedTeamId: r.buzzed_team_id,
  buzzedAt: r.buzzed_at,
  excludedTeamIds: r.excluded_team_ids ?? [],
  question: r.question,
  roundScores: r.round_scores ?? {},
  lastJudgement: r.last_judgement,
})

const stateToRow = (s: Partial<BuzzerState>): Partial<Row> => {
  const row: Partial<Row> = {}
  if (s.armed !== undefined) row.armed = s.armed
  if (s.status !== undefined) row.status = s.status
  if (s.buzzedTeamId !== undefined) row.buzzed_team_id = s.buzzedTeamId
  if (s.buzzedAt !== undefined) row.buzzed_at = s.buzzedAt
  if (s.excludedTeamIds !== undefined) row.excluded_team_ids = s.excludedTeamIds
  if (s.question !== undefined) row.question = s.question
  if (s.roundScores !== undefined) row.round_scores = s.roundScores
  if (s.lastJudgement !== undefined) row.last_judgement = s.lastJudgement
  return row
}

/**
 * Supabase-backed BuzzerStore (see supabase/schema.sql).
 *
 * Phones buzz only through the sobergames_buzz() function, a single
 * conditional UPDATE, so simultaneous presses can never both win. Host actions
 * are applied locally first and only write the columns they change; judging is
 * conditional on the team that is actually locked in.
 */
class SupabaseBuzzerStore implements BuzzerStore {
  private data: BuzzerData = { ready: false, unsaved: false, state: initialBuzzer(), connected: [] }
  private listeners = new Set<() => void>()
  private ownStamps = new Set<number>()
  private presence: RealtimeChannel | null = null
  private presenceReady: Promise<void> = Promise.resolve()

  constructor() {
    if (!supabase) return
    void this.load()

    supabase
      .channel('sobergames-buzzer-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
        (payload) => this.applyRow(payload.new as Row),
      )
      .subscribe()

    const presence = supabase.channel('sobergames-presence')
    this.presence = presence
    this.presenceReady = new Promise((resolve) => {
      presence
        .on('presence', { event: 'sync' }, () => {
          const connected = new Set<string>()
          for (const entries of Object.values(presence.presenceState<{ teamId: string }>())) {
            for (const e of entries) connected.add(e.teamId)
          }
          this.set({ connected: [...connected] })
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve()
        })
    })

    // Mobile OSes suspend websockets while a tab is backgrounded/locked, so a
    // realtime update can be missed; force a fresh fetch whenever the device
    // wakes back up or regains network, instead of trusting only the next event.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.load()
    })
    window.addEventListener('online', () => void this.load())
  }

  private async load() {
    const { data, error } = await supabase!.from(TABLE).select('*').eq('id', ROW_ID).single()
    if (error || !data) {
      console.error('Failed to load buzzer from Supabase', error)
      return
    }
    this.set({ ready: true, state: rowToState(data as Row) })
  }

  private applyRow(row: Row) {
    if (this.ownStamps.has(Date.parse(row.updated_at))) return
    this.set({ state: rowToState(row) })
  }

  private set(patch: Partial<BuzzerData>) {
    this.data = { ...this.data, ...patch }
    for (const listener of this.listeners) listener()
  }

  /** Lokal sofort anwenden, dann nur die geänderten Spalten schreiben. */
  private async write(fn: (s: BuzzerState) => BuzzerState | null, conditions: Record<string, unknown> = {}) {
    if (!supabase) return
    const before = this.data.state
    const next = fn(before)
    if (!next) return
    const changed = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof BuzzerState])),
    ) as Partial<BuzzerState>
    this.set({ state: next })

    const stamp = new Date()
    this.ownStamps.add(stamp.getTime())
    let query = supabase
      .from(TABLE)
      .update({ ...stateToRow(changed), updated_at: stamp.toISOString() })
      .eq('id', ROW_ID)
    for (const [key, value] of Object.entries(conditions)) query = query.eq(key, value)
    const { error } = await query
    if (error) {
      console.error('Buzzer update failed', error)
      this.set({ unsaved: true })
      // Stand vom Server holen, damit nichts Falsches angezeigt bleibt
      void this.load()
      return
    }
    if (this.data.unsaved) this.set({ unsaved: false })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.data

  arm(on: boolean) {
    void this.write((s) => (on ? { ...s, armed: true } : { ...s, armed: false, status: 'open', buzzedTeamId: null, buzzedAt: null }))
  }

  judge(correct: boolean, opts: { pause?: boolean } = {}) {
    const teamId = this.data.state.buzzedTeamId
    void this.write((s) => applyJudge(s, correct, opts.pause), { status: 'locked', buzzed_team_id: teamId })
  }

  startQuestion() {
    void this.write(applyStartQuestion)
  }

  undoJudge() {
    // nur solange niemand neu gebuzzert hat
    void this.write((s) => applyUndo(s, new Date().toISOString()), { status: 'open' })
  }

  release() {
    void this.write((s) => ({ ...s, status: 'open', buzzedTeamId: null, buzzedAt: null }))
  }

  nextQuestion() {
    void this.write((s) => ({
      ...s,
      status: 'open',
      buzzedTeamId: null,
      buzzedAt: null,
      excludedTeamIds: [],
      question: s.question + 1,
    }))
  }

  adjustRound(teamId: string, delta: number) {
    void this.write((s) => ({ ...s, roundScores: { ...s.roundScores, [teamId]: (s.roundScores[teamId] ?? 0) + delta } }))
  }

  resetRound() {
    void this.write((s) => ({ ...initialBuzzer(), armed: s.armed, lastJudgement: s.lastJudgement }))
  }

  async ensureTokens(teamIds: string[]) {
    if (!supabase) return {}
    const { data, error } = await supabase.from(TOKENS).select('token, team_id')
    if (error) throw error
    const out: Record<string, string> = {}
    for (const row of data as { token: string; team_id: string }[]) out[row.team_id] = row.token
    const missing = teamIds.filter((id) => !out[id]).map((teamId) => ({ token: newToken(), team_id: teamId }))
    if (missing.length) {
      const { error: insertError } = await supabase.from(TOKENS).insert(missing)
      if (insertError) throw insertError
      for (const m of missing) out[m.team_id] = m.token
    }
    return out
  }

  async regenerateToken(teamId: string) {
    if (!supabase) return ''
    const { error } = await supabase.from(TOKENS).delete().eq('team_id', teamId)
    if (error) throw error
    const token = newToken()
    const { error: insertError } = await supabase.from(TOKENS).insert({ token, team_id: teamId })
    if (insertError) throw insertError
    return token
  }

  async resolveToken(token: string) {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('sobergames_team', { p_token: token })
    if (error || typeof data !== 'string') return null
    return data
  }

  async buzz(token: string) {
    if (!supabase) return false
    const { data, error } = await supabase.rpc('sobergames_buzz', { p_token: token })
    if (error) console.error('buzz failed', error)
    return data === true
  }

  connect(teamId: string) {
    let active = true
    void this.presenceReady.then(() => {
      if (active) void this.presence?.track({ teamId })
    })
    return () => {
      active = false
      void this.presence?.untrack()
    }
  }
}

export const buzzerStore = new SupabaseBuzzerStore()
