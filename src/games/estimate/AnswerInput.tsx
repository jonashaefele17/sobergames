import type { InputHTMLAttributes } from 'react'
import NumberInput from './NumberInput'
import { maskDate, maskYear, type AnswerFormat } from './logic'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> & {
  format?: AnswerFormat
  value: string
  onChange: (text: string) => void
}

const PLACEHOLDER: Record<AnswerFormat, string> = { number: 'Zahl eingeben', year: 'z. B. 1989', date: 'TT.MM.JJJJ' }

/** Eingabe einer Lösung oder Schätzung im Format der Frage: Zahl mit Tausenderpunkten, Jahr oder Datum. */
export default function AnswerInput({ format = 'number', placeholder, ...rest }: Props) {
  if (format === 'number') return <NumberInput placeholder={placeholder ?? PLACEHOLDER.number} {...rest} />
  const mask = format === 'date' ? maskDate : maskYear
  const { value, onChange, ...input } = rest
  return (
    <input
      {...input}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? PLACEHOLDER[format]}
      value={value}
      onChange={(e) => onChange(mask(e.target.value))}
    />
  )
}
