import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import './quiz.css'
import { SPRING } from '../../lib/motion'
import { gameDef } from '../catalog'
import { mediaFiles, mediaFolder, mediaUrl } from '../common/media'
import { parseQuestions } from './parse'
import { newQuestion, questionStore, type Hint, type Question } from './questionStore'
import { ANSWER_FORMATS, detectFormat, parseAnswer } from '../estimate/logic'
import AnswerInput from '../estimate/AnswerInput'
import { CHALLENGE_TYPES } from '../challenge/logic'
import type { ChallengeType } from '../../store/types'
import { SAMPLE_ESTIMATES, SAMPLE_PROMPTS, SAMPLE_QUESTIONS } from './samples'

const pad = (n: number) => String(n).padStart(2, '0')
const SAVE_DELAY_MS = 600

/** Vorschaubild einer Datei aus dem Medienordner */
export function Thumb({ path }: { path: string }) {
  const url = mediaUrl(path)
  return url ? (
    <img className="quiz-thumb" src={url} alt="" />
  ) : (
    <span className="quiz-thumb missing" title="Dieses Bild liegt nicht im Medienordner">
      fehlt
    </span>
  )
}

/** optionales Auflösungsbild eines Bild-Hinweises: erscheint statt des Hinweises, sobald aufgelöst ist */
export function RevealSlot({ path, onPick, onClear }: { path?: string; onPick: () => void; onClear: () => void }) {
  return path ? (
    <>
      <span className="hint" title={`Bei der Auflösung: ${path.split('/').pop()}`}>→</span>
      <Thumb path={path} />
      <button className="arrow" aria-label="Auflösungsbild entfernen" onClick={onClear}>
        ✕
      </button>
    </>
  ) : (
    <button title="Bild, das bei der Auflösung an diese Stelle tritt, z. B. rausgezoomt" onClick={onPick}>
      + Auflösung
    </button>
  )
}

