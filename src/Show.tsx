import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Backdrop } from './components/shared'
import { EASE_OUT } from './lib/motion'
import { toggleSound } from './lib/sound'
import { GamesScene, ScoreboardScene, TeamsScene, WinnerScene } from './scenes/Scenes'
import WheelScene from './scenes/Wheel'
import { useBuzzer } from './buzzer'
import { BuzzerOverlay } from './buzzer/BuzzerOverlay'
import { gameDef } from './games/catalog'
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
      const game = state.games.find((g) => g.id === state.play.gameId)
      const Scene = game ? KINDS[gameDef(game.id).kind].Scene : undefined
      return game && Scene ? <Scene state={state} game={game} /> : <GamesScene state={state} hideTicker={buzzerOn} />
    }
  }
}

/** Beamer-Ansicht: zeigt nur, was der Host vorgibt. F = Vollbild, S = Ton an/aus. */
export default function Show() {
  const { ready, state } = useGame()
  const buzzer = useBuzzer().state
  // auf der Spielseite eines Buzzer-Spiels bleibt der Rundenstand stehen, auch wenn der Buzzer kurz pausiert
  const playKind = state.scene === 'play' && state.play.gameId ? gameDef(state.play.gameId).kind : null
  const pinned = playKind === 'quiz'
  const buzzerOn = buzzer.armed || pinned

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }
      if (e.key === 's' || e.key === 'S') toggleSound()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
      {ready && <BuzzerOverlay state={state} buzzer={buzzer} pinned={pinned} />}
    </div>
  )
}
