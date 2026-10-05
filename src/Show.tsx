import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Backdrop } from './components/shared'
import { EASE_OUT } from './lib/motion'
import { enableSound, toggleSound } from './lib/sound'
import { GamesScene, ScoreboardScene, TeamsScene, WinnerScene } from './scenes/Scenes'
import WheelScene from './scenes/Wheel'
import { useBuzzer } from './buzzer'
import { BuzzerOverlay } from './buzzer/BuzzerOverlay'
import { gameKind, playingGame } from './games/catalog'
import { KINDS } from './games/registry'
import { useGame } from './store'
import type { State } from './store/types'

// three.js nur laden, wenn das Intro wirklich gezeigt wird
const Intro = lazy(() => import('./scenes/Intro/Intro'))

function SceneView({ state, buzzerOn }: { state: State; buzzerOn: boolean }) {
  switch (state.scene) {
    case 'intro':
      return (
        <Suspense fallback={null}>
          <Intro />
        </Suspense>
      )
    case 'wheel':
      return <WheelScene state={state} />
    case 'teams':
      return <TeamsScene state={state} />
    case 'games':
      return <GamesScene state={state} hideTicker={buzzerOn} />
    case 'scoreboard':
      return <ScoreboardScene state={state} />
    case 'winner':
      return <WinnerScene state={state} />
    case 'play': {
      const game = playingGame(state)
      const Scene = game ? KINDS[gameKind(game)].Scene : undefined
      return game && Scene ? <Scene state={state} game={game} /> : <GamesScene state={state} hideTicker={buzzerOn} />
    }
  }
}

/** Beamer-Ansicht: zeigt nur, was der Host vorgibt. F = Vollbild, S = Ton an/aus. */
export default function Show() {
  const { ready, state } = useGame()
  const buzzer = useBuzzer().state
  // Der Buzzer erscheint nur auf der Spielseite eines Buzzer-Spiels, dort aber dauerhaft
  const playing = state.scene === 'play' ? playingGame(state) : undefined
  const buzzerOn = playing !== undefined && gameKind(playing) === 'quiz'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }
      // jede andere Taste schaltet den Ton ein (Browser brauchen dafür eine Eingabe), S schaltet um
      if (e.key === 's' || e.key === 'S') toggleSound()
      else enableSound()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', enableSound)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', enableSound)
    }
  }, [])

  return (
    <div className={`show${buzzerOn ? ' buzzer-on' : ''}`}>
      <Backdrop />
      <AnimatePresence mode="wait">
        {ready && (
          <motion.div
            key={state.scene === 'intro' ? `intro-${state.introNonce}` : state.scene === 'play' ? `play-${state.play.gameId}` : state.scene}
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.55, ease: EASE_OUT }}
          >
            <SceneView state={state} buzzerOn={buzzerOn} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{ready && buzzerOn && <BuzzerOverlay key="buzzer" state={state} buzzer={buzzer} />}</AnimatePresence>
    </div>
  )
}
