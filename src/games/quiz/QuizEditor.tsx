import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import './quiz.css'
import { SPRING } from '../../lib/motion'
import { gameDef } from '../catalog'
import { parseQuestions } from './parse'
import { newQuestion, questionStore, type Hint, type Question } from './questionStore'
import { SAMPLE_PROMPTS, SAMPLE_QUESTIONS } from './samples'

const pad = (n: number) => String(n).padStart(2, '0')
const SAVE_DELAY_MS = 600

/** Vorschaubild; holt bei Supabase eine Signed URL. */
function Thumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void questionStore.imageUrl(path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [path])
  return url ? <img className="quiz-thumb" src={url} alt="" /> : <span className="quiz-thumb" />
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Vollbild-Editor im Regiepult für die eigenen Fragen eines Quiz-Spiels. Speichert automatisch. */
export default function QuizEditor({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const def = gameDef(gameId)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const noAnswer = Boolean(def.quiz?.noAnswer)
  const plainList = Boolean(def.quiz?.plainList)
  const withHints = Boolean(def.quiz?.hints)
  // mit Hinweisen ersetzt deren Liste das einzelne Bild
  const singleImage = !plainList && !withHints
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [paste, setPaste] = useState('')
  const [save, setSave] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const dirty = useRef(false)

  useEffect(() => {
    let cancelled = false
    questionStore
      .list(gameId)
      .then((q) => {
        if (!cancelled) setQuestions(q)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fragen konnten nicht geladen werden')
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
    if (!confirm(`${label} „${q.question || 'ohne Text'}“ löschen?`)) return
    if (q.imagePath) void questionStore.removeImage(q.imagePath)
    for (const h of q.hints) if (h.kind === 'image') void questionStore.removeImage(h.value)
    change((qs) => qs.filter((x) => x.id !== q.id))
  }

  const addHint = (q: Question, hint: Omit<Hint, 'id'>) =>
    change((qs) => qs.map((x) => (x.id === q.id ? { ...x, hints: [...x.hints, { id: crypto.randomUUID(), ...hint }] } : x)))

  const addImageHint = async (q: Question, file: File | undefined) => {
    if (!file) return
    try {
      addHint(q, { kind: 'image', value: await questionStore.uploadImage(file) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bild konnte nicht hochgeladen werden')
    }
  }

  const removeHint = (q: Question, hint: Hint) => {
    if (hint.kind === 'image') void questionStore.removeImage(hint.value)
    update(q.id, { hints: q.hints.filter((h) => h.id !== hint.id) })
  }

  const moveHint = (q: Question, index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= q.hints.length) return
    const hints = [...q.hints]
    ;[hints[index], hints[to]] = [hints[to], hints[index]]
    update(q.id, { hints })
  }

  const importList = (replace: boolean) => {
    const parsed = parseQuestions(paste).map((p) => newQuestion(p))
    if (!parsed.length) return
    if (replace && questions?.length && !confirm(`Alle ${questions.length} Einträge durch ${parsed.length} neue ersetzen?`)) return
    change((qs) => (replace ? parsed : [...qs, ...parsed]))
    setPaste('')
  }

  const loadSamples = () => {
    if (questions?.length && !confirm('Beispielfragen hinten anhängen?')) return
    change((qs) => [...qs, ...(noAnswer ? SAMPLE_PROMPTS : SAMPLE_QUESTIONS).map((p) => newQuestion(p))])
  }

  const upload = async (q: Question, file: File | undefined) => {
    if (!file) return
    try {
      const path = await questionStore.uploadImage(file)
      if (q.imagePath) void questionStore.removeImage(q.imagePath)
      update(q.id, { imagePath: path })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bild konnte nicht hochgeladen werden')
    }
  }

  const parsedCount = paste.trim() ? parseQuestions(paste).length : 0

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
          {noAnswer ? (
            <>Eine Zeile pro {label}. Aus Excel oder Google Sheets kopierte Zeilen funktionieren direkt.</>
          ) : (
            <>
              Eine Zeile pro {label}: <code>{label} | Antwort | Zusatzinfo</code>. Aus Excel oder Google Sheets kopierte Zeilen (Spalten
              Frage, Antwort, Info) funktionieren direkt.
            </>
          )}
        </p>
        <textarea
          rows={5}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={noAnswer ? label : `${label} | Antwort | Zusatzinfo (optional)`}
        />
        <div className="row">
          <button className="primary" disabled={!parsedCount} onClick={() => importList(false)}>
            {parsedCount ? `${parsedCount} anhängen` : 'Anhängen'}
          </button>
          <button disabled={!parsedCount} onClick={() => importList(true)}>
            Alle ersetzen
          </button>
          <span className="grow" />
          {!plainList && <button onClick={loadSamples}>Beispielfragen laden</button>}
        </div>
      </section>

      {!questions && !error && <p className="hint">Lade…</p>}
      {questions?.map((q, i) => (
        <motion.div key={q.id} layout transition={SPRING} className="card quiz-item">
          <div className="row tight">
            <b className="num">{pad(i + 1)}</b>
            <textarea
              className="grow"
              rows={plainList ? 1 : 2}
              value={q.question}
              placeholder={label}
              onChange={(e) => update(q.id, { question: e.target.value })}
            />
            <div className="arrows">
              <button className="arrow" aria-label="nach oben" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button className="arrow" aria-label="nach unten" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
            </div>
          </div>
          {!noAnswer && (
            <>
              <div className="row tight">
                <span className="num" />
                <input className="grow" value={q.answer} placeholder="Antwort" onChange={(e) => update(q.id, { answer: e.target.value })} />
              </div>
              <div className="row tight">
                <span className="num" />
                <input className="grow" value={q.info} placeholder="Zusatzinfo (optional)" onChange={(e) => update(q.id, { info: e.target.value })} />
              </div>
            </>
          )}
          {withHints && (
            <div className="hint-list">
              <div className="hint">Hinweise in der Reihenfolge, in der sie aufgedeckt werden. Der erste erscheint sofort mit der Frage.</div>
              {q.hints.map((h, hi) => (
                <div key={h.id} className="row tight">
                  <b className="num">{hi + 1}</b>
                  {h.kind === 'image' ? (
                    <>
                      <Thumb path={h.value} />
                      <span className="grow hint">Bild</span>
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
                <label className="file-btn">
                  + Bild-Hinweis
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      void addImageHint(q, e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <button onClick={() => addHint(q, { kind: 'text', value: '' })}>+ Text-Hinweis</button>
              </div>
            </div>
          )}
          <div className="row image-row">
            <span className="num" />
            {singleImage && q.imagePath && <Thumb path={q.imagePath} />}
            {singleImage && (
            <label className="file-btn">
              {q.imagePath ? 'Bild ändern' : 'Bild hinzufügen'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void upload(q, e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            )}
            {singleImage && q.imagePath && (
              <button
                onClick={() => {
                  void questionStore.removeImage(q.imagePath!)
                  update(q.id, { imagePath: null })
                }}
              >
                Bild entfernen
              </button>
            )}
            <span className="grow" />
            <button className="danger" onClick={() => remove(q)}>
              Löschen
            </button>
          </div>
        </motion.div>
      ))}
      {questions && (
        <button onClick={() => change((qs) => [...qs, newQuestion()])}>+ {label} hinzufügen</button>
      )}
    </div>
  )
}
