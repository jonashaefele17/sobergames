import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { motion } from 'motion/react'
import '../host/host.css'
import '../games/quiz/quiz.css'
import './collect.css'
import { SPRING } from '../lib/motion'
import { signOutHost, useHostSession } from '../lib/hostAuth'
import Login from '../host/Login'
import { gameDef } from '../games/catalog'
import { mediaUrl } from '../games/common/media'
import { MediaPicker, Thumb } from '../games/quiz/QuizEditor'
import { newQuestion, questionStore, type Hint, type Question } from '../games/quiz/questionStore'
import { ANSWER_FORMATS, detectFormat, formatAnswer, parseAnswer, type AnswerFormat } from '../games/estimate/logic'
import AnswerInput from '../games/estimate/AnswerInput'
import { parseQuestions } from '../games/quiz/parse'
import { countStatus, gameToIdeas, hasGameList, IDEA_GAMES, ideaKey, ideaProblems, ideaTitle, starredToGame, type IdeaStatus } from './ideas'
import PrintTerms from './PrintTerms'
import QuestionFiles from './QuestionFiles'

const pad = (n: number) => String(n).padStart(2, '0')
const SAVE_DELAY_MS = 600

type Lists = Record<string, Question[]>
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Filter = 'all' | 'open' | IdeaStatus

const STATUS_BUTTONS: [IdeaStatus, string, string][] = [
  ['star', '⭐', 'drin'],
  ['maybe', '🤔', 'vielleicht'],
  ['out', '🗑', 'raus'],
]
const FILTERS: [Filter, string][] = [
  ['all', 'Alle'],
  ['star', '⭐'],
  ['maybe', '🤔'],
  ['open', 'Offen'],
  ['out', '🗑'],
]

const matches = (filter: Filter) => (q: Question) => filter === 'all' || (q.status ?? 'open') === filter

const ANSWER_LABEL: Record<AnswerFormat, string> = { number: 'Lösung als Zahl', year: 'Lösung als Jahr', date: 'Lösung als Datum' }

/** Lösung einer Schätzfrage so, wie sie am Abend erscheint; ungültige bleiben als Text stehen */
function numericAnswer(q: Question): string {
  const value = parseAnswer(q.answer, q.format)
  if (value === null) return q.answer || '–'
  return `${formatAnswer(value, q.format)}${(q.format ?? 'number') === 'number' && q.info ? ` ${q.info}` : ''}`
}

const itemLabel = (gameId: string) => IDEA_GAMES.find((g) => g.id === gameId)?.label ?? gameDef(gameId).quiz?.itemLabel ?? 'Frage'

/** Speicherfehler verständlich machen: meist fehlen nur die neuen Spalten in der Datenbank */
function saveError(e: unknown): string {
  const text = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
  return /column|schema/i.test(text) ? 'Die Datenbank kennt die Sammlung noch nicht: supabase/schema.sql einmal im SQL-Editor ausführen.' : text
}

