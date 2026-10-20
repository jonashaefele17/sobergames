import { useState } from 'react'
import { createQuestionExport, describeQuestionExport, parseQuestionExport, restoreQuestions } from '../lib/backup'
import { downloadJson, fileStamp } from '../lib/download'

/** Fragen exportieren und importieren, ohne den Spielstand anzufassen (Sammlung und Reset-Tab). */
export default function QuestionFiles({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const download = async () => {
    setBusy(true)
    try {
      const data = await createQuestionExport()
      downloadJson(`sobergames-fragen-${fileStamp(data.createdAt)}.json`, data)
      setMessage('Fragen heruntergeladen.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Export fehlgeschlagen')
    }
    setBusy(false)
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const data = parseQuestionExport(await file.text())
      if (confirm(`${describeQuestionExport(data)}\n\nEinspielen? Die Fragen dieser Spiele werden ersetzt. Spielstand und Teams bleiben.`)) {
        await restoreQuestions(data)
        setMessage('Fragen eingespielt.')
        onImported?.()
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Einspielen fehlgeschlagen')
    }
    setBusy(false)
  }

  return (
    <>
      <div className="row">
        <button disabled={busy} onClick={() => void download()}>
          Fragen exportieren
        </button>
        <label className={`file-btn${busy ? ' disabled' : ''}`}>
          Fragen importieren
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              void restore(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {message && <p className="hint">{message}</p>}
    </>
  )
}
