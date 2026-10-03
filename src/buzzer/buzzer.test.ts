import { describe, expect, it } from 'vitest'
import * as act from '../lib/actions'
import { standings } from '../lib/scoring'
import { applyBuzz, applyJudge, initialBuzzer, newToken } from './types'

const armed = () => ({ ...initialBuzzer(), armed: true })

describe('Buzzer', () => {
  it('nur scharf und frei, und nur der erste Buzz gewinnt', () => {
    expect(applyBuzz(initialBuzzer(), 'a', 't1')).toBeNull()
    const first = applyBuzz(armed(), 'a', 't1')
    expect(first).toMatchObject({ status: 'locked', buzzedTeamId: 'a', buzzedAt: 't1' })
    expect(applyBuzz(first!, 'b', 't2')).toBeNull()
  })

  it('Falsch sperrt das Team und gibt für die anderen frei', () => {
    const s = applyJudge(applyBuzz(armed(), 'a', 't1')!, false)!
    expect(s).toMatchObject({ status: 'open', buzzedTeamId: null, excludedTeamIds: ['a'], question: 1 })
    expect(s.lastJudgement).toEqual({ nonce: 1, teamId: 'a', correct: false })
    expect(applyBuzz(s, 'a', 't2')).toBeNull()
    expect(applyBuzz(s, 'b', 't2')?.buzzedTeamId).toBe('b')
  })

  it('Richtig gibt einen Rundenpunkt und startet die nächste Frage', () => {
    let s = applyJudge(applyBuzz(armed(), 'a', 't1')!, false)!
    s = applyJudge(applyBuzz(s, 'b', 't2')!, true)!
    expect(s).toMatchObject({ status: 'open', excludedTeamIds: [], question: 2, roundScores: { b: 1 } })
    expect(s.lastJudgement?.nonce).toBe(2)
    expect(applyJudge(s, true)).toBeNull() // niemand gebuzzert
  })

  it('Codes sind 10 Zeichen ohne verwechselbare Zeichen und unterschiedlich', () => {
    const codes = new Set(Array.from({ length: 200 }, newToken))
    expect(codes.size).toBe(200)
    for (const c of codes) expect(c).toMatch(/^[a-hjkmnp-z2-9]{10}$/)
  })
})

describe('Ergebnis aus Rundenpunkten', () => {
  it('Rangfolge mit geteilten Plätzen', () => {
    let s = act.initialState()
    const [a, b, c] = s.teams.map((t) => t.id)
    const game = s.games[0].id
    s = act.setResultFromScores(game, { [a]: 4, [b]: 7, [c]: 4 })(s)
    expect(s.games[0].result?.places).toEqual([[b], [a, c]])
    expect(standings(s).map((r) => r.points)).toEqual([3, 2, 2])
    // Teams ohne Punkte landen hinten, überschreibt das alte Ergebnis
    s = act.setResultFromScores(game, { [c]: 2 })(s)
    expect(s.games[0].result?.places).toEqual([[c], [a, b]])
  })
})
