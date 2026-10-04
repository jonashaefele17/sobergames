import { describe, expect, it } from 'vitest'
import * as act from '../lib/actions'
import { standings } from '../lib/scoring'
import { applyBuzz, applyJudge, applySetExcluded, applyUndo, canUndo, initialBuzzer, newToken } from './types'

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
    expect(s.lastJudgement).toEqual({ nonce: 1, teamId: 'a', correct: false, excludedBefore: [] })
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

describe('Rückgängig', () => {
  it('nach Falsch: Sperre weg, Team wieder dran', () => {
    const wrong = applyJudge(applyBuzz(armed(), 'a', 't1')!, false)!
    expect(canUndo(wrong)).toBe(true)
    const s = applyUndo(wrong, 't2')!
    expect(s).toMatchObject({ status: 'locked', buzzedTeamId: 'a', buzzedAt: 't2', excludedTeamIds: [], armed: true })
    expect(canUndo(s)).toBe(false)
    expect(applyUndo(s, 't3')).toBeNull()
  })

  it('nach Richtig mit Pause: Punkt und Frage zurück, frühere Sperren wieder da', () => {
    let s = applyJudge(applyBuzz(armed(), 'b', 't1')!, false)!
    s = applyJudge(applyBuzz(s, 'a', 't2')!, true, true)!
    expect(s).toMatchObject({ armed: false, question: 2, roundScores: { a: 1 } })
    s = applyUndo(s, 't3')!
    expect(s).toMatchObject({ armed: true, status: 'locked', buzzedTeamId: 'a', question: 1, roundScores: { a: 0 }, excludedTeamIds: ['b'] })
  })

  it('nicht mehr möglich, sobald neu gebuzzert wurde', () => {
    const s = applyBuzz(applyJudge(applyBuzz(armed(), 'a', 't1')!, false)!, 'b', 't2')!
    expect(canUndo(s)).toBe(false)
  })
})

describe('Einzeln freigeben', () => {
  it('ein Team sperren und wieder freigeben, andere bleiben unberührt', () => {
    let s = applyJudge(applyBuzz(armed(), 'a', 't1')!, false)!
    s = applySetExcluded(s, 'b', true)
    expect(s.excludedTeamIds).toEqual(['a', 'b'])
    s = applySetExcluded(s, 'a', false)
    expect(s.excludedTeamIds).toEqual(['b'])
    expect(applyBuzz(s, 'a', 't2')?.buzzedTeamId).toBe('a')
    expect(applyBuzz(s, 'b', 't2')).toBeNull()
    expect(applySetExcluded(s, 'b', true).excludedTeamIds).toEqual(['b'])
  })
})
