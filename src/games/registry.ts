import type { ComponentType } from 'react'
import type { Game, State } from '../store/types'
import type { GameKind } from './catalog'
import QuizEditor from './quiz/QuizEditor'
import QuizHost from './quiz/QuizHost'
import QuizScene from './quiz/QuizScene'

export interface KindModule {
  label: string
  /** Beamer-Ansicht der Spielseite */
  Scene?: ComponentType<{ state: State; game: Game }>
  /** Steuerung im Regiepult-Tab „Spiel“ */
  Host?: ComponentType<{ state: State; game: Game }>
  /** Editor für die eigenen Daten des Spiels */
  Editor?: ComponentType<{ gameId: string; onClose: () => void }>
  /** Beschriftung des Editor-Knopfs im Setup */
  dataLabel?: string
}

/** Spielarten: neue Spiele mit eigener Seite werden hier eingetragen, Show und Regiepult bleiben unverändert. */
export const KINDS: Record<GameKind, KindModule> = {
  plain: { label: 'Normal' },
  quiz: { label: 'Buzzer-Quiz', Scene: QuizScene, Host: QuizHost, Editor: QuizEditor, dataLabel: 'Fragen' },
}
