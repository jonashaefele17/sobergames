import type { ComponentType } from 'react'
import type { Game, State } from '../store/types'
import type { GameKind } from './catalog'
import CountdownHost from './countdown/CountdownHost'
import CountdownScene from './countdown/CountdownScene'
import MeasureHost from './measure/MeasureHost'
import MeasureScene from './measure/MeasureScene'
import PromptHost from './prompt/PromptHost'
import PromptScene from './prompt/PromptScene'
import QuizEditor from './quiz/QuizEditor'
import QuizHost from './quiz/QuizHost'
import QuizScene from './quiz/QuizScene'
import ScoreHost from './score/ScoreHost'
import ScoreScene from './score/ScoreScene'
import StopwatchHost from './stopwatch/StopwatchHost'
import StopwatchScene from './stopwatch/StopwatchScene'

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
  score: { label: 'Punktetafel', Scene: ScoreScene, Host: ScoreHost },
  countdown: { label: 'Countdown', Scene: CountdownScene, Host: CountdownHost },
  stopwatch: { label: 'Stoppuhr', Scene: StopwatchScene, Host: StopwatchHost },
  prompt: { label: 'Fragenrunde', Scene: PromptScene, Host: PromptHost, Editor: QuizEditor, dataLabel: 'Fragen' },
  measure: { label: 'Messen', Scene: MeasureScene, Host: MeasureHost, Editor: QuizEditor, dataLabel: 'Objekte' },
}