/** Eine Idee in der Liste: antippen zeigt die Lösung, darunter Bewertung und Sortieren */
function IdeaCard({
  gameId,
  q,
  index,
  open,
  first,
  last,
  onToggle,
  onStatus,
  onMove,
  onEdit,
}: {
  gameId: string
  q: Question
  index: number
  open: boolean
  first: boolean
  last: boolean
  onToggle: () => void
  onStatus: (status: IdeaStatus) => void
  onMove: (dir: -1 | 1) => void
  onEdit: () => void
}) {
  const quiz = gameDef(gameId).quiz
  const showAnswer = quiz && !quiz.noAnswer && !quiz.answerOnly
  const problems = q.status === 'star' ? ideaProblems(gameId, q) : []
  return (
    <motion.div layout transition={SPRING} className={`card idea ${q.status ?? 'open'}`}>
      <button className="idea-main" onClick={onToggle} aria-expanded={open}>
        <b className="num">{pad(index + 1)}</b>
        <span className="grow idea-title">{ideaTitle(q) || 'ohne Text'}</span>
        <span className="idea-more">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="idea-details">
          {showAnswer && (
            <p className="idea-answer">{quiz.numeric ? numericAnswer(q) : q.answer || '–'}</p>
          )}
          {q.info && !quiz?.numeric && <p className="hint">{q.info}</p>}
          {q.imagePath && <Thumb path={q.imagePath} />}
          {q.hints.length > 0 && (
            <ol className="idea-hints">
              {q.hints.map((h) => (
                <li key={h.id}>{h.kind === 'image' ? <Thumb path={h.value} /> : h.value}</li>
              ))}
            </ol>
          )}
          {q.audioPath && <p className="hint">🎵 {q.audioPath.split('/').pop()}{q.audioStart ? ` · ab ${q.audioStart} s` : ''}</p>}
          {q.note && <p className="idea-note">{q.note}</p>}
        </div>
      )}
      {problems.length > 0 && <p className="idea-warn">{problems.join(' · ')}</p>}
      <div className="row tight idea-actions">
        {STATUS_BUTTONS.map(([status, icon, label]) => (
          <button key={status} className={`idea-status${q.status === status ? ` on-${status}` : ''}`} aria-label={label} aria-pressed={q.status === status} onClick={() => onStatus(status)}>
            {icon}
          </button>
        ))}
        <span className="grow" />
        <button className="arrow" aria-label="nach oben" disabled={first} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="arrow" aria-label="nach unten" disabled={last} onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="arrow" aria-label="bearbeiten" onClick={onEdit}>
          ✎
        </button>
      </div>
    </motion.div>
  )
}

/**
 * Schnelleingabe für breite Bildschirme: tippen, Enter, nächster. Mehrere
 * eingefügte Zeilen werden zu je einem Eintrag (Spalten mit Tab oder „|“).
 * Bilder, Hinweise und Songs kommen danach über ✎ dazu.
 */
