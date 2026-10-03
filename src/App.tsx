import { lazy, Suspense, useSyncExternalStore } from 'react'
import Show from './Show.tsx'

const Host = lazy(() => import('./host/Host.tsx'))
const TeamPhone = lazy(() => import('./buzzer/TeamPhone.tsx'))

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

// Ansichten: `/` für den Beamer, `/#/host` für das Regiepult, `/#/buzz/<code>` für die Team-Handys
export default function App() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash)
  if (hash.startsWith('#/buzz/')) {
    return (
      <Suspense fallback={null}>
        <TeamPhone token={decodeURIComponent(hash.slice('#/buzz/'.length))} />
      </Suspense>
    )
  }
  if (hash.startsWith('#/host')) {
    return (
      <Suspense fallback={null}>
        <Host />
      </Suspense>
    )
  }
  return <Show />
}
