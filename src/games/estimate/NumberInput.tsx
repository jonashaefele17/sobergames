import { useLayoutEffect, useRef, type CSSProperties, type InputHTMLAttributes } from 'react'
import { formatNumber, groupDigits, parseNumber } from './logic'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> & {
  value: string
  onChange: (text: string) => void
}

const counted = (text: string) => text.replace(/[^\d,]/g, '').length

/**
 * Zahlenfeld, das beim Tippen Tausenderpunkte setzt („84000000“ → „84.000.000“).
 * Die Schreibmarke bleibt dabei an ihrer Stelle; ein getippter Punkt gilt als Komma.
 */
export default function NumberInput({ value, onChange, onFocus, style, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  /** Ziffern rechts der Schreibmarke, die nach dem Formatieren wieder rechts von ihr stehen sollen */
  const pending = useRef<number | null>(null)

  /** setzt die Schreibmarke so, dass rechts von ihr wieder `right` Ziffern stehen; im Zweifel links vom Punkt */
  const place = (text: string, right: number) => {
    let pos = text.length
    for (let seen = 0; pos > 0 && seen < right; pos--) {
      if (/[\d,]/.test(text[pos - 1])) seen++
    }
    if (text[pos - 1] === '.') pos--
    ref.current?.setSelectionRange(pos, pos)
  }

  useLayoutEffect(() => {
    if (pending.current === null) return
    place(value, pending.current)
    pending.current = null
  })

  return (
    <input
      {...rest}
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      style={{ ...style, '--len': Math.max(1, value.length) } as CSSProperties}
      onFocus={(e) => {
        // ältere Einträge in anderer Schreibweise („1250.5“) einmal vereinheitlichen
        const n = parseNumber(value)
        if (n !== null && groupDigits(value) !== value) onChange(formatNumber(n))
        onFocus?.(e)
      }}
      onChange={(e) => {
        let raw = e.target.value
        let caret = e.target.selectionStart ?? raw.length
        const { data, inputType } = e.nativeEvent as InputEvent
        if (data === '.' && caret > 0) raw = `${raw.slice(0, caret - 1)},${raw.slice(caret)}`
        // nur ein Tausenderpunkt gelöscht: stattdessen die Ziffer daneben löschen
        if (groupDigits(raw) === value && inputType === 'deleteContentBackward' && caret > 0) {
          raw = raw.slice(0, caret - 1) + raw.slice(caret)
          caret--
        } else if (groupDigits(raw) === value && inputType === 'deleteContentForward') {
          raw = raw.slice(0, caret) + raw.slice(caret + 1)
        }
        const next = groupDigits(raw)
        const right = counted(raw.slice(caret))
        if (next === value) {
          // nichts geändert (z. B. Buchstabe getippt): React setzt das Feld zurück, die Marke danach wieder hin
          requestAnimationFrame(() => place(value, right))
          return
        }
        pending.current = right
        onChange(next)
      }}
    />
  )
}