/** Auswahl eines Bildes aus dem Medienordner des Spiels; noch nicht verwendete stehen oben. */
export function MediaPicker({
  gameId,
  kind,
  used,
  onPick,
  onClose,
}: {
  gameId: string
  kind: 'image' | 'audio'
  used: Set<string>
  onPick: (path: string) => void
  onClose: () => void
}) {
  const images = mediaFiles(gameId).filter((f) => f.kind === kind)
  const sorted = [...images].sort((a, b) => Number(used.has(a.path)) - Number(used.has(b.path)) || a.name.localeCompare(b.name))
  return (
    <div className="media-picker" onClick={onClose}>
      <div className="media-card" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow">{kind === 'audio' ? 'Song wählen' : 'Bild wählen'}</h2>
          <button onClick={onClose}>Abbrechen</button>
        </div>
        {sorted.length === 0 ? (
          <p className="warn">
            Noch keine {kind === 'audio' ? 'Songs' : 'Bilder'} vorhanden. Lege sie im Repo in <code>{mediaFolder(gameId)}</code> ab und pushe; nach dem Deploy erscheinen sie
            hier.
          </p>
        ) : (
          <div className={kind === 'audio' ? 'media-list' : 'media-grid'}>
            {sorted.map((f) =>
              kind === 'audio' ? (
                <div key={f.path} className={`media-audio${used.has(f.path) ? ' used' : ''}`}>
                  <button className="grow" onClick={() => onPick(f.path)}>
                    {f.name}
                    {used.has(f.path) && <small>schon verwendet</small>}
                  </button>
                  <audio controls preload="none" src={mediaUrl(f.path)!} />
                </div>
              ) : (
                <button key={f.path} className={`media-item${used.has(f.path) ? ' used' : ''}`} onClick={() => onPick(f.path)}>
                  <img src={mediaUrl(f.path)!} alt="" loading="lazy" />
                  <span>{f.name}</span>
                  {used.has(f.path) && <small>schon verwendet</small>}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Picking = { questionId: string; target: 'image' | 'answerImage' | 'hint' | 'audio' } | { questionId: string; target: 'reveal'; hintId: string } | null

/** Vollbild-Editor im Regiepult für die eigenen Inhalte eines Spiels. Speichert automatisch. */
export default function QuizEditor({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const def = gameDef(gameId)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const noAnswer = Boolean(def.quiz?.noAnswer)
  const plainList = Boolean(def.quiz?.plainList)
  const withHints = Boolean(def.quiz?.hints)
  // nur die Lösung, keine eigene Frage: geraten wird über die Hinweise
  const answerOnly = Boolean(def.quiz?.answerOnly)
  const numeric = Boolean(def.quiz?.numeric)
  const withAudio = Boolean(def.quiz?.audio)
  const challenge = Boolean(def.quiz?.challenge)
  // mit Hinweisen ersetzt deren Liste das einzelne Bild
  const singleImage = !plainList && !withHints && !withAudio && !challenge
  // Bild zur Antwort nur bei Quizfragen; Schätzfragen haben ihre eigene Auflösung
  const answerImage = singleImage && !noAnswer && !numeric
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [paste, setPaste] = useState('')
  const [save, setSave] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<Picking>(null)
  const dirty = useRef(false)

  useEffect(() => {
    let cancelled = false
    questionStore
      .list(gameId)
      .then((q) => {
        if (!cancelled) setQuestions(q)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Inhalte konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  // automatisch speichern, kurz nachdem sich etwas geändert hat
  useEffect(() => {
    if (!questions || !dirty.current) return
    const id = window.setTimeout(() => {
      dirty.current = false
      setSave('saving')
      questionStore
        .save(gameId, questions)
        .then(() => setSave('saved'))
        .catch((e: unknown) => {
          setSave('error')
          setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
        })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [questions, gameId])

  const change = (fn: (q: Question[]) => Question[]) => {
    dirty.current = true
    setQuestions((q) => fn(q ?? []))
  }

  const update = (id: string, patch: Partial<Question>) => change((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))

  const move = (index: number, dir: -1 | 1) =>
    change((qs) => {
      const to = index + dir
      if (to < 0 || to >= qs.length) return qs
      const next = [...qs]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })

  const remove = (q: Question) => {
    if (!confirm(`${label} „${(answerOnly ? q.answer : q.question) || 'ohne Text'}“ löschen?`)) return
    change((qs) => qs.filter((x) => x.id !== q.id))
  }

  const addHint = (questionId: string, hint: Omit<Hint, 'id'>) =>
    change((qs) => qs.map((x) => (x.id === questionId ? { ...x, hints: [...x.hints, { id: crypto.randomUUID(), ...hint }] } : x)))

  const removeHint = (q: Question, hint: Hint) => update(q.id, { hints: q.hints.filter((h) => h.id !== hint.id) })

  const moveHint = (q: Question, index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= q.hints.length) return
    const hints = [...q.hints]
    ;[hints[index], hints[to]] = [hints[to], hints[index]]
    update(q.id, { hints })
  }

  const setReveal = (questionId: string, hintId: string, reveal: string | undefined) =>
    change((qs) => qs.map((x) => (x.id === questionId ? { ...x, hints: x.hints.map((h) => (h.id === hintId ? { ...h, reveal } : h)) } : x)))

  const pick = (path: string) => {
    if (!picking) return
    if (picking.target === 'image') update(picking.questionId, { imagePath: path })
    else if (picking.target === 'answerImage') update(picking.questionId, { answerImagePath: path })
    else if (picking.target === 'audio') update(picking.questionId, { audioPath: path })
    else if (picking.target === 'reveal') setReveal(picking.questionId, picking.hintId, path)
    else addHint(picking.questionId, { kind: 'image', value: path })
    setPicking(null)
  }

  const importList = (replace: boolean) => {
    const parsed = parseQuestions(paste, answerOnly).map((p) => newQuestion({ ...p, ...(numeric && detectFormat(p.answer) ? { format: detectFormat(p.answer) } : {}) }))
    if (!parsed.length) return
    if (replace && questions?.length && !confirm(`Alle ${questions.length} Einträge durch ${parsed.length} neue ersetzen?`)) return
    change((qs) => (replace ? parsed : [...qs, ...parsed]))
    setPaste('')
  }

  const loadSamples = () => {
    if (questions?.length && !confirm('Beispielfragen hinten anhängen?')) return
    change((qs) => [...qs, ...(noAnswer ? SAMPLE_PROMPTS : numeric ? SAMPLE_ESTIMATES : SAMPLE_QUESTIONS).map((p) => newQuestion(p))])
  }

  const parsedCount = paste.trim() ? parseQuestions(paste, answerOnly).length : 0
  const used = new Set((questions ?? []).flatMap((q) => [q.imagePath, q.answerImagePath, q.audioPath, ...q.hints.filter((h) => h.kind === 'image').flatMap((h) => [h.value, h.reveal])]).filter((p): p is string => Boolean(p)))
  const format = answerOnly ? `${label} | Zusatzinfo` : noAnswer ? label : `${label} | Antwort | Zusatzinfo`

  return (
    <div className="quiz-editor">
      <header className="row">
        <h1 className="grow">
          {def.name}
          <small>
            {questions?.length ?? 0} {label === 'Frage' ? 'Fragen' : `× ${label}`}
          </small>
        </h1>
        <span className={`save-state ${save}`}>
          {save === 'saving' ? 'Speichert…' : save === 'saved' ? 'Gespeichert ✓' : save === 'error' ? 'Nicht gespeichert' : ''}
        </span>
        <button className="primary" onClick={onClose}>
          Fertig
        </button>
      </header>
      {error && <p className="warn">{error}</p>}

      <section className="card">
        <h2>Liste einfügen</h2>
        <p className="hint">
          Eine Zeile pro {label}
          {format !== label && (
            <>
              : <code>{format}</code>
            </>
          )}
          . Aus Excel oder Google Sheets kopierte Zeilen funktionieren direkt.
        </p>
        <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={format} />
        <div className="row">
          <button className="primary" disabled={!parsedCount} onClick={() => importList(false)}>
            {parsedCount ? `${parsedCount} anhängen` : 'Anhängen'}
          </button>
          <button disabled={!parsedCount} onClick={() => importList(true)}>
            Alle ersetzen
          </button>
          <span className="grow" />
          {!plainList && !answerOnly && !challenge && <button onClick={loadSamples}>Beispielfragen laden</button>}
        </div>
      </section>

      {!questions && !error && <p className="hint">Lade…</p>}
      {questions?.map((q, i) => (
        <motion.div key={q.id} layout transition={SPRING} className="card quiz-item">
          <div className="row tight">
            <b className="num">{pad(i + 1)}</b>
            {answerOnly ? (
              <input className="grow" value={q.answer} placeholder={`${label} (Lösung)`} onChange={(e) => update(q.id, { answer: e.target.value })} />
            ) : (
              <textarea
                className="grow"
                rows={plainList ? 1 : 2}
                value={q.question}
                placeholder={label}
                onChange={(e) => update(q.id, { question: e.target.value })}
              />
            )}
            <div className="arrows">
              <button className="arrow" aria-label="nach oben" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button className="arrow" aria-label="nach unten" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
            </div>
          </div>
          {!noAnswer && !answerOnly && (
            <div className="row tight">
              <span className="num" />
              {numeric ? (
                <>
                  <select value={q.format ?? 'number'} aria-label="Format der Lösung" onChange={(e) => update(q.id, { format: e.target.value as Question['format'] })}>
                    {ANSWER_FORMATS.map(([key, text]) => (
                      <option key={key} value={key}>
                        {text}
                      </option>
                    ))}
                  </select>
                  <AnswerInput
                    className={`grow${q.answer && parseAnswer(q.answer, q.format) === null ? ' invalid' : ''}`}
                    format={q.format}
                    value={q.answer}
                    placeholder={(q.format ?? 'number') === 'number' ? 'Lösung als Zahl, z. B. 1.250 oder 3,5' : undefined}
                    onChange={(answer) => update(q.id, { answer })}
                  />
                </>
              ) : (
                <input className="grow" value={q.answer} placeholder="Antwort" onChange={(e) => update(q.id, { answer: e.target.value })} />
              )}
            </div>
          )}
          {!noAnswer && (!numeric || (q.format ?? 'number') === 'number') && (
            <div className="row tight">
              <span className="num" />
              <input className="grow" value={q.info} placeholder={numeric ? 'Einheit, z. B. Meter (für alle sichtbar)' : 'Zusatzinfo (optional)'} onChange={(e) => update(q.id, { info: e.target.value })} />
            </div>
          )}
          {challenge && <ChallengeFields q={q} onChange={(patch) => update(q.id, patch)} onPickImage={() => setPicking({ questionId: q.id, target: 'hint' })} />}
          {withHints && (
            <div className="hint-list">
              <div className="hint">Hinweise in der Reihenfolge, in der sie aufgedeckt werden. Der erste erscheint sofort.</div>
              {q.hints.map((h, hi) => (
                <div key={h.id} className="row tight">
                  <b className="num">{hi + 1}</b>
                  {h.kind === 'image' ? (
                    <>
                      <Thumb path={h.value} />
                      <span className="grow hint file-name">{h.value.split('/').pop()}</span>
                      <RevealSlot
                        path={h.reveal}
                        onPick={() => setPicking({ questionId: q.id, target: 'reveal', hintId: h.id })}
                        onClear={() => setReveal(q.id, h.id, undefined)}
                      />
                    </>
                  ) : (
                    <input
                      className="grow"
                      value={h.value}
                      placeholder="Text-Hinweis"
                      onChange={(e) => update(q.id, { hints: q.hints.map((x) => (x.id === h.id ? { ...x, value: e.target.value } : x)) })}
                    />
                  )}
                  <button className="arrow" aria-label="Hinweis nach oben" disabled={hi === 0} onClick={() => moveHint(q, hi, -1)}>
                    ↑
                  </button>
                  <button className="arrow" aria-label="Hinweis löschen" onClick={() => removeHint(q, h)}>
                    ✕
                  </button>
                </div>
              ))}
              <div className="row">
                <button onClick={() => setPicking({ questionId: q.id, target: 'hint' })}>+ Bild-Hinweis</button>
                <button onClick={() => addHint(q.id, { kind: 'text', value: '' })}>+ Text-Hinweis</button>
              </div>
            </div>
          )}
          {withAudio && (
            <div className="hint-list">
              {q.audioPath ? (
                <>
                  <div className="row tight">
                    <span className="grow file-name">{q.audioPath.split('/').pop()}</span>
                    <button onClick={() => setPicking({ questionId: q.id, target: 'audio' })}>Song ändern</button>
                  </div>
                  {mediaUrl(q.audioPath) ? <audio controls preload="none" src={mediaUrl(q.audioPath)!} /> : <p className="warn">Diese Datei liegt nicht im Medienordner.</p>}
                  <div className="row tight value-row">
                    <span className="grow hint">Start bei Sekunde (ab dem ersten Ton)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      inputMode="decimal"
                      value={q.audioStart ?? 0}
                      onChange={(e) => update(q.id, { audioStart: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <span className="unit">s</span>
                  </div>
                </>
              ) : (
                <button onClick={() => setPicking({ questionId: q.id, target: 'audio' })}>Song wählen</button>
              )}
            </div>
          )}
          <div className="row image-row">
            <span className="num" />
            {singleImage && q.imagePath && <Thumb path={q.imagePath} />}
            {singleImage && (
              <button onClick={() => setPicking({ questionId: q.id, target: 'image' })}>{q.imagePath ? 'Bild ändern' : 'Bild wählen'}</button>
            )}
            {singleImage && q.imagePath && <button onClick={() => update(q.id, { imagePath: null })}>Bild entfernen</button>}
            {answerImage && q.answerImagePath && <Thumb path={q.answerImagePath} />}
            {answerImage && (
              <button title="erscheint erst mit der Antwort" onClick={() => setPicking({ questionId: q.id, target: 'answerImage' })}>
                {q.answerImagePath ? 'Auflösungsbild ändern' : '+ Auflösungsbild'}
              </button>
            )}
            {answerImage && q.answerImagePath && <button onClick={() => update(q.id, { answerImagePath: null })}>Auflösungsbild entfernen</button>}
            <span className="grow" />
            <button className="danger" onClick={() => remove(q)}>
              Löschen
            </button>
          </div>
        </motion.div>
      ))}
      {questions && <button onClick={() => change((qs) => [...qs, newQuestion()])}>+ {label} hinzufügen</button>}

      {picking && (
        <MediaPicker gameId={gameId} kind={picking.target === 'audio' ? 'audio' : 'image'} used={used} onPick={pick} onClose={() => setPicking(null)} />
      )}
    </div>
  )
}

/** Mein Team kann: Baustein einer Aufgabe und was er braucht (Antwortliste, Timer, Bilder) */
export function ChallengeFields({ q, onChange, onPickImage }: { q: Question; onChange: (patch: Partial<Question>) => void; onPickImage: () => void }) {
  const config = q.challenge ?? { type: 'count' as const }
  const texts = q.hints.filter((h) => h.kind === 'text')
  const images = q.hints.filter((h) => h.kind === 'image')
  // die Liste als Text; Leerzeilen bleiben beim Tippen stehen und fallen erst beim Speichern als Eintrag weg
  const [draft, setDraft] = useState(() => texts.map((h) => h.value).join('\n'))

  const setList = (text: string) => {
    setDraft(text)
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    onChange({ hints: [...lines.map((value, i) => ({ id: texts[i]?.id ?? crypto.randomUUID(), kind: 'text' as const, value })), ...images] })
  }

  return (
    <div className="hint-list">
      <div className="row tight">
        <span className="grow hint">Baustein</span>
        <select value={config.type} aria-label="Baustein der Aufgabe" onChange={(e) => onChange({ challenge: { ...config, type: e.target.value as ChallengeType } })}>
          {CHALLENGE_TYPES.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </div>
      {config.type === 'count' && <div className="hint">Runden: Spieler im spielenden Team − 1, im Spiel änderbar. Geschafft, wenn die Summe das Ziel erreicht.</div>}
      {config.type === 'free' && <div className="hint">Keine feste Liste: Das Genannte tippst du im Spiel ein.</div>}
      {config.type === 'list' && (
        <>
          <div className="hint">Alle richtigen Antworten, eine pro Zeile ({texts.length})</div>
          <textarea rows={6} value={draft} placeholder={'Manuel Neuer\nPhilipp Lahm\n…'} onChange={(e) => setList(e.target.value)} />
        </>
      )}
      {config.type === 'time' && (
        <>
          <div className="row tight value-row">
            <span className="grow hint">Timer (Zeiten werden addiert, geschafft bei mehr als der Zielzeit)</span>
            <input
              type="number"
              min={1}
              max={6}
              value={config.timers ?? 1}
              onChange={(e) => onChange({ challenge: { ...config, timers: Math.min(6, Math.max(1, Number(e.target.value) || 1)) } })}
            />
          </div>
          <div className="hint">Bilder, die du im Spiel nacheinander zeigen kannst (optional)</div>
          {images.map((h) => (
            <div key={h.id} className="row tight">
              <Thumb path={h.value} />
              <span className="grow hint file-name">{h.value.split('/').pop()}</span>
              <button className="arrow" aria-label="Bild entfernen" onClick={() => onChange({ hints: q.hints.filter((x) => x.id !== h.id) })}>
                ✕
              </button>
            </div>
          ))}
          <div className="row">
            <button onClick={onPickImage}>+ Bild</button>
          </div>
        </>
      )}
    </div>
  )
}
