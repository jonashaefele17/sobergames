export interface ParsedQuestion {
  question: string
  answer: string
  info: string
}

/**
 * Liest eine eingefügte Liste: eine Frage pro Zeile, Spalten durch Tab (aus
 * Excel/Google Sheets kopiert) oder „|“ getrennt: Frage | Antwort | Zusatzinfo.
 * Leere Zeilen und eine Kopfzeile „Frage | Antwort …“ werden übersprungen.
 */
export function parseQuestions(text: string): ParsedQuestion[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.includes('\t') ? line.split('\t') : line.split('|')).map((part) => part.trim()))
    .filter(([first, second]) => !(/^(frage|ort|song)$/i.test(first ?? '') && /^antwort$/i.test(second ?? '')))
    .map(([question = '', answer = '', ...rest]) => ({ question, answer, info: rest.filter(Boolean).join(' | ') }))
    .filter((q) => q.question)
}
