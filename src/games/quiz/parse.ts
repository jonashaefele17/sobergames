export interface ParsedQuestion {
  question: string
  answer: string
  info: string
}

/**
 * Liest eine eingefügte Liste: eine Zeile pro Eintrag, Spalten durch Tab (aus
 * Excel/Google Sheets kopiert) oder „|“ getrennt: Frage | Antwort | Zusatzinfo.
 * Leere Zeilen und eine Kopfzeile „Frage | Antwort …“ werden übersprungen.
 *
 * Mit `answerOnly` gibt es keine Frage: Lösung | Zusatzinfo (z. B. Orte, die
 * über Hinweise erraten werden).
 */
export function parseQuestions(text: string, answerOnly = false): ParsedQuestion[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.includes('\t') ? line.split('\t') : line.split('|')).map((part) => part.trim()))

  if (answerOnly) {
    return rows
      .filter(([first]) => !/^(ort|lösung|antwort)$/i.test(first ?? ''))
      .map(([answer = '', ...rest]) => ({ question: '', answer, info: rest.filter(Boolean).join(' | ') }))
      .filter((q) => q.answer)
  }
  return rows
    .filter(([first, second]) => !(/^(frage|ort|song)$/i.test(first ?? '') && /^antwort$/i.test(second ?? '')))
    .map(([question = '', answer = '', ...rest]) => ({ question, answer, info: rest.filter(Boolean).join(' | ') }))
    .filter((q) => q.question)
}