function QuickAdd({ gameId, onAdd }: { gameId: string; onAdd: (qs: Question[]) => void }) {
  const quiz = gameDef(gameId).quiz
  const label = itemLabel(gameId)
  const answerOnly = Boolean(quiz?.answerOnly)
  const withAnswer = Boolean(quiz && !quiz.noAnswer && !answerOnly)
  const numeric = Boolean(quiz?.numeric)
  const [main, setMain] = useState('')
  const [answer, setAnswer] = useState('')
  const [info, setInfo] = useState('')
  const [format, setFormat] = useState<AnswerFormat>('number')
  const [star, setStar] = useState(false)
  const [added, setAdded] = useState<Question[]>([])
  const mainRef = useRef<HTMLInputElement>(null)

  const add = (qs: Question[]) => {
    if (!qs.length) return
    onAdd(qs)
    setAdded((a) => [...qs.slice().reverse(), ...a].slice(0, 6))
    setMain('')
    setAnswer('')
    // die Einheit gilt meist für mehrere Schätzfragen hintereinander
    if (!numeric) setInfo('')
    mainRef.current?.focus()
  }

  const extra = { note: '', ...(star ? { status: 'star' as const } : {}) }
  const withUnit = !numeric || format === 'number'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!main.trim()) return
    add([
      newQuestion({
        ...(answerOnly ? { answer: main.trim() } : { question: main.trim(), answer: answer.trim() }),
        info: withUnit ? info.trim() : '',
        ...(numeric ? { format } : {}),
        ...extra,
      }),
    ])
  }

  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!text.trim().includes('\n')) return
    e.preventDefault()
    // bei Schätzfragen erkennt eine Lösung wie „09.11.1989“ das Datum von selbst
    add(parseQuestions(text, answerOnly).map((p) => newQuestion({ ...p, ...(numeric ? { format: detectFormat(p.answer) ?? 'number' } : {}), ...extra })))
  }

  return (
    <form className="card quick-add" onSubmit={submit}>
      <div className="row tight">
        <input
          ref={mainRef}
          className="grow"
          value={main}
          placeholder={answerOnly ? `${label} (Lösung)` : label}
          aria-label={label}
          onChange={(e) => setMain(e.target.value)}
          onPaste={paste}
        />
        {numeric && (
          <select value={format} aria-label="Format der Lösung" onChange={(e) => setFormat(e.target.value as AnswerFormat)}>
            {ANSWER_FORMATS.map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        )}
        {withAnswer &&
          (numeric ? (
            <AnswerInput className="mid" format={format} value={answer} placeholder={format === 'number' ? 'Zahl' : undefined} aria-label="Lösung" onChange={setAnswer} />
          ) : (
            <input className="quick-answer" value={answer} placeholder="Antwort" aria-label="Antwort" onChange={(e) => setAnswer(e.target.value)} />
          ))}
        {withAnswer && withUnit && (
          <input
            className={numeric ? 'short' : 'quick-info'}
            value={info}
            placeholder={numeric ? 'Einheit' : 'Zusatzinfo'}
            aria-label={numeric ? 'Einheit' : 'Zusatzinfo'}
            onChange={(e) => setInfo(e.target.value)}
          />
        )}
        <button type="button" className={`idea-status${star ? ' on-star' : ''}`} aria-pressed={star} title="neue Einträge gleich mit ⭐" onClick={() => setStar((s) => !s)}>
          ⭐
        </button>
        <button type="submit" className="primary" disabled={!main.trim()}>
          Hinzufügen
        </button>
      </div>
      <p className="hint">Enter fügt hinzu. Mehrere Zeilen einfügen legt alle auf einmal an{withAnswer ? ' (Spalten mit Tab oder „|“)' : ''}.</p>
      {added.length > 0 && (
        <ul className="quick-added">
          {added.map((q) => (
            <li key={q.id}>
              {q.status === 'star' && '⭐ '}
              {ideaTitle(q)}
              {withAnswer && q.answer && <small> · {numeric ? numericAnswer(q) : q.answer}</small>}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

type Picking = 'image' | 'hint' | 'audio' | null

/** Eingabe einer Idee mit genau den Feldern, die das Spiel braucht */
function IdeaSheet({
  gameId,
  initial,
  isNew,
  used,
  onSave,
  onDelete,
  onClose,
}: {
  gameId: string
  initial: Question
  isNew: boolean
  used: Set<string>
  onSave: (q: Question, next: boolean) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState(initial)
  const [picking, setPicking] = useState<Picking>(null)
  const quiz = gameDef(gameId).quiz
  const label = itemLabel(gameId)
  const answerOnly = Boolean(quiz?.answerOnly)
  const withAnswer = Boolean(quiz && !quiz.noAnswer && !answerOnly)
  const withInfo = Boolean(quiz && !quiz.noAnswer)
  const singleImage = Boolean(quiz && !quiz.plainList && !quiz.hints && !quiz.audio && !quiz.noAnswer)
  const update = (patch: Partial<Question>) => setQ((x) => ({ ...x, ...patch }))
  const setHints = (hints: Hint[]) => update({ hints })
  const moveHint = (index: number) => {
    if (index === 0) return
    const hints = [...q.hints]
    ;[hints[index - 1], hints[index]] = [hints[index], hints[index - 1]]
    setHints(hints)
  }
  const pick = (path: string) => {
    if (picking === 'image') update({ imagePath: path })
    else if (picking === 'audio') update({ audioPath: path })
    else setHints([...q.hints, { id: crypto.randomUUID(), kind: 'image', value: path }])
    setPicking(null)
  }
  const empty = !ideaTitle(q)

  return (
    <div className="quiz-editor idea-sheet">
      <header className="row">
        <h1 className="grow">
          {isNew ? `${label} hinzufügen` : 'Bearbeiten'}
          <small>{gameDef(gameId).name}</small>
        </h1>
        <button onClick={onClose}>Abbrechen</button>
      </header>

      <label className="field">
        <span>{answerOnly ? `${label} (Lösung)` : label}</span>
        {answerOnly ? (
          <input autoFocus={isNew} value={q.answer} onChange={(e) => update({ answer: e.target.value })} />
        ) : (
          <textarea autoFocus={isNew} rows={3} value={q.question} onChange={(e) => update({ question: e.target.value })} />
        )}
      </label>
      {quiz?.numeric && (
        <div className="field">
          <span>Gesucht ist</span>
          <div className="seg">
            {ANSWER_FORMATS.map(([key, text]) => (
              <button key={key} className={(q.format ?? 'number') === key ? 'on' : ''} onClick={() => update({ format: key })}>
                {text}
              </button>
            ))}
          </div>
        </div>
      )}
      {withAnswer && (
        <label className="field">
          <span>{quiz?.numeric ? ANSWER_LABEL[q.format ?? 'number'] : 'Antwort'}</span>
          {quiz?.numeric ? (
            <AnswerInput
              className={q.answer && parseAnswer(q.answer, q.format) === null ? 'invalid' : ''}
              format={q.format}
              value={q.answer}
              placeholder={(q.format ?? 'number') === 'number' ? 'z. B. 1.250 oder 3,5' : undefined}
              onChange={(answer) => update({ answer })}
            />
          ) : (
            <input value={q.answer} onChange={(e) => update({ answer: e.target.value })} />
          )}
        </label>
      )}
      {withInfo && (!quiz?.numeric || (q.format ?? 'number') === 'number') && (
        <label className="field">
          <span>{quiz?.numeric ? 'Einheit (für alle sichtbar)' : 'Zusatzinfo (optional)'}</span>
          <input value={q.info} placeholder={quiz?.numeric ? 'z. B. Meter' : ''} onChange={(e) => update({ info: e.target.value })} />
        </label>
      )}

      {quiz?.hints && (
        <div className="hint-list">
          <div className="hint">Hinweise in der Reihenfolge, in der sie aufgedeckt werden. Der erste erscheint sofort.</div>
          {q.hints.map((h, i) => (
            <div key={h.id} className="row tight">
              <b className="num">{i + 1}</b>
              {h.kind === 'image' ? (
                <>
                  <Thumb path={h.value} />
                  <span className="grow hint file-name">{h.value.split('/').pop()}</span>
                </>
              ) : (
                <input className="grow" value={h.value} placeholder="Text-Hinweis" onChange={(e) => setHints(q.hints.map((x) => (x.id === h.id ? { ...x, value: e.target.value } : x)))} />
              )}
              <button className="arrow" aria-label="Hinweis nach oben" disabled={i === 0} onClick={() => moveHint(i)}>
                ↑
              </button>
              <button className="arrow" aria-label="Hinweis löschen" onClick={() => setHints(q.hints.filter((x) => x.id !== h.id))}>
                ✕
              </button>
            </div>
          ))}
          <div className="row">
            <button onClick={() => setPicking('hint')}>+ Bild-Hinweis</button>
            <button onClick={() => setHints([...q.hints, { id: crypto.randomUUID(), kind: 'text', value: '' }])}>+ Text-Hinweis</button>
          </div>
        </div>
      )}

      {quiz?.audio && (
        <div className="hint-list">
          {q.audioPath ? (
            <>
              <div className="row tight">
                <span className="grow file-name">{q.audioPath.split('/').pop()}</span>
                <button onClick={() => setPicking('audio')}>Song ändern</button>
              </div>
              {mediaUrl(q.audioPath) && <audio controls preload="none" src={mediaUrl(q.audioPath)!} />}
              <div className="row tight value-row">
                <span className="grow hint">Start bei Sekunde (ab dem ersten Ton)</span>
                <input
                  type="number"
                  className="short"
                  min={0}
                  step="0.1"
                  inputMode="decimal"
                  value={q.audioStart ?? 0}
                  onChange={(e) => update({ audioStart: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setPicking('audio')}>Song wählen</button>
              <p className="hint">Noch nicht im Medienordner? Dann einfach später wählen und den Dateinamen solange in die Notiz schreiben.</p>
            </>
          )}
        </div>
      )}

      {singleImage && (
        <div className="row">
          {q.imagePath && <Thumb path={q.imagePath} />}
          <button onClick={() => setPicking('image')}>{q.imagePath ? 'Bild ändern' : 'Bild wählen (optional)'}</button>
          {q.imagePath && <button onClick={() => update({ imagePath: null })}>Bild entfernen</button>}
        </div>
      )}

      <label className="field">
        <span>Notiz (nur für dich, z. B. Quelle)</span>
        <textarea rows={2} value={q.note ?? ''} onChange={(e) => update({ note: e.target.value })} />
      </label>

      <div className="field">
        <span>Bewertung</span>
        <div className="row tight">
          {STATUS_BUTTONS.map(([status, icon, text]) => (
            <button key={status} className={`grow idea-status${q.status === status ? ` on-${status}` : ''}`} onClick={() => update({ status: q.status === status ? undefined : status })}>
              {icon} {text}
            </button>
          ))}
        </div>
      </div>

      <div className="row sheet-actions">
        {!isNew && (
          <button className="danger" onClick={onDelete}>
            Löschen
          </button>
        )}
        <span className="grow" />
        {isNew && (
          <button disabled={empty} onClick={() => onSave(q, true)}>
            Speichern & nächste
          </button>
        )}
        <button className="primary" disabled={empty} onClick={() => onSave(q, false)}>
          {isNew ? 'Speichern' : 'Fertig'}
        </button>
      </div>

      {picking && <MediaPicker gameId={gameId} kind={picking === 'audio' ? 'audio' : 'image'} used={used} onPick={pick} onClose={() => setPicking(null)} />}
    </div>
  )
}

function CollectPage({ local }: { local: boolean }) {
  const [ideas, setIdeas] = useState<Lists | null>(null)
  /** Anzahl Einträge, die gerade wirklich im Spiel stehen */
  const [inGame, setInGame] = useState<Record<string, number>>({})
  const [reload, setReload] = useState(0)
  const [gameId, setGameId] = useState(IDEA_GAMES[0].id)
  const [filter, setFilter] = useState<Filter>('all')
  /** zugeklappte Karten; alle anderen zeigen Antwort, Hinweise und Notiz */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ draft: Question; isNew: boolean } | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const dirty = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      Promise.all(IDEA_GAMES.map(async (g) => [g.id, await questionStore.list(ideaKey(g.id))] as const)),
      Promise.all(IDEA_GAMES.filter((g) => hasGameList(g.id)).map(async (g) => [g.id, (await questionStore.list(g.id)).length] as const)),
    ])
      .then(([lists, counts]) => {
        if (cancelled) return
        setIdeas(Object.fromEntries(lists))
        setInGame(Object.fromEntries(counts))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Sammlung konnte nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  // automatisch speichern, kurz nachdem sich etwas geändert hat
  useEffect(() => {
    if (!ideas || dirty.current.size === 0) return
    const id = window.setTimeout(() => {
      const keys = [...dirty.current]
      dirty.current.clear()
      setSave('saving')
      Promise.all(keys.map((key) => questionStore.save(ideaKey(key), ideas[key] ?? [])))
        .then(() => {
          setSave('saved')
          setError(null)
        })
        .catch((e: unknown) => {
          setSave('error')
          setError(saveError(e))
        })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [ideas])

  if (!ideas) return <div className="host collect">{error ? <p className="warn">{error}</p> : 'Lade…'}</div>

  const game = IDEA_GAMES.find((g) => g.id === gameId)!
  const def = gameDef(gameId)
  const list = ideas[gameId] ?? []
  const visible = list.filter(matches(filter))
  const stars = countStatus(list, 'star')
  const label = itemLabel(gameId)
  const used = new Set(list.flatMap((q) => [q.imagePath, q.audioPath, ...q.hints.filter((h) => h.kind === 'image').map((h) => h.value)]).filter((p): p is string => Boolean(p)))

  const change = (fn: (qs: Question[]) => Question[]) => {
    dirty.current.add(gameId)
    setIdeas((all) => (all ? { ...all, [gameId]: fn(all[gameId] ?? []) } : all))
  }
  const update = (id: string, patch: Partial<Question>) => change((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))

  /** verschiebt innerhalb der gerade sichtbaren Einträge */
  const move = (q: Question, dir: -1 | 1) =>
    change((qs) => {
      const shown = qs.filter(matches(filter))
      const other = shown[shown.findIndex((x) => x.id === q.id) + dir]
      if (!other) return qs
      return qs.map((x) => (x.id === q.id ? other : x.id === other.id ? q : x))
    })

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const saveDraft = (q: Question, next: boolean) => {
    const isNew = editing?.isNew
    change((qs) => (isNew ? [...qs, q] : qs.map((x) => (x.id === q.id ? q : x))))
    setEditing(next ? { draft: newQuestion({ note: '' }), isNew: true } : null)
  }

  const remove = (q: Question) => {
    if (!confirm(`„${ideaTitle(q) || 'ohne Text'}“ löschen?`)) return
    change((qs) => qs.filter((x) => x.id !== q.id))
    setEditing(null)
  }

  const takeOver = async () => {
    const starred = list.filter((q) => q.status === 'star')
    const incomplete = starred.filter((q) => ideaProblems(gameId, q).length > 0).length
    const lines = [
      `${def.name}: Die Spielliste (${inGame[gameId] ?? 0} Einträge) wird durch die ${starred.length} ⭐-Ideen ersetzt.`,
      incomplete ? `\n${incomplete} davon ${incomplete === 1 ? 'ist' : 'sind'} noch unvollständig (siehe Hinweise auf den Karten).` : '',
    ]
    if (!confirm(lines.join(''))) return
    try {
      await questionStore.save(gameId, starredToGame(list))
      setInGame((c) => ({ ...c, [gameId]: starred.length }))
      setMessage(`${starred.length} ⭐ stehen jetzt im Spiel.`)
    } catch (e) {
      setError(saveError(e))
    }
  }

  const pull = async () => {
    try {
      const entries = await questionStore.list(gameId)
      const merged = gameToIdeas(list, entries)
      change(() => merged)
      setMessage(merged.length > list.length ? `${merged.length - list.length} Einträge als ⭐ geholt.` : 'Alle Einträge aus dem Spiel stehen schon in der Sammlung.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spielfragen konnten nicht geladen werden')
    }
  }

  return (
    <div className="host collect">
      <header className="row">
        <h1 className="grow">Fragen sammeln</h1>
        <span className={`save-state ${save}`}>{save === 'saving' ? 'Speichert…' : save === 'saved' ? 'Gespeichert ✓' : save === 'error' ? 'Nicht gespeichert' : ''}</span>
        <a href="#/host">Regiepult</a>
      </header>
      {error && <p className="warn">{error}</p>}
      {local && <p className="hint">Lokaler Modus: Die Sammlung liegt nur in diesem Browser (keine Supabase-Zugangsdaten).</p>}

      <nav className="collect-games">
        {IDEA_GAMES.map((g) => {
          const n = countStatus(ideas[g.id] ?? [], 'star')
          return (
            <button
              key={g.id}
              className={g.id === gameId ? 'on' : ''}
              onClick={() => {
                setGameId(g.id)
                setMessage(null)
              }}
            >
              {gameDef(g.id).name}
              <small>
                ⭐ {n}
                {g.goal ? ` / ${g.goal}` : ''}
              </small>
            </button>
          )
        })}
      </nav>

      <section className="card collect-head">
        <div className="row tight">
          <span className="grow">
            <b>⭐ {stars}</b>
            {game.goal ? ` von ${game.goal}` : ''} · {list.length} {list.length === 1 ? 'Idee' : 'Ideen'}
          </span>
          {hasGameList(gameId) && <span className="hint">im Spiel: {inGame[gameId] ?? 0}</span>}
        </div>
        {game.goal && (
          <div className="collect-progress" aria-hidden>
            <span style={{ width: `${Math.min(100, (stars / game.goal) * 100)}%` }} className={stars > game.goal ? 'over' : ''} />
          </div>
        )}
        {game.goal && stars > game.goal && <p className="hint">{stars - game.goal} ⭐ mehr als nötig – Reserve oder aussortieren.</p>}
        {hasGameList(gameId) ? (
          <button className="primary" disabled={stars === 0} onClick={() => void takeOver()}>
            ⭐ ins Spiel übernehmen
          </button>
        ) : (
          <p className="hint">Dieses Spiel hat im Regiepult keine Liste. Die ⭐ sind dein Spickzettel für den Abend.</p>
        )}
        {game.perRound && <button onClick={() => setPrinting(true)}>Drucken / PDF</button>}
        {message && <p className="hint">{message}</p>}
      </section>

      <div className="seg collect-filter">
        {FILTERS.map(([key, text]) => (
          <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
            {text}
            <small>{key === 'all' ? list.length : countStatus(list, key === 'open' ? '' : key)}</small>
          </button>
        ))}
      </div>

      <QuickAdd key={gameId} gameId={gameId} onAdd={(qs) => change((all) => [...all, ...qs])} />

      {visible.length === 0 && <p className="hint collect-empty">{list.length ? 'Hier ist gerade nichts.' : `Noch keine Ideen. Mit + fügst du die erste ${label === 'Frage' ? 'Frage' : 'Idee'} hinzu.`}</p>}
      {visible.map((q, i) => (
        <Fragment key={q.id}>
          {/* in der ⭐-Ansicht ergeben sich die Runden aus der Reihenfolge */}
          {game.perRound && filter === 'star' && i % game.perRound === 0 && <h3 className="idea-round">Runde {i / game.perRound + 1}</h3>}
          <IdeaCard
            gameId={gameId}
            q={q}
            index={list.indexOf(q)}
            open={!collapsed.has(q.id)}
            first={i === 0}
            last={i === visible.length - 1}
            onToggle={() => toggle(q.id)}
            onStatus={(status) => update(q.id, { status: q.status === status ? undefined : status })}
            onMove={(dir) => move(q, dir)}
            onEdit={() => setEditing({ draft: q, isNew: false })}
          />
        </Fragment>
      ))}

      <h2>Mehr</h2>
      {hasGameList(gameId) && (
        <>
          <button onClick={() => void pull()}>Fragen aus dem Spiel in die Sammlung holen</button>
          <p className="hint">Holt, was schon im Regiepult steht, als ⭐ hierher. Doppelte kommen nicht nochmal.</p>
        </>
      )}
      <QuestionFiles onImported={() => setReload((n) => n + 1)} />

      <footer className="row">
        <span className="grow" />
        {!local && <button onClick={() => void signOutHost()}>Abmelden</button>}
      </footer>

      {!editing && !printing && (
        <button className="collect-fab" aria-label={`${label} hinzufügen`} onClick={() => setEditing({ draft: newQuestion({ note: '' }), isNew: true })}>
          +
        </button>
      )}

      {printing && game.perRound && <PrintTerms gameId={gameId} perRound={game.perRound} onClose={() => setPrinting(false)} />}

      {editing && (
        <IdeaSheet
          key={editing.draft.id}
          gameId={gameId}
          initial={editing.draft}
          isNew={editing.isNew}
          used={used}
          onSave={saveDraft}
          onDelete={() => remove(editing.draft)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/** Sammlung fürs Handy: Ideen je Spiel bewerten und die ⭐ ins Spiel übernehmen. Nur mit Host-Login. */
export default function Collect() {
  const session = useHostSession()
  if (session === 'loading') return <div className="host">Lade…</div>
  if (session === null) return <Login />
  return <CollectPage local={session === 'local'} />
}
